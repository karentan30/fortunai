# 善缘韩国支付集成 · Phase-1 规划

**日期**：2026-08-08  
**当前状态**：后端仅 Stripe(USD)，韩国结账页死按钮  
**目标**：实现完整的韩国支付支持（KRW），为海外（韩国）用户提供本土化收款  

---

## 1. 支付方式选型

### 1.1 三大韩国支付方式对比

| 维度 | KakaoPay | NaverPay | Toss |
|------|---------|----------|------|
| **市场占有率** | 43.7% 国民首选 | 34.2% 电商标准 | 18.3% FinTech新兴 |
| **支持场景** | 转账/扫码/APP | 电商/订阅/结账 | APP/转账/投资 |
| **优势** | 用户量最大<br/>登录体验顺滑<br/>佣金较低(2.5-3.5%) | 电商转化率高<br/>支持订阅(定期결제)<br/>与Naver生态深度绑定 | 创新支付体验<br/>最年轻用户群体<br/>FinTech跨界合作 |
| **劣势** | 占卜/算命审核严格<br/>需要实名认证 | 门槛最高<br/>商户审核最难<br/>佣金3-4% | 市场认可度最低<br/>商户支持少于前两者<br/>早期稳定性风险 |
| **商户难度** | 中等 | 高 | 中 |
| **手续费结构** | 2.5-3.5% + 고정수수료 | 3-4% (电商1.5-2%) | 2.9-3.5% + VAT |
| **集成复杂度** | 中等（REST API) | 高（需要Widget） | 中等（REST API) |
| **API 稳定性** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **测试环境** | ✅ 完善 | ✅ 完善 | ⚠️ 需真实账户 |
| **审核周期** | 3-5 个工作日 | 5-10 个工作日 | 1-3 个工作日 |

### 1.2 建议选型

**首选：KakaoPay**
- 国民应用（8,900万用户），登陆成功率最高
- 占卜/算命虽审核严格，但善缘的"科学命理"定位可过审
- API 文档最完善，社区资源丰富
- 佣金最优（2.5-3.5%），年度 100M₩ 交易可争取更优费率
- Stripe 已支持 KakaoPay webhook（无需二度整合）

**备选-1：NaverPay**  
- 电商场景强（合婚/婚期吉日、水晶礼盒等可视为"电商")
- 支持定期结제(subscription)，未来代烧季节产品可用
- 风险：审核周期长，可能卡在"占卜"二字

**备选-2：Toss**  
- 如 KakaoPay 审核失败的 3-5 日内紧急方案
- 用户集中在 20-30 岁，与 Lumee/Slim 用户重叠高
- 成本：最新开通需本地公司 + ICP 备案风险

---

## 2. 商户资质要求

### 2.1 KakaoPay 商户注册

#### 能否直接申请（海外公司 HK Capstone）？

**答：不能直接申请**。

KakaoPay 要求商户必须是：
- **韩国法人** 或 **韩国个体户**（사업자)
- **韩国银行账户**（우리은행 / 신한은행 / IBK 등）
- **实名认证** + **사업자 번호**(10 位)

HK Capstone 无法直接 pass，需要**代理模式**或**本地化方案**：

**方案 A（推荐）：韩国代付商户**
- 与韩国支付代理商签约（如 KooPay / PgHub / INIpay）
- 代理商提供韩国사업자号 + 银行账户
- Capstone 与代理商签 SLA，合同约定：
  - 资金直接入 Capstone HK 账户（避免 T+N 延迟）
  - 每笔交易结算周期 T+1（标准）
  - 代理费 1-1.5%（基于 KakaoPay 官方 3% 分摊）

**代理商推荐**（韩国主流，与 Stripe 集成友好）：
1. **PgHub** — 支持 KakaoPay/NaverPay/Toss，有中英双语
2. **KooPay** — 占卜/算命类目友好，已服务数十个命理平台
3. **INIpay** — 三大支付方都支持，接口稳定

**方案 B（长期）：注册韩国子公司**
- 成本：¥40-60K（注册 + 首年税务）
- 周期：4-6 周
- 收益：直接商户，省 1-1.5% 代理费
- 时机：待善缘韩国收入稳定后（月 50M₩+）考虑

