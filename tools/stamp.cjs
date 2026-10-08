// 给 index.html 里引用的 js 打上内容指纹：<script src="data.js?v=1a2b3c4d">
// 用法：改完任何 js 后跑 node tools/stamp.cjs（tests/stamp.test.cjs 会拦下忘了跑的情况）
//
// 为什么要：GitHub Pages 对每个文件都给 max-age=600，浏览器各自缓存。发布后十分钟内可能出现
// 「旧 index.html + 新 data.js」——2026-10-08 实测这种组合会让斤两组合、物品参照、同行字号全部失效。
// 带上指纹后，新页面一定拿新 js（地址变了，旧缓存用不上）。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const RE = /<script src="([\w.-]+\.js)(?:\?v=[0-9a-f]*)?"><\/script>/g;

// 先把 CRLF 统一成 LF 再算：Windows 上 git 可能把文件检出成 CRLF，Linux CI 上是 LF，
// 不统一的话同一份内容两边算出不同指纹，CI 会无故报红
function hashOf(file) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 8);
}

// 返回打好指纹的 html；check 模式下只比较、不写
function stamp(html) {
  return html.replace(RE, (m, file) => `<script src="${file}?v=${hashOf(file)}"></script>`);
}

module.exports = { stamp, hashOf, RE };

if (require.main === module) {
  const f = path.join(ROOT, 'index.html');
  const before = fs.readFileSync(f, 'utf8');
  const after = stamp(before);
  if (after === before) { console.log('指纹已是最新'); process.exit(0); }
  fs.writeFileSync(f, after);
  console.log('已更新指纹：', [...after.matchAll(RE)].map(m => m[0].match(/src="([^"]+)"/)[1]).join('  '));
}
