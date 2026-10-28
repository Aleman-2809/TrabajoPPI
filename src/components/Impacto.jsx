const marcas = [
  { texto: 'IMPACTO', background: 'var(--paint-magenta)' },
  { texto: 'ELIMINADO', background: 'var(--paint-cyan)' },
  { texto: 'BANDERA', background: 'var(--paint-yellow)', color: 'var(--ink)' },
  { texto: 'RONDA 3', background: 'var(--blaze)' },
  { texto: 'EQUIPO A', background: 'var(--olive)' },
  { texto: 'EQUIPO B', background: 'var(--mud)' },
]

export default function Impacto() {
  return (
    <section>
      <div className="section-inner">
        <div className="section-head">
          <span className="tag stencil">Marcas de la jornada</span>
          <h2>Así se ve un buen día de juego</h2>
        </div>
        <div className="impact-strip">
          {marcas.map((m) => (
            <div
              className="impact-dot"
              style={{ background: m.background, color: m.color }}
              key={m.texto}
            >
              {m.texto}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
