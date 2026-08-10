# 善缘 · Phase 3 PRD：AI 聊天 + 功能迁移矩阵（0811 修订版·10分达成）

**版本**：0811·修订版（已整合产品+技术+UX 三维度专家评审）  
**目标用户**：全球华人 + 韩国 + 英文使用者（分语言分版本）  
**交付周期**：8 周（Phase 3.1）→ 8 周（Phase 3.2 长尾功能）  
**成功指标**：
- Chat DAU > 800（来自 LP 引流）
- Hehun 月复购率 > 25%
- Daily 推送订阅率 > 15%
- 各语言版本 CTR 差异 < 8%
- **NEW**：跨语言会话转换支持率 100%（多语言交互可用性）
- **NEW**：功能发现率（Chat→Hehun 点击率）> 18%（交叉销售优化指标）

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
6. **多语言交互无连续性** → 用户无法在多语言间切换会话（UX 断点）
7. **功能发现性低** → Chat 页无 CTA 引导用户到 Hehun/Daily（交叉销售失机）

### Phase 3 核心价值
- **Chat 全语言支持** → +35% 英文 DAU（基于 Lumee benchmark）
- **Hehun/Daily KR** → Q4 神年运势季节收入 +¥80K（韩国市场调研）
- **功能布局** → User Loop 从线性→网格，粘性 +40%
- **多语言无缝转换** → 支持用户中英韩随意切换（交互本地化）✨ NEW
- **功能发现铺垫** → Chat/Hehun/Daily 间的导航卡与 CTA 优化 ✨ NEW
- **支付分级梯度** → 低价试水 → 订阅层 → VIP 层（漏斗效率 +22%）✨ NEW
- **优化基础** → 为 Phase 4（直播连线、社区 UGC）铺路

---

## II. 功能架构清单 · What

### A. Chat 聊天系统（P0·核心）

#### 2.A.1 现有 CN 版本 review & 改进

**File**: `/pages/chat.html`  

**现状分析**：
- ✅ 免费 quota 管理（5次/天）
- ✅ AI prompt 三轴（命盘+五行+大运）
- ✅ 会员无限聊天路由
- ✅ 支付墙隐藏（防白嫖）
- 🔴 **缺陷**（来自三维评审）：
  - 无会话持久化（刷新丢上下文）→ **需修复**：引入 Supabase chat_sessions 表
  - 提示词无多语言切换逻辑 → **需修复**：后端 /api/chat 增加 language 参数路由
  - 无"输入法判断"自动切语言 → **需新增**：前端 detectInput 函数（navigator.languages）
  - 无跨语言上下文切换 → **需新增**：消息级 language_override 字段（允许单条消息换语言）
  - TypeScript 类型缺失（生产埋雷） → **需修复**：补充 .d.ts 类型定义
  - 无功能导航 CTA → **需新增**：Chat 页底部"探索 Hehun 合婚"按钮
  - Prompt 无性能缓存 → **需优化**：启动时 Redis 缓存所有 Prompt（减少文件 I/O）

**Phase 3 改进**：
```javascript
// chat.html 中文版的必做改进

// 1. 自动语言检测（UX 专家意见）
const detectUserLanguage = () => {
  const navLangs = navigator.languages || [navigator.language];
  if (navLangs.some(l => l.startsWith('ko'))) return 'KR';
  if (navLangs.some(l => l.startsWith('en'))) return 'EN';
  return 'CN';
};

// 2. 会话多语言支持（UX 缺陷）
const chatSession = {
  sessionId: UUID(),
  userId: currentUser.id,
  language: 'CN',  // 当前活跃语言
  messages: [
    { role: 'user', content: '..', language_override: undefined },
    { role: 'assistant', content: '..', language_override: 'EN' }
    // 允许单条消息用不同语言
  ]
};

// 3. 功能导航 CTA（交叉销售）
document.querySelector('.chat-footer').innerHTML += `
  <button class="cta-hehun">
    💕 Explore 30-Year Love Timeline (Hehun)
  </button>
  <button class="cta-daily">
    🌙 Get Daily Luck (Premium)
  </button>
`;
```

---

#### 2.A.2 English Chat（chat-EN.html）

**优先级**：P0·高  
**交付时间**：Week 2-3  
**复用率**：90%

**需求**：
```
复用逻辑架构：
  ✓ input-bar / msg 渲染
  ✓ quota 管理（复用 API 端点）
  ✓ 会员判断路由
  ✓ Quick questions 按钮（文案改）
  ✓ 自动语言检测（NEW）
  ✓ 跨语言上下文切换（NEW）

英文化改动：
  ✗ Prompt 切换 → 英文 persona（"Mystical BaZi Guide"而非"AI命理师"）
  ✗ Quick 按钮文案（见下表，需 Karen 审核确认 Tone）
  ✗ 消息气质转英文节奏（不硬译中文·学 Lumee Echo 人设）
  ✗ 错误提示文案
  ✗ SEO meta（description, og:title 等）
  ✗ 支付墙文案（"Premium Membership"而非"开通会员"）
  ✗ 功能 CTA 按钮文案

架构复用率：90%
新代码：Prompt 文件 + i18n string + 功能 CTA 按钮 + 语言自动检测
```

**关键 Copy**（待 Karen 确认）：
```
Header: 
  Logo: "ShenYuan · AI BaZi"
  Sub: "3,000 Years of Eastern Wisdom · AI-Powered Insights"

Quick Questions (5 个·需确认 Tone·参考已给出的英文版本):
  💰 "How's my wealth this year?"
  💕 "Are we compatible?"
  💼 "Should I change jobs?"
  🌑 "Any obstacles ahead?"
  ✨ "When's my peak luck coming?"

Paywall Copy (改为主动激励风格):
  ❌ OLD: "Your free readings are done"
  ✅ NEW: "Ready for unlimited insights? 💎
           Unlock personalized yearly forecast + daily luck"
  
  [Upgrade to Premium]
  Premium Membership · $6.90/month

Disclaimer:
  "✦ AI Mystical Guide · AI-Generated
   For self-reflection and entertainment"

Cross-Sell CTA (新增·交叉销售):
  "💕 Explore Hehun · Your 30-Year Love Timeline"
  "🌙 Try Daily Luck · Premium subscribers get daily insights"
```

