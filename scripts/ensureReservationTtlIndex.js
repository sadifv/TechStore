require('dotenv').config();

const mongoose = require('mongoose');
const Reservation = require('../models/Reservation');
const { ensureReservationTtlIndex } = require('../services/reservationTtlIndex');

const run = async () => {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        throw new Error('MONGO_URI no está configurado.');
    }

    await mongoose.connect(mongoUri);
    const indexName = await ensureReservationTtlIndex(Reservation.collection);
    console.log(`Índice TTL de reservas verificado: ${indexName}`);
};

run()
    .catch(error => {
        console.error(`No se pudo asegurar el índice TTL de reservas: ${error.message}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    });
