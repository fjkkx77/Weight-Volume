// 真实窄屏视口验证（headless Chrome + CDP），一条命令跑完：node tests/ui.verify.cjs [截图目录]
//   不设 WV_URL 时自己起一个静态服务器服务仓库根目录；找不到 Chrome 时设 CHROME_PATH
//   测线上站：WV_PROXY=<代理> WV_URL=<线上地址> node tests/ui.verify.cjs
// 浏览器工具在 tests/lib/cdp.js（拷自 memory 里的脚手架、改成跨系统，CI 在 Linux 上跑）
const path = require('path');
const fs = require('fs');
const http = require('http');
// 测线上站时 headless Chrome 不会自动走系统代理（直连 github.io 会超时）：
// 设了 WV_PROXY 就给起的 Chrome 补一个 --proxy-server
if (process.env.WV_PROXY) {
  const cp = require('child_process');
  const spawn0 = cp.spawn;
  cp.spawn = (cmd, args, opts) => spawn0(cmd, /chrom/i.test(cmd) ? [...args, '--proxy-server=' + process.env.WV_PROXY] : args, opts);
}
const { open, sleep } = require('./lib/cdp.js');

// 本地静态服务器：只服务仓库根目录下的文件，去掉 ?v= 指纹再找文件
const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(f).pipe(rsp);
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}

let URL = process.env.WV_URL || '';
const SHOTS = process.argv[2] || '';
const results = [];
const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info }); };

// 往某一格「打字」：真的聚焦后用 insertText，走浏览器的 input 事件，不是直接改 value
async function typeInto(c, unitId, text) {
  await c.ev(`(()=>{const el=document.getElementById('u_${unitId}');el.scrollIntoView({block:'center'});el.focus();el.select();})()`);
  await c.send('Input.insertText', { text });
  await sleep(50);
}
const val = (c, unitId) => c.ev(`document.getElementById('u_${unitId}').value`);
const setSub = (c, id) => c.ev(`(()=>{const s=document.getElementById('sub');s.value='${id}';s.dispatchEvent(new Event('change',{bubbles:true}))})()`);

const PAGES = require('../pages.js');
const RATES = require('../rates.js');

// 标题切换菜单：点标题弹出、列出全部换算、当前页描边、点外面收起、不超出屏幕、每项 ≥44px
async function switcherChecks(c, tag, W, id) {
  await c.ev(`document.activeElement.blur(); scrollTo(0,0); document.getElementById('btnSwitch').click()`);
  await sleep(250);
  const m = await c.ev(`(()=>{const m=document.getElementById('switchMenu');const r=m.getBoundingClientRect();const as=[...m.querySelectorAll('a')];return {open:!m.hidden,exp:document.getElementById('btnSwitch').getAttribute('aria-expanded'),n:as.length,cur:as.filter(a=>a.getAttribute('aria-current')==='page').map(a=>a.getAttribute('href')),left:Math.round(r.left),right:Math.round(r.right),small:as.filter(a=>{const b=a.getBoundingClientRect();return b.height<44||b.width<44}).length,home:as[0].getAttribute('href'),cut:[...m.querySelectorAll('b')].filter(b=>b.scrollWidth>b.clientWidth+1).length}})()`);
  ok(`${tag} 点标题弹出切换菜单`, m.open && m.exp === 'true', m);
  ok(`${tag} 菜单列出目录 + 全部 ${PAGES.length} 个换算`, m.n === PAGES.length + 1 && m.home === './', m);
  ok(`${tag} 菜单标出当前页`, m.cur.length === 1 && m.cur[0] === PAGES.find(p => p.id === id).file, m.cur);
  ok(`${tag} 菜单不出屏、每项 ≥44px、名字不截断`, m.left >= 0 && m.right <= W && m.small === 0 && m.cut === 0, m);
  // 主页按钮：页面左上角那一行的最左、≥44px、指向目录
  //   换算页在标题行（.head）；斤两页标题行放不下（有「按水」选择框），放在顶上吸顶导航里
  const hb = await c.ev(`(()=>{const a=document.getElementById('btnHome');if(!a)return null;const r=a.getBoundingClientRect();const row=a.parentElement;return {first:row.firstElementChild===a,row:row.id||row.className,l:Math.round(r.left),t:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),href:a.getAttribute('href')}})()`);
  const wantRow = id === 'weight' ? 'sectionNav' : 'head';
  ok(`${tag} 主页按钮在左上角那一行最左、≥44px、指向目录`, !!hb && hb.first && hb.row === wantRow && hb.w >= 44 && hb.h >= 44 && hb.href === './' && hb.l < 40, hb);
  // 标题行：标题不被挤得截断（看箭头是否超出标题区）；行里各元素都在卡片里、互不重叠、同一行
  const hd = await c.ev(`(()=>{const h=document.querySelector('#cardConvert .head');const card=document.getElementById('cardConvert').getBoundingClientRect();const kids=[...h.children].filter(e=>e.id!=='switchMenu').map(e=>{const r=e.getBoundingClientRect();return {id:e.id||e.tagName,l:Math.round(r.left),r:Math.round(r.right),t:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)}});const t1=document.getElementById('ttlConvert'),tb=document.getElementById('btnSwitch');return {kids,cardL:Math.round(card.left),cardR:Math.round(card.right),titleCut:tb.querySelector('.chev').getBoundingClientRect().right>t1.getBoundingClientRect().right+1}})()`);
  const k0 = hd.kids[0];
  const inCard = hd.kids.every(k => k.l >= hd.cardL && k.r <= hd.cardR);
  const noOverlap = hd.kids.every((k, i) => i === 0 || k.l >= hd.kids[i - 1].r);
  const oneRow = hd.kids.every(k => Math.abs(k.t + k.h / 2 - (k0.t + k0.h / 2)) <= 2);
  ok(`${tag} 标题行不截断、不重叠、不出卡片、同一行`, !hd.titleCut && inCard && noOverlap && oneRow, hd);
  await c.ev(`document.body.click()`);
  await sleep(100);
  ok(`${tag} 点外面收起菜单`, await c.ev(`document.getElementById('switchMenu').hidden && document.getElementById('btnSwitch').getAttribute('aria-expanded')==='false'`));
}

