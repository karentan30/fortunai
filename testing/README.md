# 善缘支付和邀请系统 - 自动化测试工具箱

完整的本地测试套件，无需登录即可测试支付、邀请、返佣全链路。

## 工具清单

### 1️⃣ Shell 脚本工具箱 (`test-payment-invite-toolkit.sh`)

集成式测试工具，包含以下模块：

- **Stripe 支付测试**
  - USD 单一购买（$19.90）
  - KRW 韩币订阅（₩9,900）
  - 订阅模式（月度/年度/季度）

- **微信支付**
  - 订单创建和二维码生成
  - Webhook 回调签名验证
  - 订单查询轮询

- **邀请和返佣**
  - 邀请链接追踪
  - Affiliate 创建和统计
  - 完整支付流程返佣追踪
  - 邀请信息保存和读取

- **返佣计算验证**
  - 单笔返佣计算
  - 批量计算示例

- **批量数据生成**
  - 100 个邀请码生成
  - Affiliate 自动注册

- **网关健康检查**
  - 支付方式可用性检测

- **Webhook 安全测试**
  - 无效签名拒绝测试

### 2️⃣ Python 工具库 (`payment_test_utils.py`)

可复用的 Python 模块，支持命令行和代码库两种用法。

#### 核心功能类

- **StripeWebhookSigner** - Stripe webhook 签名生成和验证
- **WeChatPaymentSigner** - 微信支付 XML 处理和签名
- **AlipayPaymentSigner** - 支付宝签名（MD5）
- **ReferralCodeGenerator** - 邀请码生成（单个/批量）
- **CommissionCalculator** - 返佣计算和验证
- **PaymentSimulator** - 支付流程模拟

---

## 快速开始

### 前置要求

```bash
# 检查依赖
which curl    # ✓
which jq      # ✓ JSON 处理
which python3 # ✓
bc --version  # ✓ 计算器（可选）

# Python 依赖（标准库，无需额外安装）
python3 -c "import json, hmac, hashlib; print('✓ 准备就绪')"
```

### 步骤 1: 设置权限

```bash
chmod +x /Users/karen/projects/shenyuan/testing/test-payment-invite-toolkit.sh
chmod +x /Users/karen/projects/shenyuan/testing/payment_test_utils.py
```

### 步骤 2: 运行完整测试套件

```bash
# 针对本地开发服务器
./testing/test-payment-invite-toolkit.sh \
  http://localhost:3000 \
  your-admin-token-here

# 针对生产环境（需要有效的 keys）
./testing/test-payment-invite-toolkit.sh \
  https://shenyuan.mylumee.cn \
  ${ADMIN_TOKEN}
```

### 步骤 3: 运行特定测试

```bash
cd /Users/karen/projects/shenyuan

# 使用 Python 工具生成邀请码
python3 testing/payment_test_utils.py generate-refcodes 50 \
  --output /tmp/refcodes.txt \
  --base-url "https://shenyuan.mylumee.cn"

# 计算返佣
python3 testing/payment_test_utils.py calculate-commission \
  --amount 49.00 --rate 0.15

# 模拟支付流程
python3 testing/payment_test_utils.py simulate-payment \
  --product bazi_full --ref-code PROMO01 --commission-rate 0.20
```

---

## 详细用法

### 📱 Stripe 支付测试

#### 创建 USD 单一购买

```bash
# 使用 curl 直接调用
curl -X POST http://localhost:3000/api/create-checkout \
  -H "Content-Type: application/json" \
  -d '{
    "product": "bazi_full",
    "email": "test@example.com",
    "donorName": "Test User",
    "contact": "contact@example.com",
    "region": "us"
  }' | jq '.url'
```

**响应示例：**
```json
{
  "url": "https://checkout.stripe.com/pay/cs_...",
  "sessionId": "cs_...",
  "orderNo": "SY-1234567890-abc123"
}
```

#### 创建订阅

```bash
# 月度会员（USD $6.90/month）
curl -X POST http://localhost:3000/api/create-checkout \
  -H "Content-Type: application/json" \
  -d '{
    "product": "member_monthly",
    "email": "subscriber@example.com",
    "region": "us"
  }'

# 年度会员（USD $49.00/year）
curl -X POST http://localhost:3000/api/create-checkout \
  -H "Content-Type: application/json" \
  -d '{
    "product": "member_yearly",
    "email": "subscriber@example.com",
    "region": "us"
  }'
```

