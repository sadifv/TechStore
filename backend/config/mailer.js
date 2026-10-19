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
      logger.error(`[Mailer] ❌ Error al conectar con Gmail: ${error.message}`);
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
    logger.warn(`[Mailer] 📧 [SIMULADO] Correo a ${to} (${templateName}) - NO ENVIADO`);
    return { simulated: true, to, subject, templateName };
  }

  try {
    // Validaciones
    if (!to || !subject || !templateName) {
      throw new Error('Faltan datos: to, subject o templateName');
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(to)) {
      throw new Error(`Email inválido: ${to}`);
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
    logger.info(`✅ Correo (${templateName}) enviado a ${to} (ID: ${info.messageId})`);

    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error(`❌ Error al enviar correo (${templateName}) a ${to}: ${error.message}`, {
      stack: error.stack,
    });
    throw error;
  }
};

// Confirmación de Pedido
const sendOrderConfirmation = async (userEmail, orderId, totalAmount) => {
  return sendTemplateEmail({
    to: userEmail,
    subject: `✅ Confirmación de pedido #${String(orderId).slice(-8).toUpperCase()} - TechStore`,
    templateName: 'email-receipt',
    templateData: { orderId, totalAmount },
  });
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

const sendMembershipWelcomeEmail = async ({
  to,
  name,
  amount,
  welcomeCouponCode,
  monthlyCouponCode,
  unsubscribeUrl,
  isTest = false,
}) => {
  return sendTemplateEmail({
    to,
    subject: isTest
      ? 'Prueba de entrega de correo VIP | TechStore'
      : 'Tu membresía TechStore VIP está activa',
    templateName: 'email-vip-welcome',
    templateData: { name, amount, welcomeCouponCode, monthlyCouponCode, unsubscribeUrl, isTest },
  });
};

module.exports = {
  sendOrderConfirmation,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendMarketingCampaignEmail,
  sendMembershipWelcomeEmail,
};
