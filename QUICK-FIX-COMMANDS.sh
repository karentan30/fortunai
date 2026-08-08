#!/bin/bash
#
# 善缘 ShenYuan — 15 个一键修复命令
# 版本: v1.0 | 2026-08-08
# 用法: bash QUICK-FIX-COMMANDS.sh [command_number]
#       或逐个复制粘贴到终端
#
# 所有命令默认 SSH 登录到: root@47.242.80.65
# 若需改变，修改下面的 SSH_HOST 变量

set -e

SSH_HOST="root@47.242.80.65"
SHENYUAN_PATH="/opt/shenyuan"
COLOR_RED='\033[0;31m'
COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[1;33m'
COLOR_NC='\033[0m' # No Color

# 打印帮助信息
print_help() {
  cat << 'EOF'

╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║  善缘 ShenYuan — 15 个一键修复命令                                        ║
║  版本: v1.0 | 2026-08-08                                                  ║
║                                                                           ║
║  用法:                                                                     ║
║    bash QUICK-FIX-COMMANDS.sh [command_number]                           ║
║    例: bash QUICK-FIX-COMMANDS.sh 1                                       ║
║        bash QUICK-FIX-COMMANDS.sh 6                                       ║
║                                                                           ║
║  或复制单个命令粘贴到终端执行                                             ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝

───────────────────────────────────────────────────────────────────────────
支付相关修复 (1-5)
───────────────────────────────────────────────────────────────────────────

【1】修复：支付端点不响应 (5min)
    症状: /api/create-checkout 返回 5xx
    操作: 重启 API 服务 + 验证健康

【2】修复：微信支付密钥缺失 (3min)
    症状: "Invalid signature" 或 "Missing WECHAT_APP_ID"
    操作: 补充 .env + 重启

【3】修复：支付宝回调 404 (5min)
    症状: 微信支付成功但未入账（回调失败）
    操作: 检查路由 + 重新注册 webhook

【4】补偿：手动入账失败订单 (10min)
    症状: 用户真实支付成功但没收到商品
    操作: 手动触发支付完成回调

【5】恢复：重置支付 webhook (10min)
    症状: 支付回调一直失败
    操作: 注销旧 webhook + 注册新 webhook

───────────────────────────────────────────────────────────────────────────
服务可用性修复 (6-10)
───────────────────────────────────────────────────────────────────────────

【6】修复：服务频繁重启 (15min)
    症状: PM2 日志显示不断崩溃重启
    操作: 查错误日志 + 定位问题代码

【7】修复：内存泄漏（需重启）(5min)
    症状: 内存占用持续上升，响应变慢
    操作: 强制重启服务 + 清空缓存

【8】修复：PM2 损坏 (10min)
    症状: pm2 status 无法工作或卡顿
    操作: 重新初始化 PM2

【9】修复：Caddy 反代失效 (5min)
    症状: 外网访问返回 502/504
    操作: 重启 Caddy 反向代理

【10】启用集群模式应对流量 (5min)
     症状: 流量暴涨导致单进程无法应对
     操作: 启用 PM2 cluster 多进程模式

───────────────────────────────────────────────────────────────────────────
数据恢复修复 (11-15)
───────────────────────────────────────────────────────────────────────────

【11】恢复：数据损坏（从 Git）(3min)
     症状: data.json 文件损坏或截断
     操作: 从 Git 恢复最后一个好版本

【12】恢复：从最近备份还原 (5min)
     症状: 数据严重丢失，Git 也不行
     操作: 从每日备份恢复数据

【13】修复：邀请链接无效 (10min)
     症状: 用户通过邀请码无法建立配对
     操作: 重新生成邀请码 + 发送给用户

【14】修复：用户数据不一致 (10min)
     症状: 用户订单在数据库但无权限，或反之
     操作: 运行数据一致性检查脚本 + 修复

【15】热修复：生产环境代码补丁 (5min)
     症状: 发现 bug，需立即上线补丁
     操作: git pull + pm2 restart

───────────────────────────────────────────────────────────────────────────

按照下面的编号选择需要执行的命令，或将命令复制到终端直接执行。

EOF
}

# ============================================================================
# 支付相关修复 (1-5)
# ============================================================================

cmd_1_payment_restart() {
  echo -e "${COLOR_YELLOW}【1】正在执行：修复支付端点不响应...${COLOR_NC}"

  ssh $SSH_HOST << 'CMD'
    echo "📍 Step 1: 重启 API 服务..."
    pm2 restart shenyuan-api

    echo "⏳ 等待 5 秒..."
    sleep 5

    echo "📍 Step 2: 验证健康状态..."
    pm2 status

    echo "📍 Step 3: 测试支付端点..."
    curl -s http://47.242.80.65/api/products | jq '.[] | {id, name}' | head -20 || echo "JSON 解析失败，查看原始响应"

    echo "📍 Step 4: 查看日志..."
    pm2 logs shenyuan-api --lines 20 | grep -E "payment|health" || echo "无相关日志"
CMD

  echo -e "${COLOR_GREEN}✅ 命令执行完成${COLOR_NC}"
}

cmd_2_wechat_key_fix() {
  echo -e "${COLOR_YELLOW}【2】正在执行：修复微信支付密钥缺失...${COLOR_NC}"

  echo "⚠️  需要手动输入："
  read -p "请输入 WECHAT_APP_ID (如 wx...): " wechat_app_id
  read -p "请输入 WECHAT_MCH_ID (如 123...): " wechat_mch_id
  read -p "请输入 WECHAT_API_KEY: " wechat_api_key

  ssh $SSH_HOST << CMD
    echo "📍 Step 1: 备份原 .env..."
    cp /opt/shenyuan/server/.env /opt/shenyuan/server/.env.backup.\$(date +%s)

    echo "📍 Step 2: 追加微信密钥..."
    cat >> /opt/shenyuan/server/.env << 'EOFKEY'
# 微信支付密钥 (补充)
WECHAT_APP_ID=$wechat_app_id
WECHAT_MCH_ID=$wechat_mch_id
WECHAT_API_KEY=$wechat_api_key
EOFKEY

    echo "📍 Step 3: 验证配置..."
    grep "WECHAT_" /opt/shenyuan/server/.env | tail -3

    echo "📍 Step 4: 重启服务..."
    pm2 restart shenyuan-api

    echo "⏳ 等待 5 秒..."
    sleep 5

    echo "📍 Step 5: 验证重启成功..."
    pm2 logs shenyuan-api | head -30 | grep -E "Server|online"
CMD

  echo -e "${COLOR_GREEN}✅ 命令执行完成${COLOR_NC}"
}

cmd_3_alipay_webhook_fix() {
  echo -e "${COLOR_YELLOW}【3】正在执行：修复支付宝回调 404...${COLOR_NC}"

  ssh $SSH_HOST << 'CMD'
    echo "📍 Step 1: 检查路由配置..."
    grep -r "alipay/notify" /opt/shenyuan/server/routes --include="*.js" || echo "❌ 未找到支付宝回调路由"

    echo "📍 Step 2: 查看最近支付宝回调日志..."
    pm2 logs shenyuan-api | grep -E "alipay|notify" | tail -10

    echo "📍 Step 3: 检查 webhook URL..."
    echo "预期 webhook URL:"
    echo "https://shenyuan.mylumee.cn/api/pay/alipay/notify"

    echo "📍 Step 4: 测试回调端点..."
    curl -X POST http://47.242.80.65/api/pay/alipay/notify \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "notify_time=2026-08-08" 2>&1 | head -20

    echo ""
    echo "⚠️  需要在支付宝后台检查:"
    echo "1. 登录 https://open.alipay.com"
    echo "2. 查看 webhook 配置是否指向正确的 notify URL"
    echo "3. 检查 webhook 日志是否有异常"
CMD

  echo -e "${COLOR_GREEN}✅ 命令执行完成（需要手动检查支付宝后台）${COLOR_NC}"
}

cmd_4_compensate_payment() {
  echo -e "${COLOR_YELLOW}【4】正在执行：补偿手动入账失败订单...${COLOR_NC}"

  echo "⚠️  需要手动输入："
  read -p "请输入失败的订单号 (格式 sy_20260808_xxx): " order_id
  read -p "请输入用户邮箱: " user_email
  read -p "请输入支付金额（分）: " amount

  ssh $SSH_HOST << CMD
    echo "📍 Step 1: 查询原订单信息..."
    curl -s "http://47.242.80.65/api/admin/orders/$order_id" | jq '.' || echo "订单不存在"

    echo "📍 Step 2: 手动入账..."
    curl -X POST http://47.242.80.65/api/admin/manual-complete-order \
      -H "Content-Type: application/json" \
      -d '{
        "order_id": "$order_id",
        "user_email": "$user_email",
        "amount": $amount,
        "reason": "payment_webhook_failed"
      }' | jq '.'

    echo "📍 Step 3: 验证订单状态..."
    curl -s "http://47.242.80.65/api/admin/orders/$order_id" | jq '.status'
CMD

  echo -e "${COLOR_GREEN}✅ 命令执行完成${COLOR_NC}"
}

