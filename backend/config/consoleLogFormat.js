const safeGmailErrorCodes = new Set([
  'GMAIL_REFRESH_TOKEN_INVALID',
  'GMAIL_OAUTH_CLIENT_INVALID',
  'GMAIL_API_NOT_ENABLED',
  'GMAIL_PERMISSION_DENIED',
  'GMAIL_QUOTA_EXCEEDED',
  'GMAIL_RATE_LIMITED',
  'GMAIL_NETWORK_ERROR',
  'GMAIL_AUTHENTICATION_FAILED',
  'GMAIL_PERMISSION_OR_QUOTA',
  'GMAIL_API_UNAVAILABLE',
  'GMAIL_API_SEND_FAILED',
  'GMAIL_API_NOT_CONFIGURED',
]);

module.exports = (info) => {
  const errorCode = safeGmailErrorCodes.has(info.errorCode) ? ` [${info.errorCode}]` : '';
  return `${info.timestamp} ${info.level}: ${info.message}${errorCode}`;
};
