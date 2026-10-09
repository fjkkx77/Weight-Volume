/*
 * 能量换算 —— 单位表（只放数据）。基准单位：焦耳。数值核实于 2026-10-09。
 * 排版规则同斤两页：每组 3 的倍数、每行同类、每行从左到右由小到大（测试会拦）。
 */
(function (root) {
  var NIST = 'NIST SP 811 附录 B.9';
  var CAL = 4.184;                                  // 热化学卡：食品营养标签上的「千卡 / 大卡」用的就是它
  var BTU = 1055.05585262;                          // 国际蒸汽表英热单位（BtuIT）精确值
  var KGCE = 29307600;                              // 1 千克标准煤 = 29 307.6 千焦
  var groups = [
    { id: 'si', tier: 'common', name: '公制' },
    { id: 'life', tier: 'common', name: '生活 · 1 度电 = 1 千瓦时' },
    { id: 'imp', tier: 'common', name: '英美' },
    { id: 'm_micro', tier: 'more', name: '微观 · 其他' },
    { id: 'm_big', tier: 'more', name: '能源 · 当量' }
  ];
  var units = [
    { id: 'j', label: '焦', group: 'si', toBase: 1, level: 'exact', source: '国际单位制（GB 3100-1993）' },
    { id: 'kj', label: '千焦', group: 'si', toBase: 1e3, level: 'exact', source: '国际单位制（GB 3100-1993）' },
    { id: 'mj', label: '兆焦', group: 'si', toBase: 1e6, level: 'exact', source: '国际单位制（GB 3100-1993）' },
    { id: 'cal', label: '卡', group: 'life', toBase: CAL, level: 'exact', source: '热化学卡 = 4.184 焦（' + NIST + '「calorieth」）' },
    { id: 'kcal', label: '千卡', group: 'life', toBase: CAL * 1000, level: 'exact', source: '即食品上说的「大卡」= 4184 焦（' + NIST + '「calorieth, kilogram (nutrition)」= 4.184×10³ 焦）' },
    { id: 'kwh', label: '千瓦时', group: 'life', toBase: 3.6e6, level: 'exact', source: '1 千瓦时（1 度电）= 3.6×10⁶ 焦（' + NIST + '）' },
    { id: 'ftlbf', label: '英尺磅力', group: 'imp', toBase: 0.3048 * 0.45359237 * 9.80665, level: 'exact', source: '= 0.3048 米 × 4.448 221 615 260 5 牛（' + NIST + ' 列 1.355 818 焦）' },
    { id: 'btu', label: '英热单位', group: 'imp', toBase: BTU, level: 'exact', source: '国际蒸汽表英热单位 BtuIT = 1055.055 852 62 焦（' + NIST + ' 列 1.055 056×10³）' },
    { id: 'therm', label: '撒姆', group: 'imp', toBase: 105480400, level: 'exact', source: '美制撒姆 = 1.054 804×10⁸ 焦（' + NIST + '「therm (U.S.)」，天然气计价用）' },
    { id: 'ev', label: '电子伏', group: 'm_micro', toBase: 1.602176634e-19, level: 'exact', source: '1 电子伏 = 1.602 176 634×10⁻¹⁹ 焦（2019 年 SI 定义的元电荷）' },
    { id: 'erg', label: '尔格', group: 'm_micro', toBase: 1e-7, level: 'exact', source: NIST + '（1 尔格 = 10⁻⁷ 焦）' },
    { id: 'wh', label: '瓦时', group: 'm_micro', toBase: 3600, level: 'exact', source: NIST + '（1 瓦时 = 3600 焦）' },
    { id: 'kgce', label: '千克标煤', group: 'm_big', toBase: KGCE, level: 'standard', source: 'GB/T 2589-2020《综合能耗计算通则》：低位发热量 29 307.6 千焦的燃料为 1 千克标准煤（按国际蒸汽表卡折算；数值来自搜索引擎对国家统计局网站一则咨询答复的摘要，原页面与标准原文都未取得）' },
    { id: 'tnt', label: '吨TNT', group: 'm_big', toBase: 4.184e9, level: 'exact', source: NIST + '「ton of TNT (energy equivalent)」= 4.184×10⁹ 焦（约定值）' },
    { id: 'tce', label: '吨标煤', group: 'm_big', toBase: KGCE * 1000, level: 'standard', source: '= 1000 千克标准煤（GB/T 2589-2020，同上）' }
  ];
  var DATA = { groups: groups, units: units, tinySci: true };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.WV_ENERGY = DATA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
