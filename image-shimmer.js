/* Elforat Pharma — shimmer placeholders for every store image, including dynamically rendered images. */
(function () {
  'use strict';
  if (window.__efpImageShimmerInstalled) return;
  window.__efpImageShimmerInstalled = true;

  var LOADING = 'efp-image-shimmer';
  var LOADED = 'efp-image-shimmer-loaded';
  var FAILED = 'efp-image-shimmer-error';

  function clearState(img) {
    img.classList.remove(LOADED, FAILED);
    img.classList.add(LOADING);
  }

  function settle(img) {
    if (!img || img.tagName !== 'IMG') return;
    if (img.naturalWidth > 0) {
      img.classList.remove(LOADING, FAILED);
      img.classList.add(LOADED);
    } else if (img.complete && (img.currentSrc || img.getAttribute('src') || img.getAttribute('srcset'))) {
      img.classList.remove(LOADING, LOADED);
      img.classList.add(FAILED);
    }
  }

  function prepare(img) {
    if (!img || img.tagName !== 'IMG') return;
    if (!img.classList.contains(LOADING) && !img.classList.contains(LOADED) && !img.classList.contains(FAILED)) {
      clearState(img);
    }
    if (img.complete) settle(img);
  }

  document.querySelectorAll('img').forEach(prepare);

  document.addEventListener('load', function (event) {
    if (event.target && event.target.tagName === 'IMG') settle(event.target);
  }, true);

  document.addEventListener('error', function (event) {
    var img = event.target;
    if (!img || img.tagName !== 'IMG') return;
    img.classList.remove(LOADING, LOADED);
    img.classList.add(FAILED);
  }, true);

  var observer = new MutationObserver(function (records) {
    records.forEach(function (record) {
      if (record.type === 'attributes' && record.target.tagName === 'IMG') {
        clearState(record.target);
        prepare(record.target);
        return;
      }
      record.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        if (node.tagName === 'IMG') prepare(node);
        if (node.querySelectorAll) node.querySelectorAll('img').forEach(prepare);
      });
    });
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['src', 'srcset']
  });
})();
