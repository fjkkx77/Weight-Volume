// 真实窄屏视口验证（headless Chrome + CDP）
// 用法：先 node <脚手架>/mock.js <仓库目录> 18831，再 node tests/ui.verify.cjs [截图目录]
// 脚手架：memory/references/组件_浏览器验证脚手架/（坑清单见同目录 README）
const path = require('path');
const fs = require('fs');
const SCAFFOLD = path.join(process.env.USERPROFILE || 'C:/Users/Administrator',
  '.claude/projects/C--Users-Administrator/memory/references/组件_浏览器验证脚手架/cdp.js');
// 测线上站时 headless Chrome 不会自动走系统代理（直连 github.io 会超时）：
// 设了 WV_PROXY 就给脚手架起的 Chrome 补一个 --proxy-server，共用脚手架本身不改
if (process.env.WV_PROXY) {
  const cp = require('child_process');
  const spawn0 = cp.spawn;
  cp.spawn = (cmd, args, opts) => spawn0(cmd, /chrome/i.test(cmd) ? [...args, '--proxy-server=' + process.env.WV_PROXY] : args, opts);
}
const { open, sleep } = require(SCAFFOLD);

const URL = process.env.WV_URL || 'http://127.0.0.1:18831/';
const SHOTS = process.argv[2] || '';
const results = [];
const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info }); };

// 往某一格「打字」：真的聚焦后用 insertText，走的是浏览器的 input 事件，不是直接改 value
async function typeInto(c, unitId, text) {
  await c.ev(`(()=>{const el=document.getElementById('u_${unitId}');el.scrollIntoView({block:'center'});el.focus();el.select();})()`);
  await c.send('Input.insertText', { text });
  await sleep(50);
}
const val = (c, unitId) => c.ev(`document.getElementById('u_${unitId}').value`);

