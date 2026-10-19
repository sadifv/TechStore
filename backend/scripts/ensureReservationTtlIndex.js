require('dotenv').config();

const mongoose = require('mongoose');
const Reservation = require('../models/Reservation');
const { ensureReservationTtlIndex } = require('../services/reservationTtlIndex');

const run = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI no está configurado.');
  }

  mongoose.set('autoIndex', false);
  await mongoose.connect(mongoUri);
  const existingIndexes = await Reservation.collection.indexes().catch(async (error) => {
    if (error.codeName === 'NamespaceNotFound') return [];
    throw error;
  });
  const existingExpiryIndex = existingIndexes.find(
    (index) => Object.keys(index.key).length === 1 && index.key.expiresAt === 1,
  );
  const alreadyHasTtl = existingExpiryIndex?.expireAfterSeconds === 0;
  const expiringDocumentCount = alreadyHasTtl
    ? 0
    : await Reservation.countDocuments({ expiresAt: { $lte: new Date() } });

  if (!process.argv.includes('--apply')) {
    console.log(
      alreadyHasTtl
        ? 'El índice TTL de reservas ya está configurado; no se realizaron cambios.'
        : `Vista previa: activar TTL podría eliminar automáticamente ${expiringDocumentCount} reserva(s) con expiresAt vencido. No se realizaron cambios.`,
    );
    console.log('Revisa el alcance y vuelve a ejecutar con --apply solo para confirmar el cambio.');
    return;
  }

  const indexName = await ensureReservationTtlIndex(Reservation.collection);
  console.log(`Índice TTL de reservas verificado: ${indexName}`);
  if (expiringDocumentCount > 0) {
    console.log(
      `MongoDB eliminará automáticamente ${expiringDocumentCount} reserva(s) vencida(s).`,
    );
  }
};

run()
  .catch((error) => {
    console.error(`No se pudo asegurar el índice TTL de reservas: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
