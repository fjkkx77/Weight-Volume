// 真实窄屏视口验证（headless Chrome + CDP）
// 用法：先 node <脚手架>/mock.js <仓库目录> 18831，再 node tests/ui.verify.cjs [截图目录]
//   测线上站：WV_PROXY=<代理> WV_URL=<线上地址> node tests/ui.verify.cjs
// 脚手架：memory/references/组件_浏览器验证脚手架/（坑清单见同目录 README）
const path = require('path');
const fs = require('fs');
// 测线上站时 headless Chrome 不会自动走系统代理（直连 github.io 会超时）：
// 设了 WV_PROXY 就给脚手架起的 Chrome 补一个 --proxy-server，共用脚手架本身不改
if (process.env.WV_PROXY) {
  const cp = require('child_process');
  const spawn0 = cp.spawn;
  cp.spawn = (cmd, args, opts) => spawn0(cmd, /chrome/i.test(cmd) ? [...args, '--proxy-server=' + process.env.WV_PROXY] : args, opts);
}
const SCAFFOLD = path.join(process.env.USERPROFILE || 'C:/Users/Administrator',
  '.claude/projects/C--Users-Administrator/memory/references/组件_浏览器验证脚手架/cdp.js');
const { open, sleep } = require(SCAFFOLD);

const URL = process.env.WV_URL || 'http://127.0.0.1:18831/';
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

async function run(W, H, dark) {
  const tag = `${W}${dark ? '-dark' : ''}`;
  const c = await open(W, H, 3);
  try {
    await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] });
    await c.goto(URL);
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

    // 一屏看全：换算卡片底边不超过屏高 85%（给 Safari 地址栏/工具栏留位置，85% 是估算）。320×568 太矮，只记录不判
    await c.ev(`document.activeElement.blur(); scrollTo(0,0)`);
    await sleep(100);
    const bottom = await c.ev(`Math.round(document.getElementById('cardConvert').getBoundingClientRect().bottom)`);
    if (W >= 390) ok(`${tag} 换算区一屏看全（底边 ${bottom} ≤ ${Math.round(H * 0.85)}）`, bottom <= H * 0.85, bottom);
    else console.log(`  ${tag} 换算区底边 ${bottom}（屏高 ${H}，不判）`);

    // 超长 / 超小的数字也要显示得下
    for (const [u, t] of [['t', '99999999'], ['qian', '0.001']]) {
      await typeInto(c, u, t);
      const clipped = await c.ev(`[...document.querySelectorAll('.cell input')].filter(i=>i.scrollWidth>i.clientWidth+1).map(i=>i.id+'='+i.value)`);
      ok(`${tag} ${u}=${t} 时数字不被截断`, clipped.length === 0, clipped);
    }
    await overflow('超长数字');

    // 切到面粉：1 美制杯 ≈ 137.2 克，并提示只是大概
    await setSub(c, 'flour');
    await typeInto(c, 'cup_us', '1');
    const g = parseFloat(await val(c, 'g'));
    ok(`${tag} 1 美制杯面粉 ≈ 137.2 克`, Math.abs(g - 137.22) < 0.01, g);
    ok(`${tag} 粉粒状提示只是大概`, (await c.ev(`document.querySelector('#refer .warn')?.textContent||''`)).includes('大概'));

    // 非法输入只标红，不动其他格子
    await typeInto(c, 'kg', 'abc');
    ok(`${tag} 非法输入标红`, await c.ev(`document.querySelector('.cell[data-unit=kg]').classList.contains('invalid')`));
    ok(`${tag} 非法输入不动其他格`, Math.abs(parseFloat(await val(c, 'g')) - 137.22) < 0.01);

    // 截首屏：换回水、1.25 斤
    await setSub(c, 'water');
    await typeInto(c, 'jin', '1.25');
    await c.ev(`document.activeElement.blur(); scrollTo(0,0)`);
    await sleep(300);
    if (SHOTS) await c.vshot(path.join(SHOTS, `${tag}-1-top.png`));

    // 生活参照：只有标准/包装标称，点一下填进换算并回到顶部
    const counts = await c.ev(`(()=>{const m=document.querySelectorAll('.item').length;document.getElementById('tabVolume').click();const v=document.querySelectorAll('.item').length;document.getElementById('tabMass').click();return {m,v}})()`);
    const want = await c.ev(`({m:WV_DATA.items.filter(i=>i.kind==='mass').length, v:WV_DATA.items.filter(i=>i.kind==='volume').length})`);
    ok(`${tag} 参照两页物品数`, counts.m === want.m && counts.v === want.v, { counts, want });
    ok(`${tag} 参照里没有经验值`, !(await c.ev(`document.getElementById('cardItems').textContent`)).includes('经验'));
    await c.ev(`document.getElementById('cardItems').scrollIntoView({block:'start'})`);
    await sleep(200);
    if (SHOTS) await c.vshot(path.join(SHOTS, `${tag}-2-items.png`));
    await c.ev(`document.getElementById('tabVolume').click(); document.querySelector('.item[data-item="bottle"]').click()`);
    await sleep(900);
    ok(`${tag} 矿泉水填入 550 毫升`, (await val(c, 'ml')) === '550');
    ok(`${tag} 起点格换成毫升`, (await c.ev(`[...document.querySelectorAll('.cell.src')].map(e=>e.dataset.unit).join()`)) === 'ml');
    ok(`${tag} 回到换算区顶部`, (await c.ev('scrollY')) < 5);
    await overflow('参照');

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
  for (const [W, H] of [[320, 568], [390, 844], [430, 932]]) {
    for (const dark of [false, true]) await run(W, H, dark);
  }
  const fail = results.filter(r => !r.pass);
  for (const r of fail) console.log('✗', r.name, JSON.stringify(r.info));
  console.log(`通过 ${results.length - fail.length} / ${results.length}`);
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
