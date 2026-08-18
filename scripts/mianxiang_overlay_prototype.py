#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
面相十二宫标注 原型
- MediaPipe Face Mesh (468点) 定位五官
- 把十二宫映射到关键点，画彩色半透明分区+标签
- 宣纸风格外框 + 标题 + 免责
用法: python3 mianxiang_overlay_prototype.py [输入图] [输出图]
不给输入图时，自动在候选目录里找"有人脸"的那张(=自拍，手相/物件图无脸自动跳过)
"""
import sys, glob, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import mediapipe as mp

CJK_FONT = "/System/Library/Fonts/PingFang.ttc"
def font(sz):
    try: return ImageFont.truetype(CJK_FONT, sz)
    except Exception: return ImageFont.load_default()

# 十二宫: 名称, 颜色RGB, mediapipe关键点(单点或[左,右]双点), 椭圆半径(占脸宽比例:rx,ry), 标签说明
PALACES = [
    ("命宫",  (214,102,102), [("mid",55,285)], (0.055,0.030), "两眉之间·精神"),
    ("官禄宫",(230,150,90),  [151],            (0.11,0.055), "额中·事业前程"),
    ("父母宫",(170,140,95),  [67,297],         (0.05,0.04),  "日月角·长辈缘"),
    ("福德宫",(120,160,100), [54,284],         (0.045,0.045),"天仓·福气松弛"),
    ("兄弟宫",(150,120,180), [105,334],        (0.06,0.022), "眉·社交精神"),
    ("田宅宫",(120,160,195), [159,386],        (0.045,0.020),"上眼睑·稳定感"),
    ("夫妻宫",(170,135,195), [130,359],        (0.04,0.03),  "眼尾奸门·感情"),
    ("男女宫",(215,190,110), [23,253],         (0.05,0.022), "卧蚕·子女缘"),
    ("疾厄宫",(150,140,205), [168],            (0.03,0.05),  "山根·疲劳睡眠"),
    ("财帛宫",(205,170,100), [4],              (0.045,0.045),"鼻头·财富中气"),
    ("迁移宫",(120,175,155), [21,251],         (0.04,0.05),  "额角太阳穴·外出"),
    ("奴仆宫",(210,140,155), [135,364],        (0.06,0.045), "颧下两颊·助力"),
]

def get_landmarks(rgb):
    with mp.solutions.face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1,
                                         refine_landmarks=True, min_detection_confidence=0.4) as fm:
        res = fm.process(rgb)
    if not res.multi_face_landmarks: return None
    h, w = rgb.shape[:2]
    lm = res.multi_face_landmarks[0].landmark
    return [(int(p.x*w), int(p.y*h)) for p in lm]

def pt(pts, spec):
    if isinstance(spec, tuple) and spec[0]=="mid":
        a,b = pts[spec[1]], pts[spec[2]]
        return ((a[0]+b[0])//2,(a[1]+b[1])//2)
    return pts[spec]

def find_face_image():
    cands = []
    for d in [os.path.expanduser("~/Documents"), os.path.expanduser("~/Downloads")]:
        cands += glob.glob(os.path.join(d,"*.jpeg")) + glob.glob(os.path.join(d,"*.jpg")) + glob.glob(os.path.join(d,"*.png"))
    # 只看近1天的·排除已知参考卡/小红书图
    cands = [c for c in cands if "面相十二宫" not in c and "小红书" not in c and "心理学" not in c and "古典舞" not in c]
    cands.sort(key=lambda c: os.path.getmtime(c), reverse=True)
    best=None; best_area=0
    for c in cands[:15]:
        try:
            im = Image.open(c).convert("RGB"); arr=np.array(im)
        except Exception: continue
        pts = get_landmarks(arr)
        if pts:
            xs=[p[0] for p in pts]; area=(max(xs)-min(xs))
            if area>best_area: best_area=area; best=c
    return best

def main():
    inp = sys.argv[1] if len(sys.argv)>1 else find_face_image()
    if not inp or not os.path.exists(inp):
        print("NO_FACE_IMAGE_FOUND"); return
    print("使用照片:", inp)
    out = sys.argv[2] if len(sys.argv)>2 else os.path.expanduser("~/projects/shenyuan/samples/面相十二宫-标注-原型.png")
    im = Image.open(inp).convert("RGB")
    arr = np.array(im)
    pts = get_landmarks(arr)
    if not pts: print("NO_FACE_IN_INPUT"); return

    W,H = im.size
    xs=[p[0] for p in pts]; face_w = max(xs)-min(xs)

    # 宣纸外框: 上留标题, 下留免责
    pad_x=int(W*0.06); top=int(H*0.16); bot=int(H*0.12)
    CW,CH = W+pad_x*2, H+top+bot
    canvas = Image.new("RGB",(CW,CH),(244,236,220))
    canvas.paste(im,(pad_x,top))

    overlay = Image.new("RGBA",(CW,CH),(0,0,0,0))
    od = ImageDraw.Draw(overlay)
    def C(p): return (p[0]+pad_x, p[1]+top)  # 照片坐标→画布坐标

    for name,rgb,specs,(rxf,ryf),desc in PALACES:
        rx=max(8,int(face_w*rxf)); ry=max(6,int(face_w*ryf))
        for sp in specs:
            cx,cy = C(pt(pts,sp))
            od.ellipse([cx-rx,cy-ry,cx+rx,cy+ry], fill=rgb+(90,), outline=rgb+(190,), width=2)
            # 标签
            f=font(max(20,int(face_w*0.05)))
            tb=od.textbbox((0,0),name,font=f); tw=tb[2]-tb[0]; th=tb[3]-tb[1]
            lx=cx-tw//2; ly=cy-th//2
            od.rounded_rectangle([lx-6,ly-4,lx+tw+6,ly+th+6],radius=6,fill=(255,252,245,230),outline=rgb+(230,),width=2)
            od.text((lx,ly),name,font=f,fill=(70,50,40,255))

    canvas = Image.alpha_composite(canvas.convert("RGBA"),overlay).convert("RGB")
    d=ImageDraw.Draw(canvas)
    # 标题
    tf=font(int(W*0.09)); title="面相十二宫位置图"
    tb=d.textbbox((0,0),title,font=tf); d.text(((CW-(tb[2]-tb[0]))//2,int(top*0.28)),title,font=tf,fill=(90,30,25))
    sf=font(int(W*0.035)); sub="Runae · 依你本人照片 · 麻衣通行十二宫位置示意"
    sb=d.textbbox((0,0),sub,font=sf); d.text(((CW-(sb[2]-sb[0]))//2,int(top*0.72)),sub,font=sf,fill=(120,90,60))
    # 免责
    df=font(int(W*0.028)); dis="传统文化科普 · 仅作位置示意 · 不作医疗/命运判断"
    db=d.textbbox((0,0),dis,font=df); d.text(((CW-(db[2]-db[0]))//2,CH-int(bot*0.6)),dis,font=df,fill=(140,110,80))

    os.makedirs(os.path.dirname(out),exist_ok=True)
    canvas.save(out,quality=92)
    print("OUTPUT:", out, canvas.size)

if __name__=="__main__":
    main()
