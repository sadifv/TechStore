const fields = [
  ['label', 'Etiqueta (opcional)', 40, false, 'off'],
  ['recipient', 'Destinatario', 100, true, 'shipping name'],
  ['street', 'Calle y detalle de entrega', 200, true, 'shipping street-address'],
  ['city', 'Ciudad', 100, true, 'shipping address-level2'],
  ['country', 'País', 80, true, 'shipping country-name'],
  ['reference', 'Referencia (opcional)', 200, false, 'off'],
];
export default function AddressFields({ value, onChange, prefix = 'address' }) {
  return (
    <>
      {fields.map(([name, label, maxLength, required, autoComplete]) => (
        <label key={name} htmlFor={`${prefix}-${name}`}>
          {label}
          <input
            id={`${prefix}-${name}`}
            name={name}
            value={value[name] || ''}
            onChange={(e) => onChange({ ...value, [name]: e.target.value })}
            maxLength={maxLength}
            minLength={required ? (name === 'street' ? 3 : 2) : undefined}
            required={required}
            autoComplete={autoComplete}
          />
        </label>
      ))}
    </>
  );
}
