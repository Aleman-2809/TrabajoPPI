import { useMemo, useState } from 'react'
import { useAuth } from '../AuthContext'
import { listarTickets, crearTicket, actualizarTicket, eliminarTicket } from '../supabaseClient'
import { enlaceWhatsApp } from '../config'
import Icon from './Icon'
import { Modal, Confirmar, Alerta, useLista, ESTADOS_TICKET, haceTiempo, errorAmigable } from './ui'

// El soporte es SOLO para errores técnicos de la página. Las dudas de reservas van a caja.
const CATEGORIAS = [
  { id: 'Error al reservar', icono: 'calendar', ayuda: 'No pude enviar o ver mi reserva' },
  { id: 'No puedo iniciar sesión', icono: 'lock', ayuda: 'Contraseña, registro o acceso' },
  { id: 'Error en mi cuenta o panel', icono: 'user', ayuda: 'Algo falla en mi panel' },
  { id: 'La página no carga o se ve mal', icono: 'monitor', ayuda: 'Pantalla en blanco o botones rotos' },
  { id: 'Otro error', icono: 'tool', ayuda: 'Cualquier otra falla técnica' },
]
const ICONO = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c.icono]))
const ETIQUETA = { abierto: 'Abierto', en_proceso: 'En proceso', resuelto: 'Resuelto' }
const MAX_ASUNTO = 80
const MAX_MENSAJE = 600
const inicial = (n) => (String(n || '?').trim().charAt(0) || '?').toUpperCase()

