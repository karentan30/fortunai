# 善缘韓國支付 · 實施路線圖 (Implementation Roadmap)

**責任人**: 工程師 | **開始日期**: 待 Karen 簽字 | **目標上線**: Week 7

---

## 🎯 實施優先度 · Why Toss First?

### Toss 優勢 (為什麼 Week 1 應該先做)

```
對比維度      Toss           Kakao          Naver
────────────────────────────────────────────────────────
申請難度      🟢 簡          🟡 中          🟡 中
審批時間      2-3 天         5-7 天         5-10 天
海外申請      ✅ 支持        ❌ 需韓銀      ❌ 需韓銀
文檔完整性    🟢 全英文       🟡 混韓英      🟡 韓文多
API 複雜度    🟢 簡           🟡 中          🟡 中
測試卡提供    ✅ 即時         ⏳ 申請後      ⏳ 申請後
SDK 穩定性    ⭐⭐⭐⭐⭐     ⭐⭐⭐⭐⭐     ⭐⭐⭐⭐

結論: Week 1 做 Toss 可獲得 Quick Win (48h 內首筆支付成功)
```

### Toss 不足 (後期補強)

- 市場份額 18% (小於 Kakao 32%)
- 新興公司 (品牌認知不如 Kakao 的 KakaoTalk 集成)
- 用戶重疊部分來自 FinTech 人群

**策略**: Toss 作 Phase-1a MVP (快速驗證), Week 3 加 Kakao 倍增用戶

---

## 📅 Week-by-Week 執行計畫

### **Week 1 · Toss MVP (Days 1-7)**

#### Day 1 (Monday) — 申請 + 環境搭建

**任務 1.1: 商戶申請** (2h)
```
1. 打開 https://toss.tech/
2. 點 "Business Console" → "Sign Up"
3. 填表:
   - Email: team@shenyuan.app
   - Company: ShenYuan Inc. (Singapore)
   - Phone: +65-xxxx (any SG number, 或用 Karen 號)
   - Business Registration: Singapore UEN (或虛擬)
4. Email 驗證 + 身份驗證 (2-3h)
5. 獲得 Dashboard access
6. 導航到 "Settings" → "API Keys" 複製:
   - Client Key (pk_live_xxx)
   - Secret Key (sk_live_xxx)
```

**預期完成**: Day 1 下午 (4-5pm 最晚)

**任務 1.2: 開發環境搭建** (1.5h)
```bash
# 1. Clone repo + checkout branch
cd /Users/karen/projects/shenyuan
git checkout -b feature/kr-payment-toss

# 2. 安裝 Toss SDK
npm install --save @toss/payment-sdk

# 3. 複製 .env.example → .env (server folder)
cp server/.env.example server/.env

# 4. 填入 Toss 金鑰
vi server/.env
# 加入:
# TOSS_CLIENT_KEY=pk_live_xxx
# TOSS_SECRET_KEY=sk_live_xxx
# TOSS_WEBHOOK_SECRET=xxx (暫時留空, 稍後 Dashboard 生成)

# 5. 本地測試伺服器啟動
cd server
npm install
npm start
# 確認: ✓ Server running on port 3020
```

**預期完成**: Day 1 晚上 (7-8pm)

---

#### Day 2-3 (Tuesday-Wednesday) — API 整合

**任務 2.1: 後端路由實作** (6h total)

新建 `/server/routes/payment-kr.js` (from skeleton in Phase-1 doc)

```javascript
// 核心 3 個 endpoint
POST /pay/kr/create
  ├─ 接收 { product, payMethod='toss', token? }
  ├─ 查詢產品定價 (amountKrw)
  ├─ 調用 Toss SDK 初始化
  └─ 返回 { clientKey, orderId, amount, currency='KRW' }

POST /pay/toss/webhook
  ├─ Toss 發送支付結果通知
  ├─ 驗簽 (TOSS_WEBHOOK_SECRET)
  └─ 更新訂單狀態

GET /pay/kr/query?order_id=SY-KR-...
  ├─ 用戶輪詢查詢支付狀態
  └─ 返回 { status: 'pending'|'paid'|'failed' }
```

**代碼檢查清單**:
- [ ] Toss SDK import 無錯誤
- [ ] webhook 驗簽實作正確
- [ ] 訂單號生成唯一 (SY-KR-{timestamp}-{random})
- [ ] 錯誤處理完整 (try-catch + 日誌)

