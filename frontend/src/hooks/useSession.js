import { useEffect, useState } from 'react';
import { requestJson } from '../services/api.js';

export default function useSession() {
  const [session, setSession] = useState({ user: null, ready: false, error: '' });
  useEffect(() => {
    let active = true;
    let latest = 0;
    const refresh = () => {
      const attempt = ++latest;
      return requestJson('/api/auth/me')
      .then((result) => {
        if (active && attempt === latest) setSession({ user: result.user, ready: true, error: '' });
      })
      .catch((error) => {
        if (active && attempt === latest)
          setSession({ user: null, ready: true, error: error.status === 401 ? '' : error.message });
      });
    };
    refresh();
    window.addEventListener('account-updated', refresh);
    return () => {
      active = false;
      window.removeEventListener('account-updated', refresh);
    };
  }, []);
  return session;
}
