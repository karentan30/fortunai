# Phase 3 实施指南（0810·工程师专用）

**目的**：快速参考 PRD→代码映射  
**对象**：前端工程师 + 后端工程师 + DevOps

---

## 一、前端实施清单

### A. Chat 英文版 (chat-EN.html) - Week 2-3

#### 步骤 1：文件创建与基础 (15 min)
```bash
cd /Users/karen/projects/shenyuan/pages/
cp chat.html chat-EN.html
```

#### 步骤 2：13 处核心改动
```html
<!-- 改动 1: <html lang> -->
<html lang="en">  <!-- 之前: zh-CN -->

<!-- 改动 2: <meta description> -->
<meta name="description" content="ShenYuan · AI BaZi Chat. Consult your destiny with AI-powered Four Pillars readings. For entertainment and self-reflection.">

<!-- 改动 3: <title> -->
<title>ShenYuan · AI BaZi Chat · Mystical Wisdom</title>

<!-- 改动 4: back-btn 文案 -->
<button class="back-btn">← Back</button>

<!-- 改动 5: header logo -->
<div class="logo">ShenYuan · AI BaZi</div>
<div class="logo-sub">3000 Years of Eastern Wisdom · AI Insights</div>

<!-- 改动 6: quick-q 按钮 (5 个) -->
<button class="qq-btn" onclick="ask('How is my wealth outlook for this year?')">
  💰 Wealth this year
</button>
<button class="qq-btn" onclick="ask('Is my partner and I compatible based on our BaZi?')">
  💕 Compatibility
</button>
<button class="qq-btn" onclick="ask('Should I make a career change right now?')">
  💼 Career change
</button>
<button class="qq-btn" onclick="ask('Are there any obstacles or challenges in my near future?')">
  🌑 Obstacles ahead
</button>
<button class="qq-btn" onclick="ask('When will my luck peak this year?')">
  ✨ Peak luck timing
</button>

<!-- 改动 7: freeCounter 文案 -->
<div id="freeCounter">Today's readings: <span id="freeRemaining">5</span> left · Premium: Unlimited</div>

<!-- 改动 8: welcome AI 消息 -->
<!-- 在 JS 里改，见下文 -->

<!-- 改动 9: input placeholder -->
<input id="input" placeholder="Ask about your destiny...">

<!-- 改动 10: paywall card 文案 (见下文 JS 改) -->

<!-- 改动 11: member.html 链接 -->
<a href="member.html?lang=en">...</a>

<!-- 改动 12: 错误提示文案 (见下文 JS) -->

<!-- 改动 13: 支付说明 + disclaimer (见下文 JS) -->
```

#### 步骤 3：JavaScript 改动 (30 min)
```javascript
// 改动: AI 消息
var welcomeMsg = '✦ ShenYuan AI Guide · AI-Generated\n\n' +
  'Hello, I\'m your BaZi guide. Share your birth date and time, ' +
  'and I\'ll offer insights into your destiny, luck cycles, and what ' +
  'the stars reveal about your path. Feel free to ask about wealth, ' +
  'love, career, or anything else your heart wonders. ☯️';

// 改动: addMsg 函数中 AI role 标签
div.innerHTML = '<div class="role">✦ AI BaZi Guide · AI-Generated</div>' + 
  text.replace(/\n/g, '<br>');

// 改动: paywall card 文案
var div = document.createElement('div');
div.innerHTML = '<div style="font-size:24px;margin-bottom:8px">👑</div>' +
  '<div style="font-size:14px;color:var(--ink);margin-bottom:4px;letter-spacing:0.08em">Your free readings are used up</div>' +
  '<div style="font-size:11px;color:var(--sub);margin-bottom:12px;line-height:1.7">' +
    'Upgrade to Premium for unlimited chat, plus full reports for all features.' +
  '</div>' +
  '<a href="member.html?lang=en" style="...">Premium Membership · $6.90/month</a>' +
  '<div style="margin-top:10px;font-size:10px;color:var(--sub)">' +
    'or <a href="bazi-en.html" style="color:var(--jade)">Get your free BaZi chart</a>' +
  '</div>';

// 改动: 错误提示
addMsg('AI is temporarily unavailable. Please try again later.', 'ai');

// 改动: API 调用中添加 language 字段
fetch('/api/chat', {
  method: 'POST',
  headers: {'Content-Type': 'application/json', 'X-Session-Id': _sessionId},
  body: JSON.stringify({
    messages: msgsToSend,
    language: 'en'  // ← NEW
  })
})

// 改动: 支付墙生成位置的文案改英文
document.getElementById('input').placeholder = 'Upgrade to continue chatting';
```

