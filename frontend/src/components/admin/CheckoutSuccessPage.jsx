import { useEffect, useRef } from 'react'
import { useCart } from '../CartContext.js'
import { money, useAdminData } from './shared.jsx'

export function CheckoutSuccessPage() {
  const orderId = new URLSearchParams(location.search).get('orderId')
  const { data, error } = useAdminData(`/api/orders/success?orderId=${encodeURIComponent(orderId || '')}`)
  const { reconcileGuestItems } = useCart()
  const reconciled = useRef(false)
  useEffect(() => {
    if (data?.guestOrder && !reconciled.current) {
      reconciled.current = true
      reconcileGuestItems(data.items)
    }
  }, [data, reconcileGuestItems])
  if (!orderId) return <section className="products-section"><h1>No se encontró el pedido</h1><a className="btn btn-primary" href="/catalogo">Volver al catálogo</a></section>
  if (error) return <section className="products-section"><p className="form-status error" role="alert">{error}</p><a href="/catalogo">Volver al catálogo</a></section>
  if (!data) return <section className="products-section"><p role="status">Verificando tu pago…</p></section>
  return <section className="checkout-success-container" aria-labelledby="checkout-success-heading"><article className="success-card"><header><i className="ri-checkbox-circle-line checkout-success-icon" aria-hidden="true"/><h1 id="checkout-success-heading">¡Gracias por tu compra!</h1></header><section className="order-details"><p>Tu pedido con ID <strong>{data._id}</strong> ha sido procesado correctamente.</p><p>Total pagado: <strong>{money(data.totalAmount)}</strong></p>{Number(data.discountAmount) > 0 && <p>Cupón <strong>{data.couponCode}</strong>: descuento de <strong>{money(data.discountAmount)}</strong></p>}<p>Hemos actualizado nuestro inventario y pronto prepararemos tu paquete.</p></section><footer><a href="/catalogo" className="btn btn-primary">Volver al Catálogo</a></footer></article></section>
}
