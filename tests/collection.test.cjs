// 换算合集（2026-10-09 第一批：长度 / 面积 / 温度）的内核与数据自检：node --test "tests/*.test.cjs"
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const K = require('../core.js');
const PAGES = require('../pages.js');

const close = (a, b, rel = 1e-12) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(b));
// 生成的页面都从 data-<id>.js 读表；weight 页用的是 data.js + convert.js，另有 convert.test.cjs
const SETS = PAGES.filter(p => p.dataVar).map(p => ({ page: p, D: require(`../data-${p.id}.js`) }));
const conv = Object.fromEntries(SETS.map(s => [s.page.id, K.makeConverter(s.D.units)]));
const eqIn = (id) => (a, ua, b, ub) => assert.ok(close(conv[id].toBase(a, ua), conv[id].toBase(b, ub)), `${id}：${a} ${ua} ≠ ${b} ${ub}`);

test('页面登记表：每页都有数据文件、文件名、名字，id 不重复', () => {
  const ids = new Set();
  for (const p of PAGES) {
    assert.ok(p.id && !ids.has(p.id), p.id); ids.add(p.id);
    assert.ok(p.file && p.name && p.title && p.glyph && p.sample && p.desc, `${p.id} 缺字段`);
    if (p.dataVar) assert.ok(fs.existsSync(path.join(__dirname, '..', `data-${p.id}.js`)), `${p.id} 缺 data-${p.id}.js`);
  }
  assert.equal(PAGES[0].id, 'weight', '斤两换算排第一个');
  assert.equal(PAGES.length % 3, 0, '目录是 3 列，条数要是 3 的倍数（不留空格子）');
  assert.deepEqual(PAGES.map(p => p.id).sort(), ['angle', 'area', 'currency', 'energy', 'force', 'fuel', 'length', 'power', 'pressure', 'speed', 'temperature', 'weight'], '用户要的 12 种换算');
});

test('每张单位表：出处、等级、排版规则（同斤两页）', () => {
  for (const { page, D } of SETS) {
    const ids = new Set();
    for (const u of D.units) {
      assert.ok(u.id && !ids.has(u.id), `${page.id} 重复 id ${u.id}`); ids.add(u.id);
      assert.ok(typeof u.source === 'string' && u.source.trim(), `${page.id}/${u.id} 缺出处`);
      assert.ok(u.level in K.LEVELS, `${page.id}/${u.id} 级别非法 ${u.level}`);
      assert.ok(u.label && u.label.length <= 5, `${page.id}/${u.id} 显示名太长（320 宽最多 5 个字）`);
      assert.ok((typeof u.toBase === 'number' && u.toBase > 0) !== !!(u.to && u.from), `${page.id}/${u.id} 要么给 toBase、要么给 to/from`);
      assert.ok(D.groups.some(g => g.id === u.group), `${page.id}/${u.id} 组不存在`);
    }
    // 同组连续、每组 3 的倍数、tier 合法
    const order = D.units.map(u => u.group).filter((g, i, a) => i === 0 || a[i - 1] !== g);
    assert.equal(new Set(order).size, order.length, `${page.id} 同组单位没排在一起`);
    assert.deepEqual(order, D.groups.map(g => g.id), `${page.id} 单位顺序要和分组顺序一致`);
    for (const g of D.groups) {
      assert.ok(['common', 'more'].includes(g.tier), `${page.id}/${g.id} tier 非法`);
      const n = D.units.filter(u => u.group === g.id).length;
      assert.ok(n > 0 && n % 3 === 0, `${page.id}/${g.name} 有 ${n} 个，不是 3 的倍数`);
    }
    // 每一行从左到右由小到大（温度单位之间没有大小，noOrder 跳过）
    if (!D.noOrder) for (const g of D.groups) {
      const us = D.units.filter(u => u.group === g.id);
      for (let i = 0; i < us.length; i += 3) for (let k = 1; k < 3; k++) {
        // 相等的并列（毫巴 = 百帕）
        assert.ok(us[i + k].toBase >= us[i + k - 1].toBase, `${page.id}/${g.name}：${us[i + k - 1].label} 比 ${us[i + k].label} 大`);
      }
    }
    // 首屏至少一行、最多 21 格（再多 390×844 一屏放不下，斤两页实测）
    const common = D.units.filter(u => D.groups.find(g => g.id === u.group).tier === 'common').length;
    assert.ok(common >= 3 && common <= 21, `${page.id} 首屏 ${common} 格`);
  }
});

test('每个单位来回换算一圈回到原值（含负数、零）', () => {
  for (const { page, D } of SETS) {
    for (const u of D.units) {
      for (const x of [0, 0.001, 1, 37, 123.456, 1e6].concat(D.signed ? [-40, -273.15] : [])) {
        const back = K.fromBaseOf(u, K.toBaseOf(u, x));
        assert.ok(Math.abs(back - x) <= 1e-9 * Math.max(1, Math.abs(x)), `${page.id}/${u.id} @ ${x} → ${back}`);
      }
    }
  }
});

