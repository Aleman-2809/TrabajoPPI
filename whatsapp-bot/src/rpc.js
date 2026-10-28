// Cliente mínimo para llamar a las funciones del bot en Supabase (sin dependencias extra)
export function crearRpc({ url, anonKey, secret, fetchImpl = fetch }) {
  const headers = { 'Content-Type': 'application/json', apikey: anonKey }
  // Las claves antiguas (JWT) también van en Authorization; las nuevas "sb_publishable_…" no
  if (anonKey.startsWith('eyJ')) headers.Authorization = `Bearer ${anonKey}`

  return async function rpc(nombre, args = {}) {
    const res = await fetchImpl(`${url}/rest/v1/rpc/${nombre}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_secret: secret, ...args }),
    })
    const texto = await res.text()
    if (!res.ok) {
      let msg = texto
      try { msg = JSON.parse(texto).message || texto } catch { /* texto plano */ }
      throw new Error(`${nombre} → ${res.status}: ${String(msg).slice(0, 200)}`)
    }
    return texto ? JSON.parse(texto) : null
  }
}
