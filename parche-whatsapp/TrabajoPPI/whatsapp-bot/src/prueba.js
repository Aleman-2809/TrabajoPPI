// Envía UN mensaje de prueba directo por WhatsApp (sin pasar por la base de datos).
// Sirve para saber si el problema está en WhatsApp o en el resto del sistema.
//   npm run prueba -- 3001234567
import 'dotenv/config'
import fs from 'node:fs'
import { leerConfig } from './config.js'
import { normalizarTelefono } from './telefono.js'
import { CARPETA_SESION } from './rutas.js'
import { crearWhatsApp, delay } from './whatsapp.js'

const cfg = leerConfig()
const destino = normalizarTelefono(process.argv[2], cfg.codigoPais)
if (!destino) {
  console.error('\nUso:  npm run prueba -- 3001234567\n(escribe el número al que quieres enviar la prueba)\n')
  process.exit(1)
}
if (!fs.existsSync(`${CARPETA_SESION}/creds.json`)) {
  console.log('ℹ️  Todavía no has vinculado WhatsApp. Escanea el QR que aparece abajo (tienes 2 minutos).\n')
}

const wa = crearWhatsApp({ carpetaSesion: CARPETA_SESION, numeroVinculacion: cfg.numeroVinculacion })
await wa.iniciar()

const limite = Date.now() + 120_000
while (wa.estado() !== 'conectado' && Date.now() < limite) await delay(1000)
if (wa.estado() !== 'conectado') {
  console.error('\n❌ No se pudo conectar con WhatsApp en 2 minutos. Revisa tu internet o escanea el QR de nuevo (borra la carpeta "sesion").')
  wa.cerrar(); process.exit(1)
}

try {
  console.log(`\n📤 Enviando mensaje de prueba a ${destino}…`)
  const r = await wa.enviar(destino, `✅ Prueba de ${cfg.negocio}: si lees esto, el bot de WhatsApp funciona correctamente. 🎯`)
  if (r.sinWhatsApp) console.error('❌ Ese número no tiene WhatsApp (o está mal escrito).')
  else console.log(`✅ WhatsApp aceptó el mensaje (id ${r.id}). Revisa el chat de ese número.\n   Si es el MISMO número del bot, búscalo en "Mensajes contigo mismo".`)
  await delay(4000) // deja que termine de entregarse antes de cerrar
} catch (e) {
  console.error('❌ No se pudo enviar:', e.message)
}
wa.cerrar()
process.exit(0)