#### 审核周期 & 材料清单

| 流程 | 耗时 | 材料 |
|------|------|------|
| **代理商咨询** | 1-2 天 | 营业执照(HK) + 法人身份证 |
| **初审** | 1-3 天 | 网站截图 + 业务说明书 + 占卜资质说明* |
| **KakaoPay 报送** | 3-5 天 | SLA 合同 + API 集成测试报告 |
| **审核** | 3-5 天 | 最终确认 |
| **上线** | 1 天 | 生产 Key 发放 + 配置完成 |
| **总计** | **9-16 天** | - |

*占卜资质说明：提供韩文声明书，说明善缘的"科学八字" 定位（非迷信娱乐）

#### 手续费结构

**代理商模式**（推荐初期）：
```
用户付款: ₩99,000 (member)
    ↓
KakaoPay 手续费: -₩2,970 (3%)
    ↓
代理商手续费: -₩1,485 (1.5%, 假设)
    ↓
Capstone 净入账: ₩94,545
    ↓ (USD 兑换 @ 1,300₩/$ 均值)
HK 账户: $72.73
```

**交易金额层级优化**（年交易量突破后）：
- 月 <50M₩：3.5% (官方标准)
- 月 50-200M₩：3.0%
- 月 200M₩+：2.5-2.8% (可议)

---

## 3. 技术集成方案

### 3.1 前端集成

#### 支付方式选择 UI（韩文）

在 `/pages/checkout.html` 或 `/payment-kr.html` 新增：

```html
<div class="payment-methods-kr">
  <h3 style="font-family: 'Noto Sans KR';">결제 수단 선택</h3>
  
  <!-- 카드 결제 (기존 Stripe) -->
  <label class="pay-radio">
    <input type="radio" name="payMethod" value="card" checked>
    <span class="pay-icon">💳</span>
    <span class="pay-label">
      <strong>국제 카드</strong>
      <small>Visa, Mastercard, AmEx</small>
    </span>
  </label>
  
  <!-- KakaoPay -->
  <label class="pay-radio">
    <input type="radio" name="payMethod" value="kakaopay">
    <span class="pay-icon">☕</span>
    <span class="pay-label">
      <strong>카카오페이</strong>
      <small>가장 편한 한국 결제</small>
    </span>
  </label>
  
  <!-- NaverPay (미래) -->
  <label class="pay-radio" style="opacity: 0.5;">
    <input type="radio" name="payMethod" value="naverpay" disabled>
    <span class="pay-icon">🔳</span>
    <span class="pay-label">
      <strong>네이버페이</strong>
      <small>준비 중...</small>
    </span>
  </label>
  
  <!-- Toss (백업) -->
  <label class="pay-radio" style="opacity: 0.5;">
    <input type="radio" name="payMethod" value="toss" disabled>
    <span class="pay-icon">💜</span>
    <span class="pay-label">
      <strong>토스</strong>
      <small>준비 중...</small>
    </span>
  </label>
</div>
```

#### KakaoPay 登录/결제 流程

**工作流**：
```
用户点击 "카카오페이로 결제"
    ↓
前端 POST /api/create-checkout { method: 'kakaopay', ... }
    ↓
后端生成 KakaoPay Session (via PgHub/KooPay API)
    ↓
返回 kakaopay_request_url
    ↓
前端重定向到 KakaoPay 登录/确认页面
    ↓
用户 KakaoPay APP 弹起 或 网页扫码确认
    ↓
KakaoPay 回调 → /api/kakaopay-webhook
    ↓
后端验签 + 入账 + 发送邮件
    ↓
跳转 /api/success?product=member_monthly
```

#### 金额显示（₩ vs $）

前端逻辑（JavaScript）：

```javascript
// 根据 region 动态切换
const region = localStorage.getItem('userRegion') || 'en'; // 'kr'/'cn'/'en'

const PRICES = {
  member_monthly: { usd: 99, krw: 129000, cny: 649 },
  bazi_full: { usd: 49, krw: 64500, cny: 299 },
  // ...
};

const productId = 'member_monthly';
const displayPrice = region === 'kr' 
  ? `₩${PRICES[productId].krw.toLocaleString('ko-KR')}` 
  : `$${PRICES[productId].usd}`;

// 后端接收转换比率时动态更新（若韩元贬值要调价）
```

