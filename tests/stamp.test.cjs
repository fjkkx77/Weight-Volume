// index.html 里 js 的 ?v= 指纹必须和文件内容对得上（忘了跑 node tools/stamp.cjs 就会报红）
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { stamp, RE } = require('../tools/stamp.cjs');

test('js 引用都带内容指纹且是最新的', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const refs = [...html.matchAll(RE)].map(m => m[0]);
  assert.equal(refs.length, 3, 'data.js / convert.js / pull-to-refresh.js 三个都要走指纹');
  for (const r of refs) assert.match(r, /\?v=[0-9a-f]{8}"/, `${r} 没带指纹`);
  assert.equal(stamp(html), html, '指纹过期了：改完 js 后跑 node tools/stamp.cjs');
});
