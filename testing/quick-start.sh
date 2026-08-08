#!/bin/bash
#
# 快速开始脚本 - 5 分钟内测试完整支付和邀请系统
#
# 用法: ./quick-start.sh
#

set -e

API_BASE="${1:-http://localhost:3000}"
ADMIN_TOKEN="${2:-test-admin-token}"

echo "════════════════════════════════════════════════════════════"
echo "  5 分钟快速体验：支付 + 邀请 + 返佣"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "目标 API: $API_BASE"
echo "管理员 Token: ${ADMIN_TOKEN:0:10}...${ADMIN_TOKEN: -10}"
echo ""

# 颜色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

step() {
  echo ""
  echo -e "${BLUE}▶ 步骤 $1:${NC} $2"
}

log() {
  echo -e "${GREEN}  ✓${NC} $1"
}

# ═════════════════════════════════════════════════════════════
step 1 "检查 API 服务器连接"
# ═════════════════════════════════════════════════════════════

if curl -s "$API_BASE/api/products" | jq -e '.products' >/dev/null 2>&1; then
  log "API 服务器正常"
else
  echo "✗ 无法连接到 API 服务器: $API_BASE"
  exit 1
fi

# ═════════════════════════════════════════════════════════════
step 2 "创建推广渠道（Affiliate）"
# ═════════════════════════════════════════════════════════════

AFF_CODE="DEMO-$(date +%s)"

response=$(curl -s -X POST "$API_BASE/api/admin/affiliate/create" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -d "{
    \"name\": \"快速体验推广\",
    \"code\": \"$AFF_CODE\",
    \"commission_rate\": 0.20
  }")

if echo "$response" | jq -e '.ok' >/dev/null 2>&1; then
  log "推广渠道创建成功: $AFF_CODE"
else
  echo "✗ 推广渠道创建失败"
  echo "$response" | jq '.'
  exit 1
fi

# ═════════════════════════════════════════════════════════════
step 3 "用户点击邀请链接（追踪点击）"
# ═════════════════════════════════════════════════════════════

curl -s -L "$API_BASE/api/affiliate/track?ref=$AFF_CODE" >/dev/null
log "邀请链接点击已记录"

# ═════════════════════════════════════════════════════════════
step 4 "用户发起支付（带邀请码）"
# ═════════════════════════════════════════════════════════════

USER_EMAIL="demo-$(date +%s)@shenyuan.local"

checkout=$(curl -s -X POST "$API_BASE/api/create-checkout" \
  -H "Content-Type: application/json" \
  -d "{
    \"product\": \"bazi_full\",
    \"email\": \"$USER_EMAIL\",
    \"donorName\": \"快速体验用户\",
    \"contact\": \"demo@shenyuan.local\",
    \"ref_code\": \"$AFF_CODE\"
  }")

if echo "$checkout" | jq -e '.url' >/dev/null 2>&1; then
  ORDER_NO=$(echo "$checkout" | jq -r '.orderNo')
  CHECKOUT_URL=$(echo "$checkout" | jq -r '.url')
  log "支付链接创建成功"
  echo ""
  echo "  💳 Checkout URL: $CHECKOUT_URL"
  echo "  📋 Order No: $ORDER_NO"
else
  echo "✗ 支付链接创建失败"
  echo "$checkout" | jq '.'
  exit 1
fi

# ═════════════════════════════════════════════════════════════
step 5 "模拟支付完成并查看返佣计算"
# ═════════════════════════════════════════════════════════════

# 注意：实际支付需要完成 Stripe checkout，这里只是展示流程
log "支付完成后，返佣会自动计算"
echo ""
echo "  📊 返佣计算示例:"
echo "    订单金额: \$19.90 (完整命盘)"
echo "    返佣比例: 20%"
echo "    返佣金额: \$3.98"

# ═════════════════════════════════════════════════════════════
step 6 "查询推广渠道统计"
# ═════════════════════════════════════════════════════════════

sleep 1  # 等待数据同步

stats=$(curl -s -X GET "$API_BASE/api/admin/affiliate/stats/$AFF_CODE" \
  -H "X-Admin-Token: $ADMIN_TOKEN")

if echo "$stats" | jq -e '.affiliate' >/dev/null 2>&1; then
  clicks=$(echo "$stats" | jq -r '.affiliate.clicks')
  log "推广渠道统计:"
  echo "    渠道代码: $AFF_CODE"
  echo "    点击数: $clicks"
  echo ""
  echo "  完整统计数据:"
  echo "$stats" | jq '.affiliate'
else
  echo "⚠ 暂无统计数据（支付需完成）"
fi

# ═════════════════════════════════════════════════════════════
step 7 "生成批量邀请码（示例）"
# ═════════════════════════════════════════════════════════════

python3 << 'EOF'
from testing.payment_test_utils import ReferralCodeGenerator

codes = ReferralCodeGenerator.generate_batch(5)
print("  生成的邀请码:")
for code in codes:
  print(f"    {code} → https://shenyuan.mylumee.cn/?ref={code}")
EOF

# ═════════════════════════════════════════════════════════════
step 8 "计算返佣（离线）"
# ═════════════════════════════════════════════════════════════

python3 << 'EOF'
from testing.payment_test_utils import CommissionCalculator

# 示例订单
orders = [
  {'amount_usd': 19.90, 'commission_rate': 0.20, 'ref_code': 'DEMO'},
  {'amount_usd': 49.00, 'commission_rate': 0.20, 'ref_code': 'DEMO'},
  {'amount_usd': 6.90,  'commission_rate': 0.20, 'ref_code': 'DEMO'},
]

result = CommissionCalculator.calculate_batch_commission(orders)

print("  返佣汇总:")
print(f"    总订单数: {result['total_orders']}")
print(f"    总收入: ${result['total_revenue']:.2f}")
print(f"    总返佣: ${result['total_commission']:.2f}")
print(f"    平均比例: {result['average_commission_rate']*100:.0f}%")
EOF

# ═════════════════════════════════════════════════════════════
echo ""
echo "════════════════════════════════════════════════════════════"
echo -e "${GREEN}✓ 快速体验完成！${NC}"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "接下来可以："
echo ""
echo "1️⃣  完成 Stripe 支付"
echo "   访问: $CHECKOUT_URL"
echo ""
echo "2️⃣  运行完整测试套件"
echo "   ./testing/test-payment-invite-toolkit.sh $API_BASE $ADMIN_TOKEN"
echo ""
echo "3️⃣  生成更多邀请码"
echo "   python3 testing/payment_test_utils.py generate-refcodes 100 \\
     --output /tmp/codes.txt --base-url 'https://shenyuan.mylumee.cn'"
echo ""
echo "4️⃣  查看详细文档"
echo "   cat testing/README.md"
echo ""
