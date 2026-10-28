// Convierte lo que escribió el cliente ("300 123 4567", "+57 300...", "3001234567")
// en el formato que pide WhatsApp: solo dígitos con código de país (573001234567).
export function normalizarTelefono(crudo, codigoPais = '57') {
  let d = String(crudo ?? '').replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('00')) d = d.slice(2)

  // Celular colombiano de 10 dígitos (empieza por 3): se le agrega el 57
  if (codigoPais === '57' && d.length === 10) return d.startsWith('3') ? `57${d}` : null
  if (d.length === 10) return `${codigoPais}${d}`

  // Ya trae código de país
  if (d.startsWith(codigoPais) && d.length >= 11 && d.length <= 15) return d
  if (d.length >= 11 && d.length <= 15) return d // otro país
  return null
}
