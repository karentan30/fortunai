#!/bin/bash

# 善缘完整部署脚本 v0808
# 使用: ./deploy-complete.sh [prod|staging]
# 功能: 更新所有文件、重启服务、验证健康

set -e

ENV=${1:-prod}
SERVER_IP="47.242.80.65"
SERVER_PATH="/opt/shenyuan"
PM2_APP="shenyuan"

if [ "$ENV" != "prod" ] && [ "$ENV" != "staging" ]; then
  echo "❌ 用法: $0 [prod|staging]"
  exit 1
fi

echo "🚀 开始部署到 $ENV 环境..."

# 1. 提交本地更改
echo "📝 提交git更改..."
git status
read -p "确认提交? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  git add -A
  git commit -m "feat: 上线冲刺更新-0808" || true
  git push origin main
fi

# 2. 同步前端文件
echo "📦 同步前端文件 (HTML + assets)..."
ssh root@$SERVER_IP "mkdir -p $SERVER_PATH/pages $SERVER_PATH/assets"
scp -r pages/*.html root@$SERVER_IP:$SERVER_PATH/pages/ || true
scp legal-*.html root@$SERVER_IP:$SERVER_PATH/ || true
scp index.html root@$SERVER_IP:$SERVER_PATH/ || true
scp -r assets/* root@$SERVER_IP:$SERVER_PATH/assets/ || true

# 3. 同步后端文件
echo "🔧 同步后端代码 (server/)..."
ssh root@$SERVER_IP "mkdir -p $SERVER_PATH/server/{routes,lib,middleware}"
scp server/index.js root@$SERVER_IP:$SERVER_PATH/server/
scp server/routes/*.js root@$SERVER_IP:$SERVER_PATH/server/routes/
scp server/lib/*.js root@$SERVER_IP:$SERVER_PATH/server/lib/
scp server/middleware/*.js root@$SERVER_IP:$SERVER_PATH/server/middleware/
scp package.json root@$SERVER_IP:$SERVER_PATH/

# 4. 重启PM2
echo "♻️  重启PM2服务..."
ssh root@$SERVER_IP "cd $SERVER_PATH && pm2 restart $PM2_APP"

# 5. 验证健康检查
echo "🏥 等待服务启动... (5秒)"
sleep 5

HEALTH=$(ssh root@$SERVER_IP "curl -s http://localhost:3021/api/health" 2>/dev/null || echo "{}")
echo "📊 健康检查结果: $HEALTH"

if echo "$HEALTH" | grep -q '"status":"ok"'; then
  echo "✅ 部署成功! 服务已启动"
  echo "📍 访问: https://shenyuan.mylumee.cn/api/health"
else
  echo "⚠️  健康检查失败，检查日志:"
  ssh root@$SERVER_IP "cd $SERVER_PATH && pm2 logs $PM2_APP --lines 20"
  exit 1
fi

# 6. 备份数据
echo "💾 备份数据..."
ssh root@$SERVER_IP "cp $SERVER_PATH/data.json $SERVER_PATH/data.json.bak-$(date +%Y%m%d-%H%M%S)"

echo "🎉 全部完成!"
echo ""
echo "后续步骤:"
echo "  1. 真机测试: https://shenyuan.mylumee.cn/pages/bazi.html"
echo "  2. 检查日志: ssh root@$SERVER_IP 'cd /opt/shenyuan && pm2 logs shenyuan'"
echo "  3. 监控: https://shenyuan.mylumee.cn/api/health"
