// El script se carga con defer, así que el DOM ya está listo
(function() {
  const form = document.querySelector('#add-to-cart-form');
  if (!form) return;

  const quantityInput = document.getElementById('quantity');
  const stockIndicator = document.getElementById('stock-indicator');
  const stockCount = document.getElementById('stock-count');
  const addToCartBtn = form.querySelector('button[type="button"]');

  // Helper para notificaciones flotantes elegantes
  function notify(message, type = 'info') {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type);
    }
  }

  // ==========================================
  // VALIDACIÓN EN TIEMPO REAL DEL STOCK
  // ==========================================
  if (quantityInput && stockIndicator && stockCount) {
    quantityInput.addEventListener('input', () => {
      const max = parseInt(quantityInput.max, 10);
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

      // Actualizar indicador visual con stock restante
      const remaining = max - val;

      if (max === 0 || remaining <= 0) {
        stockIndicator.className = 'stock-out';
        stockIndicator.innerHTML = '<i class="ri-close-circle-line"></i> Agotado temporalmente';
        if (addToCartBtn) {
          addToCartBtn.disabled = true;
          addToCartBtn.textContent = 'Producto agotado';
        }
      } else {
        stockIndicator.className = 'stock-in';
        stockCount.textContent = remaining;
        if (addToCartBtn) {
          addToCartBtn.disabled = false;
          addToCartBtn.textContent = 'Añadir al carrito';
        }
      }
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const productId = form.querySelector('input[name="productId"]').value;
    const quantity = quantityInput ? parseInt(quantityInput.value, 10) : 1;
    const submitBtn = form.querySelector('button[type="button"]');

    if (!productId || !quantity || quantity < 1) return;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Añadiendo...';
    }

    try {
      const response = await fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (submitBtn) submitBtn.textContent = '✓ Añadido al carrito';
        notify('Producto añadido al carrito con éxito', 'success');

        setTimeout(() => {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Añadir al carrito';
          }
        }, 1500);

        if (typeof window.updateCartBadge === 'function') {
          window.updateCartBadge();
        }
      } else {
        notify(data.error || 'Error al añadir al carrito.', 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Añadir al carrito';
        }
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
});
