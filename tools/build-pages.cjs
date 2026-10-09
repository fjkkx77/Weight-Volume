// 按 pages.js 生成目录页 index.html 和各个换算页（weight.html 是手写的，不生成）。
// 用法：改了 pages.js、加了换算页、或改了下面的版式后跑 node tools/build-pages.cjs（顺带打好指纹）。
//   tests/pages.test.cjs 会拦下「生成结果和仓库里的文件对不上」——手改生成出来的页面会被测试拦。
const fs = require('fs');
const path = require('path');
const PAGES = require('../pages.js');
const { stamp } = require('./stamp.cjs');

const ROOT = path.join(__dirname, '..');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const RESET_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>';
const PTR = `<div id="ptr-indicator" aria-hidden="true">
  <svg class="ptr-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
  <svg class="ptr-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
</div>
<div id="ptr-tip" hidden></div>`;

function head(title, desc) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#F2F2F7" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
<meta name="description" content="${esc(desc)}">
<title>${esc(title)}</title>
<link rel="stylesheet" href="site.css">
</head>`;
}

// 换算页：一张卡 = 标题（点开切换菜单）+ [±] + 归零，常用格子，参照行 +「更多」，收起区
function converterPage(p) {
  return `${head(p.title, p.desc)}
<body>
<!-- 本文件由 tools/build-pages.cjs 按 pages.js 生成，别手改 -->
<div class="container">
  <section class="card" id="cardConvert" aria-labelledby="ttlConvert">
    <div class="head">
      <h1 id="ttlConvert"><button type="button" class="title-btn" id="btnSwitch" aria-haspopup="true" aria-expanded="false">${esc(p.title)}<span class="chev" aria-hidden="true"></span></button></h1>
${p.signed ? '      <button type="button" class="btn-icon btn-sign" id="btnSign" aria-label="正负号（输入零下温度）">±</button>\n' : ''}      <button type="button" class="btn-icon" id="btnReset" aria-label="归零">
        ${RESET_SVG}
      </button>
    </div>
    <div id="groups" class="units"></div>
    <div class="refer-row">
      <div class="refer" id="refer" aria-live="polite"></div>
      <button type="button" class="btn-more" id="btnMore" aria-expanded="false" aria-controls="more"><span id="moreText">更多单位</span><span class="chev" aria-hidden="true"></span></button>
    </div>
    <div id="more" class="units" hidden></div>
${p.live ? '    <p class="note live-note" id="liveNote" aria-live="polite"></p>\n' : ''}  </section>
</div>

${PTR}

<script src="core.js"></script>
<script src="pages.js"></script>
<script src="nav.js"></script>
${(p.before || []).map(f => `<script src="${f}"></script>\n`).join('')}<script src="data-${p.id}.js"></script>
<script src="pull-to-refresh.js"></script>
<script src="grid.js"></script>
${p.live ? `<script src="${p.live}"></script>\n` : ''}<script>
(function () {
  'use strict';
  var D = window.${p.dataVar}, conv = window.WVCore.makeConverter(D.units);
  var menu = window.WVNav.mountSwitcher('${p.id}');
  var grid = window.WVGrid.mount({
    data: D, key: '${p.id}', signed: !!D.signed, tinySci: !!D.tinySci, convert: conv.convertAll, texts: D.texts || null,
    validate: D.validate ? function (v, id) { return D.validate(conv.toBase(v, id)); } : null,
    blocked: menu.isOpen
  });
${p.live ? '  window.WVLive.start(grid, D);   // 页面加载后再拉实时数据（货币：最新汇率）\n' : ''}})();
</script>
</body>
</html>
`;
}

// 目录页：格子直接写进 HTML（不靠脚本渲染，脚本出错也能点）；2 列，只列已上线的
function hubPage() {
  const tiles = PAGES.map(p => `    <a class="tile" href="${p.file}" data-page="${p.id}"><span class="glyph" aria-hidden="true">${esc(p.glyph)}</span><b>${esc(p.name)}</b><small>${esc(p.sample)}</small></a>`).join('\n');
  return `${head('换算合集', '重量、容量、长度、面积、温度等常用单位换算合集，市制、公制、英美制一屏看全')}
<body>
<!-- 本文件由 tools/build-pages.cjs 按 pages.js 生成，别手改 -->
<div class="container">
  <header class="hub-head">
    <h1>换算合集</h1>
    <p>选一种换算，在任意一格输入，其余单位自动算出</p>
  </header>
  <nav class="hub-grid" aria-label="全部换算">
${tiles}
  </nav>
</div>

${PTR}

<script src="pull-to-refresh.js"></script>
<script>window.PullToRefresh.setupPullToRefresh({});</script>
</body>
</html>
`;
}

function build() {
  const out = { 'index.html': hubPage() };
  for (const p of PAGES) if (p.dataVar) out[p.file] = converterPage(p);
  for (const k in out) out[k] = stamp(out[k]);
  return out;
}

module.exports = { build };

if (require.main === module) {
  const out = build();
  for (const [name, html] of Object.entries(out)) {
    const f = path.join(ROOT, name);
    const before = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : '';
    if (before === html) { console.log(name, '无变化'); continue; }
    fs.writeFileSync(f, html);
    console.log(name, '已生成');
  }
}
