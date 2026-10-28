import { useCallback, useEffect, useState } from 'react'

export const ESTADOS_RESERVA = ['pendiente', 'confirmada', 'aplazada', 'completada', 'cancelada']
export const ESTADOS_TICKET = ['abierto', 'en_proceso', 'resuelto']
export const ROLES = ['usuario', 'cajera', 'soporte', 'administrador']

export const PAQUETES = {
  Recluta: 45000,
  Escuadrón: 68000,
  'Operación Total': 95000,
}
export const CAMPOS = ['Selva Cerrada', 'Sector Urbano', 'Línea de Trincheras']
export const MODALIDADES = ['Captura de bandera', 'Eliminación', 'Última bola en pie']

export const cop = (n) =>
  n === null || n === undefined || n === ''
    ? '—'
    : Number(n).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })

export const fechaCorta = (f) => {
  if (!f) return '—'
  const d = new Date(String(f).length === 10 ? f + 'T00:00:00' : f)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}
export const fechaHora = (f) => {
  if (!f) return '—'
  return new Date(f).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function Badge({ valor, texto }) {
  return <span className={`pn-badge pn-badge-${valor}`}>{texto ?? String(valor).replace('_', ' ')}</span>
}

// Fecha local en formato AAAA-MM-DD (sin desfase por zona horaria)
export const hoyISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const num = (n) => Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 2 })

// Convierte errores técnicos de Supabase/Postgres en mensajes entendibles
export function errorAmigable(msg = '') {
  const m = String(msg).toLowerCase()
  if (m.includes('could not find the table') || m.includes('does not exist') || m.includes('schema cache')) {
    return 'Falta crear las tablas en Supabase: ejecuta el archivo supabase/inventario_contabilidad.sql en el SQL Editor.'
  }
  if (m.includes('foreign key')) return 'No se puede eliminar porque tiene movimientos asociados. Mejor desactívalo.'
  if (m.includes('duplicate key')) return 'Ya existe un registro con ese nombre o esa reserva ya fue registrada.'
  if (m.includes('row-level security')) return 'No tienes permiso para realizar esta acción.'
  if (m.includes('monto_check')) return 'El monto debe ser mayor a 0.'
  return msg
}

export function Modal({ titulo, onClose, children, ancho = 520 }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="pn-modal-backdrop" onClick={onClose}>
      <div className="pn-modal" style={{ width: ancho }} onClick={(e) => e.stopPropagation()}>
        <div className="pn-modal-head">
          <h3>{titulo}</h3>
          <button type="button" className="pn-icon-btn" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="pn-modal-body pn-scroll">{children}</div>
      </div>
    </div>
  )
}

export function Confirmar({ mensaje, onSi, onNo }) {
  return (
    <Modal titulo="Confirmar acción" onClose={onNo} ancho={400}>
      <p className="pn-confirm-text">{mensaje}</p>
      <div className="pn-actions">
        <button type="button" className="pn-btn pn-btn-ghost" onClick={onNo}>Cancelar</button>
        <button type="button" className="pn-btn pn-btn-danger" onClick={onSi}>Sí, continuar</button>
      </div>
    </Modal>
  )
}

export function Vacio({ texto }) {
  return <div className="pn-empty">{texto}</div>
}

export function Cargando() {
  return <div className="pn-empty">Cargando…</div>
}

export function Alerta({ tipo = 'error', children, onClose }) {
  if (!children) return null
  return (
    <div className={`pn-alert pn-alert-${tipo}`}>
      <span>{children}</span>
      {onClose && <button type="button" onClick={onClose}>✕</button>}
    </div>
  )
}

// Carga una lista y expone recargar()
export function useLista(fn) {
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const recargar = useCallback(async () => {
    setCargando(true)
    const res = await fn()
    if (res.ok) {
      setDatos(res.data || [])
      setError('')
    } else {
      setError(errorAmigable(res.error) || 'No se pudieron cargar los datos.')
    }
    setCargando(false)
  }, [fn])
  useEffect(() => { recargar() }, [recargar])
  return { datos, cargando, error, recargar, setError }
}

export function descargarCSV(nombre, filas) {
  if (!filas.length) return
  const cols = Object.keys(filas[0])
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [cols.join(','), ...filas.map((f) => cols.map((c) => esc(f[c])).join(','))].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nombre
  a.click()
  URL.revokeObjectURL(a.href)
}

// "hace 5 min", "hace 2 h", "ayer", o la fecha corta
export function haceTiempo(f) {
  if (!f) return ''
  const seg = Math.max(0, Math.round((Date.now() - new Date(f).getTime()) / 1000))
  if (seg < 60) return 'justo ahora'
  const min = Math.round(seg / 60)
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  if (d === 1) return 'ayer'
  if (d < 7) return `hace ${d} días`
  return fechaCorta(f)
}
