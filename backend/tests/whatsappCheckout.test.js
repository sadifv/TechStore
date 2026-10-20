const assert = require('node:assert/strict');
const { beforeEach, test } = require('node:test');
const {
  reset,
  controller,
  addProduct,
  addOrder,
  state,
  responseHarness,
  confirmPayment,
  expireOrders,
} = require('./helpers/orderControllerHarness');
const productId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const key = '11111111-1111-4111-8111-111111111111';
const payload = () => ({
  checkoutKey: key,
  items: [{ productId, quantity: 2 }],
  guestInfo: { name: 'María & José', email: 'cliente@example.test' },
});
const call = async (method, req) => {
  const res = responseHarness();
  await controller[method](req, res, (error) => {
    throw error;
  });
  return res;
};
beforeEach(reset);

test('crea un pedido pendiente, reserva stock y prepara un mensaje codificado con ID y total', async () => {
  addProduct(productId, 5);
  const res = await call('createOrder', { body: payload() });
  assert.equal(res.statusCode, 201);
  const url = new URL(res.body.whatsappUrl);
  assert.equal(url.hostname, 'wa.me');
  assert.equal(url.pathname, '/593963976623');
  assert.match(url.searchParams.get('text'), /María & José/);
  assert.match(url.searchParams.get('text'), /Total: \$50.00/);
  assert.match(url.searchParams.get('text'), /Pedido: order-1/);
  assert.equal(state.products.get(productId).stock, 3);
  assert.equal(state.orders[0].paymentStatus, 'pending');
  assert.equal(state.orders[0].contactConfirmedAt, undefined);
  assert.equal(state.orders[0].checkoutState, 'ready');
});

test('reintenta una respuesta perdida sin crear otra orden ni descontar más stock', async () => {
  addProduct(productId, 5);
  const first = await call('createOrder', { body: payload() });
  const retry = await call('createOrder', { body: payload() });
  assert.deepEqual(retry.body, first.body);
  assert.equal(state.orders.length, 1);
  assert.equal(state.products.get(productId).stock, 3);
  const changed = payload();
  changed.items[0].quantity = 1;
  assert.equal((await call('createOrder', { body: changed })).statusCode, 409);
});

test('solicitudes simultáneas con la misma clave reservan inventario una sola vez', async () => {
  addProduct(productId, 2);
  const responses = await Promise.all([
    call('createOrder', { body: payload() }),
    call('createOrder', { body: payload() }),
  ]);
  assert.equal(state.orders.length, 1);
  assert.equal(state.products.get(productId).stock, 0);
  assert.ok(responses.every((response) => response.statusCode < 300));
  assert.ok(responses.some((response) => response.statusCode === 201));
  assert.equal((await call('createOrder', { body: payload() })).body.orderId, state.orders[0]._id);
});

test('sin configuración WhatsApp no se crean pedidos ni se reserva stock', async () => {
  addProduct(productId, 5);
  delete process.env.WHATSAPP_BUSINESS_PHONE;
  const res = await call('createOrder', { body: payload() });
  assert.equal(res.statusCode, 503);
  assert.equal(state.orders.length, 0);
  assert.equal(state.products.get(productId).stock, 5);
});

test('contacto y pago registran responsable y fecha sin duplicar eventos en reintentos', async () => {
  const order = addOrder();
  const req = { params: { id: order._id }, session: { user: { id: 'admin-1' } } };
  await call('confirmWhatsappContact', req);
  await call('confirmWhatsappContact', req);
  assert.equal(order.paymentStatus, 'pending');
  await confirmPayment(order);
  const firstDate = order.paymentConfirmedAt;
  await confirmPayment(order);
  assert.equal(order.paymentConfirmedBy, 'admin-1');
  assert.equal(order.paymentConfirmedAt, firstDate);
  assert.deepEqual(
    order.events.map((event) => event.type),
    ['contact_confirmed', 'payment_confirmed'],
  );
});

test('un pedido vencido no admite pago aunque el cron todavía no haya corrido', async () => {
  const order = addOrder({ createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) });
  assert.equal((await confirmPayment(order)).statusCode, 409);
  assert.equal(order.paymentStatus, 'pending');
});

test('cancelar devuelve inventario una sola vez y registra al administrador', async () => {
  addProduct(productId, 3);
  const order = addOrder({ items: [{ product: productId, quantity: 2, inventoryReserved: true }] });
  const req = { params: { id: order._id }, session: { user: { id: 'admin-1' } } };
  assert.equal((await call('cancelWhatsappOrder', req)).statusCode, 200);
  assert.equal((await call('cancelWhatsappOrder', req)).statusCode, 200);
  assert.equal(state.products.get(productId).stock, 5);
  assert.equal(order.events.length, 1);
  assert.equal(order.events[0].actor, 'admin-1');
  assert.equal(order.events[0].type, 'cancelled');
});

test('un pedido pagado no se vence ni devuelve inventario', async () => {
  addProduct(productId, 3);
  const order = addOrder({ items: [{ product: productId, quantity: 2, inventoryReserved: true }] });
  await confirmPayment(order);
  assert.equal(await expireOrders(order), 0);
  assert.equal(state.products.get(productId).stock, 3);
  assert.equal(order.paymentStatus, 'paid');
});

test('pago y cancelación concurrentes no dejan un pedido pagado con stock restituido', async () => {
  addProduct(productId, 3);
  const order = addOrder({ items: [{ product: productId, quantity: 2, inventoryReserved: true }] });
  const req = { params: { id: order._id }, session: { user: { id: 'admin-1' } } };
  await Promise.all([confirmPayment(order), call('cancelWhatsappOrder', req)]);
  if (order.paymentStatus === 'paid') {
    assert.equal(order.inventoryRestored, false);
    assert.equal(state.products.get(productId).stock, 3);
  } else {
    assert.equal(order.paymentStatus, 'failed');
    assert.equal(order.inventoryRestored, true);
    assert.equal(state.products.get(productId).stock, 5);
  }
  assert.equal(order.events.length, 1);
});

test('solo permite un intento nuevo tras completar la restitución del anterior', async () => {
  addProduct(productId, 5);
  await call('createOrder', { body: payload() });
  const order = state.orders[0];
  await call('cancelWhatsappOrder', { params: { id: order._id } });
  const retry = await call('createOrder', { body: payload() });
  assert.equal(retry.statusCode, 409);
  assert.equal(retry.body.checkoutRetryAllowed, true);
  assert.equal(state.products.get(productId).stock, 5);
});

test('el avance de envío registra actor y no permite saltarse estados', async () => {
  const order = addOrder({ paymentStatus: 'paid', status: 'processing' });
  const req = {
    params: { id: order._id },
    session: { user: { id: 'admin-1' } },
    body: { status: 'completed' },
  };
  assert.equal((await call('updateOrderStatus', req)).statusCode, 409);
  req.body.status = 'shipped';
  assert.equal((await call('updateOrderStatus', req)).statusCode, 200);
  assert.equal((await call('updateOrderStatus', req)).statusCode, 200);
  assert.deepEqual(
    order.events.map((event) => [event.type, event.actor]),
    [['shipped', 'admin-1']],
  );
});
