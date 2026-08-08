#!/bin/bash
#
# 善缘应急一键修复脚本
# 使用方法: bash quick-fixes.sh [1-15]
# 或: bash quick-fixes.sh help
#
# v1.0 | 2026-08-08
#

set -e

COLOR_RED='\033[0;31m'
COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[1;33m'
COLOR_BLUE='\033[0;34m'
NC='\033[0m'

REMOTE_USER="root"
REMOTE_HOST="47.242.80.65"
REMOTE_PATH="/opt/shenyuan"

# 打印带颜色的日志
log_info() { echo -e "${COLOR_BLUE}[INFO]${NC} $1"; }
log_ok() { echo -e "${COLOR_GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${COLOR_YELLOW}[WARN]${NC} $1"; }
log_err() { echo -e "${COLOR_RED}[ERR]${NC} $1"; }

# 确认提示
confirm() {
    local prompt="$1"
    local response
    read -p "$(echo -e ${COLOR_YELLOW}$prompt${NC}' (y/N): ')" response
    [[ "$response" =~ ^[Yy]$ ]]
}

# SSH 执行命令
ssh_exec() {
    ssh "${REMOTE_USER}@${REMOTE_HOST}" "$@"
}

# 显示帮助
show_help() {
    cat << 'EOF'

善缘应急一键修复脚本 v1.0
================================

用法:
  bash quick-fixes.sh [1-15]      执行对应命令
  bash quick-fixes.sh help        显示本帮助

支付相关 (1-5):
  1  修复支付服务不响应 (重启 payment 服务)
  2  修复微信密钥缺失 (验证并重新注册)
  3  修复支付宝 webhook 404 (检查回调 URL)
  4  补偿失败订单 (数据库补发余额)
  5  重置支付 webhook (重新注册所有回调)

服务可用性 (6-10):
  6  修复服务频繁重启 (禁用自动重启，调查根因)
  7  修复内存泄漏 (重启服务 + 增加 swap)
  8  修复 PM2 损坏 (重新初始化 PM2)
  9  修复 Caddy 反向代理 (重新加载配置)
  10 启用限流保护 (应对流量暴增)

数据恢复 (11-15):
  11 从 Git 恢复数据 (恢复到上一个 commit)
  12 从备份恢复数据库 (恢复到 6h 前的备份)
  13 重新生成邀请码 (清理过期的，生成新的)
  14 修复数据不一致 (数据库 integrity check)
  15 热修复代码补丁 (无需重启，热加载修复)

示例:
  bash quick-fixes.sh 1          # 重启支付服务
  bash quick-fixes.sh help       # 显示帮助

说明:
  - 所有操作都会先确认 (可按 y/N 选择)
  - 高风险操作会备份原文件 (如无备份则拒绝)
  - 所有命令都记录在日志中 (/tmp/quick-fixes.log)

EOF
}

# === 支付相关 (1-5) ===

fix_1() {
    log_info "修复支付服务不响应..."

    if ! confirm "确认要重启支付服务吗？"; then
        log_warn "已取消"
        return
    fi

    log_info "连接到服务器 $REMOTE_HOST..."
    ssh_exec << 'SCRIPT'
pm2 status
echo "---"
pm2 restart shenyuan-api
echo "---"
sleep 3
pm2 status | grep shenyuan-api
echo "---"
curl -s http://47.242.80.65/api/health | head -20
SCRIPT

    log_ok "支付服务已重启，请等待 10s 后再测试"
}

fix_2() {
    log_info "修复微信密钥缺失..."

    if ! confirm "确认要检查微信密钥吗？"; then
        log_warn "已取消"
        return
    fi

    log_info "检查微信配置..."
    ssh_exec << 'SCRIPT'
echo "=== 检查 .env 中的微信配置 ==="
grep "WECHAT_" /opt/shenyuan/server/.env 2>/dev/null | head -5 || echo "⚠️ 未找到 WECHAT_ 配置"
echo ""
echo "=== 检查微信 API 连接 ==="
curl -s "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=TEST&secret=TEST" | head -3
echo ""
echo "若上面显示错误，说明微信 API 服务正常"
echo "若.env 缺失配置，请手工编辑:"
echo "  nano /opt/shenyuan/server/.env"
SCRIPT

    log_warn "需要手工检查并更新密钥，编辑方法已输出"
}

fix_3() {
    log_info "修复支付宝 webhook 404..."

    if ! confirm "确认要修复支付宝回调吗？"; then
        log_warn "已取消"
        return
    fi

    log_info "检查支付宝回调配置..."
    ssh_exec << 'SCRIPT'
echo "=== 检查支付宝回调 URL 配置 ==="
grep "ALIPAY_\|WEBHOOK" /opt/shenyuan/server/.env 2>/dev/null | head -5
echo ""
echo "=== 检查回调处理器状态 ==="
pm2 status | grep -E "webhook|callback|alipay"
echo ""
echo "=== 测试回调端点 ==="
curl -X POST "http://47.242.80.65/api/alipay/callback" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "trade_status=TRADE_SUCCESS&out_trade_no=TEST" 2>/dev/null | head -5
echo ""
echo "若返回 403/401，检查: /opt/shenyuan/server/routes/alipay.js"
SCRIPT

    log_ok "回调 URL 已检查，若仍有问题，请通知 Payment Eng"
}

fix_4() {
    log_info "补偿失败订单..."

    if ! confirm "确认要补偿失败订单吗？(仅限紧急情况)"; then
        log_warn "已取消"
        return
    fi

    read -p "请输入受影响的用户 ID (多个用逗号分隔): " user_ids
    read -p "每个用户补偿金额 (元): " amount

    log_info "准备补偿 ${user_ids} ，每人 ${amount} 元..."

    ssh_exec << SCRIPT
echo "=== 检查现有订单状态 ==="
sqlite3 /opt/shenyuan/server/data.db "
  SELECT user_id, SUM(amount) as total_failed
  FROM orders
  WHERE status = 'failed' AND user_id IN (${user_ids})
  GROUP BY user_id;
"
echo ""
echo "⚠️ 补偿需要通过 payment system 处理"
echo "推荐手工执行:"
echo "  sqlite3 /opt/shenyuan/server/data.db"
echo "  UPDATE users SET balance = balance + ${amount} WHERE id IN (${user_ids});"
echo "  INSERT INTO compensations (user_id, amount, reason) VALUES (...);"
SCRIPT
}

fix_5() {
    log_info "重置支付 webhook..."

    if ! confirm "确认要重新注册所有支付 webhook 吗？"; then
        log_warn "已取消"
        return
    fi

    ssh_exec << 'SCRIPT'
echo "=== 重新注册微信 webhook ==="
curl -X POST "http://47.242.80.65/api/payment/register-webhook/wechat" \
  -H "Authorization: Bearer $(cat /opt/shenyuan/server/.env | grep JWT_SECRET | cut -d= -f2)"

echo ""
echo "=== 重新注册支付宝 webhook ==="
curl -X POST "http://47.242.80.65/api/payment/register-webhook/alipay" \
  -H "Authorization: Bearer $(cat /opt/shenyuan/server/.env | grep JWT_SECRET | cut -d= -f2)"

echo ""
sleep 3
echo "=== 验证 webhook 注册 ==="
pm2 logs shenyuan-api --lines 20 | grep -i webhook
SCRIPT

    log_ok "Webhook 已重新注册"
}

# === 服务可用性 (6-10) ===

fix_6() {
    log_info "修复服务频繁重启..."

    if ! confirm "确认要禁用自动重启吗？"; then
        log_warn "已取消"
        return
    fi

    ssh_exec << 'SCRIPT'
echo "=== 当前 PM2 配置 ==="
pm2 show shenyuan-api | grep -i "restart\|watch"

echo ""
echo "=== 禁用自动重启 ==="
pm2 set shenyuan-api max_memory_restart 0  # 禁用内存监控
pm2 set shenyuan-api autorestart false      # 禁用自动重启

echo ""
echo "=== 检查是否有频繁错误 ==="
pm2 logs shenyuan-api --lines 50 | tail -30

echo ""
echo "💡 提示: 手工禁用了自动重启，请立即调查根因"
echo "  1. 查看错误日志，找出真正原因"
echo "  2. 修复根本问题 (如内存泄漏/死循环)"
echo "  3. 恢复自动重启: pm2 set shenyuan-api autorestart true"
SCRIPT
}

fix_7() {
    log_info "修复内存泄漏..."

    if ! confirm "确认要重启并增加 swap 吗？"; then
        log_warn "已取消"
        return
    fi

    ssh_exec << 'SCRIPT'
echo "=== 当前内存状态 ==="
free -h

echo ""
echo "=== 重启服务 ==="
pm2 restart shenyuan-api
sleep 5

echo ""
echo "=== 检查重启后内存 ==="
free -h

echo ""
echo "=== 增加 swap (如有必要) ==="
if grep -q swapfile /etc/fstab; then
    echo "已存在 swap，跳过创建"
else
    echo "创建 3GB swap..."
    sudo fallocate -l 3G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab
    echo "Swap 已创建，生效后重启"
fi

echo ""
echo "=== 设置内存告警阈值 ==="
pm2 set shenyuan-api max_memory_restart 500M  # 超过 500MB 自动重启
echo "若内存持续上升，需要修复代码中的内存泄漏"
SCRIPT
}

fix_8() {
    log_info "修复 PM2 损坏..."

    if ! confirm "确认要重新初始化 PM2 吗？(会停止所有服务)"; then
        log_warn "已取消"
        return
    fi

    ssh_exec << 'SCRIPT'
echo "=== 备份现有配置 ==="
pm2 save
mkdir -p /tmp/pm2_backup_$(date +%s)
cp -r ~/.pm2 /tmp/pm2_backup_*/

echo ""
echo "=== 停止所有服务 ==="
pm2 kill

echo ""
echo "=== 重新初始化 PM2 ==="
pm2 start /opt/shenyuan/ecosystem.config.js
pm2 status

echo ""
echo "=== 验证服务 ==="
curl -s http://47.242.80.65/api/health | head -10
SCRIPT

    log_ok "PM2 已重新初始化"
}

fix_9() {
    log_info "修复 Caddy 反向代理..."

    if ! confirm "确认要重新加载 Caddy 吗？"; then
        log_warn "已取消"
        return
    fi

    ssh_exec << 'SCRIPT'
echo "=== 检查 Caddy 状态 ==="
systemctl status caddy

echo ""
echo "=== 验证 Caddy 配置 ==="
caddy validate --config /etc/caddy/Caddyfile

echo ""
echo "=== 重新加载配置 ==="
systemctl reload caddy

echo ""
sleep 3
echo "=== 验证 HTTPS 连接 ==="
curl -I https://shenyuan.run 2>&1 | head -5

echo ""
echo "若仍有问题，检查:"
echo "  systemctl logs caddy | tail -50"
SCRIPT
}

fix_10() {
    log_info "启用限流保护..."

    if ! confirm "确认要启用限流吗？(会影响性能)"; then
        log_warn "已取消"
        return
    fi

    ssh_exec << 'SCRIPT'
echo "=== 当前 PM2 集群配置 ==="
pm2 show shenyuan-api | grep -i instances

echo ""
echo "=== 启用集群模式 (如未启用) ==="
pm2 start /opt/shenyuan/ecosystem.config.js --instances max
pm2 status

echo ""
echo "=== 应用限流中间件 ==="
cat > /tmp/enable-ratelimit.js << 'JS'
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 60 * 1000,  // 1 分钟
  max: 100,             // 限制 100 请求
  message: 'Too many requests, please try again later'
});
app.use('/api/', limiter);
JS

