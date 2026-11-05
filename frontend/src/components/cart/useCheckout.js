import { useRef, useState } from 'react';
import { submitWhatsappCheckout } from '../../features/cart/whatsappCheckout.js';
import { checkoutAddressPayload } from '../account/checkoutAddress.js';
import { requestJson } from '../../services/api.js';

export function useCheckout(user, items) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const submittingCheckout = useRef(false);
  const checkout = async (event) => {
    event.preventDefault();
    if (submittingCheckout.current) return;
    submittingCheckout.current = true;
    setBusy(true);
    setStatus('');

    const form = new FormData(event.currentTarget);
    const payload = {
      ...checkoutAddressPayload(form),
      couponCode: String(form.get('couponCode') || '').trim(),
      items: items.map(({ id, quantity }) => ({ productId: id, quantity })),
    };
    if (!user)
      payload.guestInfo = {
        name: String(form.get('guestName') || '').trim(),
        email: String(form.get('guestEmail') || '').trim(),
      };
    try {
      await submitWhatsappCheckout({
        payload,
        storage: sessionStorage,
        newId: () => crypto.randomUUID(),
        openWindow: () => window.open('', '_blank'),
        request: (body) =>
          requestJson('/api/orders/checkout', { method: 'POST', body: JSON.stringify(body) }),
        navigate: (url) => location.assign(url),
      });
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
      submittingCheckout.current = false;
    }
  };

  return { busy, status, setStatus, checkout };
}
