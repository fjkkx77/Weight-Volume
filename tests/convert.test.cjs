// 换算内核自检：node --test tests/
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
  // 推导关系：美制液量盎司 = 1/128 美制加仑，英制 = 1/160 英制加仑
  assert.ok(close(C.toBase(128, 'floz_us'), 3785.411784));
  assert.ok(close(C.toBase(160, 'floz_uk'), 4546.09));
});

test('每个单位来回换算一圈回到原值', () => {
  for (const u of D.units) {
    for (const x of [0.001, 1, 123.456, 1e6]) {
      assert.ok(close(C.fromBase(C.toBase(x, u.id), u.id), x), `${u.id} @ ${x}`);
    }
  }
});

test('数据完整性：出处非空、id 唯一、枚举合法', () => {
  const ids = new Set();
  const all = [...D.units, ...D.substances, ...D.items];
  for (const r of all) {
    assert.ok(r.id && !ids.has(r.id), `重复或缺失 id: ${r.id}`);
    ids.add(r.id);
    assert.ok(typeof r.source === 'string' && r.source.trim(), `${r.id} 缺出处`);
    assert.ok(r.level in D.levels, `${r.id} 级别非法: ${r.level}`);
  }
  for (const t of D.tips) assert.ok(t.source && t.source.trim(), `口诀缺出处: ${t.text}`);
  for (const u of D.units) {
    assert.ok(['mass', 'volume'].includes(u.kind), u.id);
    assert.ok(D.groups.some(g => g.id === u.group), `${u.id} 组不存在`);
  }
  for (const it of D.items) assert.ok(['mass', 'volume'].includes(it.kind), it.id);
  assert.equal(D.substances[0].id, 'water', '默认物质必须是水');
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
  assert.equal(C.formatNumber(1234567.891), '1234567.89');
  assert.equal(C.formatNumber(0), '0');
  assert.equal(C.formatNumber(1e-9), '≈0');
  assert.ok(!/e/i.test(C.formatNumber(123456789012)), '大数不用科学计数法');
});

test('物品联动推荐好记', () => {
  const s = C.suggestItems({ g: 500, ml: 500 });
  assert.ok(s.length >= 1 && s.length <= 3);
  for (const x of s) assert.ok(x.ratio >= 0.5 && x.ratio <= 20, `${x.item.id} ${x.ratio}`);
  assert.ok(s.some(x => ['bottle', 'egg'].includes(x.item.id)));
  // 小倍数优先：50 克首推「≈ 1 个鸡蛋」而不是「≈ 8 枚硬币」（LOG_W 过小时会退化）
  assert.equal(C.suggestItems({ g: 50, ml: 50 })[0].item.id, 'egg');
  assert.deepEqual(C.suggestItems({ g: 1e9, ml: 1e9 }), []);
  assert.deepEqual(C.suggestItems({ g: 0, ml: 0 }), []);
  // 不推荐 linkable=false 的物品
  for (const v of [3000, 5000, 8000]) {
    assert.ok(!C.suggestItems({ g: v, ml: v }).some(x => x.item.id === 'watermelon'));
  }
  // 推荐的几个量级要拉开
  const big = C.suggestItems({ g: 1000, ml: 1000 });
  for (let i = 0; i < big.length; i++) for (let j = i + 1; j < big.length; j++) {
    const k = big[i].item.value / big[j].item.value;
    assert.ok(k >= 1.6 || k <= 1 / 1.6, `${big[i].item.id} vs ${big[j].item.id}`);
  }
});

test('物品推荐全量程扫描：倍数始终好记，日常用量都有参照', () => {
  for (let e = -2; e <= 6; e += 0.125) {
    const v = 10 ** e;
    const s = C.suggestItems({ g: v, ml: v });
    for (const x of s) assert.ok(x.ratio >= 0.5 && x.ratio <= 20, `${v}: ${x.item.id} ×${x.ratio}`);
    // 0.1 克 ~ 100 千克是日常会问的量，必须至少给一个参照
    if (v >= 0.1 && v <= 1e5) assert.ok(s.length >= 1, `${v} 没有任何参照`);
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