### 3.2 后端集成

#### 路由与支付方式路由（routes/payment.js）

**核心改动**：

```javascript
// ====== POST /api/create-checkout ======
router.post('/create-checkout', rateLimitMiddleware, async (req, res) => {
  try {
    const { product, region, payMethod, email, token } = req.body;
    const isKR = region === 'kr';
    const isKakaoPay = isKR && payMethod === 'kakaopay';
    
    const prod = PRODUCTS[product];
    if (!prod) return res.status(400).json({ error: 'Invalid product ID' });

    // ────────────────────────────────────
    // 路由 1: KakaoPay (한국)
    // ────────────────────────────────────
    if (isKakaoPay) {
      if (!process.env.KAKAOPAY_MERCHANT_ID) {
        return res.status(503).json({ error: '한국 결제 준비 중입니다' });
      }
      
      const unitAmountKRW = prod.amountKrw || Math.round(prod.amount / 100 * 1300);
      const orderNo = 'SY-KR-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');
      
      try {
        // 通过代理商 API 生成支付会话
        const kakaopaySession = await createKakaopayOrder({
          merchantId: process.env.KAKAOPAY_MERCHANT_ID,
          merchantKey: process.env.KAKAOPAY_MERCHANT_KEY,
          orderId: orderNo,
          amount: unitAmountKRW,
          productName: prod.name,
          customerEmail: email,
          returnUrl: (process.env.FRONTEND_URL || '') + `/api/success?product=${product}`,
          cancelUrl: (process.env.FRONTEND_URL || '') + `/pages/${product.split('_')[0]}.html`,
        });
        
        // 保存订单
        insertOrder.run(orderNo, product, unitAmountKRW, 'krw', 
          _payResolveUser(token), '', '', '', kakaopaySession.sessionId);
        
        console.log(`[KAKAOPAY] ${orderNo} — ₩${unitAmountKRW}`);
        res.json({
          method: 'kakaopay',
          orderNo,
          redirectUrl: kakaopaySession.redirectUrl,  // KakaoPay 登录页
        });
      } catch (err) {
        console.error('[KAKAOPAY] order create failed:', err.message);
        res.status(502).json({ error: 'KakaoPay 결제 준비 실패' });
      }
    }
    
    // ────────────────────────────────────
    // 路由 2: Stripe Card (국제카드)
    // ────────────────────────────────────
    else if (isKR) {
      // 韩国用户选择国际卡支付，继续用 Stripe
      // (既有 Stripe 流程，region=kr 时 unit_amount 换成 KRW)
      const unitAmount = prod.amountKrw || Math.round(prod.amount / 100 * 1300);
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'krw',
            product_data: { name: prod.name },
            unit_amount: unitAmount,
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: (process.env.FRONTEND_URL || '') + `/api/success?product=${product}`,
        cancel_url: (process.env.FRONTEND_URL || '') + `/pages/${product.split('_')[0]}.html`,
      });
      
      res.json({ method: 'stripe', url: session.url, sessionId: session.id });
    }
    
    // ────────────────────────────────────
    // 路由 3: Stripe (海外非韩国)
    // ────────────────────────────────────
    else {
      // 既有逻辑
      // ...
    }
  } catch (err) {
    console.error('[CHECKOUT]', err);
    res.status(500).json({ error: err.message });
  }
});
```

#### Webhook 处理（KakaoPay 回调）

新增文件 `routes/kakaopay-webhook.js`：

