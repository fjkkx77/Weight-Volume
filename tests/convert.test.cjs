// 换算内核自检：node --test "tests/*.test.cjs"（Node 24 下 `node --test tests/` 会把目录当文件跑）
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../data.js');
const C = require('../convert.js');

const close = (a, b, rel = 1e-12) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(b));

test('定义值与出处一致', () => {
  assert.equal(C.toBase(1, 'jin'), 500);
  assert.equal(C.toBase(1, 'liang'), 50);
  assert.equal(C.toBase(1, 'qian'), 5);
  assert.equal(C.toBase(1, 'lb'), 453.59237);
  assert.equal(C.toBase(1, 'oz'), 28.349523125);
  assert.equal(C.toBase(1, 'gal_us'), 3785.411784);
  assert.equal(C.toBase(1, 'gal_uk'), 4546.09);
  assert.equal(C.toBase(1, 'cup_us'), 236.5882365);
  assert.equal(C.toBase(1, 'jin_hk'), 604.78982);
  assert.equal(C.toBase(1, 'jin_tw'), 600);
  assert.equal(C.toBase(1, 'liang_old'), 31.25);
  // 推导关系：美制液量盎司 = 1/128 美制加仑；16 旧制两 = 1 市斤
  assert.ok(close(C.toBase(128, 'floz_us'), 3785.411784));
  assert.ok(close(C.toBase(16, 'liang_old'), C.toBase(1, 'jin')));
});

// 每条都是两个独立写进 data.js 的系数之间的定义关系：任何一个抄错都会在这里对不上
test('新增单位的定义关系（57 个单位扩充）', () => {
  const eq = (a, ua, b, ub) => assert.ok(close(C.toBase(a, ua), C.toBase(b, ub)), `${a} ${ua} ≠ ${b} ${ub}`);
  // 市制重量：1929《度量衡法》第六条 + 1959 十两制
  eq(1, 'dan', 100, 'jin'); eq(1, 'qian', 10, 'fen'); eq(1, 'fen', 10, 'li');
  // 公制
  eq(1, 'g', 1000, 'mg'); eq(1, 'mg', 1000, 'ug'); eq(1, 'g', 5, 'ct');
  eq(1, 'l', 1, 'dm3'); eq(1, 'ml', 1, 'cm3'); eq(1, 'cm3', 1000, 'mm3'); eq(1, 'mm3', 1, 'ul');
  eq(1, 'l', 10, 'dl'); eq(1, 'dl', 10, 'cl'); eq(1, 'cl', 10, 'ml');
  // 市制容量：石 = 10 斗 = 100 升，升 = 10 合 = 100 勺 = 1000 撮；市升 = 公升
  eq(1, 'shi_dan', 10, 'dou'); eq(1, 'dou', 10, 'shi_l'); eq(1, 'shi_l', 10, 'ge');
  eq(1, 'ge', 10, 'shao'); eq(1, 'shao', 10, 'cuo'); eq(1, 'shi_l', 1, 'l');
  // 英美重量
  eq(1, 'oz', 16, 'dr'); eq(1, 'ozt', 480, 'gr'); eq(1, 'lbt', 12, 'ozt'); eq(1, 'lb', 7000, 'gr');
  eq(1, 'st', 14, 'lb'); eq(1, 'ton_s', 2000, 'lb'); eq(1, 'ton_l', 2240, 'lb');
  // 英美容量
  eq(1, 'gal_us', 8, 'pt_us'); eq(1, 'qt_us', 2, 'pt_us'); eq(1, 'pt_us', 16, 'floz_us');
  eq(1, 'gal_uk', 8, 'pt_uk'); eq(1, 'pt_uk', 20, 'floz_uk'); eq(1, 'gal_us', 231, 'in3');
  eq(1, 'ft3', 1728, 'in3'); assert.ok(close(C.toBase(1, 'in3'), 2.54 ** 3));
  eq(1, 'floz_us', 6, 'tsp_us'); eq(1, 'tbsp_us', 3, 'tsp_us'); eq(1, 'cup_us', 16, 'tbsp_us');
  eq(1, 'tbsp_m', 3, 'tsp_m');
  // 港台·旧制：斤 = 16 两，两 = 10 钱；旧制斤与市斤同重
  eq(1, 'jin_tw', 16, 'liang_tw'); eq(1, 'jin_hk', 16, 'liang_hk'); eq(1, 'jin_old', 16, 'liang_old');
  eq(1, 'liang_tw', 10, 'qian_tw'); eq(1, 'liang_hk', 10, 'qian_hk'); eq(1, 'liang_old', 10, 'qian_old');
  eq(1, 'jin_old', 1, 'jin');
  // 为排满补的英美容量
  eq(1, 'bbl', 42, 'gal_us'); eq(1, 'gal_uk', 4, 'qt_uk'); eq(1, 'qt_uk', 2, 'pt_uk'); eq(1, 'yd3', 27, 'ft3');
  // 精确值本身
  assert.equal(C.toBase(1, 'gr'), 0.06479891);
  assert.equal(C.toBase(1, 'ct'), 0.2);
});

