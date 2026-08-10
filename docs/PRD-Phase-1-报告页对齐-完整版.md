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

**语言检测与初始化逻辑**（UX补充）
```javascript
// /assets/js/language-detection.js (新增)
// 初始化用户语言环境

function detectAndSetLanguage() {
  // 优先级：URL param > localStorage > IP geolocation > 浏览器 lang > 默认 CN
  
  // 1. URL 参数 (?lang=en)
  const urlParam = new URLSearchParams(window.location.search).get('lang');
  if (urlParam && ['cn', 'en', 'kr'].includes(urlParam)) {
    setLanguage(urlParam);
    return;
  }
  
  // 2. 本地存储（记住用户上次选择）
  const saved = localStorage.getItem('preferredLanguage');
  if (saved) {
    setLanguage(saved);
    return;
  }
  
  // 3. IP 地理位置检测（仅 Phase 1.5 实装，目前用浏览器 lang）
  // 这里可接入 IP2Location 等服务，但 P1 先跳过
  
  // 4. 浏览器语言
  const browserLang = navigator.language.split('-')[0];  // 'en' from 'en-US'
  const supported = {
    'zh': 'cn',
    'en': 'en',
    'ko': 'kr'
  };
  
  if (supported[browserLang]) {
    setLanguage(supported[browserLang]);
    return;
  }
  
  // 5. 默认中文
  setLanguage('cn');
}

function setLanguage(lang) {
  document.documentElement.lang = lang;
  document.documentElement.setAttribute('data-lang', lang);
  localStorage.setItem('preferredLanguage', lang);
  
  // 触发 i18n 更新（见 i18n.js）
  window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
}

// 页面加载时执行
document.addEventListener('DOMContentLoaded', detectAndSetLanguage);

// 手动切换语言（右上角语言选择器）
window.switchLanguage = function(newLang) {
  setLanguage(newLang);
  // 重新加载报告（保持 reportId）
  location.reload();
};
```

