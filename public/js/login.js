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
                const response = await fetch('/admin/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (data.success) {
                    statusOutput.textContent = '¡Inicio de sesión exitoso! Redirigiendo...';
                    statusOutput.className = 'form-status success';
                    
                    // Redirigir al dashboard administrativo
                    setTimeout(() => {
                        window.location.href = '/admin/dashboard';
                    }, 1200);
                } else {
                    statusOutput.textContent = data.error || 'Credenciales incorrectas.';
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