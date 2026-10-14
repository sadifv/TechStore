document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.querySelector('#login-form');
    const statusOutput = document.querySelector('#login-status');

    if (loginForm && statusOutput) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const emailInput = document.querySelector('#login-email');
            const passwordInput = document.querySelector('#login-password');
            const email = emailInput.value.trim().toLowerCase();
            const password = passwordInput.value;

            if (!email || !password) return;

            const submitBtn = loginForm.querySelector('button[type="submit"]');
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
                    statusOutput.textContent = 'Inicio de sesión correcto. Preparando tu cuenta...';
                    statusOutput.className = 'form-status success';

                    // Sincronizar el carrito de visitante guardado en localStorage a MongoDB
                    if (typeof window.syncGuestCartToUser === 'function') {
                        await window.syncGuestCartToUser();
                    }

                    setTimeout(() => {
                        window.location.href = '/';
                    }, 1000);
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
                submitBtn.textContent = 'Ingresar';
            }
        });
    }

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