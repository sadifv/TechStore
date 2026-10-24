const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'El correo electrónico es obligatorio'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Por favor, ingresa un correo electrónico válido'],
    },
    password: {
      type: String,
      required: [true, 'La contraseña es obligatoria'],
      minlength: [12, 'La contraseña debe tener al menos 12 caracteres'],
      select: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'owner'],
      default: 'user',
    },
    // Incrementar al cambiar contraseña o rol para revocar las sesiones anteriores.
    authVersion: {
      type: Number,
      default: 0,
      select: false,
    },
    adminMfaSecret: { type: String, select: false },
    adminMfaEnabledAt: { type: Date, select: false },
    adminMfaLastTotpStep: { type: Number, select: false },
    adminMfaRecoveryHashes: { type: [String], select: false, default: undefined },
    lastLoginAt: Date,
    // Campos para Verificación de Email y Reset de Contraseña
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: { type: String, select: false },
    verificationTokenExpires: { type: Date, select: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
  },
  {
    timestamps: true,
  },
);

// At most one owner, including writes from migration tools.
userSchema.index(
  { role: 1 },
  { unique: true, partialFilterExpression: { role: 'owner' }, name: 'singleton_owner' },
);

// Middleware Mongoose corregido para funciones async (sin parámetro next)
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

module.exports = mongoose.model('User', userSchema);