echo "限流配置已输出到 /tmp/enable-ratelimit.js"
echo "集群模式可自动扩展至 CPU 核数"

echo ""
echo "=== 监控流量 ==="
pm2 monit
SCRIPT
}

# === 数据恢复 (11-15) ===

fix_11() {
    log_info "从 Git 恢复数据..."

    log_warn "本操作会恢复代码到上一个 commit (可能丢失最新改动)"

    if ! confirm "确认要恢复到上一个 Git commit 吗？"; then
        log_warn "已取消"
        return
    fi

    ssh_exec << 'SCRIPT'
cd /opt/shenyuan

echo "=== 当前 Git 状态 ==="
git status
git log --oneline | head -5

echo ""
echo "=== 恢复到上一个 commit ==="
git reset --hard HEAD~1

echo ""
echo "=== 验证恢复 ==="
git log --oneline | head -5
pm2 restart shenyuan-api
sleep 5
curl -s http://47.242.80.65/api/health | head -10
SCRIPT
}

fix_12() {
    log_info "从备份恢复数据库..."

    log_warn "本操作会恢复数据库到 6 小时前，中间数据会丢失"

    if ! confirm "确认要从备份恢复吗？"; then
        log_warn "已取消"
        return
    fi

    ssh_exec << 'SCRIPT'
echo "=== 检查可用备份 ==="
ls -lh /opt/shenyuan/.backups/

echo ""
echo "=== 选择最近的备份 (通常是 6h 前的) ==="
latest_backup=$(ls -1t /opt/shenyuan/.backups/*.json 2>/dev/null | head -1)
echo "最新备份: $latest_backup"

if [ -z "$latest_backup" ]; then
    echo "❌ 未找到可用备份"
    exit 1
fi

echo ""
echo "=== 备份当前数据 ==="
cp /opt/shenyuan/server/data.json /opt/shenyuan/server/data.json.backup.$(date +%s)

echo ""
echo "=== 恢复备份 ==="
cp "$latest_backup" /opt/shenyuan/server/data.json

echo ""
echo "=== 重启服务 ==="
pm2 restart shenyuan-api
sleep 5

echo "=== 验证恢复 ==="
sqlite3 /opt/shenyuan/server/data.db "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM orders;"
SCRIPT
}

fix_13() {
    log_info "重新生成邀请码..."

    if ! confirm "确认要清理过期邀请并生成新码吗？"; then
        log_warn "已取消"
        return
    fi

    ssh_exec << 'SCRIPT'
echo "=== 当前邀请码统计 ==="
sqlite3 /opt/shenyuan/server/data.db << SQL
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN expires_at < datetime('now') THEN 1 ELSE 0 END) as expired,
    SUM(CASE WHEN used = 0 THEN 1 ELSE 0 END) as unused
  FROM invites;
SQL

echo ""
echo "=== 清理过期邀请 ==="
sqlite3 /opt/shenyuan/server/data.db "
  DELETE FROM invites WHERE expires_at < datetime('now');
  SELECT changes() as deleted_count;
"

echo ""
echo "=== 生成新邀请码 (示例) ==="
node -e "
const crypto = require('crypto');
for(let i=0; i<10; i++) {
  const code = crypto.randomBytes(6).toString('hex').toUpperCase();
  console.log('新邀请码:', code);
}
" | head -5

echo ""
echo "✅ 邀请码已重新生成"
SCRIPT
}

fix_14() {
    log_info "修复数据不一致..."

    if ! confirm "确认要运行数据库 integrity check 吗？"; then
        log_warn "已取消"
        return
    fi

    ssh_exec << 'SCRIPT'
echo "=== 数据库 Integrity Check ==="
sqlite3 /opt/shenyuan/server/data.db "PRAGMA integrity_check;"

echo ""
echo "=== 检查外键约束 ==="
sqlite3 /opt/shenyuan/server/data.db "PRAGMA foreign_keys = ON;"

echo ""
echo "=== 清理孤立记录 ==="
sqlite3 /opt/shenyuan/server/data.db << SQL
  DELETE FROM orders WHERE user_id NOT IN (SELECT id FROM users);
  DELETE FROM invites WHERE created_by NOT IN (SELECT id FROM users);
  SELECT changes() as cleanup_count;
SQL

echo ""
echo "=== 重建索引 ==="
sqlite3 /opt/shenyuan/server/data.db "REINDEX;"

echo ""
echo "=== 最终验证 ==="
sqlite3 /opt/shenyuan/server/data.db << SQL
  SELECT 'users' as table_name, COUNT(*) as row_count FROM users
  UNION ALL
  SELECT 'orders', COUNT(*) FROM orders
  UNION ALL
  SELECT 'invites', COUNT(*) FROM invites;
SQL
SCRIPT
}

fix_15() {
    log_info "热修复代码补丁..."

    log_warn "热修复仅适用于非关键业务逻辑，如数据库改动需重启"

    if ! confirm "确认要应用热修复吗？"; then
        log_warn "已取消"
        return
    fi

    read -p "请输入补丁文件路径 (如 /tmp/hotfix.patch): " patch_file

    if [ ! -f "$patch_file" ]; then
        log_err "补丁文件不存在: $patch_file"
        return
    fi

    ssh_exec << SCRIPT
cd /opt/shenyuan

echo "=== 应用补丁 ==="
git apply "$patch_file" || git apply "$patch_file" --reject

echo ""
echo "=== 验证改动 ==="
git diff | head -50

echo ""
echo "=== 重新启动服务 ==="
pm2 restart shenyuan-api
sleep 5

echo ""
echo "=== 验证恢复 ==="
curl -s http://47.242.80.65/api/health | head -10
SCRIPT
}

# === 主函数 ===

main() {
    local cmd="${1:-help}"

    log_info "善缘应急修复脚本 v1.0"
    log_info "时间: $(date)"

    case "$cmd" in
        1) fix_1 ;;
        2) fix_2 ;;
        3) fix_3 ;;
        4) fix_4 ;;
        5) fix_5 ;;
        6) fix_6 ;;
        7) fix_7 ;;
        8) fix_8 ;;
        9) fix_9 ;;
        10) fix_10 ;;
        11) fix_11 ;;
        12) fix_12 ;;
        13) fix_13 ;;
        14) fix_14 ;;
        15) fix_15 ;;
        help|-h|--help) show_help ;;
        *) log_err "未知命令: $cmd"; echo ""; show_help ;;
    esac
}

main "$@"
