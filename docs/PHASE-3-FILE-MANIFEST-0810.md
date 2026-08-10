# Phase 3 文件清单（Manifest）

**日期**：0810  
**总计新增**：12 个文件（HTML 4 + 后端 5 + 文档 3）  
**总计改动**：3 个文件（API + 配置）

---

## 新增文件清单

### 前端 HTML（4 个）

#### 1. `/pages/chat-EN.html` (NEW)
- **大小**：~950 行（复用 chat.html 90%）
- **改动点**：13 处（lang, meta, 文案, quick-q, paywall, API language param）
- **关键部分**：
  ```html
  <html lang="en">
  <title>ShenYuan · AI BaZi Chat</title>
  <div class="logo">ShenYuan · AI BaZi</div>
  <div class="logo-sub">3000 Years of Eastern Wisdom · AI Insights</div>
  
  <!-- 5 quick questions -->
  <button onclick="ask('How is my wealth outlook for this year?')">
    💰 Wealth this year
  </button>
  
  <!-- API call -->
  fetch('/api/chat', {
    body: JSON.stringify({
      messages: msgsToSend,
      language: 'en'
    })
  })
  ```
- **交付时间**：Week 2-3
- **依赖**：Karen 英文文案确认

---

#### 2. `/pages/chat-KR.html` (NEW)
- **大小**：~950 行（复用 chat-EN.html 90%）
- **改动点**：13 处（同上·仅改韩文）
- **关键部分**：
  ```html
  <html lang="ko">
  <title>선연 · AI 사주 채팅</title>
  <div class="logo">선연 · AI 사주</div>
  <div class="logo-sub">3천년 동양지혜 · AI 상담</div>
  
  <!-- 5 quick questions (한글) -->
  <button onclick="ask('올해 저의 재운은 어떻게 될까요?')">
    💰 올해 재운
  </button>
  
  fetch('/api/chat', {
    language: 'ko'
  })
  ```
- **交付时间**：Week 3-4
- **依赖**：Karen 韩文 Tone 确认 + 韩文校对人员

---

#### 3. `/pages/hehun-KR.html` (NEW)
- **大小**：~1200 行（复用 hehun.html 85%）
- **改动点**：15 处（术语替换 + 30年大运 + 색상微调）
- **关键新增**：
  ```html
  <!-- 30년 대운 매칭 -->
  <div class="year-section">
    <div class="year-head">
      <span class="year-icon">📅</span>
      <span class="year-title">향후 30년 대운</span>
    </div>
    <div id="durianChart">
      <!-- 表格：期间 | 당신의 운 | 그들의 운 | 교집합 -->
    </div>
  </div>
  
  <!-- 당신들의 인연 생성 -->
  async function generateStory(personA, personB, score) {
    // Prompt → DeepSeek → 결과 렌더링
  }
  ```
- **交付时间**：Week 5-7
- **依赖**：30年大运算法实现 + 韩文校对 + DeepSeek Prompt

---

#### 4. `/pages/daily-KR.html` (NEW)
- **大小**：~800 行（复用 daily.html 90%）
- **改动点**：10 处（i18n + 황력宜忌 + 구독 UX）
- **关键新增**：
  ```html
  <!-- 오늘의 오행 에너지 -->
  <div class="energy-section">
    <div class="energy-item">
      <div class="energy-emoji">🔴</div>
      <div class="energy-name">火 (열정)</div>
      <div class="energy-level">약함</div>
    </div>
  </div>
  
  <!-- 매일 아침 푸시 구독 -->
  <button onclick="subscribeDaily()">
    매일 아침 천기 받기 · ₩12,900/월
  </button>
  ```
- **交付时间**：Week 7-9
- **依赖**：황력宜忌 API + Firebase Cloud Messaging

---

### 后端代码（5 个）

#### 5. `/backend/prompts/chat-system-EN.md` (NEW)
- **大小**：~300 行
- **内容**：
  ```markdown
  # System Prompt for English BaZi Chat
  
  You are ShenYuan, a mystical yet grounded BaZi guide...
  
  ## User's BaZi Chart
  ## Your Response Structure
  1. Direct Answer
  2. Why
  3. Timing
  4. Nuance
  5. Reflection
  
  ## Tone
  ## Disclaimer
  ```
- **交付时间**：Week 1
- **审核**：Karen 确认 Tone

