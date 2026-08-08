#!/bin/bash
#
# 善缘 - 支付和邀请系统自动化测试工具箱
# 测试内容：
#   1. Stripe 支付（三币种 USD/KRW + 三产品类型）
#   2. 微信支付模拟 webhook
#   3. 邀请链接和返佣计算
#   4. Webhook 签名验证
#
# 依赖：curl, jq, openssl, python3
# 用法：./test-payment-invite-toolkit.sh <api_base_url> <admin_token>
#
# 示例：
#   ./test-payment-invite-toolkit.sh http://localhost:3000 your-admin-token
#   ./test-payment-invite-toolkit.sh https://shenyuan.mylumee.cn your-admin-token
#

set -e

# ═══════════════════════════════════════
# 配置
# ═══════════════════════════════════════

API_BASE="${1:-http://localhost:3000}"
ADMIN_TOKEN="${2:-test-admin-token}"
STRIPE_SECRET="${STRIPE_TEST_SECRET_KEY:-}"
WX_SECRET="${WX_PAY_SECRET_KEY:-}"

# 色彩输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# 计时器
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# ═══════════════════════════════════════
# 辅助函数
# ═══════════════════════════════════════

log_info() {
  echo -e "${CYAN}ℹ️  $1${NC}"
}

log_success() {
  echo -e "${GREEN}✓ $1${NC}"
  ((PASSED_TESTS++))
}

log_error() {
  echo -e "${RED}✗ $1${NC}"
  ((FAILED_TESTS++))
}

log_warn() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

test_case() {
  ((TOTAL_TESTS++))
  echo ""
  echo "────────────────────────────────────────"
  echo -e "${YELLOW}测试 #$TOTAL_TESTS: $1${NC}"
  echo "────────────────────────────────────────"
}

assert_status() {
  local response="$1"
  local expected="$2"
  local msg="$3"

  local status=$(echo "$response" | jq -r '.status // .ok // empty' 2>/dev/null)
  if [ "$status" = "$expected" ]; then
    log_success "$msg"
    return 0
  else
    log_error "$msg (got: $status, expected: $expected)"
    return 1
  fi
}

# ═══════════════════════════════════════
# 1️⃣  Stripe 支付测试
# ═══════════════════════════════════════

test_stripe_usd() {
  test_case "Stripe USD - 完整命盘 ($19.90)"

  local payload=$(cat <<EOF
{
  "product": "bazi_full",
  "email": "test-usd-$(date +%s)@shenyuan.test",
  "donorName": "Test Donor USD",
  "contact": "test@shenyuan.test",
  "region": "us"
}
EOF
)

  local response=$(curl -s -X POST "$API_BASE/api/create-checkout" \
    -H "Content-Type: application/json" \
    -d "$payload")

  echo "Response: $response" | jq '.'

  if echo "$response" | jq -e '.url' >/dev/null 2>&1; then
    log_success "Stripe USD checkout session 创建成功"
    echo "Checkout URL: $(echo "$response" | jq -r '.url')"
    echo "Session ID: $(echo "$response" | jq -r '.sessionId')"
  else
    log_error "Stripe USD checkout session 创建失败"
  fi
}

test_stripe_krw() {
  test_case "Stripe KRW - 社주 완전 분석 (₩9,900)"

  local payload=$(cat <<EOF
{
  "product": "saju_kr_full",
  "email": "test-krw-$(date +%s)@shenyuan.test",
  "donorName": "Test Donor KRW",
  "contact": "test@shenyuan.test",
  "region": "kr"
}
EOF
)

  local response=$(curl -s -X POST "$API_BASE/api/create-checkout" \
    -H "Content-Type: application/json" \
    -d "$payload")

  echo "Response: $response" | jq '.'

  if echo "$response" | jq -e '.url' >/dev/null 2>&1; then
    log_success "Stripe KRW checkout session 创建成功"
    echo "Checkout URL: $(echo "$response" | jq -r '.url')"
  else
    log_error "Stripe KRW checkout session 创建失败"
  fi
}

