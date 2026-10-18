import { useState } from 'react'
import { requestJson } from '../api.js'

export function NewsletterSection() {
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  async function subscribe(event) {
    event.preventDefault(); setBusy(true); setStatus('')
    const target = event.currentTarget
    const form = new FormData(target)
    try { const result = await requestJson('/api/newsletter', { method: 'POST', body: JSON.stringify({ email: form.get('email'), consent: form.get('consent') === 'true' }) }); setStatus(result.message || '¡Suscripción exitosa al boletín!'); target.reset() }
    catch (error) { setStatus(error.message) } finally { setBusy(false) }
  }
  return <section className="newsletter-section"><article className="newsletter-container"><figure className="newsletter-media"><img src="/images/newsletter-tech.svg" alt="Dispositivos tecnológicos y un sobre para recibir novedades" className="newsletter-img"/></figure><header className="newsletter-content"><h2>Suscríbete a nuestras ofertas</h2><p>Suscripción gratuita a novedades y campañas generales. La membresía VIP de pago es independiente.</p><form id="newsletter-form" onSubmit={subscribe} className="newsletter-form"><p className="form-field"><input type="email" id="newsletter-email" name="email" placeholder="Ingresa tu correo electrónico" required/></p><label className="newsletter-consent"><input type="checkbox" id="newsletter-consent" name="consent" value="true" required/>Acepto recibir el boletín por correo. Puedo darme de baja cuando quiera.</label><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Enviando…' : 'Suscribirme'}</button></form>{status && <output id="newsletter-status" className={`form-status ${status.startsWith('¡') ? 'success' : 'error'}`} htmlFor="newsletter-form" role="status">{status}</output>}</header></article></section>
}

export function ContactSection() {
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  async function sendContact(event) {
    event.preventDefault(); setBusy(true); setStatus('')
    const target = event.currentTarget
    const form = new FormData(target)
    try { await requestJson('/api/contact', { method: 'POST', body: JSON.stringify({ name: form.get('name'), email: form.get('email'), message: form.get('message') }) }); setStatus('¡Mensaje enviado con éxito!'); target.reset() }
    catch (error) { setStatus(error.message) } finally { setBusy(false) }
  }
  return <section id="contacto" className="contact-section" aria-labelledby="contact-title"><header className="contact-header"><h2 id="contact-title">Contáctanos</h2><p>¿Tienes alguna pregunta? Estamos aquí para ayudarte</p></header><div className="contact-grid"><aside className="contact-info" aria-label="Información de contacto"><ul className="contact-info-list"><li className="contact-info-item"><i className="ri-mail-line" aria-hidden="true"/><div><h3>Email</h3><a href="mailto:sadiflores20201@gmail.com">sadiflores20201@gmail.com</a></div></li><li className="contact-info-item"><i className="ri-phone-line" aria-hidden="true"/><div><h3>Teléfono</h3><a href="tel:+593963976623">+593 0963976623</a></div></li><li className="contact-info-item"><i className="ri-map-pin-line" aria-hidden="true"/><div><h3>Dirección</h3><address>Villa España<br/>Guayaquil, Ecuador</address></div></li><li className="contact-info-item"><i className="ri-time-line" aria-hidden="true"/><div><h3>Horario</h3><p>Lunes a Viernes<br/>9:00 - 16:00</p></div></li></ul><nav className="contact-socials" aria-label="Redes sociales"><a href="https://instagram.com/tu_usuario" target="_blank" rel="noreferrer" aria-label="Instagram"><i className="ri-instagram-line" aria-hidden="true"/></a><a href="https://wa.me/593963976623" target="_blank" rel="noreferrer" aria-label="WhatsApp"><i className="ri-whatsapp-line" aria-hidden="true"/></a></nav></aside>
    <form id="contact-form" className="contact-form" onSubmit={sendContact}><fieldset className="form-field"><legend className="sr-only">Nombre</legend><label htmlFor="contact-name">Nombre</label><input type="text" id="contact-name" name="name" placeholder="Tu nombre completo" required minLength="2" maxLength="80" autoComplete="name"/></fieldset><fieldset className="form-field"><legend className="sr-only">Email</legend><label htmlFor="contact-email">Email</label><input type="email" id="contact-email" name="email" placeholder="tu@email.com" required autoComplete="email"/></fieldset><fieldset className="form-field"><legend className="sr-only">Mensaje</legend><label htmlFor="contact-message">Mensaje</label><textarea id="contact-message" name="message" rows="5" placeholder="¿En qué te podemos ayudar?" required minLength="10" maxLength="1000"/></fieldset><button type="submit" className="btn btn-primary btn-block" disabled={busy}><i className="ri-send-plane-line" aria-hidden="true"/>{busy ? 'Enviando…' : 'Enviar mensaje'}</button>{status && <output id="contact-status" className={`form-status ${status.startsWith('¡') ? 'success' : 'error'}`} htmlFor="contact-form" aria-live="polite">{status}</output>}</form></div></section>
}
