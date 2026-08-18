#!/usr/bin/env bash
# =============================================================================
# smoke-26methods.sh — 部署后一键冒烟测试：善缘/Runae 全部 26 种占卜方法
# =============================================================================
#
# 目的：curl 线上 runae.app 的每一个用户端占卜端点，验证「真能出报告」：
#   - HTTP 200（非 500 / 非 4xx）
#   - 响应非空
#   - **关键**：报告正文里有真引擎数据的痕迹（八字四柱/紫微宫位主星/大六壬三传四课/
#     西占太阳月亮上升 等），而不是空占位（"引擎计算中/数据不可用/undefined"）。
#
# 用法：
#   bash scripts/smoke-26methods.sh                 # 跑全部，测线上 runae.app
#   BASE=https://runae.app bash scripts/smoke-26methods.sh
#   BASE=http://localhost:3000 bash scripts/smoke-26methods.sh   # 测本地
#   TIMEOUT=180 bash scripts/smoke-26methods.sh     # 加长超时
#   ONLY=bazi,daliuren,astrology bash scripts/smoke-26methods.sh # 只跑指定端点
#   VERBOSE=1 bash scripts/smoke-26methods.sh        # 打印每个响应的前若干字
#
# 注意事项 / 已知坑：
#   1. 超时：报告要 40-54s，默认 TIMEOUT=120s。慢端点（八字全文/合婚）可能撞。
#      若大量 timeout，先手动 curl 单个端点看真实耗时，别一口咬定挂了。
#   2. 免费档 vs 付费档：多数端点免费档只出「预览」（tier=free/basic，locked=true），
#      正文会带 ---LOCKED--- 分隔 + 锁定小节。预览里 meta/chart 的**真引擎数据仍会注入**，
#      所以本脚本判「真数据」看的是引擎痕迹（四柱/宫位/三传），不是报告是否全文解锁。
#      付费全文需要登录态 + credit gate，本冒烟脚本**不测付费全文**（只验证引擎+能出字）。
#   3. 视觉端点（mianxiang 面相 / shouxiang 手相）需要 base64 照片。本脚本不传照片，
#      改传 features 兜底 或 纯 question，验证 LLM 兜底链能出字即可（标注为 vision-fallback）。
#   4. 流式端点（/stream、duanshi）：读 SSE 前 ~200 行，抓 meta 事件里的引擎数据 +
#      chunk 事件里的正文。用 curl --no-buffer + 超时截断。
#   5. 别在这里跑真付费/真提交动作。所有端点都是只读生成，不写生产订单。
#
# 退出码：全部通过=0；有失败/空注入=1。
# =============================================================================

set -uo pipefail

BASE="${BASE:-https://runae.app}"
TIMEOUT="${TIMEOUT:-120}"
VERBOSE="${VERBOSE:-0}"
ONLY="${ONLY:-}"

# ── 统一测试生辰：1995-06-15 10时 女（可辨识、真实可排盘）──
TY=1995; TMO=6; TD=15; TH=10; TMIN=0
LAT=31.23; LNG=121.47          # 上海经纬度（西占/地理需要）
GENDER="female"
QUESTION="今年整体运势如何"

RESULTS=()   # 每行: name|http|elapsed|dataok(1/0)|chars|note
PASS=0; FAIL=0; TOTAL=0

# ── 颜色 ──
if [ -t 1 ]; then GRN=$'\033[32m'; RED=$'\033[31m'; YEL=$'\033[33m'; DIM=$'\033[2m'; RST=$'\033[0m'; else GRN=; RED=; YEL=; DIM=; RST=; fi

# 空占位/失败标志词——命中这些视为「假数据/空注入」
BAD_MARKERS='引擎计算中|数据不可用|undefined|null null|NaN|排盘失败|计算失败|数据缺失|暂时不可用|temporarily unavailable|failed to generate|internal error'

want() { # ONLY 过滤
  [ -z "$ONLY" ] && return 0
  case ",$ONLY," in *",$1,"*) return 0;; *) return 1;; esac
}

