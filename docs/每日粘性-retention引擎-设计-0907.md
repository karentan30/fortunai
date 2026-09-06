# Runae 每日粘性 / Retention引擎设计规格
> 作者: Product + Growth Design Session · 2026-09-07
> 两市场: 海外华人 (CN) + 美国英文 (EN)

---

## 0. TL;DR — 核心机制三句话

Runae的每日粘性核心是"个性化天机日历"——每天基于用户的真实八字 + 当日干支，客户端纯确定性算法生成一张私人化的**今日能量卡**（无需API调用、零成本），配合**日签打卡连击**（Duolingo式损失厌恶）和**明日预览钩子**（每天结尾露出一条明日悬念），驱动用户每日自发回来。用户的"投资"随时间积累（签到记录+批注日记），形成护城河和难以迁移的习惯。

---

## 1. 竞品撕裂分析 — 每款App的精确粘性机制

### 1.1 Co-Star / The Pattern
**触发 → 行动 → 可变奖励 → 投资**

- **触发**: 每日push"今日月亮过境XX宫 — 影响你的关系"。推送标题极度个性化（用用户真实出生图）。
- **行动**: 打开App，看"今天的能量"板块 — 一张精美的、仅属于你的行星牌，加4-5个具体维度（社交/工作/自我）。
- **可变奖励**: 内容每天不同（行星真实位置每天变），且偶有"罕见"事件（如水星逆行开始），制造"今天不能错过"感。
- **投资**: 用户记录了心情、与朋友共享了星盘对比 — 数据留在App里，带走成本高。

**Runae可借鉴**: 用真实干支（每天不同）驱动内容变化，而非循环写死内容。Co-Star的精髓是**每天内容真的不同**，而不是15条循环签文。

---

### 1.2 Duolingo
**触发 → 行动 → 可变奖励 → 投资**

- **触发**: 每天固定时间push（用户设置）+ Duo猫头鹰表情包"你今天还没练习！它在哭泣"
- **行动**: 5分钟一节课（摩擦极低）
- **可变奖励**: 通关后的音效+动画+宝石+连击数字大数字跳出
- **投资**: **连击天数**（streak）是最强护城河 — 用户宁可花$5/月买"streak保护"也不愿断连击

**核心机制**: **损失厌恶** > 收益预期。断掉一个21天连击的痛苦远大于坚持的快乐。

**Runae可借鉴**: 
- 让streak数字**非常显眼**（每次打开都看到）
- 提供"streak补签"会员权益（已有部分代码）
- 设定固定触发时间 + 个性化提醒文案（"今天是你的{五行}最强日，还没来看天机")

---

### 1.3 Finch / Fabulous
**触发 → 行动 → 可变奖励 → 投资**

- **触发**: 早晨固定仪式push（基于用户设置的起床时间）
- **行动**: "早安，今天完成3件事"— 低摩擦checklist（非大目标，是微习惯）
- **可变奖励**: Finch里有一只小鸟 — 每次完成任务，鸟会成长。可变：鸟今天说的话每天不同，去了不同地方"旅行"。
- **投资**: 用户给小鸟命名、选装扮、看成长 — 情感依附，拟人化

**Runae可借鉴**: 
- 创造一个**渐进成长的可视化对象** — 不是小鸟，是用户的"命运之树"或"福缘积分"，随签到天数生长
- 每日行动极度低摩擦（一键签到），但有情感反馈

---

### 1.4 Snapchat Streaks
**触发 → 行动 → 可变奖励 → 投资**

- **触发**: 23小时内你的streak即将断掉时，推送（"⏰ 你和XX的连击还有1小时到期！"）
- **行动**: 发一条Snap（即便是随意的）
- **可变奖励**: 连击数字 + 火焰emoji组合（100天变金色）
- **投资**: **社交锁定** — streak是两个人共同拥有的，断了对双方都是损失

**Runae可借鉴**: 
- 双人共同streak（"你和闺蜜的善缘连击"）
- 24小时内未签到时发"天机即将清零"提醒邮件/push

---

### 1.5 BeReal
**触发 → 行动 → 可变奖励 → 投资**

