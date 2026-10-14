document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    const statusOutput = document.getElementById('register-status');

    if (!registerForm || !statusOutput) return;

    const submitBtn = registerForm.querySelector('button[type="submit"]');
    let authenticated = false;

    const syncCartAndContinue = async () => {
        let result;
        try {
            result = typeof window.syncGuestCartToUser === 'function'
                ? await window.syncGuestCartToUser()
                : { failedCount: 1 };
        } catch (error) {
            console.error('Error al sincronizar el carrito:', error);
            result = { failedCount: 1 };
        }

        if (result.failedCount > 0) {
            statusOutput.replaceChildren();
            const message = document.createElement('span');
            message.textContent = `La cuenta se creó, pero no se pudieron sincronizar ${result.failedCount} producto(s). Se conservaron en este navegador.`;
            statusOutput.appendChild(message);
            statusOutput.className = 'status-message error';
            submitBtn.hidden = true;

            const retryButton = document.createElement('button');
            retryButton.type = 'button';
            retryButton.className = 'login-register-action';
            retryButton.textContent = 'Reintentar sincronización';
            retryButton.addEventListener('click', async () => {
                retryButton.disabled = true;
                retryButton.textContent = 'Sincronizando...';
                try {
                    await syncCartAndContinue();
                } catch (error) {
                    console.error('Error al reintentar la sincronización del carrito:', error);
                    retryButton.disabled = false;
                    retryButton.textContent = 'Reintentar sincronización';
                }
            });
            statusOutput.appendChild(retryButton);
            return;
        }

        statusOutput.textContent = '¡Cuenta creada con éxito! Preparando tu cuenta...';
        statusOutput.className = 'status-message success';
        setTimeout(() => {
            window.location.href = '/';
        }, 1000);
    };

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (authenticated) return;

        const name = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Creando cuenta...';

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ name, email, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                authenticated = true;
                await syncCartAndContinue();
            } else {
                statusOutput.textContent = data.error || 'Error al registrar usuario.';
                statusOutput.className = 'status-message error';
            }
        } catch (error) {
            console.error('Error en el registro:', error);
            statusOutput.textContent = 'Ocurrió un error de conexión con el servidor.';
            statusOutput.className = 'status-message error';
        } finally {
            submitBtn.disabled = false;
            if (!authenticated) submitBtn.textContent = 'Crear Cuenta';
        }
    });
});
