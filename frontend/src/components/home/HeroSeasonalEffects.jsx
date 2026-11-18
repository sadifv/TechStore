import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import useReducedMotion, { useMediaQuery } from '../../hooks/useReducedMotion.js';

const emptyEffect = () => ({ default: () => null });
const Snow = lazy(() => import('react-snowfall').catch(emptyEffect));
const Sparks = lazy(() => import('./HalloweenSparks.jsx').catch(emptyEffect));

function subscribe(onChange) {
  window.addEventListener('store-theme-changed', onChange);
  return () => window.removeEventListener('store-theme-changed', onChange);
}

export default function HeroSeasonalEffects() {
  const theme = useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.theme,
    () => 'normal',
  );
  const reducedMotion = useReducedMotion();
  if (reducedMotion || (theme !== 'christmas' && theme !== 'halloween')) return null;
  return <SeasonalLayer theme={theme} />;
}

function SeasonalLayer({ theme }) {
  const layer = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    let inView = false;
    const update = () => setVisible(inView && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      update();
    });
    observer.observe(layer.current);
    document.addEventListener('visibilitychange', update);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  const compact = useMediaQuery('(max-width: 640px)');
  return (
    <div className="cinema-seasonal" ref={layer} aria-hidden="true" data-season={theme}>
      {visible && (
        <Suspense fallback={null}>
          {theme === 'christmas' ? (
            <Snow
              color="#dbeafe"
              snowflakeCount={compact ? 12 : 26}
              radius={[0.6, 2]}
              speed={[0.9, 1.8]}
              wind={[-0.25, 0.3]}
            />
          ) : (
            <Sparks compact={compact} />
          )}
        </Suspense>
      )}
    </div>
  );
}
