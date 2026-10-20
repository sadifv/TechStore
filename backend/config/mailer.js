const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');
const logger = require('./logger');

// Validar credenciales al arrancar
const hasSmtpCredentials = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

let transporter = null;

if (hasSmtpCredentials) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    pool: true, // Pool de conexiones
    maxConnections: 5,
    maxMessages: 100,
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
  logger.warn('[Mailer] ⚠️ SMTP_USER o SMTP_PASS no definidos. Correos simulados.');
}

// Helper: obtener URL base
const getAppUrl = () => {
  return process.env.APP_URL || `http://localhost:${process.env.PORT || 3001}`;
};

// Función auxiliar para renderizar y enviar
const sendTemplateEmail = async ({ to, subject, templateName, templateData = {} }) => {
  // Modo simulado si no hay transporter
  if (!transporter) {
    if (process.env.NODE_ENV === 'production') {
      const error = new Error('El envío de correo no está configurado en producción.');
      error.code = 'SMTP_NOT_CONFIGURED';
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
      appUrl: getAppUrl(),
      currentYear: new Date().getFullYear(),
    };

    const templatePath = path.join(__dirname, `../views/${templateName}.ejs`);
    const htmlContent = await ejs.renderFile(templatePath, enrichedData);

    const mailOptions = {
      from: `"TechStore" <${process.env.SMTP_USER}>`,
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