**语言选择器 UI（右上角）**（P0 新增）
```html
<!-- 右上角语言切换按钮 -->
<div class="language-switcher">
  <button class="lang-btn active" data-lang="cn" onclick="window.switchLanguage('cn')">中文</button>
  <button class="lang-btn" data-lang="en" onclick="window.switchLanguage('en')">English</button>
  <button class="lang-btn" data-lang="kr" onclick="window.switchLanguage('kr')">한국어</button>
</div>

<!-- CSS -->
<style>
.language-switcher {
  position: fixed;
  top: 16px;
  right: 16px;
  display: flex;
  gap: 8px;
  z-index: 999;
}

.lang-btn {
  padding: 6px 12px;
  border: 1px solid var(--gold);
  border-radius: 4px;
  background: transparent;
  color: var(--gold);
  cursor: pointer;
  font-size: 12px;
  transition: all 200ms;
}

.lang-btn.active {
  background: var(--gold);
  color: white;
}

.lang-btn:hover {
  background: var(--gold);
  color: white;
}
</style>
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
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --safe-area-inset-top: 0px;
  --safe-area-inset-bottom: 0px;
  /* ... 其他 12 个变量 ... */
}

/* iOS Notch & Android Safe Area */
@supports (padding: max(0px)) {
  body {
    padding-top: max(16px, var(--safe-area-inset-top));
    padding-bottom: max(16px, var(--safe-area-inset-bottom));
  }
  .sticky-cta {
    padding-bottom: max(16px, var(--safe-area-inset-bottom));
  }
}

/* Language-specific font */
html[lang="zh-CN"] { 
  --font-serif: 'Noto Serif SC'; 
  --font-sans: 'Noto Serif SC';
}
html[lang="en"] { 
  --font-serif: 'Cormorant Garamond', serif; 
  --font-sans: 'Inter', sans-serif;
}
html[lang="ko"] { 
  --font-serif: 'Noto Serif KR'; 
  --font-sans: 'Noto Sans KR';
}

body { 
  font-family: var(--font-serif), serif;
}

/* 组件样式（三语共用） */
.sizhu-grid { 
  display: grid; 
  grid-template-columns: repeat(4, 1fr); 
  gap: 6px;
}
.zhu { 
  background: var(--card); 
  border: 1px solid rgba(201,168,76,0.12); 
  border-radius: 10px;
  padding: 12px;
  text-align: center;
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 响应式（mobile-first，从 320px 开始） */

/* 超小屏 (320-375px，如 iPhone SE) */
@media (max-width: 375px) {
  body {
    font-size: 13px;
    line-height: 1.4;
  }
  
  .sizhu-grid {
    gap: 4px;  /* 压缩间距 */
  }
  
  .zhu {
    padding: 8px;
    min-height: 50px;
    font-size: 11px;
  }
  
  .sticky-cta button {
    font-size: 14px;
    padding: 12px;
  }
  
  .fortune-title {
    font-size: 14px;
  }
}

/* 小屏 (376-480px，iPhone 12/13) */
@media (min-width: 376px) and (max-width: 480px) {
  body {
    font-size: 14px;
    line-height: 1.5;
  }
  
  .sizhu-grid {
    gap: 6px;
  }
  
  .zhu {
    padding: 10px;
    min-height: 55px;
  }
  
  .fortune-title {
    font-size: 15px;
  }
}

/* 平板 (481-768px) */
@media (min-width: 481px) and (max-width: 768px) { 
  body {
    font-size: 15px;
  }
  
  .container {
    max-width: 600px;
    margin: 0 auto;
  }
  
  .sizhu-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  
  .sticky-cta {
    position: static;  /* 不再 sticky */
    margin-top: 24px;
  }
}

/* 桌面 (769px+) */
@media (min-width: 769px) {
  body {
    font-size: 16px;
  }
  
  .container {
    max-width: 900px;
    margin: 0 auto;
    padding: 0 40px;
  }
  
  .sticky-cta {
    position: static;
    margin-top: 32px;
  }
}

/* 微妙语言差异（字间距/行高） */
html[lang="en"] .fortune-title { 
  letter-spacing: 0.04em;  /* EN 紧凑 */
  font-weight: 500;
}
html[lang="ko"] .fortune-title { 
  letter-spacing: 0.06em;  /* KR 宽松 */
  font-weight: 400;
}
html[lang="zh-CN"] .fortune-title { 
  letter-spacing: 0.08em;  /* CN 最宽 */
  font-weight: 400;
}

/* 虚拟键盘弹起时的处理 */
input:focus, textarea:focus {
  /* 确保焦点元素在视口内 */
  scroll-behavior: smooth;
  scroll-margin-top: 20px;
}

html[lang="kr"] input:focus {
  /* 韩文输入可能使用 IME，给额外空间 */
  scroll-margin-bottom: 60px;
}
```

**英文报告长度决策**（P0 关键 PM 决策点）

现状：PRD 说"≥4000 词"但无实际对标

问题：
- 4000+ 词在手机上需要滚 10+ 屏，用户体验可能差
- 西方用户喜欢"精品短文"而非"冗长解读"

建议三选一（Karen 今天决策）：

选项 A：精品模式（**推荐**)
- 英文报告 2500-3000 词（中文 8000 词的 35-40%）
- 但密度更高，每句话价值量大
- 更适合手机阅读（2-3 屏）
- ROI：用户完读率 70% → 转化率 +2-3%

选项 B：完整模式
- 英文报告保留 4000-5000 词
- 翻译自中文深度内容
- 适合桌面用户、学术背景用户
- ROI：可信度↑，但手机用户完读率 30% → 转化率 -1-2%

选项 C：分层模式（最高成本）
- 基础版 2000 词（免费看）
- 完整版 4500 词（付费）
- 复杂度↑，但转化可能最高（进度条刺激）
- 开发成本：+3 天工作量

**Karen 今天选择哪个？** → 决定了 W2 的 Prompt 长度和翻译工作量
```

#### P0.4：交互对齐（支付流程细节）

**1. 加载态对齐**
```
进度文案三语翻译（现只有中文）
• 中文：算盘排八字... → 分析五行大势... → 生成命理深度报告...
• 英文：Calculating Four Pillars... → Analyzing Elemental Pattern... → Generating your reading...
• 韩文：사주 계산 중... → 오행 분석 중... → 명리 리포트 생성 중...

