document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // ELEMENTOS DEL DOM
    // ==========================================
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
            if (imagePreview) imagePreview.src = '/images/default-product.png';
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
                    window.location.reload();
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
                    window.location.reload();
                } else {
                    if (window.showToast) window.showToast(data.error || 'Error al activar la oferta', 'error');
                }
            } catch (err) {
                console.error('Error al activar flash sale:', err);
                if (window.showToast) window.showToast('Error de conexión con el servidor.', 'error');
            }
        });
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

            const confirmed = confirm('¿Estás seguro de que deseas eliminar este producto?');
            if (!confirmed) return;

            try {
                const res = await fetch(`/admin/products/${id}`, { method: 'DELETE' });
                const data = await res.json();

                if (data.success) {
                    if (window.showToast) window.showToast('Producto eliminado correctamente', 'success');
                    window.location.reload();
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

            // Buscar el producto en la tabla (datos ya renderizados con EJS)
            const row = editProdBtn.closest('tr');
            if (!row) return;

            const nameCell = row.children[1];
            const categoryCell = row.children[2];
            const priceCell = row.children[3];
            const stockCell = row.children[4];

            document.getElementById('product-id').value = id;
            document.getElementById('prod-name').value = nameCell ? nameCell.textContent.trim() : '';
            document.getElementById('prod-description').value = '';
            document.getElementById('prod-price').value = priceCell ? parseFloat(priceCell.textContent.replace('$', '')) || 0 : 0;
            document.getElementById('prod-stock').value = stockCell ? parseInt(stockCell.textContent) || 0 : 0;
            document.getElementById('prod-image').value = '';

            if (imagePreview) imagePreview.src = '/images/default-product.png';
            document.getElementById('prod-category').value = categoryCell ? categoryCell.textContent.trim() : '';

            modalTitle.textContent = 'Editar Producto';
            productModal.showModal();
            return;
        }

        // Botón Flash Sale
        const flashProdBtn = e.target.closest('.btn-flash-product');
        if (flashProdBtn) {
            const id = flashProdBtn.getAttribute('data-id');
            if (!id) return;

            const row = flashProdBtn.closest('tr');
            if (!row) return;

            const nameCell = row.children[1];
            const priceCell = row.children[3];

            flashProductId.value = id;
            flashProductName.textContent = nameCell ? nameCell.textContent.trim() : '-';
            flashCurrentPrice.textContent = priceCell ? priceCell.textContent.trim() : '$0.00';
            flashCurrentPrice.dataset.price = priceCell ? parseFloat(priceCell.textContent.replace('$', '')) || 0 : 0;
            flashDiscount.value = 20;
            flashDuration.value = 24;
            updateFinalPrice();
            flashModal.showModal();
            return;
        }

        // Botón Eliminar Mensaje
        const deleteMsgBtn = e.target.closest('.btn-delete-message');
        if (deleteMsgBtn) {
            const id = deleteMsgBtn.getAttribute('data-id');
            if (!id) return;

            const confirmed = confirm('¿Estás seguro de que deseas eliminar este mensaje?');
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

            const confirmed = confirm('¿Estás seguro de que deseas eliminar este suscriptor?');
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

            const confirmed = confirm('¿Estás seguro de que deseas eliminar este usuario?');
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
