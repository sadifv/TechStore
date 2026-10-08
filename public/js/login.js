document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.querySelector('#login-form');
    const statusOutput = document.querySelector('#login-status');

    if (loginForm && statusOutput) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.querySelector('#login-email').value.trim();
            const password = document.querySelector('#login-password').value.trim();

            if (!email || !password) return;

            const submitBtn = loginForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Ingresando...';

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
                    statusOutput.textContent = '¡Inicio de sesión exitoso! Sincronizando carrito...';
                    statusOutput.className = 'form-status success';

                    // Sincronizar el carrito de visitante guardado en localStorage a MongoDB
                    if (typeof window.syncGuestCartToUser === 'function') {
                        await window.syncGuestCartToUser();
                    }

                    setTimeout(() => {
                        window.location.href = '/';
                    }, 1000);
                } else {
                    statusOutput.textContent = ''; 

                    const messageText = data.error || 'El correo no está registrado.';
                    const errorTextNode = document.createTextNode(messageText + ' ');

                    const registerLink = document.createElement('a');
                    registerLink.href = '/register';
                    registerLink.textContent = '¿Deseas registrarte?';

                    statusOutput.appendChild(errorTextNode);
                    statusOutput.appendChild(registerLink);
                    statusOutput.className = 'form-status error';
                }
            } catch (error) {
                console.error('Error en login:', error);
                statusOutput.textContent = 'Error de conexión con el servidor.';
                statusOutput.className = 'form-status error';
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Ingresar';
            }
        });
    }
});