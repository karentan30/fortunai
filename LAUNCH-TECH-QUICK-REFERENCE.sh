#!/bin/bash
# 善缘投放启动前24小时 - 技术快速参考命令集
# 使用: bash LAUNCH-TECH-QUICK-REFERENCE.sh [check|deploy|monitor|recover]
# 最后更新: 2026-08-08

set -e

SERVER_IP="47.242.80.65"
SERVER_PATH="/opt/shenyuan"
APP_NAME="shenyuan"
APP_PORT="3021"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印函数
print_header() {
  echo -e "\n${BLUE}════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}════════════════════════════════════════════════${NC}\n"
}

print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

# ================================================================================
# 【命令1】完整检查清单 (投放前必须全绿)
# ================================================================================

check_all() {
  print_header "【投放启动前 - 完整检查清单】"

  local pass_count=0
  local fail_count=0

  # 1. 数据备份检查
  print_header "第一部分: 数据备份检查"

  if ssh root@$SERVER_IP "test -f $SERVER_PATH/data.json"; then
    print_success "data.json 文件存在"
    ((pass_count++))
  else
    print_error "data.json 文件不存在"
    ((fail_count++))
  fi

  if ssh root@$SERVER_IP "ls $SERVER_PATH/data.json.bak-* 2>/dev/null | wc -l | grep -q '[1-9]'"; then
    print_success "备份文件存在"
    ((pass_count++))
  else
    print_warning "未找到备份文件"
  fi

  # 2. 环境变量检查
  print_header "第二部分: 环境变量验证"

  local env_check=$(ssh root@$SERVER_IP "cat $SERVER_PATH/.env 2>/dev/null | grep -c 'STRIPE_SECRET_KEY\\|DEEPSEEK_API_KEY\\|ADMIN_TOKEN\\|JWT_SECRET' || echo 0")

  if [ "$env_check" -ge 4 ]; then
    print_success "关键环境变量已配置 ($env_check项)"
    ((pass_count++))
  else
    print_error "环境变量配置不完整 (仅$env_check项)"
    ((fail_count++))
  fi

  # 3. 服务启动检查
  print_header "第三部分: 服务启动验证"

  local pm2_status=$(ssh root@$SERVER_IP "pm2 status 2>/dev/null | grep $APP_NAME | grep -c online || echo 0")

  if [ "$pm2_status" -gt 0 ]; then
    print_success "PM2进程 $APP_NAME 在线"
    ((pass_count++))
  else
    print_error "PM2进程 $APP_NAME 离线"
    ((fail_count++))
  fi

  # 4. 健康检查
  print_header "第四部分: 健康检查"

  local health_check=$(ssh root@$SERVER_IP "curl -s http://localhost:$APP_PORT/api/health 2>/dev/null | grep -c 'status.*ok' || echo 0")

  if [ "$health_check" -gt 0 ]; then
    print_success "健康检查返回 OK"
    ssh root@$SERVER_IP "curl -s http://localhost:$APP_PORT/api/health | jq ."
    ((pass_count++))
  else
    print_error "健康检查失败"
    ((fail_count++))
  fi

  # 5. 代码部署检查
  print_header "第五部分: 代码部署验证"

  local latest_commit=$(git log --oneline -1)
  if git diff-index --quiet HEAD --; then
    print_success "本地无未提交的更改"
    print_success "最新commit: $latest_commit"
    ((pass_count++))
  else
    print_warning "本地有未提交的更改，请先commit"
  fi

  local server_commit=$(ssh root@$SERVER_IP "cd $SERVER_PATH && git log --oneline -1")
  echo -e "服务器最新commit: $server_commit"

  if [[ "$latest_commit" == "$server_commit" ]]; then
    print_success "本地和服务器代码版本一致"
    ((pass_count++))
  else
    print_warning "本地和服务器代码版本不一致，需要git pull"
  fi

  # 6. 文件存在性检查
  print_header "第六部分: 关键文件检查"

  local files_ok=0
  for file in "pages/bazi.html" "pages/bazi-en.html" "pages/saju-landing-KR.html" "legal-CN.html" "server/index.js"; do
    if ssh root@$SERVER_IP "test -f $SERVER_PATH/$file"; then
      print_success "✓ $file"
      ((files_ok++))
    else
      print_error "✗ $file 不存在"
    fi
  done

  if [ "$files_ok" -eq 5 ]; then
    ((pass_count++))
  else
    ((fail_count++))
  fi

  # 7. 日志检查
  print_header "第七部分: 日志配置检查"

  if ssh root@$SERVER_IP "ls $SERVER_PATH/logs/ 2>/dev/null | grep -q 'error\\|access'"; then
    print_success "日志文件已配置"
    ((pass_count++))
  else
    print_warning "日志文件可能未配置"
  fi

  # 最终统计
  print_header "【检查结果统计】"
  echo -e "${GREEN}✅ 通过: $pass_count 项${NC}"
  echo -e "${RED}❌ 失败: $fail_count 项${NC}"

  if [ "$fail_count" -eq 0 ] && [ "$pass_count" -ge 7 ]; then
    echo -e "\n${GREEN}🟢 所有关键检查都通过了! 可以投放${NC}"
    return 0
  else
    echo -e "\n${RED}🔴 还有失败项，不能投放。请检查上述错误${NC}"
    return 1
  fi
}

