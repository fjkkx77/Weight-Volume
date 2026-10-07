/*
 * 重量·容量换算站 —— 数据表（只放数据，不放逻辑）
 *
 * 维护约定：
 *   - 每条都必须有 source（tests/convert.test.cjs 会拦截空出处）。
 *   - 基准单位：重量 = 克，容量 = 毫升。toBase 是「1 个该单位 = 多少基准单位」。
 *   - units 的顺序就是页面上的格子顺序；首屏常用组每组 3 的倍数个，3 列网格才排得整齐。
 *   - 物品只收「有标准规定」或「包装上印着标称值」的，不收经验估计（用户 2026-10-07 定：避免歧义）。
 *   - 数值核实于 2026-10-06，出处链接见 README「数据出处」。
 */
(function (root) {
  var SRC = {
    law1929: '1929《度量衡法》第五条「重量以公斤二分之一为市斤」「一斤分为十六两」',
    order1959: '1959 国务院《关于统一我国计量制度的命令》「一律改成十两为一斤」',
    si: '国际单位制（GB 3100-1993）',
    nist: 'NIST SP 811 附录 B.9（精确值）',
    fao: 'FAO/INFOODS Density Database v2.0',
    pack: '包装标称规格'
  };

  var levels = {
    exact: '定义值',
    convention: '通行约定',
    standard: '标准规定',
    derived: '按标准推算',
    measured: '实测数据',
    label: '包装标称'
  };

  // tier: 'common' 首屏常用（必须一屏看全，每组 3 的倍数个）；'more' 收在「更多单位」里
  // 2026-10-07：先改版成 4 组 21 个一屏看全；同日用户要求「涵盖全面」（点名立方分米、立方厘米），
  // 扩到 57 个，选了「常用首屏 + 更多折叠」
  var groups = [
    { id: 'shi', tier: 'common', name: '市制 · 公制', composite: 'jin' },
    { id: 'vol', tier: 'common', name: '容量' },
    { id: 'imperial', tier: 'common', name: '英美' },
    { id: 'old', tier: 'common', name: '港台 · 旧制', composite: 'jin_old' },
    { id: 'm_shi', tier: 'more', name: '市制重量' },
    { id: 'm_metric', tier: 'more', name: '公制重量' },
    { id: 'm_imp_mass', tier: 'more', name: '英美重量' },
    { id: 'm_old', tier: 'more', name: '港台 · 旧制' },
    { id: 'm_vol', tier: 'more', name: '公制容量' },
    { id: 'm_shi_vol', tier: 'more', name: '市制容量' },
    { id: 'm_kitchen', tier: 'more', name: '厨房量具' },
    { id: 'm_imp_vol', tier: 'more', name: '英美容量' }
  ];

  // label：格子里显示的短名（320 宽下最多 5 个字）
  var units = [
    // —— 首屏常用 21 个 ——
    { id: 'jin', label: '斤', group: 'shi', kind: 'mass', toBase: 500, level: 'exact', source: SRC.law1929 + '；' + SRC.order1959 },
    { id: 'liang', label: '两', group: 'shi', kind: 'mass', toBase: 50, level: 'exact', source: SRC.order1959 + '（1 斤 = 10 两）' },
    { id: 'qian', label: '钱', group: 'shi', kind: 'mass', toBase: 5, level: 'exact', source: '1929《度量衡法》第六条（1 两 = 10 钱）+ 1959 改十两制' },
    { id: 'g', label: '克', group: 'shi', kind: 'mass', toBase: 1, level: 'exact', source: SRC.si },
    { id: 'kg', label: '千克', group: 'shi', kind: 'mass', toBase: 1000, level: 'exact', source: SRC.si + '（即公斤）' },
    { id: 't', label: '吨', group: 'shi', kind: 'mass', toBase: 1e6, level: 'exact', source: SRC.si },

    { id: 'ml', label: '毫升', group: 'vol', kind: 'volume', toBase: 1, level: 'exact', source: SRC.si },
    { id: 'l', label: '升', group: 'vol', kind: 'volume', toBase: 1000, level: 'exact', source: SRC.si },
    { id: 'm3', label: '立方米', group: 'vol', kind: 'volume', toBase: 1e6, level: 'exact', source: SRC.si },
    { id: 'cm3', label: '立方厘米', group: 'vol', kind: 'volume', toBase: 1, level: 'exact', source: SRC.si + '（1 立方厘米 = 1 毫升）' },
    { id: 'dm3', label: '立方分米', group: 'vol', kind: 'volume', toBase: 1000, level: 'exact', source: SRC.si + '（1 立方分米 = 1 升）' },
    { id: 'tbsp_m', label: '汤匙', group: 'vol', kind: 'volume', toBase: 15, level: 'convention', source: '国际通行公制量勺 15 毫升；未查到中国统一的量勺国家标准' },

    { id: 'lb', label: '磅', group: 'imperial', kind: 'mass', toBase: 453.59237, level: 'exact', source: SRC.nist + '；1959 国际码磅协定' },
    { id: 'oz', label: '盎司', group: 'imperial', kind: 'mass', toBase: 28.349523125, level: 'exact', source: '1 盎司 = 1/16 磅（' + SRC.nist + '）' },
    { id: 'cup_us', label: '美制杯', group: 'imperial', kind: 'volume', toBase: 236.5882365, level: 'exact', source: SRC.nist },
    { id: 'floz_us', label: '美制液盎司', group: 'imperial', kind: 'volume', toBase: 29.5735295625, level: 'exact', source: '1/128 美制加仑（' + SRC.nist + '）' },
    { id: 'gal_us', label: '美制加仑', group: 'imperial', kind: 'volume', toBase: 3785.411784, level: 'exact', source: SRC.nist + '（231 立方英寸）' },
    { id: 'gal_uk', label: '英制加仑', group: 'imperial', kind: 'volume', toBase: 4546.09, level: 'exact', source: SRC.nist },

    { id: 'jin_tw', label: '台斤', group: 'old', kind: 'mass', toBase: 600, level: 'convention', source: '台湾市场通行 1 台斤 = 600 克（第三方资料转述，未取得官方条文原文）' },
    { id: 'jin_hk', label: '港斤', group: 'old', kind: 'mass', toBase: 604.78982, level: 'exact', source: '香港《度量衡条例》第 68 章（司马斤 = 1⅓ 磅）' },
    { id: 'liang_old', label: '旧制两', group: 'old', kind: 'mass', toBase: 31.25, level: 'exact', source: SRC.law1929 + '（500 ÷ 16）' },

    // —— 更多单位 36 个 ——
    { id: 'dan', label: '担', group: 'm_shi', kind: 'mass', toBase: 50000, level: 'exact', source: '1929《度量衡法》第六条「担：等于百斤」× 市斤 500 克' },
    { id: 'fen', label: '分', group: 'm_shi', kind: 'mass', toBase: 0.5, level: 'convention', source: '1929《度量衡法》第六条各级十进（钱 = 10 分）；1959 改十两制后按十进推得 1 分 = 0.5 克' },
    { id: 'li', label: '厘', group: 'm_shi', kind: 'mass', toBase: 0.05, level: 'convention', source: '1929《度量衡法》第六条（分 = 10 厘）；1959 改十两制后按十进推得 1 厘 = 0.05 克' },

    { id: 'mg', label: '毫克', group: 'm_metric', kind: 'mass', toBase: 1e-3, level: 'exact', source: SRC.si },
    { id: 'ug', label: '微克', group: 'm_metric', kind: 'mass', toBase: 1e-6, level: 'exact', source: SRC.si },
    { id: 'ct', label: '克拉', group: 'm_metric', kind: 'mass', toBase: 0.2, level: 'exact', source: '公制克拉 = 200 毫克（' + SRC.nist + '）' },

    { id: 'dr', label: '打兰', group: 'm_imp_mass', kind: 'mass', toBase: 1.7718451953125, level: 'exact', source: '常衡打兰 = 1/16 盎司（由 ' + SRC.nist + ' 的盎司定义推导）' },
    { id: 'gr', label: '格令', group: 'm_imp_mass', kind: 'mass', toBase: 0.06479891, level: 'exact', source: SRC.nist },
    { id: 'ozt', label: '金衡盎司', group: 'm_imp_mass', kind: 'mass', toBase: 31.1034768, level: 'exact', source: '= 480 格令（由 ' + SRC.nist + ' 的格令推导；NIST 表中列为 31.10348 克）' },
    { id: 'lbt', label: '金衡磅', group: 'm_imp_mass', kind: 'mass', toBase: 373.2417216, level: 'exact', source: '= 12 金衡盎司（由 ' + SRC.nist + ' 推导）' },
    { id: 'st', label: '英石', group: 'm_imp_mass', kind: 'mass', toBase: 6350.29318, level: 'exact', source: '= 14 磅（由 ' + SRC.nist + ' 的磅定义推导）' },
    { id: 'ton_s', label: '短吨', group: 'm_imp_mass', kind: 'mass', toBase: 907184.74, level: 'exact', source: '= 2000 磅（' + SRC.nist + '）' },
    { id: 'ton_l', label: '长吨', group: 'm_imp_mass', kind: 'mass', toBase: 1016046.9088, level: 'exact', source: '= 2240 磅（' + SRC.nist + '）' },

    { id: 'liang_tw', label: '台两', group: 'm_old', kind: 'mass', toBase: 37.5, level: 'convention', source: '台斤 ÷ 16（台斤为台湾市场通行值，第三方资料转述）' },
    { id: 'liang_hk', label: '港两', group: 'm_old', kind: 'mass', toBase: 37.79936375, level: 'exact', source: '港斤 ÷ 16（香港《度量衡条例》第 68 章）' },
    { id: 'qian_old', label: '旧制钱', group: 'm_old', kind: 'mass', toBase: 3.125, level: 'exact', source: SRC.law1929 + '（旧制两 ÷ 10）' },

    { id: 'dl', label: '分升', group: 'm_vol', kind: 'volume', toBase: 100, level: 'exact', source: SRC.si },
    { id: 'cl', label: '厘升', group: 'm_vol', kind: 'volume', toBase: 10, level: 'exact', source: SRC.si },
    { id: 'mm3', label: '立方毫米', group: 'm_vol', kind: 'volume', toBase: 1e-3, level: 'exact', source: SRC.si },
    { id: 'ul', label: '微升', group: 'm_vol', kind: 'volume', toBase: 1e-3, level: 'exact', source: SRC.si + '（1 微升 = 1 立方毫米）' },

    { id: 'shi_dan', label: '石', group: 'm_shi_vol', kind: 'volume', toBase: 1e5, level: 'exact', source: '1929《度量衡法》第五、六条（市升 = 公升，石 = 100 升）' },
    { id: 'dou', label: '斗', group: 'm_shi_vol', kind: 'volume', toBase: 1e4, level: 'exact', source: '1929《度量衡法》第五、六条（斗 = 10 升）' },
    { id: 'shi_l', label: '市升', group: 'm_shi_vol', kind: 'volume', toBase: 1000, level: 'exact', source: '1929《度量衡法》第五条（以公升为市升）' },
    { id: 'ge', label: '合', group: 'm_shi_vol', kind: 'volume', toBase: 100, level: 'exact', source: '1929《度量衡法》第六条（合 = 1/10 升）' },
    { id: 'shao', label: '勺', group: 'm_shi_vol', kind: 'volume', toBase: 10, level: 'exact', source: '1929《度量衡法》第六条（勺 = 1/100 升）' },
    { id: 'cuo', label: '撮', group: 'm_shi_vol', kind: 'volume', toBase: 1, level: 'exact', source: '1929《度量衡法》第六条（撮 = 1/1000 升）' },

    { id: 'tsp_m', label: '茶匙', group: 'm_kitchen', kind: 'volume', toBase: 5, level: 'convention', source: '国际通行公制量勺 5 毫升；未查到中国统一的量勺国家标准' },
    { id: 'cup_m', label: '公制杯', group: 'm_kitchen', kind: 'volume', toBase: 250, level: 'convention', source: '澳大利亚、新西兰、加拿大通行的公制杯 250 毫升' },
    { id: 'tsp_us', label: '美制茶匙', group: 'm_kitchen', kind: 'volume', toBase: 4.92892159375, level: 'exact', source: '= 1/6 美制液盎司（' + SRC.nist + '）' },
    { id: 'tbsp_us', label: '美制汤匙', group: 'm_kitchen', kind: 'volume', toBase: 14.78676478125, level: 'exact', source: '= 1/2 美制液盎司（' + SRC.nist + '）' },

    { id: 'pt_us', label: '美制品脱', group: 'm_imp_vol', kind: 'volume', toBase: 473.176473, level: 'exact', source: '= 1/8 美制加仑（由 ' + SRC.nist + ' 推导）' },
    { id: 'qt_us', label: '美制夸脱', group: 'm_imp_vol', kind: 'volume', toBase: 946.352946, level: 'exact', source: '= 1/4 美制加仑（由 ' + SRC.nist + ' 推导）' },
    { id: 'floz_uk', label: '英制液盎司', group: 'm_imp_vol', kind: 'volume', toBase: 28.4130625, level: 'exact', source: '= 1/160 英制加仑（由 ' + SRC.nist + ' 推导）' },
    { id: 'pt_uk', label: '英制品脱', group: 'm_imp_vol', kind: 'volume', toBase: 568.26125, level: 'exact', source: '= 1/8 英制加仑（由 ' + SRC.nist + ' 推导）' },
    { id: 'in3', label: '立方英寸', group: 'm_imp_vol', kind: 'volume', toBase: 16.387064, level: 'exact', source: '= 2.54³ 立方厘米（英寸为 2.54 厘米，' + SRC.nist + '）' },
    { id: 'ft3', label: '立方英尺', group: 'm_imp_vol', kind: 'volume', toBase: 28316.846592, level: 'exact', source: '= 1728 立方英寸（由 ' + SRC.nist + ' 推导）' }
  ];

  // density：克/毫升；granular=true 表示松紧不同误差大
  var substances = [
    { id: 'water', name: '水', density: 1.0, level: 'measured', source: SRC.fao + '（常温近似）' },
    { id: 'milk', name: '牛奶', density: 1.03, range: [1.02, 1.05], level: 'measured', source: SRC.fao },
    { id: 'oil', name: '食用油', density: 0.92, range: [0.914, 0.927], level: 'measured', source: SRC.fao + '（玉米/花生/大豆/橄榄油）' },
    { id: 'rice', name: '生大米', density: 0.82, range: [0.72, 0.85], granular: true, level: 'measured', source: SRC.fao },
    { id: 'flour', name: '面粉', density: 0.58, range: [0.48, 0.67], granular: true, level: 'measured', source: SRC.fao },
    { id: 'sugar', name: '白糖', density: 0.88, range: [0.7, 0.95], granular: true, level: 'measured', source: SRC.fao },
    { id: 'salt', name: '食盐', density: 1.22, range: [1.22, 1.38], granular: true, level: 'measured', source: SRC.fao }
  ];

  // 只收标准规定或包装标称（见文件头）。value：重量物品为克，容量物品为毫升
  var items = [
    { id: 'pingpong', emoji: '🏓', name: '乒乓球', unit: '个', kind: 'mass', value: 2.7, level: 'standard', source: '国际乒联规则 2.3.3：球重 2.7 克' },
    { id: 'a4', emoji: '📄', name: 'A4 纸（80 克规格）', unit: '张', kind: 'mass', value: 4.99, level: 'derived', source: 'ISO 216：A4 为 210×297 毫米，× 80 克/平方米 = 4.99 克' },
    { id: 'saltbag', emoji: '🧂', name: '一包盐', unit: '包', kind: 'mass', value: 400, level: 'label', source: SRC.pack },
    { id: 'ricebag', emoji: '🛍️', name: '一袋大米', unit: '袋', kind: 'mass', value: 5000, level: 'label', source: SRC.pack },
    { id: 'milkbox', emoji: '🧃', name: '一盒牛奶', unit: '盒', kind: 'volume', value: 250, level: 'label', source: SRC.pack },
    { id: 'cola', emoji: '🥤', name: '一罐可乐', unit: '罐', kind: 'volume', value: 330, level: 'label', source: SRC.pack },
    { id: 'bottle', emoji: '🧴', name: '一瓶矿泉水', unit: '瓶', kind: 'volume', value: 550, level: 'label', source: SRC.pack },
    { id: 'oilbucket', emoji: '🛢️', name: '一桶食用油', unit: '桶', kind: 'volume', value: 5000, level: 'label', source: SRC.pack },
    { id: 'waterjug', emoji: '🚰', name: '一桶桶装水', unit: '桶', kind: 'volume', value: 18900, level: 'label', source: SRC.pack }
  ];

  var WV_DATA = { levels: levels, groups: groups, units: units, substances: substances, items: items };
  if (typeof module !== 'undefined' && module.exports) module.exports = WV_DATA;
  else root.WV_DATA = WV_DATA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
