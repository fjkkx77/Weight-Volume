// 零依赖 headless Chrome + CDP 小工具。
// 来源：memory/references/组件_浏览器验证脚手架/cdp.js（2026-10-08 拷入本仓库），本副本的改动：
//   - 不再写死 Windows 的 Chrome 路径：先看环境变量 CHROME_PATH，再按系统找常见位置（CI 在 Linux 上跑）
//   - 收尾：Windows 照旧按 PID 树杀 + 按 user-data-dir 唯一名兜底；其他系统用进程组 SIGKILL
//   - CI 环境（CI=true）加 --no-sandbox：Ubuntu 24.04 限制非特权 user namespace，Chrome 沙箱起不来
// 需要 Node 22+（全局 WebSocket / fetch）
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LIVE = [];
const RUN_PREFIX = 'cdp-' + process.pid + '-';   // 本次运行起的所有浏览器都用这个前缀；查残留只查它
const WIN = process.platform === 'win32';

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const cands = WIN
    ? ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  const hit = cands.find(p => fs.existsSync(p));
  if (!hit) throw new Error('找不到 Chrome：设环境变量 CHROME_PATH 指向它');
  return hit;
}

function killOne(b) {
  if (WIN) {
    try { require('child_process').execSync('taskkill /PID ' + b.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {}
    try {
      const ps = 'Get-CimInstance Win32_Process -Filter "Name=\'chrome.exe\'" | Where-Object { $_.CommandLine -like \'*' + b.tag + '*\' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }';
      require('child_process').execSync('powershell -NoProfile -Command "' + ps.replace(/"/g, '\\"') + '"', { stdio: 'ignore' });
    } catch (e) {}
  } else {
    try { process.kill(-b.pid, 'SIGKILL'); } catch (e) { try { process.kill(b.pid, 'SIGKILL'); } catch (_) {} }
  }
  // 刚杀完进程时 profile 目录里的文件句柄还没释放，一次删不掉；重试几次
  for (let i = 0; i < 6; i++) {
    try { fs.rmSync(b.dir, { recursive: true, force: true }); break; }
    catch (e) { const t = Date.now(); while (Date.now() - t < 1000) {} }
  }
}
function killAll() { while (LIVE.length) killOne(LIVE.pop()); }
process.on('exit', killAll);
process.on('SIGINT', () => { killAll(); process.exit(1); });
process.on('SIGTERM', () => { killAll(); process.exit(1); });
process.on('uncaughtException', e => { console.error('FAIL', e && e.message); killAll(); process.exit(1); });

async function open(w, h, scale) {
  const port = 20000 + Math.floor(Math.random() * 20000);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), RUN_PREFIX));
  const tag = path.basename(dir);
  const args = ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + dir, '--no-first-run',
    '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars'];
  if (process.env.CI) args.push('--no-sandbox');
  const proc = spawn(chromePath(), [...args, 'about:blank'], { stdio: 'ignore', detached: !WIN });
  LIVE.push({ pid: proc.pid, dir, tag });
  let ws = null;
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch('http://127.0.0.1:' + port + '/json/list'); const l = await r.json();
      const pg = l.find(x => x.type === 'page'); if (pg) { ws = pg.webSocketDebuggerUrl; break; } } catch (e) {}
    await sleep(250);
  }
  if (!ws) throw new Error('chrome 起不来');
  const sock = new WebSocket(ws); let id = 0; const pend = new Map(); const errors = [];
  await new Promise((res, rej) => { sock.onopen = res; sock.onerror = rej; setTimeout(() => rej(new Error('ws 超时')), 10000); });
  sock.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { const { res, rej } = pend.get(m.id); pend.delete(m.id);
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      errors.push((d.exception && (d.exception.description || d.exception.value)) || d.text);
    }
  };
  const send = (method, params) => { const i = ++id;
    return new Promise((res, rej) => { pend.set(i, { res, rej });
      setTimeout(() => { if (pend.has(i)) { pend.delete(i); rej(new Error('CDP 超时: ' + method)); } }, 20000);
      sock.send(JSON.stringify({ id: i, method, params: params || {} })); }); };
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('EVAL ' + JSON.stringify(r.exceptionDetails.exception && r.exceptionDetails.exception.description));
    return r.result.value; };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__alerts=[];window.alert=function(m){window.__alerts.push(String(m))};window.confirm=function(){return true};' });
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: scale || 2, mobile: (w < 900), screenWidth: w, screenHeight: h });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const goto = async url => { await send('Page.navigate', { url });
    for (let i = 0; i < 60; i++) { if (await ev('document.readyState') === 'complete') break; await sleep(100); }
    await sleep(300); };
  const shot = async f => { const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.writeFileSync(f, Buffer.from(r.data, 'base64')); };
  const close = () => { const i = LIVE.findIndex(x => x.pid === proc.pid); if (i >= 0) killOne(LIVE.splice(i, 1)[0]); };
  // 只截当前视口（长页面别用 shot()：整页长图 × DPR 3 很吃内存）
  const vshot = async f => { const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(f, Buffer.from(r.data, 'base64')); };
  return { ev, send, goto, shot, vshot, close, errors };
}
module.exports = { open, sleep, RUN_PREFIX };
