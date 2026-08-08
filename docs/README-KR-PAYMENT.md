# 善缘韓國支付集成 · 文檔導航

**狀態**: ✅ 規劃完成 | **優先度**: P1 備用 | **投資**: ₩0 | **回報**: ₩8.6M/年

---

## 📚 文檔結構 · 按角色快速索引

### 👑 CEO / Karen (決策者)
**目標**: 5 分鐘了解方案, 10 分鐘決策

**必讀順序**:
1. **[KR-PAYMENT-DECISION-MEMO.md](KR-PAYMENT-DECISION-MEMO.md)** (10 min)
   - 三大決策點 (商戶方案 / Timeline / 預算)
   - 簽字欄
   - FAQ

2. **[KR-PAYMENT-QUICK-REFERENCE.txt](KR-PAYMENT-QUICK-REFERENCE.txt)** (5 min)
   - 核心數字對標
   - 財務模型
   - 風險清單

**簽字後**: 監督進度 (Week 1-4 standup)

---

### 👨‍💻 工程師 (後端 + 前端)
**目標**: 詳細技術規劃, 實施無誤

**必讀順序**:
1. **[KR-PAYMENT-QUICK-REFERENCE.txt](KR-PAYMENT-QUICK-REFERENCE.txt)** (5 min)
   - 快速了解全貌

2. **[KR-PAYMENT-INTEGRATION-PHASE1.md](KR-PAYMENT-INTEGRATION-PHASE1.md)** (60 min)
   - 商戶方案對標
   - 技術架構 (API 骨架)
   - 合規檢查
   - 工程檢查清單

3. **[KR-PAYMENT-IMPLEMENTATION-ROADMAP.md](KR-PAYMENT-IMPLEMENTATION-ROADMAP.md)** (45 min)
   - Week-by-Week 執行計畫
   - 每天任務分解
   - 代碼骨架 (複製粘貼用)
   - 訂單狀態機

**簽字後**:
- Day 1 啟動 Toss 申請
- Week 1 提交 PR (payment-kr.js)
- Week 4 上線驗收

---

### 🎯 產品經理 (PM / 運營)
**目標**: 理解商業邏輯, 監督進度

**必讀順序**:
1. **[KR-PAYMENT-QUICK-REFERENCE.txt](KR-PAYMENT-QUICK-REFERENCE.txt)** (5 min)
   - 財務模型
   - KPI 預期

2. **[KR-PAYMENT-INTEGRATION-PHASE1.md](KR-PAYMENT-INTEGRATION-PHASE1.md)** §財務模型 + 合規 (20 min)
   - MRR 預測
   - PIPA + 占卜監管

**簽字後**:
- 配合工程師推進
- 監督 Week 2-3 商戶審批
- 準備韓國市場 GTM

---

### 🧪 QA / 測試
**目標**: 驗收清單, 逐項測試

**必讀順序**:
1. **[KR-PAYMENT-INTEGRATION-PHASE1.md](KR-PAYMENT-INTEGRATION-PHASE1.md)** §工程檢查清單 (15 min)
   - 代碼層級
   - 前端層級
   - 合規層級
   - 測試層級

2. **[KR-PAYMENT-IMPLEMENTATION-ROADMAP.md](KR-PAYMENT-IMPLEMENTATION-ROADMAP.md)** §Day 4-5 測試章節 (20 min)
   - 測試卡
   - 測試場景
   - 灰度驗證

**簽字後**:
- 印出檢查清單 × 2 份
- 每日逐項驗證
- Week 5 最終簽字

---

### 💼 CFO / 財務
**目標**: 成本確認, 毛利驗證

**必讀順序**:
1. **[KR-PAYMENT-DECISION-MEMO.md](KR-PAYMENT-DECISION-MEMO.md)** §商業案例 (5 min)
   - 投資 / 回報表
   - 毛利承諾

**簽字後**: 監督月度財務報表

---

## 📖 完整文檔清單

### Phase-1 主文檔 (4 篇)

