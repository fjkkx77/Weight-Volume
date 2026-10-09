/*
 * 速度换算 —— 单位表（只放数据）。基准单位：米/秒。数值核实于 2026-10-09。
 * 排版规则同斤两页：每组 3 的倍数、每行同类、每行从左到右由小到大（测试会拦）。
 */
(function (root) {
  var NIST = 'NIST SP 811 附录 B.9';
  var groups = [
    { id: 'si', tier: 'common', name: '公制' },
    { id: 'imp', tier: 'common', name: '英美 · 航海' },
    { id: 'm_other', tier: 'more', name: '其他' }
  ];
  var units = [
    { id: 'kmh', label: '千米/时', group: 'si', toBase: 1000 / 3600, level: 'exact', source: '= 1000 米 ÷ 3600 秒（国际单位制 GB 3100-1993；' + NIST + ' 列 0.277 777 8）' },
    { id: 'ms', label: '米/秒', group: 'si', toBase: 1, level: 'exact', source: '国际单位制（GB 3100-1993）' },
    { id: 'kms', label: '千米/秒', group: 'si', toBase: 1000, level: 'exact', source: '国际单位制（GB 3100-1993）' },
    { id: 'fts', label: '英尺/秒', group: 'imp', toBase: 0.3048, level: 'exact', source: NIST + '（1 英尺 = 0.3048 米）' },
    { id: 'mph', label: '英里/时', group: 'imp', toBase: 0.44704, level: 'exact', source: NIST + '（1 英里 = 1609.344 米）' },
    { id: 'kn', label: '节', group: 'imp', toBase: 1852 / 3600, level: 'exact', source: '1 节 = 1 海里/时 = 1852/3600 米/秒（国务院 1984《关于在我国统一实行法定计量单位的命令》附表，只用于航行；' + NIST + ' 列 0.514 444 4）' },
    { id: 'cms', label: '厘米/秒', group: 'm_other', toBase: 0.01, level: 'exact', source: '国际单位制（GB 3100-1993）' },
    { id: 'mmin', label: '米/分', group: 'm_other', toBase: 1 / 60, level: 'exact', source: '国际单位制（GB 3100-1993）' },
    { id: 'c', label: '光速', group: 'm_other', toBase: 299792458, level: 'exact', source: '真空中光速 299 792 458 米/秒（国际单位制定义常数，2019 年 SI 修订）' }
  ];
  var DATA = { groups: groups, units: units, tinySci: true };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.WV_SPEED = DATA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
