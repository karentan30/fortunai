#!/bin/bash
# 相生改用站内留言作法定联系渠道（不公示客服邮箱）：服务器拉 integrate/xiangsheng-1106（只快进），
# 备份 .env，删掉 FRIENDS_SUPPORT_EMAIL，设 FRIENDS_SUPPORT_CHANNEL=inapp，重启后打印交友日志和页面状态码。
# 用法：bash scripts/ops/xs-inapp-support.sh
set -euo pipefail
ssh root@47.242.80.65 'bash -s' <<'REMOTE'
set -euo pipefail
APP=/opt/xiangsheng
ENVF=$APP/server/.env
export PATH=/opt/node24/bin:$PATH
cd "$APP"
git fetch origin integrate/xiangsheng-1106
git merge --ff-only origin/integrate/xiangsheng-1106
echo "代码版本 $(git rev-parse --short HEAD)"
cp "$ENVF" "$ENVF.bak.$(date +%Y%m%d-%H%M%S)"
sed -i '/^FRIENDS_SUPPORT_EMAIL=/d' "$ENVF"
if grep -q '^FRIENDS_SUPPORT_CHANNEL=' "$ENVF"; then
  sed -i 's|^FRIENDS_SUPPORT_CHANNEL=.*|FRIENDS_SUPPORT_CHANNEL=inapp|' "$ENVF"
else
  printf '\nFRIENDS_SUPPORT_CHANNEL=inapp\n' >> "$ENVF"
fi
grep -E '^FRIENDS_SUPPORT_' "$ENVF" || true
pm2 restart xiangsheng --update-env >/dev/null
sleep 4
pm2 logs xiangsheng --lines 40 --nostream | grep -i "friends\]" | tail -3 || true
curl -s -o /dev/null -w "首页 %{http_code}\n" http://127.0.0.1:3031/pages/friends-connect.html
curl -s -o /dev/null -w "联系我们 %{http_code}\n" http://127.0.0.1:3031/pages/friends-contact.html
echo "交友状态 $(curl -s http://127.0.0.1:3031/api/friends/status)"  # 期望 enabled:true, mode:public
curl -s http://127.0.0.1:3031/api/friends/legal | grep -o '"supportChannel":"[a-z]*"' || echo "legal 接口没返回 supportChannel"
REMOTE