**預期完成**: Day 2 晚上

---

**任務 2.2: 前端 UI** (4h total)

修改 `/pages/saju-KR.html`

```html
<!-- 替換死按鈕 -->
<button class="btn-payment" onclick="showPaymentModal()">
  결제 진행 (완전 분석 리포트) ₩9,900
</button>

<!-- 新增支付方式選擇 Modal -->
<div id="paymentModal" class="modal hidden">
  <div class="modal-content">
    <h3>결제 방법 선택</h3>
    
    <button id="btnToss" class="pay-method-btn">
      <span class="logo">TOSS</span>
      <span class="desc">토스 결제</span>
    </button>
    
    <!-- Kakao/Naver 按鈕暫留空 (Week 3 填) -->
  </div>
</div>

<script src="https://js.tosspayments.com/v1"></script>
<script>
async function startTossPayment() {
  // 1. 後端下單
  const orderResp = await fetch('/pay/kr/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product: 'saju_kr_full',
      payMethod: 'toss',
      token: AUTH_TOKEN || null
    })
  });
  
  const order = await orderResp.json();
  // 2. Toss SDK 初始化
  const tossPayment = new tosspayments.Payment({
    clientKey: order.clientKey,
    customerKey: 'USER_' + (AUTH_TOKEN || 'GUEST')
  });
  
  // 3. 發起支付
  await tossPayment.requestPayment({
    method: 'CARD',  // Toss 支持 CARD/VIRTUAL_ACCOUNT/TRANSFER/PAYCO
    orderId: order.orderId,
    orderName: '善缘 · 사주 리포트',
    amount: 9900,
    currency: 'KRW',
    successUrl: `${window.location.origin}/api/success?order_id=${order.orderId}&method=toss`,
    failUrl: `${window.location.origin}/pages/saju-KR.html?error=payment_failed`
  });
}
</script>
```

**預期完成**: Day 3 晚上

---

#### Day 4-5 (Thursday-Friday) — 測試

**任務 3.1: 單元測試** (2h)

```bash
# Toss 提供測試卡 (不真扣費)
Test Card:      4111-1111-1111-1111
Expiry:         11/25
CVC:            123

# 手工測試場景 (curl + browser)
1. 測試成功支付 → webhook 驗簽 → 訂單記錄 ✅
2. 測試支付失敗 → 錯誤頁面 ✅
3. 測試重複支付 → customerKey 去重防護 ✅
4. 測試 webhook 逆序 (支付完成再 webhook) → 冪等性 ✅
```

**日誌檢查**:
```bash
pm2 logs shenyuan | grep -E "toss|webhook"
# 預期:
# [pay/kr/create] order SY-KR-xxxx created
# [toss/webhook] payment confirmed, status=DONE
# [ORDER] SY-KR-xxxx → completed
```

**預期完成**: Day 4 下午

---

**任務 3.2: 灰度測試** (1h setup + 24h 觀察)

```
參與者: 5 位 QA / 早期韓國用戶
支付方式: Toss 測試卡
驗證項: 
  ✅ 支付成功率 = 5/5 (100%)
  ✅ Webhook 記錄 = 5/5 (100%)
  ✅ 訂單查詢 API = 5/5 (100%)
  ✅ 報告解鎖 = 5/5 (100%)
  ✅ 用戶無投訴 = 5/5 ✅
```

**預期完成**: Day 5 晚上

---

#### Day 6-7 (Saturday-Sunday) — 最後檢查 + 上線

**任務 4.1: 代碼審查 + 部署** (1h)

```bash
# 1. 代碼審查
git diff main feature/kr-payment-toss
# 檢查清單:
# [ ] 無硬編碼密鑰
# [ ] .env 不在 git
# [ ] webhook 驗簽完整
# [ ] 錯誤日誌詳細
# [ ] 無死鏈接

# 2. 部署到生產
git merge feature/kr-payment-toss main
git push
ssh root@47.242.80.65
  cd /www/shenyuan
  git pull
  npm install
  pm2 restart shenyuan
  pm2 logs shenyuan | grep "✓ Toss"
# 預期: ✓ Toss initialized (1-2 min)
```

**預期完成**: Day 6 下午

---

**任務 4.2: 生產驗證** (2h)

