import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Carpeta donde queda guardada la sesión de WhatsApp (para no escanear el QR cada vez)
export const CARPETA_SESION = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'sesion')
