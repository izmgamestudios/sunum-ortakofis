// public/theme-init.js — applied before React mounts to avoid a theme flash (external file: CSP forbids inline scripts)
(function () {
  try {
    var m = localStorage.getItem('teknodoz-sunum:theme');
    if (m === 'light' || m === 'dark') document.documentElement.setAttribute('data-theme', m);
  } catch (e) {
    /* storage blocked → follow system */
  }
})();
