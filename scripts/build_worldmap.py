#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Runae 多体系世界地图: 各占卜体系按发源地标注 + 目标寺庙"""
import os
BASE=os.path.expanduser("~/projects/shenyuan")
svg=open(os.path.join(BASE,"samples/caijing/world-map.svg")).read()
OUT=os.path.join(BASE,"samples/caijing/世界地图-多体系.html")
VW,VH=1010,666
def xy(lat,lon):  # 等距圆柱投影
    return ((lon+180)/360*VW, (90-lat)/180*VH)

# 体系发源地: 名, 副, lat, lon, 侧(标签方向)
SYS=[
 ("🀄 中国",[ "八字·紫微·奇门","六壬·风水" ],39.9,116.4,"r"),
 ("🕉 印度","吠陀占星 Jyotish",22.0,78.0,"l"),
 ("🏔 西藏","藏历命理",29.6,91.1,"l"),
 ("🌎 中美洲","玛雅历法",19.0,-96.0,"l"),
 ("🏛 希腊/西方","西方占星",39.0,22.0,"l"),
]
TEMPLE=[("雍和宫",39.9,116.4),("灵隐寺",30.2,120.1),("普陀山",30.0,122.4),("九华山",30.5,117.8),("五台山",39.0,113.6)]

pins="";labels=""
for name,sub,lat,lon,side in SYS:
    x,y=xy(lat,lon);lx=x/VW*100;ly=y/VH*100
    subhtml=("<br>".join(sub) if isinstance(sub,list) else sub)
    pins+=f'<div class="pin" style="left:{lx:.2f}%;top:{ly:.2f}%"></div>'
    align="left" if side=="l" else "right"
    off = "translate(-108%,-50%)" if side=="l" else "translate(8%,-50%)"
    labels+=(f'<div class="lab" style="left:{lx:.2f}%;top:{ly:.2f}%;transform:{off};text-align:{align}">'
             f'<div class="ln">{name}</div><div class="ls">{subhtml}</div></div>')
# 寺庙簇(东部中国·合并一个标)
tx,ty=xy(31.5,119.5);tlx=tx/VW*100;tly=ty/VH*100
for _,lat,lon in TEMPLE:
    x,y=xy(lat,lon);pins+=f'<div class="tpin" style="left:{x/VW*100:.2f}%;top:{y/VH*100:.2f}%"></div>'
templabel=(f'<div class="lab tl" style="left:{tlx:.2f}%;top:{tly:.2f}%;transform:translate(10%,10%)">'
           f'<div class="ln">⛩ 目标寺庙</div><div class="ls">雍和宫·灵隐寺<br>普陀山·九华山·五台山</div></div>')

html=f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:1400px;height:920px;position:relative;overflow:hidden;font-family:"Songti SC","Georgia","Hiragino Sans GB",serif;
 background:radial-gradient(130% 90% at 50% 0%,#1a1c3e,#0d1030 45%,#06060f 100%);color:#eadfc8}}
.stars{{position:absolute;inset:0;background-image:radial-gradient(1.3px 1.3px at 12% 14%,#fff,transparent),radial-gradient(1.1px 1.1px at 82% 10%,#ffe9b0,transparent),radial-gradient(1px 1px at 60% 8%,#fff,transparent),radial-gradient(1.2px 1.2px at 34% 20%,#cfe0ff,transparent),radial-gradient(1px 1px at 90% 26%,#fff,transparent);opacity:.55}}
.head{{position:relative;text-align:center;padding-top:44px;z-index:3}}
.brand{{font-size:24px;letter-spacing:8px;color:#c9a84c}}
h1{{font-size:60px;font-weight:700;margin:6px 0 2px;background:linear-gradient(135deg,#e8d08a,#c9a84c,#f0e4b0);-webkit-background-clip:text;background-clip:text;color:transparent}}
.sub{{font-size:24px;color:#a9a488;letter-spacing:1px}}
.mapwrap{{position:absolute;left:50%;top:150px;transform:translateX(-50%);width:1180px;height:{1180*VH/VW:.0f}px}}
.mapwrap svg{{width:100%;height:100%}}
.mapwrap svg path{{fill:#243056 !important;stroke:#c9a84c !important;stroke-width:.4 !important;stroke-opacity:.5}}
.layer{{position:absolute;inset:0}}
.pin{{position:absolute;width:16px;height:16px;border-radius:50%;background:#f0d98a;
 box-shadow:0 0 0 5px rgba(240,217,138,.25),0 0 18px 4px rgba(240,217,138,.7);transform:translate(-50%,-50%)}}
.tpin{{position:absolute;width:9px;height:9px;border-radius:50%;background:#e07a5a;
 box-shadow:0 0 0 3px rgba(224,122,90,.3),0 0 10px 2px rgba(224,122,90,.6);transform:translate(-50%,-50%)}}
.lab{{position:absolute;white-space:nowrap}}
.ln{{font-size:27px;font-weight:700;color:#f0e4b0;text-shadow:0 2px 8px #000}}
.ls{{font-size:20px;color:#c9bfa2;line-height:1.35;text-shadow:0 2px 6px #000}}
.tl .ln{{color:#f0b49a}}
.foot{{position:absolute;bottom:34px;width:100%;text-align:center;font-size:22px;color:#8f8a70;z-index:3}}
</style></head><body>
<div class="stars"></div>
<div class="head"><div class="brand">RUNAE · 多体系交叉印证</div>
<h1>汇聚全球占卜智慧于一处</h1><div class="sub">Eastern & Western Divination · One Platform</div></div>
<div class="mapwrap">{svg}<div class="layer">{pins}{labels}{templabel}</div></div>
<div class="foot">Runae · 八字 · 紫微 · 奇门 · 六壬 · 吠陀 · 藏历 · 玛雅 · 西占 —— 一个问题，多体系合断</div>
</body></html>"""
open(OUT,"w").write(html);print("HTML",OUT)
