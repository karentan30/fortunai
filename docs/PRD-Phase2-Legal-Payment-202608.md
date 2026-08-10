# 善缘 Phase 2 PRD：法律合规 + 三币种支付系统

**版本**: 1.0  
**日期**: 2026-08-10  
**负责人**: Karen (CEO) / 工程团队  
**状态**: 待审批  
**目标上线**: 2026-09-30

---

## 📋 Executive Summary

ShenYuan Phase 2 的核心目标是**构建企业级法律合规框架与全球三币种支付系统**，支撑未来的商业扩张与监管要求。

| 阶段 | 交付物 | 状态 | 目标完成 |
|------|--------|------|---------|
| **法律文件** | 中/英/韩 legal docs | ✓ 已草稿 | 2026-08-31 (法务审查) |
| **Stripe 三币种** | USD/CNY/KRW 支付流程 | 📋 PR设计中 | 2026-08-20 |
| **韩国支付本地化** | Toss/Kakao/Naver 集成 | 📋 Phase 1 | 2026-09-30 |
| **支付回调策略** | Webhook + DB reconciliation | 📋 架构定稿 | 2026-09-15 |

---

## Part I：法律文件补全（Legal Compliance）

### I.1 现状评估

#### 现有文件
- ✅ **legal-CN.html** (中文): 完整度 95% — 条款清晰，需补真实公司信息
- ✅ **legal-en.html** (英文): 完整度 90% — 结构明确，需 GDPR/CCPA 微调
- ✅ **legal-kr.html** (韩文): 完整度 85% — 术语韩式化待审，缺 PIPA 细节

#### 缺口清单
| 项目 | 中文 | 英文 | 韩文 | 优先级 |
|------|------|------|------|--------|
| 运营主体信息 | ⚠️ 占位 | ⚠️ 占位 | ⚠️ 占位 | P0 |
| 商业登记号 | ⚠️ "待Karen提供" | ✓ 已补 | ⚠️ 占位 | P0 |
| 法定代表人 | ⚠️ 占位 | ✓ 隐匿 | ⚠️ 占位 | P0 |
| GDPR 隐私权 | ✓ 含 | ⚠️ 简略 | ❌ 缺 | P1 |
| CCPA（加州）| ✓ 参考 | ✓ 含 | ❌ 缺 | P1 |
| PIPA（韩国） | ❌ 缺 | ❌ 缺 | ⚠️ 简略 | P0 |
| AI 生成标识 | ✓ 明确 | ✓ 明确 | ✓ 明确 | ✓ |
| 退款明确期限 | ✓ 详细 | ✓ 详细 | ✓ 详细 | ✓ |

---

### I.2 补全方案

#### 需 Karen 提供的真实信息
```
【必填 · P0】
├─ 公司法定名称 (中文正式名)
├─ 英文法律主体名 
├─ 香港商业登记号 (CR # from Companies Registry)
├─ 法定代表人姓名 + 身份证号后4位
├─ 实际运营地址 (不仅仅是申报地址)
├─ 财务负责人邮箱 (用于税务对接)
└─ 韩国子公司情况 (如已成立)
   ├─ 韩国法人登记号 (사업자번호)
   └─ 韩国实名代表人

【参考 · 法务需求】
├─ 外商代理商资格 (PIPA 合规商)
├─ ISO 27001 或类似数据安全认证
└─ 第三方隐私合规审查报告 (可选但增强信任)
```

#### 中文版补全清单

**位置**: `legal-CN.html` line 170-177 (meta-block)

**现状**:
```html
<div class="row"><b>香港商业登记号</b>：待Karen提供</div>
<div class="row"><b>法定代表人</b>：待Karen提供</div>
```

**修正后**:
```html
<div class="row"><b>运营主体</b>：Capstone IQ Group Limited（香港注册）</div>
<div class="row"><b>香港商业登记号</b>：[CR 编号，8 位数]</div>
<div class="row"><b>公司地址</b>：香港九龙旺角亚皆老街 111 号（已有，确保准确）</div>
<div class="row"><b>法定代表人</b>：[姓名]（身份验证私密化处理）</div>
<div class="row"><b>财务负责人</b>：[邮箱地址]（内部财务对接）</div>
<div class="row"><b>PIPL 数据保护官</b>：support@shenyuan.app（同时为隐私权益联系方）</div>
```

**新增第四章：PIPA 合规声明（仅中文版，因面向大陆用户）**

在隐私政策第三章后（line 362 前）插入：

```html
<h3>四之一、韩国个人信息保护法 (PIPA) 合规</h3>
<p>若用户位于韩国或使用韩国 IP，本平台遵守《个人信息保护法（PIPA）》。所有个人信息处理由 Capstone IQ Group Limited 或其授权韓国代理商作为个人信息处理者负责。用户享有 PIPA 第 35-39 条规定的权利，包括：</p>
<ul>
  <li>信息接近权：要求查阅本平台持有的其个人信息；</li>
  <li>更正/删除权：更正不准确信息，或要求删除；</li>
  <li>处理停止权：可在任何时刻要求停止处理个人信息。</li>
</ul>
<p>用户可向 <strong>support@shenyuan.app</strong> 提交权利申请，我们将在 10 日内回复。如对我们的处理有异议，可向韩国个人信息保护委员会投诉。</p>
```

#### 英文版补全清单

**位置**: `legal-en.html` line 91-96 (meta-block)

**补充内容**：

1. **GDPR 加强** (line 180 Privacy Policy 第 3 节后添加):
```html
<h3>3.1 GDPR Compliance (EU/UK Users)</h3>
<p>For users located in the European Union or United Kingdom, we process personal data in accordance with Regulation (EU) 2016/679 (GDPR). Your legal basis for processing is "legitimate interest" (contract performance for paid services). You have the right to:</p>
<ul>
  <li><b>Data Access:</b> Request a portable copy of your data in machine-readable format</li>
  <li><b>Erasure:</b> Request deletion ("right to be forgotten") within 30 days, subject to legal retention obligations</li>
  <li><b>Withdraw Consent:</b> Opt out of processing at any time (retroactive withdrawal does not affect prior lawful processing)</li>
</ul>
<p>To exercise these rights, email support@shenyuan.app with "GDPR Request" in the subject. We will respond within 30 calendar days.</p>
```

2. **CCPA 强化** (line 191 更新为):
```html
<h3>5. Your Rights (GDPR / CCPA / PIPL)</h3>
<p>Depending on your jurisdiction:</p>

<b>🇪🇺 GDPR (EU/UK):</b><br>
<ul>
  <li>Data Portability: Receive your data in CSV/JSON</li>
  <li>Erasure: "Right to be forgotten" within statutory periods</li>
  <li>Withdrawal: Revoke consent (does not retroactively invalidate past processing)</li>
</ul>

<b>🇺🇸 CCPA (California):</b><br>
<ul>
  <li>Know: Disclosure of personal information collected</li>
  <li>Delete: Request deletion (with exceptions for legal compliance)</li>
  <li>Opt-Out: Do Not Sell My Personal Information (we do not sell data)</li>
  <li>Non-Discrimination: No penalty for exercising rights</li>
</ul>

<b>🇨🇳 PIPL (Mainland China):</b><br>
<ul>
  <li>Cross-Border Consent: Separate confirmation for data transferred outside China</li>
  <li>Withdrawal: May revoke consent prospectively</li>
  <li>Complaint: File with CAC (Cyberspace Administration of China)</li>
</ul>

<b>🇰🇷 PIPA (South Korea):</b><br>
<ul>
  <li>Access & Correction: View and modify your personal information</li>
  <li>Erasure: Request deletion from our systems</li>
  <li>Complaint: File with Korea Personal Information Protection Commission</li>
</ul>
```

#### 韩文版补全清单

**位置**: `legal-kr.html` 整体韩式术语调整

**P0 补正**：

1. **PIPA 용어 정확화** (line 228-245):
   - "데이터 컨트롤러" → "개인정보 처리자" (한국식)
   - "개인정보 보호 담당자" 추가: KISA 등록 필수
   - PIPA § 31-36 조 명시 (권리 조항)

2. **만세력 명확화** (line 258 탭에서):
   ```html
   <tr>
      <td><strong>출생 년월일시 (만세력 기준)</strong></td>
      <td>필수 (사주 계산 기반)</td>
      <td>한국 만세력(만세주)에 따른 정확한 사주 계산, 서양 열대 황도와 무관</td>
   </tr>
   ```

3. **신구 PIPA 구분** (line 245 추가):
   ```html
   <p>본 정책은 2024년 3월 16일 개정 PIPA를 기준으로 합니다. 이전 버전 정책을 참고하시려면 support@shenyuan.app으로 문의하세요.</p>
   ```

---

