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

const sendOrderConfirmation = async (userEmail, orderId, totalAmount) => {
    try {
        const templatePath = path.join(__dirname, '../views/email-receipt.ejs');
        const htmlContent = await ejs.renderFile(templatePath, { orderId, totalAmount });

        const mailOptions = {
            from: `"TechStore" <${process.env.SMTP_USER}>`,
            to: userEmail,
            subject: '¡Confirmación de tu pedido en TechStore!',
            html: htmlContent
        };

        const info = await transporter.sendMail(mailOptions);
        logger.info(`✅ Correo de confirmación enviado a ${userEmail} (ID: ${info.messageId})`);
        return true;
    } catch (error) {
        logger.error(`❌ Error al enviar correo de confirmación a ${userEmail}: ${error.message}`, { stack: error.stack });
        throw error;
    }
};

module.exports = { sendOrderConfirmation };