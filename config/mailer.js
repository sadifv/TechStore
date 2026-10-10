const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');
const logger = require('./logger');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

/**
 * Función auxiliar para renderizar plantillas EJS y enviar correos
 */
const sendTemplateEmail = async ({ to, subject, templateName, templateData }) => {
    try {
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            logger.warn(`[Mailer] ⚠️ SMTP_USER o SMTP_PASS no definidos. Correo a ${to} simulado.`);
            return true;
        }

        const templatePath = path.join(__dirname, `../views/${templateName}.ejs`);
        const htmlContent = await ejs.renderFile(templatePath, templateData);

        const mailOptions = {
            from: `"TechStore" <${process.env.SMTP_USER}>`,
            to,
            subject,
            html: htmlContent
        };

        const info = await transporter.sendMail(mailOptions);
        logger.info(`✅ Correo (${templateName}) enviado con éxito a ${to} (ID: ${info.messageId})`);
        return true;
    } catch (error) {
        logger.error(`❌ Error al enviar correo (${templateName}) a ${to}: ${error.message}`, { stack: error.stack });
        throw error;
    }
};

/**
 * Confirmación de Pedido
 */
const sendOrderConfirmation = async (userEmail, orderId, totalAmount) => {
    return sendTemplateEmail({
        to: userEmail,
        subject: '¡Confirmación de tu pedido en TechStore!',
        templateName: 'email-receipt',
        templateData: { orderId, totalAmount }
    });
};

/**
 * Restablecimiento de Contraseña
 */
const sendPasswordResetEmail = async (userEmail, resetUrl) => {
    return sendTemplateEmail({
        to: userEmail,
        subject: 'Restablecimiento de contraseña | TechStore',
        templateName: 'email-reset-password',
        templateData: { resetUrl }
    });
};

module.exports = {
    sendOrderConfirmation,
    sendPasswordResetEmail
};