import { requestJson } from './api.js';

// Keep one HTTP/error contract for JSON and multipart administrative writes.
export const adminMutation = (url, options = {}) => requestJson(url, options);
