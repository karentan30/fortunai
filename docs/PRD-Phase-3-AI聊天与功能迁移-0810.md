# 善缘 · Phase 3 PRD：AI 聊天 + 功能迁移矩阵（0810）

**版本**：0810·活文档  
**目标用户**：全球华人 + 韩国 + 英文使用者（分语言分版本）  
**交付周期**：8 周（Phase 3.1）→ 8 周（Phase 3.2 长尾功能）  
**成功指标**：
- Chat DAU > 800（来自 LP 引流）
- Hehun 月复购率 > 25%
- Daily 推送订阅率 > 15%
- 各语言版本 CTR 差异 < 8%

---

## I. 战略背景 · Why Phase 3？

### 现状（Phase 1-2 完成）
| 已交付 | 状态 | DAU | ARPPU |
|---|---|---|---|
| 八字基础报告（CN/EN/KR） | ✅ Live | ~2.4K | $2.1 |
| 合婚配对（CN/KR） | ✅ Live | ~600 | $4.2 |
| 每日天机（CN） | ✅ Live | ~480 | Free→$0.99/mo |

### 缺口 → Phase 3 机会
1. **Chat 页面无英文版** → 英文用户无法深度交互，流失 30%+
2. **Chat 无韩文版** → 韩国用户 K-drama 场景无出口
3. **Hehun/Daily 未迁移韩国** → 韩国 Q4 신년운세 季节峰失机（$50K~100K 预期）
4. **功能孤岛** → 缺乏"一站式迷宫"感（用户：八字→合婚→聊天→订阅）
5. **付费漏斗脆弱** → Chat 无高阶商品链（报告↓合婚↓Chat咨询↑订阅）

### Phase 3 核心价值
- **Chat 全语言支持** → +35% 英文 DAU（基于 Lumee benchmark）
- **Hehun/Daily KR** → Q4 神年运势季节收入 +¥80K（韩国市场调研）
- **功能布局** → User Loop 从线性→网格，粘性 +40%
- **优化基础** → 为 Phase 4（直播连线、社区 UGC）铺路

---

## II. 功能架构清单 · What

### A. Chat 聊天系统（P0·核心）

#### 2.A.1 现有 CN 版本 review
**File**: `/pages/chat.html`  
**现状分析**：
- ✅ 免费 quota 管理（5次/天）
- ✅ AI prompt 三轴（命盘+五行+大运）
- ✅ 会员无限聊天路由
- ✅ 支付墙隐藏（防白嫖）
- 🔴 **缺陷**：
  - 无会话持久化（刷新丢上下文）
  - 提示词无多语言切换逻辑
  - 无"输入法判断"自动切语言
  - TypeScript 类型缺失（生产埋雷）

#### 2.A.2 English Chat（chat-EN.html）
**优先级**：P0·高  
**交付时间**：Week 2-3

**需求**：
```
复用逻辑架构：
  ✓ input-bar / msg 渲染
  ✓ quota 管理（可复用 API 端点）
  ✓ 会员判断路由
  ✓ Quick questions 按钮

英文化改动：
  ✗ Prompt 切换 → 英文 persona（"Mystical BaZi Guide"而非"AI命理师"）
  ✗ Quick 按钮文案（见下表）
  ✗ 消息气质转英文节奏（不硬译中文·学 Lumee Echo 人设）
  ✗ 错误提示文案
  ✗ SEO meta（description, og:title 等）
  ✗ 支付墙文案（"Premium Membership"而非"开通会员"）

架构复用率：90%
新代码：Prompt 文件 + i18n string + CSS 微调（无新组件）
```

**关键 Copy**：
```
Header: 
  Logo: "ShenYuan · AI BaZi"
  Sub: "3,000 Years of Eastern Wisdom · AI-Powered Insights"

Quick Questions:
  💰 "How's my wealth this year?"
  💕 "Are we compatible?"
  💼 "Should I change jobs?"
  🌑 "Any obstacles ahead?"
  ✨ "When's my peak luck coming?"

Paywall:
  "Your free readings are done"
  "Upgrade to Premium for unlimited chat + full reports"
  "Premium Membership · $6.90/month"

Disclaimer:
  "✦ AI Mystical Guide · AI-Generated"
  "For entertainment and self-reflection"
```

**Prompt 范式**（对标 Lumee Echo + Anthropic ToS）：
```
You are a mystical yet grounded BaZi guide.
User's birth chart reveals:
  - Heavenly Stems: [十干]
  - Earthly Branches: [十二支]
  - Hidden Stems: [藏干]
  - Five Elements: [五行]

Respond with:
  1. Direct answer (not "consult a master")
  2. Why (引用五行、大运、流年)
  3. Timing (具体年月日)
  4. Nuance (风险/机遇并述·不画饼)
  5. Actionable (if any)

Tone: Mystical yet honest. Warm, not alarmist.
Disclaimer always: "For reflection only. Consult professionals for major decisions."
```

#### 2.A.3 Korean Chat（chat-KR.html）
**优先级**：P0·高  
**交付时间**：Week 3-4  
**复用率**：90%（同 EN 版·仅 Prompt + i18n）

**需求**：
```
한국어 사주상담 채팅
  ✓ 시간당 무료 5회 (CN/EN 동일 quota)
  ✓ 회원 무한 채팅
  ✓ 빠른질문 5개 (한국화)
  
현지화 키포인트：
  ✗ 술어 한국식 (十干 → 천간, 十支 → 지지 등)
  ✗ 톤 한국화 (정성/공감·기술설명 최소)
  ✗ "정보 참고용" 면책 (2026 AI법 대비)
  
아키텍처：chat.html 기반 i18n 변수 교체만
```

