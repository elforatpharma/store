/* Elforat Pharma — shared shimmer loading layer. Safe, dependency-free and page-scoped. */
(function () {
  'use strict';
  if (window.__efpShimmerLoaderInstalled) return;
  window.__efpShimmerLoaderInstalled = true;

  // Each repository uses its own explicit mode so page titles/pathnames cannot
  // accidentally classify an admin page as storefront (or vice versa).
  var isAdmin = false;
  var MIN_VISIBLE_MS = 420;
  var MAX_INITIAL_MS = isAdmin ? 1200 : 950;
  var startedAt = Date.now();
  var overlay = null;
  var hideTimer = null;
  var safetyTimer = null;

  function block(className, extraClass) {
    var el = document.createElement('div');
    el.className = 'efp-shimmer-block ' + className + (extraClass ? ' ' + extraClass : '');
    return el;
  }
  function add(parent, className, extraClass) {
    var el = document.createElement('div');
    el.className = className + (extraClass ? ' ' + extraClass : '');
    parent.appendChild(el);
    return el;
  }
  function makeOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'efp-shimmer-overlay ' + (isAdmin ? 'efp-admin-loading' : 'efp-store-loading');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('role', 'presentation');
    overlay.hidden = true;

    var top = add(overlay, 'efp-shimmer-top');
    top.appendChild(block('efp-shimmer-brand'));
    top.appendChild(block('efp-shimmer-pill'));

    var layout = add(overlay, 'efp-shimmer-layout');
    if (isAdmin) {
      var side = add(layout, 'efp-shimmer-sidebar');
      for (var s = 0; s < 6; s++) side.appendChild(block('efp-shimmer-side-link'));
    }
    var main = add(layout, 'efp-shimmer-main');
    if (!isAdmin) main.appendChild(block('efp-shimmer-hero'));
    main.appendChild(block('efp-shimmer-heading'));
    main.appendChild(block('efp-shimmer-subheading'));

    var stats = add(main, 'efp-shimmer-stats');
    for (var i = 0; i < 4; i++) {
      var stat = add(stats, 'efp-shimmer-stat');
      stat.appendChild(block('efp-shimmer-line'));
      stat.appendChild(block('efp-shimmer-value'));
    }

    var panel = add(main, 'efp-shimmer-panel');
    panel.appendChild(block('efp-shimmer-panel-head'));
    if (isAdmin) {
      for (var r = 0; r < 4; r++) panel.appendChild(block('efp-shimmer-table-row'));
    } else {
      var products = add(main, 'efp-shimmer-products');
      for (var p = 0; p < 4; p++) {
        var product = add(products, 'efp-shimmer-product');
        product.appendChild(block('efp-shimmer-product-image'));
        product.appendChild(block('efp-shimmer-product-line'));
        product.appendChild(block('efp-shimmer-product-line', 'short'));
      }
    }
    return overlay;
  }

  function show(duration) {
    clearTimeout(hideTimer);
    clearTimeout(safetyTimer);
    var el = makeOverlay();
    el.classList.remove('efp-shimmer-leaving');
    el.hidden = false;
    // Attach to <html> so the overlay can appear as early as possible, even
    // when this script is loaded from <head> before <body> exists.
    if (!el.isConnected) (document.body || document.documentElement).appendChild(el);
    startedAt = Date.now();
    hideTimer = setTimeout(hide, typeof duration === 'number' ? duration : MAX_INITIAL_MS);
    safetyTimer = setTimeout(hide, MAX_INITIAL_MS + 1800);
  }

  function hide() {
    if (!overlay || overlay.hidden) return;
    var remaining = MIN_VISIBLE_MS - (Date.now() - startedAt);
    if (remaining > 0) {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hide, remaining);
      return;
    }
    overlay.classList.add('efp-shimmer-leaving');
    clearTimeout(hideTimer);
    clearTimeout(safetyTimer);
    hideTimer = setTimeout(function () {
      if (overlay) overlay.hidden = true;
    }, 240);
  }

  function init() {
    show();
    if (document.readyState !== 'complete') {
      window.addEventListener('load', hide, { once: true });
    } else {
      hide();
    }

    // Store navigation is hash-based; show a brief transition for route changes.
    if (!isAdmin) {
      function routeChanged() {
        show(650);
      }
      window.addEventListener('hashchange', routeChanged);
      window.addEventListener('popstate', routeChanged);
    }
  }

  // Start before DOMContentLoaded where possible to avoid a blank initial flash.
  if (document.readyState === 'loading') {
    show();
    document.addEventListener('DOMContentLoaded', function () {
      if (document.readyState === 'complete') hide();
    }, { once: true });
    window.addEventListener('load', hide, { once: true });
    if (!isAdmin) {
      window.addEventListener('hashchange', function () { show(650); });
      window.addEventListener('popstate', function () { show(650); });
    }
  } else {
    init();
  }
})();