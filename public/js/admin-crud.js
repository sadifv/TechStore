document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // ELEMENTOS DEL DOM
    // ==========================================
    const productsList = document.getElementById('admin-products-list');
    const productModal = document.getElementById('product-modal');
    const productForm = document.getElementById('product-form');
    const modalTitle = document.getElementById('modal-title');
    const btnOpenCreate = document.getElementById('btn-open-create-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnCancelModal = document.getElementById('btn-cancel-modal');

    // Elementos de imagen
    const imageFileInput = document.getElementById('prod-image-file');
    const imageUrlInput = document.getElementById('prod-image');
    const imagePreview = document.getElementById('prod-image-preview');

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

    if (productsList) fetchProducts();

    // ==========================================
    // PREVISUALIZACIÓN DE IMÁGENES
    // ==========================================

    if (imageFileInput && imagePreview) {
        imageFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    imagePreview.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (imageUrlInput && imagePreview) {
        imageUrlInput.addEventListener('input', (e) => {
            const url = e.target.value.trim();
            if (url && (!imageFileInput || !imageFileInput.files.length)) {
                imagePreview.src = url;
            }
        });
    }

    // ==========================================
    // MODAL DE PRODUCTO (Crear/Editar)
    // ==========================================

    if (btnOpenCreate) {
        btnOpenCreate.addEventListener('click', () => {
            productForm.reset();
            document.getElementById('product-id').value = '';
            if (imagePreview) imagePreview.src = '/images/products/product-placeholder.svg';
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
            const priceVal = parseFloat(document.getElementById('prod-price').value);

            if (isNaN(priceVal) || priceVal < 0) {
                if (window.showToast) window.showToast('El precio debe ser un número válido mayor o igual a 0.', 'error');
                return;
            }

            const formData = new FormData(productForm);
            const isEditing = Boolean(id);
            const url = isEditing ? `/admin/products/${id}` : '/admin/products';
            const method = isEditing ? 'PUT' : 'POST';

            try {
                const res = await fetch(url, {
                    method,
                    body: formData
                });

                const data = await res.json();

                if (data.success) {
                    if (window.showToast) {
                        window.showToast(isEditing ? 'Producto actualizado correctamente' : 'Producto creado con éxito', 'success');
                    }
                    closeModal();
                    fetchProducts();
                } else {
                    if (window.showToast) window.showToast(data.error || 'Ocurrió un error al procesar la solicitud', 'error');
                }
            } catch (err) {
                console.error('Error al guardar producto:', err);
                if (window.showToast) window.showToast('Error de conexión con el servidor.', 'error');
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
                    if (window.showToast) window.showToast(data.message, 'success');
                    closeFlashModal();
                    fetchProducts();
                } else {
                    if (window.showToast) window.showToast(data.error || 'Error al activar la oferta', 'error');
                }
            } catch (err) {
                console.error('Error al activar flash sale:', err);
                if (window.showToast) window.showToast('Error de conexión con el servidor.', 'error');
            }
        });
    }

    async function fetchProducts() {
        try {
            const response = await fetch('/api/products?limit=100');
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || `Error HTTP ${response.status}`);
            }
            renderProducts(data.products);
        } catch (error) {
            console.error('Error al cargar productos del panel:', error);
            if (productsList) {
                productsList.replaceChildren();
                const row = document.createElement('tr');
                const cell = document.createElement('td');
                cell.colSpan = 7;
                cell.className = 'text-center';
                cell.textContent = 'No se pudieron cargar los productos.';
                row.appendChild(cell);
                productsList.appendChild(row);
            }
            if (window.showToast) window.showToast('No se pudieron cargar los productos.', 'error');
        }
    }

    function renderProducts(products) {
        if (!productsList) return;

        productsList.replaceChildren();
        window.adminProductsCache = products;

        if (products.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 7;
            cell.className = 'text-center';
            cell.textContent = 'No hay productos registrados.';
            row.appendChild(cell);
            productsList.appendChild(row);
            return;
        }

        products.forEach(product => {
            const row = document.createElement('tr');
            row.dataset.id = product._id;

            const imageCell = document.createElement('td');
            const image = document.createElement('img');
            image.className = 'admin-product-thumbnail';
            image.src = product.image || '/images/products/product-placeholder.svg';
            image.alt = product.name;
            image.loading = 'lazy';
            imageCell.appendChild(image);

            const nameCell = document.createElement('td');
            nameCell.textContent = product.name;

            const categoryCell = document.createElement('td');
            categoryCell.textContent = product.category;

            const priceCell = document.createElement('td');
            priceCell.textContent = `$${Number(product.price).toFixed(2)}`;

            const stockCell = document.createElement('td');
            stockCell.textContent = product.stock;

            const saleCell = document.createElement('td');
            const isFlashSaleActive = product.flashSale &&
                product.flashSaleEndsAt &&
                new Date(product.flashSaleEndsAt) > new Date();
            saleCell.textContent = isFlashSaleActive
                ? `Activa · ${product.flashSaleDiscount}%`
                : 'Sin oferta';

            const actionsCell = document.createElement('td');
            actionsCell.className = 'admin-actions';
            actionsCell.append(
                createProductAction('Editar', 'btn-edit-product', product._id),
                createProductAction('Eliminar', 'btn-delete-product', product._id),
                createProductAction(
                    isFlashSaleActive ? 'Detener oferta' : 'Poner en oferta',
                    isFlashSaleActive ? 'btn-stop-flash-product' : 'btn-flash-product',
                    product._id
                )
            );

            row.append(imageCell, nameCell, categoryCell, priceCell, stockCell, saleCell, actionsCell);
            productsList.appendChild(row);
        });
    }

    function createProductAction(label, className, productId) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `btn btn-sm ${className}`;
        button.dataset.id = productId;
        button.textContent = label;
        return button;
    }

    // ==========================================
    // ACCIONES DE EDICIÓN Y ELIMINACIÓN DESDE LA TABLA
    // ==========================================

    document.addEventListener('click', async (e) => {
        // Botón Eliminar Producto
        const deleteProdBtn = e.target.closest('.btn-delete-product');
        if (deleteProdBtn) {
            const id = deleteProdBtn.getAttribute('data-id');
            if (!id) return;

            const confirmed = await window.showConfirm(
                'Se eliminará este producto del catálogo. Esta acción no se puede deshacer.',
                'Eliminar producto',
                'Conservar producto'
            );
            if (!confirmed) return;

            try {
                const res = await fetch(`/admin/products/${id}`, { method: 'DELETE' });
                const data = await res.json();

                if (data.success) {
                    if (window.showToast) window.showToast('Producto eliminado correctamente', 'success');
                    await fetchProducts();
                } else {
                    if (window.showToast) window.showToast(data.error || 'Error al eliminar', 'error');
                }
            } catch (err) {
                console.error('Error al eliminar producto:', err);
            }
            return;
        }

        // Botón Editar Producto
        const editProdBtn = e.target.closest('.btn-edit-product');
        if (editProdBtn) {
            const id = editProdBtn.getAttribute('data-id');
            if (!id) return;
            const product = (window.adminProductsCache || []).find(item => item._id === id);
            if (!product) return;
            document.getElementById('product-id').value = id;
            document.getElementById('prod-name').value = product.name;
            document.getElementById('prod-description').value = product.description || '';
            document.getElementById('prod-price').value = product.price;
            document.getElementById('prod-stock').value = product.stock;
            document.getElementById('prod-image').value = product.image || '';
            const categorySelect = document.getElementById('prod-category');
            if (product.category && !Array.from(categorySelect.options).some(option => option.value === product.category)) {
                const option = document.createElement('option');
                option.value = product.category;
                option.textContent = product.category;
                categorySelect.appendChild(option);
            }
            categorySelect.value = product.category || '';
            if (imageFileInput) imageFileInput.value = '';
            if (imagePreview) imagePreview.src = product.image || '/images/products/product-placeholder.svg';

            modalTitle.textContent = 'Editar Producto';
            productModal.showModal();
            return;
        }

        // Botón Flash Sale
        const flashProdBtn = e.target.closest('.btn-flash-product');
        if (flashProdBtn) {
            const id = flashProdBtn.getAttribute('data-id');
            if (!id) return;
            const product = (window.adminProductsCache || []).find(item => item._id === id);
            if (!product) return;
            flashProductId.value = id;
            flashProductName.textContent = product.name;
            flashCurrentPrice.textContent = `$${Number(product.price).toFixed(2)}`;
            flashCurrentPrice.dataset.price = product.price;
            flashDiscount.value = 20;
            flashDuration.value = 24;
            updateFinalPrice();
            flashModal.showModal();
            return;
        }

        const stopFlashProdBtn = e.target.closest('.btn-stop-flash-product');
        if (stopFlashProdBtn) {
            const id = stopFlashProdBtn.getAttribute('data-id');
            if (!id) return;
            const confirmed = await window.showConfirm(
                'Se detendrá la oferta y el precio volverá a su valor original.',
                'Detener oferta',
                'Mantener oferta'
            );
            if (!confirmed) return;
            try {
                const response = await fetch(`/admin/products/${id}/flash-sale`, { method: 'DELETE' });
                const data = await response.json();
                if (!response.ok || !data.success) {
                    throw new Error(data.error || 'No se pudo detener la oferta.');
                }
                if (window.showToast) window.showToast(data.message, 'success');
                await fetchProducts();
            } catch (error) {
                console.error('Error al detener oferta:', error);
                if (window.showToast) window.showToast(error.message || 'Error al detener la oferta.', 'error');
            }
            return;
        }

        // Botón Eliminar Mensaje
        const deleteMsgBtn = e.target.closest('.btn-delete-message');
        if (deleteMsgBtn) {
            const id = deleteMsgBtn.getAttribute('data-id');
            if (!id) return;

            const confirmed = await window.showConfirm(
                'Este mensaje de contacto se eliminará permanentemente.',
                'Eliminar mensaje',
                'Conservar mensaje'
            );
            if (!confirmed) return;

            try {
                const res = await fetch(`/admin/messages/${id}`, { method: 'DELETE' });
                const data = await res.json();

                if (data.success) {
                    const tr = deleteMsgBtn.closest('tr');
                    if (tr) tr.remove();
                    if (window.showToast) window.showToast('Mensaje eliminado correctamente', 'success');
                } else {
                    if (window.showToast) window.showToast(data.error || 'Error al eliminar el mensaje', 'error');
                }
            } catch (err) {
                console.error('Error al eliminar mensaje:', err);
                if (window.showToast) window.showToast('Error de conexión con el servidor.', 'error');
            }
            return;
        }

        // Botón Eliminar Suscriptor
        const deleteSubBtn = e.target.closest('.btn-delete-subscriber');
        if (deleteSubBtn) {
            const id = deleteSubBtn.getAttribute('data-id');
            if (!id) return;

            const confirmed = await window.showConfirm(
                'Se eliminará este correo de la lista del newsletter.',
                'Eliminar suscriptor',
                'Conservar suscriptor'
            );
            if (!confirmed) return;

            try {
                const res = await fetch(`/admin/subscribers/${id}`, { method: 'DELETE' });
                const data = await res.json();

                if (data.success) {
                    const tr = deleteSubBtn.closest('tr');
                    if (tr) tr.remove();
                    if (window.showToast) window.showToast('Suscriptor eliminado correctamente', 'success');
                } else {
                    if (window.showToast) window.showToast(data.error || 'Error al eliminar el suscriptor', 'error');
                }
            } catch (err) {
                console.error('Error al eliminar suscriptor:', err);
                if (window.showToast) window.showToast('Error de conexión con el servidor.', 'error');
            }
            return;
        }

        // Botón Eliminar Usuario
        const deleteUserBtn = e.target.closest('.btn-delete-user');
        if (deleteUserBtn) {
            const id = deleteUserBtn.getAttribute('data-id');
            if (!id) return;

            const confirmed = await window.showConfirm(
                'Esta cuenta de usuario se eliminará permanentemente.',
                'Eliminar usuario',
                'Conservar usuario'
            );
            if (!confirmed) return;

            try {
                const res = await fetch(`/admin/users/${id}`, { method: 'DELETE' });
                const data = await res.json();

                if (data.success) {
                    const tr = deleteUserBtn.closest('tr');
                    if (tr) tr.remove();
                    if (window.showToast) window.showToast('Usuario eliminado correctamente', 'success');
                } else {
                    if (window.showToast) window.showToast(data.error || 'Error al eliminar el usuario', 'error');
                }
            } catch (err) {
                console.error('Error al eliminar usuario:', err);
                if (window.showToast) window.showToast('Error de conexión con el servidor.', 'error');
            }
            return;
        }
    });

    // ==========================================
    // ACTUALIZACIÓN DEL ESTADO DE ÓRDENES (ADMIN)
    // ==========================================

    document.addEventListener('change', async (e) => {
        const statusSelect = e.target.closest('.select-order-status');
        if (!statusSelect) return;

        const orderId = statusSelect.getAttribute('data-order-id');
        const newStatus = statusSelect.value;

        if (!orderId || !newStatus) return;

        statusSelect.disabled = true;

        try {
            const res = await fetch(`/admin/orders/${orderId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                if (window.showToast) window.showToast(errorData.error || `Error HTTP ${res.status}`, 'error');
                return;
            }

            const data = await res.json();

            if (data.success && window.showToast) {
                window.showToast('Estado de la orden actualizado', 'success');
            }
        } catch (err) {
            console.error('Error al actualizar estado de orden:', err);
            if (window.showToast) window.showToast('Error de conexión con el servidor.', 'error');
        } finally {
            statusSelect.disabled = false;
        }
    });
});