cmd_5_reset_webhooks() {
  echo -e "${COLOR_YELLOW}【5】正在执行：重置支付 webhook...${COLOR_NC}"

  ssh $SSH_HOST << 'CMD'
    echo "📍 Step 1: 注销旧 webhook..."
    # 这通常需要在第三方平台后台操作，这里只清空本地记录
    rm -f /opt/shenyuan/.webhook_cache

    echo "📍 Step 2: 重新注册 webhook..."
    curl -X POST http://47.242.80.65/api/admin/register-webhooks \
      -H "Content-Type: application/json" \
      -d '{
        "wechat_notify_url": "https://shenyuan.mylumee.cn/api/pay/wechat/notify",
        "alipay_notify_url": "https://shenyuan.mylumee.cn/api/pay/alipay/notify"
      }' | jq '.'

    echo "📍 Step 3: 验证 webhook 状态..."
    pm2 logs shenyuan-api | grep -i webhook | tail -5
CMD

  echo -e "${COLOR_GREEN}✅ 命令执行完成${COLOR_NC}"
}

# ============================================================================
# 服务可用性修复 (6-10)
# ============================================================================

cmd_6_fix_frequent_restart() {
  echo -e "${COLOR_YELLOW}【6】正在执行：修复服务频繁重启...${COLOR_NC}"

  ssh $SSH_HOST << 'CMD'
    echo "📍 Step 1: 查看错误日志..."
    pm2 logs shenyuan-api --err | tail -50

    echo ""
    echo "📍 Step 2: 查看 PM2 状态..."
    pm2 status

    echo ""
    echo "📍 Step 3: 查看最近的 crash 信息..."
    pm2 logs shenyuan-api | grep -E "Error|Exception|crash" | tail -20

    echo ""
    echo "⚠️  常见原因："
    echo "1. 内存不足 (OOM) - 需要重启 + 检查内存泄漏"
    echo "2. 依赖问题 - 需要 npm install"
    echo "3. 配置缺失 - 需要补充 .env"
    echo "4. 端口占用 - 需要 lsof -i :3021 | kill"
    echo ""
    echo "👉 请根据上面的日志确定具体原因，然后执行对应的修复命令"
CMD

  echo -e "${COLOR_GREEN}✅ 已列出错误日志，请根据日志内容选择后续修复${COLOR_NC}"
}

