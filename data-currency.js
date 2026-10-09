/*
 * 货币换算 —— 单位表（只放数据）。基准：人民币。toBase = 1 单位该货币合多少人民币。
 * 汇率先取仓库里的快照 rates.js（页面里在本文件之前加载），打开页面后 currency.js 再拉最新的覆盖。
 * 汇率天天变，单位之间没有固定的大小顺序，排版不判从小到大（noOrder）；按地区分组，常用的放首屏。
 * 数字只写到 5 位有效数字：中间价本身就只公布 5 位有效数字（如 6.7367），多写是假精度。
 */
(function (root) {
  var R = (typeof module !== 'undefined' && module.exports) ? require('./rates.js') : root.WV_RATES;
  var SRC = {
    CFETS: '中国外汇交易中心人民币汇率中间价（经 Frankfurter 接口获取，按欧元基准原始数折算，与官网核对一致）',
    ECB: '欧洲央行参考汇率（以欧元公布，按欧洲央行的欧元兑人民币折算；CFETS 不公布这种货币的中间价）',
    AMCM: '澳门金融管理局银行间中间价（以欧元基准折算；CFETS、欧洲央行都不公布新台币）'
  };
  var LEVEL = { CFETS: 'rate_cn', ECB: 'rate_ref', AMCM: 'rate_ref' };
  // [代码, 显示名, 组]
  var LIST = [
    ['CNY', '人民币', 'main'], ['HKD', '港币', 'main'], ['MOP', '澳门元', 'main'],
    ['USD', '美元', 'main'], ['EUR', '欧元', 'main'], ['GBP', '英镑', 'main'],
    ['JPY', '日元', 'main'], ['KRW', '韩元', 'main'], ['TWD', '新台币', 'main'],
    ['AUD', '澳元', 'main'], ['CAD', '加元', 'main'], ['SGD', '新加坡元', 'main'],
    ['CHF', '瑞士法郎', 'm_eu'], ['DKK', '丹麦克朗', 'm_eu'], ['SEK', '瑞典克朗', 'm_eu'],
    ['NOK', '挪威克朗', 'm_eu'], ['PLN', '波兰兹罗提', 'm_eu'], ['HUF', '匈牙利福林', 'm_eu'],
    ['CZK', '捷克克朗', 'm_eu'], ['RON', '列伊', 'm_eu'], ['RUB', '俄罗斯卢布', 'm_eu'],
    ['THB', '泰铢', 'm_asia'], ['MYR', '林吉特', 'm_asia'], ['NZD', '新西兰元', 'm_asia'],
    ['IDR', '印尼盾', 'm_asia'], ['PHP', '菲律宾比索', 'm_asia'], ['INR', '印度卢比', 'm_asia'],
    ['AED', '迪拉姆', 'm_other'], ['SAR', '沙特里亚尔', 'm_other'], ['TRY', '土耳其里拉', 'm_other'],
    ['ZAR', '南非兰特', 'm_other'], ['MXN', '墨西哥比索', 'm_other'], ['BRL', '巴西雷亚尔', 'm_other']
  ];
  var groups = [
    { id: 'main', tier: 'common', name: '常用' },
    { id: 'm_eu', tier: 'more', name: '欧洲（列伊 = 罗马尼亚货币）' },
    { id: 'm_asia', tier: 'more', name: '亚太（林吉特 = 马来西亚货币）' },
    { id: 'm_other', tier: 'more', name: '中东 · 非洲 · 美洲（迪拉姆 = 阿联酋货币）' }
  ];
  var units = LIST.map(function (x) {
    var code = x[0];
    if (code === 'CNY') return { id: 'cny', code: code, label: x[1], group: x[2], toBase: 1, level: 'exact', source: '基准货币' };
    var r = R.rates[code];
    return { id: code.toLowerCase(), code: code, label: x[1], group: x[2], toBase: r ? r.cny : NaN,
      level: r ? LEVEL[r.provider] : 'rate_ref', source: (r ? SRC[r.provider] : '（快照里缺这种货币）') + '；快照日期 ' + (r ? r.date : '无') };
  });
  // 金额：5 位有效数字（放不下再减），与中间价的精度一致
  function texts(u, x) {
    var K = (typeof module !== 'undefined' && module.exports) ? require('./core.js') : root.WVCore;
    return [5, 4, 3].map(function (sig) { return K.formatCell(x, sig); });
  }
  var DATA = { groups: groups, units: units, noOrder: true, texts: texts, date: R.date };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.WV_CURRENCY = DATA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