export default function Tickets() {
  const { user, perfil, nombre, puedeAtenderTickets: atiende, esAdmin } = useAuth()
  const { datos, cargando, error, recargar, setError } = useLista(listarTickets)
  const [filtro, setFiltro] = useState('todos')
  const [modal, setModal] = useState(null) // { tipo: 'nuevo' | 'editar' | 'responder', ticket? }
  const [borrar, setBorrar] = useState(null)
  const [abiertos, setAbiertos] = useState(() => new Set())
  const [ok, setOk] = useState('')

  const conteo = useMemo(() => {
    const c = { todos: datos.length }
    ESTADOS_TICKET.forEach((e) => { c[e] = datos.filter((t) => t.estado === e).length })
    return c
  }, [datos])
  const visibles = useMemo(() => datos.filter((t) => filtro === 'todos' || t.estado === filtro), [datos, filtro])

  const alternar = (id) =>
    setAbiertos((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const confirmarBorrado = async () => {
    const r = await eliminarTicket(borrar.id)
    setBorrar(null)
    if (!r.ok) setError(errorAmigable(r.error))
    else { setOk('Reporte eliminado.'); recargar() }
  }

  return (
    <div className="sp">
      <section className="sp-hero">
        <div className="sp-hero-icon"><Icon name={atiende ? 'inbox' : 'lifebuoy'} size={28} /></div>
        <div className="sp-hero-text">
          <h2>{atiende ? 'Bandeja de errores' : 'Centro de soporte'}</h2>
          <p>
            {atiende
              ? 'Aquí llegan los errores técnicos que reportan los usuarios y el personal.'
              : '¿Algo no funciona en la página? Cuéntanos qué error viste y lo solucionamos.'}
          </p>
        </div>
        {!atiende && (
          <button type="button" className="sp-cta" onClick={() => { setError(''); setModal({ tipo: 'nuevo' }) }}>
            <Icon name="plus" size={18} /> Reportar un error
          </button>
        )}
      </section>

      {!atiende && (
        <aside className="sp-notice">
          <span className="sp-notice-icon"><Icon name="chat" size={20} /></span>
          <p>
            <strong>¿Dudas sobre una reserva?</strong> El soporte es solo para errores técnicos de la página.
            Para reservas, escríbele directamente a caja.
          </p>
          <a className="sp-notice-link" href={enlaceWhatsApp('Hola, tengo una duda sobre mi reserva.')} target="_blank" rel="noreferrer">
            Escribir a caja
          </a>
        </aside>
      )}

      <div className="sp-pills" role="tablist">
        {[['todos', 'Todos'], ['abierto', 'Abiertos'], ['en_proceso', 'En proceso'], ['resuelto', 'Resueltos']].map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={filtro === k} className={filtro === k ? `on sp-pill-${k}` : ''} onClick={() => setFiltro(k)}>
            {l} <span>{conteo[k] ?? 0}</span>
          </button>
        ))}
      </div>

      <Alerta onClose={() => setError('')}>{!modal ? error : ''}</Alerta>
      <Alerta tipo="ok" onClose={() => setOk('')}>{ok}</Alerta>

      {cargando ? (
        <div className="sp-skeleton"><i /><i /><i /></div>
      ) : !visibles.length ? (
        <div className="sp-empty">
          <span><Icon name="check" size={34} /></span>
          <h3>{datos.length ? 'No hay reportes con ese filtro' : atiende ? 'Todo en orden' : 'Aún no has reportado errores'}</h3>
          <p>{datos.length ? 'Prueba con otro estado.' : atiende ? 'No hay errores pendientes por atender.' : 'Si algo falla en la página, repórtalo y te ayudamos.'}</p>
          {!atiende && !datos.length && (
            <button type="button" className="sp-cta sp-cta-solid" onClick={() => setModal({ tipo: 'nuevo' })}>
              <Icon name="plus" size={18} /> Reportar un error
            </button>
          )}
        </div>
      ) : (
        <div className="sp-list">
          {visibles.map((t) => {
            const largo = (t.mensaje || '').length > 260
            const expandido = abiertos.has(t.id)
            return (
              <article className={`sp-ticket sp-${t.estado}`} key={t.id}>
                <div className="sp-ticket-head">
                  <span className="sp-chip-icon"><Icon name={ICONO[t.categoria] || 'tool'} size={20} /></span>
                  <div className="sp-ticket-title">
                    <h4>{t.asunto}</h4>
                    <small>
                      #{t.id} · {t.categoria || 'Otro error'} · {haceTiempo(t.created_at)}
                      {atiende && <> · {t.nombre}{t.email ? ` (${t.email})` : ''}</>}
                    </small>
                  </div>
                  <span className={`sp-status sp-status-${t.estado}`}><i />{ETIQUETA[t.estado]}</span>
                </div>

                <p className={`sp-msg ${largo && !expandido ? 'sp-clamp' : ''}`}>{t.mensaje}</p>
                {largo && <button type="button" className="sp-more" onClick={() => alternar(t.id)}>{expandido ? 'Ver menos' : 'Ver más'}</button>}

                {t.respuesta ? (
                  <div className="sp-reply">
                    <span className="sp-avatar sp-avatar-team">{inicial(t.atendido_por || 'S')}</span>
                    <div className="sp-bubble sp-bubble-team">
                      <header><strong>{t.atendido_por || 'Soporte'}</strong><small>{haceTiempo(t.updated_at)}</small></header>
                      <p>{t.respuesta}</p>
                    </div>
                  </div>
                ) : !atiende && (
                  <div className="sp-wait"><Icon name="clock" size={16} /> Estamos revisando tu reporte. Te respondemos aquí mismo.</div>
                )}

                <footer>
                  {atiende && (
                    <button type="button" className="sp-btn sp-btn-primary" onClick={() => { setError(''); setModal({ tipo: 'responder', ticket: t }) }}>
                      <Icon name="send" size={15} /> {t.respuesta ? 'Editar respuesta' : 'Responder'}
                    </button>
                  )}
                  {!atiende && t.estado === 'abierto' && (
                    <button type="button" className="sp-btn" onClick={() => { setError(''); setModal({ tipo: 'editar', ticket: t }) }}>Editar</button>
                  )}
                  {(esAdmin || (!atiende && t.estado === 'abierto')) && (
                    <button type="button" className="sp-btn sp-btn-ghost-danger" onClick={() => setBorrar(t)}>Eliminar</button>
                  )}
                </footer>
              </article>
            )
          })}
        </div>
      )}

      {modal && (modal.tipo === 'responder' ? (
        <ResponderModal ticket={modal.ticket} atendidoPor={nombre} onClose={() => setModal(null)}
          onGuardado={() => { setModal(null); setOk('Respuesta guardada.'); recargar() }} />
      ) : (
        <ReporteModal ticket={modal.ticket} user={user} nombre={nombre} email={perfil?.email || user.email} onClose={() => setModal(null)}
          onGuardado={(m) => { setModal(null); setOk(m); recargar() }} />
      ))}
      {borrar && <Confirmar mensaje={`¿Eliminar el reporte "${borrar.asunto}"?`} onSi={confirmarBorrado} onNo={() => setBorrar(null)} />}
    </div>
  )
}

