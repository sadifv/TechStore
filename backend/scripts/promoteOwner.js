const mongoose = require('mongoose');
const User = require('../models/User');

// Explicit operator migration. The web application never assigns owner.
async function promoteOwner({ apply = false } = {}) {
  if (await User.exists({ role: 'owner' })) return { status: 'already-configured' };
  const admins = await User.find({ role: 'admin' }).select('_id').limit(2).lean();
  if (admins.length !== 1) {
    throw new Error('Se requiere exactamente un administrador existente. No se ha cambiado ninguna cuenta.');
  }
  if (!apply) return { status: 'dry-run', targetId: String(admins[0]._id) };
  await User.collection.createIndex(
    { role: 1 },
    { unique: true, partialFilterExpression: { role: 'owner' }, name: 'singleton_owner' },
  );
  const owner = await User.findOneAndUpdate(
    { _id: admins[0]._id, role: 'admin' },
    { $set: { role: 'owner' }, $inc: { authVersion: 1 } },
    { returnDocument: 'after', runValidators: true },
  ).select('_id');
  if (!owner) throw new Error('La cuenta cambió durante la migración. No se pudo asignar owner.');
  return { status: 'promoted', targetId: String(owner._id) };
}

async function main() {
  require('dotenv').config({ quiet: true });
  if (process.argv.slice(2).some((arg) => arg !== '--apply')) throw new Error('Argumento inválido. Usa --apply para confirmar.');
  if (!process.env.MONGO_URI) throw new Error('Falta MONGO_URI.');
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false });
    console.log(JSON.stringify(await promoteOwner({ apply: process.argv.includes('--apply') })));
  } finally {
    await mongoose.disconnect();
  }
}
if (require.main === module) main().catch(() => {
  console.error('No se pudo completar la migración de owner. Comprueba la conexión y que exista exactamente un administrador. No se muestran credenciales.');
  process.exitCode = 1;
});
module.exports = { promoteOwner };
