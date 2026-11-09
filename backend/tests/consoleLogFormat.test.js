const test = require('node:test');
const assert = require('node:assert/strict');
const formatConsoleLog = require('../config/consoleLogFormat');

test('console logs show allowlisted Gmail diagnostic codes without printing provider details', () => {
  const line = formatConsoleLog({
    timestamp: '2026-11-09 12:00:00',
    level: 'error',
    message: '[Mailer] Error al enviar correo (email-campaign).',
    errorCode: 'GMAIL_REFRESH_TOKEN_INVALID',
    errorDescription: 'private-token-data',
  });

  assert.match(line, /\[GMAIL_REFRESH_TOKEN_INVALID\]$/);
  assert.ok(!line.includes('private-token-data'));
});

test('console logs omit unrecognized error codes', () => {
  const line = formatConsoleLog({
    timestamp: '2026-11-09 12:00:00',
    level: 'error',
    message: 'Error al enviar correo.',
    errorCode: 'secret-value-that-is-not-a-diagnostic-code',
  });

  assert.equal(line, '2026-11-09 12:00:00 error: Error al enviar correo.');
});