# -----------------------------------------------------------------------------
# hit_json <name> <path> <json-body> <grep-regex-for-real-engine-data> [note]
#   非流式端点：POST JSON，读整个 JSON 响应
# -----------------------------------------------------------------------------
hit_json() {
  local name="$1" path="$2" body="$3" datare="$4" note="${5:-}"
  want "$name" || return 0
  TOTAL=$((TOTAL+1))
  local url="$BASE$path"
  local tmp; tmp="$(mktemp)"
  local t0 t1 http elapsed chars dataok=0
  t0=$(date +%s)
  http=$(curl -s -o "$tmp" -w '%{http_code}' \
      --max-time "$TIMEOUT" \
      -H 'Content-Type: application/json' \
      -H 'Accept: application/json' \
      -X POST "$url" -d "$body" 2>/dev/null || echo "000")
  t1=$(date +%s); elapsed=$((t1-t0))
  chars=$(wc -c < "$tmp" | tr -d ' ')

  # 真引擎数据判定：命中期望正则 且 未命中「假数据」标志词
  if grep -qE "$datare" "$tmp" 2>/dev/null && ! grep -qiE "$BAD_MARKERS" "$tmp" 2>/dev/null; then
    dataok=1
  fi
  # HTTP 非 200 直接判空注入失败
  [ "$http" = "200" ] || dataok=0
  # 响应太短（<200 字符基本是纯错误 JSON）判失败
  [ "${chars:-0}" -lt 200 ] && dataok=0

  _record "$name" "$http" "$elapsed" "$dataok" "$chars" "$note"
  [ "$VERBOSE" = "1" ] && { echo "${DIM}--- $name 前 400 字 ---${RST}"; head -c 400 "$tmp"; echo; }
  rm -f "$tmp"
}

# -----------------------------------------------------------------------------
# hit_stream <name> <path> <json-body> <grep-regex> [note]
#   流式端点：curl --no-buffer 读 SSE，抓前若干行的 meta+chunk
# -----------------------------------------------------------------------------
hit_stream() {
  local name="$1" path="$2" body="$3" datare="$4" note="${5:-stream}"
  want "$name" || return 0
  TOTAL=$((TOTAL+1))
  local url="$BASE$path"
  local tmp; tmp="$(mktemp)"
  local t0 t1 http elapsed chars dataok=0
  t0=$(date +%s)
  # 流式：用 --max-time 截断，抓到的都写进 tmp；SSE 无最终 http_code 语义，
  # 用 -w 拿建连码；读约 250 行足够含 meta + 一批 chunk。
  http=$(curl -s --no-buffer -o "$tmp" -w '%{http_code}' \
      --max-time "$TIMEOUT" \
      -H 'Content-Type: application/json' \
      -H 'Accept: text/event-stream' \
      -X POST "$url" -d "$body" 2>/dev/null || echo "000")
  t1=$(date +%s); elapsed=$((t1-t0))
  chars=$(wc -c < "$tmp" | tr -d ' ')

  # SSE 正文里抓 data: 行拼起来再判（meta 含引擎数据，chunk 含正文）
  if grep -qE "$datare" "$tmp" 2>/dev/null && ! grep -qiE "$BAD_MARKERS" "$tmp" 2>/dev/null; then
    dataok=1
  fi
  # 建连非 200（且非 000 截断）判失败；000 常是被 --max-time 正常截断的流，靠内容判
  [ "$http" = "200" ] || [ "$http" = "000" ] || dataok=0
  [ "${chars:-0}" -lt 200 ] && dataok=0

  _record "$name" "$http" "$elapsed" "$dataok" "$chars" "$note"
  [ "$VERBOSE" = "1" ] && { echo "${DIM}--- $name SSE 前 500 字 ---${RST}"; head -c 500 "$tmp"; echo; }
  rm -f "$tmp"
}