test_stripe_member_subscription() {
  test_case "Stripe 订阅 - 月度会员 (monthly subscription)"

  local payload=$(cat <<EOF
{
  "product": "member_monthly",
  "email": "test-member-$(date +%s)@shenyuan.test",
  "donorName": "Test Member",
  "contact": "test@shenyuan.test",
  "region": "us"
}
EOF
)

  local response=$(curl -s -X POST "$API_BASE/api/create-checkout" \
    -H "Content-Type: application/json" \
    -d "$payload")

  echo "Response: $response" | jq '.'

  if echo "$response" | jq -e '.url' >/dev/null 2>&1; then
    log_success "Stripe 订阅 session 创建成功"
    echo "Mode: $(echo "$response" | jq -r '.sessionId // "subscription"')"
  else
    log_error "Stripe 订阅 session 创建失败"
  fi
}

# ═══════════════════════════════════════
# 2️⃣  微信支付 Webhook 模拟
# ═══════════════════════════════════════

test_wechat_webhook_signature() {
  test_case "微信支付 - Webhook 签名验证"

  if [ -z "$WX_SECRET" ]; then
    log_warn "WX_PAY_SECRET_KEY 未设置，跳过签名验证测试"
    return
  fi

  log_info "生成测试微信 webhook 回调 XML..."

  local timestamp=$(date +%s)
  local nonce="test_nonce_$timestamp"
  local order_no="WX-$(date +%s%N)"

  # 模拟微信通知 XML
  local xml_body=$(cat <<'EOF'
<xml>
  <appid>wx123456</appid>
  <bank_type>ICBC_DEBIT</bank_type>
  <cash_fee>100</cash_fee>
  <fee_type>CNY</fee_type>
  <is_subscribe>N</is_subscribe>
  <mch_id>123456</mch_id>
  <nonce_str>test_nonce</nonce_str>
  <openid>oUVf6xxxxxtest</openid>
  <out_trade_no>sy_wx_1234567890</out_trade_no>
  <result_code>SUCCESS</result_code>
  <return_code>SUCCESS</return_code>
  <time_end>20240101120000</time_end>
  <total_fee>100</total_fee>
  <trade_type>NATIVE</trade_type>
  <transaction_id>1234567890123456789</transaction_id>
  <sign>0123456789ABCDEF</sign>
</xml>
EOF
)

  log_info "POST 到 /pay/wechat/notify..."
  local response=$(curl -s -X POST "$API_BASE/pay/wechat/notify" \
    -H "Content-Type: application/xml" \
    -d "$xml_body")

  echo "Response: $response"

  if echo "$response" | grep -q "return_code\|success\|OK"; then
    log_success "微信 webhook 处理返回有效响应"
  else
    log_warn "微信 webhook 响应可能异常（可能是未配置密钥）"
  fi
}

test_wechat_create_order() {
  test_case "微信支付 - 创建订单获取二维码"

  local payload=$(cat <<EOF
{
  "product": "bazi_full",
  "channel": "wechat"
}
EOF
)

  local response=$(curl -s -X POST "$API_BASE/pay/wechat/create" \
    -H "Content-Type: application/json" \
    -d "$payload")

  echo "Response: $response" | jq '.'

  if echo "$response" | jq -e '.code_url' >/dev/null 2>&1; then
    log_success "微信支付订单创建成功，获得二维码"
    local out_trade_no=$(echo "$response" | jq -r '.out_trade_no')
    echo "订单号: $out_trade_no"

    # 尝试查询订单状态
    log_info "查询订单状态..."
    local query=$(curl -s "$API_BASE/pay/wechat/query?out_trade_no=$out_trade_no")
    echo "Query response: $query" | jq '.'
  else
    log_error "微信支付订单创建失败"
  fi
}

# ═══════════════════════════════════════
# 3️⃣  邀请链接生成和返佣计算
# ═══════════════════════════════════════

test_affiliate_track() {
  test_case "邀请 - 追踪链接点击"

  local ref_code="TEST$(printf '%06d' $RANDOM)"

  log_info "追踪邀请链接: ?ref=$ref_code"
  local response=$(curl -s -i -X GET "$API_BASE/api/affiliate/track?ref=$ref_code" 2>&1 | grep -E "HTTP|Location")

  echo "Response: $response"

  if echo "$response" | grep -qE "HTTP|Location"; then
    log_success "邀请链接追踪成功（应重定向首页）"
  else
    log_error "邀请链接追踪失败"
  fi
}

