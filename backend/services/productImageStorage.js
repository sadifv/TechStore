const ProductImage = require('../models/ProductImage');

const contentTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const maxImageBytes = 5 * 1024 * 1024;

const detectImageType = (buffer) => {
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
    return 'image/jpeg';
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'image/png';
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6)))
    return 'image/gif';
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'image/webp';
  return null;
};

const storeProductImage = async ({ buffer, mimetype }) => {
  const actualType = detectImageType(buffer);
  if (
    !Buffer.isBuffer(buffer) ||
    !contentTypes.has(mimetype) ||
    actualType !== mimetype ||
    buffer.length > maxImageBytes
  ) {
    const error = new Error('El contenido del archivo no coincide con una imagen permitida.');
    error.statusCode = 400;
    throw error;
  }

  const image = await ProductImage.create({ contentType: actualType, data: buffer });
  return { url: `/uploads/products/${image._id}` };
};

module.exports = { detectImageType, storeProductImage };
