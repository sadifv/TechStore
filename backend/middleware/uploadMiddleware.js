const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');

const allowedFiles = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
]);

const detectImageType = async (filePath) => {
  const handle = await fs.promises.open(filePath, 'r');
  const header = Buffer.alloc(12);
  try {
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const bytes = header.subarray(0, bytesRead);
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
      return 'image/jpeg';
    if (
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    )
      return 'image/png';
    if (bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6)))
      return 'image/gif';
    if (
      bytes.length >= 12 &&
      bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.toString('ascii', 8, 12) === 'WEBP'
    )
      return 'image/webp';
    return null;
  } finally {
    await handle.close();
  }
};

// Asegurar que el directorio de destino existe
const uploadDir = path.join(__dirname, '../public/uploads/products');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuración del almacenamiento en disco
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `product-${uniqueSuffix}${ext}`);
  },
});

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
  storage,
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
    detectImageType(req.file.path)
      .then((actualType) => {
        const extension = path.extname(req.file.originalname).toLowerCase();
        if (actualType !== allowedFiles.get(extension) || actualType !== req.file.mimetype) {
          return fs.promises
            .unlink(req.file.path)
            .catch(() => {})
            .then(() =>
              res.status(400).json({
                success: false,
                error:
                  'El contenido del archivo no coincide con una imagen JPEG, PNG, WEBP o GIF válida.',
              }),
            );
        }
        return next();
      })
      .catch((validationError) => {
        logger.error(`No se pudo verificar la imagen subida: ${validationError.message}`);
        return fs.promises
          .unlink(req.file.path)
          .catch(() => {})
          .then(() =>
            res.status(400).json({
              success: false,
              error: 'No se pudo verificar el archivo de imagen.',
            }),
          );
      });
  });
};

module.exports = {
  uploadSingleProductImage,
};
