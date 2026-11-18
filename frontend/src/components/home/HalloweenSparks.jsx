import Particles, { ParticlesProvider } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';

function sparkOptions(count) {
  return {
    fullScreen: { enable: false },
    fpsLimit: 30,
    detectRetina: false,
    particles: {
      number: { value: count },
      color: { value: ['#a78bfa', '#c4b5fd'] },
      opacity: { value: { min: 0.25, max: 0.7 } },
      size: { value: { min: 0.8, max: 2.3 } },
      move: { enable: true, direction: 'top', speed: 0.45, outModes: { default: 'out' } },
    },
  };
}

const compactOptions = sparkOptions(10);
const desktopOptions = sparkOptions(22);

export default function HalloweenSparks({ compact }) {
  return (
    <ParticlesProvider init={loadSlim}>
      <Particles id="cinema-halloween-sparks" options={compact ? compactOptions : desktopOptions} />
    </ParticlesProvider>
  );
}