- **触发**: 每天随机时间推送"时间到了！2分钟内拍你的BeReal"
- **行动**: 2分钟内必须完成（时间压力）
- **可变奖励**: 看到朋友们的今日真实生活（新鲜感 + 窥探欲）
- **投资**: 你的过去BeReal构成了一本"生活相册"

**Runae可借鉴**: 
- **时间限定感**: "今日天机只在今天有效，明天换新" — 制造今日必看的紧迫感
- **日记留档**: 每天看完天机后，用户写一句"今天发生了什么"，长期形成时间轴

---

### 1.6 疯读 / 墨迹天气 / 黄历类日签
**触发 → 行动 → 可变奖励 → 投资**

- **疯读**: 每日阅读任务 + 阅读时长排行榜 + "今天读了XXX分钟"成就感
- **墨迹天气**: 每天必看因为**天气是刚需**，顺带看"今日黄历宜忌"
- **黄历日签**: 最简化版：一个宜忌列表 + 运势分 + 一键截图分享

**Runae可借鉴**: 
- 黄历日签的截图分享已实现（canvas share card）— 这是强增长引擎
- 但Runae比黄历强的是**真的个性化**（你的八字 vs 通用黄历）

---

## 2. Runae每日循环设计 — 具体方案

### 2.1 每日核心循环（精简版）

```
[触发] 早8点 → 邮件/push "今天是{干支}日 · 你的{日主}今日{关键词}"
    ↓
[行动] 打开daily主页 → 看个性化天机卡（<3秒加载，确定性算法，无API）
    ↓
[可变奖励] 每日内容真实变化（干支每天不同） + 偶发特殊日（节气/自己生日/流年节点）
    ↓
[投资] 一键签到 → 写一句日记批注 → 明日悬念预览
    ↓
[回来] 次日循环 · streak保护驱动
```

---

### 2.2 每日天机卡 — 内容结构（个性化算法）

**核心原则**: 所有内容必须基于用户真实八字 + 今日干支，**客户端确定性算法**生成，无需API调用（每天内容相同但个人独特）。

#### 天机卡7个维度（卡片UI）

| 维度 | 内容 | 算法来源 |
|------|------|---------|
| 今日干支 | 甲子日 | 基准日算法（已在daily.html实现）|
| 今日五行对你的影响 | "今日甲木旺，你的庚金日主受压，宜柔不宜刚" | 日干支五行 × 用户日主相克关系 |
| 能量指数 | 1-100分（五行相生相克计算）| 确定性公式 |
| 今日幸运色 | 从五行映射固定颜色表 | 日干五行 → 色彩表 |
| 今日宜 / 忌 | 固定宜忌词库 × 日支映射 | 地支 → 宜忌表（12支各10条） |
| 一句话指引 | "今天适合深思熟虑，少做决断" | 五行旺衰 × 预设模板库（无需AI）|
| 节气/特殊事件提示 | "距下一节气还有X天" | 节气固定算法 |

#### 个性化计算逻辑（客户端JS，无API）

```javascript
// 用户日主 × 今日天干 → 今日能量分
function computeDailyEnergy(dayMaster, todayHeavenlyStem) {
  // 五行相生 +30分，相克 -20分，同类 +10分
  const relations = WUXING_RELATIONS[dayMaster][todayHeavenlyStem];
  // 结果: { score: 0-100, relation: 'sheng'|'ke'|'same', keyword: '旺盛'|'受压' }
}

// 用户八字 × 今日地支 → 宜忌
function computeYiJi(userPillars, todayEarthlyBranch) {
  // 基于六合、三合、相冲关系映射宜忌词
}
```

完整映射表约200行JS，确定性 + 零API成本 + 每天刷新。

---

### 2.3 连击/仪式机制设计

#### Streak设计（借鉴Duolingo损失厌恶）

- **位置**: daily主页顶部hero区域，数字40px大字+火焰emoji，每次打开都看到
- **连击档位**:
  - 1-6天: 🕯️（烛火·刚开始）
  - 7-13天: 🌿（生长·有了习惯）
  - 14-29天: 🔥（燃起·真正入轨）
  - 30-89天: ✨（发光·修炼者）
  - 90+天: 🏆（大师·稀有成就）