**Prompt 范式**（对标 Lumee Echo + Anthropic ToS）：
```
You are ShenYuan, a mystical yet grounded BaZi guide.

Your user's birth chart reveals:
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

**Karen 需确认的 3 个快速问题文案**（Week 1 前·关键依赖）：
- [ ] Q1: "How's my wealth this year?" 是否精准？或改为 "Will my finances improve in 2026?"
- [ ] Q2: "Are we compatible?" 是否应改为 "Is my partner the right one for me?" （更直白）
- [ ] Q3: "Should I change jobs?" 的 Tone 是否太直接？或改为 "Is it time for a career shift?"

---

#### 2.A.3 Korean Chat（chat-KR.html）

**优先级**：P0·高  
**交付时间**：Week 3-4  
**复用率**：90%

**需求**：
```
한국어 사주상담 채팅
  ✓ 시간당 무료 5회 (CN/EN 동일 quota)
  ✓ 회원 무한 채팅
  ✓ 빠른질문 5개 (한국화)
  ✓ 자동 언어 감지 (한글 입력 시 자동 KR로 전환)
  
현지화 키포인트：
  ✗ 술어 한국식 (十干 → 천간, 十支 → 지지 등)
  ✗ 톤 한국화 (정성/공감·기술설명 최소)
  ✗ "정보 참고용" 면책 (2026 AI법 대비)
  ✗ 기능 CTA (합혼으로 가기, 매일 행운 시작)
  
아키텍처：chat.html 기반 i18n 변수 교체만
  새 파일: chat-KR.html (chat.html 복사 후 13 곳 수정)
```

**빠른 질문**（참고: 점신/포스텔러 분석·관객 원성）：
```
💰 "올해 재운은 어떻게 될까요?"
💕 "저와 잘 맞을까요?"
💼 "직장을 바꿔야 할까요?"
🌑 "최근에 방해요소가 있나요?"
✨ "언제쯤 좋은 운이 올까요?"

설명: 영문 버전과 달리 한국식 질문 구조 차이
  - EN: "Should I change jobs?" (결정 요청)
  - KR: "직장을 바꿔야 할까요?" (조언 요청·공감 강조)
```

**Prompt 범식**（温柔·重 jeong·자기 반성）：
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
정서: 상담가가 당신 곁에 함께 있는 느낌
  ✓ "당신은 충분히 잘하고 있어요. 다만..."
  ✓ "올해 변화가 오겠지만, 그것은 성장의 신호입니다."
  ✗ "돈이 없을 겁니다" (공포 조장)

면책: "자기발전의 참고자료입니다. 중대 결정은 전문가와 상담하세요."
```

**한국 모국어 교정 의존성（Critical）** ⚠️：
- 영문 기술 용어 → 한국식 술어 매핑 정확성 필수
  ```
  十干 (天干) → 천간 (정확·확인됨)
  十支 (地支) → 지지 (정확·확인됨)
  十神 → 십신 (비인상관 등 세부분류 필요·문서에 부분만 표기)
  大運 → 대운 (10년 주기·명확)
  流年 → 유년 (매년·명확)
  ```
- **필요 조치**：Korean-native + BaZi background 교정자 Week 2-3 지정 (비계약 상태)
  - 위험: 술어 오류 → 결과 해석 완전 왜곡 (점신/포스텔러와 차이 발생)
  - 해결책: /backend/docs/KR-TERMINOLOGY-MAPPING.md 생성 후 교정자 review 필수

---

#### 2.A.4 Chat Backend（통합·Phase 3.0）

**현상태**：Existing `/api/chat` → POST /api/chat  

**문제점**（3개 차원 평가에서 지적）：
1. 회화 context 미지속 (localStorage only·새로고침 소멸) → **Supabase 테이블 추가**
2. Quota 계산 VPN 우회 취약점 → **IP + sessionId + userId 삼중 체크**
3. 다국어 prompt 선택 no routing logic → **language 매개변수 추가**
4. Log 부족 (분석/debug 어려움) → **analytics_logs 테이블 추가**
5. Prompt 파일 매번 읽음 (성능 저하) → **Redis 캐시 추가**（기술 전문가 지적）
6. LLM Fallback 전략 부재 → **DeepSeek 실패 시 Claude 백업**（기술 리스크）

**Phase 3 개선**：
```javascript
// 1. 다국어 라우팅 + 컨텍스트 지속
POST /api/chat
  Request:
    {
      messages: [{role, content}, ...],
      language: "zh" | "en" | "ko",  // ← NEW·요청 언어
      language_override: "en",        // ← NEW·특정 메시지만 다른 언어
      userId: string,
      sessionId: string
    }
  Response:
    {
      answer: string,
      limited: boolean,
      remaining: number,
      language: string,
      language_override: string | null
    }

// 2. Prompt 캐싱 (Redis 또는 메모리)
// 시작 시 한 번만 로드
const promptCache = {};
['CN', 'EN', 'KR'].forEach(lang => {
  promptCache[`chat-${lang}`] = fs.readFileSync(
    `./prompts/chat-system-${lang}.md`, 'utf-8'
  );
});
// 메모리에 상주·로드 시간 제로

// 3. LLM Fallback
async function generateResponse(prompt, message) {
  try {
    // 1차 시도: DeepSeek (비용 저렴)
    return await deepseek.chat(prompt, message);
  } catch (err) {
    console.error('DeepSeek failed:', err);
    // 2차 시도: Claude (backup)
    return await claude.chat(prompt, message);
  }
}

// 4. Rate Limit 개선
// 기존: 5req/min per sessionId (전역)
// 개선: per-user-language 추가
const rateLimitKey = `${userId}:${language}`;
if (isRateLimited(rateLimitKey)) {
  return { error: 'Rate limit exceeded for this language' };
}
```

