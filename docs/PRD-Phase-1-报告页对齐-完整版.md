# ShenYuan Phase 1 PRD：报告页对齐（英文+韩文完整版）

**版本**：1.0 | **日期**：2026-08-10  
**作者**：Claude Code  
**状态**：✅ 待 Karen 审批 & 技术启动

---

## 1. 概述

### 1.1 项目目标
三语（中文/英文/韩文）八字报告页面对齐，统一交互与设计规范，打通完整变现闭环。

**战略背景**：
- **中文主站**（HK 47.242.80.65:3021）：已上线基础变现 — 报告 $9.9/$19.9、订阅 $6.9/月
- **英文版**（bazi-en.html）：逻辑复用中文，缺英文化 prompt + 对标 Western astrology 背景用户
- **韩文完整版**（docs/saju-report-KR.html）：样张 9.6/10 已定稿，需打通完整流程（结果页→付费→收款）

### 1.2 核心交付物
| 语言 | 现状 | Phase 1 目标 | 优先级 |
|------|------|-----------|---------|
| **中文** | 基础上线（3021） | 优化变现UI + 诚实文案 | P0 |
| **英文** | 逻辑框架完成 | 英文 prompt 调优 + 对齐中文 CSS | P0 |
| **韩文** | 样张定稿（9.6/10） | 完整流程打通（结果→付费→支付） | P1 |

**成功指标**：
- ✅ 三语 CSS/交互统一（mobile-first 390px 一套代码）
- ✅ 报告生成耗时 <8s（含 AI 调用）
- ✅ 付费转化率 baseline 建立（中文先上线测试）
- ✅ 支付成功率 >95%（3 语言实时监控）

---

## 2. 需求分析

### 2.1 用户痛点 & 竞品缝隙

#### 中文市场
- **痛点**：现有报告是前端假数据（Math.sin 造数据）→ 用户不信 → 付费率低
- **缝隙**：对标国内 App Store 榜单，无人主打"真排盘 + AI 万字深度报告"的组合
- **我们做**：实时调用 `/api/bazi` 生成真实报告，分级展示（basic 免费四柱/five elements，full 付费）

#### 英文市场（海外华人 + 世界人口）
- **痛点**：西方用户对"八字"陌生，需要 Western astrology 类比解释
- **缝隙**：Cozy 只有中文版；No Western-centric BaZi app with AI depth
- **我们做**：prompt 改为"古代中国命理体系 vs 西方占星类比"，用英文文化参照讲解

#### 韩文市场（Tier-1 优先级，吃신년운세 春节峰）
- **痛点**：포스텔러/점신 都是模板报告，不做"30年大运同步"궁합，真人上山海经贵且慢
- **缝隙**：**无人主打"AI 万字韩式사주深报告 + 온라인팩스직"即时变现**
- **我们做**：完整流程打通 — 결과페이지 → 付费墙 → KakaoPay/NaverPay/Toss → 报告落库

---

## 3. 功能需求清单

### 3.1 Phase 1 核心功能（按优先级）

#### P0：三语报告核心流程
```
┌─────────────────────────────────────────┐
│  生日输入 (Date Picker mobile-optimized) │
│  性别选择 (Gender Radio)                 │
│  时辰 (Hour Picker 12 Chinese + English)│
│  修正(DST checkbox for EN/KR)            │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│  加载态 (Hexagram spinner + 3-step text)│
│  • 算盘排八字...                         │
│  • 分析五行大势...                       │
│  • 生成命理深度报告...                   │
│  (30-60s 进度条 shimmer)                 │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│  结果页展示                              │
│  ├─ 四柱八字 (4-column grid)             │
│  ├─ 五行分析 (Bar chart)                 │
│  ├─ 日干分析卡片 (Daymaster card)       │
│  ├─ 免费部分 (Basic: 四柱+五行+日干)    │
│  └─ 锁定部分 (Full: 运势+财运+情感+流年)│
│     → 付费墙 sticky CTA                  │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│  付费流程                                │
│  • 选档次 ($9.9 full / $6.9 member)    │
│  • 跳转 createCheckout                  │
│  • 支付页 (3语言 Stripe/KakaoPay 等)   │
│  • 回流：本地生成报告卡片               │
│    (带 Full access token 重拉数据)      │
└─────────────────────────────────────────┘
```

#### P0.1：报告内容分级（后端 hasFullAccess flag）
```javascript
// 后端返回示例 (getFullBaziReport)
{
  "basic": {
    "sizhu": { /* 四柱 */ },
    "elements": { /* 五行分析 */ },
    "daymaster": { /* 日干 */ },
    "wordsCount": 1800  // ~1800字
  },
  "full": {  // 需 hasFullAccess=true
    "fortune": {
      "career": "...",      // 事业运
      "wealth": "...",      // 财运
      "relationship": "...", // 情感
      "health": "..."        // 健康
    },
    "dayun": [ /* 大运流年 */ ],
    "liuNian": [ /* 2026-2030 */ ],
    "wordsCount": 5800
  }
}
```

