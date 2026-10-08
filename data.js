/*
 * 重量·容量换算站 —— 数据表（只放数据，不放逻辑）
 *
 * 维护约定：
 *   - 每条都必须有 source（tests/convert.test.cjs 会拦截空出处）。
 *   - 基准单位：重量 = 克，容量 = 毫升。toBase 是「1 个该单位 = 多少基准单位」。
 *   - units 的顺序就是页面上的格子顺序；每 3 个一行，一行必须是同一类（排版规则见 groups 上方注释）。
 *   - 物品只收「有标准规定」或「包装上印着标称值」的，不收经验估计（用户 2026-10-07 定：避免歧义）；
 *     唯一例外是人民币（央行不公布克重，用户 2026-10-08 同意用第三方称量并标明非官方；硬币 2026-10-09 同样处理）。
 *   - 原来的「生活参照」items 表 2026-10-08 并进了物品格（units 里 tier 为 items 的那些），不再单独存一份。
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
    label: '包装标称',
    unofficial: '非官方实测'   // 人民币纸币和硬币：央行只公布尺寸、不公布克重（用户 2026-10-08 选「放，但标明非官方」，硬币 10-09 同样选）
  };

  // 人民币纸币：只有 100 元的「约 1.15 克」流传较广（第三方称量，央行未公布），
  // 其他面值网上说法互相对不上，改为按央行公布的票面尺寸、与 100 元同纸张按面积比推算
  var RMB100_G = 1.15, RMB100_AREA = 155 * 77;
  function rmb(w, h) { return RMB100_G * w * h / RMB100_AREA; }
  var A4_G = 0.21 * 0.297 * 80;   // 一张 80 克 A4 = 4.9896 克
  var RMB_SRC = '中国人民银行公告公布的票面尺寸；单张克重央行未公布，按 100 元约 1.15 克（第三方称量）× 面积比推算';
  var COIN_SRC = '2019 年版第五套人民币，重量取钱币目录 Numista / uCoin / Numisquare 三家一致的记载值；中国人民银行公告只公布直径和材质、未公布重量';
  var COIN_FEN_SRC = '铝分币，重量取钱币目录 Numista 的记载值（只核到这一家）；中国人民银行未公布重量';

  // tier: 'common' 首屏常用（必须一屏看全）；'more' 收在「更多单位」里。
  // 排版规则（用户 2026-10-07：「尽量把一类的放一起……我有强迫症请你好好排版规整一下」）：
  //   - 每组都是 3 的倍数个，units 的顺序就是格子顺序，**每 3 个一行，一行必须是同一类**
  //   - 每一行从左到右由小到大（用户 2026-10-07：「便于我查看」）；同组上下行的同一列尽量对应（旧 | 台 | 港、茶匙 | 汤匙 | 杯、液盎司 | 品脱 | 夸脱）
  //   - 为了排满补了 6 个同族单位：旧制斤、台钱、港钱、石油桶、英制夸脱、立方码（57 → 63）
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
    { id: 'm_imp_vol', tier: 'more', name: '英美容量' },
    // tier 'items'：生活物品，按个数/张数输入（用户 2026-10-08：「输入 xxx 张 A4 纸后其他各个单位显示多重」），单独一张卡紧跟换算卡
    // tier 'items'：生活物品，按件数输入（用户 2026-10-08：「输入 xxx 张 A4 纸后其他各个单位显示多重」），单独一张卡紧跟换算卡。
    // 标题里写出每一列按什么规格算（审查发现规格只藏在底部小字里，瓶装水 550/555/570 毫升都有，会有歧义）
    { id: 'i_daily', tier: 'items', name: '日用 · 2.7 克 / 4.99 克 / 61 克' },
    { id: 'i_rmb', tier: 'items', name: '人民币纸币', note: '非官方实测' },
    // 硬币（用户 2026-10-08 要求补上）：上行分币、下行现行 2019 版，标题写明版别，避免和老版 1 元（6.1 克）混淆
    { id: 'i_coin', tier: 'items', name: '硬币 · 分币 / 2019 版', note: '非官方实测' },
    { id: 'i_drink', tier: 'items', name: '饮料 · 250 / 330 / 550 毫升' },
    { id: 'i_pack1', tier: 'items', name: '大包装 · 400 克 / 500 张 / 5 升' },
    { id: 'i_pack2', tier: 'items', name: '大包装 · 5 千克 / 18.9 升 / 50 千克' }
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
  function dens(id) { return substances.filter(function (x) { return x.id === id; })[0].density; }

  // label：格子里显示的短名（320 宽下最多 5 个字）
  var units = [
    // ======== 首屏常用 21 个（7 行），每行从左到右由小到大 ========
    // 市制：钱 两 斤
    { id: 'qian', label: '钱', group: 'shi', kind: 'mass', toBase: 5, level: 'exact', source: '1929《度量衡法》第六条（1 两 = 10 钱）+ 1959 改十两制' },
    { id: 'liang', label: '两', group: 'shi', kind: 'mass', toBase: 50, level: 'exact', source: SRC.order1959 + '（1 斤 = 10 两）' },
    { id: 'jin', label: '斤', group: 'shi', kind: 'mass', toBase: 500, level: 'exact', source: SRC.law1929 + '；' + SRC.order1959 },
    // 公制：克 千克 吨
    { id: 'g', label: '克', group: 'shi', kind: 'mass', toBase: 1, level: 'exact', source: SRC.si },
    { id: 'kg', label: '千克', group: 'shi', kind: 'mass', toBase: 1000, level: 'exact', source: SRC.si + '（即公斤）' },
    { id: 't', label: '吨', group: 'shi', kind: 'mass', toBase: 1e6, level: 'exact', source: SRC.si },
    // 立方：立方厘米 立方分米 立方米（用户点名放一行）
    { id: 'cm3', label: '立方厘米', group: 'vol', kind: 'volume', toBase: 1, level: 'exact', source: SRC.si + '（1 立方厘米 = 1 毫升）' },
    { id: 'dm3', label: '立方分米', group: 'vol', kind: 'volume', toBase: 1000, level: 'exact', source: SRC.si + '（1 立方分米 = 1 升）' },
    { id: 'm3', label: '立方米', group: 'vol', kind: 'volume', toBase: 1e6, level: 'exact', source: SRC.si },
    // 升：毫升 分升 升（与上一行同列对应：立方厘米 = 毫升，立方分米 = 升）
    { id: 'ml', label: '毫升', group: 'vol', kind: 'volume', toBase: 1, level: 'exact', source: SRC.si },
    { id: 'dl', label: '分升', group: 'vol', kind: 'volume', toBase: 100, level: 'exact', source: SRC.si },
    { id: 'l', label: '升', group: 'vol', kind: 'volume', toBase: 1000, level: 'exact', source: SRC.si },
    // 英美常衡：打兰 盎司 磅（每级 ×16）
    { id: 'dr', label: '打兰', group: 'imperial', kind: 'mass', toBase: 1.7718451953125, level: 'exact', source: '常衡打兰 = 1/16 盎司（由 ' + SRC.nist + ' 的盎司定义推导）' },
    { id: 'oz', label: '盎司', group: 'imperial', kind: 'mass', toBase: 28.349523125, level: 'exact', source: '1 盎司 = 1/16 磅（' + SRC.nist + '）' },
    { id: 'lb', label: '磅', group: 'imperial', kind: 'mass', toBase: 453.59237, level: 'exact', source: SRC.nist + '；1959 国际码磅协定' },
    // 加仑 · 桶
    { id: 'gal_us', label: '美制加仑', group: 'imperial', kind: 'volume', toBase: 3785.411784, level: 'exact', source: SRC.nist + '（231 立方英寸）' },
    { id: 'gal_uk', label: '英制加仑', group: 'imperial', kind: 'volume', toBase: 4546.09, level: 'exact', source: SRC.nist },
    { id: 'bbl', label: '石油桶', group: 'imperial', kind: 'volume', toBase: 158987.294928, level: 'exact', source: '= 42 美制加仑（由 ' + SRC.nist + ' 推导）' },
    // 各地的斤：旧 | 台 | 港（500 < 600 < 604.8 克；下面「更多」里的两、钱两行同列对应）
    { id: 'jin_old', label: '旧制斤', group: 'old', kind: 'mass', toBase: 500, level: 'exact', source: SRC.law1929 + '（旧制一斤十六两，与市斤同为 500 克）' },
    { id: 'jin_tw', label: '台斤', group: 'old', kind: 'mass', toBase: 600, level: 'convention', source: '台湾市场通行 1 台斤 = 600 克（第三方资料转述，未取得官方条文原文）' },
    { id: 'jin_hk', label: '港斤', group: 'old', kind: 'mass', toBase: 604.78982, level: 'exact', source: '香港《度量衡条例》第 68 章（司马斤 = 1⅓ 磅）' },

    // ======== 更多单位 42 个（14 行），每行从左到右由小到大 ========
    // 市制：厘 分 担
    { id: 'li', label: '厘', group: 'm_shi', kind: 'mass', toBase: 0.05, level: 'convention', source: '1929《度量衡法》第六条（分 = 10 厘）；1959 改十两制后按十进推得 1 厘 = 0.05 克' },
    { id: 'fen', label: '分', group: 'm_shi', kind: 'mass', toBase: 0.5, level: 'convention', source: '1929《度量衡法》第六条各级十进（钱 = 10 分）；1959 改十两制后按十进推得 1 分 = 0.5 克' },
    { id: 'dan', label: '担', group: 'm_shi', kind: 'mass', toBase: 50000, level: 'exact', source: '1929《度量衡法》第六条「担：等于百斤」× 市斤 500 克' },
    // 公制：微克 毫克 克拉
    { id: 'ug', label: '微克', group: 'm_metric', kind: 'mass', toBase: 1e-6, level: 'exact', source: SRC.si },
    { id: 'mg', label: '毫克', group: 'm_metric', kind: 'mass', toBase: 1e-3, level: 'exact', source: SRC.si },
    { id: 'ct', label: '克拉', group: 'm_metric', kind: 'mass', toBase: 0.2, level: 'exact', source: '公制克拉 = 200 毫克（' + SRC.nist + '）' },
    // 大重量：英石 短吨 长吨
    { id: 'st', label: '英石', group: 'm_imp_mass', kind: 'mass', toBase: 6350.29318, level: 'exact', source: '= 14 磅（由 ' + SRC.nist + ' 的磅定义推导）' },
    { id: 'ton_s', label: '短吨', group: 'm_imp_mass', kind: 'mass', toBase: 907184.74, level: 'exact', source: '= 2000 磅（' + SRC.nist + '）' },
    { id: 'ton_l', label: '长吨', group: 'm_imp_mass', kind: 'mass', toBase: 1016046.9088, level: 'exact', source: '= 2240 磅（' + SRC.nist + '）' },
    // 金衡：格令 金衡盎司 金衡磅（贵金属，1 金衡盎司 = 480 格令）
    { id: 'gr', label: '格令', group: 'm_imp_mass', kind: 'mass', toBase: 0.06479891, level: 'exact', source: SRC.nist },
    { id: 'ozt', label: '金衡盎司', group: 'm_imp_mass', kind: 'mass', toBase: 31.1034768, level: 'exact', source: '= 480 格令（由 ' + SRC.nist + ' 的格令推导；NIST 表中列为 31.10348 克）' },
    { id: 'lbt', label: '金衡磅', group: 'm_imp_mass', kind: 'mass', toBase: 373.2417216, level: 'exact', source: '= 12 金衡盎司（由 ' + SRC.nist + ' 推导）' },
    // 各地的两、钱：旧 | 台 | 港
    { id: 'liang_old', label: '旧制两', group: 'm_old', kind: 'mass', toBase: 31.25, level: 'exact', source: SRC.law1929 + '（500 ÷ 16）' },
    { id: 'liang_tw', label: '台两', group: 'm_old', kind: 'mass', toBase: 37.5, level: 'convention', source: '台斤 ÷ 16（台斤为台湾市场通行值，第三方资料转述）' },
    { id: 'liang_hk', label: '港两', group: 'm_old', kind: 'mass', toBase: 37.79936375, level: 'exact', source: '港斤 ÷ 16（香港《度量衡条例》第 68 章）' },
    { id: 'qian_old', label: '旧制钱', group: 'm_old', kind: 'mass', toBase: 3.125, level: 'exact', source: SRC.law1929 + '（旧制两 ÷ 10）' },
    { id: 'qian_tw', label: '台钱', group: 'm_old', kind: 'mass', toBase: 3.75, level: 'convention', source: '台两 ÷ 10（台湾市场通行，第三方资料转述）' },
    { id: 'qian_hk', label: '港钱', group: 'm_old', kind: 'mass', toBase: 3.779936375, level: 'exact', source: '港两 ÷ 10（香港《度量衡条例》第 68 章：钱 = 1/160 斤）' },
    // 小容量：微升 立方毫米 厘升（微升 = 立方毫米，并列）
    { id: 'ul', label: '微升', group: 'm_vol', kind: 'volume', toBase: 1e-3, level: 'exact', source: SRC.si + '（1 微升 = 1 立方毫米）' },
    { id: 'mm3', label: '立方毫米', group: 'm_vol', kind: 'volume', toBase: 1e-3, level: 'exact', source: SRC.si },
    { id: 'cl', label: '厘升', group: 'm_vol', kind: 'volume', toBase: 10, level: 'exact', source: SRC.si },
    // 市制容量：撮 勺 合 / 市升 斗 石（一条十进阶梯，从左上到右下一路递增）
    { id: 'cuo', label: '撮', group: 'm_shi_vol', kind: 'volume', toBase: 1, level: 'exact', source: '1929《度量衡法》第六条（撮 = 1/1000 升）' },
    { id: 'shao', label: '勺', group: 'm_shi_vol', kind: 'volume', toBase: 10, level: 'exact', source: '1929《度量衡法》第六条（勺 = 1/100 升）' },
    { id: 'ge', label: '合', group: 'm_shi_vol', kind: 'volume', toBase: 100, level: 'exact', source: '1929《度量衡法》第六条（合 = 1/10 升）' },
    { id: 'shi_l', label: '市升', group: 'm_shi_vol', kind: 'volume', toBase: 1000, level: 'exact', source: '1929《度量衡法》第五条（以公升为市升）' },
    { id: 'dou', label: '斗', group: 'm_shi_vol', kind: 'volume', toBase: 1e4, level: 'exact', source: '1929《度量衡法》第五、六条（斗 = 10 升）' },
    { id: 'shi_dan', label: '石', group: 'm_shi_vol', kind: 'volume', toBase: 1e5, level: 'exact', source: '1929《度量衡法》第五、六条（市升 = 公升，石 = 100 升）' },
    // 厨房：公制 / 美制 上下同列对应（茶匙 | 汤匙 | 杯）
    { id: 'tsp_m', label: '茶匙', group: 'm_kitchen', kind: 'volume', toBase: 5, level: 'convention', source: '国际通行公制量勺 5 毫升；未查到中国统一的量勺国家标准' },
    { id: 'tbsp_m', label: '汤匙', group: 'm_kitchen', kind: 'volume', toBase: 15, level: 'convention', source: '国际通行公制量勺 15 毫升；未查到中国统一的量勺国家标准' },
    { id: 'cup_m', label: '公制杯', group: 'm_kitchen', kind: 'volume', toBase: 250, level: 'convention', source: '澳大利亚、新西兰、加拿大通行的公制杯 250 毫升' },
    { id: 'tsp_us', label: '美制茶匙', group: 'm_kitchen', kind: 'volume', toBase: 4.92892159375, level: 'exact', source: '= 1/6 美制液盎司（' + SRC.nist + '）' },
    { id: 'tbsp_us', label: '美制汤匙', group: 'm_kitchen', kind: 'volume', toBase: 14.78676478125, level: 'exact', source: '= 1/2 美制液盎司（' + SRC.nist + '）' },
    { id: 'cup_us', label: '美制杯', group: 'm_kitchen', kind: 'volume', toBase: 236.5882365, level: 'exact', source: SRC.nist },
    // 英美液量：美制 / 英制 上下同列对应（液盎司 | 品脱 | 夸脱）；立方英制一行
    { id: 'floz_us', label: '美制液盎司', group: 'm_imp_vol', kind: 'volume', toBase: 29.5735295625, level: 'exact', source: '1/128 美制加仑（' + SRC.nist + '）' },
    { id: 'pt_us', label: '美制品脱', group: 'm_imp_vol', kind: 'volume', toBase: 473.176473, level: 'exact', source: '= 1/8 美制加仑（由 ' + SRC.nist + ' 推导）' },
    { id: 'qt_us', label: '美制夸脱', group: 'm_imp_vol', kind: 'volume', toBase: 946.352946, level: 'exact', source: '= 1/4 美制加仑（由 ' + SRC.nist + ' 推导）' },
    { id: 'floz_uk', label: '英制液盎司', group: 'm_imp_vol', kind: 'volume', toBase: 28.4130625, level: 'exact', source: '= 1/160 英制加仑（由 ' + SRC.nist + ' 推导）' },
    { id: 'pt_uk', label: '英制品脱', group: 'm_imp_vol', kind: 'volume', toBase: 568.26125, level: 'exact', source: '= 1/8 英制加仑（由 ' + SRC.nist + ' 推导）' },
    { id: 'qt_uk', label: '英制夸脱', group: 'm_imp_vol', kind: 'volume', toBase: 1136.5225, level: 'exact', source: '= 1/4 英制加仑（由 ' + SRC.nist + ' 推导）' },
    { id: 'in3', label: '立方英寸', group: 'm_imp_vol', kind: 'volume', toBase: 16.387064, level: 'exact', source: '= 2.54³ 立方厘米（英寸为 2.54 厘米，' + SRC.nist + '）' },
    { id: 'ft3', label: '立方英尺', group: 'm_imp_vol', kind: 'volume', toBase: 28316.846592, level: 'exact', source: '= 1728 立方英寸（由 ' + SRC.nist + ' 推导）' },
    { id: 'yd3', label: '立方码', group: 'm_imp_vol', kind: 'volume', toBase: 764554.857984, level: 'exact', source: '= 27 立方英尺（由 ' + SRC.nist + ' 推导）' },

    // ======== 生活物品 24 个（8 行）：1 件 = 多少克，每行从左到右由小到大 ========
    // 全部按重量记（kind: 'mass'）：装的东西是固定的，不能跟着顶部「按什么物质」变——
    //   2026-10-08 审查实测：选「按面粉」时 3 罐可乐算成 574 克。容量类物品用 vol × 自己内容物的密度折成克。
    // cw：量词（格子里数字后面的小字、推荐文字用）；noun：推荐文字里的名字；vol：一件装多少毫升；suggest:false 不进「相当于」推荐
    { id: 'n_pingpong', label: '乒乓球', cw: '个', noun: '乒乓球', group: 'i_daily', kind: 'mass', toBase: 2.7, level: 'standard', source: '国际乒联规则 2.3.3：球重 2.7 克' },
    { id: 'n_a4', label: 'A4 纸', cw: '张', noun: 'A4 纸', group: 'i_daily', kind: 'mass', toBase: A4_G, level: 'derived', source: 'ISO 216：A4 为 210×297 毫米，按最常见的 80 克/平方米复印纸 = 4.9896 克' },
    { id: 'n_egg', label: '鸡蛋', cw: '个', noun: '鸡蛋', group: 'i_daily', kind: 'mass', toBase: 61, level: 'derived', source: 'SB/T 10638-2011《鲜鸡蛋、鲜鸭蛋分级》中等蛋（M 级）单枚 58～64 克，取中值 61 克（用户 2026-10-08 选；分级表经 T/GDFCA 048-2020 表 2 转引核对，SB/T 原文未取得）' },
    { id: 'n_rmb1', label: '1 元', cw: '张', group: 'i_rmb', kind: 'mass', toBase: rmb(130, 63), level: 'unofficial', suggest: false, source: RMB_SRC + '（130×63 毫米）' },
    { id: 'n_rmb5', label: '5 元', cw: '张', group: 'i_rmb', kind: 'mass', toBase: rmb(135, 63), level: 'unofficial', suggest: false, source: RMB_SRC + '（135×63 毫米）' },
    { id: 'n_rmb10', label: '10 元', cw: '张', group: 'i_rmb', kind: 'mass', toBase: rmb(140, 70), level: 'unofficial', suggest: false, source: RMB_SRC + '（140×70 毫米）' },
    { id: 'n_rmb20', label: '20 元', cw: '张', group: 'i_rmb', kind: 'mass', toBase: rmb(145, 70), level: 'unofficial', suggest: false, source: RMB_SRC + '（145×70 毫米）' },
    { id: 'n_rmb50', label: '50 元', cw: '张', group: 'i_rmb', kind: 'mass', toBase: rmb(150, 70), level: 'unofficial', suggest: false, source: RMB_SRC + '（150×70 毫米）' },
    { id: 'n_rmb100', label: '100 元', cw: '张', group: 'i_rmb', kind: 'mass', toBase: RMB100_G, level: 'unofficial', suggest: false, source: '155×77 毫米；约 1.15 克为第三方称量，中国人民银行未公布单张克重' },
    // 人民币硬币：中国人民银行的发行公告只公布直径和材质、不公布重量（2019 年版公告与各行转发的《硬币详解》均如此），
    //   只能取钱币目录记载的值。2019 版三枚 Numista、uCoin、Numisquare 三家一致；分币只核到 Numista 一家。
    //   网上流传的「2019 版 1 元 3.3 克、1 角 4.7 克」与三家目录都对不上，不采用（2026-10-09 核）
    { id: 'n_c1f', label: '1 分', cw: '枚', group: 'i_coin', kind: 'mass', toBase: 0.67, level: 'unofficial', suggest: false, source: COIN_FEN_SRC + '（18 毫米）' },
    { id: 'n_c2f', label: '2 分', cw: '枚', group: 'i_coin', kind: 'mass', toBase: 1.08, level: 'unofficial', suggest: false, source: COIN_FEN_SRC + '（21 毫米）' },
    { id: 'n_c5f', label: '5 分', cw: '枚', group: 'i_coin', kind: 'mass', toBase: 1.6, level: 'unofficial', suggest: false, source: COIN_FEN_SRC + '（24 毫米）' },
    { id: 'n_c1j', label: '1 角', cw: '枚', group: 'i_coin', kind: 'mass', toBase: 3.2, level: 'unofficial', suggest: false, source: COIN_SRC + '（不锈钢，直径 19 毫米）' },
    { id: 'n_c5j', label: '5 角', cw: '枚', group: 'i_coin', kind: 'mass', toBase: 3.8, level: 'unofficial', suggest: false, source: COIN_SRC + '（钢芯镀镍，直径 20.5 毫米）' },
    { id: 'n_c1y', label: '1 元', cw: '枚', group: 'i_coin', kind: 'mass', toBase: 4.75, level: 'unofficial', suggest: false, source: COIN_SRC + '（钢芯镀镍，直径 22.25 毫米）' },
    { id: 'n_milk', label: '盒装牛奶', cw: '盒', noun: '牛奶', group: 'i_drink', kind: 'mass', vol: 250, toBase: 250 * dens('milk'), level: 'label', source: SRC.pack + '（250 毫升）× 牛奶密度 1.03（' + SRC.fao + '）' },
    { id: 'n_cola', label: '罐装可乐', cw: '罐', noun: '可乐', group: 'i_drink', kind: 'mass', vol: 330, toBase: 330 * dens('water'), level: 'label', source: SRC.pack + '（330 毫升），按水的密度近似' },
    { id: 'n_bottle', label: '瓶装水', cw: '瓶', noun: '矿泉水', group: 'i_drink', kind: 'mass', vol: 550, toBase: 550 * dens('water'), level: 'label', source: SRC.pack + '（550 毫升）× 水的密度' },
    // 大包装两行是一条阶梯（400 克 → 50 千克），小的一行在上
    { id: 'n_salt', label: '袋装盐', cw: '袋', noun: '盐', group: 'i_pack1', kind: 'mass', toBase: 400, level: 'label', source: SRC.pack + '（400 克）' },
    { id: 'n_ream', label: '整包 A4', cw: '包', noun: 'A4 纸（500 张装）', group: 'i_pack1', kind: 'mass', toBase: 500 * A4_G, level: 'derived', source: '包装标称 500 张/包（一令）× 单张 4.9896 克（ISO 216，80 克纸）= 2494.8 克' },
    { id: 'n_oil', label: '桶装油', cw: '桶', noun: '食用油', group: 'i_pack1', kind: 'mass', vol: 5000, toBase: 5000 * dens('oil'), level: 'label', source: SRC.pack + '（5 升）× 食用油密度 0.92（' + SRC.fao + '）' },
    { id: 'n_rice', label: '袋装大米', cw: '袋', noun: '大米', group: 'i_pack2', kind: 'mass', toBase: 5000, level: 'label', source: SRC.pack + '（5 千克）' },
    { id: 'n_jug', label: '桶装水', cw: '桶', noun: '桶装水', group: 'i_pack2', kind: 'mass', vol: 18900, toBase: 18900 * dens('water'), level: 'label', source: SRC.pack + '（18.9 升）× 水的密度' },
    { id: 'n_cement', label: '袋装水泥', cw: '袋', noun: '水泥', group: 'i_pack2', kind: 'mass', toBase: 50000, level: 'standard', source: 'GB 175-2007《通用硅酸盐水泥》9.4：袋装水泥每袋净含量为 50 千克（2023 版条文原文未取得）' }
  ];


  var WV_DATA = { levels: levels, groups: groups, units: units, substances: substances };
  if (typeof module !== 'undefined' && module.exports) module.exports = WV_DATA;
  else root.WV_DATA = WV_DATA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
