// El script se carga con defer, así que el DOM ya está listo
(function() {
  const form = document.querySelector('#add-to-cart-form');
  if (!form) return;

  const quantityInput = document.getElementById('quantity');
  const stockIndicator = document.getElementById('stock-indicator');
  const stockCount = document.getElementById('stock-count');
  const stockLabel = document.getElementById('stock-label');
  const stockSeparator = document.getElementById('stock-separator');
  const stockUnitLabel = document.getElementById('stock-unit-label');
  const addToCartBtn = form.querySelector('button[type="button"]');
  const productId = form.querySelector('input[name="productId"]')?.value;
  let stockRefreshInProgress = false;

  // Helper para notificaciones flotantes elegantes
  function notify(message, type = 'info') {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type);
    }
  }

  function updateStockDisplay(availableStock) {
    const max = Math.max(0, Math.floor(availableStock));
    const isAvailable = max > 0;

    if (stockIndicator) {
      stockIndicator.classList.toggle('stock-in', isAvailable);
      stockIndicator.classList.toggle('stock-out', !isAvailable);
    }
    if (stockLabel) stockLabel.textContent = isAvailable ? 'En stock' : 'Agotado temporalmente';
    if (stockSeparator) stockSeparator.hidden = !isAvailable;
    if (stockCount) {
      stockCount.textContent = isAvailable ? String(max) : '';
      stockCount.hidden = !isAvailable;
    }
    if (stockUnitLabel) {
      stockUnitLabel.textContent = isAvailable ? 'unidades disponibles' : '';
      stockUnitLabel.hidden = !isAvailable;
    }
    if (quantityInput) {
      quantityInput.max = String(max);
      quantityInput.disabled = !isAvailable;
      if (isAvailable && Number(quantityInput.value) > max) {
        quantityInput.value = String(max);
      }
    }
    if (addToCartBtn) {
      addToCartBtn.dataset.stock = String(max);
      addToCartBtn.disabled = !isAvailable;
      addToCartBtn.textContent = isAvailable ? 'Añadir al carrito' : 'Producto agotado';
    }
  }

  async function refreshStock() {
    if (!productId || stockRefreshInProgress || document.visibilityState === 'hidden') return;
    stockRefreshInProgress = true;

    try {
      const response = await fetch(`/api/products/${encodeURIComponent(productId)}`, {
        cache: 'no-store',
        headers: { 'Accept': 'application/json' }
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'No se pudo actualizar el stock.');
      }

      let availableStock = Number(data.data?.availableStock);
      if (!Number.isInteger(availableStock) || availableStock < 0) {
        throw new Error('El servidor devolvió una disponibilidad inválida.');
      }

      if (window.IS_AUTHENTICATED === false && typeof window.getGuestCart === 'function') {
        const guestItem = window.getGuestCart().find(
          item => (item.id || item.productId || item._id) === productId
        );
        availableStock = Math.max(0, availableStock - (Number(guestItem?.quantity) || 0));
      }

      updateStockDisplay(availableStock);
    } catch (error) {
      console.error('No se pudo actualizar el stock del producto:', error);
    } finally {
      stockRefreshInProgress = false;
    }
  }

  // ==========================================
  // VALIDACIÓN EN TIEMPO REAL DEL STOCK
  // ==========================================
  if (quantityInput && stockIndicator && stockCount) {
    quantityInput.addEventListener('input', () => {
      let max = parseInt(quantityInput.max, 10);
      let val = parseInt(quantityInput.value, 10);

      if (isNaN(max) || max < 0) max = 0;
      if (isNaN(val) || val < 1) {
        quantityInput.value = 1;
        val = 1;
      }

      if (max > 0 && val > max) {
        quantityInput.value = max;
        val = max;
        notify(`Máximo ${max} disponibles`, 'warning');
      }

      if (max === 0) {
        updateStockDisplay(0);
      }
    });
  }

  refreshStock();
  window.setInterval(refreshStock, 30000);
  window.addEventListener('focus', refreshStock);
  window.addEventListener('pageshow', refreshStock);
  window.addEventListener('cart:updated', refreshStock);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshStock();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const productId = form.querySelector('input[name="productId"]').value;
    const quantity = quantityInput ? parseInt(quantityInput.value, 10) : 1;
    const submitBtn = form.querySelector('button[type="button"]');

    if (!productId || !quantity || quantity < 1) return;
    if (typeof window.addToCart !== 'function') {
      notify('El carrito todavía no está disponible. Inténtalo de nuevo.', 'error');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Añadiendo...';
    }

    try {
      const productData = {
        name: form.closest('.product-detail-info')?.querySelector('h1')?.textContent.trim() || 'Producto',
        price: parseFloat(document.querySelector('.product-detail-price')?.textContent.replace(/[^\d.,-]/g, '').replace(',', '.') || 0),
        image: document.querySelector('.product-detail-media img')?.src || ''
      };
      const added = await window.addToCart(productId, quantity, productData);

      if (added) {
        if (submitBtn) submitBtn.textContent = '✓ Añadido al carrito';

        setTimeout(() => {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Añadir al carrito';
          }
        }, 1500);

      }
    } catch (error) {
      console.error('Error al añadir al carrito:', error);
      notify('Error de conexión con el servidor.', 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Añadir al carrito';
      }
    }
  });
})();
