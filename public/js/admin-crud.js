document.addEventListener('DOMContentLoaded', () => {
    const productsList = document.getElementById('admin-products-list');
    const productModal = document.getElementById('product-modal');
    const productForm = document.getElementById('product-form');
    const modalTitle = document.getElementById('modal-title');

    const btnOpenCreate = document.getElementById('btn-open-create-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnCancelModal = document.getElementById('btn-cancel-modal');

    // Cargar catálogo al iniciar
    fetchProducts();

    // Abrir diálogo para crear
    if (btnOpenCreate) {
        btnOpenCreate.addEventListener('click', () => {
            productForm.reset();
            document.getElementById('product-id').value = '';
            modalTitle.textContent = 'Agregar Producto';
            productModal.showModal();
        });
    }

    // Cerrar diálogo
    const closeModal = () => productModal.close();
    if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
    if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);

    // Enviar formulario (Crear o Editar)
    if (productForm) {
        productForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const id = document.getElementById('product-id').value;
            const payload = {
                name: document.getElementById('prod-name').value,
                description: document.getElementById('prod-description').value,
                price: parseFloat(document.getElementById('prod-price').value),
                stock: parseInt(document.getElementById('prod-stock').value, 10),
                category: document.getElementById('prod-category').value,
                image: document.getElementById('prod-image').value
            };

            const isEditing = Boolean(id);
            const url = isEditing ? `/admin/products/${id}` : '/admin/products';
            const method = isEditing ? 'PUT' : 'POST';

            try {
                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();

                if (data.success) {
                    alert(isEditing ? 'Producto actualizado correctamente' : 'Producto creado con éxito');
                    closeModal();
                    fetchProducts();
                } else {
                    alert(data.error || 'Ocurrió un error al procesar la solicitud');
                }
            } catch (err) {
                console.error('Error al guardar producto:', err);
                alert('Error de conexión con el servidor.');
            }
        });
    }

    // Obtener catálogo desde la API
    async function fetchProducts() {
        try {
            const res = await fetch('/api/products');
            const data = await res.json();

            if (data.success) {
                renderProducts(data.data);
            }
        } catch (err) {
            console.error('Error al cargar productos:', err);
        }
    }

    // Renderizar la lista construyendo nodos DOM semánticos
    function renderProducts(products) {
        if (!productsList) return;

        // Limpiar contenido previo del tbody
        productsList.replaceChildren();

        if (products.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 6;
            td.textContent = 'No hay productos registrados.';
            tr.appendChild(td);
            productsList.appendChild(tr);
            return;
        }

        window.adminProductsCache = products;

        products.forEach(prod => {
            const tr = document.createElement('tr');

            // 1. Imagen
            const tdImage = document.createElement('td');
            const img = document.createElement('img');
            img.src = prod.image;
            img.alt = prod.name;
            img.width = 50;
            img.style.objectFit = 'cover';
            img.style.borderRadius = '4px';
            tdImage.appendChild(img);

            // 2. Nombre
            const tdName = document.createElement('td');
            const strong = document.createElement('strong');
            strong.textContent = prod.name;
            tdName.appendChild(strong);

            // 3. Categoría
            const tdCategory = document.createElement('td');
            const spanCategory = document.createElement('span');
            spanCategory.textContent = prod.category;
            tdCategory.appendChild(spanCategory);

            // 4. Precio
            const tdPrice = document.createElement('td');
            tdPrice.textContent = `$${Number(prod.price).toFixed(2)}`;

            // 5. Stock
            const tdStock = document.createElement('td');
            tdStock.textContent = prod.stock;

            // 6. Acciones
            const tdActions = document.createElement('td');
            
            const btnEdit = document.createElement('button');
            btnEdit.type = 'button';
            btnEdit.className = 'btn btn-sm btn-edit';
            btnEdit.textContent = 'Editar';
            btnEdit.addEventListener('click', () => editProduct(prod._id));

            const btnDelete = document.createElement('button');
            btnDelete.type = 'button';
            btnDelete.className = 'btn btn-sm btn-delete';
            btnDelete.textContent = 'Eliminar';
            btnDelete.addEventListener('click', () => deleteProduct(prod._id));

            tdActions.append(btnEdit, ' ', btnDelete);

            // Ensamblar la fila
            tr.append(tdImage, tdName, tdCategory, tdPrice, tdStock, tdActions);
            productsList.appendChild(tr);
        });
    }

    // Editar Producto
    function editProduct(id) {
        const prod = (window.adminProductsCache || []).find(p => p._id === id);
        if (!prod) return;

        document.getElementById('product-id').value = prod._id;
        document.getElementById('prod-name').value = prod.name;
        document.getElementById('prod-description').value = prod.description;
        document.getElementById('prod-price').value = prod.price;
        document.getElementById('prod-stock').value = prod.stock;
        document.getElementById('prod-category').value = prod.category;
        document.getElementById('prod-image').value = prod.image;

        modalTitle.textContent = 'Editar Producto';
        productModal.showModal();
    }

    // Eliminar Producto
    async function deleteProduct(id) {
        if (!confirm('¿Estás seguro de que deseas eliminar este producto?')) return;

        try {
            const res = await fetch(`/admin/products/${id}`, { method: 'DELETE' });
            const data = await res.json();

            if (data.success) {
                alert('Producto eliminado correctamente');
                fetchProducts();
            } else {
                alert(data.error || 'Error al eliminar');
            }
        } catch (err) {
            console.error('Error al eliminar producto:', err);
            alert('Error de conexión con el servidor.');
        }
    }

    // --- ELIMINAR MENSAJES DE CONTACTO, SUSCRIPTORES Y USUARIOS ---
    document.addEventListener('click', async (e) => {
        // Eliminar Mensaje de Contacto
        const deleteMsgBtn = e.target.closest('.btn-delete-message');
        if (deleteMsgBtn) {
            const id = deleteMsgBtn.getAttribute('data-id');
            if (!id || !confirm('¿Estás seguro de que deseas eliminar este mensaje?')) return;

            try {
                const res = await fetch(`/admin/messages/${id}`, { method: 'DELETE' });
                const data = await res.json();

                if (data.success) {
                    const tr = deleteMsgBtn.closest('tr');
                    if (tr) tr.remove();
                } else {
                    alert(data.error || 'Error al eliminar el mensaje');
                }
            } catch (err) {
                console.error('Error al eliminar mensaje:', err);
                alert('Error de conexión con el servidor.');
            }
            return;
        }

        // Eliminar Suscriptor al Boletín
        const deleteSubBtn = e.target.closest('.btn-delete-subscriber');
        if (deleteSubBtn) {
            const id = deleteSubBtn.getAttribute('data-id');
            if (!id || !confirm('¿Estás seguro de que deseas eliminar este suscriptor?')) return;

            try {
                const res = await fetch(`/admin/subscribers/${id}`, { method: 'DELETE' });
                const data = await res.json();

                if (data.success) {
                    const tr = deleteSubBtn.closest('tr');
                    if (tr) tr.remove();
                } else {
                    alert(data.error || 'Error al eliminar el suscriptor');
                }
            } catch (err) {
                console.error('Error al eliminar suscriptor:', err);
                alert('Error de conexión con el servidor.');
            }
            return;
        }

        // Eliminar Usuario Registrado
        const deleteUserBtn = e.target.closest('.btn-delete-user');
        if (deleteUserBtn) {
            const id = deleteUserBtn.getAttribute('data-id');
            if (!id || !confirm('¿Estás seguro de que deseas eliminar este usuario?')) return;

            try {
                const res = await fetch(`/admin/users/${id}`, { method: 'DELETE' });
                const data = await res.json();

                if (data.success) {
                    const tr = deleteUserBtn.closest('tr');
                    if (tr) tr.remove();
                } else {
                    alert(data.error || 'Error al eliminar el usuario');
                }
            } catch (err) {
                console.error('Error al eliminar usuario:', err);
                alert('Error de conexión con el servidor.');
            }
            return;
        }
    });
});