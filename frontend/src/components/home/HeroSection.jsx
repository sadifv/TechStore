import HeroBackground from './HeroBackground.jsx';
import HeroMascot from './HeroMascot.jsx';
import PurchaseGuide from './PurchaseGuide.jsx';
import { backendAssetUrl } from '../../services/api.js';
import { placeholder } from '../../config/storeCatalog.js';

const heroPointerMotion =
  '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)';

export default function HeroSection({ product, signedIn }) {
  const image = product?.image !== placeholder && product?.image;
  function moveImage(event) {
    if (event.pointerType !== 'mouse' || !window.matchMedia(heroPointerMotion).matches) return;
    const frame = event.currentTarget;
    const bounds = frame.getBoundingClientRect();
    frame.style.setProperty(
      '--hero-offset-x',
      `${((event.clientX - bounds.left) / bounds.width - 0.5) * 16}px`,
    );
    frame.style.setProperty(
      '--hero-offset-y',
      `${((event.clientY - bounds.top) / bounds.height - 0.5) * 12}px`,
    );
  }

  function resetImage(event) {
    event.currentTarget.style.removeProperty('--hero-offset-x');
    event.currentTarget.style.removeProperty('--hero-offset-y');
  }

  return (
    <section id="inicio" className="hero editorial-hero">
      <HeroBackground />
      <article className="hero-content">
        <header>
          <span className="hero-eyebrow">TechStore Ecuador</span>
          <h1 data-enter>
            <span className="hero-title-lead">Laptops, audio y periféricos</span>{' '}
            <span className="hero-title-accent">en Ecuador</span>
          </h1>
          <p>Explora el catálogo y coordina tu pedido por WhatsApp.</p>
        </header>
        <nav className="hero-actions" aria-label="Explorar productos">
          <a href="/catalogo" className="btn btn-primary">
            Explorar catálogo <span aria-hidden="true">→</span>
          </a>
          <PurchaseGuide />
        </nav>
      </article>
      <HeroMascot signedIn={signedIn} />
      {image && (
        <figure className="hero-media" onPointerMove={moveImage} onPointerLeave={resetImage}>
          <a className="hero-photo" href={`/producto/${product._id}`}>
            <img src={backendAssetUrl(image)} alt={product.name} fetchPriority="high" />
          </a>
        </figure>
      )}
    </section>
  );
}
