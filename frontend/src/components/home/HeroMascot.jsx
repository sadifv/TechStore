import { useState } from 'react';

export default function HeroMascot() {
  const [open, setOpen] = useState(false);

  return (
    <aside
      className="hero-mascot"
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
          ¡Hola! ¿Buscas algo?
        </span>
      </button>
      <p id="hero-mascot-greeting" className="hero-mascot-greeting" hidden={!open}>
        ¡Hola! ¿Buscas algo?{' '}
        <a href="#ai-assistant" onClick={() => setOpen(false)}>
          Abrir TechBot
        </a>
      </p>
    </aside>
  );
}
