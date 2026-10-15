document.addEventListener('DOMContentLoaded', () => {
    const panel = document.querySelector('[data-membership-panel]');
    if (!panel) return;

    const status = document.getElementById('membership-status');
    const coupons = document.getElementById('membership-coupons');
    const cancelButton = document.getElementById('membership-cancel');
    const portalButton = document.getElementById('membership-portal');
    const subscribeForm = document.getElementById('membership-subscribe-form');
    const authenticated = panel.dataset.authenticated === 'true';
    const setStatus = (message, isError = false) => {
        if (!status) return;
        status.textContent = message;
        status.className = isError ? 'membership-status error' : 'membership-status';
    };

    const loadMembership = () => fetch('/api/membership')
            .then(async response => {
                const data = await response.json();
                if (!response.ok || !data.success) throw new Error(data.error || 'No se pudo cargar la membresía.');
                return data;
            })
            .then(data => {
                const membership = data.membership;
                if (!membership) {
                    setStatus('Aún no tienes una membresía.');
                    return;
                }
                if (membership.status === 'active') {
                    const endDate = membership.currentPeriodEnd
                        ? new Date(membership.currentPeriodEnd).toLocaleDateString('es-EC')
                        : 'sin fecha disponible';
                    setStatus(membership.cancelAtPeriodEnd
                        ? `Activa hasta el ${endDate}. La cancelación ya está programada.`
                        : `Activa hasta el ${endDate}.`);
                    if (cancelButton && !membership.cancelAtPeriodEnd) cancelButton.hidden = false;
                    if (portalButton && membership.provider === 'stripe') portalButton.hidden = false;
                    if (subscribeForm) subscribeForm.hidden = true;
                    if (coupons) {
                        [
                            ['Cupón de bienvenida', membership.welcomeCouponCode],
                            ['Cupón VIP mensual', membership.monthlyCouponCode]
                        ].forEach(([label, code]) => {
                            if (!code) return;
                            const item = document.createElement('p');
                            item.textContent = `${label}: ${code}`;
                            coupons.appendChild(item);
                        });
                    }
                } else if (membership.status === 'pending') {
                    setStatus(membership.provider === 'stripe'
                        ? 'Tu pago está pendiente de confirmación. Si ya completaste Checkout, espera unos segundos y vuelve a cargar esta página.'
                        : 'Tienes una activación de prueba pendiente. Puedes iniciar un nuevo proceso para reemplazarla.');
                } else if (membership.status === 'past_due') {
                    setStatus('No se pudo completar el último cobro. Actualiza tu método de pago para conservar la membresía.');
                    if (cancelButton && !membership.cancelAtPeriodEnd) cancelButton.hidden = false;
                    if (portalButton && membership.provider === 'stripe') portalButton.hidden = false;
                    if (subscribeForm) subscribeForm.hidden = true;
                } else {
                    setStatus('Tu membresía no está activa. Puedes volver a suscribirte cuando el pago esté disponible.');
                }
            })
            .catch(error => setStatus(error.message, true));

    if (authenticated && !document.getElementById('mock-payment-form')) {
        const params = new URLSearchParams(window.location.search);
        const checkoutSessionId = params.get('session_id');
        const confirmation = params.get('membership') === 'processing' && checkoutSessionId
            ? fetch(`/api/membership/confirm?session_id=${encodeURIComponent(checkoutSessionId)}`)
                .then(async response => {
                    const data = await response.json();
                    if (!response.ok || !data.success) throw new Error(data.error || 'No se pudo confirmar el pago.');
                })
            : Promise.resolve();
        confirmation.then(loadMembership).catch(error => setStatus(error.message, true));
    }

    if (subscribeForm) {
        subscribeForm.addEventListener('submit', async event => {
            event.preventDefault();
            const button = subscribeForm.querySelector('button[type="submit"]');
            button.disabled = true;
            setStatus(panel.dataset.paymentMode === 'stripe'
                ? 'Conectando con Stripe...'
                : 'Preparando la pantalla de pago de prueba...');
            try {
                const response = await fetch('/api/membership/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({
                        marketingOptIn: subscribeForm.elements.marketingOptIn.checked
                    })
                });
                const data = await response.json();
                if (!response.ok || !data.success) throw new Error(data.error || 'No se pudo iniciar la activación.');
                window.location.assign(data.checkoutUrl);
            } catch (error) {
                setStatus(error.message, true);
                button.disabled = false;
            }
        });
    }

    const cancel = async () => {
        cancelButton.disabled = true;
        try {
            const response = await fetch('/api/membership/cancel', {
                method: 'POST',
                headers: { 'Accept': 'application/json' }
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || 'No se pudo cancelar la membresía.');
            setStatus(data.message);
            cancelButton.hidden = true;
        } catch (error) {
            setStatus(error.message, true);
            cancelButton.disabled = false;
        }
    };
    if (cancelButton) cancelButton.addEventListener('click', cancel);

    if (portalButton) {
        portalButton.addEventListener('click', async () => {
            portalButton.disabled = true;
            try {
                const response = await fetch('/api/membership/portal', {
                    method: 'POST',
                    headers: { 'Accept': 'application/json' }
                });
                const data = await response.json();
                if (!response.ok || !data.success) throw new Error(data.error || 'No se pudo abrir el portal de pagos.');
                window.location.assign(data.url);
            } catch (error) {
                setStatus(error.message, true);
                portalButton.disabled = false;
            }
        });
    }

    const paymentForm = document.getElementById('mock-payment-form');
    if (paymentForm) {
        paymentForm.addEventListener('submit', async event => {
            event.preventDefault();
            const button = paymentForm.querySelector('button[type="submit"]');
            button.disabled = true;
            setStatus('Activando el período de prueba...');
            try {
                const response = await fetch('/api/membership/mock-confirm', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ token: paymentForm.elements.token.value })
                });
                const data = await response.json();
                if (!response.ok || !data.success) throw new Error(data.error || 'No se pudo activar la membresía.');
                window.location.assign('/profile?membership=active');
            } catch (error) {
                setStatus(error.message, true);
                button.disabled = false;
            }
        });
    }
});
