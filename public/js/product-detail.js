document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#add-to-cart-form');
  if (!form) return;

  // Helper para notificaciones flotantes elegantes
  function notify(message, type = 'info') {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type);
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const productId = form.querySelector('input[name="productId"]').value;
    const quantityInput = form.querySelector('input[name="quantity"]');
    const quantity = parseInt(quantityInput.value, 10);
    const submitBtn = form.querySelector('button[type="submit"]');

    if (!productId || !quantity || quantity < 1) return;

    submitBtn.disabled = true;
    const originalText = submitBtn.textContent.trim();
    submitBtn.textContent = 'Añadiendo...';

    try {
      const response = await fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        submitBtn.textContent = '✓ Añadido al carrito';
        notify('Producto añadido al carrito con éxito', 'success');

        setTimeout(() => {
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
        }, 1500);

        if (typeof window.updateCartBadge === 'function') {
          window.updateCartBadge();
        }
      } else {
        notify(data.error || 'Error al añadir al carrito.', 'error');
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    } catch (error) {
      logger.error('Error al añadir al carrito:', error);
      notify('Error de conexión con el servidor.', 'error');
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
});