import { useEffect, useState } from 'react';
import { requestJson } from '../services/api.js';

export default function useSession() {
  const [session, setSession] = useState({ user: null, ready: false, error: '' });
  useEffect(() => {
    let active = true;
    requestJson('/api/auth/me')
      .then((result) => {
        if (active) setSession({ user: result.user, ready: true, error: '' });
      })
      .catch((error) => {
        if (active)
          setSession({ user: null, ready: true, error: error.status === 401 ? '' : error.message });
      });
    return () => {
      active = false;
    };
  }, []);
  return session;
}
