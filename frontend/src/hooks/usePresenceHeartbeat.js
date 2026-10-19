import { useEffect } from 'react';
import { requestJson } from '../api.js';

const HEARTBEAT_INTERVAL_MS = 20 * 1000;

export default function usePresenceHeartbeat(user) {
  useEffect(() => {
    if (!user?.id) return undefined;

    const sendHeartbeat = () => {
      if (document.visibilityState !== 'visible') return;
      requestJson('/api/presence/heartbeat', { method: 'POST', body: '{}' }).catch(() => {});
    };

    sendHeartbeat();
    const intervalId = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    document.addEventListener('visibilitychange', sendHeartbeat);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', sendHeartbeat);
    };
  }, [user?.id]);
}
