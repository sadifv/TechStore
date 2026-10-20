const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const createCsrfProtection = (allowedOrigins) => (req, res, next) => {
  if (!MUTATING_METHODS.has(req.method)) return next();

  const origin = req.get('origin');
  const fetchSite = req.get('sec-fetch-site');
  if (fetchSite === 'cross-site' || (origin && !allowedOrigins.includes(origin))) {
    return res.status(403).json({ success: false, error: 'Origen de solicitud no permitido.' });
  }

  return next();
};

module.exports = { createCsrfProtection };
