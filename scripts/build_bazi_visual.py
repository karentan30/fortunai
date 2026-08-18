#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""八字·视觉仪表盘(命盘图+五行图+短卡片·深金玄学) -> HTML. argv: out_html lang"""
import sys,os
out_html=sys.argv[1]; lang=sys.argv[2] if len(sys.argv)>2 else "zh"
EN=(lang=="en"); C=lambda z,e: e if EN else z

pillars=[(C("年","Year"),"辛",C("伤官","Hurt Off."),"未",C("己丁乙","Ji·Ding·Yi")),
 (C("月","Month"),"丁",C("正印","Resource"),"酉",C("辛","Xin")),
 (C("日","Day"),"戊",C("日主·Self","Self"),"申",C("庚壬戊","Geng·Ren·Wu")),
 (C("时","Hour"),"乙",C("正官","Officer"),"卯",C("乙","Yi"))]
WX=[(C("金","Metal"),3,"#d4af52"),(C("木","Wood"),2,"#6fae6f"),(C("土","Earth"),2,"#b5926a"),
    (C("火","Fire"),1,"#d8776f"),(C("水","Water"),0,"#6f9fd8")]
aspects=[
 ("🌱",C("日主","Day Master"),C("戊土坐申 · 中和","Wu Earth on Shen · balanced"),C("沉稳自足，内有主见，不需外界认可","Grounded, self-assured, needs no outside validation")),
 ("✨",C("格局","Pattern"),C("伤官格 · 纯","Hurt Officer · pure"),C("才华外显，重创意表达，不喜体制拘束","Expressive & creative, dislikes rigid systems")),
 ("💧",C("喜用","Favorable"),C("喜水木","Water & Wood"),C("水偏弱，宜流动、近水、走出去","Water weak — favor movement & going abroad")),
 ("💼",C("事业","Career"),C("伤官生财","Talent → wealth"),C("靠专业与才华变现，自由/国际化环境最旺","Monetize skill; thrives in free/global settings")),
 ("💰",C("财运","Wealth"),C("迁移藏偏财","Windfall in travel"),C("异乡、走出去见财，中年渐入佳境","Wealth from abroad; peaks in mid-life")),
 ("❤️",C("姻缘","Love"),C("时柱正官","Officer in Hour"),C("重责任、伴侣正派，晚配更稳","Loyal; upright partner; later marriage suits")),
]
sumline=C("伤官格 · 戊土中和 · 喜水木 —— 才华型，宜走出去、异乡见财、晚配稳。",
          "Hurt-Officer, balanced Wu Earth, favors Water/Wood — a talent type who thrives abroad.")

cols="".join(f'<div class="pil"><div class="pn">{n}</div><div class="ss">{s}</div><div class="gan">{g}</div><div class="zhi">{z}</div><div class="cang">{c}</div></div>' for n,g,s,z,c in pillars)
bars="".join(f'<div class="wxrow"><span class="wxn" style="color:{col}">{n}</span><span class="wxbar"><i style="width:{v/3*100:.0f}%;background:{col}"></i></span><span class="wxv">{v}</span></div>' for n,v,col in WX)
cards="".join(f'<div class="asp"><div class="ai">{i}</div><div class="ac"><div class="at">{t} <span>{tag}</span></div><div class="ad">{d}</div></div></div>' for i,t,tag,d in aspects)

