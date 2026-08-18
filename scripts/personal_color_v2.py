#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
个人色彩报告 v2 — 小红书风格
输出: 个人色彩报告-v2.png
用法: python3 personal_color_v2.py <脸照>
"""
import sys, os, glob, math, colorsys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONT_PINGFANG = "/System/Library/AssetsV2/com_apple_MobileAsset_Font8/86ba2c91f017a3749571a82f2c6d890ac7ffb2fb.asset/AssetData/PingFang.ttc"
FONT_SONGTI   = "/System/Library/Fonts/Supplemental/Songti.ttc"
FONT_HEITI    = "/System/Library/Fonts/STHeiti Medium.ttc"
MODEL  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "face_landmarker.task")
OUTDIR = os.path.expanduser("~/projects/shenyuan/samples")

def F(size):
    for path, idx in [(FONT_PINGFANG, 6), (FONT_HEITI, 0)]:
        try: return ImageFont.truetype(path, size, index=idx)
        except: pass
    return ImageFont.load_default()

def Fb(size):
    for path, idx in [(FONT_PINGFANG, 3), (FONT_HEITI, 0)]:
        try: return ImageFont.truetype(path, size, index=idx)
        except: pass
    return ImageFont.load_default()

def Fsong(size):
    for path, idx in [(FONT_SONGTI, 4), (FONT_SONGTI, 2), (FONT_HEITI, 0)]:
        try: return ImageFont.truetype(path, size, index=idx)
        except: pass
    return Fb(size)

# ── Mediapipe detection ──
import mediapipe as mp
from mediapipe.tasks import python as mpy
from mediapipe.tasks.python import vision

def detect_face(path):
    opts = vision.FaceLandmarkerOptions(
        base_options=mpy.BaseOptions(model_asset_path=MODEL), num_faces=1)
    lm = vision.FaceLandmarker.create_from_options(opts)
    img = mp.Image.create_from_file(path)
    res = lm.detect(img)
    if not res.face_landmarks: return None, None
    pil = Image.open(path).convert("RGB")
    w, h = pil.size
    P = [(int(p.x*w), int(p.y*h)) for p in res.face_landmarks[0]]
    return pil, P

# ── Color sampling ──
def sample_patch(arr, cx, cy, r=8):
    h, w = arr.shape[:2]
    x0,x1 = max(0,cx-r), min(w,cx+r)
    y0,y1 = max(0,cy-r), min(h,cy+r)
    px = arr[y0:y1, x0:x1].reshape(-1, 3)
    if len(px) == 0: return None
    return np.median(px, axis=0)

def rgb_to_lab(rgb):
    r, g, b = [c/255 for c in rgb]
    def f(t): return t/12.92 if t<=0.04045 else ((t+0.055)/1.055)**2.4
    r,g,b = f(r),f(g),f(b)
    x = r*.4124+g*.3576+b*.1805
    y = r*.2126+g*.7152+b*.0722
    z = r*.0193+g*.1192+b*.9505
    def g_(t): return t**(1/3) if t>.008856 else 7.787*t+16/116
    fx,fy,fz = g_(x/.95047), g_(y/1.0), g_(z/1.08883)
    return (116*fy-16, 500*(fx-fy), 200*(fy-fz))

def hexof(rgb): return "#%02X%02X%02X" % tuple(int(c) for c in rgb)

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2],16) for i in (0,2,4))

# ── Season database ──
SEASONS = {
    "春 暖亮型": {
        "desc": "暖调 · 明亮 · 清透",
        "keywords": ["活力", "明媚", "温暖"],
        "emoji": "🌸",
        "best": ["#FF9E7A","#FFC15E","#FF6F61","#8FD694","#FFE4B5","#F5B7A0","#FADA8A","#E8A87C"],
        "avoid": ["#2E2E2E","#5C4B8A","#8A8A8A","#4A4A6A"],
        "avoid_reason": "避免冷色、深色、灰调",
        "lip": "珊瑚橘 / 西柚粉 / 蜜桃橘",
        "blush": "蜜桃橘 / 浅杏橘",
        "eye": "暖棕 / 杏金 / 焦糖",
        "highlight": "香槟金 / 珠光橘",
        "bg": (255, 250, 240),
        "accent": (220, 120, 60),
    },
    "夏 冷柔型": {
        "desc": "冷调 · 柔和 · 雾面",
        "keywords": ["温柔", "优雅", "柔美"],
        "emoji": "🌿",
        "best": ["#E6A6B8","#C7A6D6","#A9C6E8","#B8B8C4","#D6A6C0","#A6D6C6","#E8C6D6","#9AA6C4"],
        "avoid": ["#FF7A00","#FFE000","#8A5A2B","#FF4500"],
        "avoid_reason": "避免暖色、橘调、高饱和度色",
        "lip": "豆沙玫瑰 / 樱花粉 / 藕粉",
        "blush": "哑光玫瑰 / 冷粉",
        "eye": "灰粉 / 雾紫 / 浅蓝灰",
        "highlight": "珠光玫瑰 / 粉金",
        "bg": (245, 240, 250),
        "accent": (160, 100, 180),
    },
    "秋 暖深型": {
        "desc": "暖调 · 深沉 · 大地",
        "keywords": ["沉稳", "丰盛", "大地"],
        "emoji": "🍂",
        "best": ["#C79A2B","#7A7A2E","#B5532B","#C4632B","#8A5A2B","#3E5C3A","#B5892B","#8A2E1E"],
        "avoid": ["#FF6FCF","#00E0FF","#111111","#E0E0FF"],
        "avoid_reason": "避免冷色、荧光色、纯黑",
        "lip": "枫叶红 / 南瓜橘 / 焦糖棕",
        "blush": "砖橘 / 大地色",
        "eye": "焦糖 / 橄榄棕 / 深棕",
        "highlight": "铜金 / 古铜",
        "bg": (250, 245, 235),
        "accent": (170, 90, 40),
    },
    "冬 冷艳型": {
        "desc": "冷调 · 高对比 · 清冷",
        "keywords": ["清冷", "高冷", "干净"],
        "emoji": "❄️",
        "best": ["#FFFFFF","#111111","#E1122B","#1E3FD6","#C41E8A","#0E8A5A","#E6B7C6","#5A1E8A"],
        "avoid": ["#C79A6B","#FF9E5A","#B5A68A","#D4AA70"],
        "avoid_reason": "避免暖色、驼色、米色系",
        "lip": "正红 / 玫红 / 梅子色",
        "blush": "冷玫红 / 深玫",
        "eye": "冷灰 / 黑棕 / 深紫",
        "highlight": "冷白 / 银光 / 钻石粉",
        "bg": (240, 245, 252),
        "accent": (60, 80, 180),
    },
}

def classify_season(skin, hair, lip, iris):
    L, a, b = rgb_to_lab(skin)
    warm = b - 0.5 * abs(a)
    is_warm = warm > 14
    is_light = L > 62
    hair_L = rgb_to_lab(hair)[0]
    contrast = L - hair_L
    if is_warm and is_light:               return "春 暖亮型"
    elif is_warm and not is_light:         return "秋 暖深型"
    elif (not is_warm) and contrast < 50:  return "夏 冷柔型"
    else:                                   return "冬 冷艳型"


# ════════════════════════════════════════════════════════════════════════════════
# Render
# ════════════════════════════════════════════════════════════════════════════════
def make_color_report(im, P, skin, hair, lip, iris, season_key, out_path):
    info = SEASONS[season_key]
    CW, CH = 1080, 1920
    BG = info["bg"]
    ACCENT = info["accent"]
    DARK  = (45, 30, 28)
    GRAY  = (110, 100, 95)
    LIGHT_GRAY = (200, 195, 190)
    MAROON = (88, 22, 22)

    cv = Image.new("RGB", (CW, CH), BG)
    d  = ImageDraw.Draw(cv)

    # ── 1. Header (top 200px) ──
    header_h = 210
    # Gradient strip
    for y in range(header_h):
        alpha = int(40 * (1 - y/header_h))
        r0,g0,b0 = ACCENT
        d.line([(0,y),(CW,y)], fill=(r0,g0,b0,alpha))  # Note: RGB mode, alpha ignored
    # Actually draw accent with lighter overlay
    d.rectangle([0, 0, CW, header_h], fill=BG)
    # Decorative top band
    band_h = 8
    d.rectangle([0, 0, CW, band_h], fill=ACCENT)

    title_f = Fsong(82)
    title   = "个人色彩分析"
    tb = d.textbbox((0,0), title, font=title_f)
    d.text(((CW-(tb[2]-tb[0]))//2, 28), title, font=title_f, fill=MAROON)

    sub_f = F(28)
    sub   = "Runae · 依照片真实采集 · 韩式四季型分析"
    sb = d.textbbox((0,0), sub, font=sub_f)
    d.text(((CW-(sb[2]-sb[0]))//2, 126), sub, font=sub_f, fill=GRAY)

    d.line([(60, 184),(CW-60, 184)], fill=ACCENT, width=1)

    # Red stamp top-right
    def draw_stamp(draw, cx, cy, r=52, char="灵"):
        draw.ellipse([cx-r,cy-r,cx+r,cy+r], outline=(185,35,35), width=4)
        draw.ellipse([cx-r+6,cy-r+6,cx+r-6,cy+r-6], outline=(185,35,35), width=1)
        sf = Fsong(int(r*1.0))
        bb = draw.textbbox((0,0), char, font=sf)
        draw.text((cx-(bb[2]-bb[0])//2, cy-(bb[3]-bb[1])//2-3), char, font=sf, fill=(185,35,35))
    draw_stamp(d, CW-76, 94, r=52, char="彩")

    # ── 2. Portrait + Season card (side by side, y=220) ──
    SECTION_Y = 220
    PORT_SIZE  = 300   # portrait circle diameter

    # Circular portrait crop — tight on the face, exclude neck & chair.
    xs_all = [p[0] for p in P]; ys_all = [p[1] for p in P]
    f_l, f_r = min(xs_all), max(xs_all)
    f_t, f_b = min(ys_all), max(ys_all)
    fw = f_r - f_l; fh = f_b - f_t
    f_cx = (f_l + f_r) // 2
    # center vertically slightly above the bbox middle so chin/neck is excluded
    f_cy = int(f_t + fh * 0.42)
    # radius = a touch more than half the face height for a snug circle
    crop_r = int(max(fw, fh) * 0.64)
    cl = max(0, f_cx - crop_r); cr = min(im.width, f_cx + crop_r)
    ct = max(0, f_cy - crop_r); cb = min(im.height, f_cy + crop_r)
    face_sq = im.crop((cl, ct, cr, cb)).resize((PORT_SIZE, PORT_SIZE), Image.LANCZOS)

    # Circle mask
    mask = Image.new("L", (PORT_SIZE, PORT_SIZE), 0)
    ImageDraw.Draw(mask).ellipse([0,0,PORT_SIZE,PORT_SIZE], fill=255)
    face_circ = Image.new("RGBA", (PORT_SIZE, PORT_SIZE), (0,0,0,0))
    face_circ.paste(face_sq, mask=mask)

    port_x = 42; port_y = SECTION_Y
    cv_rgba = cv.convert("RGBA")
    cv_rgba.paste(face_circ, (port_x, port_y), face_circ)
    cv = cv_rgba.convert("RGB")
    d  = ImageDraw.Draw(cv)

    # Ring border around portrait
    ring_d = ImageDraw.Draw(cv)
    ring_d.ellipse([port_x-4, port_y-4, port_x+PORT_SIZE+4, port_y+PORT_SIZE+4],
                    outline=ACCENT, width=4)
    ring_d.ellipse([port_x-8, port_y-8, port_x+PORT_SIZE+8, port_y+PORT_SIZE+8],
                    outline=ACCENT,
                    width=2)

    # Season card (right of portrait)
    card_x = port_x + PORT_SIZE + 30
    card_w  = CW - card_x - 30
    card_y  = SECTION_Y
    card_h  = PORT_SIZE + 8

    d.rounded_rectangle([card_x, card_y, card_x+card_w, card_y+card_h],
                          radius=20, fill=(255,255,255), outline=ACCENT, width=2)

    # Season emoji + name
    season_emoji = info["emoji"]
    season_name  = season_key  # "冬 冷艳型"
    season_parts = season_name.split(" ")  # ["冬", "冷艳型"]
    s_season = season_parts[0] if len(season_parts) > 0 else season_name
    s_type   = season_parts[1] if len(season_parts) > 1 else ""

    big_f   = Fsong(68)
    big2_f  = Fsong(42)
    desc_f  = F(24)
    kw_f    = Fb(22)

    sy = card_y + 18
    # Big season character
    d.text((card_x+22, sy), s_season, font=big_f, fill=MAROON)
    sb2 = d.textbbox((0,0), s_season, font=big_f)
    d.text((card_x+22+(sb2[2]-sb2[0])+8, sy+14), s_type, font=big2_f, fill=MAROON)

    sy += 84
    d.text((card_x+22, sy), info["desc"], font=desc_f, fill=GRAY)

    # Keyword badges
    sy += 40
    kx = card_x + 22
    for kw in info["keywords"]:
        kwb = d.textbbox((0,0), kw, font=kw_f)
        kw_w = kwb[2]-kwb[0]+20
        d.rounded_rectangle([kx, sy, kx+kw_w, sy+32], radius=8,
                              fill=BG, outline=ACCENT, width=1)
        d.text((kx+10, sy+6), kw, font=kw_f, fill=ACCENT)
        kx += kw_w + 10

    # ── Sampled colors row ──
    sy = card_y + card_h - 90
    d.text((card_x+22, sy), "采集到的你", font=F(22), fill=GRAY)
    sy += 32
    samples = [
        (skin, "肤"), (hair, "发"), (lip, "唇"), (iris, "瞳")
    ]
    sw_x = card_x + 22
    for rgb, label in samples:
        d.rounded_rectangle([sw_x, sy, sw_x+52, sy+52], radius=8,
                              fill=tuple(int(c) for c in rgb), outline=LIGHT_GRAY, width=1)
        lb = d.textbbox((0,0), label, font=F(17))
        d.text((sw_x+(52-(lb[2]-lb[0]))//2, sy+56), label, font=F(17), fill=GRAY)
        sw_x += 68

    # ── 3. Color palette section ──
    SECT_Y = SECTION_Y + card_h + 40
    # Section header
    def section_header(y, title, icon="✓", icon_color=(50,150,80)):
        hf = Fb(38)
        d.text((30, y), icon, font=hf, fill=icon_color)
        hb = d.textbbox((0,0), icon, font=hf)
        d.text((30+(hb[2]-hb[0])+14, y), title, font=hf, fill=DARK)
        return y + 58

    y = section_header(SECT_Y, "你的黄金色盘", "✓", (50,150,70))

    # 8 large swatches in 2 rows of 4
    sw_size = 186
    sw_gap  = 16
    sw_start_x = (CW - 4*sw_size - 3*sw_gap) // 2

    for i, hx in enumerate(info["best"]):
        col = i % 4; row = i // 4
        sx = sw_start_x + col*(sw_size+sw_gap)
        sy = y + row*(sw_size+36+sw_gap)
        rgb = hex_to_rgb(hx)
        d.rounded_rectangle([sx, sy, sx+sw_size, sy+sw_size],
                              radius=16, fill=rgb, outline=LIGHT_GRAY, width=1)
        hex_f = F(17)
        hb2 = d.textbbox((0,0), hx.upper(), font=hex_f)
        d.text((sx+(sw_size-(hb2[2]-hb2[0]))//2, sy+sw_size+5), hx.upper(),
               font=hex_f, fill=GRAY)

    y += 2*(sw_size+36+sw_gap) + 16

    # ── 4. Avoid colors ──
    y = section_header(y, "建议避开的色系", "✗", (190,60,50))

    sw_size2 = 148
    sw_gap2  = 20
    n_avoid  = len(info["avoid"])
    sw_start2 = (CW - n_avoid*sw_size2 - (n_avoid-1)*sw_gap2) // 2
    for i, hx in enumerate(info["avoid"]):
        sx2 = sw_start2 + i*(sw_size2+sw_gap2)
        rgb2 = hex_to_rgb(hx)
        d.rounded_rectangle([sx2, y, sx2+sw_size2, y+sw_size2],
                              radius=14, fill=rgb2, outline=LIGHT_GRAY, width=1)
        hex_f2 = F(16)
        hb3 = d.textbbox((0,0), hx.upper(), font=hex_f2)
        d.text((sx2+(sw_size2-(hb3[2]-hb3[0]))//2, y+sw_size2+4), hx.upper(),
               font=hex_f2, fill=GRAY)

    avoid_reason_f = F(21)
    arb = d.textbbox((0,0), info["avoid_reason"], font=avoid_reason_f)
    d.text(((CW-(arb[2]-arb[0]))//2, y+sw_size2+28), info["avoid_reason"],
           font=avoid_reason_f, fill=(180,80,60))

    y += sw_size2 + 62

    # ── 5. Makeup card ──
    card2_h = 248
    card2_m = 30
    d.rounded_rectangle([card2_m, y, CW-card2_m, y+card2_h],
                          radius=20, fill=(255,255,255), outline=ACCENT, width=2)
    mup_title_f = Fb(38)
    d.text((card2_m+28, y+22), "妆容推荐", font=mup_title_f, fill=MAROON)

    # Divider
    d.line([(card2_m+20, y+70),(CW-card2_m-20, y+70)], fill=LIGHT_GRAY, width=1)

    items_mu = [
        ("口红", info["lip"],   (200, 60, 80)),
        ("腮红", info["blush"], (200, 100, 100)),
        ("眼影", info["eye"],   (80,  80, 140)),
    ]
    mu_y = y + 80
    for label_mu, text_mu, dot_c in items_mu:
        # Colored dot
        d.ellipse([card2_m+28, mu_y+6, card2_m+46, mu_y+24], fill=dot_c)
        lbl_f = Fb(26); txt_f = F(26)
        d.text((card2_m+58, mu_y), label_mu+"：", font=lbl_f, fill=DARK)
        lbl_b = d.textbbox((0,0), label_mu+"：", font=lbl_f)
        d.text((card2_m+58+(lbl_b[2]-lbl_b[0]), mu_y), text_mu, font=txt_f, fill=GRAY)
        mu_y += 52

    y += card2_h + 30

    # ── 6. Tips card ──
    tips_h = 180
    d.rounded_rectangle([card2_m, y, CW-card2_m, y+tips_h],
                          radius=20, fill=BG, outline=ACCENT, width=2)
    tips_title_f = Fb(32)
    d.text((card2_m+28, y+22), "高光推荐 · 加分技巧", font=tips_title_f, fill=ACCENT)
    d.line([(card2_m+20, y+62),(CW-card2_m-20, y+62)], fill=ACCENT, width=1)
    tips_f = F(26)
    hl_text = f"高光：{info['highlight']}"
    hl_bb = d.textbbox((0,0), hl_text, font=tips_f)
    d.text((card2_m+28, y+76), hl_text, font=tips_f, fill=DARK)
    tip2 = "穿搭技巧：从色盘中选主色，一次最多搭配2-3个颜色"
    d.text((card2_m+28, y+124), tip2, font=tips_f, fill=GRAY)
    y += tips_h + 24

    # ── 7. Footer ──
    foot_y = CH - 80
    d.line([(60, foot_y),(CW-60, foot_y)], fill=LIGHT_GRAY, width=1)
    disc = "娱乐/风格参考 · 照片光线会影响判定 · 不作医疗或优劣评价"
    disc_f = F(23)
    db = d.textbbox((0,0), disc, font=disc_f)
    d.text(((CW-(db[2]-db[0]))//2, foot_y+14), disc, font=disc_f, fill=GRAY)
    brand_f = Fb(26)
    brd = "Runae · 个人色彩分析"
    brd_b = d.textbbox((0,0), brd, font=brand_f)
    d.text(((CW-(brd_b[2]-brd_b[0]))//2, foot_y+46), brd, font=brand_f, fill=ACCENT)

    # Bottom accent band
    d.rectangle([0, CH-8, CW, CH], fill=ACCENT)

    os.makedirs(OUTDIR, exist_ok=True)
    cv.save(out_path, quality=95)
    print(f"SAVED: {out_path}")


def main():
    inp = sys.argv[1] if len(sys.argv) > 1 else None
    if not inp:
        c = glob.glob("/Users/karen/Downloads/*6639170629074168189*.jpeg")
        inp = c[0] if c else None
    if not inp:
        print("NO_PHOTO"); return
    print("Using photo:", inp)

    im, P = detect_face(inp)
    if not P: print("NO_FACE"); return

    arr = np.array(im)
    def S(i): return sample_patch(arr, P[i][0], P[i][1])

    # Sample key colors
    skin_samples = [v for v in [S(50),S(280),S(101),S(330),S(151)] if v is not None]
    skin = np.median(skin_samples, axis=0) if skin_samples else np.array([200,170,150])

    lip_samples = [v for v in [S(0),S(17),S(13)] if v is not None]
    lip = np.median(lip_samples, axis=0) if lip_samples else np.array([180,90,90])

    iris_samples = [v for v in [S(468),S(473)] if v is not None]
    iris = np.median(iris_samples, axis=0) if iris_samples else np.array([80,60,50])

    # Hair: sample above face
    ys_all = [p[1] for p in P]; top_y = min(ys_all)
    hair = sample_patch(arr, P[10][0], max(0, top_y - int(im.height*0.04)), r=12)
    if hair is None or rgb_to_lab(hair)[0] > 62:
        hair = np.array([55, 42, 38])

    season = classify_season(skin, hair, lip, iris)
    print(f"Season: {season}")
    print(f"Skin {hexof(skin)}, Hair {hexof(hair)}, Lip {hexof(lip)}, Iris {hexof(iris)}")

    out = os.path.join(OUTDIR, "个人色彩报告-v2.png")
    make_color_report(im, P, skin, hair, lip, iris, season, out)

if __name__ == "__main__":
    main()
