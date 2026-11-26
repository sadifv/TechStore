import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pcCompatibility } from '../../src/features/catalog/pcParts.js';

const part = (fields) => ({
  specifications: Object.entries(fields).map(([name, value]) => ({ name, value })),
});

test('comprueba la longitud de la gráfica y comunica cuando falta una medida', () => {
  const Gabinete = part({ 'Longitud máxima de gráfica (mm)': '320' });
  const Gráfica = part({ Dimensiones: '320 × 120 × 42 mm' });
  assert.deepEqual(pcCompatibility({ Gabinete, Gráfica }), []);
  assert.match(
    pcCompatibility({ Gabinete, Gráfica: part({ 'Longitud (mm)': '321' }) })[0],
    /supera la longitud/,
  );
  assert.match(pcCompatibility({ Gabinete, Gráfica: part({}) })[0], /Por confirmar/);
});

test('un socket coincidente no certifica la BIOS de una placa genérica', () => {
  const cpu = part({ Socket: 'AM5' });
  assert.match(
    pcCompatibility({ Procesador: cpu, 'Placa madre': part({ Socket: 'AM5' }) })[0],
    /modelo exacto de placa, versión de BIOS/,
  );
});