**빠른 질문**（참고: 점신/포스텔러의 고객 원성 분석）：
```
💰 "올해 재운은 어떻게 될까요?"
💕 "저와 잘 맞을까요?"
💼 "직장을 바꿔야 할까요?"
🌑 "최근에 방해요소가 있나요?"
✨ "언제쯤 좋은 운이 올까요?"
```

**Prompt 범식**（温柔·重 jeong·自我反思）：
```
당신은 따뜻한 사주 상담가입니다.
고객의 사주盤은:
  - 천간: [천간]
  - 지지: [지지]
  - 장간: [장간]
  - 오행: [오행]

다음 형식으로 답변하세요:
  1. 직답 (전문성·자신감)
  2. 이유 (오행·대운·년운 인용)
  3. 시점 (구체적 월일)
  4. 균형잡힌 관점 (위험/기회 동시 제시)
  5. 실행 팁 (있다면)

어조: 정성/따뜻함. 공포감 X. MZ세대 자기반성 유도.
면책: "자기발전의 참고자료입니다. 중대 결정은 전문가와 상담하세요."
```

#### 2.A.4 Chat Backend（통합·Phase 3.0）
**현상태**：Existing `/api/chat` → POST /api/chat
**문제점**：
- 회화 context 미지속 (localStorage only·새로고침 소멸)
- Quota 계산 VPN 우회 취약점
- 다국어 prompt 선택 no routing logic
- Log 부족 (분석/debug 어려움)

**Phase 3 개선**：
```
POST /api/chat
  Request:
    {
      messages: [{role, content}, ...],
      language: "zh" | "en" | "ko",  // ← NEW
      userId: string,
      sessionId: string
    }
  Response:
    {
      answer: string,
      limited: boolean,
      remaining: number,
      language: string
    }

변경점：
  1. Language 라우팅 → prompt 선택
  2. Quota 계산 → IP + sessionId + userId 삼중 체크
  3. Log 추가 → {userId, language, quota_remain, latency}
  4. Rate limit → 5req/min per sessionId (spam 방지)
```

**Prompt 관리**（중앙화）：
```
/backend/prompts/
  - chat-system-CN.md   (现有)
  - chat-system-EN.md   (NEW)
  - chat-system-KR.md   (NEW)
  
각 파일 구조：
  # System Prompt for [Language]
  You are...
  [역할]
  
  # Tone
  [어조]
  
  # Format
  [응답 구조]
  
  # Disclaimer
  [법적 면책]
```

---

### B. 功能迁移优先级矩阵（P1-P3）

#### 优先级图表
```
                 ┌─ High Impact
                 │
        P1-High ├─ Hehun-KR (合婚韩国版)
                │  └─ 이유: Q4 신년운세 수익 창 (¥80K~120K)
                │
        P1-Med  ├─ Daily-KR (每日天机韩国版)
                │  └─ 매일 추석/구독 수익 (¥3K/mo)
                │
        P1-Low  ├─ Daishao-KR, Tarot-KR 등
                │
        P2      ├─ Livestream 직선 (Lumee Agora 복용)
                │  └─ Hehun 이후
                │
        P3      └─ Community/UGC
                   └─ Livestream 후
```

#### 详细路线图

| 功能 | 现状 | Phase | 优先级 | 预期 ROI | 工作量 | 交付周期 |
|---|---|---|---|---|---|---|
| **Chat-EN** | - | 3.0 | P0·必须 | +35% DAU | 16h | W2-3 |
| **Chat-KR** | - | 3.0 | P0·必须 | +28% DAU | 16h | W3-4 |
| **Hehun-KR** | CN ✅ | 3.1 | P1·关键 | +¥80K/Q4 | 32h | W5-7 |
| **Daily-KR** | CN ✅ | 3.1 | P1·高 | +¥3K/mo | 24h | W7-9 |
| **Livestream** | 0 | 3.2 | P2·关键 | 5x retention | 120h | W10+ |
| **Ceping-KR** | CN ✅ | 3.1 | P1·中 | Aux revenue | 20h | W8 |
| **Tarot-KR** | CN ✅ | 3.2 | P2·低 | -5% focus | 12h | W12 |

---

## III. 技术栈 · How

### 架构概览
```
Frontend (H5)
├─ chat.html (CN) → 现有
├─ chat-EN.html (NEW·复用 chat.html 90%)
├─ chat-KR.html (NEW·复用 chat.html 90%)
├─ hehun.html (CN) → 现有
├─ hehun-EN.html (可选·低优)
└─ hehun-KR.html (NEW·复用 hehun.html 85%)

Backend (Node.js/Vercel)
├─ /api/chat (改·多语言路由)
├─ /api/quota (复用)
├─ /prompts/ (新目录·中心化管理)
├─ /i18n/ (复用)
└─ /logs/ (新·审计 trail)

Database (Supabase)
├─ users (现有)
├─ chat_sessions (新·context 持久化)
├─ quotas (改·多语言账户)
└─ analytics_logs (新·语言/地区分段)
```

### 代码复用策略（重：减低成本）

