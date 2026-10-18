import { useEffect, useState } from 'react'
import { requestJson, safeReturnTo } from '../api.js'
import { defaultMembershipConfig } from '../config/membership.js'

function AccountForm({ title, description, children, onSubmit, status, statusType = 'error', buttonText, busy }) {
  return <section className="login-container container" aria-label={title}>
    <article className="login-card">
      <h1>{title}</h1>
      {description && <p className="auth-description">{description}</p>}
      <form className="auth-form" onSubmit={onSubmit}>
        {children}
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Procesando…' : buttonText}</button>
        {status && <output className={`form-status ${statusType}`} aria-live="polite">{status}</output>}
      </form>
    </article>
  </section>
}

function AuthPage({ register = false }) {
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const next = safeReturnTo(new URLSearchParams(location.search).get('next'))

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setStatus('')
    const data = Object.fromEntries(new FormData(event.currentTarget).entries())
    try {
      await requestJson(register ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      location.assign(next)
    } catch (error) {
      setStatus(error.message)
    } finally {
      setBusy(false)
    }
  }

  return <AccountForm
    title={register ? 'Crear Cuenta' : 'Iniciar Sesión'}
    description={register ? 'Regístrate para comenzar a comprar en TechStore.' : undefined}
    onSubmit={submit}
    status={status}
    buttonText={register ? 'Crear Cuenta' : 'Ingresar'}
    busy={busy}
  >
    {register && <fieldset className="form-group"><label htmlFor="auth-name">Nombre Completo</label><input id="auth-name" name="name" required minLength="2" autoComplete="name" placeholder="Tu nombre" /></fieldset>}
    <fieldset className="form-group"><label htmlFor="auth-email">Correo Electrónico</label><input id="auth-email" name="email" type="email" required autoComplete="email" placeholder="correo@ejemplo.com" /></fieldset>
    <fieldset className="form-group"><label htmlFor="auth-password">Contraseña</label><input id="auth-password" name="password" type="password" minLength="6" required autoComplete={register ? 'new-password' : 'current-password'} placeholder="••••••••" /></fieldset>
    {!register && <p className="auth-forgot-link"><a className="link-secondary" href="/forgot-password">¿Olvidaste tu contraseña?</a></p>}
    <p className="auth-redirect">{register ? '¿Ya tienes una cuenta?' : '¿No tienes una cuenta?'} <a href={register ? `/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}` : `/register${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}>{register ? 'Inicia sesión aquí' : 'Regístrate aquí'}</a></p>
  </AccountForm>
}

export function LoginPage() { return <AuthPage /> }
export function RegisterPage() { return <AuthPage register /> }

export function ForgotPasswordPage() {
  const [status, setStatus] = useState('')
  const [statusType, setStatusType] = useState('success')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setStatus('')
    const form = event.currentTarget
    try {
      const email = new FormData(form).get('email')
      const result = await requestJson('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) })
      setStatusType('success')
      setStatus(result.message)
      form.reset()
    } catch (error) {
      setStatusType('error')
      setStatus(error.message)
    } finally { setBusy(false) }
  }
  return <AccountForm title="Recuperar Contraseña" description="Ingresa tu correo electrónico y te enviaremos un enlace para restablecerla." onSubmit={submit} status={status} statusType={statusType} buttonText="Enviar instrucciones" busy={busy}>
    <fieldset className="form-group"><label htmlFor="forgot-email">Correo Electrónico</label><input id="forgot-email" type="email" name="email" required autoComplete="email" placeholder="correo@ejemplo.com" /></fieldset>
    <p className="auth-redirect"><a href="/login">← Volver al inicio de sesión</a></p>
  </AccountForm>
}

export function ResetPasswordPage({ token }) {
  const [status, setStatus] = useState('')
  const [statusType, setStatusType] = useState('error')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault()
    const data = Object.fromEntries(new FormData(event.currentTarget).entries())
    if (data.password !== data.confirmPassword) {
      setStatus('Las contraseñas no coinciden.')
      return
    }
    setBusy(true)
    setStatus('')
    try {
      const result = await requestJson(`/api/auth/reset-password/${encodeURIComponent(token)}`, { method: 'POST', body: JSON.stringify({ password: data.password }) })
      setStatusType('success')
      setStatus(result.message)
      setTimeout(() => location.assign('/login'), 1800)
    } catch (error) {
      setStatusType('error')
      setStatus(error.message)
    } finally { setBusy(false) }
  }
  return <AccountForm title="Nueva Contraseña" description="Ingresa y confirma tu nueva contraseña." onSubmit={submit} status={status} statusType={statusType} buttonText="Guardar Contraseña" busy={busy}>
    <fieldset className="form-group"><label htmlFor="new-password">Nueva Contraseña</label><input id="new-password" type="password" name="password" required minLength="6" autoComplete="new-password" /></fieldset>
    <fieldset className="form-group"><label htmlFor="confirm-password">Confirmar Contraseña</label><input id="confirm-password" type="password" name="confirmPassword" required minLength="6" autoComplete="new-password" /></fieldset>
  </AccountForm>
}

function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(2)}`
}

function MembershipSummary({ membership }) {
  if (!membership) return <p className="membership-status">Aún no tienes una membresía activa.</p>
  const endDate = membership.currentPeriodEnd ? new Date(membership.currentPeriodEnd).toLocaleDateString('es-EC') : null
  const label = membership.status === 'active'
    ? `Activa hasta el ${endDate || 'fin del período'}.${membership.cancelAtPeriodEnd ? ' La cancelación ya está programada.' : ''}`
    : membership.status === 'pending' ? 'Tu pago está pendiente de confirmación.'
      : membership.status === 'past_due' ? 'Hay un pago pendiente en tu membresía.' : 'Tu membresía no está activa.'
  return <><p className="membership-status">{label}</p><div className="membership-coupons">{membership.welcomeCouponCode && <p>Cupón de bienvenida: <strong>{membership.welcomeCouponCode}</strong></p>}{membership.monthlyCouponCode && <p>Cupón VIP mensual: <strong>{membership.monthlyCouponCode}</strong></p>}</div></>
}

export function ProfilePage({ user }) {
  const [orders, setOrders] = useState(null)
  const [membership, setMembership] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    Promise.allSettled([requestJson('/api/orders'), requestJson('/api/membership')])
      .then(([orderResult, membershipResult]) => {
        if (!active) return
        if (orderResult.status === 'fulfilled') setOrders(orderResult.value.orders || [])
        else setError(orderResult.reason.message)
        if (membershipResult.status === 'fulfilled') setMembership(membershipResult.value.membership)
        else setError((current) => current ? `${current} ${membershipResult.reason.message}` : membershipResult.reason.message)
      })
    return () => { active = false }
  }, [])
  return <section className="container profile-container" aria-labelledby="profile-heading">
    <section className="profile-card"><figure className="profile-avatar"><i className="ri-user-3-line" aria-hidden="true" /></figure><article className="profile-details"><h1 id="profile-heading">Mi Cuenta</h1><p><strong>Nombre:</strong> {user?.name || 'Usuario'}</p><p><strong>Correo:</strong> {user?.email || '—'}</p></article></section>
    <section className="membership-card profile-membership-card" aria-labelledby="profile-membership-heading"><h2 id="profile-membership-heading">Membresía VIP</h2><MembershipSummary membership={membership} />{error && <p className="form-status error" role="status">{error}</p>}<a href="/vip" className="btn btn-outline">Ver planes y beneficios</a></section>
    <section className="orders-section"><h2>Historial de Compras</h2>{orders === null && !error && <p className="orders-status">Cargando tus pedidos…</p>}{error && <p className="orders-status error" role="status">{error}</p>}{orders?.length === 0 && <p className="empty-msg">Aún no has realizado ninguna compra.</p>}
      <div className="orders-list">{orders?.map((order) => {
        const total = order.totalAmount ?? order.total ?? (order.items || []).reduce((sum, item) => sum + Number(item.price ?? item.product?.price ?? 0) * Number(item.quantity || 1), 0)
        return <article className="order-card" key={order._id}><header className="order-header"><hgroup><strong className="order-id">Orden #{String(order._id).slice(0, 8)}</strong><time className="order-date" dateTime={order.createdAt}>{new Date(order.createdAt).toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' })}</time></hgroup><span className={`order-status status-${order.status || 'completed'}`}>{order.status === 'pending' ? 'Pendiente' : order.paymentStatus === 'paid' ? 'Pagado' : order.status || 'Procesado'}</span></header><ul className="order-body">{(order.items || []).map((item, index) => <li className="order-item" key={`${item.product?._id || item.product || index}-${index}`}><span>{item.product?.name || item.name || 'Producto'} (×{item.quantity || 1})</span><span>{formatCurrency(Number(item.price ?? item.product?.price ?? 0) * Number(item.quantity || 1))}</span></li>)}</ul><footer className="order-footer"><span>Método: <strong>{order.paymentMethod || 'Tarjeta'}</strong></span><span className="order-total">Total: <strong>{formatCurrency(total)}</strong></span></footer></article>
      })}</div>
    </section>
  </section>
}

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