_record() {
  local name="$1" http="$2" elapsed="$3" dataok="$4" chars="$5" note="$6"
  RESULTS+=("$name|$http|$elapsed|$dataok|$chars|$note")
  if [ "$dataok" = "1" ]; then PASS=$((PASS+1)); local mark="${GRN}✅${RST}"; else FAIL=$((FAIL+1)); local mark="${RED}❌${RST}"; fi
  printf "  %-16s HTTP %-4s %3ss  %s  %6s字 %s\n" "$name" "$http" "$elapsed" "$mark" "$chars" "${note:+· $note}"
}

echo "═══════════════════════════════════════════════════════════════"
echo " Runae 26 占卜方法冒烟测试  →  $BASE"
echo " 测试生辰: ${TY}-${TMO}-${TD} ${TH}时 ${GENDER} · 超时 ${TIMEOUT}s"
[ -n "$ONLY" ] && echo " 仅测: $ONLY"
echo "═══════════════════════════════════════════════════════════════"
echo

# =============================================================================
#  26 种方法（+ 少量工具端点）
# =============================================================================

# ── 1. 八字 BaZi（四柱天干地支）──
hit_json bazi /api/bazi \
  "{\"birthYear\":$TY,\"birthMonth\":$TMO,\"birthDay\":$TD,\"birthHour\":$TH,\"gender\":\"$GENDER\",\"question\":\"$QUESTION\",\"lang\":\"zh\"}" \
  '天干|地支|日主|四柱|年柱|月柱|日柱|时柱' '真数据=四柱'

# ── 2. 八字 流式 ──
hit_stream bazi/stream /api/bazi/stream \
  "{\"birthYear\":$TY,\"birthMonth\":$TMO,\"birthDay\":$TD,\"birthHour\":$TH,\"gender\":\"$GENDER\",\"question\":\"$QUESTION\",\"lang\":\"zh\"}" \
  'pillars|天干|地支|四柱|日主' 'meta.pillars'

# ── 3. 紫微斗数（命宫主星）──
hit_json ziwei /api/ziwei \
  "{\"birthYear\":$TY,\"birthMonth\":$TMO,\"birthDay\":$TD,\"birthHour\":$TH,\"gender\":\"$GENDER\",\"question\":\"$QUESTION\",\"lang\":\"zh\"}" \
  '命宫|主星|紫微|天府|贪狼|七杀|十二宫' '真数据=宫位主星'

# ── 4. 紫微 流式 ──
hit_stream ziwei/stream /api/ziwei/stream \
  "{\"birthYear\":$TY,\"birthMonth\":$TMO,\"birthDay\":$TD,\"birthHour\":$TH,\"gender\":\"$GENDER\",\"question\":\"$QUESTION\",\"lang\":\"zh\"}" \
  '命宫|主星|紫微|贪狼|七杀' 'stream'

# ── 5. 塔罗 Tarot ──
hit_json tarot /api/tarot \
  "{\"cards\":[{\"name\":\"愚人\",\"position\":\"正位\"},{\"name\":\"恋人\",\"position\":\"正位\"},{\"name\":\"星星\",\"position\":\"逆位\"}],\"question\":\"$QUESTION\",\"topic\":\"综合\",\"lang\":\"zh\"}" \
  '愚人|恋人|星星|牌|塔罗' '真数据=抽到的牌'

# ── 6. 塔罗 流式 ──
hit_stream tarot/stream /api/tarot/stream \
  "{\"cards\":[{\"name\":\"愚人\",\"position\":\"正位\"},{\"name\":\"恋人\",\"position\":\"正位\"}],\"question\":\"$QUESTION\",\"topic\":\"综合\"}" \
  '愚人|恋人|牌|塔罗' 'stream'

# ── 7. 面相 Mianxiang（视觉端点·无照片走兜底）──
hit_json mianxiang /api/mianxiang \
  "{\"question\":\"$QUESTION\",\"features\":{\"faceShape\":\"鹅蛋脸\",\"forehead\":\"饱满\",\"eyes\":\"桃花眼\",\"nose\":\"悬胆鼻\"},\"lang\":\"zh\"}" \
  '面相|额|眼|鼻|三停|五官' 'vision-fallback·传features'