Hexagram spinner 统一（已是，保持）
进度条 shimmer 统一（已是，保持）
```

**2. 试读与付费墙布局**（关键 UX 缺陷补充）
```
现状问题：
- 用户看多少内容才知道需要付费？
- Basic（免费）和 Full（付费）的分界线在哪？

解决方案：
页面分为 5 个区域

┌─────────────────────────────────────────────────────┐
│ 区域 1：四柱八字 (基础信息，始终显示)              │ ✅ 始终可见
│ ├─ 年/月/日/时四个天干地支 grid                   │
│ ├─ 用户性别和出生地信息                            │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ 区域 2：五行分析 (基础分析，始终显示)              │ ✅ 始终可见
│ ├─ Bar chart (木火土金水 强弱)                    │
│ ├─ 五行简述 "你的命格中木性较弱..."(400字)       │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ 区域 3：日干卡片 (基础分析，始终显示)              │ ✅ 始终可见
│ ├─ 大标题："你的日干是 丙火"                      │
│ ├─ 日干定义 (100字左右)                            │
│ ├─ 性格特质 (300字左右) "丙火的人性格热情..."    │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ 区域 4：试读内容 (Progressive paywall)              │ 🟡 部分显示
│ ├─ "大运分析" 标题可见                             │
│ ├─ 内容逐渐 fade out (渐变透明)                   │
│ ├─ 底部覆盖 50% 灰色半透明遮挡                    │
│ ├─ 提示文案："[仅显示前 30% 内容] 解锁完整分析"  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ 区域 5：付费墙 CTA (Sticky button)                 │ 🎯 转化按钮
│ ├─ Sticky 在底部（向下滚时随之向下）              │
│ ├─ 大按钮："🔓 解锁完整报告 $9.9"               │
│ ├─ 二级文案："包含运势/财运/感情/健康深度分析"   │
│ ├─ 背景：Gold gradient，hover 时稍微变亮          │
└─────────────────────────────────────────────────────┘

CSS 实现：
html {
  /* 试读区域逐渐透明 */
  --paywall-gradient: linear-gradient(
    180deg,
    rgba(255,255,255,1) 0%,
    rgba(255,255,255,0.7) 80%,
    rgba(0,0,0,0.3) 100%
  );
}

.paywall-preview {
  position: relative;
  background: var(--paywall-gradient);
  opacity: 0.65;
}

.paywall-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 120px;
  background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.15) 100%);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 16px;
  color: var(--text-secondary);
  font-size: 13px;
}

.sticky-cta {
  position: sticky;
  bottom: 0;
  background: linear-gradient(135deg, var(--gold), var(--gold-dark));
  padding: 16px;
  border-radius: 12px 12px 0 0;
  box-shadow: 0 -2px 8px rgba(0,0,0,0.08);
  z-index: 100;
}
```

**3. 支付流程完整态**（解决"支付后无反馈"问题）

```
┌─ 用户点 "解锁完整报告" ─────────┐
│                                │
├─ 前端确认对话框              │
│  "确认购买？$9.9/Complete Reading"
│  [取消] [确认支付]
│                                │
└──→ 后端 POST /api/createCheckout
    └──→ Stripe sessionId 返回
        └──→ window.location = stripe_url
            
支付页面（Stripe hosted checkout）
│
├─ 用户填入卡号/PayPal 等
│  (或 KakaoPay OAuth 授权)
│
└──→ 支付成功
    └──→ Stripe webhook 回调后端
        └──→ 后端：1. 更新 orders 表 status='paid'
        │        2. 设置 users 表 hasFullAccess=true
        │        3. 发送确认邮件
        │
        └──→ 前端用 return_url 回流：
            window.location = '/pages/bazi.html?paid=1&sessionId=XXX'
            
