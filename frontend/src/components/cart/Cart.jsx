import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CartActionsContext, CartStateContext } from './CartContext.js';
import CartDrawer from './CartDrawer.jsx';
import CheckoutDialog from './CheckoutDialog.jsx';
import { useCartItems } from './useCartItems.js';
import { useCheckout } from './useCheckout.js';
import { useCartOverlays } from './useCartOverlays.js';

export function CartProvider({ user, children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const notify = useCallback((message, type = 'info') => {
    setToast({ message, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const { items, add, remove, setQuantity, refresh, reconcileGuestItems } = useCartItems(
    user,
    notify,
  );
  const { busy, status, setStatus, checkout } = useCheckout(user, items);
  const { checkoutDialog, cartDrawer } = useCartOverlays(drawerOpen, checkoutOpen, setDrawerOpen);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const stateValue = useMemo(
    () => ({
      items,
      count: items.reduce((total, item) => total + item.quantity, 0),
      subtotal,
      drawerOpen,
      checkoutOpen,
    }),
    [items, subtotal, drawerOpen, checkoutOpen],
  );
  const actionsValue = useMemo(
    () => ({
      add,
      setQuantity,
      remove,
      refresh,
      reconcileGuestItems,
      setDrawerOpen,
      setCheckoutOpen,
      notify,
    }),
    [add, setQuantity, remove, refresh, reconcileGuestItems, notify],
  );
  return (
    <CartStateContext.Provider value={stateValue}>
      <CartActionsContext.Provider value={actionsValue}>
        {children}
        <CartDrawer
          cartDrawer={cartDrawer}
          drawerOpen={drawerOpen}
          setDrawerOpen={setDrawerOpen}
          items={items}
          subtotal={subtotal}
          setQuantity={setQuantity}
          remove={remove}
          onCheckout={() => {
            setDrawerOpen(false);
            setStatus('');
            setCheckoutOpen(true);
          }}
        />
        <CheckoutDialog
          checkoutDialog={checkoutDialog}
          checkoutOpen={checkoutOpen}
          setCheckoutOpen={setCheckoutOpen}
          user={user}
          busy={busy}
          status={status}
          subtotal={subtotal}
          checkout={checkout}
        />
        {toast && (
          <section
            id="toast-container"
            className="toast-container"
            aria-live="polite"
            aria-atomic="true"
          >
            <output className={`toast toast-${toast.type} show`} role="status">
              <i
                className={`ri-${toast.type === 'success' ? 'checkbox-circle' : toast.type === 'error' ? 'error-warning' : toast.type === 'warning' ? 'alert' : 'information'}-line`}
                aria-hidden="true"
              />
              <span>{toast.message}</span>
            </output>
          </section>
        )}
      </CartActionsContext.Provider>
    </CartStateContext.Provider>
  );
}
