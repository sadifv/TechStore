document.addEventListener('DOMContentLoaded', () => {
    const navbarToggle = document.querySelector('.navbar-toggle');
    const navbarMenu = document.querySelector('#navbar-menu');

    if (!navbarToggle || !navbarMenu) return;

    // Alternar menú móvil
    function toggleMenu() {
        const isExpanded = navbarToggle.getAttribute('aria-expanded') === 'true';
        navbarToggle.setAttribute('aria-expanded', (!isExpanded).toString());
        navbarMenu.classList.toggle('active');

        // Cambiar ícono entre hamburguesa y cerrar
        const icon = navbarToggle.querySelector('i');
        if (icon) {
            if (navbarMenu.classList.contains('active')) {
                icon.className = 'ri-close-line';
            } else {
                icon.className = 'ri-menu-line';
            }
        }
    }

    // Cerrar menú al hacer clic en cualquier enlace
    function closeMenu() {
        navbarToggle.setAttribute('aria-expanded', 'false');
        navbarMenu.classList.remove('active');
        const icon = navbarToggle.querySelector('i');
        if (icon) {
            icon.className = 'ri-menu-line';
        }
    }

    navbarToggle.addEventListener('click', toggleMenu);

    // Escuchar clics en los enlaces del menú
    const menuLinks = navbarMenu.querySelectorAll('a');
    menuLinks.forEach(link => {
        link.addEventListener('click', closeMenu);
    });

    // Cerrar menú al hacer clic fuera de la navbar
    document.addEventListener('click', (e) => {
        if (!navbarMenu.contains(e.target) && !navbarToggle.contains(e.target)) {
            closeMenu();
        }
    });
});