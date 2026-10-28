import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../AuthContext'

const estadoInicial = {
  nombre: '',
  email: '',
  password: '',
  confirmar: '',
}

export default function AuthModal({ onClose }) {
  const { registrar, iniciarSesion, enviarRecuperacion } = useAuth()
  const [tab, setTab] = useState('login') // 'login' | 'registro' | 'recuperar'
  const [enviadoRecuperacion, setEnviadoRecuperacion] = useState(false)
  const [datos, setDatos] = useState(estadoInicial)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [verPass, setVerPass] = useState(false)
  const [exito, setExito] = useState(null) // { codigoDescuento, requiereConfirmacion } cuando el registro fue exitoso

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const handleChange = (e) => {
    const { name, value } = e.target
    setDatos((prev) => ({ ...prev, [name]: value }))
    setError('')
  }

  const cambiarTab = (nuevaTab) => {
    setTab(nuevaTab)
    setError('')
    setExito(null)
    setEnviadoRecuperacion(false)
  }

  const handleRecuperar = async (e) => {
    e.preventDefault()
    if (!datos.email) {
      setError('Escribe el correo con el que te registraste.')
      return
    }
    setEnviando(true)
    setError('')
    const res = await enviarRecuperacion(datos.email)
    setEnviando(false)
    if (!res.success) {
      setError(traducirError(res.error))
      return
    }
    setEnviadoRecuperacion(true)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!datos.email || !datos.password) {
      setError('Completa tu correo y contraseña.')
      return
    }
    setEnviando(true)
    setError('')
    const res = await iniciarSesion({ email: datos.email, password: datos.password })
    setEnviando(false)
    if (!res.success) {
      setError(traducirError(res.error))
      return
    }
    onClose()
  }

  const handleRegistro = async (e) => {
    e.preventDefault()
    if (!datos.nombre || !datos.email || !datos.password || !datos.confirmar) {
      setError('Completa todos los campos.')
      return
    }
    if (datos.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (datos.password !== datos.confirmar) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setEnviando(true)
    setError('')
    const res = await registrar({ nombre: datos.nombre, email: datos.email, password: datos.password })
    setEnviando(false)
    if (!res.success) {
      setError(traducirError(res.error))
      return
    }
    setExito({ codigoDescuento: res.codigoDescuento, requiereConfirmacion: res.requiereConfirmacion })
  }

  return createPortal(
    <div className="auth-backdrop" onClick={onClose}>
      <div className="auth-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="auth-close" onClick={onClose} aria-label="Cerrar">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
            <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {exito ? (
          <div className="auth-scroll auth-success">
            <div className="auth-success-badge">%</div>
            <span className="modos-panel-eyebrow stencil">¡Cuenta creada!</span>
            <h3>Tienes 20% de descuento</h3>
            <p className="auth-success-text">
              {exito.requiereConfirmacion
                ? 'Confirma tu correo para activar tu cuenta. Tu descuento ya quedó guardado y listo para usar apenas ingreses.'
                : 'Ya puedes usarlo en tu próxima reserva.'}
            </p>
            <div className="auth-code">
              <span>{exito.codigoDescuento}</span>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(exito.codigoDescuento)}
                title="Copiar código"
              >
                Copiar
              </button>
            </div>
            <button
              type="button"
              className="btn btn-primary auth-success-cta"
              onClick={() => {
                onClose()
                document.getElementById('reserva')?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              Ir a reservar
            </button>
          </div>
        ) : (
          <>
            <div className="auth-head">
              <span className="auth-brand stencil">Zona Impacto</span>
              {tab === 'recuperar' ? (
                <div className="auth-recover-title">Recuperar contraseña</div>
              ) : (
              <div className="auth-tabs">
              <button
                type="button"
                className={tab === 'login' ? 'auth-tab auth-tab-active' : 'auth-tab'}
                onClick={() => cambiarTab('login')}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                className={tab === 'registro' ? 'auth-tab auth-tab-active' : 'auth-tab'}
                onClick={() => cambiarTab('registro')}
              >
                Crear cuenta
              </button>
              </div>
              )}
            </div>

            <div className="auth-scroll">
            {tab === 'registro' && (
              <div className="auth-perk">
                <span className="auth-perk-icon">%</span>
                <span>Regístrate y obtén <strong>20% de descuento</strong> en tu próxima reserva.</span>
              </div>
            )}

            {tab === 'recuperar' ? (
              enviadoRecuperacion ? (
                <div className="auth-recover-ok">
                  <div className="auth-success-badge">✉</div>
                  <h3>Revisa tu correo</h3>
                  <p className="auth-success-text">
                    Si <strong>{datos.email}</strong> tiene una cuenta, te enviamos un enlace para crear una nueva
                    contraseña. Puede tardar un par de minutos; revisa también la carpeta de spam.
                  </p>
                  <button type="button" className="btn btn-primary auth-submit" onClick={() => cambiarTab('login')}>
                    Volver a iniciar sesión
                  </button>
                </div>
              ) : (
                <form className="auth-form" onSubmit={handleRecuperar}>
                  <p className="auth-help">
                    Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.
                  </p>
                  <div className="form-group">
                    <label htmlFor="recEmail">Correo electrónico</label>
                    <input
                      type="email"
                      id="recEmail"
                      name="email"
                      placeholder="tucorreo@ejemplo.com"
                      value={datos.email}
                      onChange={handleChange}
                      autoFocus
                      required
                    />
                  </div>
                  {error && <p className="auth-error">{error}</p>}
                  <button type="submit" className="btn btn-primary auth-submit" disabled={enviando}>
                    {enviando ? 'Enviando...' : 'Enviar enlace'}
                  </button>
                  <button type="button" className="auth-link auth-link-center" onClick={() => cambiarTab('login')}>
                    ← Volver a iniciar sesión
                  </button>
                </form>
              )
            ) : tab === 'login' ? (
              <form className="auth-form" onSubmit={handleLogin}>
                <div className="form-group">
                  <label htmlFor="loginEmail">Correo electrónico</label>
                  <input
                    type="email"
                    id="loginEmail"
                    name="email"
                    placeholder="tucorreo@ejemplo.com"
                    value={datos.email}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="loginPassword">Contraseña</label>
                  <input
                    type={verPass ? 'text' : 'password'}
                    id="loginPassword"
                    name="password"
                    placeholder="••••••••"
                    value={datos.password}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="auth-extras">
                  <label className="auth-showpass">
                    <input type="checkbox" checked={verPass} onChange={(e) => setVerPass(e.target.checked)} />
                    Mostrar contraseña
                  </label>
                  <button type="button" className="auth-link" onClick={() => cambiarTab('recuperar')}>
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                {error && <p className="auth-error">{error}</p>}
                <button type="submit" className="btn btn-primary auth-submit" disabled={enviando}>
                  {enviando ? 'Ingresando...' : 'Iniciar sesión'}
                </button>
              </form>
            ) : (
              <form className="auth-form" onSubmit={handleRegistro}>
                <div className="form-group">
                  <label htmlFor="regNombre">Nombre completo</label>
                  <input
                    type="text"
                    id="regNombre"
                    name="nombre"
                    placeholder="Ej: Juan Pérez"
                    value={datos.nombre}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="regEmail">Correo electrónico</label>
                  <input
                    type="email"
                    id="regEmail"
                    name="email"
                    placeholder="tucorreo@ejemplo.com"
                    value={datos.email}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="auth-row">
                <div className="form-group">
                  <label htmlFor="regPassword">Contraseña</label>
                  <input
                    type={verPass ? 'text' : 'password'}
                    id="regPassword"
                    name="password"
                    placeholder="Mínimo 6 caracteres"
                    value={datos.password}
                    onChange={handleChange}
                    required
                  />
                  {datos.password && (
                    <div className={`auth-strength auth-strength-${fuerza(datos.password).nivel}`}>
                      <span /><span /><span /><span />
                      <em>{fuerza(datos.password).texto}</em>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="regConfirmar">Confirmar contraseña</label>
                  <input
                    type={verPass ? 'text' : 'password'}
                    id="regConfirmar"
                    name="confirmar"
                    placeholder="Repite tu contraseña"
                    value={datos.confirmar}
                    onChange={handleChange}
                    required
                  />
                </div>
                </div>
                <label className="auth-showpass">
                  <input type="checkbox" checked={verPass} onChange={(e) => setVerPass(e.target.checked)} />
                  Mostrar contraseña
                </label>
                {error && <p className="auth-error">{error}</p>}
                <button type="submit" className="btn btn-primary auth-submit" disabled={enviando}>
                  {enviando ? 'Creando cuenta...' : 'Crear cuenta y obtener 20% OFF'}
                </button>
              </form>
            )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

export function traducirError(msg = '') {
  const m = msg.toLowerCase()
  if (m.includes('already registered') || m.includes('already exists')) {
    return 'Ese correo ya tiene una cuenta. Intenta iniciar sesión.'
  }
  if (m.includes('invalid login credentials')) {
    return 'Correo o contraseña incorrectos.'
  }
  if (m.includes('password should be at least')) {
    return 'La contraseña debe tener al menos 6 caracteres.'
  }
  if (m.includes('rate limit') || m.includes('security purposes')) {
    return 'Demasiados intentos. Espera un minuto y vuelve a intentarlo.'
  }
  if (m.includes('different from the old password')) {
    return 'La nueva contraseña debe ser diferente a la anterior.'
  }
  if (m.includes('session missing') || m.includes('expired') || m.includes('invalid')) {
    if (!m.includes('login credentials')) return 'El enlace venció o ya fue usado. Pide uno nuevo.'
  }
  if (m.includes('email not confirmed')) {
    return 'Debes confirmar tu correo antes de iniciar sesión.'
  }
  return msg || 'Ocurrió un error. Intenta de nuevo.'
}

export function fuerza(pass = '') {
  let puntos = 0
  if (pass.length >= 6) puntos++
  if (pass.length >= 10) puntos++
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) puntos++
  if (/\d/.test(pass) && /[^A-Za-z0-9]/.test(pass)) puntos++
  const textos = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Excelente']
  return { nivel: puntos, texto: textos[puntos] }
}
