const paquetes = [
  {
    nombre: 'Recluta',
    precio: '$45.000',
    destacado: false,
    items: ['100 bolas de pintura', '2 horas de juego', '1 campo a elección', 'Equipo completo incluido'],
  },
  {
    nombre: 'Escuadrón',
    precio: '$68.000',
    destacado: true,
    badge: 'Más elegido',
    items: ['250 bolas de pintura', '4 horas de juego', '2 campos a elección', 'Snacks y bebidas incluidos'],
  },
  {
    nombre: 'Operación Total',
    precio: '$95.000',
    destacado: false,
    items: ['500 bolas de pintura', 'Jornada completa', 'Los 3 campos', 'Fotografías del evento'],
  },
]

export default function Paquetes() {
  return (
    <section id="paquetes">
      <div className="section-inner">
        <div className="section-head">
          <span className="tag stencil">Paquetes</span>
          <h2>Precios claros, sin sorpresas</h2>
          <p>Todos los paquetes incluyen equipo completo, munición base y árbitro de campo.</p>
        </div>
        <div className="pricing-grid">
          {paquetes.map((p) => (
            <div className={`price-card ${p.destacado ? 'feat' : ''}`} key={p.nombre}>
              {p.badge && <span className="badge">{p.badge}</span>}
              <h3>{p.nombre}</h3>
              <div className="price">{p.precio}<span>/persona</span></div>
              <ul>
                {p.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <a href="#reserva" className="btn btn-primary btn-elegir">
                Elegir
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
