import { useEffect } from 'react';
import { requestJson } from '../api.js';
import { PRESENCE_HEARTBEAT_INTERVAL_MS } from '../requestCadence.js';

export default function usePresenceHeartbeat(user) {
  useEffect(() => {
    if (!user?.id) return undefined;

    const sendHeartbeat = () => {
      if (document.visibilityState !== 'visible') return;
      requestJson('/api/presence/heartbeat', { method: 'POST', body: '{}' }).catch(() => {});
    };

    sendHeartbeat();
    const intervalId = window.setInterval(sendHeartbeat, PRESENCE_HEARTBEAT_INTERVAL_MS);
    document.addEventListener('visibilitychange', sendHeartbeat);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', sendHeartbeat);
    };
  }, [user?.id]);
}
