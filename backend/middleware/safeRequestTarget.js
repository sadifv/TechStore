const getSafeRequestTarget = (req) => {
  const pathname =
    typeof req.path === 'string'
      ? req.path
      : new URL(req.originalUrl || '/', 'http://localhost').pathname;

  // Do not write reset or unsubscribe bearer tokens to application logs.
  return pathname.replace(/\/(reset-password|unsubscribe)\/[^/]+/gi, '/$1/[redacted]');
};

module.exports = getSafeRequestTarget;