test('每个单位来回换算一圈回到原值', () => {
  for (const u of D.units) {
    for (const x of [0.001, 1, 123.456, 1e6]) {
      assert.ok(close(C.fromBase(C.toBase(x, u.id), u.id), x), `${u.id} @ ${x}`);
    }
  }
});

test('数据完整性：出处非空、id 唯一、枚举合法、网格排得整齐', () => {
  const ids = new Set();
  for (const r of [...D.units, ...D.substances, ...D.items]) {
    assert.ok(r.id && !ids.has(r.id), `重复或缺失 id: ${r.id}`);
    ids.add(r.id);
    assert.ok(typeof r.source === 'string' && r.source.trim(), `${r.id} 缺出处`);
    assert.ok(r.level in D.levels, `${r.id} 级别非法: ${r.level}`);
  }
  for (const u of D.units) {
    assert.ok(['mass', 'volume'].includes(u.kind), u.id);
    assert.ok(u.label && u.label.trim(), `${u.id} 缺显示名`);
    assert.ok(D.groups.some(g => g.id === u.group), `${u.id} 组不存在`);
  }
  assert.equal(D.units.length, 63, '57 个 + 为排满每行补的 6 个同族单位');
  for (const g of D.groups) {
    assert.ok(['common', 'more'].includes(g.tier), `${g.id} tier 非法`);
    const n = D.units.filter(u => u.group === g.id).length;
    // 用户有强迫症：每组都必须排满 3 列，不许最后一行空格子
    assert.ok(n > 0 && n % 3 === 0, `${g.name} 有 ${n} 个单位，不是 3 的倍数`);
  }
  // 用户点名：立方厘米、立方分米、立方米放在同一行（同组内第 k 行 = 下标 3k..3k+2）
  const row = id => { const u = D.units.find(x => x.id === id); const us = D.units.filter(x => x.group === u.group); return u.group + ':' + Math.floor(us.indexOf(u) / 3); };
  assert.ok(row('cm3') === row('dm3') && row('dm3') === row('m3'), '立方厘米、立方分米、立方米不在同一行');
  // 上下行同列对应：台 | 港 | 旧、茶匙 | 汤匙 | 杯、液盎司 | 品脱 | 夸脱
  const col = id => { const u = D.units.find(x => x.id === id); return D.units.filter(x => x.group === u.group).indexOf(u) % 3; };
  for (const ids of [['liang_tw', 'qian_tw'], ['liang_hk', 'qian_hk'], ['liang_old', 'qian_old'], ['tsp_m', 'tsp_us'], ['cup_m', 'cup_us'], ['floz_us', 'floz_uk'], ['qt_us', 'qt_uk']]) {
    assert.equal(col(ids[0]), col(ids[1]), `${ids} 不在同一列`);
  }
  // 首屏只放 21 个：再多就一屏放不下（390×844 实测）
  const common = D.units.filter(u => D.groups.find(g => g.id === u.group).tier === 'common');
  assert.equal(common.length, 21);
  for (const id of ['cm3', 'dm3', 'm3']) assert.ok(common.some(u => u.id === id), `用户点名要的 ${id} 必须在首屏`);
  // 320 宽下格子标签最多放 5 个字
  for (const u of D.units) assert.ok(u.label.length <= 5, `${u.label} 太长`);
  // 同一组内的单位必须连续（页面按 units 的顺序排格子）
  const order = D.units.map(u => u.group).filter((g, i, a) => i === 0 || a[i - 1] !== g);
  assert.equal(new Set(order).size, order.length, '同组单位没有排在一起');
  assert.equal(D.substances[0].id, 'water', '默认物质必须是水');
});

test('图鉴只收标准规定与包装标称（用户 2026-10-07 定：不要经验值）', () => {
  const allowed = ['standard', 'derived', 'label'];
  for (const it of D.items) {
    assert.ok(allowed.includes(it.level), `${it.id} 级别 ${it.level} 不该进图鉴`);
    assert.ok(['mass', 'volume'].includes(it.kind), it.id);
    assert.ok(!it.range, `${it.id} 带了区间：既定标准应是单一数值`);
  }
  assert.ok(!('estimate' in D.levels), '经验值这一级已经撤掉');
});

test('按物质跨重量/容量换算', () => {
  const r = C.convertAll(1, 'l', 'water');
  assert.ok(close(r.jin, 2));
  assert.equal(r.approx, false);
  const f = C.convertAll(1, 'cup_us', 'flour');
  assert.ok(Math.abs(f.g - 137.22) < 0.01, String(f.g));
  assert.equal(f.approx, true, '粉粒状跨类要标约');
  const same = C.convertAll(1, 'jin', 'flour');
  assert.equal(same.g, 500);
  assert.equal(same.liang, 10);
});

