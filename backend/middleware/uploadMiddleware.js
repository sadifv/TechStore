const multer = require('multer');
const path = require('path');
const logger = require('../config/logger');
const { detectImageType, storeProductImage } = require('../services/productImageStorage');

const allowedFiles = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
]);

// Filtro de seguridad para tipos MIME
const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();
  if (allowedFiles.get(extension) === file.mimetype) {
    cb(null, true);
  } else {
    logger.warn(`Intento de subida de archivo no permitido con mimetype: ${file.mimetype}`);
    cb(new Error('Formato de imagen no soportado. Usa JPEG, PNG, WEBP o GIF.'), false);
  }
};

// Instancia configurada de Multer (máximo 5MB por archivo)
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});

// Middleware envoltorio para capturar errores de Multer de forma limpia
const uploadSingleProductImage = (req, res, next) => {
  const uploadSingle = upload.single('imageFile');

  uploadSingle(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      logger.error(`Error de Multer en subida de imagen: ${err.message}`);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'La imagen supera el tamaño máximo permitido (5 MB).',
        });
      }
      return res.status(400).json({ success: false, error: err.message });
    } else if (err) {
      logger.error(`Error en subida de imagen: ${err.message}`);
      return res.status(400).json({ success: false, error: err.message });
    }
    if (!req.file) return next();
    Promise.resolve()
      .then(async () => {
        const actualType = detectImageType(req.file.buffer);
        const extension = path.extname(req.file.originalname).toLowerCase();
        if (actualType !== allowedFiles.get(extension) || actualType !== req.file.mimetype) {
          return res.status(400).json({
            success: false,
            error:
              'El contenido del archivo no coincide con una imagen JPEG, PNG, WEBP o GIF válida.',
          });
        }
        const stored = await storeProductImage(req.file);
        req.file.filename = stored.url.split('/').at(-1);
        req.file.storageUrl = stored.url;
        delete req.file.buffer;
        return next();
      })
      .catch((validationError) => {
        logger.error(`No se pudo verificar la imagen subida: ${validationError.message}`);
        if (validationError.statusCode === 400) {
          return res.status(400).json({
            success: false,
            error: 'No se pudo verificar el archivo de imagen.',
          });
        }
        return next(validationError);
      });
  });
};

module.exports = {
  uploadSingleProductImage,
};
