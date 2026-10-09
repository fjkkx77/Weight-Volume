/*
 * 角度换算 —— 单位表（只放数据）。基准单位：度。数值核实于 2026-10-09。
 * 排版规则同斤两页：每组 3 的倍数、每行同类、每行从左到右由小到大（测试会拦）。
 */
(function (root) {
  var NIST = 'NIST SP 811 附录 B.9';
  var RAD = 180 / Math.PI;
  var groups = [
    { id: 'fine', tier: 'common', name: '分秒 · 百分度' },
    { id: 'main', tier: 'common', name: '常用' },
    { id: 'm_mil', tier: 'more', name: '密位 · 炮兵与瞄准', note: '密位按 6000 制' }
  ];
  var units = [
    { id: 'sec', label: '角秒', group: 'fine', toBase: 1 / 3600, level: 'exact', source: '1° = 60′ = 3600″（国务院 1984《关于在我国统一实行法定计量单位的命令》附表；' + NIST + '）' },
    { id: 'min', label: '角分', group: 'fine', toBase: 1 / 60, level: 'exact', source: '1° = 60′（同上）' },
    { id: 'gon', label: '百分度', group: 'fine', toBase: 0.9, level: 'exact', source: '1 百分度（gon）= 0.9°，直角 = 100 百分度（' + NIST + '）' },
    { id: 'deg', label: '度', group: 'main', toBase: 1, level: 'exact', source: '1° = π/180 弧度（国务院 1984《关于在我国统一实行法定计量单位的命令》附表）' },
    { id: 'rad', label: '弧度', group: 'main', toBase: RAD, level: 'exact', source: '国际单位制（GB 3100-1993）：1 弧度 = 180/π 度' },
    { id: 'rev', label: '圈', group: 'main', toBase: 360, level: 'exact', source: '1 圈 = 2π 弧度 = 360°（' + NIST + '）' },
    { id: 'mil_nato', label: '北约密位', group: 'm_mil', toBase: 0.05625, level: 'exact', source: '一圈 = 6400 密位（' + NIST + '「mil」= 0.056 25°）' },
    { id: 'mrad', label: '毫弧度', group: 'm_mil', toBase: RAD / 1000, level: 'exact', source: '国际单位制：1 毫弧度 = 0.001 弧度（瞄准镜上常说的 mil 即此）' },
    { id: 'mil6000', label: '密位', group: 'm_mil', toBase: 0.06, level: 'convention', source: '一圈 = 6000 密位（苏联 / 俄罗斯炮兵沿用的密位制，经维基百科「Milliradian」条目转引；我国炮兵常用此制，未查到国家标准条文）' }
  ];
  var DATA = { groups: groups, units: units };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.WV_ANGLE = DATA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