# ================================================================================
# 【命令2】支付路由测试
# ================================================================================

test_payment_routes() {
  print_header "【支付路由测试】"

  echo -e "${YELLOW}提示: 需要手机测试。以下为快速验证命令${NC}\n"

  # 测试中文版本
  print_header "测试中文版本 (CN)"
  echo "URL: https://shenyuan.mylumee.cn/pages/bazi.html"
  echo "手机打开上述URL，输入生辰: 1990-05-15 03:47"
  echo "检查点:"
  echo "  1. 页面加载 ✓"
  echo "  2. 免费预览显示 (四柱+五行+今年运势) ✓"
  echo "  3. 支付弹窗显示 ✓"
  echo "  4. 微信支付完成 ✓"
  echo "  5. 完整报告显示 ✓"
  echo ""

  # 测试英文版本
  print_header "测试英文版本 (EN)"
  echo "URL: https://shenyuan.mylumee.cn/pages/bazi-en.html"
  echo "输入生辰: 1990-05-15 03:47"
  echo "检查点:"
  echo "  1. 英文页面加载 ✓"
  echo "  2. 英文免费预览显示 ✓"
  echo "  3. Stripe支付弹窗 ✓"
  echo "  4. 信用卡支付 (4242 4242 4242 4242) ✓"
  echo "  5. 英文完整报告显示 ✓"
  echo ""

  # 测试韩文版本
  print_header "测试韩文版本 (KR)"
  echo "URL: https://shenyuan.mylumee.cn/pages/saju-landing-KR.html"
  echo "或者: 用韩国IP自动跳转"
  echo "输入생辰: 1990-05-15 03:47"
  echo "检查点:"
  echo "  1. 韩文页面加载 ✓"
  echo "  2. 韩文免费预览显示 ✓"
  echo "  3. 支付方式选择 ✓"
  echo "  4. 支付完成 ✓"
  echo "  5. 韩文完整报告显示 ✓"
  echo ""

  # API测试
  print_header "API测试 (可选)"

  echo "测试邀请链接生成:"
  curl -X POST https://shenyuan.mylumee.cn/api/referral/generate \
    -H "Content-Type: application/json" \
    -d '{"user_id":"test_user_123","share_platform":"wechat"}' \
    -w "\nHTTP Status: %{http_code}\n" 2>/dev/null || print_error "API调用失败"

  echo ""
  print_success "所有支付路由测试检查清单已列出"
}

# ================================================================================
# 【命令3】完整部署
# ================================================================================

