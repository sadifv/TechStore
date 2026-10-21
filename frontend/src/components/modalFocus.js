export function trapTabKey(event, focusableElements, activeElement) {
  if (event.key !== 'Tab' || focusableElements.length === 0) return false;

  const first = focusableElements[0];
  const last = focusableElements[focusableElements.length - 1];
  const activeIndex = focusableElements.indexOf(activeElement);
  if (event.shiftKey && (activeIndex === 0 || activeIndex === -1)) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && (activeIndex === focusableElements.length - 1 || activeIndex === -1)) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}

export function focusVisibleElement(element) {
  if (!element?.isConnected || element.closest?.('[inert], [aria-hidden="true"]')) return false;
  if (typeof element.getClientRects === 'function' && element.getClientRects().length === 0)
    return false;
  element.focus();
  return true;
}

export function restoreCartFocus(documentRef = document) {
  const cartButton = documentRef.getElementById('cart-btn');
  return focusVisibleElement(cartButton);
}
