import { useMemo, useState } from 'react'
import { useAuth } from '../AuthContext'
import {
  listarTransacciones, crearTransacciones, actualizarTransaccion, eliminarTransaccion, listarReservas,
} from '../supabaseClient'
import {
  Badge, Modal, Confirmar, Vacio, Cargando, Alerta, useLista, descargarCSV,
  cop, fechaCorta, hoyISO, errorAmigable,
} from './ui'

const CAT_INGRESO = ['Reservas', 'Venta de productos', 'Alquiler de equipo', 'Otros ingresos']
const CAT_GASTO = [
  'Compra de inventario', 'Mantenimiento', 'Nómina', 'Servicios públicos',
  'Arriendo', 'Marketing', 'Impuestos', 'Otros gastos',
]
const METODOS = ['Efectivo', 'Transferencia', 'Nequi', 'Daviplata', 'Tarjeta', 'Otro']

const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function rangoPreset(p) {
  const hoy = new Date()
  const y = hoy.getFullYear()
  const m = hoy.getMonth()
  if (p === 'mes') return { desde: iso(new Date(y, m, 1)), hasta: iso(new Date(y, m + 1, 0)) }
  if (p === 'mes_ant') return { desde: iso(new Date(y, m - 1, 1)), hasta: iso(new Date(y, m, 0)) }
  if (p === 'trimestre') return { desde: iso(new Date(y, m - 2, 1)), hasta: iso(new Date(y, m + 1, 0)) }
  if (p === 'anio') return { desde: `${y}-01-01`, hasta: `${y}-12-31` }
  return { desde: '', hasta: '' }
}

const abreviar = (n) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(Math.round(n))