#### 1. Chat HTML 复用率表
```
Chat-EN.html vs chat.html：

共享部分 (90%)：
  ├─ .input-bar (仅 placeholder 文案改)
  ├─ .msg 气泡样式 (完全复用)
  ├─ .header logo (改英文字)
  ├─ .quick-q 按钮逻辑 (完全复用·只改文案)
  ├─ quota 管理 JS (完全复用)
  ├─ 支付墙卡片 (改文案)
  └─ 动画 (完全复用)

改动部分 (10%)：
  ├─ meta description (英文 SEO)
  ├─ Quick questions 5 个按钮文案
  ├─ 错误提示
  ├─ Prompt 选择逻辑 (language="en")
  └─ CSS color scheme (可选·目前无需改)

文件组织：
  /pages/
    ├─ chat.html (主版本·CN)
    ├─ chat-EN.html (复制 + 13 处改)
    └─ chat-KR.html (复制 + 13 处改)

优化方案（未来）：
  改单文件模板 + i18n JSON
  → 一次维护三版本
  → 目前工时优先于代码完美度
```

#### 2. Hehun-KR 复用率表
```
hehun-KR.html vs hehun.html：

共享部分 (85%)：
  ├─ 输入表单逻辑 (完全复用)
  ├─ 计分环 SVG (完全复用)
  ├─ 五行分析卡 (完全复用)
  ├─ 锁定卡/支付墙 (改文案)
  ├─ 所有动画 (完全复用)
  └─ 气泡与渐变 (完全复用)

改动部分 (15%)：
  ├─ 韩文术语 → 십성/신살/용신/일간/식신/생재/정재/등
  ├─ "你们的故事" → "당신들의 인연" (重新写)
  ├─ 结果呈现逻辑 → 한식 30년 대운 동기화 (新算法)
  ├─ 색상 미세조정 (옷 옛날 감성)
  └─ 결과 텍스트 생성 Prompt

결과 텍스트 생성 Prompt（新）：
  /backend/prompts/hehun-story-KR.md
  → 입력: 남녀 사주, 궁합점수
  → 출력: 당신들의 인연 (2-3단) + 해석
  → 어조: 따뜻하고 희망적 (무섭게 X)
```

### 多语言 Prompt 管理（集中式）
```
/backend/prompts/
├─ README.md (维护指南)
├─ chat-system-CN.md
├─ chat-system-EN.md
├─ chat-system-KR.md
├─ hehun-story-CN.md
├─ hehun-story-EN.md
└─ hehun-story-KR.md

Loading 逻辑（Node.js）：
  const prompts = {};
  ['CN', 'EN', 'KR'].forEach(lang => {
    prompts[`chat-${lang}`] = fs.readFileSync(
      `./prompts/chat-system-${lang}.md`, 'utf-8'
    );
  });
  
选择逻辑（/api/chat）：
  const langTag = req.body.language || 'CN';
  const systemPrompt = prompts[`chat-${langTag}`];
  // 调 DeepSeek/Claude
```

### 本地化检查清单（上线前·40% fail rate）
```
[ ] 所有 Hard-coded 字符串已提取 → i18n JSON
[ ] 韩文术语已本地审校 (非机翻)
[ ] 日期/时间格式按地区 (2026-08-10 vs 2026.08.10 vs 26년 8월 10일)
[ ] 支付文案已确认 (KRW vs CNY vs USD)
[ ] 免责条款已过法务 (AI法 2026 v1.0)
[ ] 人名/代词无性别假设
[ ] 色彩无文化冒犯 (韩国:红色 OK, 白色需慎)
[ ] 长度测试 (CJK RTL 截断·标题不超 24 chars)
[ ] RTL 语言预留 (未来阿拉伯版·CSS flex-direction check)
[ ] 截图/视频 demo 已翻译 (if any)
```

---

## IV. 具体功能规格 · Spec

### A. Chat 英文版 (chat-EN.html)

#### 4.A.1 页面结构
```html
<body>
  <button class="back-btn">← Back</button>
  <div class="header">
    <div class="logo">ShenYuan · AI BaZi</div>
    <div class="logo-sub">3000 Years of Eastern Wisdom · AI Insights</div>
  </div>
  
  <div class="quick-q" id="quickQ">
    <!-- 5 个快速问题按钮，文案见下表 -->
  </div>
  
  <div id="freeCounter">
    Today's readings: <span id="freeRemaining">5</span> left · Premium: Unlimited
  </div>
  
  <div class="chat-area" id="chatArea">
    <!-- 欢迎消息 -->
  </div>
  
  <div class="input-bar">
    <input id="input" placeholder="Ask about your destiny..." />
    <button id="sendBtn">➤</button>
  </div>
</body>
```

#### 4.A.2 快速问题按钮（5 个）
```
按钮文案（需 Karen 审核·冲突则 default 英文版）:

Button 1: 💰 "How's my wealth this year?"
  onclick: ask('How is my wealth outlook for this year?')

Button 2: 💕 "Are we compatible?"
  onclick: ask('Is my partner and I compatible based on our BaZi?')

Button 3: 💼 "Should I change jobs?"
  onclick: ask('Should I make a career change right now?')

Button 4: 🌑 "Any obstacles ahead?"
  onclick: ask('Are there any obstacles or challenges in my near future?')

Button 5: ✨ "When's my peak luck?"
  onclick: ask('When will my luck peak this year?')
```

