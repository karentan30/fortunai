#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把新方法报告(txt)做成有设计感的主题化HTML"""
import os,re,html as _h
BASE=os.path.expanduser("~/projects/shenyuan/samples/caijing")
# 方法配置: key,标题,英,印,txt文件,主题(bg渐变/主色/卡bg/字色/副色)
METHODS=[
 dict(key="omikuji",title="御神籤 · おみくじ",en="JAPANESE OMIKUJI",seal="神籤",f="karen-omikuji.txt",
   bg="radial-gradient(120% 50% at 50% 0%,#f6ece0,#efe0cf 55%,#e6d3bd)",main="#b23a2e",card="rgba(255,252,246,.9)",fg="#4a2f24",sub="#a06a4a",bd="#d8b48a"),
 dict(key="rune",title="卢恩符文 · RUNES",en="ELDER FUTHARK",seal="ᚱᚢᚾ",f="karen-rune.txt",
   bg="radial-gradient(120% 60% at 50% 0%,#1d2740,#111a2e 55%,#080d18)",main="#9fc4e8",card="rgba(255,255,255,.05)",fg="#e6ecf5",sub="#8fa8c8",bd="rgba(159,196,232,.35)"),
 dict(key="kyusei",title="九星気学",en="NINE STAR KI",seal="九星",f="karen-kyusei.txt",
   bg="radial-gradient(120% 55% at 50% 0%,#16323e,#0e2530 55%,#071820)",main="#7fc4d6",card="rgba(255,255,255,.05)",fg="#e2eef0",sub="#8fbccb",bd="rgba(127,196,214,.32)"),
]
HEAD=re.compile(r'^\s*(\d+[.\、]|[⭐🌸🏯🌟💫🀄🌙✨💰❤🎯🔮🌊♦◆🎴⚡🧭①②③④⑤⑥⑦⑧⑨●])')
def sections(txt):
    secs=[];cur=None
    for line in txt.split("\n"):
        s=line.strip()
        if not s:continue
        if HEAD.match(s) or (len(s)<24 and re.search(r'[（(]?\d*字?[)）]?$',s) and len(s)<20 and not cur):
            if cur:secs.append(cur)
            cur={"h":s,"b":[]}
        else:
            if not cur:cur={"h":"","b":[]}
            cur["b"].append(s)
    if cur:secs.append(cur)
    return secs
for m in METHODS:
    txt=open(os.path.join(BASE,m["f"])).read()
    secs=sections(txt)
    cards=""
    for sec in secs:
        b="<br>".join(_h.escape(x) for x in sec["b"])
        cards+=f'<div class="c"><div class="ch">{_h.escape(sec["h"])}</div><div class="cb">{b}</div></div>'
    doc=f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
@page{{size:1080px 1528px;margin:0}}
.c{{break-inside:avoid}}
body{{width:1080px;font-family:"Songti SC","STSong","Georgia","Hiragino Sans GB",serif;background:{m['bg']};color:{m['fg']};padding:64px 70px 84px;position:relative}}
.brand{{text-align:center;font-size:22px;letter-spacing:7px;color:{m['main']}}}
h1{{text-align:center;font-size:62px;font-weight:700;margin:8px 0 2px;color:{m['main']}}}
.en{{text-align:center;font-size:22px;letter-spacing:5px;color:{m['sub']};margin-bottom:6px}}
.who{{text-align:center;font-size:22px;color:{m['sub']};margin-bottom:34px}}
.seal{{position:absolute;right:60px;top:60px;width:88px;height:88px;border:2px solid {m['main']};border-radius:12px;color:{m['main']};display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;transform:rotate(-4deg)}}
.c{{background:{m['card']};border:1.5px solid {m['bd']};border-radius:20px;padding:30px 36px;margin-bottom:22px}}
.ch{{font-size:32px;font-weight:700;color:{m['main']};margin-bottom:14px;line-height:1.3}}
.cb{{font-size:26px;line-height:1.85;color:{m['fg']}}}
.foot{{text-align:center;font-size:20px;color:{m['sub']};margin-top:30px}}
</style></head><body>
<div class="seal">{m['seal']}</div>
<div class="brand">RUNAE</div><h1>{m['title']}</h1><div class="en">{m['en']}</div>
<div class="who">依你的问事 · 1991-10-05 · 女</div>
{cards}
<div class="foot">Runae · 传统文化/娱乐参考 · 不作医疗或命运绝对判断</div>
</body></html>"""
    open(os.path.join(BASE,f"report-{m['key']}.html"),"w").write(doc)
    print("HTML report-"+m["key"]+".html ·",len(secs),"段")