export function LegalPage() {
  return <article className="legal-container" aria-labelledby="legal-heading"><h1 id="legal-heading">Información Legal</h1>
    <section id="privacidad"><h2>Política de Privacidad</h2><p>Última actualización: Octubre 2026</p><p>En TechStore, valoramos tu privacidad. Esta política describe cómo recopilamos, usamos y protegemos tu información personal.</p><h3>Información que recopilamos</h3><ul><li>Nombre y correo electrónico al registrarte</li><li>Dirección de envío para procesar pedidos</li><li>Historial de compras y preferencias</li><li>Preferencias de membresía y consentimiento para comunicaciones promocionales</li></ul><h3>Cómo usamos tu información</h3><ul><li>Procesar y enviar tus pedidos</li><li>Enviar confirmaciones y actualizaciones por correo</li><li>Enviar campañas promocionales solo a quienes aceptaron recibirlas</li><li>Mejorar nuestros productos y servicios</li></ul><p>Puedes darte de baja de campañas desde el enlace incluido en cada correo. La baja no afecta los mensajes transaccionales de tus pedidos ni el estado de una membresía activa.</p><h3>Protección de datos</h3><p>Implementamos medidas de seguridad para proteger tu información personal contra acceso no autorizado, alteración o destrucción.</p></section>
    <section id="terminos"><h2>Términos y Condiciones</h2><p>Última actualización: Octubre 2026</p><h3>Uso del servicio</h3><p>Al usar TechStore, aceptas estos términos. Debes tener al menos 18 años para realizar compras.</p><h3>Productos y precios</h3><p>Nos esforzamos por mostrar información precisa, pero pueden existir errores. Nos reservamos el derecho de corregir precios y descripciones.</p><h3>Membresía VIP y cupones</h3><p>El precio y las condiciones de los cupones se muestran en <a href="/vip">la página de membresía</a> y pueden cambiar para nuevas altas. Cuando se ofrece con Stripe, la membresía se factura mensualmente con renovación automática hasta que la canceles; conserva el acceso hasta terminar el período pagado. Puedes cancelar desde tu cuenta y administrar tu método de pago en el portal de Stripe. Los cupones están sujetos a su compra mínima, tope, vencimiento y límite de usos; se validan al momento del checkout. La baja de comunicaciones promocionales no cancela la membresía.</p><p>La modalidad simulada solo existe en desarrollo, no solicita tarjeta ni genera cobros, y no se renueva automáticamente. No se activarán altas simuladas en producción.</p><h3>Envíos y entregas</h3><p>Los tiempos de entrega son estimados y pueden variar según la ubicación y disponibilidad del producto.</p><h3>Devoluciones</h3><p>Aceptamos devoluciones dentro de los 14 días posteriores a la entrega, siempre que el producto esté en su estado original.</p></section>
    <section id="cookies"><h2>Política de Cookies</h2><p>Última actualización: Octubre 2026</p><p>Utilizamos cookies para mejorar tu experiencia de navegación y analizar el tráfico del sitio.</p><h3>Tipos de cookies que usamos</h3><ul><li><strong>Cookies esenciales:</strong> Necesarias para el funcionamiento del sitio (sesiones, carrito)</li><li><strong>Cookies de análisis:</strong> Nos ayudan a entender cómo usas el sitio</li></ul><h3>Gestión de cookies</h3><p>Puedes configurar tu navegador para rechazar cookies, pero algunas funciones del sitio pueden no funcionar correctamente.</p></section>
  </article>
}
