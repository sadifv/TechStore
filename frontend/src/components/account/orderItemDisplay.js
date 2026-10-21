export const getOrderItemName = (item) =>
  item.productName || item.product?.name || 'Producto no disponible';
