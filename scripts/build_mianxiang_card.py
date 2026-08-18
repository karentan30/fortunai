#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""面相十二宫卡: 脸(tight crop)+精准宫位色区+引线标签+山水宣纸底 -> HTML(供Chrome渲染)"""
import os,base64,json
import numpy as np
from PIL import Image
import mediapipe as mp
from mediapipe.tasks import python as mpy
from mediapipe.tasks.python import vision

BASE=os.path.expanduser("~/projects/shenyuan")
FACE=os.path.join(BASE,"samples/caijing/face-clean.jpg")
TPL=os.path.join(BASE,"samples/caijing/mianxiang-template.png")
MODEL=os.path.join(BASE,"scripts/face_landmarker.task")
OUTH=os.path.join(BASE,"samples/caijing/mianxiang-card.html")

lm=vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
    base_options=mpy.BaseOptions(model_asset_path=MODEL),num_faces=1))
img=mp.Image.create_from_file(FACE);res=lm.detect(img)
im=Image.open(FACE).convert("RGB");W,H=im.size
P=[(p.x*W,p.y*H) for p in res.face_landmarks[0]]
xs=[p[0] for p in P];ys=[p[1] for p in P]
# tight crop 带留白
fx0,fx1=min(xs),max(xs);fy0,fy1=min(ys),max(ys);fw=fx1-fx0;fh=fy1-fy0
cx0=max(0,fx0-fw*0.28);cx1=min(W,fx1+fw*0.28)
cy0=max(0,fy0-fh*0.42);cy1=min(H,fy1+fh*0.30)
crop=im.crop((int(cx0),int(cy0),int(cx1),int(cy1)))
cw,ch=crop.size
def rel(pt):return ((pt[0]-cx0)/cw,(pt[1]-cy0)/ch)  # 0-1 相对裁剪
def mid(a,b):return ((a[0]+b[0])/2,(a[1]+b[1])/2)
def gp(spec):
    if isinstance(spec,tuple):return mid(P[spec[0]],P[spec[1]])
    return P[spec]
# 十二宫色区
FW=fw
zones=[]
def add(name,desc,pts,col,rx,ry,side):
    for pt in pts:
        rxpx=FW*rx; rypx=FW*ry
        rp=rel(pt)
        zones.append(dict(name=name,desc=desc,x=rp[0],y=rp[1],rx=rxpx/cw,ry=rypx/ch,col=col,side=side))
add("命宫","印堂·精神",[gp((55,285))],"#d98a8a",.05,.03,"L")
add("官禄宫","额中·事业",[gp(151)],"#e0a35a",.12,.05,"R")
add("父母宫","日月角·长辈",[P[67],P[297]],"#b39560",.05,.04,"R")
add("福德宫","天仓·福气",[P[54],P[284]],"#93b478",.045,.045,"L")
add("兄弟宫","眉·社交",[P[105],P[334]],"#9c86c0",.07,.024,"L")
add("田宅宫","眼睑·家宅",[P[159],P[386]],"#7fb0d6",.05,.022,"R")
add("夫妻宫","鱼尾·姻缘",[P[130],P[359]],"#b58fc0",.045,.032,"L")
add("男女宫","卧蚕·子女",[P[23],P[253]],"#e6c46e",.05,.024,"R")
add("疾厄宫","山根·气色",[gp(168)],"#a094d6",.03,.055,"L")
add("财帛宫","鼻头·财运",[gp(4)],"#d6aa66",.05,.05,"R")
add("迁移宫","额角·外出",[P[21],P[251]],"#78b39c",.04,.055,"L")
add("奴仆宫","颧下·助力",[P[135],P[364]],"#d68f9c",.06,.045,"R")

def b64(p):return base64.b64encode(open(p,"rb").read()).decode()
face_b64=b64(FACE) if False else base64.b64encode(crop_bytes:=__import__("io").BytesIO() or b"").decode() if False else None
import io
buf=io.BytesIO();crop.save(buf,"JPEG",quality=92);face_b64=base64.b64encode(buf.getvalue()).decode()
tpl_b64=b64(TPL)

# 标签去重(dual宫合并成一个标签,指向靠外那个点)
labelmap={}
for z in zones:
    labelmap.setdefault(z["name"],[]).append(z)
