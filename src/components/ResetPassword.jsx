import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../AuthContext'
import { fuerza, traducirError } from './AuthModal'

// Se muestra automáticamente cuando la persona llega desde el enlace del correo
// de "olvidé mi contraseña" (evento PASSWORD_RECOVERY de Supabase).
export default function ResetPassword() {
  const { cambiarContrasena, terminarRecuperacion } = useAuth()
  const [pass, setPass] = useState('')
  const [conf, setConf] = useState('')
  const [ver, setVer] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState(false)

  const guardar = async (e) => {
    e.preventDefault()
    if (pass.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
    if (pass !== conf) return setError('Las contraseñas no coinciden.')
    setEnviando(true)
    setError('')
    const res = await cambiarContrasena(pass)
    setEnviando(false)
    if (!res.success) return setError(traducirError(res.error))
    setListo(true)
  }

  return createPortal(
    <div className="auth-backdrop">
      <div className="auth-modal" role="dialog" aria-modal="true">
        {listo ? (
          <div className="auth-scroll auth-success">
            <div className="auth-success-badge">✓</div>
            <span className="modos-panel-eyebrow stencil">¡Listo!</span>
            <h3>Contraseña actualizada</h3>
            <p className="auth-success-text">Ya puedes usar tu nueva contraseña. Tu sesión quedó iniciada.</p>
            <button type="button" className="btn btn-primary auth-success-cta" onClick={terminarRecuperacion}>
              Continuar
            </button>
          </div>
        ) : (
          <>
            <div className="auth-head">
              <span className="auth-brand stencil">Zona Impacto</span>
              <div className="auth-recover-title">Crea tu nueva contraseña</div>
            </div>
            <div className="auth-scroll">
              <form className="auth-form" onSubmit={guardar}>
                <div className="form-group">
                  <label htmlFor="newPass">Nueva contraseña</label>
                  <input
                    id="newPass" type={ver ? 'text' : 'password'} placeholder="Mínimo 6 caracteres"
                    value={pass} onChange={(e) => { setPass(e.target.value); setError('') }} autoFocus required
                  />
                  {pass && (
                    <div className={`auth-strength auth-strength-${fuerza(pass).nivel}`}>
                      <span /><span /><span /><span />
                      <em>{fuerza(pass).texto}</em>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="newPass2">Confirmar contraseña</label>
                  <input
                    id="newPass2" type={ver ? 'text' : 'password'} placeholder="Repite tu contraseña"
                    value={conf} onChange={(e) => { setConf(e.target.value); setError('') }} required
                  />
                </div>
                <label className="auth-showpass">
                  <input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} />
                  Mostrar contraseña
                </label>
                {error && <p className="auth-error">{error}</p>}
                <button type="submit" className="btn btn-primary auth-submit" disabled={enviando}>
                  {enviando ? 'Guardando...' : 'Guardar contraseña'}
                </button>
                <button type="button" className="auth-link auth-link-center" onClick={terminarRecuperacion}>
                  Cancelar
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
