import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { requestJson } from '../../services/api.js';
import defaults from '../../config/storeContentDefaults.json';
import { StoreContentContext } from './StoreContentContext.js';

export default function StoreContentProvider({ children }) {
  const [content, setContent] = useState(defaults);
  const editVersion = useRef(0);
  const publishContent = useCallback((next) => {
    editVersion.current += 1;
    setContent(next);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const version = editVersion.current;
    requestJson('/api/store/content', { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted && version === editVersion.current)
          setContent({ ...defaults, ...result.content });
      })
      .catch(() => {}); // Public pages retain the current copy during a temporary failure.
    return () => controller.abort();
  }, []);
  const value = useMemo(() => ({ content, setContent: publishContent }), [content, publishContent]);
  return <StoreContentContext.Provider value={value}>{children}</StoreContentContext.Provider>;
}
