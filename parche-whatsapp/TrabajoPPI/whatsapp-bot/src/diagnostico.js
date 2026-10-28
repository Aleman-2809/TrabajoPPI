// Revisa uno por uno los eslabones del sistema de avisos y dice cuál falla.
//   npm run diagnostico
import 'dotenv/config'
import fs from 'node:fs'
import { leerConfig, validarConfig } from './config.js'
import { crearRpc } from './rpc.js'
import { CARPETA_SESION } from './rutas.js'

const ok = (t) => console.log(`  ✅ ${t}`)
const mal = (t, arreglo) => { console.log(`  ❌ ${t}`); if (arreglo) console.log(`     👉 ${arreglo}`); problemas++ }
const aviso = (t, arreglo) => { console.log(`  ⚠️  ${t}`); if (arreglo) console.log(`     👉 ${arreglo}`); avisos++ }
let problemas = 0
let avisos = 0

console.log('\n🔎 Diagnóstico del bot de WhatsApp\n')

// 1) Node
const mayor = Number(process.versions.node.split('.')[0])
console.log('1. Programa')
mayor >= 20 ? ok(`Node.js ${process.versions.node}`) : mal(`Node.js ${process.versions.node} es muy antiguo`, 'Instala Node.js 20 o superior desde nodejs.org')

// 2) .env
console.log('\n2. Archivo .env')
const cfg = leerConfig()
const faltan = validarConfig(cfg)
if (faltan.length) {
  mal(`Falta completar: ${faltan.join(', ')}`, 'Copia .env.example como .env y complétalo (BOT_SECRET está en Panel → WhatsApp)')
  console.log('\nCorrige esto primero y vuelve a ejecutar el diagnóstico.\n')
  process.exit(1)
}
ok('SUPABASE_URL, SUPABASE_ANON_KEY y BOT_SECRET están escritos')
if (cfg.secret.length < 30) {
  aviso(`Tu BOT_SECRET tiene solo ${cfg.secret.length} caracteres`,
    'El que genera el sistema tiene 64 y NO se inventa: vive en Supabase. Si escribiste uno tuyo, no va a coincidir (ver paso 4)')
}

// 3) Sesión de WhatsApp
console.log('\n3. Vinculación con WhatsApp')
fs.existsSync(`${CARPETA_SESION}/creds.json`)
  ? ok('Hay una sesión guardada (el teléfono ya fue vinculado)')
  : mal('Todavía no has vinculado el teléfono', 'Ejecuta "npm start" y escanea el QR: WhatsApp → Dispositivos vinculados → Vincular un dispositivo')

// 4) Supabase
console.log('\n4. Conexión con Supabase')
const rpc = crearRpc({ url: cfg.supabaseUrl, anonKey: cfg.anonKey, secret: cfg.secret })
let d = null
try {
  await rpc('bot_latido', { p_estado: 'diagnostico' })
  ok('Supabase responde y el BOT_SECRET es correcto')
  d = await rpc('bot_diagnostico')
} catch (e) {
  const m = String(e.message)
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|EAI_AGAIN/i.test(m)) mal('No hay conexión con Supabase', 'Revisa tu internet y que SUPABASE_URL esté bien escrita (https://xxxx.supabase.co)')
  else if (/Could not find the function|does not exist|PGRST202|404/i.test(m)) mal('Faltan las funciones del bot en Supabase', 'Ejecuta el archivo roles_whatsapp.sql en Supabase → SQL Editor (puedes repetirlo sin problema)')
  else if (/No autorizado|28000/i.test(m)) {
  mal('El BOT_SECRET de tu .env NO coincide con el que está guardado en Supabase',
    'La contraseña la genera Supabase (no se inventa). En Supabase → SQL Editor ejecuta:\n        select valor from public.configuracion where clave = \'bot_secret\';\n     y pega ese valor en BOT_SECRET= del .env del bot (sin comillas ni espacios). También lo ves en Panel → WhatsApp → "Datos para conectar el bot".')
}
  else if (/api key|jwt|apikey|401|403/i.test(m)) mal('La clave SUPABASE_ANON_KEY no es válida', 'Usa la misma clave pública (publishable/anon) del .env de la página')
  else mal(`Error inesperado: ${m}`)
}

// 5) Base de datos
if (d) {
  console.log('\n5. Reglas de avisos en la base de datos')
  d.trigger_instalado ? ok('El disparador de reservas está instalado') : mal('El disparador de reservas NO está instalado', 'Ejecuta roles_whatsapp.sql completo en Supabase')
  d.whatsapp_activo ? ok('El envío automático está activado') : mal('El envío automático está APAGADO', 'Enciende el interruptor en Panel → WhatsApp')
  d.cajeras_con_telefono > 0
    ? ok(`${d.cajeras_con_telefono} cajera(s) con WhatsApp recibirán los avisos de nuevas reservas`)
    : aviso('Ninguna cajera recibirá el aviso de nuevas reservas', 'Panel → Usuarios y roles → Editar → rol "cajera" + su número de WhatsApp')
  if (d.cajeras_sin_telefono > 0) aviso(`${d.cajeras_sin_telefono} cajera(s) no tienen número de WhatsApp`, 'Agrégalo en Usuarios y roles')

  const c = d.cola || {}
  console.log(`\n6. Cola de mensajes   (en cola: ${c.pendiente || 0} · enviando: ${c.procesando || 0} · enviados: ${c.enviado || 0} · con error: ${c.error || 0})`)
  if (d.reservas_24h > 0 && d.reservas_24h_con_aviso === 0) {
    mal(`Hubo ${d.reservas_24h} reserva(s) en las últimas 24 h pero NINGUNA generó mensajes`, 'Suele pasar si las reservas se hicieron antes de ejecutar roles_whatsapp.sql, o si el envío estaba apagado. Haz una reserva nueva para probar')
  } else if (d.reservas_24h > 0) ok(`${d.reservas_24h_con_aviso} de ${d.reservas_24h} reservas recientes generaron mensajes`)
  else aviso('No hay reservas en las últimas 24 h para comparar', 'Haz una reserva de prueba desde la página con tu número')
  if ((c.pendiente || 0) > 0) aviso(`Hay ${c.pendiente} mensaje(s) esperando en cola`, 'El bot no los está enviando: ¿está encendido ("npm start") y conectado? Mira el panel → WhatsApp')

  if (d.ultimas?.length) {
    console.log('\n   Últimos mensajes:')
    for (const n of d.ultimas) {
      const icono = { enviado: '✅', error: '❌', pendiente: '⏳', procesando: '📤' }[n.estado] || '•'
      console.log(`   ${icono} #${n.id} ${n.tipo} → ${n.para} (${n.destinatario}) · ${n.estado}${n.error ? ` · ${n.error}` : ''}`)
    }
  }
}

console.log(
  problemas
    ? `\n❗ Se encontraron ${problemas} problema(s). Corrige el primero y vuelve a ejecutar "npm run diagnostico".\n`
    : avisos
      ? '\n🟡 No hay errores graves, pero revisa los avisos ⚠️ de arriba. Si todo lo demás está bien y aún no llega un mensaje, prueba el envío directo:  npm run prueba -- 3001234567\n'
      : '\n🎉 La configuración está bien. Si aún no llega un mensaje, prueba el envío directo:  npm run prueba -- 3001234567\n',
)
process.exit(problemas ? 1 : 0)
