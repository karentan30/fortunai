#!/bin/bash
# 善缘 ShenYuan 部署脚本 (HK 服务器)
# Usage: bash deploy.sh

set -e

echo "🚀 善缘 ShenYuan 部署开始..."
echo ""

# 1. 推送最新代码到 GitHub
echo "📤 推送代码到 GitHub..."
git status
git add -A
git commit -m "deploy: push to production" || echo "✓ 无新改动"
git push origin main
echo "✓ GitHub 最新"

# 2. 服务器连接信息
HK_SERVER="root@47.242.80.65"
HK_PATH="/opt/shenyuan"

echo ""
echo "🔗 连接到 HK 服务器..."
echo "   服务器: $HK_SERVER"
echo "   路径: $HK_PATH"

# 3. 远程执行部署命令
echo ""
echo "📦 在服务器上部署..."
ssh $HK_SERVER bash << 'REMOTE_SCRIPT'
  set -e

  echo "📂 检查项目目录..."
  if [ ! -d /opt/shenyuan ]; then
    mkdir -p /opt/shenyuan
    echo "✓ 创建目录: /opt/shenyuan"
  fi

  cd /opt/shenyuan

  echo "📥 拉取最新代码..."
  if [ -d .git ]; then
    git pull origin main
  else
    git clone https://github.com/karentan30/fortunai.git . || true
    git pull origin main
  fi

  echo "📦 安装后端依赖..."
  cd server
  npm install --silent

  echo "✅ 部署完成！"
  echo ""
  echo "🔧 后端配置检查："
  echo "   PORT: $(grep PORT .env | cut -d= -f2)"
  echo "   OLLAMA_URL: $(grep OLLAMA_URL .env | cut -d= -f2)"
  echo ""
  echo "📋 启动后端："
  echo "   npm start (在 port 3020)"
  echo ""
  echo "🌐 配置 Caddy 反代:"
  echo "   /etc/caddy/Caddyfile 中添加:"
  echo "   shenyuan.domain.com {"
  echo "     root * /opt/shenyuan"
  echo "     file_server"
  echo "     reverse_proxy /api* localhost:3020"
  echo "   }"
REMOTE_SCRIPT

echo ""
echo "✅ 部署完成！"
echo ""
echo "🚀 后续步骤："
echo "1. SSH 到服务器: ssh root@47.242.80.65"
echo "2. 启动后端: cd /opt/shenyuan/server && npm start"
echo "3. 配置 Caddy 反代 (如需要)"
echo "4. 访问: http://47.242.80.65 或 shenyuan.com"
