document.addEventListener('DOMContentLoaded', () => {
    const successContainer = document.querySelector('.checkout-success-container');
    if (!successContainer || successContainer.dataset.guestOrder !== 'true') return;

    try {
        const purchasedItems = JSON.parse(successContainer.dataset.purchasedItems || '[]');
        if (typeof window.removeGuestCartItemsAfterPurchase !== 'function') {
            throw new Error('No está disponible la reconciliación del carrito de invitado.');
        }
        window.removeGuestCartItemsAfterPurchase(purchasedItems);
    } catch (error) {
        console.error('No se pudo actualizar el carrito tras la compra confirmada:', error);
    }
});
