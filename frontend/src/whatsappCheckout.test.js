import assert from 'node:assert/strict';
import { test } from 'node:test';
import { submitWhatsappCheckout } from './whatsappCheckout.js';
const setup = () => {
  const values = new Map();
  let nextId = 0;
  return {
    payload: { items: [{ productId: 'abc', quantity: 1 }] },
    storage: {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
    newId: () => String(++nextId),
    openWindow: () => null,
    request: async () => ({
      orderId: 'order-1',
      whatsappUrl: 'https://wa.me/593963976623?text=Pedido',
    }),
    navigate() {},
  };
};
test('con ventana bloqueada conserva enlace y navega a la confirmación para reabrir WhatsApp', async () => {
  const options = setup();
  let destination;
  options.navigate = (url) => {
    destination = url;
  };
  await submitWhatsappCheckout(options);
  assert.equal(destination, '/pedido-enviado?orderId=order-1');
  assert.match(options.storage.getItem('techstore.whatsapp.order-1'), /^https:\/\/wa.me/);
  assert.equal(options.storage.getItem('techstore.orderAccess.order-1'), '1');
});
test('reintentar después de un error conserva la clave y cierra la ventana vacía', async () => {
  const options = setup();
  const keys = [];
  let closed = 0;
  options.openWindow = () => ({
    close() {
      closed++;
    },
  });
  options.request = async (payload) => {
    keys.push(payload.checkoutKey);
    throw new Error('Respuesta perdida');
  };
  await assert.rejects(submitWhatsappCheckout(options), /Respuesta perdida/);
  await assert.rejects(submitWhatsappCheckout(options), /Respuesta perdida/);
  assert.equal(keys[0], keys[1]);
  assert.equal(closed, 2);
});
test('abre el mensaje sin afirmar que el cliente lo envió y cambia clave si cambia el carrito', async () => {
  const options = setup();
  const popup = {};
  const keys = [];
  options.openWindow = () => popup;
  options.request = async (payload) => {
    keys.push(payload.checkoutKey);
    return { orderId: 'order-1', whatsappUrl: 'https://wa.me/593963976623?text=Pedido' };
  };
  await submitWhatsappCheckout(options);
  assert.equal(popup.opener, null);
  assert.match(popup.location, /wa.me/);
  options.payload.items[0].quantity = 2;
  await submitWhatsappCheckout(options);
  assert.notEqual(keys[0], keys[1]);
});

test('renueva la clave solo cuando el servidor confirma que liberó el pedido fallido', async () => {
  const options = setup();
  const keys = [];
  options.request = async (payload) => {
    keys.push(payload.checkoutKey);
    throw Object.assign(new Error('Reserva liberada'), { checkoutRetryAllowed: true });
  };
  await assert.rejects(submitWhatsappCheckout(options), /Reserva liberada/);
  await assert.rejects(submitWhatsappCheckout(options), /Reserva liberada/);
  assert.notEqual(keys[0], keys[1]);
});
