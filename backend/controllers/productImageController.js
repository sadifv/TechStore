const ProductImage = require('../models/ProductImage');

const serveProductImage = async (req, res, next) => {
  const { imageId } = req.params;
  if (!/^[a-f\d]{24}$/i.test(imageId)) return next();

  try {
    const image = await ProductImage.findById(imageId).select('contentType data').lean();
    if (!image) return next();

    res.set({
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Length': String(image.data.length),
    });
    return res.type(image.contentType).send(image.data);
  } catch (error) {
    return next(error);
  }
};

module.exports = { serveProductImage };
