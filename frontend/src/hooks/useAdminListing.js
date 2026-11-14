import { useEffect, useState } from 'react';
import { requestJson } from '../services/api.js';

export function useAdminListing(url) {
  const [response, setResponse] = useState({ key: '', result: null, error: '' });
  const [version, setVersion] = useState(0);
  const key = `${version}:${url}`;
  useEffect(() => {
    const controller = new AbortController();
    requestJson(url, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setResponse({ key, result: data.data, error: '' });
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setResponse({ key, result: null, error: cause.message });
      });
    return () => controller.abort();
  }, [url, key]);
  return {
    result: response.key === key ? response.result : null,
    error: response.key === key ? response.error : '',
    loading: response.key !== key,
    reload: () => setVersion((value) => value + 1),
  };
}
