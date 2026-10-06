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
                    headers: { 
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    statusOutput.textContent = '¡Inicio de sesión exitoso! Redirigiendo...';
                    statusOutput.className = 'form-status success';
                    
                    setTimeout(() => {
                        // Redirigir siempre a la página principal
                        window.location.href = '/';
                    }, 1200);
                } else {
                    // Limpiamos el mensaje anterior
                    statusOutput.textContent = ''; 

                    // 1. Mensaje devuelto por el servidor
                    const messageText = data.error || 'El correo no está registrado.';
                    const errorTextNode = document.createTextNode(messageText + ' ');

                    // 2. Enlace de registro programático y seguro (sin innerHTML)
                    const registerLink = document.createElement('a');
                    registerLink.href = '/register';
                    registerLink.textContent = '¿Deseas registrarte?';

                    // 3. Insertamos ambos elementos en el <output>
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