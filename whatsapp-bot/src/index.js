import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pino from 'pino'
import qrcode from 'qrcode-terminal'
import makeWASocket, {
  useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers, delay,
} from '@whiskeysockets/baileys'
import { leerConfig, validarConfig } from './config.js'
import { crearRpc } from './rpc.js'
import { procesarLote } from './cola.js'
 
const cfg = leerConfig()
const faltan = validarConfig(cfg)
if (faltan.length) {
  console.error(`\n❌ Falta configurar en el archivo .env: ${faltan.join(', ')}\n   Copia .env.example como .env y complétalo (mira el README).\n`)
  process.exit(1)
}
 
const rpc = crearRpc({ url: cfg.supabaseUrl, anonKey: cfg.anonKey, secret: cfg.secret })
const CARPETA_SESION = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'sesion')
const logger = pino({ level: 'silent' }) // el log de la librería es muy ruidoso; usamos el nuestro
const ahora = () => new Date().toLocaleTimeString('es-CO')
const log = {
  log: (...a) => console.log(`[${ahora()}]`, ...a),
  warn: (...a) => console.warn(`[${ahora()}]`, ...a),
  error: (...a) => console.error(`[${ahora()}]`, ...a),
}
 
let sock = null
let estado = 'desconectado' // desconectado | esperando_qr | conectado
let reconectando = false
const enviadosHora = [] // marcas de tiempo de los envíos de la última hora
 
const aleatorio = (a, b) => Math.floor(a + Math.random() * (b - a))
 
async function conectar() {
  const { state, saveCreds } = await useMultiFileAuthState(CARPETA_SESION)
  let version
  try { version = (await fetchLatestBaileysVersion()).version } catch { /* usa la versión incluida */ }
 
  sock = makeWASocket({
    ...(version ? { version } : {}),
    auth: state,
    logger,
    browser: Browsers.appropriate('Zona Impacto'),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  })
  sock.ev.on('creds.update', saveCreds)
 
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      estado = 'esperando_qr'
      log.log('📱 Escanea este código: WhatsApp → Dispositivos vinculados → Vincular un dispositivo\n')
      qrcode.generate(qr, { small: true })
    }
    if (connection === 'open') {
      estado = 'conectado'
      reconectando = false
      log.log('🟢 WhatsApp conectado. Esperando mensajes en la cola…')
      latido()
    }
    if (connection === 'close') {
      estado = 'desconectado'
      const codigo = lastDisconnect?.error?.output?.statusCode
      if (codigo === DisconnectReason.loggedOut) {
        log.warn('🔴 La sesión se cerró desde el teléfono. Borro la sesión y pido un QR nuevo…')
        fs.rmSync(CARPETA_SESION, { recursive: true, force: true })
        setTimeout(conectar, 2000)
      } else if (!reconectando) {
        reconectando = true
        const espera = codigo === DisconnectReason.restartRequired ? 0 : 5000
        log.warn(`🟡 Conexión cerrada (código ${codigo ?? '?'}). Reconectando…`)
        setTimeout(() => { reconectando = false; conectar().catch((e) => log.error('Reconexión falló:', e.message)) }, espera)
      }
    }
  })
 
  if (!state.creds.registered && cfg.numeroVinculacion) {
    try {
      await delay(3000)
      const codigo = await sock.requestPairingCode(cfg.numeroVinculacion)
      log.log(`🔑 Código de vinculación: ${codigo}  (WhatsApp → Dispositivos vinculados → Vincular con número de teléfono)`)
    } catch (e) {
      log.error('No se pudo pedir el código de vinculación:', e.message)
    }
  }
}
 
// Envía un texto. Primero verifica que el número tenga WhatsApp y usa el JID que devuelve WhatsApp
// (con Baileys 7 puede ser un LID, por eso no se arma a mano).
async function enviar(telefono, texto) {
  if (!sock || estado !== 'conectado') throw new Error('WhatsApp no está conectado')
 
  const encontrados = await sock.onWhatsApp(telefono)
  if (encontrados === undefined) throw new Error('No se pudo verificar el número (reintentaremos)')
  const hit = encontrados.find((x) => x.exists)
  if (!hit) return { sinWhatsApp: true }
 
  try {
    await sock.presenceSubscribe(hit.jid)
    await sock.sendPresenceUpdate('composing', hit.jid)
    await delay(aleatorio(800, 1500))
    await sock.sendPresenceUpdate('paused', hit.jid)
    const enviado = await sock.sendMessage(hit.jid, { text: texto })
    enviadosHora.push(Date.now())
    return { ok: true, jid: hit.jid, id: enviado?.key?.id }
  } catch (e) {
    log.error(`❌ FALLÓ EL ENVÍO A ${hit.jid}:`, e?.message || e)
    throw e
  }
}
 
let procesando = false
async function ciclo() {
  if (procesando || estado !== 'conectado') {
    return
  }
  const corte = Date.now() - 3600_000
  while (enviadosHora.length && enviadosHora[0] < corte) enviadosHora.shift()
  const restante = cfg.maxPorHora - enviadosHora.length
  if (restante <= 0) {
    return
  }
 
  procesando = true
  try {
    await procesarLote({
      rpc, enviar, cfg, log,
      limite: Math.min(10, restante),
      esperar: () => delay(aleatorio(cfg.pausaMinMs, cfg.pausaMaxMs)),
    })
  } catch (e) {
    log.error('❌ Error leyendo la cola:', e.message)
  } finally {
    procesando = false
  }
}
 
let latidoFallando = false
async function latido() {
  try {
    await rpc('bot_latido', { p_estado: estado })
    latidoFallando = false
  } catch (e) {
    if (!latidoFallando) log.error('No pude contactar a Supabase:', e.message)
    latidoFallando = true
  }
}
 
async function recordatorios() {
  if (estado !== 'conectado') return
  try {
    const n = await rpc('bot_recordatorios')
    if (n > 0) log.log(`⏰ ${n} recordatorio(s) programado(s) para mañana`)
  } catch (e) {
    log.error('Recordatorios:', e.message)
  }
}
 
log.log('🚀 Iniciando bot de WhatsApp de', cfg.negocio)
await conectar()
setInterval(ciclo, cfg.intervaloMs)
setInterval(latido, 30_000)
setInterval(recordatorios, 10 * 60_000)
 
const salir = () => { log.log('Cerrando…'); try { sock?.end(undefined) } catch { /* ya cerrado */ } process.exit(0) }
process.on('SIGINT', salir)
process.on('SIGTERM', salir)