#### P0.2：三语 Prompt 调优（复用 Lumee 军师三轴结构）

**中文 Prompt**（现有，优化 4 点）
```
保持：麦玲玲风格（具体数字 + 时间点 + 先难后解）
优化：
1. 加"AIGC 免责" → 句尾加标注 [AI参考·真实解读需咨询专业人士]
2. 改医疗化 → "健康倾向" 代替 "易患XX病"
3. 诚实承诺 → "大运引导·不决定人生" 代替 "必然XX"
4. 语气暖化 → "陪伴·同情·理解" 加强
```

**英文 Prompt**（新增，需创意输入）
```
向导用户背景假设：
- 25-45 岁海外华人 OR 国际学生 OR 华裔美人
- 对中文文化有 50% 理解（不是母语）
- 理解西方占星但陌生于 BaZi 系统
- 寻求"人生方向·职业·情感"指导

Prompt 架构（3 轴）：
1. 翻译轴：八字术语 → 英文等价 (Day Master = 日干)
2. 类比轴：BaZi 元素 → Western elements 对标
   - 木火土金水 → Growth(Wood) Passion(Fire) Foundation(Earth) Precision(Metal) Introspection(Water)
   - 十神 → Archetypal roles (Wealth Officer, Seal, Officer, etc.)
3. 文化轴：故事讲法要西方友好（打破宿命论·强调"趋势引导"）

样本框架：
"Your Four Pillars Reading reveals [5-7 key patterns]. 
In Western terms, your chart shows [Element strengths].
Career trajectory: [具体运势] — not destiny, but a guiding trend.
Relationship pattern: [感情特质] — understand yourself to attract alignment.
Recommended action: [建议] — work WITH your chart's strengths."

关键词禁用：
❌ "must" / "will definitely" / "fate" (宿命)
✅ "may indicate" / "suggests" / "favorable timing"
✅ "use this self-knowledge to..." (赋能型)
```

**韩文 Prompt**（已有样张 9.6/10，校对 2 点）
```
现状优点：
✅ 温柔陪伴语气（重 jeong）
✅ 韩式术语到位（십성/신살/용신/일간/배우자자리）
✅ 去医疗化（"건강운 약함" 非 "질병 조심"）

优化点：
1. 加韩国 AI 法合规 → "연예 및 참고용 [AI분석]" 免责
2. 加"온라인팩스직" 链接 → 결과页底部留连接引导支付后推荐真人咨询

样本结构维持不变，微调措辞确保 9.6→9.8/10
```

#### P0.3：CSS 统一方案（mobile-first 一份代码 3 语言）

**设计系统整合**（避免三份 CSS 重复）
```
方案 A：❌ 不推荐（3份 HTML + 3份 CSS）
bazi.html (CN) + bazi-en.html (EN) + bazi-kr.html (KR) → 代码重复 70%，维护地狱

方案 B：✅ 推荐（1份 HTML template + CSS Variables）
brand-tokens.css 作为全局主色系（已有）
language.css 包含 font-family 差异 (Noto Serif SC vs Inter vs Noto Serif KR)
component.css 包含所有组件（复用）

具体做法：
1. 创建 /assets/css/report-unified.css （合并 bazi/bazi-en 的 <style>）
2. 三个 HTML 都引入 report-unified.css + language.css
3. 用 <html lang="zh-CN|en|ko"> 和 CSS 属性选择器差异 font-family
4. 各 HTML 只保留业务逻辑 script，删除重复 CSS
```

**具体 CSS 重构**
```css
/* report-unified.css */

/* 全局设计令牌（已有，保持） */
:root {
  --bg: #faf8f5;
  --card: #ffffff;
  --gold: #c9a84c;
  --jade: #5bbfa0;
  /* ... 其他 12 个变量 ... */
}

/* Language-specific font */
html[lang="zh-CN"] { --font-serif: 'Noto Serif SC'; --font-sans: 'Noto Serif SC'; }
html[lang="en"] { --font-serif: 'Cormorant Garamond'; --font-sans: 'Inter'; }
html[lang="ko"] { --font-serif: 'Noto Serif KR'; --font-sans: 'Noto Sans KR'; }

body { font-family: var(--font-serif), serif; }

/* 组件样式（三语共用） */
.sizhu-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.zhu { background: var(--card); border: 1px solid rgba(201,168,76,0.12); border-radius: 10px; }

/* 响应式（mobile-first） */
@media (min-width: 480px) { /* tablet */ }
@media (min-width: 768px) { /* desktop */ }

/* 微妙语言差异 */
html[lang="en"] .fortune-title { font-size: 13px; letter-spacing: 0.04em; } /* EN 紧凑 */
html[lang="ko"] .fortune-title { font-size: 14px; letter-spacing: 0.06em; } /* KR 宽松 */
html[lang="zh-CN"] .fortune-title { font-size: 13px; letter-spacing: 0.08em; } /* CN 最宽 */
```

