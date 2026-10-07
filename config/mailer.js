// config/mailer.js
const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const sendOrderConfirmation = async (userEmail, orderId, totalAmount) => {
    try {
        // 1. Apuntamos a la vista que acabamos de crear
        const templatePath = path.join(__dirname, '../views/email-receipt.ejs');
        
        // 2. Renderizamos el archivo EJS y le pasamos las variables
        const htmlContent = await ejs.renderFile(templatePath, { orderId, totalAmount });

        // 3. Enviamos el correo con el HTML ya renderizado
        const mailOptions = {
            from: `"TechStore" <${process.env.SMTP_USER}>`,
            to: userEmail,
            subject: '¡Confirmación de tu pedido en TechStore!',
            html: htmlContent
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Correo de confirmación enviado a ${userEmail}`);
    } catch (error) {
        console.error('❌ Error al enviar el correo:', error);
    }
};

module.exports = { sendOrderConfirmation };