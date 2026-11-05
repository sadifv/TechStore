const attemptKey = 'techstore.checkoutAttempt';
export function checkoutAttempt(payload, storage, newId) {
  const fingerprint = JSON.stringify(payload);
  let previous;
  try {
    previous = JSON.parse(storage.getItem(attemptKey));
  } catch {
    /* Un intento corrupto se reemplaza. */
  }
  if (previous?.fingerprint === fingerprint && previous.key) return previous.key;
  const key = newId();
  storage.setItem(attemptKey, JSON.stringify({ fingerprint, key }));
  return key;
}

export async function submitWhatsappCheckout({
  payload,
  storage,
  newId,
  openWindow,
  request,
  navigate,
}) {
  const popup = openWindow();
  if (popup) popup.opener = null;
  try {
    const checkoutKey = checkoutAttempt(payload, storage, newId);
    const result = await request({ ...payload, checkoutKey });
    if (!/^https:\/\/wa\.me\/\d+\?text=/.test(result.whatsappUrl || '')) {
      throw new Error('No se pudo preparar el mensaje de WhatsApp.');
    }
    storage.setItem(`techstore.whatsapp.${result.orderId}`, result.whatsappUrl);
    storage.setItem(`techstore.orderAccess.${result.orderId}`, checkoutKey);
    if (popup) popup.location = result.whatsappUrl;
    navigate(`/pedido-enviado?orderId=${encodeURIComponent(result.orderId)}`);
  } catch (error) {
    popup?.close();
    if (error.checkoutRetryAllowed) storage.removeItem(attemptKey);
    throw error;
  }
}

export function finishCheckoutAttempt(storage) {
  storage.removeItem(attemptKey);
}