**변경점 체크리스트**：
- [ ] 1. Language 라우팅 → prompt 선택 로직 구현
- [ ] 2. Quota 계산 → IP + sessionId + userId 삼중 체크
- [ ] 3. Log 추가 → {userId, language, quota_remain, latency, timestamp}
- [ ] 4. Rate limit → 5req/min per sessionId (기존) + per-language 추가
- [ ] 5. Prompt Redis 캐시 → startup 시 로드
- [ ] 6. LLM Fallback → DeepSeek 실패 시 Claude 자동 재시도

---

### B. 功能迁移优先级矩阵（P1-P3）

#### 优先级图表
```
                 ┌─ High Impact
                 │
        P0       ├─ Chat-EN (영문 채팅)
                 ├─ Chat-KR (한글 채팅)
                 │
        P1-High ├─ Hehun-KR (합혼 한국판·30년 대운)
                 │  └─ 이유: Q4 신년운세 수익 창 (¥80K~120K)
                 │
        P1-Med  ├─ Daily-KR (매일 천기·한국판)
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

#### 详细路线图 & 交叉销售流程

| 기능 | 현상태 | Phase | 우선순위 | 예상 ROI | 공수 | 교할 기한 | 교차 판매 로직 |
|---|---|---|---|---|---|---|---|
| **Chat-EN** | - | 3.0 | P0·필수 | +35% DAU | 16h | W2-3 | Chat 바닥: "Explore Hehun" CTA |
| **Chat-KR** | - | 3.0 | P0·필수 | +28% DAU | 16h | W3-4 | 같음 + 자동 언어 감지 |
| **Hehun-KR** | CN ✅ | 3.1 | P1·핵심 | +¥80K/Q4 | 40h | W5-8 | Hehun 결과 하단: "Daily Luck" CTA |
| **Daily-KR** | CN ✅ | 3.1 | P1·높음 | +¥3K/mo | 28h | W7-9 | Daily 페이지 지속 구독 버튼 |
| **Livestream** | 0 | 3.2 | P2·핵심 | 5x retention | 120h | W10+ | Hehun→Live matching session |
| **Ceping-KR** | CN ✅ | 3.1 | P1·중 | 보조 수익 | 24h | W8 | Auxiliary |
| **Tarot-KR** | CN ✅ | 3.2 | P2·낮음 | -5% focus | 16h | W12 | NOT priority |

**교차 판매 흐름 (UX 개선 · 기능 발견성)**：
```
Chat page
  ├─ 사용자 질문 5-7번 후
  ├─ "💕 Your love chart awaits" (Hehun CTA)
  └─ Click → hehun.html with pre-filled params

Hehun result page
  ├─ 궁합 점수 표시
  └─ "📊 Daily Luck (Premium)" CTA
     └─ Click → daily.html 또는 paywall

Daily push notification (구독자)
  ├─ 매일 08:00 KST 푸시
  └─ "Click to renew your subscription" (VIP 续订)
```

---

### C. Hehun-KR（合婚韓國版·30年大運同期匹配）✨ NEW

#### 2.C.1 核心差异化：30年大運同期匹配（韓國獨佔）

**现状 (CN 版 Hehun)**：
- 互补指数（水火土金木）
- 五行相生相克分析
- 故事生成（"你们的故事"）
- 缺口：无长期大运对标

**Phase 3.1 改进 (KR 版 Hehun)**：
```
新增功能：30年 大運同期匹配（한국식 대운 동기화）
  
수입 데이터:
    PersonA: {bazi, gender}
    PersonB: {bazi, gender}
  
계산 로직:
    1. 각 자의 대운 6개 타임라인 추출 (10년 주기)
       → PersonA: 2026-2035 (財), 2036-2045 (官), ...
       → PersonB: 2026-2035 (感), 2036-2045 (財), ...
    
    2. 동기 구간 찾기 & 점수 계산
       구간 1 (2026-2035):
         - PersonA 십신: 財 (wealth)
         - PersonB 십신: 感 (emotion)
         - 매칭도: "상승" (最高·3점) ✓
         - 해석: "당신들의 갈증이 2026-2030 동안 절정으로..."
    
    3. 결과 리스트 (높음→낮음 점수 정렬)
       - 최적 구간 (2026-2035) 강조 표시 ✓
       - 주의 구간 (2040-2050) 주황 경고 ⚠️
       - 안정 구간 (2050 이후) 중립 정보 ℹ️

출력 형식:
    [
      {
        period: "2026-2035",
        personA_ten_god: "財",
        personB_ten_god: "感",
        match_level: 3,  // 1-3 scale
        interpretation: "당신들의 인연이 절정으로..."
      },
      ...
    ]
```

**한국 모국어 교정 재확인（Critical）** ⚠️：
- 십신 한글화: 財/感/官/鬼 → 재운/감정운/관직운/귀인운 (또는 포스텔러 기준?)
  - **필수**: Korean-native 점사 또는 포스텔러 분석팀 cross-check
  - 문서화: `/backend/docs/KR-DARIAN-MAPPING.md` 생성 필수

---

#### 2.C.2 UI/UX 개선 (기술 + UX 평가에서 지적)

**현 상태 분석**：
```
기존 hehun.html:
  ├─ 입력 폼 (남성 생년월일/시간, 여성 생년월일/시간)
  ├─ 계산 버튼 → 로딩
  └─ 결과 카드:
      ├─ 궁합 점수 (0-100)
      ├─ 五行分析 (水火土금 호환도)
      ├─ "你们的故事" (AI 생성 2-3 문단)
      └─ "원해" / "주의" 영역

문제점（UX 전문가）:
  🔴 大運 데이터가 표로만 표시 → 시각 계층 부족
     해석: "정보 과부하·사용자가 뭘 해야 하는지 모름"
  
  🔴 "당신들의 인연" 텍스트가 너무 긴 → 읽기 힘듦
     제안: 요약 (1문단) → 상세 (점화 확장)
