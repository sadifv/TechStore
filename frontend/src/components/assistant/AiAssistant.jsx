import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { requestJson } from '../../services/api.js';
import GuestAssistantPreview from './GuestAssistantPreview.jsx';
import AssistantProductLink from './AssistantProductLink.jsx';
const GuidedShopping = lazy(() => import('./GuidedShopping.jsx'));

const MAX_VISIBLE_MESSAGES = 20;
const suggestions = [
  ['Quiero una laptop', 'Busco una laptop para ___ y mi presupuesto es de $___'],
  ['Busco un regalo', 'Busco un regalo para alguien a quien le gusta ___. Puedo gastar hasta $___'],
  ['Tengo un presupuesto', 'Tengo $___ para comprar ___. ¿Qué opciones hay en la tienda?'],
];

function appendMessage(current, message) {
  return [...current, message].slice(-MAX_VISIBLE_MESSAGES);
}

export default function AiAssistant({ user }) {
  const promptInput = useRef(null);
  const [mode, setMode] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [historyVisible, setHistoryVisible] = useState(
    () => typeof window === 'undefined' || !('IntersectionObserver' in window),
  );
  const sectionRef = useRef(null);
  const historyRef = useRef(null);
  const followLatestMessage = useRef(false);
  const historyChangedLocally = useRef(false);
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;
    if (!('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHistoryVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!user) {
      return undefined;
    }
    if (!historyVisible) return undefined;
    let active = true;
    requestJson('/api/ai/history')
      .then((result) => {
        if (active && !historyChangedLocally.current && Array.isArray(result.history))
          setMessages(
            result.history.slice(-MAX_VISIBLE_MESSAGES).map((item) => ({
              role: item.role === 'user' ? 'user' : 'bot',
              content: item.content,
              products: Array.isArray(item.products) ? item.products : [],
            })),
          );
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      });
    return () => {
      active = false;
    };
  }, [user, historyVisible]);
  useEffect(() => {
    if (!followLatestMessage.current || !historyRef.current) return;
    historyRef.current.scrollTop = historyRef.current.scrollHeight;
    followLatestMessage.current = false;
  }, [messages]);
  async function send(value = message) {
    const content = value.trim();
    if (!content || busy) return;
    historyChangedLocally.current = true;
    setMessage('');
    setError('');
    setAnnouncement('');
    followLatestMessage.current = true;
    setMessages((current) => appendMessage(current, { role: 'user', content }));
    setBusy(true);
    try {
      const result = await requestJson('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: content }),
      });
      followLatestMessage.current = true;
      setAnnouncement(result.reply);
      setMessages((current) =>
        appendMessage(current, {
          role: 'bot',
          content: result.reply,
          products: Array.isArray(result.products) ? result.products : [],
        }),
      );
    } catch (requestError) {
      const reply = requestError.message || 'Ocurrió un error de conexión con el servidor.';
      followLatestMessage.current = true;
      setAnnouncement(reply);
      setMessages((current) =>
        appendMessage(current, {
          role: 'bot',
          content: reply,
        }),
      );
    } finally {
      setBusy(false);
    }
  }
  async function clearHistory() {
    if (!window.confirm('¿Borrar toda la conversación?')) return;
    historyChangedLocally.current = true;
    try {
      await requestJson('/api/ai/history', { method: 'DELETE' });
      setMessages([]);
      setError('');
      setAnnouncement('Conversación eliminada.');
      promptInput.current?.focus();
    } catch (requestError) {
      setError(requestError.message);
    }
  }
  if (!user) {
    return (
      <section
        ref={sectionRef}
        id="ai-assistant"
        className="ai-section techbot-introduction"
        aria-labelledby="ai-title"
      >
        <GuestAssistantPreview />
      </section>
    );
  }
  return (
    <section ref={sectionRef} id="ai-assistant" className="ai-section" aria-labelledby="ai-title">
      <div className="ai-console">
        <header className="ai-header">
          <figure className="ai-avatar" aria-hidden="true">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 8V4H8" />
              <rect width="16" height="12" x="4" y="8" rx="2" />
              <path d="M2 14h2" />
              <path d="M20 14h2" />
              <path d="M15 13v2" />
              <path d="M9 13v2" />
            </svg>
          </figure>
          <hgroup className="ai-title-group">
            <h2 id="ai-title">Asistente TechBot</h2>
            <p>
              <span id="ai-status-text">Pregúntame sobre los productos del catálogo</span>
            </p>
          </hgroup>
          {messages.length > 0 && (
            <button
              type="button"
              id="ai-clear-chat"
              className="ai-clear-btn"
              aria-label="Limpiar conversación"
              title="Limpiar conversación"
              onClick={clearHistory}
              disabled={busy}
            >
              <i className="ri-delete-bin-line" aria-hidden="true" />
            </button>
          )}
        </header>
        <nav className="guided-shopping-modes" aria-label="Modo de TechBot">
          <button
            className="btn btn-outline"
            type="button"
            aria-pressed={mode === 'chat'}
            onClick={() => setMode('chat')}
          >
            Chat libre
          </button>
          <button
            className="btn btn-outline"
            type="button"
            aria-pressed={mode === 'guided'}
            onClick={() => setMode('guided')}
          >
            Compra guiada
          </button>
        </nav>
        {mode === 'guided' && (
          <Suspense fallback={<p role="status">Cargando compra guiada…</p>}>
            <GuidedShopping />
          </Suspense>
        )}
        {mode === 'chat' && (
          <article className="ai-widget" aria-label="Conversación con el asistente virtual">
            <p className="ai-sr-only" role="status" aria-live="polite" aria-atomic="true">
              {announcement}
            </p>
            <section id="ai-chat-messages" ref={historyRef} className="ai-history">
              {messages.length === 0 && (
                <section id="ai-empty-state" className="ai-empty" aria-label="Sugerencias iniciales">
                  <i className="ri-robot-line ai-empty-icon" aria-hidden="true" />
                  <h3>¡Hola! Soy TechBot</h3>
                  <p>Elige una pregunta y edítala antes de enviarla.</p>
                  <ul className="ai-suggestions">
                    {suggestions.map(([label, prompt]) => (
                      <li key={label}>
                        <button
                          type="button"
                          className="ai-suggestion"
                          onClick={() => {
                            setMessage(prompt);
                            promptInput.current?.focus();
                          }}
                        >
                          {label} <span aria-hidden="true">↗</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {messages.map((item, index) => (
                <article
                  className={`ai-message ${item.role === 'user' ? 'ai-message-user' : 'ai-message-bot'}`}
                  key={`${index}-${item.role}`}
                >
                  <span className="ai-message-sender">{item.role === 'user' ? 'Tú' : 'TechBot'}</span>
                  <p>{item.content}</p>
                  {item.role === 'bot' && item.products?.length > 0 && (
                    <section className="ai-mentioned-products" aria-label="Productos mencionados">
                      {item.products.map((product) => (
                        <AssistantProductLink key={product._id} product={product} />
                      ))}
                    </section>
                  )}
                </article>
              ))}
              {busy && (
                <output className="ai-typing" aria-label="TechBot está escribiendo">
                  <span />
                  <span />
                  <span />
                </output>
              )}
            </section>
            {error && (
              <output className="form-status error" role="status">
                {error}
              </output>
            )}
            <form
              id="ai-chat-form"
              className="ai-form"
              autoComplete="off"
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
            >
              <fieldset className="ai-fieldset">
                <legend className="ai-sr-only">Escribe tu consulta al asistente</legend>
                <label htmlFor="ai-chat-input" className="ai-sr-only">
                  Mensaje
                </label>
                <input
                  id="ai-chat-input"
                  ref={promptInput}
                  type="text"
                  name="message"
                  placeholder="Escribe tu consulta..."
                  required
                  maxLength="500"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  disabled={busy}
                />
                <button type="submit" className="ai-send" aria-label="Enviar mensaje" disabled={busy}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m22 2-7 20-4-9-9-4Z" />
                    <path d="M22 2 11 13" />
                  </svg>
                </button>
              </fieldset>
            </form>
          </article>
        )}
      </div>
    </section>
  );
}
