import { useEffect, useRef, useState } from 'react'
import { requestJson } from '../api.js'
import { useCart } from './CartContext.js'

const money = (value) => `$${Number(value || 0).toFixed(2)}`
const date = (value, options = { year: 'numeric', month: 'short', day: 'numeric' }) => value ? new Date(value).toLocaleDateString('es-EC', options) : 'N/A'
const statuses = { pending: 'Pendiente', processing: 'En proceso', shipped: 'Enviado', delivered: 'Entregado', completed: 'Completado', cancelled: 'Cancelado' }
const categories = ['Laptops', 'Smartphones', 'Audio', 'Accesorios', 'Periféricos', 'Monitores', 'Almacenamiento', 'Componentes', 'Gaming', 'Redes']
const placeholder = '/images/products/product-placeholder.svg'

function useAdminData(url) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    requestJson(url).then((result) => { if (active) { setData(result.data); setError('') } }).catch((cause) => { if (active) setError(cause.message) })
    return () => { active = false }
  }, [url, reload])
  return { data, error, refresh: () => setReload((value) => value + 1) }
}

async function adminMutation(url, options = {}) {
  const headers = new Headers(options.headers || {})
  headers.set('Accept', 'application/json')
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  let response
  try { response = await fetch(url, { credentials: 'include', ...options, headers }) }
  catch { throw new Error('No se pudo conectar con el servidor.') }
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.success) throw new Error(result?.error || `Error HTTP ${response.status}`)
  return result
}

function AdminNotice({ error }) {
  return error ? <section className="admin-container container"><p className="form-status error" role="alert">{error}</p><a className="btn btn-secondary" href="/login">Inicia sesión con una cuenta administradora</a></section> : null
}

function AdminPagination({ pagination, onPage }) {
  if (!pagination || pagination.totalPages <= 1) return null
  return <nav className="pagination-nav" aria-label="Navegación de páginas"><button className="btn btn-sm btn-outline" type="button" disabled={pagination.currentPage <= 1} onClick={() => onPage(pagination.currentPage - 1)}>« Anterior</button><span className="pagination-info">Página {pagination.currentPage} de {pagination.totalPages}{pagination.totalUsers ? ` · ${pagination.totalUsers} usuarios` : ''}</span><button className="btn btn-sm btn-outline" type="button" disabled={pagination.currentPage >= pagination.totalPages} onClick={() => onPage(pagination.currentPage + 1)}>Siguiente »</button></nav>
}

function allowedOrderStatuses(order) {
  if (order.paymentStatus !== 'paid') return [order.status]
  return ({ pending: ['pending', 'processing'], processing: ['processing', 'shipped'], shipped: ['shipped', 'delivered'], delivered: ['delivered', 'completed'] })[order.status] || [order.status]
}

function OrderStatusSelect({ order, onUpdated }) {
  const [status, setStatus] = useState(order.status)
  const [busy, setBusy] = useState(false)
  async function change(event) {
    const next = event.target.value
    setBusy(true)
    try { await adminMutation(`/admin/orders/${order._id}/status`, { method: 'PUT', body: JSON.stringify({ status: next }) }); setStatus(next); onUpdated?.() }
    catch (error) { window.alert(error.message); event.target.value = status }
    finally { setBusy(false) }
  }
  const disabled = busy || order.paymentStatus !== 'paid' || ['completed', 'cancelled'].includes(order.status)
  return <><select className="form-control select-order-status" aria-label={`Estado de orden ${order._id}`} value={status} onChange={change} disabled={disabled}>{allowedOrderStatuses(order).map((value) => <option value={value} key={value}>{statuses[value] || value}</option>)}</select>{order.paymentStatus !== 'paid' && <small className="text-muted">Disponible después del pago</small>}</>
}

