import { useEffect, useRef, useState } from 'react'
import { requestJson } from '../api.js'

export default function AiAssistant({ user }) {
  const [messages, setMessages] = useState([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const historyRef = useRef(null)
  useEffect(() => {
    let active = true
    if (user) requestJson('/api/ai/history').then((result) => { if (active && Array.isArray(result.history)) setMessages(result.history.map((item) => ({ role: item.role === 'user' ? 'user' : 'bot', content: item.content }))) }).catch((requestError) => { if (active) setError(requestError.message) })
    else setMessages([])
    return () => { active = false }
  }, [user])
  useEffect(() => { if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight }, [messages, busy])
  async function send(value = message) {
    const content = value.trim()
    if (!content || busy) return
    setMessage(''); setError(''); setMessages((current) => [...current, { role: 'user', content }]); setBusy(true)
    try { const result = await requestJson('/api/ai/chat', { method: 'POST', body: JSON.stringify({ message: content }) }); setMessages((current) => [...current, { role: 'bot', content: result.reply }]) }
    catch (requestError) { setMessages((current) => [...current, { role: 'bot', content: requestError.message || 'Ocurrió un error de conexión con el servidor.' }]) }
    finally { setBusy(false) }
  }
  async function clearHistory() {
    if (!window.confirm('¿Borrar toda la conversación?')) return
    try { await requestJson('/api/ai/history', { method: 'DELETE' }); setMessages([]); setError('') }
    catch (requestError) { setError(requestError.message) }
  }
  return <section id="ai-assistant" className="ai-section" aria-labelledby="ai-title"><header className="ai-header"><figure className="ai-avatar" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg></figure><hgroup className="ai-title-group"><h2 id="ai-title">Asistente TechBot</h2><p><span className="ai-status" aria-hidden="true"/><span id="ai-status-text">En línea · Pregúntame sobre cualquier producto</span></p></hgroup>{user && <button type="button" id="ai-clear-chat" className="ai-clear-btn" aria-label="Limpiar conversación" title="Limpiar conversación" onClick={clearHistory}><i className="ri-delete-bin-line" aria-hidden="true"/></button>}</header>
    <article className="ai-widget" aria-label="Conversación con el asistente virtual">{!user ? <section className="ai-login-required" aria-label="Inicia sesión para usar el asistente"><p className="ai-login-emoji" aria-hidden="true">🔒</p><h3>Inicia sesión para hablar con TechBot</h3><p>Nuestro asistente virtual está disponible solo para usuarios registrados. Es rápido y gratis.</p><nav className="ai-login-actions" aria-label="Acciones de autenticación"><a href="/login" className="btn btn-primary">Iniciar sesión</a><a href="/register" className="btn btn-secondary">Crear cuenta</a></nav></section> : <><section id="ai-chat-messages" ref={historyRef} className="ai-history" aria-live="polite" aria-atomic="false">{messages.length === 0 && <section id="ai-empty-state" className="ai-empty" aria-label="Sugerencias iniciales"><p className="ai-empty-emoji" aria-hidden="true">👋</p><h3>¡Hola! Soy TechBot</h3><p>Estoy aquí para ayudarte a encontrar el producto perfecto. Prueba con una de estas preguntas:</p><ul className="ai-suggestions"><li><button type="button" className="ai-suggestion" onClick={() => send('¿Qué laptops tienes disponibles?')}>💻 ¿Qué laptops tienes disponibles?</button></li><li><button type="button" className="ai-suggestion" onClick={() => send('Busco unos auriculares con cancelación de ruido')}>🎧 Busco auriculares con cancelación de ruido</button></li><li><button type="button" className="ai-suggestion" onClick={() => send('¿Cuál es el mejor smartphone calidad-precio?')}>📱 Mejor smartphone calidad-precio</button></li></ul></section>}{messages.map((item, index) => <article className={`ai-message ${item.role === 'user' ? 'ai-message-user' : 'ai-message-bot'}`} key={`${index}-${item.role}`}><span className="ai-message-sender">{item.role === 'user' ? 'Tú' : 'TechBot'}</span><p>{item.content}</p></article>)}{busy && <output className="ai-typing" aria-label="TechBot está escribiendo"><span/><span/><span/></output>}</section>{error && <output className="form-status error" role="status">{error}</output>}<form id="ai-chat-form" className="ai-form" autoComplete="off" onSubmit={(event) => { event.preventDefault(); send() }}><fieldset className="ai-fieldset"><legend className="ai-sr-only">Escribe tu consulta al asistente</legend><label htmlFor="ai-chat-input" className="ai-sr-only">Mensaje</label><input id="ai-chat-input" type="text" name="message" placeholder="Escribe tu consulta..." required maxLength="500" value={message} onChange={(event) => setMessage(event.target.value)} disabled={busy}/><button type="submit" className="ai-send" aria-label="Enviar mensaje" disabled={busy}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg></button></fieldset></form></>}</article>
  </section>
}
