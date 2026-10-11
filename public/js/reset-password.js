document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('reset-password-form');
    const passwordInput = document.getElementById('password');
    const confirmInput = document.getElementById('confirm-password');
    const submitBtn = document.getElementById('submit-btn');
    const statusDiv = document.getElementById('form-status');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const password = passwordInput.value;
        const confirmPassword = confirmInput.value;

        if (password.length < 6) {
            showStatus('La contraseña debe tener al menos 6 caracteres.', 'error');
            return;
        }

        if (password !== confirmPassword) {
            showStatus('Las contraseñas no coinciden.', 'error');
            return;
        }

        const token = window.location.pathname.split('/').pop();

        submitBtn.disabled = true;
        submitBtn.textContent = 'Restableciendo...';
        statusDiv.textContent = '';
        statusDiv.className = 'form-status';

        try {
            const response = await fetch(`/api/auth/reset-password/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            const data = await response.json();

            if (data.success) {
                showStatus(data.message || 'Contraseña restablecida con éxito. Redirigiendo...', 'success');
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
            } else {
                showStatus(data.error || 'Ocurrió un error. Intenta de nuevo.', 'error');
            }
        } catch (error) {
            logger.error('Error:', error);
            showStatus('Error de conexión. Intenta de nuevo.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Restablecer contraseña';
        }
    });

    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = `form-status ${type}`;
    }
});
