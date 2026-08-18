#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""个人色彩(韩式四季型) 原型: 真采集肤/发/唇/瞳色 → 判冷暖+深浅+对比 → 季型 + 适合/忌讳色盘 + 妆容
用法: python3 personal_color_prototype.py <脸照>"""
import sys, os, glob, colorsys, statistics
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import mediapipe as mp
from mediapipe.tasks import python as mpy
from mediapipe.tasks.python import vision

FONT="/System/Library/Fonts/PingFang.ttc"
MODEL=os.path.join(os.path.dirname(__file__),"face_landmarker.task")
def F(s):
    try:return ImageFont.truetype(FONT,s)
    except:return ImageFont.load_default()

def patch(arr,cx,cy,r=6):
    h,w=arr.shape[:2]
    x0,x1=max(0,cx-r),min(w,cx+r);y0,y1=max(0,cy-r),min(h,cy+r)
    px=arr[y0:y1,x0:x1].reshape(-1,3)
    if len(px)==0:return None
    return np.median(px,axis=0)

def lab(rgb):
    r,g,b=[c/255 for c in rgb]
    def f(t):return t/12.92 if t<=0.04045 else ((t+0.055)/1.055)**2.4
    r,g,b=f(r),f(g),f(b)
    x=r*.4124+g*.3576+b*.1805;y=r*.2126+g*.7152+b*.0722;z=r*.0193+g*.1192+b*.9505
    xn,yn,zn=.95047,1.0,1.08883
    def g_(t):return t**(1/3) if t>.008856 else 7.787*t+16/116
    fx,fy,fz=g_(x/xn),g_(y/yn),g_(z/zn)
    return (116*fy-16, 500*(fx-fy), 200*(fy-fz))  # L*, a*, b*

SEASON={
 "春 暖亮型":dict(desc="暖调·明亮·清透",best=["#FF9E7A","#FFC15E","#FF6F61","#8FD694","#FFE4B5","#40C4C4","#F5B7A0","#C8E64A"],
   avoid=["#2E2E2E","#5C4B8A","#8A8A8A"],lip="珊瑚橘 / 西柚粉 / 蜜桃橘",blush="蜜桃橘",eye="暖棕/杏金"),
 "夏 冷柔型":dict(desc="冷调·柔和·雾面",best=["#E6A6B8","#C7A6D6","#A9C6E8","#B8B8C4","#D6A6C0","#A6D6C6","#E8C6D6","#9AA6C4"],
   avoid=["#FF7A00","#FFE000","#8A5A2B"],lip="豆沙玫瑰 / 樱花粉 / 藕粉",blush="哑光玫瑰",eye="灰粉/雾紫"),
 "秋 暖深型":dict(desc="暖调·深沉·大地",best=["#C79A2B","#7A7A2E","#B5532B","#C4632B","#8A5A2B","#3E5C3A","#B5892B","#8A2E1E"],
   avoid=["#FF6FCF","#00E0FF","#111111"],lip="枫叶红 / 南瓜橘 / 焦糖棕",blush="砖橘",eye="焦糖/橄榄棕"),
 "冬 冷艳型":dict(desc="冷调·高对比·清冷",best=["#FFFFFF","#111111","#E1122B","#1E3FD6","#C41E8A","#0E8A5A","#E6B7C6","#5A1E8A"],
   avoid=["#C79A6B","#FF9E5A","#B5A68A"],lip="正红 / 玫红 / 梅子色",blush="冷玫红",eye="冷灰/黑棕"),
}

def classify(skin,hair,lipc):
    L,a,b=lab(skin)
    warm = b - 0.5*abs(a)           # b*高=偏黄=暖
    is_warm = warm > 14
    is_light = L > 62
    hairL=lab(hair)[0]
    contrast = L - hairL
    if is_warm and is_light: s="春 暖亮型"
    elif is_warm and not is_light: s="秋 暖深型"
    elif (not is_warm) and is_light and contrast<50: s="夏 冷柔型"
    else: s="冬 冷艳型"
    return s,dict(L=L,a=a,b=b,warm=warm,contrast=contrast,is_warm=is_warm,is_light=is_light)

def hexof(rgb):return "#%02X%02X%02X"%tuple(int(c) for c in rgb)

def main():
    inp=sys.argv[1]
    lm=vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
        base_options=mpy.BaseOptions(model_asset_path=MODEL),num_faces=1))
    img=mp.Image.create_from_file(inp);res=lm.detect(img)
    if not res.face_landmarks:print("NO_FACE");return
    im=Image.open(inp).convert("RGB");arr=np.array(im);w,h=im.size
    P=[(int(p.x*w),int(p.y*h)) for p in res.face_landmarks[0]]
    def S(i):return patch(arr,P[i][0],P[i][1])
    skin=np.median([v for v in [S(50),S(280),S(101),S(330),S(151)] if v is not None],axis=0)
    lipc=np.median([v for v in [S(0),S(17),S(13)] if v is not None],axis=0)
    iris=np.median([v for v in [S(468),S(473)] if v is not None],axis=0)
    # 发色: 取脸最上缘再上移
    ys=[p[1] for p in P];topy=min(ys);cx=P[10][0]
    hair=patch(arr,cx,max(0,topy-int(h*0.04)),r=10)
    if hair is None or lab(hair)[0]>60: hair=[45,35,35]
    season,m=classify(skin,hair,lipc)
    info=SEASON[season]
    print(f"季型: {season}")
    print(f"肤色{hexof(skin)} L*{m['L']:.0f} b*{m['b']:.0f} 暖度{m['warm']:.0f} → {'暖' if m['is_warm'] else '冷'}调·{'浅' if m['is_light'] else '深'}")
    print(f"发色{hexof(hair)} 唇色{hexof(lipc)} 瞳色{hexof(iris)}")

    # 渲染报告卡
    CW=1080;CH=1500;cv=Image.new("RGB",(CW,CH),(245,238,226));d=ImageDraw.Draw(cv)
    d.text((60,50),"个人色彩报告",font=F(72),fill=(90,30,25))
    d.text((60,140),f"Runae · 依你本人照片 · 韩式四季型",font=F(30),fill=(120,90,60))
    # 头像
    fw=max(p[0] for p in P)-min(p[0] for p in P)
    cxc=(min(p[0] for p in P)+max(p[0] for p in P))//2;cyc=(min(ys)+max(ys))//2
    crop=im.crop((max(0,cxc-fw),max(0,cyc-fw),min(w,cxc+fw),min(h,cyc+fw))).resize((360,360))
    cv.paste(crop,(60,200))
    # 季型结论
    d.rounded_rectangle([460,200,1020,560],radius=18,fill=(255,252,246),outline=(200,120,90),width=3)
    d.text((490,230),"你的季型",font=F(30),fill=(150,110,80))
    d.text((490,275),season,font=F(60),fill=(150,30,25))
    d.text((490,360),info["desc"],font=F(34),fill=(90,70,50))
    # 你的颜色
    def swatch(x,y,rgb,label):
        d.rounded_rectangle([x,y,x+70,y+70],radius=10,fill=tuple(int(c) for c in rgb),outline=(120,120,120),width=2)
        d.text((x,y+76),label,font=F(24),fill=(90,70,50))
    d.text((490,430),"采集到的你:",font=F(28),fill=(120,90,60))
    swatch(490,465,skin,"肤");swatch(600,465,hair,"发");swatch(710,465,lipc,"唇");swatch(820,465,iris,"瞳")
    # 适合色盘
    y=620;d.text((60,y),"✓ 你的黄金色盘",font=F(42),fill=(40,120,60))
    for i,hx in enumerate(info["best"]):
        x=60+(i%8)*126;d.rounded_rectangle([x,y+70,x+110,y+180],radius=12,fill=hx,outline=(180,180,180),width=1)
    # 忌讳色
    y=860;d.text((60,y),"✗ 尽量避开",font=F(42),fill=(170,40,40))
    for i,hx in enumerate(info["avoid"]):
        x=60+i*126;d.rounded_rectangle([x,y+70,x+110,y+180],radius=12,fill=hx,outline=(180,180,180),width=1)
    # 妆容
    y=1090;d.rounded_rectangle([60,y,1020,y+280],radius=18,fill=(255,252,246),outline=(200,150,120),width=2)
    d.text((90,y+30),"妆容推荐",font=F(40),fill=(150,30,25))
    d.text((90,y+100),f"口红：{info['lip']}",font=F(34),fill=(80,60,45))
    d.text((90,y+155),f"腮红：{info['blush']}",font=F(34),fill=(80,60,45))
    d.text((90,y+210),f"眼影：{info['eye']}",font=F(34),fill=(80,60,45))
    d.text((60,CH-70),"娱乐/风格参考 · 照片光线会影响判定 · 不作医疗或优劣评价",font=F(26),fill=(150,120,90))
    out=os.path.expanduser("~/projects/shenyuan/samples/个人色彩报告-原型.png")
    cv.save(out,quality=92);print("OUTPUT:",out)

if __name__=="__main__":main()
