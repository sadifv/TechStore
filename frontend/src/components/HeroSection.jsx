export default function HeroSection() {
  return (
    <section id="inicio" className="hero">
      <article className="hero-content">
        <header>
          <h1>TechStore - Tecnología a tu alcance</h1>
          <p>Descubre los mejores gadgets con envío rápido y garantía asegurada.</p>
        </header>
        <a href="/catalogo" className="btn btn-primary">
          Ver catálogo completo
        </a>
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