#### P0.4：交互对齐 3 点
```
1. 加载态对齐
   • 进度文案三语翻译（现只有中文）
   • Hexagram spinner 统一（已是，保持）
   • 进度条 shimmer 统一（已是，保持）
   
2. 付费墙对齐
   中文：$9.9 full / $6.9 member（美元）
   英文：同上（美元）
   韩文：₩9,900-₩19,900 (KRW) / ₩5,900 (member)
   
   • 价格单位自动从 region 推导（后端 getRegion/IP + 前端 localStorage 优先级）
   • CTA 颜色统一（gold gradient）
   
3. 错误处理
   • 生日无效：三语统一报错文本 (已有，校对拼写)
   • 网络失败：Retry button + 错误日志上报（Sentry）
   • 超时（>60s）：超时提示 + 报告缓存查询
```

---

### 3.2 Phase 1 后端需求

#### 端点梳理 & 分级

| 端点 | 已有 | P1 需求 | 变更 |
|------|------|--------|------|
| `POST /api/bazi` | ✅ | 中文 prompt 优化 | 改 prompt |
| `POST /api/bazi-en` | ❌ 新增 | 英文 prompt 执行 | 新增 |
| `POST /api/bazi-kr` | ❌ 新增 | 韩文 prompt 执行 | 新增 |
| `GET /api/bazi/:id` | ✅ | 支持返回 lang query | 改逻辑 |
| `POST /api/create-checkout` | ✅ | 三语价格/币种支持 | 改逻辑 |
| `POST /api/orders` | ✅ | 加 hasFullAccess 分级 | 改逻辑 |

**新增端点细节**：

```javascript
// POST /api/bazi-en (新增)
// 复用中文排盘逻辑，仅 prompt 改为英文
{
  request: {
    year, month, day, hour, gender, timezone,
    lang: "en"  // 新增参数
  },
  response: {
    id: "bazi_xxxxx",
    lang: "en",
    basic: { /* same structure */ },
    full: { /* locked until paid */ },
    html: "<div class='report'> ... </div>" // 可选：直出 HTML 降低前端计算
  }
}

// GET /api/bazi/:id?lang=en (改逻辑)
// 现状：只返回中文
// 改后：返回指定语言的 prompt 结果 OR 重新生成该语言版本
// 伪代码：
if (cached[id][lang]) return cached[id][lang];
else return regenerateReport(id, lang);  // 复用八字排盘·改 prompt
```

#### 数据库（Supabase）变更
```sql
-- 现有表
CREATE TABLE bazi_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  created_at TIMESTAMP,
  lang TEXT,  /* NEW: 'cn' | 'en' | 'kr' */
  data JSONB, /* 存四柱/五行/日干/大运等中立数据 */
  prompt_version TEXT, /* 追踪 prompt 版本 */
  regenerated_langs JSONB /* ['en', 'kr'] 表示被重新生成过 */
);

-- 新增审计日志（防止滥用 API）
CREATE TABLE api_rate_limits (
  user_id TEXT,
  endpoint TEXT,  /* '/api/bazi' '/api/bazi-en' 等 */
  attempts INT,
  reset_at TIMESTAMP
);
```

#### 部署检查清单（Server）

| 检查项 | 详情 | P1 |
|-------|------|-----|
| Prompt 文件 | `/server/prompts/` 新增 `bazi-en.txt` + `bazi-kr.txt` | ✅ |
| 环境变量 | `DEEPSEEK_API_KEY` (现有) 继续用，分配额度 | ✅ |
| Rate Limiting | 后端 `/api/bazi*` 限流 (5req/min/IP) | ✅ |
| Sentry | 新增 event: `ai_report_generated` (lang tag) | ✅ |
| 缓存 | Redis 存 bazi_reports (TTL 7 days) | ✅ |

---

### 3.3 前端需求（JavaScript 变更）

#### 全新架构（一份 HTML 支持三语）

**方案演进**：
```
旧：bazi.html (CN) + bazi-en.html (EN) + bazi-kr.html (KR) [70% 重复代码]
新：bazi.html + i18n system + 单一 JavaScript 逻辑
```

**实现步骤**：

