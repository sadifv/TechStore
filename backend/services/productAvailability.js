const activeProductFilter = () => ({ archivedAt: null });
const isProductArchived = (product) => product?.archivedAt != null;
module.exports = { activeProductFilter, isProductArchived };
