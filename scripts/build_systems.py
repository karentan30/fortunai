#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Runae 占卜体系全览(各算法介绍·配主题)"""
import os
OUT=os.path.expanduser("~/projects/shenyuan/samples/caijing/占卜体系全览.html")
GROUPS=[
 ("🀄 东方精算","#e0b45a",[
   ("八字","生辰四柱·看一生格局运势"),("紫微斗数","星盘十二宫·各领域细看"),
   ("奇门遁甲","时空盘·择时与决策"),("大六壬","三传四课·断具体事"),("六爻·易经","摇卦·问一事吉凶")]),
 ("👁 观相","#7fb0d6",[
   ("面相","麻衣十二宫·看气色格局"),("手相","三大主线·看性情节点")]),
 ("💞 缘分","#d68f9c",[("合婚","双方八字·看契合与相处")]),
 ("🌏 世界占卜","#8fd6a0",[
   ("西方占星","出生星盘·性格与运势"),("吠陀占星","印度星象·业力人生"),
   ("塔罗","抽牌·解当下与指引"),("卢恩符文","北欧符文·抽解方向"),
   ("おみくじ","日本神签·运势指引"),("九星気学","本命星·性格流年"),
   ("藏历·玛雅","古历法·独特视角")]),
 ("🙏 祈福代办","#f0b46a",[("代祈福·供灯·超度","全球圣地·代办功德·连麦为证")]),
]
def card(n,d,col):
    return f'<div class="c" style="border-color:{col}55"><div class="cn" style="color:{col}">{n}</div><div class="cd">{d}</div></div>'
body=""
for g,col,items in GROUPS:
    body+=f'<div class="gt" style="color:{col}">{g}</div><div class="grid">'+"".join(card(n,d,col) for n,d in items)+"</div>"
html=f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:1200px;font-family:"Songti SC","Georgia","Hiragino Sans GB",serif;position:relative;
 background:radial-gradient(120% 45% at 50% 0%,#241a30,#140f1e 55%,#08060f);color:#eadfc8;padding:56px 60px 70px}}
.stars{{position:absolute;inset:0;background-image:radial-gradient(1.3px 1.3px at 15% 8%,#fff,transparent),radial-gradient(1.1px 1.1px at 80% 6%,#ffe9b0,transparent),radial-gradient(1px 1px at 55% 5%,#fff,transparent);opacity:.5}}
.wrap{{position:relative}}
.brand{{text-align:center;font-size:22px;letter-spacing:7px;color:#c9a84c}}
h1{{text-align:center;font-size:56px;font-weight:700;margin:6px 0 4px;background:linear-gradient(135deg,#e8d08a,#c9a84c,#f0e4b0);-webkit-background-clip:text;background-clip:text;color:transparent}}
.sub{{text-align:center;font-size:23px;color:#a9a488;margin-bottom:34px}}
.gt{{font-size:32px;font-weight:700;margin:28px 0 14px}}
.grid{{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}}
.c{{background:rgba(255,255,255,.045);border:1.5px solid;border-radius:16px;padding:22px 24px}}
.cn{{font-size:30px;font-weight:700;margin-bottom:8px}}
.cd{{font-size:22px;color:#c9bfa4;line-height:1.45}}
.foot{{text-align:center;font-size:21px;color:#8f8a70;margin-top:34px}}
</style></head><body><div class="stars"></div><div class="wrap">
<div class="brand">RUNAE · 占卜体系全览</div>
<h1>一个平台，全球占卜智慧</h1>
<div class="sub">东方精算 · 观相 · 世界占卜 · 祈福代办 —— 一个问题，可多体系合断</div>
{body}
<div class="foot">Runae · 传统文化参考 · 专业引擎精算 · 不作医疗/命运绝对判断</div>
</div></body></html>"""
open(OUT,"w").write(html);print("HTML",OUT)
