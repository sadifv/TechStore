const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');

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
    }
});

// Filtro de seguridad para tipos MIME
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif'];
    if (allowedMimeTypes.includes(file.mimetype)) {
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
        fileSize: 5 * 1024 * 1024 // 5 MB
    }
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
                    error: 'La imagen supera el tamaño máximo permitido (5 MB).'
                });
            }
            return res.status(400).json({ success: false, error: err.message });
        } else if (err) {
            logger.error(`Error en subida de imagen: ${err.message}`);
            return res.status(400).json({ success: false, error: err.message });
        }
        next();
    });
};

module.exports = {
    uploadSingleProductImage
};