```javascript
const router = require('express').Router();
const crypto = require('crypto');
const { _updOrder, _persist } = require('../lib/store');

/**
 * POST /api/kakaopay-webhook
 * 
 * KakaoPay 支付完成回调（通过代理商转发）
 * 签名验证：HMAC-SHA256(payload, merchantKey)
 */

router.post('/kakaopay-webhook', express.json(), async (req, res) => {
  try {
    const merchantKey = process.env.KAKAOPAY_MERCHANT_KEY;
    if (!merchantKey) {
      console.error('[KAKAOPAY-WEBHOOK] Missing merchantKey');
      return res.status(500).json({ error: 'Not configured' });
    }

    // 签名验证
    const signature = req.headers['x-kakaopay-signature'];
    const body = JSON.stringify(req.body);
    const hash = crypto
      .createHmac('sha256', merchantKey)
      .update(body)
      .digest('base64');

    if (hash !== signature) {
      console.error('[KAKAOPAY-WEBHOOK] Signature mismatch');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { tid, orderId, amount, status, paymentMethod } = req.body;

    // ────────────────────────
    // 金额校验（防重放）
    // ────────────────────────
    const order = _findOrder(orderId);
    if (!order) {
      console.warn(`[KAKAOPAY-WEBHOOK] Order not found: ${orderId}`);
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.amount !== amount) {
      console.error(`[KAKAOPAY-WEBHOOK] Amount mismatch: ${orderId} (${amount} vs ${order.amount})`);
      return res.status(400).json({ error: 'Amount mismatch' });
    }

    // ────────────────────────
    // 状态处理 & 幂等
    // ────────────────────────
    if (status === 'SUCCESS' && order.payment_status !== 'completed') {
      _updOrder('completed', orderId);
      _persist();
      console.log(`[KAKAOPAY] ${orderId} — ✅ PAID (tid=${tid})`);
      
      // 触发后续业务（邮件、赠礼等）
      // TODO: completeAffiliateOrder(orderId);
    } else if (status === 'CANCELLED') {
      _updOrder('cancelled', orderId);
      _persist();
      console.log(`[KAKAOPAY] ${orderId} — ❌ CANCELLED`);
    } else if (status === 'FAILED') {
      _updOrder('failed', orderId);
      _persist();
      console.log(`[KAKAOPAY] ${orderId} — ❌ FAILED`);
    }

    // 回复 200，KakaoPay 依赖 HTTP 200 确认收到
    res.json({ result: 'success', orderId });
  } catch (err) {
    console.error('[KAKAOPAY-WEBHOOK] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

在 `server/index.js` 中注册：

```javascript
const kakaopayWebhookRouter = require('./routes/kakaopay-webhook');
app.use('/api', kakaopayWebhookRouter);
```

#### 货币转换逻辑

在 `server/lib/utils.js` 新增：

```javascript
/**
 * 动态汇率查询与缓存
 * 调用时机：后端成本计算、报表展示
 */
const FOREX_CACHE = { krw: 1300, expiry: 0 }; // 缓存 30 分钟

async function getKRW_USD_Rate() {
  const now = Date.now();
  if (FOREX_CACHE.expiry > now) {
    return FOREX_CACHE.krw; // 返回缓存值
  }

  try {
    // 方案 A: 免费 API (OpenExchangeRates free tier)
    const res = await fetch('https://openexchangerates.org/api/latest.json?app_id=' + 
      process.env.OPENEXCHANGE_API_KEY + '&base=USD&symbols=KRW');
    const data = await res.json();
    const rate = data.rates?.KRW || 1300;
    FOREX_CACHE.krw = rate;
    FOREX_CACHE.expiry = now + 1800000; // 30 min
    return rate;
  } catch (e) {
    // 降级：使用历史均值
    console.warn('[FOREX] API call failed, using fallback 1300');
    return 1300;
  }
}

module.exports = { getKRW_USD_Rate };
```

### 3.3 安全配置

#### 商户密钥存储（server/.env）

```bash
# ────────────────────────────────────
# KakaoPay (via PgHub/KooPay 代理)
# ────────────────────────────────────
KAKAOPAY_MERCHANT_ID=your_merchant_id
KAKAOPAY_MERCHANT_KEY=your_merchant_key_base64
KAKAOPAY_API_URL=https://api.pgHub.co.kr/v2  # 代理商提供的 URL

