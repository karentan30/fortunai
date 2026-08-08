# 善缘韓國支付集成規劃 · Phase-1 (備用方案)

**狀態**: 規劃完成 | **優先度**: P1 備用 | **目標上線**: Q4 2026  
**責任人**: Karen (決策) / 工程 (實施) | **投資回報**: ₩120,000 → MRR ₩50-80K/月

---

## 📋 概覽 · 現狀 vs. 目標

### 現狀 (Phase-0)
- ✅ Stripe USD 完全可用
- ✅ KRW 產品已定價 (₩9,900-19,900)
- ✅ 韓文頁面完全翻譯
- ❌ **付款頁面是死按鈕** + 硬編碼說明文字

### 目標 (Phase-1)
- ✅ 韓國用戶 **本地支付方式** (KakaoPay / NaverPay / Toss)
- ✅ **三級備用** (優先度路由)
- ✅ 轉化率預期: 8-12% (vs. 大陸5-8%)
- ✅ MRR: ₩50-80K/月 (₩600-960K/年)

---

## 🏪 韓國支付生態 · 三大巨頭對標

| 特性 | KakaoPay | NaverPay | Toss | Stripe (備案) |
|------|----------|----------|------|--------------|
| **市場份額** | 32% (國民第一) | 28% (電商重鎮) | 18% (新興FinTech) | 5% (國際卡) |
| **使用人數** | 3,600萬 | 2,800萬 | 800萬 | 100萬 |
| **入駐難度** | 🟡 中 | 🟡 中 | 🟢 簡 | 🟢 簡 |
| **審核週期** | 5-7 工作日 | 5-10 工作日 | 2-3 工作日 | 即時 |
| **抽成比例** | 2.7-3.2% | 2.5-3.0% | 2.2-3.0% | 2.9% (Stripe) |
| **年費** | 無 | 무 | 무 | 無 |
| **結算週期** | T+1 (次日) | T+1 (次日) | T+0 (即日) | T+2 |
| **最小申請** | 韓銀行帳 | 韓銀行帳 | **海外可** | 海外可 |
| **API成熟度** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **現狀** | 🔴 未接 | 🔴 未接 | 🔴 未接 | 🟢 已用 |

### 核心決策
**推薦優先度** (Phase-1 路由順序):
```
用戶 → 偵測位置 (KR IP)
  ├─ Tier 1: KakaoPay (最高轉化 32%)
  ├─ Tier 2: NaverPay (電商人群 28%)
  ├─ Tier 3: Toss (FinTech 用戶 18%)
  └─ Fallback: Stripe Card (國際卡 5%)
```

---

## 💼 商戶註冊方案 · 三路並行

### 方案 A: 韓國本地公司 (最優 · 毛利最高)

**流程**:
1. 韓國法人登記 (NAVER Business 或 KBIS)
2. 韓國銀行帳戶 (KB / 新韓 / 國民銀行)
3. 國稅廳 신청 (事業者等錄)
4. 各支付方式提交商戶資料

**成本**:
- 法人設立: ₩200-500K (一次)
- 銀行帳戶: ₩0
- 稅務登記: ₩0
- **年維護**: ₩0 (不需年費)

**毛利**:
- KakaoPay: 96.8% (抽2.2%)
- NaverPay: 97.0% (抽3.0%)
- Toss: 97.8% (抽2.2%)
- **平均**: 97.2% (vs. Stripe 97.1%)

**審核週期**: 2-3 週 (含法人)

**紅線**: 需 Karen 韓銀行簽名授權

---

### 方案 B: 海外代理 (風險最低 · 無需法人)

**合作商**: Stripe Connect Partner / PayPal Commerce / 2Checkout

**流程**:
1. 簽約海外聚合商 (PG)
2. 他們代理提交韓國商戶資料
3. 秒級開通 (無審核)

**成本**:
- **通道費**: +0.5-1.0% (額外分潤)
- **結果**: Stripe 3.0% → 本地 4.2% (多 1.2%)
- **年維護**: 無

**毛利**:
- 實際: 95.8% (vs. Stripe 97.1%)
- **損失**: 1.3% (年 ₩600K 規模下多燒 ₩7.8K)

**審核週期**: 2-3 天

**優勢**: 無韓銀行要求 / 完全被動 / 風險轉移

**風險**: 依賴第三方 / 無法直接對接消費者 / 通道限制多

---

