// 每个页面里 js / css 的 ?v= 指纹必须和文件内容对得上（忘了跑 node tools/stamp.cjs 就会报红）；
// 生成出来的页面必须和 pages.js + 版式一致（忘了跑 node tools/build-pages.cjs、或手改了生成的页面就会报红）
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { stamp, RE, htmlFiles } = require('../tools/stamp.cjs');
const { build } = require('../tools/build-pages.cjs');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');

test('每个页面的 js / css 引用都带内容指纹且是最新的', () => {
  const files = htmlFiles();
  assert.ok(files.includes('index.html') && files.includes('weight.html'), files.join());
  for (const f of files) {
    const html = read(f);
    const refs = [...html.matchAll(RE)].map(m => m[0]);
    assert.ok(refs.length >= 2, `${f} 引用太少：${refs}`);
    assert.ok(refs.some(r => r.includes('site.css')), `${f} 没引用 site.css`);
    for (const r of refs) assert.match(r, /\?v=[0-9a-f]{8}"$/, `${f}：${r} 没带指纹`);
    assert.equal(stamp(html), html, `${f} 指纹过期了：改完 js / css 后跑 node tools/stamp.cjs`);
  }
  // 引用的文件都得真的存在（拼错文件名时页面会静默缺功能）
  for (const f of files) for (const m of read(f).matchAll(RE)) assert.ok(fs.existsSync(path.join(ROOT, m[2])), `${f} 引用了不存在的 ${m[2]}`);
});

test('生成的页面和 pages.js 对得上', () => {
  for (const [name, html] of Object.entries(build())) {
    assert.ok(fs.existsSync(path.join(ROOT, name)), `${name} 还没生成：跑 node tools/build-pages.cjs`);
    assert.equal(read(name), html, `${name} 和生成结果不一致：别手改，改版式去 tools/build-pages.cjs，然后重新生成`);
  }
});
