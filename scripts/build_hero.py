#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Runae 首页 Hero: 算命先生 + 7项运势 + 全套综合评价入口"""
import os,base64
BASE=os.path.expanduser("~/projects/shenyuan")
master=base64.b64encode(open(os.path.join(BASE,"samples/caijing/master.png"),"rb").read()).decode()
OUT=os.path.join(BASE,"samples/caijing/首页hero-算命先生.html")
aspects=[("💕","姻缘婚恋"),("💼","事业前程"),("💰","财运机遇"),("🌿","健康养生"),
         ("📚","学业考运"),("👶","子女缘分"),("🧭","去留·贵人")]
cards="".join(f'<div class="asp"><span class="ai">{i}</span><span class="an">{n}</span></div>' for i,n in aspects)
html=f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:1440px;height:940px;position:relative;overflow:hidden;font-family:"Songti SC","STSong","Hiragino Sans GB",serif;
 background:radial-gradient(130% 90% at 30% 0%,#241a2e,#140f1e 48%,#08060f 100%);color:#eadfc8}}
.stars{{position:absolute;inset:0;background-image:radial-gradient(1.3px 1.3px at 20% 12%,#fff,transparent),radial-gradient(1.1px 1.1px at 78% 8%,#ffe9b0,transparent),radial-gradient(1px 1px at 60% 18%,#fff,transparent),radial-gradient(1.2px 1.2px at 42% 26%,#cfe0ff,transparent);opacity:.5}}
.top{{position:relative;text-align:center;padding-top:40px;z-index:3}}
.brand{{font-size:24px;letter-spacing:8px;color:#c9a84c}}
.tag{{font-size:34px;margin-top:8px;background:linear-gradient(135deg,#e8d08a,#c9a84c,#f0e4b0);-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:700}}
.stage{{position:absolute;top:150px;left:0;width:100%;height:640px;display:flex;align-items:center;padding:0 70px}}
.masterbox{{position:relative;width:440px;height:600px;flex:0 0 440px}}
.masterbox img{{width:100%;height:100%;object-fit:cover;border-radius:20px;border:3px solid rgba(201,168,76,.5);box-shadow:0 0 60px 10px rgba(201,168,76,.18)}}
.mcap{{position:absolute;bottom:18px;left:0;width:100%;text-align:center;font-size:24px;color:#f0e4b0;text-shadow:0 2px 10px #000;letter-spacing:2px}}
.right{{flex:1;padding-left:60px}}
.rh{{font-size:46px;font-weight:700;color:#f0e4b0;margin-bottom:6px}}
.rs{{font-size:23px;color:#a9a488;margin-bottom:26px}}
.grid{{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}}
.asp{{display:flex;align-items:center;gap:14px;background:rgba(255,255,255,.05);border:1.5px solid rgba(201,168,76,.32);border-radius:16px;padding:20px 22px}}
.ai{{font-size:36px}} .an{{font-size:27px;color:#ecdfc0;font-weight:600}}
.full{{grid-column:1/4;background:linear-gradient(135deg,rgba(201,168,76,.18),rgba(201,168,76,.06));border:2px solid rgba(201,168,76,.6);border-radius:16px;padding:22px 26px;display:flex;align-items:center;gap:18px}}
.full .ai{{font-size:40px}}
.ft{{font-size:29px;color:#f0e4b0;font-weight:700}}
.fs{{font-size:20px;color:#c9bfa2;margin-top:4px}}
.cta{{position:absolute;bottom:46px;width:100%;text-align:center;z-index:3}}
.btn{{display:inline-block;background:linear-gradient(135deg,#e8d08a,#c9a84c);color:#1a1206;font-size:30px;font-weight:700;padding:18px 60px;border-radius:50px;box-shadow:0 8px 26px rgba(201,168,76,.35)}}
.cn{{font-size:21px;color:#9a9078;margin-top:14px}}
</style></head><body>
<div class="stars"></div>
<div class="top"><div class="brand">RUNAE · 汇聚全球占卜智慧</div>
<div class="tag">一个问题，多体系合断</div></div>
<div class="stage">
 <div class="masterbox"><img src="data:image/png;base64,{master}"><div class="mcap">AI 命理宗师 为你解读</div></div>
 <div class="right">
  <div class="rh">你想问什么？</div>
  <div class="rs">选一个方向，AI 用多体系为你合断 · 免费开测</div>
  <div class="grid">{cards}
   <div class="full"><span class="ai">✦</span><div><div class="ft">全套综合评价</div><div class="fs">上传生辰·出生地·面相·手相 → 八字+面手+西占 一次合断（旗舰报告）</div></div></div>
  </div>
 </div>
</div>
<div class="cta"><span class="btn">免费开始 · 输入你的问题</span><div class="cn">八字·紫微·奇门·六壬·塔罗·卢恩·西占·吠陀…&nbsp; 全球体系一个平台</div></div>
</body></html>"""
open(OUT,"w").write(html);print("HTML",OUT)