export function AdminDashboardPage() {
  const [subscriberPage, setSubscriberPage] = useState(1)
  const { data, error, refresh } = useAdminData(`/api/admin/dashboard?subscribersPage=${subscriberPage}`)
  const [product, setProduct] = useState(null)
  const [flashProduct, setFlashProduct] = useState(null)
  const productDialog = useRef(null)
  const flashDialog = useRef(null)
  const imageFile = useRef(null)
  const [imagePreview, setImagePreview] = useState(placeholder)
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [flashDiscount, setFlashDiscount] = useState(20)
  const [flashDuration, setFlashDuration] = useState(24)

  useEffect(() => { if (productDialog.current) product ? productDialog.current.showModal() : productDialog.current.close() }, [product])
  useEffect(() => { if (flashDialog.current) flashProduct ? flashDialog.current.showModal() : flashDialog.current.close() }, [flashProduct])
  useEffect(() => {
    const file = imageFile.current?.files?.[0]
    if (!file) { setImagePreview(product?.image || placeholder); return undefined }
    const url = URL.createObjectURL(file); setImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [product])

  async function submitProduct(event) {
    event.preventDefault(); setBusy(true); setFormError('')
    const form = new FormData(event.currentTarget)
    const id = form.get('id')
    try {
      await adminMutation(id ? `/admin/products/${id}` : '/admin/products', { method: id ? 'PUT' : 'POST', body: form })
      productDialog.current?.close(); setProduct(null); refresh()
    } catch (cause) { setFormError(cause.message) } finally { setBusy(false) }
  }
  async function deleteProduct(item) {
    if (!window.confirm(`¿Eliminar el producto “${item.name}”?`)) return
    try { await adminMutation(`/admin/products/${item._id}`, { method: 'DELETE' }); refresh() } catch (cause) { window.alert(cause.message) }
  }
  async function toggleFlash(item) {
    if (item.flashSale) {
      if (!window.confirm('Se detendrá la oferta y el precio volverá a su valor original.')) return
      try { await adminMutation(`/admin/products/${item._id}/flash-sale`, { method: 'DELETE' }); refresh() } catch (cause) { window.alert(cause.message) }
    } else { setFlashDiscount(20); setFlashDuration(24); setFlashProduct(item) }
  }
  async function submitFlash(event) {
    event.preventDefault(); setBusy(true)
    try { await adminMutation(`/admin/products/${flashProduct._id}/flash-sale`, { method: 'POST', body: JSON.stringify({ discount: Number(flashDiscount), durationHours: Number(flashDuration) }) }); flashDialog.current?.close(); setFlashProduct(null); refresh() }
    catch (cause) { window.alert(cause.message) } finally { setBusy(false) }
  }
  async function removeResource(kind, id) {
    if (!window.confirm(kind === 'messages' ? 'Este mensaje se eliminará permanentemente.' : 'Se eliminará este suscriptor.')) return
    try { await adminMutation(`/admin/${kind}/${id}`, { method: 'DELETE' }); refresh() } catch (cause) { window.alert(cause.message) }
  }

  if (error) return <AdminNotice error={error}/>
  if (!data) return <section className="admin-container container"><p role="status">Cargando panel…</p></section>
  const { activeMemberships = [], orders = [], products = [], topProducts = [], messages = [], subscribers = [], subscriberPagination } = data
  return <section className="admin-container container" aria-labelledby="admin-dashboard-heading">
    <header className="admin-header"><h1 id="admin-dashboard-heading"><i className="ri-dashboard-line"/> Panel de Administración</h1><a href="/admin/marketing" className="btn btn-primary">Marketing y membresías</a></header>
    <section className="dashboard-stats" aria-label="Resumen de ventas">{[['Órdenes Totales', data.totalOrders], ['Ingresos Pagados', money(data.totalRevenue)], ['Productos Vendidos', data.totalProductsSold], ['Carritos Activos', data.activeCartCount], ['Membresías VIP Activas', data.activeMembershipCount]].map(([label, value]) => <article className="stat-card" key={label}><h3>{label}</h3><p className="stat-number">{value ?? 0}</p></article>)}</section>
    <section className="dashboard-memberships"><header className="section-heading"><div><h2 className="section-title">Suscripciones VIP activas</h2><p className="membership-dashboard-note">Se muestran las membresías vigentes; la lista presenta hasta 100 usuarios.</p></div><a href="/admin/marketing" className="btn btn-sm btn-outline">Gestionar campañas y cupones</a></header><div className="admin-table-wrapper"><table className="admin-table"><thead><tr><th>Usuario</th><th>Inicio del período</th><th>Vigente hasta</th><th>Precio</th><th>Proveedor</th><th>Estado de renovación</th></tr></thead><tbody>{activeMemberships.length ? activeMemberships.map((membership) => <tr key={membership._id}><td>{membership.user?.name || 'Cuenta no disponible'}<br/>{membership.user?.email}</td><td>{date(membership.currentPeriodStart)}</td><td>{date(membership.currentPeriodEnd)}</td><td>{membership.currency || 'USD'} {money(membership.amount)}</td><td>{membership.provider === 'mock' ? 'Prueba (sin cobro)' : membership.provider}</td><td>{membership.cancelAtPeriodEnd ? 'Cancelada al finalizar período' : 'Activa'}</td></tr>) : <tr><td colSpan="6">No hay membresías activas.</td></tr>}</tbody></table></div></section>
    <section className="dashboard-orders"><div className="section-heading"><h2 className="section-title">Órdenes recientes</h2><a href="/admin/orders" className="btn btn-sm btn-outline">Ver todas</a></div><div className="admin-table-wrapper"><table className="admin-table"><thead><tr><th>#</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>{orders.map((order, index) => <tr key={order._id}><td>{index + 1}</td><td>{order.user?.name || order.guestInfo?.name || 'Invitado'}<small>{order.user?.email || order.guestInfo?.email}</small></td><td>{money(order.totalAmount)}</td><td><span className={`status-${order.status}`}>{statuses[order.status] || order.status}</span></td><td>{date(order.createdAt)}</td><td><a href={`/admin/orders/${order._id}`} className="btn btn-sm btn-primary">Ver</a></td></tr>)}</tbody></table></div></section>
    <section className="dashboard-products"><header className="section-heading"><h2 className="section-title">Gestión del catálogo</h2><button type="button" className="btn btn-primary" onClick={() => setProduct({})}>Nuevo producto</button></header><div className="admin-table-wrapper"><table className="admin-table"><thead><tr><th>Imagen</th><th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Oferta</th><th>Acciones</th></tr></thead><tbody>{products.map((item) => <tr key={item._id}><td><img className="admin-product-thumbnail" src={item.image || placeholder} alt={item.name}/></td><td>{item.name}</td><td>{item.category}</td><td>{money(item.price)}</td><td>{item.stock}</td><td>{item.flashSale ? `${item.flashSaleDiscount}%` : '—'}</td><td><button className="btn btn-sm btn-outline" type="button" onClick={() => setProduct(item)}>Editar</button> <button className="btn btn-sm btn-outline" type="button" onClick={() => toggleFlash(item)}>{item.flashSale ? 'Detener oferta' : 'Oferta'}</button> <button className="btn btn-sm btn-delete" type="button" onClick={() => deleteProduct(item)}>Eliminar</button></td></tr>)}{!products.length && <tr><td colSpan="7">No hay productos registrados.</td></tr>}</tbody></table></div></section>
    <section className="dashboard-messages"><h2 className="section-title">Mensajes de contacto</h2><div className="admin-table-wrapper"><table className="admin-table"><thead><tr><th>Nombre</th><th>Correo</th><th>Mensaje</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>{messages.map((message) => <tr key={message._id}><td>{message.name}</td><td><a href={`mailto:${message.email}`}>{message.email}</a></td><td className="admin-message-content">{message.message}</td><td>{date(message.createdAt)}</td><td><button className="btn btn-sm btn-delete" type="button" onClick={() => removeResource('messages', message._id)}>Eliminar</button></td></tr>)}{!messages.length && <tr><td colSpan="5">No hay mensajes.</td></tr>}</tbody></table></div></section>
    <section className="dashboard-newsletter"><h2 className="section-title">Suscriptores al boletín</h2><p className="membership-dashboard-note">{subscriberPagination.totalSubscribers} suscriptores registrados; se muestran hasta 20 por página.</p><div className="admin-table-wrapper"><table className="admin-table"><thead><tr><th>Correo</th><th>Fecha</th><th>Marketing</th><th>Acciones</th></tr></thead><tbody>{subscribers.map((subscriber) => <tr key={subscriber._id}><td><a href={`mailto:${subscriber.email}`}>{subscriber.email}</a></td><td>{date(subscriber.createdAt)}</td><td>{subscriber.isSubscribed === false ? 'Dio de baja' : 'Activo'}</td><td><button className="btn btn-sm btn-delete" type="button" onClick={() => removeResource('subscribers', subscriber._id)}>Eliminar</button></td></tr>)}{!subscribers.length && <tr><td colSpan="4">No hay suscriptores.</td></tr>}</tbody></table></div><AdminPagination pagination={subscriberPagination} onPage={setSubscriberPage}/></section>
    <section className="dashboard-products"><h2 className="section-title">Productos más vendidos</h2><div className="products-grid">{topProducts.map((item) => <article className="product-card" key={item._id}><a href={`/producto/${item._id}`}><img src={item.image || placeholder} alt={item.name}/><h4>{item.name}</h4></a><p className="product-price">{money(item.price)}</p><small>{item.unitsSold} vendidos</small></article>)}{!topProducts.length && <p className="empty-msg">Todavía no hay productos vendidos.</p>}</div></section>
    <dialog ref={productDialog} className="modal-dialog" onClose={() => setProduct(null)}><article className="modal-card"><header className="modal-header"><h2>{product?._id ? 'Editar producto' : 'Agregar producto'}</h2><button type="button" className="btn-close" aria-label="Cerrar" onClick={() => productDialog.current?.close()}>×</button></header><form key={product?._id || 'new-product'} onSubmit={submitProduct} encType="multipart/form-data"><input type="hidden" name="id" value={product?._id || ''}/><p className="form-field"><label htmlFor="prod-name">Nombre del producto</label><input id="prod-name" name="name" defaultValue={product?.name || ''} required minLength="2" maxLength="100"/></p><p className="form-field"><label htmlFor="prod-description">Descripción</label><textarea id="prod-description" name="description" defaultValue={product?.description || ''} rows="3" required/></p><fieldset className="form-group-inline"><p className="form-field"><label htmlFor="prod-price">Precio ($)</label><input id="prod-price" name="price" type="number" step="0.01" min="0.01" defaultValue={product?.price || ''} required/></p><p className="form-field"><label htmlFor="prod-stock">Stock</label><input id="prod-stock" name="stock" type="number" min="0" defaultValue={product?.stock ?? ''} required/></p></fieldset><p className="form-field"><label htmlFor="prod-category">Categoría</label><select id="prod-category" name="category" defaultValue={product?.category || ''} required><option value="">Selecciona una categoría</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></p><p className="form-field"><label htmlFor="prod-image-file">Imagen del producto (opcional)</label><input ref={imageFile} id="prod-image-file" name="imageFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; if (file) setImagePreview(URL.createObjectURL(file)) }}/></p><p className="form-field"><label htmlFor="prod-image">URL de imagen (si no subes un archivo)</label><input id="prod-image" name="image" type="url" defaultValue={product?.image || ''} placeholder="https://..." onChange={(event) => { if (!imageFile.current?.files?.length && event.target.value) setImagePreview(event.target.value) }}/></p><figure className="form-field image-preview-container"><figcaption>Vista previa</figcaption><img src={imagePreview} alt="Vista previa del producto"/></figure>{formError && <output className="form-status error" role="alert">{formError}</output>}<footer className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => productDialog.current?.close()}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar producto'}</button></footer></form></article></dialog>
    <dialog ref={flashDialog} className="modal-dialog" onClose={() => setFlashProduct(null)}><article className="modal-card"><header className="modal-header"><h2>Configurar oferta relámpago</h2><button type="button" className="btn-close" aria-label="Cerrar" onClick={() => flashDialog.current?.close()}>×</button></header><form onSubmit={submitFlash}><p className="form-field"><span>Producto</span><output>{flashProduct?.name}</output></p><p className="form-field"><span>Precio actual</span><output>{money(flashProduct?.price)}</output></p><fieldset className="form-group-inline"><p className="form-field"><label htmlFor="flash-discount">Descuento (%)</label><input id="flash-discount" type="number" min="1" max="90" value={flashDiscount} onChange={(event) => setFlashDiscount(Number(event.target.value))}/></p><p className="form-field"><label htmlFor="flash-duration">Duración (horas)</label><input id="flash-duration" type="number" min="1" max="168" value={flashDuration} onChange={(event) => setFlashDuration(Number(event.target.value))}/></p></fieldset><p>Precio final: {money(Number(flashProduct?.price || 0) * (1 - flashDiscount / 100))}</p><footer className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => flashDialog.current?.close()}>Cancelar</button><button className="btn btn-primary" disabled={busy}>Activar oferta</button></footer></form></article></dialog>
  </section>
}

