import { useSyncExternalStore } from 'react';
import styles from './HeroBackground.module.css';

const backdropQuery = '(min-width: 768px) and (prefers-reduced-motion: no-preference)';

function subscribe(update) {
  const preference = window.matchMedia(backdropQuery);
  preference.addEventListener('change', update);
  return () => preference.removeEventListener('change', update);
}

function canPlayBackdrop() {
  return window.matchMedia(backdropQuery).matches;
}

function startBackdrop(video) {
  if (!video) return;
  video.muted = true;
  void video.play().catch(() => {});
}

export default function HeroBackground() {
  const canPlay = useSyncExternalStore(subscribe, canPlayBackdrop);

  if (!canPlay) return null;

  return (
    <video
      ref={startBackdrop}
      className={styles.backdrop}
      src="/images/hero-setup.webm"
      poster="/images/hero-tech.jpg"
      muted
      playsInline
      preload="none"
      aria-hidden="true"
      disablePictureInPicture
    />
  );
}
