import { useId, useRef, useState } from 'react';

export default function ComplementFields({ complements, disabled }) {
  const prefix = useId();
  const nextId = useRef(complements?.length ?? 0);
  const focus = useRef(null);
  const [rows, setRows] = useState(() =>
    (complements ?? []).map(({ name, reason }, id) => ({ id, name, reason: reason ?? '' })),
  );

  function updateRow(id, value) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...value } : row)));
  }

  function focusPending(element, target) {
    if (element && focus.current === target) {
      focus.current = null;
      element.focus();
    }
  }

  return (
    <fieldset
      className="specification-fields"
      disabled={disabled}
      aria-describedby={`${prefix}-help`}
    >
      <legend>Complementos recomendados</legend>
      <p id={`${prefix}-help`}>
        Elige hasta tres productos por su nombre en el catálogo. Puedes explicar para qué sirve cada uno.
      </p>
      {(complements || rows.length > 0) && (
        <input
          type="hidden"
          name="complementDetails"
          value={JSON.stringify(rows.map(({ name, reason }) => ({ name, reason })))}
        />
      )}
      {rows.map((row, index) => (
        <fieldset className="specification-row" key={row.id}>
          <legend>Complemento {index + 1}</legend>
          <p className="form-field">
            <label htmlFor={`${prefix}-name-${row.id}`}>Nombre del producto</label>
            <input
              id={`${prefix}-name-${row.id}`}
              value={row.name}
              required
              maxLength={100}
              ref={(element) => focusPending(element, row.id)}
              onChange={(event) => updateRow(row.id, { name: event.target.value })}
            />
          </p>
          <p className="form-field">
            <label htmlFor={`${prefix}-reason-${row.id}`}>Motivo de la recomendación (opcional)</label>
            <input
              id={`${prefix}-reason-${row.id}`}
              value={row.reason}
              maxLength={160}
              onChange={(event) => updateRow(row.id, { reason: event.target.value })}
            />
          </p>
          <button
            type="button"
            className="btn btn-outline"
            aria-label={`Eliminar complemento ${index + 1}`}
            onClick={() => {
              focus.current = 'add';
              setRows((current) => current.filter(({ id }) => id !== row.id));
            }}
          >
            Eliminar
          </button>
        </fieldset>
      ))}
      <button
        ref={(element) => focusPending(element, 'add')}
        type="button"
        className="btn btn-secondary"
        disabled={rows.length >= 3}
        onClick={() => {
          const id = nextId.current++;
          focus.current = id;
          setRows((current) => [...current, { id, name: '', reason: '' }]);
        }}
      >
        Añadir complemento
      </button>
    </fieldset>
  );
}
