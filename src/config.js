// Número de WhatsApp del negocio (con código de país, solo dígitos). Se cambia en el archivo .env:
//   VITE_WHATSAPP_NEGOCIO=573001234567
export const WHATSAPP_NEGOCIO = String(import.meta.env.VITE_WHATSAPP_NEGOCIO || '573000000000').replace(/\D/g, '')

export const enlaceWhatsApp = (texto = '') =>
  `https://wa.me/${WHATSAPP_NEGOCIO}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
