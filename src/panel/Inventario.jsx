import { useMemo, useState } from 'react'
import { useAuth } from '../AuthContext'
import {
  listarProductos, crearProducto, actualizarProducto, eliminarProducto,
  listarMovimientos, crearMovimiento,
} from '../supabaseClient'
import {
  Badge, Modal, Confirmar, Vacio, Cargando, Alerta, useLista, descargarCSV,
  cop, num, fechaHora, errorAmigable,
} from './ui'

export const CATEGORIAS_PRODUCTO = [
  'Bolas de pintura', 'Gas / CO2', 'Marcadoras y repuestos', 'Protección',
  'Uniformes', 'Snacks y bebidas', 'Mantenimiento', 'Otros',
]
const UNIDADES = ['unidad', 'caja', 'paquete', 'tanque', 'libra', 'kg', 'litro']
const MOTIVOS = {
  entrada: ['Compra a proveedor', 'Devolución', 'Donación', 'Otro'],
  salida: ['Uso en partida', 'Venta', 'Merma / daño', 'Pérdida', 'Otro'],
  ajuste: ['Conteo físico', 'Corrección de inventario'],
}
const SUGERIDOS = [
  { nombre: 'Bolas de pintura (caja x2000)', categoria: 'Bolas de pintura', unidad: 'caja', stock_minimo: 5 },
  { nombre: 'Tanque de CO2', categoria: 'Gas / CO2', unidad: 'tanque', stock_minimo: 2 },
  { nombre: 'Máscaras de protección', categoria: 'Protección', unidad: 'unidad', stock_minimo: 5 },
  { nombre: 'Chalecos', categoria: 'Protección', unidad: 'unidad', stock_minimo: 5 },
  { nombre: 'Overoles', categoria: 'Uniformes', unidad: 'unidad', stock_minimo: 5 },
  { nombre: 'Marcadoras (repuestos)', categoria: 'Marcadoras y repuestos', unidad: 'unidad', stock_minimo: 3 },
  { nombre: 'Gaseosas y bebidas', categoria: 'Snacks y bebidas', unidad: 'paquete', stock_minimo: 4 },
  { nombre: 'Snacks', categoria: 'Snacks y bebidas', unidad: 'paquete', stock_minimo: 4 },
]

export const estadoStock = (p) =>
  Number(p.stock) <= 0 ? 'agotado' : Number(p.stock) <= Number(p.stock_minimo) ? 'bajo' : 'ok'
const TEXTO_ESTADO = { agotado: 'Agotado', bajo: 'Stock bajo', ok: 'En stock' }