1. **创建 i18n 文件** (`/assets/js/i18n.js`)
```javascript
const i18n = {
  'cn': {
    header_title: '八字命理',
    form_label_birth: '生辰',
    loading_step_1: '算盘排八字...',
    loading_step_2: '分析五行大势...',
    error_invalid_date: '请输入有效的生日',
    btn_generate: '生成报告',
    paywall_unlock: '解锁完整报告',
    paywall_price: '¥99.9', // 假示例
  },
  'en': {
    header_title: 'BaZi Destiny Reading',
    form_label_birth: 'Birth Date',
    loading_step_1: 'Calculating Four Pillars...',
    loading_step_2: 'Analyzing Elemental Pattern...',
    error_invalid_date: 'Please enter a valid birth date',
    btn_generate: 'Generate Report',
    paywall_unlock: 'Unlock Full Reading',
    paywall_price: '$9.9',
  },
  'kr': {
    header_title: '사주 심층 리포트',
    form_label_birth: '생년월일',
    loading_step_1: '사주 계산 중...',
    loading_step_2: '오행 분석 중...',
    error_invalid_date: '유효한 생년월일을 입력하세요',
    btn_generate: '리포트 생성',
    paywall_unlock: '완전한 리포트 보기',
    paywall_price: '₩9,900',
  }
};

// 使用
function t(key) {
  const lang = document.documentElement.lang || 'cn';
  return i18n[lang]?.[key] || key;
}

// DOM 中
document.querySelector('.header-title').textContent = t('header_title');
```

2. **统一表单逻辑** (`/assets/js/bazi-form.js`)
```javascript
class BaziForm {
  constructor() {
    this.lang = document.documentElement.lang || 'cn';
    this.bindEvents();
  }
  
  async submit() {
    const { year, month, day, hour, gender } = this.getFormData();
    
    // API 端点选择 (智能路由)
    const endpoint = {
      cn: '/api/bazi',
      en: '/api/bazi-en',
      kr: '/api/bazi-kr'
    }[this.lang];
    
    const response = await fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({ year, month, day, hour, gender })
    });
    
    return response.json();
  }
}
```

3. **删除冗余代码**
```bash
# 当前
bazi.html (20KB)      → 中文专用
bazi-en.html (21KB)   → 英文专用（80% 复制）
bazi-kr.html (22KB)   → 韩文专用（85% 复制）
合计：63KB 代码重复

# 改后
bazi.html (20KB)      → 模板 + i18n
i18n.js (8KB)         → 翻译资源
bazi-form.js (12KB)   → 逻辑
合计：40KB （60% 减代码）
```

#### 前端支付流程对齐

**现状问题**：
```
中文 bazi.html：点"解锁" → createCheckout → Stripe 成功 ✅
英文 bazi-en.html：无支付逻辑 ❌
韩文样张：无支付逻辑 ❌
```

**P1 修复**：
```javascript
// bazi-form.js 新增
async handlePaywall() {
  const { region, lang } = this.detectRegion();
  
  const priceMap = {
    'cn': { amount: 999, currency: 'USD', methods: ['stripe'] },
    'en': { amount: 999, currency: 'USD', methods: ['stripe'] },
    'kr': { amount: 9900, currency: 'KRW', methods: ['kakao', 'naver', 'toss', 'stripe'] }
  };
  
  const price = priceMap[lang];
  
  // 跳转支付
  window.location.href = `/pay.html?reportId=${this.reportId}&amount=${price.amount}&currency=${price.currency}`;
}

// 支付成功回流
if (URLParams.paid === '1') {
  // 用 token 重拉 full report
  this.loadFullReport(this.reportId, this.accessToken);
}
```

---

## 4. 质量标准

### 4.1 产品质量门禁（10分制）

#### 报告内容质量（由 AI 生成）

| 维度 | 标准 | 检查方法 | P0 | P1 |
|-----|------|--------|-----|-----|
| **准确性** | 四柱排盘 100% 正确 | 交叉验证万年历 | ✅ | ✅ |
| **深度** | 英文 ≥4000 词 | wc -w report.txt | ✅ | ✅ |
| **本地化** | 无机翻痕迹 | 母语人读检查 | ⚠️ | ✅ |
| **诚实** | AIGC 标注 + 免责 | grep "AI参考" report | ✅ | ✅ |
| **不冒犯** | 无医学索赔 + 无宿命论 | 法务审阅 | ✅ | ✅ |

**自动化检查脚本**（Haiku 执行）：
```bash
# 检查 1：四柱正确性
python check_bazi.py --date "1990-05-15" --expected "庚午 癸巳 丙子 壬辰"

# 检查 2：词数统计
wc -w report.txt | awk '{if ($1 < 3500) exit 1}'  # >= 3500 words

# 检查 3：AI 标注覆盖
grep -c "\[AI参考\]" report.txt | awk '{if ($1 == 0) exit 1}'

# 检查 4：禁用词过滤
forbidden_words=("一定会" "命中注定" "你必然" "肯定会")
for word in "${forbidden_words[@]}"; do
  grep -q "$word" report.txt && exit 1
done
```

#### 页面性能质量