回流后端流程（P1 关键）
│
├─ 检查 sessionId 真实性（防伪造 paid=1）
│  const session = await stripe.checkout.sessions.retrieve(sessionId);
│  if (session.payment_status !== 'paid') throw Error('Fraud');
│
├─ 用户登录（邮箱 OTP）后，查询用户的 orders
│  SELECT * FROM orders WHERE user_id = XXX AND status = 'paid'
│
├─ 前端重拉报告数据
│  GET /api/bazi/:reportId?token=accessToken
│  后端返回完整 full 数据
│
└──→ 展示完整报告（区域 4-5 的遮挡去掉）

失败流程（网络中断/支付失败/用户取消）
│
├─ Stripe 支付失败或用户取消
│  → 返回 return_url?error=payment_failure
│
├─ 前端显示错误提示
│  "支付失败，请重试" + "返回报告" 按钮
│
├─ 用户点 "返回报告" 或稍后重试
│  本地仍可看 basic 内容
│  付费墙重新展示"解锁完整报告"
│
└──→ 二次尝试支付

超时处理（支付成功但 webhook 未回调）
│
├─ 轮询逻辑：前端 setInterval 检查
│  每 5s 检查一次 GET /api/orders/:orderId/status
│
├─ 若 60s 后仍未回调
│  显示提示："报告已生成，请刷新页面"
│  刷新后重新检查 hasFullAccess
│
└──→ 最多等待 60s 自动刷新
```

**4. 付费墙对齐**
```
价格与支付方式（按语言路由）

中文 (bazi.html?lang=cn):
  • ¥99.9 full report (或 $9.9 USD 按 region 检测)
  • 支付方式：Stripe + 支付宝(若添加)
  • CTA 文案："解锁完整报告"

英文 (bazi.html?lang=en):
  • $9.9 USD (固定)
  • 支付方式：Stripe only (P1 阶段)
  • CTA 文案："Unlock Full Reading"

韩文 (bazi.html?lang=kr):
  • ₩9,900 KRW (固定，约 $7-8)
  • 支付方式：Stripe (Phase 1) 
  •         KakaoPay (Phase 1.5 待定 Karen 决策)
  • CTA 文案："완전한 리포트 보기"

价格自动转换逻辑（后端）:
function getPriceByLang(lang, region) {
  const priceMap = {
    'cn': { amount: 999, currency: 'USD', label: '$9.9' },
    'en': { amount: 999, currency: 'USD', label: '$9.9' },
    'kr': { amount: 9900, currency: 'KRW', label: '₩9,900' }
  };
  return priceMap[lang] || priceMap['cn'];
}
```

**5. 错误处理与重试**
```
场景 1：生日输入无效
  显示："请输入有效的生日（1900-2024）"
  三语错误文案需审核 ✅

场景 2：网络超时（生成报告超过 60s）
  显示加载超时提示
  提供"取消" + "重新生成" 按钮
  日志上报 Sentry (event: 'report_generation_timeout')

场景 3：支付页面异常
  若 Stripe 无响应：显示"支付服务暂时不可用，请稍后重试"
  若用户取消支付：返回报告页，提示"您已取消购买，可继续查看基础内容"

场景 4：用户支付成功但本地 token 丢失
  存储策略（三层防护）：
  1. localStorage: 存本地 accessToken（24h 过期）
  2. sessionStorage: 支付中的临时 token（仅当次有效）
  3. Server-side: 后端 orders 表记录真实状态
  
  若 localStorage 丢失：
  • 已登录用户可自动从 server 重拉 token
  • 未登录用户需重新邮箱 OTP 验证后拉 token

场景 5：弱网环境（3G throttle）
  报告加载显示进度条 (已有)
  若卡住超过 15s，提示"网络较慢，请检查连接"
  提供离线保存选项（仅适用于已生成的报告）
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
| **响应式** | 四屏无变形 (320/375/480/768) | 真机测试 | QA | ✅ | ✅ |
| **虚拟键盘** | 弹起时不挡输入框 | iOS/Android 模拟 | Dev | ✅ | ✅ |
| **加载态** | 有转圈 + 文字进度 | 视觉检查 | UX | ✅ | ✅ |
| **错误提示** | 明确 + 可操作 | 制造失败场景 | Dev | ✅ | ✅ |
| **iOS Notch** | 内容不被 Safe Area 遮挡 | iPhone 12 Pro 真机 | QA | ✅ | ✅ |
| **Android Nav** | 底部导航栏不与 CTA 重叠 | Samsung S21 真机 | QA | ✅ | ✅ |

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

