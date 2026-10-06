# 重量·容量换算站 Implementation Plan

> **For agentic workers:** 本计划在当前会话内按任务顺序执行（用户规则：未经要求不派子代理）。Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 做一个手机优先的静态网页：斤两、克、毫升、杯、磅等单位互相换算（按物质跨重量/容量），并把数值翻译成生活常见物品帮助记忆。

**Architecture:** 三个文件分层——`data.js` 纯数据（每条带出处和可信度）、`convert.js` 纯计算（浏览器与 node 共用）、`index.html` 界面。经典 `<script>` 加载（不用 ES module，保证本地双击 `file://` 也能跑），两个 js 同时挂 `globalThis` 并兼容 `module.exports` 供 node 测试。

**Tech Stack:** 原生 HTML/CSS/JS，零外部依赖；node 24 内置 `node:test`；headless Chrome + CDP 验证脚手架（`memory/references/组件_浏览器验证脚手架/`）；GitHub Pages。

**Spec:** `docs/superpowers/specs/2026-10-06-weight-volume-design.md`

---

## 0. 已核实的数据（2026-10-06 检索，实施直接用）

### 0.1 单位（基准：重量=克，容量=毫升）

| id | 显示名 | 组 | 系数 | 级别 | 出处 |
|---|---|---|---|---|---|
| jin | 斤 | 市制 | 500 | exact | 1929《度量衡法》第五条「重量以公斤二分之一为市斤」；1959 国务院《关于统一我国计量制度的命令》「一律改成十两为一斤」 |
| liang | 两 | 市制 | 50 | exact | 同上（1 斤 = 10 两） |
| qian | 钱 | 市制 | 5 | exact | 1929《度量衡法》第六条「两…即十钱」+ 1959 改十两制 |
| gongjin | 公斤 | 市制 | 1000 | exact | 公斤即千克（1984《关于在我国统一实行法定计量单位的命令》） |
| g / kg / t | 克 / 千克 / 吨 | 公制重量 | 1 / 1000 / 1e6 | exact | SI（GB 3100-1993） |
| ml / l / cm3 / m3 | 毫升 / 升 / 立方厘米 / 立方米 | 公制容量 | 1 / 1000 / 1 / 1e6 | exact | SI |
| tsp_m | 茶匙（公制） | 厨房 | 5 | convention | 国际通行公制量勺；**未查到中国统一的量勺国家标准** |
| tbsp_m | 汤匙（公制） | 厨房 | 15 | convention | 同上 |
| cup_m | 公制杯 | 厨房 | 250 | convention | 澳/新/加通行的 metric cup |
| cup_us | 美制杯 | 厨房 | 236.5882365 | exact | NIST SP 811 附录 B.9（粗体=精确） |
| lb | 磅 | 英美 | 453.59237 | exact | NIST SP 811 B.9；1959 国际码磅协定 |
| oz | 盎司 | 英美 | 28.349523125 | exact | = 1/16 磅 |
| floz_us | 美制液量盎司 | 英美 | 29.5735295625 | exact | NIST SP 811 B.9（= 1/128 美制加仑） |
| floz_uk | 英制液量盎司 | 英美 | 28.4130625 | exact | = 1/160 英制加仑 |
| gal_us | 美制加仑 | 英美 | 3785.411784 | exact | NIST SP 811 B.9（231 立方英寸） |
| gal_uk | 英制加仑 | 英美 | 4546.09 | exact | NIST SP 811 B.9 |
| jin_old | 旧制斤（16 两） | 旧制港台 | 500 | exact | 1929《度量衡法》第五条「一斤分为十六两」 |
| liang_old | 旧制两 | 旧制港台 | 31.25 | exact | = 500/16 |
| jin_tw | 台斤 | 旧制港台 | 600 | convention | 台湾市场通行（第三方转述，**可信度中**；未取得官方条文原文） |
| jin_hk | 港斤 | 旧制港台 | 604.78982 | exact | 香港《度量衡条例》第 68 章（司马斤 = 1⅓ 磅） |

### 0.2 物质密度（克/毫升）— FAO/INFOODS Density Database v2.0

| id | 名称 | 典型 | 范围 | 粉粒状 |
|---|---|---|---|---|
| water | 💧 水 | 1.00 | — | 否 |
| milk | 🥛 牛奶 | 1.03 | 1.02–1.05 | 否 |
| oil | 🫒 食用油 | 0.92 | 0.914–0.927 | 否 |
| rice | 🍚 生大米 | 0.82 | 0.72–0.85 | 是 |
| flour | 🌾 面粉 | 0.58 | 0.48–0.67 | 是 |
| sugar | 🍬 白糖 | 0.88 | 0.70–0.95 | 是 |
| salt | 🧂 食盐 | 1.22 | 1.22–1.38 | 是 |