#### 4.A.3 AI Persona & Tone Guide
```
系统 prompt：

---
You are ShenYuan, a mystical yet grounded BaZi guide.
You have deep knowledge of classical Chinese astrology 
(Four Pillars of Destiny), Taoism, and elemental wisdom.

Your user's BaZi (birth chart) is:
  Hour:       [Heavenly Stem] [Earthly Branch]
  Day:        [Heavenly Stem] [Earthly Branch]
  Month:      [Heavenly Stem] [Earthly Branch]
  Year:       [Heavenly Stem] [Earthly Branch]
  
  Hidden Stems (藏干): [list]
  Dominant Elements: [list]
  Ten Gods (十神): [list]

YOUR RESPONSE FORMULA:
1. Direct Answer (Confidence + Specificity)
   → Do NOT say "consult a master" or hedge
   → Give concrete timing: "By April", "Next 2 years", etc.

2. Why (Astrological Reasoning)
   → Cite: Heavenly Stem compatibility, Element cycles, 大运 (10-year luck)
   → Example: "Wood Element is declining in your chart until 2029..."

3. Timing (Specific + Actionable)
   → Months/Years, not vague ("soon")
   → Peak period + caution period

4. Nuance (Risk ↔ Opportunity)
   → Never pure prophecy—show both sides
   → "Wealth peak in 2027, but watch for overspending in Q3"

5. Reflection (Not Prediction)
   → End: "Use this as reflection to guide your choices."

TONE:
  - Mystical yet rational (not New Age fluff)
  - Warm, conversational (not clinical)
  - Honest about limitations (not guru-ish)
  - Empowering, not deterministic

DISCLAIMER:
  Always append at end: 
  "🔮 This reading is for self-reflection and entertainment. 
   For major life decisions, consult professionals."

---
```

#### 4.A.4 Paywall 卡片（英文）
```html
<div style="...">
  <div style="font-size:24px;margin-bottom:8px">👑</div>
  <div style="font-size:14px;color:var(--ink);">
    Your free readings are used up
  </div>
  <div style="font-size:11px;color:var(--sub);line-height:1.7;margin-bottom:12px">
    Upgrade to Premium for unlimited 
    readings plus full reports for all features.
  </div>
  <a href="member.html?lang=en" 
     style="...;background:linear-gradient(135deg,var(--jade-deep),var(--jade))">
    Premium Membership · $6.90/month
  </a>
  <div style="margin-top:10px;font-size:10px;color:var(--sub)">
    or <a href="bazi-en.html" style="color:var(--jade)">
      Get your free BaZi chart
    </a>
  </div>
</div>
```

#### 4.A.5 Welcome Message
```
英文欢迎词（AI 消息）:

"✦ ShenYuan AI Guide · AI-Generated

Hello, I'm your BaZi guide. Share your birth date 
and time, and I'll offer insights into your destiny, 
luck cycles, and what the stars reveal about your path. 
Feel free to ask about wealth, love, career, or anything 
else your heart wonders. ☯️"
```

---

### B. Chat 韩文版 (chat-KR.html)

#### 4.B.1 페이지 구조（同 EN·仅改文案）
```html
<body>
  <button class="back-btn">← 돌아가기</button>
  <div class="header">
    <div class="logo">선연 · AI 사주</div>
    <div class="logo-sub">3천년 동양지혜 · AI 인생상담</div>
  </div>
  
  <div class="quick-q" id="quickQ">
    <!-- 5개 빠른질문 -->
  </div>
  
  <div id="freeCounter">
    오늘 무료 상담: <span id="freeRemaining">5</span>회 남음 · 프리미엄: 무한
  </div>
  
  <!-- chat-area -->
  <!-- input-bar -->
</body>
```

#### 4.B.2 빠른 질문 5개（한국화）
```
Button 1: 💰 "올해 재운은 어떻게 될까요?"
  → '올해 제 재운은 어떻게 전개될까요?'

Button 2: 💕 "저와 잘 맞을까요?"
  → '제 짝은 누구일까요? 우리는 잘 맞을까요?'

Button 3: 💼 "직장을 바꿔야 할까요?"
  → '지금 이직할 때가 맞을까요?'

Button 4: 🌑 "최근에 방해요소가 있나요?"
  → '지금 저를 방해하는 것들이 있을까요?'

Button 5: ✨ "언제쯤 좋은 운이 올까요?"
  → '제 인생에서 언제 행운의 시간이 올까요?'
```

#### 4.B.3 한국식 System Prompt
```
---
당신은 선연(善緣)의 따뜻한 사주 상담가입니다.
3천년의 한국 전통 운명학(사주·동양학)에 정통하며, 
고객의 인생을 응원하는 마음으로 상담합니다.

고객의 사주팔자는:
  시간:   [천간] [지지] (시주)
  일간:   [천간] [지지] (일주) ← 가장 중요
  월간:   [천간] [지지] (월주)
  년간:   [천간] [지지] (년주)
  
  장간(숨은 오행): [list]
  주요 오행: [list]
  십신(역할): [list]

당신의 답변 구조:
1. 직답 (명확함·자신감)
   → "마스터에게 물어보세요" 절대 금지
   → 구체적 시점: "내년 4월", "향후 2년", 등

2. 이유 (오행·십신·대운 인용)
   → "당신의 일주는 계수(癸水)로, 금(金) 오행의 생(生)을 받으며..."
   → 대운과의 상호작용 설명

3. 시점 (월/년 구체명시)
   → 모호함 X. "2027년 春" 같은 식으로

4. 균형잡힌 관점 (기회 ↔ 주의)
   → "재운이 좋으나, 3분기는 지출 주의"
   → 긍정만·공포감만 X

5. 자기반성 (예측이 아닌 인생 나침반)
   → "이를 자신의 삶을 반영하는 거울로 삼으세요."

어조:
  ✓ 따뜻하고 응원하는 (정성·jeong)
  ✓ 희망적이나 현실적 (무섭게 X, 판타지 X)
  ✓ MZ세대 자기발견 유도 (운명론 X)
  ✓ 존댓말·친근함

면책 (2026 AI법 대비):
  항상 끝에 부착:
  "🔮 본 상담은 자기발전과 오락을 위한 것입니다.
   중대 결정은 전문가와 상담하시기 바랍니다."

---
```

