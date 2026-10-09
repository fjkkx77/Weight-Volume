/*
 * 换算合集 —— 共用内核（纯函数，不碰 DOM）
 * 浏览器里挂到 window.WVCore；node 里 require('./core.js')。
 * 斤两页的物质密度、斤两组合、物品推荐在 convert.js；这里只放所有换算页都用得上的东西。
 */
(function (root) {
  // 可信等级：每个单位都要标（测试会拦）
  var LEVELS = {
    exact: '定义值',
    convention: '通行约定',
    standard: '标准规定',
    derived: '按标准推算',
    measured: '实测数据',
    label: '包装标称',
    unofficial: '非官方实测',
    historical: '历史单位',  // 温度的列氏度、罗氏度：按当年的定义算，现在已不使用
    rate_cn: '官方中间价',    // 货币：中国外汇交易中心人民币汇率中间价
    rate_ref: '外国央行参考价' // 货币：欧洲央行、澳门金管局公布的汇率，折算成人民币
  };

  // 单位二选一：toBase（1 个该单位 = 多少基准单位，乘倍数）或 to / from（函数，温度这种带偏移的）
  function toBaseOf(u, v) { return u.to ? u.to(v) : v * u.toBase; }
  function fromBaseOf(u, b) { return u.from ? u.from(b) : b / u.toBase; }

  // 一个数换成同一张表里的全部单位；起点格原样返回用户输入的数（不让浮点尾巴改掉它）
  function makeConverter(units) {
    var byId = {};
    units.forEach(function (u) { byId[u.id] = u; });
    function unit(id) {
      var u = byId[id];
      if (!u) throw new Error('未知单位: ' + id);
      return u;
    }
    return {
      unitById: byId,
      toBase: function (v, id) { return toBaseOf(unit(id), v); },
      fromBase: function (b, id) { return fromBaseOf(unit(id), b); },
      convertAll: function (v, id) {
        var base = toBaseOf(unit(id), v), out = { base: base };
        units.forEach(function (x) { out[x.id] = x.id === id ? v : fromBaseOf(x, base); });
        return out;
      }
    };
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

  // 科学计数写法「6.68×10⁻¹²」：给开了 tinySci 的页面写极小的数（sig 位有效数字，尾数四舍五入到 10 要进位）
  function formatSci(x, sig) {
    if (x === 0 || !isFinite(x)) return formatCell(x);
    var exp = Math.floor(Math.log10(Math.abs(x)));
    var m = Number((x / Math.pow(10, exp)).toPrecision(sig || 4));
    if (Math.abs(m) >= 10) { m = m / 10; exp += 1; }
    return m + '×10' + String(exp).replace(/-/, '⁻').replace(/\d/g, function (d) { return '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]; });
  }

  // 物品格（个数、张数）的写法：数量本身就是约数（鸡蛋 58～64 克、人民币是推算值），
  // 6 位有效数字是假精度（2026-10-08 审查：「8.47458 个鸡蛋」「434.783 张」）。≥1 留 1 位小数，<1 留 2 位有效数字
  function formatCount(x) {
    if (x === 0) return '0';
    if (!isFinite(x)) return '';
    return Math.abs(x) >= 1 ? formatCell(Math.round(x * 10) / 10, 6) : formatCell(x, 2);
  }

  // 「1,5」「1，5」都当小数；空、非数字一律 null。全角数字（中文输入法下可能打出「１２」）也照收
  //   signed：允许负号（温度）。全角「－」和数学减号「−」也算；没开时负数照旧当非法
  function parseInput(s, signed) {
    s = String(s == null ? '' : s).trim()
      .replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/[，,．。]/g, '.')
      .replace(/[－−]/g, '-');
    var re = signed ? /^-?(\d+\.?\d*|\.\d+)$/ : /^(\d+\.?\d*|\.\d+)$/;
    if (!re.test(s)) return null;
    var n = Number(s);
    return isFinite(n) ? n : null;
  }

  var WVCore = {
    LEVELS: LEVELS, toBaseOf: toBaseOf, fromBaseOf: fromBaseOf, makeConverter: makeConverter,
    formatNumber: formatNumber, formatCell: formatCell, formatSci: formatSci, formatCount: formatCount, parseInput: parseInput
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = WVCore;
  else root.WVCore = WVCore;
})(typeof globalThis !== 'undefined' ? globalThis : this);