cmd_7_fix_memory_leak() {
  echo -e "${COLOR_YELLOW}【7】正在执行：修复内存泄漏...${COLOR_NC}"

  ssh $SSH_HOST << 'CMD'
    echo "📍 Step 1: 查看当前内存使用..."
    ps aux | grep "node.*index.js" | grep -v grep | awk '{print $2, $6" MB"}'

    echo ""
    echo "📍 Step 2: 强制重启服务..."
    killall -9 node
    sleep 2
    pm2 start /opt/shenyuan/server/index.js --name "shenyuan-api" --instances 1

    echo "⏳ 等待 5 秒..."
    sleep 5

    echo "📍 Step 3: 验证重启后内存..."
    ps aux | grep "node.*index.js" | grep -v grep | awk '{print $2, $6" MB"}'

    echo ""
    echo "📍 Step 4: 保存 PM2 配置..."
    pm2 save

    echo "📍 Step 5: 验证服务状态..."
    pm2 status
    pm2 logs shenyuan-api | head -30
CMD

  echo -e "${COLOR_GREEN}✅ 命令执行完成${COLOR_NC}"
}

cmd_8_fix_pm2_corruption() {
  echo -e "${COLOR_YELLOW}【8】正在执行：修复 PM2 损坏...${COLOR_NC}"

  ssh $SSH_HOST << 'CMD'
    echo "📍 Step 1: 停止所有 PM2 进程..."
    pm2 kill

    echo "⏳ 等待 2 秒..."
    sleep 2

    echo "📍 Step 2: 清空 PM2 缓存..."
    rm -rf ~/.pm2

    echo "📍 Step 3: 重新启动服务..."
    cd /opt/shenyuan/server
    pm2 start npm --name "shenyuan-api" -- start

    echo "⏳ 等待 5 秒..."
    sleep 5

    echo "📍 Step 4: 保存配置..."
    pm2 save
    pm2 startup

    echo "📍 Step 5: 验证状态..."
    pm2 status
    pm2 logs shenyuan-api | head -20
CMD

  echo -e "${COLOR_GREEN}✅ 命令执行完成${COLOR_NC}"
}