#### 步骤 4: SEO meta 优化
```html
<!-- 在 <head> 中补充 -->
<meta name="robots" content="index, follow">
<link rel="alternate" hreflang="zh" href="https://shenyuan.mylumee.cn/pages/chat.html">
<link rel="alternate" hreflang="en" href="https://shenyuan.mylumee.cn/pages/chat-EN.html">
<link rel="alternate" hreflang="ko" href="https://shenyuan.mylumee.cn/pages/chat-KR.html">
<meta property="og:title" content="ShenYuan · AI BaZi Chat">
<meta property="og:description" content="Consult your destiny with AI-powered Four Pillars readings">
<meta property="og:url" content="https://shenyuan.mylumee.cn/pages/chat-EN.html">
<meta name="twitter:title" content="ShenYuan · AI BaZi Chat · Mystical Wisdom">
```

#### 步骤 5: QA 检查表 (Week 3)
- [ ] 所有英文文案无中文字符
- [ ] 按钮文案 < 24 char
- [ ] Mobile responsive (< 390px width)
- [ ] 支付链接指向正确的 lang param
- [ ] 加载速度 < 2s
- [ ] 无 console errors
- [ ] Quota 计数正确
- [ ] 支付墙出现时机正确 (free quota=0)

---

### B. Chat 韩文版 (chat-KR.html) - Week 3-4

#### 快速实施（复用 EN 版本）
```bash
cp chat-EN.html chat-KR.html
```

#### 13 处韩文改动
```html
<!-- 改动 1: <html lang> -->
<html lang="ko">

<!-- 改动 2: meta description -->
<meta name="description" content="선연 · AI 사주 채팅. AI 기반 사주(四柱) 상담으로 당신의 운명을 읽어보세요. 오락 및 자기발전용입니다.">

<!-- 改动 3: <title> -->
<title>선연 · AI 사주 채팅</title>

<!-- 改动 4-7: 按钮文案 -->
<button class="back-btn">← 돌아가기</button>
<div class="logo">선연 · AI 사주</div>
<div class="logo-sub">3천년 동양지혜 · AI 상담</div>

<!-- 改动 8: quick-q 按钮 (5个) -->
<button class="qq-btn" onclick="ask('올해 저의 재운은 어떻게 될까요?')">
  💰 올해 재운
</button>
<button class="qq-btn" onclick="ask('저와 그들은 잘 맞을까요?')">
  💕 궁합 확인
</button>
<button class="qq-btn" onclick="ask('지금 직장을 바꿔야 할까요?')">
  💼 이직 판단
</button>
<button class="qq-btn" onclick="ask('최근에 방해요소가 있나요?')">
  🌑 방해 요소
</button>
<button class="qq-btn" onclick="ask('제 인생에서 언제 좋은 운이 올까요?')">
  ✨ 행운 시점
</button>

<!-- 改动 9: freeCounter -->
<div id="freeCounter">오늘 무료 상담: <span id="freeRemaining">5</span>회 남음 · 프리미엄: 무한</div>

<!-- 改动 10: placeholder -->
<input id="input" placeholder="당신의 운명에 대해 물어보세요...">

<!-- 改动 11-13: JS 中改 paywall + AI 消息 + error msg -->
```

#### JavaScript 한글 개역
```javascript
// AI welcome 메시지
var welcomeMsg = '✦ 선연 AI 상담가 · AI생성\n\n' +
  '안녕하세요, 저는 당신의 사주 상담가입니다. 생년월일시를 알려주시면, ' +
  '당신의 운명·대운·앞으로의 길을 읽어드립니다. 재운, 애정, 직업, ' +
  '혹은 마음속 질문이라면 무엇이든 물어봐주세요. ☯️';

// AI role 태그
'<div class="role">✦ 선연 AI 상담가 · AI생성</div>'

// paywall 카드
'<div style="font-size:24px;margin-bottom:8px">👑</div>' +
'<div style="font-size:14px;color:var(--ink);letter-spacing:0.08em;">오늘 무료 상담 종료</div>' +
'<div style="font-size:11px;color:var(--sub);line-height:1.7;margin-bottom:12px">' +
  '프리미엄으로 업그레이드하시면 무한 상담과 모든 기능의 전체 보고서를 이용하실 수 있습니다.' +
'</div>' +
'<a href="member.html?lang=ko" style="...">프리미엄 멤버십 · ₩34,900/월</a>'

// error 메시지
'AI가 일시적으로 작동하지 않습니다. 잠시 후 다시 시도해주세요.'

// API 호출
language: 'ko'
```

