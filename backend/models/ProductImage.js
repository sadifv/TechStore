const mongoose = require('mongoose');

const productImageSchema = new mongoose.Schema(
  {
    contentType: {
      type: String,
      enum: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      required: true,
    },
    data: {
      type: Buffer,
      required: true,
    },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model('ProductImage', productImageSchema);
