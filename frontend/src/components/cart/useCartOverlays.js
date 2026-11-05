import { useEffect, useRef } from 'react';
import { trapTabKey } from '../dialogs/modalFocus.js';

export function useCartOverlays(drawerOpen, checkoutOpen, setDrawerOpen) {
  const checkoutDialog = useRef(null);
  const cartDrawer = useRef(null);
  const drawerReturnFocus = useRef(null);
  useEffect(() => {
    const dialog = checkoutDialog.current;
    if (!dialog) return;
    if (checkoutOpen && !dialog.open) dialog.showModal();
    if (!checkoutOpen && dialog.open) dialog.close();
  }, [checkoutOpen]);
  useEffect(() => {
    const drawer = cartDrawer.current;
    if (!drawer) return undefined;
    if (drawerOpen) {
      if (!drawer.contains(document.activeElement))
        drawerReturnFocus.current = document.activeElement;
      drawer.querySelector('#cart-close-btn')?.focus();
      const handleKeyDown = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          setDrawerOpen(false);
          return;
        }
        const focusable = drawer
          .querySelector('.cart-drawer-content')
          ?.querySelectorAll(
            'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          );
        trapTabKey(event, Array.from(focusable || []), document.activeElement);
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
    if (!checkoutOpen && drawerReturnFocus.current?.isConnected) {
      drawerReturnFocus.current.focus();
      drawerReturnFocus.current = null;
    }
    return undefined;
  }, [drawerOpen, checkoutOpen, setDrawerOpen]);
  return { checkoutDialog, cartDrawer };
}
