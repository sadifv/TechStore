import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { requestJson } from '../../services/api.js';
import {
  readGuestCart,
  removeGuestQuantity,
  saveGuestCart,
  syncGuestCartToUser,
} from '../../features/cart/guestCart.js';

const placeholder = '/images/products/catalog-fallback.jpg';

export function useCartItems(user, notify) {
  const [items, setItems] = useState([]);
  const itemsRef = useRef(items);
  const pendingQuantityUpdates = useRef(new Map());
  useLayoutEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const refresh = useCallback(async () => {
    if (!user) {
      const savedItems = readGuestCart();
      const normalizedItems = await Promise.all(
        savedItems.map(async (item) => {
          const id = String(item.id || item.productId || item._id || '');
          let product = null;
          if ((!item.name || item.name === 'Producto') && /^[a-f\d]{24}$/i.test(id)) {
            try {
              product = (await requestJson(`/api/products/${encodeURIComponent(id)}`)).data;
            } catch {
              /* Keep unavailable items removable from the cart. */
            }
          }
          return {
            id,
            name: product?.name || item.name || 'Producto no disponible',
            price: Number(product?.price ?? item.price) || 0,
            image: product?.image || item.image || placeholder,
            quantity: Number(item.quantity) || 1,
            availableStock: product?.availableStock ?? item.availableStock,
            unavailable: !product && (!item.name || item.name === 'Producto'),
          };
        }),
      );
      setItems(normalizedItems);
      return true;
    }
    try {
      const result = await requestJson('/api/cart');
      setItems(
        (result.items || []).map((item) => {
          const product = item.product || {};
          return {
            id: String(item.productId || product._id || item.product || item._id),
            cartItemId: String(item._id || ''),
            name: product.name || 'Producto no disponible',
            price: Number(product.price) || 0,
            image: product.image || placeholder,
            quantity: Number(item.quantity) || 1,
            availableStock: product.availableStock ?? product.stock,
            unavailable: !item.product,
          };
        }),
      );
      return true;
    } catch (error) {
      if (error.status !== 401) console.error('No se pudo cargar el carrito:', error);
      return false;
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    async function loadAndSync() {
      if (!user) {
        await refresh();
        return;
      }
      try {
        const result = await syncGuestCartToUser();
        if (result.failedCount > 0)
          notify(`No se sincronizaron ${result.failedCount} producto(s) del carrito.`, 'warning');
      } catch (error) {
        console.error('No se pudo sincronizar el carrito local:', error);
      }
      if (active) await refresh();
    }
    loadAndSync();
    return () => {
      active = false;
    };
  }, [refresh, user, notify]);
  const add = useCallback(
    async (product, quantity = 1) => {
      const id = String(product._id || product.id);
      if (!id || !Number.isInteger(Number(quantity)) || Number(quantity) < 1) return false;
      if (user) {
        await requestJson('/api/cart/add', {
          method: 'POST',
          body: JSON.stringify({ productId: id, quantity: Number(quantity) }),
        });
        await refresh();
      } else {
        let cart = readGuestCart();
        const index = cart.findIndex(
          (item) => String(item.id || item.productId || item._id) === id,
        );
        const existing = index >= 0 ? Number(cart[index].quantity) || 0 : 0;
        const stock = Number(
          product.availableStock ?? product.stock ?? cart[index]?.availableStock,
        );
        if (Number.isInteger(stock) && existing + Number(quantity) > Math.min(stock, 99))
          throw new Error(`Solo hay ${Math.max(0, stock - existing)} unidades disponibles.`);
        if (index >= 0) cart[index].quantity = existing + Number(quantity);
        else
          cart.push({
            id,
            name: product.name,
            price: Number(product.price) || 0,
            image: product.image || placeholder,
            quantity: Number(quantity),
            availableStock: stock,
          });
        saveGuestCart(cart);
        await refresh();
      }
      return true;
    },
    [refresh, user],
  );

  const remove = useCallback(
    async (id, cartItemId) => {
      if (user) {
        const pendingUpdate = pendingQuantityUpdates.current.get(String(id));
        if (pendingUpdate) await pendingUpdate.promise;
        const removedItem = itemsRef.current.find((item) =>
          cartItemId ? item.cartItemId === String(cartItemId) : item.id === String(id),
        );
        setItems((current) =>
          current.filter((item) =>
            cartItemId ? item.cartItemId !== String(cartItemId) : item.id !== String(id),
          ),
        );
        try {
          const endpoint = cartItemId
            ? `/api/cart/item/${encodeURIComponent(cartItemId)}`
            : `/api/cart/remove/${encodeURIComponent(id)}`;
          await requestJson(endpoint, { method: 'DELETE' });
          await refresh();
        } catch (error) {
          const refreshed = await refresh();
          if (!refreshed && removedItem)
            setItems((current) =>
              current.some((item) => item.cartItemId === removedItem.cartItemId)
                ? current
                : [...current, removedItem],
            );
          notify(error.message, 'error');
        }
        return;
      }
      const remaining = readGuestCart().filter(
        (item) => String(item.id || item.productId || item._id) !== String(id),
      );
      saveGuestCart(remaining);
      setItems((current) => current.filter((item) => item.id !== String(id)));
    },
    [refresh, user, notify],
  );

  const setQuantity = useCallback(
    async (item, quantity) => {
      const id = String(item.id);
      if (quantity < 1) {
        const pendingUpdate = pendingQuantityUpdates.current.get(id);
        if (pendingUpdate) await pendingUpdate.promise;
        return remove(id, item.cartItemId);
      }
      const currentQuantity =
        itemsRef.current.find((entry) => entry.id === id)?.quantity ?? item.quantity;
      setItems((current) =>
        current.map((entry) => (entry.id === id ? { ...entry, quantity } : entry)),
      );
      if (user) {
        let update = pendingQuantityUpdates.current.get(id);
        if (update) {
          update.quantity = quantity;
          return update.promise;
        }

        update = { quantity, originalQuantity: currentQuantity, promise: null };
        pendingQuantityUpdates.current.set(id, update);
        update.promise = (async () => {
          try {
            let savedQuantity;
            while (true) {
              savedQuantity = update.quantity;
              await requestJson(`/api/cart/quantity/${encodeURIComponent(id)}`, {
                method: 'PATCH',
                body: JSON.stringify({ quantity: savedQuantity }),
              });
              if (savedQuantity === update.quantity) {
                await refresh();
                if (savedQuantity === update.quantity) break;
              }
            }
          } catch (error) {
            const refreshed = await refresh();
            if (!refreshed) {
              setItems((current) =>
                current.map((entry) =>
                  entry.id === id ? { ...entry, quantity: update.originalQuantity } : entry,
                ),
              );
            }
            notify(error.message, 'error');
          } finally {
            if (pendingQuantityUpdates.current.get(id) === update)
              pendingQuantityUpdates.current.delete(id);
          }
        })();
        return update.promise;
      } else {
        const cart = readGuestCart().map((entry) =>
          String(entry.id || entry.productId || entry._id) === id ? { ...entry, quantity } : entry,
        );
        saveGuestCart(cart);
      }
    },
    [refresh, user, remove, notify],
  );

  const reconcileGuestItems = useCallback(
    async (purchasedItems) => {
      if (user || !Array.isArray(purchasedItems)) return;
      purchasedItems.forEach((item) => {
        if (item?.productId && Number.isInteger(item.quantity) && item.quantity > 0)
          removeGuestQuantity(String(item.productId), item.quantity);
      });
      await refresh();
    },
    [refresh, user],
  );

  return { items, add, remove, setQuantity, refresh, reconcileGuestItems };
}