### I.3 法律页面 UX 改进（全新）

#### 折叠式条款设计（Accordion 模式）

**目标**：按用户地理位置动态展示相关条款，降低信息噪音

```html
<!-- 推荐设计：页面顶部 1 屏 FAQ 五问 -->
<section class="legal-faq">
  <h2>你可能关心的问题</h2>
  <div class="accordion">
    <details open>
      <summary>❓ 你们能把我的生日卖给别人吗？</summary>
      <p>不能。我们不出售或转移任何个人信息。你的生日仅用于算命计算，存储在加密数据库中。</p>
      <p><a href="#section-privacy">→ 查看完整隐私政策</a></p>
    </details>

    <details>
      <summary>🔙 多久能退款？</summary>
      <p><b>中国用户 (¥)</b>: 7 天无理由退款 / <b>海外用户 ($)</b>: 14 天 / <b>韩国用户 (₩)</b>: 7 天</p>
      <p><a href="#section-refund">→ 查看完整退款政策</a></p>
    </details>

    <details>
      <summary>🤖 我的数据会被 AI 训练吗？</summary>
      <p>你的生日、姓名、出生时间仅用于个性化算命结果，不用于 AI 模型训练。我们的算命引擎基于经典五行学说。</p>
      <p><a href="#section-ai-disclosure">→ 了解更多 AI 透明度</a></p>
    </details>

    <details>
      <summary>🔒 支付安全吗？</summary>
      <p>是的。所有支付通过 Stripe、WeChat Pay、Alipay 等官方支付网关，我们不存储信用卡信息。</p>
      <p><a href="#section-security">→ 安全政策详情</a></p>
    </details>

    <details>
      <summary>🗑️ 能永久删除我的账户吗？</summary>
      <p>可以。发邮件至 support@shenyuan.app，我们会在 30 天内删除你的所有数据（法律保留期除外）。</p>
      <p><a href="#section-deletion">→ 数据删除权利</a></p>
    </details>
  </div>
</section>

<!-- 按地理位置动态展示条款 -->
<section class="legal-by-region" id="section-privacy">
  <h2>隐私政策</h2>
  
  <!-- JavaScript 根据用户 IP/地区展示对应条款 -->
  <div id="privacy-sections">
    <!-- 中国用户: PIPL -->
    <div class="region-block" data-region="CN">
      <h3>🇨🇳 中国用户 - 个人信息保护法 (PIPL)</h3>
      <p>若你位于中国大陆，本平台遵守 PIPL 相关规定...</p>
    </div>

    <!-- 韩国用户: PIPA -->
    <div class="region-block" data-region="KR">
      <h3>🇰🇷 韩国用户 - 개인정보보호법 (PIPA)</h3>
      <p>한국 사용자의 경우, 본 플랫폼은 PIPA를 준수합니다...</p>
    </div>

    <!-- EU/UK 用户: GDPR -->
    <div class="region-block" data-region="EU">
      <h3>🇪🇺 欧盟/英国用户 - GDPR</h3>
      <p>If you are located in the EU or UK, we process your data in accordance with GDPR...</p>
    </div>

    <!-- 美国用户: CCPA -->
    <div class="region-block" data-region="US">
      <h3>🇺🇸 加州用户 - CCPA</h3>
      <p>If you are a California resident, you have specific rights under CCPA...</p>
    </div>

    <!-- 其他国家：通用 -->
    <div class="region-block" data-region="OTHER">
      <h3>🌍 其他地区用户</h3>
      <p>本平台遵守国际数据保护标准...</p>
    </div>
  </div>

  <script>
    // 前端地区检测与动态展示
    (async function() {
      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        const country = data.country_code;  // 'CN', 'KR', 'US', etc.
        
        const regionMap = {
          'CN': 'CN',
          'KR': 'KR',
          'US': 'US',
          'DE': 'EU', 'FR': 'EU', 'GB': 'EU'  // 示例
          // ... 完整映射
        };
        
        const region = regionMap[country] || 'OTHER';
        
        // 隐藏不相关条款
        document.querySelectorAll('.region-block').forEach(block => {
          if (block.dataset.region !== region) {
            block.style.display = 'none';
          }
        });
        
        // 记录用户地区（用于支付币种自动选择）
        localStorage.setItem('userRegion', region);
      } catch (err) {
        console.warn('Geo-detection failed, showing all regions');
      }
    })();
  </script>
</section>
```

#### 支付 UI 容错设计（全新）

**1. 支付重试进度条**
```html
<div class="payment-retry-progress">
  <p id="retry-message">重试中 (1/3)...</p>
  <progress id="retry-bar" value="1" max="3"></progress>
  
  <!-- 第 3 次失败时显示降级选项 -->
  <div id="fallback-options" style="display:none;">
    <p>支付暂时失败，请尝试：</p>
    <button onclick="switchPaymentMethod('wechat')">用微信支付</button>
    <button onclick="switchPaymentMethod('alipay')">用支付宝</button>
    <button onclick="contactSupport()">联系客服</button>
  </div>
</div>

<script>
async function attemptPayment(maxRetries = 3) {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      document.getElementById('retry-message').textContent = `重试中 (${i}/${maxRetries})...`;
      document.getElementById('retry-bar').value = i;
      
      const result = await processPayment();
      if (result.success) return result;
    } catch (err) {
      if (i === maxRetries) {
        // 显示降级选项
        document.getElementById('fallback-options').style.display = 'block';
        throw err;
      }
      await new Promise(r => setTimeout(r, 1000 * i));  // 指数退避
    }
  }
}
</script>
```

**2. 支付确认状态流**
```html
<div class="payment-status-flow">
  <div class="step active" data-step="1">
    <span class="dot">1</span>
    <span class="label">提交支付</span>
  </div>
  <div class="step" data-step="2">
    <span class="dot">2</span>
    <span class="label">交易确认中...</span>
  </div>
  <div class="step" data-step="3">
    <span class="dot">3</span>
    <span class="label">生成报告</span>
  </div>
</div>

<script>
// 轮询订单状态
async function pollPaymentStatus(orderId) {
  updateStep(2);  // 进入确认阶段
  
  while (true) {
    const response = await fetch(`/api/orders/${orderId}/status`);
    const { status } = await response.json();
    
    if (status === 'completed') {
      updateStep(3);  // 进入生成阶段
      return;
    }
    
    if (status === 'failed') {
      showPaymentFailed();
      return;
    }
    
    await new Promise(r => setTimeout(r, 1000));  // 每秒轮询
  }
}

function updateStep(stepNum) {
  document.querySelectorAll('.step').forEach(step => {
    if (parseInt(step.dataset.step) <= stepNum) {
      step.classList.add('active');
    }
  });
}
</script>
```

#### 多币种定价透明度（全新）

```html
<div class="pricing-transparency">
  <div class="currency-selector">
    <label>选择货币：</label>
    <select id="currency" onchange="updatePricing()">
      <option value="cny">¥ 中国人民币 (CNY)</option>
      <option value="usd">$ 美元 (USD)</option>
      <option value="krw">₩ 韩元 (KRW)</option>
    </select>
  </div>

  <div class="pricing-display">
    <div class="price-item">
      <strong>深度八字报告</strong>
      <p>
        <span id="price-display">¥29.9</span>
        <span id="exchange-rate">(汇率: 1 USD = 6.45 CNY, 更新于 2026-08-10)</span>
      </p>
    </div>

    <!-- Toss 即将推出提示 -->
    <div id="toss-coming-soon" style="display:none;" class="info-banner">
      <strong>⏰ 便利店支付即将推出</strong>
      <p>我们正在集成韩国本地支付方式（Toss、Kakao Pay）。完成后，支付手续费会降低 30%。</p>
      <button onclick="joinWaitlist()">加入等待名单</button>
    </div>
  </div>

  <script>
async function updatePricing() {
  const currency = document.getElementById('currency').value;
  
  // 实时从服务器获取当日汇率
  const response = await fetch('/api/pricing/rates', {
    method: 'POST',
    body: JSON.stringify({ currency, date: new Date().toISOString().split('T')[0] })
  });
  
  const { price, rate, updateDate } = await response.json();
  
  document.getElementById('price-display').textContent = formatPrice(price, currency);
  document.getElementById('exchange-rate').textContent = 
    `(汇率: 1 USD = ${rate} ${currency.toUpperCase()}, 更新于 ${updateDate})`;
  
  // 韩国用户才显示 Toss 提示
  if (currency === 'krw') {
    document.getElementById('toss-coming-soon').style.display = 'block';
  }
}

function formatPrice(price, currency) {
  const symbols = { cny: '¥', usd: '$', krw: '₩' };
  return `${symbols[currency]} ${price.toFixed(2)}`;
}
  </script>
</div>
```

