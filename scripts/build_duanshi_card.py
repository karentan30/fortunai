#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""多体系合断·回国vs留外 报告(罗盘暗夜风) -> HTML"""
import os
BASE=os.path.expanduser("~/projects/shenyuan")
OUTH=os.path.join(BASE,"samples/caijing/duanshi-card.html")

verdict="等 · 45分"
concl="卦象与命理交叉印证 → 不宜仓促。短期宜稳住国际化机会，九月白露后为决策窗口；外走见财，但须择时守根基。"

m1=[("卦象","泽风大过（兑上巽下）→ 初爻动变 泽雷随"),
    ("断辞","静待九月，卦显反复之象；三爻皆阴、二五失应＝根基不稳、进退两难；四爻独阳＝外势强而内力弱，不宜仓促决断"),
    ("时机","白露（9/7）后两周内，观职场新动向再定")]
m2=[("格局","伤官格 · 戊土日主坐申金——喜自由表达、不喜体制拘束，灵活/国际化环境更能发挥"),
    ("迁移·财","迁移宫申金藏壬水（偏财）——走出去、异乡带来财机，外走利财"),
    ("提醒","戊土须稳、忌浮动——外走同时要守根基、择时而动，不宜裸辞冲动")]
cross=[("一致","两法都不主'立刻回'：卦象说'等'、八字说'外走见财' → 短期宜留外、稳住国际化机会"),
       ("分歧","卦象点出'反复·根基不稳'，八字提醒'戊土忌浮' → 别冲动，用九月窗口谈条件、留后路")]
actions=["梳理国内外岗位匹配度与签证政策变动","联系国内 3 家目标企业做非正式探询（留后路）",
         "暂停签署任何长期海外续约协议（保持灵活）","决策窗口＝白露后两周内再定"]

import math
spokes="".join(f'<line x1="410" y1="410" x2="{410+400*math.cos(i*math.pi/6):.0f}" y2="{410+400*math.sin(i*math.pi/6):.0f}"/>' for i in range(12))
def rows(items):
    return "".join(f'<div class="r"><span class="k">{k}</span><span class="v">{v}</span></div>' for k,v in items)
acts="".join(f'<li>{a}</li>' for a in actions)

html=f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:1080px;position:relative;overflow:hidden;font-family:"Songti SC","STSong","Hiragino Sans GB",serif;
 background:radial-gradient(120% 80% at 50% -10%,#1a1c44,#0d1030 45%,#05060f 100%);color:#e8e2d0;padding:60px 70px 90px}}
.rings{{position:absolute;top:-260px;left:50%;transform:translateX(-50%);width:820px;height:820px;pointer-events:none;opacity:.28}}
.stars{{position:absolute;inset:0;background-image:radial-gradient(1.4px 1.4px at 20% 12%,#fff,transparent),radial-gradient(1.2px 1.2px at 70% 8%,#ffe9b0,transparent),radial-gradient(1px 1px at 85% 22%,#fff,transparent),radial-gradient(1.3px 1.3px at 12% 30%,#cfe0ff,transparent),radial-gradient(1px 1px at 55% 18%,#fff,transparent);opacity:.6}}
.wrap{{position:relative;z-index:2}}
.brand{{text-align:center;font-size:24px;letter-spacing:6px;color:#c9a84c}}
h1{{text-align:center;font-size:66px;font-weight:700;letter-spacing:3px;margin:8px 0 4px;
 background:linear-gradient(135deg,#e8d08a,#c9a84c,#f0e4b0);-webkit-background-clip:text;background-clip:text;color:transparent}}
.sub{{text-align:center;font-size:22px;color:#a9a488;margin-bottom:26px}}
.verdict{{text-align:center;margin:0 auto 8px;width:230px;padding:14px 0;border:2px solid #c9a84c;border-radius:50px;
 font-size:34px;font-weight:700;color:#f0e4b0;background:rgba(201,168,76,.10)}}
.concl{{background:rgba(201,168,76,.09);border:1.5px solid rgba(201,168,76,.4);border-radius:18px;padding:26px 30px;
 font-size:27px;line-height:1.66;color:#f2ecd8;margin:20px 0 30px;text-align:center}}
.sec{{background:rgba(255,255,255,.045);border:1.5px solid rgba(201,168,76,.28);border-radius:18px;padding:28px 32px;margin-bottom:22px}}
.st{{font-size:34px;font-weight:700;color:#e8d08a;margin-bottom:16px;display:flex;align-items:center;gap:12px}}
.st small{{font-size:22px;color:#9fb0d0;font-weight:400}}
.r{{display:flex;gap:16px;margin:12px 0}}
.k{{flex:0 0 96px;font-size:24px;color:#c9a84c;font-weight:700}}
.v{{flex:1;font-size:24px;line-height:1.6;color:#e6e0cf}}
.acts{{list-style:none}}
.acts li{{font-size:24px;line-height:1.5;color:#e6e0cf;margin:12px 0;padding-left:34px;position:relative}}
.acts li:before{{content:"◆";color:#c9a84c;position:absolute;left:0;top:2px}}
.foot{{text-align:center;font-size:20px;color:#7d7a68;margin-top:30px}}
.seal{{position:absolute;right:0;top:2px;width:84px;height:84px;border:2px solid #c9a84c;border-radius:12px;color:#c9a84c;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;transform:rotate(-4deg)}}
</style></head><body>
<div class="stars"></div>
<svg class="rings" viewBox="0 0 820 820"><g fill="none" stroke="#c9a84c" stroke-width="1.2">
<circle cx="410" cy="410" r="400"/><circle cx="410" cy="410" r="330"/><circle cx="410" cy="410" r="250"/><circle cx="410" cy="410" r="170"/>
{spokes}
</g></svg>
<div class="wrap">
<div class="seal">合断</div>
<div class="brand">RUNAE · 多体系交叉印证</div>
<h1>回国 · 还是留外</h1>
<div class="sub">八字命理 × 断事卦象 交叉合断 · 依你生辰 1991-10-05 早6点 女</div>
<div class="verdict">{verdict}</div>
<div class="concl">{concl}</div>
<div class="sec"><div class="st">☯ 方法一 · 断事卦象 <small>六爻/易经</small></div>{rows(m1)}</div>
<div class="sec"><div class="st">🀄 方法二 · 八字命理 <small>迁移·事业·财</small></div>{rows(m2)}</div>
<div class="sec"><div class="st">⚖ 交叉印证</div>{rows(cross)}</div>
<div class="sec"><div class="st">🎯 行动建议</div><ul class="acts">{acts}</ul></div>
<div class="foot">Runae · 传统命理/卦象文化交叉参考 · 仅供决策辅助 · 不构成投资/职业最终建议</div>
</div></body></html>"""
open(OUTH,"w").write(html);print("HTML",OUTH)
