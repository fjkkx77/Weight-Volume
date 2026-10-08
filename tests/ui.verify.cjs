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

    // 一屏看全：首屏 21 个常用单位的最后一行不超过屏高 85%（给 Safari 地址栏/工具栏留位置，85% 是估算）。
    // 2026-10-08 加了吸顶导航，用户同意参照行和「更多」按钮被挤到首屏下面，所以只判 21 格。320×568 太矮，只记录不判
    await c.ev(`document.activeElement.blur(); scrollTo(0,0)`);
    await sleep(100);
    const bottom = await c.ev(`Math.round(Math.max(...[...document.querySelectorAll('#groups .cell')].map(e=>e.getBoundingClientRect().bottom)))`);
    if (W >= 390) ok(`${tag} 常用 21 格一屏看全（底边 ${bottom} ≤ ${Math.round(H * 0.85)}）`, bottom <= H * 0.85, bottom);
    else console.log(`  ${tag} 常用格底边 ${bottom}（屏高 ${H}，不判）`);

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
    ok(`${tag} 每个物品格都带量词`, cws.length === 18 && !cws.includes(' '), cws);
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
    await c.goto(URL);
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
  for (const [W, H] of [[320, 568], [390, 844], [430, 932]]) {
    for (const dark of [false, true]) await run(W, H, dark);
  }
  const fail = results.filter(r => !r.pass);
  for (const r of fail) console.log('✗', r.name, JSON.stringify(r.info));
  console.log(`通过 ${results.length - fail.length} / ${results.length}`);
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
