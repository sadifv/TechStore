let currentPage = 1;
const limit = 8;

async function loadProducts(page = 1) {
    const catalogContainer = document.getElementById('products-grid');
    const paginationContainer = document.getElementById('pagination-controls');

    if (!catalogContainer) return;

    try {
        const response = await fetch(`/api/products?page=${page}&limit=${limit}`);
        const data = await response.json();

        if (!data.success) return;

        // Limpieza segura del contenedor
        while (catalogContainer.firstChild) {
            catalogContainer.removeChild(catalogContainer.firstChild);
        }

        // Renderizado semántico de tarjetas de producto
        data.products.forEach(product => {
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

            catalogContainer.appendChild(article);
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
        currentPage--;
        loadProducts(currentPage);
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
        currentPage++;
        loadProducts(currentPage);
    });
    nav.appendChild(nextBtn);

    container.appendChild(nav);
}

document.addEventListener('DOMContentLoaded', () => {
    loadProducts(currentPage);
});