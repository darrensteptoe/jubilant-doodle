(function () {
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  function navTo(target) {
    if (!target) return;
    if (typeof window.navigateTo === 'function') {
      window.navigateTo(target);
      return;
    }
    if (target.charAt(0) === '#') {
      location.hash = target;
      return;
    }
    try {
      location.href = target;
    } catch (e) {}
  }

  function build(navRoot, config) {
    navRoot.innerHTML = '';

    config.sections.forEach(function (section) {
      var sec = el('div', 'navSection');

      var header = el('button', 'navSectionHeader', section.label);
      header.type = 'button';
      header.setAttribute('aria-expanded', 'false');

      var body = el('div', 'navSectionBody');
      body.hidden = true;

      header.addEventListener('click', function () {
        var open = header.getAttribute('aria-expanded') === 'true';
        header.setAttribute('aria-expanded', open ? 'false' : 'true');
        body.hidden = open;
      });

      section.items.forEach(function (item) {
        if (item.children && item.children.length) {
          var group = el('div', 'navGroup');
          var groupBtn = el('button', 'navItem navItemGroup', item.label);
          groupBtn.type = 'button';
          groupBtn.setAttribute('aria-expanded', 'false');

          var groupBody = el('div', 'navGroupBody');
          groupBody.hidden = true;

          groupBtn.addEventListener('click', function () {
            var open = groupBtn.getAttribute('aria-expanded') === 'true';
            groupBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
            groupBody.hidden = open;
          });

          item.children.forEach(function (child) {
            var childBtn = el('button', 'navItem navItemChild', child.label);
            childBtn.type = 'button';
            childBtn.addEventListener('click', function () {
              navTo(child.target);
            });
            groupBody.appendChild(childBtn);
          });

          group.appendChild(groupBtn);
          group.appendChild(groupBody);
          body.appendChild(group);
        } else {
          var btn = el('button', 'navItem', item.label);
          btn.type = 'button';
          btn.addEventListener('click', function () {
            navTo(item.target);
          });
          body.appendChild(btn);
        }
      });

      sec.appendChild(header);
      sec.appendChild(body);
      navRoot.appendChild(sec);
    });
  }

  function init() {
    var navBody = document.getElementById('leftNavBody');
    if (!navBody) return;

    var configEl = document.getElementById('leftNavConfig');
    if (configEl && configEl.type === 'application/json') {
      try {
        build(navBody, JSON.parse(configEl.textContent || '{}'));
        return;
      } catch (e) {}
    }

    fetch('navConfig.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (cfg) { build(navBody, cfg); })
      .catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