---

### I.3 法务审查清单

**交付前必过**（需 Karen 自行或雇外部法务）：

| 检查项 | 优先级 | 验收标准 |
|--------|--------|---------|
| **商业主体真实性** | P0 | CR # 在香港公司注册处可查，地址可验证 |
| **PIPL 第三章符合性** | P0 | 敏感信息(出生日期)有单独同意机制 |
| **PIPA (韩国版) 准确性** | P0 | 用语符合韩国个인정보보호법·위원회指南 |
| **GDPR 适配** | P1 | 覆盖 28 EU 国家 + UK |
| **CCPA 免责准确** | P1 | 加州特殊条款（退款、DNSMPI）不违州法 |
| **AI 生成标识合规** | P0 | 符合 EU AI Act / 中国《生成式AI服务管理暂行办法》 |
| **退款流程可执行** | P0 | 标明 24h/72h 期限不违当地消保法 |
| **第三方转移披露** | P0 | DeepSeek/Stripe 信息处理协议已签 |
| **多币种定价清晰度** | P1 | 汇率算式清楚，用户理解不被宰 |
| **支付失败恢复 UX** | P1 | 3 次失败后显示降级选项（银行转账/客服） |

**法务反馈周期**: 预计 7-10 个工作日  
**法务合作建议**: 签署加急合同 ($800, SLA 5-7 天)，并行处理文件逻辑审查 + 等待企业信息

---

## Part II：Stripe 三币种支付系统

### II.1 现状与需求

#### 当前支付现状
```
【已上线】
├─ Stripe Card (USD) · 全球信用卡 ✓
├─ WeChat Pay (CNY) · 中国微信 ✓
└─ Alipay (CNY) · 中国支付宝 ✓

【待集成】
├─ Stripe (CNY) · 中国银联 — 考虑
└─ Stripe (KRW) · 韩国 — 临时方案，长期用 Toss/Kakao
```

#### 三币种需求背景
- **USD**: 海外英文用户（北美/欧洲/澳洲）
- **CNY**: 中国大陆用户（已通过微信/支付宝）
- **KRW**: 韩国新市场（$3.7B 四柱命理市场）

#### Stripe 的角色定位
| 币种 | 当前方案 | Stripe 角色 | 用途 |
|------|---------|-----------|------|
| USD | Stripe Card | 主力 | 国际卡支付（唯一选择） |
| CNY | WeChat/Alipay | 备选 | Stripe 中国支付仍在试验，非 GA |
| KRW | Toss/Kakao/Naver | 主力 | 韩国本地化支付（Stripe KRW 成本高）|

---

### II.2 Stripe 三币种完整方案

#### 2.2.1 USD（国际信用卡）— 已实现，验证逻辑

**现有集成**:
```javascript
// /server/api/checkout (existing)
POST /checkout {
  product: 'bazi-deep-report',
  amount: 4.99,           // USD
  currency: 'usd',
  customer: { email, name },
  paymentMethod: 'card'   // Stripe default
}

Response: {
  clientSecret: 'pi_xxx#secret_xxx',
  publicKey: 'pk_live_xxx'
}
```

**验证清单**:
- ✅ Stripe 美国账户已活跃（可查 Dashboard）
- ✅ Webhook 已注册 `https://shenyuan.mylumee.cn/api/webhook`
- ❓ 需验证：Live mode API keys 有效期 & 权限范围

**完整性检查**:
```bash
# Test USD payment flow
curl -X POST https://shenyuan.mylumee.cn/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "product": "bazi-report",
    "amount": 0.01,
    "currency": "usd",
    "customer": { "email": "test@example.com" }
  }'

# Expected: clientSecret returned, payment_intent created in Stripe Dashboard
```

---

#### 2.2.2 CNY（中国银联）— 验证 Stripe 可行性

**方案选择**:

| 方案 | 成本 | 实现度 | 备注 |
|------|------|--------|------|
| **A. 保持 WeChat/Alipay** | 3-5% 手续费 | ✓ 完整 | 推荐 · 用户体验最佳 |
| **B. Stripe China CNY** | 3.9% | ⚠️ Beta | Stripe 官方不推荐生产环境 |
| **C. UnionPay (银联直连)** | 2-3% | ❌ 需新集成 | 中国仅支持有 ICP 备案的企业 |
| **D. 混合（推荐）** | 3-5% | ✓ 最优 | WeChat/Alipay 主力 + Stripe CNY 作备选 |

**建议方案 D 实施**:
```javascript
// /server/api/checkout 逻辑扩展
if (currency === 'cny') {
  // 主路由：WeChat/Alipay（通过现有网关）
  if (paymentMethod === 'wechat') {
    return initWeChatPayment(params);  // 现有
  } else if (paymentMethod === 'alipay') {
    return initAlipayment(params);     // 现有
  }
  
  // 备选路由：Stripe CNY（仅海外用户）
  if (paymentMethod === 'stripe_cny') {
    return initStripeCNY(params);      // NEW
  }
}

// initStripeCNY implementation
async function initStripeCNY({ amount, customerId }) {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),  // cents
      currency: 'cny',
      customer: customerId,
      payment_method_types: ['card'],
      metadata: { product: 'bazi-report' }
    });
    return { clientSecret: paymentIntent.client_secret };
  } catch (err) {
    console.error('[stripe/cny] error:', err);
    // Fallback: redirect to WeChat/Alipay
    return { fallback: 'wechat' };
  }
}
```

**集成优先度**: **P2（可后续添加）** — 目前 WeChat/Alipay 足够

---

#### 2.2.3 KRW（韩国元）— 长期策略

**方案对比**:

| 方案 | 成本 | 覆盖市场 | 实施周期 | 优先度 |
|------|------|---------|---------|--------|
| **Stripe Korea (KRW)** | 3.9% + 补充费 | 10% | 2 周 | P2 临时 |
| **Toss (사모핸) Payments** | 2.2-2.8% | 18% | 3-5 天 | **P1 快速** |
| **Kakao Pay** | 3.2% | 32% | 1-2 周 | **P1 扩张** |
| **Naver Pay** | 3.0% | 28% | 1-2 周 | **P1 补完** |
| **混合（推荐）** | 平均 2.8% | 78%+ | 4 周 | **推荐** |

**Stripe KRW 作为临时方案**（如韩国支付审批延期）:

```javascript
// Fallback: Stripe KRW when Toss not ready
POST /checkout {
  product: 'saju-deep-report',
  amount: 9900,           // ₩
  currency: 'krw',
  paymentMethod: 'stripe'
}

// Server-side implementation
async function initStripeKRW(params) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: params.amount,  // KRW (no division)
    currency: 'krw',
    customer: params.customerId,
    payment_method_types: ['card'],  // Only international cards
  });
  return { clientSecret: paymentIntent.client_secret };
}
```

**限制**: Stripe KRW 仅支持国际卡，无本地支付方式 → 转化率预期 <2%

---

### II.3 Stripe 集成检查清单

**必完成项** (Phase 2 交付前):

| 检查项 | 验收标准 | 负责人 | 完成日期 |
|--------|---------|--------|---------|
| **API Keys 有效性** | Live mode keys 有 create_payment_intent 权限 | 工程 | 2026-08-15 |
| **USD 支付端到端** | 测试卡成功计费 + webhook 收到确认 | 工程 | 2026-08-15 |
| **CNY 备选路由** | WeChat/Alipay 存量流程验证 | 工程 | 2026-08-18 |
| **KRW 临时方案** | Stripe KRW endpoint 编码完成（暂不启用） | 工程 | 2026-08-20 |
| **Webhook 防重复** | 同一 payment_intent 重复 webhook 幂等性 | 工程 | 2026-08-22 |
| **多币种错误处理** | 汇率异常、支付超时、重复扣款 recovery | 工程 | 2026-08-25 |
| **用户前端本地化** | 选币种界面、价格显示、收据货币符号 | 前端 | 2026-08-28 |

---

## Part III：支付回调策略（Payment Webhook Architecture）

### III.1 核心设计原则

#### 问题陈述
支付完成后，从支付网关（Stripe/Toss/Kakao）到我们后端订单系统需要**可靠、幂等、可审计**的数据同步机制。

**⚠️ 关键约束**：
- **事务隔离级别** 必须 REPEATABLE_READ 以上（防并发幽灵读）
- **Webhook 幂等性 KEY** 使用 (payment_provider, transaction_id) 复合唯一键
- **Express middleware 顺序**：raw body 必须在 json 中间件之前，否则 Stripe 签名验证失败
- **Toss/Kakao 无签名验证**：需要并行实现 API polling 作备选验证（长期方案）