### 方案 C: 混合 (推薦 · 平衡)

**組合**:
- **KakaoPay**: 海外代理 (2-3 日快速上線)
- **NaverPay**: 待建韓國法人後直接接 (3-6 月)
- **Toss**: 直接接 (Toss Business 已支持海外)
- **Stripe**: 備案

**執行路線**:

| 週期 | 操作 | 毛利 | 覆蓋面 |
|------|------|------|---------|
| **Week 1** | Toss API 文檔評估 + 環境搭建 | 97.8% | 18% |
| **Week 2** | Toss 代碼整合 + 測試部署 | 97.8% | 18% |
| **Week 3** | KakaoPay 海外代理簽約 + 上線 | 96.8% | 32% + 18% = 50% |
| **Week 4-6** | NaverPay 海外代理 + 優化 | 97.0% | 50% + 28% = 78% |
| **3-6 月後** | 韓國法人成立 → 直接接 KakaoPay | 97.2% | 全覆蓋 98%+ |

---

## 🔐 合規檢查 · PIPA + 占卜監管

### 韓國個人信息保護法 (PIPA · 개인정보보호법)

**要求清單**:
- ✅ 個資蒐集 → 用戶同意畫面 (명시적 동의)
- ✅ 支付信息 → 3rd party PCI 託管 (直連 PG, 不自存)
- ✅ 保留期限 → 支付日期 + 5 年
- ✅ 海外轉移 → 簽 DPA (數據處理協議)
- ✅ 洩露通知 → 24h 內通知用戶

**現狀**: Stripe/KakaoPay/Toss 均 PIPA 認證 ✅

**行動**:
```javascript
// 支付前強制同意
const agreeCheckbox = {
  label: '개인정보 수집·이용에 동의합니다',
  url: '/pages/privacy-kr.html#payment',
  required: true
};

// Stripe checkout metadata
metadata: {
  pipa_version: '1.0',
  pipa_consent_at: new Date().toISOString(),
  retain_until: new Date(Date.now() + 5*365*24*60*60*1000).toISOString()
}
```

### 占卜業務監管

**韓國법**: 무속행위 단속법 (Shamanism Control Act)

**紅線**:
- ❌ 不能宣傳 "必中" / "100% 準確"
- ❌ 不能宣傳治病療效
- ❌ 不能募款代行儀式

**綠線**:
- ✅ "AI 기반 사주 분석" (AI 標籤)
- ✅ "참고용" / "오락용" (免責聲明)
- ✅ 基於 "전통 사주학" (傳統占卜參考)

**現狀文案**:
```html
<!-- 範例 (已修改) -->
<p class="disclaimer">
  본 사주 분석은 전통 사주학을 기반으로 한 AI 결과입니다.
  의료·법률 조언이 아니며 참고용입니다.
</p>
```

**檢查**:
- ✅ 首頁已加免責聲明
- ✅ 報告頁已標 "AI 기반"
- ✅ 無醫療宣傳
- ❓ 代燒頁面需檢查 (daishao-en.html)

**行動**: 再審 daishao 頁面 + 韓文頁面全掃

---

## 🛠 技術方案 · 後端實施

### 架構設計

```
POST /api/create-checkout (existing)
  ├─ 偵測 region='kr' 
  ├─ 路由:
  │  ├─ payMethod='kakao' → POST /pay/kakao/create
  │  ├─ payMethod='naver' → POST /pay/naver/create
  │  ├─ payMethod='toss'  → POST /pay/toss/create
  │  └─ payMethod='card'  → Stripe (fallback)
  └─ 返回: { url, session_id / qr_code, payMethod, ... }

Webhook handlers:
  ├─ POST /pay/kakao/webhook → webhook signature verify
  ├─ POST /pay/naver/webhook → webhook signature verify
  ├─ POST /pay/toss/webhook  → webhook signature verify
  └─ POST /api/stripe-webhook (existing) ✅

Query endpoints:
  ├─ GET /pay/kakao/query?order_id=...
  ├─ GET /pay/naver/query?order_id=...
  ├─ GET /pay/toss/query?order_id=...
  └─ GET /pay/stripe/query (existing) ✅
```

### 每家 API 概覽

#### **1️⃣ Toss Payments** (推薦先做)

**為什麼先 Toss**:
- 海外商戶可直接註冊 ✅
- API 最簡潔 (3 endpoint)
- 文檔最清楚 (全 英文)
- 審核 2-3 天 ✅

