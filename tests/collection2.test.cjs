// 换算合集第二批（2026-10-09：速度 / 角度 / 力 / 能量 / 功率 / 压力 / 油耗 / 货币）的定义关系与汇率逻辑
//   通用的出处、等级、排版规则、来回换算已在 collection.test.cjs 里对所有页面跑过
const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../core.js');
const close = (a, b, rel = 1e-12) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(b));
const conv = id => K.makeConverter(require(`../data-${id}.js`).units);
const eqIn = id => { const c = conv(id); return (a, ua, b, ub, rel) => assert.ok(close(c.toBase(a, ua), c.toBase(b, ub), rel), `${id}：${a} ${ua} ≠ ${b} ${ub}`); };

test('速度', () => {
  const eq = eqIn('speed');
  eq(3.6, 'kmh', 1, 'ms'); eq(1, 'kms', 1000, 'ms'); eq(1, 'ms', 100, 'cms'); eq(1, 'ms', 60, 'mmin');
  eq(1, 'mph', 1.609344, 'kmh'); eq(1, 'kn', 1.852, 'kmh'); eq(15, 'mph', 22, 'fts');
  assert.equal(conv('speed').toBase(1, 'c'), 299792458);
});

test('角度', () => {
  const eq = eqIn('angle');
  eq(1, 'deg', 60, 'min'); eq(1, 'min', 60, 'sec'); eq(1, 'rev', 360, 'deg'); eq(1, 'rev', 400, 'gon');
  eq(Math.PI, 'rad', 180, 'deg'); eq(1, 'rad', 1000, 'mrad');
  eq(1, 'rev', 6400, 'mil_nato'); eq(1, 'rev', 6000, 'mil6000');
});

test('力', () => {
  const eq = eqIn('force');
  eq(1, 'n', 1e5, 'dyn'); eq(1, 'kn', 1000, 'n'); eq(1, 'kgf', 9.80665, 'n'); eq(1, 'kgf', 1000, 'gf'); eq(1, 'tf', 1000, 'kgf');
  eq(1, 'lbf', 16, 'ozf'); eq(1, 'kip', 1000, 'lbf');
  assert.ok(close(conv('force').toBase(1, 'lbf'), 4.4482216152605), '磅力精确值');
});

test('能量', () => {
  const eq = eqIn('energy');
  eq(1, 'kj', 1000, 'j'); eq(1, 'mj', 1000, 'kj'); eq(1, 'kcal', 1000, 'cal'); eq(1, 'kcal', 4.184, 'kj');
  eq(1, 'kwh', 3.6, 'mj'); eq(1, 'kwh', 1000, 'wh'); eq(1, 'j', 1e7, 'erg'); eq(1, 'tce', 1000, 'kgce');
  eq(1, 'kgce', 29307.6, 'kj');
  const c = conv('energy');
  assert.ok(Math.abs(c.toBase(1, 'ftlbf') - 1.355818) < 1e-6, 'NIST 1.355 818');
  assert.ok(Math.abs(c.toBase(1, 'btu') - 1055.056) < 1e-3, 'NIST 1.055 056×10³');
  assert.equal(c.toBase(1, 'ev'), 1.602176634e-19);
});

test('功率', () => {
  const eq = eqIn('power');
  eq(1, 'kw', 1000, 'w'); eq(1, 'mw', 1000, 'kw'); eq(1, 'gw', 1e9, 'w'); eq(1, 'w', 1000, 'mwatt'); eq(1, 'w', 1e7, 'ergs');
  eq(1, 'rt', 12000, 'btuh');
  const c = conv('power');
  assert.equal(c.toBase(1, 'ps'), 735.49875);
  assert.ok(Math.abs(c.toBase(1, 'hp') - 745.6999) < 1e-4, 'NIST 745.6999');
  assert.ok(Math.abs(c.toBase(1, 'kcalh') - 1.163) < 1e-12, '1 千卡/时 = 1.163 瓦');
  assert.ok(Math.abs(c.toBase(1, 'rt') - 3516.853) < 1e-3, 'NIST 3516.853');
  assert.ok(Math.abs(c.toBase(1, 'btuh') - 0.2930711) < 1e-7, 'NIST 0.293 071 1');
});

test('压力', () => {
  const eq = eqIn('pressure');
  eq(1, 'kpa', 1000, 'pa'); eq(1, 'mpa', 1000, 'kpa'); eq(1, 'bar', 100, 'kpa'); eq(1, 'hpa', 1, 'mbar'); eq(1, 'gpa', 1000, 'mpa');
  eq(1, 'atm', 760, 'torr'); eq(1, 'inhg', 25.4, 'mmhg'); eq(1, 'ksi', 1000, 'psi'); eq(1, 'at', 10000, 'mmh2o');
  const c = conv('pressure');
  assert.ok(Math.abs(c.toBase(1, 'psi') - 6894.757) < 1e-3, 'NIST 6894.757');
  assert.ok(Math.abs(c.toBase(1, 'mmhg') - 133.3224) < 1e-4, 'NIST 133.3224');
  assert.ok(Math.abs(c.toBase(1, 'inhg') - 3386.389) < 1e-3, 'NIST 3386.389');
});