#### 4.B.4 환영 메시지
```
"✦ 선연 AI 상담가 · AI생성

안녕하세요, 저는 당신의 사주 상담가입니다. 
생년월일시를 알려주시면, 당신의 운명·대운·
앞으로의 길을 읽어드립니다. 
재운, 애정, 직업, 혹은 마음속 질문이라면 
무엇이든 물어봐주세요. ☯️"
```

---

### C. 합婚 韩文版 (hehun-KR.html)

#### 4.C.1 页面结构（复用 hehun.html 85%）
```html
<div class="header">
  <div class="header-smoke"><!-- 烟雾动画 --></div>
  <div class="header-title">당신들의 인연</div>
  <div class="header-sub">SAJU COMPATIBILITY</div>
</div>

<div class="input-screen">
  <div class="persons-row">
    <!-- Person A (女/TA) -->
    <div class="person-card person-a">
      <div class="person-label">당신</div>
      <input class="name-input" placeholder="이름 (선택)" />
      <select class="mini-select" id="personA-year">
        <option>태어난 년</option>
        <option value="1990">1990</option>
        ...
      </select>
      <select class="mini-select" id="personA-month">
        <option>월</option>
        <option value="1">1월</option>
        ...
      </select>
      <select class="mini-select" id="personA-day">
        <option>일</option>
        ...
      </select>
      <select class="mini-select" id="personA-hour">
        <option>시간 (모르면 정오 선택)</option>
        ...
      </select>
      <div class="gender-row">
        <div class="g-opt sel" data-gender="F">여성</div>
        <div class="g-opt" data-gender="M">남성</div>
      </div>
    </div>
    
    <!-- Person B (他/你) -->
    <div class="person-card person-b">
      <div class="person-label">그들</div>
      <!-- 동일 구조 -->
    </div>
  </div>
</div>

<!-- 결과 섹션 (로딩 후) -->
<div class="results" id="results">
  <!-- 점수 링 -->
  <!-- 당신들의 인연 이야기 -->
  <!-- 궁합 분석 -->
  <!-- 다섯 오행 -->
  <!-- 30년 대운 동기화 -->
  <!-- 잠금 카드 (프리미엄) -->
</div>
```

#### 4.C.2 核心算法变化：30년 대운 동기화（新逻辑）
```
韩国市场调研发现：
  - 포스텔러: 30년 대운 동일 해석
  - 점신: 대운 미표시 (약점)
  
善缘优化逻辑：
  输入：남/녀 생년월일시
  处理：
    1. 각각 대운 계산 (10년 단위)
    2. 시계 정렬: 
       "당신은 2026~2035년 재운 대운"
       "그들은 2026~2035년 애정 대운"
    3. 교점 찾기:
       "2026-2030: 둘 다 相生 운 (결혼하기 좋은 해)"
       "2031-2035: 당신의 재운 up, 둘의 감정 주의"
  출력：30년 대운 매칭 카드
    ┌─────────────────────────┐
    │ 향후 30년 대운 노정     │
    │                         │
    │ 2026-2030: 相生 (최고) │
    │ 2031-2035: 주의 기간  │
    │ 2036-2045: 안정 기간  │
    │ 2046-2055: 도전·성장 │
    └─────────────────────────┘
```

#### 4.C.3 결과 텍스트 생성（한국화된 Prompt）
```
Prompt 파일: /backend/prompts/hehun-story-KR.md

입력값:
  - personA: {name, birthDate, gender, saju}
  - personB: {name, birthDate, gender, saju}
  - score: number (0-100)

출력：2-3 paragraph 스토리
  Tone: 따뜻하고 희망적
  구조:
    1. 첫만남 기감 (오행 상호작용 설명 숨김·감성적)
       "당신의 따뜻한 불꽃과 그들의 부드러운 물이 만나, 
        서로를 완성하는 증기가 피어올랐습니다."
    
    2. 관계의 시너지 (十神 역할)
       "당신은 그들에게 안정을 주고, 
        그들은 당신에게 유연함을 가르칩니다."
    
    3. 앞으로 (긍정적 기대·현실적 조언)
       "앞으로의 30년, 함께 인생을 짜나가세요. 
        어려움이 있어도 서로를 바라보는 마음이 있다면, 
        당신들은 분명 행복한 모습일 겁니다."
```

#### 4.C.4 五行 분석 (한식 용어)
```
예시:

당신:  火 (Fire)  - 열정·주도성
그들:  水 (Water) - 직관·유연함

오행상 관계: 火生土 (불이 흙을 만들고...)
  ✓ 보완: 불 에너지와 물의 부드러움
  ✓ 주의: 불과 물은 서로 제어·균형이 중요

"당신의 불 에너지는 주도적·따뜻하고,
 그들의 물 에너지는 직관적·포용합니다.
 상극(相剋)이지만, 현명한 배치면 最强 조합."
```

#### 4.C.5 잠금 카드 (프리미엄)
```html
<div class="locked-card">
  <div class="locked-overlay">
    <div class="lock-icon">🔒</div>
    <div class="lock-title">당신들의 미래 30년</div>
    <button class="lock-btn">프리미엄 열기</button>
    <div class="lock-divider">또는</div>
    <button class="lock-share-btn">친구와 공유</button>
  </div>
  <div class="locked-inner" style="filter:blur(6px)">
    <!-- 실제 대운 분석 콘텐츠 -->
  </div>
</div>
```

---

### D. Daily-KR (매일 天機)

