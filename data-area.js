/*
 * 面积换算 —— 单位表（只放数据）。基准单位：平方米；toBase = 1 个该单位是多少平方米。
 * 排版规则同斤两页：每组 3 的倍数、每行同类、每行从左到右由小到大（测试会拦）。
 * 数值核实于 2026-10-09。
 */
(function (root) {
  var SRC = {
    si: '国际单位制（GB 3100-1993）',
    nist: 'NIST SP 811 附录 B',
    intl: '1959 国际码磅协定（1 英尺 = 0.3048 米）',
    law1929: '1929《度量衡法》第五、六条（市尺 = 1/3 米；地积以 6000 平方尺为亩，亩 = 10 分，顷 = 100 亩；经维基百科「市制」条目转引）',
    tw: '台湾民间通行（坪 = 6 台尺见方，台尺 = 10/33 米，与日本「坪」相同；甲 = 2934 坪，分 = 1/10 甲）。官方文件一律用平方米，未取得官方条文，第三方资料转述'
  };
  var MU = 2000 / 3, PING = 400 / 121, FT2 = 0.09290304;
  var groups = [
    { id: 'metric', tier: 'common', name: '公制' },
    { id: 'land', tier: 'common', name: '公制 · 土地' },
    { id: 'shi', tier: 'common', name: '市制' },
    { id: 'imp', tier: 'common', name: '英美' },
    { id: 'm_shi', tier: 'more', name: '市制' },
    { id: 'm_imp', tier: 'more', name: '英美' },
    { id: 'm_tw', tier: 'more', name: '台湾', note: '民间通行' }
  ];
  var units = [
    // ======== 首屏常用 12 个 ========
    { id: 'cm2', label: '平方厘米', group: 'metric', toBase: 1e-4, level: 'exact', source: SRC.si },
    { id: 'dm2', label: '平方分米', group: 'metric', toBase: 1e-2, level: 'exact', source: SRC.si },
    { id: 'm2', label: '平方米', group: 'metric', toBase: 1, level: 'exact', source: SRC.si },
    { id: 'are', label: '公亩', group: 'land', toBase: 100, level: 'exact', source: '= 100 平方米（' + SRC.nist + '）' },
    { id: 'ha', label: '公顷', group: 'land', toBase: 1e4, level: 'exact', source: '= 10 000 平方米（' + SRC.nist + '）' },
    { id: 'km2', label: '平方千米', group: 'land', toBase: 1e6, level: 'exact', source: SRC.si + '（即平方公里）' },
    { id: 'mu_fen', label: '分', group: 'shi', toBase: MU / 10, level: 'exact', source: SRC.law1929 + '（1 分 = 1/10 亩 ≈ 66.67 平方米）' },
    { id: 'mu', label: '亩', group: 'shi', toBase: MU, level: 'exact', source: SRC.law1929 + '（1 亩 = 2000/3 ≈ 666.67 平方米）' },
    { id: 'qing', label: '顷', group: 'shi', toBase: MU * 100, level: 'exact', source: SRC.law1929 + '（1 顷 = 100 亩）' },
    { id: 'ft2', label: '平方英尺', group: 'imp', toBase: FT2, level: 'exact', source: SRC.nist + '；' + SRC.intl },
    { id: 'yd2', label: '平方码', group: 'imp', toBase: 0.83612736, level: 'exact', source: '= 9 平方英尺（' + SRC.nist + '）' },
    { id: 'acre', label: '英亩', group: 'imp', toBase: 43560 * FT2, level: 'exact', source: '= 43 560 平方英尺（按' + SRC.intl + '推导 = 4046.856 422 4 平方米；NIST SP 811 列的是按测量英尺的 4046.873）' },

    // ======== 更多 9 个 ========
    { id: 'cun2', label: '平方寸', group: 'm_shi', toBase: 1 / 900, level: 'exact', source: SRC.law1929 },
    { id: 'chi2', label: '平方尺', group: 'm_shi', toBase: 1 / 9, level: 'exact', source: SRC.law1929 },
    { id: 'zhang2', label: '平方丈', group: 'm_shi', toBase: 100 / 9, level: 'exact', source: SRC.law1929 + '（1 亩 = 60 平方丈）' },
    { id: 'in2', label: '平方英寸', group: 'm_imp', toBase: 6.4516e-4, level: 'exact', source: SRC.nist },
    { id: 'rod2', label: '平方杆', group: 'm_imp', toBase: 5.0292 * 5.0292, level: 'exact', source: '= 272.25 平方英尺 = 1/160 英亩（按' + SRC.intl + '推导）' },
    { id: 'mi2', label: '平方英里', group: 'm_imp', toBase: 1609.344 * 1609.344, level: 'exact', source: '= 640 英亩（' + SRC.nist + '）' },
    { id: 'ping', label: '坪', group: 'm_tw', toBase: PING, level: 'convention', source: SRC.tw + '（1 坪 = 400/121 ≈ 3.3058 平方米）' },
    { id: 'tw_fen', label: '台分', group: 'm_tw', toBase: PING * 293.4, level: 'convention', source: SRC.tw + '（1 分 = 293.4 坪）' },
    { id: 'jia', label: '甲', group: 'm_tw', toBase: PING * 2934, level: 'convention', source: SRC.tw + '（1 甲 = 2934 坪 ≈ 9699.17 平方米）' }
  ];
  // tinySci：极小的数写成 6.68×10⁻¹²（1 米换成天文单位、1 平方厘米换成平方千米都在 10⁻¹⁰ 量级，写 ≈0 等于没说）
  var DATA = { groups: groups, units: units, tinySci: true };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.WV_AREA = DATA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
