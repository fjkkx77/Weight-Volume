/*
 * 货币换算 —— 汇率来源与实时更新（浏览器里挂 window.WVCurrency；node 里给 tools/fetch-rates.cjs 用）
 *
 * 数据源（全部经 Frankfurter 免费接口转发，可跨域、不要密钥；2026-10-08 实测）：
 *   CFETS：中国外汇交易中心人民币汇率中间价，25 种外币（官方口径，工作日 9:15 公布）
 *   ECB：欧洲央行参考汇率，补 CFETS 没有的 6 种（经欧元交叉折算成人民币）
 *   AMCM：澳门金融管理局银行间中间价，补新台币（CFETS、ECB 都没有）
 * 怎么算：Frankfurter 内部一律以欧元为基准、保留 5 位有效数字存。直接要 base=CNY 它会再折算再舍入一次，
 *   港币就变成 0.85852（官网 0.85849）。所以要欧元基准的原始数，自己算「1 外币 = 欧元兑人民币 ÷ 欧元兑该外币」人民币，
 *   只经过一次舍入：港币 7.5404 ÷ 8.7833 = 0.858493，美元 7.5404 ÷ 1.1193 = 6.73671，都和官网对得上（2026-10-09 核）。
 * 打开页面时先用仓库里存的快照 rates.js（GitHub Actions 每个工作日更新）和本机上次拉到的，再去拉实时的；
 * 拉不到（断网、接口被墙、超时）就停在快照上，页面写明是哪天的汇率。
 */
(function (root) {
  'use strict';
  var API = 'https://api.frankfurter.dev/v2/rates';
  var PLAN = {
    CFETS: ['USD', 'EUR', 'JPY', 'HKD', 'GBP', 'AUD', 'NZD', 'SGD', 'CHF', 'CAD', 'MOP', 'MYR', 'RUB', 'ZAR', 'KRW',
            'AED', 'SAR', 'HUF', 'PLN', 'DKK', 'SEK', 'NOK', 'TRY', 'MXN', 'THB'],
    ECB: ['BRL', 'CZK', 'IDR', 'INR', 'PHP', 'RON'],
    AMCM: ['TWD']
  };
  var SOURCE_NAME = { CFETS: '中国外汇交易中心人民币汇率中间价', ECB: '欧洲央行参考汇率（经欧元折算）', AMCM: '澳门金融管理局银行间中间价' };
  function urlOf(provider) { return API + '?providers=' + provider + '&quotes=CNY,' + PLAN[provider].join(','); }

  // 把各数据源的返回（欧元基准）合成一张表：{ USD: { cny: 1 美元合多少人民币, date, provider } }。
  //   只收计划里由这个源负责的币种、只收正数；同一个源里必须有欧元兑人民币，且日期一致
  function ok(x) { return x && x.rate > 0 && isFinite(x.rate) && /^\d{4}-\d{2}-\d{2}$/.test(x.date); }
  function merge(byProvider, into) {
    var out = {};
    var k;
    if (into) for (k in into) out[k] = into[k];
    Object.keys(byProvider).forEach(function (p) {
      var list = byProvider[p];
      if (!Array.isArray(list) || !PLAN[p]) return;
      var eur = list.filter(function (x) { return ok(x) && x.base === 'EUR' && x.quote === 'CNY'; })[0];
      if (!eur) return;
      list.forEach(function (x) {
        if (!ok(x) || x.base !== 'EUR' || x.date !== eur.date || PLAN[p].indexOf(x.quote) < 0) return;
        var cny = x.quote === 'EUR' ? eur.rate : eur.rate / x.rate;
        var old = out[x.quote];
        if (!old || old.date <= x.date) out[x.quote] = { cny: cny, date: x.date, provider: p };
      });
    });
    return out;
  }
  // 这张表的「汇率日期」= 中间价的日期（以 CFETS 为准，取最新）
  function dateOf(rates) {
    var d = '';
    for (var k in rates) if (rates[k].provider === 'CFETS' && rates[k].date > d) d = rates[k].date;
    return d;
  }

  // ---------- 浏览器 ----------
  var CACHE_KEY = 'wv.currency.rates';
  function fetchJson(url, ms) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, ms);
    return fetch(url, { signal: ctl ? ctl.signal : undefined, cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .finally(function () { clearTimeout(timer); });
  }

  function start(grid, D) {
    var note = document.getElementById('liveNote');
    var byCode = {};
    D.units.forEach(function (u) { if (u.code) byCode[u.code] = u; });
    var current = (root.WV_RATES && root.WV_RATES.rates) || {};

    function apply(rates) {
      Object.keys(rates).forEach(function (code) { var u = byCode[code]; if (u && rates[code].cny > 0) u.toBase = rates[code].cny; });
      current = rates;
      grid.recompute();
    }
    function show(state) {
      if (!note) return;
      var d = dateOf(current);
      var head = d ? d.replace(/^(\d{4})-0?(\d+)-0?(\d+)$/, '$1 年 $2 月 $3 日') + '的汇率' : '汇率';
      var tail = state === 'live' ? '' : state === 'loading' ? '（正在获取最新汇率…）' : '（没连上汇率接口，用的是之前存下的）';
      note.innerHTML = '<b>' + head + '</b>' + tail + '：' + SOURCE_NAME.CFETS + '；巴西雷亚尔、捷克克朗、印尼盾、印度卢比、菲律宾比索、列伊按' +
        SOURCE_NAME.ECB + '，新台币按' + SOURCE_NAME.AMCM + '。中间价不是银行买卖价，实际换汇以银行牌价为准。';
    }

    // 本机上次拉到的比仓库快照新，就先用它
    try {
      var cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached && cached.rates && dateOf(cached.rates) > dateOf(current)) apply(merge({}, Object.assign({}, current, cached.rates)));
    } catch (e) {}
    show('loading');
    // 测试时可以关掉联网（结果要确定）；没有 fetch 的老浏览器也直接用快照
    var noLive = false;
    try { noLive = localStorage.getItem('wv.currency.nolive') === '1'; } catch (e) {}
    if (noLive || typeof fetch !== 'function') { show('offline'); return; }

    var providers = Object.keys(PLAN), got = {};
    Promise.all(providers.map(function (p) {
      return fetchJson(urlOf(p), 8000).then(function (j) { got[p] = j; }, function () {});
    })).then(function () {
      if (!got.CFETS) { show('offline'); return; }
      var merged = merge(got, current);
      apply(merged);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ rates: merged })); } catch (e) {}
      show('live');
    });
  }

  var API_OUT = { PLAN: PLAN, SOURCE_NAME: SOURCE_NAME, urlOf: urlOf, merge: merge, dateOf: dateOf, start: start };
  if (typeof module !== 'undefined' && module.exports) module.exports = API_OUT;
  else root.WVCurrency = root.WVLive = API_OUT;   // WVLive：生成的页面挂完网格后调 WVLive.start(grid, D)
})(typeof globalThis !== 'undefined' ? globalThis : this);
