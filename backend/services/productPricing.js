const saleExpired = (product, now) =>
  product.flashSale && new Date(product.flashSaleEndsAt).getTime() <= now;
const getEffectivePrice = (product, now = Date.now()) =>
  saleExpired(product, now) && product.originalPrice != null
    ? product.originalPrice
    : product.price;
const toPublicProduct = (product, now = Date.now()) => {
  if (!saleExpired(product, now)) return { ...product };
  return {
    ...product,
    price: getEffectivePrice(product, now),
    flashSale: false,
    flashSaleDiscount: 0,
    flashSaleEndsAt: null,
    originalPrice: null,
  };
};
module.exports = { getEffectivePrice, toPublicProduct };
