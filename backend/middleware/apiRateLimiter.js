const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { loadCurrentUser } = require('./authMiddleware');

// Resolve current permissions, including revocations, before granting a larger budget.
async function identifyStaff(req, res, next) {
  req.verifiedStaffId = null;
  if (req.session?.authLevel !== 'mfa' || !req.session?.user) return next();
  try {
    const user = await loadCurrentUser(req, res);
    if (['owner', 'admin'].includes(user?.role)) req.verifiedStaffId = user.id;
    next();
  } catch (error) {
    next(error);
  }
}

const budget = (req) => (req.verifiedStaffId ? 1000 : 150);
const key = (req) =>
  req.verifiedStaffId ? `staff:${req.verifiedStaffId}` : ipKeyGenerator(req.ip);
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: budget,
  keyGenerator: key,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Demasiadas solicitudes. Inténtalo de nuevo más tarde.' },
});

module.exports = { identifyStaff, apiLimiter, budget, key };
