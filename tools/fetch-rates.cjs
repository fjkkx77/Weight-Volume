// 拉最新汇率、写进仓库里的快照 rates.js（货币页打不开汇率接口时就用它）。
// 用法：node tools/fetch-rates.cjs（之后要跑 node tools/stamp.cjs，rates.js 变了指纹也要变）
//   GitHub Actions 每个工作日自动跑（.github/workflows/rates.yml）；本机走代理时加 NODE_USE_ENV_PROXY=1
// 规则：人民币中间价（CFETS）拿不到就不写、退出码 1；某个补充数据源失败，那几种币保留旧快照的值。
const fs = require('fs');
const path = require('path');
const { PLAN, urlOf, merge, dateOf } = require('../currency.js');

const FILE = path.join(__dirname, '..', 'rates.js');

function render(rates) {
  const codes = Object.keys(rates).sort();
  const lines = codes.map(c => `    ${JSON.stringify(c)}: ${JSON.stringify(rates[c])}`);
  return `// 汇率快照：由 tools/fetch-rates.cjs 生成，别手改。cny = 1 单位该外币合多少人民币；provider 见 currency.js 顶部说明
(function (root) {
  var WV_RATES = {
  "date": ${JSON.stringify(dateOf(rates))},
  "rates": {
${lines.join(',\n')}
  }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = WV_RATES;
  else root.WV_RATES = WV_RATES;
})(typeof globalThis !== 'undefined' ? globalThis : this);
`;
}

async function getJson(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (r.ok) return await r.json();
      console.error(url, 'HTTP', r.status);
    } catch (e) { console.error(url, e.message); }
    await new Promise(res => setTimeout(res, 3000));
  }
  return null;
}

(async () => {
  let old = {};
  try { delete require.cache[FILE]; old = require(FILE).rates || {}; } catch (e) {}
  const got = {};
  for (const p of Object.keys(PLAN)) { const j = await getJson(urlOf(p)); if (j) got[p] = j; }
  if (!got.CFETS) { console.error('拿不到人民币中间价，不写文件'); process.exit(1); }
  const rates = merge(got, old);
  const want = Object.values(PLAN).flat();
  const missing = want.filter(c => !rates[c]);
  if (missing.length) { console.error('缺这些币种：', missing.join(' ')); process.exit(1); }
  const text = render(rates);
  const before = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n') : '';
  if (before === text) { console.log('汇率没变', dateOf(rates)); return; }
  fs.writeFileSync(FILE, text);
  console.log('已更新 rates.js，中间价日期', dateOf(rates), '；失败的数据源：', Object.keys(PLAN).filter(p => !got[p]).join(' ') || '无');
})();
