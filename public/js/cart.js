document.addEventListener('DOMContentLoaded', () => {
    let cart = JSON.parse(localStorage.getItem('techstore_cart')) || [];

    const cartCountEl = document.getElementById('cart-count');
    const cartBtn = document.getElementById('cart-btn');
    const cartDrawer = document.getElementById('cart-drawer');
    const cartCloseBtn = document.getElementById('cart-close-btn');
    const cartOverlay = document.getElementById('cart-overlay');
    const cartDrawerBody = document.getElementById('cart-drawer-body');
    const cartTotalEl = document.getElementById('cart-total');

    function openCart() {
        if (cartDrawer) {
            cartDrawer.classList.add('open');
            cartDrawer.setAttribute('aria-hidden', 'false');
            renderCartItems();
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

    function saveCart() {
        localStorage.setItem('techstore_cart', JSON.stringify(cart));
        updateCartCount();
        renderCartItems();
    }

    function updateCartCount() {
        if (!cartCountEl) return;
        const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
        cartCountEl.textContent = totalItems.toString();
        
        cartCountEl.classList.add('bump');
        setTimeout(() => cartCountEl.classList.remove('bump'), 300);
    }

    function renderCartItems() {
        if (!cartDrawerBody || !cartTotalEl) return;

        // Limpieza del contenedor sin utilizar innerHTML
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

    function addToCart(productId, productCard) {
        const nameEl = productCard.querySelector('h3');
        const priceEl = productCard.querySelector('.price');
        const imgEl = productCard.querySelector('img');

        const name = nameEl ? nameEl.textContent.trim() : 'Producto';
        const priceText = priceEl ? priceEl.textContent.replace('$', '').trim() : '0';
        const price = parseFloat(priceText);
        const image = imgEl ? imgEl.getAttribute('src') : '';

        const existingItem = cart.find(item => item.id === productId);

        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({ id: productId, name, price, image, quantity: 1 });
        }

        saveCart();
    }

    document.addEventListener('click', (e) => {
        const addBtn = e.target.closest('button[data-id]');
        if (addBtn && !addBtn.classList.contains('cart-item-remove')) {
            const productId = addBtn.getAttribute('data-id');
            const productCard = addBtn.closest('.product-card');
            if (productId && productCard) {
                addToCart(productId, productCard);
                
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
            const item = cart.find(i => i.id === id);
            if (item) {
                item.quantity += 1;
                saveCart();
            }
            return;
        }

        if (e.target.closest('.btn-qty-minus')) {
            const itemEl = e.target.closest('.cart-item');
            const id = itemEl.getAttribute('data-id');
            const item = cart.find(i => i.id === id);
            if (item) {
                if (item.quantity > 1) {
                    item.quantity -= 1;
                } else {
                    cart = cart.filter(i => i.id !== id);
                }
                saveCart();
            }
            return;
        }

        if (e.target.closest('.cart-item-remove')) {
            const itemEl = e.target.closest('.cart-item');
            const id = itemEl.getAttribute('data-id');
            cart = cart.filter(i => i.id !== id);
            saveCart();
            return;
        }
    });

    updateCartCount();
});