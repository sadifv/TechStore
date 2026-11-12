import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

const query =
  '(min-width: 900px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)';
const snapshot = () => window.matchMedia(query).matches;
function subscribe(update) {
  const media = window.matchMedia(query);
  media.addEventListener('change', update);
  return () => media.removeEventListener('change', update);
}
const clamp = (value) => Math.max(0, Math.min(1, value));
const smooth = (value) => {
  const v = clamp(value);
  return v * v * (3 - 2 * v);
};

export default function useCinematicHero() {
  const ref = useRef(null);
  const animated = useSyncExternalStore(subscribe, snapshot, () => false);
  const [chapter, setChapter] = useState(0);
  const paintRef = useRef(null);
  useEffect(() => {
    const node = ref.current;
    let frame = 0;
    let start = 0;
    let distance = 1;
    let last = '';
    const paint = (progress) => {
      const key = progress.toFixed(3);
      if (key === last) return;
      last = key;
      const reveal = smooth((progress - 0.12) / 0.3);
      const zoom = smooth((progress - 0.64) / 0.3);
      node.style.setProperty('--cinema-open', reveal.toFixed(3));
      node.style.setProperty('--cinema-zoom', zoom.toFixed(3));
      node.style.setProperty('--cinema-progress', key);
      setChapter(progress < 0.32 ? 0 : progress < 0.72 ? 1 : 2);
    };
    paintRef.current = paint;
    const update = () => {
      frame = 0;
      paint(clamp((window.scrollY - start) / distance));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const measure = () => {
      start = window.scrollY + node.getBoundingClientRect().top;
      distance = Math.max(1, node.offsetHeight - window.innerHeight);
      schedule();
    };
    if (animated) {
      measure();
      window.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', measure);
    } else paint(0);
    return () => {
      paintRef.current = null;
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', measure);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [animated]);
  function choose(index) {
    const progress = [0, 0.5, 0.9][index];
    if (!animated) return paintRef.current?.(progress);
    const node = ref.current;
    const top = window.scrollY + node.getBoundingClientRect().top;
    window.scrollTo({
      top: Math.max(0, top + (node.offsetHeight - window.innerHeight) * progress),
      behavior: 'instant',
    });
  }
  return { ref, chapter, animated, choose };
}
