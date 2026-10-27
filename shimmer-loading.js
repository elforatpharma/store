/* Shared shimmer loader for all Elforat Pharma pages. No dependencies. */
(function () {
  'use strict';
  if (window.__efpShimmerLoaderInstalled) return;
  window.__efpShimmerLoaderInstalled = true;
  var startedAt = Date.now();
  var MIN_VISIBLE_MS = 420;
  var overlay = null;
  var hideTimer = null;
  var isAdmin = /\/admin(?:\/|$)/i.test(location.pathname) ||
    /لوحة التحكم|إدارة الطلبات|إدارة المخزون|تسجيل الدخول/.test(document.title || '') ||
    !!document.querySelector('#loginForm, #login-form, .efp-uiverse-ui');

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
  function show() {
    if (!document.body) return;
    clearTimeout(hideTimer);
    var el = makeOverlay();
    el.classList.remove('efp-shimmer-leaving');
    el.hidden = false;
    if (!el.isConnected) document.body.appendChild(el);
    startedAt = Date.now();
    hideTimer = setTimeout(hide, isAdmin ? 900 : 700);
  }
  function hide() {
    if (!overlay) return;
    var remaining = MIN_VISIBLE_MS - (Date.now() - startedAt);
    if (remaining > 0) {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hide, remaining);
      return;
    }
    overlay.classList.add('efp-shimmer-leaving');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      if (overlay) overlay.hidden = true;
    }, 240);
  }

  function init() {
    show();
    window.addEventListener('load', hide, { once: true });
    // The storefront uses hash-based navigation; show the same loader during route changes.
    if (!isAdmin) {
      window.addEventListener('hashchange', function () {
        show();
        hideTimer = setTimeout(hide, 320);
      });
      window.addEventListener('popstate', function () {
        show();
        hideTimer = setTimeout(hide, 320);
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();