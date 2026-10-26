const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');
const logger = require('./logger');
const { createGmailApiTransport } = require('../services/gmailApiTransport');

// Validar credenciales al arrancar
const hasSmtpCredentials = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

let transporter = null;
const transportMode = process.env.EMAIL_TRANSPORT || 'smtp';
if (!['smtp', 'gmail-api'].includes(transportMode)) {
  throw new Error('EMAIL_TRANSPORT debe ser smtp o gmail-api.');
}
const gmailCredentials = {
  user: process.env.GMAIL_USER,
  clientId: process.env.GMAIL_OAUTH_CLIENT_ID,
  clientSecret: process.env.GMAIL_OAUTH_CLIENT_SECRET,
  refreshToken: process.env.GMAIL_OAUTH_REFRESH_TOKEN,
};
const hasGmailCredentials = Object.values(gmailCredentials).every(
  (value) => typeof value === 'string' && value.trim(),
);
const sender = transportMode === 'gmail-api' ? gmailCredentials.user : process.env.SMTP_USER;

if (transportMode === 'gmail-api' && hasGmailCredentials) {
  transporter = createGmailApiTransport(gmailCredentials);
  logger.info('[Mailer] Gmail API configurada por HTTPS; entrega real pendiente de verificar.');
} else if (transportMode === 'smtp' && hasSmtpCredentials) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    pool: true, // Pool de conexiones
    maxConnections: 5,
    maxMessages: 100,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
  });

  // Verificar conexión SMTP al arrancar
  transporter.verify((error) => {
    if (error) {
      logger.error('[Mailer] Error al conectar con el servidor SMTP.', {
        errorCode: error.code || error.name,
      });
    } else {
      logger.info('[Mailer] ✅ Servidor SMTP listo para enviar correos.');
    }
  });
} else {
  logger.warn('[Mailer] Configuración de correo incompleta; no hay un transporte disponible.');
}

// Helper: obtener URL base
const getAppUrl = () => {
  return process.env.APP_URL || `http://localhost:${process.env.PORT || 3001}`;
};

// Función auxiliar para renderizar y enviar
const sendTemplateEmail = async ({ to, subject, templateName, templateData = {} }) => {
  // Modo simulado si no hay transporter
  if (!transporter) {
    if (process.env.NODE_ENV === 'production' || transportMode === 'gmail-api') {
      const error = new Error('El envío de correo no está configurado en producción.');
      error.code =
        transportMode === 'gmail-api' ? 'GMAIL_API_NOT_CONFIGURED' : 'SMTP_NOT_CONFIGURED';
      error.statusCode = 503;
      throw error;
    }
    logger.warn(`[Mailer] Correo simulado (${templateName}); no fue enviado.`);
    return { simulated: true, to, subject, templateName };
  }

  try {
    // Validaciones
    if (!to || !subject || !templateName) {
      throw new Error('Faltan datos: to, subject o templateName');
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(to)) {
      throw new Error('La dirección de correo no es válida.');
    }

    // Enriquecer datos con appUrl y año actual
    const enrichedData = {
      ...templateData,
      subject,
      appUrl: getAppUrl(),
      currentYear: new Date().getFullYear(),
    };

    const templatePath = path.join(__dirname, `../views/${templateName}.ejs`);
    const htmlContent = await ejs.renderFile(templatePath, enrichedData);

    const mailOptions = {
      from: { name: 'TechStore', address: sender },
      to,
      subject,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`[Mailer] Correo (${templateName}) enviado correctamente.`);

    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error(`[Mailer] Error al enviar correo (${templateName}).`, {
      errorCode: error.code || error.name,
    });
    throw error;
  }
};

// Restablecimiento de Contraseña
const sendPasswordResetEmail = async (userEmail, resetUrl) => {
  return sendTemplateEmail({
    to: userEmail,
    subject: '🔐 Restablecimiento de contraseña | TechStore',
    templateName: 'email-reset-password',
    templateData: { resetUrl },
  });
};

const sendWelcomeEmail = async (userEmail, name) => {
  return sendTemplateEmail({
    to: userEmail,
    subject: '¡Bienvenido a TechStore!',
    templateName: 'email-welcome',
    templateData: { userName: name },
  });
};

const sendMarketingCampaignEmail = async ({
  to,
  subject,
  name,
  content,
  couponCode,
  unsubscribeUrl,
}) => {
  return sendTemplateEmail({
    to,
    subject,
    templateName: 'email-campaign',
    templateData: { name, content, couponCode, unsubscribeUrl },
  });
};

module.exports = {
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendMarketingCampaignEmail,
};
