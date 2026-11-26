const extraParts = [
  ['SSD', 'Almacenamiento'],
  ['Fuente', 'Fuente de alimentación'],
  ['Gabinete', 'Gabinete'],
  ['Gráfica', 'Tarjeta gráfica'],
];

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase();
}

export function spec(product, name) {
  return normalize(
    product?.specifications?.find((item) => normalize(item.name) === normalize(name))?.value,
  );
}

export function extraPcSteps(products) {
  if (!products) return [];
  return extraParts.flatMap(([label, type]) => {
    const names = Array.from(products.values())
      .filter(
        (product) =>
          ['componentes', 'almacenamiento'].includes(normalize(product.category)) &&
          spec(product, 'Tipo de pieza') === normalize(type),
      )
      .map((product) => product.name);
    return names.length ? [{ label, names }] : [];
  });
}

export function pcCompatibility(parts) {
  const messages = [];
  const checks = [
    [
      'Procesador',
      'Placa madre',
      'Socket',
      'El socket del procesador y el de la placa no coinciden.',
    ],
    [
      'Memoria RAM',
      'Placa madre',
      'Tipo de memoria',
      'La memoria y la placa usan tipos de RAM distintos.',
    ],
  ];
  for (const [left, right, field, message] of checks) {
    if (!parts[left] || !parts[right]) continue;
    const a = spec(parts[left], field);
    const b = spec(parts[right], field);
    if (!a || !b)
      messages.push(`Por confirmar: ${field} de ${left.toLowerCase()} y ${right.toLowerCase()}.`);
    else if (a !== b) messages.push(message);
  }
  const power = spec(parts.Fuente, 'Potencia (W)');
  const required = spec(parts.Gráfica, 'Fuente recomendada (W)');
  if (/^\d+$/.test(power) && /^\d+$/.test(required) && Number(power) < Number(required))
    messages.push('La fuente queda por debajo de la potencia recomendada para la gráfica.');
  return messages;
}