### 0.3 物品（克 / 毫升）

| id | 物品 | 量词 | 值 | 范围 | 级别 | linkable | 出处/依据 |
|---|---|---|---|---|---|---|---|
| pingpong | 🏓 乒乓球 | 个 | 2.7 g | — | standard | ✓ | ITTF 规则 2.3.3 |
| a4 | 📄 A4 纸 | 张 | 4.7 g | 4.4–5.0 | derived | ✓ | ISO 216：A4 = 1/16 m²；常见 70–80 g/m² |
| coin | 🪙 1 元硬币 | 枚 | 6 g | — | estimate | ✓ | 经验值（未查到央行公布的质量） |
| egg | 🥚 鸡蛋 | 个 | 55 g | 45–65 | standard | ✓ | SB/T 10638-2011 按重量分级：中号 55–60 g |
| banana | 🍌 香蕉 | 根 | 150 g | 100–200 | estimate | ✓ | 经验值（带皮） |
| apple | 🍎 苹果 | 个 | 200 g | 150–300 | estimate | ✓ | 经验值 |
| phone | 📱 智能手机 | 部 | 190 g | 150–230 | estimate | ✓ | 经验值 |
| saltbag | 🧂 一包盐 | 包 | 400 g | — | label | ✓ | 常见包装规格 |
| ricebag | 🛍️ 一袋大米 | 袋 | 5000 g | — | label | ✓ | 常见包装规格 |
| watermelon | 🍉 西瓜 | 个 | 5000 g | 3000–8000 | estimate | ✗ | 经验值，个头差别大 |
| drop | 💧 一滴水 | 滴 | 0.05 mL | 0.03–0.07 | estimate | ✓ | 常用估算 20 滴 ≈ 1 毫升，因滴管而异 |
| milkbox | 🧃 一盒牛奶 | 盒 | 250 mL | — | label | ✓ | 常见包装规格 |
| cola | 🥤 一罐可乐 | 罐 | 330 mL | — | label | ✓ | 常见包装规格 |
| bottle | 🧴 一瓶矿泉水 | 瓶 | 550 mL | — | label | ✓ | 常见包装规格 |
| oilbucket | 🛢️ 一桶食用油 | 桶 | 5000 mL | — | label | ✓ | 常见包装规格 |
| waterjug | 🚰 一桶桶装水 | 桶 | 18900 mL | — | label | ✓ | 常见 18.9 L 规格 |

### 0.4 口诀
1. 一斤 = 十两 = 500 克，一两 = 50 克（出处同 jin）
2. 1 升水 ≈ 1 千克 = 2 斤（水密度 1.00）
3. 「半斤八两」：旧制一斤十六两，半斤正是八两（1929《度量衡法》第五条）
4. 一磅 ≈ 0.9 斤（453.59 克）
5. 港斤、台斤都比大陆的斤重：600 多克

---

## 1. 文件结构

| 文件 | 职责 |
|---|---|
| `data.js` | `WV_DATA = { units, groups, substances, items, tips, levels }` |
| `convert.js` | `toBase / fromBase / convertAll / formatNumber / formatComposite / suggestItems / parseInput` |
| `index.html` | 结构 + 样式 + 交互（含吸顶导航、下拉刷新） |
| `tests/convert.test.cjs` | node:test：定义值、往返、数据完整性、组合写法、推荐 |
| `tests/ui.verify.cjs` | CDP 脚手架：320/390/430 × 浅/深 |
| `README.md` / `PROJECT_STATUS.md` | 说明 / 交接 |

---

## Chunk 1: 数据与计算（TDD）

### Task 1: 测试先行
- [ ] 写 `tests/convert.test.cjs`，覆盖：
  1. `toBase(1,'jin')===500`，`toBase(1,'lb')===453.59237`，`toBase(1,'gal_us')===3785.411784`，`toBase(1,'jin_hk')===604.78982`
  2. 所有单位 `fromBase(toBase(x,u),u)≈x`（x ∈ {0.001, 1, 123.456, 1e6}，相对误差 < 1e-12）
  3. 数据完整性：每个 unit/substance/item/tip 都有非空 `source`；id 不重复；item.kind ∈ {mass, volume}；level 属于 `levels`
  4. `convertAll(1,'l','water').jin` ≈ 2；`convertAll(1,'cup_us','flour').g` ≈ 137.2；跨类时 `approx===true` 当且仅当物质是粉粒状
  5. `formatComposite(625,'jin')==='1斤2两5钱'`；`formatComposite(250,'jin_old')==='8两'`；`formatComposite(0,…)===''`
  6. `formatNumber`：`0.1+0.2`→`'0.3'`；`1234567.891`→`'1234567.89'`（≤ 9 位有效）；`1e-9` 不出现 `e`→ 用「≈0」；
  7. `suggestItems({g:500,ml:500})` 返回 1–3 条，每条 ratio 在 [0.5, 20]，含 `bottle` 或 `egg`；`suggestItems({g:1e9,ml:1e9})` 返回 `[]`
  8. `parseInput('1,5')===1.5`、`parseInput('')===null`、`parseInput('-3')===null`、`parseInput('abc')===null`
