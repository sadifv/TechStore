let currentPage = 1;
const limit = 8;
let debounceTimer;

async function loadProducts(page = 1) {
    currentPage = page;
    const catalogContainer = document.getElementById('products-grid');
    const paginationContainer = document.getElementById('pagination-controls');

    const searchInput = document.getElementById('search-input');
    const categorySelect = document.getElementById('category-select');
    const sortSelect = document.getElementById('sort-select');

    if (!catalogContainer) return;

    const search = searchInput ? searchInput.value.trim() : '';
    const category = categorySelect ? categorySelect.value : 'all';
    const sort = sortSelect ? sortSelect.value : 'recent';

    const params = new URLSearchParams({
        page: currentPage,
        limit,
        search,
        category,
        sort
    });

    try {
        const response = await fetch(`/api/products?${params.toString()}`);
        const data = await response.json();

        if (!data.success) return;

        while (catalogContainer.firstChild) {
            catalogContainer.removeChild(catalogContainer.firstChild);
        }

        if (data.products.length === 0) {
            const emptyLi = document.createElement('li');
            emptyLi.classList.add('empty-state-item');

            const emptyMsg = document.createElement('p');
            emptyMsg.classList.add('empty-msg');
            emptyMsg.textContent = 'No se encontraron productos con los filtros seleccionados.';

            emptyLi.appendChild(emptyMsg);
            catalogContainer.appendChild(emptyLi);

            if (paginationContainer) {
                while (paginationContainer.firstChild) {
                    paginationContainer.removeChild(paginationContainer.firstChild);
                }
            }
            return;
        }

        data.products.forEach(product => {
            const li = document.createElement('li');

            const article = document.createElement('article');
            article.classList.add('product-card');

            const productUrl = `/producto/${encodeURIComponent(product._id)}`;
            const media = document.createElement('figure');
            media.classList.add('product-card-media');

            const img = document.createElement('img');
            img.src = product.image || '/images/products/product-placeholder.svg';
            img.alt = product.name;
            img.loading = 'lazy';
            media.appendChild(img);

            const header = document.createElement('header');
            const title = document.createElement('h3');
            title.textContent = product.name;
            header.appendChild(title);

            const titleLink = document.createElement('a');
            titleLink.href = productUrl;
            titleLink.classList.add('product-card-link');
            titleLink.setAttribute('aria-label', `Ver detalles de ${product.name}`);
            titleLink.appendChild(media);
            titleLink.appendChild(header);

            const pPrice = document.createElement('p');
            pPrice.classList.add('product-price');
            pPrice.textContent = `$${Number(product.price).toFixed(2)}`;
            titleLink.appendChild(pPrice);

            const footer = document.createElement('footer');
            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.classList.add('btn', 'add-to-cart-btn');
            addBtn.textContent = Number(product.availableStock) > 0 ? 'Agregar al Carrito' : 'Agotado';
            addBtn.disabled = Number(product.availableStock) <= 0;
            addBtn.dataset.id = product._id;
            addBtn.dataset.stock = String(product.availableStock);
            footer.appendChild(addBtn);

            article.appendChild(titleLink);
            article.appendChild(footer);

            li.appendChild(article);
            catalogContainer.appendChild(li);
        });

        renderPagination(data.pagination || { totalPages: 1, currentPage: 1 }, paginationContainer);

    } catch (error) {
        console.error('Error al cargar productos:', error);
        if (catalogContainer) {
            while (catalogContainer.firstChild) {
                catalogContainer.removeChild(catalogContainer.firstChild);
            }
            const errorLi = document.createElement('li');
            errorLi.classList.add('empty-state-item');
            const errorMsg = document.createElement('p');
            errorMsg.classList.add('empty-msg');
            errorMsg.textContent = 'Error al cargar productos. Intenta recargar la página.';
            errorLi.appendChild(errorMsg);
            catalogContainer.appendChild(errorLi);
        }
    }
}

function renderPagination(pagination, container) {
    if (!container) return;

    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    if (pagination.totalPages <= 1) return;

    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Navegación de productos');
    nav.classList.add('pagination-nav');

    const prevBtn = document.createElement('button');
    prevBtn.classList.add('btn', 'btn-secondary', 'pagination-btn');
    prevBtn.textContent = '« Anterior';
    prevBtn.disabled = !pagination.hasPrevPage;
    prevBtn.addEventListener('click', () => {
        if (pagination.hasPrevPage) {
            loadProducts(pagination.currentPage - 1);
        }
    });
    nav.appendChild(prevBtn);

    const pageInfo = document.createElement('span');
    pageInfo.classList.add('pagination-info');
    pageInfo.textContent = `Página ${pagination.currentPage} de ${pagination.totalPages}`;
    nav.appendChild(pageInfo);

    const nextBtn = document.createElement('button');
    nextBtn.classList.add('btn', 'btn-secondary', 'pagination-btn');
    nextBtn.textContent = 'Siguiente »';
    nextBtn.disabled = !pagination.hasNextPage;
    nextBtn.addEventListener('click', () => {
        if (pagination.hasNextPage) {
            loadProducts(pagination.currentPage + 1);
        }
    });
    nav.appendChild(nextBtn);

    container.appendChild(nav);
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Catalog] DOMContentLoaded disparado');
    const searchInput = document.getElementById('search-input');
    const categorySelect = document.getElementById('category-select');
    const sortSelect = document.getElementById('sort-select');

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => loadProducts(1), 300);
        });
    }

    if (categorySelect) {
        categorySelect.addEventListener('change', () => loadProducts(1));
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', () => loadProducts(1));
    }

    loadProducts(currentPage);
});