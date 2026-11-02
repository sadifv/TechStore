const privateResponsePaths = [
  '/api/auth',
  '/api/admin',
  '/admin',
  '/api/cart',
  '/api/orders',
  '/api/addresses',
  '/api/favorites',
  '/api/reviews',
  '/api/ai',
  '/api/presence',
];
const preventPrivateCaching = (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};
module.exports = { privateResponsePaths, preventPrivateCaching };
