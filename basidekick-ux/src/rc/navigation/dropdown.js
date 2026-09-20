(function () {
  'use strict';
  window.baskNavigationDropdown = function (id, prompt, items, enabled) {
    var select = document.getElementById(id);
    if (!select) return;
    var signature = JSON.stringify([prompt, items, enabled]);
    if (select.dataset.menuSignature === signature) return;
    select.dataset.menuSignature = signature;
    select.textContent = '';
    select.add(new Option(prompt, ''));
    items.forEach(function (item) { select.add(new Option(item[0], item[1])); });
    select.disabled = !enabled;
    select.setAttribute('aria-label', prompt);
    select.onchange = function () {
      var href = select.value;
      select.selectedIndex = 0;
      if (!href) return;
      var env = window.niagara && window.niagara.env;
      if (env && typeof env.hyperlink === 'function') env.hyperlink(href);
      else window.location.assign(href);
    };
  };
}());