# ── 8. 手相 Shouxiang（视觉端点·无照片走兜底）──
hit_json shouxiang /api/shouxiang \
  "{\"question\":\"$QUESTION\",\"hand\":\"left\",\"features\":{\"lifeLine\":\"深长\",\"heartLine\":\"清晰\",\"headLine\":\"平直\"},\"lang\":\"zh\"}" \
  '手相|生命线|感情线|智慧线|掌' 'vision-fallback·传features'

# ── 9. 西方占星 Astrology（太阳月亮上升+行星宫位）──
hit_json astrology /api/astrology \
  "{\"birthYear\":$TY,\"birthMonth\":$TMO,\"birthDay\":$TD,\"birthHour\":$TH,\"birthMinute\":$TMIN,\"latitude\":$LAT,\"longitude\":$LNG,\"gender\":\"$GENDER\",\"question\":\"$QUESTION\",\"lang\":\"zh\"}" \
  '太阳|月亮|上升|Sun|Moon|Ascendant|宫|相位' '真数据=行星宫位'

# ── 10. 风水 Fengshui ──
hit_json fengshui /api/fengshui \
  "{\"houseDirection\":\"坐北朝南\",\"floor\":8,\"rooms\":3,\"occupants\":3,\"address\":\"上海市\",\"question\":\"$QUESTION\"}" \
  '风水|方位|坐北朝南|财位|明堂|气' '真数据=方位'

# ── 11. 风水 流式 ──
hit_stream fengshui/stream /api/fengshui/stream \
  "{\"houseDirection\":\"坐北朝南\",\"floor\":8,\"rooms\":3,\"address\":\"上海市\",\"question\":\"$QUESTION\",\"members\":3}" \
  '风水|方位|财位|明堂|坐' 'stream'

# ── 12. 阴宅 Yinzhai 流式 ──
hit_stream yinzhai/stream /api/yinzhai/stream \
  "{\"city\":\"上海\",\"relation\":\"祖父\",\"masterBirthYear\":$TY,\"masterGender\":\"$GENDER\",\"masterMingua\":\"坎\",\"concerns\":\"家运子孙\",\"question\":\"$QUESTION\"}" \
  '阴宅|龙脉|穴|砂|水|风水|坐向' 'stream'

# ── 13. 地理运势 Geo-fortune（经纬度）──
hit_json geo-fortune /api/geo-fortune \
  "{\"latitude\":$LAT,\"longitude\":$LNG,\"birthYear\":$TY,\"birthMonth\":$TMO,\"birthDay\":$TD,\"gender\":\"$GENDER\",\"lang\":\"zh\"}" \
  '方位|地理|运势|东|西|南|北|方向' '真数据=地理方位'

# ── 14. 六爻 Liuyao ──
hit_json liuyao /api/liuyao \
  "{\"question\":\"$QUESTION\",\"topic\":\"综合\",\"lang\":\"zh\"}" \
  '卦|爻|世|应|六爻' '真数据=卦象'

# ── 15. 奇门遁甲 Qimen ──
hit_json qimen /api/qimen \
  "{\"question\":\"$QUESTION\",\"direction\":\"东\",\"birthYear\":$TY,\"gender\":\"$GENDER\",\"lang\":\"zh\"}" \
  '奇门|遁甲|九宫|八门|九星|值符|值使' '真数据=奇门盘'

# ── 16. 大六壬 Daliuren（三传四课）──
hit_json daliuren /api/daliuren \
  "{\"question\":\"$QUESTION\",\"birthYear\":$TY,\"gender\":\"$GENDER\",\"lang\":\"zh\"}" \
  '三传|四课|贵神|初传|中传|末传|课' '真数据=三传四课'

