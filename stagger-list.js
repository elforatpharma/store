/* Elforat Pharma — staggered animation for product grids and explicit lists. */
(function () {
  'use strict';
  if (window.__efpStaggerListsInstalled) return;
  window.__efpStaggerListsInstalled = true;

  var containerSelector = '#catalog-grid, #bundles-grid, #related-products-grid, #favorites-grid, .efp-stagger-list';
  var itemSelector = '.pro-product-card, .product-card';

  function animateItems(container) {
    if (!container || !container.querySelectorAll) return;
    var items;
    if (container.matches && container.matches('.efp-stagger-list')) {
      items = Array.from(container.children);
    } else {
      items = Array.from(container.querySelectorAll(itemSelector));
      // Include direct children for grid containers whose card markup uses a different class.
      if (!items.length && container.matches && container.matches('#catalog-grid, #bundles-grid, #related-products-grid, #favorites-grid')) {
        items = Array.from(container.children).filter(function (el) {
          return el.nodeType === 1 && !el.matches('.hidden, [hidden], .skeleton-img');
        });
      }
    }
    items.forEach(function (item, index) {
      if (!item || item.nodeType !== 1 || item.classList.contains('efp-stagger-item')) return;
      item.style.setProperty('--efp-stagger-delay', (index < 8 ? index * 80 : 0) + 'ms');
      item.classList.add('efp-stagger-item');
    });
  }

  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.matches && root.matches(containerSelector)) animateItems(root);
    if (root.querySelectorAll) root.querySelectorAll(containerSelector).forEach(animateItems);
    // Product cards can be inserted into a grid after the container itself already exists.
    if (root.matches && root.matches(itemSelector)) {
      var parent = root.closest(containerSelector);
      if (parent) animateItems(parent);
    }
  }

  function start() {
    document.querySelectorAll(containerSelector).forEach(animateItems);
    var observer = new MutationObserver(function (records) {
      records.forEach(function (record) {
        if (record.type === 'childList') {
          record.addedNodes.forEach(function (node) {
            if (node.nodeType === 1) scan(node);
          });
          if (record.target.nodeType === 1) {
            var parent = record.target.closest && record.target.closest(containerSelector);
            if (parent) animateItems(parent);
          }
        }
      });
    });
    observer.observe(document.documentElement, { subtree: true, childList: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();