**部署命令**（改进版包含向后兼容+Webhook容错+数据库迁移）：

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

# 4. 向后兼容性检查（旧客户端）
# 确保 /api/bazi 端点继续工作（不添加 lang 参数时默认返回中文）
# 旧 mobile app 可能仍在用 v1 API，不可 break

# 5. 数据库迁移（带回滚脚本）
npm run migrate
# 备份：mysqldump -u$DB_USER -p$DB_PASS $DB_NAME > ./backup-$(date +%Y%m%d-%H%M%S).sql

# 6. 构建前端（如果有 bundler）
# npm run build

# 7. Webhook 验签测试（支付流程容错）
npm run test:webhook 2>&1 || echo "⚠️ Webhook tests may not run in non-interactive mode"

# 8. DeepSeek 限流测试
npm run test:rate-limit 2>&1 || echo "⚠️ Rate limit tests skipped"

# 9. 重启 PM2（保留现有实例）
pm2 restart shenyuan --update-env

# 10. 健康检查（三语端点都检查）
sleep 2
for endpoint in "/api/health" "/api/bazi" "/api/bazi-en" "/api/bazi-kr"; do
  curl -s -f http://localhost:3021${endpoint}?dry_run=true 2>/dev/null || {
    echo "❌ Failed: ${endpoint}"
    pm2 logs shenyuan | head -20
    exit 1
  }
done

echo "✅ Deployment complete - All endpoints healthy"
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

### 10.1.5 向后兼容性（L1 技术缺陷修复）

**问题**：旧客户端（中文 mobile app）可能在用 `/api/bazi` 且没有 `lang` 参数，Phase 1 新增 lang 后可能 break 旧版本。

**解决方案**：

```javascript
// server/routes/bazi.js - 防止 break 旧 API

// 旧 API v1（向后兼容）
router.post('/api/bazi', async (req, res) => {
  const { year, month, day, hour, gender } = req.body;
  const lang = req.body.lang || 'cn';  // 默认中文，不会 break 旧客户端
  
  const report = await generateReport({
    year, month, day, hour, gender, lang
  });
  
  res.json(report);
});

// 新 API v2（显式语言标记）
router.post('/api/bazi-en', (req, res) => { /* ... */ });
router.post('/api/bazi-kr', (req, res) => { /* ... */ });

// 获取报告时也要支持 lang 参数重新生成
router.get('/api/bazi/:id', async (req, res) => {
  const { id } = req.params;
  const { lang = 'cn' } = req.query;  // 默认返回中文
  
  const cached = await getFromCache(id, lang);
  if (cached) return res.json(cached);
  
  // 缓存未命中 → 复用四柱数据，仅改 prompt
  const baseBazi = await getBaziData(id);
  const report = await generatePrompt({ ...baseBazi, lang });
  await setCache(id, lang, report);
  
  res.json(report);
});
```

**验证清单**（部署前必检）：
- [ ] 旧客户端 POST /api/bazi (无 lang 参数) 仍返回中文报告 ✅
- [ ] 新客户端 POST /api/bazi?lang=en 正确返回英文 ✅
- [ ] GET /api/bazi/:id 默认返回中文 ✅
- [ ] GET /api/bazi/:id?lang=en 返回英文（若缓存有）或重新生成 ✅

---

### 10.1.6 Webhook 容错（L2 技术缺陷修复）

**问题**：支付成功但 webhook 未及时回调 → 用户看不到完整内容 → 体验差

**完整支付流程与容错**：

