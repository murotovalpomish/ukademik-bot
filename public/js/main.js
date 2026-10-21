// ============ Ishga tushirish ============
'use strict';
(function boot() {
  if (TG) {
    try {
      TG.ready();
      TG.expand();
      if (TG.BackButton) TG.BackButton.onClick(() => back());
      TG.onEvent && TG.onEvent('themeChanged', applyTheme);
    } catch (e) { }
  }
  applyTheme();
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  ['pointerdown', 'touchend', 'click'].forEach((ev) => document.addEventListener(ev, () => audio(), { once: true, capture: true }));
  go('gate', {}, { root: true });
})();
