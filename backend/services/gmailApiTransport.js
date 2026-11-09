const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');

const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

const providerReasonCodes = new Map([
  ['invalid_grant', 'GMAIL_REFRESH_TOKEN_INVALID'],
  ['invalid_client', 'GMAIL_OAUTH_CLIENT_INVALID'],
  ['unauthorized_client', 'GMAIL_OAUTH_CLIENT_INVALID'],
  ['accessnotconfigured', 'GMAIL_API_NOT_ENABLED'],
  ['servicedisabled', 'GMAIL_API_NOT_ENABLED'],
  ['insufficientpermissions', 'GMAIL_PERMISSION_DENIED'],
  ['autherror', 'GMAIL_PERMISSION_DENIED'],
  ['access_token_scope_insufficient', 'GMAIL_PERMISSION_DENIED'],
  ['dailylimitexceeded', 'GMAIL_QUOTA_EXCEEDED'],
  ['quotaexceeded', 'GMAIL_QUOTA_EXCEEDED'],
  ['userratelimitexceeded', 'GMAIL_RATE_LIMITED'],
  ['ratelimitexceeded', 'GMAIL_RATE_LIMITED'],
]);

const getSafeErrorCode = (error) => {
  const providerError = error?.response?.data?.error;
  const reasons = [
    typeof providerError === 'string' ? providerError : providerError?.status,
    ...(Array.isArray(providerError?.errors)
      ? providerError.errors.map((item) => item?.reason)
      : []),
  ];

  for (const reason of reasons) {
    if (typeof reason !== 'string') continue;
    const safeCode = providerReasonCodes.get(reason.toLowerCase());
    if (safeCode) return safeCode;
  }

  const status = Number(error?.response?.status);
  if (status === 401) return 'GMAIL_AUTHENTICATION_FAILED';
  if (status === 403) return 'GMAIL_PERMISSION_OR_QUOTA';
  if (status === 429) return 'GMAIL_RATE_LIMITED';
  if (status >= 500 && status <= 599) return 'GMAIL_API_UNAVAILABLE';

  if (
    ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH'].includes(
      error?.code,
    )
  )
    return 'GMAIL_NETWORK_ERROR';

  return 'GMAIL_API_SEND_FAILED';
};

function createGmailApiTransport(
  { user, clientId, clientSecret, refreshToken },
  AuthClient = OAuth2Client,
) {
  const auth = new AuthClient({
    clientId,
    clientSecret,
    transporterOptions: { timeout: 15000, retry: false, retryConfig: { retry: 0 } },
  });
  auth.setCredentials({ refresh_token: refreshToken });
  // Nodemailer constructs MIME locally; this transport never opens an SMTP socket.
  const composer = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: 'windows',
  });
  return {
    async sendMail(message) {
      try {
        const mime = await composer.sendMail({
          ...message,
          from: { name: 'TechStore', address: user },
        });
        const response = await auth.request({
          url: SEND_URL,
          method: 'POST',
          data: { raw: mime.message.toString('base64url') },
          timeout: 15000,
          retry: false,
          retryConfig: { retry: 0 },
        });
        if (typeof response.data?.id !== 'string' || !response.data.id) {
          throw new Error('Missing Gmail message acknowledgement');
        }
        return { messageId: response.data.id };
      } catch (providerError) {
        // Google errors can carry tokens, authorization headers and the full message.
        // Never propagate that payload to application logs or responses.
        const error = new Error('No se pudo confirmar el envío mediante Gmail API.');
        error.code = getSafeErrorCode(providerError);
        error.statusCode = 502;
        throw error;
      }
    },
  };
}

module.exports = { createGmailApiTransport };
