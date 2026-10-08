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

  // 数字格式与输入解析搬到了共用内核 core.js（所有换算页共用），这里转手给斤两页
  var K = (typeof module !== 'undefined' && module.exports) ? require('./core.js') : root.WVCore;
  var formatNumber = K.formatNumber, formatCell = K.formatCell, formatCount = K.formatCount;
  function parseInput(s) { return K.parseInput(s, false); }

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

  var WV = {
    toBase: toBase, fromBase: fromBase, convertAll: convertAll,
    formatNumber: formatNumber, formatCell: formatCell, formatCount: formatCount, formatComposite: formatComposite,
    suggestItems: suggestItems, suggestionText: suggestionText, parseInput: parseInput,
    unitById: unitById, subById: subById
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = WV;
  else root.WV = WV;
})(typeof globalThis !== 'undefined' ? globalThis : this);