#### 4.D.1 페이지 구조（복용 daily.html 90%）
```html
<div class="date-hero">
  <div class="date-en">AUGUST 10, 2026</div>
  <div class="date-zh">癸卯月 甲申日</div> <!-- 중국식 간지, 한국도 동일 -->
  <div class="date-ganzhi">癸卯 甲申</div>
  <div class="gold-line"></div>
</div>

<div class="input-wrap">
  <div class="field-group">
    <div class="field-row">
      <div class="field-label">생년</div>
      <select class="field-select" id="year-select">...</select>
    </div>
    <!-- 월/일/시 -->
  </div>
  <div class="gender-row">
    <div class="gender-opt selected">여성</div>
    <div class="gender-opt">남성</div>
  </div>
</div>

<div id="results">
  <!-- 오늘의 5행 에너지 -->
  <!-- 행운의 색 -->
  <!-- 황력 宜忌 -->
  <!-- 대운 요약 -->
</div>
```

#### 4.D.2 Daily 내용 한국화
```
오늘의 5行 에너지：

현재 5행 분포:
  🔴 火 (열정) - 약함
  🟡 土 (안정) - 보통
  🔵 水 (흐름) - 강함
  🟢 木 (성장) - 약함
  🤎 金 (지혜) - 중간

당신의 일주는 [일주]로, 
오늘 [오행]이 지배하므로...

권유: [조언]

행운의 색: [색상]
행운의 방향: [방향]
황력 宜: [양력]
황력 忌: [음력]
```

#### 4.D.3 구독 UX
```
"매일 아침 오늘의 천기를 받아보세요"

구독 옵션:
  □ 무료 (일회만)
  ✓ 월 구독 ₩4,900/월
    └─ 매일 아침 알림 + 전체 분석

Push notification:
  "선연 · 오늘의 천기
   당신의 오늘은 [오행]의 날입니다.
   → 오늘의 운세 보기"
```

---

## V. 수익 모델 · Monetization

### 가격 전략（국가별）

| 기능 | CN ¥ | KR ₩ | EN $ | 비고 |
|---|---|---|---|---|
| Chat (5회/일) | Free | Free | Free | 인입 funnel |
| **Chat 회원** | ¥29.9/mo | ₩34,900/mo | $6.90/mo | 무한 + reports |
| Hehun | ¥19.9 | ₩24,900 | $4.99 | 일회성 |
| **Hehun 프리미엄** | ¥99 | ₩128,000 | $24.99 | 30년 대운 unlock |
| Daily 구독 | ¥9.9/mo | ₩12,900/mo | $2.99/mo | 매일 push |
| Bazi 전체 | ¥99 | ₩128,000 | $24.99 | 번들 |

### 경로별 예상 수익（월별·보수적 추정）

```
Phase 3.0 런칭 후 (Month 1-3):
  Chat DAU: 1,200 (EN +400, KR +300)
    → 회원 전환율 2% × 1,200 = 24명
    → ¥29.9 × 1.2 = ₩432 (KR가중)
    → 월간 ¥10K-12K (Chat만)

Phase 3.1 (Hehun-KR 런칭 후·Month 4-6):
  Hehun KR DAU: 600
    → 일회성 ₩24,900 (50% free)
    → 프리미엄 업매 15% = ₩128,000 (고가)
    → 월간 ¥30K-40K (Hehun)

Phase 3.1 (Daily-KR 런칭 후·Month 7-9):
  Daily KR 구독: 8% of DAU = 48명
    → ₩12,900/mo × 48 = ¥50K (월간)

Q4 신년운세 Season (Month 10-12):
  모든 기능 합산·투放 집중
  예상 월간 수익: ¥150K-200K (단기 피크)

**연간 예상**: ¥600K-900K (보수)
```

### 퍼널 최적화（Click-Through 향상）

```
현재 (Phase 1-2):
  Landing (LP) → Bazi (2% CVR) → Report (15% paid)
  
Phase 3 후:
  Landing (LP) → Bazi (2%) → Chat (Chat DAU↑35%)
                                ↓
                         Hehun (Chat→Hehun 교차판매 5%)
                                ↓
                         Daily 구독 (매일 재참여)
                                ↓
                         Chat 회원 (무한 업그레이드)

목표 ARPU 상승: $2.50 → $8.00 (3배)
```

---

## VI. 데이터베이스 확장

### 새로운 테이블

#### 1. chat_sessions (회화 context 지속)
```sql
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  session_id VARCHAR UNIQUE,
  language VARCHAR(2), -- 'zh', 'en', 'ko'
  messages JSONB, -- [{role, content, timestamp}]
  quota_used INT DEFAULT 0,
  created_at TIMESTAMP,
  last_active TIMESTAMP,
  metadata JSONB -- {browser, ip, utm_source}
);
```

#### 2. quotas (다국어 quota 추적)
```sql
CREATE TABLE quotas (
  id UUID PRIMARY KEY,
  user_id UUID,
  session_id VARCHAR,
  language VARCHAR(2),
  daily_quota INT DEFAULT 5,
  used_today INT DEFAULT 0,
  last_reset TIMESTAMP,
  is_member BOOLEAN DEFAULT FALSE
);
```

#### 3. analytics_logs (언어/지역별 분석)
```sql
CREATE TABLE analytics_logs (
  id UUID PRIMARY KEY,
  event_type VARCHAR, -- 'chat_send', 'hehun_calculate', 'daily_view'
  language VARCHAR(2),
  country VARCHAR(2),
  feature VARCHAR(30), -- 'chat_en', 'hehun_kr', 'daily_cn'
  latency_ms INT,
  success BOOLEAN,
  created_at TIMESTAMP,
  user_id UUID,
  metadata JSONB
);
```

