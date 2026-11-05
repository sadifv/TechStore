import { getOrderItemName } from '../account/orderItemDisplay.js';
import { AdminNotice } from './AdminNotice.jsx';
import { date, money } from '../../utils/formatters.js';
import { useAdminData } from '../../hooks/useAdminData.js';

export function AdminPackingSlipPage({ orderId }) {
  const { data, error } = useAdminData(
    `/api/admin/orders/${encodeURIComponent(orderId)}/packing-slip`,
  );
  const order = data?.order;
  if (error) return <AdminNotice error={error} />;
  if (!order)
    return (
      <main className="container">
        <p role="status">Preparando comprobante…</p>
      </main>
    );
  return (
    <main className="packing-slip">
      <div className="packing-main">
        <header className="packing-header">
          <p className="packing-logo">TechStore</p>
          <h1 className="packing-doc-title">
            Packing Slip #{String(order._id).slice(-8).toUpperCase()}
          </h1>
          <button className="btn btn-primary no-print" type="button" onClick={() => window.print()}>
            Imprimir
          </button>
        </header>
        <section className="packing-section" aria-labelledby="packing-customer-heading">
          <h2 id="packing-customer-heading" className="packing-section-title">
            Información del Cliente
          </h2>
          <dl className="packing-info-list">
            <div className="packing-info-row">
              <dt className="packing-info-label">Nombre:</dt>
              <dd className="packing-info-value">
                {order.guestInfo?.name || order.user?.name || 'N/A'}
              </dd>
            </div>
            <div className="packing-info-row">
              <dt className="packing-info-label">Email:</dt>
              <dd className="packing-info-value">
                {order.guestInfo?.email || order.user?.email || 'N/A'}
              </dd>
            </div>
            <div className="packing-info-row">
              <dt className="packing-info-label">Dirección:</dt>
              <dd className="packing-info-value">
                {order.shippingAddressProvided ? (
                  <>
                    {order.shippingAddress?.recipient}: {order.shippingAddress?.street},{' '}
                    {order.shippingAddress?.city}, {order.shippingAddress?.country}
                    {order.shippingAddress?.reference
                      ? ` · ${order.shippingAddress.reference}`
                      : ''}
                  </>
                ) : (
                  'Entrega por coordinar con la tienda.'
                )}
              </dd>
            </div>
          </dl>
        </section>
        <section className="packing-section" aria-labelledby="packing-order-heading">
          <h2 id="packing-order-heading" className="packing-section-title">
            Detalles del Pedido
          </h2>
          <dl className="packing-info-list">
            <div className="packing-info-row">
              <dt className="packing-info-label">Fecha:</dt>
              <dd className="packing-info-value">
                <time dateTime={new Date(order.createdAt).toISOString()}>
                  {date(order.createdAt)}
                </time>
              </dd>
            </div>
            <div className="packing-info-row">
              <dt className="packing-info-label">Estado:</dt>
              <dd className="packing-info-value">{order.status}</dd>
            </div>
            <div className="packing-info-row">
              <dt className="packing-info-label">Pago:</dt>
              <dd className="packing-info-value">{order.paymentStatus}</dd>
            </div>
          </dl>
        </section>
        <section className="packing-section" aria-labelledby="packing-products-heading">
          <h2 id="packing-products-heading" className="packing-section-title">
            Productos
          </h2>
          <table className="packing-table">
            <caption className="sr-only">Productos incluidos en la orden</caption>
            <thead>
              <tr>
                <th scope="col">Producto</th>
                <th scope="col">Cantidad</th>
                <th scope="col">Precio Unit.</th>
                <th scope="col">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => (
                <tr key={item._id || index}>
                  <td>{getOrderItemName(item)}</td>
                  <td>{item.quantity}</td>
                  <td>{money(item.price)}</td>
                  <td>{money(Number(item.price) * Number(item.quantity))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="packing-total-row">
                <th scope="row" colSpan="3">
                  Total:
                </th>
                <td>
                  <strong>{money(order.totalAmount)}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </section>
        <footer className="packing-footer">
          <address>
            TechStore - Villa España, Guayaquil, Ecuador |{' '}
            <a href="tel:+593963976623">+593 0963976623</a>
          </address>
        </footer>
      </div>
    </main>
  );
}
