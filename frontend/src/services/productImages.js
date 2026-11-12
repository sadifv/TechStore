import { backendAssetUrl } from './api.js';

// The same reference photo already used by the catalog, served locally at three sizes.
// Unknown images keep their original URL, including administrator uploads.
export function productImageSources(image) {
  const src = backendAssetUrl(image || '/images/products/catalog-fallback.jpg');
  let knownLaptop = false;
  try {
    const url = new URL(src);
    knownLaptop =
      url.origin === 'https://images.unsplash.com' &&
      url.pathname === '/photo-1593642632823-8f785ba67e45';
  } catch {
    // Local paths need no URL transformation.
  }
  if (!knownLaptop) return { src };
  return {
    src: '/images/products/dell-xps-reference-960.webp',
    srcSet: [480, 768, 960]
      .map((width) => `/images/products/dell-xps-reference-${width}.webp ${width}w`)
      .join(', '),
  };
}