#### SEO hreflang 추가
```html
<link rel="alternate" hreflang="ko" href="https://shenyuan.mylumee.cn/pages/chat-KR.html">
```

---

### C. Hehun 韩文版 (hehun-KR.html) - Week 5-7

#### 步骤 1: 文件创建
```bash
cp /Users/karen/projects/shenyuan/pages/hehun.html hehun-KR.html
```

#### 步骤 2: 术语替换（关键·影响内容生成）
```
替换表：

CN术语         → KR术语
────────────────────────────
合婚           → 궁합 / 궁합 분석
五行互补       → 오행 보완
性格匹配       → 성격 매칭
你们的故事     → 당신들의 인연
五行分析       → 오행 분석
最佳结婚年份   → 최고의 결혼 해
十神           → 십신 (비인상관 등)
大运           → 대운
宜            → 길한 해 / 적기
忌            → 주의 해
```

#### 步骤 3: 页面结构改动
```html
<!-- 改动 1: <html lang> -->
<html lang="ko">

<!-- 改动 2: header title -->
<div class="header-title">당신들의 인연</div>
<div class="header-sub">SAJU COMPATIBILITY</div>

<!-- 改动 3: person labels -->
<div class="person-label">당신</div>  <!-- Person A -->
<div class="person-label">그들</div>  <!-- Person B -->

<!-- 改动 4: gender options -->
<div class="g-opt sel" data-gender="F">여성</div>
<div class="g-opt" data-gender="M">남성</div>

<!-- 改动 5: select options (year/month/day/hour) -->
<option>태어난 년</option>
<option value="1990">1990</option>
...
<option>월</option>
<option value="1">1월</option>
...
<!-- hour: 시간 (모르면 정오 선택) -->

<!-- 改动 6: 로딩 텍스트 -->
<div class="load-txt">당신들의 인연을 분석 중입니다...</div>

<!-- 改动 7: 결과 타이틀 -->
<div class="score-lbl">궁합 점수</div>

<!-- 改动 8: 당신들의 故事 section -->
<div class="story-section">
  <div style="font-size:11px;color:var(--sub);margin-bottom:6px;letter-spacing:0.1em">
    당신들의 인연
  </div>
  <!-- 내용은 JS에서 생성 -->
</div>

<!-- 改动 9: 五行分析 -->
<div class="wuxing-section">
  <div class="dims-label">오행 분석</div>
  <!-- ... -->
</div>

<!-- 改动 10: 30년 대운 section (NEW) -->
<div class="year-section">
  <div class="year-head">
    <span class="year-icon">📅</span>
    <span class="year-title">향후 30년 대운</span>
  </div>
  <div id="durianChart" style="...">
    <!-- 30년 대운 매칭 카드 -->
  </div>
</div>

<!-- 改动 11: 锁定卡 -->
<div class="locked-card">
  <div class="lock-title">당신들의 미래 30년</div>
  <button class="lock-btn">프리미엄 열기</button>
  <button class="lock-share-btn">친구와 공유</button>
</div>

<!-- 改动 12: sticky CTA -->
<div class="sticky-bar">
  <button class="sticky-cta" onclick="window.location='/member.html?lang=ko'">
    프리미엄 궁합 분석 · ₩128,000
  </button>
</div>

<!-- 改动 13: meta + SEO -->
```

#### 步骤 4: JavaScript 로직 변경
```javascript
// 도움 함수: 당신들의 故事 생성
async function generateStory(personA, personB, score) {
  const prompt = `
당신은 따뜻한 사주 상담가입니다.
다음 정보에 기반해 2-3 문단의 "당신들의 인연" 이야기를 작성하세요.

Person A (${personA.name}): ${personA.saju} (${personA.gender})
Person B (${personB.name}): ${personB.saju} (${personB.gender})
Compatibility Score: ${score}