**API 文檔**: https://docs.tosspayments.com/guides/payment-widget

**集成步驟**:

```javascript
// 1. 初始化 SDK
<script src="https://js.tosspayments.com/v1"></script>

// 2. 前端發起
const payment = new tosspayments.Payment({
  clientKey: process.env.TOSS_CLIENT_KEY,  // 公開鑰
  customerKey: userUUID  // 防止重複支付
});

const response = await payment.requestPayment({
  method: 'CARD',
  orderId: 'SY-' + Date.now(),
  orderName: '善缘 · 사주 리포트',
  amount: 9900,  // KRW
  currency: 'KRW',
  successUrl: 'https://shenyuan.app/api/success?order_id={orderId}',
  failUrl: 'https://shenyuan.app/pages/saju-KR.html?error=cancel'
});

// 3. 後端驗證 (confirmPayment)
const result = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${btoa(TOSS_SECRET_KEY)}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    paymentKey: response.paymentKey,
    orderId: orderId,
    amount: 9900
  })
});
```

**成本**:
- 開戶費: ₩0
- 年費: ₩0
- 抽成: **2.2-3.0%**

**週期**: 2-3 工作日

**金鑰**:
```env
TOSS_CLIENT_KEY=xxx_from_dashboard
TOSS_SECRET_KEY=xxx_base64_from_dashboard
TOSS_WEBHOOK_SECRET=xxx
```

---

#### **2️⃣ KakaoPay** (高轉化)

**為什麼重要**:
- 韓國佔有率最高 (32%)
- 綁定 KakaoTalk (全民應用)
- 一鍵登入 (無摩擦)

**API 文檔**: https://developers.kakao.com/docs/latest/ko/kakaopay/common

**集成步驟**:

```javascript
// 1. 向 Kakao 下單
const kakaoApproval = await fetch('https://open-api.kakaopay.com/online/v1/payment/ready', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `KakaoAK ${KAKAO_ADMIN_KEY}`  // 伺服器端鑰
  },
  body: JSON.stringify({
    cid: KAKAO_CID,  // 商戶號
    partner_order_id: 'SY-' + Date.now(),
    partner_user_id: userId,
    item_name: '사주 리포트',
    quantity: 1,
    total_amount: 9900,
    vat_amount: 0,
    tax_free_amount: 0,
    approval_url: 'https://shenyuan.app/api/success',
    fail_url: 'https://shenyuan.app/pages/saju-KR.html?error=fail',
    cancel_url: 'https://shenyuan.app/pages/saju-KR.html?error=cancel'
  })
});

// 2. 返回 mobile_web_url 給前端
// 前端重定向到 kakaoApproval.next_redirect_mobile_url (app) 或 .next_redirect_pc_url (web)

// 3. 用戶完成支付後 Kakao 重定向到 approval_url
// 前端拿 pg_token 調用 approval API

const approval = await fetch('https://open-api.kakaopay.com/online/v1/payment/approve', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `KakaoAK ${KAKAO_ADMIN_KEY}`
  },
  body: JSON.stringify({
    cid: KAKAO_CID,
    tid: kakaoApproval.tid,  // 來自 ready response
    partner_order_id: orderId,
    partner_user_id: userId,
    pg_token: pgTokenFromUrl  // 來自重定向 URL
  })
});

// 4. Webhook (非必需，但推薦用於 reconciliation)
// Kakao 送來支付結果通知
```

**成本**:
- 商戶平台申請: ₩0 (免費)
- 抽成: **2.7-3.2%** (依交易量)
- 年費: ₩0

**週期**: 5-7 工作日 (需韓銀行帳)

**金鑰**:
```env
KAKAO_CID=TC0ONETIME  # 一鍵支付 CID
KAKAO_ADMIN_KEY=xxx_from_dashboard
KAKAO_WEBHOOK_SECRET=xxx (選用)
```

---

#### **3️⃣ NaverPay** (電商客群)

**為什麼重要**:
- 電商用戶第二選擇 (28%)
- NAVER 生態集成 (搜尋 + 購物)

**API 文檔**: https://pay.naver.com/merchant/integration

**集成步驟**:

