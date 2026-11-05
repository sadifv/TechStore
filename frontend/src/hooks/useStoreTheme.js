import { useEffect } from 'react';
import { requestJson } from '../services/api.js';
import { applyTheme } from '../features/appearance/appearance.js';

export default function useStoreTheme() {
  useEffect(() => {
    let active = true;
    requestJson('/api/store/appearance')
      .then((result) => {
        if (active) applyTheme(result.theme);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
}
