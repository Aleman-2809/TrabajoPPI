import { useEffect, useState } from 'react'
import { useAuth } from '../AuthContext'
import Reservas from './Reservas'
import Tickets from './Tickets'
import Usuarios from './Usuarios'
import Historial from './Historial'
import Resumen from './Resumen'
import Inventario from './Inventario'
import Contabilidad from './Contabilidad'
import WhatsApp from './WhatsApp'
import { Badge } from './ui'

// Qué ve cada rol:
//  usuario       → Mis reservas · Soporte (reportar errores)
//  cajera        → Resumen · Reservas · Inventario · Reportar un error
//  soporte       → solo Reportes de errores
//  administrador → todo
function pestanasPorRol(rol) {
  const resumen = { id: 'resumen', label: 'Resumen' }
  const reservas = { id: 'reservas', label: 'Reservas' }
  const inventario = { id: 'inventario', label: 'Inventario' }
  switch (rol) {
    case 'administrador':
      return [resumen, reservas, { id: 'tickets', label: 'Reportes de errores' }, inventario,
        { id: 'contabilidad', label: 'Contabilidad' }, { id: 'whatsapp', label: 'WhatsApp' },
        { id: 'historial', label: 'Historial de registros' }, { id: 'usuarios', label: 'Usuarios y roles' }]
    case 'cajera':
      return [resumen, reservas, inventario, { id: 'tickets', label: 'Reportar un error' }]
    case 'soporte':
      return [{ id: 'tickets', label: 'Reportes de errores' }]
    default:
      return [{ id: 'reservas', label: 'Mis reservas' }, { id: 'tickets', label: 'Soporte' }]
  }
}
const TITULO_LATERAL = { administrador: 'Administración', cajera: 'Caja', soporte: 'Soporte', usuario: 'Mi cuenta' }

export default function Panel() {
  const { user, loading, nombre, rol, esAdmin, cerrarSesion } = useAuth()
  const pestanas = pestanasPorRol(rol)
  const [tab, setTab] = useState(null)
  const actual = tab && pestanas.some((p) => p.id === tab) ? tab : pestanas[0].id

  useEffect(() => { window.scrollTo(0, 0) }, [])

  if (loading) return <div className="pn-page"><div className="pn-empty">Cargando…</div></div>

  if (!user) {
    return (
      <div className="pn-page">
        <div className="pn-gate">
          <h2>Necesitas iniciar sesión</h2>
          <p>Ingresa a tu cuenta para ver tu panel.</p>
          <a className="btn btn-primary" href="#">Volver al inicio</a>
        </div>
      </div>
    )
  }

  return (
    <div className="pn-page">
      <header className="pn-top">
        <a href="#" className="pn-top-logo stencil"><span className="logo-mark" /> Zona Impacto</a>
        <div className="pn-top-user">
          <div>
            <strong>{nombre}</strong>
            <Badge valor={rol} />
          </div>
          <a className="pn-btn pn-btn-sm pn-btn-ghost" href="#">← Sitio</a>
          <button type="button" className="pn-btn pn-btn-sm pn-btn-danger" onClick={async () => { await cerrarSesion(); window.location.hash = '' }}>
            Salir
          </button>
        </div>
      </header>

      <div className="pn-layout">
        <aside className="pn-side">
          <span className="pn-side-title stencil">{TITULO_LATERAL[rol] || 'Mi cuenta'}</span>
          {pestanas.map((p) => (
            <button key={p.id} type="button" className={actual === p.id ? 'pn-tab pn-tab-on' : 'pn-tab'} onClick={() => setTab(p.id)}>
              {p.label}
            </button>
          ))}
        </aside>
        <main className="pn-main">
          {actual !== 'tickets' && <h1>{pestanas.find((p) => p.id === actual)?.label}</h1>}
          {actual === 'resumen' && <Resumen esAdmin={esAdmin} />}
          {actual === 'reservas' && <Reservas />}
          {actual === 'tickets' && <Tickets />}
          {actual === 'inventario' && <Inventario />}
          {actual === 'contabilidad' && <Contabilidad />}
          {actual === 'whatsapp' && <WhatsApp />}
          {actual === 'historial' && <Historial />}
          {actual === 'usuarios' && <Usuarios />}
        </main>
      </div>
    </div>
  )
}