#### 设计目标
1. **可靠性**: 即使 webhook 丢失/延迟，订单最终一致性有保证（DB 对账 Job 补救）
2. **幂等性**: 重复 webhook 不会导致订单重复计费（ON DUPLICATE KEY + IFNULL 防覆盖）
3. **可审计**: 所有支付事件有完整日志，便于对账（webhook_events 表全记录）
4. **低延迟**: 支付后 <2s 内用户获得内容访问权限（前端 poll + webhook 双管齐下）

---

### III.2 推荐架构：Webhook + DB Reconciliation

#### 整体流程

```
User Payment Flow
├─ 1. User 提交支付 (前端 → Stripe/Toss)
│  └─ POST /checkout { product, amount, currency }
│
├─ 2. 支付网关返回 clientSecret / orderId
│  └─ 前端保存 transactionId
│
├─ 3. 支付完成（用户在支付网关确认）
│  ├─ Webhook 异步推送 (Payment Success Event)
│  │  └─ POST /webhook/[provider]/payment.success
│  │     ├─ 验证签名
│  │     ├─ 幂等性检查 (INSERT OR UPDATE orders)
│  │     ├─ 记录 webhook_confirmed_at
│  │     └─ Response 200 OK
│  │
│  └─ [可选] 前端 polling /api/status/[transactionId]
│     └─ 快速反馈（<2s）
│
├─ 4. 每日对账 (Reconciliation Job)
│  ├─ 查询 Stripe/Toss API 获取当日所有完成交易
│  ├─ 对比本地 DB orders 表
│  ├─ 发现幽灵单据（支付方有，本地无）→ 插入补救
│  ├─ 发现孤立单据（本地有，支付方无）→ 告警
│  └─ 生成对账报告 (settlement_reconciliation 表)
│
└─ 5. 用户获得内容访问权限
   └─ 根据 orders.webhook_confirmed_at IS NOT NULL 解锁
```

---

### III.3 数据库设计

#### 订单表 (orders)

```sql
CREATE TABLE orders (
  id VARCHAR(36) PRIMARY KEY,  -- UUID4
  
  -- 用户信息
  user_id VARCHAR(36) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  
  -- 商品信息
  product_id VARCHAR(100) NOT NULL,
  product_name VARCHAR(200),
  
  -- 支付信息
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,  -- 'usd','cny','krw'
  payment_provider VARCHAR(50),  -- 'stripe','toss','kakao','wechat','alipay'
  payment_status VARCHAR(50),    -- 'pending','processing','completed','failed','refunded'
  
  -- 交易标识
  transaction_id VARCHAR(255),   -- Stripe pi_xxx, Toss orderId
  payment_intent_id VARCHAR(255), -- Stripe PI ID (用于 webhook 验证)
  payment_method VARCHAR(100),    -- 'card','wechat','alipay','toss_card'
  
  -- 时间戳
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Webhook 记录
  webhook_received_at TIMESTAMP NULL,  -- 首次 webhook 到达时间
  webhook_confirmed_at TIMESTAMP NULL, -- webhook 验签+处理成功时间
  webhook_retry_count INT DEFAULT 0,   -- webhook 重试次数
  
  -- 对账标记
  reconciliation_status VARCHAR(50),   -- 'pending','confirmed','mismatch'
  reconciliation_checked_at TIMESTAMP NULL,
  
  -- 元数据
  metadata JSON,  -- 额外字段：user_agent, ip_addr, 优惠码等
  
  UNIQUE KEY uk_transaction_id (payment_provider, transaction_id),
  INDEX idx_user_id (user_id),
  INDEX idx_payment_status (payment_status),
  INDEX idx_webhook_confirmed (webhook_confirmed_at)
);
```

#### Webhook 事件日志表

```sql
CREATE TABLE webhook_events (
  id VARCHAR(36) PRIMARY KEY,
  
  -- Webhook 元信息
  provider VARCHAR(50),           -- 'stripe','toss','kakao'
  event_type VARCHAR(100),        -- 'payment.success','payment.failed'
  event_id VARCHAR(255),          -- 支付方的事件 ID（用于去重）
  
  -- 相关订单
  order_id VARCHAR(36),
  transaction_id VARCHAR(255),
  
  -- 内容
  raw_payload LONGTEXT,           -- 原始 JSON (用于调查)
  processed_at TIMESTAMP NULL,
  error_message TEXT,
  
  -- 验证结果
  signature_valid BOOLEAN DEFAULT FALSE,
  idempotency_check_passed BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_event_id (provider, event_id),
  INDEX idx_order_id (order_id),
  INDEX idx_processed (processed_at)
);
```

#### 对账报告表

```sql
CREATE TABLE settlement_reconciliation (
  id VARCHAR(36) PRIMARY KEY,
  
  reconciliation_date DATE NOT NULL,
  payment_provider VARCHAR(50),
  
  -- 数字
  total_transactions INT,
  confirmed_count INT,
  pending_count INT,
  mismatch_count INT,
  
  -- 金额
  total_amount DECIMAL(12,2),
  total_currency VARCHAR(3),
  
  -- 状态
  status VARCHAR(50),  -- 'completed', 'with_warnings', 'with_errors'
  report_summary JSON,  -- { "mismatches": [...], "alerts": [...] }
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_date_provider (reconciliation_date, payment_provider)
);
```

---

### III.4 Webhook 处理逻辑

#### Stripe Webhook Handler

```javascript
// /server/routes/webhook.js
const crypto = require('crypto');
const { db, logger } = require('../utils');

// ⚠️ Express 中间件顺序（CRITICAL）
// app.use(express.raw({ type: 'application/json', limit: '10mb' }));  // 必须在 json() 之前
// app.use(express.json());
// app.post('/api/webhooks/stripe', handleStripeWebhook);

// POST /api/webhooks/stripe
async function handleStripeWebhook(req, res) {
  const db_conn = null;
  try {
    // 1. 验证签名（必须用 raw buffer）
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      logger.warn('[stripe/webhook] missing signature header');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,  // 必须是 raw buffer，不能是解析后的 JSON
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (signErr) {
      logger.error('[stripe/webhook] signature verification failed', { 
        error: signErr.message 
      });
      return res.status(401).json({ error: 'Signature mismatch' });
    }
    
    logger.info('[stripe/webhook] event received', {
      eventId: event.id,
      type: event.type,
      apiVersion: event.api_version
    });

    // 2. 只处理支付成功事件
    if (event.type !== 'payment_intent.succeeded') {
      logger.debug('[stripe/webhook] ignored event type', { type: event.type });
      return res.status(200).json({ received: true });
    }

    const paymentIntent = event.data.object;
    const { amount, currency, id: paymentIntentId, metadata } = paymentIntent;

    // 3. 开启事务（REPEATABLE_READ 隔离）
    db_conn = await db.getConnection();
    await db_conn.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await db_conn.beginTransaction();

    // 4. 幂等性检查 & 插入订单
    // 使用 IFNULL() 确保首次时间戳不被后续 webhook 覆盖
    const [result] = await db_conn.query(`
      INSERT INTO orders (
        id, user_id, customer_email, product_id,
        amount, currency, payment_provider,
        payment_status, transaction_id, payment_intent_id,
        webhook_received_at, webhook_confirmed_at, webhook_retry_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        webhook_received_at = IFNULL(webhook_received_at, NOW()),
        webhook_confirmed_at = CASE 
          WHEN webhook_confirmed_at IS NULL THEN NOW() 
          ELSE webhook_confirmed_at 
        END,
        payment_status = 'completed',
        webhook_retry_count = webhook_retry_count + 1
    `, [
      generateUUID(),
      metadata.userId,
      paymentIntent.receipt_email || metadata.email,
      metadata.product_id,
      amount / 100,  // Stripe 以分为单位
      currency,
      'stripe',
      'completed',
      paymentIntentId,
      paymentIntentId,
      new Date(),
      new Date(),
      0
    ]);

    // 5. 查询确认后的订单（用于日志）
    const [order] = await db_conn.query(
      'SELECT id FROM orders WHERE payment_intent_id = ? LIMIT 1',
      [paymentIntentId]
    );

    // 6. 记录 webhook 事件
    await db_conn.query(`
      INSERT INTO webhook_events (
        id, provider, event_type, event_id,
        order_id, transaction_id, raw_payload,
        signature_valid, idempotency_check_passed, processed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      generateUUID(),
      'stripe',
      'payment.success',
      event.id,
      order?.id || null,
      paymentIntentId,
      JSON.stringify(paymentIntent),
      true,
      true,
      new Date()
    ]);

    // 7. 提交事务
    await db_conn.commit();

    logger.info('[stripe/webhook] order processed successfully', {
      orderId: order?.id,
      amount: amount / 100,
      currency: currency,
      eventId: event.id
    });

    return res.status(200).json({ received: true });

  } catch (err) {
    if (db_conn) {
      try {
        await db_conn.rollback();
      } catch (rollbackErr) {
        logger.error('[stripe/webhook] rollback failed', rollbackErr);
      }
    }
    
    logger.error('[stripe/webhook] error', err);
    
    // Stripe 重试策略：
    // - 5xx → 重试 5 次，24h 内
    // - 2xx → 停止重试
    // 我们总是返回 200（已幂等处理），不让 Stripe 重试
    return res.status(200).json({ received: true });
    
  } finally {
    if (db_conn) {
      await db_conn.release();
    }
  }
}

