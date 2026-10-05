document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.querySelector('#contact-form');
    const statusOutput = document.querySelector('#contact-status');

    if (contactForm && statusOutput) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.querySelector('#name').value.trim();
            const email = document.querySelector('#email').value.trim();
            const message = document.querySelector('#message').value.trim();

            if (!name || !email || !message) return;

            const submitBtn = contactForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Enviando...';

            try {
                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, message })
                });

                const data = await response.json();

                if (data.success) {
                    statusOutput.textContent = '¡Mensaje enviado con éxito!';
                    statusOutput.className = 'form-status success';
                    contactForm.reset();
                } else {
                    statusOutput.textContent = data.error || 'Error al enviar el mensaje.';
                    statusOutput.className = 'form-status error';
                }
            } catch (error) {
                console.error('Error al enviar contacto:', error);
                statusOutput.textContent = 'Error de conexión con el servidor.';
                statusOutput.className = 'form-status error';
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Enviar mensaje';
            }
        });
    }
});