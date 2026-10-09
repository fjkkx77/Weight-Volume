/*
 * 换算合集 —— 网格引擎（所有换算页共用；2026-10-09 从斤两页的内联脚本抽出来，逻辑照旧）
 *
 *   var g = WVGrid.mount({
 *     data: { groups, units },          // 单位表（groups.tier: common 首屏 / more 收起 / items 物品卡）
 *     convert: function (v, unitId) {}, // 返回 { 单位 id: 数值 }；起点格原样返回 v
 *     key: 'length',                    // 存状态用的名字（斤两页沿用老的 wv.state / wv.moreOpen）
 *     signed: false,                    // 允许负数（温度）：解析放开负号，并接上 ± 键 #btnSign
 *     validate: function (v, unitId) {},// 返回错误文字＝这个数不成立（低于绝对零度），只标红起点格
 *     texts: function (u, x) {},        // 一格的候选写法（从长到短）；默认 6～3 位有效数字
 *     after: function (state, r) {},    // 每次重算后（参照行、组合写法、合计）；r 为 null 表示没输入
 *     extra: { get, set, reset },       // 页面自己的状态（斤两页的「按什么物质」），跟输入一起存
 *     resetIds: ['btnReset'],
 *     blocked: function () {}           // 返回 true 时不接管下拉刷新（如菜单开着）
 *   });
 *
 * 要守的约定（来自斤两页踩过的坑，别改丢）：
 *   - recompute 里不读任何布局属性：格子宽度缓存在 availCache，文字宽度 = 逐字符宽度之和（charW 缓存）
 *     否则每按一个键整页同步重排（2026-10-08 改前 CPU÷6 下中位 526ms）
 *   - 收起状态下「更多」区的格子宽度是 0：展开时必须清缓存再 recompute
 *   - 同一行三格字号取最小（用户有强迫症）
 */
