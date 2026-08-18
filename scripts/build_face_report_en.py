#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""English Face Reading report: annotated card + reading page (xuan-paper style)"""
import os,base64,io
from PIL import Image
import mediapipe as mp
from mediapipe.tasks import python as mpy
from mediapipe.tasks.python import vision

BASE=os.path.expanduser("~/projects/shenyuan")
FACE=os.path.join(BASE,"samples/caijing/face-clean.jpg")
TPL=os.path.join(BASE,"samples/caijing/mianxiang-template.png")
MODEL=os.path.join(BASE,"scripts/face_landmarker.task")
def b64f(p):return base64.b64encode(open(p,"rb").read()).decode()
tpl_b64=b64f(TPL)

lm=vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
    base_options=mpy.BaseOptions(model_asset_path=MODEL),num_faces=1))
img=mp.Image.create_from_file(FACE);res=lm.detect(img)
im=Image.open(FACE).convert("RGB");W,H=im.size
P=[(p.x*W,p.y*H) for p in res.face_landmarks[0]]
xs=[p[0] for p in P];ys=[p[1] for p in P]
fx0,fx1=min(xs),max(xs);fy0,fy1=min(ys),max(ys);fw=fx1-fx0;fh=fy1-fy0
cx0=max(0,fx0-fw*.28);cx1=min(W,fx1+fw*.28);cy0=max(0,fy0-fh*.42);cy1=min(H,fy1+fh*.30)
crop=im.crop((int(cx0),int(cy0),int(cx1),int(cy1)));cw,ch=crop.size
def rel(pt):return ((pt[0]-cx0)/cw,(pt[1]-cy0)/ch)
def mid(a,b):return ((a[0]+b[0])/2,(a[1]+b[1])/2)
def gp(s):return mid(P[s[0]],P[s[1]]) if isinstance(s,tuple) else P[s]
FW=fw;zones=[]
def add(name,desc,pts,col,rx,ry,side):
    for pt in pts:
        rp=rel(pt);zones.append(dict(name=name,desc=desc,x=rp[0],y=rp[1],rx=FW*rx/cw,ry=FW*ry/ch,col=col,side=side))
add("Life","spirit · Ming Gong",[gp((55,285))],"#d98a8a",.05,.03,"L")
add("Career","forehead · Guan Lu",[gp(151)],"#e0a35a",.12,.05,"R")
add("Parents","temples · Fu Mu",[P[67],P[297]],"#b39560",.05,.04,"R")
add("Fortune","temple · Fu De",[P[54],P[284]],"#93b478",.045,.045,"L")
add("Siblings","brows · Xiong Di",[P[105],P[334]],"#9c86c0",.07,.024,"L")
add("Property","eyelids · Tian Zhai",[P[159],P[386]],"#7fb0d6",.05,.022,"R")
add("Marriage","eye corners · Fu Qi",[P[130],P[359]],"#b58fc0",.045,.032,"L")
add("Children","under-eye · Nan Nv",[P[23],P[253]],"#e6c46e",.05,.024,"R")
add("Health","nose bridge · Ji E",[gp(168)],"#a094d6",.03,.055,"L")
add("Wealth","nose tip · Cai Bo",[gp(4)],"#d6aa66",.05,.05,"R")
add("Travel","brow-temple · Qian Yi",[P[21],P[251]],"#78b39c",.04,.055,"L")
add("Support","cheeks · Nu Pu",[P[135],P[364]],"#d68f9c",.06,.045,"R")

buf=io.BytesIO();crop.save(buf,"JPEG",quality=92);face_b64=base64.b64encode(buf.getvalue()).decode()
labelmap={}
for z in zones:labelmap.setdefault(z["name"],[]).append(z)
CW=1080;FACEW=460;FACEX=(CW-FACEW)//2;FACEY=250;FACEH=int(FACEW*ch/cw)
def px(z):return (FACEX+z["x"]*FACEW,FACEY+z["y"]*FACEH)
ell="";lines="";labels=""
for z in zones:
    ex,ey=px(z);rxp=z["rx"]*FACEW;ryp=z["ry"]*FACEH
    ell+=f'<ellipse cx="{ex:.0f}" cy="{ey:.0f}" rx="{rxp:.0f}" ry="{ryp:.0f}" fill="{z["col"]}" fill-opacity="0.42" stroke="{z["col"]}" stroke-opacity="0.9" stroke-width="2"/>'
