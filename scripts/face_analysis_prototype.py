#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
面部分析原型 (Tasks API · 478关键点)
输出两张图:
  1) 黄金比例 phi-mask: 中线/瞳孔线/三停线/三角 + 逐项比例 + 综合吻合度%
  2) 面相十二宫: 彩色分区+标签(宣纸风)
用法: python3 face_analysis_prototype.py [输入图]
  不给输入图 → 只在"微信传来的照片(webwxgetmsgimg)"里挑有人脸的那张(=你的自拍)
"""
import sys, glob, os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import mediapipe as mp
from mediapipe.tasks import python as mpy
from mediapipe.tasks.python import vision

FONT="/System/Library/Fonts/PingFang.ttc"
MODEL=os.path.join(os.path.dirname(__file__),"face_landmarker.task")
def F(s):
    try:return ImageFont.truetype(FONT,s)
    except Exception:return ImageFont.load_default()

def landmarker():
    o=vision.FaceLandmarkerOptions(base_options=mpy.BaseOptions(model_asset_path=MODEL),num_faces=1)
    return vision.FaceLandmarker.create_from_options(o)

def pts_of(path,lm):
    img=mp.Image.create_from_file(path)
    r=lm.detect(img)
    if not r.face_landmarks:return None,None
    im=Image.open(path).convert("RGB");w,h=im.size
    P=[(p.x*w,p.y*h) for p in r.face_landmarks[0]]
    return im,P

def find_selfie(lm):
    c=[]
    for d in ["/Users/karen/Documents","/Users/karen/Downloads"]:
        for e in ("*.jpeg","*.jpg","*.png"):c+=glob.glob(os.path.join(d,e))
    c=[x for x in c if "webwxgetmsgimg" in x or "mmwebwx" in x]   # 只认微信传来的
    c.sort(key=os.path.getmtime,reverse=True)
    best=None;ba=0
    for x in c[:20]:
        im,P=pts_of(x,lm)
        if P:
            xs=[p[0] for p in P];a=max(xs)-min(xs)
            if a>ba:ba=a;best=x
    return best

def D(a,b):return math.hypot(a[0]-b[0],a[1]-b[1])
def mid(a,b):return ((a[0]+b[0])/2,(a[1]+b[1])/2)

def golden(im,P,out):
    d=ImageDraw.Draw(im,"RGBA")
    # 关键点
    top=P[10]; chin=P[152]; leftF=P[234]; rightF=P[454]
    browL=P[105]; browR=P[334]; brow=mid(browL,browR)
    eyeLo=P[33]; eyeLi=P[133]; eyeRo=P[263]; eyeRi=P[362]
    noseTip=P[4]; noseBase=P[2]; alL=P[48]; alR=P[278]
    mL=P[61]; mR=P[291]; mTop=P[0]; mBot=P[17]; mCen=mid(mTop,mBot)
    faceW=D(leftF,rightF); faceL=D(top,chin)
    eyeW=D(eyeLo,eyeLi)
    # 逐项比例(实测/理想)
    items=[]
    def add(name,val,ideal):
        dev=abs(val/ideal-1); sc=max(0,1-dev/0.5)*100  # 偏离50%=0分
        items.append((name,val,ideal,sc))
    add("脸长:脸宽(φ)", faceL/faceW, 1.618)
    t1=abs(brow[1]-top[1]);t2=abs(noseBase[1]-brow[1]);t3=abs(chin[1]-noseBase[1])
    add("三停 上:中", t1/t2, 1.0); add("三停 中:下", t2/t3, 1.0)
    add("五眼(脸宽/眼宽)", faceW/eyeW, 5.0)
    add("眼间距/眼宽", D(eyeLi,eyeRi)/eyeW, 1.0)
    add("口宽/鼻宽", D(mL,mR)/D(alL,alR), 1.618)
    add("鼻底唇:唇颏", D(noseBase,mCen)/D(mCen,chin), 0.618)
    overall=sum(s for *_,s in items)/len(items)
    # 画中线/横线/三角
    midx=(top[0]+chin[0])/2
    d.line([(midx,top[1]),(midx,chin[1])],fill=(60,60,180,200),width=2)
    eyeY=(eyeLi[1]+eyeRi[1])/2
    d.line([(leftF[0],eyeY),(rightF[0],eyeY)],fill=(200,60,60,160),width=2)
    for y in (brow[1],noseBase[1]):
        d.line([(leftF[0],y),(rightF[0],y)],fill=(200,60,60,110),width=1)
    def tri(a,b,c,col):d.polygon([a,b,c],outline=col,width=2)
    tri(browL,browR,noseTip,(60,60,180,220))
    tri(alL,alR,mCen,(60,60,180,220))
    tri(mL,mR,chin,(60,60,180,220))
    d.line([eyeLo,eyeLi],fill=(200,60,60,220),width=2);d.line([eyeRo,eyeRi],fill=(200,60,60,220),width=2)
    d.line([mL,mR],fill=(200,60,60,200),width=2)
    return items,overall

def frame_and_save(im,title,sub,out,extra=None):
    W,H=im.size;pad=int(W*0.06);tp=int(H*0.14);bt=int(H*0.30 if extra else H*0.10)
    cv=Image.new("RGB",(W+pad*2,H+tp+bt),(244,236,220));cv.paste(im,(pad,tp))
    d=ImageDraw.Draw(cv)
    tf=F(int(W*0.085));tb=d.textbbox((0,0),title,font=tf);d.text(((cv.width-(tb[2]-tb[0]))//2,int(tp*0.22)),title,font=tf,fill=(90,30,25))
    sf=F(int(W*0.033));sb=d.textbbox((0,0),sub,font=sf);d.text(((cv.width-(sb[2]-sb[0]))//2,int(tp*0.66)),sub,font=sf,fill=(120,90,60))
    if extra:
        y=H+tp+int(bt*0.06);ef=F(int(W*0.032))
        for line,col in extra:
            d.text((pad,y),line,font=ef,fill=col);y+=int(W*0.045)
    df=F(int(W*0.026));dis="传统/娱乐参考 · 比例为示意近似 · 不作医疗或颜值优劣判断"
    db=d.textbbox((0,0),dis,font=df);d.text(((cv.width-(db[2]-db[0]))//2,cv.height-int(bt*0.16 if not extra else 0.06*bt)-30),dis,font=df,fill=(150,120,90))
    cv.save(out,quality=92);return out

# ---- 十二宫 ----
PAL=[("命宫",(214,102,102),[("mid",55,285)],(0.055,0.030)),("官禄宫",(230,150,90),[151],(0.11,0.055)),
("父母宫",(170,140,95),[67,297],(0.05,0.04)),("福德宫",(120,160,100),[54,284],(0.045,0.045)),
("兄弟宫",(150,120,180),[105,334],(0.06,0.022)),("田宅宫",(120,160,195),[159,386],(0.045,0.020)),
("夫妻宫",(170,135,195),[130,359],(0.04,0.03)),("男女宫",(215,190,110),[23,253],(0.05,0.022)),
("疾厄宫",(150,140,205),[168],(0.03,0.05)),("财帛宫",(205,170,100),[4],(0.045,0.045)),
("迁移宫",(120,175,155),[21,251],(0.04,0.05)),("奴仆宫",(210,140,155),[135,364],(0.06,0.045))]
def gp(P,s):
    if isinstance(s,tuple)and s[0]=="mid":a,b=P[s[1]],P[s[2]];return((a[0]+b[0])/2,(a[1]+b[1])/2)
    return P[s]
def palaces(im,P):
    ov=Image.new("RGBA",im.size,(0,0,0,0));d=ImageDraw.Draw(ov)
    xs=[p[0] for p in P];fw=max(xs)-min(xs)
    for name,rgb,specs,(rxf,ryf) in PAL:
        rx=max(8,int(fw*rxf));ry=max(6,int(fw*ryf))
        for sp in specs:
            cx,cy=gp(P,sp)
            d.ellipse([cx-rx,cy-ry,cx+rx,cy+ry],fill=rgb+(85,),outline=rgb+(190,),width=2)
            f=F(max(18,int(fw*0.045)));tb=d.textbbox((0,0),name,font=f);tw=tb[2]-tb[0];th=tb[3]-tb[1]
            lx=cx-tw/2;ly=cy-th/2
            d.rounded_rectangle([lx-5,ly-3,lx+tw+5,ly+th+5],radius=5,fill=(255,252,245,225),outline=rgb+(230,),width=2)
            d.text((lx,ly),name,font=f,fill=(70,50,40,255))
    return Image.alpha_composite(im.convert("RGBA"),ov).convert("RGB")

def main():
    lm=landmarker()
    inp=sys.argv[1] if len(sys.argv)>1 else find_selfie(lm)
    if not inp:print("NO_SELFIE_FOUND");return
    print("使用照片:",inp)
    im,P=pts_of(inp,lm)
    if not P:print("NO_FACE");return
    outdir=os.path.expanduser("~/projects/shenyuan/samples");os.makedirs(outdir,exist_ok=True)
    # 黄金比例
    g=im.copy();items,overall=golden(g,P,None)
    extra=[(f"综合黄金比例吻合度  ≈ {overall:.1f}%   (参照:Amber Heard 91.85%)",(150,30,25))]
    for n,v,i,s in items:extra.append((f"· {n}: 实测{v:.2f} / 理想{i:.2f}  → {s:.0f}分",(90,70,50)))
    o1=frame_and_save(g,"面部黄金比例分析",f"Runae · 依你本人照片 · phi 比例示意",os.path.join(outdir,"黄金比例-标注-原型.png"),extra)
    print("OUTPUT1:",o1)
    print(f"综合吻合度≈{overall:.1f}%")
    for n,v,i,s in items:print(f"  {n}: {v:.2f} (理想{i}) {s:.0f}分")
    # 十二宫
    p=palaces(im.copy(),P)
    o2=frame_and_save(p,"面相十二宫位置图","Runae · 依你本人照片 · 麻衣通行十二宫示意",os.path.join(outdir,"面相十二宫-标注-原型.png"))
    print("OUTPUT2:",o2)

if __name__=="__main__":main()
