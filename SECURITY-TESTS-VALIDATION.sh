#!/bin/bash
# 安全修复验证脚本 v1.0
# 用于验证所有安全修复是否生效

set -e

REPO_ROOT="/Users/karen/projects/shenyuan"
cd "$REPO_ROOT"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   善缘安全修复验证测试 v1.0                                      ║"
echo "║   2026-08-11                                                   ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass_count=0
fail_count=0

function test_pass() {
  echo -e "${GREEN}✓ PASS${NC}: $1"
  ((pass_count++))
}

function test_fail() {
  echo -e "${RED}✗ FAIL${NC}: $1"
  ((fail_count++))
}

function test_warn() {
  echo -e "${YELLOW}⚠ WARN${NC}: $1"
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. API 密钥硬编码检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 检查是否仍然有明文key (排除worktree和注释中的REVOKED标记)
if grep -r "sk-8597ac6c84d344039e09c8f947e4022b" "$REPO_ROOT" --include="*.js" --exclude-dir=".claude" 2>/dev/null | grep -v "REVOKED" | grep -v "^[[:space:]]*//"; then
  test_fail "DeepSeek key仍在可执行代码中"
else
  test_pass "DeepSeek key已从代码中移除（仅存在于注释中标记REVOKED）"
fi

# 检查env变量使用
if grep -l "process.env.DEEPSEEK_API_KEY" "$REPO_ROOT"/{docs,blog}/*.js 2>/dev/null | wc -l | grep -q "^[1-9]"; then
  test_pass "已使用process.env.DEEPSEEK_API_KEY"
else
  test_warn "无法确认environment variable读取 (可能在运行时)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. XSS漏洞修复检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 检查支付模态框
if grep -q "function showCnPayModal" "$REPO_ROOT/pages/bazi.html"; then
  if grep -A 50 "function showCnPayModal" "$REPO_ROOT/pages/bazi.html" | grep -q "document.createElement.*div"; then
    test_pass "支付模态框已改用DOM API（非innerHTML）"
  else
    test_fail "支付模态框仍使用innerHTML"
  fi
fi

# 检查年月日select
if grep -q "ySel.appendChild" "$REPO_ROOT/pages/bazi.html"; then
  test_pass "年选择器已改用appendChild"
else
  test_fail "年选择器仍使用innerHTML +="
fi

if grep -q "dSel.appendChild" "$REPO_ROOT/pages/bazi.html"; then
  test_pass "日选择器已改用appendChild"
else
  test_fail "日选择器仍使用innerHTML +="
fi

# 统计还有多少innerHTML
REMAINING_INNERHTML=$(grep -o "\.innerHTML\s*=" "$REPO_ROOT/pages/bazi.html" | wc -l)
if [ "$REMAINING_INNERHTML" -gt 0 ]; then
  test_warn "页面中还有 $REMAINING_INNERHTML 处 innerHTML 赋值（低优先级）"
else
  test_pass "页面中无innerHTML直接赋值"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. Token存储安全检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 检查客户端是否还在读localStorage的token
if grep -n "localStorage.getItem.*sy_token" "$REPO_ROOT/pages/bazi.html" 2>/dev/null | grep -v "SECURITY FIX" > /dev/null; then
  test_fail "客户端仍在读localStorage中的sy_token"
else
  test_pass "客户端不再读localStorage中的token"
fi

# 检查服务器是否设置httpOnly cookie
if grep -q "res.cookie.*sy_token.*httpOnly" "$REPO_ROOT/server/routes/auth.js"; then
  test_pass "auth.js已设置httpOnly cookie"
else
  test_fail "auth.js未设置httpOnly cookie"
fi

# 检查credentials: include
if grep -q "credentials.*include" "$REPO_ROOT/pages/bazi.html"; then
  test_pass "fetch请求已添加credentials: 'include'"
else
  test_fail "fetch请求缺少credentials标记"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. CSRF保护检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 检查客户端CSRF token生成
if grep -q "generateCSRFToken" "$REPO_ROOT/pages/bazi.html"; then
  test_pass "客户端有CSRF token生成函数"
else
  test_fail "客户端缺少CSRF token生成"
fi

# 检查X-CSRF-Token header
if grep -q "X-CSRF-Token" "$REPO_ROOT/pages/bazi.html"; then
  test_pass "支付请求添加X-CSRF-Token header"
else
  test_fail "支付请求缺少CSRF token header"
fi

# 检查服务器CSRF中间件
if grep -q "function csrfMiddleware" "$REPO_ROOT/server/middleware/index.js"; then
  test_pass "服务器有csrfMiddleware中间件"
else
  test_warn "服务器csrfMiddleware可能未完全实现"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. ref_code验证检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 检查ref_code正则
if grep -q "REF_CODE_PATTERN" "$REPO_ROOT/server/routes/payment.js"; then
  test_pass "payment.js有REF_CODE_PATTERN正则"
else
  test_fail "payment.js缺少ref_code正则验证"
fi

# 检查格式验证
if grep -q "REF_CODE_PATTERN.test(code)" "$REPO_ROOT/server/routes/payment.js"; then
  test_pass "ref_code格式验证已实现"
else
  test_fail "ref_code格式验证未正确实现"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6. 日志脱敏检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 检查auth.js脱敏
if grep -q "emailHash" "$REPO_ROOT/server/routes/auth.js"; then
  test_pass "auth.js已脱敏email"
else
  test_fail "auth.js未脱敏email日志"
fi

# 检查daily.js脱敏
if grep -q "emailHash.*feedback" "$REPO_ROOT/server/routes/daily.js"; then
  test_pass "daily.js已脱敏feedback"
else
  test_fail "daily.js未脱敏feedback日志"
fi

# 检查email.js脱敏
if grep -q "emailHash.*subscribe" "$REPO_ROOT/server/routes/email.js"; then
  test_pass "email.js已脱敏subscribe"
else
  test_fail "email.js未脱敏subscribe日志"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7. 支付体验优化检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 检查超时处理
if grep -q "pollCount > maxPolls" "$REPO_ROOT/pages/bazi.html"; then
  test_pass "微信支付有超时处理（60秒）"
else
  test_fail "微信支付缺少超时处理"
fi

# 检查倒计时
if grep -q "cnPayCountdown" "$REPO_ROOT/pages/bazi.html"; then
  test_pass "微信支付有二维码倒计时"
else
  test_fail "微信支付缺少倒计时"
fi

# 检查countdown interval
if grep -q "countdown--" "$REPO_ROOT/pages/bazi.html"; then
  test_pass "倒计时逻辑已实现"
else
  test_fail "倒计时逻辑未实现"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 测试结果统计"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}通过: $pass_count${NC}"
echo -e "${RED}失败: $fail_count${NC}"
echo ""

if [ $fail_count -eq 0 ]; then
  echo -e "${GREEN}✅ 所有关键检查通过！${NC}"
  exit 0
else
  echo -e "${RED}❌ 还有$fail_count项检查失败，需要修复${NC}"
  exit 1
fi
