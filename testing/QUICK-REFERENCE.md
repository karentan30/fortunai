# 善缘支付系统 - 快速参考手册

## 文件导航

| 文件 | 用途 | 场景 |
|------|------|------|
| `test-payment-invite-toolkit.sh` | 集成测试工具 | 全量测试套件 |
| `quick-start.sh` | 5 分钟体验 | 快速验证系统 |
| `advanced-scenarios.sh` | 高级场景模拟 | 真实业务场景 |
| `payment_test_utils.py` | Python 工具库 | 离线计算和模拟 |
| `README.md` | 完整文档 | 深入学习 |

---

## 快速命令

### 1️⃣ 开始测试

```bash
# 方案 A: 快速 5 分钟体验（推荐新手）
./testing/quick-start.sh http://localhost:3000 your-admin-token

# 方案 B: 完整测试套件（30 分钟）
./testing/test-payment-invite-toolkit.sh http://localhost:3000 your-admin-token

# 方案 C: 高级业务场景（深度测试）
./testing/advanced-scenarios.sh http://localhost:3000 your-admin-token
```

### 2️⃣ 生成邀请码

```bash
# 生成 100 个邀请码到文件
python3 testing/payment_test_utils.py generate-refcodes 100 \
  --output /tmp/codes.txt \
  --base-url "https://shenyuan.mylumee.cn"

# 生成带前缀的邀请码
python3 testing/payment_test_utils.py generate-refcodes 50 \
  --prefix "SUMMER2024-"
```

### 3️⃣ 计算返佣

```bash
# 单笔返佣
python3 testing/payment_test_utils.py calculate-commission \
  --amount 49.00 --rate 0.15

# 批量返佣计算
python3 testing/payment_test_utils.py simulate-payment \
  --product bazi_full --ref-code PROMO01 --commission-rate 0.20
```

### 4️⃣ Webhook 签名

```bash
# 生成 Stripe 签名
python3 testing/payment_test_utils.py stripe-webhook generate \
  --secret whsec_test123 \
  --payload '{"type":"charge.completed"}'

# 验证签名
python3 testing/payment_test_utils.py stripe-webhook verify \
  --secret whsec_test123 \
  --signature "t=...,v1=..." \
  --payload '{...}'

# 生成微信签名
python3 testing/payment_test_utils.py wechat-sign \
  --secret your_wx_secret \
  --params '{"appid":"wx123"}'
```

---

## 支付流程速查

### Stripe USD 购买

```bash
curl -X POST http://localhost:3000/api/create-checkout \
  -H "Content-Type: application/json" \
  -d '{
    "product": "bazi_full",
    "email": "user@example.com",
    "region": "us",
    "ref_code": "PROMO001"
  }' | jq '.url'
```

### 微信支付

```bash
# 1. 创建订单获取二维码
curl -X POST http://localhost:3000/pay/wechat/create \
  -H "Content-Type: application/json" \
  -d '{"product": "bazi_full", "channel": "wechat"}' | jq '.code_url'

# 2. 查询订单状态
curl "http://localhost:3000/pay/wechat/query?out_trade_no=sy_wx_xxx"
```

### 邀请和返佣

```bash
# 1. 创建推广渠道
curl -X POST http://localhost:3000/api/admin/affiliate/create \
  -H "X-Admin-Token: $TOKEN" \
  -d '{"name":"渠道名","code":"PROMO001","commission_rate":0.15}'

# 2. 追踪邀请链接
curl http://localhost:3000/api/affiliate/track?ref=PROMO001

# 3. 发起支付（带邀请码）
curl -X POST http://localhost:3000/api/create-checkout \
  -d '{"product":"bazi_full","ref_code":"PROMO001"}'

# 4. 查询返佣统计
curl http://localhost:3000/api/admin/affiliate/list \
  -H "X-Admin-Token: $TOKEN" | jq '.affiliates[]'
```

---

## 产品价格表

| 产品 ID | 名称 | USD | 返佣（15%） |
|---------|------|-----|-----------|
| bazi_full | 完整命盘 | $19.90 | $2.99 |
| bazi_vip | 深度批命 | $39.90 | $5.99 |
| member_monthly | 月度会员 | $6.90 | $1.04 |
| member_yearly | 年度会员 | $49.00 | $7.35 |
| hehun | 合婚配对 | $19.90 | $2.99 |
| tarot | 塔罗占卜 | $3.90 | $0.59 |
| joss_basic | 代烧·基础 | $49.90 | $7.49 |

---

## 常见场景代码片段

### 场景 1: 完整支付→返佣流程