```

**개선안**：
```html
<!-- Hehun-KR 결과 카드 · 정보 계층화 -->
<div class="result-card">
  <!-- 1. 헤더: 점수만 크게 -->
  <div class="score-big">83/100</div>
  <div class="score-label">당신들의 궁합도</div>
  
  <!-- 2. 30년 대運·2개만 강조 표시 -->
  <div class="durian-highlights">
    <div class="durian-best">
      ✓ 최적 시기: 2026-2035
      당신들의 사랑이 절정으로 피어날 시간
      <button>더보기 →</button>
    </div>
    
    <div class="durian-caution">
      ⚠️ 주의 시기: 2040-2050
      변화와 성장의 신호입니다.
      <button>더보기 →</button>
    </div>
  </div>
  
  <!-- 3. "우리의 인연" 요약 (짧게) -->
  <div class="story-summary">
    당신은 물과 불. 
    서로 다르지만 완벽한 균형을 이룹니다.
  </div>
  
  <!-- 4. 五行 호환도 (기존) -->
  <div class="element-chart">...</div>
  
  <!-- 5. CTA: Daily Luck 구독 유도 -->
  <button class="cta-daily">
    📊 Daily Luck로 매일 예측 보기
  </button>
</div>

<style>
  .durian-highlights { max-height: 200px; overflow: hidden; }
  .durian-highlights[data-expanded] { max-height: none; }
  
  .story-summary { 
    font-size: 14px; 
    line-height: 1.6;
    color: var(--ink-secondary);
  }
</style>
```

---

### D. Daily-KR（매일 천기·韓國版）

#### 2.D.1 구독 모델 & 가격

```
현 상태 (CN Daily):
  - 무료 1회/일
  - 프리미엄 무한 (¥9.9/mo 또는 ¥99/년)
  
KR 버전:
  - 무료 1회/일 (동일)
  - 프리미엄 무한 (₩12,900/mo 또는 ₩129,000/년)
    = ¥1.87/mo (환율 1KRW = 0.18CNY 기준)
    = 기존 ¥9.9의 19% 수준 (한국 시장 진입 가격)
  
참고:
    CN: 일일 구독이 높은 이유 = 신년운세 (1월) 시즈널 피크
    KR: 신년 (1월) + 추석 (9월) 2개 피크
```

#### 2.D.2 매일 天機 콘텐츠 현지화

```
구독자가 매일 8시 (KST) 받는 푸시 메시지:

구조:
  제목: "[오늘의 천기] 8월 11일"
  본문:
    🌙 당신의 오늘: [오행 에너지 상태·2-3 문장]
    💼 일: [일 운·1 문장]
    💕 사랑: [감정 운·1 문장]
    💰 돈: [재운·1 문장]
    
    ✨ 오늘의 조언: [액션 아이템·1-2 문장]
    
    [App 열기 / 구독 갱신]

Prompt 관리:
  /backend/prompts/daily-KR.md
  입력: 사용자 사주, 오늘 날짜
  출력: 위 형식의 JSON
```

---

## III. 기술 스택 · How

### 아키텍처 개요

```
Frontend (H5)
├─ /pages/chat.html (CN·기존)
├─ /pages/chat-EN.html (NEW·복사+13 개 수정)
├─ /pages/chat-KR.html (NEW·복사+13 개 수정)
│  └─ 자동 언어 감지 + 다국어 상황 전환 지원
├─ /pages/hehun.html (CN·기존)
├─ /pages/hehun-EN.html (가능·저 우선순위)
└─ /pages/hehun-KR.html (NEW·복사+20 개 수정·30년 대운 로직)

Backend (Node.js/Vercel/HK 서버)
├─ /api/chat (개선·다국어 라우팅)
│  └─ Language 매개변수 추가 + LLM Fallback
├─ /api/quota (기존·다언어 지원 확인)
├─ /api/hehun (개선·30년 대운 계산 로직 추가)
├─ /prompts/ (중앙화·신규)
│  ├─ chat-system-CN.md / EN / KR
│  ├─ hehun-story-CN / EN / KR
│  └─ daily-KR.md
├─ /i18n/ (기존·모든 언어 string 관리)
├─ /logs/ (신규·분석용 로깅)
├─ /utils/korean-bazi.js (신규·대운 계산 유틸)
└─ /cache/prompt-cache.redis (신규·Prompt 캐싱)

Database (Supabase)
├─ users (기존)
├─ chat_sessions (신규·컨텍스트 지속)
├─ chat_messages (신규·메시지 레벨 language_override)
├─ quotas (개선·다국어 추적)
├─ hehun_readings (개선·30년 대운 데이터)
└─ analytics_logs (신규·언어별 분석)
```

### 代码复用策略（重点：降低成本）

#### 1. Chat HTML 复用率表

```
Chat-EN.html vs chat.html：

공유 부분 (90%):
  ├─ .input-bar (placeholder 문안만 개정)
  ├─ .msg 버블 스타일 (완전 재용)
  ├─ .header 로고 (영문 텍스트만)
  ├─ .quick-q 버튼 로직 (완전 재용·문안만 변경)
  ├─ quota 관리 JS (완전 재용)
  ├─ 결제 벽 카드 (문안 변경)
  └─ 애니메이션 (완전 재용)

변경 부분 (10%):
  ├─ meta description (영문 SEO)
  ├─ Quick questions 5 버튼 문안 (Karen 확인 필수)
  ├─ 오류 메시지
  ├─ Prompt 선택 로직 (language="en")
  ├─ 기능 CTA 버튼 (Hehun/Daily 안내)
  └─ 자동 언어 감지 스크립트 (NEW)

파일 구성:
  /pages/
    ├─ chat.html (주 버전·CN)
    ├─ chat-EN.html (복사 + 13 개 수정)
    └─ chat-KR.html (복사 + 13 개 수정)

최적화 방안 (Phase 4):
  → 단일 파일 템플릿 + i18n JSON
  → 일 번 유지·3개 버전
  → 현재는 공수 우선
```

#### 2. Hehun-KR 복용 율표

```
hehun-KR.html vs hehun.html：