---

#### 6. `/backend/prompts/chat-system-KR.md` (NEW)
- **大小**：~300 行
- **内容**：韩文版 System Prompt（따뜻함 + 정성 + 자기발견）
- **交付时间**：Week 2
- **审核**：韩文原生校对

---

#### 7. `/backend/prompts/hehun-story-KR.md` (NEW)
- **大小**：~150 行
- **内容**：당신들의 인연 생성 Prompt（감성적 스토리텔링）
- **交付时间**：Week 5
- **审核**：Karen + 韩文校对

---

#### 8. `/backend/api/chat.js` (MODIFY)
- **改动**：+80 行（多语言路由 + Quota 检查 + logging）
- **前**（现有）：
  ```javascript
  router.post('/chat', async (req, res) => {
    const { messages } = req.body;
    // 默认中文 prompt
    // 调 DeepSeek
  });
  ```
- **后**（改后）：
  ```javascript
  router.post('/chat', async (req, res) => {
    const { messages, language = 'CN', userId, sessionId } = req.body;
    
    // 1. Quota 检查 (多语言)
    const quota = await checkQuota(userId, sessionId, language);
    
    // 2. Prompt 路由
    const langTag = ['CN', 'EN', 'KR'].includes(language) ? language : 'CN';
    const systemPrompt = prompts[`chat-${langTag}`];
    
    // 3. LLM 调用
    const response = await callDeepSeek({...});
    
    // 4. Quota 扣除
    // 5. 日志记录 (分语言分析)
  });
  ```
- **交付时间**：Week 2
- **依赖**：/backend/services/quota.js 更新

---

#### 9. `/backend/migrations/001_add_phase3_tables.sql` (NEW)
- **大小**：~200 行
- **内容**：
  ```sql
  CREATE TABLE chat_sessions (...);
  CREATE TABLE quotas (...);
  CREATE TABLE analytics_logs (...);
  CREATE FUNCTION deduct_quota_safe(...);
  CREATE INDEX idx_quotas_last_reset (...);
  ```
- **数据库表**：
  - `chat_sessions`：回话持久化（context 保留）
  - `quotas`：多语言 quota 管理
  - `analytics_logs`：分语言分析日志
- **交付时间**：Week 1
- **执行**：`supabase db push --linked`

---

### 文档（3 个）

#### 10. `/docs/PRD-Phase-3-AI聊天与功能迁移-0810.md` (NEW)
- **大小**：~12,000 字（完整 PRD）
- **章节**：
  1. 战略背景
  2. 功能架构
  3. 技术栈
  4. 详细规格
  5. 收入模型
  6. 数据库设计
  7. 启动清单
  8. 运营 KPI
  9. 风险管理
  10. 成功定义
  11. 术语字典 + 审核清单
- **用途**：团队完整参考
- **交付时间**：Week 1 初稿

---

#### 11. `/docs/PHASE-3-IMPLEMENTATION-GUIDE-0810.md` (NEW)
- **大小**：~8,000 字（工程师专用）
- **章节**：
  1. 前端实施清单（HTML 4 个·细节改动）
  2. 后端实施清单（API 路由·Prompt 管理）
  3. 数据库扩展（表结构·RPC 函数）
  4. DevOps 部署（环境变量·回滚计划）
  5. 性能优化（加载速度·LLM 响应）
- **用途**：开发人员逐步施工指南
- **交付时间**：Week 1

---

#### 12. `/docs/PHASE-3-EXECUTIVE-SUMMARY-0810.md` (NEW)
- **大小**：~3,000 字（给 Karen）
- **章节**：
  1. 一句话战略
  2. 三个核心数字（DAU/收入/ARPU）
  3. 四个交付物 + Karen 决策清单
  4. 三个审核环节
  5. 三个风险对应
  6. 五个财务预期（ROI 计算）
  7. 六个关键依赖
  8. 七个时间表（甘特图）
  9. 八个成功指标（Dashboard）
  10. 清单 & 下一步
- **用途**：高管快速理解 + 决策点
- **交付时间**：Week 1 初稿

---

## 改动文件清单

### 13. `/pages/index.html` (MODIFY)
- **改动**：+2 行（添加 KR 链接）
- **前**：无 Korean Chat 链接
- **后**：
  ```html
  <a href="/pages/chat-KR.html">선연 · AI 사주 채팅</a>
  ```