```
用 Stripe 測試卡試一次真實支付流
1. 打開 https://shenyuan.app/pages/saju-KR.html
2. 點擊 "결제 진행"
3. 選 Toss
4. 填測試卡 4111-1111-1111-1111
5. 確認支付成功 + 報告解鎖 ✅
6. 檢查後端日誌 + 訂單表 ✅
```

**預期完成**: Day 7 中午

---

### **Week 2 · Toss 穩定 + Kakao 申請開始**

#### Day 8-14 (Monday-Sunday)

**任務 5.1: Toss 生產監控** (持續)
```
每日巡檢:
  ✅ 支付成功率 >98%
  ✅ Webhook 無漏包
  ✅ 無異常日誌
  
指標看板 (可選):
  - 日支付數 (target: 5-10 筆)
  - 平均成功率
  - webhook 延遲 (target: <2s)
```

**任務 5.2: Kakao 商戶申請** (平行進行)

```
1. 打開 https://business.kakao.com
2. "서비스 신청" → "카카오페이 상점"
3. 填表 (需要韓國身份, 或 Karen 授權委託):
   - 상호: ShenYuan Inc.
   - 사업자등록번호: (使用 Singapore UEN, 注上 "International")
   - 대표자: Karen (+ 護照掃描)
   - 계좌: (需韓銀行帳戶, 待決策)
4. 提交 → 審核 5-7 天

預期完成時間: Week 2 末 (Day 14)
```

**風險**: 需韓銀行帳戶
  - 方案 A: Karen 遠端開戶 (+ 授權簽名)
  - 方案 B: 海外代理商協助 (多付 1% 手續費)
  → 待 Karen 決策

**預期完成**: Day 14

---

### **Week 3 · Kakao 集成**

假設 Kakao 審批通過 (Day 10-12)

#### Day 15-21

**任務 6.1: Kakao API 整合** (5h)

新增 `payment-kr.js` 中的 Kakao handler:

```javascript
async function _kakaoPay(res, product, amountKrw, orderNo, token) {
  if (!KAKAO_ADMIN_KEY) {
    return res.status(503).json({ error: 'Kakao not configured' });
  }
  
  try {
    // Step 1: Kakao API 下單 (ready endpoint)
    const readyResp = await fetch('https://open-api.kakaopay.com/online/v1/payment/ready', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `KakaoAK ${KAKAO_ADMIN_KEY}`
      },
      body: JSON.stringify({
        cid: KAKAO_CID,
        partner_order_id: orderNo,
        partner_user_id: token ? extractUserId(token) : 'GUEST_' + Date.now(),
        item_name: '사주 리포트',
        quantity: 1,
        total_amount: amountKrw,
        vat_amount: 0,
        tax_free_amount: 0,
        approval_url: `${FRONTEND_URL}/api/success?order_id=${orderNo}&method=kakao&pg_token={pg_token}`,
        fail_url: `${FRONTEND_URL}/pages/saju-KR.html?error=payment_failed&method=kakao`,
        cancel_url: `${FRONTEND_URL}/pages/saju-KR.html?error=payment_cancelled&method=kakao`
      })
    });
    
    const ready = await readyResp.json();
    if (ready.tid) {
      // 存儲 tid 供 approval 時使用
      _M.pendingOrders = _M.pendingOrders || {};
      _M.pendingOrders[orderNo] = {
        tid: ready.tid,
        method: 'kakao',
        createdAt: Date.now()
      };
      _persist();
      
      // 返回 redirect URL
      return res.json({
        method: 'kakao',
        redirectUrl: ready.next_redirect_mobile_url,  // mobile
        // 或 ready.next_redirect_pc_url 依 client type
        orderId: orderNo,
        tid: ready.tid
      });
    } else {
      throw new Error('Kakao ready failed: ' + ready.msg);
    }
  } catch (err) {
    console.error('[_kakaoPay]', err);
    res.status(502).json({ error: 'Kakao payment init failed' });
  }
}
```

**預期完成**: Day 15-16

---

**任務 6.2: Kakao Webhook** (2h)

