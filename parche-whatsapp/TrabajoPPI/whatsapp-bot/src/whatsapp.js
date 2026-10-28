import fs from 'node:fs'
import pino from 'pino'
import qrcode from 'qrcode-terminal'
import makeWASocket, {
  useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers, delay,
} from '@whiskeysockets/baileys'

export const aleatorio = (a, b) => Math.floor(a + Math.random() * (b - a))
export { delay }

// Conexión con WhatsApp (Baileys). Se usa desde el bot y desde la prueba de envío.
export function crearWhatsApp({ carpetaSesion, numeroVinculacion = '', log = console }) {
  const logger = pino({ level: 'silent' }) // el log de la librería es muy ruidoso; usamos el nuestro
  let sock = null
  let estado = 'desconectado' // desconectado | esperando_qr | conectado
  let reconectando = false
  let cerrado = false
  const oyentes = []

  const cambiar = (e) => { estado = e; oyentes.forEach((f) => f(e)) }

  async function conectar() {
    if (cerrado) return
    const { state, saveCreds } = await useMultiFileAuthState(carpetaSesion)
    let version
    try { version = (await fetchLatestBaileysVersion()).version } catch { /* usa la versión incluida */ }

    sock = makeWASocket({
      ...(version ? { version } : {}),
      auth: state,
      logger,
      browser: Browsers.appropriate('Zona Impacto'),
      markOnlineOnConnect: false, // no te muestra "en línea" ni silencia las notificaciones del teléfono
      syncFullHistory: false,
    })
    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        cambiar('esperando_qr')
        log.log('📱 Escanea este código: WhatsApp → Dispositivos vinculados → Vincular un dispositivo\n')
        qrcode.generate(qr, { small: true })
      }
      if (connection === 'open') {
        reconectando = false
        cambiar('conectado')
        log.log('🟢 WhatsApp conectado.')
      }
      if (connection === 'close') {
        cambiar('desconectado')
        if (cerrado) return
        const codigo = lastDisconnect?.error?.output?.statusCode
        const motivo = lastDisconnect?.error?.message || ''
        if (codigo === DisconnectReason.loggedOut) {
          log.warn('🔴 La sesión se cerró desde el teléfono. Borro la sesión y pido un QR nuevo…')
          fs.rmSync(carpetaSesion, { recursive: true, force: true })
          setTimeout(() => conectar().catch((e) => log.error('Reconexión falló:', e.message)), 2000)
        } else if (!reconectando) {
          reconectando = true
          const espera = codigo === DisconnectReason.restartRequired ? 0 : 5000
          log.warn(`🟡 Conexión cerrada (código ${codigo ?? '?'}${motivo ? `: ${motivo}` : ''}). Reconectando…`)
          setTimeout(() => { reconectando = false; conectar().catch((e) => log.error('Reconexión falló:', e.message)) }, espera)
        }
      }
    })

    // Opcional: vincular con código de 8 letras en lugar de QR
    if (!state.creds.registered && numeroVinculacion) {
      try {
        await delay(3000)
        const codigo = await sock.requestPairingCode(numeroVinculacion)
        log.log(`🔑 Código de vinculación: ${codigo}  (WhatsApp → Dispositivos vinculados → Vincular con número de teléfono)`)
      } catch (e) {
        log.error('No se pudo pedir el código de vinculación:', e.message)
      }
    }
  }

  // Envía un texto con comportamiento "humano" (escribiendo…)
  async function enviar(telefono, texto) {
    if (!sock || estado !== 'conectado') throw new Error('WhatsApp no está conectado')
    const encontrados = await sock.onWhatsApp(telefono)
    if (encontrados === undefined) throw new Error('No se pudo verificar el número (reintentaremos)')
    const hit = encontrados.find((x) => x.exists)
    if (!hit) return { sinWhatsApp: true }

    await sock.presenceSubscribe(hit.jid)
    await sock.sendPresenceUpdate('composing', hit.jid)
    await delay(aleatorio(1200, 3000))
    await sock.sendPresenceUpdate('paused', hit.jid)
    const enviado = await sock.sendMessage(hit.jid, { text: texto })
    return { ok: true, jid: hit.jid, id: enviado?.key?.id }
  }

  return {
    iniciar: conectar,
    enviar,
    estado: () => estado,
    alCambiar: (f) => oyentes.push(f),
    cerrar: () => { cerrado = true; try { sock?.end(undefined) } catch { /* ya cerrado */ } },
  }
}