- **交付时间**：Week 4

---

### 14. `/pages/bazi.html` (MODIFY)
- **改动**：+1 行（添加 Chat-KR 跳转）
- **后**：
  ```html
  <a href="/pages/chat-KR.html">韩文聊天</a>
  ```
- **交付时间**：Week 4

---

### 15. `/backend/services/quota.js` (MODIFY)
- **改动**：+60 行（多语言 quota 管理）
- **新增**：
  - `checkQuota(userId, sessionId, language)` - 多语言检查
  - `deductQuota(userId, sessionId, language)` - 原子性扣费
  - RPC 调用 `deduct_quota_safe()` - 防并发
- **交付时间**：Week 2

---

## 文件结构树

```
shenyuan/
├── pages/
│   ├── chat.html              (现有·无改)
│   ├── chat-EN.html           ⭐ NEW (Week 2-3)
│   ├── chat-KR.html           ⭐ NEW (Week 3-4)
│   ├── hehun.html             (现有·无改)
│   ├── hehun-EN.html          (跳过·优先级 P2)
│   ├── hehun-KR.html          ⭐ NEW (Week 5-7)
│   ├── daily.html             (现有·无改)
│   ├── daily-EN.html          (跳过·优先级 P2)
│   ├── daily-KR.html          ⭐ NEW (Week 7-9)
│   └── index.html             (改·+KR 链接)
│   └── bazi.html              (改·+Chat-KR 链接)
│
├── backend/
│   ├── api/
│   │   ├── chat.js            (改·+lang 路由)
│   │   └── quota.js           (改·+多语言逻辑)
│   │
│   ├── prompts/               ⭐ NEW 目录
│   │   ├── README.md          (维护指南)
│   │   ├── chat-system-CN.md  (现有或新)
│   │   ├── chat-system-EN.md  ⭐ NEW (Week 1)
│   │   ├── chat-system-KR.md  ⭐ NEW (Week 2)
│   │   ├── hehun-story-CN.md  (新或改)
│   │   ├── hehun-story-EN.md  (跳过)
│   │   └── hehun-story-KR.md  ⭐ NEW (Week 5)
│   │
│   ├── services/
│   │   └── quota.js           (改·见上)
│   │
│   ├── migrations/
│   │   └── 001_add_phase3_tables.sql  ⭐ NEW (Week 1)
│   │
│   └── cron/
│       └── daily-notification.js  ⭐ NEW (Week 8)
│           (推送调度·可选)
│
├── docs/
│   ├── PRD-Phase-3-AI聊天与功能迁移-0810.md
│   │   ⭐ NEW (本文件·12K)
│   │
│   ├── PHASE-3-IMPLEMENTATION-GUIDE-0810.md
│   │   ⭐ NEW (工程师指南·8K)
│   │
│   ├── PHASE-3-EXECUTIVE-SUMMARY-0810.md
│   │   ⭐ NEW (Karen·3K)
│   │
│   └── PHASE-3-FILE-MANIFEST-0810.md
│       ⭐ THIS FILE
│
└── .env.production (改·+KR payment keys)
    (Inicis/KakaoPay/NaverPay)
```

---

## 提交检查清单（Before Commit）

### Git 提交结构（建议分 3 个 PR）

#### PR #1: Backend Infrastructure (Week 1)
```bash
git add backend/migrations/001_add_phase3_tables.sql
git add backend/prompts/chat-system-EN.md
git add backend/prompts/chat-system-KR.md
git add backend/prompts/hehun-story-KR.md
git add backend/api/chat.js
git add backend/services/quota.js
git add docs/PRD-Phase-3-AI聊天与功能迁移-0810.md
git add docs/PHASE-3-IMPLEMENTATION-GUIDE-0810.md
git commit -m "Phase 3 Backend: Multi-language chat routing + DB schema

- Add chat_sessions, quotas, analytics_logs tables
- Implement language-aware quota management
- Create system prompts (EN, KR)
- Update /api/chat to support language parameter
- Add comprehensive PRD & implementation guide"
```

