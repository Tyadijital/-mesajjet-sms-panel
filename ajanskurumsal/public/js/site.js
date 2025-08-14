(function () {
  const root = document.documentElement;
  let raf = null;
  function updatePointer(e) {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      root.style.setProperty('--x', x + '%');
      root.style.setProperty('--y', y + '%');
    });
  }
  window.addEventListener('pointermove', updatePointer, { passive: true });
})();