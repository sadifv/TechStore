import { useEffect, useState } from 'react'
import { requestJson } from '../../api.js'
import { defaultMembershipConfig } from '../../config/membership.js'
import { MembershipSummary } from './ProfilePage.jsx'
import { formatCurrency } from './utils.js'

export function MembershipPage({ user }) {
  const [config, setConfig] = useState(defaultMembershipConfig)
  const [membership, setMembership] = useState(null)
  const [paymentMode, setPaymentMode] = useState('unavailable')
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!user) return undefined
    let active = true
    const params = new URLSearchParams(location.search)
    const sessionId = params.get('session_id')
    const confirm = params.get('membership') === 'processing' && sessionId
      ? requestJson(`/api/membership/confirm?session_id=${encodeURIComponent(sessionId)}`)
      : Promise.resolve(null)
    confirm.then(() => requestJson('/api/membership')).then((result) => {
      if (!active) return
      setConfig((current) => ({ ...current, ...result }))
      setMembership(result.membership)
      setPaymentMode(result.paymentMode || 'unavailable')
    }).catch((error) => { if (active) setStatus(error.message) })
    return () => { active = false }
  }, [user])

  async function subscribe(event) {
    event.preventDefault()
    setBusy(true)
    setStatus('Conectando con el servicio de pago…')
    try {
      const result = await requestJson('/api/membership/checkout', { method: 'POST', body: JSON.stringify({ marketingOptIn }) })
      location.assign(result.checkoutUrl)
    } catch (error) { setStatus(error.message); setBusy(false) }
  }
  async function cancel() {
    setBusy(true)
    try {
      const result = await requestJson('/api/membership/cancel', { method: 'POST' })
      setMembership(result.membership)
      setStatus(result.message)
    } catch (error) { setStatus(error.message) } finally { setBusy(false) }
  }
  async function openPortal() {
    setBusy(true)
    try {
      const result = await requestJson('/api/membership/portal', { method: 'POST' })
      location.assign(result.url)
    } catch (error) { setStatus(error.message); setBusy(false) }
  }

  return <section className="container membership-page" aria-labelledby="membership-heading">
    <header className="membership-hero"><span className="membership-eyebrow">TECHSTORE VIP</span><h1 id="membership-heading">Más beneficios para tus compras de tecnología</h1><p>Accede a cupones VIP y recibe avisos anticipados de campañas y lanzamientos.</p><p className="membership-price"><strong>{formatCurrency(config.monthlyPrice)}</strong><span> / mes</span></p><p className="membership-payment-note">La suscripción se renueva automáticamente cada mes. Puedes cancelarla cuando quieras y conservarás el acceso hasta el final del período pagado.</p></header>
    <section className="membership-benefits" aria-label="Beneficios incluidos"><article className="membership-card"><i className="ri-coupon-3-line" aria-hidden="true"/><h2>Cupón de bienvenida</h2><p>{config.welcomeDiscountPercent}% de descuento, hasta {formatCurrency(config.welcomeMaxDiscount)}, en compras desde {formatCurrency(config.couponMinOrder)}. Un uso.</p></article><article className="membership-card"><i className="ri-calendar-check-line" aria-hidden="true"/><h2>Cupón VIP mensual</h2><p>{config.monthlyDiscountPercent}% de descuento, hasta {formatCurrency(config.monthlyMaxDiscount)}, en compras desde {formatCurrency(config.couponMinOrder)}. Un uso durante cada período VIP pagado.</p></article><article className="membership-card"><i className="ri-notification-3-line" aria-hidden="true"/><h2>Avisos anticipados</h2><p>Recibe antes que el público las campañas y lanzamientos que el equipo marque como VIP.</p></article></section>
    <article className="membership-card membership-account-card"><h2>Tu membresía</h2>{user ? <><MembershipSummary membership={membership}/>{status && <p className="membership-status error" role="status">{status}</p>}{membership?.status === 'active' || membership?.status === 'past_due' ? <><button type="button" className="btn btn-secondary" disabled={busy || membership.cancelAtPeriodEnd} onClick={cancel}>Cancelar al final del período</button>{membership.provider === 'stripe' && <button type="button" className="btn btn-secondary" disabled={busy} onClick={openPortal}>Administrar método de pago</button>}</> : paymentMode === 'mock' || paymentMode === 'stripe' ? <form className="membership-form" onSubmit={subscribe}><label className="membership-consent"><input type="checkbox" checked={marketingOptIn} onChange={(event) => setMarketingOptIn(event.target.checked)}/>Quiero recibir campañas y avisos VIP por correo. Puedo darme de baja cuando quiera.</label><button type="submit" className="btn btn-primary" disabled={busy}>{paymentMode === 'stripe' ? 'Suscribirme con Stripe' : 'Activar membresía de prueba'}</button><p className="membership-payment-note">{paymentMode === 'stripe' ? 'El primer pago y las renovaciones mensuales se procesan con Stripe.' : 'La simulación solo está disponible en desarrollo y no genera cobros.'}</p></form> : <p className="membership-unavailable" role="status">El pago de membresías no está disponible por ahora.</p>}</> : <><p>Inicia sesión para suscribirte y consultar tus cupones.</p><a href="/login?next=%2Fvip" className="btn btn-primary">Iniciar sesión</a></>}{!user && status && <p className="membership-status error" role="status">{status}</p>}</article>
  </section>
}

export function MockMembershipCheckoutPage() {
  const token = new URLSearchParams(location.search).get('token') || ''
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  async function confirm(event) {
    event.preventDefault()
    setBusy(true)
    try {
      await requestJson('/api/membership/mock-confirm', { method: 'POST', body: JSON.stringify({ token }) })
      location.assign('/profile?membership=active')
    } catch (error) { setStatus(error.message); setBusy(false) }
  }
  return <section className="login-container container"><article className="login-card"><h1>Pago de prueba</h1><p>Esta simulación no solicita datos de tarjeta ni genera ningún cobro.</p><form className="auth-form" onSubmit={confirm}><button className="btn btn-primary" type="submit" disabled={busy || !token}>{busy ? 'Activando…' : 'Confirmar activación'}</button>{status && <output className="form-status error" role="status">{status}</output>}</form><a href="/vip">Volver a membresía VIP</a></article></section>
}
