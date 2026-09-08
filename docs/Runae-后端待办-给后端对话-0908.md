# Runae 后端待办（给后端对话·自成一体·0908 修订版）

> 项目：/Users/karen/projects/shenyuan · 生产分支 `deploy-candidate-0907` · Node 后端（端口 3021·PM2 名 shenyuan） · 前端 pages/ 由另一会话负责，**你只改 `server/` 及其引用的共享文件，绝不碰 pages/*.html**。
>
> 部署：改完先 `node -e "require('./server/routes/divination.js')"` 语法校验 + `curl` 实测，push 用 `git -c http.version=HTTP/1.1 push`（本机代理会 HTTP/2 报错）；服务器执行 `git reset --hard origin/deploy-candidate-0907 && pm2 restart shenyuan`。提交只 `git add` 自己动过的 server 文件，绝不 `git add -A`。

---

## 代码审计结论（接手必读，对应原文档说的坑）

1. **`/api/session` 并未修好 lang**：原文档写"已修"——实际代码（`divination.js` L1550-1590）根本没从 `req.body` 读 `lang`，system/user prompt 全是中文硬编码。这是 P0-1 里最大的漏，优先级最高。
2. **`calcBazi` 无 `lacking` 字段**：引擎返回 `{ dayMaster, dayMasterElement, isStrong, wuxing: {木,火,土,金,水} }`，没有 `lacking`，需自行从 `wuxing` 里算最小值。原文档说"已有 calcBazi 能出"，表述不准确。
3. **`WU_XING_GAN` 未在 divination.js 模块顶层导入**：`require('../bazi')` 只解构了 `calcBazi`，没有 `WU_XING_GAN`。要么补充导入，要么就地写内联 map（见 L375 已有的 `WU_XING_GAN_MAP` 局部变量可参考）。
4. **`_dailyDayPillar` 返回 `{gan, zhi, ganzhi}`，无 element**：要推断流日五行必须自己用干支 map 转换。
5. **`/api/daily`（routes/daily.js）的元素是伪造的**：用 `(dateNum + birthNum) % 5` 种子哈希出"今日五行"，与真正的流日干支无关。P0-2 的改造要对 `/api/daily/card`，不要误动 `/api/daily`（这个旧产品还在 daily.html/saju-KR.html 用，暂不动）。
6. **daily/card 无缓存**：同一人同一天多次请求全走 LLM，成本直线上升。
7. **PDF 功能零代码基础**：P1 里的"月度 PDF"需先选定方案（puppeteer/wkhtmltopdf/模板 HTML→print）再写，文档里没说清楚怎么做。

---

## 🔴 P0-1：lang 全端点扫（英文页报告正文出中文的根因）

**现象**：英文页 UI 全英文，但 AI 生成的报告/卡片正文仍是中文。

**根因**：多个后端端点没有 `lang` 分支，或接收了 `lang` 但没有传给 prompt。

### 需要修的端点清单（优先级排序）

| 端点 | 文件 | 问题 | 修法 |
|------|------|------|------|
| `POST /api/session` | `divination.js` L1550 | **从不读 `lang`**，全中文硬编码 system/userPrompt | 从 `req.body.lang` 读取，加 `if (lang === 'en')` 英文 persona + 英文 userPrompt 分支，参照 `/api/hehun/stream` 的 en 分支写法（L2424）|
| `POST /api/tarot/stream` | `divination.js` L2885 | `systemPrompt` 硬编码中文，未读 `lang` | 加 `const lang = req.body.lang \|\| 'zh'`，en 时换英文 system + `langSuffix('en')` |
| `POST /api/xingming` | `divination.js` L3700 | 无 `lang`，全中文 | 加 `lang` 分支，en 时 system+user 换英文（参照 tarot 写法即可）|
| `POST /api/lingqian` | `divination.js` L4017 | 无 en 分支 | 加 `lang` 分支；签诗本身仍中文，解签部分走 `langSuffix('en')` |
| `POST /api/daily-teaser` | `divination.js` L4585 | 未读 `lang` | 加 `lang` 分支 |
| `POST /api/ask-followup` | `divination.js` L4564 | 未读 `lang` | 加 `lang` 分支 |
| `POST /api/zhiyuan` | `divination.js` L4475 | 未读 `lang` | 加 `lang` 分支 |

**不需要动**（已有 en 分支）：`/bazi`、`/daily/card`、`/monthly`、`/bazi/topic`、`/tarot`（非 stream）、`/ziwei`、`/mianxiang`、`/shouxiang`、`/hehun/stream`、`/fengshui`、`/astrology`、`/liuyao`、`/daliuren`、`/qimen`、`/omikuji`、`/rune`、`/kyusei`、`/jyotish`、`/maya`、`/tibet`（这些已有 en 或走 `langSuffix`）。

**验证 done 标准**：`curl -X POST https://yourhost/api/session -H 'Content-Type: application/json' -d '{"method":"bazi","topic":"career","birthYear":1990,"birthMonth":6,"birthDay":15,"birthHour":10,"gender":"male","lang":"en"}' | grep -c "English"` 返回正文包含英文。每个修过的端点都跑一遍类似 curl。

---

## 🔴 P0-2：每日运势卡 `/api/daily/card` 重做（5.5→9 分）

**目标**：把 score / luckyColor / luckyDir 从"让 LLM 自己推"改为"后端代码算好注入 prompt"，消除五行推理幻觉。修改范围仅限 `divination.js` 中 `router.post('/daily/card', ...)` 这一个路由。

### (a) 补导入

在 `divination.js` 顶部 `require('../bazi')` 那行改为：

```js
const { calcBazi, WU_XING_GAN } = require('../bazi');
```

（`WU_XING_GAN` 已在 `bazi.js` 的 `module.exports` 里，只是没被解构出来。）

### (b) 升级 `_dailyDayPillar`，返回五行 element

```js
function _dailyDayPillar(dateStr) {
  const WU_XING_GAN_MAP = {甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'};
  try {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(dateStr || '').trim());
    if (!m) return null;
    var y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    var bz = calcBazi(y, mo, d, 12, 'male');
    var gan = bz.day.gan, zhi = bz.day.zhi;
    return { gan, zhi, ganzhi: gan + zhi, element: WU_XING_GAN_MAP[gan] || '木' };
  } catch (e) { return null; }
}
```

### (c) 在路由里代码算出 relation / baseScore / luckyColor / luckyDir / lacking

在 `chartCore` 赋值块之后、`const system = ...` 之前插入：

```js
// ③ 五行关系 + 分数 + 幸运色/方位（代码算，不经 LLM）
const WX_MAP = {甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'};
const WX_CYCLE = { 木:{生:'火',克:'土',被生:'水',被克:'金',泄:'水'},
                   火:{生:'土',克:'金',被生:'木',被克:'水',泄:'木'},
                   土:{生:'金',克:'水',被生:'火',被克:'木',泄:'火'},
                   金:{生:'水',克:'木',被生:'土',被克:'火',泄:'土'},
                   水:{生:'木',克:'火',被生:'金',被克:'土',泄:'金'} };
const LUCKY_RULES = {
  木: { color: { name: lang==='en'?'Forest Green':'碧绿', hex:'#228B22' }, dir: lang==='en'?'East':'东' },
  火: { color: { name: lang==='en'?'Vermillion':'朱红', hex:'#E34234' },  dir: lang==='en'?'South':'南' },
  土: { color: { name: lang==='en'?'Amber':'黄棕', hex:'#D4A017' },      dir: lang==='en'?'Center':'中' },
  金: { color: { name: lang==='en'?'Silver White':'银白', hex:'#C0C0C0' },dir: lang==='en'?'West':'西' },
  水: { color: { name: lang==='en'?'Deep Navy':'藏蓝', hex:'#1B2A4A' },  dir: lang==='en'?'North':'北' },
};
// 日主五行 & 最缺五行
let dmElem = null, lacking = null, hardBaseScore = 68, relation = 'neutral';
let luckyColorCode = null, luckyDirCode = null;
try {
  const _bz2 = calcBazi(Number(birthYear), Number(birthMonth), Number(birthDay),
                        _hasHour ? Number(birthHour) : 12, gender || 'male');
  dmElem = _bz2.dayMasterElement; // '木'|'火'|'土'|'金'|'水'
  const wx = _bz2.wuxing || {};
  // 最缺五行（五行分布最低）
  lacking = Object.entries(wx).sort((a,b) => a[1]-b[1])[0]?.[0] || null;
  // 今日流日五行
  const dayElem = (dayPillar && dayPillar.element) ? dayPillar.element : null;
  // relation 判断（用于决定 baseScore 区间 & prompt 语气）
  if (dayElem && dmElem && WX_CYCLE[dayElem]) {
    if (WX_CYCLE[dayElem].生 === dmElem)         relation = '生';   // 流日生日主
    else if (WX_CYCLE[dayElem].克 === dmElem)    relation = '克';   // 流日克日主
    else if (dayElem === dmElem)                 relation = '助';   // 同类助旺
    else if (WX_CYCLE[dmElem] && WX_CYCLE[dmElem].生 === dayElem) relation = '泄'; // 日主泄气
    else                                         relation = '耗';
  }
  // baseScore（硬约束，±10 浮动由 LLM 在区间内填）
  const SCORE_MAP = { '生': [70,85], '助': [65,80], '泄': [55,70], '耗': [45,60], '克': [40,55], 'neutral': [60,75] };
  const [lo, hi] = SCORE_MAP[relation];
  hardBaseScore = Math.round((lo + hi) / 2);
  // 幸运色/方位取"最缺五行"（今天补什么）
  const fillElem = lacking || dayElem || dmElem || '木';
  luckyColorCode = (LUCKY_RULES[fillElem] || LUCKY_RULES['木']).color;
  luckyDirCode   = (LUCKY_RULES[fillElem] || LUCKY_RULES['木']).dir;
} catch(e) {}
```

### (d) 把算好的值注入 prompt，并约束 score 区间

在 `const userPrompt = ...` 里的命盘核心字符串之后，追加锚点行（中英文分开）：

**中文 userPrompt 追加**：
```
\n【后端已算好，你必须遵守】\n日主五行：${dmElem || '未知'}｜最缺五行：${lacking || '未知'}｜今日流日五行：${dayPillar?.element || '未知'}｜relation=${relation}\nscore 必须在 ${hardBaseScore-8}~${hardBaseScore+8} 整数范围内。\nluckyColor 必须输出：{"name":"${luckyColorCode?.name}","hex":"${luckyColorCode?.hex}"}（不得改动）\nluckyDir 必须输出："${luckyDirCode}"（不得改动）\n宜忌/insight 必须与 relation=${relation} 一致：'生/助'→偏进取；'克/耗'→偏保守修整；'泄'→偏输出表达。
```

**英文 userPrompt 追加**（在 `Read THIS day for THIS person...` 行之前）：
```
\n[Backend pre-computed — you MUST use exactly as given]\nDay-master element: ${dmElem || '?'} | Most lacking element: ${lacking || '?'} | Today day-pillar element: ${dayPillar?.element || '?'} | Relation: ${relation}\nscore MUST be an integer in ${hardBaseScore-8}~${hardBaseScore+8}.\nluckyColor MUST be: {"name":"${luckyColorCode?.name}","hex":"${luckyColorCode?.hex}"} (do not change)\nluckyDir MUST be: "${luckyDirCode}" (do not change)\nyi/ji/insight MUST align with relation=${relation}: '生/助'→proactive; '克/耗'→conservative/repair; '泄'→expressive/output.
```

### (e) 解析层：直接用代码算好的值覆盖 LLM 输出

在现有 `const out = { ... }` 里，把 luckyColor 和 luckyDir 改为用代码值：

```js
luckyColor: luckyColorCode || { name: (typeof lc.name === 'string' && lc.name.trim()) ? lc.name.trim() : fallback.luckyColor.name, hex: hexOk ? ... : fallback.luckyColor.hex },
luckyDir: luckyDirCode || ((typeof p.luckyDir === 'string' && p.luckyDir.trim()) ? p.luckyDir.trim() : fallback.luckyDir),
```

同时 score 做硬截断到 relation 区间：

```js
if (hardBaseScore > 0) score = Math.max(hardBaseScore - 10, Math.min(hardBaseScore + 10, score));
```

### (f) 升级 system prompt（替换现有的中英文 system 字符串）

**中文 system**（替换 `divination.js` L984 的 `'你是一位精准…'` 字符串）：
```
你是 Runae 每日运势顾问。融合 The Pattern（命理数据全翻成大白话心理语言）、Co-Star（像朋友直白点你）、Chani（给具体能做的事）。

【已给你算好的锚点，必须遵守，不得重新推算】日主五行/最缺五行/今日流日五行/relation(生克助泄耗) 已在 user 消息中标注。你必须用 relation 驱动 score/宜/忌/insight：relation=生/助→偏进取；克/耗→偏保守修整；泄→偏输出表达。不同 relation 的人同一天，宜/忌/insight 必须明显不同。绝不脱离这些锚点写通用鸡汤。

【零黑话铁律】命盘/五行/干支/十神（日主/日元/庚食神/身强弱等）只用于内部推理，绝不出现在任何用户可见输出。全部大白话+具体建议。

【诚实】自我觉察+娱乐，不做命定断言，不吓唬，不承诺结果。只输出严格 JSON，禁止 markdown、代码围栏、多余说明。

字段规则：
- insight：像朋友当面说的一句话，≤45字，含[今天能量状态]+[对这个人具体的一个行动]。换另一个 relation 的人还能成立=太泛，必须重写。✅"今天推力够，那个你一直没启动的计划，动一步比等下去强。" ❌"能量聚焦，适时而动。"（禁）
- yi(3条)/ji(2条)：具体场景化行动（"开会提方案"而非"推进工作"）；第1条 yi 必须扣今日 relation。
- qian.text：大白话一两句，禁文言黑话。
- score/luckyColor/luckyDir：已由后端固定，直接照搬，不得修改。
- 输出前自检：insight/yi[0] 换个 relation 还成立吗？不合格重写。
```

**英文 system**（替换 L983 的 `'You are a precise…'` 字符串，大意同上，用 English）。

### (g) 加每日卡同人同日缓存（防重复计费）

在路由最开头、`try` 块内，接生辰参数之后插入：

```js
// 同人同日缓存：避免同一用户当天重复调 LLM
if (!_M.dailyCardCache) _M.dailyCardCache = {};
const _cardKey = [birthYear, birthMonth, birthDay, birthHour||'x', gender||'m', dateStr, lang].join('|');
if (_M.dailyCardCache[_cardKey]) return res.json(_M.dailyCardCache[_cardKey]);
```

在 `res.json(out)` 之前：

```js
_M.dailyCardCache[_cardKey] = out;
// 次日自动清理（按当天 key 隔天自然失效，或每天清一次）
setTimeout(() => { delete _M.dailyCardCache[_cardKey]; }, 26 * 60 * 60 * 1000);
```

### (h) 补 `luckyHour` 字段（前端"时辰"栏现在空着）

在 `const out = { ... }` 里加：

```js
luckyHour: lang === 'en'
  ? (p.luckyHour || '9 AM – 11 AM')
  : (p.luckyHour || '巳时（09-11点）'),
```

并在 `schemaHint` 里两个语言版本都加入 `"luckyHour": "<auspicious time window today>"` 字段说明。

### 验证 done 标准

```bash
# 不同出生日期同日期应得不同 score 区间
curl -X POST .../api/daily/card -d '{"birthYear":1990,"birthMonth":6,"birthDay":15,"birthHour":10,"gender":"male","lang":"zh"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['score'], d['luckyColor'], d['luckyDir'])"
# 英文版
curl -X POST .../api/daily/card -d '{"birthYear":1990,"birthMonth":6,"birthDay":15,"birthHour":10,"gender":"male","lang":"en"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['insight'][:30])"  # 确认是英文
# 同人同日第二次调用，响应时间应 <50ms（缓存命中）
```

---

## 🟡 P1-1：`/api/daily`（routes/daily.js）流日真排替换伪种子

`routes/daily.js` 里"今日五行"用 `(dateNum + birthNum) % 5` 哈希，不是真流日。这个端点目前服务 daily.html（中文）、daily-en.html（英文）、saju-KR.html（韩文），改动有回归风险。

**做法**：把 `todayElementZh/En/Ko` 改为用 `_dailyDayPillar(dateStr)` 真算，元素 → 中文/英文/韩文名称。幸运数字保留种子哈希（随机就行）。改完必须 curl 三个语言各验一次。

---

## 🟡 P1-2：报告按付费档分层字数（tier 控制 maxTokens）

`/api/bazi` 和 `/api/session` 已有 `tier` 概念，但 `/api/monthly`、`/api/daily/card` 的 `maxTokens` 是固定值（700、2048 等）。

**做法**：在 `/api/monthly` 加 `const isFull = gateReportAccess(req, ['monthly']).full`，full 时 maxTokens=4096，否则 maxTokens=1800。日卡因为是 JSON 结构不需要分层，保持 700 即可。

---

## 🟡 P1-3：续费到期提醒邮件（挽留钩子）

`payment.js` 里 `invoice.payment_failed` 事件已有续费失败提醒邮件（L419），但没有"订阅将在 3 天后到期"的提前提醒。

**做法**：加一个 cron job（`setInterval` 每天一次，或注册到现有的 push.js 的定时逻辑里），扫 `_M.orders` 里 `expires_at` 在未来 3 天内的活跃订阅，调 `sendEmail` 发挽留邮件。邮件模板参照 L420 的风格写英文+中文两版，按 `order.lang` 分支。

防重复：给订单加一个 `reminded_expiry: true` 标记，发过不再发。

---

## 🟡 P1-4：裂变防刷加固

`referral.js` 有"邀请人首次真实测算后才奖励"逻辑（onInviteeFirstReading）。当前缺失：
- 同 IP 多账号刷邀请：在 `tryApplyReferral` 加 IP 去重检查（`_M.referralIps`）
- 自邀自刷：确认已有 `inviter === invitee` 判断；若无，加上
- 奖励上限：每个邀请人最多奖励 N 人（推荐 10），写入 `_M.referralCounts[userId]`

---

## 🟡 P1-5：PDF 月度报告（留存钩子）

**当前无任何 PDF 代码**。推荐方案：

1. 服务器安装 `puppeteer`（或用已有 Caddy+Node 环境的 `@sparticuz/chromium`）
2. 新建 `server/lib/pdf-gen.js`：接受 `{ html, filename }` → 调 puppeteer 截 PDF → 返回 Buffer
3. 新建路由 `GET /api/monthly-report-pdf?month=2026-09&token=xxx`：校验 token → 查订阅有效性 → 若本月已生成则返回缓存，否则先调 `/api/monthly` 生成 markdown → 用模板 HTML 渲染 → 调 `pdf-gen.js` → `res.setHeader('Content-Type','application/pdf')` 流式返回

**先决条件**：先确认服务器能装 puppeteer（HK 47.242.80.65 的内存和磁盘容量）；目前磁盘 77% 是最早红线，装 chromium 大约再用 300MB，要先确认可行再写代码。

---

## 🟢 P2 / 确认事项

### P2-1：DeepSeek failover 验证
Karen 充值后，`server/lib/llm.js` 里的 failover 顺序（deepseek→groq 或类似）需实测一次：把 DeepSeek key 临时改错，确认请求自动降级到下一个 provider 且返回 200。

### P2-2：Google 登录联调
`/api/auth/google`（commit a6eb5f6）后端已接，等前端加按钮后：
1. curl 测 `POST /api/auth/google` 带合法 `id_token`，返回 `{ token }` 确认
2. 测无效 token 返回 401
3. 在 daily-EN.html 点击 Google 登录按钮，全流程走通

### P2-3：`/api/daily-teaser` lang 分支（P0-1 做完后确认）
这个端点给首页免登录卡片用，做完 P0-1 再顺手验一遍英文页的 teaser 是否出英文。

---

## 通用后端待补缺漏（优先级 P1~P2，按影响排序）

| 缺失项 | 影响 | 建议 |
|--------|------|------|
| daily/card 同人同日无缓存 | 每次刷新都扣 LLM 成本 | 见 P0-2(g) |
| `/api/session` 无 lang | 英文用户报告出中文 | P0-1 优先做 |
| `lang` 分支无公共 helper | 每个端点各写一次 `if lang==='en'`，维护成本高 | 可提取 `buildLocalizedPrompt(system_zh, system_en, user_zh, user_en, lang)` 工具函数放 `lib/llm.js`，后续端点统一用 |
| 错误响应无 i18n | en 用户收到中文报错 | 至少对 400/429/500 的 `error` 字段加 `lang` 分支 |
| 农历/时区 | `/api/daily`、`/api/daily/card` 用服务器本地时间（HK UTC+8）算"今天"，美国用户可能跨日 | 接受 `clientDate` 参数，前端传本地 YYYY-MM-DD，优先使用 |
| 报告埋点 | 无法知道哪个 method/lang 成本最高 | 在 `insertReading.run(...)` 调用处记录 `{ method, lang, tokens_est, tier }` 到 `_M.costLog`，每周汇总 |

---

## 部署/回归核查清单

每次改完至少跑以下命令，全部 200 再 push：

```bash
# 语法检查
node -e "require('./server/routes/divination.js'); console.log('OK')"
node -e "require('./server/routes/daily.js'); console.log('OK')"

# P0-1 - session lang
curl -s -X POST http://localhost:3021/api/session \
  -H 'Content-Type: application/json' \
  -d '{"method":"bazi","topic":"career","birthYear":1990,"birthMonth":6,"birthDay":15,"birthHour":10,"gender":"male","lang":"en"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('reading',''); print('EN_OK' if r and not any(c>'一' for c in r[:50]) else 'FAIL:'+r[:80])"

# P0-2 - daily/card 五行锚点
curl -s -X POST http://localhost:3021/api/daily/card \
  -H 'Content-Type: application/json' \
  -d '{"birthYear":1990,"birthMonth":6,"birthDay":15,"birthHour":10,"gender":"male","lang":"zh"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('score=',d.get('score'),'color=',d.get('luckyColor',{}).get('name'),'dir=',d.get('luckyDir'),'insight=',d.get('insight','')[:30])"

# P0-2 - daily/card 英文
curl -s -X POST http://localhost:3021/api/daily/card \
  -H 'Content-Type: application/json' \
  -d '{"birthYear":1990,"birthMonth":6,"birthDay":15,"birthHour":10,"gender":"male","lang":"en"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('EN insight:', d.get('insight','')[:50])"

# 基础回归：bazi 不能挂
curl -s -X POST http://localhost:3021/api/bazi \
  -H 'Content-Type: application/json' \
  -d '{"birthYear":1990,"birthMonth":6,"birthDay":15,"birthHour":10,"gender":"male","lang":"zh","mode":"free"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('bazi OK, len=', len(d.get('reading','')))"
```