톤: 따뜻하고 희망적. 공포감 X. 자기발견 유도.
`;
  
  // DeepSeek API 호출
  const response = await fetch('/api/generate', {
    method: 'POST',
    body: JSON.stringify({
      prompt: prompt,
      language: 'ko'
    })
  });
  return response.json();
}

// 30년 대운 매칭 로직
function render30YearDurian(personA, personB) {
  const durians = calculateDurian(personA, personB);
  // durians = [
  //   {period: "2026-2030", personA: "財 (wealth)", personB: "感 (emotion)", match: "好"},
  //   {period: "2031-2035", personA: "感", personB: "財", match: "주의"}
  // ]
  
  let html = `
    <table style="width:100%; border-collapse: collapse; font-size:11px;">
      <tr>
        <th style="border-bottom:1px solid var(--jade);">기간</th>
        <th style="border-bottom:1px solid var(--jade);">${personA.name}의 운</th>
        <th style="border-bottom:1px solid var(--jade);">${personB.name}의 운</th>
        <th style="border-bottom:1px solid var(--jade);">교집합</th>
      </tr>
  `;
  
  durians.forEach(d => {
    html += `
      <tr style="border-bottom:1px solid rgba(201,96,122,0.08);">
        <td style="padding:8px;">${d.period}</td>
        <td style="padding:8px; color:var(--jade);">${d.personA}</td>
        <td style="padding:8px; color:var(--rose);">${d.personB}</td>
        <td style="padding:8px; font-weight:500;">${d.match}</td>
      </tr>
    `;
  });
  
  html += '</table>';
  document.getElementById('durianChart').innerHTML = html;
}

// 버튼 클릭 핸들러
document.getElementById('calcBtn').addEventListener('click', async function() {
  const personA = {
    name: document.getElementById('personA-name').value || '당신',
    year: document.getElementById('personA-year').value,
    month: document.getElementById('personA-month').value,
    day: document.getElementById('personA-day').value,
    hour: document.getElementById('personA-hour').value,
    gender: document.querySelector('.person-a .g-opt.sel').dataset.gender
  };
  
  const personB = { /* 동일 */ };
  
  // 계산 & 렌더링
  const score = calculateHehun(personA, personB);
  const story = await generateStory(personA, personB, score);
  render30YearDurian(personA, personB);
  
  document.getElementById('results').classList.add('show');
});
```

#### 步骤 5: 30년 대운 계산 알고리즘 (신규)
```javascript
function calculateDurian(personA, personB) {
  // 각 사람의 대운 (10년 단위) 계산
  const durianA = calculatePersonDurian(personA);
  const durianB = calculatePersonDurian(personB);
  
  const results = [];
  for (let i = 0; i < 3; i++) { // 30년 = 3개 구간
    const period = `${2026 + i*10}-${2035 + i*10}`;
    const da = durianA[i];
    const db = durianB[i];
    
    // 오행 상생/상극 판단
    const match = isMutuallyAuspicious(da.element, db.element) 
      ? '相生 (최고)' 
      : isNeutral(da.element, db.element)
        ? '안정'
        : '주의 필요';
    
    results.push({
      period: period,
      personA: da.ten_god, // 십신: 財/感/官 등
      personB: db.ten_god,
      match: match
    });
  }
  
  return results;
}

function calculatePersonDurian(person) {
  // person = {year, month, day, hour}
  // 기존 사주 엔진 재사용
  const saju = calculateSaju(person.year, person.month, person.day, person.hour);
  
  // 대운 계산 (복잡도 높음·기존 로직 참고)
  return getDurianCycles(saju);
}
```

#### QA 체크리스트 (Week 7)
- [ ] 한글 술어 정확성 (십신, 신살 등)
- [ ] 30년 대운 매칭 정확도 (포스텔러와 cross-check)
- [ ] "당신들의 인연" 스토리 생성 후 렌더링
- [ ] 색상 정감 (한국식 고전미)
- [ ] 모바일 responsive
- [ ] 결제 링크 (₩128,000 프리미엄 unlock)

---

### D. Daily 韩文版 (daily-KR.html) - Week 7-9

#### 快速实施（复用 daily.html）
```bash
cp /Users/karen/projects/shenyuan/pages/daily.html daily-KR.html
```

