const pasos = [
  {
    num: '01',
    titulo: 'Reservas tu horario',
    texto: 'Eliges fecha, cantidad de jugadores y el campo que más te llame la atención.',
  },
  {
    num: '02',
    titulo: 'Te equipamos',
    texto: 'Máscara, chaleco, marcadora y overol. Una charla de seguridad de 10 minutos y listo.',
  },
  {
    num: '03',
    titulo: 'Juegas rondas',
    texto: 'Modos de captura de bandera, eliminación y última bola en pie, con árbitro en campo.',
  },
  {
    num: '04',
    titulo: 'Celebras',
    texto: 'Zona de descanso con bebidas y snacks para revivir las mejores jugadas del día.',
  },
]

export default function ComoFunciona() {
  return (
    <section id="como-funciona">
      <div className="section-inner">
        <div className="section-head">
          <span className="tag stencil">Cómo funciona</span>
          <h2>De la puerta al campo en 15 minutos</h2>
          <p>No necesitas experiencia ni equipo propio. Nosotros ponemos todo, tú pones la puntería.</p>
        </div>
        <div className="steps">
          {pasos.map((p) => (
            <div className="step" key={p.num}>
              <div className="step-num">{p.num}</div>
              <h3>{p.titulo}</h3>
              <p>{p.texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
