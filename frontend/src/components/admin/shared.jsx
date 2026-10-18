/* eslint react-refresh/only-export-components: off */
import { useEffect, useState } from 'react'
import { apiUrl, requestJson } from '../../api.js'

export const money = (value) => `$${Number(value || 0).toFixed(2)}`
export const date = (value, options = { year: 'numeric', month: 'short', day: 'numeric' }) => value ? new Date(value).toLocaleDateString('es-EC', options) : 'N/A'
export const statuses = { pending: 'Pendiente', processing: 'En proceso', shipped: 'Enviado', delivered: 'Entregado', completed: 'Completado', cancelled: 'Cancelado' }
export const categories = ['Laptops', 'Smartphones', 'Audio', 'Accesorios', 'Periféricos', 'Monitores', 'Almacenamiento', 'Componentes', 'Gaming', 'Redes']
export const placeholder = '/images/products/product-placeholder.svg'

export function useAdminData(url) {
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

export async function adminMutation(url, options = {}) {
  const headers = new Headers(options.headers || {})
  headers.set('Accept', 'application/json')
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  let response
  try { response = await fetch(apiUrl(url), { credentials: 'include', ...options, headers }) }
  catch { throw new Error('No se pudo conectar con el servidor.') }
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.success) throw new Error(result?.error || `Error HTTP ${response.status}`)
  return result
}

export function AdminNotice({ error }) {
  return error ? <section className="admin-container container"><p className="form-status error" role="alert">{error}</p><a className="btn btn-secondary" href="/login">Inicia sesión con una cuenta administradora</a></section> : null
}

export function AdminPagination({ pagination, onPage }) {
  if (!pagination || pagination.totalPages <= 1) return null
  return <nav className="pagination-nav" aria-label="Navegación de páginas"><button className="btn btn-sm btn-outline" type="button" disabled={pagination.currentPage <= 1} onClick={() => onPage(pagination.currentPage - 1)}>« Anterior</button><span className="pagination-info">Página {pagination.currentPage} de {pagination.totalPages}{pagination.totalUsers ? ` · ${pagination.totalUsers} usuarios` : ''}</span><button className="btn btn-sm btn-outline" type="button" disabled={pagination.currentPage >= pagination.totalPages} onClick={() => onPage(pagination.currentPage + 1)}>Siguiente »</button></nav>
}

function allowedOrderStatuses(order) {
  if (order.paymentStatus !== 'paid') return [order.status]
  return ({ pending: ['pending', 'processing'], processing: ['processing', 'shipped'], shipped: ['shipped', 'delivered'], delivered: ['delivered', 'completed'] })[order.status] || [order.status]
}

export function OrderStatusSelect({ order, onUpdated }) {
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