#### 주요 개역 포인트
```html
<!-- 改动 1: lang -->
<html lang="ko">

<!-- 改动 2: 날짜 표시 -->
<div class="date-en">AUGUST 10, 2026</div>  <!-- 유지 -->
<div class="date-zh">癸卯月 甲申日</div>     <!-- 한글 추가 -->
<div class="date-ganzhi">癸卯 甲申</div>

→ 한글 추가:
<div style="font-size:14px;color:var(--ink-mid);letter-spacing:0.1em;margin-top:6px;">
  계묘월 갑신일
</div>

<!-- 改动 3: 오늘의 오행 에너지 -->
<div class="energy-section">
  <div class="dims-label">오늘의 오행 에너지</div>
  <div class="energy-grid">
    <div class="energy-item">
      <div class="energy-emoji">🔴</div>
      <div class="energy-name">火 (열정)</div>
      <div class="energy-level">약함</div>
    </div>
    <!-- ... 土, 水, 木, 金 -->
  </div>
</div>

<!-- 改动 4: 황력 宜忌 -->
<div class="lunar-section">
  <div class="lunar-item">
    <div class="lunar-label">길한 일 (宜)</div>
    <div class="lunar-value">이사, 개업, 상담</div>
  </div>
  <div class="lunar-item">
    <div class="lunar-label">피할 일 (忌)</div>
    <div class="lunar-value">소송, 결혼, 이별</div>
  </div>
</div>

<!-- 改动 5: 구독 버튼 -->
<button style="..." onclick="subscribeDaily()">
  매일 아침 천기 받기 · ₩12,900/월
</button>

<!-- 改动 6: disclaimer -->
<div style="font-size:10px;color:var(--ink-light);text-align:center;">
  오락/참고용입니다. 중대 결정은 전문가와 상담하세요.
</div>
```

#### JavaScript 로직 추가
```javascript
// 일일 데이터 가져오기
async function getDailyData() {
  const today = new Date();
  const ganzhi = lunarCalendar.getGanzhi(today);
  
  // 오행 분석
  const elements = analyzeElements(ganzhi);
  
  // 황력 宜忌
  const auspicious = getShinYi(ganzhi); // {auspicious: [...], inauspicious: [...]}
  
  // 행운의 색
  const luckyColor = getLuckyColor(ganzhi);
  
  // 행운의 방향
  const luckyDirection = getLuckyDirection(ganzhi);
  
  return {
    date: today,
    ganzhi: ganzhi,
    elements: elements,
    auspicious: auspicious.auspicious,
    inauspicious: auspicious.inauspicious,
    luckyColor: luckyColor,
    luckyDirection: luckyDirection
  };
}

// 구독 버튼
function subscribeDaily() {
  if (!isLoggedIn()) {
    window.location = '/pages/login.html?lang=ko&redirect=daily-KR.html';
    return;
  }
  
  // 결제 페이지로
  window.location = '/member.html?lang=ko&product=daily';
}

// Push notification 발송 (매일 아침 8시)
// 이는 백엔드에서 처리 (cron job)
```

#### 백엔드: 일일 푸시 스케줄러 (新)
```javascript
// /backend/cron/daily-notification.js

const cron = require('node-cron');

cron.schedule('0 8 * * *', async () => {
  // 매일 아침 8시 (UTC+9)
  
  const subscribers = await db.query(
    'SELECT id, email, language FROM users WHERE daily_subscribed = true'
  );
  
  subscribers.forEach(async (user) => {
    const today = new Date();
    const ganzhi = lunarCalendar.getGanzhi(today);
    const elements = analyzeElements(ganzhi);
    
    // 타이틀 생성
    const title = user.language === 'ko' 
      ? `선연 · 오늘의 천기`
      : `ShenYuan · Daily Fortune`;
    
    // 메시지 생성
    const message = user.language === 'ko'
      ? `당신의 오늘은 ${elements[0].name}의 날입니다. → 오늘의 운세 보기`
      : `Your day is governed by ${elements[0].name}. → View today`;
    
    // Firebase Cloud Messaging 발송
    await sendPushNotification(user, {
      title: title,
      body: message,
      data: {
        link: `/pages/daily-${user.language === 'ko' ? 'KR' : 'en'}.html`
      }
    });
  });
});
```

---

## 二、后端实施清单

### A. `/api/chat` 다국어 라우팅 (Week 2)

