/*
 * 换算合集 —— 页面之间的跳转：标题切换菜单。读 pages.js 的 WV_PAGES（目录页的格子由 tools/build-pages.cjs 直接写进 HTML）。
 */
(function (root) {
  'use strict';
  var PAGES = root.WV_PAGES;
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  // ---------- 历史记录：换算页之间切换不叠层，回目录一步到位（2026-10-09 用户：开了几层还得一层层返回） ----------
  //   约定：从目录点进来的页，历史里它下面一条就是目录，记在 history.state.wvHubBelow 上。
  //   菜单里切到别的换算用 location.replace（顶替当前这条，不新增），所以不管切多少次，左滑一次就回目录；
  //   「标记」跨 replace 要靠 sessionStorage 捎过去（新页面的 history.state 是空的、referrer 是上一个换算页）。
  var HUB = new URL('./', location.href).href;
  var CARRY = 'wv.hubBelow';
  function isHub(u) {
    if (!u) return false;
    try { var x = new URL(u); x.hash = ''; x.search = ''; return x.href === HUB || x.href === HUB + 'index.html'; } catch (e) { return false; }
  }
  function hubBelow() { try { return !!(history.state && history.state.wvHubBelow); } catch (e) { return false; } }
  (function mark() {
    // 从目录按住 Ctrl 点开的新标签页 referrer 也是目录，但那个标签页里没有上一条，所以要 history.length > 1
    var below = hubBelow() || (isHub(document.referrer) && history.length > 1);
    try {
      var t = Number(sessionStorage.getItem(CARRY));
      sessionStorage.removeItem(CARRY);
      if (t && Date.now() - t < 10000) below = true;   // 只认刚刚捎来的，防止一次没跳成功留下的旧标记误认
    } catch (e) {}
    if (below && !hubBelow()) {
      try { history.replaceState(Object.assign({}, history.state, { wvHubBelow: true }), ''); } catch (e) {}
    }
  })();
  function switchTo(href) {
    if (hubBelow()) { try { sessionStorage.setItem(CARRY, String(Date.now())); } catch (e) {} }
    location.replace(href);
  }
  // 回目录：底下就是目录 → 退回去（目录原样恢复，历史里也不会多一条目录）；
  //   直接打开的页（书签、别人发的链接）底下没有目录 → 正常跳过去
  function goHome() {
    if (!hubBelow()) { location.href = HUB; return; }
    var left = false;
    window.addEventListener('pagehide', function () { left = true; }, { once: true });
    history.back();
    // 兜底：万一没退走（历史被浏览器裁掉之类），就直接跳
    setTimeout(function () { if (!left && document.visibilityState === 'visible') location.href = HUB; }, 800);
  }
  // 点了链接要不要由我们接管：普通左键单击才接管；按住 Ctrl / ⌘ / Shift 点（新标签页打开）交给浏览器
  function plainClick(e) { return !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey; }

  // 标题左边的主页按钮 #btnHome
  function mountHome() {
    var a = document.getElementById('btnHome');
    if (!a) return;
    a.addEventListener('click', function (e) {
      if (!plainClick(e)) return;
      e.preventDefault();
      goHome();
    });
  }

  // 标题按钮 #btnSwitch → 在同一个 .head 里挂一张菜单：第一项回目录，下面是全部换算，当前页描蓝边
  function mountSwitcher(currentId) {
    mountHome();
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
      // 点菜单里的链接：先收起菜单、等收起的画面真正画出来，再跳转。
      //   Safari 离开页面时会给它拍快照，左滑返回的动画里显示的就是这张快照；
      //   跳转时菜单还开着，返回时就会先看到一个开着的菜单（2026-10-09 用户真机截图）。
      //   回目录走 goHome，切换走 switchTo（不叠历史）
      if (link && plainClick(e)) {
        e.preventDefault();
        set(false);
        var href = link.href, home = link.classList.contains('home');
        requestAnimationFrame(function () { requestAnimationFrame(function () { if (home) goHome(); else switchTo(href); }); });
        return;
      }
      if (!menu.contains(e.target)) set(false);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { set(false); btn.focus(); } });
    // 兜底：离开页面时收起；从别的页按「返回」回来时，浏览器可能直接恢复上次的画面（bfcache），也再收一次
    window.addEventListener('pagehide', function () { set(false); });
    window.addEventListener('pageshow', function () { set(false); });
    return { isOpen: function () { return !menu.hidden; } };
  }

  root.WVNav = { mountSwitcher: mountSwitcher, goHome: goHome };
})(this);