| 文檔 | 大小 | 對象 | 用途 |
|------|------|------|------|
| **[KR-PAYMENT-QUICK-REFERENCE.txt](KR-PAYMENT-QUICK-REFERENCE.txt)** | 3 KB | 所有 | 快速查詢卡 / 印刷版 |
| **[KR-PAYMENT-INTEGRATION-PHASE1.md](KR-PAYMENT-INTEGRATION-PHASE1.md)** | 12 KB | 工程 + 產品 | 完整技術規劃 |
| **[KR-PAYMENT-IMPLEMENTATION-ROADMAP.md](KR-PAYMENT-IMPLEMENTATION-ROADMAP.md)** | 15 KB | 工程 | 4 週詳細執行計畫 |
| **[KR-PAYMENT-DECISION-MEMO.md](KR-PAYMENT-DECISION-MEMO.md)** | 8 KB | CEO | 決策備忘錄 + 簽字欄 |

### 相關參考文檔

| 文檔 | 位置 | 用途 |
|------|------|------|
| **STRIPE-QUICK-REFERENCE.txt** | `/docs/` | 現有 Stripe 實作參考 |
| **payment.js** | `/server/routes/` | 現有支付路由, 作為代碼參考 |
| **saju-KR.html** | `/pages/` | 韓文頁面, 需修改 |

---

## 🎯 核心決策 · 三選一

### 決策 1: 商戶方案
- **A**: 韓國法人 (最優, 2-3 週, 需授權)
- **B**: 海外代理 (快速, 2-3 天, 毛利 -1%)
- **C**: 混合 ← **推薦** (快速上線 + 長期最優)

### 決策 2: Timeline
- **2 週**: Toss only (₩250K MRR)
- **4 週**: Toss+Kakao+Naver ← **推薦** (₩594K MRR)
- **6 週**: 含韓國法人 (₩900K MRR+)

### 決策 3: 投資
- **成本**: ₩0
- **毛利**: 97%+
- **回報**: ₩8.6M/年

✏️ **签字位置**: [KR-PAYMENT-DECISION-MEMO.md](KR-PAYMENT-DECISION-MEMO.md) 第 260+ 行

---

## 🚀 實施時間表

```
Week 1:   Toss MVP (Day 1-7)
          └─ Day 7 首筆支付成功
          └─ MRR ₩250K

Week 2-3: Kakao 申請 + 整合
          └─ Week 3 末上線
          └─ MRR +₩146K = ₩396K

Week 4:   Naver 整合 + 全系統驗收
          └─ Week 4 末上線
          └─ MRR +₩198K = ₩594K

Month 3-6: 韓國法人 (optional)
          └─ 直接接 Kakao (降成本)
          └─ MRR +₩300K = ₩900K

Year 1:   穩定運營 + 優化
          └─ 年收入 ₩8.6M-10.8M
          └─ 毛利 97%+
```

---

## 📋 工程檢查清單 (可打印)

**Phase-1 上線前必做**:

### 代碼層級
- [ ] `/server/routes/payment-kr.js` 實作完整 (Toss/Kakao/Naver)
- [ ] 所有 webhook handler 驗簽成功
- [ ] 訂單表新增 `kr_payment_method` + `pg_order_id` 欄
- [ ] `.env` 例子備妥 (不含密鑰)
- [ ] 無硬編碼 API 密鑰
- [ ] .gitignore 包含 .env

### 前端層級
- [ ] `saju-KR.html` 支付選擇 UI 實作
- [ ] 三方 SDK 加載無競爭
- [ ] 成功/失敗頁面本地化 (韓文)
- [ ] 無死鏈接
- [ ] 表單驗證完整

### 合規層級
- [ ] `/pages/privacy-kr.html` 更新 (PIPA 條款)
- [ ] `/pages/terms-kr.html` 加支付條款
- [ ] `saju-KR.html` 支付前強制同意
- [ ] daishao 頁面檢查 (代燒合規)

