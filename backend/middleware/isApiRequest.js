const isApiRequest = (req) => {
  const requestPaths = [req.originalUrl, req.baseUrl, req.path];
  const accept = req.headers?.accept?.toLowerCase() || '';
  const contentType = req.headers?.['content-type']?.toLowerCase() || '';

  return Boolean(
    req.xhr ||
    requestPaths.some(
      (requestPath) =>
        typeof requestPath === 'string' &&
        (requestPath === '/api' || requestPath.startsWith('/api/')),
    ) ||
    accept.includes('json') ||
    (accept && !accept.includes('text/html')) ||
    contentType.includes('json'),
  );
};

module.exports = isApiRequest;
