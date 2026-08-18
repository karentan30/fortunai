#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 彩镜·个人色彩报告 HTML(设计师级·宣纸风) -> 供Chrome无头渲染成图"""
import base64, os, sys

FACE = os.path.expanduser("~/projects/shenyuan/samples/caijing/face.jpg")
OUT_HTML = os.path.expanduser("~/projects/shenyuan/samples/caijing/color-report.html")

# --- 采集数据(来自color原型) ---
season = "冬 · 冷艳型"
desc = "冷调 · 高对比 · 清冷透亮"
mine = [("肤","#AC7F70"),("发","#A38063"),("唇","#7E4038"),("瞳","#191313")]
best = [("纯白","#FFFFFF"),("墨黑","#111111"),("正红","#E1122B"),("宝蓝","#1E3FD6"),
        ("品红","#C41E8A"),("祖母绿","#0E8A5A"),("冰粉","#E6B7C6"),("紫罗兰","#5A1E8A")]
avoid = [("驼色","#C79A6B"),("暖橙","#FF9E5A"),("灰卡其","#B5A68A")]
makeup = [("口红","正红 · 玫红 · 梅子色"),("腮红","冷玫红"),("眼影","冷灰 · 黑棕")]

b64 = base64.b64encode(open(FACE,"rb").read()).decode()

def sw(items, big=False):
    s=""
    for name,hx in items:
        s+=f'<div class="sw"><div class="chip{" big" if big else ""}" style="background:{hx}"></div><div class="swn">{name}</div></div>'
    return s

html=f"""<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8">
<style>
:root{{--ink:#3a2a20;--gold:#a9803f;--red:#a8321f;}}
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:1080px;height:1740px;font-family:"Songti SC","STSong","Hiragino Sans GB","PingFang SC",serif;
 background:
  radial-gradient(120% 80% at 15% 0%, #fbf5e6 0%, #f4ead2 55%, #efe2c6 100%);
 color:var(--ink);position:relative;overflow:hidden}}
.paper{{position:absolute;inset:0;background-image:
  repeating-linear-gradient(0deg,rgba(120,90,50,.020) 0 2px,transparent 2px 4px);pointer-events:none}}
.wash{{position:absolute;right:-90px;top:-70px;width:420px;height:420px;border-radius:50%;
 background:radial-gradient(circle,rgba(120,110,90,.13),transparent 70%);filter:blur(6px)}}
.wash2{{position:absolute;left:-120px;bottom:-120px;width:380px;height:380px;border-radius:50%;
 background:radial-gradient(circle,rgba(120,110,90,.10),transparent 70%);filter:blur(6px)}}
.wrap{{position:relative;padding:64px 70px}}
.brand{{font-size:26px;letter-spacing:6px;color:var(--gold)}}
h1{{font-size:78px;font-weight:700;letter-spacing:4px;margin:6px 0 2px;color:#4a2f22}}
.rule{{width:120px;height:4px;background:linear-gradient(90deg,var(--red),var(--gold));border-radius:3px;margin:14px 0 30px}}
.seal{{position:absolute;right:70px;top:64px;width:96px;height:96px;border:3px solid var(--red);border-radius:12px;
 color:var(--red);display:flex;align-items:center;justify-content:center;font-size:34px;line-height:1.05;
 text-align:center;transform:rotate(-4deg);background:rgba(168,50,31,.05);font-weight:700}}
.hero{{display:flex;gap:34px;align-items:stretch;margin-bottom:34px}}
.photo{{width:330px;height:400px;border-radius:20px;object-fit:cover;border:6px solid #fff;
 box-shadow:0 14px 34px rgba(80,50,20,.22)}}
.card{{flex:1;background:linear-gradient(180deg,#fffdf7,#fbf3e2);border:2px solid #e7d3ab;border-radius:22px;
 padding:34px 36px;box-shadow:0 10px 26px rgba(120,90,40,.10)}}
.klabel{{font-size:26px;color:var(--gold);letter-spacing:3px}}
.season{{font-size:66px;font-weight:700;color:var(--red);margin:6px 0 8px}}
.desc{{font-size:30px;color:#6a4f3a;margin-bottom:26px}}
.mine{{display:flex;gap:26px;margin-top:8px}}
.sw{{text-align:center}}
.chip{{width:66px;height:66px;border-radius:14px;border:2px solid rgba(0,0,0,.12);
 box-shadow:0 4px 10px rgba(0,0,0,.12)}}
.chip.big{{width:100px;height:108px;border-radius:16px}}
.swn{{font-size:22px;margin-top:8px;color:#6a4f3a}}
.sec{{margin-top:8px}}
.sect{{font-size:40px;font-weight:700;margin:26px 0 18px;display:flex;align-items:center;gap:14px}}
.good{{color:#2f7a4a}} .bad{{color:#a8321f}}
.grid{{display:flex;gap:22px;flex-wrap:wrap}}
.mk{{background:linear-gradient(180deg,#fffdf7,#faf1de);border:2px solid #e7d3ab;border-radius:20px;
 padding:28px 34px;margin-top:24px}}
.mkrow{{font-size:30px;color:#5a4231;margin:10px 0}}
.mkrow b{{color:var(--red);font-weight:700;margin-right:12px}}
.foot{{position:absolute;left:0;bottom:34px;width:100%;text-align:center;font-size:22px;color:#9a8264}}
</style></head><body>
<div class="paper"></div><div class="wash"></div><div class="wash2"></div>
<div class="wrap">
 <div class="seal">彩镜<br>冬型</div>
 <div class="brand">彩镜 · COLOR MIRROR</div>
 <h1>个人色彩报告</h1><div class="rule"></div>
 <div class="hero">
  <img class="photo" src="data:image/jpeg;base64,{b64}">
  <div class="card">
    <div class="klabel">你的季型</div>
    <div class="season">{season}</div>
    <div class="desc">{desc}</div>
    <div class="klabel">采集到的你</div>
    <div class="mine">{sw(mine)}</div>
  </div>
 </div>
 <div class="sec">
   <div class="sect good">✦ 你的黄金色盘</div>
   <div class="grid">{sw(best,big=True)}</div>
 </div>
 <div class="sec">
   <div class="sect bad">✕ 尽量避开</div>
   <div class="grid">{sw(avoid,big=True)}</div>
 </div>
 <div class="mk">
   <div class="sect" style="margin-top:0;color:#4a2f22">妆容推荐</div>
   {''.join(f'<div class="mkrow"><b>{k}</b>{v}</div>' for k,v in makeup)}
 </div>
</div>
<div class="foot">彩镜 Color Mirror · 娱乐/风格参考 · 照片光线会影响判定 · 不作医疗或优劣评价</div>
</body></html>"""
open(OUT_HTML,"w").write(html)
print("HTML:",OUT_HTML)
