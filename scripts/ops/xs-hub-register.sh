#!/bin/bash
# 把相生（xiangsheng）登记到 Lumee 收款中台，给「合盘完整版」付费解锁用。付款开关保持关闭（FRIENDS_HEPAN_PAY_ENABLED=false）。
# 分两段在 47.242.80.65 上执行，中间在本机确认一次：
#  第 1 段（只改文件，不重启）：
#   1. 备份 /root/server.py；HUB_PROJECT_DEFS 里没有 xiangsheng 才加 ("xiangsheng","XS")。先写临时文件、编译通过再替换；
#      找不到这段或格式认不出就中止，不乱改。
#   2. 读 `systemctl cat xinshen.service` 的全部 EnvironmentFile（可能多行/一行多个）；一个都没有就中止。
#      已有 HUB_SECRET_XIANGSHENG 就沿用；没有就 openssl 生成，写进已存放 HUB_SECRET_* 的那个文件（都没有则用最后一个）。
#      HUB_CALLBACK_XIANGSHENG=http://127.0.0.1:3031/api/friends/hepan-pay/callback。
#   3. 同一个密钥 + FRIENDS_HUB_* 写进 /opt/xiangsheng/server/.env（先备份），FRIENDS_HEPAN_PAY_ENABLED 强制 false。
#  本机确认：会重启 Lumee 主服务（xinshen），约几秒中断，问 y/N。
#  第 2 段：重启 xinshen + pm2 xiangsheng，用签名查一个不存在的单号，打印中台回应（过验签、回订单不存在 = 登记成功）。
# 密钥不打印、不进命令行参数（不出现在 ps 里）、不进仓库。重复执行无副作用。用法：bash scripts/ops/xs-hub-register.sh
set -euo pipefail
HOST=root@47.242.80.65

ssh "$HOST" 'bash -s' <<'REMOTE'
set -euo pipefail
PY=/root/server.py
APPENV=/opt/xiangsheng/server/.env
CALLBACK=http://127.0.0.1:3031/api/friends/hepan-pay/callback
TS=$(date +%Y%m%d-%H%M%S)
[ -f "$PY" ] || { echo "找不到 $PY，中止"; exit 1; }
[ -f "$APPENV" ] || { echo "找不到 $APPENV，中止"; exit 1; }

# 1) 中台项目表：临时文件 → 编译 → 替换
cp -p "$PY" "$PY.bak.$TS"
echo "已备份 $PY.bak.$TS"
python3 - "$PY" <<'PYEDIT'
import os, re, shutil, sys, py_compile
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
close_at = i - 1
line_start = src.rfind('\n', 0, close_at) + 1
if src[line_start:close_at].strip():
    sys.exit('HUB_PROJECT_DEFS 的结尾括号不在单独一行，中止（请人工加）')
new = src[:line_start] + entries[-1] + '("xiangsheng", "XS"),\n' + src[line_start:]
tmp = path + '.xs-tmp'
with open(tmp, 'w', encoding='utf-8') as f:
    f.write(new)
try:
    py_compile.compile(tmp, doraise=True)
except Exception as e:
    os.remove(tmp)
    sys.exit('改后的 server.py 编译不过，未替换：%s' % e)
shutil.copymode(path, tmp)
os.replace(tmp, path)
print('已加入 ("xiangsheng", "XS")')
PYEDIT
grep -n '"xiangsheng"' "$PY" | head -3

