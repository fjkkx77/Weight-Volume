/*
 * 换算合集 —— 页面之间的跳转：标题切换菜单。读 pages.js 的 WV_PAGES（目录页的格子由 tools/build-pages.cjs 直接写进 HTML）。
 */
(function (root) {
  'use strict';
  var PAGES = root.WV_PAGES;
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  // 标题按钮 #btnSwitch → 在同一个 .head 里挂一张菜单：第一项回目录，下面是全部换算，当前页描蓝边
  function mountSwitcher(currentId) {
    var btn = document.getElementById('btnSwitch');
    if (!btn) return { isOpen: function () { return false; } };
    var head = btn.closest('.head');
    var menu = document.createElement('nav');
    menu.className = 'switch-menu'; menu.id = 'switchMenu'; menu.hidden = true;
    menu.setAttribute('aria-label', '切换换算');
    menu.innerHTML = '<a class="home" href="./">‹ 全部换算</a>' + PAGES.map(function (p) {
      return '<a href="' + p.file + '"' + (p.id === currentId ? ' aria-current="page"' : '') + '><b>' + esc(p.name) +
        '</b><small>' + esc(p.sample) + '</small></a>';
    }).join('');
    head.appendChild(menu);
    btn.setAttribute('aria-controls', 'switchMenu');

    function set(open) {
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    }
    btn.addEventListener('click', function () {
      // 正在输入时先收起键盘，菜单才不会被键盘挡住
      var a = document.activeElement;
      if (a && a.tagName === 'INPUT') a.blur();
      set(menu.hidden);
    });
    // 点菜单外面任何地方都收起（照 iOS 弹出菜单）；点当前页那一项也只是收起
    document.addEventListener('click', function (e) {
      if (menu.hidden || btn.contains(e.target)) return;
      var link = e.target.closest && e.target.closest('.switch-menu a');
      if (link && link.getAttribute('aria-current') === 'page') { e.preventDefault(); set(false); return; }
      if (!menu.contains(e.target)) set(false);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { set(false); btn.focus(); } });
    // 从别的页按「返回」回来时，浏览器可能直接恢复上次的画面（bfcache）：别让菜单还开着
    window.addEventListener('pageshow', function () { set(false); });
    return { isOpen: function () { return !menu.hidden; } };
  }

  root.WVNav = { mountSwitcher: mountSwitcher };
})(this);
