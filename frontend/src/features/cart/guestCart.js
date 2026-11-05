export const GUEST_CART_KEY = 'techstore_guest_cart';

export function readGuestCart(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage.getItem(GUEST_CART_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function saveGuestCart(items, storage = globalThis.localStorage) {
  if (items.length) storage.setItem(GUEST_CART_KEY, JSON.stringify(items));
  else storage.removeItem(GUEST_CART_KEY);
}

export function removeGuestQuantity(productId, quantity, storage = globalThis.localStorage) {
  const cart = readGuestCart(storage);
  const index = cart.findIndex(
    (item) => String(item.id || item.productId || item._id) === String(productId),
  );
  if (index < 0) return cart;
  const remaining = (Number(cart[index].quantity) || 1) - quantity;
  if (remaining > 0) cart[index].quantity = remaining;
  else cart.splice(index, 1);
  saveGuestCart(cart, storage);
  return cart;
}

export function removePurchasedGuestCartItems(purchasedItems, storage = globalThis.localStorage) {
  if (!Array.isArray(purchasedItems)) return readGuestCart(storage);
  for (const item of purchasedItems) {
    if (item?.productId && Number.isInteger(item.quantity) && item.quantity > 0) {
      removeGuestQuantity(item.productId, item.quantity, storage);
    }
  }
  return readGuestCart(storage);
}

export async function syncGuestCartToUser(
  fetcher = globalThis.fetch,
  storage = globalThis.localStorage,
) {
  const cart = readGuestCart(storage);
  if (!cart.length) return { syncedCount: 0, failedCount: 0 };
  const getCart = async () => {
    const response = await fetcher('/api/cart', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    const data = await response.json();
    if (!response.ok || !data.success || !Array.isArray(data.items))
      throw new Error(data.error || 'No se pudo consultar el carrito de la cuenta.');
    return new Map(
      data.items.map((item) => [
        String(item.product?._id || item.product || item.productId),
        Number(item.quantity) || 0,
      ]),
    );
  };

  let quantities;
  try {
    quantities = await getCart();
  } catch {
    return { syncedCount: 0, failedCount: cart.length };
  }
  let syncedCount = 0;
  let failedCount = 0;
  for (const item of cart) {
    const id = String(item?.id || item?.productId || item?._id || '');
    const quantity = Number(item?.quantity || 1);
    if (!id || id === 'undefined' || id === 'null' || !Number.isInteger(quantity) || quantity < 1) {
      failedCount += 1;
      continue;
    }
    const before = quantities.get(id) || 0;
    try {
      const response = await fetcher('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ productId: id, quantity }),
      });
      const data = await response.json();
      if (!response.ok || !data.success)
        throw new Error(data.error || 'No se pudo añadir el producto.');
      removeGuestQuantity(id, quantity, storage);
      quantities.set(id, before + quantity);
      syncedCount += 1;
    } catch {
      try {
        const latest = await getCart();
        if ((latest.get(id) || 0) >= before + quantity) {
          removeGuestQuantity(id, quantity, storage);
          syncedCount += 1;
        } else failedCount += 1;
        quantities = latest;
      } catch {
        failedCount += 1;
      }
    }
  }
  return { syncedCount, failedCount };
}