| 指标 | 目标 | 方法 | P0 | P1 |
|-----|------|------|-----|-----|
| **LCP** | <3s | Lighthouse | ✅ | ✅ |
| **FID** | <100ms | WebVitals | ✅ | ✅ |
| **CLS** | <0.1 | 视觉稳定性 | ✅ | ✅ |
| **报告生成** | <8s | backend latency | ✅ | ✅ |
| **付费跳转** | <200ms | 无阻塞 | ✅ | ✅ |

#### UI/UX 质量

| 维度 | 标准 | 检查方法 | 责任人 | P0 | P1 |
|-----|------|--------|-------|-----|-----|
| **可读性** | 对比度 ≥ 4.5:1 | WCAG Contrast Checker | Design | ✅ | ✅ |
| **触控友好** | 按钮 ≥ 44x44px | 尺寸检查 | Dev | ✅ | ✅ |
| **响应式** | 三屏无变形 (320/375/480) | 真机测试 | QA | ✅ | ✅ |
| **加载态** | 有转圈 + 文字进度 | 视觉检查 | UX | ✅ | ✅ |
| **错误提示** | 明确 + 可操作 | 制造失败场景 | Dev | ✅ | ✅ |

**关键设计核查单**（交 Karen 前必过）：
```markdown
- [ ] 所有 CTA 按钮大小 ≥ 44px（iOS 标准）
- [ ] 文本对比度 ≥ 4.5:1（WCAG AA）
- [ ] 圆角半径统一 (10/12/14px)
- [ ] 字号梯度一致 (12/13/14/16/20/22px)
- [ ] Padding/Margin 统一 (4/6/8/10/12/16px)
- [ ] 图标大小一致 (16/20/24/28/32px)
- [ ] 动画速度 ≤ 300ms
- [ ] 三语无文本截断或换行异常
- [ ] iOS notch/Android nav bar 不重叠
- [ ] 黑屏+弱网模拟正常显示
```

### 4.2 测试矩阵（QA 清单）

**测试环境**：
- 浏览器：Safari (iOS) / Chrome (Android) / Chrome (Desktop)
- 网络：4G / LTE / 弱网 (Throttle 3G)
- 设备：iPhone 12 / Samsung S21 / iPad

**测试用例 (30+ 场景)**：

| 功能 | 测试场景 | 预期结果 | 状态 |
|-----|---------|--------|------|
| **输入表单** | 有效生日 | 生成报告 | ✅ |
| — | 未来日期 | 报错"未来日期" | ✅ |
| — | 无效月日 | 报错"invalid date" | ✅ |
| — | 性别未选 | 按钮禁用 | ✅ |
| **加载态** | 提交后立即 | Hexagram 转圈 | ✅ |
| — | 30s 后超时 | 超时提示 + Retry | ✅ |
| **报告展示** | 四柱正确 | 显示排盘结果 | ✅ |
| — | 五行分析 | Bar 图正常 | ✅ |
| — | 日干卡片 | 信息完整 | ✅ |
| **付费墙** | 未付费用户 | 显示"锁定"标记 | ✅ |
| — | 点解锁按钮 | 跳转 Stripe 支付页 | ✅ |
| — | 支付成功 | 返回并刷新报告显示 full | ✅ |
| **三语切换** | CN → EN | 所有文本英文化 | ✅ |
| — | EN → KR | 所有文本韩文化 | ✅ |
| — | KR → CN | 所有文本中文化 | ✅ |
| **网络异常** | 连接中断 | 显示错误 + Retry | ✅ |
| — | 超时重试 | Exponential backoff (1s/2s/4s) | ✅ |
| **移动端特定** | 虚拟键盘弹出 | 不挡住输入框 | ✅ |
| — | 方向旋转 | 重新布局不闪屏 | ✅ |
| **无障碍** | 屏幕阅读器 | 按钮/标签可读 | ⚠️ |
| **支付流程** | Mock Stripe webhook | 订单确认 | ✅ |
| — | Mock KakaoPay 回调 | 订单确认 | ✅ |

**自动化 + 手测比例**：
- 自动化：单元测试 (Jest) + E2E (Playwright) = 60%
- 手测：真机测试 (iOS/Android) + 无障碍 = 40%

---

## 5. 技术实现