title=C("八字命盘 · 速览","BaZi Chart · At a Glance")
sub=C("Runae · 1991-10-05 早6点 · 女","Runae · born 1991-10-05 6am · female")
html=f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:1080px;position:relative;overflow:hidden;font-family:"Songti SC","STSong","Hiragino Sans GB",serif;
 background:radial-gradient(120% 70% at 50% -8%,#241a30,#120e1c 45%,#08060e 100%);color:#eadfc8;padding:56px 60px 80px}}
.stars{{position:absolute;inset:0;background-image:radial-gradient(1.3px 1.3px at 15% 8%,#fff,transparent),radial-gradient(1.1px 1.1px at 80% 6%,#ffe9b0,transparent),radial-gradient(1px 1px at 90% 16%,#fff,transparent),radial-gradient(1.2px 1.2px at 28% 18%,#cfe0ff,transparent);opacity:.5}}
.wrap{{position:relative}}
.seal{{position:absolute;right:0;top:0;width:82px;height:82px;border:2px solid #c9a84c;border-radius:12px;color:#c9a84c;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;transform:rotate(-4deg)}}
.brand{{font-size:22px;letter-spacing:6px;color:#c9a84c}}
h1{{font-size:58px;font-weight:700;margin:6px 0 2px;background:linear-gradient(135deg,#e8d08a,#c9a84c,#f0e4b0);-webkit-background-clip:text;background-clip:text;color:transparent}}
.sub{{font-size:22px;color:#a9a488;margin-bottom:24px}}
.card{{background:rgba(255,255,255,.045);border:1.5px solid rgba(201,168,76,.30);border-radius:18px;padding:24px 28px;margin-bottom:22px}}
.ctitle{{font-size:28px;color:#e8d08a;font-weight:700;margin-bottom:16px}}
.pills{{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}}
.pil{{text-align:center;background:rgba(201,168,76,.06);border:1px solid rgba(201,168,76,.25);border-radius:14px;padding:16px 6px}}
.pn{{font-size:22px;color:#a9a488}} .ss{{font-size:22px;color:#d8b96a;margin:6px 0}}
.gan{{font-size:60px;font-weight:700;color:#f0e4b0;line-height:1}} .zhi{{font-size:60px;font-weight:700;color:#e8d08a;line-height:1.1}}
.cang{{font-size:19px;color:#9a9078;margin-top:8px}}
.wxrow{{display:flex;align-items:center;gap:16px;margin:12px 0}}
.wxn{{flex:0 0 60px;font-size:26px;font-weight:700}}
.wxbar{{flex:1;height:20px;background:rgba(255,255,255,.06);border-radius:10px;overflow:hidden}}
.wxbar i{{display:block;height:100%;border-radius:10px}}
.wxv{{flex:0 0 30px;text-align:right;font-size:24px;color:#eadfc8}}
.grid{{display:grid;grid-template-columns:1fr 1fr;gap:16px}}
.asp{{display:flex;gap:16px;background:rgba(255,255,255,.045);border:1.5px solid rgba(201,168,76,.28);border-radius:16px;padding:20px 22px}}
.ai{{font-size:40px}} .at{{font-size:27px;font-weight:700;color:#e8d08a}}
.at span{{font-size:20px;color:#c9a84c;font-weight:400;margin-left:6px}}
.ad{{font-size:22px;line-height:1.5;color:#ddd3bd;margin-top:6px}}
.sumbar{{text-align:center;font-size:25px;color:#f2ecd8;background:rgba(201,168,76,.10);border:1.5px solid rgba(201,168,76,.4);border-radius:16px;padding:22px;margin:6px 0 24px}}
.foot{{text-align:center;font-size:19px;color:#7d7a68;margin-top:20px}}
</style></head><body><div class="stars"></div><div class="wrap">
<div class="seal">命理</div>
<div class="brand">RUNAE · {C('八字','BAZI')}</div><h1>{title}</h1><div class="sub">{sub}</div>
<div class="sumbar">{sumline}</div>
<div class="card"><div class="ctitle">{C('四柱命盘','Four Pillars')}</div><div class="pills">{cols}</div></div>
<div class="card"><div class="ctitle">{C('五行分布','Five Elements')} <span style="font-size:19px;color:#a9a488">· {C('水偏弱','Water weak')}</span></div>{bars}</div>
<div class="grid">{cards}</div>
<div class="foot">Runae · {C('传统命理文化参考 · 不构成决策建议','Traditional metaphysics · for reference only')}</div>
</div></body></html>"""
open(out_html,"w").write(html);print("HTML",out_html)
