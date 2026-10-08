// 给每个页面里引用的 js / css 打上内容指纹：<script src="data.js?v=1a2b3c4d"> / <link rel="stylesheet" href="site.css?v=…">
// 用法：改完任何 js / css 后跑 node tools/stamp.cjs（tests/stamp.test.cjs 会拦下忘了跑的情况）
//   2026-10-09 起换算合集有多个页面、样式也外移成 site.css：扫根目录下所有 .html，css 一起打
//
// 为什么要：GitHub Pages 对每个文件都给 max-age=600，浏览器各自缓存。发布后十分钟内可能出现
// 「旧 index.html + 新 data.js」——2026-10-08 实测这种组合会让斤两组合、物品参照、同行字号全部失效。
// 带上指纹后，新页面一定拿新 js / css（地址变了，旧缓存用不上）。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const RE = /<(script src|link rel="stylesheet" href)="([\w.-]+\.(?:js|css))(?:\?v=[0-9a-f]*)?"/g;

// 先把 CRLF 统一成 LF 再算：Windows 上 git 可能把文件检出成 CRLF，Linux CI 上是 LF，
// 不统一的话同一份内容两边算出不同指纹，CI 会无故报红
function hashOf(file) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 8);
}

function stamp(html) {
  return html.replace(RE, (m, attr, file) => `<${attr}="${file}?v=${hashOf(file)}"`);
}

function htmlFiles() { return fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).sort(); }

module.exports = { stamp, hashOf, RE, htmlFiles };

if (require.main === module) {
  for (const name of htmlFiles()) {
    const f = path.join(ROOT, name);
    const before = fs.readFileSync(f, 'utf8');
    const after = stamp(before);
    if (after === before) { console.log(name, '指纹已是最新'); continue; }
    fs.writeFileSync(f, after);
    console.log(name, '已更新指纹：', [...after.matchAll(RE)].map(m => m[2]).join('  '));
  }
}
