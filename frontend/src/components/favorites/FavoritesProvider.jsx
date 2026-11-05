import { useCallback, useEffect, useRef, useState } from 'react';
import { requestJson } from '../../services/api.js';
import { FavoritesContext } from './FavoritesContext.js';
export default function FavoritesProvider({ user, children }) {
  const [data, setData] = useState({ ids: [], items: [] });
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState('');
  const pending = useRef(new Set());
  const [busy, setBusy] = useState([]);
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const result = await requestJson('/api/favorites');
      setData({ ids: result.ids, items: result.items });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);
  useEffect(() => {
    let active = true;
    if (user) {
      requestJson('/api/favorites')
        .then((r) => {
          if (active) setData({ ids: r.ids, items: r.items });
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [user]);
  async function toggle(product) {
    const id = String(product._id);
    if (!user || pending.current.has(id)) return;
    pending.current.add(id);
    setBusy([...pending.current]);
    const saved = data.ids.includes(id);
    try {
      await requestJson(`/api/favorites/${encodeURIComponent(id)}`, {
        method: saved ? 'DELETE' : 'PUT',
      });
      setData((current) => ({
        ids: saved ? current.ids.filter((x) => x !== id) : [...new Set([...current.ids, id])],
        items: saved
          ? current.items.filter((x) => String(x._id) !== id)
          : [...current.items.filter((x) => String(x._id) !== id), product],
      }));
    } finally {
      pending.current.delete(id);
      setBusy([...pending.current]);
    }
  }
  return (
    <FavoritesContext.Provider
      value={{ user, ...data, loading, error, busy, refresh: load, toggle }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}
