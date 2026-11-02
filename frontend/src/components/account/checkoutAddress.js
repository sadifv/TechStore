export function checkoutAddressPayload(form) {
  const mode = form.get('addressMode');
  if (mode === 'saved') return { savedAddressId: String(form.get('savedAddressId') || '') };
  if (mode === 'manual')
    return {
      shippingAddress: Object.fromEntries(
        ['recipient', 'street', 'city', 'country', 'reference'].map((key) => [
          key,
          String(form.get(key) || '').trim(),
        ]),
      ),
    };
  return {};
}
