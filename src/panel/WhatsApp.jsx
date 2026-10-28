import { useEffect, useMemo, useState } from 'react'
import { listarNotificaciones, reintentarNotificacion, listarConfig, guardarConfig, listarPerfiles } from '../supabaseClient'
import { Badge, Vacio, Cargando, Alerta, useLista, fechaHora, haceTiempo, errorAmigable } from './ui'

const NOMBRE_TIPO = {
  nueva: { cliente: 'Reserva recibida', caja: 'Nueva reserva' },
  confirmada: { cliente: 'Reserva confirmada' },
  cancelada: { cliente: 'Reserva cancelada', caja: 'Cliente canceló' },
  aplazada: { cliente: 'Reserva aplazada' },
  completada: { cliente: 'Gracias por jugar' },
  actualizada: { cliente: 'Reserva actualizada' },
  recordatorio: { cliente: 'Recordatorio (mañana)' },
}
const ETIQUETA_ESTADO = { pendiente: 'En cola', procesando: 'Enviando', enviado: 'Enviado', error: 'Error' }

// Solo administrador: estado del bot, interruptor y registro de mensajes.
export default function WhatsApp() {
  const notif = useLista(listarNotificaciones)
  const cfg = useLista(listarConfig)
  const perfiles = useLista(listarPerfiles)
  const [err, setErr] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [, setTick] = useState(0)

  // refresca cada 15 s para ver el estado del bot casi en vivo
  useEffect(() => {
    const t = setInterval(() => { notif.recargar(); cfg.recargar(); setTick((n) => n + 1) }, 15000)
    return () => clearInterval(t)
  }, [notif.recargar, cfg.recargar]) // eslint-disable-line react-hooks/exhaustive-deps

  const conf = useMemo(() => Object.fromEntries(cfg.datos.map((c) => [c.clave, c.valor])), [cfg.datos])
  const activo = conf.whatsapp_activo !== 'false'
  const latido = conf.bot_latido ? new Date(conf.bot_latido).getTime() : 0
  const reciente = latido && Date.now() - latido < 90_000
  const estadoBot = !reciente ? 'apagado' : conf.bot_estado === 'conectado' ? 'conectado' : conf.bot_estado === 'esperando_qr' ? 'qr' : 'desconectado'
  const TEXTO_BOT = {
    conectado: ['Conectado', 'El bot está enviando los mensajes automáticamente.'],
    qr: ['Esperando vincular', 'Abre la terminal del bot y escanea el código QR con el WhatsApp del negocio.'],
    desconectado: ['Reconectando…', 'El bot está encendido pero WhatsApp se desconectó. Debería volver solo.'],
    apagado: ['Bot apagado', 'No hay señal del bot. Enciéndelo con "npm start" en la carpeta whatsapp-bot.'],
  }

  const cajerasConTel = perfiles.datos.filter((p) => p.rol === 'cajera' && p.activo && (p.telefono || '').trim()).length
  const hoy = new Date().toDateString()
  const stats = useMemo(() => ({
    cola: notif.datos.filter((n) => n.estado === 'pendiente' || n.estado === 'procesando').length,
    hoy: notif.datos.filter((n) => n.estado === 'enviado' && n.enviado_at && new Date(n.enviado_at).toDateString() === hoy).length,
    errores: notif.datos.filter((n) => n.estado === 'error').length,
  }), [notif.datos, hoy])

  const alternar = async () => {
    const r = await guardarConfig('whatsapp_activo', activo ? 'false' : 'true')
    if (!r.ok) setErr(errorAmigable(r.error)); else cfg.recargar()
  }
  const reintentar = async (n) => {
    const r = await reintentarNotificacion(n.id)
    if (!r.ok) setErr(errorAmigable(r.error)); else notif.recargar()
  }
  const copiar = async () => {
    try { await navigator.clipboard.writeText(conf.bot_secret || ''); setCopiado(true); setTimeout(() => setCopiado(false), 1800) } catch { /* sin permiso */ }
  }

  return (
    <div className="wa">
      <Alerta onClose={() => setErr('')}>{err || notif.error || cfg.error}</Alerta>

      <section className={`wa-status wa-status-${estadoBot}`}>
        <span className="wa-dot" />
        <div className="wa-status-text">
          <strong>{TEXTO_BOT[estadoBot][0]}</strong>
          <p>{TEXTO_BOT[estadoBot][1]}{latido ? ` Última señal: ${haceTiempo(new Date(latido))}.` : ''}</p>
        </div>
        <label className="wa-switch" title="Apaga o enciende todos los mensajes automáticos">
          <input type="checkbox" checked={activo} onChange={alternar} />
          <span /> <em>{activo ? 'Envío automático activado' : 'Envío automático apagado'}</em>
        </label>
      </section>

      {!perfiles.cargando && cajerasConTel === 0 && (
        <div className="pn-hint-box">
          <strong>Nadie recibirá el aviso de nuevas reservas.</strong>
          Ve a <em>Usuarios y roles</em>, edita a la cajera, ponle el rol <strong>cajera</strong> y su número de WhatsApp.
        </div>
      )}

      <div className="pn-stats pn-stats-sm">
        <div className="pn-stat"><span>En cola</span><strong>{stats.cola}</strong></div>
        <div className="pn-stat pn-stat-good"><span>Enviados hoy</span><strong>{stats.hoy}</strong></div>
        <div className={`pn-stat ${stats.errores ? 'pn-stat-bad' : ''}`}><span>Con error</span><strong>{stats.errores}</strong></div>
        <div className="pn-stat"><span>Cajeras con WhatsApp</span><strong>{cajerasConTel}</strong></div>
      </div>

      <details className="wa-setup">
        <summary>Datos para conectar el bot</summary>
        <ol>
          <li>Instala <strong>Node.js 20+</strong> en el computador que quedará encendido y abre la carpeta <code>whatsapp-bot</code>.</li>
          <li>Copia <code>.env.example</code> como <code>.env</code> y pega estos dos datos:</li>
        </ol>
        <div className="wa-secret">
          <div><span>SUPABASE_URL</span><code>{import.meta.env.VITE_SUPABASE_URL || '(está en el .env de la página)'}</code></div>
          <div>
            <span>BOT_SECRET</span>
            <code>{conf.bot_secret ? (verClave ? conf.bot_secret : '•'.repeat(24)) : 'Ejecuta roles_whatsapp.sql en Supabase'}</code>
            {conf.bot_secret && (
              <>
                <button type="button" className="pn-btn pn-btn-sm" onClick={() => setVerClave(!verClave)}>{verClave ? 'Ocultar' : 'Mostrar'}</button>
                <button type="button" className="pn-btn pn-btn-sm" onClick={copiar}>{copiado ? '¡Copiado!' : 'Copiar'}</button>
              </>
            )}
          </div>
        </div>
        <ol start="3">
          <li>Ejecuta <code>npm install</code> y luego <code>npm start</code>.</li>
          <li>Escanea el QR con el WhatsApp del negocio: <em>Dispositivos vinculados → Vincular un dispositivo</em>.</li>
        </ol>
        <p className="pn-note">Guarda el BOT_SECRET como una contraseña: quien lo tenga puede leer los datos de las reservas pendientes de aviso.</p>
      </details>

      <h3 className="wa-h3">Registro de mensajes</h3>
      {notif.cargando ? <Cargando /> : !notif.datos.length ? (
        <Vacio texto="Todavía no se ha generado ningún mensaje. Aparecerán aquí cuando alguien haga una reserva." />
      ) : (
        <div className="pn-table-wrap pn-scroll">
          <table className="pn-table">
            <thead><tr><th>Fecha</th><th>Mensaje</th><th>Para</th><th>Reserva</th><th>Estado</th><th>Detalle</th><th></th></tr></thead>
            <tbody>
              {notif.datos.map((n) => (
                <tr key={n.id}>
                  <td>{fechaHora(n.created_at)}</td>
                  <td><strong>{NOMBRE_TIPO[n.tipo]?.[n.para] || n.tipo}</strong></td>
                  <td>{n.para === 'caja' ? 'Caja' : 'Cliente'}<small>{n.destinatario}</small></td>
                  <td>#{n.reserva_id}</td>
                  <td><Badge valor={n.estado} texto={ETIQUETA_ESTADO[n.estado]} /></td>
                  <td>{n.error ? <small className="wa-error">{n.error}</small> : n.estado === 'enviado' ? <small>{haceTiempo(n.enviado_at)}</small> : n.intentos > 0 ? <small>Intento {n.intentos}</small> : '—'}</td>
                  <td className="pn-row-actions">
                    {n.estado === 'error' && <button type="button" className="pn-btn pn-btn-sm" onClick={() => reintentar(n)}>Reintentar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
