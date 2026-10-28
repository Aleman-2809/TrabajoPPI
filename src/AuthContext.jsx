import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  supabase,
  registrarUsuario,
  iniciarSesionUsuario,
  cerrarSesionUsuario,
  obtenerPerfil,
  enviarRecuperacion,
  cambiarContrasena,
} from './supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [loading, setLoading] = useState(true)
  const [aviso, setAviso] = useState('')
  const [recuperando, setRecuperando] = useState(false) // true cuando llegó desde el enlace del correo

  const cargarPerfil = useCallback(async (u) => {
    if (!u) {
      setPerfil(null)
      return
    }
    const res = await obtenerPerfil(u.id)
    if (res.ok && res.data) {
      if (res.data.activo === false) {
        setAviso('Tu cuenta está desactivada. Contacta a soporte.')
        await cerrarSesionUsuario()
        setUser(null)
        setPerfil(null)
        return
      }
      setPerfil(res.data)
    } else {
      setPerfil(null) // sin tabla `perfiles` todavía: la app sigue funcionando como usuario normal
    }
  }, [])

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user ?? null
      setUser(u)
      await cargarPerfil(u)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecuperando(true)
      const u = session?.user ?? null
      setUser(u)
      // setTimeout evita bloquear el callback interno de supabase-js
      setTimeout(() => cargarPerfil(u), 0)
    })

    return () => listener.subscription.unsubscribe()
  }, [cargarPerfil])

  const nombre = perfil?.nombre || user?.user_metadata?.nombre || ''
  const descuento = perfil?.descuento ?? user?.user_metadata?.descuento ?? 0
  const codigoDescuento = perfil?.codigo_descuento || user?.user_metadata?.codigo_descuento || ''
  const rol = perfil?.rol || 'usuario'

  const value = {
    user,
    perfil,
    loading,
    nombre,
    descuento,
    codigoDescuento,
    rol,
    esAdmin: rol === 'administrador',
    esSoporte: rol === 'soporte',
    esCajera: rol === 'cajera',
    // caja = cajera + administrador: gestionan reservas e inventario
    esCaja: rol === 'administrador' || rol === 'cajera',
    // soporte = soporte + administrador: atienden los reportes de errores
    puedeAtenderTickets: rol === 'administrador' || rol === 'soporte',
    esStaff: rol !== 'usuario',
    aviso,
    limpiarAviso: () => setAviso(''),
    recuperando,
    terminarRecuperacion: () => setRecuperando(false),
    enviarRecuperacion,
    cambiarContrasena,
    refrescarPerfil: () => cargarPerfil(user),
    registrar: registrarUsuario,
    iniciarSesion: iniciarSesionUsuario,
    cerrarSesion: cerrarSesionUsuario,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