#### 파일: `/backend/api/chat.js`
```javascript
const express = require('express');
const router = express.Router();
const { callDeepSeek, callClaude } = require('../services/llm');
const { checkQuota, deductQuota } = require('../services/quota');
const fs = require('fs');
const path = require('path');

// 프롬프트 로드 (시작 시)
const prompts = {};
['CN', 'EN', 'KR'].forEach(lang => {
  prompts[`chat-${lang}`] = fs.readFileSync(
    path.join(__dirname, `../prompts/chat-system-${lang}.md`),
    'utf-8'
  );
});

router.post('/chat', async (req, res) => {
  const { messages, language = 'CN', userId, sessionId } = req.body;
  
  if (!sessionId || !messages || messages.length === 0) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  
  const langTag = ['CN', 'EN', 'KR'].includes(language) ? language : 'CN';
  
  try {
    // 1. Quota 체크
    const quota = await checkQuota(userId, sessionId, langTag);
    if (quota.remaining <= 0 && !quota.is_member) {
      return res.status(200).json({
        limited: true,
        remaining: 0,
        language: langTag
      });
    }
    
    // 2. 시스템 프롬프트 선택
    const systemPrompt = prompts[`chat-${langTag}`];
    
    // 3. LLM 호출 (DeepSeek 추천·비용)
    const response = await callDeepSeek({
      messages: messages,
      system: systemPrompt,
      max_tokens: 500,
      temperature: 0.7
    });
    
    const answer = response.choices[0].message.content;
    
    // 4. Quota 차감 (회원이 아닐 경우)
    if (!quota.is_member) {
      await deductQuota(userId, sessionId, langTag);
    }
    
    // 5. 로그 기록
    await logAnalytics({
      event_type: 'chat_send',
      language: langTag,
      feature: `chat_${langTag.toLowerCase()}`,
      latency_ms: response.latency,
      success: true,
      user_id: userId,
      session_id: sessionId
    });
    
    return res.status(200).json({
      answer: answer,
      limited: false,
      remaining: quota.is_member ? -1 : quota.remaining - 1,
      language: langTag
    });
    
  } catch (error) {
    console.error('Chat API error:', error);
    
    await logAnalytics({
      event_type: 'chat_send',
      language: langTag,
      feature: `chat_${langTag.toLowerCase()}`,
      success: false,
      error: error.message,
      user_id: userId,
      session_id: sessionId
    });
    
    return res.status(500).json({
      error: 'AI service temporarily unavailable',
      language: langTag
    });
  }
});

module.exports = router;
```

#### 파일: `/backend/services/quota.js`
```javascript
const db = require('../db/supabase');

async function checkQuota(userId, sessionId, language) {
  // 동시성 체크 (IP + sessionId + userId)
  
  const { data, error } = await db
    .from('quotas')
    .select('*')
    .or(`session_id.eq.${sessionId}, user_id.eq.${userId}`)
    .single();
  
  if (data && data.is_member) {
    return { remaining: -1, is_member: true };
  }
  
  if (data && data.last_reset >= today()) {
    // 같은 날
    return {
      remaining: data.daily_quota - data.used_today,
      is_member: false
    };
  }
  
  // 새 날: 리셋
  return {
    remaining: 5, // 기본값
    is_member: false
  };
}

async function deductQuota(userId, sessionId, language) {
  // used_today 증가
  const { error } = await db.rpc('deduct_quota_safe', {
    p_user_id: userId,
    p_session_id: sessionId
  });
  
  if (error) throw error;
}

module.exports = { checkQuota, deductQuota };
```

---

### B. Prompt 파일 생성 (Week 1)

