// Constante para el manejo de carrito en LocalStorage (Visitantes)
const GUEST_CART_KEY = 'techstore_guest_cart';

// Utilidades de LocalStorage para usuarios no autenticados
function getGuestCart() {
    const data = localStorage.getItem(GUEST_CART_KEY);
    return data ? JSON.parse(data) : [];
}

function saveGuestCart(cartArray) {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cartArray));
}

function clearGuestCart() {
    localStorage.removeItem(GUEST_CART_KEY);
}

/**
 * Sincroniza los productos guardados en localStorage con MongoDB al iniciar sesión
 */
async function syncGuestCartToUser() {
    const localCart = getGuestCart();
    if (!localCart || localCart.length === 0) return;

    try {
        for (const item of localCart) {
            const validId = item.id || item.productId || item._id;
            if (validId && validId !== 'undefined' && validId !== 'null') {
                await fetch('/api/cart/add', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        productId: validId,
                        quantity: item.quantity || 1
                    })
                });
            }
        }
    } catch (error) {
        console.error('Error al sincronizar el carrito local:', error);
    } finally {
        clearGuestCart();
        console.log('Carrito local limpiado tras la sincronización.');
    }
}

// Exponer funciones globalmente
window.syncGuestCartToUser = syncGuestCartToUser;
window.getGuestCart = getGuestCart;
window.saveGuestCart = saveGuestCart;
window.clearGuestCart = clearGuestCart;