```bash
#!/bin/bash
API="http://localhost:3000"
TOKEN="admin-token"
AFF="WAVE001"

# 创建推广渠道
curl -s -X POST "$API/api/admin/affiliate/create" \
  -H "X-Admin-Token: $TOKEN" \
  -d "{\"name\":\"Wave渠道\",\"code\":\"$AFF\",\"commission_rate\":0.20}" >/dev/null

# 用户点击邀请链接
curl -s "$API/api/affiliate/track?ref=$AFF" >/dev/null

# 用户支付
ORDER=$(curl -s -X POST "$API/api/create-checkout" \
  -d "{\"product\":\"bazi_full\",\"email\":\"user@test.local\",\"ref_code\":\"$AFF\"}")

# 查询返佣
curl -s "$API/api/admin/affiliate/stats/$AFF" -H "X-Admin-Token: $TOKEN" | jq '.'
```

### 场景 2: 批量生成邀请码和自动注册

```bash
#!/bin/bash
API="http://localhost:3000"
TOKEN="admin-token"

python3 testing/payment_test_utils.py generate-refcodes 50 --prefix "WAVE" | \
while read CODE; do
  curl -s -X POST "$API/api/admin/affiliate/create" \
    -H "X-Admin-Token: $TOKEN" \
    -d "{\"name\":\"$CODE\",\"code\":\"$CODE\",\"commission_rate\":0.15}" &
  sleep 0.1
done
```

### 场景 3: 返佣对账报告

```python
from testing.payment_test_utils import CommissionCalculator

# 从数据库读取所有订单
orders = [
    {'amount_usd': 19.90, 'commission_rate': 0.15, 'ref_code': 'WAVE001'},
    {'amount_usd': 49.00, 'commission_rate': 0.20, 'ref_code': 'WAVE001'},
    {'amount_usd': 6.90,  'commission_rate': 0.10, 'ref_code': 'WAVE002'},
]

result = CommissionCalculator.calculate_batch_commission(orders)

# 生成对账报告
for code, stats in result['by_affiliate'].items():
    print(f"{code}: 订单 {stats['count']} 笔，"
          f"收入 ${stats['revenue']:.2f}，"
          f"返佣 ${stats['commission']:.2f}")
```

---

## 环境变量速查

```bash
# 配置文件
export API_BASE="http://localhost:3000"
export ADMIN_TOKEN="your-token"
export STRIPE_SECRET="sk_test_..."
export WX_SECRET="your_wx_secret"

# 然后运行
./testing/quick-start.sh
```

---

## 错误代码和解决方案

| 错误 | 原因 | 解决方案 |
|------|------|--------|
| 401 Unauthorized | 缺少或错误的 token | 检查 `ADMIN_TOKEN` |
| 503 Service Unavailable | 支付系统未配置 | 确认 Stripe 密钥已设置 |
| curl: command not found | 未安装 curl | `brew install curl` |
| jq: command not found | 未安装 jq | `brew install jq` |
| 连接超时 | API 服务器未运行 | 检查服务器状态 |

---

## 性能基准

| 操作 | 平均时间 | 说明 |
|------|--------|------|
| 创建 Stripe checkout | 200ms | API 调用 |
| 创建微信订单 | 150ms | 生成二维码 |
| 创建 affiliate | 50ms | 本地操作 |
| 查询统计 | 100ms | 数据库查询 |
| 计算返佣 | <1ms | 离线计算 |

---

## 常见问题速答

**Q: 邀请码会过期吗？**
A: 邀请信息（inviteId）24 小时过期。但邀请码（ref_code）永不过期。

**Q: 返佣什么时候到账？**
A: 支付完成后立即记录，但需要管理员标记为已结算（payout）才能提现。

**Q: 支持哪些货币？**
A: USD（国际）、CNY（中国）、KRW（韩国）。

**Q: 最高返佣比例是多少？**
A: 默认上限 30%。可在代码中修改。

**Q: 可以同时支持多个邀请码吗？**
A: 支持。用户点击任何邀请链接都会记录。

**Q: Webhook 签名如何验证？**
A: 使用 `payment_test_utils.py` 中的 `StripeWebhookSigner.verify_signature()`。

---

## 下一步

1. **快速开始** → 运行 `./quick-start.sh`
2. **深入学习** → 阅读 `README.md`
3. **高级测试** → 运行 `./advanced-scenarios.sh`
4. **集成代码** → 复用 `payment_test_utils.py`

---

**版本**: 1.0  
**最后更新**: 2024-08-08  
**维护者**: Karen Tan
