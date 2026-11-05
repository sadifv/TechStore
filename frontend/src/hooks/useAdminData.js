import { useEffect, useState } from 'react';
import { requestJson } from '../services/api.js';
export function useAdminData(url, { refreshIntervalMs = 0 } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    requestJson(url)
      .then((result) => {
        if (active) {
          setData(result.data);
          setError('');
        }
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      });
    const intervalId =
      refreshIntervalMs > 0
        ? window.setInterval(() => {
            if (document.visibilityState === 'visible') setReload((value) => value + 1);
          }, refreshIntervalMs)
        : null;
    return () => {
      active = false;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [url, reload, refreshIntervalMs]);
  return { data, error, refresh: () => setReload((value) => value + 1) };
}