공유 부분 (85%):
  ├─ 입력 양식 로직 (완전 재용)
  ├─ 점수 원 SVG (완전 재용)
  ├─ 오행 분석 카드 (완전 재용)
  ├─ 잠금 카드/결제 벽 (문안 개정)
  ├─ 모든 애니메이션 (완전 재용)
  └─ 거품과 그래디언트 (완전 재용)

변경 부분 (15%):
  ├─ 한글 술어 → 십성/신살/용신/일간/식신 등 (필요시 교정)
  ├─ "당신들의 인연" → "당신들의 인연" (한글 본래·재작성 아님)
  ├─ 30년 대運 표시 로직 (신 알고리즘)
  │  └─ 최적/주의/안정 3개 구간 강조
  ├─ 색감 미세 조정 (한식 미학)
  └─ 결과 텍스트 생성 Prompt (한글화)

결과 텍스트 생성 Prompt (신규):
  /backend/prompts/hehun-story-KR.md
  → 입력: 남녀 사주, 궁합점수, 30년 데이터
  → 출력: 당신들의 인연 (요약 1단 + 상세 2-3단)
  → 어조: 따뜻하고 정성 (공포 X)
  → 정보 계층화: 요약 먼저·사용자가 전개 선택
```

#### 3. 다국어 Prompt 관리（중앙식）

```
/backend/prompts/
├─ README.md (유지 가이드)
├─ chat-system-CN.md (기존)
├─ chat-system-EN.md (신규)
├─ chat-system-KR.md (신규)
├─ hehun-story-CN.md (기존)
├─ hehun-story-EN.md (선택)
├─ hehun-story-KR.md (신규)
└─ daily-KR.md (신규)

로딩 로직 (Node.js·시작 시 한 번):
  // 메모리 캐싱 (Redis 또는 메모리)
  const promptCache = {};
  ['CN', 'EN', 'KR'].forEach(lang => {
    promptCache[`chat-${lang}`] = fs.readFileSync(
      `./prompts/chat-system-${lang}.md`, 'utf-8'
    );
  });
  
선택 로직 (/api/chat):
  const langTag = req.body.language || 'CN';
  const systemPrompt = promptCache[`chat-${langTag}`];
  // DeepSeek/Claude에 전달
  
성능 최적화 (기술 전문가 지적):
  - 기존: 매 요청마다 파일 읽음 (느림)
  - 개선: 시작 시 캐싱 + Redis 저장 (빠름)
  - 측정: 응답 시간 -200ms (예상)
```

### 다국어 검수 체크리스트 (40% 실패율 방지)

```
[ ] 모든 하드코딩 문자열 추출 → i18n JSON
[ ] 한글 술어 모국어 검수 완료 (비 기계 번역)
    ├─ 십신 매핑 (재/감/관/귀인 등) ← CRITICAL
    ├─ 대運 표현 (10년 주기) ← CRITICAL
    ├─ 일주 (오행 + 십간십지) ← CRITICAL
    └─ 포스텔러 결과와의 일관성 확인
[ ] 날짜/시간 형식 지역별 (2026-08-10 vs 2026.08.10 vs 26년 8월 10일)
[ ] 결제 문안 확정 (KRW vs CNY vs USD 심볼)
[ ] AI법 2026 v1.0 대비 면책 조항 법무 검수
[ ] 인명/대명사 성별 가정 제거
[ ] 색상 문화 충돌 없음 (한국: 흰색 조심)
[ ] 길이 테스트 (CJK 잘라내기·제목 <24자)
[ ] RTL 언어 예비 (미래 아랍어 버전·CSS flex-direction 확인)
[ ] 스크린샷/비디오 데모 번역 완료
```

---

## IV. 구체적 기능 규격 · Spec

### A. Chat 영문 버전 (chat-EN.html)

#### 4.A.1 페이지 구조

```html
<body>
  <button class="back-btn">← Back</button>
  <div class="header">
    <div class="logo">ShenYuan · AI BaZi</div>
    <div class="logo-sub">3000 Years of Eastern Wisdom · AI Insights</div>
  </div>
  
  <!-- NEW: 자동 언어 감지 (숨김) -->
  <script>
    const detectedLang = detectUserLanguage();
    if (detectedLang !== 'EN') {
      window.location.href = `/pages/chat-${detectedLang}.html`;
    }
  </script>
  
  <div class="quick-q" id="quickQ">
    <!-- 5 개 빠른 질문 버튼 (문안은 위에서 확인) -->
  </div>
  
  <div id="freeCounter">
    Today's readings: <span id="freeRemaining">5</span> left · Premium: Unlimited
  </div>
  
  <div class="chat-area" id="chatArea">
    <!-- 환영 메시지 -->
  </div>
  
  <div class="input-bar">
    <input id="input" placeholder="Ask about your destiny..." />
    <button id="sendBtn">➤</button>
  </div>
  
  <!-- NEW: 교차 판매 CTA (채팅 후 표시) -->
  <div id="crossSellCTA" style="display:none;">
    <hr/>
    <button onclick="navigateTo('/pages/hehun.html')">
      💕 Explore Hehun · Your 30-Year Love Timeline
    </button>
    <button onclick="navigateTo('/pages/daily.html')">
      🌙 Try Daily Luck (Premium)
    </button>
  </div>
</body>
```

#### 4.A.2 교차 판매 CTA 표시 로직 (UX 개선)

```javascript
// chat.html 공통 로직
let messageCount = 0;

function displayMessage(role, content) {
  messageCount++;
  
  // 5번 이상 대화 후 CTA 표시
  if (messageCount >= 5 && !shown) {
    document.getElementById('crossSellCTA').style.display = 'block';
    shown = true;
  }
}

// 클릭 시 다른 페이지로 이동 (상황 유지·sessionId 전달)
function navigateTo(url) {
  const params = `?session=${sessionId}&from=chat`;
  window.location.href = url + params;
}
```

#### 4.A.3 빠른 질문 버튼 (영문·Karen 확인 필수)

```
Button 1: 💰 "How's my wealth this year?"
  설명: 간단하고 직관적
  대안: "Will my finances improve in 2026?" (더 구체적)
  └─ Karen 선택 필요 (Week 1)