export function AdminOrdersPage() {
  const params = new URLSearchParams(location.search)
  const [page, setPage] = useState(Number(params.get('page')) || 1)
  const [status, setStatus] = useState(params.get('status') || '')
  const { data, error } = useAdminData(`/api/admin/orders?page=${page}&status=${encodeURIComponent(status)}`)
  if (error) return <AdminNotice error={error}/>
  if (!data) return <section className="admin-container container"><p role="status">Cargando órdenes…</p></section>
  const filters = [['', 'Todas'], ['pending', 'Pendientes'], ['processing', 'En proceso'], ['shipped', 'Enviadas'], ['completed', 'Completadas'], ['cancelled', 'Canceladas']]
  return <section className="admin-container container admin-orders-page"><header className="admin-header"><h1><i className="ri-shopping-bag-line"/> Gestión de Órdenes</h1><nav className="admin-filter-nav" aria-label="Filtro de estados">{filters.map(([value, label]) => <button type="button" key={value} className={`btn btn-sm ${status === value ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setStatus(value); setPage(1) }}>{label}</button>)}</nav></header><div className="admin-table-wrapper"><table className="admin-table"><thead><tr><th>ID Orden</th><th>Cliente</th><th>Fecha</th><th>Total</th><th>Pago</th><th>Envío</th><th>Acciones</th></tr></thead><tbody>{data.orders.map((order) => <tr key={order._id}><td><code>#{order._id}</code></td><td><strong>{order.user?.name || order.guestInfo?.name || 'Cliente desconocido'}</strong><br/><small>{order.user?.email || order.guestInfo?.email}</small></td><td>{date(order.createdAt)}</td><td><strong>{money(order.totalAmount)}</strong></td><td><span className={`badge badge-${order.paymentStatus === 'paid' ? 'success' : 'warning'}`}>{order.paymentStatus === 'paid' ? 'Pagado' : 'Pendiente'}</span></td><td><OrderStatusSelect order={order}/></td><td><a href={`/admin/orders/${order._id}`} className="btn btn-sm btn-secondary">Detalle</a></td></tr>)}{!data.orders.length && <tr><td colSpan="7">No se encontraron órdenes registradas.</td></tr>}</tbody></table></div><AdminPagination pagination={data.pagination} onPage={setPage}/></section>
}

export function AdminOrderDetailPage({ orderId }) {
  const { data, error, refresh } = useAdminData(`/api/admin/orders/${encodeURIComponent(orderId)}`)
  const order = data?.order
  if (error) return <AdminNotice error={error}/>
  if (!order) return <section className="admin-container container"><p role="status">Cargando orden…</p></section>
  return <section className="admin-container container order-detail-page"><header className="admin-header"><div><a href="/admin/orders" className="btn btn-outline btn-sm">← Volver a Órdenes</a><h1>Detalle de Orden #{order._id}</h1></div><a href={`/admin/orders/${order._id}/packing-slip`} target="_blank" rel="noreferrer" className="btn btn-secondary" onClick={(event) => { event.preventDefault(); window.open(`/admin/orders/${order._id}/packing-slip`, '_blank', 'noopener'); }}>Imprimir Packing Slip</a></header><div className="order-detail-grid"><article className="order-card"><h2>Información del Cliente</h2><p><strong>Nombre:</strong> {order.user?.name || order.guestInfo?.name || 'Sin información'}</p><p><strong>Email:</strong> {order.user?.email || order.guestInfo?.email || '—'}</p><p><strong>Fecha de Orden:</strong> {date(order.createdAt, { dateStyle: 'long', timeStyle: 'short' })}</p></article><article className="order-card"><h2>Estado del Pedido</h2><OrderStatusSelect order={order} onUpdated={refresh}/></article></div><section className="order-items-section"><h2>Productos Comprados</h2><div className="admin-table-wrapper"><table className="admin-table"><thead><tr><th>Producto</th><th>Precio Unitario</th><th>Cantidad</th><th>Subtotal</th></tr></thead><tbody>{order.items.map((item, index) => <tr key={`${item._id || index}`}><td>{item.product?.name || <em>Producto no disponible o eliminado</em>}</td><td>{money(item.price)}</td><td>{item.quantity}</td><td>{money(item.price * item.quantity)}</td></tr>)}</tbody><tfoot><tr><th colSpan="3">Total General:</th><td><strong>{money(order.totalAmount)}</strong></td></tr></tfoot></table></div></section></section>
}

export function AdminPackingSlipPage({ orderId }) {
  const { data, error } = useAdminData(`/api/admin/orders/${encodeURIComponent(orderId)}/packing-slip`)
  const order = data?.order
  if (error) return <AdminNotice error={error}/>
  if (!order) return <main className="container"><p role="status">Preparando comprobante…</p></main>
  return <main className="packing-slip"><div className="packing-main"><header className="packing-header"><p className="packing-logo">TechStore</p><h1 className="packing-doc-title">Packing Slip #{String(order._id).slice(-8).toUpperCase()}</h1><button className="btn btn-primary no-print" type="button" onClick={() => window.print()}>Imprimir</button></header>
    <section className="packing-section" aria-labelledby="packing-customer-heading"><h2 id="packing-customer-heading" className="packing-section-title">Información del Cliente</h2><dl className="packing-info-list"><div className="packing-info-row"><dt className="packing-info-label">Nombre:</dt><dd className="packing-info-value">{order.guestInfo?.name || order.user?.name || 'N/A'}</dd></div><div className="packing-info-row"><dt className="packing-info-label">Email:</dt><dd className="packing-info-value">{order.guestInfo?.email || order.user?.email || 'N/A'}</dd></div><div className="packing-info-row"><dt className="packing-info-label">Dirección:</dt><dd className="packing-info-value">{order.shippingAddress?.street || 'Dirección estándar'}, {order.shippingAddress?.city || 'Guayaquil'}, {order.shippingAddress?.country || 'Ecuador'}</dd></div></dl></section>
    <section className="packing-section" aria-labelledby="packing-order-heading"><h2 id="packing-order-heading" className="packing-section-title">Detalles del Pedido</h2><dl className="packing-info-list"><div className="packing-info-row"><dt className="packing-info-label">Fecha:</dt><dd className="packing-info-value"><time dateTime={new Date(order.createdAt).toISOString()}>{date(order.createdAt)}</time></dd></div><div className="packing-info-row"><dt className="packing-info-label">Estado:</dt><dd className="packing-info-value">{order.status}</dd></div><div className="packing-info-row"><dt className="packing-info-label">Pago:</dt><dd className="packing-info-value">{order.paymentStatus}</dd></div></dl></section>
    <section className="packing-section" aria-labelledby="packing-products-heading"><h2 id="packing-products-heading" className="packing-section-title">Productos</h2><table className="packing-table"><caption className="sr-only">Productos incluidos en la orden</caption><thead><tr><th scope="col">Producto</th><th scope="col">Cantidad</th><th scope="col">Precio Unit.</th><th scope="col">Subtotal</th></tr></thead><tbody>{order.items.map((item, index) => <tr key={item._id || index}><td>{item.product?.name || item.productName || 'Producto'}</td><td>{item.quantity}</td><td>{money(item.price)}</td><td>{money(Number(item.price) * Number(item.quantity))}</td></tr>)}</tbody><tfoot><tr className="packing-total-row"><th scope="row" colSpan="3">Total:</th><td><strong>{money(order.totalAmount)}</strong></td></tr></tfoot></table></section><footer className="packing-footer"><address>TechStore - Villa España, Guayaquil, Ecuador | <a href="tel:+593963976623">+593 0963976623</a></address></footer></div></main>
}

export function AdminUsersPage() {
  const query = new URLSearchParams(location.search)
  const [search, setSearch] = useState(query.get('search') || '')
  const [role, setRole] = useState(query.get('role') || '')
  const [page, setPage] = useState(Number(query.get('page')) || 1)
  const [filter, setFilter] = useState({ search, role })
  const { data, error, refresh } = useAdminData(`/api/admin/users?page=${page}&search=${encodeURIComponent(filter.search)}&role=${encodeURIComponent(filter.role)}`)
  async function remove(user) {
    if (!window.confirm(`¿Eliminar la cuenta de ${user.name}?`)) return
    try { await adminMutation(`/admin/users/${user._id}`, { method: 'DELETE' }); refresh() } catch (cause) { window.alert(cause.message) }
  }
  if (error) return <AdminNotice error={error}/>
  if (!data) return <section className="admin-container container"><p role="status">Cargando usuarios…</p></section>
  return <section className="admin-container container admin-users-page"><header className="admin-header"><h1><i className="ri-user-settings-line"/> Gestión de Usuarios</h1><a href="/admin/dashboard" className="btn btn-outline btn-sm">← Volver al Dashboard</a></header><form className="catalog-filters" role="search" onSubmit={(event) => { event.preventDefault(); setPage(1); setFilter({ search, role }) }}><fieldset className="filter-group search-group"><label className="sr-only" htmlFor="admin-users-search">Buscar usuarios</label><input id="admin-users-search" type="search" placeholder="Buscar por nombre o email…" value={search} onChange={(event) => setSearch(event.target.value)}/></fieldset><fieldset className="filter-group"><label htmlFor="admin-users-role">Rol:</label><select id="admin-users-role" value={role} onChange={(event) => setRole(event.target.value)}><option value="">Todos los roles</option><option value="user">Usuarios</option><option value="admin">Administradores</option></select></fieldset><button className="btn btn-primary btn-sm">Filtrar</button>{(filter.search || filter.role) && <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setRole(''); setFilter({ search: '', role: '' }); setPage(1) }}>Limpiar filtros</button>}</form><div className="admin-table-wrapper"><table className="admin-table"><thead><tr><th>Usuario</th><th>Email</th><th>Rol</th><th>Registro</th><th>Último acceso</th><th>Acciones</th></tr></thead><tbody>{data.users.map((user) => <tr key={user._id}><td><strong>{user.name}</strong></td><td><a href={`mailto:${user.email}`}>{user.email}</a></td><td><span className={`badge badge-${user.role === 'admin' ? 'primary' : 'secondary'}`}>{user.role === 'admin' ? 'Admin' : 'Usuario'}</span></td><td>{date(user.createdAt)}</td><td>{date(user.lastLoginAt)}</td><td>{user.role === 'admin' ? 'Protegido' : <button type="button" className="btn btn-sm btn-delete" onClick={() => remove(user)}>Eliminar</button>}</td></tr>)}{!data.users.length && <tr><td colSpan="6">No se encontraron usuarios con esos filtros.</td></tr>}</tbody></table></div><AdminPagination pagination={data.pagination} onPage={setPage}/></section>
}

export function AdminMarketingPage() {
  const { data, error, refresh } = useAdminData('/api/admin/marketing')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const coupons = data?.coupons || []
  const campaigns = data?.campaigns || []
  async function createCoupon(event) {
    event.preventDefault(); setBusy(true); setStatus('')
    const target = event.currentTarget
    const form = new FormData(target)
    try { const result = await adminMutation('/admin/coupons', { method: 'POST', body: JSON.stringify(Object.fromEntries(form.entries())) }); setStatus(`Cupón ${result.coupon.code} guardado.`); target.reset(); refresh() }
    catch (cause) { setStatus(cause.message) } finally { setBusy(false) }
  }
  async function sendCampaign(event) {
    event.preventDefault()
    if (!window.confirm('La campaña se procesará ahora para el público seleccionado. ¿Quieres continuar?')) return
    const formData = Object.fromEntries(new FormData(event.currentTarget).entries())
    setBusy(true); setStatus('Procesando campaña…')
    try { const result = await adminMutation('/admin/campaigns', { method: 'POST', body: JSON.stringify(formData) }); setStatus(result.message); refresh() }
    catch (cause) { setStatus(cause.message) } finally { setBusy(false) }
  }
  async function toggleCoupon(coupon) {
    try { await adminMutation(`/admin/coupons/${coupon._id}/status`, { method: 'PATCH' }); refresh() } catch (cause) { setStatus(cause.message) }
  }
  if (error) return <AdminNotice error={error}/>
  if (!data) return <section className="admin-container container"><p role="status">Cargando marketing…</p></section>
  return <section className="admin-container container admin-marketing"><header className="admin-header"><h1>Marketing y membresías</h1><a href="/admin/dashboard" className="btn btn-outline">Volver al dashboard</a></header><section className="marketing-grid"><article className="admin-marketing-card"><h2>Crear cupón</h2><form className="admin-marketing-form" onSubmit={createCoupon}><label>Código<input name="code" required minLength="4" maxLength="32" pattern="[A-Za-z0-9_-]+" placeholder="VERANO10"/></label><label>Descuento (%)<input name="discountPercent" type="number" min="1" max="100" required defaultValue="10"/></label><label>Descuento máximo ($)<input name="maxDiscountAmount" type="number" min="0.01" step="0.01" required defaultValue="8"/></label><label>Compra mínima ($)<input name="minOrderAmount" type="number" min="0" step="0.01" required defaultValue="50"/></label><label>Usos máximos<input name="maxRedemptions" type="number" min="1" step="1"/></label><label>Vence<input name="expiresAt" type="datetime-local"/></label><label className="marketing-form-wide">Descripción<input name="description" maxLength="200"/></label><button className="btn btn-primary" disabled={busy}>Guardar cupón</button></form></article><article className="admin-marketing-card"><h2>Enviar campaña</h2><p>El envío respeta las bajas. Sin SMTP configurado, queda registrado como simulado y no se envía ningún correo.</p><form className="admin-marketing-form" onSubmit={sendCampaign}><label>Nombre interno<input name="name" required maxLength="100"/></label><label>Asunto del correo<input name="subject" required maxLength="150"/></label><label>Público<select name="audience"><option value="newsletter">Boletín gratuito</option><option value="vip">VIP con consentimiento</option><option value="all">Boletín y VIP</option></select></label><label>Cupón<select name="couponCode"><option value="">Sin cupón</option>{coupons.filter((coupon) => coupon.active).map((coupon) => <option key={coupon._id} value={coupon.code}>{coupon.code}</option>)}</select></label><label className="marketing-form-wide">Mensaje<textarea name="content" required maxLength="5000" rows="6"/></label><button className="btn btn-primary" disabled={busy}>Enviar campaña</button></form></article></section>{status && <output className={`form-status ${status.includes('Error') || status.includes('No se') ? 'error' : 'success'}`} role="status">{status}</output>}<section className="admin-marketing-card"><h2>Cupones</h2><div className="admin-table-wrapper"><table className="admin-table"><thead><tr><th>Código</th><th>Descuento</th><th>Mínimo</th><th>Usos</th><th>Vencimiento</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{coupons.map((coupon) => <tr key={coupon._id}><td><strong>{coupon.code}</strong></td><td>{coupon.discountPercent}% (máx. {money(coupon.maxDiscountAmount)})</td><td>{money(coupon.minOrderAmount)}</td><td>{coupon.redemptionCount}{coupon.maxRedemptions ? ` / ${coupon.maxRedemptions}` : ''}</td><td>{date(coupon.expiresAt)}</td><td>{coupon.active ? 'Activo' : 'Pausado'}</td><td><button type="button" className="btn btn-sm btn-outline" onClick={() => toggleCoupon(coupon)}>{coupon.active ? 'Pausar' : 'Activar'}</button></td></tr>)}{!coupons.length && <tr><td colSpan="7">Aún no hay cupones.</td></tr>}</tbody></table></div></section><section className="admin-marketing-card"><h2>Historial de campañas</h2><div className="admin-table-wrapper"><table className="admin-table"><thead><tr><th>Nombre</th><th>Público</th><th>Estado</th><th>Destinatarios</th><th>Fecha</th></tr></thead><tbody>{campaigns.map((campaign) => <tr key={campaign._id}><td>{campaign.name}</td><td>{campaign.audience}</td><td>{campaign.status}</td><td>{campaign.recipientCount} · {campaign.sentCount} enviados · {campaign.failedCount} fallidos{campaign.simulated ? ' · simulado' : ''}</td><td>{date(campaign.createdAt, { dateStyle: 'short', timeStyle: 'short' })}</td></tr>)}{!campaigns.length && <tr><td colSpan="5">Aún no hay campañas.</td></tr>}</tbody></table></div></section></section>
}

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
