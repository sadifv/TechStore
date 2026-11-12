import HeroBackground from './HeroBackground.jsx';
import HeroMascot from './HeroMascot.jsx';
import PurchaseGuide from './PurchaseGuide.jsx';
import useCinematicHero from './useCinematicHero.js';

const chapters = [
  ['El primer contacto.', 'Explora laptops, audio y periféricos en Ecuador.'],
  ['Mira lo que hay dentro.', 'Una mirada distinta a la tecnología que eliges.'],
  ['Encuentra lo que va contigo.', 'Explora el catálogo y coordina tu pedido por WhatsApp.'],
];

export default function HeroSection({ signedIn }) {
  const { ref, chapter, animated, choose } = useCinematicHero();
  return (
    <section
      ref={ref}
      id="inicio"
      className="hero-cinema"
      data-scroll={animated}
      data-chapter={chapter}
      aria-labelledby="cinema-title"
    >
      <div className="cinema-stage">
        <HeroBackground />
        <header className="cinema-copy">
          <p className="cinema-eyebrow">TECHSTORE / ECUADOR</p>
          <h1 id="cinema-title">
            Escucha cada <em>detalle.</em>
          </h1>
          <p>Laptops, audio y periféricos. Tu próximo equipo empieza aquí.</p>
          <nav className="cinema-actions" aria-label="Explorar productos">
            <a href="/catalogo" className="btn btn-primary">
              Ver catálogo <span aria-hidden="true">↗</span>
            </a>
            <PurchaseGuide />
          </nav>
        </header>
        <figure
          className="cinema-art"
          aria-label="Visualización ilustrativa de auriculares completos y sus componentes separados"
        >
          <img
            className="cinema-assembled"
            src="/images/experience/audio-assembled-1280.webp"
            srcSet="/images/experience/audio-assembled-640.webp 640w, /images/experience/audio-assembled-1280.webp 1280w"
            sizes="(min-width: 900px) 85vw, 100vw"
            alt="Auriculares de referencia en grafito, con detalles azules"
            fetchPriority="high"
            width="1774"
            height="887"
          />
          <img
            className="cinema-exploded"
            src="/images/experience/audio-exploded-1280.webp"
            srcSet="/images/experience/audio-exploded-640.webp 640w, /images/experience/audio-exploded-1280.webp 1280w"
            sizes="(min-width: 900px) 85vw, 100vw"
            alt=""
            aria-hidden="true"
            decoding="async"
            width="1774"
            height="887"
          />
          <span className="cinema-part cinema-part--band" aria-hidden="true">
            Diadema
          </span>
          <span className="cinema-part cinema-part--driver" aria-hidden="true">
            Altavoz
          </span>
          <span className="cinema-part cinema-part--pad" aria-hidden="true">
            Almohadilla
          </span>
        </figure>
        <div className="cinema-orbit" aria-hidden="true">
          {Array.from({ length: 16 }, (_, i) => (
            <span
              key={i}
              style={{ '--particle': i, left: `${(i * 37) % 100}%`, top: `${(i * 23) % 100}%` }}
            />
          ))}
        </div>
        <footer className="cinema-footer">
          <hgroup className="cinema-chapter-copy">
            <h2>{chapters[chapter][0]}</h2>
            <p>{chapters[chapter][1]}</p>
          </hgroup>
          <nav className="cinema-chapters" aria-label="Escenas del producto">
            {chapters.map(([title], index) => (
              <button
                key={title}
                type="button"
                aria-label={`Ver escena ${index + 1}`}
                aria-current={chapter === index ? 'step' : undefined}
                onClick={() => choose(index)}
              >
                <span>0{index + 1}</span>
                <span className="cinema-chapter-line" aria-hidden="true" />
              </button>
            ))}
          </nav>
          <p className="cinema-disclaimer">
            Render ilustrativo. Modelos y disponibilidad en el catálogo.
          </p>
        </footer>
        <div className="cinema-assistant">
          <HeroMascot signedIn={signedIn} />
        </div>
      </div>
    </section>
  );
}