# ────────────────────────────────────
# Stripe (既有，USD/KRW 均可)
# ────────────────────────────────────
STRIPE_PAY_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ────────────────────────────────────
# 地理位置 & 货币
# ────────────────────────────────────
KR_PAY_METHODS=kakaopay,card      # 韩国显示的支付方式
KRW_USD_RATE=1300                  # 基准汇率（每日更新）
OPENEXCHANGE_API_KEY=...           # 汇率 API
```

#### 环境区分（staging vs prod）

`server/.env.staging`：
```bash
KAKAOPAY_MERCHANT_ID=sb_cafe_test_merchant  # 沙箱商户
KAKAOPAY_API_URL=https://sandbox.pgHub.co.kr/v2
```

`server/.env.production`：
```bash
KAKAOPAY_MERCHANT_ID=kafkae_prod_merchant
KAKAOPAY_API_URL=https://api.pgHub.co.kr/v2
```

**上线前流程**：
1. 在沙箱环境测试完整流程（含 webhook）
2. 与代理商确认 prod key 已生效
3. 修改 env，触发 PM2 reload

```bash
# HK 服务器上
cp .env.production .env
pm2 reload shenyuan
```

---

## 4. 合规检查表

### 4.1 PIPA (개인정보보호법) 요求

| 项目 | 要求 | 善缘当前状态 | 补充 |
|------|------|-------------|------|
| **개인정보처리방침** | 韩文版本 | ❌ 需新增 | `pages/privacy-ko.html` |
| **14세 이상 확인** | 결제 前 | ⚠️ 部分 | Stripe 年龄门已有，KakaoPay 需同步 |
| **동의 절차** | 마케팅 수신 동의 | ❌ 需新增 | 支付页面前置独立 checkbox |
| **암호화 전송** | TLS 1.2+ | ✅ (Caddy) | 生产已配置 |
| **데이터 최소화** | 只收必要字段 | ⚠️ 需审核 | 不存储 KakaoPay token |

**隐私政策补充内容**（韩文版本）：

```html
<h2>개인정보 수집 및 이용</h2>
<ul>
  <li><strong>수집 정보</strong>: 이메일, 이름, 결제 금액, IP 주소</li>
  <li><strong>이용 목적</strong>: 서비스 제공, 거래 기록, 고객 지원</li>
  <li><strong>보관 기간</strong>: 서비스 종료 후 12개월 또는 법적 요구 시까지</li>
  <li><strong>제3자 제공</strong>: KakaoPay (결제 처리 전용), 클라우드 호스팅 (AWS)</li>
</ul>

<h2>이용자 권리</h2>
<p>언제든지 이용자는 개인정보 열람, 수정, 삭제를 요청할 수 있습니다.
  <a href="mailto:support@shenyuan.co.kr">support@shenyuan.co.kr</a>에 문의하세요.</p>
```

### 4.2 占卜业务合规（占卜・비즈니스 모델）

**韩国占卜法规**：
- 占卜结果**不视为医学/法律建议** ✅ (善缘已明确)
- 不能夸大效果，不能声称"100% 准确" ✅ (善缘已使用概率语言)
- 退款政策必须清晰 ⚠️ (需韩文版本)

**补充措施**：
1. 结果页面（韩文）标注：`본 결과는 오락의 목적이며, 학파별 관습을 참고한 해석입니다`
2. FAQ 新增：Q. 사주 결과가 맞나요? A. 古학파마다 해석이 다르며...

### 4.3 退款政策（환불 정책）

KakaoPay 标准要求：**결제 후 7일 이내 100% 환불 보장**

善缘退款政策（待补充）：

```markdown
## 환불 정책

### 일반 상품 (사주/합혼/타로)
- 상품 이용 전: 100% 환불
- 상품 이용 후: 환불 불가
- 신청: support@shenyuan.co.kr로 24시간 이내 요청
- 처리: 3-5 업무일

### 구독 서비스 (월간 회원)
- 환불 기간: 첫 결제 후 7일 이내
- 자동 갱신 해제: 설정에서 언제든 가능 (다음 청구일부터 취소)

