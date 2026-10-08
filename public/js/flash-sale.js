// public/js/flash-sale.js
document.addEventListener('DOMContentLoaded', () => {
  const timer = document.querySelector('.flash-sale-timer');
  if (!timer) return; // No hay flash sale activa

  const endsAtISO = timer.dataset.endsAt;
  if (!endsAtISO) return;

  const endsAt = new Date(endsAtISO).getTime();
  const cta = document.querySelector('.flash-sale-cta');

  const daysEl = timer.querySelector('[data-days]');
  const hoursEl = timer.querySelector('[data-hours]');
  const minutesEl = timer.querySelector('[data-minutes]');
  const secondsEl = timer.querySelector('[data-seconds]');

  const pad = (num) => String(num).padStart(2, '0');

  let intervalId; // Declarado antes para poder limpiarlo

  function updateCountdown() {
    const now = Date.now();
    const diff = endsAt - now;

    if (diff <= 0) {
      // Oferta terminada
      if (daysEl) daysEl.textContent = '00';
      if (hoursEl) hoursEl.textContent = '00';
      if (minutesEl) minutesEl.textContent = '00';
      if (secondsEl) secondsEl.textContent = '00';

      timer.classList.add('is-expired');

      if (cta) {
        cta.setAttribute('disabled', 'disabled');
        cta.classList.add('is-expired');
        cta.textContent = '⏹ Oferta terminada';
        cta.removeAttribute('href');
      }

      clearInterval(intervalId);
      return;
    }

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (daysEl) daysEl.textContent = pad(days);
    if (hoursEl) hoursEl.textContent = pad(hours);
    if (minutesEl) minutesEl.textContent = pad(minutes);
    if (secondsEl) secondsEl.textContent = pad(seconds);
  }

  // Ejecutar inmediatamente y luego cada segundo
  updateCountdown();
  intervalId = setInterval(updateCountdown, 1000);
});