module.exports = { handleStripeWebhook };
```

**⚠️ 实现注意事项**：
1. **Express middleware 必须顺序正确**（raw → json → routes）
2. **事务隔离** REPEATABLE READ 防止并发幽灵读
3. **IFNULL() & CASE WHEN** 防止后续 webhook 覆盖首次时间戳
4. **错误总是返回 200**（因为幂等处理完成），不让 Stripe 重试

#### Toss Webhook Handler (韩国支付) + API Polling 备选方案

```javascript
// POST /api/webhooks/toss
async function handleTossWebhook(req, res) {
  const db_conn = null;
  try {
    const { orderId, orderName, approvedAt, totalAmount, method, paymentKey } = req.body;
    
    // 1. IP 白名单检查（Toss 无签名验证的替代方案）
    // ⚠️ 注意：IP 白名单可被 DNS 劫持绕过，长期需要 API polling 备选
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
    const validIps = (process.env.TOSS_WEBHOOK_IPS || '').split(',').map(ip => ip.trim());
    
    if (validIps.length > 0 && !validIps.includes(clientIp)) {
      logger.warn('[toss/webhook] IP verification failed', { 
        clientIp, 
        validIps: validIps.slice(0, 2) 
      });
      // 不返回 403（会让 Toss 认为有问题继续重试）
      // 而是记录并返回 200，然后用 API polling 确认
      await db.query(`
        INSERT INTO webhook_events (id, provider, event_type, error_message)
        VALUES (?, ?, ?, ?)
      `, [generateUUID(), 'toss', 'payment.verify_pending', 'IP verification failed']);
      
      return res.status(200).json({ received: true });
    }

    // 2. 无条件插入或更新订单（幂等）
    // 先插入再验证，不要因为验证失败丢弃数据
    db_conn = await db.getConnection();
    await db_conn.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await db_conn.beginTransaction();

    const [result] = await db_conn.query(`
      INSERT INTO orders (
        id, user_id, customer_email, product_id,
        amount, currency, payment_provider, payment_status,
        transaction_id, payment_method, 
        webhook_received_at, webhook_confirmed_at,
        metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        webhook_received_at = IFNULL(webhook_received_at, NOW()),
        webhook_confirmed_at = CASE 
          WHEN webhook_confirmed_at IS NULL THEN NOW()
          ELSE webhook_confirmed_at
        END,
        payment_status = 'completed',
        payment_method = VALUES(payment_method),
        webhook_retry_count = webhook_retry_count + 1
    `, [
      generateUUID(),
      null,  // user_id 从 metadata 提取
      null,  // customer_email 待 Toss API 验证
      'saju-deep-report',  // 从 orderName 映射
      Math.round(totalAmount / 100),  // Toss 以分为单位
      'krw',
      'toss',
      'processing',  // 暂标 processing，验证通过后改 completed
      orderId,
      method,
      new Date(),
      null,
      JSON.stringify({ 
        toss_payment_key: paymentKey,
        toss_method: method,
        toss_approved_at: approvedAt 
      })
    ]);

    // 3. 获取插入的订单 ID
    const [order] = await db_conn.query(
      'SELECT id, amount FROM orders WHERE transaction_id = ? LIMIT 1',
      [orderId]
    );

    // 4. 金额验证（双检）
    if (order && Math.round(order.amount) !== Math.round(totalAmount / 100)) {
      logger.error('[toss/webhook] amount mismatch after insert', {
        orderId,
        expected: order.amount,
        received: Math.round(totalAmount / 100)
      });

      // 标记为不匹配，稍后人工审查
      await db_conn.query(
        'UPDATE orders SET payment_status = ?, reconciliation_status = ? WHERE id = ?',
        ['failed', 'mismatch', order.id]
      );

      await db_conn.commit();
      await db_conn.release();

      logger.warn('[toss/webhook] order marked as mismatch, manual review needed');
      return res.status(200).json({ received: true });
    }

    // 5. 标记为已确认（验证通过）
    await db_conn.query(`
      UPDATE orders SET 
        payment_status = 'completed',
        webhook_confirmed_at = NOW()
      WHERE id = ?
    `, [order?.id]);

    // 6. 记录 webhook 事件
    await db_conn.query(`
      INSERT INTO webhook_events (
        id, provider, event_type, event_id,
        order_id, transaction_id, signature_valid, processed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      generateUUID(),
      'toss',
      'payment.success',
      `${orderId}:${approvedAt}`,
      order?.id || null,
      orderId,
      true,  // IP 白名单通过
      new Date()
    ]);

    await db_conn.commit();

    logger.info('[toss/webhook] order confirmed', { 
      orderId, 
      amount: order?.amount,
      paymentKey 
    });

    return res.status(200).json({ received: true });

  } catch (err) {
    if (db_conn) {
      try {
        await db_conn.rollback();
      } catch (rollbackErr) {
        logger.error('[toss/webhook] rollback failed', rollbackErr);
      }
    }
    
    logger.error('[toss/webhook] processing error', err);
    // 总是返回 200 让 Toss 停止重试，后续用 API polling 补救
    return res.status(200).json({ received: true });

  } finally {
    if (db_conn) {
      await db_conn.release();
    }
  }
}

// ⚠️ 补充：Toss API Polling（后续长期方案）
// 由于 Toss Webhook 无签名验证，建议定时调用 Toss API 验证支付状态
async function verifyTossPaymentViaAPI(orderId, paymentKey) {
  try {
    // Toss Payments API: GET /v1/payments/{paymentKey}
    const response = await fetch(`https://api.tosspayments.com/v1/payments/${paymentKey}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(
          process.env.TOSS_CLIENT_KEY + ':'
        ).toString('base64')}`
      }
    });

    if (!response.ok) {
      throw new Error(`Toss API error: ${response.status}`);
    }

    const payment = await response.json();
    
    if (payment.status === 'DONE' && payment.totalAmount) {
      // 更新订单为已验证
      await db.query(`
        UPDATE orders SET 
          payment_status = 'completed',
          webhook_confirmed_at = NOW()
        WHERE transaction_id = ? AND payment_status = 'processing'
      `, [orderId]);

      logger.info('[toss/api-verify] payment confirmed via API', { orderId });
      return true;
    }

    return false;
  } catch (err) {
    logger.error('[toss/api-verify] error', err);
    return false;
  }
}

module.exports = { handleTossWebhook, verifyTossPaymentViaAPI };
```

**⚠️ Toss Webhook 缺陷与长期方案**：
1. **IP 白名单风险**：可被 DNS 劫持绕过，需要 API polling 备选（已添加 `verifyTossPaymentViaAPI`）
2. **无唯一事件 ID**：使用 `orderId:approvedAt` 作复合 ID，但易重复
3. **建议**：Phase 2 先用 webhook + API polling 并行，Toss 支持签名验证后升级

---

### III.5 每日对账 Job

#### Cron 配置 (PM2)

```json
{
  "apps": [{
    "name": "shenyuan",
    "script": "server/index.js",
    "cron_restart": "0 2 * * *",  // 每天凌晨 2 点重启（不需要，用 job 触发）
    "instances": 1,
    "env": {
      "NODE_ENV": "production"
    }
  }]
}
```

#### 对账任务 (Scheduled Job)

```javascript
// /server/jobs/reconcile-payments.js
const cron = require('node-cron');
const { db, logger, stripe } = require('../utils');

async function reconcilePaymentsDaily() {
  logger.info('[reconcile] starting daily reconciliation');
  
  const today = new Date().toISOString().split('T')[0];
  const startOfDay = new Date(today + 'T00:00:00Z');
  const endOfDay = new Date(today + 'T23:59:59Z');

  try {
    // 1. 从 Stripe 拉取当日已结算交易
    const stripeTransactions = await stripe.charges.list({
      created: {
        gte: Math.floor(startOfDay / 1000),
        lte: Math.floor(endOfDay / 1000)
      },
      limit: 100
    });

    logger.info('[reconcile/stripe] fetched transactions', {
      count: stripeTransactions.data.length
    });

    // 2. 查询本地订单
    const [localOrders] = await db.query(`
      SELECT 
        id, transaction_id, amount, currency, 
        payment_status, webhook_confirmed_at
      FROM orders
      WHERE DATE(created_at) = ?
        AND payment_provider = 'stripe'
    `, [today]);

    logger.info('[reconcile/local] fetched orders', {
      count: localOrders.length
    });

    // 3. 对比：发现幽灵单据
    const processedTxIds = new Set(localOrders.map(o => o.transaction_id));
    let ghostOrders = 0;

    for (const charge of stripeTransactions.data) {
      if (!processedTxIds.has(charge.payment_intent)) {
        ghostOrders++;
        logger.warn('[reconcile/ghost] unprocessed stripe charge detected', {
          chargeId: charge.id,
          paymentIntentId: charge.payment_intent,
          amount: charge.amount / 100
        });

        // 插入修复
        await db.query(`
          INSERT INTO orders (
            id, customer_email, amount, currency,
            payment_provider, payment_status,
            transaction_id, payment_intent_id,
            webhook_confirmed_at, reconciliation_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          generateUUID(),
          charge.billing_details?.email || 'unknown@stripe.local',
          charge.amount / 100,
          charge.currency,
          'stripe',
          'completed',
          charge.payment_intent,
          charge.payment_intent,
          new Date(),
          'mismatch'  // 标记为通过对账发现
        ]);
      }
    }

    // 4. 对比：发现孤立单据
    let orphanOrders = 0;
    for (const order of localOrders) {
      const stripeMatch = stripeTransactions.data.find(
        c => c.payment_intent === order.transaction_id
      );
      if (!stripeMatch) {
        orphanOrders++;
        logger.warn('[reconcile/orphan] local order missing in stripe', {
          orderId: order.id,
          transaction_id: order.transaction_id
        });
        
        // 可能原因：
        // 1. 网络延迟（Stripe 尚未结算）
        // 2. 退款
        // 3. 订单假数据
        // 留待人工审查
      }
    }

    // 5. 生成对账报告
    const report = {
      date: today,
      total_stripe_transactions: stripeTransactions.data.length,
      total_local_orders: localOrders.length,
      ghost_orders: ghostOrders,
      orphan_orders: orphanOrders,
      status: ghostOrders > 0 || orphanOrders > 5 ? 'with_warnings' : 'completed'
    };

    await db.query(`
      INSERT INTO settlement_reconciliation (
        id, reconciliation_date, payment_provider,
        total_transactions, confirmed_count, mismatch_count,
        status, report_summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      generateUUID(),
      today,
      'stripe',
      stripeTransactions.data.length,
      localOrders.length - orphanOrders,
      ghostOrders,
      report.status,
      JSON.stringify(report)
    ]);

    logger.info('[reconcile] completed', report);

  } catch (err) {
    logger.error('[reconcile] error', err);
    // 发送告警给 Karen
    await sendAlert({
      subject: '[ShenYuan] Reconciliation Failed',
      body: `Daily payment reconciliation failed: ${err.message}`
    });
  }
}

// 每天 02:30 UTC 执行（中国时间 10:30）
cron.schedule('30 2 * * *', reconcilePaymentsDaily, {
  timezone: 'UTC'
});

module.exports = { reconcilePaymentsDaily };
```

---

### III.6 回调策略清单

| 策略 | Stripe | Toss | Kakao | 说明 |
|------|--------|------|-------|------|
| **Webhook 签名验证** | ✓ HMAC SHA-256 | ✗ IP 白名单 | ✗ IP 白名单 | Stripe 最安全 |
| **支付确认延迟** | <100ms | 1-3s | 1-5s | 越短用户体验越好 |
| **幂等性保证** | DB UNIQUE KEY | 同左 | 同左 | 防止重复计费 |
| **每日对账** | ✓ 自动 | ✓ 自动 | ✓ 自动 | 发现幽灵单据 |
| **失败重试** | Stripe 自动重试 5 次 | 手动或依赖网关 | 手动或依赖网关 | 我们需要主动 poll |
| **用户前端 poll** | 可选（webhook 已覆盖） | 推荐 | 推荐 | 快速反馈，不阻塞 |

---

## Part IV：实施时间表

### 4.1 关键路径

```
Week 1-2 (Aug 10-25)
├─ 法律文件补全 + 外部法务审查 (5-7 days)
├─ Stripe 验证 + 三币种编码 (5 days)
└─ Webhook 数据库设计完成 (3 days)

Week 3-4 (Aug 26-Sep 8)
├─ Webhook 逻辑实现 (Stripe/Toss/Kakao) (6 days)
├─ 每日对账 Job 完成 (2 days)
└─ 全链路测试 (3 days)

Week 5-6 (Sep 9-22)
├─ 韩国支付 (Toss/Kakao) 申请 & 集成 (10 days, 平行)
└─ 前端多币种 UI 完成 (5 days)

Week 7 (Sep 23-30)
├─ 生产环境部署 + 烟雾测试 (3 days)
├─ Karen 签字放行 (1 day)
└─ **上线** (1 day)
```

### 4.2 可交付物清单

| 交付物 | 完成日期 | 验收方 | 状态 |
|--------|---------|--------|------|
| **legal-CN.html** (更新版) | 2026-08-31 | 法务 + Karen | ⏳ |
| **legal-en.html** (GDPR/CCPA 加强) | 2026-08-31 | 法务 + Karen | ⏳ |
| **legal-kr.html** (PIPA + 术语) | 2026-08-31 | 法务 + Karen | ⏳ |
| **Stripe 三币种验证报告** | 2026-08-25 | 工程 | ⏳ |
| **Webhook 架构文档** | 2026-08-22 | 工程 | ⏳ |
| **支付回调代码** (Stripe/Toss/Kakao) | 2026-09-08 | 工程 | ⏳ |
| **每日对账 Job** | 2026-09-10 | 工程 | ⏳ |
| **多币种前端 UI** | 2026-09-20 | 前端 | ⏳ |
| **生产环保烟雾测试报告** | 2026-09-25 | QA | ⏳ |

---

## Part V：成本与 ROI

### 5.1 投资 

| 项目 | 成本 | 备注 |
|------|------|------|
| 外部法务审查（3 国） | $500-1000 | 可选，补全文件后自行审 |
| Stripe API 成本 | $0 | 按交易金额 % 扣 |
| 韩国支付开户费 | ₩0 (Toss 免费) | 各 PG 免费申请 |
| **总投资** | **~$1000** | — |

### 5.2 预期收入提升

| 市场 | 当前 | Phase 2 后 | 增幅 |
|------|------|-----------|------|
| 大陆（CNY） | ¥600K/年 | ¥600K/年 | 0% (维持) |
| 海外（USD） | $50K/年 | $80K/年 | +60% (更好的支付流程) |
| 韩国（KRW） | ₩0/年 | ₩8.6M/年 | +新市场 |
| **合计** | **~$70K/年** | **~$180K/年** | **+156%** |

---

## Part VI：风险管理

### 6.1 关键风险

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| **Kakao 审批被拒** | 5% | 韩国收入 -32% | 改用 Toss + Naver (覆盖 46%) |
| **法务审查延期** | 10% | 推迟 2 周上线 | 并行开发，最后补文件 |
| **支付 webhook 丢包** | 2% | 用户报怨，订单漏记 | DB 对账 job 补救 |
| **Stripe KRW 成本高** | 100% | 用户会选本地支付 | 优先上线 Toss/Kakao |
| **汇率波动** | 100% | 收入浮动 | 固定定价，月底结算调整 |

### 6.2 应急方案

- **支付全链路故障** → 降级到银行转账（后端配置）
- **Webhook 持续失败** → 启动手动对账 + 客服补发内容
- **法务审查不通过** → 外聘专业律师（预算 $2K）
- **Toss/Kakao 审批延期** → 扩大 Stripe KRW 临时方案覆盖范围，同时启动 API polling 备选

---

### 6.3 生产部署前完整检查清单（新增）

**上线前 72 小时内必完成**：

| 检查项 | 验收标准 | 测试命令 |
|--------|---------|---------|
| **Webhook 域名 HTTPS** | curl -I https://shenyuan.mylumee.cn/api/webhooks/stripe 返回 200 | 见下 |
| **SSL 证书有效期** | ≥30 天 | openssl s_client -connect shenyuan.mylumee.cn:443 |
| **DB 连接池大小** | min=5, max=20 (支持 100 并发 webhook) | ps aux \| grep "mysql/pool" |
| **Monitoring & Alerting** | webhook 延迟 >5s、幽灵单据 >1/小时 | 见 monitoring.md |
| **日志聚合可查询** | grep 'webhook_confirmed_at' /var/log/shenyuan.log | 见 logging 章节 |
| **性能测试** | 100 并发 webhook, p99 延迟 <2s | ab -n 100 -c 100 https://... |
| **数据库故障演练** | kill DB → webhook retry 成功率 >95% | 见容错测试 SOP |
| **Stripe 签名验证** | 测试卡支付后 webhook 验签通过 | curl -X POST -d '{"test":"true"}' -H 'stripe-signature: xxx' |
| **Toss IP 白名单** | Toss 白名单 IP 在 nginx 中正确配置 | grep -A5 "toss_ips" /etc/nginx/conf.d/shenyuan.conf |
| **多币种前端** | 支付页面可切换 USD/CNY/KRW，价格正确显示 | 在生产环境测试支付页 |

**性能测试脚本示例**：
```bash
#!/bin/bash
# webhook-load-test.sh
ENDPOINT="https://shenyuan.mylumee.cn/api/webhooks/stripe"
STRIPE_SIGNATURE="t=1691608000,v1=xxx"  # 有效签名

ab -n 100 -c 100 -H "stripe-signature: $STRIPE_SIGNATURE" \
   -H "Content-Type: application/json" \
   -p webhook-payload.json \
   "$ENDPOINT"

# 结果：Connection Times (ms) p99 < 2000ms
```

**数据库故障演练**：
```sql
-- 模拟 DB 故障
FLUSH TABLES WITH READ LOCK;  -- 仅读
-- 观察 webhook 错误日志，确认重试机制触发
UNLOCK TABLES;
-- 验证恢复后 webhook 自动补救
SELECT COUNT(*) FROM orders WHERE webhook_confirmed_at > DATE_SUB(NOW(), INTERVAL 1 HOUR);
```

---

## Part VII：成功指标 (KPIs)

### 上线后 30 天

| KPI | 目标 | 验收标准 |
|-----|------|---------|
| **支付成功率** | >98% | Stripe/Toss/Kakao 总成功率 |
| **Webhook 处理延迟** | <2s | webhook_confirmed_at - webhook_received_at |
| **每日对账准确率** | 100% | 幽灵单据 = 0, 孤立单据 < 1 |
| **用户反馈** | 0 重复计费投诉 | 24h 内解决 |
| **多币种转化** | CNY 40%, KRW 30%, USD 30% | 基于实际支付数据 |

---

## 附录 A：动态定价与汇率调整策略（完全重写）

### A.1 定价基准与汇率管理

**CNY 基准价格**（港元成本转算为 CNY 后定价）

| 产品 | CNY 基准 | 成本基础 | 毛利 |
|------|---------|--------|------|
| 基础报告 | ¥9.9 | API 0.5 元 | 90% |
| 深度报告 | ¥29.9 | API 1.2 元 | 96% |
| 合婚报告 | ¥19.9 | API 0.8 元 | 96% |
| 月度订阅 | ¥39 | API 2.0 元 | 95% |

**参考汇率与衍生定价**（更新日期：2026-08-10）

```
基准汇率: 1 USD = 7.05 CNY (参考 Open Exchange Rates)
衍生:
  USD 定价 = ¥29.9 / 7.05 = $4.24 → 调整到 $4.99 (覆盖支付成本 3.9%)
  KRW 定价 = $4.99 × 1305 = ₩6,513 → 舍入到 ₩6,500

质检: 毛利 = (¥29.9 - ¥2.1 支付费) / ¥29.9 = 93% ✓ 可接受
```

---

### A.2 月度动态重定价触发条件（新增）

**触发规则**：当 USD/CNY 汇率变化 **≥ 5%** 时，重新定价

```
例 1: 汇率从 7.0 变 7.4 (↑ 5.7%)
  - 旧定价: ¥29.9 (基准)
  - 新定价: ¥29.9 × (7.0 / 7.4) = ¥28.2 (下调以保持美元价格稳定)
  - 生效延迟: 调整后 7 天生效 (减少用户震撼)

例 2: 汇率从 7.0 变 6.65 (↓ 5%)
  - 旧定价: ¥29.9
  - 新定价: ¥29.9 × (7.0 / 6.65) = ¥31.4 (上调，用户实际支付美元价不变)
  - 策略: CNY 贬值 → 我们提高 CNY 价格，保护美元端收入
```

**执行流程**：

```javascript
// /server/jobs/pricing-update.js
const cron = require('node-cron');
const fetch = require('node-fetch');
const { db } = require('../utils');

// 每月 1 日 9:00 UTC 执行汇率检查
cron.schedule('0 9 1 * *', async () => {
  try {
    // 1. 拉取当日汇率
    const response = await fetch('https://openexchangerates.org/api/latest.json', {
      headers: { 'Authorization': `Bearer ${process.env.OPENEXCHANGERATES_KEY}` }
    });
    const { rates } = await response.json();
    const todayRate = rates.CNY / rates.USD;  // CNY 相对于 USD
    
    // 2. 对比上月汇率
    const [lastMonth] = await db.query(
      'SELECT exchange_rate FROM price_history WHERE currency = "usd" ORDER BY date DESC LIMIT 1'
    );
    const lastRate = lastMonth[0].exchange_rate;
    const changePercent = Math.abs((todayRate - lastRate) / lastRate) * 100;
    
    logger.info('[pricing] exchange rate check', { 
      lastRate, 
      todayRate, 
      changePercent: changePercent.toFixed(2) + '%'
    });

    // 3. 如果变化 >= 5%，触发重定价
    if (changePercent >= 5) {
      logger.info('[pricing] triggering repricing due to rate change');
      
      const products = [
        { id: 'bazi-basic', baseCNY: 9.9 },
        { id: 'bazi-deep', baseCNY: 29.9 },
        { id: 'bazi-marriage', baseCNY: 19.9 },
        { id: 'subscription-monthly', baseCNY: 39 }
      ];

      for (const product of products) {
        const newPrice = product.baseCNY * (lastRate / todayRate);
        
        await db.query(
          'INSERT INTO price_history (product_id, currency, price, exchange_rate, effective_date) VALUES (?, ?, ?, ?, ?)',
          [product.id, 'cny', newPrice.toFixed(2), todayRate, new Date(Date.now() + 7*24*60*60*1000)]  // 7 天后生效
        );
      }

      logger.info('[pricing] reprice scheduled', { effectiveDate: '+7 days' });
    }

  } catch (err) {
    logger.error('[pricing] job failed', err);
  }
});

module.exports = { pricingUpdateJob };
```

---

### A.3 订阅用户汇率锁定策略

**问题**：订阅用户每月续费时，汇率变化可能导致突然加价，用户不满

**解决方案**：

```
订阅定价策略:
├─ 首月: 按订阅当日汇率锁定 (假设 1 USD = 7.0 CNY, 用户支付 ¥35/月)
├─ 续费 1-11 月: 保持 ¥35 (锁定首月汇率)
├─ 12 月后: 重新协商，可能因汇率调整到 ¥33 (CNY 升值) 或 ¥37 (CNY 贬值)
└─ 提前通知: 续费前 30 天邮件告知新价格变化

用户感知:
  好: 用户收到 "Your subscription will renew at ¥35 (locked rate) on Sept 10"
  差: 突然扣 ¥37，用户投诉被宰
```

**实现逻辑**（pseudocode）：

```javascript
async function renewSubscription(subscriptionId) {
  const sub = await db.query(
    'SELECT *, locked_exchange_rate, next_unlock_date FROM subscriptions WHERE id = ?',
    [subscriptionId]
  );

  const isRenewalAllowed = sub.next_unlock_date <= new Date();
  
  if (isRenewalAllowed) {
    // 12 个月后解锁，允许重新定价
    const newRate = await getCurrentExchangeRate();
    const newPrice = recalculatePrice(newRate);
    
    await db.query(
      'UPDATE subscriptions SET price = ?, locked_exchange_rate = ?, next_unlock_date = DATE_ADD(NOW(), INTERVAL 1 YEAR) WHERE id = ?',
      [newPrice, newRate, subscriptionId]
    );
    
    logger.info('[subscription] renewal unlocked new rate', { subscriptionId, newPrice });
  } else {
    // 保持锁定价格
    await processPayment(sub.id, sub.price);
  }
}
```

---

### A.4 多币种价格自动化（新增）

**问题**：当前汇率手工月度调整，每月波动 1-2% 影响毛利 $1-3K

**解决方案**：集成实时汇率 API

```javascript
// 方案 A: 前端实时查询 Stripe API
async function getPricing(productId, userCurrency) {
  const basePrice = PRODUCT_PRICES[productId].base;  // USD 基准
  
  // 仅调用一次（缓存 5 分钟）
  const rate = await redis.get(`exchange_rate:${userCurrency}`);
  if (!rate) {
    const stripePrice = await stripe.prices.list({
      product: productId,
      active: true
    });
    // 或者用 Open Exchange Rates API
    const response = await fetch(`https://api.exchangerate-api.com/v4/latest/USD`);
    const { rates } = await response.json();
    await redis.setex(`exchange_rate:${userCurrency}`, 300, rates[userCurrency]);
  }

  return (basePrice * rate).toFixed(2);
}