### 5.1 架构总览

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (3 语言)                      │
│  bazi.html + i18n.js + bazi-form.js + report-unified.css │
│                                                           │
│  Route: /pages/bazi.html?lang=cn/en/kr                  │
│  Feature: DatePicker + Form + LoadingHex + Report + CTA  │
└──────────────────┬──────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ↓                     ↓
┌──────────────────┐  ┌──────────────────┐
│  Backend API     │  │  Payment API     │
│  (Node.js PM2)   │  │  (Stripe/etc)    │
└──────────────────┘  └──────────────────┘
  POST /api/bazi        POST /api/createCheckout
  POST /api/bazi-en     POST /api/orders
  POST /api/bazi-kr     GET /api/orders/:id
  GET /api/bazi/:id
        │                     │
        ├─────────┬───────────┤
        ↓         ↓           ↓
    ┌─────────────────────────────────┐
    │   Supabase (HK Region)          │
    │  ├─ bazi_reports                │
    │  ├─ orders                      │
    │  └─ users (auth)                │
    └─────────────────────────────────┘
        │
        ↓
    ┌─────────────────────────────────┐
    │   External APIs (Rate Limited)   │
    │  ├─ DeepSeek (CN/EN/KR prompts) │
    │  ├─ TsinghuaWangyou (排盘)      │
    │  └─ Stripe Webhook (payment)    │
    └─────────────────────────────────┘
```

### 5.2 部署清单（HK 47.242.80.65:3021）

**当前部署结构**（中文主站）：
```
/opt/shenyuan/
├── server/
│   ├── index.js         ← PM2 入口
│   ├── pay.js           ← 支付处理
│   ├── prompts/
│   │   ├── bazi-cn.txt  ← 中文 prompt
│   │   ├── bazi-en.txt  ← 新增（P1）
│   │   └── bazi-kr.txt  ← 新增（P1）
│   ├── routes/
│   │   ├── bazi.js      ← /api/bazi*
│   │   └── order.js     ← /api/orders*
│   └── data.json        ← 用户数据备份
├── pages/
│   ├── bazi.html        ← 中文模板
│   └── ...
└── assets/
    ├── css/
    │   ├── report-unified.css ← 新建（P1）
    │   └── brand-tokens.css   ← 现有
    └── js/
        ├── i18n.js            ← 新建（P1）
        └── bazi-form.js       ← 新建（P1）
```

**部署命令**（改进版）：

```bash
#!/bin/bash
# deploy-phase1.sh

set -e  # Exit on error

# 1. 拉代码 & 更新依赖
cd /opt/shenyuan
git pull origin main
npm install

# 2. 生成 Prompt 文件
cat > server/prompts/bazi-en.txt << 'EOF'
You are a BaZi reading expert explaining ancient Chinese astrology to English-speaking audience...
EOF

cat > server/prompts/bazi-kr.txt << 'EOF'
당신은 한국 고객을 위한 사주 분석 전문가입니다...
EOF

# 3. 验证环境变量
required_vars=("DEEPSEEK_API_KEY" "STRIPE_SECRET_KEY" "DATABASE_URL")
for var in "${required_vars[@]}"; do
  [ -z "${!var}" ] && echo "❌ Missing $var" && exit 1
done

# 4. 运行数据库迁移
npm run migrate

# 5. 构建前端（如果有 bundler）
# npm run build

# 6. 重启 PM2（保留现有实例）
pm2 restart shenyuan --update-env

# 7. 验证健康检查
sleep 2
curl -f http://localhost:3021/health || (echo "❌ Health check failed" && exit 1)