document.addEventListener('DOMContentLoaded', () => {
    let cart = [];

    const cartCountEl = document.getElementById('cart-count');
    const cartBtn = document.getElementById('cart-btn');
    const cartDrawer = document.getElementById('cart-drawer');
    const cartCloseBtn = document.getElementById('cart-close-btn');
    const cartOverlay = document.getElementById('cart-overlay');
    const cartDrawerBody = document.getElementById('cart-drawer-body');
    const cartTotalEl = document.getElementById('cart-total');

    // Elementos del Modal de Checkout
    const cartCheckoutBtn = document.getElementById('cart-checkout-btn');
    const checkoutModal = document.getElementById('checkout-modal');
    const closeCheckoutModalBtn = document.getElementById('close-checkout-modal');
    const checkoutForm = document.getElementById('checkout-form');
    const checkoutStatus = document.getElementById('checkout-status');
    const checkoutModalTotal = document.getElementById('checkout-modal-total');

    // Helper para invocación segura de toast
    function notify(message, type = 'info') {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        }
    }

    function dispatchCartUpdated() {
        window.dispatchEvent(new CustomEvent('cart:updated'));
    }

    // ==========================================
    // VALIDACIÓN EN TIEMPO REAL DEL INPUT #quantity
    // ==========================================
    const quantityInput = document.getElementById('quantity');
    if (quantityInput) {
        quantityInput.addEventListener('input', () => {
            const max = parseInt(quantityInput.max, 10) || 999;
            let val = parseInt(quantityInput.value, 10);
            if (isNaN(val) || val < 1) {
                quantityInput.value = 1;
                return;
            }
            if (val > max) {
                quantityInput.value = max;
                if (window.showToast) window.showToast(`Máximo ${max} disponibles`, 'warning');
            }
        });
    }

    // Cargar carrito desde MongoDB o LocalStorage
    async function fetchCart() {
        if (typeof window.IS_AUTHENTICATED !== 'undefined' && !window.IS_AUTHENTICATED) {
            cart = getGuestCart();
            updateCartCount();
            renderCartItems();
            dispatchCartUpdated();
            return;
        }

        try {
            const response = await fetch('/api/cart');

            if (response.status === 401) {
                window.IS_AUTHENTICATED = false;
                cart = getGuestCart();
                return;
            }

            if (response.ok) {
                const data = await response.json();
                const itemsList = data.data ? (data.data.items || data.data) : (data.items || []);

                if (Array.isArray(itemsList)) {
                    cart = itemsList
                        .filter(item => item && (item.product || item.productId || item.id))
                        .map(item => {
                            const prod = item.product || {};
                            return {
                                id: prod._id || item.productId || item.id || item._id,
                                name: prod.name || item.name || 'Producto Desconocido',
                                price: prod.price !== undefined ? Number(prod.price) : Number(item.price || 0),
                                image: prod.image || item.image || '/images/products/product-placeholder.svg',
                                quantity: item.quantity || 1
                            };
                        });
                } else {
                    cart = [];
                }
            } else {
                throw new Error('No se pudo cargar el carrito desde el servidor.');
            }
        } catch (error) {
            console.error('Error al cargar el carrito:', error);
            notify('No se pudo cargar el carrito. Inténtalo de nuevo.', 'error');
        } finally {
            updateCartCount();
            renderCartItems();
            dispatchCartUpdated();
        }
    }

    function openCart() {
        if (cartDrawer) {
            cartDrawer.classList.add('open');
            cartDrawer.setAttribute('aria-hidden', 'false');
            cartDrawer.removeAttribute('inert');
            fetchCart();

            if (cartCloseBtn) {
                cartCloseBtn.focus();
            }
        }
    }

    function closeCart() {
        if (cartDrawer) {
            if (document.activeElement && cartDrawer.contains(document.activeElement)) {
                document.activeElement.blur();
            }
            cartDrawer.classList.remove('open');
            cartDrawer.setAttribute('aria-hidden', 'true');
            cartDrawer.setAttribute('inert', '');

            if (cartBtn) {
                cartBtn.focus();
            }
        }
    }

    if (cartBtn) cartBtn.addEventListener('click', openCart);
    if (cartCloseBtn) cartCloseBtn.addEventListener('click', closeCart);
    if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

    function updateCartCount() {
        if (!cartCountEl) return;
        const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
        cartCountEl.textContent = totalItems.toString();

        cartCountEl.classList.add('bump');
        setTimeout(() => cartCountEl.classList.remove('bump'), 300);
    }

    function renderCartItems() {
        if (!cartDrawerBody || !cartTotalEl) return;

        while (cartDrawerBody.firstChild) {
            cartDrawerBody.removeChild(cartDrawerBody.firstChild);
        }

        if (cart.length === 0) {
            const emptyArticle = document.createElement('article');
            emptyArticle.classList.add('cart-empty-state');

            const icon = document.createElement('i');
            icon.classList.add('ri-shopping-cart-line');

            const text = document.createElement('p');
            text.textContent = 'Tu carrito está vacío';

            emptyArticle.appendChild(icon);
            emptyArticle.appendChild(text);
            cartDrawerBody.appendChild(emptyArticle);

            cartTotalEl.textContent = '$0.00';
            return;
        }

        let total = 0;

        cart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;

            const article = document.createElement('article');
            article.classList.add('cart-item');
            article.setAttribute('data-id', item.id);

            const img = document.createElement('img');
            img.src = item.image;
            img.alt = item.name;

            const detailsSection = document.createElement('section');
            detailsSection.classList.add('cart-item-details');

            const title = document.createElement('h4');
            title.textContent = item.name;

            const price = document.createElement('span');
            price.classList.add('cart-item-price');
            price.textContent = `$${item.price.toFixed(2)}`;

            const controlsNav = document.createElement('nav');
            controlsNav.classList.add('cart-item-controls');

            const btnMinus = document.createElement('button');
            btnMinus.type = 'button';
            btnMinus.classList.add('btn-qty-minus');
            btnMinus.textContent = '-';

            const qtySpan = document.createElement('span');
            qtySpan.textContent = item.quantity.toString();

            const btnPlus = document.createElement('button');
            btnPlus.type = 'button';
            btnPlus.classList.add('btn-qty-plus');
            btnPlus.textContent = '+';

            controlsNav.appendChild(btnMinus);
            controlsNav.appendChild(qtySpan);
            controlsNav.appendChild(btnPlus);

            detailsSection.appendChild(title);
            detailsSection.appendChild(price);
            detailsSection.appendChild(controlsNav);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.classList.add('cart-item-remove');
            removeBtn.setAttribute('aria-label', 'Eliminar producto');

            const removeIcon = document.createElement('i');
            removeIcon.classList.add('ri-delete-bin-line');
            removeBtn.appendChild(removeIcon);

            article.appendChild(img);
            article.appendChild(detailsSection);
            article.appendChild(removeBtn);

            cartDrawerBody.appendChild(article);
        });

        cartTotalEl.textContent = `$${total.toFixed(2)}`;
    }

    // Agregar producto (MongoDB o LocalStorage)
    async function addToCart(productId, quantity = 1, productData = null) {
        if (typeof window.IS_AUTHENTICATED !== 'undefined' && !window.IS_AUTHENTICATED) {
            const added = await addToGuestCart(productId, quantity, productData);
            if (!added) return false;
            notify('Producto añadido al carrito', 'success');
            return true;
        }

        try {
            const response = await fetch('/api/cart/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId, quantity })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    await fetchCart();
                    notify('Producto añadido al carrito', 'success');
                    return true;
                }
                notify(data.error || 'No se pudo actualizar el carrito.', 'error');
                return false;
            }
            const data = await response.json().catch(() => ({}));
            notify(data.error || 'No se pudo actualizar el carrito.', 'error');
            return false;
        } catch (error) {
            console.error('Error al actualizar el carrito:', error);
            notify('Error de conexión al actualizar el carrito.', 'error');
            return false;
        }
    }
    window.addToCart = addToCart;

    async function addToGuestCart(productId, quantity, productData) {
        let localCart = getGuestCart();
        const index = localCart.findIndex(item => (item.id || item.productId || item._id) === productId);
        const existingItem = index > -1 ? localCart[index] : null;
        const requestedQuantity = Number(quantity);
        let stockLimit = Number(productData?.availableStock ?? existingItem?.availableStock);

        if (!Number.isInteger(requestedQuantity) || requestedQuantity === 0) return false;
        if (requestedQuantity > 0 && (!Number.isInteger(stockLimit) || stockLimit < 0)) {
            try {
                const response = await fetch(`/api/products/${encodeURIComponent(productId)}`, {
                    headers: { 'Accept': 'application/json' }
                });
                const data = await response.json();
                if (!response.ok || !data.success) {
                    throw new Error(data.error || 'No se pudo verificar el stock.');
                }
                stockLimit = Number(data.data?.availableStock ?? data.data?.stock);
                if (!Number.isInteger(stockLimit) || stockLimit < 0) {
                    throw new Error('El producto no tiene un valor de stock válido.');
                }
            } catch (error) {
                console.error('No se pudo verificar el stock del producto:', error);
                notify('No se pudo verificar el stock. Inténtalo de nuevo.', 'error');
                return false;
            }
        }

        const currentQuantity = existingItem ? Number(existingItem.quantity) || 0 : 0;
        const maxAllowedQuantity = Math.min(stockLimit, 99);
        if (requestedQuantity > 0 && currentQuantity + requestedQuantity > maxAllowedQuantity) {
            const remaining = Math.max(0, maxAllowedQuantity - currentQuantity);
            notify(
                remaining > 0
                    ? `Solo puedes agregar ${remaining} unidad(es) más. Ya tienes ${currentQuantity} en el carrito.`
                    : `Ya tienes ${currentQuantity} unidad(es) en el carrito y alcanzaste el límite disponible (${maxAllowedQuantity}).`,
                'warning'
            );
            return false;
        }

        if (index > -1) {
            const updatedQuantity = currentQuantity + requestedQuantity;
            if (updatedQuantity <= 0) {
                localCart.splice(index, 1);
            } else {
                localCart[index].quantity = updatedQuantity;
                if (Number.isInteger(stockLimit)) localCart[index].availableStock = stockLimit;
            }
        } else if (requestedQuantity > 0) {
            localCart.push({
                id: productId,
                name: productData ? productData.name : 'Producto',
                price: productData ? productData.price : 0,
                image: productData ? productData.image : '',
                quantity: requestedQuantity,
                availableStock: stockLimit
            });
        }

        saveGuestCart(localCart);
        fetchCart();
        return true;
    }

    async function decreaseCartQuantity(productId, quantity) {
        if (typeof window.IS_AUTHENTICATED !== 'undefined' && !window.IS_AUTHENTICATED) {
            addToGuestCart(productId, -1);
            return;
        }

        try {
            const response = await fetch(`/api/cart/quantity/${productId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity: quantity - 1 })
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                notify(data.error || 'No se pudo actualizar la cantidad.', 'error');
                return;
            }

            await fetchCart();
        } catch (error) {
            console.error('Error al reducir la cantidad del carrito:', error);
            notify('Error de conexión al actualizar el carrito.', 'error');
        }
    }

    // Eliminar producto
    async function removeFromCart(productId) {
        if (typeof window.IS_AUTHENTICATED !== 'undefined' && !window.IS_AUTHENTICATED) {
            removeFromGuestCart(productId);
            notify('Producto eliminado del carrito', 'info');
            return;
        }

        try {
            const response = await fetch(`/api/cart/remove/${productId}`, {
                method: 'DELETE'
            });
            const data = await response.json().catch(() => ({}));

            if (response.ok && data.success) {
                await fetchCart();
                notify('Producto eliminado del carrito', 'info');
                return;
            }
            notify(data.error || 'No se pudo eliminar el producto del carrito.', 'error');
        } catch (error) {
            console.error('Error al eliminar del carrito:', error);
            notify('Error de conexión al eliminar el producto.', 'error');
        }
    }

    function removeFromGuestCart(productId) {
        let localCart = getGuestCart().filter(i => i.id !== productId);
        saveGuestCart(localCart);
        fetchCart();
    }

    // Eventos Globales Delegados
    document.addEventListener('click', async (e) => {
        // Ignorar clics dentro del dashboard de administración
        if (e.target.closest('.admin-dashboard')) {
            return;
        }

        // Ignorar botones específicos del dashboard admin
        if (e.target.closest('.btn-edit-product') ||
            e.target.closest('.btn-delete-product') ||
            e.target.closest('.btn-flash-product') ||
            e.target.closest('.btn-stop-flash-product') ||
            e.target.closest('.btn-delete-user') ||
            e.target.closest('.btn-delete-message') ||
            e.target.closest('.btn-delete-subscriber')) {
            return;
        }

        const addBtn = e.target.closest('button[data-id]');
        if (addBtn && !addBtn.classList.contains('cart-item-remove') && !addBtn.classList.contains('btn-qty-minus') && !addBtn.classList.contains('btn-qty-plus')) {
            e.preventDefault(); // Evitar submit del formulario
            const productId = addBtn.getAttribute('data-id');
            const card = addBtn.closest('.product-card');
            const quantityInput = document.getElementById('quantity');
            const stockFromInput = quantityInput && quantityInput.max
                ? Number.parseInt(quantityInput.max, 10)
                : NaN;
            const stockFromButton = Number.parseInt(addBtn.dataset.stock, 10);

            const productData = card ? {
                name: card.querySelector('h3')?.textContent || 'Producto',
                price: parseFloat(card.querySelector('.product-price')?.textContent.replace(/[^\d.,-]/g, '').replace(',', '.') || 0),
                image: card.querySelector('img')?.src || '/images/products/product-placeholder.svg',
                availableStock: Number.isInteger(stockFromButton) ? stockFromButton : undefined
            } : {
                name: document.querySelector('.product-detail-title')?.textContent.trim() || document.querySelector('h1')?.textContent.trim() || 'Producto',
                price: parseFloat(document.querySelector('.product-detail-price')?.textContent.replace(/[^\d.,-]/g, '').replace(',', '.') || 0),
                image: document.querySelector('.product-detail-media img')?.src || '/images/products/product-placeholder.svg',
                availableStock: Number.isInteger(stockFromButton)
                    ? stockFromButton
                    : stockFromInput
            };

            if (productId) {
                // Leer cantidad del input #quantity (si existe)
                let requestedQty = quantityInput ? parseInt(quantityInput.value, 10) : 1;
                if (isNaN(requestedQty) || requestedQty < 1) requestedQty = 1;

                // Validar el límite por solicitud antes de enviarlo al carrito.
                const availableStock = Number.isInteger(stockFromButton)
                    ? stockFromButton
                    : stockFromInput;
                if (requestedQty > availableStock) {
                    if (window.showToast) window.showToast(`Solo hay ${availableStock} disponibles`, 'error');
                    return;
                }

                const added = await addToCart(productId, requestedQty, productData);
                if (!added) return;

                const icon = document.createElement('i');
                icon.classList.add('ri-check-line');

                while (addBtn.firstChild) {
                    addBtn.removeChild(addBtn.firstChild);
                }

                addBtn.appendChild(icon);
                addBtn.appendChild(document.createTextNode(' ¡Añadido!'));
                addBtn.disabled = true;

                setTimeout(() => {
                    while (addBtn.firstChild) {
                        addBtn.removeChild(addBtn.firstChild);
                    }
                    addBtn.textContent = 'Añadir al carrito';
                    addBtn.disabled = false;
                }, 1000);
            }
            return;
        }

        if (e.target.closest('.btn-qty-plus')) {
            const itemEl = e.target.closest('.cart-item');
            const id = itemEl.getAttribute('data-id');
            await addToCart(id, 1);
            return;
        }

        if (e.target.closest('.btn-qty-minus')) {
            const itemEl = e.target.closest('.cart-item');
            const id = itemEl.getAttribute('data-id');
            const item = cart.find(i => i.id === id);

            if (item && item.quantity > 1) {
                await decreaseCartQuantity(id, item.quantity);
            } else {
                await removeFromCart(id);
            }
            return;
        }

        if (e.target.closest('.cart-item-remove')) {
            const itemEl = e.target.closest('.cart-item');
            const id = itemEl.getAttribute('data-id');
            await removeFromCart(id);
            return;
        }
    });

    // --- Flujo de Checkout con Redirección a Stripe ---

    if (cartCheckoutBtn) {
        cartCheckoutBtn.addEventListener('click', () => {
            if (cart.length === 0) {
                notify('Tu carrito está vacío. Agrega productos antes de continuar.', 'warning');
                return;
            }

            if (checkoutModalTotal && cartTotalEl) {
                checkoutModalTotal.textContent = cartTotalEl.textContent;
            }

            if (checkoutStatus) {
                checkoutStatus.textContent = '';
                checkoutStatus.className = 'form-status';
            }

            closeCart();

            if (checkoutModal) {
                if (typeof checkoutModal.showModal === 'function') {
                    checkoutModal.showModal();
                } else {
                    checkoutModal.setAttribute('open', 'true');
                }
            }
        });
    }

    if (closeCheckoutModalBtn && checkoutModal) {
        closeCheckoutModalBtn.addEventListener('click', () => {
            if (typeof checkoutModal.close === 'function') {
                checkoutModal.close();
            } else {
                checkoutModal.removeAttribute('open');
            }
        });
    }

    // Enviar Orden / Iniciar Sesión de Stripe Checkout (Soporta Invitados y Autenticados)
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = document.getElementById('btn-confirm-order');
            const paymentMethodSelect = document.getElementById('payment-method');
            const paymentMethod = paymentMethodSelect ? paymentMethodSelect.value : 'card';

            const payload = {
                paymentMethod,
                couponCode: document.getElementById('checkout-coupon-code')?.value.trim(),
                items: cart.map(item => ({
                    productId: item.id,
                    quantity: item.quantity,
                    price: item.price
                }))
            };

            // Recopilar datos de invitado si el usuario no ha iniciado sesión
            if (typeof window.IS_AUTHENTICATED !== 'undefined' && !window.IS_AUTHENTICATED) {
                const guestNameInput = document.getElementById('guest-name');
                const guestEmailInput = document.getElementById('guest-email');

                if (!guestEmailInput || !guestEmailInput.value.trim()) {
                    notify('Por favor, ingresa un correo electrónico válido.', 'error');
                    if (checkoutStatus) {
                        checkoutStatus.textContent = 'Por favor, ingresa un correo electrónico válido.';
                        checkoutStatus.className = 'form-status error';
                    }
                    return;
                }

                payload.guestInfo = {
                    name: guestNameInput ? guestNameInput.value.trim() : 'Invitado',
                    email: guestEmailInput.value.trim()
                };
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Redirigiendo a Stripe...';
            }

            try {
                const response = await fetch('/api/orders/checkout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (response.ok && data.success && data.url) {
                    clearGuestCart();
                    window.location.href = data.url;
                } else {
                    const errorMsg = data.error || 'Ocurrió un error al procesar el pedido.';
                    notify(errorMsg, 'error');
                    if (checkoutStatus) {
                        checkoutStatus.textContent = errorMsg;
                        checkoutStatus.className = 'form-status error';
                    }
                }
            } catch (error) {
                console.error('Error durante la orden:', error);
                notify('Error de conexión con el servidor.', 'error');
                if (checkoutStatus) {
                    checkoutStatus.textContent = 'Error de conexión con el servidor.';
                    checkoutStatus.className = 'form-status error';
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Confirmar Pedido';
                }
            }
        });
    }

    // Cargar productos al inicio
    fetchCart();
});