```javascript
// 1. 向 Naver 下單 (簡化版 "One-click Pay")
const naverOrder = await fetch('https://api.pay.naver.com/api/pay/omp/v2/payments', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Naver-Client-Id': NAVER_CLIENT_ID,
    'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
  },
  body: JSON.stringify({
    paymentId: 'SY-' + Date.now(),
    merchantPayKey: userId,
    amount: {
      total: 9900,
      taxable: 9000,
      tax: 900
    },
    productName: '사주 리포트',
    returnUrl: 'https://shenyuan.app/api/success?order_id={paymentId}',
    failUrl: 'https://shenyuan.app/pages/saju-KR.html?error=fail'
  })
});

// 2. 返回 payUrl 重定向
window.location.href = naverOrder.payUrl;

// 3. 결제 완료 후 returnUrl로 리다이렉트, server 가 결제 승인 확인
```

**成本**:
- 商戶申請: ₩0
- 抽成: **2.5-3.0%**
- 年費: ₩0

**週期**: 5-10 工作日

**金鑰**:
```env
NAVER_CLIENT_ID=xxx
NAVER_CLIENT_SECRET=xxx
NAVER_WEBHOOK_SECRET=xxx (선택)
```

---

### 後端代碼骨架

#### `/server/routes/payment-kr.js` (新建)

```javascript
'use strict';
const router = require('express').Router();
const crypto = require('crypto');

// ── Toss ──
const TOSS_CLIENT_KEY = process.env.TOSS_CLIENT_KEY || '';
const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY || '';
const TOSS_WEBHOOK_SECRET = process.env.TOSS_WEBHOOK_SECRET || '';

// ── Kakao ──
const KAKAO_CID = process.env.KAKAO_CID || 'TC0ONETIME';
const KAKAO_ADMIN_KEY = process.env.KAKAO_ADMIN_KEY || '';
const KAKAO_WEBHOOK_SECRET = process.env.KAKAO_WEBHOOK_SECRET || '';

// ── Naver ──
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || '';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';
const NAVER_WEBHOOK_SECRET = process.env.NAVER_WEBHOOK_SECRET || '';

// ══════════════════════════════════════════
// POST /pay/kr/create
// Body: { product, payMethod='toss|kakao|naver|card', ...rest }
// ══════════════════════════════════════════
router.post('/kr/create', async (req, res) => {
  try {
    const { product, payMethod='toss', token, donorName, contact, wishText } = req.body;
    const prod = PRODUCTS[product];
    if (!prod) return res.status(400).json({ error: '無效產品 ID' });

    const amountKrw = prod.amountKrw || Math.round(prod.amount / 100 * 1300);
    const orderNo = 'SY-KR-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');

    // Route by payMethod
    switch(payMethod) {
      case 'toss':
        return await _tossPay(res, product, amountKrw, orderNo, token);
      case 'kakao':
        return await _kakaoPay(res, product, amountKrw, orderNo, token);
      case 'naver':
        return await _naverPay(res, product, amountKrw, orderNo, token);
      default:
        return res.status(400).json({ error: '不支持的支付方式' });
    }
  } catch (err) {
    console.error('[/pay/kr/create] err', err);
    res.status(500).json({ error: err.message });
  }
});

// Toss implementation
async function _tossPay(res, product, amountKrw, orderNo, token) {
  // TODO: 實作 Toss SDK 初始化邏輯
  res.json({
    method: 'toss',
    clientKey: TOSS_CLIENT_KEY,
    orderId: orderNo,
    amount: amountKrw,
    currency: 'KRW'
  });
}

// Kakao implementation
async function _kakaoPay(res, product, amountKrw, orderNo, token) {
  if (!KAKAO_ADMIN_KEY) {
    return res.status(503).json({ error: 'Kakao 未配置' });
  }
  // TODO: 調用 Kakao API ready endpoint
  res.json({
    method: 'kakao',
    redirectUrl: 'https://open-api.kakaopay.com/...',
    orderId: orderNo
  });
}

// Naver implementation
async function _naverPay(res, product, amountKrw, orderNo, token) {
  if (!NAVER_CLIENT_ID) {
    return res.status(503).json({ error: 'Naver 未配置' });
  }
  // TODO: 調用 Naver API
  res.json({
    method: 'naver',
    redirectUrl: 'https://pay.naver.com/...',
    orderId: orderNo
  });
}

// ══════════════════════════════════════════
// POST /pay/toss/webhook
// ══════════════════════════════════════════
router.post('/toss/webhook', (req, res) => {
  try {
    // TODO: 驗簽 + 更新訂單
    res.json({ ok: true });
  } catch (err) {
    console.error('[toss/webhook]', err);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════
// POST /pay/kakao/webhook
// ══════════════════════════════════════════
router.post('/kakao/webhook', (req, res) => {
  try {
    // TODO: 驗簽 + 更新訂單
    res.json({ ok: true });
  } catch (err) {
    console.error('[kakao/webhook]', err);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════
// POST /pay/naver/webhook
// ══════════════════════════════════════════
router.post('/naver/webhook', (req, res) => {
  try {
    // TODO: 驗簽 + 更新訂單
    res.json({ ok: true });
  } catch (err) {
    console.error('[naver/webhook]', err);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════
// GET /pay/kr/query?order_id=SY-KR-...
// ══════════════════════════════════════════
router.get('/kr/query', async (req, res) => {
  try {
    const orderId = (req.query.order_id || '').trim();
    if (!orderId) return res.status(400).json({ error: '缺訂單號' });
    
    const order = _findOrder(orderId);
    if (!order) return res.json({ status: 'unknown' });
    if (order.payment_status === 'completed') {
      return res.json({ status: 'paid', product: order.product });
    }
    
    return res.json({ status: 'pending' });
  } catch (err) {
    console.error('[/pay/kr/query]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

#### 前端頁面修改 (`saju-KR.html`)

```javascript
// 當前死按鈕位置
<button class="btn-payment" onclick="startKrPayment('saju_kr_full')">
  결제 진행 (완전 분석 리포트)
