#!/bin/bash
# 把相生（xiangsheng）登记到 Lumee 收款中台，给「合盘完整版」付费解锁用。付款开关保持关闭（FRIENDS_HEPAN_PAY_ENABLED=false）。
# 做的事（全部在 47.242.80.65 上）：
#  1. 备份 /root/server.py；HUB_PROJECT_DEFS 里没有 xiangsheng 才加 ("xiangsheng","XS")；找不到这段就中止，不乱改。
#  2. 读 `systemctl cat xinshen.service` 的 EnvironmentFile；没有就中止。已有 HUB_SECRET_XIANGSHENG 就沿用，没有才 openssl 生成；
#     追加 HUB_CALLBACK_XIANGSHENG=http://127.0.0.1:3031/api/friends/hepan-pay/callback。
#  3. 同一个密钥 + FRIENDS_HUB_* 写进 /opt/xiangsheng/server/.env（先备份），FRIENDS_HEPAN_PAY_ENABLED 强制 false。
#  4. 重启 xinshen + pm2 xiangsheng，用签名查一个不存在的单号，打印中台回应（能过验签、回「订单不存在」= 登记成功）。
# 密钥不打印、不进仓库。用法：bash scripts/ops/xs-hub-register.sh
set -euo pipefail
ssh root@47.242.80.65 'bash -s' <<'REMOTE'
set -euo pipefail
export PATH=/opt/node24/bin:$PATH
PY=/root/server.py
APPENV=/opt/xiangsheng/server/.env
CALLBACK=http://127.0.0.1:3031/api/friends/hepan-pay/callback
TS=$(date +%Y%m%d-%H%M%S)
[ -f "$PY" ] || { echo "找不到 $PY，中止"; exit 1; }
[ -f "$APPENV" ] || { echo "找不到 $APPENV，中止"; exit 1; }

# 1) 中台项目表
cp -p "$PY" "$PY.bak.$TS"
echo "已备份 $PY.bak.$TS"
python3 - "$PY" <<'PYEDIT'
import re, sys, py_compile
path = sys.argv[1]
src = open(path, encoding='utf-8').read()
m = re.search(r'^HUB_PROJECT_DEFS\s*(?::[^=\n]*)?=\s*([\[(])', src, re.M)
if not m:
    sys.exit('没找到 HUB_PROJECT_DEFS = [ ... ]，中止（server.py 结构变了，请人工看）')
open_ch = m.group(1); close_ch = ']' if open_ch == '[' else ')'
i, depth = m.end(1), 1
while i < len(src) and depth:
    c = src[i]
    if c == open_ch: depth += 1
    elif c == close_ch: depth -= 1
    i += 1
if depth:
    sys.exit('HUB_PROJECT_DEFS 括号不配对，中止')
block = src[m.end(1):i - 1]
if re.search(r'["\']xiangsheng["\']', block):
    print('HUB_PROJECT_DEFS 已有 xiangsheng，不改')
    sys.exit(0)
if re.search(r'["\']XS["\']', block):
    sys.exit('前缀 XS 已被别的项目占用，中止')
entries = re.findall(r'^([ \t]*)\(\s*["\'][a-z0-9_]+["\']\s*,\s*["\'][A-Z0-9]+["\']\s*\)\s*,', block, re.M)
if not entries:
    sys.exit('HUB_PROJECT_DEFS 里没有认得出的 ("项目", "前缀"), 条目，中止')
indent = entries[-1]
close_at = i - 1
line_start = src.rfind('\n', 0, close_at) + 1
if src[line_start:close_at].strip():
    sys.exit('HUB_PROJECT_DEFS 的结尾括号不在单独一行，中止（请人工加）')
new = src[:line_start] + indent + '("xiangsheng", "XS"),\n' + src[line_start:]
open(path, 'w', encoding='utf-8').write(new)
py_compile.compile(path, doraise=True)
print('已加入 ("xiangsheng", "XS")')
PYEDIT
grep -n '"xiangsheng"' "$PY" | head -3

