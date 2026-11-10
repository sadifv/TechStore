const mongoose = require('mongoose');
const { normalizeSpecifications } = require('../services/productSpecifications');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'El nombre del producto es obligatorio'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    specifications: {
      // Mixed preserves the original types so validation never silently casts
      // scalars, drops unknown keys or accepts nested objects as text.
      type: mongoose.Schema.Types.Mixed,
      default: () => [],
      set(value) {
        if (value === undefined) return value;
        if (!Array.isArray(value)) throw new Error('Especificaciones inválidas');
        return normalizeSpecifications(value);
      },
      validate: {
        validator(value) {
          try {
            return Array.isArray(value) && normalizeSpecifications(value) !== undefined;
          } catch {
            return false;
          }
        },
        message: 'Especificaciones inválidas',
      },
    },
    archivedAt: { type: Date, default: null },
    price: {
      type: Number,
      required: [true, 'El precio es obligatorio'],
      min: 0,
    },
    gallery: { type: [String], default: [] },
    image: {
      type: String,
      default: '/images/products/catalog-fallback.jpg',
      trim: true,
    },
    category: {
      type: String,
      default: 'General',
      index: true,
    },
    stock: {
      type: Number,
      default: 10,
      min: 0,
    },
    inventoryRestorationKeys: {
      type: [String],
      default: [],
      select: false,
    },
    reservationLockToken: {
      type: String,
      select: false,
    },
    reservationLockExpiresAt: {
      type: Date,
      select: false,
    },
    // FLASH SALE (Oferta Relámpago)
    flashSale: {
      type: Boolean,
      default: false,
      index: true,
    },
    flashSaleDiscount: {
      type: Number,
      default: 0,
      min: 0,
      max: 90,
    },
    flashSaleEndsAt: {
      type: Date,
      default: null,
    },
    originalPrice: {
      type: Number,
      default: null,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('Product', productSchema);
