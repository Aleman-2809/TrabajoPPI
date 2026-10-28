import { useState, useRef, useEffect } from 'react'

const baseConocimiento = [
  {
    claves: ['horario', 'hora', 'abren', 'cierran'],
    respuesta: 'El campo opera de 07:00 a 22:00, todos los días.',
  },
  {
    claves: ['cancel', 'modific', 'reembolso'],
    respuesta: 'Puedes cancelar o modificar tu reserva hasta 24 horas antes de tu franja horaria.',
  },
  {
    claves: ['equipo', 'marcadora', 'mascara', 'máscara', 'chaleco', 'tanque', 'overol'],
    respuesta: 'El préstamo de equipo (marcadora, máscara, chaleco, tanque y overol) se solicita al reservar tu campo, sujeto a disponibilidad.',
  },
  {
    claves: ['pago', 'precio', 'tarifa', 'costo', 'cuanto cuesta'],
    respuesta: 'Puedes pagar en línea al confirmar tu reserva o en efectivo de forma presencial.',
  },
  {
    claves: ['reserva', 'reservar', 'disponibilidad'],
    respuesta: 'Puedes ver la disponibilidad de campos y equipos en el calendario y confirmar tu reserva una vez realizado el pago.',
  },
  {
    claves: ['seguridad', 'proteccion', 'protección'],
    respuesta: 'El uso de máscara de protección es obligatorio en todo momento dentro del campo de juego.',
  },
]

function buscarRespuesta(texto) {
  const t = texto.toLowerCase()
  const hit = baseConocimiento.find((k) => k.claves.some((palabra) => t.includes(palabra)))
  return hit
    ? hit.respuesta
    : 'No tengo un aviso registrado para eso todavía. Consulta con el staff en recepción.'
}

export default function ChatbotAvisos() {
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState([
    { autor: 'bot', texto: '¡Hola! Puedo darte información sobre horarios, reservas, equipos, pagos y políticas del campo. ¿Qué necesitas saber?' },
  ])
  const [texto, setTexto] = useState('')
  const bodyRef = useRef(null)

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [mensajes, abierto])

  const enviar = (mensaje) => {
    if (!mensaje.trim()) return
    setMensajes((prev) => [...prev, { autor: 'user', texto: mensaje }])
    setTimeout(() => {
      setMensajes((prev) => [...prev, { autor: 'bot', texto: buscarRespuesta(mensaje) }])
    }, 350)
  }

  const onSubmit = (e) => {
    e.preventDefault()
    enviar(texto)
    setTexto('')
  }

  const chips = ['Horario', 'Cancelaciones', 'Equipo incluido', 'Formas de pago']

  return (
    <>
      <button
        className="chatbot-toggle"
        onClick={() => setAbierto((v) => !v)}
        aria-label="Abrir chat de avisos"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      </button>

      {abierto && (
        <div className="chatbot-panel">
          <div className="chatbot-head">
            <span className="chatbot-pulse"></span>
            <div>
              <strong>Asistente Zona Impacto</strong>
              <small>Avisos e información en tiempo real</small>
            </div>
          </div>

          <div className="chatbot-body" ref={bodyRef}>
            {mensajes.map((m, i) => (
              <p key={i} className={`chatbot-msg ${m.autor}`}>{m.texto}</p>
            ))}
          </div>

          <div className="chatbot-chips">
            {chips.map((c) => (
              <button key={c} className="chatbot-chip" onClick={() => enviar(c)}>{c}</button>
            ))}
          </div>

          <form className="chatbot-input" onSubmit={onSubmit}>
            <input
              type="text"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escribe tu pregunta..."
            />
            <button type="submit">Enviar</button>
          </form>
        </div>
      )}
    </>
  )
}