```
用户流程
┌─ 用户点"解锁" ─────────┐
│ (支付 $9.9)           │
├─ 跳转 Stripe 支付页  │
│ (输入卡号/PayPal)     │
│                       │
└──→ 支付成功 ──────────┐
    (Stripe 返回)        │
                        ↓
    ┌─────────────────────────────────────┐
    │ 后端处理流程（3 层防护）             │
    │                                     │
    │ 1. 验证签名（防伪造）              │
    │    if (!verifyStripeSignature) 拒绝 │
    │                                     │
    │ 2. 更新订单状态（幂等）            │
    │    UPDATE orders SET status='paid'  │
    │    用 stripe_session_id 作 UNIQUE  │
    │    (防重复处理同一订单)            │
    │                                     │
    │ 3. 更新用户权限缓存                │
    │    redis.set(`user:${id}:access`,  │
    │             { hasFullAccess: true })│
    │    TTL: 24 小时                    │
    │                                     │
    │ 4. 异步发邮件（不阻塞响应）       │
    │    sendEmailAsync(...)              │
    └─────────────────────────────────────┘
                        ↓
前端轮询确认（60 秒超时保护）
┌─────────────────────────────────────┐
│ setInterval(pollOrderStatus, 5s)    │
│ 检查 GET /api/orders/:orderId       │
│ 最多等待 60s                         │
│ 若成功 → location.reload()          │
│ 若超时 → 显示"刷新查看"提示         │
└─────────────────────────────────────┘
```

**技术实现细节**：

```javascript
// server/webhooks/stripe.js

const express = require('express');
const router = express.Router();

// Stripe webhook 处理（核心支付回调）
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  // 1. 验证签名
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    logger.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // 2. 幂等性检查（防重复处理）
  const eventExists = await db
    .from('webhook_events')
    .select('id')
    .eq('stripe_event_id', event.id)
    .single();
  
  if (eventExists) {
    logger.info(`Duplicate webhook: ${event.id}, returning success`);
    return res.json({ received: true });
  }
  
  // 3. 处理支付成功事件
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    try {
      // 记录事件（用于幂等性检查）
      await db.from('webhook_events').insert({
        stripe_event_id: event.id,
        type: event.type,
        processed_at: new Date()
      });
      
      // 更新订单
      const { error, data } = await db
        .from('orders')
        .update({
          status: 'paid',
          paid_at: new Date(),
          stripe_session_id: session.id
        })
        .eq('stripe_session_id', session.id);
      
      if (error && data?.count === 0) {
        logger.warn(`Order not found: ${session.id}`);
        // 返回 200，因为这是 Stripe 端的问题，不应重试
      }
      
      // 更新用户权限（缓存）
      const userId = session.metadata?.userId;
      if (userId) {
        await redis.set(
          `user:${userId}:hasFullAccess`,
          true,
          'EX',
          86400  // 24 小时过期
        );
      }
      
      // 发送确认邮件（异步，不阻塞响应）
      sendEmailAsync({
        to: session.customer_email,
        subject: 'Your BaZi Report Payment Confirmed',
        template: 'payment-success',
        data: { reportId: session.metadata?.reportId }
      }).catch(err => {
        logger.error(`Failed to send email: ${err.message}`);
        // 邮件失败不影响主流程
      });
      
      res.json({ received: true });
    } catch (err) {
      logger.error(`Webhook processing error: ${err.message}`, {
        event_id: event.id
      });
      
      // 上报 Sentry（告警）
      Sentry.captureException(err, {
        tags: { service: 'stripe-webhook' }
      });
      
      // 返回 500，Stripe 会重试
      return res.status(500).send('Internal error');
    }
  } else {
    // 其他事件类型暂不处理
    res.json({ received: true });
  }
});

module.exports = router;
```

**前端轮询逻辑**（支付中断恢复）：

```javascript
// /assets/js/payment-polling.js

async function pollOrderStatus(orderId, options = {}) {
  const {
    maxRetries = 12,        // 60 秒
    interval = 5000,        // 每 5s 轮询一次
    onSuccess = null,
    onTimeout = null
  } = options;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`/api/orders/${orderId}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const order = await response.json();
      
      if (order.status === 'paid' || order.hasFullAccess) {
        // 支付成功
        if (onSuccess) onSuccess(order);
        location.reload();  // 刷新显示完整内容
        return;
      }
      
      // 状态仍为 pending，继续轮询
      console.log(`[${i + 1}/${maxRetries}] Order still pending...`);
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    } catch (err) {
      logger.error(`Poll error on attempt ${i + 1}: ${err.message}`);
      // 继续轮询，不中断
    }
  }
  
  // 60 秒超时
  if (onTimeout) onTimeout();
  showNotification(
    '支付确认中，请刷新页面查看最新状态',
    'info'
  );
}

