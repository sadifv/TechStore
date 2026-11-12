import assert from 'node:assert/strict';
import { test } from 'node:test';
import { productImageSources } from '../../src/services/productImages.js';

test('la foto conocida del portátil usa versiones locales sin cambiar de producto', () => {
  const sources = productImageSources(
    'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=800&q=80',
  );
  assert.equal(sources.src, '/images/products/dell-xps-reference-960.webp');
  assert.match(sources.srcSet, /480w.*768w.*960w/);
});

test('las subidas y las fotos nuevas conservan su origen y no reciben variantes inventadas', () => {
  for (const image of [
    '/uploads/image-id',
    '/images/products/shure-sm7b-ref.jpg',
    'https://example.invalid/photo.jpg',
    'https://example.invalid/photo-1593642632823-8f785ba67e45',
  ]) {
    assert.deepEqual(productImageSources(image), { src: image });
  }
  assert.deepEqual(productImageSources(null), { src: '/images/products/catalog-fallback.jpg' });
});
