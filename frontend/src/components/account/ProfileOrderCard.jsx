import { getOrderItemName } from './orderItemDisplay.js';
import { formatCurrency } from './utils.js';
import OrderTracking from './OrderTracking.jsx';
import { orderPaymentLabel, orderShippingLabel } from './orderTracking.js';
import { orderNextStep } from './orderOverview.js';

export default function ProfileOrderCard({ order, onUpdate }) {
  const total = order.totalAmount ?? order.total ?? (order.items || []).reduce((sum, item) => sum + Number(item.price ?? item.product?.price ?? 0) * Number(item.quantity || 1), 0);
  return (
    <article className="order-card">
      <header className="order-header">
        <section aria-label="Referencia del pedido">
          <h4 className="order-id">Orden #{String(order._id).slice(0, 8)}</h4>
          <time className="order-date" dateTime={order.createdAt}>
            {new Date(order.createdAt).toLocaleDateString('es-EC', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
        </section>
        <span className={`order-status status-${order.status || 'completed'}`}>
          {orderShippingLabel(order)}
        </span>
      </header>
      <dl className="profile-order-summary">
        <div>
          <dt>Pago</dt>
          <dd>{orderPaymentLabel(order)}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{formatCurrency(total)}</dd>
        </div>
      </dl>
      <p className="order-next-step">{orderNextStep(order)}</p>
      <details className="order-details">
        <summary>Ver detalles</summary>
        <ul className="order-body">
          {(order.items || []).map((item, index) => (
            <li
              className="order-item"
              key={`${item.product?._id || item.product || index}-${index}`}
            >
              <span>
                {getOrderItemName(item)} (×{item.quantity || 1})
              </span>
              <span>
                {formatCurrency(
                  Number(item.price ?? item.product?.price ?? 0) *
                    Number(item.quantity || 1),
                )}
              </span>
            </li>
          ))}
        </ul>
        <footer className="order-footer">
          <span>
            Método:{' '}
            <strong>
              {order.paymentMethod === 'whatsapp' ? 'WhatsApp' : 'No disponible'}
            </strong>
          </span>
          <span className="order-total">
            Total: <strong>{formatCurrency(total)}</strong>
          </span>
        </footer>
        <OrderTracking order={order} headingLevel={5} onUpdate={onUpdate} />
      </details>
    </article>
  );
}
