const envNumber = (name, fallback) => {
  const value = Number(import.meta.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

export const defaultMembershipConfig = {
  monthlyPrice: envNumber('VITE_VIP_MONTHLY_PRICE', 4.99),
  couponMinOrder: envNumber('VITE_VIP_COUPON_MIN_ORDER', 50),
  welcomeDiscountPercent: envNumber('VITE_VIP_WELCOME_DISCOUNT_PERCENT', 15),
  welcomeMaxDiscount: envNumber('VITE_VIP_WELCOME_MAX_DISCOUNT', 10),
  monthlyDiscountPercent: envNumber('VITE_VIP_MONTHLY_DISCOUNT_PERCENT', 10),
  monthlyMaxDiscount: envNumber('VITE_VIP_MONTHLY_MAX_DISCOUNT', 8),
};
