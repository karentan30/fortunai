#!/bin/bash

#############################################################################
# 善缘监控告警系统 - 快速部署脚本
# 功能: 一键配置Slack webhook + 启动告警系统 + 配置定时任务
# 使用: bash monitoring-setup.sh
#############################################################################

set -e  # 任何命令失败即退出

# ========== 颜色定义 ==========
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ========== 工具函数 ==========
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
  exit 1
}

# ========== 前置检查 ==========
log_info "启动监控系统部署..."

# 检查Node.js
if ! command -v node &> /dev/null; then
  log_error "未找到Node.js,请先安装: brew install node"
fi
log_success "Node.js版本: $(node --version)"

# 检查pm2
if ! command -v pm2 &> /dev/null; then
  log_info "安装pm2..."
  npm install -g pm2
fi
log_success "pm2已就绪"

# 检查脚本文件
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [ ! -f "$SCRIPT_DIR/slack-alerts.js" ]; then
  log_error "未找到 $SCRIPT_DIR/slack-alerts.js"
fi

if [ ! -f "$SCRIPT_DIR/slack-webhook-template.json" ]; then
  log_error "未找到 $SCRIPT_DIR/slack-webhook-template.json"
fi

log_success "所有脚本文件已检查"

# ========== Slack Webhook 配置 ==========
log_info ""
log_info "════════════════════════════════════════════════════════════"
log_info "步骤 1: 配置 Slack Webhook"
log_info "════════════════════════════════════════════════════════════"

ENV_FILE="$HOME/.env.production"

read -p "是否需要配置Slack webhook? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  if [ -f "$ENV_FILE" ]; then
    log_warning "检测到 $ENV_FILE 已存在,将追加新配置"
  else
    log_info "创建 $ENV_FILE..."
    touch "$ENV_FILE"
    chmod 600 "$ENV_FILE"
  fi

  log_info "请访问 https://api.slack.com/apps 创建webhook URL"
  log_info ""

  read -p "请输入 SLACK_WEBHOOK_ALERTS: " webhook_alerts
  read -p "请输入 SLACK_WEBHOOK_PAYMENT: " webhook_payment
  read -p "请输入 SLACK_WEBHOOK_INVITES: " webhook_invites
  read -p "请输入 SLACK_WEBHOOK_INFRA: " webhook_infra

  # 检查是否已存在(避免重复)
  if ! grep -q "SLACK_WEBHOOK_ALERTS" "$ENV_FILE" 2>/dev/null; then
    cat >> "$ENV_FILE" <<EOF

# 善缘Slack告警系统 webhook配置
SLACK_WEBHOOK_ALERTS=$webhook_alerts
SLACK_WEBHOOK_PAYMENT=$webhook_payment
SLACK_WEBHOOK_INVITES=$webhook_invites
SLACK_WEBHOOK_INFRA=$webhook_infra
ALERT_SERVER_PORT=3007
EOF
    log_success "Webhook已配置到 $ENV_FILE"
  else
    log_warning "webhook已存在,跳过配置"
  fi
else
  log_warning "跳过webhook配置,告警系统将无法发送通知"
  log_info "后续可手动编辑 $ENV_FILE 进行配置"
fi

# ========== 安装依赖 ==========
log_info ""
log_info "════════════════════════════════════════════════════════════"
log_info "步骤 2: 安装依赖"
log_info "════════════════════════════════════════════════════════════"

cd "$PROJECT_ROOT"

if [ -f "package.json" ] && ! grep -q "\"dependencies\"" package.json; then
  log_info "更新 package.json..."
  cat >> package.json <<'EOF'
,
  "dependencies": {
    "pm2": "latest"
  }
EOF
fi

log_success "依赖检查完成"

# ========== 启动告警系统 ==========
log_info ""
log_info "════════════════════════════════════════════════════════════"
log_info "步骤 3: 启动告警系统"
log_info "════════════════════════════════════════════════════════════"