#### 파일: `/backend/prompts/chat-system-EN.md`
```markdown
# System Prompt for English BaZi Chat

You are ShenYuan, a mystical yet grounded BaZi guide.
You have deep knowledge of classical Chinese astrology 
(Four Pillars of Destiny), Taoism, and elemental wisdom.

## User's BaZi Chart
User's birth information:
  - Hour: [Heavenly Stem] [Earthly Branch]
  - Day: [Heavenly Stem] [Earthly Branch]
  - Month: [Heavenly Stem] [Earthly Branch]
  - Year: [Heavenly Stem] [Earthly Branch]
  - Hidden Stems: [list]
  - Dominant Elements: [list]
  - Ten Gods: [list]

## Your Response Structure

1. **Direct Answer** (Confidence + Specificity)
   - Do NOT say "consult a master" or hedge
   - Give concrete timing: "By April", "Next 2 years"

2. **Why** (Astrological Reasoning)
   - Cite Heavenly Stem compatibility, Element cycles, 大运
   - Example: "Wood Element is declining until 2029..."

3. **Timing** (Specific, not vague)
   - Use months/years, never "soon"
   - Peak period + caution period

4. **Nuance** (Risk ↔ Opportunity)
   - Never pure prophecy
   - Show both sides: "Wealth peak in 2027, but watch for overspending in Q3"

5. **Reflection** (Not Prediction)
   - End: "Use this as reflection to guide your choices."

## Tone
- Mystical yet rational (not New Age fluff)
- Warm, conversational (not clinical)
- Honest about limitations (not guru-ish)
- Empowering, not deterministic

## Disclaimer
Always append at end:
"🔮 This reading is for self-reflection and entertainment. 
For major life decisions, consult professionals."

---
```

#### 파일: `/backend/prompts/chat-system-KR.md`
```markdown
# 한국어 사주 채팅 System Prompt

당신은 선연(善緣)의 따뜻한 사주 상담가입니다.
3천년의 한국 전통 운명학(사주·동양학)에 정통하며,
고객의 인생을 응원하는 마음으로 상담합니다.

## 고객의 사주팔자
  - 시주: [천간] [지지]
  - 일주: [천간] [지지] (가장 중요)
  - 월주: [천간] [지지]
  - 년주: [천간] [지지]
  - 장간(숨은 오행): [list]
  - 주요 오행: [list]
  - 십신: [list]

## 답변 구조

1. **직답** (명확함·자신감)
   - "전문가에게 물어보세요" 절대 금지
   - 구체적 시점: "내년 4월", "향후 2년"

2. **이유** (오행·십신·대운 인용)
   - "일주는 계수(癸水)로, 금(金) 오행의 생을 받으며..."

3. **시점** (월/년 구체명시)
   - 모호함 X → "2027년 春"

4. **균형잡힌 관점** (기회 ↔ 주의)
   - "재운이 좋으나, 3분기는 지출 주의"

5. **자기반성** (예측 X)
   - "이를 자신의 삶을 반영하는 거울로 삼으세요."

## 어조
- 따뜻하고 응원하는 (정성·jeong)
- 희망적이나 현실적 (공포감 X)
- MZ세대 자기발견 유도
- 존댓말·친근함

## 면책 (2026 AI법 준수)
항상 끝에:
"🔮 본 상담은 자기발전과 오락을 위한 것입니다.
 중대 결정은 전문가와 상담하시기 바랍니다."

---
```

#### 파일: `/backend/prompts/hehun-story-KR.md`
```markdown
# 한국 궁합 스토리 생성 Prompt

입력: 남녀 생년월일시, 궁합점수

당신은 따뜻한 사주 상담가입니다.
다음 정보에 기반해 2-3 문단의 "당신들의 인연" 이야기를 작성하세요.

Person A (이름): [사주정보] (성별)
Person B (이름): [사주정보] (성별)
Compatibility Score: [점수/100]

요청사항:
1. 첫 문단: 오행 상호작용을 감성적으로 설명
   - 예: "당신의 따뜻한 불꽃과 그들의 부드러운 물이..."
   - 기술적 용어는 숨기기

2. 둘째 문단: 십신 역할·시너지
   - 예: "당신은 그들에게 안정을, 그들은 당신에게 유연함을..."

3. 셋째 문단: 앞으로의 희망
   - 긍정적이나 현실적
   - "어려움이 있어도 서로 바라보는 마음이 있다면..."

톤: 따뜻함·희망감·자기발견 유도
길이: 2-3 문단 (총 150-200자)

---
```

---

### C. 데이터베이스 마이그레이션 (Week 1)