names=list(labelmap);L=[n for n in names if labelmap[n][0]["side"]=="L"];R=[n for n in names if labelmap[n][0]["side"]=="R"]
def layout(col,gx,al):
    global lines,labels
    col=sorted(col,key=lambda n:min(px(z)[1] for z in labelmap[n]))
    n=len(col);s0=FACEY-10;sh=(FACEH+20)/max(1,n)
    for i,nm in enumerate(col):
        zs=labelmap[nm];tgt=min(zs,key=lambda z:px(z)[0]) if al=="left" else max(zs,key=lambda z:px(z)[0])
        tx,ty=px(tgt);ly=s0+sh*i+sh/2;bw=250;bx=gx if al=="left" else gx-bw
        labels+=f'<div class="lab" style="left:{bx}px;top:{ly-30:.0f}px;width:{bw}px"><span class="nm">{nm}</span><span class="ds">{zs[0]["desc"]}</span></div>'
        anc=bx+bw if al=="left" else bx
        lines+=f'<line x1="{tx:.0f}" y1="{ty:.0f}" x2="{anc:.0f}" y2="{ly:.0f}" stroke="#8a6a4a" stroke-width="1.5" stroke-dasharray="4,4" opacity="0.75"/>'
layout(L,36,"left");layout(R,CW-36,"right")
CH=FACEY+FACEH+120
card=f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:{CW}px;height:{CH}px;position:relative;overflow:hidden;font-family:"Songti SC","Georgia","Hiragino Sans GB",serif;background:radial-gradient(120% 90% at 50% 0%,#fbf5e6,#f3e8cf 60%,#eaddbf)}}
.bgart{{position:absolute;inset:0;background:url(data:image/png;base64,{tpl_b64}) center/cover;opacity:.13;mix-blend-mode:multiply}}
.title{{position:absolute;top:64px;width:100%;text-align:center;font-size:60px;font-weight:700;color:#5a2f22;letter-spacing:2px}}
.sub{{position:absolute;top:150px;width:100%;text-align:center;font-size:23px;color:#9a6a3a;letter-spacing:2px}}
.seal{{position:absolute;right:66px;top:60px;width:88px;height:88px;border:3px solid #a8321f;border-radius:12px;color:#a8321f;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:700;transform:rotate(-4deg);background:rgba(168,50,31,.05)}}
.face{{position:absolute;left:{FACEX}px;top:{FACEY}px;width:{FACEW}px;height:{FACEH}px;border-radius:16px;object-fit:cover;border:5px solid #fff;box-shadow:0 10px 26px rgba(80,50,20,.22)}}
svg{{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}}
.lab{{position:absolute;background:rgba(255,252,245,.95);border:2px solid #d8b98a;border-radius:12px;padding:7px 12px;box-shadow:0 3px 8px rgba(120,90,40,.12)}}
.lab .nm{{font-size:25px;font-weight:700;color:#5a2f22;margin-right:8px}}
.lab .ds{{font-size:16px;color:#8a6a4a}}
.foot{{position:absolute;bottom:32px;width:100%;text-align:center;font-size:19px;color:#9a8264}}
</style></head><body><div class="bgart"></div>
<div class="title">Face Reading · 12 Palaces</div>
<div class="sub">Runae · from your own photo · Ma Yi physiognomy</div>
<div class="seal">面相</div>
<img class="face" src="data:image/jpeg;base64,{face_b64}">
<svg viewBox="0 0 {CW} {CH}">{lines}{ell}</svg>{labels}
<div class="foot">Runae · Traditional culture · position guide only · not medical or fortune advice</div>
</body></html>"""
open(os.path.join(BASE,"samples/caijing/face-en-card.html"),"w").write(card)

READ=[
("Life","Ming Gong","An open, smooth brow-center — a broad mind that doesn't dwell on small things. Keep it relaxed and your best feature stays."),
("Career","Guan Lu","A full, wide forehead — good career structure and early mentor luck. Suited to work that uses the mind and connects people."),
("Wealth","Cai Bo","A rounded nose tip with contained wings — wealth gathers and holds. Mid-life is your strongest earning phase; steadiness builds it."),
("Marriage","Fu Qi","Smooth outer eye corners — loyal and sincere in love, giving much. Remember to keep some energy for yourself."),
("Property","Tian Zhai","Thin upper lids — home and property built by your own effort, settling in from mid-life. Sentimental, prefers a calm home."),
("Children","Nan Nv","Soft under-eye area — a warm, caring bond with children. Slight puffiness is fatigue, not fate — it recovers with rest."),
("Siblings","Xiong Di","Natural, even brows — good friendships and warmth. Slightly frayed tails: choose a few close friends over many loose ones."),
("Support","Nu Pu","Full lower cheeks — support from juniors and team in later years; a natural people-gatherer, good at leading."),
("Health","Ji E","A straight nose bridge — a solid constitution. Some tiredness around the eyes: earlier nights and eye rest help (wellness, not diagnosis)."),
("Travel","Qian Yi","Open brow-temple area — travel and relocation favor you. Going out beats staying put; opportunities abroad."),
("Fortune","Fu De","Full temples — deep blessings, earned by your own kindness. Contentment and peace of mind in later years."),
("Parents","Fu Mu","Full upper-forehead corners — a strong bond with elders and lifelong mentor luck. Respect and remembrance keep it with you."),
]
cards="".join(f'<div class="c"><div class="ct"><span class="n">{n}</span><span class="p">{p}</span></div><div class="t">{t}</div></div>' for n,p,t in READ)
read=f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:1080px;position:relative;font-family:"Georgia","Songti SC","Hiragino Sans GB",serif;background:radial-gradient(120% 60% at 50% 0%,#fbf5e6,#f3e8cf 60%,#eaddbf);padding:56px 60px 90px}}
.bgart{{position:fixed;inset:0;background:url(data:image/png;base64,{tpl_b64}) center/cover;opacity:.10;mix-blend-mode:multiply}}
.wrap{{position:relative}}
h1{{font-size:56px;font-weight:700;color:#5a2f22;text-align:center}}
.sub{{text-align:center;font-size:22px;color:#9a6a3a;margin:8px 0 34px}}
.seal{{position:absolute;right:0;top:6px;width:80px;height:80px;border:3px solid #a8321f;border-radius:10px;color:#a8321f;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;transform:rotate(-4deg);background:rgba(168,50,31,.05)}}
.grid{{display:grid;grid-template-columns:1fr 1fr;gap:22px}}
.c{{background:rgba(255,252,245,.92);border:2px solid #dcc199;border-radius:16px;padding:20px 22px;box-shadow:0 4px 10px rgba(120,90,40,.10)}}
.ct{{display:flex;align-items:baseline;gap:10px;margin-bottom:8px}}
.n{{font-size:30px;font-weight:700;color:#a8321f}} .p{{font-size:18px;color:#9a6a3a;font-style:italic}}
.t{{font-size:21px;line-height:1.55;color:#4a3628}}
.z{{margin-top:28px;background:linear-gradient(180deg,#fffdf7,#f7ecd7);border:2px solid #d8b98a;border-radius:18px;padding:28px 32px}}
.zt{{font-size:34px;font-weight:700;color:#5a2f22;margin-bottom:10px}} .zz{{font-size:23px;line-height:1.6;color:#4a3628}}
.foot{{text-align:center;font-size:19px;color:#9a8264;margin-top:30px}}
</style></head><body><div class="bgart"></div><div class="wrap">
<div class="seal">面相</div><h1>Your 12 Palaces · In Detail</h1>
<div class="sub">Runae · from your own photo · Ma Yi physiognomy</div>
<div class="grid">{cards}</div>
<div class="z"><div class="zt">A Note from the Reader</div><div class="zz">A face changes with the heart — nothing here is fixed fate. Yours is an open, generous, steadily-rising structure; what matters most is keeping that ease and openness. Do good, be kind to yourself, and a good face only grows brighter.</div></div>
<div class="foot">Runae · Traditional Ma Yi physiognomy · for cultural & self-reflection only · not medical, fortune, or decision advice</div>
</div></body></html>"""
open(os.path.join(BASE,"samples/caijing/face-en-reading.html"),"w").write(read)
print("EN card + reading HTML ready. CARD_CH",CH)
