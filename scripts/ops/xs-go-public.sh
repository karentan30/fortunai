#!/bin/bash
# 相生测试站：补备份 + 更新代码 + 转公开。用法：bash scripts/ops/xs-go-public.sh 客服邮箱
# Karen 1109 确认：隐私/协议已看同意、实名核验流程已看、运营主体 Capstone IQ Group Limited。
set -euo pipefail
EMAIL="${1:?请在命令后面加客服邮箱}"
ssh root@47.242.80.65 "EMAIL='$EMAIL' bash -s" <<'REMOTE'
set -euo pipefail
# 1) 备份脚本 + 每6小时一次
mkdir -p /root/backups/xiangsheng /root/scripts /root/logs
cat > /root/scripts/backup_xiangsheng.sh <<'EOF'
#!/bin/bash
set -euo pipefail
SRC=/opt/xiangsheng-data
TS=$(date +%Y%m%d-%H%M%S)
DST=/root/backups/xiangsheng/$TS
mkdir -p "$DST"
sqlite3 "$SRC/friends.sqlite" ".backup '$DST/friends.sqlite'"
cp "$SRC/data.json" "$DST/data.json"
tar -czf "$DST/media.tgz" -C "$SRC" friends-media friends-verification events
sqlite3 "$DST/friends.sqlite" "PRAGMA integrity_check;" | grep -qx ok
python3 -c "import json,sys;json.load(open(sys.argv[1]))" "$DST/data.json"
chmod -R go-rwx /root/backups/xiangsheng
find /root/backups/xiangsheng -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} +
echo "$TS ok"
EOF
chmod 700 /root/scripts/backup_xiangsheng.sh
/root/scripts/backup_xiangsheng.sh
crontab -l | grep -q backup_xiangsheng || (crontab -l; echo "30 */6 * * * /root/scripts/backup_xiangsheng.sh >> /root/logs/backup_xiangsheng.log 2>&1") | crontab -

# 2) 更新代码到含出境同意的版本
cd /opt/xiangsheng
git fetch -q origin integrate/xiangsheng-1106
git merge -q --ff-only origin/integrate/xiangsheng-1106
git log --oneline -1

# 3) 改 .env（先备份）
ENVF=/opt/xiangsheng/server/.env
cp "$ENVF" "$ENVF.bak.$(date +%Y%m%d-%H%M%S)"
setkv(){ grep -q "^$1=" "$ENVF" && sed -i "s|^$1=.*|$1=$2|" "$ENVF" || echo "$1=$2" >> "$ENVF"; }
setkv FRIENDS_RELEASE_MODE public
setkv FRIENDS_OPERATOR_NAME "Capstone IQ Group Limited"
setkv FRIENDS_SUPPORT_EMAIL "$EMAIL"
setkv FRIENDS_RETENTION_POLICY "注销后30天内删除账号资料；核验材料审完即删原件；合盘结果随配对删除"
setkv FRIENDS_PUBLIC_APPROVED true
setkv FRIENDS_IDENTITY_REVIEWED true
setkv FRIENDS_LEGAL_REVIEWED true
setkv FRIENDS_BACKUP_VERIFIED true

# 4) 重启并自检
export PATH=/opt/node24/bin:$PATH
pm2 restart xiangsheng --update-env >/dev/null
sleep 4
pm2 describe xiangsheng | grep -E "status|restarts" | head -2
curl -s -o /dev/null -w "首页 %{http_code}\n" http://127.0.0.1:3031/pages/friends-connect.html
pm2 logs xiangsheng --lines 15 --nostream | tail -15
REMOTE