cmd_9_fix_caddy() {
  echo -e "${COLOR_YELLOW}【9】正在执行：修复 Caddy 反代失效...${COLOR_NC}"

  ssh $SSH_HOST << 'CMD'
    echo "📍 Step 1: 查看 Caddy 状态..."
    sudo systemctl status caddy --no-pager

    echo ""
    echo "📍 Step 2: 检查 Caddy 配置..."
    grep -A 10 "reverse_proxy" /etc/caddy/Caddyfile || echo "未配置反代"

    echo ""
    echo "📍 Step 3: 重新加载 Caddy..."
    sudo systemctl reload caddy

    echo "📍 Step 4: 验证反代..."
    curl -I http://47.242.80.65/api/health

    echo ""
    echo "📍 Step 5: 查看 Caddy 日志..."
    sudo journalctl -u caddy -n 20 --no-pager
CMD

  echo -e "${COLOR_GREEN}✅ 命令执行完成${COLOR_NC}"
}

cmd_10_enable_cluster() {
  echo -e "${COLOR_YELLOW}【10】正在执行：启用集群模式应对流量...${COLOR_NC}"

  ssh $SSH_HOST << 'CMD'
    echo "📍 Step 1: 删除旧配置..."
    pm2 delete shenyuan-api

    echo ""
    echo "📍 Step 2: 启用 cluster 模式..."
    pm2 start /opt/shenyuan/server/index.js --name "shenyuan-api" --instances max

    echo "⏳ 等待 5 秒..."
    sleep 5

    echo "📍 Step 3: 保存配置..."
    pm2 save
    pm2 startup

    echo ""
    echo "📍 Step 4: 验证进程数..."
    ps aux | grep "node.*index.js" | grep -v grep | wc -l

    echo ""
    echo "📍 Step 5: 验证 PM2 状态..."
    pm2 status | grep shenyuan-api

    echo ""
    echo "📍 Step 6: 验证服务..."
    curl -s http://47.242.80.65/api/health | jq '.status'
CMD

  echo -e "${COLOR_GREEN}✅ 命令执行完成${COLOR_NC}"
}

