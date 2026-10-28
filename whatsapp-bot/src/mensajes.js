// Textos de los mensajes. WhatsApp entiende *negrita* y _cursiva_.

const EQUIPO_POR_PAQUETE = {
  Recluta: 'Máscara, chaleco, marcadora, overol y 100 bolas de pintura',
  Escuadrón: 'Equipo completo, 250 bolas de pintura, snacks y bebidas',
  'Operación Total': 'Equipo completo, 500 bolas de pintura y fotografías del evento',
}

export const primerNombre = (n) => {
  const p = String(n ?? '').trim().split(/\s+/)[0] || ''
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : 'jugador'
}

export function fechaLarga(f) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(f ?? ''))
  if (!m) return String(f ?? '')
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function horaCorta(h) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(h ?? ''))
  if (!m) return String(h ?? '')
  let hh = Number(m[1])
  const suf = hh >= 12 ? 'p. m.' : 'a. m.'
  hh = hh % 12 || 12
  return `${hh}:${m[2]} ${suf}`
}

export const dinero = (n) =>
  n === null || n === undefined || n === '' || isNaN(Number(n))
    ? null
    : `$ ${Number(n).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`

function detalle(r) {
  const l = []
  l.push(`📅 ${fechaLarga(r.fecha)}`)
  l.push(`🕒 ${horaCorta(r.hora)}`)
  if (r.campo) l.push(`📍 ${r.campo}`)
  if (r.modalidad) l.push(`🎮 ${r.modalidad}`)
  if (r.jugadores) l.push(`👥 ${r.jugadores} ${Number(r.jugadores) === 1 ? 'jugador' : 'jugadores'}`)
  if (r.paquete) l.push(`📦 Paquete ${r.paquete}`)
  const t = dinero(r.total)
  if (t) l.push(`💰 Total: ${t}`)
  return l.join('\n')
}

// Devuelve el texto, o null si el tipo no existe.
export function construirMensaje(tipo, para, r, cfg) {
  const nombre = primerNombre(r.cliente)
  const neg = cfg.negocio
  const pie = cfg.telefonoNegocio ? `\n\nDudas: ${cfg.telefonoNegocio}` : ''

  if (para === 'caja') {
    const contacto = `${r.cliente} · ${r.telefono ?? 'sin teléfono'}`
    if (tipo === 'nueva') {
      return [
        `🆕 *Nueva reserva* #${r.id}`,
        '',
        `👤 ${contacto}`,
        detalle(r),
        r.mensaje ? `\n📝 ${String(r.mensaje).trim()}` : false,
        cfg.panelUrl ? `\n👉 Confírmala en el panel: ${cfg.panelUrl}` : false,
      ].filter((x) => x !== false).join('\n')
    }
    if (tipo === 'cancelada') {
      return `❌ *El cliente canceló su reserva* #${r.id}\n\n👤 ${contacto}\n${detalle(r)}`
    }
    return null
  }

  switch (tipo) {
    case 'nueva':
      return `¡Hola ${nombre}! 🎯\n\nRecibimos tu solicitud de reserva en *${neg}*:\n\n${detalle(r)}\n\n⏳ Estado: *pendiente de confirmación*. Una persona de caja te confirmará muy pronto por este mismo chat.${pie}`
    case 'confirmada':
      return `✅ *¡Reserva confirmada, ${nombre}!*\n\n${detalle(r)}\n${EQUIPO_POR_PAQUETE[r.paquete] ? `\n🎒 Incluye: ${EQUIPO_POR_PAQUETE[r.paquete]}` : ''}${cfg.ubicacion ? `\n📌 Te esperamos en: ${cfg.ubicacion}` : ''}${cfg.recomendaciones ? `\n\n💡 ${cfg.recomendaciones}` : ''}\n\nSi necesitas cambiar algo, respóndenos por este chat.${pie}`
    case 'actualizada':
      return `🔄 *Actualizamos tu reserva, ${nombre}*\n\nEstos son los datos vigentes:\n\n${detalle(r)}${pie}`
    case 'aplazada':
      return `⏸️ Hola ${nombre}, tu reserva del ${fechaLarga(r.fecha)} quedó *aplazada*.\n\nNos pondremos en contacto contigo para acordar la nueva fecha. Si ya tienes una en mente, respóndenos por este chat.${pie}`
    case 'cancelada':
      return `Hola ${nombre}, tu reserva del ${fechaLarga(r.fecha)} fue *cancelada*.\n\nSi fue un error o quieres reprogramarla, respóndenos por este chat y con gusto te ayudamos. 🙌${pie}`
    case 'completada':
      return `🙌 ¡Gracias por jugar con nosotros, ${nombre}!\n\nEsperamos que la hayas pasado increíble en *${neg}*. Si quieres contarnos cómo te fue o volver con tu equipo, respóndenos por este chat. 🎯`
    case 'recordatorio':
      return `⏰ *Recordatorio, ${nombre}*\n\nMañana tienes tu partida en *${neg}*:\n\n${detalle(r)}${cfg.ubicacion ? `\n\n📌 ${cfg.ubicacion}` : ''}${cfg.recomendaciones ? `\n💡 ${cfg.recomendaciones}` : ''}\n\n¡Te esperamos! 🔥`
    default:
      return null
  }
}
