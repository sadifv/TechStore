// A visible admin tab spends about 60 of the 100 API requests per 15 minutes:
// 15 refreshes plus 45 heartbeats, leaving room for navigation and mutations.
export const ADMIN_REFRESH_INTERVAL_MS = 60_000;
export const PRESENCE_HEARTBEAT_INTERVAL_MS = 20_000;