# 布局: 脸放中间(faceX..faceX+faceW), 左右gutter放标签
CW=1080; FACEW=460; FACEX=(CW-FACEW)//2; FACEY=250; FACEH=int(FACEW*ch/cw)
def px(z):return (FACEX+z["x"]*FACEW, FACEY+z["y"]*FACEH)
ell="";lines="";labels=""
for z in zones:
    ex,ey=px(z); rxp=z["rx"]*FACEW; ryp=z["ry"]*FACEH
    ell+=f'<ellipse cx="{ex:.0f}" cy="{ey:.0f}" rx="{rxp:.0f}" ry="{ryp:.0f}" fill="{z["col"]}" fill-opacity="0.42" stroke="{z["col"]}" stroke-opacity="0.9" stroke-width="2"/>'
# 每个宫一个标签(取该宫最外侧点)
names=list(labelmap.keys())
left=[n for n in names if labelmap[n][0]["side"]=="L"]
right=[n for n in names if labelmap[n][0]["side"]=="R"]
def layout(col_names,gutter_x,align):
    global lines,labels
    col=sorted(col_names,key=lambda n:min(px(z)[1] for z in labelmap[n]))
    n=len(col); slot0=FACEY-10; slotH=(FACEH+20)/max(1,n)
    for i,nm in enumerate(col):
        zs=labelmap[nm]
        # 目标点=最外侧(x最小/最大)
        tgt=min(zs,key=lambda z:px(z)[0]) if align=="left" else max(zs,key=lambda z:px(z)[0])
        tx,ty=px(tgt)
        ly=slot0+slotH*i+slotH/2
        lx=gutter_x
        boxw=230
        bx=lx if align=="left" else lx-boxw
        labels+=(f'<div class="lab {align}" style="left:{bx}px;top:{ly-30:.0f}px;width:{boxw}px">'
                 f'<span class="nm">{nm}</span><span class="ds">{zs[0]["desc"]}</span></div>')
        anchor_x=lx+boxw if align=="left" else lx-boxw
        anchor_x=(bx+boxw) if align=="left" else bx
        lines+=f'<line x1="{tx:.0f}" y1="{ty:.0f}" x2="{anchor_x:.0f}" y2="{ly:.0f}" stroke="#8a6a4a" stroke-width="1.5" stroke-dasharray="4,4" opacity="0.75"/>'
layout(left,40,"left")
layout(right,CW-40,"right")
CH=FACEY+FACEH+120
html=f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:{CW}px;height:{CH}px;position:relative;overflow:hidden;
 font-family:"Songti SC","STSong","Hiragino Sans GB","PingFang SC",serif;
 background:radial-gradient(120% 90% at 50% 0%,#fbf5e6,#f3e8cf 60%,#eaddbf)}}
.bgart{{position:absolute;inset:0;background:url(data:image/png;base64,{tpl_b64}) center/cover;opacity:.13;mix-blend-mode:multiply}}
.title{{position:absolute;top:60px;width:100%;text-align:center;font-size:74px;font-weight:700;color:#5a2f22;letter-spacing:6px}}
.sub{{position:absolute;top:158px;width:100%;text-align:center;font-size:26px;color:#9a6a3a;letter-spacing:3px}}
.seal{{position:absolute;right:70px;top:60px;width:88px;height:88px;border:3px solid #a8321f;border-radius:12px;color:#a8321f;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:700;transform:rotate(-4deg);background:rgba(168,50,31,.05)}}
.face{{position:absolute;left:{FACEX}px;top:{FACEY}px;width:{FACEW}px;height:{FACEH}px;border-radius:16px;object-fit:cover;border:5px solid #fff;box-shadow:0 10px 26px rgba(80,50,20,.22)}}
svg{{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}}
.lab{{position:absolute;background:rgba(255,252,245,.95);border:2px solid #d8b98a;border-radius:12px;padding:8px 12px;box-shadow:0 3px 8px rgba(120,90,40,.12)}}
.lab .nm{{font-size:27px;font-weight:700;color:#5a2f22;margin-right:8px}}
.lab .ds{{font-size:19px;color:#8a6a4a}}
.foot{{position:absolute;bottom:34px;width:100%;text-align:center;font-size:21px;color:#9a8264}}
</style></head><body>
<div class="bgart"></div>
<div class="title">面相十二宫</div>
<div class="sub">Runae · 依你本人照片 · 麻衣通行十二宫位置</div>
<div class="seal">面相</div>
<img class="face" src="data:image/jpeg;base64,{face_b64}">
<svg viewBox="0 0 {CW} {CH}">{lines}{ell}</svg>
{labels}
<div class="foot">Runae · 传统文化科普 · 仅作位置示意 · 不作医疗或命运判断</div>
</body></html>"""
open(OUTH,"w").write(html)
print("HTML",OUTH,"CH",CH)
