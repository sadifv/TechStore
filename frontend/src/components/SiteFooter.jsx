export default function SiteFooter() {
  return (
    <>
      <footer className="footer">
        <section className="footer-info">
          <h2>
            <i className="ri-store-line" aria-hidden="true" /> TechStore
          </h2>
          <p>
            Tu tienda de tecnología de confianza. Ofrecemos los mejores productos con la mejor
            garantía y servicio.
          </p>
          <nav className="footer-socials" aria-label="Redes sociales">
            <a
              href="https://instagram.com/tu_usuario"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
            >
              <i className="ri-instagram-line" aria-hidden="true" />
            </a>
            <a
              href="https://wa.me/593963976623"
              target="_blank"
              rel="noreferrer"
              aria-label="WhatsApp"
            >
              <i className="ri-whatsapp-line" aria-hidden="true" />
            </a>
          </nav>
        </section>
        <nav className="footer-links" aria-label="Enlaces rápidos">
          <h2>Enlaces rápidos</h2>
          <ul>
            <li>
              <a href="/">Inicio</a>
            </li>
            <li>
              <a href="/catalogo">Catálogo</a>
            </li>
            <li>
              <a href="/#contacto">Contacto</a>
            </li>
            <li>
              <a href="/#ai-assistant">IA Assistant</a>
            </li>
          </ul>
        </nav>
        <nav className="footer-links" aria-label="Categorías">
          <h2>Categorías</h2>
          <ul>
            <li>
              <a href="/catalogo?category=Laptops">Laptops</a>
            </li>
            <li>
              <a href="/catalogo?category=Smartphones">Smartphones</a>
            </li>
            <li>
              <a href="/catalogo?category=Audio">Audio</a>
            </li>
            <li>
              <a href="/catalogo?category=Periféricos">Periféricos</a>
            </li>
            <li>
              <a href="/catalogo?category=Monitores">Monitores</a>
            </li>
          </ul>
        </nav>
        <section className="footer-contact">
          <h2>Contacto</h2>
          <address>
            <p>
              <i className="ri-map-pin-line" aria-hidden="true" />
              Villa España, Guayaquil, Ecuador
            </p>
            <p>
              <i className="ri-phone-line" aria-hidden="true" />
              <a href="tel:+593963976623">+593 0963976623</a>
            </p>
            <p>
              <i className="ri-mail-line" aria-hidden="true" />
              <a href="mailto:sadiflores20201@gmail.com">sadiflores20201@gmail.com</a>
            </p>
            <p>
              <i className="ri-time-line" aria-hidden="true" />
              Lun-Vie: 9:00 - 18:00
            </p>
          </address>
        </section>
        <div className="footer-bottom">
          <p>
            © <time dateTime={String(new Date().getFullYear())}>{new Date().getFullYear()}</time>{' '}
            TechStore. Todos los derechos reservados.
          </p>
          <nav className="footer-legal" aria-label="Enlaces legales">
            <a href="/legal#privacidad">Política de privacidad</a>
            <span aria-hidden="true">·</span>
            <a href="/legal#terminos">Términos y condiciones</a>
            <span aria-hidden="true">·</span>
            <a href="/legal#cookies">Cookies</a>
          </nav>
        </div>
      </footer>
    </>
  );
}