# 检查是否已启动
if pm2 list | grep -q "shenyuan-alerts"; then
  log_warning "检测到告警系统已运行,重启中..."
  pm2 restart shenyuan-alerts || log_error "重启失败"
else
  log_info "启动新的告警系统实例..."
  pm2 start "$SCRIPT_DIR/slack-alerts.js" \
    --name shenyuan-alerts \
    --env production \
    -i 1 \
    --max-memory-restart 512M \
    --error "$PROJECT_ROOT/logs/alerts-error.log" \
    --output "$PROJECT_ROOT/logs/alerts-output.log" \
    || log_error "启动失败"
fi

# 验证启动
sleep 2
if pm2 list | grep -q "shenyuan-alerts"; then
  pm2 save
  log_success "告警系统已启动: $(pm2 list | grep shenyuan-alerts)"
else
  log_error "告警系统启动失败,查看日志: pm2 logs shenyuan-alerts"
fi

# ========== 验证告警系统 ==========
log_info ""
log_info "════════════════════════════════════════════════════════════"
log_info "步骤 4: 验证告警系统"
log_info "════════════════════════════════════════════════════════════"

log_info "等待服务启动..."
sleep 2

# 测试健康检查
HEALTH_CHECK=$(curl -s http://localhost:3007/health)
if echo "$HEALTH_CHECK" | grep -q "healthy"; then
  log_success "健康检查通过"
else
  log_error "健康检查失败: $HEALTH_CHECK"
fi

# 测试指标端点
METRICS=$(curl -s http://localhost:3007/metrics)
if echo "$METRICS" | grep -q "metrics"; then
  log_success "指标端点可用"
else
  log_error "指标端点不可用"
fi

# ========== 设置定时任务 ==========
log_info ""
log_info "════════════════════════════════════════════════════════════"
log_info "步骤 5: 配置定时任务 (可选)"
log_info "════════════════════════════════════════════════════════════"

read -p "是否添加定时服务器监控上报? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  log_info "创建监控脚本..."
  cat > "$SCRIPT_DIR/server-metrics-cron.sh" <<'EOFCRON'
#!/bin/bash
# 定时上报服务器指标到告警系统
# 部署: crontab -e
# 每5分钟执行: */5 * * * * /path/to/server-metrics-cron.sh

ALERT_URL="http://localhost:3007/alert/server"

# 获取服务器指标
MEMORY=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
DISK=$(df / | tail -1 | awk '{print int($3/$2 * 100)}')
CPU=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print int(100 - $1)}')

# 获取API错误数(从日志)
ERRORS=$(grep "ERROR\|500\|503" /var/log/shenyuan/*.log 2>/dev/null | wc -l || echo 0)
REQUESTS=$(grep "GET\|POST" /var/log/shenyuan/*.log 2>/dev/null | wc -l || echo 1)

# 发送到告警系统
curl -s -X POST "$ALERT_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"memory\": $MEMORY,
    \"disk\": $DISK,
    \"cpu\": $CPU,
    \"errors\": $ERRORS,
    \"requests\": $REQUESTS
  }"
EOFCRON

  chmod +x "$SCRIPT_DIR/server-metrics-cron.sh"
  log_success "监控脚本已创建: $SCRIPT_DIR/server-metrics-cron.sh"

  # 安装cron任务
  CRON_JOB="*/5 * * * * $SCRIPT_DIR/server-metrics-cron.sh > /tmp/server-metrics-cron.log 2>&1"

  # 检查cron是否已存在
  if crontab -l 2>/dev/null | grep -q "server-metrics-cron.sh"; then
    log_warning "Cron任务已存在,跳过添加"
  else
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    log_success "Cron任务已安装,每5分钟上报一次服务器指标"
  fi
else
  log_warning "跳过cron配置,后续可手动添加"
fi

# ========== 配置自动启动 ==========
log_info ""
log_info "════════════════════════════════════════════════════════════"
log_info "步骤 6: 配置开机自动启动"
log_info "════════════════════════════════════════════════════════════"

read -p "是否配置pm2开机自动启动? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  pm2 startup
  pm2 save
  log_success "pm2开机自启已配置"
else
  log_warning "跳过自启配置"
fi

# ========== 生成看板URL ==========
log_info ""
log_info "════════════════════════════════════════════════════════════"
log_info "步骤 7: 配置监控看板"
log_info "════════════════════════════════════════════════════════════"

DASHBOARD_FILE="$PROJECT_ROOT/monitoring-dashboard.html"
if [ -f "$DASHBOARD_FILE" ]; then
  log_success "监控看板已部署: $DASHBOARD_FILE"
  log_info "本地访问: file://$DASHBOARD_FILE"
  log_info "或使用HTTP服务: http://localhost:8000/monitoring-dashboard.html"
else
  log_warning "监控看板文件未找到"
fi

# ========== 测试告警 ==========
log_info ""
log_info "════════════════════════════════════════════════════════════"
log_info "步骤 8: 测试告警系统 (可选)"
log_info "════════════════════════════════════════════════════════════"

read -p "是否发送测试告警? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  log_info "发送测试支付通知..."
  curl -s -X POST http://localhost:3007/alert/payment \
    -H "Content-Type: application/json" \
    -d '{
      "type": "success",
      "amount": 99.9,
      "orderId": "test-'"$(date +%s)"'",
      "userId": "test-user",
      "processingTime": 1200
    }' && log_success "测试通知已发送" || log_error "发送失败"

  log_info "发送测试邀请通知..."
  curl -s -X POST http://localhost:3007/alert/invite \
    -H "Content-Type: application/json" \
    -d '{
      "referrer": "test-referrer",
      "invitee": "test-invitee",
      "activated": true,
      "activatedAt": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
      "reward": 50
    }' && log_success "邀请通知已发送" || log_error "发送失败"

  log_info "检查Slack通知是否已收到"
