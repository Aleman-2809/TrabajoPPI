import { construirMensaje } from './mensajes.js'
import { normalizarTelefono } from './telefono.js'
 
// Toma un lote de mensajes pendientes, los envía uno por uno y reporta el resultado.
// `enviar(telefono, texto)` debe devolver { ok:true } o { sinWhatsApp:true }, o lanzar un error.
export async function procesarLote({ rpc, enviar, esperar, cfg, limite = 10, log = console }) {
  const lote = (await rpc('bot_tomar_pendientes', { p_limite: limite })) || []
  let enviados = 0
 
  for (let i = 0; i < lote.length; i++) {
    const n = lote[i]
    if (i > 0) await esperar() // pausa aleatoria entre mensajes (evita parecer spam)
 
    const resultado = async (ok, error = null, reintentar = true) =>
      rpc('bot_resultado', { p_id: n.id, p_ok: ok, p_error: error, p_reintentar: reintentar })
 
    try {
      // El número de destino viene en `destinatario` ("para" solo dice si es cliente o caja)
      const texto = n.reserva ? construirMensaje(n.tipo, n.para, n.reserva, cfg) : null
      if (!texto) {
        const motivo = n.reserva ? `Tipo de mensaje desconocido: ${n.tipo}/${n.para}` : 'La reserva ya no existe'
        await resultado(false, motivo, false)
        continue
      }
 
      const tel = normalizarTelefono(n.destinatario, cfg.codigoPais)
      if (!tel) {
        await resultado(false, `Teléfono no válido: ${n.destinatario}`, false)
        continue
      }
 
      const r = await enviar(tel, texto)
      if (r?.sinWhatsApp) {
        await resultado(false, 'Ese número no tiene WhatsApp', false)
        log.warn(`⚠️  #${n.id} ${n.tipo} → ${tel}: el número no tiene WhatsApp`)
      } else {
        await resultado(true)
        enviados++
        log.log(`✅ #${n.id} ${n.tipo} enviado a ${tel}`)
      }
    } catch (e) {
      log.error(`❌ #${n.id} ${n.tipo}: ${e.message}`)
      try { await resultado(false, e.message, true) } catch (e2) { log.error('No se pudo reportar el fallo:', e2.message) }
    }
  }
  return { tomados: lote.length, enviados }
}