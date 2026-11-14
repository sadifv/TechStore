import { useCallback, useEffect, useState } from 'react';
import { requestJson } from '../../services/api.js';
import { defaultCategories, StoreCategoriesContext } from '../../hooks/useStoreCategories.js';

export default function StoreCategoriesProvider({ children }) {
  const [categories, setCategories] = useState(defaultCategories);
  const [retry, setRetry] = useState(0);
  const refresh = useCallback(() => setRetry((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    requestJson('/api/store/categories', { signal: controller.signal })
      .then((result) => {
        if (
          !controller.signal.aborted &&
          Array.isArray(result.categories) &&
          result.categories.length
        )
          setCategories(result.categories);
      })
      .catch(() => {
        /* The existing catalog remains usable during a temporary outage. */
      });
    return () => controller.abort();
  }, [retry]);
  return (
    <StoreCategoriesContext.Provider value={{ categories, refresh }}>
      {children}
    </StoreCategoriesContext.Provider>
  );
}