echo "✅ Deployment complete"
```

**PM2 配置**（ecosystem.config.js）：

```javascript
module.exports = {
  apps: [
    {
      name: 'shenyuan',
      script: './server/index.js',
      instances: 2,  // 负载均衡
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3021,
        LOG_LEVEL: 'info'
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      merge_logs: true,
      autorestart: true,
      watch: false,  // 不要 watch（生产禁用）
      max_memory_restart: '500M',  // 内存保护
      // 优雅关闭
      kill_timeout: 5000,
      listen_timeout: 3000
    }
  ],
  deploy: {
    production: {
      user: 'ubuntu',
      host: '47.242.80.65',
      ref: 'origin/main',
      repo: 'git@github.com:shenyuan/shenyuan.git',
      path: '/opt/shenyuan',
      'post-deploy': 'npm install && npm run deploy'
    }
  }
};
```

---

## 6. 时间表 & 里程碑

### 6.1 Phase 1 完整倒排期

| 周期 | 任务 | 责任人 | 交付物 | 审批点 |
|-----|------|--------|--------|--------|
| **W1 (8/10-8/16)** | **设计定稿** | Design | 三语 Figma 高保真 | Karen 确认 |
| — | Prompt 初稿编写 | Content | CN/EN/KR 版本 | 母语校对 |
| — | 后端 API 设计 | CTO | Schema + 端点列表 | 架构评审 |
| **W2 (8/17-8/23)** | **前端重构** | Frontend | i18n + CSS 统一 | 代码审查 |
| — | 后端开发 | Backend | 三语端点 + 分级 | 集成测试 |
| — | Prompt 优化 v1 | AI 专家 | 英文/韩文 prompt | 独立评审 |
| **W3 (8/24-8/30)** | **集成测试** | QA | 30+ 测试用例 | 全绿 |
| — | 性能优化 | Perf | LCP <3s | Lighthouse ✅ |
| — | 合规审阅 | Legal | 免责条款 + AIGC 标注 | 法务审查 |
| **W4 (8/31-9/6)** | **Staging 验收** | 多方 | 三语端到端 | Karen 确认 |
| — | 用户测试 (beta) | Growth | 50 人 × 3 语言测试 | NPS ≥ 7 |
| **W5 (9/7-9/13)** | **上线准备** | DevOps | 部署脚本 + 监控 | Sentry/PostHog ✅ |
| — | 文档更新 | Tech Writer | API docs + FAQ | 内部培训 ✅ |
| **W6 (9/14-9/20)** | **灰度上线** (10% 流量) | DevOps | 中文先 → 英文 → 韩文 | 7天无异常 |
| **W7 (9/21-9/27)** | **全量上线** | DevOps | 100% 流量切换 | 正式发布 |

### 6.2 关键依赖 & 风险

| 风险 | 影响 | 缓解方案 | 业主 |
|-----|------|--------|------|
| **Prompt 质量不达标** (EN/KR) | 报告无用 → 转化 0 | 独立母语 agent 双评审 + 10 报告样本验证 | Content Lead |
| **Stripe KR 支付接入延迟** | KR 收不了钱 | Phase 1 KR 先用 Stripe，KakaoPay 随后迭代 | Karen (Fintech) |
| **数据库迁移失败** | 用户数据丢失 | 完整备份（AWS S3）+ 原地回滚脚本 | DevOps |
| **DeepSeek API 限流** | 报告生成失败 | 建立配额池 (日 5000 req)，超过降级到缓存 | Backend Lead |
| **三语 UI 变形** | 移动端崩溃 | 真机 + 虚拟机三屏测试，提前 1 周冒烟 | QA |
| **法合规缺陷** (AIGC 标注漏) | 罚款/下架 | 法务清单 + 自动化扫描脚本 (grep) | Legal |

---

## 7. 交付物清单

### 7.1 代码交付（Git 标签）

```bash
# 最终发布
git tag -a v1.0-phase1-report-align \
  -m "Three-language report unification: CN/EN/KR with unified CSS + i18n"
  
# 分阶段标签
git tag v1.0-p1-design-approved      # W1 设计定稿
git tag v1.0-p1-frontend-complete    # W2 前端完成
git tag v1.0-p1-qa-passed            # W3 QA 全绿
git tag v1.0-p1-staging-ready        # W4 Staging 准备
git tag v1.0-p1-production           # W7 生产上线
```

### 7.2 文档交付

| 文档 | 模板 | 交付周期 | 责任人 |
|------|------|--------|--------|
| **API 文档** | OpenAPI 3.0 | W4 | Backend |
| **Prompt 库** | 三语对标文档 | W3 | Content |
| **UI 组件库** | Storybook (可选) | W2 | Frontend |
| **部署指南** | runbook | W5 | DevOps |
| **监控告警** | Sentry/PostHog 配置 | W5 | DevOps |
| **测试报告** | QA 全矩阵 | W3 | QA |
| **合规审查** | 法务签字 | W4 | Legal |

### 7.3 监控指标（上线后每周审视）

```
Grafana Dashboard: https://grafana.shenyuan.app/d/phase1-reports

