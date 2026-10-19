const ONLINE_WINDOW_MS = 60 * 1000;

const isOnline = (lastSeenAt, now = Date.now()) => {
  if (!lastSeenAt) return false;
  const lastSeenTime = new Date(lastSeenAt).getTime();
  return (
    Number.isFinite(lastSeenTime) && lastSeenTime <= now && now - lastSeenTime <= ONLINE_WINDOW_MS
  );
};

module.exports = { ONLINE_WINDOW_MS, isOnline };
