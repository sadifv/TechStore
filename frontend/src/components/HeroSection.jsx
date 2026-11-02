export default function HeroSection() {
  return (
    <section id="inicio" className="hero">
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
            Explorar catálogo <span aria-hidden="true">→</span>
          </a>
          <a href="#destacados" className="hero-secondary">
            Ver destacados
          </a>
        </nav>
        <ul className="hero-benefits">
          <li>
            <i className="ri-shopping-cart-line" aria-hidden="true" /> Pedido por WhatsApp
          </li>
          <li>Guarda tus favoritos</li>
        </ul>
      </article>
      <figure className="hero-media">
        <img
          src="/images/hero-tech.svg"
          alt="Laptop, teléfono y audífonos en un espacio de trabajo moderno"
        />
      </figure>
    </section>
  );
}
