import { createContext, useContext } from 'react';

export const CartStateContext = createContext(null);
export const CartActionsContext = createContext(null);

export function useCartState() {
  const context = useContext(CartStateContext);
  if (!context) throw new Error('useCartState debe usarse dentro de CartProvider');
  return context;
}

export function useCartActions() {
  const context = useContext(CartActionsContext);
  if (!context) throw new Error('useCartActions debe usarse dentro de CartProvider');
  return context;
}