// Solo administrador (la base de datos también lo exige con RLS).
export default function Contabilidad() {
  const { user } = useAuth()
  const trans = useLista(listarTransacciones)
  const res = useLista(listarReservas)
  const [preset, setPreset] = useState('mes')
  const [rango, setRango] = useState(rangoPreset('mes'))
  const [tipoFiltro, setTipoFiltro] = useState('todos')
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(null) // { trans? , tipo? }
  const [borrar, setBorrar] = useState(null)
  const [ok, setOk] = useState('')
  const [err, setErr] = useState('')
  const [registrando, setRegistrando] = useState(false)

  const cambiarPreset = (p) => {
    setPreset(p)
    if (p !== 'personalizado') setRango(rangoPreset(p))
  }

  const enRango = useMemo(
    () => trans.datos.filter((t) => (!rango.desde || t.fecha >= rango.desde) && (!rango.hasta || t.fecha <= rango.hasta)),
    [trans.datos, rango],
  )

  const resumen = useMemo(() => {
    const ingresos = enRango.filter((t) => t.tipo === 'ingreso').reduce((a, t) => a + Number(t.monto), 0)
    const gastos = enRango.filter((t) => t.tipo === 'gasto').reduce((a, t) => a + Number(t.monto), 0)
    const utilidad = ingresos - gastos
    const porCat = (tipo) => {
      const m = {}
      enRango.filter((t) => t.tipo === tipo).forEach((t) => { m[t.categoria] = (m[t.categoria] || 0) + Number(t.monto) })
      return Object.entries(m).sort((a, b) => b[1] - a[1])
    }
    const meses = {}
    enRango.forEach((t) => {
      const k = t.fecha.slice(0, 7)
      meses[k] = meses[k] || { clave: k, ingresos: 0, gastos: 0 }
      meses[k][t.tipo === 'ingreso' ? 'ingresos' : 'gastos'] += Number(t.monto)
    })
    return {
      ingresos, gastos, utilidad,
      margen: ingresos > 0 ? (utilidad / ingresos) * 100 : null,
      catIngreso: porCat('ingreso'), catGasto: porCat('gasto'),
      meses: Object.values(meses).sort((a, b) => a.clave.localeCompare(b.clave)).slice(-12),
    }
  }, [enRango])

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return enRango.filter((t) =>
      (tipoFiltro === 'todos' || t.tipo === tipoFiltro) &&
      (!q || [t.descripcion, t.categoria, t.metodo_pago].some((v) => String(v || '').toLowerCase().includes(q))))
  }, [enRango, tipoFiltro, busca])

  // Reservas confirmadas/completadas que todavía no están registradas como ingreso
  const registradas = useMemo(() => new Set(trans.datos.map((t) => t.reserva_id).filter(Boolean)), [trans.datos])
  const pendientes = useMemo(
    () => res.datos.filter((r) => ['confirmada', 'completada'].includes(r.estado) && Number(r.total) > 0 && !registradas.has(String(r.id))),
    [res.datos, registradas],
  )
  const totalPendiente = pendientes.reduce((a, r) => a + Number(r.total), 0)

  const filaIngreso = (r) => ({
    tipo: 'ingreso', categoria: 'Reservas', monto: Number(r.total), fecha: r.fecha || hoyISO(),
    descripcion: `Reserva de ${r.cliente} — ${r.paquete || 'paquete'} (${r.jugadores} jugadores)`,
    reserva_id: String(r.id), user_id: user.id,
  })

  const registrarReservas = async (lista) => {
    setRegistrando(true)
    setErr('')
    const r = await crearTransacciones(lista.map(filaIngreso))
    setRegistrando(false)
    if (!r.ok) return setErr(errorAmigable(r.error))
    setOk(`${lista.length} ingreso${lista.length === 1 ? '' : 's'} registrado${lista.length === 1 ? '' : 's'}.`)
    trans.recargar()
  }

  const confirmarBorrado = async () => {
    const r = await eliminarTransaccion(borrar.id)
    setBorrar(null)
    if (!r.ok) setErr(errorAmigable(r.error))
    else { setOk('Movimiento eliminado.'); trans.recargar() }
  }

  return (
    <div>
      <div className="pn-toolbar">
        <div className="pn-chips">
          {[['mes', 'Este mes'], ['mes_ant', 'Mes anterior'], ['trimestre', '3 meses'], ['anio', 'Este año'], ['todo', 'Todo'], ['personalizado', 'Personalizado']].map(([k, l]) => (
            <button key={k} type="button" className={preset === k ? 'on' : ''} onClick={() => cambiarPreset(k)}>{l}</button>
          ))}
        </div>
        {preset === 'personalizado' && (
          <div className="pn-dates">
            <input type="date" className="pn-select" value={rango.desde} onChange={(e) => setRango({ ...rango, desde: e.target.value })} />
            <span>a</span>
            <input type="date" className="pn-select" value={rango.hasta} onChange={(e) => setRango({ ...rango, hasta: e.target.value })} />
          </div>
        )}
      </div>

      <Alerta onClose={() => setErr('')}>{err || trans.error}</Alerta>
      <Alerta tipo="ok" onClose={() => setOk('')}>{ok}</Alerta>

      {trans.cargando ? <Cargando /> : (
        <>
          <div className="pn-stats pn-stats-sm">
            <div className="pn-stat pn-stat-good"><span>Ingresos</span><strong>{cop(resumen.ingresos)}</strong></div>
            <div className="pn-stat pn-stat-bad"><span>Gastos</span><strong>{cop(resumen.gastos)}</strong></div>
            <div className={`pn-stat ${resumen.utilidad >= 0 ? 'pn-stat-good' : 'pn-stat-bad'}`}>
              <span>Utilidad</span><strong>{cop(resumen.utilidad)}</strong>
            </div>
            <div className="pn-stat"><span>Margen</span><strong>{resumen.margen === null ? '—' : `${resumen.margen.toFixed(1)}%`}</strong></div>
          </div>

          {pendientes.length > 0 && (
            <div className="pn-hint-box pn-hint-col">
              <div>
                <strong>{pendientes.length} reserva{pendientes.length === 1 ? '' : 's'} confirmada{pendientes.length === 1 ? '' : 's'} sin registrar como ingreso</strong>
                {' '}({cop(totalPendiente)}). Regístralas para que cuenten en tu contabilidad.
              </div>
              <ul className="pn-pend">
                {pendientes.slice(0, 5).map((r) => (
                  <li key={r.id}>
                    <span>{r.cliente} · {fechaCorta(r.fecha)} · <strong>{cop(r.total)}</strong></span>
                    <button type="button" className="pn-btn pn-btn-sm" disabled={registrando} onClick={() => registrarReservas([r])}>Registrar</button>
                  </li>
                ))}
                {pendientes.length > 5 && <li className="pn-more">y {pendientes.length - 5} más…</li>}
              </ul>
              <button type="button" className="pn-btn pn-btn-sm pn-btn-primary" disabled={registrando} onClick={() => registrarReservas(pendientes)}>
                {registrando ? 'Registrando…' : `Registrar todas (${pendientes.length})`}
              </button>
            </div>
          )}

          <div className="pn-panels">
            <section className="pn-panel">
              <h3>Ingresos vs. gastos por mes</h3>
              {resumen.meses.length ? <GraficoMensual meses={resumen.meses} /> : <Vacio texto="Sin movimientos en este periodo." />}
            </section>
            <section className="pn-panel">
              <h3>Gastos por categoría</h3>
              <Barras datos={resumen.catGasto} total={resumen.gastos} color="gasto" />
              <h3 className="pn-h3-gap">Ingresos por categoría</h3>
              <Barras datos={resumen.catIngreso} total={resumen.ingresos} color="ingreso" />
            </section>
          </div>

          <div className="pn-toolbar">
            <input className="pn-search" placeholder="Buscar por descripción, categoría…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <select className="pn-select" value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)}>
              <option value="todos">Ingresos y gastos</option>
              <option value="ingreso">Solo ingresos</option>
              <option value="gasto">Solo gastos</option>
            </select>
            <button
              type="button" className="pn-btn pn-btn-ghost"
              onClick={() => descargarCSV('contabilidad.csv', visibles.map((t) => ({
                fecha: t.fecha, tipo: t.tipo, categoria: t.categoria, descripcion: t.descripcion,
                metodo_pago: t.metodo_pago, monto: t.monto,
              })))}
            >
              Exportar CSV
            </button>
            <button type="button" className="pn-btn pn-btn-danger" onClick={() => { setErr(''); setModal({ tipo: 'gasto' }) }}>− Gasto</button>
            <button type="button" className="pn-btn pn-btn-primary" onClick={() => { setErr(''); setModal({ tipo: 'ingreso' }) }}>+ Ingreso</button>
          </div>

          {!visibles.length ? <Vacio texto={trans.datos.length ? 'No hay movimientos con ese filtro.' : 'Aún no hay movimientos contables.'} /> : (
            <div className="pn-table-wrap pn-scroll">
              <table className="pn-table">
                <thead>
                  <tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Descripción</th><th>Método</th><th className="pn-num">Monto</th><th></th></tr>
                </thead>
                <tbody>
                  {visibles.map((t) => (
                    <tr key={t.id}>
                      <td>{fechaCorta(t.fecha)}</td>
                      <td><Badge valor={t.tipo} /></td>
                      <td>{t.categoria}</td>
                      <td>{t.descripcion || '—'}</td>
                      <td>{t.metodo_pago || '—'}</td>
                      <td className="pn-num"><strong className={t.tipo === 'ingreso' ? 'pn-pos' : 'pn-neg'}>{t.tipo === 'ingreso' ? '+' : '−'}{cop(t.monto)}</strong></td>
                      <td className="pn-row-actions">
                        <button type="button" className="pn-btn pn-btn-sm" onClick={() => { setErr(''); setModal({ trans: t }) }}>Editar</button>
                        <button type="button" className="pn-btn pn-btn-sm pn-btn-danger" onClick={() => setBorrar(t)}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {modal && (
        <TransModal
          datos={modal.trans} tipoInicial={modal.tipo} userId={user.id}
          onClose={() => setModal(null)}
          onGuardado={(m) => { setModal(null); setOk(m); trans.recargar() }}
        />
      )}
      {borrar && (
        <Confirmar
          mensaje={`¿Eliminar este ${borrar.tipo} de ${cop(borrar.monto)}${borrar.descripcion ? ` (${borrar.descripcion})` : ''}?`}
          onSi={confirmarBorrado} onNo={() => setBorrar(null)}
        />
      )}
    </div>
  )
}

function Barras({ datos, total, color }) {
  if (!datos.length) return <p className="pn-note">Sin datos en este periodo.</p>
  return (
    <ul className="pn-hbars">
      {datos.map(([cat, v]) => (
        <li key={cat}>
          <div className="pn-hbar-top"><span>{cat}</span><strong>{cop(v)} <em>{total ? Math.round((v / total) * 100) : 0}%</em></strong></div>
          <div className="pn-hbar"><i className={`pn-hbar-${color}`} style={{ width: `${total ? (v / total) * 100 : 0}%` }} /></div>
        </li>
      ))}
    </ul>
  )
}

function GraficoMensual({ meses }) {
  const W = 560, H = 230, L = 46, B = 28, T = 14
  const max = Math.max(1, ...meses.flatMap((m) => [m.ingresos, m.gastos]))
  const alto = H - B - T
  const ancho = W - L - 8
  const grupo = ancho / meses.length
  const bw = Math.min(26, grupo / 2.6)
  const y = (v) => T + alto - (v / max) * alto
  const etiqueta = (k) => {
    const [a, m] = k.split('-')
    return new Date(Number(a), Number(m) - 1, 1).toLocaleDateString('es-CO', { month: 'short' }).replace('.', '')
  }
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="pn-chart" role="img" aria-label="Ingresos y gastos por mes">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - 8} y1={y(max * f)} y2={y(max * f)} className="pn-grid" />
            <text x={L - 6} y={y(max * f) + 4} textAnchor="end" className="pn-axis">${abreviar(max * f)}</text>
          </g>
        ))}
        {meses.map((m, i) => {
          const cx = L + grupo * i + grupo / 2
          return (
            <g key={m.clave}>
              <rect x={cx - bw - 1} y={y(m.ingresos)} width={bw} height={Math.max(0, T + alto - y(m.ingresos))} rx="3" className="pn-bar-ingreso"><title>Ingresos: {cop(m.ingresos)}</title></rect>
              <rect x={cx + 1} y={y(m.gastos)} width={bw} height={Math.max(0, T + alto - y(m.gastos))} rx="3" className="pn-bar-gasto"><title>Gastos: {cop(m.gastos)}</title></rect>
              <text x={cx} y={H - 9} textAnchor="middle" className="pn-axis">{etiqueta(m.clave)}</text>
            </g>
          )
        })}
      </svg>
      <div className="pn-legend"><span><i className="pn-bar-ingreso" /> Ingresos</span><span><i className="pn-bar-gasto" /> Gastos</span></div>
    </div>
  )
}

function TransModal({ datos, tipoInicial, userId, onClose, onGuardado }) {
  const editando = !!datos
  const [f, setF] = useState({
    tipo: datos?.tipo || tipoInicial || 'gasto', categoria: datos?.categoria || '',
    descripcion: datos?.descripcion || '', monto: datos?.monto ?? '', fecha: datos?.fecha || hoyISO(),
    metodo_pago: datos?.metodo_pago || '',
  })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const cats = f.tipo === 'ingreso' ? CAT_INGRESO : CAT_GASTO
  const cambiar = (e) => setF((p) => ({ ...p, [e.target.name]: e.target.value }))

  const guardar = async (e) => {
    e.preventDefault()
    if (!f.categoria) return setError('Elige una categoría.')
    if (!(Number(f.monto) > 0)) return setError('El monto debe ser mayor a 0.')
    if (!f.fecha) return setError('Elige la fecha.')
    setGuardando(true)
    const payload = {
      tipo: f.tipo, categoria: f.categoria, descripcion: f.descripcion.trim() || null,
      monto: Number(f.monto), fecha: f.fecha, metodo_pago: f.metodo_pago || null,
    }
    const r = editando ? await actualizarTransaccion(datos.id, payload) : (await crearTransacciones([{ ...payload, user_id: userId }]))
    setGuardando(false)
    if (!r.ok) return setError(errorAmigable(r.error))
    onGuardado(editando ? 'Movimiento actualizado.' : f.tipo === 'ingreso' ? 'Ingreso registrado.' : 'Gasto registrado.')
  }

  return (
    <Modal titulo={editando ? 'Editar movimiento' : f.tipo === 'ingreso' ? 'Nuevo ingreso' : 'Nuevo gasto'} onClose={onClose} ancho={560}>
      <form className="pn-form" onSubmit={guardar}>
        <Alerta onClose={() => setError('')}>{error}</Alerta>
        {datos?.reserva_id && <p className="pn-note">Este ingreso viene de una reserva. Puedes ajustar el monto si cobraste algo distinto.</p>}
        <div className="pn-seg">
          {['ingreso', 'gasto'].map((t) => (
            <button key={t} type="button" className={f.tipo === t ? `on on-${t}` : ''} disabled={editando && !!datos?.reserva_id && t !== 'ingreso'}
              onClick={() => setF((p) => ({ ...p, tipo: t, categoria: '' }))}>
              {t === 'ingreso' ? '＋ Ingreso' : '− Gasto'}
            </button>
          ))}
        </div>
        <div className="pn-grid-2">
          <label>Categoría
            <select name="categoria" value={f.categoria} onChange={cambiar}>
              <option value="">Selecciona…</option>
              {[...new Set([...(f.categoria && !cats.includes(f.categoria) ? [f.categoria] : []), ...cats])].map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>Fecha
            <input type="date" name="fecha" value={f.fecha} onChange={cambiar} />
          </label>
          <label>Monto (COP)
            <input type="number" min="0" step="any" name="monto" value={f.monto} onChange={cambiar} autoFocus />
          </label>
          <label>Método de pago
            <select name="metodo_pago" value={f.metodo_pago} onChange={cambiar}>
              <option value="">—</option>
              {METODOS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <label>Descripción
          <textarea name="descripcion" rows="2" value={f.descripcion} onChange={cambiar} placeholder="Ej: Pago de luz de octubre" />
        </label>
        <div className="pn-actions">
          <button type="button" className="pn-btn pn-btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="pn-btn pn-btn-primary" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  )
}
