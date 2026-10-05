/* ELFORAT STORE — lightweight image loading optimization */
(function () {
  'use strict';

  function optimizeImages() {
    const images = document.querySelectorAll('img');
    images.forEach(function (img) {
      if (!img.hasAttribute('decoding')) img.decoding = 'async';

      const rect = img.getBoundingClientRect();
      const nearViewport = rect.top < window.innerHeight * 1.35 && rect.bottom > -window.innerHeight * 0.35;

      // Keep the first-screen images eager; defer images that are clearly below it.
      if (!nearViewport && !img.hasAttribute('loading')) {
        img.loading = 'lazy';
        if (!img.hasAttribute('fetchpriority')) img.fetchPriority = 'low';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', optimizeImages, { once: true });
  } else {
    optimizeImages();
  }

  // Product cards are rendered dynamically after the initial page load.
  const observer = new MutationObserver(function () {
    optimizeImages();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
