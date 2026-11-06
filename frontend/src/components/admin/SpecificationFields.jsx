import { useId, useRef, useState } from 'react';

export default function SpecificationFields({ specifications = [], disabled }) {
  const prefix = useId();
  const nextId = useRef(specifications.length);
  const pendingFocus = useRef(null);
  const [rows, setRows] = useState(() => specifications.map((pair, id) => ({ ...pair, id })));

  function changeRow(id, field, value) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  }

  return (
    <>
      <input
        type="hidden"
        name="specifications"
        value={JSON.stringify(rows.map(({ name, value }) => ({ name, value })))}
      />
      <fieldset
        className="specification-fields"
        disabled={disabled}
        aria-describedby={`${prefix}-help`}
      >
        <legend>Especificaciones técnicas</legend>
        <p id={`${prefix}-help`}>
          Opcional: hasta 20 características de texto plano, sin nombres repetidos.
        </p>
        {rows.map((row, index) => (
          <fieldset className="specification-row" key={row.id}>
            <legend>Característica {index + 1}</legend>
            <p className="form-field">
              <label htmlFor={`${prefix}-name-${row.id}`}>
                Nombre de característica {index + 1}
              </label>
              <input
                id={`${prefix}-name-${row.id}`}
                value={row.name}
                required
                maxLength={40}
                ref={(element) => {
                  if (element && pendingFocus.current === row.id) {
                    pendingFocus.current = null;
                    element.focus();
                  }
                }}
                onChange={(event) => changeRow(row.id, 'name', event.target.value)}
              />
            </p>
            <p className="form-field">
              <label htmlFor={`${prefix}-value-${row.id}`}>
                Valor de característica {index + 1}
              </label>
              <input
                id={`${prefix}-value-${row.id}`}
                value={row.value}
                required
                maxLength={200}
                onChange={(event) => changeRow(row.id, 'value', event.target.value)}
              />
            </p>
            <button
              type="button"
              className="btn btn-outline"
              aria-label={`Eliminar característica ${index + 1}`}
              onClick={() => {
                pendingFocus.current = 'add';
                setRows((current) => current.filter((pair) => pair.id !== row.id));
              }}
            >
              Eliminar
            </button>
          </fieldset>
        ))}
        <button
          ref={(element) => {
            if (element && pendingFocus.current === 'add') {
              pendingFocus.current = null;
              element.focus();
            }
          }}
          type="button"
          className="btn btn-secondary"
          disabled={rows.length >= 20}
          onClick={() => {
            const id = nextId.current++;
            pendingFocus.current = id;
            setRows((current) => [...current, { id, name: '', value: '' }]);
          }}
        >
          Añadir característica
        </button>
        <p role="status" className="specification-count">
          {rows.length} de 20 características
        </p>
      </fieldset>
    </>
  );
}