test('油耗：倒数关系、典型值、0 不成立', () => {
  const c = conv('fuel'), D = require('../data-fuel.js');
  let r = c.convertAll(10, 'kmpl');
  assert.ok(close(r.l100km, 10), '10 公里/升 = 10 升/百公里');
  r = c.convertAll(1, 'mpg_us');
  assert.ok(Math.abs(r.l100km - 235.215) < 1e-3, 'NIST：235.215 ÷ mpg');
  assert.ok(Math.abs(r.kmpl - 0.4251437) < 1e-7, 'NIST 0.425 143 7');
  r = c.convertAll(1, 'mpg_uk');
  assert.ok(Math.abs(r.l100km - 282.481) < 1e-3, '英制 282.481 ÷ mpg');
  r = c.convertAll(5, 'l100km');
  assert.ok(Math.abs(r.mpg_us - 47.043) < 1e-3, '5 升/百公里 ≈ 47.04 美制 MPG');
  assert.ok(close(r.g100_us, 100 / r.mpg_us), '加仑/百英里 = 100 ÷ MPG');
  assert.ok(close(r.g100_uk, 100 / r.mpg_uk));
  assert.ok(D.validate(c.toBase(0, 'l100km')), '0 升/百公里 不成立');
  assert.ok(D.validate(c.toBase(0, 'kmpl')), '0 公里/升 不成立');
  assert.equal(D.validate(c.toBase(8, 'l100km')), null);
});

test('货币：快照完整、合并算法、人民币是基准', () => {
  const CUR = require('../currency.js'), R = require('../rates.js'), D = require('../data-currency.js');
  const plan = Object.values(CUR.PLAN).flat();
  assert.equal(D.units.length, plan.length + 1, '计划里的外币 + 人民币，全部上页面');
  assert.equal(D.units.length % 3, 0);
  for (const code of plan) {
    assert.ok(R.rates[code] && R.rates[code].cny > 0, `快照缺 ${code}`);
    assert.ok(D.units.some(u => u.code === code), `页面缺 ${code}`);
  }
  assert.equal(D.units.find(u => u.code === 'CNY').toBase, 1);
  assert.equal(new Set(D.units.map(u => u.code)).size, D.units.length);
  assert.match(R.date, /^\d{4}-\d{2}-\d{2}$/);
  // 合并：欧元基准原始数自己折算（港币 7.5404 ÷ 8.7833 = 0.858493 → 官网 0.85849）
  const list = (date, pairs) => pairs.map(([q, rate]) => ({ date, base: 'EUR', quote: q, rate }));
  const m = CUR.merge({
    CFETS: list('2026-10-08', [['CNY', 7.5404], ['EUR', 1], ['HKD', 8.7833], ['USD', 1.1193], ['BRL', 9.9]]),
    ECB: list('2026-10-08', [['CNY', 7.4972], ['BRL', 5.6118]]),
    AMCM: list('2026-10-07', [['CNY', 7.5048], ['TWD', 35.678]])
  });
  assert.equal(m.HKD.cny.toFixed(5), '0.85849');
  assert.equal(m.USD.cny.toFixed(4), '6.7367');
  assert.equal(m.EUR.cny, 7.5404, '欧元直接取欧元兑人民币');
  assert.equal(m.BRL.provider, 'ECB', '巴西雷亚尔归欧洲央行，CFETS 里混进来的不收');
  assert.ok(close(m.BRL.cny, 7.4972 / 5.6118));
  assert.ok(close(m.TWD.cny, 7.5048 / 35.678));
  assert.equal(CUR.dateOf(m), '2026-10-08', '汇率日期以中间价为准');
  // 坏数据：没有欧元兑人民币、日期对不上、非正数，一律不收；旧值保留
  const old = { USD: { cny: 7, date: '2026-10-01', provider: 'CFETS' } };
  const m2 = CUR.merge({ CFETS: [{ date: '2026-10-08', base: 'EUR', quote: 'USD', rate: 1.1 }] }, old);
  assert.equal(m2.USD.cny, 7, '缺欧元兑人民币时不能算');
  const m3 = CUR.merge({ CFETS: list('2026-10-08', [['CNY', 7.5], ['USD', -1], ['HKD', 0]]).concat([{ date: '2026-10-07', base: 'EUR', quote: 'JPY', rate: 170 }]) }, old);
  assert.equal(m3.USD.cny, 7); assert.ok(!m3.HKD && !m3.JPY, '负数、0、日期不一致都不收');
  // 金额只写 5 位有效数字（中间价本身就只有 5 位）
  assert.equal(D.texts(null, 6.736710001)[0], '6.7367');
});
