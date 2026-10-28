import 'dotenv/config'
import { leerConfig, validarConfig } from './config.js'
import { crearRpc } from './rpc.js'
import { procesarLote } from './cola.js'
import { CARPETA_SESION } from './rutas.js'
import { crearWhatsApp, delay, aleatorio } from './whatsapp.js'

const cfg = leerConfig()
const faltan = validarConfig(cfg)
if (faltan.length) {
  console.error(`\n❌ Falta configurar en el archivo .env: ${faltan.join(', ')}\n   Copia .env.example como .env y complétalo (mira el README).\n`)
  process.exit(1)
}

const rpc = crearRpc({ url: cfg.supabaseUrl, anonKey: cfg.anonKey, secret: cfg.secret })
const ahora = () => new Date().toLocaleTimeString('es-CO')
const log = {
  log: (...a) => console.log(`[${ahora()}]`, ...a),
  warn: (...a) => console.warn(`[${ahora()}]`, ...a),
  error: (...a) => console.error(`[${ahora()}]`, ...a),
}

const wa = crearWhatsApp({ carpetaSesion: CARPETA_SESION, numeroVinculacion: cfg.numeroVinculacion, log })
const enviadosHora = [] // marcas de tiempo de los envíos de la última hora

async function enviar(telefono, texto) {
  const r = await wa.enviar(telefono, texto)
  if (r.ok) enviadosHora.push(Date.now())
  return r
}

let procesando = false
async function ciclo() {
  if (procesando || wa.estado() !== 'conectado') return
  const corte = Date.now() - 3600_000
  while (enviadosHora.length && enviadosHora[0] < corte) enviadosHora.shift()
  const restante = cfg.maxPorHora - enviadosHora.length
  if (restante <= 0) return // límite por hora alcanzado: espera

  procesando = true
  try {
    await procesarLote({
      rpc, enviar, cfg, log,
      limite: Math.min(10, restante),
      esperar: () => delay(aleatorio(cfg.pausaMinMs, cfg.pausaMaxMs)),
    })
  } catch (e) {
    log.error('Error leyendo la cola:', e.message)
  } finally {
    procesando = false
  }
}

let latidoFallando = false
let latidoOk = false
async function latido() {
  try {
    await rpc('bot_latido', { p_estado: wa.estado() })
    if (!latidoOk || latidoFallando) log.log('✅ Conexión con Supabase correcta.')
    latidoOk = true
    latidoFallando = false
  } catch (e) {
    if (!latidoFallando) log.error('❌ No pude contactar a Supabase (revisa SUPABASE_URL, la clave y BOT_SECRET; prueba "npm run diagnostico"):', e.message)
    latidoFallando = true
  }
}

async function recordatorios() {
  if (wa.estado() !== 'conectado') return
  try {
    const n = await rpc('bot_recordatorios')
    if (n > 0) log.log(`⏰ ${n} recordatorio(s) programado(s) para mañana`)
  } catch (e) {
    log.error('Recordatorios:', e.message)
  }
}

wa.alCambiar((estado) => { if (estado === 'conectado') log.log('Esperando mensajes en la cola…'); latido() })

log.log('🚀 Iniciando bot de WhatsApp de', cfg.negocio)
await latido()
await wa.iniciar()
setInterval(ciclo, cfg.intervaloMs)
setInterval(latido, 30_000)
setInterval(recordatorios, 10 * 60_000)

const salir = () => { log.log('Cerrando…'); wa.cerrar(); process.exit(0) }
process.on('SIGINT', salir)
process.on('SIGTERM', salir)
