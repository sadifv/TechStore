document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.querySelector('#login-form');
    const statusOutput = document.querySelector('#login-status');

    if (!loginForm || !statusOutput) return;

    const submitBtn = loginForm.querySelector('button[type="submit"]');
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
            message.textContent = `No se pudieron sincronizar ${result.failedCount} producto(s). Se conservaron en este navegador.`;
            statusOutput.appendChild(message);
            statusOutput.className = 'form-status error login-status-visible';
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

        statusOutput.textContent = 'Inicio de sesión correcto. Preparando tu cuenta...';
        statusOutput.className = 'form-status success';
        setTimeout(() => {
            window.location.href = '/';
        }, 1000);
    };

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (authenticated) return;

        const emailInput = document.querySelector('#login-email');
        const passwordInput = document.querySelector('#login-password');
        const email = emailInput.value.trim().toLowerCase();
        const password = passwordInput.value;

        if (!email || !password) return;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Ingresando...';
        statusOutput.replaceChildren();
        statusOutput.className = 'form-status';

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                authenticated = true;
                await syncCartAndContinue();
            } else {
                showLoginError(
                    data.error || 'No se pudo iniciar sesión. Revisa tus datos e inténtalo de nuevo.',
                    data.code === 'ACCOUNT_NOT_FOUND'
                );
                passwordInput.value = '';
                passwordInput.focus();
            }
        } catch (error) {
            console.error('Error en login:', error);
            showLoginError('No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.');
        } finally {
            submitBtn.disabled = false;
            if (!authenticated) submitBtn.textContent = 'Ingresar';
        }
    });

    function showLoginError(message, showRegisterLink = false) {
        const messageElement = document.createElement('span');
        messageElement.className = 'login-status-message';
        const icon = document.createElement('i');
        icon.className = 'ri-error-warning-line';
        icon.setAttribute('aria-hidden', 'true');
        messageElement.append(icon, document.createTextNode(message));
        statusOutput.replaceChildren(messageElement);

        if (showRegisterLink) {
            const registerLink = document.createElement('a');
            registerLink.className = 'login-register-action';
            registerLink.href = '/register';
            registerLink.textContent = 'Crear cuenta';
            statusOutput.appendChild(registerLink);
        }

        statusOutput.className = 'form-status error login-status-visible';
    }
});