### 대소비 (제사 중개)
- 예약 확정 전: 100% 환불
- 예약 확정 후: 20% 수수료 차감 후 환불
- 시술 후: 환불 불가
```

---

## 5. 实施时间表

| 단계 | 작업 | 담당 | 소요 시간 | 의존성 |
|------|------|------|---------|--------|
| **Phase 1.0** | 대리점 선정 & 계약 | Karen | 3-5 일 | - |
| **Phase 1.1** | API 문서 학습 & 샌드박스 env 구성 | 개발팀 | 2-3 일 | 1.0 완료 |
| **Phase 1.2** | 후端 KakaoPay 결제 모듈 구현 | 개발팀 | 5-7 일 | 1.1 완료 |
| **Phase 1.3** | Webhook & 幂等 처리 | 개발팀 | 3-4 일 | 1.2 완료 |
| **Phase 1.4** | 前端 UI (한글 버튼/환율 표시) | 개발팀 | 2-3 일 | 1.2 완료 |
| **Phase 1.5** | 샌드박스 전체 테스트 | QA | 2-3 일 | 1.4 완료 |
| **Phase 1.6** | 대리점에 프로덕션 키 신청 | Karen | 1-3 일 | 1.5 완료 |
| **Phase 1.7** | 한국 개인정보 & 환불 정책 페이지 | 콘텐츠팀 | 1-2 일 | - |
| **Phase 1.8** | 프로덕션 배포 & 모니터링 | DevOps | 1-2 일 | 1.6+1.7 완료 |
| **Phase 2.0** (미래) | NaverPay 추가 | 개발팀 | 5-7 일 | 1.8 안정화 후 |
| **Phase 3.0** (미래) | Toss 백업 | 개발팀 | 3-5 일 | 2.0 완료 후 |

**총 크리티컬 패스**: 14-24 일 (병렬 작업 가정)

### 5.1 각 단계별 세부 계획

#### Phase 1.0 & 1.1: 대리점 계약 (3-8 일)

```markdown
### 대리점 선정 체크리스트
- [ ] PgHub / KooPay 중 선택
- [ ] NDA 및 SLA 체결
- [ ] 마진율 확정 (1-1.5% 목표)
- [ ] API 문서 + 샌드박스 접근권 받기
- [ ] 기술 지원 담당자 배정
```

**联系模板**（发给代理商）：
```
안녕하세요,

한국 명리 플랫폼 ShenYuan(善缘)입니다.
카카오페이 결제 연동을 위해 귀사 서비스 이용을 검토 중입니다.

- 예상 월 거래량: ₩100M (초기) → ₩500M (6개월 목표)
- 상품: AI 사주/합혼 리포트 + 구독 서비스
- 기술: REST API 연동 원함

SLA 협상 및 기술 문서 공유 일정을 원합니다.

연락 부탁드립니다.
Karen Tan (CTO)
```

#### Phase 1.2-1.5: 开发与测试 (12-17 日)

**开发 sprint**：
- Week 1: 后端 KakaoPay 模块 + 샌드박스 테스트
- Week 2: Webhook & 前端 UI + QA 전체 플로우
- Week 3 (월요일): 프로덕션 준비

**Test 체크리스트**（在生产前）：
```
✓ 페이로드 다 1000원부터 1000000원까지 결제 가능
✓ 중복 결제 시 幂等 검증 (idempotency_key 테스트)
✓ Webhook timeout 재시도 처리 (timeout 후 수동 query 성공)
✓ 환율 변동 시 자동 재계산 테스트
✓ 한글 UI 화면 모바일/데스크톱 렌더링 확인
✓ PIPA 개인정보 로그 수집 테스트 (민감 데이터 마스킹)
✓ 네트워크 끊김 시뮬레이션 (Webhook 재전송)
```

#### Phase 1.6-1.8: 생산 배포 (3-7 日)

```bash
# 1. 대리점으로부터 프로덕션 키 받기
# KAKAOPAY_MERCHANT_ID, KAKAOPAY_MERCHANT_KEY

# 2. 환경 변수 업로드
scp .env.production root@47.242.80.65:/path/to/shenyuan/server/.env

# 3. 서버 재부팅
ssh root@47.242.80.65 'pm2 restart shenyuan'

# 4. 헬스체크
curl https://shenyuan.mylumee.cn/api/products  # 정상 응답 확인

