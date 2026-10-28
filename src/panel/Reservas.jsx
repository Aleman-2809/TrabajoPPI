import { useMemo, useState } from 'react'
import { useAuth } from '../AuthContext'
import { listarReservas, crearReserva, actualizarReserva, eliminarReserva } from '../supabaseClient'
import ReservaForm from './ReservaForm'
import {
  Badge, Modal, Confirmar, Vacio, Cargando, Alerta, useLista, descargarCSV,
  ESTADOS_RESERVA, cop, fechaCorta,
} from './ui'

// Sirve para los tres roles:
//  - usuario: ve y gestiona SOLO sus reservas (RLS) — editar/eliminar si están pendientes
//  - soporte: ve todas, solo cambia el estado
//  - administrador: CRUD completo
export default function Reservas() {
  const { user, esAdmin, esCaja, nombre } = useAuth()
  const { datos, cargando, error, recargar, setError } = useLista(listarReservas)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [modal, setModal] = useState(null) // { tipo: 'nueva' | 'editar', reserva? }
  const [borrar, setBorrar] = useState(null)
  const [ok, setOk] = useState('')

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return datos.filter((r) => {
      if (filtro !== 'todos' && r.estado !== filtro) return false
      if (!q) return true
      return [r.cliente, r.telefono, r.campo, r.paquete, r.modalidad].some((v) => String(v || '').toLowerCase().includes(q))
    })
  }, [datos, busca, filtro])

  const puedeEditar = (r) => esCaja || r.estado === 'pendiente' || r.estado === 'aplazada'
  const puedeBorrar = (r) => esAdmin || (!esCaja && r.estado === 'pendiente')

  const guardar = async (payload) => {
    let res
    if (modal.tipo === 'nueva') {
      // las reservas que crea caja no pertenecen a ninguna cuenta (el cliente puede no tener usuario)
      res = await crearReserva({ ...payload, user_id: esCaja ? null : user.id, estado: payload.estado || 'pendiente' })
    } else {
      res = await actualizarReserva(modal.reserva.id, payload)
    }
    if (!res.ok) return res.error
    setModal(null)
    setOk(modal.tipo === 'nueva' ? 'Reserva creada.' : 'Reserva actualizada.')
    recargar()
    return null
  }

  const confirmarBorrado = async () => {
    const res = await eliminarReserva(borrar.id)
    setBorrar(null)
    if (!res.ok) setError(res.error)
    else { setOk('Reserva eliminada.'); recargar() }
  }

  const cancelarComoUsuario = async (r) => {
    const res = await actualizarReserva(r.id, { estado: 'cancelada' })
    if (!res.ok) setError(res.error)
    else { setOk('Reserva cancelada.'); recargar() }
  }

  return (
    <div>
      <div className="pn-toolbar">
        <input className="pn-search" placeholder="Buscar por cliente, campo, paquete…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select className="pn-select" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="todos">Todos los estados</option>
          {ESTADOS_RESERVA.map((e) => <option key={e}>{e}</option>)}
        </select>
        {esCaja && (
          <button type="button" className="pn-btn pn-btn-ghost" onClick={() => descargarCSV('reservas.csv', visibles.map(({ id, cliente, telefono, campo, fecha, hora, jugadores, modalidad, paquete, total, estado }) => ({ id, cliente, telefono, campo, fecha, hora, jugadores, modalidad, paquete, total, estado })))}>
            Exportar CSV
          </button>
        )}
        <button type="button" className="pn-btn pn-btn-primary" onClick={() => setModal({ tipo: 'nueva', reserva: esCaja ? {} : { cliente: nombre } })}>
          + Nueva reserva
        </button>
      </div>

      <Alerta onClose={() => setError('')}>{error}</Alerta>
      <Alerta tipo="ok" onClose={() => setOk('')}>{ok}</Alerta>

      {cargando ? <Cargando /> : !visibles.length ? (
        <Vacio texto={datos.length ? 'No hay reservas con ese filtro.' : 'Aún no hay reservas.'} />
      ) : (
        <div className="pn-table-wrap pn-scroll">
          <table className="pn-table">
            <thead>
              <tr>
                <th>Cliente</th><th>Fecha</th><th>Campo</th><th>Paquete</th>
                <th>Jug.</th><th>Total</th><th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.cliente}</strong><small>{r.telefono}</small></td>
                  <td>{fechaCorta(r.fecha)}<small>{r.hora}</small></td>
                  <td>{r.campo}<small>{r.modalidad}</small></td>
                  <td>{r.paquete}</td>
                  <td>{r.jugadores}</td>
                  <td>{cop(r.total)}</td>
                  <td><Badge valor={r.estado || 'pendiente'} /></td>
                  <td className="pn-row-actions">
                    {puedeEditar(r) && (
                      <button type="button" className="pn-btn pn-btn-sm" onClick={() => setModal({ tipo: 'editar', reserva: r })}>
                        Editar
                      </button>
                    )}
                    {!esCaja && r.estado === 'pendiente' && (
                      <button type="button" className="pn-btn pn-btn-sm pn-btn-ghost" onClick={() => cancelarComoUsuario(r)}>Cancelar</button>
                    )}
                    {puedeBorrar(r) && (
                      <button type="button" className="pn-btn pn-btn-sm pn-btn-danger" onClick={() => setBorrar(r)}>Eliminar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal titulo={modal.tipo === 'nueva' ? 'Nueva reserva' : 'Editar reserva'} onClose={() => setModal(null)} ancho={640}>
          <ReservaForm
            inicial={modal.reserva}
            onGuardar={guardar}
            onCancelar={() => setModal(null)}
            mostrarEstado={esCaja}
          />
        </Modal>
      )}
      {borrar && (
        <Confirmar
          mensaje={`¿Eliminar la reserva de ${borrar.cliente}? Esta acción no se puede deshacer.`}
          onSi={confirmarBorrado}
          onNo={() => setBorrar(null)}
        />
      )}
    </div>
  )
}
