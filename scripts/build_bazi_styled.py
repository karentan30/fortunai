#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""八字报告·深金玄学背景 -> styled HTML (供Chrome --print-to-pdf)"""
import os,re,sys,html as _h
md_path=sys.argv[1]; out_html=sys.argv[2]; title=sys.argv[3]; sub=sys.argv[4]
lang=sys.argv[5] if len(sys.argv)>5 else "zh"
md=open(md_path).read()

# --- 她的四柱命盘(引擎: 1991-10-05 06:00) ---
EN=(lang=="en")
CH=lambda z,e: e if EN else z
pillars=[  # 柱名, 天干, 十神, 地支, 藏干
 (CH("年柱","Year"),"辛",CH("伤官","Hurt Off."),"未",CH("己丁乙","Ji Ding Yi")),
 (CH("月柱","Month"),"丁",CH("正印","Resource"),"酉",CH("辛","Xin")),
 (CH("日柱","Day"),"戊",CH("日主","Self"),"申",CH("庚壬戊","Geng Ren Wu")),
 (CH("时柱","Hour"),"乙",CH("正官","Officer"),"卯",CH("乙","Yi")),
]
WX=[(CH("金","Metal"),3,"#d4af52"),(CH("木","Wood"),2,"#6fae6f"),(CH("土","Earth"),2,"#b5926a"),
    (CH("火","Fire"),1,"#d8776f"),(CH("水","Water"),0,"#6f9fd8")]
cols="".join(
 f'<div class="pil"><div class="pn">{n}</div><div class="ss">{s}</div><div class="gan">{g}</div>'
 f'<div class="zhi">{z}</div><div class="cang">{c}</div></div>' for n,g,s,z,c in pillars)
bars="".join(
 f'<div class="wxrow"><span class="wxn" style="color:{col}">{n}</span>'
 f'<span class="wxbar"><span style="width:{v/3*100:.0f}%;background:{col}"></span></span>'
 f'<span class="wxv">{v}</span></div>' for n,v,col in WX)
chart=f"""<div class="chart">
 <div class="ctitle">{CH('四柱命盘','Four Pillars')}</div>
 <div class="pills">{cols}</div>
 <div class="ctitle" style="margin-top:24px">{CH('五行分布','Five Elements')} <span style="font-size:20px;color:#a9a488">{CH('· 水偏弱','· Water weak')}</span></div>
 <div class="wx">{bars}</div>
</div>"""

def inline(t):
    t=_h.escape(t)
    t=re.sub(r'\*\*(.+?)\*\*',r'<b>\1</b>',t)
    t=re.sub(r'\*(.+?)\*',r'<i>\1</i>',t)
    return t
out=[];inlist=False
for line in md.split("\n"):
    s=line.rstrip()
    if not s:
        if inlist:out.append("</ul>");inlist=False
        continue
    if s.startswith("# "): continue
    if s.startswith("### "):
        if inlist:out.append("</ul>");inlist=False
        out.append(f'<h3>{inline(s[4:])}</h3>');continue
    if s.startswith("## "):
        if inlist:out.append("</ul>");inlist=False
        out.append(f'<h2>{inline(s[3:])}</h2>');continue
    if s.startswith("> "): continue
    if s.startswith("---"):
        if inlist:out.append("</ul>");inlist=False
        continue
    if s.startswith("- ") or s.startswith("* "):
        if not inlist:out.append('<ul>');inlist=True
        out.append(f'<li>{inline(s[2:])}</li>');continue
    if inlist:out.append("</ul>");inlist=False
    out.append(f'<p>{inline(s)}</p>')
if inlist:out.append("</ul>")
body="\n".join(out)

doc=f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@page{{size:820px 1160px;margin:0}}
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
body{{font-family:"Songti SC","STSong","Georgia","Hiragino Sans GB",serif;
 background:#0d0a12;color:#eadfc8;padding:70px 68px}}
.bgglow{{position:fixed;top:-160px;left:50%;transform:translateX(-50%);width:900px;height:520px;
 background:radial-gradient(closest-side,rgba(201,168,76,.22),transparent 70%);pointer-events:none}}
.stars{{position:fixed;inset:0;background-image:radial-gradient(1.3px 1.3px at 15% 10%,#fff,transparent),radial-gradient(1.1px 1.1px at 78% 6%,#ffe9b0,transparent),radial-gradient(1px 1px at 88% 18%,#fff,transparent),radial-gradient(1.2px 1.2px at 30% 22%,#cfe0ff,transparent);opacity:.5;pointer-events:none}}
.wrap{{position:relative}}
.brand{{text-align:center;font-size:22px;letter-spacing:6px;color:#c9a84c}}
h1{{text-align:center;font-size:60px;font-weight:700;letter-spacing:3px;margin:8px 0 4px;
 background:linear-gradient(135deg,#e8d08a,#c9a84c,#f0e4b0);-webkit-background-clip:text;background-clip:text;color:transparent}}
.sub{{text-align:center;font-size:22px;color:#a9a488;margin-bottom:14px}}
.rule{{width:130px;height:3px;background:linear-gradient(90deg,#8a6420,#e8d08a,#8a6420);border-radius:3px;margin:0 auto 30px}}
h2{{font-size:36px;color:#e8d08a;margin:34px 0 14px;padding-left:16px;border-left:5px solid #c9a84c;break-after:avoid}}
h3{{font-size:28px;color:#d8b96a;margin:22px 0 10px;break-after:avoid}}
p{{font-size:24px;line-height:1.75;margin:12px 0;color:#e6ddc7}}
b{{color:#f0d98a}}
ul{{margin:12px 0 12px 6px}}
li{{font-size:24px;line-height:1.72;margin:10px 0;list-style:none;padding-left:30px;position:relative;color:#e6ddc7}}
li:before{{content:"◆";color:#c9a84c;position:absolute;left:0;top:2px;font-size:18px}}
.seal{{position:absolute;right:0;top:0;width:82px;height:82px;border:2px solid #c9a84c;border-radius:12px;color:#c9a84c;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;transform:rotate(-4deg)}}
.foot{{text-align:center;font-size:19px;color:#7d7a68;margin-top:34px}}
</style></head><body><div class="bgglow"></div><div class="stars"></div><div class="wrap">
<div class="seal">命理</div>
<div class="brand">RUNAE · 八字命理</div>
<h1>{title}</h1><div class="sub">{sub}</div><div class="rule"></div>
{body}
<div class="foot">Runae · 传统命理文化参考 · 仅供自我观照 · 不构成决策建议</div>
</div></body></html>"""
open(out_html,"w").write(doc);print("HTML",out_html)
