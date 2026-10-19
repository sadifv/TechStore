const readNumber = (name, fallback, minimum, maximum = Number.MAX_SAFE_INTEGER) => {
  const configuredValue = process.env[name];
  if (configuredValue === undefined || configuredValue === '') return fallback;

  const value = Number(configuredValue);
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${name} debe ser un número entre ${minimum} y ${maximum}.`);
  }
  return value;
};

const getMembershipConfig = () => ({
  monthlyPrice: Number(readNumber('VIP_MONTHLY_PRICE', 4.99, 0.01).toFixed(2)),
  couponMinOrder: Number(readNumber('VIP_COUPON_MIN_ORDER', 50, 0).toFixed(2)),
  welcomeDiscountPercent: readNumber('VIP_WELCOME_DISCOUNT_PERCENT', 15, 1, 100),
  welcomeMaxDiscount: Number(readNumber('VIP_WELCOME_MAX_DISCOUNT', 10, 0.01).toFixed(2)),
  monthlyDiscountPercent: readNumber('VIP_MONTHLY_DISCOUNT_PERCENT', 10, 1, 100),
  monthlyMaxDiscount: Number(readNumber('VIP_MONTHLY_MAX_DISCOUNT', 8, 0.01).toFixed(2)),
});

module.exports = { getMembershipConfig };
