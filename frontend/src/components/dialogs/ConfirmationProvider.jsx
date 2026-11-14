import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmationContext } from './ConfirmationContext.js';
import { trapTabKey } from './modalFocus.js';

export default function ConfirmationProvider({ children }) {
  const [request, setRequest] = useState(null);
  const pending = useRef(null);
  const dialog = useRef(null);
  const cancelButton = useRef(null);
  const finish = useCallback((accepted) => {
    const current = pending.current;
    if (!current) return;
    pending.current = null;
    dialog.current?.close();
    setRequest(null);
    const trigger = current.trigger;
    if (trigger?.isConnected && trigger.getClientRects().length && !trigger.disabled)
      trigger.focus({ preventScroll: true });
    current.resolve(accepted);
  }, []);
  const ask = useCallback((options, owner) => {
    // Ignore a repeated click rather than queueing a second destructive action.
    if (pending.current) return Promise.resolve(false);
    return new Promise((resolve) => {
      const next = { ...options, owner, resolve, trigger: document.activeElement };
      pending.current = next;
      setRequest(next);
    });
  }, []);
  const cancel = useCallback(
    (owner) => {
      if (pending.current?.owner === owner) finish(false);
    },
    [finish],
  );
  useEffect(() => {
    if (!request) return;
    dialog.current.showModal();
    cancelButton.current?.focus({ preventScroll: true });
  }, [request]);
  useEffect(
    () => () => {
      pending.current?.resolve(false);
      pending.current = null;
    },
    [],
  );
  const value = useMemo(() => ({ ask, cancel }), [ask, cancel]);
  return (
    <ConfirmationContext value={value}>
      {children}
      <dialog
        ref={dialog}
        className="confirmation-dialog"
        aria-labelledby="confirmation-title"
        aria-describedby="confirmation-description"
        onKeyDown={(event) =>
          trapTabKey(
            event,
            [...event.currentTarget.querySelectorAll('button')],
            document.activeElement,
          )
        }
        onCancel={(event) => {
          event.preventDefault();
          finish(false);
        }}
      >
        {request && (
          <article className="confirmation-card">
            <header>
              <p className="confirmation-eyebrow">
                {request.danger ? 'Confirma esta acción' : 'Antes de continuar'}
              </p>
              <h2 id="confirmation-title">{request.title || '¿Quieres continuar?'}</h2>
            </header>
            <p id="confirmation-description">{request.message}</p>
            <footer className="confirmation-actions">
              <button
                ref={cancelButton}
                type="button"
                className="btn btn-outline"
                onClick={() => finish(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={request.danger ? 'btn confirmation-danger' : 'btn btn-primary'}
                onClick={() => finish(true)}
              >
                {request.confirmLabel || 'Continuar'}
              </button>
            </footer>
          </article>
        )}
      </dialog>
    </ConfirmationContext>
  );
}
