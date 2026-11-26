const multer = require('multer');

const parse = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024,
    files: 1,
    fields: 3,
    parts: 5,
    fieldNameSize: 40,
    fieldSize: 8 * 1024,
  },
}).single('photo');

const parseInteger = (value) =>
  typeof value === 'string' && /^[1-9]\d{0,14}$/.test(value) ? Number(value) : value;

module.exports = function reviewPhotoUpload(req, res, next) {
  if (!req.is('multipart/form-data')) return next();
  return parse(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Adjunta una sola foto JPEG, PNG o WebP de hasta 1 MB.',
      });
    }
    req.body.rating = parseInteger(req.body.rating);
    req.body.version = parseInteger(req.body.version);
    return next();
  });
};