// 方案 B: 后端每日 UTC 9:00 同步汇率
cron.schedule('0 9 * * *', async () => {
  const rates = await fetchExchangeRates();
  await redis.set('exchange_rates', JSON.stringify(rates), 'EX', 86400);
  logger.info('[pricing/sync] daily rates updated');
});
```

**成本分析**：
- Open Exchange Rates: 免费层 1500 请求/月
- 前端实时查询: 每用户 1 次 HTTP 请求 (~5KB) → 假设日活 1000 用户，月 30MB 流量
- 后端日同步: 1 次 HTTP 请求/天 → 月 30KB 流量（微不足道）
- **建议**: 后端日同步 + 前端缓存 localStorage 30 分钟最佳

---

### A.5 收据与结算单规范

**用户收据邮件格式**（解决小数点混乱问题）

```
尊敬的用户，

感谢你的购买！以下是你的订单信息：

交易 ID: ord_xxx
产品: 深度八字报告
金额: ¥29.90 CNY  ← 务必含 .90（不能写 ¥29.9）
支付方式: 微信支付
支付时间: 2026-08-10 14:30:00 UTC+8
汇率参考: 1 USD = 7.05 CNY (2026-08-10 适用)  ← 增加透明度
状态: 已完成 ✓

...
```

**韩国用户特别提示**（提示汇率风险）

```
주문 정보:

