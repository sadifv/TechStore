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
            // Solo enviar al backend si el ID es un valor real y no nulo/indefinido
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
        // Garantiza que el localStorage quede limpio tras intentar la sincronización
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

    // Cargar carrito desde MongoDB o LocalStorage
    async function fetchCart() {
        if (typeof window.IS_AUTHENTICATED !== 'undefined' && !window.IS_AUTHENTICATED) {
            cart = getGuestCart();
            updateCartCount();
            renderCartItems();
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
                // Extraer lista de ítems soportando la respuesta del controlador
                const itemsList = data.data ? (data.data.items || data.data) : (data.items || []);
                
                if (Array.isArray(itemsList)) {
                    cart = itemsList
                        // Filtro de seguridad: Omite ítems huérfanos sin datos de producto reales
                        .filter(item => item && (item.product || item.productId || item.id))
                        .map(item => {
                            const prod = item.product || {};
                            return {
                                id: prod._id || item.productId || item.id || item._id,
                                name: prod.name || item.name || 'Producto Desconocido',
                                price: prod.price !== undefined ? Number(prod.price) : Number(item.price || 0),
                                image: prod.image || item.image || '/images/default-product.png',
                                quantity: item.quantity || 1
                            };
                        });
                } else {
                    cart = getGuestCart();
                }
            } else {
                cart = getGuestCart();
            }
        } catch (error) {
            cart = getGuestCart();
        } finally {
            updateCartCount();
            renderCartItems();
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
            // Quita el foco activo de cualquier elemento interno antes de ocultar
            if (document.activeElement && cartDrawer.contains(document.activeElement)) {
                document.activeElement.blur();
            }
            cartDrawer.classList.remove('open');
            cartDrawer.setAttribute('aria-hidden', 'true');
            cartDrawer.setAttribute('inert', ''); // Desactiva interacción para lectores de pantalla

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
            addToGuestCart(productId, quantity, productData);
            notify('Producto añadido al carrito', 'success');
            return;
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
                    return;
                }
            }
            addToGuestCart(productId, quantity, productData);
            notify('Producto añadido al carrito', 'success');
        } catch (error) {
            addToGuestCart(productId, quantity, productData);
            notify('Producto añadido al carrito', 'success');
        }
    }

    function addToGuestCart(productId, quantity, productData) {
        let localCart = getGuestCart();
        const index = localCart.findIndex(i => i.id === productId);

        if (index > -1) {
            localCart[index].quantity += quantity;
            if (localCart[index].quantity <= 0) {
                localCart.splice(index, 1);
            }
        } else if (quantity > 0) {
            localCart.push({
                id: productId,
                name: productData ? productData.name : 'Producto',
                price: productData ? productData.price : 0,
                image: productData ? productData.image : '',
                quantity: quantity
            });
        }

        saveGuestCart(localCart);
        fetchCart();
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

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    await fetchCart();
                    notify('Producto eliminado del carrito', 'info');
                    return;
                }
            }
            removeFromGuestCart(productId);
            notify('Producto eliminado del carrito', 'info');
        } catch (error) {
            removeFromGuestCart(productId);
            notify('Producto eliminado del carrito', 'info');
        }
    }

    function removeFromGuestCart(productId) {
        let localCart = getGuestCart().filter(i => i.id !== productId);
        saveGuestCart(localCart);
        fetchCart();
    }

    // Eventos Globales Delegados
    document.addEventListener('click', async (e) => {
        const addBtn = e.target.closest('button[data-id]');
        if (addBtn && !addBtn.classList.contains('cart-item-remove') && !addBtn.classList.contains('btn-qty-minus') && !addBtn.classList.contains('btn-qty-plus')) {
            const productId = addBtn.getAttribute('data-id');
            const card = addBtn.closest('.product-card');

            const productData = card ? {
                name: card.querySelector('h3')?.textContent || 'Producto',
                price: parseFloat(card.querySelector('.product-price')?.textContent.replace('$', '') || 0),
                image: card.querySelector('img')?.src || ''
            } : null;

            if (productId) {
                await addToCart(productId, 1, productData);
                
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
                await addToCart(id, -1);
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

    // Enviar Orden / Iniciar Sesión de Stripe Checkout
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = document.getElementById('btn-confirm-order');
            const paymentMethodSelect = document.getElementById('payment-method');
            const paymentMethod = paymentMethodSelect ? paymentMethodSelect.value : 'card';

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
                    body: JSON.stringify({ paymentMethod })
                });

                const data = await response.json();

                if (response.ok && data.success && data.url) {
                    clearGuestCart();
                    // Redirección oficial a la pasarela de pago de Stripe
                    window.location.href = data.url;
                } else {
                    if (response.status === 401) {
                        notify('Debes iniciar sesión para completar la compra.', 'error');
                        if (checkoutStatus) {
                            checkoutStatus.textContent = 'Debes iniciar sesión para completar la compra.';
                            checkoutStatus.className = 'form-status error';
                        }
                    } else {
                        const errorMsg = data.error || 'Ocurrió un error al procesar el pedido.';
                        notify(errorMsg, 'error');
                        if (checkoutStatus) {
                            checkoutStatus.textContent = errorMsg;
                            checkoutStatus.className = 'form-status error';
                        }
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