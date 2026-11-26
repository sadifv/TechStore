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
  if (parts.Fuente && parts.Gráfica) {
    if (!isPositiveInteger(power) || !isPositiveInteger(required))
      messages.push('Por confirmar: potencia de la fuente y potencia recomendada para la gráfica.');
    else if (Number(power) < Number(required))
      messages.push('La fuente queda por debajo de la potencia recomendada para la gráfica.');
  }
  if (parts.Gabinete && parts.Gráfica) {
    const clearance = spec(parts.Gabinete, 'Longitud máxima de gráfica (mm)');
    const dimensions = spec(parts.Gráfica, 'Dimensiones');
    const length =
      spec(parts.Gráfica, 'Longitud (mm)') ||
      dimensions.match(/^(\d+)\s*[×x]\s*\d+\s*[×x]\s*\d+\s*mm$/u)?.[1];
    if (!isPositiveInteger(clearance) || !isPositiveInteger(length))
      messages.push('Por confirmar: espacio del gabinete para instalar la gráfica.');
    else if (Number(length) > Number(clearance))
      messages.push('La gráfica supera la longitud máxima admitida por el gabinete.');
  }
  const board = parts['Placa madre'];
  if (parts.Procesador && board) {
    messages.push(
      spec(board, 'Modelo de placa')
        ? 'Por confirmar: versión de BIOS instalada y soporte para este procesador.'
        : 'Por confirmar: modelo exacto de placa, versión de BIOS y soporte del procesador.',
    );
  }
  return messages;
}

function isPositiveInteger(value) {
  return /^[1-9]\d*$/.test(value ?? '') && Number.isSafeInteger(Number(value));
}