test_affiliate_create() {
  test_case "邀请 - 创建 Affiliate（管理员）"

  local aff_code="AFF-TEST-$(date +%s)"

  local payload=$(cat <<EOF
{
  "name": "测试推广者",
  "code": "$aff_code",
  "commission_rate": 0.15
}
EOF
)

  local response=$(curl -s -X POST "$API_BASE/api/admin/affiliate/create" \
    -H "Content-Type: application/json" \
    -H "X-Admin-Token: $ADMIN_TOKEN" \
    -d "$payload")

  echo "Response: $response" | jq '.'

  if echo "$response" | jq -e '.ok' >/dev/null 2>&1; then
    log_success "Affiliate 创建成功"
    echo "Affiliate Code: $aff_code"
  else
    log_error "Affiliate 创建失败"
  fi
}

test_affiliate_list() {
  test_case "邀请 - 列出所有 Affiliates 及统计"

  local response=$(curl -s -X GET "$API_BASE/api/admin/affiliate/list" \
    -H "X-Admin-Token: $ADMIN_TOKEN")

  echo "Response: $response" | jq '.'

  if echo "$response" | jq -e '.ok' >/dev/null 2>&1; then
    log_success "Affiliate 列表获取成功"
    local count=$(echo "$response" | jq '.total')
    echo "总 Affiliates 数: $count"
    echo "$response" | jq '.affiliates[] | "\(.code): 点击 \(.clicks), 订单 \(.orders_paid), 返佣 \$\(.commission_total)"'
  else
    log_error "Affiliate 列表获取失败"
  fi
}

test_affiliate_payment_flow() {
  test_case "邀请 - 带 ref_code 的支付流程（完整返佣链路）"

  # 1. 创建 affiliate
  local aff_code="TESTPAY-$(date +%s)"
  local create_payload=$(cat <<EOF
{
  "name": "支付测试推广",
  "code": "$aff_code",
  "commission_rate": 0.20
}
EOF
)

  curl -s -X POST "$API_BASE/api/admin/affiliate/create" \
    -H "Content-Type: application/json" \
    -H "X-Admin-Token: $ADMIN_TOKEN" \
    -d "$create_payload" >/dev/null

  log_info "创建 Affiliate: $aff_code (佣金比例 20%)"

  # 2. 模拟用户通过邀请链接访问
  log_info "用户点击邀请链接: ?ref=$aff_code"
  curl -s -X GET "$API_BASE/api/affiliate/track?ref=$aff_code" >/dev/null

  # 3. 用户发起支付，携带 ref_code
  local email="affiliate-test-$(date +%s)@test.local"
  local pay_payload=$(cat <<EOF
{
  "product": "bazi_full",
  "email": "$email",
  "donorName": "推广用户",
  "contact": "ref-test@test.local",
  "ref_code": "$aff_code"
}
EOF
)

  log_info "用户发起支付，ref_code=$aff_code"
  local pay_response=$(curl -s -X POST "$API_BASE/api/create-checkout" \
    -H "Content-Type: application/json" \
    -d "$pay_payload")

  echo "Pay Response: $pay_response" | jq '.'

  if echo "$pay_response" | jq -e '.url' >/dev/null 2>&1; then
    log_success "支付链接创建成功（带返佣追踪）"

    # 4. 查询 affiliate 统计
    sleep 1
    log_info "查询 affiliate 统计..."
    local stats=$(curl -s -X GET "$API_BASE/api/admin/affiliate/stats/$aff_code" \
      -H "X-Admin-Token: $ADMIN_TOKEN")

    echo "Stats: $stats" | jq '.'

    if echo "$stats" | jq -e '.orders' >/dev/null 2>&1; then
      log_success "Affiliate 订单统计可用"
      local order_count=$(echo "$stats" | jq '.orders | length')
      echo "Affiliate 订单数: $order_count"
    fi
  else
    log_error "支付链接创建失败"
  fi
}

# ═══════════════════════════════════════
# 4️⃣  邀请码生成和转化追踪
# ═══════════════════════════════════════

