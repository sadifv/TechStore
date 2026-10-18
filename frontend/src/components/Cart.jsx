import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { backendAssetUrl, requestJson } from '../api.js'
import { CartContext } from './CartContext.js'
import { readGuestCart, removeGuestQuantity, saveGuestCart, syncGuestCartToUser } from '../guestCart.js'

const placeholder = '/images/products/product-placeholder.svg'

export function CartProvider({ user, children }) {
  const [items, setItems] = useState([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)
  const checkoutDialog = useRef(null)
  const notify = useCallback((message, type = 'info') => {
    setToast({ message, type })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }, [])

  const refresh = useCallback(async () => {
    if (!user) {
      const savedItems = readGuestCart()
      const normalizedItems = await Promise.all(savedItems.map(async (item) => {
        const id = String(item.id || item.productId || item._id || '')
        let product = null
        if ((!item.name || item.name === 'Producto') && /^[a-f\d]{24}$/i.test(id)) {
          try { product = (await requestJson(`/api/products/${encodeURIComponent(id)}`)).data } catch { /* Keep unavailable items removable from the cart. */ }
        }
        return {
          id,
          name: product?.name || item.name || 'Producto no disponible',
          price: Number(product?.price ?? item.price) || 0,
          image: product?.image || item.image || placeholder,
          quantity: Number(item.quantity) || 1,
          availableStock: product?.availableStock ?? item.availableStock,
          unavailable: !product && (!item.name || item.name === 'Producto')
        }
      }))
      setItems(normalizedItems)
      return true
    }
    try {
      const result = await requestJson('/api/cart')
      setItems((result.items || []).map((item) => {
        const product = item.product || {}
        return { id: String(item.productId || product._id || item.product || item._id), cartItemId: String(item._id || ''), name: product.name || 'Producto no disponible', price: Number(product.price) || 0, image: product.image || placeholder, quantity: Number(item.quantity) || 1, availableStock: product.availableStock ?? product.stock, unavailable: !item.product }
      }))
      return true
    } catch (error) { if (error.status !== 401) console.error('No se pudo cargar el carrito:', error); return false }
  }, [user])

  useEffect(() => {
    let active = true
    async function loadAndSync() {
      if (!user) { await refresh(); return }
      try {
        const result = await syncGuestCartToUser()
        if (result.failedCount > 0) notify(`No se sincronizaron ${result.failedCount} producto(s) del carrito.`, 'warning')
      } catch (error) { console.error('No se pudo sincronizar el carrito local:', error) }
      if (active) await refresh()
    }
    loadAndSync()
    return () => { active = false }
  }, [refresh, user, notify])
  useEffect(() => {
    const dialog = checkoutDialog.current
    if (!dialog) return
    if (checkoutOpen && !dialog.open) dialog.showModal()
    if (!checkoutOpen && dialog.open) dialog.close()
  }, [checkoutOpen])
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const add = useCallback(async (product, quantity = 1) => {
    const id = String(product._id || product.id)
    if (!id || !Number.isInteger(Number(quantity)) || Number(quantity) < 1) return false
    if (user) {
      await requestJson('/api/cart/add', { method: 'POST', body: JSON.stringify({ productId: id, quantity: Number(quantity) }) })
      await refresh()
    } else {
      let cart = readGuestCart()
      const index = cart.findIndex((item) => String(item.id || item.productId || item._id) === id)
      const existing = index >= 0 ? Number(cart[index].quantity) || 0 : 0
      const stock = Number(product.availableStock ?? product.stock ?? cart[index]?.availableStock)
      if (Number.isInteger(stock) && existing + Number(quantity) > Math.min(stock, 99)) throw new Error(`Solo hay ${Math.max(0, stock - existing)} unidades disponibles.`)
      if (index >= 0) cart[index].quantity = existing + Number(quantity)
      else cart.push({ id, name: product.name, price: Number(product.price) || 0, image: product.image || placeholder, quantity: Number(quantity), availableStock: stock })
      saveGuestCart(cart); await refresh()
    }
    return true
  }, [refresh, user])

  const remove = useCallback(async (id, cartItemId) => {
    if (user) {
      const removedItem = items.find((item) => cartItemId ? item.cartItemId === String(cartItemId) : item.id === String(id))
      setItems((current) => current.filter((item) => cartItemId ? item.cartItemId !== String(cartItemId) : item.id !== String(id)))
      try {
        const endpoint = cartItemId ? `/api/cart/item/${encodeURIComponent(cartItemId)}` : `/api/cart/remove/${encodeURIComponent(id)}`
        await requestJson(endpoint, { method: 'DELETE' })
        await refresh()
      } catch (error) {
        const refreshed = await refresh()
        if (!refreshed && removedItem) setItems((current) => current.some((item) => item.cartItemId === removedItem.cartItemId) ? current : [...current, removedItem])
        notify(error.message, 'error')
      }
      return
    }
    const remaining = readGuestCart().filter((item) => String(item.id || item.productId || item._id) !== String(id))
    saveGuestCart(remaining)
    setItems((current) => current.filter((item) => item.id !== String(id)))
  }, [items, refresh, user, notify])

  const setQuantity = useCallback(async (item, quantity) => {
    if (quantity < 1) return remove(item.id, item.cartItemId)
    if (user) await requestJson(`/api/cart/quantity/${encodeURIComponent(item.id)}`, { method: 'PATCH', body: JSON.stringify({ quantity }) })
    else {
      const cart = readGuestCart().map((entry) => String(entry.id || entry.productId || entry._id) === item.id ? { ...entry, quantity } : entry)
      saveGuestCart(cart)
    }
    await refresh()
  }, [refresh, user, remove])

  const reconcileGuestItems = useCallback(async (purchasedItems) => {
    if (user || !Array.isArray(purchasedItems)) return
    purchasedItems.forEach((item) => {
      if (item?.productId && Number.isInteger(item.quantity) && item.quantity > 0) removeGuestQuantity(String(item.productId), item.quantity)
    })
    await refresh()
  }, [refresh, user])

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const checkout = async (event) => {
    event.preventDefault(); setBusy(true); setStatus('')
    const form = new FormData(event.currentTarget)
    const payload = { paymentMethod: 'card', couponCode: String(form.get('couponCode') || '').trim(), items: items.map(({ id, quantity, price }) => ({ productId: id, quantity, price })) }
    if (!user) payload.guestInfo = { name: String(form.get('guestName') || '').trim(), email: String(form.get('guestEmail') || '').trim() }
    try {
      const result = await requestJson('/api/orders/checkout', { method: 'POST', body: JSON.stringify(payload) })
      if (!result.url) throw new Error('El servidor no devolvió el enlace de pago.')
      location.assign(result.url)
    } catch (error) { setStatus(error.message) } finally { setBusy(false) }
  }

  const value = useMemo(() => ({ items, count: items.reduce((total, item) => total + item.quantity, 0), subtotal, add, setQuantity, remove, refresh, reconcileGuestItems, drawerOpen, setDrawerOpen, checkoutOpen, setCheckoutOpen, notify }), [items, subtotal, add, setQuantity, remove, refresh, reconcileGuestItems, drawerOpen, checkoutOpen, notify])
  return <CartContext.Provider value={value}>{children}
    <aside id="cart-drawer" className={`cart-drawer${drawerOpen ? ' open' : ''}`} aria-hidden={!drawerOpen} aria-labelledby="cart-drawer-heading" inert={!drawerOpen}>
      <button type="button" className="cart-drawer-overlay" id="cart-overlay" aria-label="Cerrar carrito" onClick={() => setDrawerOpen(false)} />
      <section className="cart-drawer-content"><header className="cart-drawer-header"><h2 id="cart-drawer-heading"><i className="ri-shopping-cart-2-line" aria-hidden="true"/> Tu Carrito</h2><button id="cart-close-btn" className="cart-close-btn" type="button" aria-label="Cerrar carrito" onClick={() => setDrawerOpen(false)}><i className="ri-close-line" aria-hidden="true"/></button></header>
        <section id="cart-drawer-body" className="cart-drawer-body" aria-label="Productos en el carrito">{items.length === 0 ? <article className="cart-empty-state"><i className="ri-shopping-cart-line"/><p>Tu carrito está vacío</p></article> : items.map((item) => <article className="cart-item" data-id={item.id} key={item.cartItemId || item.id}><img src={backendAssetUrl(item.image)} alt={item.name}/><section className="cart-item-details"><h4>{item.name}</h4>{item.unavailable ? <span className="cart-item-price">Ya no está disponible</span> : <span className="cart-item-price">${item.price.toFixed(2)}</span>}<nav className="cart-item-controls" aria-label={`Cantidad de ${item.name}`}><button type="button" className="btn-qty-minus" aria-label="Reducir cantidad" disabled={item.unavailable} onClick={() => setQuantity(item, item.quantity - 1)}>-</button><span>{item.quantity}</span><button type="button" className="btn-qty-plus" aria-label="Aumentar cantidad" disabled={item.unavailable} onClick={() => setQuantity(item, item.quantity + 1)}>+</button></nav></section><button type="button" className="cart-item-remove" aria-label={`Eliminar ${item.name}`} onClick={() => remove(item.id, item.cartItemId)}><i className="ri-delete-bin-line"/></button></article>)}</section>
        <footer className="cart-drawer-footer"><p className="cart-summary-row"><span>Subtotal:</span><strong id="cart-total">${subtotal.toFixed(2)}</strong></p><button id="cart-checkout-btn" type="button" className="btn btn-primary btn-block" disabled={!items.length || items.some((item) => item.unavailable)} onClick={() => { setDrawerOpen(false); setStatus(''); setCheckoutOpen(true) }}><i className="ri-secure-payment-line" aria-hidden="true"/>Proceder al Pago</button></footer>
      </section>
    </aside>
    <dialog id="checkout-modal" ref={checkoutDialog} className="checkout-modal" aria-labelledby="checkout-modal-title" onClose={() => setCheckoutOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setCheckoutOpen(false) }}><form id="checkout-form" className="modal-container" onSubmit={checkout}><header className="modal-header"><h2 id="checkout-modal-title"><i className="ri-secure-payment-line" aria-hidden="true"/>Finalizar Compra</h2><button type="button" id="close-checkout-modal" className="modal-close-btn" aria-label="Cerrar modal" onClick={() => setCheckoutOpen(false)}><i className="ri-close-line"/></button></header>
      {!user && <fieldset className="form-group" id="guest-checkout-fields"><legend>Datos del Comprador</legend><p className="form-field"><label htmlFor="guest-name">Nombre Completo</label><input type="text" id="guest-name" name="guestName" className="form-control" placeholder="Ej. Juan Pérez" required/></p><p className="form-field"><label htmlFor="guest-email">Correo Electrónico para Recibo</label><input type="email" id="guest-email" name="guestEmail" className="form-control" placeholder="correo@ejemplo.com" required/></p></fieldset>}
      <fieldset className="form-group"><legend>Método de Pago</legend><p>Pago seguro con tarjeta de crédito o débito a través de Stripe.</p></fieldset><fieldset className="form-group"><legend>Cupón de descuento</legend><label htmlFor="checkout-coupon-code">Código (opcional)</label><input type="text" id="checkout-coupon-code" name="couponCode" className="form-control" maxLength="32" autoComplete="off" placeholder="Ingresa tu código"/><small>El servidor validará el cupón y calculará el descuento antes del pago.</small></fieldset><section className="checkout-summary-box"><span>Subtotal antes del cupón:</span><strong>${subtotal.toFixed(2)}</strong></section>{status && <output id="checkout-status" className="form-status error" role="status">{status}</output>}<footer className="modal-footer"><button type="submit" id="btn-confirm-order" className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Redirigiendo a Stripe…' : 'Confirmar Pedido'}</button></footer></form></dialog>
    {toast && <section id="toast-container" className="toast-container" aria-live="polite" aria-atomic="true"><output className={`toast toast-${toast.type} show`} role="status"><i className={`ri-${toast.type === 'success' ? 'checkbox-circle' : toast.type === 'error' ? 'error-warning' : toast.type === 'warning' ? 'alert' : 'information'}-line`} aria-hidden="true"/><span>{toast.message}</span></output></section>}
  </CartContext.Provider>
}