### 💳 微信支付测试

#### 创建订单获取二维码

```bash
curl -X POST http://localhost:3000/pay/wechat/create \
  -H "Content-Type: application/json" \
  -d '{
    "product": "bazi_full",
    "channel": "wechat"
  }' | jq '.code_url'
```

#### 查询订单状态

```bash
OUT_TRADE_NO="sy_wx_1234567890"

curl "http://localhost:3000/pay/wechat/query?out_trade_no=$OUT_TRADE_NO" | jq '.'
```

**响应示例：**
```json
{
  "status": "pending"  // 或 "paid"
}
```

#### 模拟微信支付回调

```bash
# 生成测试 XML
python3 testing/payment_test_utils.py wechat-notify \
  --order-no "sy_wx_1234567890" \
  --amount 3990 \
  --transaction-id "1234567890123456789"

# 发送到 webhook 端点
curl -X POST http://localhost:3000/pay/wechat/notify \
  -H "Content-Type: application/xml" \
  -d @wechat_notify.xml
```

### 🔗 邀请系统测试

#### 创建邀请码并追踪

```bash
# 1. 创建 affiliate
curl -X POST http://localhost:3000/api/admin/affiliate/create \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: your-admin-token" \
  -d '{
    "name": "推广渠道名",
    "code": "PROMO001",
    "commission_rate": 0.15
  }' | jq '.'

# 2. 用户点击邀请链接（模拟）
curl -L http://localhost:3000/api/affiliate/track?ref=PROMO001

# 3. 查询邀请码统计
curl http://localhost:3000/api/admin/affiliate/stats/PROMO001 \
  -H "X-Admin-Token: your-admin-token" | jq '.'
```

#### 完整返佣流程

```bash
# 用户通过邀请码发起支付
curl -X POST http://localhost:3000/api/create-checkout \
  -H "Content-Type: application/json" \
  -d '{
    "product": "bazi_full",
    "email": "user@example.com",
    "ref_code": "PROMO001"  # 关键：带上邀请码
  }'

# 支付完成后，查询推广者的返佣统计
curl http://localhost:3000/api/admin/affiliate/list \
  -H "X-Admin-Token: your-admin-token" | \
  jq '.affiliates[] | select(.code == "PROMO001")'
```

**返佣数据结构：**
```json
{
  "code": "PROMO001",
  "name": "推广渠道名",
  "commission_rate": 0.15,
  "clicks": 10,
  "orders_total": 5,
  "orders_paid": 3,
  "revenue_usd": 119.70,
  "commission_total": 17.96,
  "commission_pending": 17.96  // 未结算
}
```

#### 邀请信息保存（用于合婚/配对）

```bash
# 保存邀请信息
curl -X POST http://localhost:3000/api/invite/save \
  -H "Content-Type: application/json" \
  -d '{
    "inviterName": "张三（邀请者）",
    "nameA": "李四（被邀请者）",
    "p1Year": 1990,
    "p1Month": 6,
    "p1Day": 15,
    "p1Hour": 14,
    "p1Gender": "M",
    "mode": "marriage"
  }' | jq '.inviteId'

# 查询邀请信息
INVITE_ID="ABC123"
curl http://localhost:3000/api/invite/$INVITE_ID | jq '.'
```

### 💰 返佣计算

#### 简单计算

```bash
python3 testing/payment_test_utils.py calculate-commission \
  --amount 19.90 --rate 0.15

# 输出:
# Amount: $19.90
# Commission Rate: 15%
# Commission: $2.99
```

#### 批量计算示例

```python
from testing.payment_test_utils import CommissionCalculator

orders = [
    {'amount_usd': 19.90, 'commission_rate': 0.15, 'ref_code': 'PROMO01'},
    {'amount_usd': 49.00, 'commission_rate': 0.20, 'ref_code': 'PROMO01'},
    {'amount_usd': 6.90,  'commission_rate': 0.10, 'ref_code': 'PROMO02'},
]

result = CommissionCalculator.calculate_batch_commission(orders)
print(result)
# 输出:
# {
#   'total_orders': 3,
#   'total_revenue': 75.80,
#   'total_commission': 13.33,
#   'by_affiliate': {
#     'PROMO01': {'count': 2, 'revenue': 68.90, 'commission': 12.83},
#     'PROMO02': {'count': 1, 'revenue': 6.90, 'commission': 0.69}
#   }
# }
```

