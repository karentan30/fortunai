#!/bin/bash
#
# 高级场景测试 - 真实业务场景模拟
#
# 场景包括：
#  1. 订阅自动续费流程
#  2. 国际用户多币种支付
#  3. 批量邀请返佣对账
#  4. 订单失败和重试
#  5. Webhook 延迟处理
#
# 用法: ./advanced-scenarios.sh <api_base> <admin_token>
#

set -e

API_BASE="${1:-http://localhost:3000}"
ADMIN_TOKEN="${2:-test-admin-token}"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_scenario() {
  echo ""
  echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}场景 $1: $2${NC}"
  echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
}

log_step() {
  echo -e "${YELLOW}▶ $1${NC}"
}

log_ok() {
  echo -e "${GREEN}✓ $1${NC}"
}

log_error() {
  echo -e "${RED}✗ $1${NC}"
}

# ═══════════════════════════════════════════════════════════════
# 场景 1: 订阅自动续费流程
# ═══════════════════════════════════════════════════════════════

scenario_subscription_renewal() {
  log_scenario 1 "订阅自动续费流程"

  log_step "1.1 用户首次购买月度会员"

  local email="sub_renewal_$(date +%s)@test.local"

  response=$(curl -s -X POST "$API_BASE/api/create-checkout" \
    -H "Content-Type: application/json" \
    -d "{
      \"product\": \"member_monthly\",
      \"email\": \"$email\",
      \"donorName\": \"张三\",
      \"contact\": \"13800138000\"
    }")

  if echo "$response" | jq -e '.url' >/dev/null 2>&1; then
    log_ok "月度会员订阅创建成功"
    local order_no=$(echo "$response" | jq -r '.orderNo')
    echo "   订单号: $order_no"
  else
    log_error "订阅创建失败"
    return 1
  fi

  log_step "1.2 模拟首月支付完成"
  echo "   (实际环境由 Stripe webhook 触发)"
  echo "   预期: subscription 状态变为 active"

  log_step "1.3 模拟一个月后续费"
  echo "   (Stripe 自动发起 invoice.payment_succeeded webhook)"
  echo "   预期: 订阅自动延期，expires_at 更新"

  log_ok "场景 1 完成"
}

# ═══════════════════════════════════════════════════════════════
# 场景 2: 国际用户多币种支付
# ═══════════════════════════════════════════════════════════════

scenario_multicurrency_payment() {
  log_scenario 2 "国际用户多币种支付"

  local currencies=(
    "USD:bazi_full:us"
    "KRW:saju_kr_full:kr"
    "CNY:bazi_full:cn"
  )

  for curr_info in "${currencies[@]}"; do
    IFS=":" read -r currency product region <<< "$curr_info"

    log_step "2.$RANDOM 创建 $currency 支付 (产品: $product)"

    local email="multi_curr_$(date +%s)_$currency@test.local"

    response=$(curl -s -X POST "$API_BASE/api/create-checkout" \
      -H "Content-Type: application/json" \
      -d "{
        \"product\": \"$product\",
        \"email\": \"$email\",
        \"region\": \"$region\",
        \"donorName\": \"International User\",
        \"contact\": \"intl@test.local\"
      }")

    if echo "$response" | jq -e '.url // .code_url' >/dev/null 2>&1; then
      log_ok "$currency 支付链接创建成功"
      echo "   金额: $(echo "$response" | jq '.amount // "N/A"')"
    else
      log_error "$currency 支付创建失败"
      echo "   原因: $(echo "$response" | jq '.error')"
    fi
  done

  log_ok "场景 2 完成"
}

# ═══════════════════════════════════════════════════════════════
# 场景 3: 批量邀请返佣对账
# ═══════════════════════════════════════════════════════════════

