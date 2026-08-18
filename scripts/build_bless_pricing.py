#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""祈福代办 价目卡(暖金风)"""
import os
OUT=os.path.expanduser("~/projects/shenyuan/samples/caijing/祈福价目卡.html")
GROUPS=[
 ("🙏 祈福 · 上香",[("代上香 · 代祈福","¥288","$68"),("系红丝带 · 挂红祈愿","¥128","$38")]),
 ("🪔 供灯",[("供灯（单次）","¥388","$88"),("长明灯 · 月供","¥388/月","$88/月"),("长明灯 · 年供（省¥768）","¥3888/年","$788/年")]),
 ("📿 功德",[("开光物代请（含物）","¥588","$138"),("代放生（服务）","¥388","$88"),("寺庙修缮功德（自选）","¥200/800/2000","$50/168/388")]),
 ("🕯 法事",[("消灾祈福法事","¥1888","$388"),("超度法事 · 为逝去的亲人","¥2888","$588")]),
 ("🎋 大师",[("大师连麦 · 加持/开示（30min）","¥488","$98")]),
]
def row(n,c,d):
    return f'<div class="r"><span class="rn">{n}</span><span class="rp"><b>{c}</b><i>{d}</i></span></div>'
body=""
for g,items in GROUPS:
    body+=f'<div class="gt">{g}</div>'+"".join(row(*i) for i in items)
html=f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:1080px;font-family:"Songti SC","STSong","Hiragino Sans GB",serif;position:relative;
 background:radial-gradient(130% 55% at 50% 0%,#2e2010,#1c1408 52%,#0d0904);color:#f0e2c8;padding:60px 66px 76px}}
.glow{{position:absolute;inset:0;background-image:radial-gradient(1.4px 1.4px at 18% 8%,#ffcf8a,transparent),radial-gradient(1.1px 1.1px at 80% 6%,#ffe9b0,transparent);opacity:.5}}
.wrap{{position:relative}}
.brand{{text-align:center;font-size:23px;letter-spacing:7px;color:#d9a34c}}
h1{{text-align:center;font-size:62px;font-weight:700;margin:8px 0 4px;background:linear-gradient(135deg,#f0d08a,#d9a34c,#f5e2a8);-webkit-background-clip:text;background-clip:text;color:transparent}}
.sub{{text-align:center;font-size:24px;color:#c2a878;margin-bottom:8px}}
.scene{{text-align:center;font-size:22px;color:#e8b060;margin-bottom:30px}}
.gt{{font-size:30px;font-weight:700;color:#f0d08a;margin:26px 0 12px}}
.r{{display:flex;justify-content:space-between;align-items:center;background:rgba(217,163,76,.07);border:1.5px solid rgba(217,163,76,.28);border-radius:14px;padding:20px 26px;margin-bottom:12px}}
.rn{{font-size:27px;color:#f0e2c8}}
.rp{{text-align:right}} .rp b{{font-size:30px;color:#f5e2a8;font-weight:700}} .rp i{{display:block;font-size:21px;color:#c2a878;font-style:normal;margin-top:2px}}
.foot{{text-align:center;font-size:21px;color:#b09664;margin-top:30px;line-height:1.6}}
</style></head><body><div class="glow"></div><div class="wrap">
<div class="brand">RUNAE · 全球祈福代办</div>
<h1>祈福代办 · 价目</h1>
<div class="sub">全球圣地 · 真人代办 · 连麦直播为证</div>
<div class="scene">为逝去的亲人超度 · 为自己求学求福（考试/事业/健康/姻缘）</div>
{body}
<div class="foot">实地录像 + 大师 Agora 连麦 + 照片 + 书面回向凭证<br>Runae · 代办服务 · 传统习俗心意 · 不作效果承诺</div>
</div></body></html>"""
open(OUT,"w").write(html);print("HTML",OUT)
