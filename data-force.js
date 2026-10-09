/*
 * 力换算 —— 单位表（只放数据）。基准单位：牛顿。数值核实于 2026-10-09。
 * 排版规则同斤两页：每组 3 的倍数、每行同类、每行从左到右由小到大（测试会拦）。
 */
(function (root) {
  var NIST = 'NIST SP 811 附录 B.9';
  var G = 9.80665;                 // 标准重力加速度（定义值）
  var LBF = 0.45359237 * G;        // 1 磅力 = 1 磅质量 × 标准重力 = 4.448 221 615 260 5 牛
  var groups = [
    { id: 'si', tier: 'common', name: '公制' },
    { id: 'grav', tier: 'common', name: '重力单位（按标准重力 9.80665）' },
    { id: 'imp', tier: 'common', name: '英美' }
  ];
  var units = [
    { id: 'dyn', label: '达因', group: 'si', toBase: 1e-5, level: 'exact', source: NIST + '（1 达因 = 10⁻⁵ 牛）' },
    { id: 'n', label: '牛', group: 'si', toBase: 1, level: 'exact', source: '国际单位制（GB 3100-1993）' },
    { id: 'kn', label: '千牛', group: 'si', toBase: 1000, level: 'exact', source: '国际单位制（GB 3100-1993）' },
    { id: 'gf', label: '克力', group: 'grav', toBase: G / 1000, level: 'exact', source: '= 1/1000 千克力（' + NIST + '：千克力 = 9.806 65 牛）' },
    { id: 'kgf', label: '千克力', group: 'grav', toBase: G, level: 'exact', source: NIST + '：1 千克力（公斤力）= 9.806 65 牛' },
    { id: 'tf', label: '吨力', group: 'grav', toBase: G * 1000, level: 'exact', source: '= 1000 千克力（' + NIST + '）' },
    { id: 'ozf', label: '盎司力', group: 'imp', toBase: LBF / 16, level: 'exact', source: '= 1/16 磅力（' + NIST + ' 列 0.278 013 9 牛）' },
    { id: 'lbf', label: '磅力', group: 'imp', toBase: LBF, level: 'exact', source: '= 0.453 592 37 千克 × 9.806 65（' + NIST + ' 列 4.448 222 牛）' },
    { id: 'kip', label: '千磅力', group: 'imp', toBase: LBF * 1000, level: 'exact', source: NIST + '：1 kip = 1000 磅力' }
  ];
  var DATA = { groups: groups, units: units };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.WV_FORCE = DATA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
