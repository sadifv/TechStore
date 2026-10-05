document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.querySelector('#ai-chat-form');
    const chatInput = document.querySelector('#ai-chat-input');
    const chatMessages = document.querySelector('#ai-chat-messages');

    if (!chatForm || !chatInput || !chatMessages) return;

    // Función auxiliar para agregar mensajes al contenedor de forma segura
    function appendMessage(sender, text) {
        const msgWrapper = document.createElement('div');
        msgWrapper.classList.add('chat-message', sender === 'user' ? 'message-user' : 'message-ai');

        const senderLabel = document.createElement('span');
        senderLabel.classList.add('message-sender');
        senderLabel.textContent = sender === 'user' ? 'Tú' : 'TechBot';

        const textParagraph = document.createElement('p');
        textParagraph.textContent = text;

        msgWrapper.appendChild(senderLabel);
        msgWrapper.appendChild(textParagraph);

        chatMessages.appendChild(msgWrapper);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const message = chatInput.value.trim();
        if (!message) return;

        // 1. Mostrar mensaje del usuario
        appendMessage('user', message);
        chatInput.value = '';

        // 2. Estado de carga
        const loadingIndicator = document.createElement('div');
        loadingIndicator.classList.add('chat-loading');
        loadingIndicator.textContent = 'TechBot está pensando...';
        chatMessages.appendChild(loadingIndicator);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        try {
            // 3. Enviar petición al backend
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });

            const data = await response.json();
            chatMessages.removeChild(loadingIndicator);

            if (data.success) {
                appendMessage('ai', data.reply);
            } else {
                appendMessage('ai', 'Lo siento, no pude procesar tu mensaje. Intenta de nuevo.');
            }
        } catch (error) {
            console.error('Error al comunicarse con la IA:', error);
            if (chatMessages.contains(loadingIndicator)) {
                chatMessages.removeChild(loadingIndicator);
            }
            appendMessage('ai', 'Ocurrió un error de conexión con el servidor.');
        }
    });
});