import { useEffect, useState } from 'react';
import { requestJson } from '../../services/api.js';
import AddressFields from './AddressFields.jsx';
export default function CheckoutAddressSelector({ user, open, busy }) {
  const [mode, setMode] = useState('none'),
    [data, setData] = useState(null),
    [selected, setSelected] = useState(''),
    [reload, setReload] = useState(0),
    [error, setError] = useState(''),
    [manual, setManual] = useState({ country: 'Ecuador' });
  useEffect(() => {
    if (!user || !open) return;
    let active = true;
    requestJson('/api/addresses')
      .then((r) => {
        if (active) {
          setData(r.data);
          setSelected((current) =>
            r.data.addresses.some((a) => a._id === current)
              ? current
              : r.data.defaultAddressId || '',
          );
          setError('');
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [user, open, reload]);
  return (
    <fieldset className="form-group customer-form" disabled={busy}>
      <legend>Dirección de entrega (opcional)</legend>
      <label htmlFor="checkout-address-mode">Cómo coordinar la entrega</label>
      <select
        id="checkout-address-mode"
        name="addressMode"
        value={mode}
        onChange={(e) => setMode(e.target.value)}
      >
        <option value="none">Coordinar por WhatsApp sin añadir dirección</option>
        {user && <option value="saved">Elegir una dirección guardada</option>}
        <option value="manual">Usar una dirección puntual</option>
      </select>
      {mode === 'saved' && (
        <>
          {!data && !error && <p role="status">Cargando direcciones…</p>}
          {error && <p role="alert">{error} Puedes reintentar o usar una dirección puntual.</p>}
          <button type="button" className="btn btn-outline" onClick={() => setReload((n) => n + 1)}>
            Actualizar direcciones guardadas
          </button>
          <label htmlFor="checkout-saved-address">Dirección guardada</label>
          <select
            id="checkout-saved-address"
            name="savedAddressId"
            required
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Selecciona una dirección</option>
            {data?.addresses.map((a) => (
              <option key={a._id} value={a._id}>
                {a.label || a.recipient}: {a.street}, {a.city}
              </option>
            ))}
          </select>
          {data?.addresses.length === 0 && (
            <p>
              No tienes direcciones guardadas. Puedes usar una puntual o gestionarlas en{' '}
              <a href="/profile">Mi cuenta</a>.
            </p>
          )}
        </>
      )}
      {mode === 'manual' && (
        <>
          <p>Esta dirección se usará solo en este pedido; no se guardará en tu libreta.</p>
          <AddressFields prefix="checkout-delivery" value={manual} onChange={setManual} />
        </>
      )}
      <p>
        La dirección seleccionada se incluirá en el mensaje de WhatsApp y en la copia del pedido.
      </p>
    </fieldset>
  );
}