- [ ] 运行 `node --test tests/` → 预期 FAIL（模块不存在）

### Task 2: data.js
- [ ] 按 §0 转录；`groups` 定义组顺序与组名；`levels` 定义 exact/convention/standard/derived/label/estimate 的中文标签
- [ ] 文件尾：`(typeof module!=='undefined')?module.exports=WV_DATA:globalThis.WV_DATA=WV_DATA`

### Task 3: convert.js
- [ ] 实现 Task 1 的函数（核心规则：
  - `convertAll(value, unitId, substanceId)`：先换基准；源是 mass → `g=base, ml=g/density`；源是 volume 反之；返回 `{[unitId]: value, g, ml, approx}`
  - `formatNumber(x)`：`|x|<1e-6` → `'≈0'`；否则 `Number(x.toPrecision(9))`，整数部分 ≥ 1e12 用中文「万亿」退化为 `toExponential(3)`
  - `formatComposite(g, system)`：市制 斤/两/钱（钱保留 1 位小数，去尾零）；旧制 斤/两（16 两制，两保留 1 位）
  - `suggestItems({g, ml})`：对每个 linkable 物品取 ratio，过滤 [0.5, 20]；分数 = 与最近 0.5 倍数的相对偏差 + 0.02·log2(ratio)；按分数取，排除 ratio 相近（比值差 < 1.6 倍）的，最多 3 个
- [ ] `node --test tests/` → 全绿
- [ ] **变异测试**：把 `jin` 改成 501、把 `suggestItems` 区间上限改成 2000，各跑一次确认变红，再改回
- [ ] commit：`feat: 数据表与换算内核（含出处与自检）`

## Chunk 2: 界面

### Task 4: index.html 骨架 + 视觉
- [ ] 风格 token 从 data-Calculation 拷（`--bg/--card-bg/--text-main/--accent/--nav-idle`…），深浅两套；`theme-color` 两份；`viewport-fit=cover` + 安全区
- [ ] 全局 `[hidden]{display:none!important}`；hover 包 `@media (hover:hover)`；可点元素 `touch-action:manipulation`
- [ ] 吸顶导航「换算 / 图鉴 / 口诀」：照搬 data-Calculation 模块六（sticky、z-index 90、白底蓝药丸、滚动高亮、`scroll-margin-top`）

### Task 5: 换算模块
- [ ] 物质选择：7 个按钮 4 列网格（不横滑）、≥44px、选中=蓝色实心；下方一行密度说明 + 粉粒状警示
- [ ] 结果摘要卡：市制组合写法 + 物品联动标签（点了跳图鉴并高亮）
- [ ] 单位分组为 iOS「inset grouped」列表：左名称、右输入框；输入框 `type=text inputmode=decimal` 17px 右对齐；正在编辑的格子保留原文；其他格子实时更新；结果为空时其他格清空
- [ ] 「归零」按钮 ≥44px

### Task 6: 图鉴 + 口诀
- [ ] 分段控件「重量 / 容量」；物品按值升序；行=emoji+名称+「约 55 克（45–65）≈ 1.1 两」+ 级别标签 + 出处小字（#6E6E73 以上对比度）；点行 → 填入换算（克或毫升）并滚回换算、目标行闪一下
- [ ] 口诀用 `<details>`，展开看出处

### Task 7: 下拉刷新
- [ ] 从 `references/组件_下拉刷新/pull-to-refresh.html` 搬 v1.7（预热同源 css/js 后 reload）；输入框聚焦时 `blocked()` 返回 true

## Chunk 3: 验证与发布

### Task 8: 浏览器验证
- [ ] `tests/ui.verify.cjs` 用脚手架：320/390/430 × 浅/深：`scrollWidth<=clientWidth`；所有按钮/输入 ≥44px 高；输入 `1` 到「斤」后「克」显示 500；物质切到面粉后 1 美制杯 → 克≈137；点联动标签后图鉴目标行进入视口；导航点击跳转
- [ ] 截 390 档浅/深各一张给用户看
- [ ] 进程收尾：只按自己 PID / user-data-dir 唯一名清理

### Task 9: 发布
- [ ] README、PROJECT_STATUS
- [ ] `gh repo create fjkkx77/Weight-Volume --public --source . --push`；开 Pages（main / root）
- [ ] 打开线上地址核对；加入站点巡检 `SITES`
- [ ] 记忆：项目指针、资产清单（吸顶导航第二次用→抽组件，另起任务时做，本次登记）
