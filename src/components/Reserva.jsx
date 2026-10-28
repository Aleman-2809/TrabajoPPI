import { useEffect, useState } from 'react'
import { guardarReservaEnBD } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { enlaceWhatsApp } from '../config'

// Precio por persona de cada paquete (debe coincidir con la sección "Paquetes")
const PRECIO_POR_PAQUETE = {
  Recluta: 45000,
  Escuadrón: 68000,
  'Operación Total': 95000,
}

const formatoCOP = (n) =>
  Number(n).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })

// Total = jugadores × precio del paquete ('' si falta algún dato o el número no es válido)
function calcularTotal(paquete, jugadores) {
  const precio = PRECIO_POR_PAQUETE[paquete]
  const n = Number(jugadores)
  if (!precio || !Number.isInteger(n) || n < 1) return ''
  return precio * n
}

const estadoInicial = {
  cliente: '',
  telefono: '',
  campo: '',
  fecha: '',
  hora: '',
  jugadores: '',
  modalidad: '',
  paquete: '',
  total: '',
  mensaje: '',
}

export default function Reserva() {
  const [datos, setDatos] = useState(estadoInicial)
  const [enviando, setEnviando] = useState(false)
  const [creada, setCreada] = useState(null) // datos de la reserva ya enviada
  const [errorEnvio, setErrorEnvio] = useState('')
  const { user, nombre, descuento, codigoDescuento } = useAuth()

  // Si hay sesión, precarga el nombre del cliente (solo si el campo está vacío)
  useEffect(() => {
    if (nombre) setDatos((prev) => (prev.cliente ? prev : { ...prev, cliente: nombre }))
  }, [nombre])

  const handleChange = (e) => {
    const { name, value } = e.target
    setDatos((prev) => {
      const next = { ...prev, [name]: value }
      if (name === 'paquete' || name === 'jugadores') {
        next.total = calcularTotal(next.paquete, next.jugadores)
      }
      return next
    })
  }

  const enviarReserva = async (e) => {
    e.preventDefault()

    const { cliente, telefono, campo, fecha, hora, jugadores, modalidad, paquete, total, mensaje } = datos

    if (!cliente || !telefono || !campo || !fecha || !hora || !jugadores || !modalidad || !paquete) {
      alert('Por favor completa todos los datos de la reserva.')
      return
    }

    if (total === '') {
      alert('Revisa el número de jugadores: debe ser un número entero de 1 en adelante.')
      return
    }

    const soloDigitos = telefono.replace(/\D/g, '')
    if (soloDigitos.length < 10) {
      alert('Escribe tu número de WhatsApp completo (10 dígitos). Ahí te enviaremos la confirmación.')
      return
    }

    setEnviando(true)
    setErrorEnvio('')

    // El código de descuento viaja en las notas para que caja lo vea y lo aplique
    const notas =
      user && descuento > 0 && codigoDescuento
        ? `${mensaje ? `${mensaje.trim()}\n\n` : ''}Código de descuento: ${codigoDescuento} (${descuento}%)`
        : mensaje

    const guardadoOk = await guardarReservaEnBD({
      cliente: cliente.trim(),
      telefono: telefono.trim(),
      campo,
      fecha,
      hora,
      jugadores,
      modalidad,
      paquete,
      total: total !== '' && !isNaN(total) ? Number(total) : null,
      mensaje: notas,
    })

    setEnviando(false)

    if (!guardadoOk) {
      setErrorEnvio('No pudimos guardar tu reserva en este momento. Inténtalo de nuevo o escríbenos por WhatsApp.')
      return
    }
    setCreada({ ...datos })
    setDatos({ ...estadoInicial, cliente: nombre || '' })
    document.getElementById('reserva')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (creada) {
    const fechaBase = new Date(`${creada.fecha}T00:00:00`).toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
    const fechaTxt = fechaBase.charAt(0).toUpperCase() + fechaBase.slice(1)
    return (
      <section id="reserva" className="container">
        <div className="section-inner">
          <div className="reserva-ok">
            <div className="reserva-ok-badge">✓</div>
            <h2>¡Reserva recibida!</h2>
            <p className="reserva-ok-lead">
              Gracias, <strong>{creada.cliente.trim().split(/\s+/)[0]}</strong>. Te enviamos los detalles por WhatsApp al{' '}
              <strong>{creada.telefono}</strong> y una persona de caja la confirmará muy pronto.
            </p>
            <ul className="reserva-ok-resumen">
              <li><span>Fecha</span><strong>{fechaTxt}</strong></li>
              <li><span>Hora</span><strong>{creada.hora}</strong></li>
              <li><span>Campo</span><strong>{creada.campo}</strong></li>
              <li><span>Jugadores</span><strong>{creada.jugadores}</strong></li>
              <li><span>Paquete</span><strong>{creada.paquete}</strong></li>
              <li><span>Total</span><strong>{formatoCOP(creada.total)}</strong></li>
            </ul>
            <p className="reserva-ok-nota">¿No te llegó el mensaje en unos minutos? Escríbenos y la revisamos.</p>
            <div className="reserva-ok-actions">
              <a
                className="btn btn-primary"
                href={enlaceWhatsApp(`Hola, acabo de hacer una reserva para el ${creada.fecha} a las ${creada.hora} a nombre de ${creada.cliente}.`)}
                target="_blank"
                rel="noreferrer"
              >
                Escribirnos por WhatsApp
              </a>
              <button type="button" className="btn btn-outline" onClick={() => setCreada(null)}>
                Hacer otra reserva
              </button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section id="reserva" className="container">
      <div className="section-inner">
        <div className="section-head">
          <span className="tag">RESERVAS</span>
          <h2>Confirma tu aventura</h2>
          <p>Completa los datos de tu reserva. Te enviaremos la confirmación automáticamente por WhatsApp.</p>
        </div>

        {user && descuento > 0 && (
          <div className="descuento-banner">
            <span className="descuento-banner-icon">%</span>
            <div>
              <strong>Tienes {descuento}% de descuento activo</strong>
              <p>
                Tu código <span className="descuento-banner-code">{codigoDescuento}</span> se enviará junto con tu
                reserva para que caja lo aplique.
              </p>
            </div>
          </div>
        )}

        <form id="reservaForm" className="booking-card" onSubmit={enviarReserva}>
          <div className="form-group">
            <label htmlFor="cliente">Nombre del cliente</label>
            <input
              type="text"
              id="cliente"
              name="cliente"
              placeholder="Ej: Juan Pérez"
              value={datos.cliente}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="telefono">Número de WhatsApp</label>
            <input
              type="tel"
              id="telefono"
              name="telefono"
              placeholder="Ej: 3001234567"
              value={datos.telefono}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="campo">Campo de Paintball</label>
            <select id="campo" name="campo" value={datos.campo} onChange={handleChange} required>
              <option value="">Selecciona un campo</option>
              <option value="Selva Cerrada">Selva Cerrada</option>
              <option value="Sector Urbano">Sector Urbano</option>
              <option value="Línea de Trincheras">Línea de Trincheras</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="fecha">Fecha de la reserva</label>
            <input
              type="date"
              id="fecha"
              name="fecha"
              value={datos.fecha}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="hora">Hora</label>
            <input
              type="time"
              id="hora"
              name="hora"
              value={datos.hora}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="jugadores">Número de jugadores</label>
            <input
              type="number"
              id="jugadores"
              name="jugadores"
              min="1"
              step="1"
              inputMode="numeric"
              placeholder="Ej: 10"
              value={datos.jugadores}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="modalidad">Modalidad de juego</label>
            <select id="modalidad" name="modalidad" value={datos.modalidad} onChange={handleChange} required>
              <option value="">Selecciona una modalidad</option>
              <option value="Captura de bandera">Captura de bandera</option>
              <option value="Eliminación">Eliminación</option>
              <option value="Última bola en pie">Última bola en pie</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="paquete">Paquete seleccionado</label>
            <select id="paquete" name="paquete" value={datos.paquete} onChange={handleChange} required>
              <option value="">Selecciona un paquete</option>
              <option value="Recluta">Recluta - $45.000 por persona</option>
              <option value="Escuadrón">Escuadrón - $68.000 por persona</option>
              <option value="Operación Total">Operación Total - $95.000 por persona</option>
            </select>
          </div>

          <div className={`total-box ${datos.total !== '' ? 'total-box-on' : ''}`} aria-live="polite">
            <div className="total-box-info">
              <span className="total-box-label">Total de la reserva</span>
              {datos.total !== '' ? (
                <span className="total-box-calc">
                  {Number(datos.jugadores)} {Number(datos.jugadores) === 1 ? 'jugador' : 'jugadores'} ×{' '}
                  {formatoCOP(PRECIO_POR_PAQUETE[datos.paquete])} ({datos.paquete})
                </span>
              ) : (
                <span className="total-box-calc">Elige el paquete e indica cuántos jugadores van.</span>
              )}
            </div>
            <strong className="total-box-value">{datos.total !== '' ? formatoCOP(datos.total) : '—'}</strong>
          </div>

          <div className="form-group form-group-full">
            <label htmlFor="mensaje">Cuéntanos del evento</label>
            <textarea
              id="mensaje"
              name="mensaje"
              placeholder="Cumpleaños, evento de empresa, número de niños si asisten, etc."
              value={datos.mensaje}
              onChange={handleChange}
            ></textarea>
          </div>

          {errorEnvio && (
            <p className="reserva-error" role="alert">
              {errorEnvio}{' '}
              <a href={enlaceWhatsApp('Hola, quiero hacer una reserva pero la página no me dejó enviarla.')} target="_blank" rel="noreferrer">
                Escribir por WhatsApp
              </a>
            </p>
          )}

          <button type="submit" id="btnWhatsApp" className="btn-whatsapp" disabled={enviando}>
            {enviando ? 'Enviando tu reserva...' : '✅ Enviar reserva'}
          </button>
        </form>

        <div className="info-panel">
          <h3 className="stencil">Datos del campo</h3>
          <div className="info-line">
            <strong>Horario</strong>
            Martes a domingo, 8:00 a.m. – 6:00 p.m.
          </div>
          <div className="info-line">
            <strong>Ubicación</strong>
            Km 4 vía a la vereda El Roble
          </div>
          <div className="info-line">
            <strong>Teléfono</strong>
            +57 300 000 0000
          </div>
          <div className="info-line">
            <strong>Correo</strong>
            reservas@zonaimpacto.com
          </div>
          <div className="info-line">
            <strong>Edad mínima</strong>
            12 años (con autorización de un adulto)
          </div>
        </div>
      </div>
    </section>
  )
}