#### SQL: `/backend/migrations/001_add_phase3_tables.sql`
```sql
-- chat_sessions 테이블
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  language VARCHAR(2) DEFAULT 'CN',
  messages JSONB DEFAULT '[]'::jsonb,
  quota_used INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP DEFAULT NOW(),
  metadata JSONB,
  
  INDEX idx_session_id (session_id),
  INDEX idx_user_id (user_id),
  INDEX idx_language (language)
);

-- quotas 테이블 (다국어)
CREATE TABLE IF NOT EXISTS quotas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id VARCHAR(255),
  language VARCHAR(2) DEFAULT 'CN',
  daily_quota INT DEFAULT 5,
  used_today INT DEFAULT 0,
  last_reset TIMESTAMP DEFAULT NOW(),
  is_member BOOLEAN DEFAULT FALSE,
  
  UNIQUE (user_id, language),
  INDEX idx_session_id (session_id)
);

-- analytics_logs 테이블
CREATE TABLE IF NOT EXISTS analytics_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(50),
  language VARCHAR(2),
  country VARCHAR(2),
  feature VARCHAR(50),
  latency_ms INT,
  success BOOLEAN,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  user_id UUID,
  session_id VARCHAR(255),
  metadata JSONB,
  
  INDEX idx_event_type (event_type),
  INDEX idx_language (language),
  INDEX idx_created_at (created_at),
  INDEX idx_feature (feature)
);

-- RPC: deduct_quota_safe (동시성 처리)
CREATE OR REPLACE FUNCTION deduct_quota_safe(
  p_user_id UUID,
  p_session_id VARCHAR
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE quotas
  SET used_today = used_today + 1,
      last_reset = NOW()
  WHERE (user_id = p_user_id OR session_id = p_session_id)
    AND last_reset >= CURRENT_DATE
    AND used_today < daily_quota;
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Index for performance
CREATE INDEX idx_quotas_last_reset ON quotas(last_reset);
```

#### 실행 방법
```bash
cd /Users/karen/projects/shenyuan
supabase migration new add_phase3_tables

# Edit migration file
supabase db push

# 또는 로컬 개발 시
supabase start
psql postgres://[connection-string] < ./backend/migrations/001_add_phase3_tables.sql
```

---

## 三、DevOps & 배포 체크리스트

### 배포 전 (Week 10)
```
[ ] 환경 변수 확인
    DEEPSEEK_API_KEY=...
    CLAUDE_API_KEY=...
    SUPABASE_URL=...
    
[ ] DB 마이그레이션 적용 (production)
    supabase db push --linked
    
[ ] Vercel 배포
    git add pages/chat-EN.html pages/chat-KR.html pages/hehun-KR.html
    git add pages/daily-KR.html backend/api/chat.js backend/prompts/*
    git commit -m "Phase 3.0: Multi-language chat system"
    git push
    
[ ] 프로덕션 테스트
    curl -X POST https://shenyuan.mylumee.cn/api/chat \
      -H "Content-Type: application/json" \
      -d '{
        "messages": [{"role":"user","content":"What is my wealth?"}],
        "language": "en",
        "sessionId": "test-session"
      }'
    
[ ] 모니터링 설정 (Sentry)
    - Chat errors by language
    - Quota API latency
    - LLM response time
    
[ ] Alert 설정 (PagerDuty/Slack)
    - Chat API availability < 99%
    - Error rate > 0.5%
    - Quota check failure spike
```

### 롤백 계획 (문제 발생 시)
```bash
# 빠른 롤백 (이전 버전으로)
git revert HEAD
git push

# Supabase 롤백 (마지막 스냅샷)
supabase db push --linked --recover-from-backup

# CDN 캐시 무효화
curl -X POST https://purge.cloudflare.com/ \
  -H "X-Auth-Key: ..." \
  -H "X-Auth-Email: ..." \
  -d '{"files":["https://shenyuan.mylumee.cn/pages/chat-*.html"]}'
```

---

## 四、성능 최적화 체크리스트

### 로딩 속도 (목표: < 2s)
```
현재:
  - chat.html: 1.2s (CN)
  
목표:
  - chat-EN.html: 1.2s
  - chat-KR.html: 1.2s
  
최적화:
  [ ] CSS 압축 (minify)
  [ ] JS 트리 셰이킹
  [ ] 웹폰트 preload
  [ ] Gzip 압축 (모든 리소스)
  [ ] CDN 캐시 (60초 public, 300초 private)
```

### LLM 응답 시간
```
현재:
  - DeepSeek 평균 800ms
  - Claude 평균 600ms
  
목표:
  - p95 < 1.5s
  
최적화:
  [ ] Prompt 캐싱 (Redis)
  [ ] Batch API 활용 (장시간 요청용)
  [ ] 타임아웃 설정 (> 2s는 에러)
  [ ] 폴백 모델 (Claude 느리면 DeepSeek)
```

---

**끝. 이 문서는 실시간 업데이트됩니다.**
