import { useEffect, useState } from 'react'
import Header from './components/Header'
import Hero from './components/Hero'
import ComoFunciona from './components/ComoFunciona'
import Campos from './components/Campos'
import Paquetes from './components/Paquetes'
import Impacto from './components/Impacto'
import Testimonios from './components/Testimonios'
import Reserva from './components/Reserva'
import Footer from './components/Footer'
import ChatbotAvisos from './components/ChatbotAvisos'
import ScrollTop from './components/ScrollTop'
import Panel from './panel/Panel'
import ResetPassword from './components/ResetPassword'
import { useAuth } from './AuthContext'

// Ruta simple por hash: "#/panel" muestra el panel, cualquier otra cosa el sitio.
const enPanel = () => window.location.hash.startsWith('#/panel')

export default function App() {
  const [panel, setPanel] = useState(enPanel())
  const { recuperando } = useAuth()

  useEffect(() => {
    const onHash = () => setPanel(enPanel())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (panel) {
    return (
      <>
        <Panel />
        {recuperando && <ResetPassword />}
      </>
    )
  }

  return (
    <>
        {recuperando && <ResetPassword />}
      <Header />
      <Hero />
      <ComoFunciona />
      <Campos />
      <Paquetes />
      <Impacto />
      <Testimonios />
      <Reserva />
      <Footer />
      <ChatbotAvisos />
      <ScrollTop />
    </>
  )
}
