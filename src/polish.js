(function bootDiplomakerPolish() {
  'use strict';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootDiplomakerPolish, { once: true });
    return;
  }
  if (window.Diplomaker?.Polish) return;

  const topbar = document.querySelector('.topbar');
  if (topbar && !topbar.querySelector('.mobile-topbar-brand')) {
    const context = [...topbar.children].find(child => child.classList?.contains('topbar-actions') === false);
    if (context) context.classList.add('topbar-context');
    const brand = document.createElement('div');
    brand.className = 'mobile-topbar-brand';
    brand.innerHTML = `
      <img src="assets/brand/diplomaker-symbol.svg" alt="">
      <div><strong>Diplomaker</strong><small>Estudio local</small></div>
    `;
    topbar.insertBefore(brand, topbar.firstChild);
  }

  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon) {
    favicon.href = 'assets/brand/favicon.svg';
    favicon.type = 'image/svg+xml';
  }

  function openHashTarget() {
    const hash = location.hash.toLowerCase();
    if (!hash) return;
    if (hash === '#crear') {
      document.querySelector('#mainNav [data-view="create"]')?.click();
    } else if (hash === '#disenar' || hash === '#diseñar') {
      const direct = document.querySelector('#mainNav [data-view="studio"]');
      if (direct) direct.click();
      else document.querySelector('[data-studio-open]')?.click();
    } else if (hash === '#proyectos') {
      window.Diplomaker?.Experience?.openProjectLibrary?.();
    }
  }

  window.addEventListener('hashchange', openHashTarget);
  setTimeout(openHashTarget, 450);

  window.Diplomaker = window.Diplomaker || {};
  window.Diplomaker.Polish = { openHashTarget };
})();