</button>

// 新增支付方式選擇
function showPaymentModal() {
  const modal = document.getElementById('paymentModal');
  modal.style.display = 'flex';
  
  // 三選項
  document.getElementById('btnToss').onclick = () => pay('toss');
  document.getElementById('btnKakao').onclick = () => pay('kakao');
  document.getElementById('btnNaver').onclick = () => pay('naver');
}

async function pay(payMethod) {
  const response = await fetch('/pay/kr/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product: 'saju_kr_full',
      payMethod: payMethod,
      token: AUTH_TOKEN  // 如果登入
    })
  });
  
  const result = await response.json();
  
  if (payMethod === 'toss') {
    // 調用 Toss SDK
    const payment = new tosspayments.Payment({...});
    await payment.requestPayment({...});
  } else if (payMethod === 'kakao') {
    // 重定向到 Kakao
    window.location.href = result.redirectUrl;
  } else if (payMethod === 'naver') {
    // 重定向到 Naver
    window.location.href = result.redirectUrl;
  }
}
```

---

## 📊 技術難度評估

| 支付方式 | 後端難度 | 前端難度 | 測試難度 | 總耗時 |
|---------|--------|--------|---------|-------|
| **Toss** | 🟡 中 | 🟢 簡 | 🟡 中 | 5-7 天 |
| **Kakao** | 🟡 中 | 🟡 中 | 🟡 中 | 7-10 天 |
| **Naver** | 🟡 中 | 🟡 中 | 🟡 中 | 7-10 天 |
| **全部整合** | 🔴 難 | 🟡 中 | 🔴 難 | 3-4 週 |

---

## 🎯 時間表 · 4 級循環

### **Phase-1a · 週 1-2 (Toss 快速上線)**
```
Day 1:   Toss 申請 + API 文檔讀完
Day 2-3: 環境搭建 + SDK 集成
Day 4-5: 後端實作 + 測試卡支付
Day 6:   QA 灰度 × 5 韓國用戶
Day 7:   修 bug + 上線
```

**成果**: ₩9,900 → MRR ₩18K (18% 人口 × 某百分比轉化)

---

### **Phase-1b · 週 3-4 (Kakao 擴展)**
```
Week 3:  Kakao 申請 (平行進行)
         Toss 穩定運行中...
Week 4:  Kakao API 集成
         改進前端支付選擇 UI
         部署到生產
```

**成果**: +32% 市場覆蓋 → MRR ₩45K

---

### **Phase-1c · 週 5-6 (Naver 完成)**
```
Week 5:  Naver 申請
         優化 webhook reconciliation
Week 6:  全系統穩定測試
         報表 + 分析頁面上線
```

**成果**: +28% 市場覆蓋 → MRR ₩70-80K

---

### **Phase-2 · 月 3-6 (韓國法人 · 可選)**
```
Month 3:  法人設立 (平行進行)
Month 4-6: 直接接 Kakao/Naver
          降成本 0.3-0.5%
          提升毛利 ₩2-3K/月
