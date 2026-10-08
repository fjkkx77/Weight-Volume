/*
 * 长度换算 —— 单位表（只放数据）。基准单位：米；toBase = 1 个该单位是多少米。
 * 排版规则同斤两页：每组 3 的倍数、每行同类、每行从左到右由小到大（测试会拦）。
 * 数值核实于 2026-10-09。
 */
(function (root) {
  var SRC = {
    si: '国际单位制（GB 3100-1993）',
    nist: 'NIST SP 811 附录 B（精确值）',
    intl: '1959 国际码磅协定（1 码 = 0.9144 米，1 英尺 = 0.3048 米）',
    law1929: '1929《度量衡法》第五、六条（市尺 = 1/3 米；寸 = 1/10 尺，丈 = 10 尺，里 = 1500 尺；经维基百科「市制」条目转引）'
  };
  var AU = 149597870700;
  var groups = [
    { id: 'metric', tier: 'common', name: '公制' },
    { id: 'far', tier: 'common', name: '远距离' },
    { id: 'shi', tier: 'common', name: '市制' },
    { id: 'imp', tier: 'common', name: '英美' },
    { id: 'm_metric', tier: 'more', name: '公制' },
    { id: 'm_shi', tier: 'more', name: '市制' },
    { id: 'm_imp', tier: 'more', name: '英美旧单位' },
    { id: 'm_astro', tier: 'more', name: '天文' }
  ];
  var units = [
    // ======== 首屏常用 12 个 ========
    { id: 'mm', label: '毫米', group: 'metric', toBase: 1e-3, level: 'exact', source: SRC.si },
    { id: 'cm', label: '厘米', group: 'metric', toBase: 1e-2, level: 'exact', source: SRC.si },
    { id: 'm', label: '米', group: 'metric', toBase: 1, level: 'exact', source: SRC.si },
    // 三种「远距离」放一行：1000 < 1609.344 < 1852
    { id: 'km', label: '千米', group: 'far', toBase: 1000, level: 'exact', source: SRC.si + '（即公里）' },
    { id: 'mi', label: '英里', group: 'far', toBase: 1609.344, level: 'exact', source: '= 5280 英尺（' + SRC.nist + '；' + SRC.intl + '）' },
    { id: 'nmi', label: '海里', group: 'far', toBase: 1852, level: 'exact', source: '国务院 1984《关于在我国统一实行法定计量单位的命令》附表：1 海里 = 1852 米（只用于航程）；NIST SP 811 同值' },
    { id: 'cun', label: '寸', group: 'shi', toBase: 1 / 30, level: 'exact', source: SRC.law1929 },
    { id: 'chi', label: '尺', group: 'shi', toBase: 1 / 3, level: 'exact', source: SRC.law1929 },
    { id: 'li', label: '里', group: 'shi', toBase: 500, level: 'exact', source: SRC.law1929 + '（1 里 = 1500 尺 = 500 米）' },
    { id: 'in', label: '英寸', group: 'imp', toBase: 0.0254, level: 'exact', source: SRC.nist + '；' + SRC.intl },
    { id: 'ft', label: '英尺', group: 'imp', toBase: 0.3048, level: 'exact', source: SRC.nist + '；' + SRC.intl },
    { id: 'yd', label: '码', group: 'imp', toBase: 0.9144, level: 'exact', source: SRC.nist + '；' + SRC.intl },

    // ======== 更多 12 个 ========
    { id: 'nm', label: '纳米', group: 'm_metric', toBase: 1e-9, level: 'exact', source: SRC.si },
    { id: 'um', label: '微米', group: 'm_metric', toBase: 1e-6, level: 'exact', source: SRC.si },
    { id: 'dm', label: '分米', group: 'm_metric', toBase: 0.1, level: 'exact', source: SRC.si },
    { id: 'shi_li', label: '厘', group: 'm_shi', toBase: 1 / 3000, level: 'exact', source: SRC.law1929 + '（厘 = 1/100 寸）' },
    { id: 'shi_fen', label: '分', group: 'm_shi', toBase: 1 / 300, level: 'exact', source: SRC.law1929 + '（分 = 1/10 寸）' },
    { id: 'zhang', label: '丈', group: 'm_shi', toBase: 10 / 3, level: 'exact', source: SRC.law1929 },
    // 英美旧单位都按国际英尺推（美国 2023 年起停用测量英尺，NIST 表里按测量英尺列的值略大百万分之二）
    { id: 'fathom', label: '英寻', group: 'm_imp', toBase: 1.8288, level: 'exact', source: '= 6 英尺（按' + SRC.intl + '推导；NIST SP 811 列的是测量英尺值 1.828804 米）' },
    { id: 'rod', label: '杆', group: 'm_imp', toBase: 5.0292, level: 'exact', source: '= 16.5 英尺（按' + SRC.intl + '推导；NIST SP 811 列的是测量英尺值 5.029210 米）' },
    { id: 'furlong', label: '弗隆', group: 'm_imp', toBase: 201.168, level: 'exact', source: '= 660 英尺 = 1/8 英里（按' + SRC.intl + '推导；赛马仍在用）' },
    { id: 'au', label: '天文单位', group: 'm_astro', toBase: AU, level: 'exact', source: '国际天文学联合会 2012 年 B2 决议：1 天文单位 = 149 597 870 700 米（定义值）' },
    { id: 'ly', label: '光年', group: 'm_astro', toBase: 9460730472580800, level: 'exact', source: '光速 299 792 458 米/秒 × 儒略年 365.25 天（国际天文学联合会）；NIST SP 811 列 9.460 73×10¹⁵ 米' },
    { id: 'pc', label: '秒差距', group: 'm_astro', toBase: AU * 648000 / Math.PI, level: 'exact', source: '国际天文学联合会 2015 年 B2 决议：1 秒差距 = 648 000/π 天文单位' }
  ];
  // tinySci：极小的数写成 6.68×10⁻¹²（1 米换成天文单位、1 平方厘米换成平方千米都在 10⁻¹⁰ 量级，写 ≈0 等于没说）
  var DATA = { groups: groups, units: units, tinySci: true };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.WV_LENGTH = DATA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
