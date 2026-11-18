import { useCallback, useSyncExternalStore } from 'react';

export function useMediaQuery(query, fallback = false) {
  const subscribe = useCallback(
    (onChange) => {
      const preference = window.matchMedia(query);
      preference.addEventListener('change', onChange);
      return () => preference.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => fallback);
}

export default function useReducedMotion() {
  return useMediaQuery('(prefers-reduced-motion: reduce)', true);
}
