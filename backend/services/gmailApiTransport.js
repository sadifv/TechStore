const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');

const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

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
      } catch {
        // Google errors can carry tokens, authorization headers and the full message.
        // Never propagate that payload to application logs or responses.
        const error = new Error('No se pudo confirmar el envío mediante Gmail API.');
        error.code = 'GMAIL_API_SEND_FAILED';
        error.statusCode = 502;
        throw error;
      }
    },
  };
}

module.exports = { createGmailApiTransport };