fi

# ========== 最终总结 ==========
log_info ""
log_info "════════════════════════════════════════════════════════════"
log_success "善缘监控告警系统部署完成!"
log_info "════════════════════════════════════════════════════════════"

echo ""
echo "📊 快速参考:"
echo "  启动告警系统:      pm2 start shenyuan-alerts"
echo "  重启告警系统:      pm2 restart shenyuan-alerts"
echo "  查看日志:         pm2 logs shenyuan-alerts"
echo "  查看进程状态:      pm2 list"
echo "  监控实时指标:      http://localhost:3007/metrics"
echo "  健康检查:         http://localhost:3007/health"
echo ""
echo "📋 支持的端点:"
echo "  POST /alert/payment  - 支付事件通知"
echo "  POST /alert/invite   - 邀请激活事件通知"
echo "  POST /alert/server   - 服务器指标上报"
echo "  GET /metrics        - 查询当前指标"
echo "  GET /health         - 健康检查"
echo ""
echo "📖 文档:"
echo "  告警规则:         $PROJECT_ROOT/docs/alert-rules.md"
echo "  Webhook配置:      $SCRIPT_DIR/slack-webhook-template.json"
echo "  监控看板:         $DASHBOARD_FILE"
echo ""
echo "🚨 关键命令:"
echo "  查看告警历史:      pm2 logs shenyuan-alerts | grep '\\[.*\\]'"
echo "  测试支付告警:      curl -X POST http://localhost:3007/alert/payment ..."
echo "  测试服务器告警:    curl -X POST http://localhost:3007/alert/server ..."
echo ""
echo "✅ 下一步:"
echo "  1. 在 Slack 检查 #shenyuan-alerts 频道是否已收到通知"
echo "  2. 配置后端服务在关键节点调用告警端点"
echo "  3. 打开监控看板: $DASHBOARD_FILE"
echo "  4. 定期审视告警规则 (docs/alert-rules.md)"
echo ""
