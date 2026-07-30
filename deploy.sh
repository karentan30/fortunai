#!/bin/bash
# 善缘 ShenYuan 部署脚本 v2.0 (DeepSeek + Stripe)
# Usage: bash deploy.sh [frontend|backend|all]
#   frontend — 只推送 HTML/CSS 页面
#   backend  — 只推送 server 代码
#   all      — 推送全部 (默认)

set -e

MODE="${1:-all}"
HK_SERVER="root@47.242.80.65"
HK_PATH="/opt/shenyuan"

echo "========================================="
echo "  善缘 ShenYuan 部署 v2.0"
echo "  模式: $MODE"
echo "  服务器: $HK_SERVER"
echo "========================================="
echo ""

deploy_frontend() {
  echo "📤 部署前端文件..."
  # 核心页面
  for f in index.html; do
    scp "$f" "$HK_SERVER:$HK_PATH/"
    echo "  ✓ $f"
  done
  # 子页面
  ssh $HK_SERVER "mkdir -p $HK_PATH/pages"
  for f in pages/*.html; do
    scp "$f" "$HK_SERVER:$HK_PATH/pages/"
    echo "  ✓ $f"
  done
  # 静态资源
  ssh $HK_SERVER "mkdir -p $HK_PATH/assets/images"
  scp -r assets/images/* "$HK_SERVER:$HK_PATH/assets/images/" 2>/dev/null || echo "  ℹ no images to sync"
  echo "✓ 前端部署完成"
}

deploy_backend() {
  echo "📦 部署后端..."
  scp server/*.js "$HK_SERVER:$HK_PATH/server/"   # 全部依赖(index.js+pay.js+astrology.js+bazi.js), 防漏模块导致 MODULE_NOT_FOUND
  ssh $HK_SERVER "cd $HK_PATH/server && npm install --silent 2>&1 | tail -2"
  ssh $HK_SERVER "pm2 restart shenyuan 2>&1 | head -3"
  echo "✓ 后端部署完成"
  echo ""
  echo "  健康检查:"
  ssh $HK_SERVER "curl -s http://localhost:3021/api/health"
}

deploy_all() {
  echo "📤 推送代码到 GitHub..."
  git status --short
  git add -A
  git commit -m "deploy: shenyuan v2.0" 2>/dev/null || echo "✓ 无新改动"
  git push origin main 2>/dev/null && echo "✓ GitHub 最新" || echo "⚠ git push 失败（可忽略）"

  deploy_frontend
  deploy_backend
}

case "$MODE" in
  frontend) deploy_frontend ;;
  backend)  deploy_backend ;;
  all)      deploy_all ;;
  *)        echo "用法: bash deploy.sh [frontend|backend|all]" ;;
esac

echo ""
echo "✅ 部署完成！"
echo "   访问: http://47.242.80.65:3021"
echo "   API:  http://47.242.80.65:3021/api/health"
echo "   Caddy: https://shenyuan.mylumee.cn (需配DNS)"
