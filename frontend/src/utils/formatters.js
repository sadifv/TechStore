const usd = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
export const money = (value) => usd.format(Number.isFinite(Number(value)) ? Number(value) : 0);
export const date = (value, options = { year: 'numeric', month: 'short', day: 'numeric' }) =>
  value ? new Intl.DateTimeFormat('es-EC', options).format(new Date(value)) : 'N/A';