test('长度：定义关系', () => {
  const eq = eqIn('length');
  eq(1, 'm', 100, 'cm'); eq(1, 'cm', 10, 'mm'); eq(1, 'km', 1000, 'm'); eq(1, 'dm', 10, 'cm');
  eq(1, 'um', 1000, 'nm'); eq(1, 'mm', 1000, 'um');
  eq(1, 'chi', 10, 'cun'); eq(1, 'zhang', 10, 'chi'); eq(1, 'li', 1500, 'chi'); eq(1, 'cun', 10, 'shi_fen'); eq(1, 'shi_fen', 10, 'shi_li');
  eq(3, 'chi', 1, 'm'); eq(2, 'li', 1, 'km');
  eq(1, 'ft', 12, 'in'); eq(1, 'yd', 3, 'ft'); eq(1, 'mi', 1760, 'yd'); eq(1, 'mi', 8, 'furlong');
  eq(1, 'fathom', 6, 'ft'); eq(2, 'rod', 33, 'ft'); eq(1, 'furlong', 40, 'rod');
  assert.equal(conv.length.toBase(1, 'in'), 0.0254);
  assert.equal(conv.length.toBase(1, 'nmi'), 1852);
  assert.equal(conv.length.toBase(1, 'au'), 149597870700);
  assert.ok(close(conv.length.toBase(1, 'pc'), 3.0856775814913673e16, 1e-12), '秒差距 ≈ 3.0857×10¹⁶ 米');
  assert.ok(close(conv.length.toBase(1, 'ly'), 299792458 * 365.25 * 86400), '光年 = 光速 × 儒略年');
});

test('面积：定义关系', () => {
  const eq = eqIn('area');
  eq(1, 'm2', 100, 'dm2'); eq(1, 'dm2', 100, 'cm2'); eq(1, 'are', 100, 'm2'); eq(1, 'ha', 100, 'are'); eq(1, 'km2', 100, 'ha');
  eq(1, 'mu', 6000, 'chi2'); eq(1, 'mu', 60, 'zhang2'); eq(1, 'mu', 10, 'mu_fen'); eq(1, 'qing', 100, 'mu');
  eq(1, 'chi2', 100, 'cun2'); eq(1, 'zhang2', 100, 'chi2');
  eq(15, 'mu', 1, 'ha');   // 常用口诀：15 亩 = 1 公顷
  eq(1, 'ft2', 144, 'in2'); eq(1, 'yd2', 9, 'ft2'); eq(1, 'acre', 43560, 'ft2'); eq(1, 'acre', 160, 'rod2'); eq(1, 'mi2', 640, 'acre');
  eq(1, 'jia', 10, 'tw_fen'); eq(1, 'jia', 2934, 'ping');
  assert.ok(close(conv.area.toBase(1, 'acre'), 4046.8564224));
  assert.ok(Math.abs(conv.area.toBase(1, 'ping') - 3.305785) < 1e-6, '1 坪 ≈ 3.3058 平方米');
  assert.ok(Math.abs(conv.area.toBase(1, 'mu') - 666.6667) < 1e-4, '1 亩 ≈ 666.67 平方米');
});

test('温度：特征点、绝对零度、负数', () => {
  const c = conv.temperature;
  const at = (v, from) => c.convertAll(v, from);
  // 冰点、沸点、人体、−40 交点
  let r = at(0, 'c'); assert.ok(close(r.f, 32) && close(r.k, 273.15) && close(r.r, 491.67) && close(r.re, 0) && close(r.ro, 7.5));
  r = at(100, 'c'); assert.ok(close(r.f, 212) && close(r.k, 373.15) && close(r.r, 671.67) && close(r.re, 80) && close(r.ro, 60));
  r = at(-40, 'f'); assert.ok(close(r.c, -40), String(r.c));
  r = at(98.6, 'f'); assert.ok(close(r.c, 37), String(r.c));
  r = at(0, 'k'); assert.ok(close(r.c, -273.15) && close(r.f, -459.67) && close(r.r, 0, 1e-9));
  assert.equal(K.formatCell(at(37, 'c').f), '98.6', '不带浮点尾巴');
  const D = require('../data-temperature.js');
  assert.ok(D.validate(c.toBase(-1, 'k')), '−1 K 不存在');
  assert.ok(D.validate(c.toBase(-300, 'c')));
  assert.equal(D.validate(c.toBase(0, 'k')), null, '0 K 本身成立');
  assert.equal(D.validate(c.toBase(-459.67, 'f')), null, '−459.67 ℉ 就是绝对零度');
});

test('输入解析：只有开了 signed 才收负数', () => {
  assert.equal(K.parseInput('-40', true), -40);
  assert.equal(K.parseInput('－12.5', true), -12.5, '全角负号');
  assert.equal(K.parseInput('−3', true), -3, '数学减号');
  assert.equal(K.parseInput('-', true), null);
  assert.equal(K.parseInput('--1', true), null);
  assert.equal(K.parseInput('1-', true), null);
  assert.equal(K.parseInput('-40', false), null, '斤两页仍不收负数');
  assert.equal(K.parseInput('１２，５'), 12.5);
  assert.equal(K.formatCell(-40), '-40');
  assert.equal(K.formatCell(-123456789), '-1.23457亿');
});

test('科学计数写法（长度、面积页的极小值）', () => {
  assert.equal(K.formatSci(1 / 149597870700, 4), '6.685×10⁻¹²');
  assert.equal(K.formatSci(1e-10, 4), '1×10⁻¹⁰');
  assert.equal(K.formatSci(9.99996e-7, 4), '1×10⁻⁶', '尾数进位到 10');
  assert.equal(K.formatSci(-2.5e-8, 3), '-2.5×10⁻⁸');
  assert.equal(K.formatSci(0, 4), '0');
});
