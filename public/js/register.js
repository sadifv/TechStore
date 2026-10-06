document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    const statusOutput = document.getElementById('register-status');

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('reg-name').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const password = document.getElementById('reg-password').value;

            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password })
                });

                const data = await response.json();

                if (data.success) {
                    statusOutput.textContent = '¡Cuenta creada con éxito! Redirigiendo...';
                    statusOutput.className = 'status-message success';
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 1500);
                } else {
                    statusOutput.textContent = data.error || 'Error al registrar usuario.';
                    statusOutput.className = 'status-message error';
                }
            } catch (error) {
                console.error('Error en el registro:', error);
                statusOutput.textContent = 'Ocurrió un error de conexión.';
                statusOutput.className = 'status-message error';
            }
        });
    }
});