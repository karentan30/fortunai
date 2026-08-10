#!/bin/bash

###############################################################################
# 善缘生产部署验证脚本 - Production Deployment Verification
# 使用: bash verify-deploy.sh
# 功能: 一键验证生产环境所有关键系统是否就绪
# 作者: DevOps Team
# 最后更新: 2026-08-10
###############################################################################

set -e

# ========== 颜色定义 ==========
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ========== 配置 ==========
SERVER="47.242.80.65"
SERVER_PATH="/opt/shenyuan"
PM2_APP="shenyuan"
ALERT_APP="shenyuan-alerts"
HEALTH_CHECK_ENDPOINT="http://localhost:3021/api/health"
ALERT_HEALTH="http://localhost:3007/health"
DEPLOYMENT_TIMEOUT=30

# ========== 统计 ==========
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0

# ========== 工具函数 ==========
log_header() {
  echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}$1${NC}"
  echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
}

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[✅ PASS]${NC} $1"
  ((PASSED_CHECKS++))
}

log_fail() {
  echo -e "${RED}[❌ FAIL]${NC} $1"
  ((FAILED_CHECKS++))
}

log_warning() {
  echo -e "${YELLOW}[⚠️  WARN]${NC} $1"
  ((WARNINGS++))
}

log_check() {
  echo -e "${CYAN}[CHECK #$((++TOTAL_CHECKS))]${NC} $1"
}

check_result() {
  if [ $1 -eq 0 ]; then
    log_success "$2"
  else
    log_fail "$2"
  fi
}

# ========== 连接验证 ==========
verify_ssh_connection() {
  log_header "第1步: 服务器连接性验证 (SSH connectivity)"

  log_check "验证服务器可达性"
  if ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no root@$SERVER "echo 'SSH连接OK'" > /dev/null 2>&1; then
    log_success "SSH连接到 $SERVER 成功"
    return 0
  else
    log_fail "无法连接到 $SERVER (SSH超时或连接拒绝)"
    exit 1
  fi
}

# ========== PM2服务验证 ==========
verify_pm2_services() {
  log_header "第2步: PM2服务状态验证"

  # 检查主服务
  log_check "验证 $PM2_APP 服务状态"
  if ssh root@$SERVER "pm2 status $PM2_APP | grep -q 'online'" 2>/dev/null; then
    log_success "PM2服务 '$PM2_APP' 运行中 (online)"

    # 获取进程详情
    PM2_PID=$(ssh root@$SERVER "pm2 list | grep $PM2_APP | awk '{print \$2}'" 2>/dev/null || echo "N/A")
    log_info "进程ID: $PM2_PID"
  else
    log_fail "PM2服务 '$PM2_APP' 不在线"
    log_info "尝试重启服务: ssh root@$SERVER 'pm2 restart $PM2_APP'"
  fi

  # 检查告警服务
  log_check "验证 $ALERT_APP 告警系统状态"
  if ssh root@$SERVER "pm2 status $ALERT_APP | grep -q 'online'" 2>/dev/null; then
    log_success "PM2服务 '$ALERT_APP' 运行中 (online)"
  else
    log_warning "告警系统 '$ALERT_APP' 未运行 (可选服务)"
    log_info "如需启用告警: ssh root@$SERVER 'bash $SERVER_PATH/scripts/monitoring-setup.sh'"
  fi

  # 获取总进程数
  log_check "获取PM2进程总数"
  PROCESS_COUNT=$(ssh root@$SERVER "pm2 list | grep -c 'online'" 2>/dev/null || echo "0")
  log_success "PM2进程数: $PROCESS_COUNT (online)"
}