### 🔐 Webhook 签名验证

#### Stripe 签名生成

```bash
python3 testing/payment_test_utils.py stripe-webhook generate \
  --secret whsec_test123 \
  --payload '{"type":"charge.completed","data":{}}'

# 输出:
# Signature: t=1234567890,v1=abc123def456...
```

#### Stripe 签名验证

```bash
python3 testing/payment_test_utils.py stripe-webhook verify \
  --secret whsec_test123 \
  --signature "t=1234567890,v1=abc123def456..." \
  --payload '{"type":"charge.completed","data":{}}'

# 输出:
# Valid: True
# Message: 签名有效
```

#### 微信签名生成

```bash
python3 testing/payment_test_utils.py wechat-sign \
  --secret your_wx_secret \
  --params '{"appid":"wx123","mch_id":"456","amount":100}'

# 输出:
# Params: {...}
# Sign: 0123456789ABCDEF
```

---

## 批量测试数据生成

### 生成 100 个邀请码

```bash
python3 testing/payment_test_utils.py generate-refcodes 100 \
  --output /tmp/refcodes.txt \
  --base-url "https://shenyuan.mylumee.cn"

# 查看前 10 个
head -10 /tmp/refcodes.txt
```

### 带前缀的邀请码

```bash
python3 testing/payment_test_utils.py generate-refcodes 50 \
  --prefix "SUMMER2024-" \
  --output /tmp/summer_codes.txt

# 输出:
# SUMMER2024-0000
# SUMMER2024-0001
# ...
# SUMMER2024-0049
```

### 在脚本中批量创建 Affiliates

```bash
#!/bin/bash
API_BASE="http://localhost:3000"
ADMIN_TOKEN="your-token"

python3 testing/payment_test_utils.py generate-refcodes 50 \
  --prefix "WAVE" | while read CODE; do
  
  curl -s -X POST "$API_BASE/api/admin/affiliate/create" \
    -H "Content-Type: application/json" \
    -H "X-Admin-Token: $ADMIN_TOKEN" \
    -d "{
      \"name\": \"推广 - $CODE\",
      \"code\": \"$CODE\",
      \"commission_rate\": 0.15
    }"
  
  sleep 0.2  # 避免过快
done
```

---

## 常见用例

### 用例 1: 测试完整支付→返佣流程

```bash
#!/bin/bash

API_BASE="http://localhost:3000"
ADMIN_TOKEN="test-token"

# 步骤 1: 创建 affiliate
REF_CODE="TEST_$(date +%s)"
curl -s -X POST "$API_BASE/api/admin/affiliate/create" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -d "{\"name\":\"Test\",\"code\":\"$REF_CODE\",\"commission_rate\":0.20}" | jq '.'

# 步骤 2: 用户点击邀请链接
echo "追踪邀请链接..."
curl -s "$API_BASE/api/affiliate/track?ref=$REF_CODE" >/dev/null

# 步骤 3: 发起支付
echo "发起支付..."
CHECKOUT=$(curl -s -X POST "$API_BASE/api/create-checkout" \
  -H "Content-Type: application/json" \
  -d "{
    \"product\":\"bazi_full\",
    \"email\":\"test@example.com\",
    \"ref_code\":\"$REF_CODE\"
  }")

ORDER_NO=$(echo "$CHECKOUT" | jq -r '.orderNo')
echo "订单号: $ORDER_NO"

# 步骤 4: 查询返佣统计
sleep 1
echo "查询返佣统计..."
curl -s "$API_BASE/api/admin/affiliate/stats/$REF_CODE" \
  -H "X-Admin-Token: $ADMIN_TOKEN" | jq '.'
```

### 用例 2: 测试微信支付通知回调