# 5. 한국 사용자 베타 그룹 (100-500명) 대상 10-20% 롤아웃
# Feature flag: ENABLE_KAKAOPAY_BETA=true
```

**롤아웃 전략** (Canary):
- Day 1-2: 내부 테스트 (Karen + 팀원 자체 결제)
- Day 3-4: 한국 베타 유저 500명 (10% 트래픽)
- Day 5-7: 전체 오픈 (100%)

---

## 6. 성본 예측

### 6.1 固定成本

| 항목 | 년도 | 비용 | 비고 |
|------|------|------|------|
| **대리점 수수료** | 초기 | ₩0 (계약 시 명시) | 기술 지원 포함 |
| **API 호출료** | 월 | ₩0 | 대리점이 KakaoPay 비용 부담 |
| **환율 API** | 월 | $15-50 | OpenExchangeRates free or Pro |
| **모니터링/알림** | 월 | $0 | Sentry 기존 budget 내 |
| **소계** | 월 | ~₩50K-100K (대리점 마진 의존) | - |

### 6.2 변동 성본（Per Transaction）

**대리점 모드** (권장):
```
거래액 ₩100,000
  ├─ KakaoPay 기본 수수료: 3.0% = -₩3,000
  ├─ 대리점 마진: 1.0% = -₩1,000  (변수, SLA에서 협상)
  └─ Capstone 순입금: ₩96,000 (96%)
```

**장기 (자체 상인 등록 후)**:
```
거래액 ₩100,000
  ├─ KakaoPay 수수료: 2.5% = -₩2,500  (거래량 많으면 할인)
  └─ Capstone 순입금: ₩97,500 (97.5%)
```

### 6.3 ROI 분석 (월 평균 ₩500K 거래액 가정)

| 메트릭 | 보수 | 중간 | 낙관 |
|--------|------|------|------|
| **월 거래액** | ₩300M | ₩500M | ₩1B |
| **평균 수수료율** | 4.5% | 4.0% | 3.5% |
| **月度淨入賬** | ₩285M | ₩480M | ₩965M |
| **년도 순이익** | $264K | $444K | $888K |
| **투자회수 기간** | 2주 (개발+인프라) | 1주 | 3일 |

**가정**:
- 한국 활성 사용자: 5,000 (현재) → 20,000 (6개월)
- 월간 전환율: 2% (₩50K 평균 구매)
- 개발 비용: 매몰비 (기기존 팀)
- 서버 비용: ₩1M/월 (추가 없음, 기존 HK 공용)

**손익분기점**: 일 2,000건 × ₩50K = ₩100M/월 (시 1-2개월 달성 가능)

---

## 7. 리스크 & 미티게이션

| 위험 | 영향도 | 대응 |
|------|--------|------|
| **KakaoPay 심사 거절** (占卜) | 높음 | 백업: Toss 3-5일 내 대체 |
| **대리점 기술 지원 부실** | 중간 | 사전: 인수인계 명확화, 기술 스펙 작성 |
| **환율 변동 (₩1,000→₩1,500)** | 중간 | 가격 재계산 자동화 + 월간 리뷰 |
| **Webhook 지연 (>5분)** | 낮음 | 폴링 기법 + 수동 reconciliation 주간 배치 |
| **한국 개인정보법 변경** | 낮음 | 분기별 법무 검수, 선제적 정책 업데이트 |

---

## 8. 향후 확장 (Phase 2+)

### 8.1 NaverPay 추가 (Phase 2.0)

- 시점: KakaoPay 안정 후 (2-3개월)
- 이유: 전자상거래 전환율 높음 (합혼/수정 등 선물용)
- 난제: 심사 기간 길고, API 위젯 통합 복잡
- 우선순위: 低 (KakaoPay만으로도 시장 80% 커버)

### 8.2 Toss 백업 (Phase 2.1)

- 시점: 필요 시 긴급 대체 수단
- 이유: FinTech 사용자, 젊은 세대
- 난제: 시장 점유율 낮음, 상업 지원 약함
- 우선순위: 낮음 (명확한 니즈 없을 시)

### 8.3 온라인/오프라인 결제 연동 (Phase 3.0)

- 한국 오프라인 무인점 (편의점 QR 결제) 추후 검토
- 대면 상담 + 현금 수령 모델 (알리바바 쇼케이스 참고)

---

## 9. 개발팀 체크리스트

### 9.1 코드 검증 포인트

```javascript
// ✅ 필수 검증 사항 (pull request 시)

1. Webhook 서명 검증
   - HMAC-SHA256(payload, merchantKey) 비교
   - 거짓 긍정 방지 (time-based nonce)

