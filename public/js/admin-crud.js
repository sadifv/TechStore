document.addEventListener('DOMContentLoaded', () => {
    const productsList = document.getElementById('admin-products-list');
    const productModal = document.getElementById('product-modal');
    const productForm = document.getElementById('product-form');
    const modalTitle = document.getElementById('modal-title');

    const btnOpenCreate = document.getElementById('btn-open-create-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnCancelModal = document.getElementById('btn-cancel-modal');

    // Flash Sale modal
    const flashModal = document.getElementById('flash-sale-modal');
    const flashForm = document.getElementById('flash-sale-form');
    const btnCloseFlashModal = document.getElementById('btn-close-flash-modal');
    const btnCancelFlashModal = document.getElementById('btn-cancel-flash-modal');
    const flashProductId = document.getElementById('flash-product-id');
    const flashProductName = document.getElementById('flash-product-name');
    const flashCurrentPrice = document.getElementById('flash-current-price');
    const flashDiscount = document.getElementById('flash-discount');
    const flashDuration = document.getElementById('flash-duration');
    const flashFinalPrice = document.getElementById('flash-final-price');

    // Cargar catálogo al iniciar
    fetchProducts();

    // ==========================================
    // MODAL DE PRODUCTO (Crear/Editar)
    // ==========================================

    if (btnOpenCreate) {
        btnOpenCreate.addEventListener('click', () => {
            productForm.reset();
            document.getElementById('product-id').value = '';
            modalTitle.textContent = 'Agregar Producto';
            productModal.showModal();
        });
    }

    const closeModal = () => productModal.close();
    if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
    if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);

    if (productForm) {
        productForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const id = document.getElementById('product-id').value;
            const payload = {
                name: document.getElementById('prod-name').value.trim(),
                description: document.getElementById('prod-description').value.trim(),
                price: window.parsePrice(document.getElementById('prod-price').value),
                stock: parseInt(document.getElementById('prod-stock').value, 10),
                category: document.getElementById('prod-category').value,
                image: document.getElementById('prod-image').value.trim()
            };

            // Validación rápida
            if (isNaN(payload.price) || payload.price < 0) {
                window.showToast('El precio debe ser un número válido mayor o igual a 0.', 'error');
                return;
            }

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
                    window.showToast(
                        isEditing ? 'Producto actualizado correctamente' : 'Producto creado con éxito',
                        'success'
                    );
                    closeModal();
                    fetchProducts();
                } else {
                    window.showToast(data.error || 'Ocurrió un error al procesar la solicitud', 'error');
                }
            } catch (err) {
                logger.error('Error al guardar producto:', err);
                window.showToast('Error de conexión con el servidor.', 'error');
            }
        });
    }

    // ==========================================
    // MODAL DE FLASH SALE
    // ==========================================

    const closeFlashModal = () => flashModal.close();
    if (btnCloseFlashModal) btnCloseFlashModal.addEventListener('click', closeFlashModal);
    if (btnCancelFlashModal) btnCancelFlashModal.addEventListener('click', closeFlashModal);

    const updateFinalPrice = () => {
        window.updateFinalPrice(flashCurrentPrice, flashDiscount, flashFinalPrice);
    };

    if (flashDiscount) flashDiscount.addEventListener('input', updateFinalPrice);
    if (flashDuration) flashDuration.addEventListener('input', updateFinalPrice);

    if (flashForm) {
        flashForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const id = flashProductId.value;
            const payload = {
                discount: parseInt(flashDiscount.value, 10),
                durationHours: parseInt(flashDuration.value, 10)
            };

            try {
                const res = await fetch(`/admin/products/${id}/flash-sale`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();

                if (data.success) {
                    window.showToast(data.message, 'success');
                    closeFlashModal();
                    fetchProducts();
                } else {
                    window.showToast(data.error || 'Error al activar la oferta', 'error');
                }
            } catch (err) {
                logger.error('Error al activar flash sale:', err);
                window.showToast('Error de conexión con el servidor.', 'error');
            }
        });
    }

    // ==========================================
    // OBTENER Y RENDERIZAR PRODUCTOS
    // ==========================================

    async function fetchProducts() {
        try {
            const res = await fetch('/api/products?limit=50');
            const data = await res.json();

            if (data.success) {
                renderProducts(data.products);
            }
        } catch (err) {
            logger.error('Error al cargar productos:', err);
        }
    }

    function renderProducts(products) {
        if (!productsList) return;

        productsList.replaceChildren();

        if (products.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 7;
            td.textContent = 'No hay productos registrados.';
            tr.appendChild(td);
            productsList.appendChild(tr);
            return;
        }

        window.adminProductsCache = products;

        products.forEach(prod => {
            const tr = document.createElement('tr');
            tr.dataset.id = prod._id;

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
            if (prod.flashSale && prod.originalPrice) {
                const priceContainer = document.createElement('span');
                priceContainer.classList.add('price-container');

                const original = document.createElement('del');
                original.classList.add('price-original');
                original.textContent = `$${Number(prod.originalPrice).toFixed(2)}`;

                const final = document.createElement('strong');
                final.classList.add('price-flash');
                final.textContent = ` $${Number(prod.price).toFixed(2)}`;

                priceContainer.append(original, final);
                tdPrice.appendChild(priceContainer);
            } else {
                tdPrice.textContent = `$${Number(prod.price).toFixed(2)}`;
            }

            // 5. Stock
            const tdStock = document.createElement('td');
            tdStock.textContent = prod.stock;

            // 6. Estado de Oferta
            const tdFlashStatus = document.createElement('td');
            if (prod.flashSale && prod.flashSaleEndsAt) {
                const endsAt = new Date(prod.flashSaleEndsAt);
                if (endsAt > new Date()) {
                    const badge = document.createElement('span');
                    badge.classList.add('badge-flash-active');
                    badge.textContent = `🔥 ${prod.flashSaleDiscount}% activo`;
                    badge.title = `Termina: ${endsAt.toLocaleString()}`;
                    tdFlashStatus.appendChild(badge);
                } else {
                    const badge = document.createElement('span');
                    badge.classList.add('badge-flash-expired');
                    badge.textContent = 'Expirada';
                    tdFlashStatus.appendChild(badge);
                }
            } else {
                const span = document.createElement('span');
                span.classList.add('badge-flash-inactive');
                span.textContent = '—';
                tdFlashStatus.appendChild(span);
            }

            // 7. Acciones
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

            const btnFlash = document.createElement('button');
            btnFlash.type = 'button';
            btnFlash.className = 'btn btn-sm btn-flash';
            if (prod.flashSale && prod.flashSaleEndsAt && new Date(prod.flashSaleEndsAt) > new Date()) {
                btnFlash.textContent = '⏹️ Detener';
                btnFlash.title = 'Detener la oferta y restaurar precio';
                btnFlash.addEventListener('click', () => deactivateFlashSale(prod._id));
            } else {
                btnFlash.textContent = '🔥 Oferta';
                btnFlash.title = 'Poner en oferta relámpago';
                btnFlash.addEventListener('click', () => openFlashModal(prod));
            }

            tdActions.append(btnEdit, ' ', btnDelete, ' ', btnFlash);

            tr.append(tdImage, tdName, tdCategory, tdPrice, tdStock, tdFlashStatus, tdActions);
            productsList.appendChild(tr);
        });
    }

    // ==========================================
    // ACCIONES DE PRODUCTOS: EDITAR, ELIMINAR Y FLASH SALE
    // ==========================================

    function editProduct(id) {
        const prod = (window.adminProductsCache || []).find(p => p._id === id);
        if (!prod) return;

        document.getElementById('product-id').value = prod._id;
        document.getElementById('prod-name').value = prod.name;
        document.getElementById('prod-description').value = prod.description || '';
        document.getElementById('prod-price').value = prod.price;
        document.getElementById('prod-stock').value = prod.stock;
        document.getElementById('prod-image').value = prod.image;

        const categorySelect = document.getElementById('prod-category');
        const categoryExists = Array.from(categorySelect.options)
            .some(opt => opt.value === prod.category);

        if (!categoryExists && prod.category) {
            const newOption = document.createElement('option');
            newOption.value = prod.category;
            newOption.textContent = prod.category;
            categorySelect.appendChild(newOption);
        }
        categorySelect.value = prod.category || '';

        modalTitle.textContent = 'Editar Producto';
        productModal.showModal();
    }

    async function deleteProduct(id) {
        const confirmed = await window.showConfirm(
            '¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.',
            'Eliminar'
        );
        if (!confirmed) return;

        try {
            const res = await fetch(`/admin/products/${id}`, { method: 'DELETE' });
            const data = await res.json();

            if (data.success) {
                window.showToast('Producto eliminado correctamente', 'success');
                fetchProducts();
            } else {
                window.showToast(data.error || 'Error al eliminar', 'error');
            }
        } catch (err) {
            logger.error('Error al eliminar producto:', err);
            window.showToast('Error de conexión con el servidor.', 'error');
        }
    }

    function openFlashModal(prod) {
        flashProductId.value = prod._id;
        flashProductName.textContent = prod.name;
        flashCurrentPrice.textContent = `$${Number(prod.price).toFixed(2)}`;
        flashCurrentPrice.dataset.price = prod.price;
        flashDiscount.value = 20;
        flashDuration.value = 24;
        updateFinalPrice();
        flashModal.showModal();
    }

    async function deactivateFlashSale(id) {
        const confirmed = await window.showConfirm(
            '¿Detener la oferta y restaurar el precio original?',
            'Detener'
        );
        if (!confirmed) return;

        try {
            const res = await fetch(`/admin/products/${id}/flash-sale`, {
                method: 'DELETE'
            });

            const data = await res.json();

            if (data.success) {
                window.showToast(data.message, 'success');
                fetchProducts();
            } else {
                window.showToast(data.error || 'Error al detener la oferta', 'error');
            }
        } catch (err) {
            logger.error('Error al detener flash sale:', err);
            window.showToast('Error de conexión con el servidor.', 'error');
        }
    }

    // ==========================================
    // ACTUALIZACIÓN DEL ESTADO DE ÓRDENES (NEW)
    // ==========================================

    document.addEventListener('change', async (e) => {
        const statusSelect = e.target.closest('.select-order-status');
        if (!statusSelect) return;

        const orderId = statusSelect.getAttribute('data-order-id');
        const newStatus = statusSelect.value;

        try {
            const res = await fetch(`/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            const data = await res.json();

            if (data.success) {
                window.showToast('Estado de la orden actualizado', 'success');
            } else {
                window.showToast(data.error || 'Error al actualizar estado', 'error');
            }
        } catch (err) {
            logger.error('Error al actualizar estado de orden:', err);
            window.showToast('Error de conexión con el servidor.', 'error');
        }
    });

    // ==========================================
    // ELIMINAR MENSAJES, SUSCRIPTORES, USUARIOS
    // ==========================================

    document.addEventListener('click', async (e) => {
        const deleteMsgBtn = e.target.closest('.btn-delete-message');
        if (deleteMsgBtn) {
            const id = deleteMsgBtn.getAttribute('data-id');
            if (!id) return;

            const confirmed = await window.showConfirm(
                '¿Estás seguro de que deseas eliminar este mensaje?',
                'Eliminar'
            );
            if (!confirmed) return;

            try {
                const res = await fetch(`/admin/messages/${id}`, { method: 'DELETE' });
                const data = await res.json();

                if (data.success) {
                    const tr = deleteMsgBtn.closest('tr');
                    if (tr) tr.remove();
                    window.showToast('Mensaje eliminado correctamente', 'success');
                } else {
                    window.showToast(data.error || 'Error al eliminar el mensaje', 'error');
                }
            } catch (err) {
                logger.error('Error al eliminar mensaje:', err);
                window.showToast('Error de conexión con el servidor.', 'error');
            }
            return;
        }

        const deleteSubBtn = e.target.closest('.btn-delete-subscriber');
        if (deleteSubBtn) {
            const id = deleteSubBtn.getAttribute('data-id');
            if (!id) return;

            const confirmed = await window.showConfirm(
                '¿Estás seguro de que deseas eliminar este suscriptor?',
                'Eliminar'
            );
            if (!confirmed) return;

            try {
                const res = await fetch(`/admin/subscribers/${id}`, { method: 'DELETE' });
                const data = await res.json();

                if (data.success) {
                    const tr = deleteSubBtn.closest('tr');
                    if (tr) tr.remove();
                    window.showToast('Suscriptor eliminado correctamente', 'success');
                } else {
                    window.showToast(data.error || 'Error al eliminar el suscriptor', 'error');
                }
            } catch (err) {
                logger.error('Error al eliminar suscriptor:', err);
                window.showToast('Error de conexión con el servidor.', 'error');
            }
            return;
        }

        const deleteUserBtn = e.target.closest('.btn-delete-user');
        if (deleteUserBtn) {
            const id = deleteUserBtn.getAttribute('data-id');
            if (!id) return;

            const confirmed = await window.showConfirm(
                '¿Estás seguro de que deseas eliminar este usuario?',
                'Eliminar'
            );
            if (!confirmed) return;

            try {
                const res = await fetch(`/admin/users/${id}`, { method: 'DELETE' });
                const data = await res.json();

                if (data.success) {
                    const tr = deleteUserBtn.closest('tr');
                    if (tr) tr.remove();
                    window.showToast('Usuario eliminado correctamente', 'success');
                } else {
                    window.showToast(data.error || 'Error al eliminar el usuario', 'error');
                }
            } catch (err) {
                logger.error('Error al eliminar usuario:', err);
                window.showToast('Error de conexión con el servidor.', 'error');
            }
            return;
        }
    });
});