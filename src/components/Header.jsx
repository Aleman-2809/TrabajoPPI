import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../AuthContext'
import AuthModal from './AuthModal'

const modos = [
  {
    nombre: 'Eliminación',
    color: 'var(--blaze)',
    desc: 'Todos contra todos o por equipos: gana quien queda en pie.',
    meta: ['4–30 jugadores', 'Dificultad media'],
    detalles: [
      'Partidas por tiempo o hasta que caiga el último jugador.',
      'Modalidad individual (todos contra todos) o por equipos.',
      'Respawns limitados según el reglamento de cada partida.',
      'Ideal para grupos nuevos que quieren acción rápida.',
    ],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 1.5V5M12 19V22.5M1.5 12H5M19 12H22.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    nombre: 'Captura la bandera',
    color: 'var(--paint-yellow)',
    desc: 'Toma la bandera rival y llévala a tu base sin caer.',
    meta: ['10–40 jugadores', 'Dificultad media'],
    detalles: [
      'Dos equipos, dos banderas y dos bases que defender.',
      'Gana el primer equipo en llevar la bandera rival a su base.',
      'Requiere estrategia de ataque y defensa simultánea.',
      'Se juega mejor en campos abiertos como Trincheras.',
    ],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 21V3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M5 4C8 2.5 10.5 5 14 3.5C16 2.7 18 3 19 3.8V13C17.5 12 15.5 12.8 13.5 13.5C10.8 14.5 8 12.2 5 13.6V4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    nombre: 'Escenario / Misión',
    color: 'var(--paint-cyan)',
    desc: 'Objetivos narrativos: rescates, defensa de zona, cargas.',
    meta: ['8–40 jugadores', 'Dificultad alta'],
    detalles: [
      'Cada partida tiene una historia y objetivos concretos.',
      'Ejemplos: rescatar un rehén, defender una zona, escoltar carga.',
      'Un árbitro guía el desarrollo de la misión en tiempo real.',
      'Perfecto para grupos que buscan una experiencia más inmersiva.',
    ],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 4L3 6.5V20L9 17.5L15 20L21 17.5V4L15 6.5L9 4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M9 4V17.5M15 6.5V20" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    nombre: 'VIP',
    color: 'var(--paint-magenta)',
    desc: 'Un jugador protegido debe llegar a la extracción con su escolta.',
    meta: ['6–20 jugadores', 'Dificultad alta'],
    detalles: [
      'Un jugador es designado VIP y debe llegar vivo al punto de extracción.',
      'Su equipo actúa como escolta, protegiéndolo del equipo rival.',
      'El equipo contrario gana si elimina al VIP antes de la extracción.',
      'Modo pensado para partidas tácticas y coordinadas.',
    ],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2.5L14.6 8.7L21.3 9.3L16.3 13.7L17.8 20.3L12 16.8L6.2 20.3L7.7 13.7L2.7 9.3L9.4 8.7L12 2.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
]

export default function Header() {
  const [open, setOpen] = useState(false)
  const [modosOpen, setModosOpen] = useState(false)
  const [modoActivo, setModoActivo] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const panelRef = useRef(null)
  const userMenuRef = useRef(null)
  const { user, nombre, descuento, codigoDescuento, rol, cerrarSesion } = useAuth()

  const closeMenu = () => {
    setOpen(false)
    setModosOpen(false)
    setModoActivo(null)
  }

  // Cerrar con la tecla Escape (si hay un modo abierto, primero vuelve a la lista)
  useEffect(() => {
    if (!modosOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (modoActivo) setModoActivo(null)
        else setModosOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [modosOpen, modoActivo])

  // Cerrar al hacer click fuera del panel
  useEffect(() => {
    if (!modosOpen) return
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setModosOpen(false)
        setModoActivo(null)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [modosOpen])

  // Cerrar el menú de usuario al hacer click fuera
  useEffect(() => {
    if (!userMenuOpen) return
    const onClick = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [userMenuOpen])

  return (
    <header>
      <div className="nav-wrap">
        <div className="logo stencil">
          <span className="logo-mark"></span>
          Zona Impacto
        </div>

        <input
          type="checkbox"
          id="navToggle"
          checked={open}
          onChange={(e) => setOpen(e.target.checked)}
        />

        <nav>
          <ul>
            <li className="nav-dropdown" ref={panelRef}>
              <button
                type="button"
                className="nav-dropdown-trigger"
                onClick={() => setModosOpen((v) => !v)}
                aria-expanded={modosOpen}
              >
                Modos de juego
                <svg
                  className={`chevron ${modosOpen ? 'chevron-open' : ''}`}
                  viewBox="0 0 24 24"
                  width="12"
                  height="12"
                  fill="none"
                >
                  <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {modosOpen && (
                <>
                  <div
                    className="modos-backdrop"
                    onClick={() => {
                      setModosOpen(false)
                      setModoActivo(null)
                    }}
                  />
                  <div className="modos-panel">
                    {!modoActivo ? (
                      <>
                        <div className="modos-panel-header">
                          <span className="modos-panel-eyebrow stencil">Elige tu estilo</span>
                          <h3>Modos de juego</h3>
                        </div>
                        <div className="modos-grid">
                          {modos.map((m) => (
                            <div
                              className="modo-card"
                              key={m.nombre}
                              style={{ '--modo-color': m.color }}
                            >
                              <span className="modo-icon">{m.icon}</span>
                              <div className="modo-card-body">
                                <strong>{m.nombre}</strong>
                                <p>{m.desc}</p>
                                <button
                                  type="button"
                                  className="modo-more-btn"
                                  onClick={() => setModoActivo(m.nombre)}
                                >
                                  Más características
                                  <svg viewBox="0 0 24 24" width="11" height="11" fill="none">
                                    <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      (() => {
                        const m = modos.find((x) => x.nombre === modoActivo)
                        return (
                          <div className="modo-detail">
                            <button
                              type="button"
                              className="modo-back-btn"
                              onClick={() => setModoActivo(null)}
                            >
                              <svg viewBox="0 0 24 24" width="13" height="13" fill="none">
                                <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              Volver
                            </button>
                            <div className="modo-detail-head" style={{ '--modo-color': m.color }}>
                              <span className="modo-icon modo-icon-lg">{m.icon}</span>
                              <div>
                                <h3>{m.nombre}</h3>
                                <div className="modo-detail-meta">
                                  <span>{m.meta[0]}</span>
                                  <span>·</span>
                                  <span>{m.meta[1]}</span>
                                </div>
                              </div>
                            </div>
                            <p className="modo-detail-desc">{m.desc}</p>
                            <ul className="modo-detail-list">
                              {m.detalles.map((d, i) => (
                                <li key={i}>{d}</li>
                              ))}
                            </ul>
                          </div>
                        )
                      })()
                    )}
                  </div>
                </>
              )}
            </li>
            <li><a href="#campos" onClick={closeMenu}>Campos</a></li>
            <li><a href="#como-funciona" onClick={closeMenu}>Cómo funciona</a></li>
            <li><a href="#paquetes" onClick={closeMenu}>Paquetes</a></li>
            <li><a href="#testimonios" onClick={closeMenu}>Opiniones</a></li>

            <li className="nav-dropdown" ref={userMenuRef}>
              {user ? (
                <>
                  <button
                    type="button"
                    className="nav-user-trigger"
                    onClick={() => setUserMenuOpen((v) => !v)}
                    aria-expanded={userMenuOpen}
                  >
                    <span className="nav-user-avatar">{(nombre || 'U').charAt(0).toUpperCase()}</span>
                    <span className="nav-user-name">{nombre.split(' ')[0] || 'Cuenta'}</span>
                    {descuento > 0 && <span className="nav-user-badge">-{descuento}%</span>}
                  </button>
                  {userMenuOpen && (
                    <div className="user-menu">
                      <div className="user-menu-head">
                        <strong>{nombre}</strong>
                        <span className="user-menu-role">{rol}</span>
                        {descuento > 0 && (
                          <div className="user-menu-code">
                            <span>Tu código: {codigoDescuento}</span>
                          </div>
                        )}
                      </div>
                      <a
                        href="#/panel"
                        className="user-menu-panel"
                        onClick={() => { setUserMenuOpen(false); closeMenu() }}
                      >
                        {{ administrador: 'Panel de administración', cajera: 'Panel de caja', soporte: 'Panel de soporte' }[rol] || 'Mi panel'}
                      </a>
                      <button
                        type="button"
                        className="user-menu-logout"
                        onClick={async () => {
                          await cerrarSesion()
                          setUserMenuOpen(false)
                          closeMenu()
                        }}
                      >
                        Cerrar sesión
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <button type="button" className="nav-login-btn" onClick={() => setAuthOpen(true)}>
                  Iniciar sesión
                </button>
              )}
            </li>

            <li><a href="#reserva" className="nav-cta" onClick={closeMenu}>Reservar</a></li>
          </ul>
        </nav>

        <label htmlFor="navToggle" className="burger">
          <span></span><span></span><span></span>
        </label>
      </div>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </header>
  )
}
