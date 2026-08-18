#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Runae 为什么准(信任卡)"""
import os
OUT=os.path.expanduser("~/projects/shenyuan/samples/caijing/为什么很准.html")
pts=[
 ("🎯","专业万年历引擎精算","四柱·大运·十神·藏干 全部机器精算——<b>不像 ChatGPT 自己排盘常算错</b>"),
 ("🔒","AI 只解读，不排盘","代码硬性禁止 AI 改动命盘·只做解读——<b>盘是对的，解读才可信</b>"),
 ("⚖","多体系交叉印证","一个问题多方法合断·<b>2–3 法指向同一结论 = 可信度翻倍</b>·别人只单点"),
 ("💧","基于你的真实数据","说中你，是因为算的是<b>你真实的五行与格局</b>·不是人人通用的模糊话"),
 ("🕊","诚实·不吓唬","给方向不宿命·不制造焦虑·不打包票——<b>可信，才敢一直用</b>"),
]
cards="".join(f'<div class="c"><div class="i">{i}</div><div><div class="t">{t}</div><div class="d">{d}</div></div></div>' for i,t,d in pts)
html=f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:1080px;font-family:"Songti SC","Georgia","Hiragino Sans GB",serif;position:relative;
 background:radial-gradient(120% 50% at 50% 0%,#241a30,#140f1e 55%,#08060f);color:#eadfc8;padding:60px 66px 76px}}
.stars{{position:absolute;inset:0;background-image:radial-gradient(1.3px 1.3px at 15% 8%,#fff,transparent),radial-gradient(1.1px 1.1px at 80% 6%,#ffe9b0,transparent);opacity:.5}}
.wrap{{position:relative}}
.brand{{text-align:center;font-size:22px;letter-spacing:7px;color:#c9a84c}}
h1{{text-align:center;font-size:60px;font-weight:700;margin:6px 0 6px;background:linear-gradient(135deg,#e8d08a,#c9a84c,#f0e4b0);-webkit-background-clip:text;background-clip:text;color:transparent}}
.sub{{text-align:center;font-size:23px;color:#a9a488;margin-bottom:34px}}
.c{{display:flex;gap:22px;align-items:flex-start;background:rgba(255,255,255,.045);border:1.5px solid rgba(201,168,76,.3);border-radius:18px;padding:26px 30px;margin-bottom:18px}}
.i{{font-size:44px;flex:0 0 56px}}
.t{{font-size:32px;font-weight:700;color:#f0e4b0;margin-bottom:8px}}
.d{{font-size:24px;color:#cabfa2;line-height:1.5}} .d b{{color:#f0d98a}}
.foot{{text-align:center;font-size:21px;color:#8f8a70;margin-top:26px}}
</style></head><body><div class="stars"></div><div class="wrap">
<div class="brand">RUNAE · 我们凭什么准</div>
<h1>Runae 为什么准？</h1>
<div class="sub">盘是机器精算的 · 解读是懂你的 · 还能多体系互相印证</div>
{cards}
<div class="foot">Runae · 专业引擎 + AI 解读 + 多体系印证 · 传统文化参考·不作绝对命运判断</div>
</div></body></html>"""
open(OUT,"w").write(html);print("HTML",OUT)