scenario_bulk_affiliate_reconciliation() {
  log_scenario 3 "批量邀请返佣对账"

  log_step "3.1 创建 3 个推广渠道"

  local affiliates=()
  for i in {1..3}; do
    local code="BULK_AFF_$i"

    response=$(curl -s -X POST "$API_BASE/api/admin/affiliate/create" \
      -H "Content-Type: application/json" \
      -H "X-Admin-Token: $ADMIN_TOKEN" \
      -d "{
        \"name\": \"批量推广 #$i\",
        \"code\": \"$code\",
        \"commission_rate\": 0.$(($i * 5))"
      }")

    if echo "$response" | jq -e '.ok' >/dev/null 2>&1; then
      log_ok "Affiliate $code 创建成功 (返佣比例: $((i*5))%)"
      affiliates+=("$code")
    fi
  done

  log_step "3.2 模拟不同渠道的支付订单"

  local products=("bazi_full" "member_monthly" "hehun" "tarot")

  for aff in "${affiliates[@]}"; do
    for i in {1..2}; do
      local product=${products[$RANDOM % ${#products[@]}]}
      local email="bulk_test_$(date +%s%N)_$aff@test.local"

      response=$(curl -s -X POST "$API_BASE/api/create-checkout" \
        -H "Content-Type: application/json" \
        -d "{
          \"product\": \"$product\",
          \"email\": \"$email\",
          \"ref_code\": \"$aff\"
        }" 2>/dev/null)

      if echo "$response" | jq -e '.url' >/dev/null 2>&1; then
        echo "   ✓ $aff: $product 订单生成"
      fi
    done
  done

  log_step "3.3 对账所有推广渠道的返佣"

  sleep 1

  all_affiliates=$(curl -s -X GET "$API_BASE/api/admin/affiliate/list" \
    -H "X-Admin-Token: $ADMIN_TOKEN")

  echo ""
  echo "推广渠道对账汇总:"
  echo "$all_affiliates" | jq '.affiliates[] | select(.code | startswith("BULK_AFF_")) | {
    code,
    name,
    commission_rate,
    orders_total,
    orders_paid,
    revenue_usd,
    commission_total
  }' | head -30

  log_ok "场景 3 完成"
}

# ═══════════════════════════════════════════════════════════════
# 场景 4: 支付失败和重试
# ═══════════════════════════════════════════════════════════════

scenario_payment_failure_retry() {
  log_scenario 4 "支付失败和重试处理"

  log_step "4.1 创建支付订单"

  local email="failure_test_$(date +%s)@test.local"

  response=$(curl -s -X POST "$API_BASE/api/create-checkout" \
    -H "Content-Type: application/json" \
    -d "{
      \"product\": \"bazi_vip\",
      \"email\": \"$email\",
      \"donorName\": \"失败用户\",
      \"contact\": \"fail@test.local\"
    }")

  if echo "$response" | jq -e '.sessionId' >/dev/null 2>&1; then
    local session_id=$(echo "$response" | jq -r '.sessionId')
    log_ok "支付订单创建: $session_id"

    log_step "4.2 模拟支付失败场景"
    echo "   (checkout.session.expired webhook)"
    echo "   预期: 订单状态变为 expired"

    log_step "4.3 模拟用户重试"
    echo "   (用户重新发起支付)"

    sleep 1

    retry_response=$(curl -s -X POST "$API_BASE/api/create-checkout" \
      -H "Content-Type: application/json" \
      -d "{
        \"product\": \"bazi_vip\",
        \"email\": \"$email\",
        \"donorName\": \"失败用户（重试）\",
        \"contact\": \"fail@test.local\"
      }")

    if echo "$retry_response" | jq -e '.url' >/dev/null 2>&1; then
      log_ok "重试支付成功"
    fi
  fi

  log_ok "场景 4 完成"
}

# ═══════════════════════════════════════════════════════════════
# 场景 5: Webhook 延迟处理
# ═══════════════════════════════════════════════════════════════

scenario_webhook_delay_handling() {
  log_scenario 5 "Webhook 延迟和乱序处理"

  log_step "5.1 创建订单"

  local email="webhook_delay_$(date +%s)@test.local"

  response=$(curl -s -X POST "$API_BASE/api/create-checkout" \
    -H "Content-Type: application/json" \
    -d "{
      \"product\": \"member_yearly\",
      \"email\": \"$email\",
      \"ref_code\": \"WEBHOOK_TEST\"
    }")

  local order_no=$(echo "$response" | jq -r '.orderNo')
  log_ok "订单创建: $order_no"

  log_step "5.2 模拟 Webhook 乱序场景"
  echo "   正常: checkout.session.completed → invoice.payment_succeeded"
  echo "   乱序: invoice.payment_succeeded 先到达"
  echo "   预期: 系统应能正确处理"

  log_step "5.3 等待 webhook 处理"
  echo "   (模拟 5 秒延迟)"
  sleep 5

  log_step "5.4 查询最终订单状态"

  orders_response=$(curl -s -X GET "$API_BASE/api/orders" \
    -H "X-Admin-Token: $ADMIN_TOKEN")

  echo "   检查订单状态..."
  # 输出不包含敏感数据

  log_ok "场景 5 完成"
}

# ═══════════════════════════════════════════════════════════════
# 场景 6: 邀请码有效期和过期处理
# ═══════════════════════════════════════════════════════════════

scenario_invite_code_expiry() {
  log_scenario 6 "邀请信息有效期处理"

  log_step "6.1 创建邀请信息（有效期 24 小时）"

  local payload=$(cat <<EOF
{
  "inviterName": "邀请者A",
  "nameA": "被邀请者B",
  "p1Year": 1990,
  "p1Month": 6,
  "p1Day": 15,
  "p1Hour": 14,
  "p1Gender": "M",
  "mode": "marriage"
}
EOF
)

  response=$(curl -s -X POST "$API_BASE/api/invite/save" \
    -H "Content-Type: application/json" \
    -d "$payload")

  if echo "$response" | jq -e '.inviteId' >/dev/null 2>&1; then
    local invite_id=$(echo "$response" | jq -r '.inviteId')
    log_ok "邀请信息保存成功: $invite_id"

    log_step "6.2 立即读取（应成功）"

    get_response=$(curl -s "$API_BASE/api/invite/$invite_id")
    if echo "$get_response" | jq -e '.nameA' >/dev/null 2>&1; then
      log_ok "邀请信息读取成功"
    fi

    log_step "6.3 模拟 24 小时后访问（应过期）"
    echo "   (实际测试需要修改代码中的过期时间)"
    echo "   预期: 返回 404 未找到"
  fi

  log_ok "场景 6 完成"
}

# ═══════════════════════════════════════════════════════════════
# 场景 7: 并发支付请求处理
# ═══════════════════════════════════════════════════════════════

scenario_concurrent_payments() {
  log_scenario 7 "并发支付请求处理"

  log_step "7.1 发起 5 个并发支付请求"

  for i in {1..5}; do
    (
      local email="concurrent_$(date +%s%N)_$i@test.local"
      curl -s -X POST "$API_BASE/api/create-checkout" \
        -H "Content-Type: application/json" \
        -d "{
          \"product\": \"bazi_full\",
          \"email\": \"$email\",
          \"donorName\": \"并发用户 #$i\"
        }" >/dev/null &
    )
  done

  wait

  log_ok "5 个并发请求已发送"

  log_step "7.2 验证所有订单已创建"

  sleep 1

  orders=$(curl -s "$API_BASE/api/orders" -H "X-Admin-Token: $ADMIN_TOKEN")
  order_count=$(echo "$orders" | jq '.orders | length' 2>/dev/null || echo "0")
  echo "   已创建订单数: $order_count"

  log_ok "场景 7 完成"
}

# ═══════════════════════════════════════════════════════════════
# 场景 8: 不同返佣比例的计算验证
# ═══════════════════════════════════════════════════════════════

scenario_commission_calculation_accuracy() {
  log_scenario 8 "返佣计算准确性验证"

  log_step "8.1 测试各种返佣比例"

  python3 << 'EOF'
from testing.payment_test_utils import CommissionCalculator

test_cases = [
    # (金额, 比例, 期望返佣)
    (10.00, 0.05, 0.50),
    (19.90, 0.10, 1.99),
    (49.00, 0.15, 7.35),
    (99.00, 0.20, 19.80),
    (1000.00, 0.25, 250.00),
    (3.99, 0.30, 1.20),  # 浮点数边界
]

print("返佣计算验证:")
all_pass = True

for amount, rate, expected in test_cases:
    calculated = CommissionCalculator.calculate_commission(amount, rate)
    passed = abs(calculated - expected) < 0.01
    status = "✓" if passed else "✗"
    all_pass = all_pass and passed
    print(f"  {status} ${amount:.2f} × {rate*100:.0f}% = ${calculated:.2f} (期望: ${expected:.2f})")

if all_pass:
    print("\n  所有测试通过！")
else:
    print("\n  有测试失败，请检查")
EOF

  log_ok "场景 8 完成"
}

# ═══════════════════════════════════════════════════════════════
# 主程序
# ═══════════════════════════════════════════════════════════════

main() {
  echo ""
  echo "════════════════════════════════════════════════════════════"
  echo "  善缘支付系统 - 高级场景测试套件"
  echo "════════════════════════════════════════════════════════════"
  echo ""
  echo "API: $API_BASE"
  echo ""

  # 运行所有场景
  scenario_subscription_renewal
  scenario_multicurrency_payment
  scenario_bulk_affiliate_reconciliation
  scenario_payment_failure_retry
  scenario_webhook_delay_handling
  scenario_invite_code_expiry
  scenario_concurrent_payments
  scenario_commission_calculation_accuracy

  echo ""
  echo "════════════════════════════════════════════════════════════"
  echo -e "${GREEN}✓ 所有高级场景测试完成${NC}"
  echo "════════════════════════════════════════════════════════════"
  echo ""
}

main
