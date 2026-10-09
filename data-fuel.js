/*
 * 油耗换算 —— 单位表（只放数据）。基准：公里/升（每升油跑多远）。数值核实于 2026-10-09。
 * 「升/百公里」和「加仑/百英里」跟基准是倒数关系（越小越省），不能乘倍数，用 to / from 两个函数写。
 * 倒数关系下单位之间没有固定的大小顺序，排版不判从小到大（noOrder）。
 */
(function (root) {
  var MI = 1.609344, GAL_US = 3.785411784, GAL_UK = 4.54609;   // 千米 / 升，NIST SP 811 精确值
  var NIST = 'NIST SP 811 附录 B.9';
  // 倒数单位：读数 v 和基准 b（公里/升）互为 k / x，to 和 from 是同一个式子
  function inverse(k) { var f = function (x) { return k / x; }; return { to: f, from: f }; }
  var l100 = inverse(100), g100us = inverse(100 * MI / GAL_US), g100uk = inverse(100 * MI / GAL_UK);
  var groups = [
    { id: 'main', tier: 'common', name: '常用（MPG = 英里/加仑）' },
    { id: 'm_imp', tier: 'more', name: '英制 MPG · 每百英里耗几加仑' }
  ];
  var units = [
    { id: 'l100km', label: '升/百公里', group: 'main', to: l100.to, from: l100.from, level: 'exact', source: '每 100 公里耗油升数（国内、欧洲的标注方式）；与公里/升互为倒数：升/百公里 = 100 ÷ 公里/升' },
    { id: 'kmpl', label: '公里/升', group: 'main', toBase: 1, level: 'exact', source: '每升油跑多少公里（日本、印度常用）' },
    { id: 'mpg_us', label: '美制MPG', group: 'main', toBase: MI / GAL_US, level: 'exact', source: '英里/美制加仑（' + NIST + '：1 mpg = 0.425 143 7 公里/升；235.215 ÷ mpg = 升/百公里）' },
    { id: 'mpg_uk', label: '英制MPG', group: 'm_imp', toBase: MI / GAL_UK, level: 'exact', source: '英里/英制加仑（英制加仑 = 4.546 09 升，' + NIST + '）' },
    { id: 'g100_us', label: '美制加仑', group: 'm_imp', to: g100us.to, from: g100us.from, level: 'exact', source: '每 100 英里耗美制加仑数（美国环保署油耗标签上的写法），按 ' + NIST + ' 的英里、美制加仑精确值换算' },
    { id: 'g100_uk', label: '英制加仑', group: 'm_imp', to: g100uk.to, from: g100uk.from, level: 'exact', source: '每 100 英里耗英制加仑数，按 ' + NIST + ' 的英里、英制加仑精确值换算' }
  ];
  var DATA = { groups: groups, units: units, noOrder: true,
    // 0 没法换：0 升/百公里 = 无穷远，0 公里/升 = 无穷多油
    validate: function (b) { return b > 0 && isFinite(b) ? null : '油耗不能是 0（0 升/百公里等于不耗油，换成公里/升是无穷大）'; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.WV_FUEL = DATA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
