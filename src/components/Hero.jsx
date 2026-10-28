export default function Hero() {
  return (
    <section className="hero">
      <span className="splat-dot" style={{ width: 60, height: 60, background: 'var(--paint-magenta)', top: 60, left: '8%' }}></span>
      <span className="splat-dot" style={{ width: 34, height: 34, background: 'var(--paint-cyan)', bottom: 80, right: '12%' }}></span>
      <span className="splat-dot" style={{ width: 46, height: 46, background: 'var(--paint-yellow)', top: '30%', right: '6%' }}></span>

      <div className="hero-content">
        <span className="eyebrow-splat stencil">Adrenalina garantizada</span>
        <h1 className="stencil">Entra al campo.<br />Sal con historias.</h1>
        <p>
          Tres terrenos de juego, equipo profesional incluido y partidas para grupos
          de 6 a 60 personas. Cumpleaños, despedidas o eventos de empresa: aquí todos disparan.
        </p>
        <div className="hero-btns">
          <a href="#reserva" className="btn btn-primary">Reservar mi partida</a>
          <a href="#paquetes" className="btn btn-outline">Ver paquetes</a>
        </div>
      </div>
    </section>
  )
}
