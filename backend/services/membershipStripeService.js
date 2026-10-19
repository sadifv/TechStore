const crypto = require('crypto');
const mongoose = require('mongoose');
const Coupon = require('../models/Coupon');
const Membership = require('../models/Membership');
const stripe = require('../config/stripe');
const { getMembershipConfig } = require('../config/membershipConfig');

const getStripeId = (value) => (typeof value === 'string' ? value : value?.id);
const toDate = (timestamp) => (Number.isFinite(timestamp) ? new Date(timestamp * 1000) : undefined);

const getCouponCode = (membershipId, type, periodStart) => {
  const seed = `${membershipId}:${type}:${periodStart || 'welcome'}`;
  const digest = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 16).toUpperCase();
  return `${type === 'welcome' ? 'VIPBIENV' : 'VIPMES'}-${digest}`;
};

const createMembershipCoupon = async (membership, type, periodStart, periodEnd) => {
  const code = getCouponCode(membership._id, type, periodStart);
  const existingCoupon = await Coupon.findOne({ code });
  if (existingCoupon) return existingCoupon;

  const config = getMembershipConfig();
  const isWelcomeCoupon = type === 'welcome';
  const couponData = {
    code,
    type,
    allowedUser: membership.user,
    membership: membership._id,
    minOrderAmount: config.couponMinOrder,
    active: true,
    startsAt: periodStart || new Date(),
    expiresAt: periodEnd,
    maxRedemptions: 1,
    discountPercent: isWelcomeCoupon
      ? config.welcomeDiscountPercent
      : config.monthlyDiscountPercent,
    maxDiscountAmount: isWelcomeCoupon ? config.welcomeMaxDiscount : config.monthlyMaxDiscount,
    description: isWelcomeCoupon ? 'Cupón de bienvenida VIP' : 'Cupón mensual VIP',
  };

  try {
    return await Coupon.create(couponData);
  } catch (error) {
    if (error.code !== 11000) throw error;
    const concurrentlyCreatedCoupon = await Coupon.findOne({ code });
    if (!concurrentlyCreatedCoupon) throw error;
    return concurrentlyCreatedCoupon;
  }
};

const syncMembershipCoupons = async (membership, periodStart, periodEnd) => {
  const welcomeCoupon = membership.welcomeCouponCode
    ? null
    : await createMembershipCoupon(membership, 'welcome', null, periodEnd);
  const monthlyCoupon = await createMembershipCoupon(membership, 'monthly', periodStart, periodEnd);
  const updates = {};
  if (welcomeCoupon) updates.welcomeCouponCode = welcomeCoupon.code;
  if (monthlyCoupon.code !== membership.monthlyCouponCode) {
    updates.monthlyCouponCode = monthlyCoupon.code;
  }
  if (Object.keys(updates).length) {
    await Membership.updateOne({ _id: membership._id }, { $set: updates });
  }
};

const getMembershipForSubscription = async (subscription) => {
  const membershipId = subscription.metadata?.membershipId;
  const subscriptionId = getStripeId(subscription);
  if (membershipId && mongoose.isValidObjectId(membershipId)) {
    const membership = await Membership.findById(membershipId);
    if (
      membership?.provider === 'stripe' &&
      (!membership.stripeSubscriptionId || membership.stripeSubscriptionId === subscriptionId) &&
      (membership.stripeSubscriptionId ||
        membership.stripeCheckoutAttemptId === subscription.metadata?.checkoutAttemptId)
    ) {
      return membership;
    }
  }
  return subscriptionId ? Membership.findOne({ stripeSubscriptionId: subscriptionId }) : null;
};

const syncStripeSubscription = async (subscription, statusOverride) => {
  const membership = await getMembershipForSubscription(subscription);
  if (!membership || membership.provider !== 'stripe') return null;

  const subscriptionStatus = statusOverride || subscription.status;
  const status = ['active', 'trialing'].includes(subscriptionStatus)
    ? 'active'
    : ['past_due', 'unpaid'].includes(subscriptionStatus)
      ? 'past_due'
      : ['canceled', 'incomplete_expired'].includes(subscriptionStatus)
        ? 'cancelled'
        : 'pending';
  const firstItem = subscription.items?.data?.[0];
  const currentPeriodStart =
    toDate(subscription.current_period_start) || toDate(firstItem?.current_period_start);
  const currentPeriodEnd =
    toDate(subscription.current_period_end) || toDate(firstItem?.current_period_end);
  const update = {
    status,
    stripeSubscriptionId: getStripeId(subscription),
    stripeCustomerId: getStripeId(subscription.customer),
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end || subscription.cancel_at),
  };
  if (currentPeriodStart) update.currentPeriodStart = currentPeriodStart;
  if (currentPeriodEnd) update.currentPeriodEnd = currentPeriodEnd;

  const updatedMembership = await Membership.findOneAndUpdate(
    { _id: membership._id, provider: 'stripe' },
    { $set: update },
    { returnDocument: 'after' },
  );
  if (updatedMembership && status === 'active' && currentPeriodEnd) {
    await syncMembershipCoupons(updatedMembership, currentPeriodStart, currentPeriodEnd);
  }
  return updatedMembership;
};

const handleMembershipStripeEvent = async (event) => {
  const object = event.data.object;
  switch (event.type) {
    case 'checkout.session.completed': {
      if (object.mode !== 'subscription' || !object.metadata?.membershipId) return false;
      const subscriptionId = getStripeId(object.subscription);
      if (!subscriptionId)
        throw new Error('La sesión VIP completada no contiene una suscripción Stripe.');
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await syncStripeSubscription(subscription);
      return true;
    }
    case 'checkout.session.expired':
      if (!object.metadata?.membershipId) return false;
      await Membership.updateOne(
        {
          _id: object.metadata.membershipId,
          provider: 'stripe',
          status: 'pending',
          stripeCheckoutSessionId: object.id,
        },
        { $set: { status: 'expired' } },
      );
      return true;
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await syncStripeSubscription(
        object,
        event.type === 'customer.subscription.deleted' ? 'canceled' : undefined,
      );
      return true;
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const subscriptionId =
        getStripeId(object.subscription) ||
        getStripeId(object.parent?.subscription_details?.subscription);
      if (!subscriptionId) return false;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const preserveTerminalStatus = ['canceled', 'incomplete_expired'].includes(
        subscription.status,
      );
      await syncStripeSubscription(
        subscription,
        preserveTerminalStatus
          ? subscription.status
          : event.type === 'invoice.payment_failed'
            ? 'past_due'
            : 'active',
      );
      return true;
    }
    default:
      return false;
  }
};

const ensureProductionStripeAccountCanCharge = async () => {
  if (process.env.NODE_ENV !== 'production') return;
  const account = await stripe.accounts.retrieve();
  if (!account.charges_enabled || !account.payouts_enabled) {
    const error = new Error('La cuenta Stripe no está habilitada para cobrar y recibir payouts.');
    error.statusCode = 503;
    throw error;
  }
};

const createBillingPortalSession = async (membership, returnUrl) => {
  if (!membership.stripeCustomerId) {
    const error = new Error('Stripe todavía no registró un cliente para esta membresía.');
    error.statusCode = 409;
    throw error;
  }
  return stripe.billingPortal.sessions.create({
    customer: membership.stripeCustomerId,
    return_url: returnUrl,
  });
};

module.exports = {
  handleMembershipStripeEvent,
  syncStripeSubscription,
  ensureProductionStripeAccountCanCharge,
  createBillingPortalSession,
};