async function run(W, H, dark) {
  const tag = `${W}${dark ? '-dark' : ''}`;
  const c = await open(W, H, 3);
  try {
    await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] });
    await c.goto(URL);
    ok(`${tag} 页面标题`, (await c.ev('document.title')) === '斤两换算');
    ok(`${tag} CSS 已加载`, (await c.ev("getComputedStyle(document.querySelector('.card')).borderRadius")) === '20px');
    ok(`${tag} 单位行已渲染`, (await c.ev("document.querySelectorAll('.row').length")) === (await c.ev('WV_DATA.units.length')));
    const bg = await c.ev("getComputedStyle(document.body).backgroundColor");
    ok(`${tag} 主题背景`, dark ? bg === 'rgb(0, 0, 0)' : bg === 'rgb(242, 242, 247)', bg);

    const overflow = async (label) => {
      const m = await c.ev('({sw:document.documentElement.scrollWidth, iw:innerWidth})');
      ok(`${tag} 无横向溢出 @${label}`, m.sw <= W && m.iw <= W, m);
    };
    await overflow('初始');

    // 触摸目标：可见的按钮/输入行都要 ≥44px 高
    const small = await c.ev(`[...document.querySelectorAll('button, .row, summary')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.height<44}).map(e=>(e.className||e.tagName)+':'+Math.round(e.getBoundingClientRect().height))`);
    ok(`${tag} 触摸目标 ≥44px`, small.length === 0, small);

    // 每行的单位名不能被挤成逐字竖排：名称本身必须单行
    const squeezed = await c.ev(`[...document.querySelectorAll('.row label')].filter(l=>{const t=l.firstChild;const r=document.createRange();r.selectNodeContents(t);return r.getClientRects().length>1}).map(l=>l.textContent)`);
    ok(`${tag} 单位名不换行`, squeezed.length === 0, squeezed);
    // 输入框至少能放下 9 位数字（17px 等宽数字约 9.5px/位）
    const narrow = await c.ev(`[...document.querySelectorAll('.row input')].filter(i=>i.clientWidth<90).map(i=>i.id+':'+i.clientWidth)`);
    ok(`${tag} 输入框够宽`, narrow.length === 0, narrow);
    // 物质按钮里的名称不能换行
    const subWrap = await c.ev(`[...document.querySelectorAll('.sub-btn span:last-child')].filter(s=>{const r=document.createRange();r.selectNodeContents(s);return r.getClientRects().length>1}).map(s=>s.textContent)`);
    ok(`${tag} 物质名不换行`, subWrap.length === 0, subWrap);

    // 1 斤 → 500 克，组合写法、物品联动出现
    await typeInto(c, 'jin', '1.25');
    ok(`${tag} 1.25 斤 = 625 克`, (await val(c, 'g')) === '625');
    ok(`${tag} 1.25 斤 = 12.5 两`, (await val(c, 'liang')) === '12.5');
    ok(`${tag} 正在编辑的格子保留原文`, (await val(c, 'jin')) === '1.25');
    ok(`${tag} 市制组合写法`, (await c.ev(`document.querySelector('[data-foot="shi"]').textContent`)).includes('1斤2两5钱'));
    ok(`${tag} 旧制组合写法`, (await c.ev(`document.querySelector('[data-foot="old"]').textContent`)).includes('1斤4两'));
    const chips = await c.ev(`[...document.querySelectorAll('.chip')].map(b=>b.textContent)`);
    ok(`${tag} 物品联动标签`, chips.length >= 1 && chips.length <= 3, chips);
    // 「1.5 罐一罐可乐」这种量词重复（截图里看到过）
    ok(`${tag} 联动标签量词不重复`, chips.every(t => !/(\S)一\1/.test(t)), chips);
    ok(`${tag} 水：1 升 = 2 斤`, await (async () => { await typeInto(c, 'l', '1'); return (await val(c, 'jin')) === '2'; })());
    await overflow('有结果');

    // 真触摸点按「面粉」，验证触摸路径；之后 1 美制杯 ≈ 137.2 克
    await c.ev(`document.querySelector('.sub-btn[data-id="flour"]').scrollIntoView({block:'center'})`);
    const fr = await c.ev(`(()=>{const r=document.querySelector('.sub-btn[data-id="flour"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: fr.x, y: fr.y }] });
    await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(150);
    ok(`${tag} 触摸切换到面粉`, (await c.ev(`document.querySelector('.sub-btn[data-id="flour"]').getAttribute('aria-pressed')`)) === 'true');
    ok(`${tag} 粉粒状警示出现`, await c.ev(`!document.getElementById('warn').hidden`));
    await typeInto(c, 'cup_us', '1');
    const g = parseFloat(await val(c, 'g'));
    ok(`${tag} 1 美制杯面粉 ≈ 137.2 克`, Math.abs(g - 137.22) < 0.01, g);
    ok(`${tag} 跨类结果标「大概」`, (await c.ev(`document.querySelector('[data-foot="metric_mass"]').textContent`)).includes('大概'));
    await overflow('面粉');

    // 非法输入只标红，不动其他格子
    await typeInto(c, 'kg', 'abc');
    ok(`${tag} 非法输入标红`, await c.ev(`document.getElementById('u_kg').closest('.row').classList.contains('invalid')`));
    ok(`${tag} 非法输入不动其他格`, Math.abs(parseFloat(await val(c, 'g')) - 137.22) < 0.01);

    // 截图：换回水，输入 1 斤
    await c.ev(`document.querySelector('.sub-btn[data-id="water"]').click()`);
    await typeInto(c, 'jin', '1');
    await c.ev(`document.activeElement.blur(); scrollTo(0,0)`);
    await sleep(300);
    if (SHOTS) await c.vshot(path.join(SHOTS, `${tag}-1-top.png`));
    await c.ev(`document.querySelector('[data-group="kitchen"]').scrollIntoView({block:'start'}); scrollBy(0,-90)`);
    await sleep(200);
    if (SHOTS) await c.vshot(path.join(SHOTS, `${tag}-1b-rows.png`));

    // 点联动标签 → 图鉴切到对应类别、目标物品滚进视口
    const chipId = await c.ev(`(()=>{const b=document.querySelector('.chip');b.click();return b.dataset.item})()`);
    // 高亮只持续 0.9 秒，点完立刻读
    ok(`${tag} 图鉴高亮`, await c.ev(`document.querySelector('.item[data-item="${chipId}"]').classList.contains('flash')`));
    await sleep(900);
    const inView = await c.ev(`(()=>{const r=document.querySelector('.item[data-item="${chipId}"]').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()`);
    ok(`${tag} 联动标签跳到图鉴物品(${chipId})`, inView);
    ok(`${tag} 导航高亮跟到图鉴`, (await c.ev(`document.querySelector('.nav-item[data-target="cardItems"]').getAttribute('aria-current')`)) === 'true');
    if (SHOTS) await c.vshot(path.join(SHOTS, `${tag}-2-items.png`));
    await overflow('图鉴');

    // 点图鉴里的鸡蛋 → 填入 55 克并滚回换算
    await c.ev(`document.getElementById('tabMass').click()`);
    await c.ev(`document.querySelector('.item[data-item="egg"]').click()`);
    await sleep(900);
    ok(`${tag} 鸡蛋填入 55 克`, (await val(c, 'g')) === '55');
    ok(`${tag} 鸡蛋 = 1.1 两`, (await val(c, 'liang')) === '1.1');
    const top = await c.ev(`document.getElementById('cardConvert').getBoundingClientRect().top`);
    ok(`${tag} 滚回换算卡片`, top >= 0 && top < 160, top);

    // 容量分页
    await c.ev(`document.getElementById('tabVolume').click()`);
    ok(`${tag} 容量分页物品`, (await c.ev(`document.querySelectorAll('.item').length`)) === 6);

    // 导航跳到口诀，展开一条
    await c.ev(`document.querySelector('.nav-item[data-target="cardTips"]').click()`);
    await sleep(900);
    const tipsTop = await c.ev(`document.getElementById('cardTips').getBoundingClientRect().top`);
    const navH = await c.ev(`document.getElementById('sectionNav').getBoundingClientRect().bottom`);
    // 页面到底时卡片停不到导航条下方，这是正常的；此时要求整张卡在屏内
    const atBottom = await c.ev(`Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 1`);
    const tipsBottom = await c.ev(`document.getElementById('cardTips').getBoundingClientRect().bottom`);
    ok(`${tag} 导航跳到口诀且不被导航条遮住`, tipsTop >= navH - 1 && (tipsTop < navH + 300 || (atBottom && tipsBottom <= H)), { tipsTop, navH, atBottom });
    ok(`${tag} 导航高亮跟到口诀`, (await c.ev(`document.querySelector('.nav-item[data-target="cardTips"]').getAttribute('aria-current')`)) === 'true');
    await c.ev(`document.querySelector('#tips details').open=true`);
    await overflow('口诀展开');
    await sleep(400);   // 等箭头旋转动画（.2s）结束再截
    if (SHOTS) await c.vshot(path.join(SHOTS, `${tag}-3-tips.png`));

    // 归零
    await c.ev(`document.getElementById('btnReset').click()`);
    ok(`${tag} 归零清空`, (await val(c, 'g')) === '' && (await c.ev(`document.querySelectorAll('.chip').length`)) === 0);

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