function ReporteModal({ ticket, user, nombre, email, onClose, onGuardado }) {
  const editando = !!ticket
  const [f, setF] = useState({
    categoria: ticket?.categoria || '', asunto: ticket?.asunto || '', mensaje: ticket?.mensaje || '',
  })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const guardar = async (e) => {
    e.preventDefault()
    if (!f.categoria) return setError('Elige qué tipo de error viste.')
    if (f.asunto.trim().length < 4) return setError('Escribe un título corto del problema.')
    if (f.mensaje.trim().length < 10) return setError('Cuéntanos un poco más: qué estabas haciendo y qué pasó.')
    setGuardando(true)
    const base = { categoria: f.categoria, asunto: f.asunto.trim(), mensaje: f.mensaje.trim() }
    const r = editando
      ? await actualizarTicket(ticket.id, base)
      : await crearTicket({ ...base, user_id: user.id, nombre, email })
    setGuardando(false)
    if (!r.ok) return setError(errorAmigable(r.error))
    onGuardado(editando ? 'Reporte actualizado.' : 'Reporte enviado. Te responderemos por aquí.')
  }

  return (
    <Modal titulo={editando ? 'Editar reporte' : 'Reportar un error'} onClose={onClose} ancho={580}>
      <form className="sp-form" onSubmit={guardar}>
        <p className="sp-form-lead">Cuéntanos qué falló y lo revisamos lo antes posible.</p>
        <Alerta onClose={() => setError('')}>{error}</Alerta>

        <fieldset className="sp-field">
          <legend>¿Qué tipo de error viste?</legend>
          <div className="sp-tiles">
            {CATEGORIAS.map((c) => (
              <button key={c.id} type="button" className={`sp-tile ${f.categoria === c.id ? 'on' : ''}`} aria-pressed={f.categoria === c.id}
                onClick={() => { setF({ ...f, categoria: c.id }); setError('') }}>
                <span><Icon name={c.icono} size={20} /></span>
                <strong>{c.id}</strong>
                <small>{c.ayuda}</small>
              </button>
            ))}
          </div>
        </fieldset>

        <label className="sp-field">
          <span className="sp-label">Título del problema <em>{f.asunto.length}/{MAX_ASUNTO}</em></span>
          <input value={f.asunto} maxLength={MAX_ASUNTO} onChange={(e) => setF({ ...f, asunto: e.target.value })} placeholder="Ej: Me sale un error al enviar mi reserva" />
        </label>
        <label className="sp-field">
          <span className="sp-label">¿Qué pasó? <em>{f.mensaje.length}/{MAX_MENSAJE}</em></span>
          <textarea rows="5" value={f.mensaje} maxLength={MAX_MENSAJE} onChange={(e) => setF({ ...f, mensaje: e.target.value })}
            placeholder="Cuéntanos qué estabas haciendo, qué mensaje apareció y desde qué dispositivo (celular o computador)." />
        </label>

        <div className="sp-form-actions">
          <button type="button" className="sp-btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="sp-btn sp-btn-primary sp-btn-lg" disabled={guardando}>
            <Icon name="send" size={16} /> {guardando ? 'Enviando…' : editando ? 'Guardar cambios' : 'Enviar reporte'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ResponderModal({ ticket, atendidoPor, onClose, onGuardado }) {
  const [respuesta, setRespuesta] = useState(ticket.respuesta || '')
  const [estado, setEstado] = useState(ticket.estado === 'abierto' ? 'en_proceso' : ticket.estado)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const guardar = async (e, forzarEstado) => {
    e?.preventDefault()
    if (!respuesta.trim()) return setError('Escribe una respuesta para la persona.')
    setGuardando(true)
    const r = await actualizarTicket(ticket.id, { respuesta: respuesta.trim(), estado: forzarEstado || estado, atendido_por: atendidoPor || 'Soporte' })
    setGuardando(false)
    if (!r.ok) return setError(errorAmigable(r.error))
    onGuardado()
  }

  return (
    <Modal titulo={`Reporte #${ticket.id}`} onClose={onClose} ancho={600}>
      <form className="sp-form" onSubmit={guardar}>
        <Alerta onClose={() => setError('')}>{error}</Alerta>
        <div className="sp-thread">
          <span className="sp-avatar">{inicial(ticket.nombre)}</span>
          <div className="sp-bubble">
            <header><strong>{ticket.nombre}</strong><small>{haceTiempo(ticket.created_at)} · {ticket.categoria}</small></header>
            <h5>{ticket.asunto}</h5>
            <p>{ticket.mensaje}</p>
          </div>
        </div>

        <label className="sp-field">
          <span className="sp-label">Tu respuesta</span>
          <textarea rows="5" value={respuesta} onChange={(e) => setRespuesta(e.target.value)} placeholder="Explica qué pasó y cómo se solucionó o qué debe hacer la persona…" autoFocus />
        </label>

        <div className="sp-field">
          <span className="sp-label">Estado del reporte</span>
          <div className="sp-seg">
            {ESTADOS_TICKET.map((e) => (
              <button key={e} type="button" className={estado === e ? `on on-${e}` : ''} onClick={() => setEstado(e)}>{ETIQUETA[e]}</button>
            ))}
          </div>
        </div>

        <div className="sp-form-actions">
          <button type="button" className="sp-btn" onClick={onClose}>Cancelar</button>
          <button type="button" className="sp-btn" disabled={guardando} onClick={() => guardar(null, 'resuelto')}>Responder y resolver</button>
          <button type="submit" className="sp-btn sp-btn-primary sp-btn-lg" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar respuesta'}</button>
        </div>
      </form>
    </Modal>
  )
}
