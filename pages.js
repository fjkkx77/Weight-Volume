/*
 * 换算合集 —— 页面登记表（只放数据）
 * 目录页的格子、每页标题上的切换菜单、tools/build-pages.cjs 生成页面，都读这一份。
 * 加一个换算页 = 这里加一条 + 写 data-<id>.js + 跑 node tools/build-pages.cjs（weight 页是手写的，不生成）。
 *   glyph：目录格子里的大字；sample：几个代表单位，帮人认出是哪种换算（390 宽下要一行放下，测试会拦）
 *   dataVar：data 文件挂到 window 上的变量名；signed：允许输入负数（页面会多一个 ± 键）
 *   before：要在 data 文件之前加载的脚本（货币要先有汇率快照）；live：页面加载后还要跑的模块（货币拉实时汇率）
 * 目录是 3 列网格，条数要是 3 的倍数（测试会拦）
 */
(function (root) {
  var PAGES = [
    { id: 'weight', file: 'weight.html', name: '重量·容量', title: '斤两换算', glyph: '斤', sample: '斤 两 克 毫升',
      desc: '斤、两、克、毫升、杯、磅等重量与容量单位换算；输入几个鸡蛋、几张 A4 纸、几张人民币或几枚硬币，直接看多重' },
    { id: 'length', file: 'length.html', name: '长度', title: '长度换算', glyph: '尺', sample: '米 尺 英寸',
      dataVar: 'WV_LENGTH', desc: '米、厘米、尺、寸、里、英寸、英尺、英里、海里、光年等长度单位换算' },
    { id: 'area', file: 'area.html', name: '面积', title: '面积换算', glyph: '亩', sample: '平方米 亩 坪',
      dataVar: 'WV_AREA', desc: '平方米、亩、公顷、平方千米、坪、英亩、平方英尺等面积单位换算' },
    { id: 'temperature', file: 'temperature.html', name: '温度', title: '温度换算', glyph: '℃', sample: '℃ ℉ K',
      dataVar: 'WV_TEMPERATURE', signed: true, desc: '摄氏度、华氏度、开尔文、兰氏度等温度单位换算' },
    { id: 'currency', file: 'currency.html', name: '货币', title: '货币换算', glyph: '¥', sample: '美元 港币',
      dataVar: 'WV_CURRENCY', before: ['rates.js'], live: 'currency.js',
      desc: '人民币、美元、欧元、港币、日元、英镑、新台币等 33 种货币换算，按中国外汇交易中心人民币汇率中间价' },
    { id: 'speed', file: 'speed.html', name: '速度', title: '速度换算', glyph: '速', sample: '千米/时 节',
      dataVar: 'WV_SPEED', desc: '千米/时、米/秒、英里/时、节、英尺/秒等速度单位换算' },
    { id: 'angle', file: 'angle.html', name: '角度', title: '角度换算', glyph: '角', sample: '度 弧度 密位',
      dataVar: 'WV_ANGLE', desc: '度、弧度、角分、角秒、百分度、圈、密位等角度单位换算' },
    { id: 'fuel', file: 'fuel.html', name: '油耗', title: '油耗换算', glyph: '油', sample: '升/百公里',
      dataVar: 'WV_FUEL', desc: '升/百公里、公里/升、英里/加仑（MPG，美制与英制）等油耗单位换算' },
    { id: 'energy', file: 'energy.html', name: '能量', title: '能量换算', glyph: '焦', sample: '千卡 度电 焦',
      dataVar: 'WV_ENERGY', desc: '焦耳、千焦、卡、千卡（大卡）、千瓦时（度）、英热单位、电子伏、标准煤等能量单位换算' },
    { id: 'power', file: 'power.html', name: '功率', title: '功率换算', glyph: '瓦', sample: '千瓦 马力',
      dataVar: 'WV_POWER', desc: '瓦、千瓦、米制马力、英制马力、千卡/时、冷吨、BTU/时等功率单位换算' },
    { id: 'pressure', file: 'pressure.html', name: '压力', title: '压力换算', glyph: '帕', sample: '千帕 巴 psi',
      dataVar: 'WV_PRESSURE', desc: '帕、千帕、兆帕、巴、标准大气压、毫米汞柱、psi 等压力（压强）单位换算' },
    { id: 'force', file: 'force.html', name: '力', title: '力换算', glyph: '牛', sample: '牛 千克力',
      dataVar: 'WV_FORCE', desc: '牛、千牛、千克力、吨力、磅力、达因等力的单位换算' }
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = PAGES;
  else root.WV_PAGES = PAGES;
})(typeof globalThis !== 'undefined' ? globalThis : this);
