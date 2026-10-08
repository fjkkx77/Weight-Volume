/*
 * 温度换算 —— 单位表（只放数据）。基准：摄氏度。温度带偏移，不能乘倍数，所以每个单位给 to / from 两个函数：
 *   to(v)：这个单位的读数 v 是多少摄氏度；from(c)：c 摄氏度在这个单位下读多少。
 * 温度单位之间没有「谁大谁小」，排版不判从小到大（noOrder）。数值核实于 2026-10-09。
 */
(function (root) {
  var NIST = 'NIST SP 811 附录 B.8 / B.9';
  var groups = [
    { id: 'main', tier: 'common', name: '常用' },
    // 用户 2026-10-09 选：凑满一行，收两个历史单位并标出来
    { id: 'm_more', tier: 'more', name: '兰氏 · 历史单位', note: '列氏、罗氏已不使用' }
  ];
  var units = [
    { id: 'c', label: '摄氏度', group: 'main', to: function (v) { return v; }, from: function (c) { return c; },
      level: 'exact', source: '国际单位制（GB 3100-1993）：t/℃ = T/K − 273.15' },
    { id: 'f', label: '华氏度', group: 'main', to: function (v) { return (v - 32) / 1.8; }, from: function (c) { return c * 1.8 + 32; },
      level: 'exact', source: NIST + '：t/℃ = (t/℉ − 32)/1.8' },
    { id: 'k', label: '开尔文', group: 'main', to: function (v) { return v - 273.15; }, from: function (c) { return c + 273.15; },
      level: 'exact', source: '国际单位制（GB 3100-1993）；' + NIST + '：T/K = t/℃ + 273.15' },
    { id: 'r', label: '兰氏度', group: 'm_more', to: function (v) { return v / 1.8 - 273.15; }, from: function (c) { return (c + 273.15) * 1.8; },
      level: 'exact', source: NIST + '：T/K = (T/°R)/1.8（绝对零度为 0，刻度与华氏度相同）' },
    { id: 're', label: '列氏度', group: 'm_more', to: function (v) { return v * 1.25; }, from: function (c) { return c * 0.8; },
      level: 'historical', source: '列氏温标定义：水的冰点 0 °Ré、沸点 80 °Ré（18 世纪欧洲使用，现已不用；按定义换算，经维基百科「列氏温标」转引）' },
    { id: 'ro', label: '罗氏度', group: 'm_more', to: function (v) { return (v - 7.5) * 40 / 21; }, from: function (c) { return c * 21 / 40 + 7.5; },
      level: 'historical', source: '罗氏温标定义：水的冰点 7.5 °Rø、沸点 60 °Rø（18 世纪丹麦使用，现已不用；按定义换算，经维基百科「罗氏温标」转引）' }
  ];
  var DATA = { groups: groups, units: units, noOrder: true, signed: true,
    // 低于绝对零度的读数不存在：起点格标红，其他格不算
    validate: function (c) { return c < -273.15 - 1e-9 ? '低于绝对零度（−273.15 ℃ = −459.67 ℉ = 0 K），这个温度不存在' : null; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.WV_TEMPERATURE = DATA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
