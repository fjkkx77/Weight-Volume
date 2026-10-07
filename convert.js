/*
 * 重量·容量换算站 —— 换算内核（纯函数，不碰 DOM）
 * 浏览器里挂到 window.WV；node 里 require('./convert.js')。
 */
(function (root) {
  var D = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.WV_DATA;

  var unitById = {};
  D.units.forEach(function (u) { unitById[u.id] = u; });
  var subById = {};
  D.substances.forEach(function (s) { subById[s.id] = s; });

  function unit(id) {
    var u = unitById[id];
    if (!u) throw new Error('未知单位: ' + id);
    return u;
  }

  function toBase(value, unitId) { return value * unit(unitId).toBase; }
  function fromBase(base, unitId) { return base / unit(unitId).toBase; }

  // 一个数换成全部单位。跨重量/容量时用所选物质的密度（克/毫升）。
  function convertAll(value, unitId, substanceId) {
    var u = unit(unitId);
    var sub = subById[substanceId] || D.substances[0];
    var base = toBase(value, unitId);
    var g = u.kind === 'mass' ? base : base * sub.density;
    var ml = u.kind === 'volume' ? base : base / sub.density;
    var out = { g: g, ml: ml, approx: !!sub.granular };
    D.units.forEach(function (x) {
      out[x.id] = x.id === unitId ? value : fromBase(x.kind === 'mass' ? g : ml, x.id);
    });
    return out;
  }

  // 显示用：6 位有效数字（手机一行放得下、生活里够用），但整数部分不截断；去掉浮点尾巴；不用科学计数法
  //   最初给的是 9 位，截图里「33.3333333 茶匙」「2.11337642 杯」又长又没用，2026-10-06 收到 6 位
  var SIG = 6;
  function formatNumber(x) {
    if (x === 0) return '0';
    if (!isFinite(x)) return '';
    if (Math.abs(x) < 1e-6) return '≈0';
    var intDigits = Math.abs(x) >= 1 ? Math.floor(Math.log10(Math.abs(x))) + 1 : 1;
    var n = Number(x.toPrecision(Math.min(21, Math.max(SIG, intDigits))));
    var s = String(n);
    if (/e/i.test(s)) s = n.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 9 });
    return s;
  }

  // 格子里用的写法：sig 位有效数字；1 亿以上改成「亿 / 万亿」，否则 3 列网格的格子里放不下 12 位以上的整数
  //   （2026-10-07 实测：99999999 吨 → 99999999000000 克，字号缩到 12px 也会被截断）
  function formatCell(x, sig) {
    sig = sig || 6;
    if (x === 0) return '0';
    if (!isFinite(x)) return '';
    var ax = Math.abs(x);
    if (ax < 1e-9) return '≈0';
    if (ax >= 1e12) return Number((x / 1e12).toPrecision(sig)) + '万亿';
    if (ax >= 1e8) return Number((x / 1e8).toPrecision(sig)) + '亿';
    var intDigits = ax >= 1 ? Math.floor(Math.log10(ax)) + 1 : 1;
    var n = Number(x.toPrecision(Math.max(sig, intDigits)));
    var str = String(n);
    if (/e/i.test(str)) str = n.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 });
    return str;
  }

  // 组合写法。全程用整数计数避免浮点误差：
  //   市制：以 0.1 钱（= 0.5 克）为最小单位；旧制：以 0.1 两（= 3.125 克）为最小单位
  function formatComposite(g, system) {
    var t, jin, liang, rest, parts = [];
    if (system === 'jin') {
      t = Math.round(g / 0.5);
      if (t <= 0) return '';
      jin = Math.floor(t / 1000);
      liang = Math.floor((t % 1000) / 100);
      var qian = (t % 100) / 10;
      if (jin) parts.push(jin + '斤');
      if (liang) parts.push(liang + '两');
      if (qian) parts.push(qian + '钱');
    } else if (system === 'jin_old') {
      t = Math.round(g / 3.125);
      if (t <= 0) return '';
      jin = Math.floor(t / 160);
      rest = (t % 160) / 10;
      if (jin) parts.push(jin + '斤');
      if (rest) parts.push(rest + '两');
    } else {
      throw new Error('未知组合制式: ' + system);
    }
    return parts.join('');
  }

  // 「≈ N 个某物品」推荐。
  //   好记 = 倍数在 [0.5, 20] 内、接近整数或半个；倍数离 1 越远越难想象，要扣分。
  //   扣分权重 LOG_W：0.02 时「50 克 ≈ 8.33 枚硬币」会压过「≈ 0.9 个鸡蛋」，调到 0.06 才让小倍数优先（2026-10-06 按当时的物品表调）。
  //   为了拉开量级，入选物品两两之间的典型值至少差 1.6 倍（否则「1.5 罐可乐、2 盒牛奶」等于说了两遍）。
  //   MAX_PICK=2：2026-10-07 改版后参照只占换算区下面一行，放两个正好
  var RATIO_MIN = 0.5, RATIO_MAX = 20, SPREAD = 1.6, MAX_PICK = 2, LOG_W = 0.06;
  function suggestItems(q) {
    var cands = [];
    D.items.forEach(function (it) {
      var have = it.kind === 'mass' ? q.g : q.ml;
      if (!(have > 0)) return;
      var r = have / it.value;
      if (r < RATIO_MIN || r > RATIO_MAX) return;
      var half = Math.round(r * 2) / 2 || 0.5;
      var err = Math.abs(r - half) / r;
      cands.push({ item: it, ratio: r, rounded: half, exactish: err < 0.05, score: err + LOG_W * Math.abs(Math.log2(r)) });
    });
    cands.sort(function (a, b) { return a.score - b.score; });
    var picked = [];
    for (var i = 0; i < cands.length && picked.length < MAX_PICK; i++) {
      var c = cands[i];
      var tooClose = picked.some(function (p) {
        var k = p.item.value / c.item.value;
        return k < SPREAD && k > 1 / SPREAD;
      });
      if (!tooClose) picked.push(c);
    }
    return picked;
  }

  // 「1.5 罐可乐」「半瓶矿泉水」：物品名以「一+量词」开头时去掉前缀再数，否则会读成「1.5 罐一罐可乐」
  function suggestionText(s) {
    var it = s.item, n;
    var noun = it.name.indexOf('一' + it.unit) === 0 ? it.name.slice(1 + it.unit.length) : it.name;
    if (/^[0-9A-Za-z]/.test(noun)) noun = ' ' + noun;          // 「2 张 A4 纸」，别粘成「2 张A4 纸」
    if (s.exactish && s.rounded === 0.5) return '半' + it.unit + noun.trim();
    if (s.exactish) n = formatNumber(s.rounded);
    else n = s.ratio >= 10 ? String(Math.round(s.ratio)) : formatNumber(Math.round(s.ratio * 10) / 10);
    return n + ' ' + it.unit + noun;
  }

  // 「1,5」「1，5」都当小数；空、负数、非数字一律 null
  function parseInput(s) {
    s = String(s == null ? '' : s).trim().replace(/[，,]/g, '.');
    if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return null;
    var n = Number(s);
    return isFinite(n) ? n : null;
  }

  var WV = {
    toBase: toBase, fromBase: fromBase, convertAll: convertAll,
    formatNumber: formatNumber, formatCell: formatCell, formatComposite: formatComposite,
    suggestItems: suggestItems, suggestionText: suggestionText, parseInput: parseInput,
    unitById: unitById, subById: subById
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = WV;
  else root.WV = WV;
})(typeof globalThis !== 'undefined' ? globalThis : this);
