import { useMemo, useState } from 'react'
import { useAuth } from '../AuthContext'
import { listarHistorial, eliminarHistorial } from '../supabaseClient'
import { Vacio, Cargando, Alerta, Confirmar, useLista, descargarCSV, fechaHora } from './ui'

// Historial de personas que se registraron (administrador y soporte lo ven; solo admin elimina).
export default function Historial() {
  const { esAdmin } = useAuth()
  const { datos, cargando, error, recargar, setError } = useLista(listarHistorial)
  const [busca, setBusca] = useState('')
  const [borrar, setBorrar] = useState(null)

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return datos.filter((h) => !q || [h.nombre, h.email, h.codigo_descuento].some((v) => String(v || '').toLowerCase().includes(q)))
  }, [datos, busca])

  const confirmar = async () => {
    const res = await eliminarHistorial(borrar.id)
    setBorrar(null)
    if (!res.ok) setError(res.error)
    else recargar()
  }

  return (
    <div>
      <div className="pn-toolbar">
        <input className="pn-search" placeholder="Buscar nombre, correo o código…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <span className="pn-count">{visibles.length} registro{visibles.length === 1 ? '' : 's'}</span>
        <button
          type="button" className="pn-btn pn-btn-ghost"
          onClick={() => descargarCSV('historial_registros.csv', visibles.map((h) => ({ nombre: h.nombre, correo: h.email, codigo: h.codigo_descuento, fecha: h.created_at })))}
        >
          Exportar CSV
        </button>
      </div>
      <Alerta onClose={() => setError('')}>{error}</Alerta>
      {cargando ? <Cargando /> : !visibles.length ? <Vacio texto="Todavía no hay registros." /> : (
        <div className="pn-table-wrap pn-scroll">
          <table className="pn-table">
            <thead><tr><th>#</th><th>Nombre</th><th>Correo</th><th>Código</th><th>Fecha de registro</th>{esAdmin && <th></th>}</tr></thead>
            <tbody>
              {visibles.map((h, i) => (
                <tr key={h.id}>
                  <td>{visibles.length - i}</td>
                  <td><strong>{h.nombre}</strong></td>
                  <td>{h.email}</td>
                  <td><code className="pn-code">{h.codigo_descuento || '—'}</code></td>
                  <td>{fechaHora(h.created_at)}</td>
                  {esAdmin && (
                    <td className="pn-row-actions">
                      <button type="button" className="pn-btn pn-btn-sm pn-btn-danger" onClick={() => setBorrar(h)}>Eliminar</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {borrar && (
        <Confirmar
          mensaje={`¿Quitar a ${borrar.nombre} del historial? (La cuenta del usuario NO se elimina.)`}
          onSi={confirmar} onNo={() => setBorrar(null)}
        />
      )}
    </div>
  )
}
