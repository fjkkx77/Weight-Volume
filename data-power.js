/*
 * 功率换算 —— 单位表（只放数据）。基准单位：瓦。数值核实于 2026-10-09。
 * 排版规则同斤两页：每组 3 的倍数、每行同类、每行从左到右由小到大（测试会拦）。
 * 空调的「匹」没收：它不是计量单位，各厂家按 1 匹 ≈ 2300～2600 瓦制冷量的说法不一，放进来会有歧义。
 */
(function (root) {
  var NIST = 'NIST SP 811 附录 B.9';
  var LBF = 0.45359237 * 9.80665;
  var BTU = 1055.05585262;
  var groups = [
    { id: 'si', tier: 'common', name: '公制' },
    { id: 'hp', tier: 'common', name: '马力' },
    { id: 'heat', tier: 'common', name: '热工 · 制冷' },
    { id: 'm_other', tier: 'more', name: '其他' }
  ];
  var units = [
    { id: 'w', label: '瓦', group: 'si', toBase: 1, level: 'exact', source: '国际单位制（GB 3100-1993）' },
    { id: 'kw', label: '千瓦', group: 'si', toBase: 1e3, level: 'exact', source: '国际单位制（GB 3100-1993）' },
    { id: 'mw', label: '兆瓦', group: 'si', toBase: 1e6, level: 'exact', source: '国际单位制（GB 3100-1993）' },
    { id: 'ps', label: '米制马力', group: 'hp', toBase: 735.49875, level: 'exact', source: '= 75 千克力·米/秒 = 735.498 75 瓦（' + NIST + '「horsepower (metric)」列 735.4988）；国内车辆说的「马力」一般指它' },
    { id: 'hp', label: '英制马力', group: 'hp', toBase: 550 * 0.3048 * LBF, level: 'exact', source: '= 550 英尺·磅力/秒（' + NIST + ' 列 745.6999 瓦）' },
    { id: 'bhp', label: '锅炉马力', group: 'hp', toBase: 9809.5, level: 'exact', source: NIST + '「horsepower (boiler)」= 9.809 50×10³ 瓦' },
    { id: 'btuh', label: 'BTU/时', group: 'heat', toBase: BTU / 3600, level: 'exact', source: '国际蒸汽表英热单位每小时（' + NIST + ' 列 0.293 071 1 瓦）；空调铭牌常见' },
    { id: 'kcalh', label: '千卡/时', group: 'heat', toBase: 4186.8 / 3600, level: 'exact', source: '国际蒸汽表千卡每小时 = 1.163 瓦（' + NIST + '「kilocalorieIT」= 4186.8 焦）；暖通常用' },
    { id: 'rt', label: '冷吨', group: 'heat', toBase: 12000 * BTU / 3600, level: 'exact', source: '美制冷吨 = 12 000 BTU/时（' + NIST + '「ton of refrigeration」列 3516.853 瓦）' },
    { id: 'ergs', label: '尔格/秒', group: 'm_other', toBase: 1e-7, level: 'exact', source: NIST + '（1 尔格/秒 = 10⁻⁷ 瓦）' },
    { id: 'mwatt', label: '毫瓦', group: 'm_other', toBase: 1e-3, level: 'exact', source: '国际单位制（GB 3100-1993）' },
    { id: 'gw', label: '吉瓦', group: 'm_other', toBase: 1e9, level: 'exact', source: '国际单位制（GB 3100-1993）' }
  ];
  var DATA = { groups: groups, units: units, tinySci: true };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.WV_POWER = DATA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