```javascript
router.post('/kakao/webhook', (req, res) => {
  try {
    const data = req.body;
    // Kakao webhook 不含簽名, 直接信任 (需 IP 白名單)
    
    if (data.event !== 'payment.completed') {
      return res.json({ ok: true });  // 非支付完成事件, 忽略
    }
    
    const orderNo = data.partner_order_id;
    const amount = data.amount;
    
    const order = _findOrder(orderNo);
    if (!order) {
      console.error('[kakao/webhook] order not found', orderNo);
      return res.json({ ok: false });
    }
    
    if (order.payment_status === 'completed') {
      return res.json({ ok: true });  // 冪等, 已支付
    }
    
    if (Math.abs(order.amount - amount) > 100) {
      console.error('[kakao/webhook] amount mismatch', orderNo, order.amount, amount);
      return res.json({ ok: false });
    }
    
    // 更新訂單
    _updOrder('completed', orderNo);
    completeAffiliateOrder(orderNo);
    console.log(`[PAYMENT] ${orderNo} (kakao) — completed`);
    
    return res.json({ ok: true });
  } catch (err) {
    console.error('[kakao/webhook]', err);
    return res.json({ ok: false });
  }
});
```

**預期完成**: Day 16

---

**任務 6.3: 前端更新** (2h)

```html
<!-- 在 saju-KR.html modal 中加 Kakao 按鈕 -->
<button id="btnKakao" class="pay-method-btn">
  <span class="logo">Kakao Pay</span>
  <span class="desc">카카오페이</span>
  <span class="market-share">32% 국민 선택</span>
</button>

<script>
document.getElementById('btnKakao').onclick = async () => {
  const order = await fetch('/pay/kr/create', {
    method: 'POST',
    body: JSON.stringify({ product: 'saju_kr_full', payMethod: 'kakao' })
  }).then(r => r.json());
  
  // Kakao 重定向
  window.location.href = order.redirectUrl;
};
</script>
```

**預期完成**: Day 17

---

**任務 6.4: 測試** (2h)

```
1. 申請 Kakao 測試帳戶 (via Kakao Dashboard)
2. 手工支付 3 次
3. 驗證 webhook 記錄
4. 檢查訂單狀態
```

**預期完成**: Day 17-18

---

### **Week 4 · Naver 整合 + 穩定**

#### Day 22-28

**任務 7: Naver 集成** (類似 Kakao, 3-4h)
- API 實作
- Webhook handler
- 前端按鈕
- 測試驗證

**任務 8: 全系統測試** (2h)
```
黑盒測試 (模擬真實用戶):
  1. 支付選擇 UI 三選項都能點
  2. 每個方式都能成功支付
  3. Webhook 都能正確記錄
  4. 訂單狀態都能正確查詢
  5. 報告都能正常解鎖
```

**任務 9: 最後檢查** (1h)
- 代碼審查 (無密鑰洩露, 無死鏈接)
- 日誌檢查 (錯誤日誌完整)
- 文檔檢查 (README/API reference 完整)
- 上線簽字 (Karen 確認無誤)

**預期完成**: Day 28 下午

---

## 🔧 技術棧細節

### 訂單狀態機

```
new order
  ↓
pending (前端軮詢中)
  ↓ (webhook 或 query endpoint)
completed (訂單支付成功)
  ↓
fulfilled (報告已解鎖)

失敗路徑:
  ↓
failed (支付失敗, 用戶可重試)
  ↓
expired (24h 未支付, 訂單作廢)
```

### 訂單表新增欄位

```sql
ALTER TABLE orders ADD COLUMN kr_payment_method VARCHAR(50);
-- 值: 'toss' | 'kakao' | 'naver' | 'stripe'

ALTER TABLE orders ADD COLUMN webhook_confirmed_at TIMESTAMP;
-- webhook 驗簽時間, 用於 reconciliation

ALTER TABLE orders ADD COLUMN pg_order_id VARCHAR(255);
-- 支付商的訂單號 (用於查詢)
```

### 環變清單 (.env 最終版本)

```env
# 現有 (保持)
PORT=3020
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
SHENYUAN_BASE_URL=https://shenyuan.mylumee.cn
WECHAT_APP_ID=...
WECHAT_MCH_ID=...
ALIPAY_APP_ID=...

# 新增 (Phase-1)
TOSS_CLIENT_KEY=pk_live_xxx
TOSS_SECRET_KEY=sk_live_xxx
TOSS_WEBHOOK_SECRET=xxx

KAKAO_CID=TC0ONETIME
KAKAO_ADMIN_KEY=xxx
KAKAO_WEBHOOK_SECRET=xxx

NAVER_CLIENT_ID=xxx
NAVER_CLIENT_SECRET=xxx
NAVER_WEBHOOK_SECRET=xxx
```

---