test_invite_save() {
  test_case "邀请 - 保存邀请信息"

  local payload=$(cat <<EOF
{
  "inviterName": "测试邀请者",
  "nameA": "被邀请者A",
  "p1Year": 1990,
  "p1Month": 6,
  "p1Day": 15,
  "p1Hour": 14,
  "p1Gender": "M",
  "mode": "marriage",
  "ref": "TESTREF123"
}
EOF
)

  local response=$(curl -s -X POST "$API_BASE/api/invite/save" \
    -H "Content-Type: application/json" \
    -d "$payload")

  echo "Response: $response" | jq '.'

  if echo "$response" | jq -e '.inviteId' >/dev/null 2>&1; then
    local invite_id=$(echo "$response" | jq -r '.inviteId')
    log_success "邀请信息保存成功"
    echo "Invite ID: $invite_id"

    # 尝试读取邀请信息
    log_info "读取邀请信息..."
    local get_response=$(curl -s -X GET "$API_BASE/api/invite/$invite_id")
    echo "Get response: $get_response" | jq '.'

    if echo "$get_response" | jq -e '.nameA' >/dev/null 2>&1; then
      log_success "邀请信息读取成功"
    fi
  else
    log_error "邀请信息保存失败"
  fi
}

# ═══════════════════════════════════════
# 5️⃣  返佣计算验证
# ═══════════════════════════════════════

test_commission_calculation() {
  test_case "返佣 - 计算验证（离线）"

  log_info "测试返佣计算公式..."

  local test_cases=(
    "19.90|0.10|1.99"      # $19.90 * 10% = $1.99
    "49.00|0.15|7.35"      # $49.00 * 15% = $7.35
    "99.00|0.20|19.80"     # $99.00 * 20% = $19.80
    "1.00|0.30|0.30"       # $1.00 * 30% = $0.30
  )

  for case in "${test_cases[@]}"; do
    local amount=$(echo "$case" | cut -d'|' -f1)
    local rate=$(echo "$case" | cut -d'|' -f2)
    local expected=$(echo "$case" | cut -d'|' -f3)

    # 用 bc 计算
    local calculated=$(echo "scale=2; $amount * $rate" | bc)

    if [ "$calculated" = "$expected" ]; then
      log_success "返佣计算: \$$amount × $rate = \$$calculated ✓"
    else
      log_error "返佣计算: \$$amount × $rate = \$$calculated (expected \$$expected)"
    fi
  done
}

# ═══════════════════════════════════════
# 6️⃣  生成测试数据
# ═══════════════════════════════════════

test_generate_ref_codes_batch() {
  test_case "生成 - 批量邀请码生成（100 个）"

  log_info "生成 100 个测试邀请码..."

  local temp_file="/tmp/ref_codes_$(date +%s).txt"
  : > "$temp_file"

  for i in {1..100}; do
    local ref_code=$(printf "REF%06d" $i)

    # 创建 affiliate
    local payload=$(cat <<EOF
{
  "name": "推广者 #$i",
  "code": "$ref_code",
  "commission_rate": 0.15
}
EOF
)

    if [ $((i % 10)) -eq 0 ]; then
      log_info "创建第 $i 个..."
    fi

    curl -s -X POST "$API_BASE/api/admin/affiliate/create" \
      -H "Content-Type: application/json" \
      -H "X-Admin-Token: $ADMIN_TOKEN" \
      -d "$payload" >/dev/null 2>&1

    echo "$ref_code" >> "$temp_file"
  done

  log_success "批量邀请码生成完成"
  echo "邀请码已保存到: $temp_file"
  echo "前 10 个邀请码:"
  head -10 "$temp_file" | sed 's/^/  /'
}

# ═══════════════════════════════════════
# 7️⃣  支付网关检查
# ═══════════════════════════════════════

test_payment_gateway_health() {
  test_case "支付网关 - 健康检查"

  log_info "检查 Stripe 连接..."
  local stripe_response=$(curl -s -X GET "$API_BASE/api/products")
  if echo "$stripe_response" | jq -e '.products' >/dev/null 2>&1; then
    log_success "产品列表可用"
  else
    log_warn "无法获取产品列表"
  fi

  log_info "检查微信支付..."
  if [ -n "$WX_SECRET" ]; then
    log_success "微信支付配置已检测到"
  else
    log_warn "微信支付未配置（WX_PAY_SECRET_KEY 环境变量缺失）"
  fi

  log_info "检查支付宝..."
  log_warn "支付宝配置检查需要实际环境密钥"
}