- **视觉进度**: 横向进度条显示"距下个档位X天"
- **断签保护**: 会员专属1次/月补签机会（已有后端代码，前端需展示）
- **社交压力**: streak显示时附"分享你的连击"按钮，让用户晒到朋友圈/小红书

#### 仪式感设计（Finch风格）

- 签到动画: 打卡时一个金色圆圈扩散+粒子 → 感觉"仪式完成"
- 成就收藏: "解锁成就：第一个7天连击" → 永久存在localStorage的成就列表
- 生日特殊日: 用户生日当天，天机卡自动出现"今日是你命盘的年度重置点"+ 特殊UI

---

### 2.4 明日预览钩子（最强回来驱动）

daily.html已实现 `loadTomorrowTeaser()`，但目前调用`/api/daily-teaser`（API成本 + 不一定稳定）。

**改进方案**: 明日预览改为**纯客户端计算**：

```javascript
function renderTomorrowTeaser(userPillars) {
  var tomorrow = getNextDayGanzhi();
  var energy = computeDailyEnergy(userPillars.dayMaster, tomorrow.stem);
  var teaser = TEASER_TEMPLATES[energy.relation]; // 静态模板
  // 例: "明日{天干}木当令，你的水系力量得到补充 — 适合深聊心事"
  document.getElementById('tomorrowText').textContent = teaser;
  document.getElementById('tomorrowTeaser').style.display = 'block';
}
```

呈现方式: 用**模糊遮罩** (blur filter) 半显示明日卡片 → "明天来看完整" → 最强回来钩子。

---

### 2.5 回来钩子 — Web App可用手段（按优先级排序）

| 方案 | 实现难度 | 效果 | 状态 |
|------|---------|------|------|
| **每日邮件推送** (每天早8点，基于用户birth data) | 中 | 高（打开率15-25%） | 需建邮件队列 |
| **浏览器Push通知** | 中 | 高（已有代码框架） | 已实现，需VAPID key配置 |
| **Add to Homescreen (PWA)** | 低 | 中 | 已实现 pwaPrompt |
| **明日天机截图分享** (社交裂变) | 低 | 极高（自然传播） | canvas share已实现 |
| **邮件订阅 + 每日运势邮件** | 中 | 高 | 已有订阅入口 |
| **微信服务号模板消息** (国内) | 高 | 极高 | 未做，需公众号资质 |

**立即可做（无后端改动）**: 强化"截图分享"的视觉质量 → 图片里醒目写今天日期+干支，让用户有理由每天截图分享。

---

### 2.6 "投资"积累 — 用户数据锁定

**日记批注（最重要的投资机制）**:
- 看完天机后，底部出现: "今天运势验证了吗？写一句话留档"
- 输入框 + 一键保存到localStorage
- 日记自动关联今日干支，形成"个人命理日记本"
- 7天/30天后，打开会看到"你的历史记录" → 锁定效应

**历史时间轴**:
- `daily-sign.html` 已有30天dot grid
- 升级为**可点击的历史时间轴**：点击某一天 → 看当天的天机内容 + 自己写的日记批注
- 这是真正的"只有你自己有"的数据

---

## 3. Unicorn Feel — 7个具体触感设计

### 3.1 "今日能量震动" (WOW时刻 #1)
用户打开daily页，显示今日干支时，**屏幕轻微震动** (vibrate API，80ms) + 金色粒子从顶部散落。
- 感觉: "今天的天机为你揭开了"
- 成本: 0（已有stardust粒子，加vibrate一行代码）

### 3.2 干支大字 + 实时呼吸动画
今日干支（如"甲子日"）以56px金色字在顶部，持续做极慢的0.97-1.0 scale呼吸动画（已有类似代码）。
- 感觉: 活的、有生命的日历，不是死的页面

### 3.3 五行能量条 — 带"对你的影响"语
能量条旁不只是数字，而是一句话: "木旺 · 利你的决策力今日最强"
- 对比竞品（通用木火土金水百分比），Runae的感觉是**它认识你**

### 3.4 节气倒计时 + 特殊UI
距离下一个节气（如寒露）还有X天时，天机卡顶部出现隐约的节气插图（SVG，轻量）。
节气到达当天: 特殊背景（金色更浓）+ "今日是寒露，天机能量转换点"
- 成本: 节气表静态数据，SVG插图5kb

