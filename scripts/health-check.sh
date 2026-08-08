#!/bin/bash

# 善缘健康检查脚本 - 每天早8点运行
# 用途: 验证服务器/支付/数据库健康状态

set -e

SERVER="47.242.80.65"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL:-}"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

echo "🏥 [善缘健康检查] $DATE"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查函数
check_status() {
  local name=$1
  local result=$2

  if [ $result -eq 0 ]; then
    echo -e "${GREEN}✅ $name${NC}"
    return 0
  else
    echo -e "${RED}❌ $name${NC}"
    if [ ! -z "$SLACK_WEBHOOK" ]; then
      curl -X POST "$SLACK_WEBHOOK" \
        -d "{\"text\":\"🚨 [$(date '+%H:%M')] $name 异常\"}" \
        -H 'Content-Type: application/json' 2>/dev/null || true
    fi
    return 1
  fi
}

ERRORS=0

# 1. 检查PM2服务状态
echo -e "\n${YELLOW}1️⃣  检查服务状态${NC}"
ssh root@$SERVER "pm2 status shenyuan | grep online" > /dev/null 2>&1
check_status "PM2 shenyuan 运行状态" $? || ERRORS=$((ERRORS+1))

# 2. 检查API健康
echo -e "\n${YELLOW}2️⃣  检查API健康${NC}"
HEALTH=$(ssh root@$SERVER "curl -s http://localhost:3021/api/health" 2>/dev/null || echo "{}")
echo "$HEALTH" | grep -q "ok" 2>/dev/null
check_status "API 健康检查" $? || ERRORS=$((ERRORS+1))

# 3. 检查支付连接
echo -e "\n${YELLOW}3️⃣  检查Stripe连接${NC}"
echo "$HEALTH" | grep -q "connected" 2>/dev/null
check_status "Stripe 连接状态" $? || ERRORS=$((ERRORS+1))

# 4. 检查数据落盘
echo -e "\n${YELLOW}4️⃣  检查数据持久化${NC}"
ssh root@$SERVER "test -f /opt/shenyuan/data.json && [ -s /opt/shenyuan/data.json ]" > /dev/null 2>&1
check_status "数据文件存在且非空" $? || ERRORS=$((ERRORS+1))

# 5. 检查备份
echo -e "\n${YELLOW}5️⃣  检查数据备份${NC}"
BACKUP_COUNT=$(ssh root@$SERVER "ls -1 /opt/shenyuan/data.json.bak-* 2>/dev/null | wc -l")
if [ $BACKUP_COUNT -gt 0 ]; then
  echo -e "${GREEN}✅ 备份文件数: $BACKUP_COUNT${NC}"
else
  echo -e "${RED}❌ 没有备份文件${NC}"
  ERRORS=$((ERRORS+1))
fi

# 6. 检查磁盘空间
echo -e "\n${YELLOW}6️⃣  检查磁盘空间${NC}"
DISK_USAGE=$(ssh root@$SERVER "df /opt/shenyuan | tail -1 | awk '{print \$5}' | sed 's/%//'")
if [ $DISK_USAGE -lt 80 ]; then
  echo -e "${GREEN}✅ 磁盘使用率: ${DISK_USAGE}%${NC}"
else
  echo -e "${RED}❌ 磁盘使用率过高: ${DISK_USAGE}%${NC}"
  ERRORS=$((ERRORS+1))
fi

# 7. 检查最近的错误日志
echo -e "\n${YELLOW}7️⃣  检查错误日志${NC}"
ERROR_COUNT=$(ssh root@$SERVER "pm2 logs shenyuan --lines 50 2>/dev/null | grep -i 'error' | wc -l" || echo 0)
if [ $ERROR_COUNT -eq 0 ]; then
  echo -e "${GREEN}✅ 最近日志无错误${NC}"
else
  echo -e "${YELLOW}⚠️  最近日志有 $ERROR_COUNT 条错误${NC}"
  if [ $ERROR_COUNT -gt 10 ]; then
    ERRORS=$((ERRORS+1))
  fi
fi

# 总结
echo -e "\n${YELLOW}📊 检查总结${NC}"
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ 所有检查通过 - 系统健康${NC}"
  exit 0
else
  echo -e "${RED}❌ 发现 $ERRORS 个问题 - 需要修复${NC}"
  exit 1
fi