# 2) xinshen 的环境文件（可能多行、一行多个，前缀 - 表示可缺）
FILES=()
while read -r f; do
  f=${f#-}
  [ -n "$f" ] || continue
  if [ -f "$f" ]; then FILES+=("$f"); else echo "提示：EnvironmentFile $f 不存在，跳过"; fi
done < <(systemctl cat xinshen.service 2>/dev/null | sed -n 's/^EnvironmentFile=//p' | tr ' ' '\n')
[ "${#FILES[@]}" -gt 0 ] || { echo "xinshen.service 没有可用的 EnvironmentFile，中止（不往 unit 里写密钥）"; exit 1; }
HUBENV=""
for f in "${FILES[@]}"; do grep -q '^HUB_SECRET_XIANGSHENG=' "$f" && HUBENV=$f; done
if [ -z "$HUBENV" ]; then for f in "${FILES[@]}"; do grep -q '^HUB_SECRET_' "$f" && HUBENV=$f; done; fi
[ -n "$HUBENV" ] || HUBENV=${FILES[${#FILES[@]}-1]}
echo "中台环境文件：$HUBENV（共 ${#FILES[@]} 个）"
cp -p "$HUBENV" "$HUBENV.bak.$TS"
SECRET=$(sed -n 's/^HUB_SECRET_XIANGSHENG=//p' "$HUBENV" | tail -1 | tr -d "\"' ")
if [ -z "$SECRET" ]; then
  SECRET=$(openssl rand -hex 32)
  printf '\nHUB_SECRET_XIANGSHENG=%s\n' "$SECRET" >> "$HUBENV"
  echo "已生成 HUB_SECRET_XIANGSHENG（不打印）"
else
  echo "沿用已有 HUB_SECRET_XIANGSHENG"
fi
sed -i '/^HUB_CALLBACK_XIANGSHENG=/d' "$HUBENV"
printf 'HUB_CALLBACK_XIANGSHENG=%s\n' "$CALLBACK" >> "$HUBENV"
grep -E '^HUB_CALLBACK_XIANGSHENG=' "$HUBENV"

# 3) 相生自己的 .env（付款开关保持关闭）。删旧行再用内建 printf 追加，密钥不进任何命令参数。
cp -p "$APPENV" "$APPENV.bak.$TS"
[ -z "$(tail -c1 "$APPENV")" ] || printf '\n' >> "$APPENV"
setkv(){ sed -i "/^$1=/d" "$APPENV"; printf '%s=%s\n' "$1" "$2" >> "$APPENV"; }
setkv FRIENDS_HUB_BASE http://127.0.0.1:8765
setkv FRIENDS_HUB_PROJECT_ID xiangsheng
setkv FRIENDS_HUB_SECRET "$SECRET"
setkv FRIENDS_HEPAN_PAY_ENABLED false
chmod 600 "$APPENV"
grep -E '^FRIENDS_(HUB_BASE|HUB_PROJECT_ID|HEPAN_PAY_ENABLED|HEPAN_PRICE|ADVISOR_QR_URL)=' "$APPENV" || true
echo "文件已改好，尚未重启。"
REMOTE

echo
echo "⚠ 接下来会重启 Lumee 主服务（xinshen），约几秒中断；然后重启相生（pm2 xiangsheng）。"
read -r -p "继续? y/N " ans
case "$ans" in
  y|Y|yes|YES) ;;
  *) echo "已取消重启。文件改动已生效在磁盘上，下次重跑本脚本即可（重复执行无副作用）。"; exit 0;;
esac

ssh "$HOST" 'bash -s' <<'REMOTE'
set -euo pipefail
export PATH=/opt/node24/bin:$PATH
APPENV=/opt/xiangsheng/server/.env
systemctl restart xinshen
sleep 3
systemctl is-active xinshen
pm2 restart xiangsheng --update-env >/dev/null
sleep 4
QS="project_id=xiangsheng&order_no=XSPROBE000000"
# 密钥从 .env 读进 python，经环境变量不经 argv
SIG=$(QS="$QS" ENVF="$APPENV" python3 -c 'import hmac,hashlib,os
s=[l.split("=",1)[1].strip() for l in open(os.environ["ENVF"]) if l.startswith("FRIENDS_HUB_SECRET=")][-1]
print(hmac.new(s.encode(),os.environ["QS"].encode(),hashlib.sha256).hexdigest())')
echo "中台签名探测（期望：过验签、回订单不存在，而不是签名错误/未知项目）："
curl -s -m 8 -H "X-Project-Id: xiangsheng" -H "X-Sign: $SIG" "http://127.0.0.1:8765/hub/pay/status?$QS"; echo
curl -s -o /dev/null -w "相生首页 %{http_code}\n" http://127.0.0.1:3031/pages/friends-connect.html
echo "合盘付款开关仍为关闭：FRIENDS_HEPAN_PAY_ENABLED=$(sed -n 's/^FRIENDS_HEPAN_PAY_ENABLED=//p' "$APPENV")"
REMOTE