# ============================================================================
# 数据恢复修复 (11-15)
# ============================================================================

cmd_11_restore_from_git() {
  echo -e "${COLOR_YELLOW}【11】正在执行：恢复数据（从 Git）...${COLOR_NC}"

  ssh $SSH_HOST << 'CMD'
    echo "📍 Step 1: 备份当前数据..."
    cp /opt/shenyuan/server/data.json /opt/shenyuan/server/data.json.corrupted.$(date +%s)

    echo ""
    echo "📍 Step 2: 从 Git 恢复..."
    git -C /opt/shenyuan checkout server/data.json

    echo ""
    echo "📍 Step 3: 验证文件完整性..."
    jq '.' /opt/shenyuan/server/data.json > /dev/null && echo "✅ JSON 有效" || echo "❌ JSON 仍然损坏"

    echo ""
    echo "📍 Step 4: 重启服务..."
    pm2 restart shenyuan-api

    echo ""
    echo "📍 Step 5: 验证..."
    pm2 logs shenyuan-api | head -20
CMD

  echo -e "${COLOR_GREEN}✅ 命令执行完成${COLOR_NC}"
}

cmd_12_restore_from_backup() {
  echo -e "${COLOR_YELLOW}【12】正在执行：从最近备份还原...${COLOR_NC}"

  ssh $SSH_HOST << 'CMD'
    echo "📍 Step 1: 列出可用备份..."
    ls -lh /opt/shenyuan/.backups/data-*.json | tail -5

    echo ""
    read -p "请输入要恢复的备份文件（如 data-2026-08-07.json）: " backup_file

    echo "📍 Step 2: 备份当前数据..."
    cp /opt/shenyuan/server/data.json /opt/shenyuan/server/data.json.corrupted.$(date +%s)

    echo ""
    echo "📍 Step 3: 恢复备份..."
    cp /opt/shenyuan/.backups/$backup_file /opt/shenyuan/server/data.json

    echo ""
    echo "📍 Step 4: 验证..."
    jq '.' /opt/shenyuan/server/data.json > /dev/null && echo "✅ JSON 有效" || echo "❌ 备份也损坏"

    echo ""
    echo "📍 Step 5: 重启服务..."
    pm2 restart shenyuan-api

    echo ""
    echo "📍 Step 6: 确认恢复..."
    curl -s http://47.242.80.65/api/health | jq '.status'
CMD

  echo -e "${COLOR_GREEN}✅ 命令执行完成${COLOR_NC}"
}

cmd_13_regenerate_invites() {
  echo -e "${COLOR_YELLOW}【13】正在执行：修复邀请链接...${COLOR_NC}"

  ssh $SSH_HOST << 'CMD'
    echo "📍 Step 1: 测试邀请端点..."
    curl -s http://47.242.80.65/api/invite/generate -X POST \
      -H "Content-Type: application/json" \
      -d '{"user_id":"test@example.com"}' | jq '.'

    echo ""
    echo "📍 Step 2: 重新生成邀请码..."
    curl -X POST http://47.242.80.65/api/admin/regenerate-invites \
      -H "Content-Type: application/json" \
      -d '{}' | jq '.regenerated_count'

    echo ""
    echo "📍 Step 3: 查看生成结果..."
    curl -s http://47.242.80.65/api/admin/invites?limit=5 | jq '.[] | {code, created_at}' | head -20

    echo ""
    echo "📍 Step 4: 发送新链接给用户..."
    echo "可以通过邮件发送新的邀请码：https://shenyuan.mylumee.cn/hepan?invite_code=[CODE]"
CMD

  echo -e "${COLOR_GREEN}✅ 命令执行完成${COLOR_NC}"
}