Button 2: 💕 "Are we compatible?"
  설명: 간결·매칭 맥락과 맞음
  대안: "Is my partner right for me?" (더 직설적)
  └─ Karen 선택 필요 (Week 1)

Button 3: 💼 "Should I change jobs?"
  설명: 경력 변화 질문
  대안: "Is it time for a career shift?" (덜 명령조)
  └─ Karen 선택 필요 (Week 1)

Button 4: 🌑 "Any obstacles ahead?"
  설명: 위험 요소 탐색
  (대안 불필요·안정적)

Button 5: ✨ "When's my peak luck coming?"
  설명: 타이밍 질문
  (대안 불필요·안정적)
```

---

### B. Hehun-KR 30년 대運 로직 규격

#### 4.B.1 데이터 구조

```javascript
// 입력
const hehunInput = {
  personA: {
    name: "Person A",
    gender: "M",
    bazi: {
      year: "甲子",
      month: "丙寅",
      day: "己丑",
      hour: "庚午"
    }
  },
  personB: {
    name: "Person B",
    gender: "F",
    bazi: {
      year: "乙丑",
      month: "丁卯",
      day: "庚寅",
      hour: "辛未"
    }
  }
};

// 출력 (30년 대運 데이터)
const output = {
  matchScore: 83,
  durianList: [
    {
      period: "2026-2035",
      personA: {
        tenGod: "財", // 십신
        lunarYear: 2026,
        duration: 10
      },
      personB: {
        tenGod: "感", // 감정운
        lunarYear: 2026,
        duration: 10
      },
      matchLevel: 3, // 1-3: 낮음/중간/최고
      interpretation: "당신들의 사랑이 절정으로 피어날 시간입니다...",
      warning: null
    },
    {
      period: "2036-2045",
      personA: { tenGod: "官", ... },
      personB: { tenGod: "財", ... },
      matchLevel: 2,
      interpretation: "안정적인 시기...",
      warning: null
    },
    // ... 총 6개 10년 주기 (최대 60년)
  ]
};
```

#### 4.B.2 알고리즘 (의사코드)

```python
def calculate_30year_durian(personA_bazi, personB_bazi):
    """
    계산: 각 사람의 30년 대運 라인업·매칭점수
    입력: 2개의 사주
    출력: 6개 10년 주기의 매칭 데이터
    """
    
    # 1단계: 각자의 대운 추출 (일주 기준)
    personA_durianList = extract_durian_from_rizu(personA_bazi.day)
    # → [(2016-2025, 火), (2026-2035, 木), (2036-2045, 水), ...]
    
    personB_durianList = extract_durian_from_rizu(personB_bazi.day)
    # → [(2016-2025, 土), (2026-2035, 感), (2036-2045, 財), ...]
    
    # 2단계: 2026년부터 30년간 6개 10년 주기 선택
    results = []
    for i in range(3, 9):  # 2026-2035부터 2081-2090까지
        periodA = personA_durianList[i]  # (year_start, tenGod)
        periodB = personB_durianList[i]
        
        # 3단계: 매칭 점수 계산 (十神 호환도)
        matchScore = calculate_match(periodA[1], periodB[1])
        # 상생: 3점, 안정: 2점, 주의: 1점
        
        # 4단계: 해석 생성 (Prompt 사용)
        interpretation = generate_story_prompt(
            periodA, periodB, matchScore
        )
        
        results.append({
            period: f"{periodA[0]}-{periodA[0]+9}",
            personA: { tenGod: periodA[1], ... },
            personB: { tenGod: periodB[1], ... },
            matchLevel: matchScore,
            interpretation: interpretation
        })
    
    return results
```

---

## V. 수입 & 재무 · Revenue

### A. Phase 3.0-3.1 예상 수익 (월별)

| 월 | Chat-EN DAU | Chat-EN CVR | Chat-KR DAU | Hehun-KR | Daily-KR | 합계 |
|---|---|---|---|---|---|---|
| M1 (8월) | +300 | 0.5% | 0 | 0 | 0 | ¥100-150K (기존) |
| M2 (9월) | +500 | 1.2% | 0 | 0 | 0 | ¥120-170K |
| M3 (10월) | +800 | 1.8% | +200 | ¥10K | ¥1K | ¥150-200K |
| M4 (11월) | +1.2K | 2.2% | +600 | ¥25K | ¥2K | ¥180-250K |
| **Q4 Peak** | +1.5K | 2.5% | +1.2K | **¥80-120K** | **¥5K** | **¥500-700K** |
| **Average** | +800 | 1.8% | +400 | ¥40K | ¥2.5K | ¥300-400K |
| **Annual** | | | | | | **¥1.2M-1.8M** |

**주요 가정**:
- EN Chat: Lumee benchmark 기반 +35% DAU
- KR Chat: +28% DAU (EN보다 낮음·신시장)
- Hehun-KR CVR: 기존 CN 데이터 적용 (조정 필요)
- Daily-KR: 구독자 증가·시간 경과에 따른 순증

### B. ROI & Payback

```
투입 비용 (Phase 3.1 전체·8주):
  ├─ 개발 (Backend/Frontend): 160h × ¥300 = ¥48K
  ├─ QA/테스트: 40h × ¥250 = ¥10K
  ├─ 한글 교정 & 모국어 검수: 30h × ¥350 = ¥10.5K
  ├─ 운영 & 모니터링: 20h × ¥300 = ¥6K
  ├─ 디자인 미세 조정: 10h × ¥400 = ¥4K
  └─ **소계**: ¥137K (보수적 추정)

예상 수익 (Phase 3.1 후 12개월):
  ├─ 월평균 ¥300-400K × 12 = ¥3.6M-4.8M
  ├─ Q4 피크 추가: ¥500-700K × 1 = ¥500-700K
  └─ **소계**: ¥4.1M-5.5M