# ── 17. 灵签 Lingqian ──
hit_json lingqian /api/lingqian \
  "{\"question\":\"$QUESTION\",\"temple\":\"观音灵签\"}" \
  '签|观音|上上|中平|下下|签文|签诗' '真数据=签'

# ── 18. 前世今生 Pastlife ──
hit_json pastlife /api/pastlife \
  "{\"birthYear\":$TY,\"birthMonth\":$TMO,\"birthDay\":$TD,\"birthHour\":$TH,\"gender\":\"$GENDER\",\"birthPlace\":\"上海\",\"lang\":\"zh\"}" \
  '前世|今生|因果|轮回|宿世' '真数据=前世'

# ── 19. 吠陀占星 Jyotish（Nakshatra/Rashi）──
hit_json jyotish /api/jyotish \
  "{\"name\":\"测试\",\"dob\":\"${TY}-0${TMO}-${TD}\",\"tob\":\"${TH}:00\",\"city\":\"Shanghai\",\"country\":\"China\",\"concern\":\"$QUESTION\",\"lang\":\"zh\"}" \
  'Nakshatra|Rashi|Lagna|Dasha|星宿|月宿|吠陀' '真数据=吠陀盘'

# ── 20. 玛雅历 Maya（Tzolkin/Kin）──
hit_json maya /api/maya \
  "{\"name\":\"测试\",\"dob\":\"${TY}-0${TMO}-${TD}\",\"intention\":\"$QUESTION\",\"lang\":\"zh\"}" \
  'Tzolkin|Kin|卓尔金|印记|太阳|图腾|玛雅' '真数据=玛雅印记'

# ── 21. 藏历 Tibet ──
hit_json tibet /api/tibet \
  "{\"name\":\"测试\",\"dob\":\"${TY}-0${TMO}-${TD}\",\"gender\":\"$GENDER\",\"concern\":\"$QUESTION\",\"lang\":\"zh\"}" \
  '藏历|生肖|五行|命宫|梅花|藏|白玛' '真数据=藏历盘'

# ── 22. 断事 Duanshi 流式（六爻/梅花起卦·返回 JSON）──
hit_stream duanshi/stream /api/duanshi/stream \
  "{\"question\":\"$QUESTION\",\"topic\":\"综合\",\"method\":\"liuyao\"}" \
  '卦|爻|summary|analysis|advice|宜|不宜' 'JSON'

# ── 23. 御神签 Omikuji ──
hit_json omikuji /api/omikuji \
  "{\"question\":\"$QUESTION\",\"lang\":\"zh\"}" \
  '签|吉|凶|omikuji|grade|御神签|大吉|中吉' '真数据=签grade'

# ── 24. 卢恩符文 Rune ──
hit_json rune /api/rune \
  "{\"question\":\"$QUESTION\",\"spread\":\"three\",\"lang\":\"zh\"}" \
  '符文|rune|Fehu|Ansuz|runes|卢恩|符号' '真数据=符文'

# ── 25. 九星气学 Kyusei ──
hit_json kyusei /api/kyusei \
  "{\"birthYear\":$TY,\"birthMonth\":$TMO,\"birthDay\":$TD,\"question\":\"$QUESTION\",\"lang\":\"zh\"}" \
  '九星|本命星|一白|九紫|star|气学|水星|火星' '真数据=本命星'

# ── 26. 合婚 Hehun（双人八字合盘）──
hit_json hehun /api/hehun \
  "{\"p1Year\":$TY,\"p1Month\":$TMO,\"p1Day\":$TD,\"p1Hour\":$TH,\"p1Gender\":\"$GENDER\",\"p2Year\":1993,\"p2Month\":3,\"p2Day\":8,\"p2Hour\":14,\"p2Gender\":\"male\"}" \
  '合婚|分|八字|配对|姻缘|生肖|五行' '真数据=合盘'

