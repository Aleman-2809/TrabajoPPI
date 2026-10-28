const testimonios = [
  {
    quote: 'Llevamos a toda la oficina para el cierre de año. El campo urbano nos tuvo corriendo dos horas sin parar de reír.',
    who: 'Marcela R. — Evento corporativo',
  },
  {
    quote: 'Reservé para la despedida de soltero de mi hermano. El árbitro explicó todo súper claro, hasta los que nunca habían disparado.',
    who: 'Andrés T. — Despedida de soltero',
  },
  {
    quote: 'El paquete Operación Total valió cada peso. Jugamos los tres campos y no alcanzamos a aburrirnos ni un minuto.',
    who: 'Camila V. — Cumpleaños',
  },
]

export default function Testimonios() {
  return (
    <section id="testimonios" style={{ background: '#fff' }}>
      <div className="section-inner">
        <div className="section-head">
          <span className="tag stencil">Lo que dicen</span>
          <h2>Grupos que ya pasaron por el campo</h2>
        </div>
        <div className="testi-grid">
          {testimonios.map((t) => (
            <div className="testi-card" key={t.who}>
              <p className="quote">{t.quote}</p>
              <div className="who">{t.who}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
