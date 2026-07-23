#!/bin/bash
# 善缘 ShenYuan — 快速启动脚本

set -e

echo "🌿 启动善缘 ShenYuan..."
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装。请运行："
    echo "   brew install node"
    exit 1
fi

echo "✓ Node.js $(node -v)"
echo ""

# 后端启动
echo "🚀 启动后端服务 (port 3020)..."
cd server
if [ ! -d "node_modules" ]; then
    echo "  📦 安装依赖..."
    npm install --silent
fi

PORT=3020 node index.js &
SERVER_PID=$!
sleep 2

# 检查后端是否启动成功
if ps -p $SERVER_PID > /dev/null; then
    echo "  ✓ 后端运行中 (PID: $SERVER_PID)"
else
    echo "  ❌ 后端启动失败"
    exit 1
fi

cd ..

# 简单 HTTP 服务器（前端）
echo ""
echo "📱 启动前端服务 (port 8080)..."

# 使用 Node.js http-server 或 Python SimpleHTTPServer
if command -v python3 &> /dev/null; then
    cd /Users/karen/projects/shenyuan
    python3 -m http.server 8080 2>/dev/null &
    HTTP_PID=$!
    sleep 1
    echo "  ✓ 前端运行中 (PID: $HTTP_PID)"
else
    echo "  ⚠️  需要 Python 3 启动前端服务器"
    echo "  请手动运行：cd /Users/karen/projects/shenyuan && python3 -m http.server 8080"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ 善缘已启动！"
echo ""
echo "   🌐 前端：http://localhost:8080/index.html"
echo "   🔌 后端：http://localhost:3020"
echo "   📡 API：http://localhost:3020/api"
echo ""
echo "按 Ctrl+C 关闭所有服务"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 等待 Ctrl+C
wait $SERVER_PID
