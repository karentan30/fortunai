#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""面相算命报告·逐宫详批页(宣纸风) -> HTML"""
import os,base64
BASE=os.path.expanduser("~/projects/shenyuan")
TPL=os.path.join(BASE,"samples/caijing/mianxiang-template.png")
OUTH=os.path.join(BASE,"samples/caijing/mianxiang-reading.html")
tpl_b64=base64.b64encode(open(TPL,"rb").read()).decode()

# 逐宫详批(依麻衣体系·仅就可见特征·娱乐参考)
READ=[
 ("命宫","印堂","印堂开阔平润、无竖纹深锁，心胸不窄、遇事不钻牛角尖，精神舒展。守住这份开阔便是好相。"),
 ("官禄宫","额中","额中饱满开阔，事业有格局、早年多得师长提携，宜走用脑统筹、与人打交道之路。"),
 ("财帛宫","鼻准","准头圆润有肉、兰台廷尉收而不塌，财气聚而不漏，中年财运最旺，越沉稳越聚财。"),
 ("夫妻宫","鱼尾","鱼尾平顺、起始浅纹，重情义、认真专一，付出偏多易替对方操心，记得也留心力给自己。"),
 ("田宅宫","上眼睑","眼睑偏薄略垂，家宅不动产靠自己置办，中年后自置根基；念旧心细，居所宜静。"),
 ("男女宫","卧蚕","卧蚕略润，与子女缘分厚、牵挂深。近来略浮多因睡眠不足，休息足自回润。"),
 ("兄弟宫","眉","眉形自然浓淡适中，朋友缘好、待人有情；眉尾稍散，交友宜精不宜滥。"),
 ("奴仆宫","地阁两侧","地阁两侧丰满，晚年有后辈下属之助、得人拥戴，适合带团队、做有人望之事。"),
 ("疾厄宫","山根","山根中等、鼻梁直，体质根基不弱。眼下略倦，宜早睡疏肝、注意用眼休息。"),
 ("迁移宫","额角","额角开润，外出异乡远行之运顺，走出去比守着强，四方皆有可结之缘。"),
 ("福德宫","天仓","天仓饱满，福气厚、享的是自己修来的福；晚年精神富足，宜多近让自己心安之人。"),
 ("父母宫","日月角","日月角饱满，与长辈缘分厚、一生多得贵人相助；懂敬长念旧，贵人运长随。"),
]
cards="".join(
 f'<div class="c"><div class="ct"><span class="n">{n}</span><span class="p">{p}</span></div><div class="t">{t}</div></div>'
 for n,p,t in READ)
html=f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:1080px;position:relative;font-family:"Songti SC","STSong","Hiragino Sans GB","PingFang SC",serif;
 background:radial-gradient(120% 60% at 50% 0%,#fbf5e6,#f3e8cf 60%,#eaddbf);padding:56px 60px 90px}}
.bgart{{position:fixed;inset:0;background:url(data:image/png;base64,{tpl_b64}) center/cover;opacity:.10;mix-blend-mode:multiply;z-index:0}}
.wrap{{position:relative;z-index:1}}
h1{{font-size:66px;font-weight:700;color:#5a2f22;letter-spacing:5px;text-align:center}}
.sub{{text-align:center;font-size:24px;color:#9a6a3a;margin:8px 0 34px;letter-spacing:2px}}
.seal{{position:absolute;right:0;top:6px;width:80px;height:80px;border:3px solid #a8321f;border-radius:10px;color:#a8321f;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;transform:rotate(-4deg);background:rgba(168,50,31,.05)}}
.grid{{display:grid;grid-template-columns:1fr 1fr;gap:22px}}
.c{{background:rgba(255,252,245,.92);border:2px solid #dcc199;border-radius:16px;padding:22px 24px;box-shadow:0 4px 10px rgba(120,90,40,.10)}}
.ct{{display:flex;align-items:baseline;gap:12px;margin-bottom:10px}}
.n{{font-size:34px;font-weight:700;color:#a8321f}}
.p{{font-size:22px;color:#9a6a3a}}
.t{{font-size:25px;line-height:1.62;color:#4a3628}}
.z{{margin-top:30px;background:linear-gradient(180deg,#fffdf7,#f7ecd7);border:2px solid #d8b98a;border-radius:18px;padding:30px 34px}}
.zt{{font-size:38px;font-weight:700;color:#5a2f22;margin-bottom:12px}}
.zz{{font-size:26px;line-height:1.66;color:#4a3628}}
.foot{{text-align:center;font-size:21px;color:#9a8264;margin-top:34px}}
</style></head><body><div class="bgart"></div><div class="wrap">
<div class="seal">详批</div>
<h1>面相 · 十二宫详批</h1>
<div class="sub">Runae · 依你本人照片 · 麻衣神相体系</div>
<div class="grid">{cards}</div>
<div class="z"><div class="zt">相师叮嘱</div><div class="zz">面相随心性而变，非一成不变的定数。你本是开阔、丰厚、越走越稳的好格局，最要守的就是那份从容与开阔——印堂莫锁、心事莫积、身子莫熬。积善修德、善待自己，相由心生，好相自会越养越亮。</div></div>
<div class="foot">Runae · 传统麻衣神相文化解读 · 仅供文化娱乐与自我观照参考 · 不构成医疗/命运/决策建议</div>
</div></body></html>"""
open(OUTH,"w").write(html);print("HTML",OUTH)
