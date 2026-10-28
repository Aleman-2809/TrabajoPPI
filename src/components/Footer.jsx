export default function Footer() {
  return (
    <footer>
      <div className="footer-inner">
        <div className="logo stencil" style={{ color: 'var(--paper)' }}>
          <span className="logo-mark"></span>
          Zona Impacto
        </div>
        <div className="footer-cols">
          <div>
            <h4>Explorar</h4>
            <ul>
              <li><a href="#campos">Campos</a></li>
              <li><a href="#paquetes">Paquetes</a></li>
              <li><a href="#testimonios">Opiniones</a></li>
            </ul>
          </div>
          <div>
            <h4>Contacto</h4>
            <ul>
              <li><a href="tel:+573000000000">+57 300 000 0000</a></li>
              <li><a href="mailto:reservas@zonaimpacto.com">reservas@zonaimpacto.com</a></li>
            </ul>
          </div>
        </div>
      </div>
      <p className="foot-bottom">© 2026 Zona Impacto. Todos los derechos reservados.</p>
    </footer>
  )
}
