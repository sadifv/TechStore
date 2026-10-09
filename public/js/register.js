document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    const statusOutput = document.getElementById('register-status');

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('reg-name').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const password = document.getElementById('reg-password').value;

            const submitBtn = registerForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Creando cuenta...';
            }

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
                    if (statusOutput) {
                        statusOutput.textContent = '¡Cuenta creada con éxito! Sincronizando carrito...';
                        statusOutput.className = 'status-message success';
                    }

                    // Sincronizar el carrito de visitante al crear cuenta
                    if (typeof window.syncGuestCartToUser === 'function') {
                        await window.syncGuestCartToUser();
                    }

                    setTimeout(() => {
                        window.location.href = '/';
                    }, 1000);
                } else {
                    if (statusOutput) {
                        statusOutput.textContent = data.error || 'Error al registrar usuario.';
                        statusOutput.className = 'status-message error';
                    }
                }
            } catch (error) {
                logger.error('Error en el registro:', error);
                if (statusOutput) {
                    statusOutput.textContent = 'Ocurrió un error de conexión con el servidor.';
                    statusOutput.className = 'status-message error';
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Crear Cuenta';
                }
            }
        });
    }
});