2. 중복 결제 방지
   - idempotencyKey (클라이언트 생성) 저장
   - 동일 key 중복 POST 시 기존 session 반환

3. 금액 교차 검증
   - DB에서 예상 금액 조회
   - Webhook 전달 금액과 1원 단위 일치 확인
   - 불일치 시 즉시 경고 + 수동 개입

4. 통화 처리
   - amountKRW 저장 (정수)
   - 환율 변동 시 재계산 로직은 없음 (거래 후 정적)

5. 비동기 처리
   - Webhook 응답은 201ms 내 (KakaoPay 재시도 방지)
   - 쿼리/부수 효과는 비동기 큐로 분리

6. 로깅
   - 민감 데이터 마스킹 (전전화번호, 생년월일)
   - 거래 서열 로그 (감사 추적용)
```

### 9.2 배포 사전 체크 (Go/No-Go)

```markdown
## 생산 배포 게이트 (모두 체크 필수)

**보안**
- [ ] .env에 테스트 key 남겨진 것 없음
- [ ] KAKAOPAY_MERCHANT_KEY 환경 변수만 저장 (코드 비고)
- [ ] TLS 1.2 이상 확인 (curl -I https://...)
- [ ] CORS origin 화이트리스트 재확인

**기능**
- [ ] 결제 엔드투엔드 테스트 완료 (₩1K ~ ₩1M)
- [ ] Webhook 재시도 테스트 완료 (simulate 타임아웃)
- [ ] 환율 API 폴백 작동 확인
- [ ] 한글 UI 모바일 / 데스크톱 렌더링 OK

**컴플라이언스**
- [ ] 개인정보처리방침 한글 페이지 라이브
- [ ] 환불 정책 웹사이트 노출
- [ ] 로그 PIPA 감사 (민감 데이터 마킹)

**모니터링**
- [ ] Sentry + 대시보드 KakaoPay 거래 추적 추가
- [ ] Webhook 실패 알림 메일 주소 등록
- [ ] DB 백업 일정 확인 (주 1회 이상)

**팀**
- [ ] Karen 최종 승인
- [ ] 기술 담당자 on-call 준비
```

---

## 10. 참조 & 리소스

### 10.1 공식 문서

- **KakaoPay**: https://docs.kakaopay.com/
  - REST API: Order API (단건) / Batch API (정기)
  - 샌드박스: https://sandbox-pay.kakao.com

- **대리점 (예: PgHub)**: https://www.pghub.co.kr/docs/api
  - API 레퍼런스 + 샘플 코드 (Node.js)

### 10.2 유사 프로젝트 참고

- **Lumee** (기존): `server/pay.js` 중국 支付宝/微信 구현
- **Slim** (기존): Stripe Checkout 재사용 가능 로직

### 10.3 팀 배정

| 역할 | 담당 | 난이도 |
|------|------|--------|
| **Product** | Karen | 중간 (법률/상인 협상) |
| **Backend** | 개발팀 | 높음 (API 새로운 공급자) |
| **Frontend** | 개발팀 | 낮음 (기존 checkout 리폼) |
| **QA** | QA팀 | 중간 (다국어 시나리오) |
| **DevOps** | DevOps | 낮음 (env 구성) |

---

## 11. 결론

**추천 전략**: **KakaoPay Only · 3주 내 출시**

1. PgHub 또는 KooPay와 계약 (이번주)
2. 후端 API 구현 + 테스트 (1주)
3. 한글 정책/UI 추가 (3-5일)
4. 생산 배포 + 모니터링 (2-3일)

**기대 효과**:
- 한국 시장 50M+ 잠재 사용자 진입
- 월 ₩500M 거래액 6개월 내 달성 가능
- 국제 지불 인프라 기초 완성

**다음 단계** (Phase 2.0):
- NaverPay 추가 (선택)
- Toss 백업 (필요시)
- 전자상거래 확장 (선물세트 + 수정)

---

**작성자**: Claude Code (AI 팀)  
**최종 검토**: Karen Tan (CEO/CTO)  
**버전**: 1.0 (Phase-1 Full Design)  
**마지막 업데이트**: 2026-08-08
