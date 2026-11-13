import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function HeroMascot({ signedIn = false }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef(null);
  const [dock, setDock] = useState(null);
  const mascotRef = useRef(null);
  const restoreFocus = useRef(null);

  useLayoutEffect(() => {
    if (restoreFocus.current) {
      mascotRef.current?.querySelector(restoreFocus.current)?.focus({ preventScroll: true });
      restoreFocus.current = null;
    }
  }, [dock]);

  useEffect(() => {
    const hero = anchor.current?.closest('.hero-cinema');
    const slot = document.getElementById('navbar-assistant');
    if (!hero || !slot) return;
    const observer = new IntersectionObserver(([entry]) => {
      // Ignore a hero below the viewport; dock only after passing the whole scene.
      const active = document.activeElement;
      restoreFocus.current = mascotRef.current?.contains(active)
        ? active.tagName === 'A' ? 'a' : 'button'
        : null;
      setDock(!entry.isIntersecting && entry.boundingClientRect.bottom <= 0 ? slot : null);
    });
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  const mascot = (
    <aside
      ref={mascotRef}
      className={`hero-mascot${dock ? ' hero-mascot--docked' : ''}`}
      aria-label="TechBot"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
      }}
    >
      <button
        type="button"
        className="hero-mascot-button"
        aria-label="Saludar a TechBot"
        aria-expanded={open}
        aria-controls="hero-mascot-greeting"
        onClick={() => setOpen(!open)}
      >
        <svg viewBox="0 0 80 80" aria-hidden="true" focusable="false">
          <path d="M38 27V16" stroke="currentColor" strokeWidth="4" />
          <circle cx="38" cy="13" r="5" fill="currentColor" />
          <rect x="12" y="26" width="50" height="35" rx="13" fill="currentColor" />
          <rect x="20" y="33" width="34" height="19" rx="8" fill="var(--color-surface)" />
          <circle cx="30" cy="42" r="3" fill="currentColor" />
          <circle cx="44" cy="42" r="3" fill="currentColor" />
          <path
            className="hero-mascot-hand"
            d="M59 56 Q70 56 72 42 M69 44 L68 37 M72 42 L76 36"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
          <g className="hero-mascot-pumpkin">
            <ellipse cx="17" cy="63" rx="11" ry="8" fill="var(--color-primary)" />
            <path d="M17 56v-4 M13 63h1m6 0h1" stroke="var(--color-surface)" strokeWidth="2" />
          </g>
          <g className="hero-mascot-hat">
            <path d="M24 28Q27 7 49 15L55 29Z" fill="currentColor" />
            <path
              d="M23 28h33"
              stroke="var(--color-surface)"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <circle cx="50" cy="15" r="4" fill="var(--color-surface)" />
          </g>
        </svg>
        <span className="hero-mascot-preview" aria-hidden="true" hidden={open}>
          {signedIn ? '¡Hola! ¿Buscas algo?' : 'Inicia sesión para conversar'}
        </span>
      </button>
      <p id="hero-mascot-greeting" className="hero-mascot-greeting" hidden={!open}>
        {signedIn
          ? '¡Hola! Cuéntame qué estás buscando.'
          : '¡Hola! Inicia sesión para conversar conmigo.'}{' '}
        <a href="/#ai-assistant" onClick={() => setOpen(false)}>
          {signedIn ? 'Abrir TechBot' : 'Conocer TechBot'}
        </a>
      </p>
    </aside>
  );
  return (
    <div ref={anchor} className="hero-mascot-anchor">
      {dock ? createPortal(mascot, dock) : mascot}
    </div>
  );
}
