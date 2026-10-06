/**
 * Notificación flotante (Toast) accesible globalmente
 */
function showToast(message, type = 'info', duration = 3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconClass = 'ri-information-line';
    if (type === 'success') iconClass = 'ri-checkbox-circle-line';
    if (type === 'error') iconClass = 'ri-error-warning-line';
    if (type === 'warning') iconClass = 'ri-alert-line';

    const icon = document.createElement('i');
    icon.className = iconClass;

    const span = document.createElement('span');
    span.textContent = message;

    toast.appendChild(icon);
    toast.appendChild(span);
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);

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