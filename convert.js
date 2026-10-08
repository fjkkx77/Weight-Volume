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
    // 1 亿亿以上（如 99999999 吨换成微克 = 10²⁰）「万亿」也放不下，改成 1×10²⁰ 这种写法
    if (ax >= 1e16) {
      var exp = Math.floor(Math.log10(ax)), m = Number((x / Math.pow(10, exp)).toPrecision(Math.min(sig, 4)));
      if (Math.abs(m) >= 10) { m = m / 10; exp += 1; }
      return m + '×10' + String(exp).replace(/\d/g, function (d) { return '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]; });
    }
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

  // 物品格（个数、张数）的写法：数量本身就是约数（鸡蛋 58～64 克、人民币是推算值），
  // 6 位有效数字是假精度（2026-10-08 审查：「8.47458 个鸡蛋」「434.783 张」）。≥1 留 1 位小数，<1 留 2 位有效数字
  function formatCount(x) {
    if (x === 0) return '0';
    if (!isFinite(x)) return '';
    return Math.abs(x) >= 1 ? formatCell(Math.round(x * 10) / 10, 6) : formatCell(x, 2);
  }

  // 「≈ N 个某物品」推荐，候选是生活物品格（tier 为 items、没标 suggest:false 的；人民币不进推荐）。
  //   好记 = 倍数在 [0.5, 20] 内、接近整数或半个；倍数离 1 越远越难想象，要扣分。
  //   扣分权重 LOG_W：0.02 时「50 克 ≈ 8.33 枚硬币」会压过「≈ 0.9 个鸡蛋」，调到 0.06 才让小倍数优先（2026-10-06 按当时的物品表调）。
  //   为了拉开量级，入选物品两两之间至少差 1.6 倍（否则「1.5 罐可乐、2 盒牛奶」等于说了两遍）。
  //   MAX_PICK=2：参照只占换算区下面一行，放两个正好。
  //   exclude：起点格本身是物品时不推荐它自己（2026-10-08 审查：输入 1 罐可乐，提示「相当于 1 罐可乐」）
  var RATIO_MIN = 0.5, RATIO_MAX = 20, SPREAD = 1.6, MAX_PICK = 2, LOG_W = 0.06;
  var tierOf = {};
  D.groups.forEach(function (g) { tierOf[g.id] = g.tier; });
  var CANDS = D.units.filter(function (u) { return tierOf[u.group] === 'items' && u.suggest !== false; });
  function suggestItems(g, exclude) {
    if (!(g > 0)) return [];
    var cands = [];
    CANDS.forEach(function (u) {
      if (u.id === exclude) return;
      var r = g / u.toBase;
      if (r < RATIO_MIN || r > RATIO_MAX) return;
      var half = Math.round(r * 2) / 2 || 0.5;
      var err = Math.abs(r - half) / r;
      cands.push({ item: u, ratio: r, rounded: half, exactish: err < 0.05, score: err + LOG_W * Math.abs(Math.log2(r)) });
    });
    cands.sort(function (a, b) { return a.score - b.score; });
    var picked = [];
    for (var i = 0; i < cands.length && picked.length < MAX_PICK; i++) {
      var c = cands[i];
      var tooClose = picked.some(function (p) {
        var k = p.item.toBase / c.item.toBase;
        return k < SPREAD && k > 1 / SPREAD;
      });
      if (!tooClose) picked.push(c);
    }
    return picked;
  }

  // 「1.5 罐可乐」「半瓶矿泉水」「2 张 A4 纸」：量词 cw + 名字 noun；名字以字母数字开头时隔一个空格
  function suggestionText(s) {
    var u = s.item, n, noun = u.noun;
    if (s.exactish && s.rounded === 0.5) return '半' + u.cw + noun;
    if (/^[0-9A-Za-z]/.test(noun)) noun = ' ' + noun;
    if (s.exactish) n = formatNumber(s.rounded);
    else n = s.ratio >= 10 ? String(Math.round(s.ratio)) : formatNumber(Math.round(s.ratio * 10) / 10);
    return n + ' ' + u.cw + noun;
  }

  // 「1,5」「1，5」都当小数；空、负数、非数字一律 null
  //   全角数字（中文输入法下可能打出「１２」）也照收
  function parseInput(s) {
    s = String(s == null ? '' : s).trim()
      .replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/[，,．。]/g, '.');
    if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return null;
    var n = Number(s);
    return isFinite(n) ? n : null;
  }

  var WV = {
    toBase: toBase, fromBase: fromBase, convertAll: convertAll,
    formatNumber: formatNumber, formatCell: formatCell, formatCount: formatCount, formatComposite: formatComposite,
    suggestItems: suggestItems, suggestionText: suggestionText, parseInput: parseInput,
    unitById: unitById, subById: subById
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = WV;
  else root.WV = WV;
})(typeof globalThis !== 'undefined' ? globalThis : this);
