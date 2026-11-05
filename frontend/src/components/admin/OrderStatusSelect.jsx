import { useState } from 'react';
import { statuses } from '../../config/storeCatalog.js';
import { adminMutation } from '../../services/adminMutation.js';
function allowedOrderStatuses(order) {
  if (order.paymentStatus !== 'paid') return [order.status];
  return (
    {
      pending: ['pending', 'processing'],
      processing: ['processing', 'shipped'],
      shipped: ['shipped', 'delivered'],
      delivered: ['delivered', 'completed'],
    }[order.status] || [order.status]
  );
}

export function OrderStatusSelect({ order, onUpdated }) {
  const [status, setStatus] = useState(order.status);
  const [busy, setBusy] = useState(false);
  async function change(event) {
    const next = event.target.value;
    setBusy(true);
    try {
      await adminMutation(`/api/admin/orders/${order._id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: next }),
      });
      setStatus(next);
      onUpdated?.();
    } catch (error) {
      window.alert(error.message);
      event.target.value = status;
    } finally {
      setBusy(false);
    }
  }
  const disabled =
    busy || order.paymentStatus !== 'paid' || ['completed', 'cancelled'].includes(order.status);
  return (
    <>
      <select
        className="form-control select-order-status"
        aria-label={`Estado de orden ${order._id}`}
        value={status}
        onChange={change}
        disabled={disabled}
      >
        {allowedOrderStatuses(order).map((value) => (
          <option value={value} key={value}>
            {statuses[value] || value}
          </option>
        ))}
      </select>
      {order.paymentStatus !== 'paid' && (
        <small className="text-muted">Disponible después del pago</small>
      )}
    </>
  );
}