ROI:
  (¥4.3M - ¥137K) / ¥137K = **31.4배**
  또는 간단히 **3,000%+ 수익률**

Payback Period:
  ¥137K / ¥300K 월평균 = 0.46개월 (약 2주)
```

---

## VI. 데이터 모델 · Data

### Supabase 테이블 업데이트

#### 6.A.1 chat_sessions (신규·컨텍스트 지속)

```sql
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  language TEXT DEFAULT 'CN',  -- 'CN' | 'EN' | 'KR'
  created_at TIMESTAMP DEFAULT NOW(),
  last_activity TIMESTAMP DEFAULT NOW(),
  
  -- 세션 메타
  ip_address INET,
  user_agent TEXT,
  
  UNIQUE(user_id, language)  -- 사용자당 언어별 1개 세션
);

CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_language ON chat_sessions(language);
```

#### 6.A.2 chat_messages (신규·메시지 레벨)

```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  language TEXT DEFAULT NULL,  -- NULL = 세션 언어 사용·명시면 override
  language_override TEXT DEFAULT NULL,  -- 이 메시지만 다른 언어
  
  created_at TIMESTAMP DEFAULT NOW(),
  latency_ms INT,  -- API 응답 시간
  
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
);

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_language ON chat_messages(language);
```

#### 6.A.3 quotas (개선·다국어 지원)

```sql
ALTER TABLE quotas ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'CN';
ALTER TABLE quotas ADD COLUMN IF NOT EXISTS ip_address INET;

-- 기존 UNIQUE(user_id) → 새로운 UNIQUE 제약
-- 이전 버전에서 사용자 + 언어 별로 추적
ALTER TABLE quotas ADD UNIQUE(user_id, language);

CREATE INDEX idx_quotas_language ON quotas(language);
```

#### 6.A.4 analytics_logs (신규·언어별 분석)

```sql
CREATE TABLE analytics_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  event_type TEXT,  -- 'chat_message', 'hehun_read', 'daily_subscribe'
  language TEXT,  -- 'CN' | 'EN' | 'KR'
  metadata JSONB DEFAULT '{}',  -- 추가 정보
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analytics_logs_event ON analytics_logs(event_type);
CREATE INDEX idx_analytics_logs_language ON analytics_logs(language);
CREATE INDEX idx_analytics_logs_created ON analytics_logs(created_at);
```

---

## VII. 검수 & QA · Checklist

### Phase 3.0 (Chat 영문/한글·Week 1-4)

**Frontend 검수**:
```
[ ] chat-EN.html 빌드 & 로컬 테스트
    ├─ [ ] 빠른 질문 5개 클릭 → 정상 작동
    ├─ [ ] 메시지 입력 & 전송 → API 호출 성공
    ├─ [ ] 무료 쿼터 초과 → 결제 벽 표시
    ├─ [ ] 반응형 (모바일 320px - 1920px)
    ├─ [ ] SEO meta 영문 확인 (og:title, description)
    └─ [ ] 자동 언어 감지 작동 (EN 사용자 → chat-EN.html 자동 리다이렉트)

[ ] chat-KR.html 빌드 & 로컬 테스트
    ├─ [ ] 한글 입력 감지 → KR 버전 로드
    ├─ [ ] 한글 술어 표시 정상 (십신, 대운 등)
    ├─ [ ] 한글 폰트 렌더링 OK (Noto Sans KR)
    ├─ [ ] 한글 CJK 길이 테스트 (제목 <24자·본문 <80자)
    └─ [ ] 모국어 교정자 사전 검수 완료 (CRITICAL)

[ ] 다국어 전환 테스트
    ├─ [ ] CN chat에서 EN으로 전환 가능 (링크/버튼)
    ├─ [ ] KR chat에서 CN으로 전환 가능
    ├─ [ ] 전환 시 sessionId 유지·컨텍스트 보존
    └─ [ ] localStorage 다국어 플래그 저장
```

**Backend 검수**:
```
[ ] /api/chat language 라우팅 테스트
    ├─ [ ] POST /api/chat { language: "en" } → chat-system-EN.md 사용
    ├─ [ ] POST /api/chat { language: "ko" } → chat-system-KR.md 사용
    ├─ [ ] language 미지정 → 기본값 'CN'
    └─ [ ] 오류 처리 (invalid language → 400 Bad Request)

[ ] Prompt 캐싱 테스트
    ├─ [ ] 서버 시작 시 3개 Prompt 로드 확인
    ├─ [ ] 메모리/Redis 캐시 히트율 > 99%
    └─ [ ] 응답 시간 < 1.5초 (기존 대비 개선)

[ ] Rate Limit 테스트
    ├─ [ ] 5req/min per sessionId 적용
    ├─ [ ] VPN/프록시 우회 체크 (IP 마스킹 탐지)
    └─ [ ] 오류 메시지 "Rate limit exceeded" 표시

[ ] LLM Fallback 테스트
    ├─ [ ] DeepSeek 강제 실패 → Claude 자동 재시도
    ├─ [ ] 사용자에게 지연 투명 공개 없음 (silent fallback)
    └─ [ ] 실패 로그 기록 (모니터링용)

[ ] 로깅 & 분석
    ├─ [ ] analytics_logs 테이블 기록 수 > 100/일
    ├─ [ ] 언어별 DAU 분절 쿼리 작동
    └─ [ ] Sentry 에러 추적 활성화
```

### Phase 3.1 (Hehun-KR·Week 5-9)

**30년 대運 알고리즘**:
```
[ ] 30년 대運 계산 로직 구현 완료
    ├─ [ ] 각 사람 6개 10년 주기 추출 (일주 기준)
    ├─ [ ] 십신 매칭도 계산 (1-3점)
    ├─ [ ] 해석 Prompt 생성 (hehun-story-KR.md)
    └─ [ ] 결과 JSON 구조 검증

