/*
 * 换算合集 —— 页面登记表（只放数据）
 * 目录页的格子、每页标题上的切换菜单、tools/build-pages.cjs 生成页面，都读这一份。
 * 加一个换算页 = 这里加一条 + 写 data-<id>.js + 跑 node tools/build-pages.cjs（weight 页是手写的，不生成）。
 *   glyph：目录格子里的大字；sample：几个代表单位，帮人认出是哪种换算
 *   dataVar：data 文件挂到 window 上的变量名；signed：允许输入负数（页面会多一个 ± 键）
 */
(function (root) {
  var PAGES = [
    { id: 'weight', file: 'weight.html', name: '重量 · 容量', title: '斤两换算', glyph: '斤', sample: '斤 两 克 毫升 磅 杯',
      desc: '斤、两、克、毫升、杯、磅等重量与容量单位换算；输入几个鸡蛋、几张 A4 纸、几张人民币或几枚硬币，直接看多重' },
    { id: 'length', file: 'length.html', name: '长度', title: '长度换算', glyph: '尺', sample: '米 尺 英寸 英里 海里',
      dataVar: 'WV_LENGTH', desc: '米、厘米、尺、寸、里、英寸、英尺、英里、海里、光年等长度单位换算' },
    { id: 'area', file: 'area.html', name: '面积', title: '面积换算', glyph: '亩', sample: '平方米 亩 公顷 坪 英亩',
      dataVar: 'WV_AREA', desc: '平方米、亩、公顷、平方千米、坪、英亩、平方英尺等面积单位换算' },
    { id: 'temperature', file: 'temperature.html', name: '温度', title: '温度换算', glyph: '℃', sample: '摄氏 华氏 开尔文',
      dataVar: 'WV_TEMPERATURE', signed: true, desc: '摄氏度、华氏度、开尔文、兰氏度等温度单位换算' }
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = PAGES;
  else root.WV_PAGES = PAGES;
})(typeof globalThis !== 'undefined' ? globalThis : this);