## 📋 依賴清單

### 軟件包
```json
{
  "@toss/payment-sdk": "^1.x",
  // Kakao 無官方 npm 包, 用 fetch 直調 API
  // Naver 無官方 npm 包, 用 fetch 直調 API
}
```

### API 密鑰取得流程

| 支付方式 | 申請渠道 | 耗時 | 責任人 |
|---------|--------|------|-------|
| Toss | https://toss.tech | 2-3 h | 工程師 |
| Kakao | https://business.kakao.com | 5-7 d | Karen (授權) |
| Naver | https://pay.naver.com | 5-10 d | Karen (授權) |

### 帳戶需求

| 支付方式 | 韓銀行帳 | 韓身份 | 公司法人 | 備註 |
|--------|--------|------|--------|------|
| Toss | ❌ | ❌ | ❌ | 海外商戶友善 ✅ |
| Kakao | ⚠️ | ⚠️ | ⚠️ | 需 Karen 簽名授權 |
| Naver | ⚠️ | ⚠️ | ⚠️ | 需 Karen 簽名授權 |

---

## 🎯 成功標準 · Go/No-Go Decision

### Week 1 後 (Day 7)
```
✅ Toss 上線
✅ 首筆支付成功 (測試卡)
✅ Webhook 驗簽成功
✅ 訂單記錄正確

→ GO: 進入 Week 2
```

### Week 2 後 (Day 14)
```
✅ Toss 穩定運行 (無異常)
✅ Kakao/Naver 申請提交
✅ 無任何生產事故

→ GO: 進入 Week 3 (等待 Kakao 審批)
```

### Week 4 後 (Day 28)
```
✅ 三支付方式都上線
✅ 全系統通過黑盒測試
✅ 支付成功率 >98%
✅ 毛利確認 97%+

→ GO: 簽字上線生產
```

---

## 💡 Contingency Plans

### 情景 A: Kakao 審批被拒

**觸發條件**: Day 14 收到拒信

**響應**:
1. 保留 Toss + Naver 上線計畫 (Week 3 優先)
2. 改 Kakao → 海外代理商尋求合作 (Week 4-5)
3. 毛利 -1% 但還是值得 (₩9,900 失 ₩100)

**預期上線延遲**: +2 週

---

### 情景 B: Webhook 丟包

**觸發條件**: 訂單重複或漏記

**響應**:
1. 立即加 DB retry 機制 (Day 24 hotfix)
2. 手工 reconcile (查 PG 官方後台)
3. 重新發 webhook

**預期無用戶感知** (後台自動修)

---

### 情景 C: PIPA 投訴

**觸發條件**: 韓國監管投訴 (低概率)

**響應**:
1. 立即加強隱私政策頁面
2. 自動同意前置強制確認
3. 數據保留期限清楚標示

**預期無關鍵業務中斷**

---

## 📞 Daily Standup 模板 (Week 1-4)

每日 10am UTC+8:

```
【進度】
- 完成: [任務名] ✅ or 🔴
- 阻擋: [問題] (有則列)
- 下一步: [明天計畫]

【指標】
- Toss 支付成功率: XX%
- Webhook 成功率: XX%
- Errors: [任何異常日誌]

【決策需求】
- [若有] Karen 簽字項
```

---

## 📚 參考資料

### 官方文檔 (必讀)

1. **Toss API Docs**  
   https://docs.tosspayments.com/guides/payment-widget
   - 重點: Payment Widget / Webhook Signature

2. **Kakao Payment API**  
   https://developers.kakao.com/docs/latest/ko/kakaopay/common
   - 重點: Ready API / Approval API / CID types

3. **Naver Pay**  
   https://pay.naver.com/merchant/integration
   - 重點: One-click Pay / OAuth flow

### 相關文檔 (本項目)

- `/docs/KR-PAYMENT-INTEGRATION-PHASE1.md` (完整規劃)
- `/docs/KR-PAYMENT-QUICK-REFERENCE.txt` (快速查詢)
- `/server/routes/payment.js` (現有 Stripe 實作, 作參考)
- `/pages/saju-KR.html` (前端頁面, 需改)

---

## ✍️ 版本控制

| 版本 | 日期 | 變更 |
|------|------|------|
| v1.0 | 2026-08-08 | 初版 · 4 週完整計畫 |

---

**準備就緒?** Karen 簽字後立即啟動 Day 1 任務 🚀

