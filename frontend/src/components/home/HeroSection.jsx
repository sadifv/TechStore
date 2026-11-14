import HeroBackground from './HeroBackground.jsx';
import HeroMascot from './HeroMascot.jsx';
import PurchaseGuide from './PurchaseGuide.jsx';
import useCinematicHero from './useCinematicHero.js';
import useStoreContent from '../../hooks/useStoreContent.js';

export default function HeroSection({ signedIn }) {
  const { ref, chapter, animated, choose } = useCinematicHero();
  const { content } = useStoreContent();
  const chapters = [1, 2, 3].map((n) => [content[`chapter${n}Title`], content[`chapter${n}Text`]]);
  const defaultImage = content.heroImage === '/images/experience/audio-assembled-1280.webp';
  const defaultDetail = content.heroDetailImage === '/images/experience/audio-exploded-1280.webp';
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
            {content.heroLead} <em>{content.heroAccent}</em>
          </h1>
          <p>{content.heroSubtitle}</p>
          <nav className="cinema-actions" aria-label="Explorar productos">
            <a href="/catalogo" className="btn btn-primary">
              Ver catálogo <span aria-hidden="true">↗</span>
            </a>
            <PurchaseGuide />
          </nav>
        </header>
        <figure className="cinema-art" aria-label={content.heroImageAlt}>
          <img
            className="cinema-assembled"
            src={content.heroImage}
            srcSet={
              defaultImage
                ? '/images/experience/audio-assembled-640.webp 640w, /images/experience/audio-assembled-1280.webp 1280w'
                : undefined
            }
            sizes="(min-width: 900px) 85vw, 100vw"
            alt={content.heroImageAlt}
            fetchPriority="high"
            width="1774"
            height="887"
          />
          <img
            className="cinema-exploded"
            src={content.heroDetailImage}
            srcSet={
              defaultDetail
                ? '/images/experience/audio-exploded-640.webp 640w, /images/experience/audio-exploded-1280.webp 1280w'
                : undefined
            }
            sizes="(min-width: 900px) 85vw, 100vw"
            alt=""
            aria-hidden="true"
            decoding="async"
            width="1774"
            height="887"
          />
          <span
            className="cinema-part cinema-part--band"
            aria-hidden="true"
            hidden={!defaultImage || !defaultDetail}
          >
            Diadema
          </span>
          <span
            className="cinema-part cinema-part--driver"
            aria-hidden="true"
            hidden={!defaultImage || !defaultDetail}
          >
            Altavoz
          </span>
          <span
            className="cinema-part cinema-part--pad"
            aria-hidden="true"
            hidden={!defaultImage || !defaultDetail}
          >
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
