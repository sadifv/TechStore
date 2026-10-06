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

    // Obtención de parámetros de búsqueda y filtros
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

        // Limpieza segura del contenedor
        while (catalogContainer.firstChild) {
            catalogContainer.removeChild(catalogContainer.firstChild);
        }

        // Caso sin productos encontrados
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

        // Renderizado semántico de tarjetas de producto
        data.products.forEach(product => {
            const li = document.createElement('li');

            const article = document.createElement('article');
            article.classList.add('product-card');

            const img = document.createElement('img');
            img.src = product.image || '/images/placeholder.jpg';
            img.alt = product.name;
            img.loading = 'lazy';

            const header = document.createElement('header');
            const title = document.createElement('h3');
            title.textContent = product.name;
            header.appendChild(title);

            const pPrice = document.createElement('p');
            pPrice.classList.add('price');
            pPrice.textContent = `$${Number(product.price).toFixed(2)}`;

            const footer = document.createElement('footer');
            const addBtn = document.createElement('button');
            addBtn.classList.add('btn', 'btn-primary');
            addBtn.textContent = 'Agregar al Carrito';
            addBtn.dataset.id = product._id;
            
            // Reutiliza la función global de agregar al carrito si existe
            addBtn.addEventListener('click', () => {
                if (typeof addToCart === 'function') {
                    addToCart(product._id);
                }
            });
            footer.appendChild(addBtn);

            article.appendChild(img);
            article.appendChild(header);
            article.appendChild(pPrice);
            article.appendChild(footer);

            li.appendChild(article);
            catalogContainer.appendChild(li);
        });

        // Renderizado del bloque de controles de paginación
        renderPagination(data.pagination, paginationContainer);

    } catch (error) {
        console.error('Error al cargar productos:', error);
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

    // Botón Anterior
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

    // Indicador de Página
    const pageInfo = document.createElement('span');
    pageInfo.classList.add('pagination-info');
    pageInfo.textContent = `Página ${pagination.currentPage} de ${pagination.totalPages}`;
    nav.appendChild(pageInfo);

    // Botón Siguiente
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
    const searchInput = document.getElementById('search-input');
    const categorySelect = document.getElementById('category-select');
    const sortSelect = document.getElementById('sort-select');

    // Listeners de eventos de filtros
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