// 目录页 + 生成出来的换算页（长度 / 面积 / 温度）
async function runCollection(W, H, dark) {
  const tag = `${W}${dark ? '-dark' : ''}`;
  const c = await open(W, H, 3);
  const overflow = async (label) => {
    const m = await c.ev('({sw:document.documentElement.scrollWidth, iw:innerWidth})');
    ok(`${tag} 无横向溢出 @${label}`, m.sw <= W && m.iw <= W, m);
  };
  try {
    await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] });
    // ---------- 目录 ----------
    await c.goto(URL);
    ok(`${tag} 目录：标题`, (await c.ev('document.title')) === '换算合集');
    const tiles = await c.ev(`[...document.querySelectorAll('.tile')].map(a=>{const r=a.getBoundingClientRect();return {href:a.getAttribute('href'),w:Math.round(r.width),h:Math.round(r.height),bottom:Math.round(r.bottom),cut:a.querySelector('b').scrollWidth>a.querySelector('b').clientWidth+1||(${W >= 390}&&a.querySelector('small').scrollWidth>a.querySelector('small').clientWidth+1),lines:Math.round(a.querySelector('small').getBoundingClientRect().height/parseFloat(getComputedStyle(a.querySelector('small')).lineHeight))}})`);
    // 代表单位只占一行（截图里「密位」被拆成两行）；390 / 430 宽要完整显示，320 允许省略号
    ok(`${tag} 目录：代表单位一行`, tiles.every(t => t.lines === 1), tiles.map(t => t.lines));
    ok(`${tag} 目录：每个换算一个格子`, tiles.map(t => t.href).join() === PAGES.map(p => p.file).join(), tiles.map(t => t.href));
    ok(`${tag} 目录：格子 ≥44px、文字不截断`, tiles.every(t => t.w >= 44 && t.h >= 44 && !t.cut), tiles);
    // 一屏看全：390 / 430 判（85% 给 Safari 工具栏留位置，同换算页）；320×568 太矮，只记录
    const hubBottom = Math.max(...tiles.map(t => t.bottom));
    if (W >= 390) ok(`${tag} 目录：一屏看全（底边 ${hubBottom} ≤ ${Math.round(H * 0.85)}）`, hubBottom <= H * 0.85, hubBottom);
    else console.log(`  ${tag} 目录底边 ${hubBottom}（屏高 ${H}，不判）`);
    const cols = await c.ev(`getComputedStyle(document.querySelector('.hub-grid')).gridTemplateColumns.split(' ').length`);
    ok(`${tag} 目录：3 列排满`, cols === 3 && tiles.length % 3 === 0, { cols, n: tiles.length });
    await overflow('目录');
    if (SHOTS) await c.vshot(path.join(SHOTS, `${tag}-hub.png`));
    await c.ev(`document.querySelector('.tile[data-page=length]').click()`);
    await sleep(800);
    ok(`${tag} 目录：点格子进入换算页`, (await c.ev('location.pathname')).endsWith('/length.html'));

    for (const p of PAGES.filter(x => x.dataVar)) {
      const t2 = `${tag} ${p.id}`;
      // 先在当前页（同一个站）关掉货币页联网，再打开货币页：否则第一次打开时发出的实时请求
      //   可能在清缓存之后才回来，把新汇率写回缓存（2026-10-09 CI 能连上汇率接口时踩到，1 美元变成当天的 6.7331）
      const prep = `sessionStorage.clear(); localStorage.clear()${p.id === 'currency' ? "; localStorage.setItem('wv.currency.nolive','1')" : ''}`;
      await c.ev(prep);
      await c.goto(URL + p.file);
      await c.ev(prep);
      await c.goto(URL + p.file);
      const n = await c.ev(`window.${p.dataVar}.units.length`);
      ok(`${t2} 标题`, (await c.ev('document.title')) === p.title);
      ok(`${t2} 每个单位一格`, (await c.ev(`document.querySelectorAll('.cell').length`)) === n, n);
      ok(`${t2} CSS 已加载、每行 3 格`, await c.ev(`getComputedStyle(document.querySelector('.card')).borderRadius==='20px' && [...document.querySelectorAll('.grid')].every(g=>getComputedStyle(g).gridTemplateColumns.split(' ').length===3)`));
      await overflow(p.id);
      const small = await c.ev(`[...document.querySelectorAll('button, .cell')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.height<44||r.width<44)}).map(e=>(e.id||e.className))`);
      ok(`${t2} 触摸目标 ≥44px`, small.length === 0, small);
      const cut = await c.ev(`[...document.querySelectorAll('.cell label, .cap')].filter(l=>l.scrollWidth>l.clientWidth+1).map(l=>l.textContent)`);
      ok(`${t2} 单位名、分组标题不截断`, cut.length === 0, cut);
      const bottom = await c.ev(`Math.round(Math.max(...[...document.querySelectorAll('#groups .cell')].map(e=>e.getBoundingClientRect().bottom)))`);
      if (W >= 390) ok(`${t2} 常用格一屏看全（底边 ${bottom} ≤ ${Math.round(H * 0.85)}）`, bottom <= H * 0.85, bottom);
      ok(`${t2} 提示行`, (await c.ev(`document.getElementById('refer').textContent`)).includes('任意一格'));
      ok(`${t2} ± 键只有温度有`, (await c.ev(`!!document.getElementById('btnSign')`)) === !!p.signed);
      await switcherChecks(c, t2, W, p.id);
      if (SHOTS) await c.vshot(path.join(SHOTS, `${tag}-${p.id}-0-empty.png`));

      // 换算正确（各页挑几个有代表性的）
      const checks = {
        // 极小值写成科学计数（tinySci）：1 米 = 6.685×10⁻¹² 天文单位，1 平方厘米 = 1×10⁻¹⁰ 平方千米
        length: [['m', '1', { chi: '3', cun: '30', cm: '100', ft: '3.28084', au: '6.685×10⁻¹²' }], ['mi', '1', { m: '1609.34', km: '1.60934' }], ['li', '2', { km: '1' }]],
        area: [['ha', '1', { mu: '15', m2: '10000', are: '100' }], ['mu', '1', { m2: '666.667', chi2: '6000' }], ['acre', '1', { m2: '4046.86' }], ['cm2', '1', { km2: '1×10⁻¹⁰' }]],
        temperature: [['c', '37', { f: '98.6', k: '310.15' }], ['f', '-40', { c: '-40' }], ['k', '0', { c: '-273.15', f: '-459.67' }]],
        // 第二批（期望值和独立算式核对过：100/3.6、100/1.609344、π/2、3.6e6/4184……）
        speed: [['kmh', '100', { ms: '27.7778', mph: '62.1371', kn: '53.9957' }], ['kn', '1', { kmh: '1.852' }]],
        angle: [['deg', '90', { rad: '1.5708', gon: '100', min: '5400' }], ['rev', '1', { deg: '360', mil_nato: '6400', mil6000: '6000' }]],
        fuel: [['l100km', '8', { kmpl: '12.5', mpg_us: '29.4018', mpg_uk: '35.3101' }], ['mpg_us', '30', { l100km: '7.84049', kmpl: '12.7543' }]],
        energy: [['kcal', '1', { kj: '4.184', j: '4184', cal: '1000' }], ['kwh', '1', { mj: '3.6', kcal: '860.421', btu: '3412.14' }]],
        power: [['ps', '1', { w: '735.499', kw: '0.735499', hp: '0.98632' }]],
        pressure: [['atm', '1', { kpa: '101.325', mmhg: '760', psi: '14.6959', bar: '1.01325' }], ['bar', '2.5', { psi: '36.2594', kpa: '250' }]],
        force: [['kgf', '1', { n: '9.80665', lbf: '2.20462', gf: '1000' }]],
        // 货币：关掉联网、用仓库快照，期望值从快照现算（5 位有效数字）
        currency: [['cny', '100', Object.fromEntries(['usd', 'hkd', 'jpy', 'twd'].map(k => [k, String(Number((100 / RATES.rates[k.toUpperCase()].cny).toPrecision(5)))]))],
          ['usd', '1', { cny: String(Number(RATES.rates.USD.cny.toPrecision(5))) }]]
      }[p.id];
      for (const [from, text, want] of checks) {
        await typeInto(c, from, text);
        const got = {};
        for (const k in want) got[k] = await val(c, k);
        ok(`${t2} ${text} ${from} 换算`, Object.keys(want).every(k => got[k] === want[k]), got);
        ok(`${t2} ${text} ${from} 只有起点格高亮`, (await c.ev(`[...document.querySelectorAll('.cell.src')].map(e=>e.dataset.unit).join()`)) === from);
      }
      // 「更多」：展开后全部可见、每格 ≥44、名字不截断；记住展开状态
      //   没有「更多」单位的页（力）：按钮和收起区都不该出现
      const wantMore = await c.ev(`window.${p.dataVar}.units.filter(u=>window.${p.dataVar}.groups.find(g=>g.id===u.group).tier==='more').length`);
      if (!wantMore) {
        ok(`${t2} 没有更多单位时不显示「更多」按钮`, await c.ev(`!document.getElementById('btnMore') && !document.getElementById('more')`));
      } else {
        await c.ev(`document.activeElement.blur(); document.getElementById('btnMore').click()`);
        await sleep(100);
        const vis = await c.ev(`[...document.querySelectorAll('#more .cell')].filter(e=>e.getBoundingClientRect().height>=44).length`);
        ok(`${t2} 展开后「更多」${wantMore} 格全部可见`, vis === wantMore, vis);
        ok(`${t2} 展开后按钮变成收起`, (await c.ev(`document.getElementById('moreText').textContent`)) === '收起');
        const cut2 = await c.ev(`[...document.querySelectorAll('#more .cell label, #more .cap')].filter(l=>l.scrollWidth>l.clientWidth+1).map(l=>l.textContent)`);
        ok(`${t2} 更多区名称不截断`, cut2.length === 0, cut2);
      }
      // 极端值：数字都放得下、同一行字号一致
      for (const [u, t] of (p.id === 'temperature' ? [['c', '99999999'], ['k', '0.001'], ['c', '-273.15']] : [[checks[0][0], '99999999'], [checks[0][0], '0.000001']])) {
        await typeInto(c, u, t);
        const clipped = await c.ev(`[...document.querySelectorAll('.cell input')].filter(i=>i.scrollWidth>i.clientWidth+1).map(i=>i.id+'='+i.value)`);
        ok(`${t2} ${u}=${t} 时数字不被截断`, clipped.length === 0, clipped);
      }
      const uneven = await c.ev(`(()=>{const bad=[];document.querySelectorAll('.grid').forEach(g=>{const cs=[...g.children];for(let i=0;i<cs.length;i+=3){const f=cs.slice(i,i+3).map(c=>getComputedStyle(c.querySelector('input')).fontSize);if(new Set(f).size>1)bad.push(cs[i].dataset.unit+':'+f.join('/'))}});return bad})()`);
      ok(`${t2} 同一行字号一致`, uneven.length === 0, uneven);
      await overflow(p.id + ' 极端值');

      if (p.id === 'fuel') {
        await typeInto(c, 'l100km', '0');
        const inv = await c.ev(`({bad:document.querySelector('.cell[data-unit=l100km]').classList.contains('invalid'),k:document.getElementById('u_kmpl').value,refer:document.getElementById('refer').textContent,own:document.getElementById('u_l100km').value})`);
        ok(`${t2} 0 升/百公里 标红、不算、说明原因`, inv.bad && inv.k === '' && inv.refer.includes('不能是 0') && inv.own === '0', inv);
      }
      if (p.id === 'currency') {
        const note = await c.ev(`document.getElementById('liveNote').textContent`);
        ok(`${t2} 写明汇率日期、来源、不是银行牌价`, note.includes(RATES.date.slice(0, 4) + ' 年') && note.includes('中间价') && note.includes('不是银行买卖价') && note.includes('之前存下的'), note);
        // 实时更新：把 fetch 换成假的接口（欧元基准原始数），重新打开页面，汇率要换成新的、说明里不再说「之前存下的」
        await c.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const D='2099-01-02'; const mk=(p,pairs)=>pairs.map(([q,r])=>({date:D,base:'EUR',quote:q,rate:r}));
          const data={CFETS:mk('CFETS',[['CNY',8],['EUR',1],['USD',1.6],['HKD',8],['JPY',160],['GBP',0.8],['AUD',1.6],['NZD',1.6],['SGD',1.6],['CHF',1],['CAD',1.6],['MOP',8],['MYR',4],['RUB',80],['ZAR',16],['KRW',1600],['AED',4],['SAR',4],['HUF',400],['PLN',4],['DKK',8],['SEK',8],['NOK',8],['TRY',40],['MXN',16],['THB',40]]),
            ECB:mk('ECB',[['CNY',8],['BRL',4],['CZK',20],['IDR',16000],['INR',80],['PHP',40],['RON',4]]),AMCM:mk('AMCM',[['CNY',8],['TWD',32]])};
          window.fetch = url => { const p = /providers=(\\w+)/.exec(url)[1]; return Promise.resolve({ ok: true, json: () => Promise.resolve(data[p]) }); }; })()` });
        await c.ev(`localStorage.removeItem('wv.currency.nolive')`);
        await c.goto(URL + p.file);
        await sleep(300);
        await typeInto(c, 'usd', '1');
        const live = { cny: await val(c, 'cny'), note: await c.ev(`document.getElementById('liveNote').textContent`) };
        ok(`${t2} 拉到新汇率后换算跟着变（假接口：1 美元 = 8 ÷ 1.6 = 5 人民币）`, live.cny === '5' && live.note.includes('2099 年 1 月 2 日') && !live.note.includes('之前存下的'), live);
        await c.ev(`localStorage.setItem('wv.currency.nolive','1'); localStorage.removeItem('wv.currency.rates')`);
        await c.ev(`document.getElementById('btnReset').click()`);
      }
      if (p.id === 'temperature') {
        // 负号：只打一个「-」不标红；± 键给正在输入的格子加负号、焦点不丢（键盘不收）
        await typeInto(c, 'c', '-');
        ok(`${t2} 只打负号不标红`, !(await c.ev(`document.querySelector('.cell[data-unit=c]').classList.contains('invalid')`)) && (await val(c, 'f')) === '');
        await typeInto(c, 'c', '40');
        await c.ev(`document.getElementById('btnSign').click()`);
        ok(`${t2} ± 键变成 −40`, (await val(c, 'c')) === '-40' && (await val(c, 'f')) === '-40', [await val(c, 'c'), await val(c, 'f')]);
        ok(`${t2} 按 ± 后焦点还在输入框`, (await c.ev(`document.activeElement.id`)) === 'u_c');
        await c.ev(`document.getElementById('btnSign').click()`);
        ok(`${t2} 再按 ± 变回 40`, (await val(c, 'c')) === '40' && (await val(c, 'f')) === '104');
        // 低于绝对零度：起点标红、别的清空、提示原因
        await typeInto(c, 'k', '-1');
        const inv = await c.ev(`({bad:document.querySelector('.cell[data-unit=k]').classList.contains('invalid'),c:document.getElementById('u_c').value,refer:document.getElementById('refer').textContent})`);
        ok(`${t2} −1 K 标红、不算、说明原因`, inv.bad && inv.c === '' && inv.refer.includes('绝对零度'), inv);
        // 截图发现过：标红后用户打的「-1」被清空，只剩占位的 0
        ok(`${t2} 标红后保留用户打的字`, (await val(c, 'k')) === '-1', await val(c, 'k'));
        ok(`${t2} 提示行变红`, await c.ev(`document.getElementById('refer').classList.contains('bad')`));
        await typeInto(c, 'k', '1');
        ok(`${t2} 改回合法值后提示不再是红的`, !(await c.ev(`document.getElementById('refer').classList.contains('bad')`)) && (await val(c, 'c')) === '-272.15');
        if (SHOTS) { await c.ev(`document.activeElement.blur(); scrollTo(0,0)`); await sleep(250); await c.vshot(path.join(SHOTS, `${tag}-${p.id}-2-invalid.png`)); }
      }
      // 刷新后输入还在、展开状态记得
      const first = checks[0];
      await typeInto(c, first[0], first[1]);
      await c.ev(`document.activeElement.blur(); scrollTo(0,0)`);
      if (SHOTS) { await sleep(250); await c.vshot(path.join(SHOTS, `${tag}-${p.id}-1-filled.png`)); }
      await c.goto(URL + p.file);
      const k0 = Object.keys(first[2])[0];
      ok(`${t2} 刷新后输入还在`, (await val(c, first[0])) === first[1] && (await val(c, k0)) === first[2][k0]);
      if (wantMore) ok(`${t2} 刷新后展开状态记得`, await c.ev(`!document.getElementById('more').hidden`));
      await c.ev(`document.getElementById('btnReset').click()`);
      ok(`${t2} 归零清空`, (await val(c, k0)) === '' && (await c.ev(`document.querySelectorAll('.cell.src').length`)) === 0);
      ok(`${t2} 无 JS 报错`, c.errors.length === 0, c.errors);
    }
    // ---------- 页面之间跳转（2026-10-09 用户：开了几层还得一层层返回 → 切换不叠历史 + 主页按钮） ----------
    const where = () => c.ev('document.title');
    const HUB_T = '换算合集';
    // 找不到菜单（比如上一步没回到预期的页）就记一条失败，不让整套测试崩掉
    const menuGo = async sel => {
      const has = await c.ev(`!!document.getElementById('btnSwitch')`);
      if (!has) { ok(`${tag} 打开菜单（当前页 ${await c.ev('location.pathname')} 没有菜单）`, false); return; }
      await c.ev(`document.getElementById('btnSwitch').click()`); await sleep(150); await c.ev(`document.querySelector('#switchMenu ${sel}').click()`); await sleep(800);
    };
    // 目录 → 长度 → 菜单切面积 → 菜单切温度：历史条数不变，左滑（返回）一次就回目录
    await c.goto(URL);
    await c.ev(`document.querySelector('.tile[data-page=length]').click()`);
    await sleep(800);
    const h0 = await c.ev('history.length');
    // 离开页面那一刻菜单必须已经收起：Safari 拿这一刻的画面做左滑返回的快照（用户真机截图：返回时先闪出菜单）
    await c.ev(`window.addEventListener('beforeunload', () => sessionStorage.setItem('menuAtLeave', String(document.getElementById('switchMenu').hidden)))`);
    await menuGo('a[href="area.html"]');
    ok(`${tag} 菜单跳到面积换算`, (await c.ev('location.pathname')).endsWith('/area.html'));
    ok(`${tag} 跳走时菜单已收起（返回快照里不带菜单）`, (await c.ev(`sessionStorage.getItem('menuAtLeave')`)) === 'true', await c.ev(`sessionStorage.getItem('menuAtLeave')`));
    await menuGo('a[href="temperature.html"]');
    const h1 = await c.ev('history.length');
    ok(`${tag} 菜单切换不叠历史（目录→长度→面积→温度）`, (await c.ev('location.pathname')).endsWith('/temperature.html') && h1 === h0, { h0, h1 });
    await c.ev('history.back()');
    await sleep(800);
    ok(`${tag} 切了两次后返回一次就回目录`, (await where()) === HUB_T, await where());
    // 再前进回温度：bfcache 恢复的页面菜单是收起的
    await c.ev('history.forward()');
    await sleep(800);
    ok(`${tag} 前进回来菜单是收起的`, (await c.ev(`location.pathname.endsWith('/temperature.html') && document.getElementById('switchMenu').hidden`)) === true, await c.ev('location.pathname'));
    // 主页按钮（从目录进来的）：退回目录，不新增一条——前进还能回到温度
    await c.ev(`document.getElementById('btnHome').click()`);
    await sleep(800);
    ok(`${tag} 主页按钮回到目录`, (await where()) === HUB_T, await where());
    ok(`${tag} 主页按钮是退回目录（历史不多一条）`, (await c.ev('history.length')) === h1, { h1, now: await c.ev('history.length') });
    await c.ev('history.forward()');
    await sleep(800);
    ok(`${tag} 回目录后前进还是温度`, (await c.ev('location.pathname')).endsWith('/temperature.html'));
    // 菜单里的「全部换算」同样是退回目录
    await menuGo('a.home');
    ok(`${tag} 菜单回到目录`, (await where()) === HUB_T && (await c.ev('history.length')) === h1, { t: await where(), len: await c.ev('history.length') });
    // 直接打开的换算页（书签 / 别人发的链接，底下没有目录）：主页按钮正常跳到目录，返回还能回来
    await c.goto(URL + 'force.html');
    await c.ev(`document.getElementById('btnHome').click()`);
    await sleep(800);
    ok(`${tag} 直接打开的页：主页按钮到目录`, (await where()) === HUB_T, await where());
    await c.ev('history.back()');
    await sleep(800);
    ok(`${tag} 直接打开的页：从目录返回还能回到原页`, (await c.ev('location.pathname')).endsWith('/force.html'));
    ok(`${tag} 合集各页无 JS 报错`, c.errors.length === 0, c.errors);
  } finally {
    c.close();
  }
}

async function run(W, H, dark) {
  const tag = `${W}${dark ? '-dark' : ''}`;
  const c = await open(W, H, 3);
  try {
    await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] });
    await c.goto(URL + 'weight.html');
    ok(`${tag} 页面标题`, (await c.ev('document.title')) === '斤两换算');
    ok(`${tag} CSS 已加载`, (await c.ev("getComputedStyle(document.querySelector('.card')).borderRadius")) === '20px');
    ok(`${tag} 每个单位一格`, (await c.ev("document.querySelectorAll('.cell').length")) === (await c.ev('WV_DATA.units.length')));
    const bg = await c.ev("getComputedStyle(document.body).backgroundColor");
    ok(`${tag} 主题背景`, dark ? bg === 'rgb(0, 0, 0)' : bg === 'rgb(242, 242, 247)', bg);
    ok(`${tag} 每行 3 格`, await c.ev(`[...document.querySelectorAll('.grid')].every(g=>getComputedStyle(g).gridTemplateColumns.split(' ').length===3)`));

    const overflow = async (label) => {
      const m = await c.ev('({sw:document.documentElement.scrollWidth, iw:innerWidth})');
      ok(`${tag} 无横向溢出 @${label}`, m.sw <= W && m.iw <= W, m);
    };
    await overflow('初始');

    const small = await c.ev(`[...document.querySelectorAll('button, .cell, select')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.height<44||r.width<44)}).map(e=>(e.id||e.className)+':'+Math.round(e.getBoundingClientRect().width)+'x'+Math.round(e.getBoundingClientRect().height))`);
    ok(`${tag} 触摸目标 ≥44px`, small.length === 0, small);
    const cut = await c.ev(`[...document.querySelectorAll('.cell label')].filter(l=>l.scrollWidth>l.clientWidth).map(l=>l.textContent)`);
    ok(`${tag} 单位名没被省略号截断`, cut.length === 0, cut);

    // 1.25 斤：换算正确、只有起点格高亮、组合写法
    await typeInto(c, 'jin', '1.25');
    ok(`${tag} 1.25 斤 = 625 克`, (await val(c, 'g')) === '625');
    ok(`${tag} 1.25 斤 = 12.5 两`, (await val(c, 'liang')) === '12.5');
    ok(`${tag} 正在编辑的格子保留原文`, (await val(c, 'jin')) === '1.25');
    const srcs = await c.ev(`[...document.querySelectorAll('.cell.src')].map(e=>e.dataset.unit)`);
    ok(`${tag} 只有起点格高亮`, srcs.length === 1 && srcs[0] === 'jin', srcs);
    await sleep(300);   // 描边/底色有 .2s 过渡，读早了是中间值
    const hl = await c.ev(`(()=>{const s=getComputedStyle(document.querySelector('.cell[data-unit=jin]')),o=getComputedStyle(document.querySelector('.cell[data-unit=g]'));return {src:s.borderTopColor,other:o.borderTopColor,srcBg:s.backgroundColor,otherBg:o.backgroundColor}})()`);
    const blue = dark ? 'rgb(10, 132, 255)' : 'rgb(0, 122, 255)';
    ok(`${tag} 起点格蓝描边、底色与其他格不同`, hl.src === blue && hl.other !== blue && hl.srcBg !== hl.otherBg, hl);
    ok(`${tag} 市制组合写法`, (await c.ev(`document.querySelector('[data-comp="shi"]').textContent`)) === '1斤2两5钱');
    ok(`${tag} 旧制组合写法`, (await c.ev(`document.querySelector('[data-comp="old"]').textContent`)) === '旧制 1斤4两');
    const refer = await c.ev(`document.getElementById('refer').textContent`);
    ok(`${tag} 物品参照一行`, refer.startsWith('相当于 ') && !/(\S)一\1/.test(refer), refer);
    ok(`${tag} 水：1 升 = 2 斤`, await (async () => { await typeInto(c, 'l', '1'); return (await val(c, 'jin')) === '2'; })());

    // 一屏看全：首屏 21 个常用单位的最后一行不超过屏高 85%（给 Safari 地址栏/工具栏留位置，85% 是估算）。
    // 2026-10-08 加了吸顶导航，用户同意参照行和「更多」按钮被挤到首屏下面，所以只判 21 格。320×568 太矮，只记录不判
    await c.ev(`document.activeElement.blur(); scrollTo(0,0)`);
    await sleep(100);
    const bottom = await c.ev(`Math.round(Math.max(...[...document.querySelectorAll('#groups .cell')].map(e=>e.getBoundingClientRect().bottom)))`);
    if (W >= 390) ok(`${tag} 常用 21 格一屏看全（底边 ${bottom} ≤ ${Math.round(H * 0.85)}）`, bottom <= H * 0.85, bottom);
    else console.log(`  ${tag} 常用格底边 ${bottom}（屏高 ${H}，不判）`);

    await switcherChecks(c, tag, W, 'weight');

    // 吸顶导航：点「物品」「参照」跳到对应卡片且落在导航条下方，高亮跟着走；点「换算」回到顶
    const navTo = async (id) => { await c.ev(`document.querySelector('.nav-item[data-target=${id}]').click()`); await sleep(1000); };
    const cur = () => c.ev(`document.querySelector('.nav-item[aria-current=true]').dataset.target`);
    ok(`${tag} 导航默认高亮换算`, (await cur()) === 'cardConvert');
    ok(`${tag} 导航只有换算、物品两项（参照已并进物品）`, (await c.ev(`[...document.querySelectorAll('.nav-item')].map(b=>b.textContent).join()`)) === '换算,物品' && !(await c.ev(`!!document.getElementById('cardItems')`)));
    {
      const id = 'cardObjects';
      await navTo(id);
      const g = await c.ev(`(()=>{const n=document.getElementById('sectionNav').getBoundingClientRect(),t=document.getElementById('${id}').getBoundingClientRect();return {navTop:Math.round(n.top),navBottom:Math.round(n.bottom),top:Math.round(t.top),bottom:Math.round(t.bottom),atEnd:scrollY+innerHeight>=document.documentElement.scrollHeight-2}})()`);
      // 物品卡是最后一张：页面滚到底了还贴不住导航时（430 宽屏高 932），要求整张卡都在屏内
      const landed = g.top >= g.navBottom && (g.top - g.navBottom <= 12 || (g.atEnd && g.bottom <= H));
      ok(`${tag} 导航跳到 ${id}、不被导航条盖住`, landed && g.navTop >= 0 && g.navTop <= 20, g);
      ok(`${tag} 导航高亮跟到 ${id}`, (await cur()) === id, await cur());
      // 导航条上方的缝不能透出底下的格子（审查截图露出半截「打兰 / 盎司」）
      const gap = await c.ev(`(()=>{const n=document.getElementById('sectionNav').getBoundingClientRect();const hit=[];for(let x=2;x<innerWidth;x+=20)for(let y=1;y<n.top;y+=3){const e=document.elementFromPoint(x,y);if(e&&e.closest('.cell,.cap,.refer-row'))hit.push(x+','+y)}return hit})()`);
      ok(`${tag} 吸顶导航上方不透出下面的内容`, gap.length === 0, gap.slice(0, 5));
    }
    await overflow('导航跳转后');
    if (SHOTS) await c.vshot(path.join(SHOTS, `${tag}-3-nav.png`));
    await navTo('cardConvert');
    const back = { y: await c.ev('scrollY'), cur: await cur() };
    ok(`${tag} 导航回到换算区顶`, back.y < 5 && back.cur === 'cardConvert', back);

    // 生活物品：输入几个/几张，克数、斤两、换算区全部跟着算；反过来输入斤也算出个数
    await typeInto(c, 'n_egg', '3');
    ok(`${tag} 3 个鸡蛋 = 183 克`, (await val(c, 'g')) === '183');
    const sum = await c.ev(`document.getElementById('objSum').textContent`);
    ok(`${tag} 物品卡合计`, sum.includes('183 克') && sum.includes('3两6.6钱'), sum);
    const cws = await c.ev(`[...document.querySelectorAll('#objects .cell')].map(e=>e.querySelector('.cw')?.textContent||'').join('')`);
    ok(`${tag} 每个物品格都带量词`, cws.length === 24 && !cws.includes(' '), cws);
    await typeInto(c, 'n_c1y', '100');
    ok(`${tag} 100 枚 1 元硬币 = 475 克`, (await val(c, 'g')) === '475', await val(c, 'g'));
    ok(`${tag} 硬币组标明非官方`, (await c.ev(`document.querySelector('[data-group=i_coin] .cap').textContent`)).includes('非官方'));
    ok(`${tag} 读屏能听出是张数`, (await c.ev(`document.getElementById('u_n_rmb100').getAttribute('aria-label')`)) === '100 元，张数');
    await typeInto(c, 'n_rmb100', '100');
    ok(`${tag} 100 张百元 = 115 克`, (await val(c, 'g')) === '115');
    await typeInto(c, 'n_a4', '500');
    ok(`${tag} 500 张 A4 = 2494.8 克`, (await val(c, 'g')) === '2494.8');
    await typeInto(c, 'n_cola', '3');
    ok(`${tag} 3 罐可乐 = 990 克、合计带内装毫升`, (await val(c, 'g')) === '990' && (await c.ev(`document.getElementById('objSum').textContent`)).includes('内装 990 毫升'));
    const refer1 = await c.ev(`document.getElementById('refer').textContent`);
    ok(`${tag} 不推荐起点格自己`, !refer1.includes('罐可乐'), refer1);
    // 审查 bug：选面粉 / 食用油时，可乐、桶装水不能跟着变
    await setSub(c, 'flour');
    ok(`${tag} 按面粉时 3 罐可乐仍是 990 克`, (await val(c, 'g')) === '990', await val(c, 'g'));
    ok(`${tag} 起点是物品时不提示粉粒只是大概`, !(await c.ev(`document.getElementById('refer').textContent`)).includes('大概'));
    await setSub(c, 'oil');
    await typeInto(c, 'n_jug', '1');
    ok(`${tag} 按食用油时 1 桶桶装水仍是 18900 克`, (await val(c, 'g')) === '18900', await val(c, 'g'));
    await setSub(c, 'water');
    await typeInto(c, 'jin', '1');
    ok(`${tag} 1 斤 ≈ 8.2 个鸡蛋（不带假精度）`, (await val(c, 'n_egg')) === '8.2', await val(c, 'n_egg'));
    ok(`${tag} 1 斤 ≈ 434.8 张百元`, (await val(c, 'n_rmb100')) === '434.8', await val(c, 'n_rmb100'));
    const capCut = await c.ev(`[...document.querySelectorAll('.cap')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent)`);
    ok(`${tag} 分组标题（含规格）不被截断`, capCut.length === 0, capCut);
    ok(`${tag} 人民币组标明非官方`, (await c.ev(`document.querySelector('[data-group=i_rmb] .cap').textContent`)).includes('非官方'));
    // 键盘弹出时浏览器把输入框滚进视野：不能停在吸顶导航条底下
    await c.ev(`scrollTo(0, document.body.scrollHeight)`); await sleep(100);
    const hid = await c.ev(`(()=>{const el=document.getElementById('u_n_pingpong');el.focus();const n=document.getElementById('sectionNav').getBoundingClientRect();return {cell:Math.round(el.parentNode.getBoundingClientRect().top),nav:Math.round(n.bottom)}})()`);
    ok(`${tag} 聚焦物品格不被导航条挡住`, hid.cell >= hid.nav, hid);
    // 物品卡自己的归零：数字清空、物质回到水
    await setSub(c, 'salt');
    await c.ev(`document.activeElement.blur(); document.getElementById('btnReset2').click(); scrollTo(0,0)`);
    ok(`${tag} 物品卡归零：清空且物质回到水`, !(await c.ev(`document.getElementById('objSum').textContent`)).includes('克') && (await val(c, 'g')) === '' && (await c.ev(`document.getElementById('sub').value`)) === 'water');
    // 输入 0：参照行不留白
    await typeInto(c, 'jin', '0');
    ok(`${tag} 输入 0 时参照行有提示`, (await c.ev(`document.getElementById('refer').textContent`)).length > 0);
    // 全角数字
    await typeInto(c, 'jin', '１２');
    ok(`${tag} 全角数字照收`, (await val(c, 'g')) === '6000', await val(c, 'g'));
    await c.ev(`document.activeElement.blur(); document.getElementById('btnReset').click(); scrollTo(0,0)`);

    // 「更多单位」：默认收起、按钮在首屏内；展开后 36 格可见、标签不截断；状态刷新后记得
    ok(`${tag} 更多单位默认收起`, await c.ev(`document.getElementById('more').hidden && document.getElementById('btnMore').getAttribute('aria-expanded')==='false'`));
    await c.ev(`document.getElementById('btnMore').click()`);
    await sleep(100);
    const vis = await c.ev(`[...document.querySelectorAll('#more .cell')].filter(e=>e.getBoundingClientRect().height>0).length`);
    const wantMore = await c.ev(`WV_DATA.units.filter(u=>WV_DATA.groups.find(g=>g.id===u.group).tier==='more').length`);
    ok(`${tag} 展开后「更多」的 ${wantMore} 格全部可见`, vis === wantMore && wantMore === 42, vis);
    // 每一行 3 格都在同一水平线上、没有空格子（用户有强迫症）
    const ragged = await c.ev(`[...document.querySelectorAll('.grid')].filter(g=>g.children.length%3!==0).length`);
    ok(`${tag} 每个网格都排满 3 列`, ragged === 0, ragged);
    // 同一行三格的数字字号一致（不能一格大一格小）
    const uneven = await c.ev(`(()=>{const bad=[];document.querySelectorAll('.grid').forEach(g=>{const cs=[...g.children];for(let i=0;i<cs.length;i+=3){const f=cs.slice(i,i+3).map(c=>getComputedStyle(c.querySelector('input')).fontSize);if(new Set(f).size>1)bad.push(cs[i].dataset.unit+':'+f.join('/'))}});return bad})()`);
    ok(`${tag} 同一行字号一致`, uneven.length === 0, uneven);
    const cut2 = await c.ev(`[...document.querySelectorAll('#more .cell label')].filter(l=>l.scrollWidth>l.clientWidth).map(l=>l.textContent)`);
    ok(`${tag} 更多单位的名称没被截断`, cut2.length === 0, cut2);
    const small2 = await c.ev(`[...document.querySelectorAll('#more .cell')].filter(e=>e.getBoundingClientRect().height<44).length`);
    ok(`${tag} 更多单位格子 ≥44px`, small2 === 0, small2);
    ok(`${tag} 展开后按钮变成收起`, (await c.ev(`document.getElementById('moreText').textContent`)) === '收起');
    // 在「更多」里输入：起点格换过去，首屏也跟着算
    await typeInto(c, 'dou', '1');
    ok(`${tag} 1 斗 = 10 升`, (await val(c, 'l')) === '10');
    ok(`${tag} 1 斗 = 20 斤（按水）`, (await val(c, 'jin')) === '20');
    ok(`${tag} 起点格在更多区`, (await c.ev(`[...document.querySelectorAll('.cell.src')].map(e=>e.dataset.unit).join()`)) === 'dou');
    await typeInto(c, 'ozt', '1');
    ok(`${tag} 1 金衡盎司 = 31.1035 克`, (await val(c, 'g')) === '31.1035');

    // 超长 / 超小的数字也要显示得下（展开状态，覆盖全部 57 格）
    for (const [u, t] of [['t', '99999999'], ['qian', '0.001'], ['ug', '0.001'], ['ton_l', '99999999'], ['n_cement', '99999999'], ['n_pingpong', '0.001'], ['n_rmb1', '99999999']]) {
      await typeInto(c, u, t);
      const clipped = await c.ev(`[...document.querySelectorAll('.cell input')].filter(i=>i.scrollWidth>i.clientWidth+1).map(i=>i.id+'='+i.value)`);
      ok(`${tag} ${u}=${t} 时数字不被截断`, clipped.length === 0, clipped);
    }
    await overflow('超长数字');
    await c.goto(URL + 'weight.html');
    ok(`${tag} 展开状态刷新后记得`, await c.ev(`!document.getElementById('more').hidden`));
    // 刷新后字号适配要在可见状态下重新算过：极端值仍不能被截断
    await typeInto(c, 't', '99999999');
    const clipped3 = await c.ev(`[...document.querySelectorAll('.cell input')].filter(i=>i.scrollWidth>i.clientWidth+1).map(i=>i.id+'='+i.value)`);
    ok(`${tag} 刷新后展开区数字不被截断`, clipped3.length === 0, clipped3);
    await c.ev(`document.getElementById('btnMore').click()`);
    ok(`${tag} 再点收起`, await c.ev(`document.getElementById('more').hidden`));
    // 收起状态下输入极端值（此时展开区格子宽 0，字号适配会误判），再展开：必须重算，不能被截断
    await typeInto(c, 'kg', '99999999');
    await c.ev(`document.getElementById('btnMore').click()`);
    await sleep(100);
    const clipped4 = await c.ev(`[...document.querySelectorAll('#more .cell input')].filter(i=>i.scrollWidth>i.clientWidth+1).map(i=>i.id+'='+i.value)`);
    ok(`${tag} 收起时输入、展开后不被截断`, clipped4.length === 0, clipped4);
    await c.ev(`document.getElementById('btnMore').click()`);
    await c.ev(`document.getElementById('btnReset').click()`);

    // 切到面粉：1 分升 = 100 毫升 × 0.58 = 58 克，并提示只是大概
    await setSub(c, 'flour');
    await typeInto(c, 'dl', '1');
    const g = parseFloat(await val(c, 'g'));
    ok(`${tag} 1 分升面粉 = 58 克`, g === 58, g);
    ok(`${tag} 粉粒状提示只是大概`, (await c.ev(`document.querySelector('#refer .warn')?.textContent||''`)).includes('大概'));

    // 非法输入只标红，不动其他格子
    await typeInto(c, 'kg', 'abc');
    ok(`${tag} 非法输入标红`, await c.ev(`document.querySelector('.cell[data-unit=kg]').classList.contains('invalid')`));
    ok(`${tag} 非法输入不动其他格`, parseFloat(await val(c, 'g')) === 58);

    // 截首屏：换回水、1.25 斤
    await setSub(c, 'water');
    await typeInto(c, 'jin', '1.25');
    await c.ev(`document.activeElement.blur(); scrollTo(0,0)`);
    await sleep(300);
    if (SHOTS) await c.vshot(path.join(SHOTS, `${tag}-1-top.png`));

    if (SHOTS) { await c.ev(`document.getElementById('cardObjects').scrollIntoView({block:'start'})`); await sleep(200); await c.vshot(path.join(SHOTS, `${tag}-2-objects.png`)); }

    // 性能：CPU 降速 6 倍（模拟中低端安卓），展开「更多」后连按 20 个键。
    //   判的是主线程 JS（含它逼出来的同步重排）的中位数：改前中位 526ms、最大 1908ms，改后中位约 9ms。
    //   判据 50ms 是我定的经验值（不是标准），给环境噪声留了余量；偶发的 GC 尖峰不判，所以取中位数。
    //   随后的排版绘制时间只记录不判：headless 软件渲染下同一操作在 50～650ms 间乱跳，测不准，要真机看
    await c.ev(`if (document.getElementById('more').hidden) document.getElementById('btnMore').click()`);
    await c.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    const cost = await c.ev(`(async()=>{const el=document.getElementById('u_jin');el.focus();const js=[],fr=[];const frame=()=>new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));await frame();for(const s of ['1','12','123','1234','12345','99999999','0.001','5','55','555','5555','0.5','0.05','7','77','777','3.14','31.4','314','3140']){el.value=s;const a=performance.now();el.dispatchEvent(new Event('input',{bubbles:true}));const b=performance.now();await frame();js.push(Math.round(b-a));fr.push(Math.round(performance.now()-b));}return {js,fr}})()`);
    await c.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const med = a => a.slice().sort((x, y) => x - y)[a.length >> 1];
    console.log(`  ${tag} 每键 JS 中位 ${med(cost.js)}ms / 最大 ${Math.max(...cost.js)}ms；排版绘制中位 ${med(cost.fr)}ms（CPU÷6，只记录）`);
    ok(`${tag} 每按一个键 JS 中位数 < 50ms（CPU÷6，实测 ${med(cost.js)}ms）`, med(cost.js) < 50, cost.js);
    await c.ev(`document.getElementById('btnMore').click(); document.activeElement.blur(); document.getElementById('btnReset').click(); scrollTo(0,0)`);
    await typeInto(c, 'jin', '1.25');
    await c.ev(`document.activeElement.blur(); scrollTo(0,0)`);
    await overflow('物品卡');

    // 下拉刷新：先测「输入框聚焦时不接管」（会清掉刚输的数），再测正常下拉真的刷新
    const pull = async () => {
      await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: W / 2, y: 200 }] });
      for (const d of [10, 40, 80, 130, 180, 240, 300]) { await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: W / 2, y: 200 + d }] }); await sleep(16); }
      await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await c.ev(`scrollTo(0,0); window.__alive = 1; document.getElementById('u_jin').focus({preventScroll:true}); scrollTo(0,0)`);
    await sleep(100);
    await pull();
    await sleep(600);
    ok(`${tag} 输入中下拉不刷新`, (await c.ev(`window.__alive === 1 && !document.getElementById('ptr-indicator').classList.contains('ptr-loading')`)) === true);
    await c.ev(`document.activeElement.blur(); scrollTo(0,0)`);
    await sleep(100);
    await pull();
    await sleep(1500);
    let reloaded = false;
    for (let i = 0; i < 30 && !reloaded; i++) { try { reloaded = (await c.ev(`window.__alive === undefined && document.readyState === 'complete'`)) === true; } catch (e) {} if (!reloaded) await sleep(200); }
    ok(`${tag} 正常下拉触发刷新`, reloaded);
    await sleep(300);
    ok(`${tag} 刷新后输入还在`, (await val(c, 'jin')) === '1.25' && (await val(c, 'g')) === '625' && (await c.ev(`document.querySelector('.cell.src')?.dataset.unit`)) === 'jin');

    // 刷新后再测归零
    await typeInto(c, 'jin', '3');
    await c.ev(`document.getElementById('btnReset').click()`);
    ok(`${tag} 归零清空`, (await val(c, 'g')) === '' && (await c.ev(`document.querySelectorAll('.cell.src').length`)) === 0);

    ok(`${tag} 无 JS 报错`, c.errors.length === 0, c.errors);
  } finally {
    c.close();
  }
}

(async () => {
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  if (!URL) { const srv = await serve(); srv.unref(); URL = `http://127.0.0.1:${srv.address().port}/`; }
  console.log('测试地址', URL);
  for (const [W, H] of [[320, 568], [390, 844], [430, 932]]) {
    for (const dark of [false, true]) { await run(W, H, dark); await runCollection(W, H, dark); }
  }
  const fail = results.filter(r => !r.pass);
  for (const r of fail) console.log('✗', r.name, JSON.stringify(r.info));
  console.log(`通过 ${results.length - fail.length} / ${results.length}`);
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
