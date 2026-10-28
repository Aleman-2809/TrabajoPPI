// Lee la configuración desde el archivo .env (o variables de entorno)
const num = (v, d) => (Number.isFinite(Number(v)) && v !== undefined && v !== '' ? Number(v) : d)

export function leerConfig(env = process.env) {
  return {
    supabaseUrl: (env.SUPABASE_URL || '').replace(/\/+$/, ''),
    anonKey: env.SUPABASE_ANON_KEY || '',
    secret: env.BOT_SECRET || '',
    negocio: env.NOMBRE_NEGOCIO || 'Zona Impacto',
    ubicacion: env.UBICACION || '',
    telefonoNegocio: env.TELEFONO_NEGOCIO || '',
    panelUrl: env.PANEL_URL || '',
    recomendaciones: env.RECOMENDACIONES ?? 'Usa ropa cómoda que pueda ensuciarse y zapatos cerrados.',
    codigoPais: String(env.CODIGO_PAIS || '57').replace(/\D/g, ''),
    intervaloMs: num(env.INTERVALO_SEGUNDOS, 5) * 1000,
    maxPorHora: num(env.MAX_POR_HORA, 40),
    pausaMinMs: num(env.PAUSA_MIN_MS, 2500),
    pausaMaxMs: num(env.PAUSA_MAX_MS, 6000),
    numeroVinculacion: (env.NUMERO_VINCULACION || '').replace(/\D/g, ''),
  }
}

export function validarConfig(c) {
  const faltan = []
  if (!c.supabaseUrl || c.supabaseUrl.includes('TU-PROYECTO')) faltan.push('SUPABASE_URL')
  if (!c.anonKey || c.anonKey.startsWith('tu_')) faltan.push('SUPABASE_ANON_KEY')
  if (!c.secret || c.secret.startsWith('pega_')) faltan.push('BOT_SECRET')
  return faltan
}
