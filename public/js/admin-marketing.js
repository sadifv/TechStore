document.addEventListener('DOMContentLoaded', () => {
    const showResult = (element, message, error = false) => {
        element.textContent = message;
        element.className = error ? 'form-status error' : 'form-status success';
    };

    const couponForm = document.getElementById('admin-coupon-form');
    const couponStatus = document.getElementById('coupon-status');
    if (couponForm && couponStatus) {
        couponForm.addEventListener('submit', async event => {
            event.preventDefault();
            const button = couponForm.querySelector('button[type="submit"]');
            button.disabled = true;
            try {
                const payload = Object.fromEntries(new FormData(couponForm).entries());
                const response = await fetch('/admin/coupons', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await response.json();
                if (!response.ok || !data.success) throw new Error(data.error || 'No se pudo crear el cupón.');
                showResult(couponStatus, `Cupón ${data.coupon.code} guardado.`);
                window.location.reload();
            } catch (error) {
                showResult(couponStatus, error.message, true);
                button.disabled = false;
            }
        });
    }

    const campaignForm = document.getElementById('admin-campaign-form');
    const campaignStatus = document.getElementById('campaign-status');
    if (campaignForm && campaignStatus) {
        campaignForm.addEventListener('submit', async event => {
            event.preventDefault();
            const confirmed = await window.showConfirm(
                'La campaña se procesará ahora para el público seleccionado. ¿Quieres continuar?',
                'Procesar campaña',
                'Volver'
            );
            if (!confirmed) return;
            const button = campaignForm.querySelector('button[type="submit"]');
            button.disabled = true;
            button.textContent = 'Procesando campaña...';
            try {
                const payload = Object.fromEntries(new FormData(campaignForm).entries());
                const response = await fetch('/admin/campaigns', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await response.json();
                if (!response.ok || !data.success) throw new Error(data.error || 'No se pudo procesar la campaña.');
                showResult(campaignStatus, data.message);
                window.location.reload();
            } catch (error) {
                showResult(campaignStatus, error.message, true);
                button.disabled = false;
                button.textContent = 'Enviar campaña';
            }
        });
    }

    document.querySelectorAll('.btn-toggle-coupon').forEach(button => {
        button.addEventListener('click', async () => {
            const row = button.closest('[data-coupon-id]');
            if (!row) return;
            button.disabled = true;
            try {
                const response = await fetch(`/admin/coupons/${row.dataset.couponId}/status`, {
                    method: 'PATCH',
                    headers: { 'Accept': 'application/json' }
                });
                const data = await response.json();
                if (!response.ok || !data.success) throw new Error(data.error || 'No se pudo actualizar el cupón.');
                row.querySelector('.coupon-state').textContent = data.coupon.active ? 'Activo' : 'Pausado';
                button.textContent = data.coupon.active ? 'Pausar' : 'Activar';
            } catch (error) {
                window.showToast?.(error.message, 'error');
            } finally {
                button.disabled = false;
            }
        });
    });
});
