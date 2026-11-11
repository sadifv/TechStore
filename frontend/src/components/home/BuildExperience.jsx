export default function BuildExperience() {
  return (
    <section className="build-experience" aria-labelledby="build-experience-title">
      <div className="build-experience-stage">
        <header className="build-experience-copy">
          <p className="editorial-kicker">Arma tu equipo</p>
          <h2 id="build-experience-title">
            Cada pieza cuenta.
            <br />
            Empieza por la base.
          </h2>
          <p>Explora procesadores, placas y memoria para elegir la base de tu PC.</p>
          <a className="btn btn-primary" href="/arma-tu-equipo">
            Explorar el configurador <span aria-hidden="true">↗</span>
          </a>
        </header>
        <figure
          className="build-experience-art"
          aria-label="Ilustración de una placa, un procesador y dos módulos de RAM que se ensamblan"
        >
          <svg viewBox="0 0 640 560" aria-hidden="true" focusable="false">
            <g className="build-piece-board">
              <rect className="build-board-edge" x="94" y="100" width="428" height="390" rx="16" />
              <rect className="build-board" x="102" y="108" width="412" height="374" rx="10" />
              <g className="build-traces" fill="none" strokeWidth="2">
                <path d="M125 180h40l45 45h40M125 194h34l45 45h46M125 208h28l45 45h52M125 222h22l45 45h58M320 305v38l-48 48v60M334 305v44l-48 48v54M348 305v50l-48 48v48M250 280h-36l-34 34v138M430 165h54v120l-44 44v120M440 179h30v100l-44 44v126" />
              </g>
              <g className="build-board-metal">
                <rect x="115" y="120" width="48" height="138" rx="5" />
                <rect x="175" y="122" width="164" height="38" rx="4" />
                <rect x="115" y="300" width="42" height="154" rx="5" />
                <rect x="210" y="365" width="180" height="15" rx="3" />
                <rect x="210" y="408" width="180" height="15" rx="3" />
              </g>
              <rect className="build-socket" x="246" y="204" width="112" height="112" rx="8" />
              <g className="build-slots">
                <rect x="393" y="159" width="13" height="172" rx="3" />
                <rect x="423" y="159" width="13" height="172" rx="3" />
              </g>
              <g className="build-fasteners">
                <circle cx="115" cy="119" r="4" />
                <circle cx="500" cy="119" r="4" />
                <circle cx="115" cy="469" r="4" />
                <circle cx="500" cy="469" r="4" />
              </g>
              <text className="build-board-label" x="210" y="455">
                TECHSTORE / BASE PC
              </text>
            </g>
            <g className="build-piece-cpu">
              <rect className="build-chip-base" x="250" y="208" width="104" height="104" rx="7" />
              <rect className="build-chip-metal" x="260" y="218" width="84" height="84" rx="5" />
              <path
                className="build-chip-engraving"
                d="M280 245h44M302 245v30"
                fill="none"
                strokeWidth="5"
              />
              <circle className="build-chip-node" cx="324" cy="245" r="5" />
            </g>
            <g className="build-piece-memory">
              <g className="build-ram">
                <rect x="384" y="155" width="29" height="180" rx="4" />
                <rect x="414" y="155" width="29" height="180" rx="4" />
              </g>
              <g className="build-ram-chips">
                <path d="M390 174h17v24h-17zM390 210h17v24h-17zM390 246h17v24h-17zM390 282h17v24h-17zM420 174h17v24h-17zM420 210h17v24h-17zM420 246h17v24h-17zM420 282h17v24h-17z" />
              </g>
              <path
                className="build-ram-light"
                d="M387 160v168M417 160v168"
                fill="none"
                strokeWidth="3"
              />
            </g>
          </svg>
        </figure>
        <ol className="build-experience-steps">
          <li>
            <span>01</span>
            <strong>Procesador</strong>
            <p>Elige tu punto de partida.</p>
          </li>
          <li>
            <span>02</span>
            <strong>Placa madre</strong>
            <p>Explora las opciones de plataforma.</p>
          </li>
          <li>
            <span>03</span>
            <strong>Memoria RAM</strong>
            <p>Completa la base de tu equipo.</p>
          </li>
        </ol>
      </div>
    </section>
  );
}