cmd_14_verify_data() {
  echo -e "${COLOR_YELLOW}【14】正在执行：修复用户数据不一致...${COLOR_NC}"

  ssh $SSH_HOST << 'CMD'
    echo "📍 Step 1: 查看数据完整性..."
    curl -s http://47.242.80.65/api/admin/data-integrity | jq '.'

    echo ""
    echo "📍 Step 2: 运行数据检查脚本..."
    cd /opt/shenyuan
    node << 'EOF'
    const data = require('./server/data.json');

    // 检查用户订单
    let issues = [];
    Object.entries(data.users || {}).forEach(([uid, user]) => {
      if (user.orders && Array.isArray(user.orders)) {
        user.orders.forEach(order => {
          if (!data.orders || !data.orders[order]) {
            issues.push(`用户 ${uid} 的订单 ${order} 在全局订单表中不存在`);
          }
        });
      }
    });

    console.log('检查到 ' + issues.length + ' 个问题:');
    issues.slice(0, 10).forEach(issue => console.log('  - ' + issue));

    if (issues.length > 10) {
      console.log(`  ... 还有 ${issues.length - 10} 个`);
    }
EOF

    echo ""
    echo "📍 Step 3: 修复不一致..."
    curl -X POST http://47.242.80.65/api/admin/fix-data-consistency \
      -H "Content-Type: application/json" \
      -d '{"dry_run": false}' | jq '.'

    echo ""
    echo "📍 Step 4: 重启验证..."
    pm2 restart shenyuan-api
    sleep 5
    curl -s http://47.242.80.65/api/health | jq '.status'
CMD

  echo -e "${COLOR_GREEN}✅ 命令执行完成${COLOR_NC}"
}

cmd_15_hotfix_deploy() {
  echo -e "${COLOR_YELLOW}【15】正在执行：热修复生产代码补丁...${COLOR_NC}"

  echo "⚠️  这将拉取最新代码并重启服务"
  read -p "确认继续？(yes/no): " confirm

  if [ "$confirm" != "yes" ]; then
    echo "已取消"
    return
  fi

  ssh $SSH_HOST << 'CMD'
    echo "📍 Step 1: 备份当前代码..."
    cd /opt/shenyuan
    git stash

    echo ""
    echo "📍 Step 2: 拉取最新代码..."
    git pull origin main

    echo ""
    echo "📍 Step 3: 检查依赖..."
    cd server
    npm install --production

    echo ""
    echo "📍 Step 4: 重启服务..."
    pm2 restart shenyuan-api

    echo "⏳ 等待 5 秒..."
    sleep 5

    echo "📍 Step 5: 验证部署..."
    pm2 logs shenyuan-api | head -30

    echo ""
    echo "📍 Step 6: 测试..."
    curl -s http://47.242.80.65/api/health | jq '.status'
CMD

  echo -e "${COLOR_GREEN}✅ 命令执行完成${COLOR_NC}"
}

# ============================================================================
# 主菜单
# ============================================================================

main() {
  if [ -z "$1" ]; then
    print_help
    exit 0
  fi

  case "$1" in
    1) cmd_1_payment_restart ;;
    2) cmd_2_wechat_key_fix ;;
    3) cmd_3_alipay_webhook_fix ;;
    4) cmd_4_compensate_payment ;;
    5) cmd_5_reset_webhooks ;;
    6) cmd_6_fix_frequent_restart ;;
    7) cmd_7_fix_memory_leak ;;
    8) cmd_8_fix_pm2_corruption ;;
    9) cmd_9_fix_caddy ;;
    10) cmd_10_enable_cluster ;;
    11) cmd_11_restore_from_git ;;
    12) cmd_12_restore_from_backup ;;
    13) cmd_13_regenerate_invites ;;
    14) cmd_14_verify_data ;;
    15) cmd_15_hotfix_deploy ;;
    help) print_help ;;
    *)
      echo -e "${COLOR_RED}❌ 未知命令: $1${COLOR_NC}"
      print_help
      exit 1
      ;;
  esac
}

# 执行主函数
main "$@"