// Administrador: CRUD completo de productos + movimientos.
// Soporte: ve el inventario y registra movimientos (entradas, salidas, ajustes).
export default function Inventario() {
  const { esAdmin } = useAuth()
  const prod = useLista(listarProductos)
  const mov = useLista(listarMovimientos)
  const [vista, setVista] = useState('productos')
  const [busca, setBusca] = useState('')
  const [cat, setCat] = useState('todas')
  const [soloBajo, setSoloBajo] = useState(false)
  const [modalProd, setModalProd] = useState(null) // { producto? }
  const [modalMov, setModalMov] = useState(null) // { producto }
  const [borrar, setBorrar] = useState(null)
  const [ok, setOk] = useState('')
  const [err, setErr] = useState('')
  const [filtroMov, setFiltroMov] = useState({ producto: 'todos', tipo: 'todos' })

  const productos = prod.datos
  const stats = useMemo(() => {
    const act = productos.filter((p) => p.activo)
    return {
      total: act.length,
      valor: act.reduce((a, p) => a + Number(p.stock) * Number(p.costo_unitario), 0),
      bajos: act.filter((p) => estadoStock(p) === 'bajo').length,
      agotados: act.filter((p) => estadoStock(p) === 'agotado').length,
    }
  }, [productos])

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return productos.filter((p) => {
      if (cat !== 'todas' && p.categoria !== cat) return false
      if (soloBajo && !(p.activo && estadoStock(p) !== 'ok')) return false
      return !q || p.nombre.toLowerCase().includes(q)
    })
  }, [productos, busca, cat, soloBajo])

  const movVisibles = useMemo(
    () => mov.datos.filter((m) =>
      (filtroMov.producto === 'todos' || String(m.producto_id) === filtroMov.producto) &&
      (filtroMov.tipo === 'todos' || m.tipo === filtroMov.tipo)),
    [mov.datos, filtroMov],
  )
  const nombreProd = (id) => productos.find((p) => p.id === id)?.nombre || `#${id}`
  const unidadProd = (id) => productos.find((p) => p.id === id)?.unidad || ''

  const recargar = () => { prod.recargar(); mov.recargar() }

  const confirmarBorrado = async () => {
    const res = await eliminarProducto(borrar.id)
    setBorrar(null)
    if (!res.ok) setErr(errorAmigable(res.error))
    else { setOk('Producto eliminado.'); recargar() }
  }

  const cargarSugeridos = async () => {
    setErr('')
    let creados = 0
    for (const s of SUGERIDOS) {
      const r = await crearProducto({ ...s, costo_unitario: 0 })
      if (r.ok) creados++
    }
    setOk(`${creados} productos agregados. Registra una entrada para cargar su stock y edita sus costos.`)
    recargar()
  }

  return (
    <div>
      <div className="pn-stats pn-stats-sm">
        <div className="pn-stat"><span>Productos activos</span><strong>{stats.total}</strong></div>
        <div className="pn-stat"><span>Valor del inventario</span><strong>{cop(stats.valor)}</strong></div>
        <div className={`pn-stat ${stats.bajos ? 'pn-stat-warn' : ''}`}><span>Stock bajo</span><strong>{stats.bajos}</strong></div>
        <div className={`pn-stat ${stats.agotados ? 'pn-stat-bad' : ''}`}><span>Agotados</span><strong>{stats.agotados}</strong></div>
      </div>

      <div className="pn-subtabs">
        <button type="button" className={vista === 'productos' ? 'on' : ''} onClick={() => setVista('productos')}>Productos</button>
        <button type="button" className={vista === 'movimientos' ? 'on' : ''} onClick={() => setVista('movimientos')}>Movimientos (kardex)</button>
      </div>

      <Alerta onClose={() => setErr('')}>{err || prod.error}</Alerta>
      <Alerta tipo="ok" onClose={() => setOk('')}>{ok}</Alerta>

      {vista === 'productos' ? (
        <>
          <div className="pn-toolbar">
            <input className="pn-search" placeholder="Buscar producto…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <select className="pn-select" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="todas">Todas las categorías</option>
              {CATEGORIAS_PRODUCTO.map((c) => <option key={c}>{c}</option>)}
            </select>
            <label className="pn-inline-check">
              <input type="checkbox" checked={soloBajo} onChange={(e) => setSoloBajo(e.target.checked)} /> Solo stock bajo
            </label>
            <span className="pn-spacer" />
            {esAdmin && (
              <button type="button" className="pn-btn pn-btn-primary" onClick={() => { setErr(''); setModalProd({}) }}>
                + Nuevo producto
              </button>
            )}
          </div>

          {prod.cargando ? <Cargando /> : !visibles.length ? (
            <Vacio texto={productos.length ? 'No hay productos con ese filtro.' : 'Aún no hay productos en el inventario.'} />
          ) : (
            <div className="pn-table-wrap pn-scroll">
              <table className="pn-table">
                <thead>
                  <tr><th>Producto</th><th className="pn-num">Stock</th><th className="pn-num">Mínimo</th><th className="pn-num">Costo unit.</th><th className="pn-num">Valor</th><th>Estado</th><th></th></tr>
                </thead>
                <tbody>
                  {visibles.map((p) => {
                    const est = p.activo ? estadoStock(p) : 'inactivo'
                    return (
                      <tr key={p.id} className={p.activo ? '' : 'pn-row-off'}>
                        <td><strong>{p.nombre}</strong><small>{p.categoria}</small></td>
                        <td className="pn-num"><strong>{num(p.stock)}</strong> <small className="pn-inline">{p.unidad}</small></td>
                        <td className="pn-num">{num(p.stock_minimo)}</td>
                        <td className="pn-num">{cop(p.costo_unitario)}</td>
                        <td className="pn-num">{cop(Number(p.stock) * Number(p.costo_unitario))}</td>
                        <td><Badge valor={est} texto={TEXTO_ESTADO[est] || 'Inactivo'} /></td>
                        <td className="pn-row-actions">
                          {p.activo && (
                            <button type="button" className="pn-btn pn-btn-sm pn-btn-primary" onClick={() => { setErr(''); setModalMov({ producto: p }) }}>
                              Movimiento
                            </button>
                          )}
                          {esAdmin && (
                            <>
                              <button type="button" className="pn-btn pn-btn-sm" onClick={() => { setErr(''); setModalProd({ producto: p }) }}>Editar</button>
                              <button type="button" className="pn-btn pn-btn-sm pn-btn-danger" onClick={() => setBorrar(p)}>Eliminar</button>
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {esAdmin && !prod.cargando && !productos.length && !prod.error && (
            <div className="pn-hint-box">
              <strong>¿Empezamos rápido?</strong> Puedo agregar una lista de productos típicos de un campo de paintball
              (bolas, CO2, máscaras, chalecos…) para que solo registres sus entradas y costos.
              <button type="button" className="pn-btn pn-btn-sm pn-btn-primary" onClick={cargarSugeridos}>Agregar productos sugeridos</button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="pn-toolbar">
            <select className="pn-select" value={filtroMov.producto} onChange={(e) => setFiltroMov({ ...filtroMov, producto: e.target.value })}>
              <option value="todos">Todos los productos</option>
              {productos.map((p) => <option key={p.id} value={String(p.id)}>{p.nombre}</option>)}
            </select>
            <select className="pn-select" value={filtroMov.tipo} onChange={(e) => setFiltroMov({ ...filtroMov, tipo: e.target.value })}>
              <option value="todos">Todos los tipos</option>
              <option value="entrada">Entradas</option>
              <option value="salida">Salidas</option>
              <option value="ajuste">Ajustes</option>
            </select>
            <span className="pn-spacer" />
            <button
              type="button" className="pn-btn pn-btn-ghost"
              onClick={() => descargarCSV('kardex_inventario.csv', movVisibles.map((m) => ({
                fecha: m.created_at, producto: nombreProd(m.producto_id), tipo: m.tipo, cantidad: m.cantidad,
                stock_anterior: m.stock_anterior, stock_resultante: m.stock_resultante,
                costo_unitario: m.costo_unitario, motivo: m.motivo, usuario: m.usuario,
              })))}
            >
              Exportar CSV
            </button>
          </div>
          {mov.cargando ? <Cargando /> : !movVisibles.length ? <Vacio texto="No hay movimientos registrados." /> : (
            <div className="pn-table-wrap pn-scroll">
              <table className="pn-table">
                <thead>
                  <tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th className="pn-num">Cantidad</th><th className="pn-num">Stock</th><th className="pn-num">Costo</th><th>Motivo</th><th>Usuario</th></tr>
                </thead>
                <tbody>
                  {movVisibles.map((m) => (
                    <tr key={m.id}>
                      <td>{fechaHora(m.created_at)}</td>
                      <td><strong>{nombreProd(m.producto_id)}</strong></td>
                      <td><Badge valor={m.tipo} /></td>
                      <td className="pn-num">
                        <span className={m.tipo === 'entrada' ? 'pn-pos' : m.tipo === 'salida' ? 'pn-neg' : ''}>
                          {m.tipo === 'entrada' ? '+' : m.tipo === 'salida' ? '−' : '='}{num(m.cantidad)}
                        </span>
                        <small className="pn-inline"> {unidadProd(m.producto_id)}</small>
                      </td>
                      <td className="pn-num">{num(m.stock_anterior)} → <strong>{num(m.stock_resultante)}</strong></td>
                      <td className="pn-num">{m.costo_unitario ? cop(m.costo_unitario) : '—'}</td>
                      <td>{m.motivo || '—'}</td>
                      <td>{m.usuario || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {modalProd && (
        <ProductoModal
          producto={modalProd.producto}
          onClose={() => setModalProd(null)}
          onGuardado={(msg) => { setModalProd(null); setOk(msg); recargar() }}
        />
      )}
      {modalMov && (
        <MovimientoModal
          producto={modalMov.producto}
          esAdmin={esAdmin}
          onClose={() => setModalMov(null)}
          onGuardado={(msg) => { setModalMov(null); setOk(msg); recargar() }}
        />
      )}
      {borrar && (
        <Confirmar
          mensaje={`¿Eliminar "${borrar.nombre}"? Si ya tiene movimientos no se podrá borrar; en ese caso desactívalo desde Editar.`}
          onSi={confirmarBorrado} onNo={() => setBorrar(null)}
        />
      )}
    </div>
  )
}

function ProductoModal({ producto, onClose, onGuardado }) {
  const editando = !!producto
  const [f, setF] = useState({
    nombre: producto?.nombre || '', categoria: producto?.categoria || CATEGORIAS_PRODUCTO[0],
    unidad: producto?.unidad || 'unidad', stock_minimo: producto?.stock_minimo ?? 0,
    costo_unitario: producto?.costo_unitario ?? 0, activo: producto?.activo ?? true, stock_inicial: '',
  })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const cambiar = (e) => setF((p) => ({ ...p, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const guardar = async (e) => {
    e.preventDefault()
    if (!f.nombre.trim()) return setError('Escribe el nombre del producto.')
    if (Number(f.stock_minimo) < 0 || Number(f.costo_unitario) < 0 || Number(f.stock_inicial || 0) < 0) {
      return setError('Los valores no pueden ser negativos.')
    }
    setGuardando(true)
    const base = {
      nombre: f.nombre.trim(), categoria: f.categoria, unidad: f.unidad,
      stock_minimo: Number(f.stock_minimo) || 0, costo_unitario: Number(f.costo_unitario) || 0,
    }
    let res
    if (editando) {
      res = await actualizarProducto(producto.id, { ...base, activo: f.activo })
    } else {
      res = await crearProducto(base)
      // el stock inicial entra como un movimiento para que el kardex quede completo
      if (res.ok && Number(f.stock_inicial) > 0) {
        const m = await crearMovimiento({
          producto_id: res.data.id, tipo: 'entrada', cantidad: Number(f.stock_inicial),
          costo_unitario: base.costo_unitario || null, genera_gasto: false, motivo: 'Stock inicial',
        })
        if (!m.ok) { setGuardando(false); return setError(errorAmigable(m.error)) }
      }
    }
    setGuardando(false)
    if (!res.ok) return setError(errorAmigable(res.error))
    onGuardado(editando ? 'Producto actualizado.' : 'Producto creado.')
  }

  return (
    <Modal titulo={editando ? 'Editar producto' : 'Nuevo producto'} onClose={onClose}>
      <form className="pn-form" onSubmit={guardar}>
        <Alerta onClose={() => setError('')}>{error}</Alerta>
        <label>Nombre
          <input name="nombre" value={f.nombre} onChange={cambiar} placeholder="Ej: Bolas de pintura (caja x2000)" autoFocus />
        </label>
        <div className="pn-grid-2">
          <label>Categoría
            <select name="categoria" value={f.categoria} onChange={cambiar}>
              {CATEGORIAS_PRODUCTO.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>Unidad de medida
            <select name="unidad" value={f.unidad} onChange={cambiar}>
              {UNIDADES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>Stock mínimo (alerta)
            <input type="number" min="0" step="any" name="stock_minimo" value={f.stock_minimo} onChange={cambiar} />
          </label>
          <label>Costo por unidad (COP)
            <input type="number" min="0" step="any" name="costo_unitario" value={f.costo_unitario} onChange={cambiar} />
          </label>
          {!editando && (
            <label>Stock inicial (opcional)
              <input type="number" min="0" step="any" name="stock_inicial" value={f.stock_inicial} onChange={cambiar} placeholder="0" />
            </label>
          )}
        </div>
        {editando && (
          <>
            <p className="pn-note">Stock actual: <strong>{num(producto.stock)} {producto.unidad}</strong>. Para cambiarlo registra un movimiento (así queda en el historial).</p>
            <label className="pn-check">
              <input type="checkbox" name="activo" checked={f.activo} onChange={cambiar} /> Producto activo
            </label>
          </>
        )}
        <div className="pn-actions">
          <button type="button" className="pn-btn pn-btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="pn-btn pn-btn-primary" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  )
}

function MovimientoModal({ producto, esAdmin, onClose, onGuardado }) {
  const [tipo, setTipo] = useState('entrada')
  const [cantidad, setCantidad] = useState('')
  const [costo, setCosto] = useState(producto.costo_unitario || '')
  const [motivo, setMotivo] = useState(MOTIVOS.entrada[0])
  const [gasto, setGasto] = useState(true)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cant = Number(cantidad)
  const stock = Number(producto.stock)
  const resultante = cantidad === '' || isNaN(cant) ? null
    : tipo === 'entrada' ? stock + cant : tipo === 'salida' ? stock - cant : cant
  const total = tipo === 'entrada' && cant > 0 && Number(costo) > 0 ? cant * Number(costo) : 0

  const cambiarTipo = (t) => { setTipo(t); setMotivo(MOTIVOS[t][0]); setError('') }

  const guardar = async (e) => {
    e.preventDefault()
    if (cantidad === '' || isNaN(cant) || cant < 0) return setError('Escribe una cantidad válida.')
    if (tipo !== 'ajuste' && cant <= 0) return setError('La cantidad debe ser mayor a 0.')
    if (tipo === 'salida' && cant > stock) return setError(`Solo quedan ${num(stock)} ${producto.unidad}.`)
    setGuardando(true)
    const res = await crearMovimiento({
      producto_id: producto.id, tipo, cantidad: cant, motivo,
      costo_unitario: tipo === 'entrada' && Number(costo) > 0 ? Number(costo) : null,
      genera_gasto: esAdmin && tipo === 'entrada' && gasto && Number(costo) > 0,
    })
    setGuardando(false)
    if (!res.ok) return setError(errorAmigable(res.error))
    onGuardado(`Movimiento registrado. Stock de ${producto.nombre}: ${num(res.data.stock_resultante)} ${producto.unidad}.`)
  }

  return (
    <Modal titulo={`Movimiento: ${producto.nombre}`} onClose={onClose}>
      <form className="pn-form" onSubmit={guardar}>
        <Alerta onClose={() => setError('')}>{error}</Alerta>
        <div className="pn-seg">
          {['entrada', 'salida', 'ajuste'].map((t) => (
            <button key={t} type="button" className={tipo === t ? `on on-${t}` : ''} onClick={() => cambiarTipo(t)}>
              {t === 'entrada' ? '＋ Entrada' : t === 'salida' ? '− Salida' : '⇄ Ajuste'}
            </button>
          ))}
        </div>
        <p className="pn-note">
          {tipo === 'entrada' && 'Suma productos al inventario (compras, devoluciones).'}
          {tipo === 'salida' && 'Resta productos del inventario (uso en partidas, ventas, daños).'}
          {tipo === 'ajuste' && 'Escribe el conteo físico real: el stock quedará exactamente en ese número.'}
        </p>
        <div className="pn-grid-2">
          <label>{tipo === 'ajuste' ? 'Stock real contado' : 'Cantidad'} ({producto.unidad})
            <input type="number" min="0" step="any" value={cantidad} onChange={(e) => setCantidad(e.target.value)} autoFocus />
          </label>
          <label>Motivo
            <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              {MOTIVOS[tipo].map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          {tipo === 'entrada' && (
            <label>Costo por unidad (COP)
              <input type="number" min="0" step="any" value={costo} onChange={(e) => setCosto(e.target.value)} />
            </label>
          )}
        </div>
        {esAdmin && tipo === 'entrada' && (
          <label className="pn-check">
            <input type="checkbox" checked={gasto} onChange={(e) => setGasto(e.target.checked)} />
            Registrar la compra como gasto en contabilidad{total > 0 ? ` (${cop(total)})` : ''}
          </label>
        )}
        <div className={`pn-preview ${resultante !== null && resultante < 0 ? 'pn-preview-bad' : ''}`}>
          <span>Stock actual <strong>{num(stock)}</strong></span>
          <span>→</span>
          <span>Quedará en <strong>{resultante === null ? '—' : num(resultante)} {producto.unidad}</strong></span>
        </div>
        <div className="pn-actions">
          <button type="button" className="pn-btn pn-btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="pn-btn pn-btn-primary" disabled={guardando}>{guardando ? 'Guardando…' : 'Registrar'}</button>
        </div>
      </form>
    </Modal>
  )
}