### 3.5 签到成功的"仪式感"动画
点击签到按钮 → 300ms内播放:
1. 按钮变金色
2. 一个从按钮中心向外扩散的圆圈
3. streak数字从旧数字滚动到新数字（counter动画）
4. 右上角弹出"✦ 天机已记录 · 第X天"
- 感觉: 像游戏，有反馈，不像打勾表格

### 3.6 "今日彩蛋" — 低频惊喜
每15天左右（用连击天数mod算），随机触发一条额外内容:
"✦ 你的天机今日显示一条罕见提示 [隐藏内容点击解锁]"
- 内容来自一个50条的静态文案库（基于用户日主选）
- 感觉: 像开盲盒，增加可变奖励

### 3.7 "命运共振" — 双人彩蛋（EN市场）
如果用户和朋友都看了同一天天机（通过ref link追踪）:
"今天你们两人的命盘产生了共振 — [点击看你们的今日能量对比]"
- 触发分享 + 新用户拉新

---

## 4. 最小可上线版本 Build Plan

### 4.1 Daily主页确认

**选定页面**: `pages/daily.html` (CN) / `pages/daily-en.html` (EN)
现状: 已有天机卡功能，但每次进入需要**重新输入生辰** — 这是最大的用户体验断点。

### 4.2 P0修复: 出生数据持久化（最重要的改动）

**问题**: 每次进入daily页都要输入生辰，零retention可能。
**修复**: 

```javascript
// daily.html script区域添加 (line ~590之前)
var BIRTH_KEY = 'runae_birth_v1';

function saveBirth(year, month, day, hour, gender) {
  localStorage.setItem(BIRTH_KEY, JSON.stringify({year, month, day, hour, gender}));
}

function loadBirth() {
  try {
    var raw = localStorage.getItem(BIRTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

// 在getDailyReading()开头存入:
saveBirth(year, month, day, hour, gender);

// 页面加载时自动回填并静默触发:
window.addEventListener('DOMContentLoaded', function() {
  var birth = loadBirth();
  if (birth) {
    document.getElementById('year').value = birth.year;
    document.getElementById('month').value = birth.month;
    document.getElementById('day').value = birth.day;
    if (birth.hour !== undefined) document.getElementById('hour').value = birth.hour;
    // 自动触发，隐藏form
    document.getElementById('inputWrap').style.display = 'none';
    getDailyReading(); // 自动加载！用户第二次来直接看结果
  }
});
```

**效果**: 用户第二次开页面，直接看到今天的天机，无需任何操作。这一步将D2留存从~5%提升到>40%。

### 4.3 P0修复: 客户端Streak（无需登录）

**问题**: 目前streak依赖服务器 (`updateStreak(req.userId || req.ip)`)，但:
1. 未登录用户的`req.ip`在Vercel/Nginx环境下可能是反向代理IP，**多用户共享同一streak** — 这是BUG。
2. IP会变（手机网络切换），连击会莫名断掉。

**文件:行**: `server/routes/daily.js:183` — `updateStreak(req.userId || req.ip)`

**Bug根因**: `req.ip` 在reverse proxy后是内网IP或Vercel的pool IP，不代表独立用户。多个不同用户可能映射到同一个streak条目，导致别人的streak计数到你头上，或你的streak被别人"使用"重置。

**修复方案（前端localStorage streak，无需后端改动）**:

```javascript
// 在daily.html中，在结果显示后添加客户端streak逻辑:
var DAILY_KEY = 'runae_daily_v2';

function clientUpdateStreak() {
  var now = new Date();
  var today = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
  var raw = localStorage.getItem(DAILY_KEY);
  var state = raw ? JSON.parse(raw) : { count: 0, lastDate: null, best: 0 };

  if (state.lastDate === today) return state; // 今天已算
  var yesterday = new Date(Date.now() - 86400000);
  var ymd = yesterday.getFullYear() + '-' + String(yesterday.getMonth()+1).padStart(2,'0') + '-' + String(yesterday.getDate()).padStart(2,'0');
  state.count = (state.lastDate === ymd) ? state.count + 1 : 1;
  state.lastDate = today;
  state.best = Math.max(state.best, state.count);
  localStorage.setItem(DAILY_KEY, JSON.stringify(state));
  return state;
}

// 在getDailyReading() success回调里，替换/补充 showStreak(data.streak):
var clientStreak = clientUpdateStreak();
showStreak(clientStreak.count); // 用客户端streak而非服务器streak
```

