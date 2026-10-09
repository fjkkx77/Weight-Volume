/*
 * 压力（压强）换算 —— 单位表（只放数据）。基准单位：帕。数值核实于 2026-10-09。
 * 排版规则同斤两页：每组 3 的倍数、每行同类、每行从左到右由小到大（测试会拦；数值相等的并列，如毫巴 = 百帕）。
 */
(function (root) {
  var NIST = 'NIST SP 811 附录 B.9';
  var MMHG = 133.322387415;                         // 常规毫米汞柱 = 13.5951 克/立方厘米 × 9.80665 × 1 毫米
  var PSI = 0.45359237 * 9.80665 / 0.00064516;      // 磅力 ÷ 平方英寸 = 6894.757 293 168 361 帕
  var groups = [
    { id: 'si', tier: 'common', name: '公制' },
    { id: 'common2', tier: 'common', name: '常用 · 血压 · 胎压 · 大气' },
    { id: 'eng', tier: 'common', name: '工程 · 英美（psi = 磅力/平方英寸）' },
    { id: 'm_small', tier: 'more', name: '气象 · 微小（百帕 = 毫巴）' },
    { id: 'm_big', tier: 'more', name: '真空 · 材料（ksi = 千磅力/平方英寸）' }
  ];
  var units = [
    { id: 'pa', label: '帕', group: 'si', toBase: 1, level: 'exact', source: '国际单位制（GB 3100-1993）' },
    { id: 'kpa', label: '千帕', group: 'si', toBase: 1e3, level: 'exact', source: '国际单位制（GB 3100-1993）' },
    { id: 'mpa', label: '兆帕', group: 'si', toBase: 1e6, level: 'exact', source: '国际单位制（GB 3100-1993）' },
    { id: 'mmhg', label: '毫米汞柱', group: 'common2', toBase: MMHG, level: 'exact', source: '常规毫米汞柱（' + NIST + ' 列 133.3224 帕）；血压计读数' },
    { id: 'bar', label: '巴', group: 'common2', toBase: 1e5, level: 'exact', source: NIST + '（1 巴 = 10⁵ 帕）；胎压常用' },
    { id: 'atm', label: '标准大气压', group: 'common2', toBase: 101325, level: 'exact', source: NIST + '（1 标准大气压 = 101 325 帕）' },
    { id: 'inhg', label: '英寸汞柱', group: 'eng', toBase: MMHG * 25.4, level: 'exact', source: '= 25.4 毫米汞柱（' + NIST + ' 列 3386.389 帕）' },
    { id: 'psi', label: 'psi', group: 'eng', toBase: PSI, level: 'exact', source: '磅力/平方英寸（' + NIST + ' 列 6894.757 帕）；美国胎压常用' },
    { id: 'at', label: '工程大气压', group: 'eng', toBase: 98066.5, level: 'exact', source: '= 1 千克力/平方厘米（公斤力/平方厘米，' + NIST + '「atmosphere, technical」）；国内老压力表常用「公斤」' },
    { id: 'mmh2o', label: '毫米水柱', group: 'm_small', toBase: 9.80665, level: 'exact', source: '常规毫米水柱（' + NIST + '）' },
    { id: 'hpa', label: '百帕', group: 'm_small', toBase: 100, level: 'exact', source: '国际单位制；天气预报的气压单位' },
    { id: 'mbar', label: '毫巴', group: 'm_small', toBase: 100, level: 'exact', source: NIST + '（1 毫巴 = 100 帕 = 1 百帕）' },
    { id: 'torr', label: '托', group: 'm_big', toBase: 101325 / 760, level: 'exact', source: '= 1/760 标准大气压（' + NIST + ' 列 133.3224 帕；与毫米汞柱相差约百万分之一）' },
    { id: 'ksi', label: 'ksi', group: 'm_big', toBase: PSI * 1000, level: 'exact', source: '千磅力/平方英寸（' + NIST + ' 列 6.894 757×10⁶ 帕）；材料强度常用' },
    { id: 'gpa', label: '吉帕', group: 'm_big', toBase: 1e9, level: 'exact', source: '国际单位制（GB 3100-1993）' }
  ];
  var DATA = { groups: groups, units: units, tinySci: true };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.WV_PRESSURE = DATA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
