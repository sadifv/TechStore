import HeroMascot from './HeroMascot.jsx';

export default function HeroSection() {
  function moveImage(event) {
    if (event.pointerType !== 'mouse') return;
    const frame = event.currentTarget;
    const bounds = frame.getBoundingClientRect();
    frame.style.setProperty(
      '--hero-offset-x',
      `${((event.clientX - bounds.left) / bounds.width - 0.5) * 24}px`,
    );
    frame.style.setProperty(
      '--hero-offset-y',
      `${((event.clientY - bounds.top) / bounds.height - 0.5) * 18}px`,
    );
  }

  function resetImage(event) {
    event.currentTarget.style.removeProperty('--hero-offset-x');
    event.currentTarget.style.removeProperty('--hero-offset-y');
  }

  return (
    <section id="inicio" className="hero editorial-hero">
      <HeroMascot />
      <article className="hero-content">
        <header>
          <span className="hero-eyebrow">Tecnología para tu día a día</span>
          <h1>
            Tu próximo paso. <span>Más tecnología.</span>
          </h1>
          <p>
            Encuentra lo que necesitas para trabajar, crear y disfrutar. Elige tus favoritos y
            coordina tu pedido con la tienda.
          </p>
        </header>
        <nav className="hero-actions" aria-label="Explorar productos">
          <a href="/catalogo" className="btn btn-primary">
            <span aria-hidden="true">01</span> Explorar catálogo <span aria-hidden="true">→</span>
          </a>
          <a href="#destacados" className="hero-secondary">
            <span aria-hidden="true">02</span> Ver destacados <span aria-hidden="true">↓</span>
          </a>
          <a href="/arma-tu-equipo" className="hero-secondary">Arma tu equipo</a>
        </nav>
        <ul className="hero-benefits">
          <li>
            <i className="ri-shopping-cart-line" aria-hidden="true" /> Pedido por WhatsApp
          </li>
          <li>Guarda tus favoritos</li>
        </ul>
      </article>
      <figure className="hero-media" onPointerMove={moveImage} onPointerLeave={resetImage}>
        <img
          src="/images/hero-tech.jpg"
          alt="Laptop, teléfono y audífonos en un espacio de trabajo moderno"
        />
      </figure>
    </section>
  );
}