关键指标：
1. API 延迟 (p50/p95/p99)
2. 错误率 (5xx / timeout)
3. 转化率 (生成报告 → 付费)
4. 支付成功率 (按语言/支付方式分解)
5. 用户反馈 (NPS + 支持工单分析)
```

---

## 8. 验收标准（Karen 签字前）

### 8.1 功能验收

- [ ] **中文报告** 完整显示 (basic + full)，付费墙工作，支付成功回流
- [ ] **英文报告** 完整显示，Prompt 符合西方用户预期 (≥4000 words，无机翻)
- [ ] **韩文报告** 完整显示，支持 KakaoPay 支付 (staging 验证)，韩语措辞 ≥ 9.5/10
- [ ] **三语切换** 无缝切换，文本/UI/价格同步
- [ ] **加载态** 进度条三语翻译，Hexagram spinner 转圈 ≥ 30s

### 8.2 性能验收

- [ ] LCP <3s (Lighthouse)
- [ ] 报告生成 <8s (backend)
- [ ] 支付跳转 <200ms
- [ ] 无 CLS 抖动

### 8.3 安全验收

- [ ] AIGC 标注完整 (grep 找到所有报告)
- [ ] 免责条款三语一致
- [ ] 无医学索赔 (grep 禁用词)
- [ ] Stripe webhook 验签 ✅
- [ ] API 限流 ✅ (5 req/min)
- [ ] 用户数据加密 (Supabase 行级安全)

### 8.4 UX 验收

- [ ] 三屏无变形 (320/375/480)
- [ ] 按钮 ≥ 44px，对比度 ≥ 4.5:1
- [ ] iOS notch/Android nav 不重叠
- [ ] 错误提示清晰且可操作
- [ ] 支持无网络 (离线缓存报告)

---

## 9. 扩展路线图（Phase 2+）

### 9.1 Phase 1.5 (9 月中旬微优化)

- [ ] 英文报告 sample 集采样 (100 份样本分析质量)
- [ ] 韩文支付优化 (KakaoPay/NaverPay 限流处理)
- [ ] 合婚（궁합）英文版本铺开
- [ ] 用户反馈循环 (NPS 追踪)

### 9.2 Phase 2 (Q4 2026)

- [ ] 大运/流年英文版本铺开
- [ ] 紫微/塔罗其他命理品类 (复用报告页架构)
- [ ] 订阅升级 (daily horoscope 推送)
- [ ] 真人咨询对接 (Agora 连线)

---

## 10. 附录

### 10.1 术语对标表 (EN/KR)

| 中文 | 英文 | 韩文 | 定义 |
|------|------|------|------|
| 四柱 | Four Pillars | 사주 | 年月日时天干地支 |
| 八字 | Eight Characters | 팔자/사 | 四柱 = 8 个字 |
| 天干 | Heavenly Stem | 천간 | 10 个甲乙丙... |
| 地支 | Earthly Branch | 지지 | 12 个子丑寅... |
| 日干 | Day Master | 일간 | 日柱的天干，代表自己 |
| 五行 | Five Elements | 오행 | 木火土金水 |
| 十神 | Ten Relationships | 십성 | 比肩/劫财/食神... (10 种) |
| 大运 | Major Cycles | 대운 | 10 年一个周期 |
| 流年 | Annual Cycle | 유년/년도운 | 每年运势 |
| 用神 | Favourable Element | 용신 | 命局需要补强的元素 |

### 10.2 样本 Prompt (英文版)

```
# BaZi Reading Expert (English)

You are an expert in ancient Chinese Four Pillars astrology (BaZi), 
speaking to an English-speaking audience (age 25-50, overseas Chinese or international students).

Your audience may have 50% familiarity with Chinese culture but little knowledge of BaZi.
You bridge the knowledge gap by comparing BaZi concepts to Western astrology / psychology frameworks.

## Core Instructions

### 1. Format
- Write 4000-5500 words total
- Structure: Overview → Elemental Pattern → Life Phases → Recommendations
- Each section 1000-1500 words

### 2. Elemental Translation
When describing the Five Elements, use this framework:
- **Wood (木)**: Growth, Initiative, Expansion → "Your Growth Drive"
- **Fire (火)**: Passion, Expression, Leadership → "Your Creative Fire"
- **Earth (土)**: Stability, Caregiving, Grounding → "Your Foundation"
- **Metal (金)**: Precision, Logic, Discipline → "Your Precision"
- **Water (水)**: Introspection, Wisdom, Flexibility → "Your Inner Wisdom"

### 3. Story Arc (NOT Determinism)
- ❌ AVOID: "You WILL achieve X" / "You are DESTINED for Y"
- ✅ USE: "Your chart suggests a favorable period for X"
- ✅ EMPOWER: "Understanding this pattern helps you position yourself for opportunity"

### 4. Life Domains
Provide insights on:
1. **Career & Professional Path**: Your natural strengths, ideal industries
2. **Relationship & Love**: Communication patterns, compatibility indicators
3. **Financial Patterns**: Risk tolerance, wealth-building timing
4. **Health Tendencies**: Energy patterns (NOT medical diagnosis)
5. **Life Phases**: Major transitions (10-year cycles)

### 5. Tone
- Warm, thoughtful, empowering
- Avoid jargon OR explain every term
- Use "you", "your" to feel personal
- Honor the ancient wisdom while speaking contemporary English

### 6. Disclaimer
End with: "[This reading is AI-generated for entertainment and self-reflection purposes. 
For medical concerns, consult healthcare professionals. 
For legal matters, consult lawyers. This serves as a guide, not a guarantee.]"

## Input Data
- Four Pillars: ${YEAR_STEM_BRANCH} ${MONTH_STEM_BRANCH} ${DAY_STEM_BRANCH} ${HOUR_STEM_BRANCH}
- Day Master: ${DAY_MASTER} (You)
- Elemental Balance: ${ELEM_ANALYSIS}

Begin your reading:
```

---

**版本历史**：
- v1.0 (2026-08-10)：初版草稿，含功能/技术/质量/时间表

**审批流**：
- [ ] 产品审批 (Karen)
- [ ] 技术审批 (CTO)
- [ ] 法务审批 (Legal)
- [ ] CMO 审批 (营销对接)

---

**结束**

