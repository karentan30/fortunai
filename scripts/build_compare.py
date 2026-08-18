#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Runae vs 全竞品 功能对比图(诚实版·真实MAU/定价)"""
import os
OUT=os.path.expanduser("~/projects/shenyuan/samples/caijing/竞品功能对比.html")
apps=["Runae","测测","高人汇","Fatetell","Co-Star","The Pattern","Sanctuary","Nebula","ChatGPT"]
# 符号矩阵行: 功能, [每app: (符号,短注)]  Runae在第0列
def Y(t=""):return("✓",t)
def P(t=""):return("◐",t)
def N(t=""):return("✗",t)
rows=[
("东方命理(八字/紫微/奇门)",[Y(),Y(),Y(),Y(),N(),N(),N(),N(),P()]),
("专业引擎精准排盘",[Y(),Y(),P("真人"),Y(),Y(),Y(),Y(),Y(),N("常错")]),
("命理体系数量",[Y("10+"),P(),P(),P("八字"),N("西占"),N("西占"),N("西占"),N("西占"),P("不精")]),
("多体系交叉合断",[Y("独有"),N(),N(),N(),N(),N(),N(),N(),N()]),
("可视化命盘卡",[Y(),P(),N(),N(),Y(),Y(),P(),P(),N()]),
("照片真读·面相手相",[Y(),P(),N(),N(),N(),N(),N(),N(),P("不准")]),
("报告 PDF 下载",[Y(),N(),N(),N(),N(),N(),N(),N(),N()]),
("多语言(中英韩)",[Y(),N("中"),N("中"),P("中英"),N("英"),N("英"),N("英"),N("英"),Y()]),
("代祈福/功德/寺庙",[P("规划"),N(),N(),N(),N(),N(),N(),N(),N()]),
("真人大师连麦",[P("可复用"),Y(),Y(),N(),N(),N(),Y(),N(),N()]),
]
# 文字行(MAU/定价)
textrows=[
 ("用户规模 MAU",["刚起步","6000万","300万","2万+","430万","1500万","未知","未知","巨"]),
 ("定价",["$9.9报告","¥9-299","¥/分钟","$39.9报告","$8.99月","$14.99月","$14.99+真人","$24.99月","$20月通用"]),
]
def cell(v,is_ru):
    s,n=v
    col={"✓":("#f0d98a" if is_ru else "#5fbf7a"),"◐":"#e0b45a","✗":"#b5605a"}[s]
    return f'<td class="{"ru" if is_ru else ""}"><span class="sym" style="color:{col}">{s}</span>{("<span class=nt>"+n+"</span>") if n else ""}</td>'
head="".join(f'<th class="{"ruh" if a=="Runae" else ""}">{a}</th>' for a in apps)
body=""
for feat,vals in rows:
    body+=f'<tr><td class="feat">{feat}</td>'+"".join(cell(v,i==0) for i,v in enumerate(vals))+"</tr>"
for feat,vals in textrows:
    tds="".join(f'<td class="{"ru" if i==0 else ""} txt">{t}</td>' for i,t in enumerate(vals))
    body+=f'<tr class="tr"><td class="feat">{feat}</td>{tds}</tr>'
html=f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:1820px;font-family:"Songti SC","Georgia","Hiragino Sans GB",serif;background:radial-gradient(120% 55% at 50% 0%,#1c1a2e,#100e1c 55%,#08060f);color:#eadfc8;padding:52px 56px 64px;position:relative}}
.brand{{text-align:center;font-size:22px;letter-spacing:6px;color:#c9a84c}}
h1{{text-align:center;font-size:56px;font-weight:700;margin:6px 0 4px;background:linear-gradient(135deg,#e8d08a,#c9a84c,#f0e4b0);-webkit-background-clip:text;background-clip:text;color:transparent}}
.sub{{text-align:center;font-size:22px;color:#a9a488;margin-bottom:28px}}
table{{width:100%;border-collapse:separate;border-spacing:0}}
th,td{{padding:14px 8px;text-align:center;font-size:21px;border-bottom:1px solid rgba(201,168,76,.16)}}
th{{font-size:23px;color:#cdbf9a;font-weight:700}}
th.ruh{{color:#0d0a12;background:linear-gradient(135deg,#e8d08a,#c9a84c);border-radius:12px 12px 0 0;font-size:28px}}
td.feat{{text-align:left;font-size:22px;color:#e6ddc7;font-weight:600;width:240px}}
td.ru{{background:rgba(201,168,76,.12);border-left:2px solid rgba(201,168,76,.5);border-right:2px solid rgba(201,168,76,.5)}}
.sym{{font-size:27px;font-weight:700;display:block}}
.nt{{font-size:14px;color:#a9a086;display:block;margin-top:2px}}
.txt{{font-size:19px;color:#d8cfb5}} tr.tr td{{background:rgba(255,255,255,.03)}}
tr.tr:last-child td.ru{{border-bottom:2px solid rgba(201,168,76,.5);border-radius:0 0 12px 12px}}
.foot{{text-align:center;font-size:18px;color:#8a8570;margin-top:24px;line-height:1.5}}
</style></head><body>
<div class="brand">RUNAE · 全竞品横评</div><h1>Runae 和其他算命 App 全面对比</h1>
<div class="sub">中外主流占卜/命理 App · 功能横评（如实标注·数据来自公开调研）</div>
<table><thead><tr><td class="feat"></td>{head}</tr></thead><tbody>{body}</tbody></table>
<div class="foot">✓有 · ◐部分/规划 · ✗无 &nbsp;|&nbsp; Runae 独占：多体系合断 + 全球体系 + 照片真读 + 报告PDF &nbsp;|&nbsp; 唯一短板：用户规模刚起步（推广是当务之急）</div>
</body></html>"""
open(OUT,"w").write(html);print("HTML",OUT)
