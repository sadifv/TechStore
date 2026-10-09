// public/js/ai-assistant.js
document.addEventListener('DOMContentLoaded', () => {
  const chatForm = document.querySelector('#ai-chat-form');
  const chatInput = document.querySelector('#ai-chat-input');
  const chatMessages = document.querySelector('#ai-chat-messages');
  const emptyState = document.querySelector('#ai-empty-state');
  const clearBtn = document.querySelector('#ai-clear-chat');
  const sendBtn = chatForm?.querySelector('.ai-send');

  // Si no existe el chat, es porque el usuario NO está logueado.
  // No hay nada que hacer, el HTML ya muestra el bloque de login.
  if (!chatForm || !chatInput || !chatMessages) return;

  // ==========================================
  // FUNCIONES AUXILIARES
  // ==========================================

  /**
   * Crea y añade un mensaje al historial usando SOLO DOM APIs.
   * @param {'user'|'bot'} sender
   * @param {string} text
   */
  function appendMessage(sender, text) {
    const article = document.createElement('article');
    article.classList.add('ai-message');
    article.classList.add(sender === 'user' ? 'ai-message-user' : 'ai-message-bot');

    const senderLabel = document.createElement('span');
    senderLabel.classList.add('ai-message-sender');
    senderLabel.textContent = sender === 'user' ? 'Tú' : 'TechBot';

    const paragraph = document.createElement('p');
    paragraph.textContent = text;

    article.appendChild(senderLabel);
    article.appendChild(paragraph);
    chatMessages.appendChild(article);

    requestAnimationFrame(() => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }

  /**
   * Muestra el indicador de "escribiendo...".
   */
  function showTyping() {
    const typing = document.createElement('output');
    typing.classList.add('ai-typing');
    typing.id = 'ai-typing-indicator';
    typing.setAttribute('aria-label', 'TechBot está escribiendo');

    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('span');
      dot.setAttribute('aria-hidden', 'true');
      typing.appendChild(dot);
    }

    chatMessages.appendChild(typing);
    requestAnimationFrame(() => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }

  /**
   * Elimina el indicador de "escribiendo...".
   */
  function hideTyping() {
    const typing = document.querySelector('#ai-typing-indicator');
    if (typing && typing.parentNode) {
      typing.parentNode.removeChild(typing);
    }
  }

  /**
   * Envía un mensaje al backend.
   */
  async function sendMessage(message) {
    const trimmed = message.trim();
    if (!trimmed) return;

    // Ocultar estado vacío en el primer mensaje
    if (emptyState && !emptyState.hidden) {
      emptyState.hidden = true;
    }

    appendMessage('user', trimmed);
    chatInput.value = '';

    if (sendBtn) sendBtn.disabled = true;
    showTyping();

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed })
      });

      const data = await response.json();
      hideTyping();

      if (data.success) {
        appendMessage('bot', data.reply);
      } else {
        appendMessage('bot', data.error || 'Lo siento, no pude procesar tu mensaje. Intenta de nuevo.');
      }
    } catch (error) {
      logger.error('Error al comunicarse con la IA:', error);
      hideTyping();
      appendMessage('bot', 'Ocurrió un error de conexión con el servidor.');
    } finally {
      if (sendBtn) sendBtn.disabled = false;
      chatInput.focus();
    }
  }

  /**
   * Carga el historial previo desde el servidor.
   */
  async function loadHistory() {
    try {
      const response = await fetch('/api/ai/history');
      const data = await response.json();

      if (data.success && Array.isArray(data.history) && data.history.length > 0) {
        if (emptyState) emptyState.hidden = true;

        data.history.forEach(msg => {
          appendMessage(msg.role === 'user' ? 'user' : 'bot', msg.content);
        });
      }
    } catch (error) {
      logger.error('Error al cargar historial:', error);
    }
  }

  // ==========================================
  // EVENT LISTENERS
  // ==========================================

  // Submit del formulario
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage(chatInput.value);
  });

  // Chips de sugerencia (delegación de eventos)
  chatMessages.addEventListener('click', (e) => {
    const btn = e.target.closest('.ai-suggestion');
    if (!btn) return;
    const message = btn.getAttribute('data-message');
    if (message) sendMessage(message);
  });

  // Botón de limpiar historial
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      if (!confirm('¿Borrar toda la conversación?')) return;

      try {
        const response = await fetch('/api/ai/history', { method: 'DELETE' });
        const data = await response.json();

        if (data.success) {
          // Limpiar el historial del DOM
          chatMessages.replaceChildren();

          // Volver a insertar el estado vacío
          if (emptyState) {
            emptyState.hidden = false;
            chatMessages.appendChild(emptyState);
          }

          chatInput.focus();
        }
      } catch (error) {
        logger.error('Error al limpiar historial:', error);
      }
    });
  }

  // ==========================================
  // INICIALIZACIÓN
  // ==========================================

  loadHistory();
  chatInput.focus();
});