// 支付成功回流时触发
if (new URLSearchParams(window.location.search).get('paid') === '1') {
  const orderId = new URLSearchParams(window.location.search).get('orderId');
  pollOrderStatus(orderId, {
    onSuccess: (order) => {
      console.log('Payment confirmed!', order);
      // 页面刷新会自动显示完整内容
    },
    onTimeout: () => {
      showNotification(
        '支付确认延迟。如果钱已扣，请耐心等候或联系客服。',
        'warning'
      );
    }
  });
}
```

---

### 10.1.7 数据库迁移与回滚（L3 技术缺陷修复）

**问题**：Phase 1 新增 `lang` 列和 rate_limits 表，部署失败时需要安全回滚。

**迁移脚本**：

```sql
-- migrations/001_phase1_multilang_support.sql
-- 执行时间：2026-08-10 ~ 2026-09-27
-- 备份前提：mysqldump > backup-$(date +%Y%m%d).sql

-- 1. 添加 lang 列（nullable，向后兼容）
ALTER TABLE bazi_reports 
ADD COLUMN lang VARCHAR(10) DEFAULT 'cn' 
AFTER `user_id`,
ADD INDEX idx_reports_lang (user_id, lang);

-- 2. 标记所有历史报告为中文
UPDATE bazi_reports 
SET lang = 'cn' 
WHERE lang IS NULL;

-- 3. 新增 API 限流表
CREATE TABLE api_rate_limits (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255),
  ip_address VARCHAR(45),
  endpoint VARCHAR(100),
  attempts INT DEFAULT 1,
  window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_window (ip_address, endpoint, window_start),
  INDEX idx_user (user_id),
  INDEX idx_window (window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. 新增 Webhook 幂等性表
CREATE TABLE webhook_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
  type VARCHAR(100),
  payload JSON,
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_event_id (stripe_event_id),
  INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 验证迁移成功
SELECT COUNT(*) as total_reports, 
       SUM(CASE WHEN lang = 'cn' THEN 1 ELSE 0 END) as cn_count 
FROM bazi_reports;
-- 预期：total_reports > 0, cn_count == total_reports
```

**回滚脚本**（如部署失败）：

```sql
-- rollbacks/001_phase1_multilang_support.sql

-- 1. 删除新表
DROP TABLE IF EXISTS webhook_events;
DROP TABLE IF EXISTS api_rate_limits;

-- 2. 删除新列
ALTER TABLE bazi_reports 
DROP INDEX idx_reports_lang,
DROP COLUMN lang;

-- 3. 验证回滚
SELECT COUNT(*) FROM bazi_reports LIMIT 1;
-- 预期：正常返回结果，表示表仍存在且结构恢复
```

**部署步骤（安全操作）**：

```bash
#!/bin/bash
# deploy-db-migration.sh

set -e

echo "📋 Phase 1 Database Migration"

# 1. 备份（关键！）
BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).sql"
echo "🔄 Backing up database to $BACKUP_FILE..."
mysqldump -u$DB_USER -p$DB_PASS $DB_NAME > $BACKUP_FILE
echo "✅ Backup complete"

# 2. 运行迁移
echo "🔄 Running migration..."
mysql -u$DB_USER -p$DB_PASS $DB_NAME < migrations/001_phase1_multilang_support.sql
echo "✅ Migration complete"

# 3. 验证
echo "🔍 Verifying migration..."
RESULT=$(mysql -u$DB_USER -p$DB_PASS -se "SELECT COUNT(*) FROM bazi_reports;" $DB_NAME)
echo "📊 Total reports: $RESULT"

if [ "$RESULT" -gt 0 ]; then
  echo "✅ Migration verified successfully"
else
  echo "❌ Verification failed, rolling back..."
  mysql -u$DB_USER -p$DB_PASS $DB_NAME < rollbacks/001_phase1_multilang_support.sql
  echo "✅ Rollback complete"
  exit 1
fi

echo "🎉 Database migration successful"
```

---

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