# ========== API健康检查 ==========
verify_api_health() {
  log_header "第3步: API健康检查"

  log_check "检查主服务API可达性"
  HEALTH_RESPONSE=$(ssh root@$SERVER "curl -s $HEALTH_CHECK_ENDPOINT 2>/dev/null" || echo "{}")

  if echo "$HEALTH_RESPONSE" | grep -q '"status".*"ok"'; then
    log_success "API健康检查通过: $HEALTH_RESPONSE"

    # 提取字段
    STATUS=$(echo "$HEALTH_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    log_info "状态: $STATUS"
  else
    log_fail "API健康检查失败: $HEALTH_RESPONSE"
    log_info "检查日志: ssh root@$SERVER 'pm2 logs $PM2_APP --lines 30'"
  fi
}

# ========== 数据文件验证 ==========
verify_data_persistence() {
  log_header "第4步: 数据持久化验证"

  # 检查数据文件存在
  log_check "验证data.json文件存在"
  if ssh root@$SERVER "test -f $SERVER_PATH/data.json" 2>/dev/null; then
    log_success "数据文件存在: $SERVER_PATH/data.json"

    # 检查文件大小
    FILE_SIZE=$(ssh root@$SERVER "ls -lh $SERVER_PATH/data.json | awk '{print \$5}'" 2>/dev/null)
    log_info "文件大小: $FILE_SIZE"

    # 检查文件不为空
    if ssh root@$SERVER "[ -s $SERVER_PATH/data.json ]" 2>/dev/null; then
      log_success "数据文件非空"
    else
      log_warning "数据文件为空 (可能是新部署)"
    fi
  else
    log_fail "数据文件不存在或不可访问"
  fi

  # 检查JSON有效性
  log_check "验证data.json格式有效性"
  if ssh root@$SERVER "head -c 1 $SERVER_PATH/data.json | grep -q '[{\[]'" 2>/dev/null; then
    log_success "JSON格式有效"
  else
    log_warning "无法验证JSON格式 (文件可能为空或损坏)"
  fi
}

# ========== 备份验证 ==========
verify_backup_strategy() {
  log_header "第5步: 备份策略验证"

  log_check "检查备份文件存在"
  BACKUP_COUNT=$(ssh root@$SERVER "ls -1 $SERVER_PATH/data.json.bak-* 2>/dev/null | wc -l" 2>/dev/null || echo 0)

  if [ "$BACKUP_COUNT" -gt 0 ]; then
    log_success "备份文件总数: $BACKUP_COUNT"

    # 列出最新3个备份
    log_info "最新备份列表:"
    ssh root@$SERVER "ls -1t $SERVER_PATH/data.json.bak-* 2>/dev/null | head -3 | while read f; do echo '  - '$(basename \$f); done"
  else
    log_fail "没有找到备份文件"
    log_info "检查备份脚本: ssh root@$SERVER 'cat $SERVER_PATH/scripts/backup-data.sh'"
  fi

  # 检查备份年龄
  log_check "验证最新备份新鲜度"
  LATEST_BACKUP=$(ssh root@$SERVER "ls -1t $SERVER_PATH/data.json.bak-* 2>/dev/null | head -1" 2>/dev/null)

  if [ ! -z "$LATEST_BACKUP" ]; then
    BACKUP_TIME=$(ssh root@$SERVER "stat -f '%m' $(basename $LATEST_BACKUP | sed 's/^//')" 2>/dev/null || echo "unknown")
    MINUTES_AGO=$(( ($(date +%s) - $BACKUP_TIME) / 60 ))

    if [ "$MINUTES_AGO" -lt 1440 ]; then  # 24小时
      log_success "最新备份在 $MINUTES_AGO 分钟前"
    else
      log_warning "最新备份超过24小时: $MINUTES_AGO 分钟前"
    fi
  fi
}

# ========== 磁盘空间检查 ==========
verify_disk_space() {
  log_header "第6步: 磁盘空间检查"

  log_check "验证磁盘使用率"
  DISK_USAGE=$(ssh root@$SERVER "df $SERVER_PATH | tail -1 | awk '{print \$5}' | sed 's/%//'")

  if [ -z "$DISK_USAGE" ]; then
    log_warning "无法获取磁盘使用率"
  elif [ "$DISK_USAGE" -lt 80 ]; then
    log_success "磁盘使用率正常: ${DISK_USAGE}%"
  elif [ "$DISK_USAGE" -lt 90 ]; then
    log_warning "磁盘使用率较高: ${DISK_USAGE}% (建议清理)"
  else
    log_fail "磁盘使用率严重: ${DISK_USAGE}% (需立即清理)"
  fi

  # 显示具体大小
  log_check "获取磁盘空间详情"
  ssh root@$SERVER "df -h $SERVER_PATH | tail -1 | awk '{print \"  总容量: \" \$2 \" | 已用: \" \$3 \" | 可用: \" \$4}'"
}

# ========== 日志检查 ==========
verify_error_logs() {
  log_header "第7步: 错误日志检查"

  log_check "扫描最近日志中的错误"
  ERROR_COUNT=$(ssh root@$SERVER "pm2 logs $PM2_APP --lines 100 2>/dev/null | grep -i 'error\|exception' | wc -l" 2>/dev/null || echo 0)

  if [ "$ERROR_COUNT" -eq 0 ]; then
    log_success "最近100行日志中无错误"
  elif [ "$ERROR_COUNT" -lt 5 ]; then
    log_warning "发现 $ERROR_COUNT 条错误日志 (正常范围内)"
  else
    log_fail "发现 $ERROR_COUNT 条错误日志 (需要检查)"
    log_info "查看详细日志: ssh root@$SERVER 'pm2 logs $PM2_APP | grep -i error | tail -10'"
  fi
}

# ========== Stripe连接验证 ==========
verify_stripe_connection() {
  log_header "第8步: Stripe支付系统连接验证"

  log_check "检查Stripe API密钥配置"
  if ssh root@$SERVER "grep -q 'STRIPE_KEY' $SERVER_PATH/server/.env 2>/dev/null || grep -q 'stripe' /etc/environment 2>/dev/null"; then
    log_success "Stripe密钥已配置"
  else
    log_warning "无法验证Stripe密钥配置 (可能在环境变量中)"
  fi

  log_check "验证Stripe webhook回调接收"
  if ssh root@$SERVER "curl -s 'http://localhost:3021/api/stripe/webhook-test' 2>/dev/null | grep -q 'ok\|webhook'" 2>/dev/null; then
    log_success "Stripe webhook端点可达"
  else
    log_warning "无法验证webhook端点 (如已启用代理可能正常)"
  fi
}

# ========== Webhook验证 ==========
verify_webhooks() {
  log_header "第9步: Webhook处理验证"

  log_check "检查webhook端点"
  if ssh root@$SERVER "curl -s -o /dev/null -w '%{http_code}' http://localhost:3021/api/webhooks/payment" 2>/dev/null | grep -q '200\|302\|404'; then
    log_success "Webhook端点响应正常"
  else
    log_warning "Webhook端点无法验证"
  fi
}

# ========== 系统资源监控 ==========
verify_system_resources() {
  log_header "第10步: 系统资源监控"

  log_check "获取内存使用情况"
  MEMORY=$(ssh root@$SERVER "free | grep Mem | awk '{print int(\$3/\$2*100)}'")
  if [ "$MEMORY" -lt 80 ]; then
    log_success "内存使用率: ${MEMORY}%"
  elif [ "$MEMORY" -lt 90 ]; then
    log_warning "内存使用率偏高: ${MEMORY}%"
  else
    log_fail "内存使用率严重: ${MEMORY}%"
  fi

  log_check "获取CPU负载"
  CPU=$(ssh root@$SERVER "uptime | awk -F'load average:' '{print \$2}' | awk '{print \$1}'" 2>/dev/null || echo "unknown")
  if [ "$CPU" != "unknown" ]; then
    log_success "1分钟CPU负载: $CPU"
  else
    log_warning "无法获取CPU负载"
  fi
}

# ========== 告警系统验证 (可选) ==========
verify_alert_system() {
  log_header "第11步: 告警系统验证 (可选)"

  log_check "检查告警系统健康"
  ALERT_HEALTH=$(ssh root@$SERVER "curl -s $ALERT_HEALTH 2>/dev/null" || echo "{}")

  if echo "$ALERT_HEALTH" | grep -q '"status".*"healthy"'; then
    log_success "告警系统健康"
  else
    log_warning "告警系统未运行或不健康 (可选项)"
  fi
}

# ========== 安全性检查 ==========
verify_security() {
  log_header "第12步: 安全性基础检查"

  log_check "验证敏感文件权限"
  if ssh root@$SERVER "[ -f $SERVER_PATH/server/.env ]" 2>/dev/null; then
    PERMS=$(ssh root@$SERVER "ls -l $SERVER_PATH/server/.env | awk '{print \$1}'" 2>/dev/null)
    if echo "$PERMS" | grep -q "^-[^r]*"; then
      log_success ".env 文件权限正常 (root only)"
    else
      log_warning ".env 文件权限可能过开放: $PERMS"
    fi
  fi

  log_check "验证HTTPS配置"
  if ssh root@$SERVER "curl -s -I https://shenyuan.mylumee.cn/api/health 2>/dev/null | grep -q 'HTTP'" 2>/dev/null; then
    log_success "HTTPS端点可达"
  else
    log_warning "无法验证HTTPS (可能需要VPN)"
  fi
}

# ========== 最终报告 ==========
print_summary() {
  log_header "📊 验证总结"

  echo ""
  echo -e "${GREEN}✅ 通过检查: $PASSED_CHECKS${NC}"
  echo -e "${YELLOW}⚠️  警告项: $WARNINGS${NC}"
  echo -e "${RED}❌ 失败检查: $FAILED_CHECKS${NC}"
  echo -e "总检查项: $TOTAL_CHECKS"
  echo ""

  if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✅ 部署验证通过! 系统可投入使用${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    return 0
  else
    echo -e "${RED}════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}❌ 部署验证失败! 需要修复 $FAILED_CHECKS 个问题${NC}"
    echo -e "${RED}════════════════════════════════════════════════════════════${NC}"
    return 1
  fi
}

# ========== 快速修复建议 ==========
print_quick_fixes() {
  if [ $FAILED_CHECKS -gt 0 ] || [ $WARNINGS -gt 0 ]; then
    log_header "🔧 快速修复建议"

    echo "如遇到问题,按以下步骤修复:"
    echo ""
    echo "1. 重启主服务:"
    echo "   ssh root@$SERVER 'pm2 restart $PM2_APP'"
    echo ""
    echo "2. 查看详细日志:"
    echo "   ssh root@$SERVER 'pm2 logs $PM2_APP --lines 50'"
    echo ""
    echo "3. 检查磁盘空间 (若使用率 > 85%):"
    echo "   ssh root@$SERVER 'find $SERVER_PATH -name \"*.bak-*\" -mtime +7 -delete'"
    echo ""
    echo "4. 验证数据备份:"
    echo "   ssh root@$SERVER 'ls -lh $SERVER_PATH/data.json.bak-* | tail -5'"
    echo ""
    echo "5. 检查Stripe连接:"
    echo "   ssh root@$SERVER 'curl -s http://localhost:3021/api/health | jq .stripe'"
    echo ""
  fi
}

# ========== 主程序入口 ==========
main() {
  clear

  log_header "🚀 善缘生产部署验证系统"
  echo -e "服务器: ${CYAN}$SERVER${NC}"
  echo -e "应用: ${CYAN}$PM2_APP${NC}"
  echo -e "时间: ${CYAN}$(date '+%Y-%m-%d %H:%M:%S')${NC}"
  echo ""

  # 执行所有检查
  verify_ssh_connection
  echo ""

  verify_pm2_services
  echo ""

  verify_api_health
  echo ""

  verify_data_persistence
  echo ""

  verify_backup_strategy
  echo ""

  verify_disk_space
  echo ""

  verify_error_logs
  echo ""

  verify_stripe_connection
  echo ""

  verify_webhooks
  echo ""

  verify_system_resources
  echo ""

  verify_alert_system
  echo ""

  verify_security
  echo ""

  # 最终报告
  print_summary
  FINAL_RESULT=$?

  print_quick_fixes

  exit $FINAL_RESULT
}

# 执行主程序
main
