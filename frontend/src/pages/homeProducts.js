export function normalizeHomeProducts(result) {
  return {
    products: Array.isArray(result?.products) ? result.products.slice(0, 8) : [],
    flashSale: result?.flashSale || null,
  };
}
