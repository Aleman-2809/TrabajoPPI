const campos = [
  {
    clase: 'jungle',
    nombre: 'Selva Cerrada',
    descripcion: 'Vegetación densa, visibilidad corta y emboscadas a cada paso. Ideal para quien busca sigilo.',
    meta: ['6–20 jugadores', 'Dificultad media'],
    splats: [
      { width: 30, height: 30, background: 'var(--paint-yellow)', top: 20, left: 30 },
      { width: 20, height: 20, background: 'var(--paint-magenta)', bottom: 20, right: 40 },
    ],
  },
  {
    clase: 'urbano',
    nombre: 'Sector Urbano',
    descripcion: 'Contenedores, muros y pasillos estrechos para combate rápido y coberturas constantes.',
    meta: ['10–40 jugadores', 'Dificultad alta'],
    splats: [
      { width: 26, height: 26, background: 'var(--paint-cyan)', top: 40, right: 30 },
      { width: 34, height: 34, background: 'var(--paint-magenta)', bottom: 16, left: 20 },
    ],
  },
  {
    clase: 'trinchera',
    nombre: 'Línea de Trincheras',
    descripcion: 'Campo abierto con trincheras y barricadas, pensado para partidas grandes de captura de bandera.',
    meta: ['20–60 jugadores', 'Dificultad media'],
    splats: [
      { width: 28, height: 28, background: 'var(--paint-yellow)', bottom: 30, right: 24 },
      { width: 18, height: 18, background: 'var(--paint-cyan)', top: 24, left: 50 },
    ],
  },
]

export default function Campos() {
  return (
    <section id="campos" className="camo-pattern" style={{ backgroundColor: 'var(--paper)', backgroundImage: 'none' }}>
      <div className="section-inner">
        <div className="section-head">
          <span className="tag stencil">Nuestros campos</span>
          <h2>Tres terrenos, tres formas de jugar</h2>
          <p>Cada campo tiene su propio ritmo: elige el que se ajuste al estilo de tu grupo.</p>
        </div>
        <div className="fields-grid">
          {campos.map((c) => (
            <div className="field-card" key={c.nombre}>
              <div className={`field-visual ${c.clase}`}>
                {c.splats.map((s, i) => (
                  <span className="splat" style={s} key={i}></span>
                ))}
              </div>
              <div className="field-body">
                <h3>{c.nombre}</h3>
                <p>{c.descripcion}</p>
                <div className="field-meta">
                  <span>{c.meta[0]}</span>
                  <span>·</span>
                  <span>{c.meta[1]}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
