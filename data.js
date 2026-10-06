/*
 * 重量·容量换算站 —— 数据表（只放数据，不放逻辑）
 *
 * 维护约定：
 *   - 每条都必须有 source（tests/convert.test.cjs 会拦截空出处）。
 *   - 基准单位：重量 = 克，容量 = 毫升。toBase 是「1 个该单位 = 多少基准单位」。
 *   - level 取值见 levels；定义值写 exact，查不到权威来源的写 estimate，不要硬凑出处。
 *   - 数值核实于 2026-10-06，出处链接见 README「数据出处」。
 */
(function (root) {
  var SRC = {
    law1929: '1929《度量衡法》第五条「重量以公斤二分之一为市斤」「一斤分为十六两」',
    order1959: '1959 国务院《关于统一我国计量制度的命令》「一律改成十两为一斤」',
    si: '国际单位制（GB 3100-1993）',
    nist: 'NIST SP 811 附录 B.9（精确值）',
    fao: 'FAO/INFOODS Density Database v2.0',
    pack: '常见包装规格（以包装标注为准）'
  };

  var levels = {
    exact: '定义值',
    convention: '通行约定',
    standard: '标准',
    derived: '推算',
    measured: '实测数据',
    label: '包装规格',
    estimate: '经验值'
  };

  var groups = [
    { id: 'shi', name: '市制' },
    { id: 'metric_mass', name: '公制 · 重量' },
    { id: 'metric_vol', name: '公制 · 容量' },
    { id: 'kitchen', name: '厨房量具' },
    { id: 'imperial', name: '英美单位' },
    { id: 'old', name: '旧制 · 港台' }
  ];

  var units = [
    // 市制
    { id: 'jin', name: '斤', group: 'shi', kind: 'mass', toBase: 500, level: 'exact', source: SRC.law1929 + '；' + SRC.order1959 },
    { id: 'liang', name: '两', group: 'shi', kind: 'mass', toBase: 50, level: 'exact', source: SRC.order1959 + '（1 斤 = 10 两）' },
    { id: 'qian', name: '钱', group: 'shi', kind: 'mass', toBase: 5, level: 'exact', source: '1929《度量衡法》第六条（1 两 = 10 钱）+ 1959 改十两制' },
    { id: 'gongjin', name: '公斤', group: 'shi', kind: 'mass', toBase: 1000, level: 'exact', source: '公斤即千克（' + SRC.si + '）' },
    // 公制重量
    { id: 'g', name: '克', group: 'metric_mass', kind: 'mass', toBase: 1, level: 'exact', source: SRC.si },
    { id: 'kg', name: '千克', group: 'metric_mass', kind: 'mass', toBase: 1000, level: 'exact', source: SRC.si },
    { id: 't', name: '吨', group: 'metric_mass', kind: 'mass', toBase: 1e6, level: 'exact', source: SRC.si },
    // 公制容量
    { id: 'ml', name: '毫升', group: 'metric_vol', kind: 'volume', toBase: 1, level: 'exact', source: SRC.si },
    { id: 'l', name: '升', group: 'metric_vol', kind: 'volume', toBase: 1000, level: 'exact', source: SRC.si },
    { id: 'cm3', name: '立方厘米', group: 'metric_vol', kind: 'volume', toBase: 1, level: 'exact', source: SRC.si + '（1 毫升 = 1 立方厘米）' },
    { id: 'm3', name: '立方米', group: 'metric_vol', kind: 'volume', toBase: 1e6, level: 'exact', source: SRC.si },
    // 厨房量具
    { id: 'tsp_m', name: '茶匙', note: '公制', group: 'kitchen', kind: 'volume', toBase: 5, level: 'convention', source: '国际通行公制量勺 5 毫升；未查到中国统一的量勺国家标准' },
    { id: 'tbsp_m', name: '汤匙', note: '公制', group: 'kitchen', kind: 'volume', toBase: 15, level: 'convention', source: '国际通行公制量勺 15 毫升；未查到中国统一的量勺国家标准' },
    { id: 'cup_m', name: '杯', note: '公制', group: 'kitchen', kind: 'volume', toBase: 250, level: 'convention', source: '澳大利亚、新西兰、加拿大通行的公制杯 250 毫升' },
    { id: 'cup_us', name: '杯', note: '美制', group: 'kitchen', kind: 'volume', toBase: 236.5882365, level: 'exact', source: SRC.nist },
    // 英美
    { id: 'lb', name: '磅', group: 'imperial', kind: 'mass', toBase: 453.59237, level: 'exact', source: SRC.nist + '；1959 国际码磅协定' },
    { id: 'oz', name: '盎司', group: 'imperial', kind: 'mass', toBase: 28.349523125, level: 'exact', source: '1 盎司 = 1/16 磅（' + SRC.nist + '）' },
    { id: 'floz_us', name: '液量盎司', note: '美制', group: 'imperial', kind: 'volume', toBase: 29.5735295625, level: 'exact', source: '1/128 美制加仑（' + SRC.nist + '）' },
    { id: 'floz_uk', name: '液量盎司', note: '英制', group: 'imperial', kind: 'volume', toBase: 28.4130625, level: 'exact', source: '1/160 英制加仑（' + SRC.nist + '）' },
    { id: 'gal_us', name: '加仑', note: '美制', group: 'imperial', kind: 'volume', toBase: 3785.411784, level: 'exact', source: SRC.nist + '（231 立方英寸）' },
    { id: 'gal_uk', name: '加仑', note: '英制', group: 'imperial', kind: 'volume', toBase: 4546.09, level: 'exact', source: SRC.nist },
    // 旧制 · 港台
    { id: 'jin_old', name: '斤', note: '旧制 16 两', group: 'old', kind: 'mass', toBase: 500, level: 'exact', source: SRC.law1929 },
    { id: 'liang_old', name: '两', note: '旧制', group: 'old', kind: 'mass', toBase: 31.25, level: 'exact', source: SRC.law1929 + '（500 ÷ 16）' },
    { id: 'jin_tw', name: '台斤', note: '16 台两', group: 'old', kind: 'mass', toBase: 600, level: 'convention', source: '台湾市场通行 1 台斤 = 600 克（第三方资料转述，未取得官方条文原文）' },
    { id: 'jin_hk', name: '港斤', note: '16 两', group: 'old', kind: 'mass', toBase: 604.78982, level: 'exact', source: '香港《度量衡条例》第 68 章（司马斤 = 1⅓ 磅）' }
  ];

  // density：克/毫升；granular=true 表示松紧不同误差大
  var substances = [
    { id: 'water', emoji: '💧', name: '水', density: 1.0, level: 'measured', source: SRC.fao + '（常温近似）' },
    { id: 'milk', emoji: '🥛', name: '牛奶', density: 1.03, range: [1.02, 1.05], level: 'measured', source: SRC.fao },
    { id: 'oil', emoji: '🫒', name: '食用油', density: 0.92, range: [0.914, 0.927], level: 'measured', source: SRC.fao + '（玉米/花生/大豆/橄榄油）' },
    { id: 'rice', emoji: '🍚', name: '生大米', density: 0.82, range: [0.72, 0.85], granular: true, level: 'measured', source: SRC.fao },
    { id: 'flour', emoji: '🌾', name: '面粉', density: 0.58, range: [0.48, 0.67], granular: true, level: 'measured', source: SRC.fao },
    { id: 'sugar', emoji: '🍬', name: '白糖', density: 0.88, range: [0.7, 0.95], granular: true, level: 'measured', source: SRC.fao },
    { id: 'salt', emoji: '🧂', name: '食盐', density: 1.22, range: [1.22, 1.38], granular: true, level: 'measured', source: SRC.fao }
  ];

  // value：重量物品为克，容量物品为毫升；linkable=false 不参与「≈ N 个」推荐
  var items = [
    // 花生米填的是 1 克附近的空档：没有它时 1.0–1.35 克之间推荐不出任何物品（全量程扫描测试抓到）
    { id: 'peanut', emoji: '🥜', name: '花生米', unit: '粒', kind: 'mass', value: 0.8, range: [0.5, 1.0], level: 'estimate', linkable: true, source: '经验值（去壳单粒）' },
    { id: 'pingpong', emoji: '🏓', name: '乒乓球', unit: '个', kind: 'mass', value: 2.7, level: 'standard', linkable: true, source: '国际乒联规则 2.3.3：球重 2.7 克' },
    { id: 'a4', emoji: '📄', name: 'A4 纸', unit: '张', kind: 'mass', value: 4.7, range: [4.4, 5.0], level: 'derived', linkable: true, source: 'ISO 216：A4 面积 1/16 平方米 × 常见 70–80 克/平方米' },
    { id: 'coin', emoji: '🪙', name: '1 元硬币', unit: '枚', kind: 'mass', value: 6, level: 'estimate', linkable: true, source: '经验值（未查到央行公布的质量）' },
    { id: 'egg', emoji: '🥚', name: '鸡蛋', unit: '个', kind: 'mass', value: 55, range: [45, 65], level: 'standard', linkable: true, source: 'SB/T 10638-2011 鲜鸡蛋按重量分级：中号 55–60 克' },
    { id: 'banana', emoji: '🍌', name: '香蕉', unit: '根', kind: 'mass', value: 150, range: [100, 200], level: 'estimate', linkable: true, source: '经验值（带皮）' },
    { id: 'apple', emoji: '🍎', name: '苹果', unit: '个', kind: 'mass', value: 200, range: [150, 300], level: 'estimate', linkable: true, source: '经验值（中等个头）' },
    { id: 'phone', emoji: '📱', name: '智能手机', unit: '部', kind: 'mass', value: 190, range: [150, 230], level: 'estimate', linkable: true, source: '经验值（常见机型）' },
    { id: 'saltbag', emoji: '🧂', name: '一包盐', unit: '包', kind: 'mass', value: 400, level: 'label', linkable: true, source: SRC.pack },
    { id: 'ricebag', emoji: '🛍️', name: '一袋大米', unit: '袋', kind: 'mass', value: 5000, level: 'label', linkable: true, source: SRC.pack },
    { id: 'watermelon', emoji: '🍉', name: '西瓜', unit: '个', kind: 'mass', value: 5000, range: [3000, 8000], level: 'estimate', linkable: false, source: '经验值（个头差别大，只作参照）' },
    { id: 'drop', emoji: '💧', name: '一滴水', unit: '滴', kind: 'volume', value: 0.05, range: [0.03, 0.07], level: 'estimate', linkable: true, source: '常用估算 20 滴 ≈ 1 毫升，因滴管而异' },
    { id: 'milkbox', emoji: '🧃', name: '一盒牛奶', unit: '盒', kind: 'volume', value: 250, level: 'label', linkable: true, source: SRC.pack },
    { id: 'cola', emoji: '🥤', name: '一罐可乐', unit: '罐', kind: 'volume', value: 330, level: 'label', linkable: true, source: SRC.pack },
    { id: 'bottle', emoji: '🧴', name: '一瓶矿泉水', unit: '瓶', kind: 'volume', value: 550, level: 'label', linkable: true, source: SRC.pack },
    { id: 'oilbucket', emoji: '🛢️', name: '一桶食用油', unit: '桶', kind: 'volume', value: 5000, level: 'label', linkable: true, source: SRC.pack },
    { id: 'waterjug', emoji: '🚰', name: '一桶桶装水', unit: '桶', kind: 'volume', value: 18900, level: 'label', linkable: true, source: SRC.pack }
  ];

  var tips = [
    { text: '一斤 = 十两 = 500 克', detail: '所以一两 = 50 克，差不多一个鸡蛋。', source: SRC.law1929 + '；' + SRC.order1959 },
    { text: '1 升水 ≈ 1 千克 = 2 斤', detail: '水的密度约 1 克/毫升，一瓶 550 毫升矿泉水大约 1.1 斤。', source: SRC.fao },
    { text: '「半斤八两」', detail: '旧制一斤是十六两，半斤正好八两，所以两者一样重。1959 年后大陆改成十两一斤。', source: SRC.law1929 + '；' + SRC.order1959 },
    { text: '1 磅 ≈ 0.9 斤', detail: '1 磅 = 453.59237 克，比一斤（500 克）稍轻。', source: SRC.nist },
    { text: '港斤、台斤比大陆的斤重', detail: '港斤 ≈ 604.8 克，台斤 = 600 克，都比 500 克的市斤重约两成。', source: '香港《度量衡条例》第 68 章；台湾市场通行值' }
  ];

  var WV_DATA = { levels: levels, groups: groups, units: units, substances: substances, items: items, tips: tips };
  if (typeof module !== 'undefined' && module.exports) module.exports = WV_DATA;
  else root.WV_DATA = WV_DATA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
