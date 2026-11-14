import { useCallback, useContext, useEffect, useRef } from 'react';
import { ConfirmationContext } from '../components/dialogs/ConfirmationContext.js';

export default function useConfirmation({ title, confirmLabel, danger = false } = {}) {
  const context = useContext(ConfirmationContext);
  const owner = useRef(Symbol('confirmation-owner'));
  if (!context) throw new Error('Falta ConfirmationProvider');
  const { ask, cancel } = context;
  useEffect(() => {
    const token = owner.current;
    return () => cancel(token);
  }, [cancel]);
  return useCallback(
    (message, options = {}) =>
      ask({ title, confirmLabel, danger, message, ...options }, owner.current),
    [ask, title, confirmLabel, danger],
  );
}
