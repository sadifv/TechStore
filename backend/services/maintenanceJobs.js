const cron = require('node-cron');
const Product = require('../models/Product');
const Reservation = require('../models/Reservation');
const Membership = require('../models/Membership');
const logger = require('../config/logger');

const scheduleMaintenanceJobs = () => {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const expiredSales = await Product.find({
        flashSale: true,
        flashSaleEndsAt: { $lt: new Date() },
      });

      for (const product of expiredSales) {
        if (product.originalPrice !== null && product.originalPrice !== undefined) {
          product.price = product.originalPrice;
        }
        product.flashSale = false;
        product.flashSaleDiscount = 0;
        product.flashSaleEndsAt = null;
        product.originalPrice = null;
        await product.save();
        logger.info(`Flash sale expirada restaurada (cron): ${product.name} (ID: ${product._id})`);
      }
    } catch (error) {
      logger.error('Error en cron job de restauración de ofertas.', {
        errorCode: error.code || error.name,
      });
    }
  });

  cron.schedule('*/10 * * * *', async () => {
    try {
      const cleaned = await Reservation.cleanupExpired();
      if (cleaned > 0) logger.info(`Reservas expiradas limpiadas (cron): ${cleaned}`);
    } catch (error) {
      logger.error('Error en cron job de limpieza de reservas.', {
        errorCode: error.code || error.name,
      });
    }
  });

  cron.schedule('*/10 * * * *', async () => {
    try {
      const {
        reconcileExpiredOrders,
        pruneCompletedInventoryRestorationKeys,
      } = require('../controllers/orderController');
      const reconciledOrders = await reconcileExpiredOrders();
      if (reconciledOrders > 0) logger.info(`Órdenes de Stripe vencidas reconciliadas: ${reconciledOrders}`);
      const prunedOrders = await pruneCompletedInventoryRestorationKeys();
      if (prunedOrders > 0) logger.info(`Claves de restitución de inventario limpiadas: ${prunedOrders}`);
    } catch (error) {
      logger.error('Error en cron job de conciliación de checkout.', {
        errorCode: error.code || error.name,
      });
    }
  });

  cron.schedule('15 0 * * *', async () => {
    try {
      const result = await Membership.updateMany(
        { status: 'active', currentPeriodEnd: { $lte: new Date() } },
        { $set: { status: 'expired' } },
      );
      if (result.modifiedCount > 0) logger.info(`Membresías VIP expiradas: ${result.modifiedCount}`);
    } catch (error) {
      logger.error('Error al expirar membresías VIP.', {
        errorCode: error.code || error.name,
      });
    }
  });
};

module.exports = { scheduleMaintenanceJobs };