deploy_production() {
  print_header "【生产部署】"

  echo -e "${YELLOW}警告: 这将部署到生产环境!${NC}\n"

  # 1. 检查git状态
  print_header "步骤1: 检查git状态"
  if ! git diff-index --quiet HEAD --; then
    print_error "本地有未提交的更改，请先commit"
    return 1
  fi
  print_success "本地无未提交的更改"

  # 2. 推送代码
  print_header "步骤2: 推送代码到GitHub"
  git push origin main
  print_success "代码已推送"

  # 3. 同步前端文件
  print_header "步骤3: 同步前端文件"
  ssh root@$SERVER_IP "mkdir -p $SERVER_PATH/pages $SERVER_PATH/assets"
  scp -r pages/*.html root@$SERVER_IP:$SERVER_PATH/pages/ 2>/dev/null || true
  scp legal-*.html root@$SERVER_IP:$SERVER_PATH/ 2>/dev/null || true
  scp index.html root@$SERVER_IP:$SERVER_PATH/ 2>/dev/null || true
  scp -r assets/* root@$SERVER_IP:$SERVER_PATH/assets/ 2>/dev/null || true
  print_success "前端文件已同步"

  # 4. 同步后端文件
  print_header "步骤4: 同步后端代码"
  ssh root@$SERVER_IP "mkdir -p $SERVER_PATH/server/{routes,lib,middleware}"
  scp server/index.js root@$SERVER_IP:$SERVER_PATH/server/
  scp server/routes/*.js root@$SERVER_IP:$SERVER_PATH/server/routes/ 2>/dev/null || true
  scp server/lib/*.js root@$SERVER_IP:$SERVER_PATH/server/lib/ 2>/dev/null || true
  scp server/middleware/*.js root@$SERVER_IP:$SERVER_PATH/server/middleware/ 2>/dev/null || true
  scp package.json root@$SERVER_IP:$SERVER_PATH/
  print_success "后端代码已同步"

  # 5. 重启PM2
  print_header "步骤5: 重启PM2服务"
  ssh root@$SERVER_IP "cd $SERVER_PATH && pm2 restart $APP_NAME"
  sleep 3
  print_success "PM2已重启"

  # 6. 验证健康检查
  print_header "步骤6: 验证健康检查"
  HEALTH=$(ssh root@$SERVER_IP "curl -s http://localhost:$APP_PORT/api/health" 2>/dev/null)

  if echo "$HEALTH" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}健康检查返回: ${NC}"
    echo "$HEALTH" | jq .
    print_success "服务已启动"
  else
    print_error "健康检查失败，检查日志:"
    ssh root@$SERVER_IP "pm2 logs $APP_NAME --lines 20"
    return 1
  fi

  # 7. 备份数据
  print_header "步骤7: 数据备份"
  ssh root@$SERVER_IP "cp $SERVER_PATH/data.json $SERVER_PATH/data.json.bak-$(date +%Y%m%d-%H%M%S)"
  print_success "数据已备份"

  print_header "【部署完成】"
  print_success "生产部署成功!"
  echo "后续步骤:"
  echo "  1. 真机测试: https://shenyuan.mylumee.cn/pages/bazi.html"
  echo "  2. 监控日志: ssh root@$SERVER_IP 'cd $SERVER_PATH && pm2 logs shenyuan'"
}

# ================================================================================
# 【命令4】监控和日志
# ================================================================================

monitor_realtime() {
  print_header "【实时监控】"

  echo -e "${YELLOW}按 Ctrl+C 停止监控${NC}\n"

  while true; do
    clear
    print_header "实时监控 - $(date '+%Y-%m-%d %H:%M:%S')"

    # PM2状态
    echo -e "${BLUE}【进程状态】${NC}"
    ssh root@$SERVER_IP "pm2 status" || print_error "无法连接"

    # 健康检查
    echo -e "\n${BLUE}【健康检查】${NC}"
    ssh root@$SERVER_IP "curl -s http://localhost:$APP_PORT/api/health | jq ." 2>/dev/null || print_error "健康检查失败"

    # 系统资源
    echo -e "\n${BLUE}【系统资源】${NC}"
    ssh root@$SERVER_IP "free -h | head -3 && df -h /opt | tail -1" || print_error "无法读取资源"

    # 最近错误
    echo -e "\n${BLUE}【最近错误】${NC}"
    ssh root@$SERVER_IP "tail -5 $SERVER_PATH/logs/error.log 2>/dev/null" || echo "无错误"

    echo -e "\n${YELLOW}30秒后刷新...${NC}"
    sleep 30
  done
}

view_logs() {
  print_header "【查看日志】"

  echo "1. 查看错误日志:"
  echo "   tail -50 /opt/shenyuan/logs/error.log"
  echo ""
  echo "2. 查看访问日志:"
  echo "   tail -50 /opt/shenyuan/logs/access.log"
  echo ""
  echo "3. 实时跟踪PM2日志:"
  echo "   ssh root@47.242.80.65 'pm2 logs shenyuan --lines 0 --err'"
  echo ""
  echo "4. 搜索特定错误:"
  echo "   ssh root@47.242.80.65 'grep stripe /opt/shenyuan/logs/error.log'"
  echo ""

  read -p "选择操作 (1-4): " choice

  case $choice in
    1) ssh root@$SERVER_IP "tail -50 $SERVER_PATH/logs/error.log" ;;
    2) ssh root@$SERVER_IP "tail -50 $SERVER_PATH/logs/access.log" ;;
    3) ssh root@$SERVER_IP "pm2 logs shenyuan --lines 0 --err" ;;
    4) read -p "输入搜索关键词: " keyword
       ssh root@$SERVER_IP "grep $keyword $SERVER_PATH/logs/error.log" ;;
    *) print_error "无效选择" ;;
  esac
}

# ================================================================================
# 【命令5】应急恢复
# ================================================================================

recover_from_backup() {
  print_header "【应急恢复】"

  echo "选择恢复选项:"
  echo "1. 从最新备份恢复数据"
  echo "2. 重启服务"
  echo "3. 查看所有备份"
  echo "4. 手动指定备份文件恢复"
  echo ""

  read -p "选择 (1-4): " choice

  case $choice in
    1)
      print_header "从最新备份恢复"
      LATEST_BACKUP=$(ssh root@$SERVER_IP "ls -t $SERVER_PATH/data.json.bak-* 2>/dev/null | head -1")

      if [ -z "$LATEST_BACKUP" ]; then
        print_error "未找到备份文件"
        return 1
      fi

      echo "最新备份: $LATEST_BACKUP"
      read -p "确认恢复? (y/n): " confirm

      if [ "$confirm" = "y" ]; then
        ssh root@$SERVER_IP "cp $LATEST_BACKUP $SERVER_PATH/data.json"
        ssh root@$SERVER_IP "pm2 restart $APP_NAME"
        print_success "数据已恢复，服务已重启"
      fi
      ;;

    2)
      print_header "重启服务"
      ssh root@$SERVER_IP "pm2 restart $APP_NAME"
      sleep 3
      ssh root@$SERVER_IP "pm2 status"
      print_success "服务已重启"
      ;;

    3)
      print_header "所有备份文件"
      ssh root@$SERVER_IP "ls -lh $SERVER_PATH/data.json.bak-* 2>/dev/null"
      ;;

    4)
      print_header "手动恢复"
      read -p "输入备份文件路径: " backup_file

      if ssh root@$SERVER_IP "test -f $backup_file"; then
        ssh root@$SERVER_IP "cp $backup_file $SERVER_PATH/data.json"
        ssh root@$SERVER_IP "pm2 restart $APP_NAME"
        print_success "数据已恢复"
      else
        print_error "备份文件不存在"
      fi
      ;;

    *)
      print_error "无效选择"
      ;;
  esac
}

# ================================================================================
# 【主菜单】
# ================================================================================

show_menu() {
  echo -e "\n${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║     善缘投放启动前24小时 - 技术快速参考命令集           ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}\n"

  echo "选择操作:"
  echo "  1. check              - 完整检查清单 (投放前必须全绿)"
  echo "  2. test-payment       - 支付路由测试"
  echo "  3. deploy             - 完整部署到生产环境"
  echo "  4. monitor            - 实时监控系统状态"
  echo "  5. logs               - 查看日志"
  echo "  6. recover            - 应急恢复"
  echo "  7. help               - 显示本帮助信息"
  echo ""
  echo "示例: bash LAUNCH-TECH-QUICK-REFERENCE.sh check"
  echo ""
}

# ================================================================================
# 【执行】
# ================================================================================

case "${1:-help}" in
  check)
    check_all
    ;;
  test-payment|test_payment)
    test_payment_routes
    ;;
  deploy)
    deploy_production
    ;;
  monitor)
    monitor_realtime
    ;;
  logs)
    view_logs
    ;;
  recover)
    recover_from_backup
    ;;
  help|"")
    show_menu
    ;;
  *)
    print_error "未知命令: $1"
    show_menu
    exit 1
    ;;
esac