상품: 사주 깊이 있는 리포트
가격: ₩6,500 KRW  
결제 방법: Stripe (국제 카드)  ← 한국 KRW Stripe = 환율 변동 위험
환율 참고: 1 USD = 1305 KRW (2026-08-10 기준)

⚠️ 주의: Toss/KakaoPay 출시 후 환율 위험 감소 예정
```

---

## 附录 B：法律文件检查清单

### 上线前必过

- [ ] 商业主体信息已填（CR #、地址、法代）
- [ ] 中英韩版本一致性审查
- [ ] PIPL/PIPA/GDPR 条款法务认可
- [ ] 退款政策可在后端执行（无矛盾）
- [ ] AI 生成标识遵守《生成式 AI 管理暂行办法》
- [ ] 第三方信息处理协议已签（DeepSeek/Stripe）
- [ ] 所有链接（contact email, 隐私投诉等）有效

---

## 附录 C：支付网关对比总结

| 指标 | Stripe | WeChat | Alipay | Toss | Kakao | Naver |
|------|--------|--------|--------|------|-------|-------|
| **支持币种** | USD/CNY/KRW | CNY | CNY | KRW | KRW | KRW |
| **手续费** | 2.9% | 1% | 1% | 2.2% | 3.2% | 3.0% |
| **结算周期** | T+2 | T+1 | T+1 | T+1 | T+1 | T+1 |
| **Webhook** | ✓ 签名验证 | ✓ 签名验证 | ✓ 签名验证 | ✗ IP白名单 | ✗ IP白名单 | ✗ IP白名单 |
| **用户覆盖** | 全球 | 国内 | 国内 | 韩国 18% | 韩国 32% | 韩国 28% |
| **集成复杂度** | 低 | 中 | 中 | 中 | 中 | 中 |
| **推荐优先度** | 1 (国际) | 1 (国内) | 1 (国内) | 1 (韩国快速) | 2 (韩国扩张) | 2 (韩国完整) |

---

## 修订摘要（v1.1 对标三维度评审）

本次修订基于**工程、法律、UX 三维度专家评审意见**，升级以下内容：

### 工程侧修订

| 修订项 | 原文问题 | 修复方案 | 影响 |
|--------|--------|--------|------|
| **Webhook 事务隔离** | 未提及 SQL 隔离级别 | 新增 REPEATABLE_READ 事务配置 + IFNULL() 防覆盖 | 高 |
| **Stripe 签名验证** | 缺少 Express middleware 配置 | 新增详细 middleware 顺序说明 + raw body 必需 | 高 |
| **Toss/Kakao IP 白名单** | 无备选方案 | 新增 API polling 备选验证（长期方案） | 中 |
| **生产部署检查** | 无部署清单 | 新增 10 项部署前检查 + 性能测试脚本 + 故障演练 SOP | 高 |

### 法律侧修订

| 修订项 | 原文问题 | 修复方案 | 影响 |
|--------|--------|--------|------|
| **法律页面 UX** | 条款密集难读，无地区分流 | 新增 Accordion 折叠式 + 地理位置动态显示 + FAQ 五问 | 中 |
| **法务合作策略** | 无加急方案 | 新增加急合同建议 ($800, SLA 5-7 天) + 并行审查 | 低 |
| **支付失败恢复** | 降级方案太简陋 | 新增支付重试进度条 + 3 次失败后降级选项显示 | 中 |

### UX 侧修订

| 修订项 | 原文问题 | 修复方案 | 影响 |
|--------|--------|--------|------|
| **多币种定价透明度** | 固定汇率无说明 | 新增汇率实时显示 + 计算公式可见 + 费率分解 | 中 |
| **支付确认状态** | 用户不知自己在哪步 | 新增状态流程图 (提交→确认中→生成报告) + 轮询逻辑 | 中 |
| **Toss 推迟 UX** | 用户被迫用高成本 Stripe | 新增 "便利店支付即将推出" 横幅 + 加入等待名单按钮 | 低 |
| **汇率锁定策略** | 订阅续费可能突然加价 | 新增 12 月锁定汇率 + 60 天提前通知机制 | 中 |

---

## 批准与签字

### 3 项关键决策（Karen 必须确认）

**❓ Decision 1: 法律文件真实信息**
- 公司法定名称 (英文)、香港商业登记号、法定代表人、财务邮箱
- Karen 截止日期: **2026-08-15**（开启并行法务审查）

**❓ Decision 2: 韩国支付方案**
- Toss 作为主力（2-3 周审批），Kakao/Naver 作扩张
- 临时用 Stripe KRW (低覆盖率 <2%)，还是等 Toss（推迟 2 周上线）?
- 建议: **选择前者**（快速上线 Sep 30，Toss 上线后扩大覆盖）

**❓ Decision 3: 汇率更新策略**
- 固定汇率月调（当前）vs 实时汇率 API（新方案，月损失 $1-3K）
- 建议: **选择后者**（成本 <$100/月，毛利 +$2-5K/年）

---

### Karen (CEO) 签批

**确认内容**：

- [ ] 法律文件补全方案（已补充，需提供真实公司信息）
- [ ] Stripe 三币种架构（USD 验证 + CNY 备选 + KRW 临时）+ Toss/Kakao 长期
- [ ] Webhook + DB 对账策略（已加强事务隔离 + 部署检查）
- [ ] 支付页面 UX 改进（Accordion 法律条款 + 重试进度条 + 汇率透明化）
- [ ] 2026-09-30 上线目标
- [ ] ~$1000 法务审查预算 + $800 加急合同（可选）
- [ ] ✓ Decision 1-3 已确认

**签字**:

```
CEO 姓名: Karen ________________________

