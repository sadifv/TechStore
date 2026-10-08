/**
 * Notificación flotante (Toast) accesible globalmente
 * @param {string} message - Mensaje a mostrar
 * @param {'success'|'error'|'warning'|'info'} type - Tipo de toast
 * @param {number} duration - Duración en ms (default: 3500)
 */
function showToast(message, type = 'info', duration = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('section');
        container.id = 'toast-container';
        container.className = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'true');
        document.body.appendChild(container);
    }

    // Elemento semántico <output> para resultados de acciones
    const toast = document.createElement('output');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'status');

    // Icono según el tipo
    const icon = document.createElement('i');
    icon.setAttribute('aria-hidden', 'true');

    let iconClass = 'ri-information-line';
    if (type === 'success') iconClass = 'ri-checkbox-circle-line';
    else if (type === 'error') iconClass = 'ri-error-warning-line';
    else if (type === 'warning') iconClass = 'ri-alert-line';

    icon.className = iconClass;

    // Texto del mensaje
    const span = document.createElement('span');
    span.textContent = message;

    toast.appendChild(icon);
    toast.appendChild(span);
    container.appendChild(toast);

    // Trigger de animación de entrada
    requestAnimationFrame(() => toast.classList.add('show'));

    // Auto-eliminar tras la duración
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, duration);
}

window.showToast = showToast;

/**
 * Modal de confirmación personalizado (reemplaza a confirm())
 * @param {string} message - Mensaje de confirmación
 * @param {string} confirmText - Texto del botón confirmar
 * @param {string} cancelText - Texto del botón cancelar
 * @returns {Promise<boolean>} - true si confirma, false si cancela
 */
function showConfirm(message, confirmText = 'Confirmar', cancelText = 'Cancelar') {
    return new Promise((resolve) => {
        // <dialog> nativo para accesibilidad
        const dialog = document.createElement('dialog');
        dialog.className = 'modal-dialog confirm-dialog';

        // <article> como contenedor semántico
        const article = document.createElement('article');
        article.className = 'modal-card';

        // Header
        const header = document.createElement('header');
        header.className = 'modal-header';

        const title = document.createElement('h3');
        title.textContent = 'Confirmar acción';

        header.appendChild(title);

        // Cuerpo del mensaje
        const body = document.createElement('p');
        body.className = 'modal-confirm-message';
        body.textContent = message;

        // Footer con botones
        const footer = document.createElement('footer');
        footer.className = 'modal-actions';

        const btnCancel = document.createElement('button');
        btnCancel.type = 'button';
        btnCancel.className = 'btn btn-secondary';
        btnCancel.textContent = cancelText;

        const btnConfirm = document.createElement('button');
        btnConfirm.type = 'button';
        btnConfirm.className = 'btn btn-primary';
        btnConfirm.textContent = confirmText;

        footer.appendChild(btnCancel);
        footer.appendChild(btnConfirm);

        article.appendChild(header);
        article.appendChild(body);
        article.appendChild(footer);
        dialog.appendChild(article);

        document.body.appendChild(dialog);
        dialog.showModal();

        // Cierre: resolver promesa y limpiar
        const close = (result) => {
            dialog.close();
            if (dialog.parentNode) dialog.parentNode.removeChild(dialog);
            resolve(result);
        };

        btnCancel.addEventListener('click', () => close(false));
        btnConfirm.addEventListener('click', () => close(true));

        // ESC → tratar como cancelar
        dialog.addEventListener('cancel', (e) => {
            e.preventDefault();
            close(false);
        });

        // Click en el backdrop → tratar como cancelar
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                close(false);
            }
        });
    });
}

window.showConfirm = showConfirm;

/**
 * Delegación de eventos global para añadir productos al carrito
 */
document.addEventListener('DOMContentLoaded', () => {
    document.body.addEventListener('click', (e) => {
        const addBtn = e.target.closest('.add-to-cart-btn, .btn-add-cart');
        
        if (addBtn) {
            const productId = addBtn.dataset.id;
            
            if (productId && typeof addToCart === 'function') {
                addToCart(productId);
            }
        }
    });
});