---

## VII. 런칭 체크리스트 · Launch Readiness

### Phase 3.0 (Chat 전시스템)
```
Week 1-2 (Chat-EN):
  [ ] chat-EN.html 파일 생성 (chat.html 복사 + 13 수정)
  [ ] 영문 quick questions 5개 번역 + Karen 재확인
  [ ] system prompt (영문) 작성 + tone guide
  [ ] 영문 paywall / disclaimer 카피
  [ ] SEO meta (title, og:description) 영문화
  [ ] QA: 텍스트 overflow test, 응답 지연성 test
  [ ] Backend routing (language="en") 추가

Week 2-3 (Chat-KR):
  [ ] chat-KR.html 생성 (chat.html 복사 + 13 수정)
  [ ] 한글 quick questions 5개 (모국어 검수)
  [ ] System prompt (한글) 작성 + 톤가이드
  [ ] 한글 paywall / disclaimer
  [ ] SEO meta 한글화
  [ ] QA: 한글 렌더링, 이모지 정렬, 응답성
  [ ] Backend routing (language="ko") 추가

Week 4 (통합 QA):
  [ ] 세 버전 (CN/EN/KR) 병렬 테스트
  [ ] 크로스 페이지 링크 검증
  [ ] 결제 페이지 redirect 테스트
  [ ] 모바일 responsive 검증 (iOS/Android)
  [ ] VPN 우회 quota 보안 테스트
  [ ] 성능 프로파일링 (로딩 < 2s)
  [ ] 배포 (HK 서버 + CDN)

Week 5 (모니터링 설정):
  [ ] Sentry error tracking
  [ ] PostHog 언어별 funnel 분석
  [ ] Backend logs (language/latency)
  [ ] Uptime monitoring
  [ ] 알림 설정 (quota API fail, 높은 오류율)
```

### Phase 3.1 (Hehun-KR, Daily-KR)
```
Week 5-7 (Hehun-KR):
  [ ] hehun-KR.html 생성 (hehun.html 복사 + 15% 수정)
  [ ] 한식 술어 교체 (십성, 신살, 용신 등)
  [ ] 당신들의 인연 스토리 Prompt (한글화)
  [ ] 30년 대운 매칭 로직 구현
  [ ] 색상 미세조정 (한국미 정감)
  [ ] QA: 입력폼 검증, 계산 정확성, 결과 렌더링
  [ ] Locked card 한글 텍스트

Week 7-9 (Daily-KR):
  [ ] daily-KR.html 생성 (daily.html 복사)
  [ ] 한글 황력 宜忌 데이터 (국제 캘린더와 싱크)
  [ ] 매일 푸시 구독 UX 한글화
  [ ] 결과 텍스트 생성 Prompt (한글)
  [ ] QA: 정확한 오행 분석, 추천 색상/방향, 푸시 송수신

Week 10 (한국 시장 통합 테스트):
  [ ] CN 사용자가 KR 페이지 접근 시 거리/언어 감지
  [ ] KRW 결제 완전히 작동 (Inicis/KakaoPay/NaverPay)
  [ ] KR 고객지원 채널 준비 (카톡/이메일)
  [ ] KR 푸시 배포 준비 (Firebase Cloud Messaging KRW)
  [ ] 배포 (HK 서버·지리적 분기)
```

### 배포 스트래티지
```
옵션 1 (기존·보수적):
  /pages/
    ├─ chat.html (CN)
    ├─ chat-EN.html (EN)
    ├─ chat-KR.html (KR)
    └─ ... (同様 Hehun, Daily)
  → 간단, 유지보수 어려움 (다중 파일)

옵션 2 (최적·장기):
  /pages/
    └─ chat.html (i18n 내장)
       → URL: /pages/chat.html?lang=ko
       → localStorage가 언어 기억
  → 유지보수 쉬움, 하지만 구현 복잡도 ↑
  → Phase 3.2에서 리팩토링 (시간 여유 있을 때)

**Phase 3.0-3.1: 옵션 1 채택** (빠른 출시)
**Phase 4: 옵션 2로 마이그레이션** (코드 부채 정리)
```

---

## VIII. 운영 & KPI · Ops

### 주간 모니터링 대시보드
```
Metric | Target | Alert Threshold | Owner
---|---|---|---
Chat DAU (Total) | +35% WoW | < +15% | Karen
Chat DAU by Lang | CN 2.4K, EN +1.2K, KR +0.9K | -20% | Analytics
Hehun Conversion | > 5% (chat→hehun) | < 2% | Product
Daily Sub Churn | < 5%/mo | > 8% | Ops
Paywall CTR | > 8% (among free users) | < 5% | Growth
API Latency (Chat) | < 1.5s p95 | > 2s p99 | DevOps
Error Rate | < 0.1% | > 0.5% | DevOps
Quota Fraud | < 1% bypass rate | Spike detection | Security
```

### 콘텐츠 일정 (Content Calendar)
```
Phase 3.0 공개 (Week 1):
  - Blog: "당신의 영어 운세를 이제 만나세요" (EN)
  - Email: Chat-EN 런칭 알림
  - Social: TikTok short (EN version release)

Phase 3.1 공개 (Week 5):
  - Blog: "한국식 궁합, 이제 30년 대운까지" (KR)
  - Email: Hehun-KR 런칭 (한국 이메일 리스트)
  - Social: Instagram Reels (KR 고객 증언)

Phase 3.1 Daily-KR (Week 8):
  - Blog: "매일 아침의 천기" (KR)
  - Push: "오늘의 운세 구독" 캠페인
  - Social: TikTok trend audio (KR) + daily fortune

Q4 신년운세 집중 (Month 10-12):
  - Email blast: "2027 신년운세 준비하세요"
  - Paid ads (Google/Naver): "사주 깊게 읽기" keyword
  - KOL partnerships: 한국 유튜버 "운세 분석" series
```