# 2) xinshen 的环境文件
UNIT=$(systemctl cat xinshen.service 2>/dev/null || true)
[ -n "$UNIT" ] || { echo "systemctl cat xinshen.service 没有内容，中止"; exit 1; }
HUBENV=$(printf '%s\n' "$UNIT" | sed -n 's/^EnvironmentFile=-\{0,1\}//p' | head -1 | tr -d ' ')
[ -n "$HUBENV" ] || { echo "xinshen.service 没有 EnvironmentFile，中止（不往 unit 里写密钥）"; exit 1; }
[ -f "$HUBENV" ] || { echo "EnvironmentFile $HUBENV 不存在，中止"; exit 1; }
cp -p "$HUBENV" "$HUBENV.bak.$TS"
SECRET=$(sed -n 's/^HUB_SECRET_XIANGSHENG=//p' "$HUBENV" | tail -1 | tr -d '"'"'"' ')
if [ -z "$SECRET" ]; then
  SECRET=$(openssl rand -hex 32)
  printf '\nHUB_SECRET_XIANGSHENG=%s\n' "$SECRET" >> "$HUBENV"
  echo "已生成 HUB_SECRET_XIANGSHENG（不打印）"
else
  echo "沿用已有 HUB_SECRET_XIANGSHENG"
fi
if grep -q '^HUB_CALLBACK_XIANGSHENG=' "$HUBENV"; then
  sed -i "s|^HUB_CALLBACK_XIANGSHENG=.*|HUB_CALLBACK_XIANGSHENG=$CALLBACK|" "$HUBENV"
else
  printf 'HUB_CALLBACK_XIANGSHENG=%s\n' "$CALLBACK" >> "$HUBENV"
fi
grep -E '^HUB_CALLBACK_XIANGSHENG=' "$HUBENV"

# 3) 相生自己的 .env（付款开关保持关闭）
cp -p "$APPENV" "$APPENV.bak.$TS"
setkv(){ if grep -q "^$1=" "$APPENV"; then sed -i "s|^$1=.*|$1=$2|" "$APPENV"; else printf '%s=%s\n' "$1" "$2" >> "$APPENV"; fi; }
tail -c1 "$APPENV" | od -An -c | grep -q '\\n' || printf '\n' >> "$APPENV"
setkv FRIENDS_HUB_BASE http://127.0.0.1:8765
setkv FRIENDS_HUB_PROJECT_ID xiangsheng
setkv FRIENDS_HUB_SECRET "$SECRET"
setkv FRIENDS_HEPAN_PAY_ENABLED false
chmod 600 "$APPENV"
grep -E '^FRIENDS_(HUB_BASE|HUB_PROJECT_ID|HEPAN_PAY_ENABLED|HEPAN_PRICE|ADVISOR_QR_URL)=' "$APPENV" || true

# 4) 重启并签名探测
systemctl restart xinshen
sleep 3
systemctl is-active xinshen
pm2 restart xiangsheng --update-env >/dev/null
sleep 4
QS="project_id=xiangsheng&order_no=XSPROBE000000"
SIG=$(printf '%s' "$QS" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $NF}')
echo "中台签名探测（期望：过验签、回订单不存在，而不是签名错误/未知项目）："
curl -s -m 8 -H "X-Project-Id: xiangsheng" -H "X-Sign: $SIG" "http://127.0.0.1:8765/hub/pay/status?$QS"; echo
curl -s -o /dev/null -w "相生首页 %{http_code}\n" http://127.0.0.1:3031/pages/friends-connect.html
echo "合盘付款开关仍为关闭：FRIENDS_HEPAN_PAY_ENABLED=$(sed -n 's/^FRIENDS_HEPAN_PAY_ENABLED=//p' "$APPENV")"
REMOTE
