#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Runae 全球祈福圣地网络图 + 代祈福服务"""
import os
BASE=os.path.expanduser("~/projects/shenyuan")
svg=open(os.path.join(BASE,"samples/caijing/world-map.svg")).read()
OUT=os.path.join(BASE,"samples/caijing/全球祈福圣地网络.html")
VW,VH=1010,666
def xy(lat,lon):return((lon+180)/360*VW,(90-lat)/180*VH)
# 区域: 名, 副(圣地), lat, lon, 侧
REG=[
 ("🇨🇳 中国","雍和宫·灵隐寺·普陀山<br>九华山·五台山",34,116,"r"),
 ("🏔 藏传","大昭寺·布达拉宫",29.6,88,"l"),
 ("🕉 印度","菩提伽耶·瓦拉纳西",24,80,"l"),
 ("🎌 日本","伊势神宫·清水寺·浅草寺",36,140,"r"),
 ("🇹🇭 泰国","玉佛寺·四面佛",13,101,"l"),
 ("🛕 柬埔寨","吴哥窟",13.4,104,"r"),
 ("✡️☪️ 中东","耶路撒冷·麦加",28,37,"l"),
 ("⛪ 欧洲","梵蒂冈·圣地亚哥",42,10,"l"),
]
sites=[(39.9,116.4),(30.2,120.1),(30,122.4),(30.5,117.8),(39,113.6),(29.65,91.1),(24.7,85),(25.3,83),
 (34.45,136.7),(35,135.8),(35.7,139.8),(13.75,100.5),(13.74,100.54),(13.4,103.9),(31.78,35.22),(21.42,39.83),(41.9,12.45),(42.88,-8.54)]
pins="";labels=""
for lat,lon in sites:
    x,y=xy(lat,lon);pins+=f'<div class="sp" style="left:{x/VW*100:.2f}%;top:{y/VH*100:.2f}%"></div>'
for name,sub,lat,lon,side in REG:
    x,y=xy(lat,lon);lx=x/VW*100;ly=y/VH*100
    off="translate(-106%,-50%)" if side=="l" else "translate(6%,-50%)"
    al="right" if side=="l" else "left"
    labels+=(f'<div class="lab" style="left:{lx:.2f}%;top:{ly:.2f}%;transform:{off};text-align:{al}">'
             f'<div class="ln">{name}</div><div class="ls">{sub}</div></div>')
SKU=["代上香/祈福 ¥88+","系红丝带/挂红 ¥66+","供灯·长明灯 ¥199+/年","开光物代请 ¥168+",
     "放生 ¥99+","寺庙修缮捐赠","消灾祈福法事 ¥688+","超度法事(为逝者) ¥888+"]
skuhtml="".join(f'<span class="sku">{s}</span>' for s in SKU)
html=f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:1400px;height:1020px;position:relative;overflow:hidden;font-family:"Songti SC","Georgia","Hiragino Sans GB",serif;
 background:radial-gradient(130% 90% at 50% 0%,#2a1c10,#1a1206 48%,#0c0803 100%);color:#f0e2c8}}
.glow{{position:absolute;inset:0;background-image:radial-gradient(1.4px 1.4px at 20% 12%,#ffcf8a,transparent),radial-gradient(1.1px 1.1px at 78% 8%,#ffe9b0,transparent),radial-gradient(1px 1px at 55% 6%,#fff,transparent);opacity:.5}}
.head{{position:relative;text-align:center;padding-top:40px;z-index:3}}
.brand{{font-size:23px;letter-spacing:8px;color:#d9a34c}}
h1{{font-size:58px;font-weight:700;margin:6px 0 2px;background:linear-gradient(135deg,#f0d08a,#d9a34c,#f5e2a8);-webkit-background-clip:text;background-clip:text;color:transparent}}
.sub{{font-size:24px;color:#c2a878;letter-spacing:1px}}
.scene{{font-size:22px;color:#e8b060;margin-top:8px}}
.mapwrap{{position:absolute;left:50%;top:172px;transform:translateX(-50%);width:1180px;height:{1180*VH/VW:.0f}px}}
.mapwrap svg{{width:100%;height:100%}}
.mapwrap svg path{{fill:#3a2a18 !important;stroke:#d9a34c !important;stroke-width:.4 !important;stroke-opacity:.45}}
.layer{{position:absolute;inset:0}}
.sp{{position:absolute;width:11px;height:11px;border-radius:50%;background:#ffcf7a;box-shadow:0 0 0 4px rgba(255,207,122,.25),0 0 14px 3px rgba(255,207,122,.7);transform:translate(-50%,-50%)}}
.lab{{position:absolute;white-space:nowrap}}
.ln{{font-size:25px;font-weight:700;color:#f5e2a8;text-shadow:0 2px 8px #000}}
.ls{{font-size:18px;color:#d8c49a;line-height:1.3;text-shadow:0 2px 6px #000}}
.skubar{{position:absolute;bottom:90px;width:100%;text-align:center;z-index:3;padding:0 40px}}
.skut{{font-size:24px;color:#e8b060;margin-bottom:14px;font-weight:700}}
.sku{{display:inline-block;margin:6px;padding:10px 20px;border:1.5px solid rgba(217,163,76,.5);border-radius:40px;font-size:21px;color:#f0e2c8;background:rgba(217,163,76,.08)}}
.foot{{position:absolute;bottom:34px;width:100%;text-align:center;font-size:20px;color:#a89060;z-index:3}}
</style></head><body>
<div class="glow"></div>
<div class="head"><div class="brand">RUNAE · 全球祈福网络</div>
<h1>全球祈福圣地 · 代祈福服务</h1>
<div class="sub">Global Blessing Network · One Platform</div>
<div class="scene">为逝去的亲人超度 · 为自己求学求福(考大学/事业/姻缘/健康)</div></div>
<div class="mapwrap">{svg}<div class="layer">{pins}{labels}</div></div>
<div class="skubar"><div class="skut">可代办的功德 · 师父连麦直播为证</div>{skuhtml}</div>
<div class="foot">实地录像 + 师父 Agora 连麦 + 照片 + 回向凭证 · 捐赠类透明公示善款去向</div>
</body></html>"""
open(OUT,"w").write(html);print("HTML",OUT)