```bash
#!/bin/bash

API_BASE="http://localhost:3000"

# 创建订单
ORDER=$(curl -s -X POST "$API_BASE/pay/wechat/create" \
  -H "Content-Type: application/json" \
  -d '{"product":"bazi_full","channel":"wechat"}')

OUT_TRADE_NO=$(echo "$ORDER" | jq -r '.out_trade_no')
echo "订单号: $OUT_TRADE_NO"

# 模拟微信支付完成
echo "模拟支付完成..."
python3 testing/payment_test_utils.py wechat-notify \
  --order-no "$OUT_TRADE_NO" \
  --amount 3990 \
  --transaction-id "wx$(date +%s)" | \
  curl -s -X POST "$API_BASE/pay/wechat/notify" \
    -H "Content-Type: application/xml" \
    -d @-

# 查询订单状态
echo "查询订单状态..."
curl -s "$API_BASE/pay/wechat/query?out_trade_no=$OUT_TRADE_NO" | jq '.'
```

### 用例 3: 模拟多渠道推广对比

```bash
python3 << 'EOF'
from testing.payment_test_utils import (
    ReferralCodeGenerator, CommissionCalculator, PaymentSimulator
)

# 三个推广渠道
channels = [
    {'code': 'ORGANIC', 'rate': 0.10, 'orders': 5},
    {'code': 'SOCIAL', 'rate': 0.15, 'orders': 12},
    {'code': 'PARTNER', 'rate': 0.20, 'orders': 8},
]

print("推广渠道对比分析")
print("=" * 60)

for channel in channels:
    code = channel['code']
    rate = channel['rate']
    count = channel['orders']
    
    # 模拟订单
    orders = []
    for i in range(count):
        flow = PaymentSimulator.simulate_payment_flow(
            'bazi_full', code, rate
        )
        orders.append({
            'amount_usd': flow['order']['amount_usd'],
            'commission_rate': rate,
            'ref_code': code
        })
    
    # 计算返佣
    result = CommissionCalculator.calculate_batch_commission(orders)
    
    print(f"\n{code}:")
    print(f"  订单数: {result['total_orders']}")
    print(f"  收入: ${result['total_revenue']:.2f}")
    print(f"  返佣: ${result['total_commission']:.2f}")
    print(f"  ROI: {(result['total_commission']/result['total_revenue']*100):.1f}%")
EOF
```

---

## 环境变量配置

### 可选配置（提高测试覆盖度）

```bash
# Stripe 测试密钥
export STRIPE_TEST_SECRET_KEY="sk_test_..."

# 微信支付测试密钥
export WX_PAY_SECRET_KEY="your_wx_secret"

# 支付宝测试密钥
export ALIPAY_SECRET_KEY="your_alipay_secret"

# 管理员令牌
export ADMIN_TOKEN="your-admin-token"

# 然后运行测试
./testing/test-payment-invite-toolkit.sh \
  http://localhost:3000 \
  $ADMIN_TOKEN
```

---

## 调试技巧

### 查看完整 HTTP 请求/响应

```bash
# 添加 -v 标志到 curl
curl -v -X POST http://localhost:3000/api/create-checkout \
  -H "Content-Type: application/json" \
  -d '{"product":"bazi_full"}'

# 或使用 jq 的调试模式
curl -s ... | jq -r '.response // .'
```

### 检查支付网关日志

```bash
# 查看服务器日志
tail -f server.log | grep -E "PAYMENT|WEBHOOK|STRIPE|WECHAT"
```

### 验证返佣计算

```python
from testing.payment_test_utils import CommissionCalculator

order = {
    'amount_usd': 49.00,
    'commission_rate': 0.20
}

is_correct, msg = CommissionCalculator.verify_commission(order, 9.80)
print(msg)  # ✓ 返佣正确: $9.80 == $9.80
```

### 测试 JSON 处理

```bash
# 确保 jq 正确解析
echo '{"url":"https://example.com"}' | jq '.url'

# 处理特殊字符
curl ... | jq -r '.message // empty'
```

---

## 故障排除

### 问题 1: "curl: command not found"

```bash
# macOS
brew install curl

# Ubuntu/Debian
sudo apt-get install curl
```

### 问题 2: "jq: command not found"

```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq
```

### 问题 3: "无法连接到 API 服务器"

```bash
# 检查服务器是否运行
curl http://localhost:3000/api/products

# 检查 API_BASE 变量
echo $API_BASE

# 确认正确的地址和端口
./test-payment-invite-toolkit.sh https://your-domain.com your-token
```

### 问题 4: "401 Unauthorized"