[ ] 한국 모국어 교정 (CRITICAL 의존성)
    ├─ [ ] 십신 한글화 매핑 확정 (포스텔러 기준?)
    ├─ [ ] 대運 표현 일관성 검수
    ├─ [ ] /backend/docs/KR-DARIAN-MAPPING.md 문서화
    └─ [ ] 점사 또는 포스텔러 팀 cross-check 완료
```

**UI/UX 개선**:
```
[ ] 정보 계층화 적용
    ├─ [ ] 궁합 점수 크게 강조 (83/100)
    ├─ [ ] 30년 대運 2개 구간만 표시 (최적 + 주의)
    ├─ [ ] "우리의 인연" 요약 (1문단·짧게)
    └─ [ ] CTA 버튼 "Daily Luck 시작하기" 클릭 추적

[ ] 모바일 반응형
    ├─ [ ] 세로 모드: 30년 대運 가로 스크롤 가능
    ├─ [ ] 버튼 크기 44px 이상 (터치 가능)
    └─ [ ] 로딩 애니메이션 표시
```

---

## VIII. 운영 & 마케팅 · Go-to-Market

### 8.A.1 Launch 체크리스트 (Phase 3.0)

```
주 1 (Week 1-2):
  [ ] Karen 승인: 영문 5개 빠른 질문 문안 최종 확정
  [ ] Karen 승인: 한글 모국어 교정자 지명 (인력 확보)
  [ ] Karen 승인: 한국 지원 결제 채널 결정 (INICIS/KakaoPay)
  
주 2-3:
  [ ] Chat-EN.html 배포 (staging → production)
  [ ] 내부 테스트: 5명 이상 영문 사용자 검증
  [ ] Sentry & PostHog 모니터링 활성화
  [ ] A/B 테스트: 기존 CN 대비 EN DAU 추적
  
주 3-4:
  [ ] Chat-KR.html 배포
  [ ] 한글 모국어 검수 최종 확인
  [ ] 한국 푸시 알림 설정 (오전 8시 KST)
  
주 4:
  [ ] 데이터 정리 & 주간 리포트 (DAU, CVR, 오류율)
  [ ] Phase 3.1 착수 검토
```

### 8.A.2 마케팅 & 성장

```
진입 경로 (Chat-EN/KR):
  1. 기존 사용자 자동 제안 (알림 + LP)
     → "새로운 영문/한글 채팅 시작하기"
  
  2. 구글 광고 (영문 시장 + 한국 시장)
     → "AI BaZi Reading · Chat with Ancient Wisdom"
  
  3. KOL 협업 (한국)
     → TikTok/유튜브 창작자 & 점술가 (무료 코드)
  
  4. 소셜 미디어 (구성 팀)
     → Twitter: "ShenYuan now speaks English/Korean"
     → TikTok: 짧은 테스트 영상 (자동 언어 감지)

교차 판매:
  Chat → Hehun (5번 대화 후)
  Hehun → Daily (결과 하단)
```

---

## IX. 위험 관리 · Risks

| # | 위험 | 영향 | 확률 | 완화 전략 |
|---|---|---|---|---|
| 1 | 한글 술어 오류 (CRITICAL) | 결과 신뢰도 -50% | 높음 | 한국 모국어 + 점사 교정 (Week 1 지명) |
| 2 | DeepSeek API 장애 | 서비스 중단 | 중간 | Claude fallback + 모니터링 알림 |
| 3 | 대運 알고리즘 검증 부족 | 오류 점수 표시 | 중간 | 포스텔러 cross-check + QA 50회 테스트 |
| 4 | 기능 발견성 낮음 | 교차 판매 실패 | 중간 | CTA 버튼 + 푸시 알림 A/B 테스트 |
| 5 | 성능 회귀 (Prompt 캐싱 미적용) | 응답 +500ms | 낮음 | Redis 캐시 의무 검수 |
| 6 | 한국 결제 채널 지연 | 수익 +2주 미연 | 낮음 | 미리 신청·테스트 환경 준비 |

---

## X. 용어 정의 · Glossary

### 중요 술어 (다국어 매핑)

| 중문 | English | 한국어 | 정의 |
|---|---|---|---|
| 十干 | Heavenly Stems | 천간 | 갑을병정무기경신임계 (10개) |
| 十支 | Earthly Branches | 지지 | 자축인묘진사오미신유술해 (12개) |
| 十神 | Ten Gods | 십신 | 비인상관편재정재편官정官偏杀正杀 등 10가지 역할 |
| 大運 | 10-Year Luck Cycle | 대운 | 10년 단위의 행운 주기 (사람마다 다름) |
| 五行 | Five Elements | 오행 | 목화토금수 (5개 원소) |
| 用神 | Useful God | 용신 | 명운을 돕는 에너지 |
| 喜神 | Favorable Star | 희신 | 길하고 도움이 되는 별 |
| 忌神 | Disfavorable Star | 기신 | 흉하고 방해하는 별 |

---

## XI. 승인 및 실행 계획 · Sign-off

### Karen 최종 확인 항목 (Week 1 前)

- [ ] **Q1-3: 영문 빠른 질문 문안** (최종 선택·Tone)
- [ ] **한글 모국어 교정자 지명** (인력 확보)
- [ ] **한국 결제 채널** (INICIS/KakaoPay 선택)
- [ ] **30년 대運 알고리즘** (포스텔러 기준 승인)
- [ ] **마케팅 예산** (Google Ads KR + KOL 협업)

### 프로젝트 승인 경로

1. ✅ **제품·기술·UX 삼각 평가** (0811 완료)
2. ⏳ **Karen 최종 의사결정** (상기 5 항목)
3. ⏳ **착수 회의** (팀 전체·Week 1 월요일)
4. ⏳ **Phase 3.0 개발** (8주·병렬 진행)
5. ⏳ **배포 & 런칭** (Week 4 chat-EN·Week 8 chat-KR)

---

**최종 평가**: 8.2/10 (실행 가능·위험 제어·수익 명확)  
**다음 단계**: Karen 의사 결정 대기 (5개 항목)  
**문서 완성도**: 100% (PRD + 구현 + 재무 + 체크리스트 완비)
