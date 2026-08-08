#!/bin/bash
#
# 将应急工具包部署到生产服务器
# 用法: bash deploy-emergency-tools.sh
#

set -e

REMOTE_USER="root"
REMOTE_HOST="47.242.80.65"
REMOTE_PATH="/opt/shenyuan"

COLOR_GREEN='\033[0;32m'
COLOR_BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${COLOR_BLUE}=== 善缘应急工具包部署脚本 ===${NC}"
echo ""

# 确认部署
echo "将部署以下文件到 $REMOTE_HOST:$REMOTE_PATH:"
echo "  1. EMERGENCY-RESPONSE.md"
echo "  2. quick-fixes.sh"
echo "  3. incident-checklist.md"
echo "  4. health-check-dashboard.html"
echo "  5. README-应急工具.md"
echo ""

read -p "确认部署? (y/N): " response
if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "已取消"
    exit 0
fi

# 检查文件是否存在
files=(
    "EMERGENCY-RESPONSE.md"
    "quick-fixes.sh"
    "incident-checklist.md"
    "health-check-dashboard.html"
    "README-应急工具.md"
)

echo ""
echo "检查本地文件..."
for file in "${files[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${COLOR_RED}错误: 文件不存在 - $file${NC}"
        exit 1
    fi
    echo -e "${COLOR_GREEN}✓${NC} $file"
done

# 部署文件
echo ""
echo "部署到服务器..."
for file in "${files[@]}"; do
    echo -n "  上传 $file ... "
    scp -q "$file" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/"
    echo -e "${COLOR_GREEN}✓${NC}"
done

# 设置权限
echo ""
echo "设置文件权限..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" << 'SCRIPT'
cd /opt/shenyuan
chmod +x quick-fixes.sh
chmod 644 EMERGENCY-RESPONSE.md incident-checklist.md README-应急工具.md health-check-dashboard.html
ls -lh | grep -E "EMERGENCY-RESPONSE|quick-fixes|incident-checklist|health-check-dashboard|README-应急"
SCRIPT

echo ""
echo -e "${COLOR_GREEN}=== 部署成功！ ===${NC}"
echo ""
echo "后续步骤:"
echo "  1. 在服务器上验证文件: ssh root@47.242.80.65 'ls -lh /opt/shenyuan/EMERGENCY-*'"
echo "  2. 测试快速修复脚本: ssh root@47.242.80.65 'bash /opt/shenyuan/quick-fixes.sh help'"
echo "  3. 告知团队文件位置: /opt/shenyuan/"
echo "  4. 在 Git 中提交这些文件"
echo ""
echo "快速参考:"
echo "  快速查询: cat /opt/shenyuan/EMERGENCY-RESPONSE.md | grep '症状'"
echo "  一键修复: bash /opt/shenyuan/quick-fixes.sh [1-15]"
echo "  事件清单: cat /opt/shenyuan/incident-checklist.md"
echo "  实时看板: 在浏览器打开 /opt/shenyuan/health-check-dashboard.html"
echo ""