(function (root) {
  'use strict';
  var K = root.WVCore;
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  var CONTAINER = { common: 'groups', more: 'more', items: 'objects' };
  var SIZES = [17, 15, 13.5, 12], SIGS = [6, 5, 4, 3];

  function mount(o) {
    var D = o.data;
    var extra = o.extra || { get: function () { return {}; }, set: function () {}, reset: function () {} };
    var state = { unitId: null, value: null };
    var inputs = {};

    // ---------- 渲染 ----------
    function groupsHtml(tier) { return D.groups.filter(function (g) { return g.tier === tier; }).map(function (g) {
      var cells = D.units.filter(function (u) { return u.group === g.id; }).map(function (u) {
        var input = '<input id="u_' + u.id + '" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" spellcheck="false" placeholder="0" data-unit="' + u.id + '"' +
          (u.cw ? ' aria-label="' + esc(u.label + '，' + u.cw + '数') + '"' : '') + '>';
        input = '<span class="iw">' + input + '</span>';
        return '<div class="cell" data-unit="' + u.id + '"><label for="u_' + u.id + '">' + esc(u.label) + '</label>' +
          (u.cw ? '<div class="vrow">' + input + '<span class="cw" aria-hidden="true">' + esc(u.cw) + '</span></div>' : input) + '</div>';
      }).join('');
      return '<div class="group" data-group="' + g.id + '"><div class="cap"><span>' + esc(g.name) + '</span>' +
        (g.composite ? '<b data-comp="' + g.id + '"></b>' : '') + (g.note ? '<i>' + esc(g.note) + '</i>' : '') +
        '</div><div class="grid">' + cells + '</div></div>';
    }).join(''); }
    var areas = [];
    Object.keys(CONTAINER).forEach(function (tier) {
      var el = $(CONTAINER[tier]);
      if (!el) return;
      el.innerHTML = groupsHtml(tier);
      areas.push(el);
    });
    var moreEl = $('more'), btnMore = $('btnMore');
    var moreCount = moreEl ? moreEl.querySelectorAll('.cell').length : 0;
    // 没有「更多」的页：按钮和收起区都不要
    if (moreEl && !moreCount) { moreEl.remove(); moreEl = null; if (btnMore) { btnMore.remove(); btnMore = null; } }
    D.units.forEach(function (u) { inputs[u.id] = $('u_' + u.id); });

    // ---------- 数字放进格子 ----------
    // 放不下时：先保持 6 位有效数字缩字号（17 → 12px），还放不下再减有效位数（6 → 3）。
    // 大数由 formatCell 改写成「亿 / 万亿」。起点格是用户自己打的字，只缩字号不改内容。
    var meter = document.createElement('span');
    meter.className = 'meter'; meter.setAttribute('aria-hidden', 'true');
    document.body.appendChild(meter);
    var charW = {};
    // 一批字符一起量：每个字符一个 span，一次排版全部读出
    function measureChars(chars) {
      var todo = chars.filter(function (ch, i) { return !(ch in charW) && chars.indexOf(ch) === i; });
      if (!todo.length) return;
      meter.innerHTML = '';
      var spans = todo.map(function (ch) { var sp = document.createElement('span'); sp.textContent = ch; meter.appendChild(sp); return sp; });
      spans.forEach(function (sp, i) { charW[todo[i]] = sp.getBoundingClientRect().width; });
    }
    var COMMON_CHARS = '0123456789.-≈×亿万⁰¹²³⁴⁵⁶⁷⁸⁹⁻'.split('');
    measureChars(COMMON_CHARS);
    function textWidth(t) {
      var chars = String(t).split('');
      measureChars(chars);   // 只有没见过的字符（用户打了别的东西）才真的去量
      return chars.reduce(function (w, ch) { return w + charW[ch]; }, 0);
    }
    // 能放下这段文字的最大字号；放不下返回 0。留 1.5px 余量（逐字相加不含字距微调，差额在亚像素级）
    function sizeFor(t, avail) {
      var w = textWidth(t);
      for (var i = 0; i < SIZES.length; i++) if (w * SIZES[i] / SIZES[0] <= avail - 1.5) return SIZES[i];
      return 0;
    }
    // 最小档也放不下（如 320 宽下「99999999 张」）：按比例再缩一点让数字完整露出来，最低 10px，再长就只能在框里滚动
    function squeeze(t, avail) {
      var w = textWidth(t), last = SIZES[SIZES.length - 1];
      if (!avail || !w) return last;
      return Math.max(10, Math.min(last, SIZES[0] * (avail - 1.5) / w));
    }
    var availCache = null;
    function availOf() {
      if (!availCache) {
        availCache = {};
        D.units.forEach(function (u) { if (inputs[u.id]) availCache[u.id] = inputs[u.id].parentNode.clientWidth; });
      }
      return availCache;
    }
    // 页面可以给某些格子换写法（斤两页的物品格写个数），返回空就用默认的 6～3 位有效数字
    //   tinySci：极小的数写成「6.68×10⁻¹²」而不是「≈0」（长度、面积页的天文单位、平方千米一碰就是 10⁻¹⁰ 量级；
    //   斤两页仍沿用 ≈0 的老口径，没开）
    function texts(u, x) {
      var custom = o.texts && o.texts(u, x);
      if (custom) return custom;
      if (o.tinySci && x !== 0 && Math.abs(x) < 1e-6) return [K.formatSci(x, 4), K.formatSci(x, 3), K.formatSci(x, 2)];
      return SIGS.map(function (sig) { return K.formatCell(x, sig); });
    }
    // 一格要显示 x：给出文字和字号。avail 为 0（收起区里看不见的格子）时不量，展开时 setMore 会重算
    function plan(u, x, avail) {
      var ts = texts(u, x);
      if (!avail) return { text: ts[0], size: 0 };
      for (var i = 0; i < ts.length; i++) { var sz = sizeFor(ts[i], avail); if (sz) return { text: ts[i], size: sz }; }
      // 3 位有效数字都放不下的只会是极小的数（如 0.000000005 吨）：在这个精度下就是约等于 0
      if (Math.abs(x) < 1) return { text: '≈0', size: sizeFor('≈0', avail) || SIZES[SIZES.length - 1] };
      return { text: ts[ts.length - 1], size: squeeze(ts[ts.length - 1], avail) };
    }
    // 显示字号：真实字号钉在 17px（iPhone 点进 < 16px 的输入框会自动放大页面），这里只改缩放比例，见 site.css .iw
    function setSize(el, px) {
      if (px && px !== SIZES[0]) el.style.setProperty('--k', px / SIZES[0]);
      else el.style.removeProperty('--k');
    }
    // 起点格 / 打到一半的非法输入：只按它自己的文字定字号
    function fitOwn(el) {
      var a = availOf()[el.dataset.unit];
      var sz = a ? sizeFor(el.value, a) : 0;
      setSize(el, sz || squeeze(el.value, a));
    }

    function recompute() {
      var has = state.unitId !== null && state.value !== null;
      var r = has ? o.convert(state.value, state.unitId) : null;
      // 第一步：格子可用宽度（缓存，见上）
      var avail = availOf();
      // 第二步：只算。每格定文字和字号；同一行三格取最小字号（用户有强迫症，一行里大小不一很扎眼）
      var plans = {};
      D.units.forEach(function (u) {
        if (!inputs[u.id]) return;   // 旧页面 + 新数据（缓存错配）时跳过不认识的格子，别让整页报错
        if (u.id === state.unitId) plans[u.id] = { own: true, size: (avail[u.id] && sizeFor(inputs[u.id].value, avail[u.id])) || squeeze(inputs[u.id].value, avail[u.id]) };
        else plans[u.id] = has ? plan(u, r[u.id], avail[u.id]) : { text: '', size: 0 };
      });
      D.groups.forEach(function (g) {
        var us = D.units.filter(function (u) { return u.group === g.id && plans[u.id]; });
        for (var i = 0; i < us.length; i += 3) {
          var row = us.slice(i, i + 3).map(function (u) { return plans[u.id]; });
          var sized = row.filter(function (p) { return p.size; });
          if (!sized.length) continue;
          var min = Math.min.apply(null, sized.map(function (p) { return p.size; }));
          row.forEach(function (p) { if (p.size || p.text === '') p.size = min; });
        }
      });
      // 第三步：只写
      D.units.forEach(function (u) {
        var el = inputs[u.id], p = plans[u.id];
        if (!el) return;
        var cell = el.closest('.cell');
        cell.classList.toggle('src', u.id === state.unitId);
        if (!p.own) { el.value = p.text; cell.classList.remove('invalid'); }
        setSize(el, p.size);
      });
      var refer = $('refer');
      if (refer) refer.classList.remove('bad');
      if (o.after) o.after(state, r);
      else {
        if (refer) refer.textContent = has ? '' : '在任意一格输入数字，其余单位自动算出';
      }
    }

    // 输入不成立（如低于绝对零度）：起点格标红，其他格清空，提示行说原因
    function showInvalid(el, msg) {
      state.unitId = null; state.value = null;
      // recompute 会把所有非起点格写空，这一格也在内：先记下用户打的字，算完放回去
      //   （2026-10-09 截图发现：输入 −1 K 后开尔文格被清空，只剩占位的 0）
      var typed = el.value;
      recompute();
      el.value = typed;
      el.closest('.cell').classList.add('invalid', 'src');
      fitOwn(el);
      var refer = $('refer');
      if (refer && msg) { refer.textContent = msg; refer.classList.add('bad'); }
      saveState();   // 不存的话刷新后会恢复成上一次的合法输入，跟屏幕上看到的对不上
    }

    // ---------- 刷新后接着用 ----------
    // 输入存 sessionStorage，只在这个标签页里有效、关掉就没（2026-10-08 审查：收起键盘后误拉一下，输入全丢）
    var STATE_KEY = o.key === 'weight' ? 'wv.state' : 'wv.' + o.key + '.state';
    var MORE_KEY = o.key === 'weight' ? 'wv.moreOpen' : 'wv.' + o.key + '.moreOpen';
    function saveState() {
      try {
        var x = extra.get();
        var obj = state.unitId === null ? x : Object.assign({ u: state.unitId, t: inputs[state.unitId].value }, x);
        if (Object.keys(obj).length) sessionStorage.setItem(STATE_KEY, JSON.stringify(obj));
        else sessionStorage.removeItem(STATE_KEY);
      } catch (err) {}
    }
    function restoreState() {
      var s = null;
      try { s = JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null'); } catch (err) {}
      if (!s) return;
      extra.set(s);
      var v = s.u && inputs[s.u] ? K.parseInput(s.t, o.signed) : null;
      if (v !== null && !(o.validate && o.validate(v, s.u))) { state.unitId = s.u; state.value = v; inputs[s.u].value = s.t; }
    }

    // ---------- 交互 ----------
    function onUnits(type, fn) { areas.forEach(function (el) { el.addEventListener(type, fn); }); }

    // 「更多单位」展开/收起，记住上次的状态（存不了就每次默认收起）
    function setMore(open) {
      if (!moreEl) return;
      moreEl.hidden = !open;
      btnMore.setAttribute('aria-expanded', String(open));
      $('moreText').textContent = open ? '收起' : '更多 ' + moreCount + ' 个';
      try { localStorage.setItem(MORE_KEY, open ? '1' : '0'); } catch (err) {}
      // 收起时格子宽度是 0：展开后必须重读宽度、重算一遍
      availCache = null;
      if (open) recompute();
    }
    if (btnMore) btnMore.addEventListener('click', function () { setMore(moreEl.hidden); });

    function onInput(el) {
      var cell = el.closest('.cell');
      var t = el.value.trim();
      // 空，或只打了一个负号（温度正要输入负数）：当作还没输入，不标红
      if (t === '' || (o.signed && /^[-－−]$/.test(t))) { cell.classList.remove('invalid'); state.unitId = null; state.value = null; recompute(); saveState(); return; }
      var v = K.parseInput(el.value, o.signed);
      if (v === null) { cell.classList.add('invalid'); fitOwn(el); return; }   // 打到一半的非法输入：只标红，不动别的格子
      var bad = o.validate && o.validate(v, el.dataset.unit);
      if (bad) { showInvalid(el, bad); return; }
      cell.classList.remove('invalid');
      state.unitId = el.dataset.unit; state.value = v;
      recompute(); saveState();
    }
    onUnits('input', function (e) { if (e.target.dataset.unit) onInput(e.target); });
    // 点格子空白处也能进入输入
    onUnits('click', function (e) {
      var cell = e.target.closest('.cell');
      if (cell && e.target.tagName !== 'INPUT') cell.querySelector('input').focus();
    });
    // 进入一格就全选：接着打字是替换而不是追加（iOS 真机行为未验证）
    onUnits('focusin', function (e) {
      var el = e.target;
      if (!el.dataset.unit || !el.value) return;
      requestAnimationFrame(function () { try { el.setSelectionRange(0, el.value.length); } catch (err) {} });
    });
    onUnits('keydown', function (e) { if (e.key === 'Enter' && e.target.dataset.unit) e.target.blur(); });

    // ± 键：给正在输入的那一格（没有就给起点格）加 / 去负号。
    //   按下时 preventDefault：不让按钮抢走焦点，否则 iPhone 键盘会收起来
    var btnSign = $('btnSign');
    if (btnSign) {
      if (!o.signed) btnSign.remove();
      else {
        btnSign.addEventListener('pointerdown', function (e) { e.preventDefault(); });
        btnSign.addEventListener('mousedown', function (e) { e.preventDefault(); });
        btnSign.addEventListener('click', function () {
          var a = document.activeElement;
          var el = a && a.dataset && a.dataset.unit ? a : (state.unitId ? inputs[state.unitId] : null);
          if (!el) return;
          var t = el.value.trim();
          el.value = /^[-－−]/.test(t) ? t.slice(1) : '-' + t;
          onInput(el);
          if (el === a) try { el.setSelectionRange(el.value.length, el.value.length); } catch (err) {}
        });
      }
    }

    // 归零 = 回到刚打开的样子：清空数字，页面自己的状态也复位（斤两页：物质回到「按水」）
    function reset() {
      D.units.forEach(function (u) { if (inputs[u.id]) { inputs[u.id].value = ''; inputs[u.id].closest('.cell').classList.remove('invalid'); } });
      state.unitId = null; state.value = null; extra.reset();
      recompute(); saveState();
    }
    (o.resetIds || ['btnReset']).forEach(function (id) { var b = $(id); if (b) b.addEventListener('click', reset); });
    // 格子宽度变了，字号和位数要重新试。安卓弹键盘也会触发 resize，但宽度没变就不重算
    var lastW = window.innerWidth;
    window.addEventListener('resize', function () {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth; availCache = null; recompute();
    });
    // 网页字体晚到会改变字宽：等字体就绪后清掉字宽缓存重算一次
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { charW = {}; recompute(); });

    restoreState();
    recompute();
    var savedMore = false;
    try { savedMore = localStorage.getItem(MORE_KEY) === '1'; } catch (err) {}
    setMore(savedMore);
    // 正在输入时不接管下拉：刷新会把刚输入的数清掉
    if (root.PullToRefresh) root.PullToRefresh.setupPullToRefresh({
      isBlocked: function () {
        var a = document.activeElement;
        return (!!a && a.tagName === 'INPUT') || (o.blocked ? o.blocked() : false);
      }
    });

    return { state: state, inputs: inputs, recompute: recompute, reset: reset, save: saveState };
  }

  root.WVGrid = { mount: mount };
})(this);
