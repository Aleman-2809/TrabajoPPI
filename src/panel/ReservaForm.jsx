import { useState } from 'react'
import { CAMPOS, MODALIDADES, PAQUETES, ESTADOS_RESERVA, Alerta } from './ui'

const vacio = {
  cliente: '', telefono: '', campo: '', fecha: '', hora: '',
  jugadores: '', modalidad: '', paquete: '', total: '', mensaje: '', estado: 'pendiente',
}

// Formulario compartido para crear/editar reservas.
// `soloEstado` => soporte: solo puede cambiar el estado.
export default function ReservaForm({ inicial, onGuardar, onCancelar, mostrarEstado = false, soloEstado = false }) {
  const [d, setD] = useState({ ...vacio, ...inicial })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cambiar = (e) => {
    const { name, value } = e.target
    setD((prev) => {
      const next = { ...prev, [name]: value }
      // total automático cuando cambian paquete o jugadores
      if ((name === 'paquete' || name === 'jugadores') && next.paquete && next.jugadores) {
        next.total = PAQUETES[next.paquete] * Number(next.jugadores)
      }
      return next
    })
    setError('')
  }

  const enviar = async (e) => {
    e.preventDefault()
    if (!soloEstado) {
      if (!d.cliente.trim() || !d.telefono.trim() || !d.campo || !d.fecha || !d.hora || !d.jugadores || !d.modalidad || !d.paquete) {
        setError('Completa todos los campos obligatorios.')
        return
      }
      if (Number(d.jugadores) < 1) {
        setError('Debe haber al menos 1 jugador.')
        return
      }
    }
    setGuardando(true)
    const payload = soloEstado
      ? { estado: d.estado }
      : {
          cliente: d.cliente.trim(), telefono: d.telefono.trim(), campo: d.campo, fecha: d.fecha,
          hora: d.hora, jugadores: Number(d.jugadores), modalidad: d.modalidad, paquete: d.paquete,
          total: d.total === '' ? null : Number(d.total), mensaje: d.mensaje,
          ...(mostrarEstado ? { estado: d.estado } : {}),
        }
    const err = await onGuardar(payload)
    setGuardando(false)
    if (err) setError(err)
  }

  const dis = soloEstado
  return (
    <form className="pn-form" onSubmit={enviar}>
      <Alerta onClose={() => setError('')}>{error}</Alerta>
      <div className="pn-grid-2">
        <label>Cliente
          <input name="cliente" value={d.cliente} onChange={cambiar} disabled={dis} placeholder="Nombre completo" />
        </label>
        <label>WhatsApp
          <input name="telefono" value={d.telefono} onChange={cambiar} disabled={dis} placeholder="3001234567" />
        </label>
        <label>Campo
          <select name="campo" value={d.campo} onChange={cambiar} disabled={dis}>
            <option value="">Selecciona…</option>
            {CAMPOS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label>Modalidad
          <select name="modalidad" value={d.modalidad} onChange={cambiar} disabled={dis}>
            <option value="">Selecciona…</option>
            {MODALIDADES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label>Fecha
          <input type="date" name="fecha" value={d.fecha || ''} onChange={cambiar} disabled={dis} />
        </label>
        <label>Hora
          <input type="time" name="hora" value={d.hora || ''} onChange={cambiar} disabled={dis} />
        </label>
        <label>Jugadores
          <input type="number" min="1" name="jugadores" value={d.jugadores} onChange={cambiar} disabled={dis} />
        </label>
        <label>Paquete
          <select name="paquete" value={d.paquete} onChange={cambiar} disabled={dis}>
            <option value="">Selecciona…</option>
            {Object.entries(PAQUETES).map(([k, v]) => (
              <option key={k} value={k}>{k} — ${v.toLocaleString('es-CO')}</option>
            ))}
          </select>
        </label>
        <label>Total (COP)
          <input type="number" name="total" value={d.total ?? ''} onChange={cambiar} disabled={dis} />
        </label>
        {(mostrarEstado || soloEstado) && (
          <label>Estado
            <select name="estado" value={d.estado} onChange={cambiar}>
              {ESTADOS_RESERVA.map((e) => <option key={e}>{e}</option>)}
            </select>
          </label>
        )}
      </div>
      <label>Notas del evento
        <textarea name="mensaje" rows="3" value={d.mensaje || ''} onChange={cambiar} disabled={dis} />
      </label>
      <div className="pn-actions">
        <button type="button" className="pn-btn pn-btn-ghost" onClick={onCancelar}>Cancelar</button>
        <button type="submit" className="pn-btn pn-btn-primary" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