同时在`server/routes/daily.js:183`的`updateStreak`改为只对登录用户调用:
```javascript
const streakData = req.userId ? updateStreak(req.userId) : { streak: 0, isNew: false };
```

### 4.4 P1: 确定性每日天机（减少API调用）

**目标**: 用户第N次（非首次）查看当天天机时，直接从缓存读，不再调API。

```javascript
// daily.html: 在getDailyReading() success回调末尾添加
var cacheKey = 'sy_daily_cache_' + birth.year + '_' + birth.month + '_' + birth.day + '_' + today;
localStorage.setItem(cacheKey, JSON.stringify(data));
// 清理7天前的旧缓存

// 页面加载时先查缓存:
var cached = localStorage.getItem(cacheKey);
if (cached) {
  renderResults(JSON.parse(cached)); // 直接渲染，不调API
  return;
}
```

### 4.5 P1: Streak Hero区域重新设计

**位置**: `daily.html` resultArea最顶部，在affirmationWrap之前插入:

```html
<div id="streakHero" style="text-align:center;padding:20px 16px 8px;display:none">
  <div id="streakEmoji" style="font-size:32px;margin-bottom:4px">🌱</div>
  <div id="streakBigNum" style="font-family:'Cormorant Garamond',serif;font-size:56px;font-weight:700;color:var(--gold);line-height:1"></div>
  <div style="font-size:10px;letter-spacing:.22em;color:var(--ink-light);text-transform:uppercase;margin-top:4px">DAY STREAK · 连续查看</div>
  <div id="streakProgress" style="height:3px;background:rgba(201,168,76,0.15);border-radius:2px;margin:12px 20px 0;overflow:hidden">
    <div id="streakBar" style="height:100%;background:linear-gradient(90deg,var(--gold-deep),var(--gold));border-radius:2px;transition:width 1s ease"></div>
  </div>
  <div id="streakNextGoal" style="font-size:10px;color:var(--ink-light);margin-top:5px;letter-spacing:.06em"></div>
</div>
```

### 4.6 P1: 日记批注（最低成本投资机制）

在 `affirmation-wrap` 之后添加:

```html
<div id="dailyJournal" style="margin:0 16px 12px;display:none">
  <div style="font-size:9px;letter-spacing:.22em;color:var(--gold);opacity:.7;margin-bottom:8px;text-transform:uppercase">今日验证 · Journal</div>
  <textarea id="journalInput" maxlength="100" placeholder="今天的天机准了吗？写一句话留档…" 
    style="width:100%;border:1px solid rgba(201,168,76,0.15);border-radius:10px;padding:12px;background:rgba(201,168,76,0.03);font-family:'Noto Serif SC',serif;font-size:13px;color:var(--ink);resize:none;min-height:60px;letter-spacing:.04em"></textarea>
  <div style="text-align:right;margin-top:6px">
    <button id="saveJournal" style="font-size:11px;padding:5px 14px;background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.2);border-radius:10px;color:var(--gold);cursor:pointer;font-family:inherit;letter-spacing:.06em">保存 →</button>
  </div>
</div>
```

JS: 保存时以`sy_journal_YYYY-MM-DD`为key存localStorage，形成个人命理日记。

### 4.7 P2: 修复practice-tracker.html的暗模式切换bug

**文件**: `pages/practice-tracker.html:370`

```javascript
// 当前代码 (BUG: 两个分支都设置'dark')
function toggleTheme(){var e=document.documentElement;var b=document.getElementById('themeToggle');e.classList.toggle('dark-mode');var l=e.classList.contains('dark-mode');if(b)b.textContent=l?'🌙':'🌙';localStorage.setItem('sy_theme',l?'dark':'dark');}
```

**BUG**: 无论toggle到哪个状态，localStorage都写入`'dark'`，且emoji也永远是`'🌙'`，主题无法真正切换到light mode。