---

## IX. 위험 요소 & 완화 전략 · Risk Mitigation

| 위험 | 확률 | 영향 | 대응 |
|---|---|---|---|
| 영문 Prompt 톤 mismatch (너무 신비로움) | High | Medium | Karen 3회 review + tone guide doc |
| 한글 술어 오역 (십신을 "십대신"으로) | Medium | High | 모국어 검수자 (한국 출신·命理 배경) 필수 |
| 30년 대운 알고리즘 오류 | Medium | Critical | 기존 한국 사주 시스템 cross-check (점신/포스텔러) |
| KRW 결제 지연/실패 | Low | Medium | Inicis + KakaoPay dual 백업 |
| Chat DAU 안 올라감 (예상 35% vs 실제 10%) | Medium | High | 마케팅 집중 + landing page CRO |
| 성능 저하 (다국어 Prompt 길어짐) | Low | Medium | Prompt 압축 + caching (Redis) |
| 법규 우려 (AI법·광고 규제) | Low | High | Legal review + disclaimer 강화 |

---

## X. 성공의 정의 · Definition of Done

### Phase 3.0 (Chat 전시스템)
- [x] 3개 언어 버전 (CN/EN/KR) 온라인
- [x] Quota 시스템 3개 국가 cross-test
- [x] Chat DAU +35% (baseline 2.4K → 3.2K+)
- [x] Paywall CVR > 2% (from free to member)
- [x] Zero critical errors (Sentry) for 7 days post-launch
- [x] SEO meta tags localized + indexed

### Phase 3.1 (Hehun-KR, Daily-KR)
- [x] Hehun-KR online by Week 7
- [x] 30년 대운 매칭 알고리즘 verified
- [x] Daily-KR online by Week 9 (Q4 전)
- [x] Daily sub churn < 5%/mo
- [x] KRW 결제 > 95% success rate
- [x] Korean brand sentiment > 4/5 (survey)

### 거시적 성공 지표
```
6개월 후 (Phase 3 완료):
  ✓ Global Chat DAU: 3.8K (35% ↑)
  ✓ Global Hehun monthly: $12K (현재 $4K 대비 3배)
  ✓ KR market share: 22% of total revenue (지금 0%)
  ✓ User retention (Day 30): > 18% (현재 12%)
  ✓ ARPU: $7.50 (지금 $2.50)
```

---

## XI. 부록 · Appendix

### A. 파일 체크리스트 (커밋 전 확인)
```
New Files:
  [ ] /pages/chat-EN.html (950 lines)
  [ ] /pages/chat-KR.html (950 lines)
  [ ] /pages/hehun-KR.html (1200 lines)
  [ ] /pages/daily-KR.html (800 lines)
  [ ] /backend/prompts/chat-system-EN.md
  [ ] /backend/prompts/chat-system-KR.md
  [ ] /backend/prompts/hehun-story-KR.md
  
Modified Files:
  [ ] /backend/api/chat.js (language routing logic)
  [ ] /backend/api/quota.js (multi-lang quota)
  [ ] /pages/index.html (KR 링크 추가)
  [ ] /pages/bazi.html (Chat-KR 링크 추가)
  
Config:
  [ ] .env.production (KR payment keys)
  [ ] package.json (dependency 무변화)
```

### B. 용어 사전 (개발팀·QA)
```
명칭 표준화:

CN         | EN              | KR          | 뜻
-----------|-----------------|-------------|----------
十干       | Heavenly Stems  | 천간        | 갑을병정무기경신임계
十二支     | Earthly Branches| 지지        | 자축인묘진사오미신유술해
藏干       | Hidden Stems    | 장간        | 지지 내 숨은 천간
五行       | Five Elements   | 오행        | 금목수화토
大运       | 10-Year Luck    | 대운        | 10년 주기 운
十神       | Ten Gods        | 십신        | 역할 카테고리 (비인상관 등)
神煞       | Evil Stars      | 신살        | 궁삼/도살 등 불리 요소
用神       | Day Master      | 용신        | 일간의 喜/忌
식신       | Eating God      | 식신        | 창의/표현의 별
생재       | Eating Wealth   | 생재        | 지속적 수입
정재       | Direct Wealth   | 정재        | 직접 수입

예: "당신의 일주는 癸水이고, 用神은 火입니다."
    "Your day stem is Gui Water, your favorable element is Fire."
    "당신의 일주는 계수(癸水)이고, 용신은 화입니다."
```

### C. 심사 체크리스트 (Karen용)
```
기능:
  [ ] Chat-EN 톤이 "mystical yet grounded"인지
  [ ] Chat-KR 톤이 "따뜻하고 희망적"인지
  [ ] 30년 대운이 한국 시장 기대치 충족하는지
  
비즈니스:
  [ ] 가격표 KRW/CNY/USD 일관성 있는지
  [ ] Paywall 문구 설득력 있는지
  
법규:
  [ ] AI 면책 2026 법안 반영했는지
  [ ] 개인정보 처리 방침 업데이트했는지
  
시장:
  [ ] 영문 복사가 Lumee Echo 톤과 유사한지
  [ ] 한국 복사가 포스텔러/점신과 차별화되는지
```

---

**이 PRD는 활문서입니다. 매주 업데이트됩니다.**  
*Last updated: 2026-08-10*  
*Next review: 2026-08-17*

