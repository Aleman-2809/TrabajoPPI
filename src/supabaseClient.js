import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabaseConfigurado = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

if (!supabaseConfigurado) {
  console.error(
    '[Zona Impacto] Faltan las variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
    'Crea un archivo .env en la raíz del proyecto (puedes copiar .env.example) y reinicia "npm run dev".'
  )
}

// Si no hay configuración, exportamos null en vez de dejar que createClient() lance un error
// que tumbaría toda la app (pantalla en blanco). Así el resto del sitio sigue funcionando.
export const supabase = supabaseConfigurado ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null

const ERROR_NO_CONFIG = 'El sistema de cuentas no está configurado. Falta el archivo .env con las credenciales de Supabase.'

export async function guardarReservaEnBD(datos) {
  if (!supabase) {
    console.error(ERROR_NO_CONFIG)
    return false
  }
  const { data: sesion } = await supabase.auth.getSession()
  const user_id = sesion?.session?.user?.id ?? null
  const { error } = await supabase.from('reservas').insert([{ ...datos, user_id, estado: 'pendiente' }])
  if (error) {
    console.error('Error guardando la reserva en Supabase:', error)
    return false
  }
  return true
}

// Genera un código de descuento único para cada nuevo registro, ej: BIENVENIDA20-7F3K9
export function generarCodigoDescuento() {
  const random = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `BIENVENIDA20-${random}`
}

// Crea la cuenta del usuario y le asigna automáticamente 20% de descuento
export async function registrarUsuario({ nombre, email, password }) {
  if (!supabase) return { success: false, error: ERROR_NO_CONFIG }

  const codigoDescuento = generarCodigoDescuento()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nombre,
        descuento: 20,
        codigo_descuento: codigoDescuento,
      },
    },
  })

  if (error) {
    return { success: false, error: error.message }
  }

  // Si el proyecto de Supabase tiene desactivada la confirmación por email,
  // `data.session` ya viene activa y el usuario queda logueado de inmediato.
  const requiereConfirmacion = !data.session

  return {
    success: true,
    requiereConfirmacion,
    codigoDescuento,
    user: data.user,
  }
}

export async function iniciarSesionUsuario({ email, password }) {
  if (!supabase) return { success: false, error: ERROR_NO_CONFIG }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return { success: false, error: error.message }
  }
  return { success: true, user: data.user }
}

// Envía el correo con el enlace para restablecer la contraseña.
// Supabase responde "ok" aunque el correo no exista (así no se revela quién tiene cuenta).
export async function enviarRecuperacion(email) {
  if (!supabase) return { success: false, error: ERROR_NO_CONFIG }
  const redirectTo = `${window.location.origin}${window.location.pathname}`
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// Guarda la nueva contraseña (requiere la sesión temporal que crea el enlace del correo).
export async function cambiarContrasena(password) {
  if (!supabase) return { success: false, error: ERROR_NO_CONFIG }
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function cerrarSesionUsuario() {
  if (!supabase) return
  await supabase.auth.signOut()
}

// =====================================================================
// CRUD — perfiles, historial, reservas y tickets
// Todas devuelven { ok, data, error } para manejar errores fácilmente.
// =====================================================================
async function ejecutar(consulta) {
  if (!supabase) return { ok: false, data: null, error: ERROR_NO_CONFIG }
  const { data, error } = await consulta
  if (error) {
    console.error('[Zona Impacto]', error)
    return { ok: false, data: null, error: error.message }
  }
  return { ok: true, data, error: null }
}

// ---------- Perfiles ----------
export const obtenerPerfil = (id) =>
  supabase ? ejecutar(supabase.from('perfiles').select('*').eq('id', id).maybeSingle()) : ejecutar(null)
export const listarPerfiles = () =>
  ejecutar(supabase?.from('perfiles').select('*').order('created_at', { ascending: false }))
export const actualizarPerfil = (id, cambios) =>
  ejecutar(supabase?.from('perfiles').update(cambios).eq('id', id).select().single())

// ---------- Historial de registros ----------
export const listarHistorial = () =>
  ejecutar(supabase?.from('historial_registros').select('*').order('created_at', { ascending: false }))
export const eliminarHistorial = (id) =>
  ejecutar(supabase?.from('historial_registros').delete().eq('id', id))

// ---------- Reservas ----------
export const listarReservas = () =>
  ejecutar(supabase?.from('reservas').select('*').order('fecha', { ascending: false }))
export const crearReserva = (datos) =>
  ejecutar(supabase?.from('reservas').insert([datos]).select().single())
export const actualizarReserva = (id, cambios) =>
  ejecutar(supabase?.from('reservas').update(cambios).eq('id', id).select().single())
export const eliminarReserva = (id) =>
  ejecutar(supabase?.from('reservas').delete().eq('id', id))

// ---------- Tickets de soporte ----------
export const listarTickets = () =>
  ejecutar(supabase?.from('tickets').select('*').order('created_at', { ascending: false }))
export const crearTicket = (datos) =>
  ejecutar(supabase?.from('tickets').insert([datos]).select().single())
export const actualizarTicket = (id, cambios) =>
  ejecutar(supabase?.from('tickets').update(cambios).eq('id', id).select().single())
export const eliminarTicket = (id) =>
  ejecutar(supabase?.from('tickets').delete().eq('id', id))

// ---------- Inventario ----------
export const listarProductos = () =>
  ejecutar(supabase?.from('productos').select('*').order('nombre', { ascending: true }))
export const crearProducto = (datos) =>
  ejecutar(supabase?.from('productos').insert([datos]).select().single())
export const actualizarProducto = (id, cambios) =>
  ejecutar(supabase?.from('productos').update(cambios).eq('id', id).select().single())
export const eliminarProducto = (id) =>
  ejecutar(supabase?.from('productos').delete().eq('id', id))

export const listarMovimientos = () =>
  ejecutar(
    supabase?.from('movimientos_inventario').select('*').order('created_at', { ascending: false }).limit(500),
  )
export const crearMovimiento = (datos) =>
  ejecutar(supabase?.from('movimientos_inventario').insert([datos]).select().single())

// ---------- Contabilidad ----------
export const listarTransacciones = () =>
  ejecutar(supabase?.from('transacciones').select('*').order('fecha', { ascending: false }).order('id', { ascending: false }))
export const crearTransacciones = (filas) =>
  ejecutar(supabase?.from('transacciones').insert(filas).select())
export const actualizarTransaccion = (id, cambios) =>
  ejecutar(supabase?.from('transacciones').update(cambios).eq('id', id).select().single())
export const eliminarTransaccion = (id) =>
  ejecutar(supabase?.from('transacciones').delete().eq('id', id))

// ---------- WhatsApp automático (solo administrador) ----------
export const listarNotificaciones = () =>
  ejecutar(supabase?.from('notificaciones_whatsapp').select('*').order('id', { ascending: false }).limit(150))
export const reintentarNotificacion = (id) =>
  ejecutar(
    supabase?.from('notificaciones_whatsapp')
      .update({ estado: 'pendiente', intentos: 0, error: null, proximo_intento: new Date().toISOString() })
      .eq('id', id),
  )
export const listarConfig = () => ejecutar(supabase?.from('configuracion').select('*'))
export const guardarConfig = (clave, valor) =>
  ejecutar(supabase?.from('configuracion').upsert({ clave, valor, updated_at: new Date().toISOString() }))
