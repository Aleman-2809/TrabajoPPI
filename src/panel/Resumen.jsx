import { useEffect, useState } from 'react'
import { listarReservas, listarPerfiles, listarTickets, listarHistorial, listarProductos, listarTransacciones } from '../supabaseClient'
import { cop, hoyISO, Cargando } from './ui'

// Administrador: panorama completo. Cajera: solo lo de caja (reservas e inventario), sin finanzas.
export default function Resumen({ esAdmin }) {
  const [d, setD] = useState(null)
  useEffect(() => {
    (async () => {
      const vacio = { data: [] }
      const [r, pr, p, t, h, tr] = await Promise.all([
        listarReservas(), listarProductos(),
        esAdmin ? listarPerfiles() : vacio, esAdmin ? listarTickets() : vacio,
        esAdmin ? listarHistorial() : vacio, esAdmin ? listarTransacciones() : vacio,
      ])
      const reservas = r.data || []
      const hoy = hoyISO()
      const mesActual = hoy.slice(0, 7)
      const delMes = (tr.data || []).filter((x) => String(x.fecha).slice(0, 7) === mesActual)
      const sumar = (tipo) => delMes.filter((x) => x.tipo === tipo).reduce((a, x) => a + Number(x.monto), 0)
      const hace7 = Date.now() - 7 * 864e5
      setD({
        reservas: reservas.length,
        pendientes: reservas.filter((x) => x.estado === 'pendiente').length,
        hoy: reservas.filter((x) => x.fecha === hoy && x.estado !== 'cancelada').length,
        ingresos: reservas.filter((x) => ['confirmada', 'completada'].includes(x.estado)).reduce((a, x) => a + Number(x.total || 0), 0),
        stockBajo: (pr.data || []).filter((x) => x.activo && Number(x.stock) <= Number(x.stock_minimo)).length,
        usuarios: (p.data || []).length,
        registros: (h.data || []).length,
        nuevos7: (h.data || []).filter((x) => new Date(x.created_at).getTime() > hace7).length,
        errores: (t.data || []).filter((x) => x.estado !== 'resuelto').length,
        utilidadMes: sumar('ingreso') - sumar('gasto'),
      })
    })()
  }, [esAdmin])

  if (!d) return <Cargando />
  const tarjetas = esAdmin
    ? [
        ['Reservas totales', d.reservas], ['Reservas pendientes', d.pendientes], ['Ingresos confirmados', cop(d.ingresos)],
        ['Utilidad del mes', cop(d.utilidadMes)], ['Registros totales', d.registros], ['Registros últimos 7 días', d.nuevos7],
        ['Errores sin resolver', d.errores], ['Productos con stock bajo', d.stockBajo], ['Cuentas en el sistema', d.usuarios],
      ]
    : [
        ['Reservas de hoy', d.hoy], ['Pendientes por confirmar', d.pendientes],
        ['Reservas totales', d.reservas], ['Productos con stock bajo', d.stockBajo],
      ]
  return (
    <div className="pn-stats">
      {tarjetas.map(([t, v]) => (
        <div className="pn-stat" key={t}><span>{t}</span><strong>{v}</strong></div>
      ))}
    </div>
  )
}
