const saleExpired = (product, now) =>
  product.flashSale && new Date(product.flashSaleEndsAt).getTime() <= now;
const getEffectivePrice = (product, now = Date.now()) =>
  saleExpired(product, now) && product.originalPrice != null
    ? product.originalPrice
    : product.price;
const toPublicProduct = (product, now = Date.now()) => {
  // Aggregations bypass Mongoose select:false. Only explicit catalog fields
  // may cross the public boundary, regardless of how the document was loaded.
  const publicProduct = Object.fromEntries(
    [
      '_id',
      'name',
      'description',
      'price',
      'image',
      'category',
      'stock',
      'availableStock',
      'flashSale',
      'flashSaleDiscount',
      'flashSaleEndsAt',
      'originalPrice',
      'createdAt',
      'updatedAt',
    ]
      .filter((key) => Object.hasOwn(product, key))
      .map((key) => [key, product[key]]),
  );
  if (Array.isArray(product.specifications)) {
    publicProduct.specifications = product.specifications
      .filter((pair) => pair && typeof pair.name === 'string' && typeof pair.value === 'string')
      .map(({ name, value }) => ({ name, value }));
  }
  if (!saleExpired(product, now)) return publicProduct;
  return {
    ...publicProduct,
    price: getEffectivePrice(product, now),
    flashSale: false,
    flashSaleDiscount: 0,
    flashSaleEndsAt: null,
    originalPrice: null,
  };
};
module.exports = { getEffectivePrice, toPublicProduct };