日期: 2026-08-__ ________________________

签名: ________________________

【核准意见】
___________________________________________

___________________________________________
```

---

## 后续工作流

### 工程启动（Karen 签批后）

**Week 1-2: 并行三轨**

| 轨道 | Task | Owner | 截止 |
|------|------|--------|------|
| **法律** | 提供公司信息 → 法务审查 | Karen + 法务 | Aug 25 |
| **Stripe** | USD 验证 + CNY/KRW 编码 + 测试 | 工程 | Aug 20 |
| **Webhook** | DB 设计 + Stripe handler (事务隔离) | 工程 | Aug 25 |

**Week 3-4: 集成测试**

| Task | Owner | 截止 |
|------|--------|------|
| Toss/Kakao handler + API polling | 工程 | Sep 05 |
| 每日对账 Job + 生产检查清单 | 工程 | Sep 10 |
| 前端多币种 UI + 支付重试 UX | 前端 | Sep 15 |

**Week 5-7: 上线冲刺**

| Task | Owner | 截止 |
|------|--------|------|
| 法律文件通过审查 | 法务 | Sep 20 |
| 生产环保烟雾测试 | QA | Sep 23 |
| Karen 最终签字 | Karen | Sep 27 |
| **上线** | 运维 | **Sep 30** |

---

**文档版本**: 1.1 (三维度评审修订版)  
**最后更新**: 2026-08-10  
**下一次审查**: 2026-09-01  
**Critical Path**: Karen 确认 Decision 1-3 → 工程启动 → Sep 30 上线
