export default function OrderAddress({ order }) {
  return (
    <section className="order-address" aria-label="Dirección del pedido">
      <p>
        <strong>Dirección de entrega</strong>
      </p>
      {order.shippingAddressProvided && order.shippingAddress ? (
        <>
          <p>{order.shippingAddress.recipient}</p>
          <p>
            {order.shippingAddress.street}, {order.shippingAddress.city},{' '}
            {order.shippingAddress.country}
          </p>
          {order.shippingAddress.reference && <p>{order.shippingAddress.reference}</p>}
        </>
      ) : (
        <p>Entrega por coordinar con la tienda.</p>
      )}
    </section>
  );
}