### 測試層級
- [ ] Toss 測試卡 5 次支付 ✅
- [ ] Kakao 測試帳戶 5 次支付
- [ ] Naver 測試帳戶 5 次支付
- [ ] 各支付方式 webhook 驗簽 ✅
- [ ] 支付失敗重試 ✅
- [ ] 重複支付防護 ✅
- [ ] 訂單查詢 API 正確 ✅
- [ ] 灰度測試 (5 用戶) ✅

### 文檔層級
- [ ] 代碼註釋完整 (支付邏輯清楚)
- [ ] API 文檔更新 (新 endpoint 說明)
- [ ] 部署說明更新 (.env 配置)
- [ ] 故障排查文檔備妥

---

## ⚠️ 5 個上線紅線 (任一失敗禁止上線)

```
❌ FAIL IF:
  1. 支付成功率 <98%
  2. Webhook 成功率 <100%
  3. 安全審計失敗 (PCI 漏洞)
  4. 重複支付未防護
  5. PIPA 違規

✅ PASS IF: 全部通過上述 5 項
```

---

## 📊 財務預測 (保守)

| 月份 | DAU | 支付人數 | MRR | 毛利 |
|------|-----|--------|-----|------|
| M1 (Toss) | 500 | 25 | ₩250K | ₩244K |
| M2 (Kakao) | 800 | 40 | ₩396K | ₩386K |
| M3 (Naver) | 1,200 | 60 | ₩594K | ₩579K |
| M4-12 | 1,500 | 75 | ₩900K | ₩878K |

**年收入**: ₩8.6M (Year 1) → ₩10.8M (穩定)  
**毛利**: 97.5%

---

## 🔑 環境變數 (.env 模板)

```env
# 新增 (Phase-1)
TOSS_CLIENT_KEY=pk_live_xxx
TOSS_SECRET_KEY=sk_live_xxx (base64)
TOSS_WEBHOOK_SECRET=xxx

KAKAO_CID=TC0ONETIME
KAKAO_ADMIN_KEY=xxx
KAKAO_WEBHOOK_SECRET=xxx (optional)

NAVER_CLIENT_ID=xxx
NAVER_CLIENT_SECRET=xxx
NAVER_WEBHOOK_SECRET=xxx (optional)
```

**完整範本**: 見 [KR-PAYMENT-IMPLEMENTATION-ROADMAP.md](KR-PAYMENT-IMPLEMENTATION-ROADMAP.md) §環變清單

---

## 📞 聯絡方式

| 角色 | 聯絡 | 主責 |
|------|------|------|
| **架構 / 技術決策** | Claude Code | 整體方案設計 |
| **商務決策** | Karen | 商戶申請 + 韓國法人 |
| **工程實施** | 後端工程師 | payment-kr.js + webhook |
| **前端實施** | 前端工程師 | saju-KR.html UI |
| **QA 驗收** | QA agent | 檢查清單驗證 |

---

## 🎓 學習資源

### 官方文檔
- **Toss**: https://docs.tosspayments.com/guides/payment-widget
- **Kakao**: https://developers.kakao.com/docs/latest/ko/kakaopay/common
- **Naver**: https://pay.naver.com/merchant/integration

### 內部文檔
- **Phase-0 完成**: [LAUNCH-SUMMARY-0808.md](LAUNCH-SUMMARY-0808.md)
- **Stripe 參考**: [STRIPE-QUICK-REFERENCE.txt](STRIPE-QUICK-REFERENCE.txt)

---

## ✍️ 版本控制

| 版本 | 日期 | 變更 |
|------|------|------|
| v1.0 | 2026-08-08 | 初版 · 規劃完成 |
| — | — | — |

---

## 🎉 最後一句話

```
投資 ₩0 → 4 週開發 → 年 ₩8.4M 毛利 ✅

無需多想, 現在就簽字啟動! 🚀
```

---

**下一步**: Karen 讀 [KR-PAYMENT-DECISION-MEMO.md](KR-PAYMENT-DECISION-MEMO.md) → 簽字 → 工程師啟動 Day 1

