import { useMemo, useState } from 'react'
import { useAuth } from '../AuthContext'
import { listarPerfiles, actualizarPerfil } from '../supabaseClient'
import { Badge, Modal, Vacio, Cargando, Alerta, useLista, ROLES, fechaHora } from './ui'

// Solo administrador: ver, editar rol/datos y activar/desactivar cuentas.
export default function Usuarios() {
  const { user } = useAuth()
  const { datos, cargando, error, recargar, setError } = useLista(listarPerfiles)
  const [busca, setBusca] = useState('')
  const [rolFiltro, setRolFiltro] = useState('todos')
  const [edit, setEdit] = useState(null)
  const [ok, setOk] = useState('')

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return datos.filter((p) => {
      if (rolFiltro !== 'todos' && p.rol !== rolFiltro) return false
      return !q || [p.nombre, p.email].some((v) => String(v || '').toLowerCase().includes(q))
    })
  }, [datos, busca, rolFiltro])

  const guardar = async (e) => {
    e.preventDefault()
    if (edit.id === user.id && (edit.rol !== 'administrador' || !edit.activo)) {
      return setError('No puedes quitarte el rol de administrador ni desactivarte a ti mismo.')
    }
    const res = await actualizarPerfil(edit.id, {
      nombre: edit.nombre, rol: edit.rol, descuento: Number(edit.descuento) || 0, activo: edit.activo,
      telefono: (edit.telefono || '').trim() || null,
    })
    if (!res.ok) return setError(res.error)
    setEdit(null)
    setOk('Usuario actualizado.')
    recargar()
  }

  const alternar = async (p) => {
    if (p.id === user.id) return setError('No puedes desactivar tu propia cuenta.')
    const res = await actualizarPerfil(p.id, { activo: !p.activo })
    if (!res.ok) setError(res.error)
    else { setOk(p.activo ? 'Cuenta desactivada.' : 'Cuenta activada.'); recargar() }
  }

  return (
    <div>
      <div className="pn-toolbar">
        <input className="pn-search" placeholder="Buscar por nombre o correo…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select className="pn-select" value={rolFiltro} onChange={(e) => setRolFiltro(e.target.value)}>
          <option value="todos">Todos los roles</option>
          {ROLES.map((r) => <option key={r}>{r}</option>)}
        </select>
      </div>
      <Alerta onClose={() => setError('')}>{!edit ? error : ''}</Alerta>
      <Alerta tipo="ok" onClose={() => setOk('')}>{ok}</Alerta>

      {cargando ? <Cargando /> : !visibles.length ? <Vacio texto="No hay usuarios." /> : (
        <div className="pn-table-wrap pn-scroll">
          <table className="pn-table">
            <thead>
              <tr><th>Usuario</th><th>Rol</th><th>Descuento</th><th>Registro</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              {visibles.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.nombre}</strong><small>{p.email}</small></td>
                  <td><Badge valor={p.rol} />{p.rol === 'cajera' && <small>{p.telefono ? `WhatsApp ${p.telefono}` : 'Sin WhatsApp: no recibe avisos'}</small>}</td>
                  <td>{p.descuento ? `${p.descuento}%` : '—'}<small>{p.codigo_descuento}</small></td>
                  <td>{fechaHora(p.created_at)}</td>
                  <td><Badge valor={p.activo ? 'activo' : 'inactivo'} /></td>
                  <td className="pn-row-actions">
                    <button type="button" className="pn-btn pn-btn-sm" onClick={() => { setEdit({ ...p }); setError('') }}>Editar</button>
                    <button type="button" className={`pn-btn pn-btn-sm ${p.activo ? 'pn-btn-danger' : 'pn-btn-primary'}`} onClick={() => alternar(p)}>
                      {p.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {edit && (
        <Modal titulo={`Editar a ${edit.nombre}`} onClose={() => setEdit(null)}>
          <form className="pn-form" onSubmit={guardar}>
            <Alerta onClose={() => setError('')}>{error}</Alerta>
            <label>Nombre
              <input value={edit.nombre || ''} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} />
            </label>
            <label>Correo (solo lectura)
              <input value={edit.email || ''} disabled />
            </label>
            <div className="pn-grid-2">
              <label>Rol
                <select value={edit.rol} onChange={(e) => setEdit({ ...edit, rol: e.target.value })}>
                  {ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </label>
              <label>Descuento (%)
                <input type="number" min="0" max="100" value={edit.descuento} onChange={(e) => setEdit({ ...edit, descuento: e.target.value })} />
              </label>
            </div>
            {edit.rol === 'cajera' && (
              <label>WhatsApp de la cajera (recibe los avisos de nuevas reservas)
                <input type="tel" placeholder="3001234567" value={edit.telefono || ''} onChange={(e) => setEdit({ ...edit, telefono: e.target.value })} />
              </label>
            )}
            <label className="pn-check">
              <input type="checkbox" checked={edit.activo} onChange={(e) => setEdit({ ...edit, activo: e.target.checked })} />
              Cuenta activa
            </label>
            <div className="pn-actions">
              <button type="button" className="pn-btn pn-btn-ghost" onClick={() => setEdit(null)}>Cancelar</button>
              <button type="submit" className="pn-btn pn-btn-primary">Guardar</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