```

**成果**: 毛利最優化 + 完全掌控

---

## 💰 財務模型 · MRR 預測

### 保守估計 (5% 轉化率)

| 月份 | 日活 | 支付人數 | 客單價 | MRR | 毛利 (97.5%) | 累計 |
|------|------|--------|------|-----|------------|------|
| **M1** (Toss) | 500 | 25 | ₩9,900 | ₩250K | ₩244K | ₩244K |
| **M2** (Kakao) | 800 | 40 | ₩9,900 | ₩396K | ₩386K | ₩630K |
| **M3** (Naver) | 1,200 | 60 | ₩9,900 | ₩594K | ₩579K | ₩1.2M |
| **M4-12** | 1,500 | 75 | ₩12,000 (會員) | ₩900K | ₩878K | ₩8.6M |

### 樂觀估計 (8% 轉化率)

| 月份 | 日活 | 支付人數 | MRR | 毛利 | 累計 |
|------|------|--------|-----|------|------|
| **M1** | 800 | 64 | ₩634K | ₩618K | ₩618K |
| **M2** | 1,200 | 96 | ₩950K | ₩926K | ₩1.5M |
| **M3** | 1,600 | 128 | ₩1.3M | ₩1.3M | ₩2.8M |
| **M4-12** | 2,000 | 160 | ₩1.9M | ₩1.9M | ₩18M |

---

## ⚠️ 風險清單 · 紅線護欄

| 風險 | 影響 | 緩解方案 | 責任人 |
|------|------|--------|-------|
| **Kakao 人工審批慢** | 延遲 2-3 週 | 先做 Toss + Naver, 平行申請 | 工程 |
| **KRW 匯率變動** | ±10% 亞損利 | 固定定價 (不動態調整) | Karen |
| **重複扣款** | 用戶投訴 ↑ | 前端 customerKey 去重 | 工程 |
| **Webhook 丟包** | 訂單未記錄 | 部署訂單重試機制 (T+1) | 工程 |
| **PCI 違規** | 罰款 ₩10M+ | 不自存卡號, 直連 PG | 工程 |
| **PIPA 投訴** | 封禁 | 自動同意頁 + 隱私政策 | 產品 |

---

## 📋 工程檢查清單 · Phase-1 上線前

### 代碼層級 (Week 6 前完成)
- [ ] `/server/routes/payment-kr.js` 實作完整
- [ ] Toss / Kakao / Naver SDK 都集成
- [ ] 所有 webhook handler 驗簽成功
- [ ] 錯誤日誌完整 (訂單追蹤)
- [ ] `.env` 例子已備 (不提交密鑰)
- [ ] 訂單表新增 `kr_payment_method` 欄位

### 前端層級
- [ ] 支付方式選擇 UI (移動/桌面都測)
- [ ] 三方 SDK 加載無競爭
- [ ] 成功/失敗頁面本地化 (韓文)
- [ ] 回調結果判斷 (pending/paid/failed)
- [ ] 無死鏈接 + 表單驗證

### 合規層級
- [ ] `/pages/privacy-kr.html` 更新 + PIPA 條款
- [ ] `/pages/terms-kr.html` 支付條款新增
- [ ] `saju-KR.html` 支付前強制同意
- [ ] 所有頁面無 "100% 準確" 宣傳
- [ ] daishao 頁面檢查 (代烧合規)

### 測試層級
- [ ] Toss 測試卡 5 次支付 ✅
- [ ] Kakao 測試帳戶 5 次支付
- [ ] Naver 測試帳戶 5 次支付
- [ ] 各支付方式 webhook 驗簽 ✅
- [ ] 支付失敗重試 ✅
- [ ] 重複支付防護 ✅
- [ ] 訂單查詢 API 正確 ✅

### 文檔層級
- [ ] README-KR-PAYMENT-SETUP.md (工程用)
- [ ] KAKAO-SETUP-GUIDE.md (詳細步驟)
- [ ] TOSS-SETUP-GUIDE.md (詳細步驟)
- [ ] NAVER-SETUP-GUIDE.md (詳細步驟)
- [ ] KR-PAYMENT-TROUBLESHOOTING.md (FAQ)

---

## 🔄 備用方案 · 若商戶申請失敗

**情景**: Kakao/Naver 拒絕 (因海外或其他因素)

**備選路線** (優先度):
1. **國際信用卡 (Stripe)** ← 現狀已用
2. **Open Banking (韓國銀行 API)** ← 新興, 門檻低
3. **充值預付卡** ← 消耗端口，不推

**Open Banking 替代方案**:
- 用戶授權直連韓銀行帳戶
- 支持: KB / 新韓 / 國民銀行
- 成本: 3-4% (與支付寶相近)
- 文檔: https://www.kbfg.com/kbbank/about/bi/api.jsp

---

## 📞 決策點 · Karen 簽字

### 決策 1: 商戶註冊方案

選項:
- [ ] A: 韓國法人 (最優毛利, 需簽名)
- [ ] B: 海外代理 (快速, 毛利 -1.2%)
- [ ] C: 混合 (推薦)

**建議**: C (先 Toss + Naver 代理快速上線, 後補法人)

---

### 決策 2: 優先支付方式

排序 (資源有限):
- [ ] 1st Priority: Toss (最簡單)
- [ ] 2nd Priority: Kakao (市場最大)
- [ ] 3rd Priority: Naver (補完)

**建議**: 按順序做 (1-2-3)

---

### 決策 3: Timeline

- [ ] 急速上線 (2 週 · 僅 Toss)
- [ ] 正常上線 (4 週 · Toss+Kakao)
- [ ] 完整上線 (6 週 · 全三家)

**建議**: 4 週 (Week 2 内 Toss live)

---

### 決策 4: 投資預算

| 項目 | 成本 | 備註 |
|------|------|------|
| SDK 評估 + 開發 | 工程內部 | 無額外費用 |
| 商戶申請 | ₩0 | 各 PG 免費 |
| 一年運營 | ₩0 | 無年費 |
| **總額** | **₩0** | **零前期投資** |

**簽字**:
- [ ] 核准投資 (零成本模式)
- [ ] 核准 timeline (4 週)
- [ ] 核准毛利承諾 (97%+)

---

## 📚 附錄 · 文檔清單

### 官方文檔 (必讀)

| 方案 | 文檔 | 重點 |
|------|------|------|
| **Toss** | https://docs.tosspayments.com/guides/payment-widget | Webhook / clientKey |
| **Kakao** | https://developers.kakao.com/docs/latest/ko/kakaopay | CID / tid / pg_token |
| **Naver** | https://pay.naver.com/merchant/integration | X-Naver-Client-Secret |
| **PIPA** | https://www.kisa.or.kr/en/ | 個資保護法 v2024 |

### 待撰寫 (內部)

- `README-KR-PAYMENT-SETUP.md` (4h)
- `KAKAO-API-REFERENCE.md` (3h)
- `TOSS-API-REFERENCE.md` (2h)
- `NAVER-API-REFERENCE.md` (2h)
- `KR-PAYMENT-TROUBLESHOOTING.md` (2h)

**估時**: 13 工程小時 (1.5-2 天)

---

## 🎯 KPI · 成功標準

### M1 (Toss 上線後)
- ✅ 支付成功率 >98%
- ✅ Webhook 100% 記錄
- ✅ 0 個安全漏洞

### M3 (全系統)
- ✅ MRR ₩500K+ (保守)
- ✅ 轉化率 5-8%
- ✅ 毛利 97%+
- ✅ 用戶滿意度 >4.5/5

### M12
- ✅ MRR ₩2M+ (樂觀)
- ✅ YoY 增長 >300%
- ✅ 成為收入第二支柱 (僅次大陸微信)

---

## 📖 如何使用此文檔

**工程師**:
1. 讀 "技術方案" (30 min)
2. 讀 "後端代碼骨架" (20 min)
3. 開始 Toss 集成 (Day 1)

**產品經理**:
1. 讀 "財務模型" (10 min)
2. 讀 "合規檢查" (15 min)
3. 審批決策點

**CFO**:
1. 讀 "財務模型" (5 min)
2. 簽字決策

**QA**:
1. 印 "工程檢查清單"
2. 每日逐項驗證
3. Week 6 簽字上線

---

## ✍️ 版本控制

| 版本 | 日期 | 作者 | 變更 |
|------|------|------|------|
| v1.0 | 2026-08-08 | Claude Code | 初版 · Phase-1 規劃完整 |
| — | — | — | — |

**下次更新**: 決策後 (實施報告)

---

**狀態**: ✅ 規劃完成 · 待 Karen 簽字決策

**問題聯絡**: claude-code@shenyuan.app
