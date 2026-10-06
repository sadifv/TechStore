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
            await fetch('/api/cart/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    productId: item.id || item.productId || item._id,
                    quantity: item.quantity || 1
                })
            });
        }
        clearGuestCart();
        console.log('Carrito local sincronizado exitosamente con MongoDB.');
    } catch (error) {
        console.error('Error al sincronizar el carrito local:', error);
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

    // Cargar carrito desde MongoDB o LocalStorage
    async function fetchCart() {
        try {
            const response = await fetch('/api/cart');
            const data = await response.json();

            if (response.ok && data.success && Array.isArray(data.items)) {
                cart = data.items.map(item => ({
                    id: item.product ? (item.product._id || item.product) : item.productId,
                    name: item.product ? (item.product.name || 'Producto') : 'Producto',
                    price: item.product ? (item.product.price || 0) : 0,
                    image: item.product ? (item.product.image || '') : '',
                    quantity: item.quantity
                }));
            } else {
                // Si no hay sesión iniciada, usar LocalStorage
                cart = getGuestCart();
            }
        } catch (error) {
            console.warn('Servidor sin sesión activa, cargando carrito local:', error);
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
            fetchCart();
        }
    }

    function closeCart() {
        if (cartDrawer) {
            cartDrawer.classList.remove('open');
            cartDrawer.setAttribute('aria-hidden', 'true');
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
        try {
            const response = await fetch('/api/cart/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId, quantity })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                await fetchCart();
            } else {
                // Guardar en LocalStorage si no hay sesión
                addToGuestCart(productId, quantity, productData);
            }
        } catch (error) {
            addToGuestCart(productId, quantity, productData);
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
        try {
            const response = await fetch(`/api/cart/remove/${productId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (response.ok && data.success) {
                await fetchCart();
            } else {
                removeFromGuestCart(productId);
            }
        } catch (error) {
            removeFromGuestCart(productId);
        }
    }

    function removeFromGuestCart(productId) {
        let localCart = getGuestCart().filter(i => i.id !== productId);
        saveGuestCart(localCart);
        fetchCart();
    }

    document.addEventListener('click', async (e) => {
        const addBtn = e.target.closest('button[data-id]');
        if (addBtn && !addBtn.classList.contains('cart-item-remove')) {
            const productId = addBtn.getAttribute('data-id');
            const card = addBtn.closest('.product-card');

            // Extraer metadatos por si el usuario es un visitante
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

    // Cargar productos al inicio
    fetchCart();
});