```bash
# 检查 ADMIN_TOKEN
echo "Token: $ADMIN_TOKEN"

# 在请求中添加
curl ... -H "X-Admin-Token: $ADMIN_TOKEN"
```

### 问题 5: Webhook 签名验证失败

```bash
# 检查密钥是否正确
python3 testing/payment_test_utils.py stripe-webhook verify \
  --secret "你使用的密钥" \
  --signature "..." \
  --payload '{}'

# 常见原因：
# 1. 密钥不匹配
# 2. payload 中有空格或换行
# 3. 时间戳太旧（Stripe 拒绝 5 分钟外的请求）
```

---

## 最佳实践

✅ **DO**
- 每个测试运行前检查服务器健康
- 使用唯一的 `ref_code` 避免冲突
- 保存测试数据以便分析
- 在 CI/CD 中定期运行
- 记录失败的测试情况

❌ **DON'T**
- 不要在生产环境使用测试密钥
- 不要硬编码敏感信息
- 不要一次生成太多邀请码（会有 rate limiting）
- 不要忽略 webhook 签名验证
- 不要在 git 中提交密钥

---

## 集成到 CI/CD

### GitHub Actions 示例

```yaml
name: Payment System Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.10'

      - name: Install dependencies
        run: |
          sudo apt-get install -y curl jq bc

      - name: Start server
        run: npm start &
        env:
          NODE_ENV: test

      - name: Wait for server
        run: sleep 5 && curl http://localhost:3000/api/products

      - name: Run tests
        run: |
          ./testing/test-payment-invite-toolkit.sh \
            http://localhost:3000 \
            ${{ secrets.ADMIN_TOKEN }}
```

---

## 文件结构

```
testing/
├── test-payment-invite-toolkit.sh     # 集成式 Shell 测试工具
├── payment_test_utils.py              # Python 工具库
├── README.md                          # 本文档
└── examples/
    ├── complete_flow.sh               # 完整流程示例
    ├── batch_affiliate_create.sh       # 批量创建 Affiliate
    └── payment_simulation.py           # 支付模拟脚本
```

---

## 支持的产品清单

| 产品 ID | 名称 | USD | CNY | KRW |
|---------|------|-----|-----|-----|
| bazi_basic | 基础命盘 | $9.90 | ¥19.90 | - |
| bazi_full | 完整命盘 | $19.90 | ¥39.90 | ₩9,900 |
| bazi_vip | 深度批命 | $39.90 | ¥79.90 | ₩19,900 |
| member_monthly | 月度会员 | $6.90 | ¥19.90 | ₩12,900 |
| member_yearly | 年度会员 | $49.00 | ¥99.00 | - |
| hehun | 合婚配对 | $19.90 | ¥39.90 | ₩4,900 |
| tarot | 塔罗占卜 | $3.90 | ¥9.90 | - |
| joss_basic | 代烧·基础 | $49.90 | ¥199.00 | - |

---

## 许可和声明

这些工具仅用于开发和测试目的。在生产环境使用前，请确保：

- 所有密钥和 tokens 来自正确的环境
- webhook 签名验证已启用
- 支付金额限制已配置
- 返佣比例和上限已审核

---

## 常见问题

**Q: 可以在生产环境中运行这些测试吗？**
A: 不建议。建议在 staging 环境运行。如果必须在生产环境，请使用测试金额和明确的测试 ref_code。

**Q: 邀请码会过期吗？**
A: 邀请信息在 24 小时后过期（见 `server/routes/invite.js`）。支付链接不会过期，但订单会有过期机制。

**Q: 返佣何时计算？**
A: 订单支付完成时立即计算返佣（见 `completeAffiliateOrder` 函数）。标记为已结算（payout）是管理员操作。

**Q: 支持哪些货币？**
A: USD（国际）、CNY（中国）、KRW（韩国）。其他货币可通过设置默认转换率实现。

---

## 反馈和问题

遇到问题？请：

1. 检查 API 服务器日志
2. 使用 `curl -v` 查看 HTTP 细节
3. 验证环境变量设置
4. 查看本文档的"故障排除"部分
5. 联系技术团队

---

**最后更新:** 2024-08-08  
**工具版本:** 1.0  
**维护者:** Karen Tan (tan42204@gmail.com)
