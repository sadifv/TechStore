export const money = (value) => `$${Number(value || 0).toFixed(2)}`;
export const date = (value, options = { year: 'numeric', month: 'short', day: 'numeric' }) =>
  value ? new Intl.DateTimeFormat('es-EC', options).format(new Date(value)) : 'N/A';
