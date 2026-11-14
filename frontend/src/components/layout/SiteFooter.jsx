import WhatsappLink from '../contact/WhatsappLink.jsx';
import LogoMark from './LogoMark.jsx';
import useStoreContent from '../../hooks/useStoreContent.js';

export default function SiteFooter() {
  const { content } = useStoreContent();
  return (
    <>
      <footer className="footer">
        <section className="footer-info">
          <h2>
            <LogoMark /> TechStore
          </h2>
          <p>{content.footerText}</p>
          <nav className="footer-socials" aria-label="Redes sociales">
            {content.instagram && (
              <a href={content.instagram} target="_blank" rel="noreferrer" aria-label="Instagram">
                <i className="ri-instagram-line" aria-hidden="true" />
              </a>
            )}
            <WhatsappLink />
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
              <a href="/#ai-assistant">TechBot</a>
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
              {content.location}
            </p>
            <p>
              <i className="ri-phone-line" aria-hidden="true" />
              <WhatsappLink phone />
            </p>
            <p>
              <i className="ri-mail-line" aria-hidden="true" />
              <a href={`mailto:${content.email}`}>{content.email}</a>
            </p>
            <p>
              <i className="ri-time-line" aria-hidden="true" />
              {content.hours}
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
