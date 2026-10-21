const catalogIndexes = [
  { collection: 'products', name: 'active_recent', key: { archivedAt: 1, createdAt: -1 } },
  { collection: 'products', name: 'active_flash_expiry', key: { archivedAt: 1, flashSale: 1, flashSaleEndsAt: 1 } },
  { collection: 'reservations', name: 'product_active_expiry', key: { product: 1, status: 1, expiresAt: 1 } },
];
module.exports = { catalogIndexes };
