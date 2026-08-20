#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Runae Global Blessing Network map (English · addresses · edge labels inward, no clipping)"""
import os
BASE=os.path.expanduser("~/projects/shenyuan")
svg=open(os.path.join(BASE,"samples/caijing/world-map.svg")).read()
OUT=os.path.join(BASE,"samples/caijing/全球祈福圣地网络.html")
VW,VH=1010,666
def xy(lat,lon):return((lon+180)/360*VW,(90-lat)/180*VH)
# Region: name(EN), sites+address(EN), pin lat/lon, label anchor (ax,ay in % of map), align. Leader line connects anchor→pin so labels spread out, never overlap or clip.
REG=[
 ("⛪ Europe","Vatican · Rome<br>Santiago de Compostela",42,10, 8,24,"left"),
 ("✡️ ☪️ Middle East","Jerusalem · Mecca",28,37, 6,50,"left"),
 ("🕉 India","Bodh Gaya · Varanasi",24,80, 10,76,"left"),
 ("🏔 Tibet","Jokhang & Potala · Lhasa",29.6,88, 34,90,"left"),
 ("🇹🇭 Thailand","Wat Phra Kaew · Erawan · Bangkok",13,101, 60,94,"left"),
 ("🛕 Cambodia","Angkor Wat · Siem Reap",13.4,104, 84,90,"left"),
 ("🇨🇳 China","Yonghe Temple · Beijing<br>Lingyin · Hangzhou · Mt. Putuo",34,116, 80,22,"left"),
 ("🎌 Japan","Ise Jingu · Kiyomizu<br>Senso-ji · Tokyo",36,140, 92,44,"left"),
]
sites=[(39.9,116.4),(30.2,120.1),(30,122.4),(30.5,117.8),(39,113.6),(29.65,91.1),(24.7,85),(25.3,83),
 (34.45,136.7),(35,135.8),(35.7,139.8),(13.75,100.5),(13.74,100.54),(13.4,103.9),(31.78,35.22),(21.42,39.83),(41.9,12.45),(42.88,-8.54)]
pins="";labels="";lines=""
for lat,lon in sites:
    x,y=xy(lat,lon);pins+=f'<div class="sp" style="left:{x/VW*100:.2f}%;top:{y/VH*100:.2f}%"></div>'
for name,sub,lat,lon,ax,ay,al in REG:
    x,y=xy(lat,lon);px=x/VW*100;py=y/VH*100
    # leader line from anchor(ax,ay) to pin(px,py)
    lines+=f'<line x1="{ax}" y1="{ay}" x2="{px:.2f}" y2="{py:.2f}" stroke="#d9a34c" stroke-width="0.18" stroke-dasharray="1.2 1" opacity="0.7"/>'
    tx = "translate(0,-50%)" if al=="left" else "translate(-100%,-50%)"
    labels+=(f'<div class="lab" style="left:{ax}%;top:{ay}%;transform:{tx};text-align:{al}">'
             f'<div class="ln">{name}</div><div class="ls">{sub}</div></div>')
SKU=["Incense & Prayer $12+","Red Ribbon Blessing $9+","Eternal Lamp $28+/yr","Consecrated Charm $23+",
     "Release of Life $14+","Temple Restoration","Blessing Ritual $96+","Memorial Rite (for the departed) $124+"]
skuhtml="".join(f'<span class="sku">{s}</span>' for s in SKU)
html=f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:1400px;height:1020px;position:relative;overflow:hidden;font-family:"Georgia","Songti SC","Hiragino Sans GB",serif;
 background:radial-gradient(130% 90% at 50% 0%,#2a1c10,#1a1206 48%,#0c0803 100%);color:#f0e2c8}}
.glow{{position:absolute;inset:0;background-image:radial-gradient(1.4px 1.4px at 20% 12%,#ffcf8a,transparent),radial-gradient(1.1px 1.1px at 78% 8%,#ffe9b0,transparent),radial-gradient(1px 1px at 55% 6%,#fff,transparent);opacity:.5}}
.head{{position:relative;text-align:center;padding-top:40px;z-index:3}}
.brand{{font-size:22px;letter-spacing:7px;color:#d9a34c}}
h1{{font-size:54px;font-weight:700;margin:6px 0 2px;background:linear-gradient(135deg,#f0d08a,#d9a34c,#f5e2a8);-webkit-background-clip:text;background-clip:text;color:transparent}}
.sub{{font-size:23px;color:#c2a878;letter-spacing:1px}}
.scene{{font-size:20px;color:#e8b060;margin-top:8px}}
.mapwrap{{position:absolute;left:50%;top:176px;transform:translateX(-50%);width:1160px;height:{1160*VH/VW:.0f}px}}
.mapwrap svg{{width:100%;height:100%}}
.mapwrap svg path{{fill:#3a2a18 !important;stroke:#d9a34c !important;stroke-width:.4 !important;stroke-opacity:.45}}
.layer{{position:absolute;inset:0}}
.sp{{position:absolute;width:11px;height:11px;border-radius:50%;background:#ffcf7a;box-shadow:0 0 0 4px rgba(255,207,122,.25),0 0 14px 3px rgba(255,207,122,.7);transform:translate(-50%,-50%)}}
.lab{{position:absolute;max-width:270px}}
.ln{{font-size:24px;font-weight:700;color:#f5e2a8;text-shadow:0 2px 8px #000;white-space:nowrap}}
.ls{{font-size:16px;color:#d8c49a;line-height:1.35;text-shadow:0 2px 6px #000}}
.skubar{{position:absolute;bottom:86px;width:100%;text-align:center;z-index:3;padding:0 40px}}
.skut{{font-size:23px;color:#e8b060;margin-bottom:14px;font-weight:700}}
.sku{{display:inline-block;margin:6px;padding:9px 18px;border:1.5px solid rgba(217,163,76,.5);border-radius:40px;font-size:19px;color:#f0e2c8;background:rgba(217,163,76,.08)}}
.foot{{position:absolute;bottom:32px;width:100%;text-align:center;font-size:18px;color:#a89060;z-index:3}}
</style></head><body>
<div class="glow"></div>
<div class="head"><div class="brand">RUNAE · GLOBAL BLESSING NETWORK</div>
<h1>Sacred Sites Worldwide · Blessing on Your Behalf</h1>
<div class="sub">20+ Renowned Temples & Shrines · One Platform</div>
<div class="scene">Memorial rites for departed loved ones · Prayers for study, career, love & health</div></div>
<div class="mapwrap">{svg}<div class="layer">{pins}{labels}</div></div>
<div class="skubar"><div class="skut">Merits We Can Arrange · Verified by Live Monk Video Call</div>{skuhtml}</div>
<div class="foot">On-site video + live monk (Agora) call + photos + dedication certificate · Donations: transparent public ledger</div>
</body></html>"""
open(OUT,"w").write(html);print("HTML",OUT)
