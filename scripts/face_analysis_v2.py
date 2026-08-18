#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
面部分析 v2 — 小红书风格
输出:
  1) 面相十二宫-v2.png  — 宣纸风·大椭圆色块+虚线引标签
  2) 黄金比例-v2.png    — 正脸比例线+右侧评分面板
用法: python3 face_analysis_v2.py [输入图]
"""
import sys, glob, os, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import mediapipe as mp
from mediapipe.tasks import python as mpy
from mediapipe.tasks.python import vision

# ── Fonts ──
FONT_PINGFANG = "/System/Library/AssetsV2/com_apple_MobileAsset_Font8/86ba2c91f017a3749571a82f2c6d890ac7ffb2fb.asset/AssetData/PingFang.ttc"
FONT_SONGTI   = "/System/Library/Fonts/Supplemental/Songti.ttc"
FONT_HEITI    = "/System/Library/Fonts/STHeiti Medium.ttc"
MODEL  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "face_landmarker.task")
OUTDIR = os.path.expanduser("~/projects/shenyuan/samples")

def F(size):
    """PingFang SC Regular"""
    for path, idx in [(FONT_PINGFANG, 6), (FONT_HEITI, 0)]:
        try: return ImageFont.truetype(path, size, index=idx)
        except: pass
    return ImageFont.load_default()

def Fb(size):
    """PingFang SC Medium (bold-ish)"""
    for path, idx in [(FONT_PINGFANG, 3), (FONT_HEITI, 0)]:
        try: return ImageFont.truetype(path, size, index=idx)
        except: pass
    return ImageFont.load_default()

def Fsong(size):
    """Songti SC Bold — calligraphic titles"""
    for path, idx in [(FONT_SONGTI, 4), (FONT_SONGTI, 2), (FONT_HEITI, 0)]:
        try: return ImageFont.truetype(path, size, index=idx)
        except: pass
    return Fb(size)

# ── Mediapipe ──
def make_landmarker():
    opts = vision.FaceLandmarkerOptions(
        base_options=mpy.BaseOptions(model_asset_path=MODEL), num_faces=1)
    return vision.FaceLandmarker.create_from_options(opts)

def detect(path, lm):
    img = mp.Image.create_from_file(path)
    res = lm.detect(img)
    if not res.face_landmarks: return None, None
    pil = Image.open(path).convert("RGB")
    w, h = pil.size
    P = [(p.x * w, p.y * h) for p in res.face_landmarks[0]]
    return pil, P

def mid(a, b): return ((a[0]+b[0])/2, (a[1]+b[1])/2)
def D(a, b):   return math.hypot(a[0]-b[0], a[1]-b[1])

# ── Drawing helpers ──
def draw_dashed_line(draw, x0, y0, x1, y1, fill, width=2, dash=10, gap=6):
    dx, dy = x1-x0, y1-y0
    L = math.hypot(dx, dy)
    if L == 0: return
    ux, uy = dx/L, dy/L
    pos = 0
    while pos < L:
        end = min(pos + dash, L)
        draw.line([(x0+ux*pos, y0+uy*pos), (x0+ux*end, y0+uy*end)], fill=fill, width=width)
        pos += dash + gap

def draw_mountain_wm(img_rgba, canvas_w, canvas_h):
    """Very faint mountain silhouettes as watermark."""
    wm = Image.new("RGBA", (canvas_w, canvas_h), (0,0,0,0))
    d = ImageDraw.Draw(wm)
    c = (140, 130, 115, 28)
    # Left mountains
    pts = [(0, canvas_h//2), (canvas_w//8, canvas_h//4),
           (canvas_w//6, canvas_h//3), (canvas_w//5, canvas_h//2)]
    d.polygon(pts, fill=c)
    pts2 = [(0, canvas_h//3), (canvas_w//12, canvas_h//5),
            (canvas_w//9, canvas_h//3)]
    d.polygon(pts2, fill=c)
    # Right mountains
    rpts = [(canvas_w, canvas_h//2), (canvas_w - canvas_w//8, canvas_h//4),
            (canvas_w - canvas_w//6, canvas_h//3), (canvas_w - canvas_w//5, canvas_h//2)]
    d.polygon(rpts, fill=c)
    rpts2 = [(canvas_w, canvas_h//3), (canvas_w - canvas_w//12, canvas_h//5),
             (canvas_w - canvas_w//9, canvas_h//3)]
    d.polygon(rpts2, fill=c)
    return Image.alpha_composite(img_rgba, wm)

def draw_red_stamp(draw, cx, cy, r=55, char="灵"):
    """Red circle stamp decoration."""
    draw.ellipse([cx-r, cy-r, cx+r, cy+r], outline=(185, 35, 35, 230), width=4)
    draw.ellipse([cx-r+6, cy-r+6, cx+r-6, cy+r-6], outline=(185, 35, 35, 100), width=1)
    f = Fsong(int(r * 1.05))
    bb = draw.textbbox((0,0), char, font=f)
    tw, th = bb[2]-bb[0], bb[3]-bb[1]
    draw.text((cx-tw//2, cy-th//2-3), char, font=f, fill=(185, 35, 35, 230))

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

# ── Tight face crop (shared) ──
def crop_to_face(im, P, expand=0.40, top_extra=0.55, bot_extra=0.30):
    """Crop the image tight to the face.
    Expands the landmark bounding box by `expand` (each side), with extra
    room above (hairline/forehead) and a little below (chin). Returns
    (cropped_im, (cl, ct)) so callers can map landmark coords into the crop.
    """
    w, h = im.size
    xs = [p[0] for p in P]; ys = [p[1] for p in P]
    f_l, f_r = min(xs), max(xs)
    f_t, f_b = min(ys), max(ys)
    f_w = f_r - f_l; f_h = f_b - f_t
    cl = max(0,  int(f_l - f_w * expand))
    cr = min(w,  int(f_r + f_w * expand))
    ct = max(0,  int(f_t - f_h * top_extra))
    cb = min(h,  int(f_b + f_h * bot_extra))
    return im.crop((cl, ct, cr, cb)), (cl, ct)

def feather_blob(canvas_rgba, cx, cy, rx, ry, color, alpha=78, blur=None):
    """Paint a soft, feathered elliptical tint onto canvas_rgba (in place)."""
    CW, CH = canvas_rgba.size
    if blur is None:
        blur = max(rx, ry) * 0.55
    pad = int(blur * 2 + 6)
    bw = int(rx * 2 + pad * 2); bh = int(ry * 2 + pad * 2)
    blob = Image.new("L", (bw, bh), 0)
    ImageDraw.Draw(blob).ellipse([pad, pad, pad + rx * 2, pad + ry * 2], fill=alpha)
    blob = blob.filter(ImageFilter.GaussianBlur(blur))
    r, g, b = color[:3]
    tint = Image.new("RGBA", (bw, bh), (r, g, b, 0))
    tint.putalpha(blob)
    px = int(cx - rx - pad); py = int(cy - ry - pad)
    canvas_rgba.alpha_composite(tint, (px, py))

# ── 12 Palace definitions ──
# Colors kept soft & warm, harmonising with the parchment ground (like ref #2).
# fields: name, (r,g,b), [landmark_specs], (rx_frac, ry_frac), side, subtitle, labeled
# `labeled` = draw a leader-line label to the margin. Bilateral / crowded
# palaces keep only the soft blob to avoid crossing lines (per reference #2).
# rx/ry are fractions of the canvas face-width.
PALACES = [
    ("命宫",  (214, 176, 150), [("mid",105,334)],             (0.085, 0.058), "L", "看事业婚姻", True),
    ("官禄宫",(219, 168, 150), [151],                          (0.150, 0.085), "R", "看事业前程", True),
    ("父母宫",(196, 170, 190), [67, 297],                      (0.100, 0.070), "R", "看父母缘分", False),
    ("福德宫",(170, 196, 168), [54, 284],                      (0.100, 0.082), "L", "看福气积德", False),
    ("兄弟宫",(188, 176, 210), [("mid",46,55),("mid",276,285)],(0.115, 0.045), "L", "看手足缘分", False),
    ("田宅宫",(170, 200, 200), [159, 386],                     (0.098, 0.040), "R", "看房产财产", False),
    ("夫妻宫",(210, 172, 196), [130, 359],                     (0.078, 0.060), "L", "看情感婚姻", True),
    ("子女宫",(220, 200, 152), [23, 253],                      (0.100, 0.048), "L", "看子女缘分", True),
    ("疾厄宫",(196, 172, 206), [168],                          (0.058, 0.098), "R", "看健康体质", False),
    ("财帛宫",(228, 196, 130), [4],                            (0.092, 0.098), "R", "看财富运势", True),
    ("迁移宫",(168, 194, 208), [21, 251],                      (0.084, 0.100), "L", "看出行迁移", False),
    ("奴仆宫",(210, 180, 158), [("mid",135,364)],              (0.150, 0.095), "R", "看贵人助力", True),
]

def palace_landmark(P, spec):
    if isinstance(spec, tuple) and spec[0] == "mid":
        a, b = P[spec[1]], P[spec[2]]
        return ((a[0]+b[0])/2, (a[1]+b[1])/2)
    return P[spec]


# ════════════════════════════════════════════════════════════════════════════════
# 面相十二宫 v2
# ════════════════════════════════════════════════════════════════════════════════
def make_mianxiang(orig_im, P, out_path):
    CW, CH = 1080, 1620
    PARCH = (242, 234, 211)

    # Canvas (RGBA for compositing)
    cv = Image.new("RGBA", (CW, CH), PARCH + (255,))
    cv = draw_mountain_wm(cv, CW, CH)

    # ── Tight face crop (shared helper) ──
    # Face bbox already spans forehead→chin; keep extras small so the chair
    # background is cropped out and the face fills the frame (ref card #2).
    face_crop, (cl, ct) = crop_to_face(orig_im, P, expand=0.14,
                                       top_extra=0.14, bot_extra=0.10)

    # ── Photo placement: center photo, label columns on both sides ──
    HEADER_H = 232
    FOOTER_H = 108
    LABEL_W  = 196   # room for margin label text (name + subtitle)
    GAP      = 10
    MARGIN_X = LABEL_W + GAP

    photo_area_x   = MARGIN_X
    photo_area_w   = CW - 2 * MARGIN_X
    photo_area_top = HEADER_H
    photo_area_bot = CH - FOOTER_H - 6
    photo_area_h   = photo_area_bot - photo_area_top

    scale   = min(photo_area_w / face_crop.width, photo_area_h / face_crop.height)
    ph_w    = int(face_crop.width  * scale)
    ph_h    = int(face_crop.height * scale)
    face_rs = face_crop.resize((ph_w, ph_h), Image.LANCZOS)
    ph_x    = photo_area_x + (photo_area_w - ph_w)//2
    ph_y    = photo_area_top + (photo_area_h - ph_h)//2

    # Soft rounded frame + drop shadow for the photo
    rad = 26
    sh = Image.new("RGBA", (CW, CH), (0,0,0,0))
    ImageDraw.Draw(sh).rounded_rectangle(
        [ph_x-6, ph_y-6, ph_x+ph_w+6, ph_y+ph_h+6], radius=rad+4,
        fill=(70, 45, 30, 60))
    sh = sh.filter(ImageFilter.GaussianBlur(14))
    cv.alpha_composite(sh)

    face_rgba = face_rs.convert("RGBA")
    mask = Image.new("L", (ph_w, ph_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, ph_w, ph_h], radius=rad, fill=255)
    cv.paste(face_rgba, (ph_x, ph_y), mask)
    draw = ImageDraw.Draw(cv)
    draw.rounded_rectangle([ph_x, ph_y, ph_x+ph_w, ph_y+ph_h], radius=rad,
                           outline=(150, 110, 78, 150), width=2)

    # Landmark → canvas coords
    sx = ph_w / (face_crop.width); sy = ph_h / (face_crop.height)
    ox = ph_x - cl*sx;    oy = ph_y - ct*sy
    def tc(px, py): return (px*sx + ox, py*sy + oy)
    CP = [tc(p[0], p[1]) for p in P]
    cxs_c = [p[0] for p in CP]
    cfw = max(cxs_c) - min(cxs_c)   # face width in canvas px

    # ── Draw feathered palace blobs (soft tint, no numbers) ──
    ov = Image.new("RGBA", (CW, CH), (0,0,0,0))

    palace_info = []  # (name, side, sub, avg_cx, avg_cy, labeled)
    for i, (name, color, specs, (rxf, ryf), side, sub, labeled) in enumerate(PALACES):
        rx = max(14, int(cfw * rxf))
        ry = max(11, int(cfw * ryf))
        centers = []
        for spec in specs:
            bx, by = palace_landmark(CP, spec)
            feather_blob(ov, bx, by, rx, ry, color, alpha=118,
                         blur=max(rx, ry)*0.42)
            centers.append((bx, by))
        avg_cx = sum(c[0] for c in centers) / len(centers)
        avg_cy = sum(c[1] for c in centers) / len(centers)
        palace_info.append((name, side, sub, avg_cx, avg_cy, labeled))

    # Clip blobs softly to inside the photo rect so tint doesn't bleed onto parchment
    clip = Image.new("L", (CW, CH), 0)
    ImageDraw.Draw(clip).rounded_rectangle(
        [ph_x, ph_y, ph_x+ph_w, ph_y+ph_h], radius=rad, fill=255)
    ov.putalpha(Image.composite(ov.getchannel("A"),
                                Image.new("L", (CW, CH), 0), clip))
    cv.alpha_composite(ov)
    draw = ImageDraw.Draw(cv)

    # ── Clean leader-line labels to the margins (only `labeled` palaces) ──
    MAROON  = (92, 32, 32)
    GRAY    = (120, 92, 72)
    DOTCOL  = (150, 108, 74)
    name_f  = Fb(34)
    sub_f   = F(24)

    labeled_p = [p for p in palace_info if p[5]]
    left_p  = sorted([p for p in labeled_p if p[1]=="L"], key=lambda x: x[4])
    right_p = sorted([p for p in labeled_p if p[1]=="R"], key=lambda x: x[4])

    # Vertical anchor slots so labels never overlap / lines never cross.
    slot_top = photo_area_top + 40
    slot_bot = photo_area_bot - 40

    def slots(n):
        if n == 1: return [(slot_top + slot_bot)//2]
        step = (slot_bot - slot_top) / (n - 1)
        return [int(slot_top + i*step) for i in range(n)]

    def draw_side(palaces, is_left):
        ys = slots(len(palaces))
        for (name, side, sub, fcx, fcy, _), ly in zip(palaces, ys):
            nb = draw.textbbox((0,0), name, font=name_f)
            sb = draw.textbbox((0,0), sub,  font=sub_f)
            nw = nb[2]-nb[0]; sw = sb[2]-sb[0]
            if is_left:
                # text block right-aligned to just inside the photo's left edge
                text_right = ph_x - GAP - 6
                nx  = text_right - nw
                sxx = text_right - sw
                elbow_x = ph_x - 6
                conn_start = text_right + 4
            else:
                text_left = ph_x + ph_w + GAP + 6
                nx  = text_left
                sxx = text_left
                elbow_x = ph_x + ph_w + 6
                conn_start = text_left - 4 + max(nw, sw)
            # dotted leader: blob anchor → photo edge (elbow)
            draw_dashed_line(draw, fcx, fcy, elbow_x, ly, fill=DOTCOL,
                             width=2, dash=7, gap=6)
            draw.ellipse([fcx-4, fcy-4, fcx+4, fcy+4], fill=DOTCOL)
            # short solid connector from elbow to text block
            draw.line([(elbow_x, ly), (conn_start, ly)], fill=DOTCOL, width=2)
            draw.text((nx, ly - 34), name, font=name_f, fill=MAROON)
            draw.text((sxx, ly + 6), sub, font=sub_f, fill=GRAY)

    draw_side(left_p, True)
    draw_side(right_p, False)

    # ── Header ──
    title_f    = Fsong(80)
    subtitle_f = F(30)
    title     = "面相十二宫位置图"
    sub_text  = "一张图看懂十二宫在哪 · 传统文化科普"
    tb = draw.textbbox((0,0), title, font=title_f)
    draw.text(((CW-(tb[2]-tb[0]))//2, 34), title, font=title_f, fill=(82, 22, 22))
    # little badge under title (like reference "修正版")
    badge_txt = "通行位置整理"
    bf = Fb(26)
    bbx = draw.textbbox((0,0), badge_txt, font=bf)
    bw = bbx[2]-bbx[0]
    bxc = (CW - bw)//2
    draw.rounded_rectangle([bxc-16, 138, bxc+bw+16, 182], radius=10,
                           fill=(140, 30, 30))
    draw.text((bxc, 146), badge_txt, font=bf, fill=(248, 236, 218))
    sb = draw.textbbox((0,0), sub_text, font=subtitle_f)
    draw.text(((CW-(sb[2]-sb[0]))//2, 194), sub_text, font=subtitle_f, fill=(130, 95, 70))

    # Red stamp
    draw_red_stamp(draw, CW-80, 78, r=50, char="灵")

    # ── Footer ──
    div_y = CH - FOOTER_H
    draw.line([(60, div_y), (CW-60, div_y)], fill=(160, 120, 80, 160), width=1)
    d1 = "说明：十二宫位置各流派略有差异，本图采用通行位置示意，仅供参考"
    d2 = "Runae · 娱乐参考 · 传统文化科普整理 · 不作优劣或医疗评价"
    disc_f = F(23)
    d1b = draw.textbbox((0,0), d1, font=disc_f)
    d2b = draw.textbbox((0,0), d2, font=disc_f)
    draw.text(((CW-(d1b[2]-d1b[0]))//2, div_y+18), d1, font=disc_f, fill=(135, 100, 72))
    draw.text(((CW-(d2b[2]-d2b[0]))//2, div_y+50), d2, font=disc_f, fill=(135, 100, 72))

    os.makedirs(OUTDIR, exist_ok=True)
    cv.convert("RGB").save(out_path, quality=95)
    print(f"SAVED: {out_path}")


# ════════════════════════════════════════════════════════════════════════════════
# 黄金比例 v2
# ════════════════════════════════════════════════════════════════════════════════
def make_golden(orig_im, P, out_path):
    CW, CH = 1080, 1620
    BG = (242, 234, 211)   # parchment, brand-consistent

    cv = Image.new("RGB", (CW, CH), BG)
    d  = ImageDraw.Draw(cv)

    # Subtle warm grid background
    for i in range(0, CW, 40):
        d.line([(i,0),(i,CH)], fill=(234,226,204), width=1)
    for j in range(0, CH, 40):
        d.line([(0,j),(CW,j)], fill=(234,226,204), width=1)

    # ── Key landmarks ──
    top     = P[10];  chin  = P[152]
    leftF   = P[234]; rightF= P[454]
    browL   = P[105]; browR  = P[334]; brow = mid(browL, browR)
    eyeLo   = P[33];  eyeLi  = P[133]
    eyeRo   = P[263]; eyeRi  = P[362]
    noseTip = P[4];   noseBase = P[2]
    alL     = P[48];  alR   = P[278]
    mL      = P[61];  mR    = P[291]
    mTop    = P[0];   mBot  = P[17]; mCen = mid(mTop, mBot)
    faceW   = D(leftF, rightF); faceL = D(top, chin)
    eyeW    = D(eyeLo, eyeLi)

    # ── Hairline estimation ──
    brow_y = brow[1]; nose_y = noseBase[1]; chin_y = chin[1]
    mid_sec   = nose_y - brow_y          # brow→noseBase distance
    low_sec   = chin_y - nose_y          # noseBase→chin distance
    # Ideal upper-third = same as mid, so hairline = brow_y - mid_sec
    est_hl_y  = brow_y - mid_sec
    # Use P[10] only if it's a plausible hairline (above brow, below 2× mid_sec above brow)
    top_y     = top[1]
    if (top_y < brow_y - mid_sec * 0.10 and top_y > est_hl_y - mid_sec * 0.60):
        hairline_y = top_y
    else:
        hairline_y = est_hl_y
    hairline_pt = (brow[0], hairline_y)

    # ── Scoring (generous & kind — 容貌焦虑 protection) ──
    # A deviation of 30% still scores ~75; every metric floored at 65.
    def warm_word(sc):
        if sc >= 90: return "优美"
        if sc >= 82: return "协调"
        if sc >= 74: return "匀称"
        return "自然"
    def score_item(name, val, ideal):
        dev = abs(val/ideal - 1)
        raw = (1.0 - dev / 1.20) * 100          # 30% dev → ~75, wide tolerance
        sc  = max(65.0, min(98.0, raw))         # floor 65, cap 98
        return (name, val, ideal, sc, warm_word(sc))

    items = [
        score_item("脸长 : 脸宽", faceL/faceW, 1.45),   # natural target, not harsh φ
        score_item("上庭 : 中庭", abs(brow_y-hairline_y)/mid_sec, 1.0),
        score_item("中庭 : 下庭", mid_sec/low_sec,               1.0),
        score_item("五眼 · 脸宽/眼宽", faceW/eyeW,                5.0),
        score_item("眼距 · 一眼宽", D(eyeLi, eyeRi)/eyeW,         1.0),
        score_item("口鼻 · 宽度比", D(mL,mR)/D(alL,alR),          1.55),
        score_item("唇颏 · 三分比", D(noseBase,mCen)/D(mCen,chin), 0.618),
    ]
    # Headline: blend of metrics, nudged up so a normal face reads 85-90.
    base = sum(s for *_,s,_ in items) / len(items)
    overall = min(94.0, base * 0.55 + 40.0)     # maps ~72-88 raw → ~80-88

    # ── Photo crop & placement (tight, shared helper) ──
    face_crop, (cl, ct) = crop_to_face(orig_im, P, expand=0.12,
                                       top_extra=0.16, bot_extra=0.08)
    cr = cl + face_crop.width; cb = ct + face_crop.height

    PANEL_W   = 376    # right panel width
    PANEL_GAP = 16
    PHOTO_X   = 20
    PHOTO_W   = CW - PANEL_W - PANEL_GAP - PHOTO_X - 10
    PHOTO_TOP = 180
    PHOTO_BOT = 1080
    PHOTO_H   = PHOTO_BOT - PHOTO_TOP

    scale  = min(PHOTO_W / face_crop.width, PHOTO_H / face_crop.height)
    ph_w   = int(face_crop.width  * scale)
    ph_h   = int(face_crop.height * scale)
    face_rs= face_crop.resize((ph_w, ph_h), Image.LANCZOS)
    ph_x   = PHOTO_X + (PHOTO_W - ph_w)//2
    ph_y   = PHOTO_TOP + (PHOTO_H - ph_h)//2
    # rounded frame
    _rad = 22
    _m = Image.new("L", (ph_w, ph_h), 0)
    ImageDraw.Draw(_m).rounded_rectangle([0,0,ph_w,ph_h], radius=_rad, fill=255)
    cv.paste(face_rs, (ph_x, ph_y), _m)
    d.rounded_rectangle([ph_x, ph_y, ph_x+ph_w, ph_y+ph_h], radius=_rad,
                        outline=(150,110,78), width=2)

    sx = ph_w/(cr-cl); sy = ph_h/(cb-ct)
    ox = ph_x - cl*sx; oy = ph_y - ct*sy
    def tc(px,py): return (px*sx+ox, py*sy+oy)
    CP      = [tc(p[0],p[1]) for p in P]
    c_top   = tc(*top);       c_chin  = tc(*chin)
    c_leftF = tc(*leftF);     c_rightF= tc(*rightF)
    c_brow  = tc(*brow);      c_browL = tc(*browL);  c_browR = tc(*browR)
    c_eyeLo = tc(*eyeLo);     c_eyeLi = tc(*eyeLi)
    c_eyeRo = tc(*eyeRo);     c_eyeRi = tc(*eyeRi)
    c_noset = tc(*noseTip);   c_noseb = tc(*noseBase)
    c_alL   = tc(*alL);       c_alR   = tc(*alR)
    c_mL    = tc(*mL);        c_mR    = tc(*mR);     c_mCen = tc(*mCen)
    c_hair  = tc(*hairline_pt)

    midx = (c_top[0]+c_chin[0])/2

    # Lines on face — warm gold + soft rose, elegant not clinical
    GOLD = (196, 150, 70); ROSE = (200, 110, 96)
    d.line([(midx, c_hair[1]-10),(midx, c_chin[1]+8)], fill=GOLD, width=2)
    eyeY = (c_eyeLi[1]+c_eyeRi[1])/2
    d.line([(c_leftF[0]-8, eyeY),(c_rightF[0]+8, eyeY)], fill=ROSE, width=2)
    for yp in [c_hair[1], c_brow[1], c_noseb[1]]:
        d.line([(c_leftF[0]-4,yp),(c_rightF[0]+4,yp)], fill=(196,150,70), width=1)
    # Triangles
    d.polygon([c_browL,c_browR,c_noset], outline=GOLD, width=2)
    d.polygon([c_alL,c_alR,c_mCen],     outline=GOLD, width=2)
    d.polygon([c_mL,c_mR,c_chin],       outline=GOLD, width=2)
    # Eye lines
    d.line([c_eyeLo,c_eyeLi], fill=ROSE, width=2)
    d.line([c_eyeRo,c_eyeRi], fill=ROSE, width=2)
    d.line([c_mL,c_mR],       fill=ROSE, width=2)

    # ── Right score panel ──
    PX = CW - PANEL_W - 12
    PY = PHOTO_TOP
    PH = PHOTO_BOT - PHOTO_TOP + 20

    # Panel background
    d.rounded_rectangle([PX, PY, PX+PANEL_W, PY+PH],
                          radius=22, fill=(252,251,247), outline=(196,178,150), width=2)

    # Overall score — big, warm, flattering
    sc_str = f"{overall:.0f}"
    lbl_y  = PY + 26
    lbl_f  = Fb(30)
    lbl_txt = "综合协调度"
    lbb = d.textbbox((0,0), lbl_txt, font=lbl_f)
    d.text((PX+(PANEL_W-(lbb[2]-lbb[0]))//2, lbl_y), lbl_txt, font=lbl_f, fill=(120,92,72))
    sc_f = Fsong(120)
    scb  = d.textbbox((0,0), sc_str, font=sc_f)
    pct_f = Fb(40)
    pcb = d.textbbox((0,0), "分", font=pct_f)
    total_w = (scb[2]-scb[0]) + (pcb[2]-pcb[0]) + 8
    sx0 = PX + (PANEL_W - total_w)//2
    d.text((sx0, lbl_y+40), sc_str, font=sc_f, fill=(150, 40, 40))
    d.text((sx0 + (scb[2]-scb[0]) + 8, lbl_y+118), "分", font=pct_f, fill=(150, 40, 40))
    tag_f = F(23)
    tag   = "比例协调 · 天生好面相" if overall >= 84 else "五官匀称 · 各有风韵"
    tgb   = d.textbbox((0,0), tag, font=tag_f)
    d.text((PX+(PANEL_W-(tgb[2]-tgb[0]))//2, lbl_y+180), tag, font=tag_f, fill=(150, 108, 74))

    div2y = lbl_y + 224
    d.line([(PX+20, div2y),(PX+PANEL_W-20, div2y)], fill=(210,196,170), width=1)

    # Metric rows — name + bar + warm word (no harsh percentages)
    met_f = Fb(23); word_f = Fb(23)
    ry = div2y + 22
    bar_max = PANEL_W - 44

    for name_m, val, ideal, sc, word in items:
        d.text((PX+18, ry), name_m, font=met_f, fill=(78,58,44))
        wb = d.textbbox((0,0), word, font=word_f)
        d.text((PX+PANEL_W-(wb[2]-wb[0])-18, ry), word, font=word_f, fill=(160, 110, 70))
        bary = ry + 34; barh = 12
        bar_w = int(bar_max * sc / 100)
        # Warm gradient-ish colours, never alarming red
        bc = (168, 128, 88) if sc >= 82 else (196, 158, 100)
        d.rounded_rectangle([PX+18, bary, PX+18+bar_max, bary+barh], radius=6, fill=(228,220,206))
        if bar_w > 4:
            d.rounded_rectangle([PX+18, bary, PX+18+bar_w, bary+barh], radius=6, fill=bc)
        ry += 62

    # ── Bottom interpretation ──
    interp_y = 1112
    level = ("比例协调 · 天生一张舒服的脸 ✦"  if overall >= 84 else
             "五官匀称 · 自有独特韵味 ✦")
    lev_f = Fsong(42)
    lb  = d.textbbox((0,0), level, font=lev_f)
    d.text(((CW-(lb[2]-lb[0]))//2, interp_y), level, font=lev_f, fill=(120, 40, 40))

    # Detail cards below — all positive/flattering
    card_y  = interp_y + 66
    card_h  = 82
    card_gap= 14
    card_w  = (CW - 60 - 2*card_gap) // 3
    highlights = [
        ("五眼比例", "舒展有神"),
        ("脸型轮廓", "圆润饱满" if faceL/faceW < 1.42 else "清秀修长"),
        ("五官布局", "疏密得宜"),
    ]
    for i, (hname, hdesc) in enumerate(highlights):
        cx2 = 30 + i*(card_w+card_gap)
        d.rounded_rectangle([cx2, card_y, cx2+card_w, card_y+card_h],
                              radius=16, fill=(250,244,230), outline=(200,180,150), width=1)
        hf = Fb(26); hdf = F(21)
        hb = d.textbbox((0,0), hname, font=hf)
        d.text((cx2+(card_w-(hb[2]-hb[0]))//2, card_y+14), hname, font=hf, fill=(110, 60, 40))
        db = d.textbbox((0,0), hdesc, font=hdf)
        d.text((cx2+(card_w-(db[2]-db[0]))//2, card_y+48), hdesc, font=hdf, fill=(150, 108, 74))

    # ── Header ──
    title_f2 = Fsong(76)
    t2 = "面部黄金比例分析"
    t2b = d.textbbox((0,0), t2, font=title_f2)
    d.text(((CW-(t2b[2]-t2b[0]))//2, 26), t2, font=title_f2, fill=(82, 22, 22))
    sub2_f = F(29)
    sub2   = "Runae · 依你本人照片 · 面部比例示意"
    sb2 = d.textbbox((0,0), sub2, font=sub2_f)
    d.text(((CW-(sb2[2]-sb2[0]))//2, 116), sub2, font=sub2_f, fill=(130, 95, 70))
    d.line([(80,158),(CW-80,158)], fill=(175, 140, 95), width=1)
    draw_red_stamp(d, CW-80, 80, r=50, char="测")

    # ── Footer ──
    foot_y = CH - 80
    d.line([(60, foot_y),(CW-60, foot_y)], fill=(178, 148, 105), width=1)
    disc = "容貌是独特的，数据仅供参考 · 传统审美只是一种视角 · Runae 娱乐参考"
    disc_f = F(24)
    db2 = d.textbbox((0,0), disc, font=disc_f)
    d.text(((CW-(db2[2]-db2[0]))//2, foot_y+16), disc, font=disc_f, fill=(135, 100, 72))

    os.makedirs(OUTDIR, exist_ok=True)
    cv.save(out_path, quality=95)
    print(f"SAVED: {out_path}")
    return overall, items


# ── Main ──
def find_selfie(lm):
    c = glob.glob("/Users/karen/Downloads/*6639170629074168189*.jpeg")
    if c: return c[0]
    candidates = []
    for dd in ["/Users/karen/Documents", "/Users/karen/Downloads"]:
        for e in ("*.jpeg","*.jpg","*.png"):
            candidates += glob.glob(os.path.join(dd, e))
    candidates = [x for x in candidates if "webwxgetmsgimg" in x or "mmwebwx" in x]
    candidates.sort(key=os.path.getmtime, reverse=True)
    best=None; ba=0
    for x in candidates[:20]:
        im, Pf = detect(x, lm)
        if Pf:
            xs=[p[0] for p in Pf]; a=max(xs)-min(xs)
            if a > ba: ba=a; best=x
    return best

def main():
    lm  = make_landmarker()
    inp = sys.argv[1] if len(sys.argv)>1 else find_selfie(lm)
    if not inp: print("NO_PHOTO_FOUND"); return
    print("Using photo:", inp)
    im, P = detect(inp, lm)
    if not P: print("NO_FACE"); return
    os.makedirs(OUTDIR, exist_ok=True)
    make_mianxiang(im.copy(), P, os.path.join(OUTDIR, "面相十二宫-v2.png"))
    overall, items = make_golden(im.copy(), P, os.path.join(OUTDIR, "黄金比例-v2.png"))
    print(f"\n综合吻合度: {overall:.1f}%")
    for nm, val, ideal, sc, lbl in items:
        print(f"  {nm}: {val:.3f} → {sc:.0f}分")

if __name__ == "__main__":
    main()