#### PR #2: Frontend Chat (Week 4)
```bash
git add pages/chat-EN.html
git add pages/chat-KR.html
git add pages/index.html
git add pages/bazi.html
git commit -m "Phase 3.0: Launch Chat in English & Korean

- chat-EN.html: Full reuse of chat.html + EN copy
- chat-KR.html: Full reuse of chat-EN.html + KR copy
- Update navigation links to chat-EN/KR
- SEO: Add hreflang tags for all 3 language versions
- Tested: <2s load, no console errors, paywall logic verified"
```

#### PR #3: Hehun & Daily KR (Week 9)
```bash
git add pages/hehun-KR.html
git add pages/daily-KR.html
git add backend/cron/daily-notification.js
git commit -m "Phase 3.1: Launch Hehun + Daily in Korean

- hehun-KR.html: 30-year durian matching algorithm
- daily-KR.html: Daily fortune + subscription UX
- Add push notification scheduler (8:00 KST)
- Implement Korean payment integration (KRW)
- QA: Cross-check with Korean competitors (점신, 포스텔러)"
```

---

## 验收标准（Definition of Done）

### Phase 3.0（Chat）
- [ ] chat-EN.html 加载 < 2s
- [ ] chat-KR.html 加载 < 2s
- [ ] 支付墙出现时机正确（quota=0）
- [ ] API 返回 language 字段正确
- [ ] 三语言 quick questions 功能验证
- [ ] Karen 审核通过（英文/韩文 copy）
- [ ] 零 console errors，<0.1% API error rate
- [ ] Sentry 监控已启用
- [ ] SEO meta tags indexed

### Phase 3.1（Hehun-KR）
- [ ] 30年大运算法与竞品 cross-check
- [ ] "당신들의 인연" 故事生成验证
- [ ] 韩文校对通过（术语准确）
- [ ] 结果页 UI 正确渲染
- [ ] 프리미엄 unlock 流程完整
- [ ] 支付链接正确（₩128,000）

### Phase 3.1（Daily-KR）
- [ ] 황력宜忌 数据准确
- [ ] 推送消息正确生成
- [ ] 구독 계산 정확
- [ ] Firebase Cloud Messaging 发送成功率 > 95%
- [ ] 매일 8:00 KST 发送（지표 확인）

---

## 工作量估算（小时）

| 任务 | 工时 | 优先级 | 开始周 |
|---|---|---|---|
| 后端路由（chat.js） | 20h | P0 | W1 |
| 前端 chat-EN.html | 16h | P0 | W2 |
| 前端 chat-KR.html | 16h | P0 | W3 |
| Hehun-KR 30年大运算法 | 32h | P1 | W5 |
| Daily-KR + 推送 | 24h | P1 | W7 |
| QA 三语言测试 | 40h | P1 | W3-10 |
| DevOps & 监控 | 40h | P1 | W1-10 |
| 文档 & 培训 | 20h | P2 | W1 |
| **合计** | **208h** | | |
| 预留（风险缓冲） | +40% = **~290h** | | |

**人天估算**：290h ÷ 8h/day = ~36 人天（6 周内完成）

---

## 配置文件改动

### `.env.production` (新增)
```bash
# 韩文支付
INICIS_MID=...        # 이니시스 상점ID
KAKAOPAY_KEY=...      # 카카오페이 API key
NAVERPAY_KEY=...      # 네이버페이 API key

# 韩文 SMS（Optional）
NAVER_SMS_KEY=...     # 네이버 클라우드 SMS

# Firebase (推送)
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY=...
```

---

## 版本控制 & 标签

建议添加 Git 标签：
```bash
# Week 4 Chat 上线时
git tag -a v3.0-chat -m "Phase 3.0: Multi-language chat system"

# Week 7 Hehun-KR 上线时
git tag -a v3.1-hehun -m "Phase 3.1: Korean Hehun with 30-year durian"

# Week 9 Daily-KR 上线时
git tag -a v3.1-daily -m "Phase 3.1: Korean Daily subscription launch"

# Week 12 完整 Phase 3 收尾时
git tag -a v3-complete -m "Phase 3 complete: All features launched"
```

---

## 相关文档索引

在这 3 份文件之外，参考：
- `/docs/PRD-韩国MVP-0730.md` ← 韩国市场背景
- `/docs/Lumee移植清单-0730.md` ← 复用 Lumee 引擎指南
- `/docs/README-KR-PAYMENT.md` ← 韩文支付集成

---

**这份清单会随开发进展每周更新。**

最后更新：2026-08-10
下次审核：2026-08-17
