// public/js/product-detail.js
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#add-to-cart-form');
  if (!form) return;

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
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity })
      });

      const data = await response.json();

      if (data.success) {
        submitBtn.textContent = '✓ Añadido al carrito';
        setTimeout(() => {
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
        }, 1500);

        // Actualizar el badge del carrito si la función existe
        if (typeof window.updateCartBadge === 'function') {
          window.updateCartBadge();
        }
      } else {
        alert(data.error || 'Error al añadir al carrito.');
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    } catch (error) {
      console.error('Error al añadir al carrito:', error);
      alert('Error de conexión con el servidor.');
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
});