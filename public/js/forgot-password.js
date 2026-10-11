const logger = require("../../config/logger");

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('forgot-password-form');
    const emailInput = document.getElementById('email');
    const submitBtn = document.getElementById('submit-btn');
    const statusDiv = document.getElementById('form-status');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = emailInput.value.trim();

        if (!email) {
            showStatus('Por favor ingresa tu correo electrónico.', 'error');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';
        statusDiv.textContent = '';
        statusDiv.className = 'form-status';

        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (data.success) {
                showStatus(data.message || 'Se ha enviado un correo con las instrucciones.', 'success');
                form.reset();
            } else {
                showStatus(data.error || 'Ocurrió un error. Intenta de nuevo.', 'error');
            }
        } catch (error) {
            logger.error('Error:', error);
            showStatus('Error de conexión. Intenta de nuevo.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Enviar instrucciones';
        }
    });

    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = `form-status ${type}`;
    }
});