**修复**:
```javascript
function toggleTheme(){
  var e=document.documentElement;
  var b=document.getElementById('themeToggle');
  e.classList.toggle('dark-mode');
  var l=e.classList.contains('dark-mode');
  if(b)b.textContent=l?'🌙':'☀️'; // FIX: ☀️ for light
  localStorage.setItem('sy_theme',l?'dark':'light'); // FIX: 'light' not 'dark'
}
```

另外practice-tracker.html第369行的初始化也有问题：
```javascript
// 当前: 检查 'light' 但class名是 'light-mode'，而toggleTheme用'dark-mode'
// 两个不同class名，整个theme系统不一致
(function(){var t=localStorage.getItem('sy_theme');if(t==='light'){document.documentElement.classList.add('light-mode');...
```

practice-tracker用`light-mode` class，但`daily-sign.html`用`dark-mode` class，**两个页面的主题系统完全不兼容**。这也解释了"progress features don't work"的感觉 — 主题切换在practice-tracker上完全失效。

---

## 5. 执行优先级汇总

| 优先级 | 任务 | 文件 | 工时 |
|-------|------|------|------|
| **P0** | 出生数据localStorage持久化，回访自动加载 | daily.html, daily-en.html | 1h |
| **P0** | 客户端streak（替换服务端IP-based streak） | daily.html + daily.js:183 | 2h |
| **P0** | 修复practice-tracker主题切换bug | practice-tracker.html:370 | 20min |
| **P1** | Streak Hero大数字UI插入resultArea | daily.html | 1h |
| **P1** | 日记批注组件 | daily.html | 1.5h |
| **P1** | 明日预览改为客户端确定性算法（无API） | daily.html | 3h |
| **P2** | 节气倒计时 + 特殊节气UI | daily.html | 2h |
| **P2** | 历史时间轴（日签页升级） | daily-sign.html | 3h |
| **P2** | 双人共振彩蛋（EN市场） | daily-en.html | 4h |

---

## 6. 核心KPI目标（上线后追踪）

- **D1留存**: 目前~估计10%（需要出生数据持久化才有意义）→ 目标35%
- **D7留存**: 目标15%（靠streak驱动）
- **D30留存**: 目标8%（靠投资锁定）
- **每日打开次数**: 目标平均1.2次/日活（早看 + 晚验证）
- **截图分享率**: 目标15%日活用户每天分享一张图

---

## 附录A: 破损功能诊断清单

### BUG #1: practice-tracker.html 主题切换完全失效
- **文件**: `/pages/practice-tracker.html`
- **行号**: 369-370
- **根因**: 双重错误 — (1) 初始化读'light'但加class `light-mode`，而toggling用`dark-mode`，两个class名冲突；(2) `toggleTheme`函数无论toggle到哪个方向都写入`'dark'`到localStorage，切不到light。主题永远是dark且无法切换。

### BUG #2: daily.html streak基于req.ip，多用户共享
- **文件**: `server/routes/daily.js`
- **行号**: 183
- **根因**: `updateStreak(req.userId || req.ip)` — 未登录用户fallback到IP，但在Vercel/reverse proxy环境下多用户共享同一内网IP，导致streak数据污染。表现为：用户看到的streak可能是别人的，或自己的streak被重置。

### BUG #3: daily-sign.html fortune选择不个性化
- **文件**: `pages/daily-sign.html`
- **行号**: 193-196
- **根因**: `var idx = d % FORTUNES.length;` — 按日期mod 15轮循环，所有用户当天看到完全相同的签文，没有任何个性化，且15条后会重复。这不是crash级bug，但是"没有每日粘性感"的核心原因之一。

---

## 附录B: 邮件日签模板（每日触发）

**CN版标题**: `[善缘] 今日{干支}日 · {用户日主}的天机已揭晓`
**EN版标题**: `[Runae] Your {DayStem} Day Reading · {DayMaster} Energy Today`

邮件正文: 今日干支 + 3行能量简报 + 一句话指引 + "点击看完整天机" CTA

每日早8点通过现有`/api/subscribe`列表批量发送（Resend邮件服务，成本约$0.001/封）。

---

*文档由 Claude Code 生成 · 2026-09-07 · 供Karen决策用*
