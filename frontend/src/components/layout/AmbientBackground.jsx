const curves = [
  'M-80 150 Q 500 -30 1280 185',
  'M-80 310 Q 540 55 1280 340',
  'M-80 490 Q 600 160 1280 520',
  'M-80 680 Q 650 305 1280 710',
];

export default function AmbientBackground() {
  return (
    <svg
      className="ambient-background"
      viewBox="0 0 1200 720"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {curves.map((curve) => (
        <g key={curve}>
          <path d={curve} className="ambient-curve" />
          <path d={curve} pathLength="100" className="ambient-trail" />
        </g>
      ))}
    </svg>
  );
}
