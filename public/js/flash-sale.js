// public/js/flash-sale.js
(() => {
  function initializeCountdowns() {
    document.querySelectorAll('.flash-sale-timer').forEach((timer) => {
      if (timer.dataset.countdownInitialized === 'true') return;
      timer.dataset.countdownInitialized = 'true';

      const endsAt = Date.parse(timer.dataset.endsAt || '');
      const cta = document.querySelector('.flash-sale-cta');
      const daysEl = timer.querySelector('[data-days]');
      const hoursEl = timer.querySelector('[data-hours]');
      const minutesEl = timer.querySelector('[data-minutes]');
      const secondsEl = timer.querySelector('[data-seconds]');
      const pad = (num) => String(num).padStart(2, '0');
      let intervalId;

      if (!Number.isFinite(endsAt)) {
        timer.classList.add('is-invalid');
        [daysEl, hoursEl, minutesEl, secondsEl].forEach((element) => {
          if (element) element.textContent = '--';
        });
        console.error('La oferta relámpago no tiene una fecha de vencimiento válida.');
        return;
      }

      function updateCountdown() {
        const diff = endsAt - Date.now();
        if (diff <= 0) {
          [daysEl, hoursEl, minutesEl, secondsEl].forEach((element) => {
            if (element) element.textContent = '00';
          });

          timer.classList.add('is-expired');
          if (cta) {
            cta.setAttribute('aria-disabled', 'true');
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

      updateCountdown();
      if (!timer.classList.contains('is-expired')) {
        intervalId = setInterval(updateCountdown, 1000);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCountdowns, { once: true });
  } else {
    initializeCountdowns();
  }
})();