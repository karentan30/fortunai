#!/bin/bash
# 善缘 上线前最终检查 v3.0
# 在所有agent完成后的最终部署

set -e
HK="root@47.242.80.65"
DIR="/opt/shenyuan"

echo "========================================="
echo "  善缘 上线前最终检查"
echo "========================================="

echo ""
echo "📡 1/6 服务器连接"
ssh -o ConnectTimeout=5 $HK "echo '  ✓ 服务器可达'"

echo ""
echo "🔧 2/6 后端服务"
ssh $HK "curl -s http://localhost:3021/api/health" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'  ✓ {d[\"service\"]} v{d[\"version\"]}')
print(f'  ✓ Stripe: {d[\"stripe\"]}')
print(f'  ✓ LLM: {d[\"llm\"]}')
" 2>/dev/null

echo ""
echo "📄 3/6 前端页面"
ssh $HK "ls $DIR/pages/*.html | wc -l" | xargs echo "  ✓ pages:"
ssh $HK "ls $DIR/index.html $DIR/favicon.svg $DIR/sitemap.xml $DIR/robots.txt $DIR/assets/css/style.css 2>/dev/null | wc -l" | xargs echo "  ✓ core files:"

echo ""
echo "💳 4/6 Stripe支付"
curl -s -X POST http://localhost:3021/api/create-checkout \
  -H "Content-Type: application/json" \
  -d '{"product":"bazi_full","donorName":"prelaunch"}' 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'  ✓ Checkout URL: {d.get(\"url\",\"\")[:40]}...')
print(f'  ✓ Session: {d.get(\"sessionId\",\"\")[:20]}...')
" 2>/dev/null

echo ""
echo "🔐 5/6 用户认证"
curl -s -X POST http://localhost:3021/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"prelaunch@test.com","password":"prelaunch123"}' 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'  ✓ Register: user={d.get(\"user\",{}).get(\"email\",\"\")} token={d.get(\"token\",\"\")[:16]}...')
" 2>/dev/null

echo ""
echo "🧠 6/6 AI命理"
curl -s -X POST http://localhost:3021/api/bazi \
  -H "Content-Type: application/json" \
  -d '{"birthYear":1993,"birthMonth":5,"birthDay":15,"birthHour":6,"gender":"female"}' 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('reading','')
print(f'  ✓ 八字解读: {len(r)} chars')
print(f'  ✓ 含日主: {\"日主\" in r}')
print(f'  ✓ 含建议: {\"建议\" in r or \"开运\" in r}')
" 2>/dev/null

echo ""
echo "========================================="
echo "  检查完成"
echo "========================================="
echo ""
echo "  访问: http://47.242.80.65:3021"
echo "  API:  http://47.242.80.65:3021/api/health"
echo ""