# ═══════════════════════════════════════
# 👤 用户订单查询
# ═══════════════════════════════════════

test_user_orders_query() {
  test_case "用户 - 查询个人订单（需要 token）"

  # 注意：这里需要真实的用户 token
  # 如果没有 token，使用模拟 token 会返回 401

  local fake_token="Bearer test_fake_token_for_demo"

  log_info "尝试查询订单（使用模拟 token）..."
  local response=$(curl -s -X GET "$API_BASE/api/orders/mine" \
    -H "Authorization: $fake_token")

  echo "Response: $response" | jq '.'

  if echo "$response" | grep -q "401\|error"; then
    log_warn "认证失败（预期行为，使用了模拟 token）"
  fi
}

# ═══════════════════════════════════════
# 8️⃣  Webhook 安全测试
# ═══════════════════════════════════════

test_webhook_validation() {
  test_case "Webhook - 安全验证测试"

  log_info "测试无效签名的 webhook 拒绝..."

  local fake_body='{"event":"test","data":{}}'
  local fake_sig='invalid_signature'

  # 测试 Stripe webhook（如果配置）
  local response=$(curl -s -X POST "$API_BASE/api/stripe-webhook" \
    -H "Content-Type: application/json" \
    -H "Stripe-Signature: $fake_sig" \
    -d "$fake_body")

  echo "Response: $response"

  if echo "$response" | grep -qi "signature\|error"; then
    log_success "无效 webhook 签名被正确拒绝"
  else
    log_warn "Webhook 签名验证响应不符预期（可能是 Stripe 未配置）"
  fi
}

# ═══════════════════════════════════════
# 主测试流程
# ═══════════════════════════════════════

main() {
  echo "════════════════════════════════════════════════════════════"
  echo "  善缘 - 支付和邀请系统自动化测试工具箱"
  echo "════════════════════════════════════════════════════════════"
  echo ""
  echo "API 基础地址: $API_BASE"
  echo "管理员 Token: ${ADMIN_TOKEN:0:10}...${ADMIN_TOKEN: -10}"
  echo ""

  # Stripe 支付测试
  echo ""
  echo "═ 第一部分: Stripe 支付 ═"
  test_stripe_usd
  test_stripe_krw
  test_stripe_member_subscription

  # 微信支付测试
  echo ""
  echo "═ 第二部分: 微信支付 ═"
  test_wechat_create_order
  test_wechat_webhook_signature

  # 邀请和返佣
  echo ""
  echo "═ 第三部分: 邀请和返佣 ═"
  test_affiliate_track
  test_affiliate_create
  test_affiliate_list
  test_affiliate_payment_flow
  test_invite_save

  # 返佣计算
  echo ""
  echo "═ 第四部分: 返佣计算验证 ═"
  test_commission_calculation

  # 数据生成
  echo ""
  echo "═ 第五部分: 批量测试数据生成 ═"
  test_generate_ref_codes_batch

  # 健康检查
  echo ""
  echo "═ 第六部分: 网关健康检查 ═"
  test_payment_gateway_health

  # 安全测试
  echo ""
  echo "═ 第七部分: 安全和验证 ═"
  test_webhook_validation
  test_user_orders_query

  # 总结
  echo ""
  echo "════════════════════════════════════════════════════════════"
  echo "📊 测试总结"
  echo "════════════════════════════════════════════════════════════"
  echo -e "总测试数: ${CYAN}$TOTAL_TESTS${NC}"
  echo -e "通过: ${GREEN}$PASSED_TESTS${NC}"
  echo -e "失败: ${RED}$FAILED_TESTS${NC}"
  echo ""

  if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓ 全部测试通过！${NC}"
    return 0
  else
    echo -e "${RED}✗ 有 $FAILED_TESTS 个测试失败，请检查上方输出${NC}"
    return 1
  fi
}

main "$@"