test('斤两组合写法', () => {
  assert.equal(C.formatComposite(625, 'jin'), '1斤2两5钱');
  assert.equal(C.formatComposite(500, 'jin'), '1斤');
  assert.equal(C.formatComposite(52, 'jin'), '1两0.4钱');
  assert.equal(C.formatComposite(250, 'jin_old'), '8两');
  assert.equal(C.formatComposite(531.25, 'jin_old'), '1斤1两');
  assert.equal(C.formatComposite(0, 'jin'), '');
  assert.equal(C.formatComposite(0.01, 'jin'), '');
});

test('数字显示不带浮点尾巴', () => {
  assert.equal(C.formatNumber(0.1 + 0.2), '0.3');
  assert.equal(C.formatNumber(1234567.891), '1234568', '整数部分不截断');
  assert.equal(C.formatNumber(100 / 3), '33.3333', '最多 6 位有效数字');
  assert.equal(C.formatNumber(0.000123456789), '0.000123457');
  assert.equal(C.formatNumber(0), '0');
  assert.equal(C.formatNumber(1e-9), '≈0');
  assert.ok(!/e/i.test(C.formatNumber(123456789012)), '大数不用科学计数法');
});

test('格子写法：大数用亿/万亿，小数可减位数', () => {
  assert.equal(C.formatCell(625), '625');
  assert.equal(C.formatCell(99999999), '99999999', '1 亿以下照常');
  assert.equal(C.formatCell(199999998000), '2000亿');
  assert.equal(C.formatCell(99999999000000), '100万亿');
  assert.equal(C.formatCell(123456789), '1.23457亿');
  assert.equal(C.formatCell(0.00000132086, 6), '0.00000132086');
  assert.equal(C.formatCell(0.00000132086, 3), '0.00000132');
  assert.equal(C.formatCell(1e-10), '≈0');
  assert.equal(C.formatCell(0), '0');
  for (const x of [1e8, 3.3e9, 7.7e13, 2e15, 1e20, 1.23e25]) assert.ok(!/e/i.test(C.formatCell(x)), String(x));
  assert.equal(C.formatCell(9999e12), '9999万亿');
  assert.equal(C.formatCell(1e20), '1×10²⁰');
  assert.equal(C.formatCell(1.02e20), '1.02×10²⁰');
  assert.equal(C.formatCell(9.99999e16), '1×10¹⁷', '尾数四舍五入到 10 要进位');
});

test('物品推荐：恰好等于某物品时首推它', () => {
  // 按水算（克 = 毫升）。5000 同时是「一袋大米」和「一桶食用油」，所以判据是「首推的正好 1 倍」，不是认死某一个
  for (const it of D.items) {
    const s = C.suggestItems({ g: it.value, ml: it.value });
    assert.ok(s[0] && close(s[0].ratio, 1), `${it.value} 应首推一个正好 1 倍的物品，实际 ${s.map(x => x.item.id + '×' + x.ratio)}`);
  }
});

test('物品推荐全量程扫描：倍数始终好记、最多两条、量级拉开', () => {
  for (let e = -2; e <= 6; e += 0.125) {
    const v = 10 ** e;
    const s = C.suggestItems({ g: v, ml: v });
    assert.ok(s.length <= 2);
    for (const x of s) assert.ok(x.ratio >= 0.5 && x.ratio <= 20, `${v}: ${x.item.id} ×${x.ratio}`);
    if (s.length === 2) {
      const k = s[0].item.value / s[1].item.value;
      assert.ok(k >= 1.6 || k <= 1 / 1.6, `${v}: ${s[0].item.id} vs ${s[1].item.id}`);
    }
  }
  assert.deepEqual(C.suggestItems({ g: 1e9, ml: 1e9 }), []);
  assert.deepEqual(C.suggestItems({ g: 0, ml: 0 }), []);
});

test('推荐文字：量词不重复、半个、数字与字母之间留空格', () => {
  const pick = (g) => C.suggestItems({ g, ml: g }).map(C.suggestionText);
  assert.ok(pick(495).includes('1.5 罐可乐'), pick(495));
  assert.ok(pick(275).includes('半瓶矿泉水'), pick(275));
  assert.ok(pick(9.98).includes('2 张 A4 纸（80 克规格）'), pick(9.98));
  for (let e = -1; e <= 5; e += 0.25) {
    for (const t of pick(10 ** e)) assert.ok(!/(\S)一\1/.test(t), `量词重复：${t}`);
  }
});

test('输入解析', () => {
  assert.equal(C.parseInput('1,5'), 1.5);
  assert.equal(C.parseInput('1，5'), 1.5);
  assert.equal(C.parseInput(' 2 '), 2);
  assert.equal(C.parseInput('.5'), 0.5);
  assert.equal(C.parseInput(''), null);
  assert.equal(C.parseInput('-3'), null);
  assert.equal(C.parseInput('abc'), null);
  assert.equal(C.parseInput('1.2.3'), null);
});