# ── 附加工具端点（不计入 26，但一并验证）──
echo
echo "${DIM}── 附加工具端点（不计入26核心）──${RST}"
hit_stream hehun/stream /api/hehun/stream \
  "{\"p1Year\":$TY,\"p1Month\":$TMO,\"p1Day\":$TD,\"p1Hour\":$TH,\"p1Gender\":\"$GENDER\",\"p1Name\":\"甲\",\"p2Year\":1993,\"p2Month\":3,\"p2Day\":8,\"p2Hour\":14,\"p2Gender\":\"male\",\"p2Name\":\"乙\"}" \
  '合婚|八字|配对|姻缘|分' 'stream'

hit_json xingming /api/xingming \
  "{\"surname\":\"张\",\"givenName\":\"三丰\",\"zodiac\":\"猪\",\"gender\":\"$GENDER\"}" \
  '姓名|五格|三才|笔画|数理' '姓名学'

hit_json zhiyuan /api/zhiyuan \
  "{\"birthYear\":$TY,\"birthMonth\":$TMO,\"birthDay\":$TD,\"birthHour\":$TH,\"gender\":\"$GENDER\",\"score\":600,\"province\":\"上海\",\"subjectType\":\"理科\",\"ranking\":5000}" \
  '志愿|专业|大学|命理|适合|文昌' '高考志愿'

hit_json deity-guide /api/deity-guide \
  "{\"question\":\"$QUESTION\",\"birthYear\":$TY,\"gender\":\"$GENDER\",\"preference\":\"平安\"}" \
  '神|拜|供|指引|菩萨|佛|道' '求神指引'

hit_json offering-plan /api/offering-plan \
  "{\"deity\":\"观音菩萨\",\"purpose\":\"祈福平安\",\"budget\":\"中等\",\"duration\":\"一年\",\"birthYear\":$TY,\"gender\":\"$GENDER\",\"lang\":\"zh\"}" \
  '供奉|仪轨|香|供品|方案|摆放' '供奉方案'

# =============================================================================
#  结果汇总
# =============================================================================
echo
echo "═══════════════════════════════════════════════════════════════"
echo " 结果表"
echo "═══════════════════════════════════════════════════════════════"
printf "%-18s %-6s %-6s %-8s %-8s %s\n" "端点" "HTTP" "耗时" "真数据" "字数" "备注"
printf -- "%s\n" "-----------------------------------------------------------------------"
FAILED_LIST=()
for row in "${RESULTS[@]}"; do
  IFS='|' read -r name http elapsed dataok chars note <<< "$row"
  if [ "$dataok" = "1" ]; then flag="${GRN}✅${RST}"; else flag="${RED}❌${RST}"; FAILED_LIST+=("$name (HTTP $http, ${chars}字)"); fi
  printf "%-18s %-6s %-5ss %-8b %-8s %s\n" "$name" "$http" "$elapsed" "$flag" "$chars" "$note"
done

echo
echo "═══════════════════════════════════════════════════════════════"
CORE26=$((PASS+FAIL))
echo " 通过 ${GRN}${PASS}${RST} / 测试 ${TOTAL}   （其中失败/空注入 ${RED}${FAIL}${RST}）"
if [ "$FAIL" -gt 0 ]; then
  echo
  echo " ${RED}需修的端点（HTTP错/空注入/字数不足）：${RST}"
  for f in "${FAILED_LIST[@]}"; do echo "   ❌ $f"; done
  echo
  echo " ${YEL}排查提示：${RST}"
  echo "   · HTTP 500 → 引擎/LLM provider 挂（查 LLM_PRIORITY / DeepSeek key 是否 402）"
  echo "   · HTTP 000 → 超时（报告 40-54s，加 TIMEOUT=180 重试确认真挂没）"
  echo "   · HTTP 200 但真数据❌ → 引擎没注入（vendor dist 漏 / 排盘引擎报错降级 LLM）"
  echo "   · 单独复现: VERBOSE=1 ONLY=<name> bash scripts/smoke-26methods.sh"
fi
echo "═══════════════════════════════════════════════════════════════"

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
