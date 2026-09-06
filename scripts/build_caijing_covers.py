#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""彩镜·小红书封面生成器(3:4 · 1080×1440 · 叠字大而痛)
每个封面输出独立 HTML → 供 Chrome 无头渲染成 PNG。
设计:高对比、大叠字、真实色块、中文完美(系统字)。
用法: python3 build_caijing_covers.py  (生成 HTML)
渲染: 见文件末尾注释的 Chrome 命令 / 或 render_covers.sh
"""
import os

OUT = os.path.expanduser("~/projects/shenyuan/samples/caijing/covers")
os.makedirs(OUT, exist_ok=True)

BASE_CSS = """
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1440px;overflow:hidden}
body{font-family:"PingFang SC","Hiragino Sans GB","Songti SC",sans-serif;position:relative}
.tag{position:absolute;top:40px;left:48px;font-size:30px;letter-spacing:4px;
 color:#fff;background:rgba(0,0,0,.28);padding:10px 26px;border-radius:40px;font-weight:600}
.foot{position:absolute;left:0;bottom:44px;width:100%;text-align:center;
 font-size:26px;color:rgba(0,0,0,.4);font-weight:500;letter-spacing:1px}
.big{font-weight:800;line-height:1.12;letter-spacing:2px}
.chip{border-radius:20px;box-shadow:0 8px 22px rgba(0,0,0,.14)}
"""

def swatches(items, size=150, gap=28, cross=False):
    s = f'<div style="display:flex;flex-wrap:wrap;gap:{gap}px;justify-content:center">'
    for name, hx in items:
        x = ('<div style="position:absolute;inset:0;display:flex;align-items:center;'
             'justify-content:center;font-size:72px;color:rgba(255,255,255,.9);'
             'font-weight:800">✕</div>') if cross else ''
        s += (f'<div style="text-align:center">'
              f'<div class="chip" style="position:relative;width:{size}px;height:{size}px;'
              f'background:{hx};border:3px solid rgba(255,255,255,.7)">{x}</div>'
              f'<div style="font-size:26px;margin-top:12px;color:#5a4a3a;font-weight:600">{name}</div>'
              f'</div>')
    return s + '</div>'


COVERS = {}

# ---- C 省钱型 ----
COVERS["C_shengqian"] = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>{BASE_CSS}
body{{background:radial-gradient(120% 90% at 20% 0%,#fef6e9,#f6e7c8 60%,#f0dcb4)}}
.center{{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:920px;text-align:center}}
.pre{{font-size:56px;color:#8a7a5a;font-weight:700;letter-spacing:2px}}
.strike{{font-size:150px;color:#b8b0a0;text-decoration:line-through;text-decoration-thickness:8px;margin:6px 0}}
.arrow{{font-size:60px;color:#a8321f;margin:8px 0}}
.free{{font-size:190px;color:#a8321f;font-weight:800;letter-spacing:2px;line-height:1}}
.sub{{font-size:44px;color:#5a4a3a;margin-top:36px;font-weight:600}}
</style></head><body>
<div class="tag">彩镜 · 免费 AI 测色</div>
<div class="center">
 <div class="pre">线下色彩诊断报价</div>
 <div class="strike big">好几百到上千</div>
 <div class="arrow">↓ 我先测了个大方向 ↓</div>
 <div class="free big">0 元</div>
 <div class="sub">拍脸 30 秒 · 出四季型 + 适配色号</div>
</div>
<div class="foot">大方向参考 · 光线会影响判定 · 搜「彩镜测色」</div>
</body></html>"""

# ---- E 错题本型 ----
avoid = [("土黄","#C7A24B"),("驼色","#C79A6B"),("姜黄","#C98A1E"),
         ("暖橙","#E88A46"),("灰卡其","#A99A72"),("芥末绿","#8A8A3C")]
COVERS["E_cuotiben"] = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>{BASE_CSS}
body{{background:linear-gradient(160deg,#fbf5ea,#f2e6cf)}}
.title{{position:absolute;top:150px;left:0;width:100%;text-align:center}}
.t1{{font-size:82px;color:#3a2a20;font-weight:800;letter-spacing:2px}}
.t2{{font-size:60px;color:#a8321f;font-weight:800;margin-top:22px}}
.grid{{position:absolute;top:500px;left:50%;transform:translateX(-50%);width:620px}}
.hint{{position:absolute;bottom:150px;left:0;width:100%;text-align:center;
 font-size:44px;color:#5a4a3a;font-weight:700;line-height:1.4}}
</style></head><body>
<div class="tag">彩镜 · 免费 AI 测色</div>
<div class="title">
 <div class="t1 big">你也在穿这些</div>
 <div class="t2 big">"显土色"吗？</div>
</div>
<div class="grid">{swatches(avoid, size=165, gap=30, cross=True)}</div>
<div class="hint">可能不是你的错<br>是这些色不顺你的季型</div>
<div class="foot">大方向参考 · 光线会影响判定 · 搜「彩镜测色」</div>
</body></html>"""

# ---- G 冷暖色块型 ----
cold = [("正红","#E1122B"),("宝蓝","#1E3FD6"),("玫红","#C41E8A"),("纯白","#FFFFFF")]
warm = [("珊瑚","#FF7F50"),("豆沙","#C56A5C"),("焦糖","#B5652B"),("鹅黄","#F2CE5B")]
def col(items, label, bg):
    s = (f'<div style="flex:1;background:{bg};display:flex;flex-direction:column;'
         f'align-items:center;justify-content:center;gap:30px;padding:60px 0">')
    s += f'<div style="font-size:56px;color:#3a2a20;font-weight:800;margin-bottom:14px">{label}</div>'
    for name, hx in items:
        s += (f'<div style="text-align:center">'
              f'<div class="chip" style="width:200px;height:120px;background:{hx};'
              f'border:3px solid rgba(255,255,255,.7)"></div></div>')
    return s + '</div>'
COVERS["G_lengnuan"] = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>{BASE_CSS}
body{{background:#fff}}
.split{{position:absolute;inset:0;display:flex}}
.q{{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
 background:#fff;border-radius:30px;padding:34px 54px;box-shadow:0 16px 40px rgba(0,0,0,.2);
 font-size:64px;color:#3a2a20;font-weight:800;text-align:center;white-space:nowrap}}
</style></head><body>
<div class="tag" style="z-index:5">彩镜 · 免费 AI 测色</div>
<div class="split">
 {col(cold,"冷调","linear-gradient(160deg,#e8f0fb,#d3e0f5)")}
 {col(warm,"暖调","linear-gradient(160deg,#fdf0e0,#f7dcc0)")}
</div>
<div class="q">你天生更爱哪边？</div>
<div class="foot" style="z-index:5">拍脸 30 秒测你的季型 · 搜「彩镜测色」</div>
</body></html>"""

# ---- 季型标签拼贴 ----
seasons = [
    ("冷冬型","高对比·强气场","#E1122B","#fbeaec"),
    ("夏冷型","温柔莫兰迪","#7C8BB0","#eef0f6"),
    ("暖春型","行走的多巴胺","#FF9E3D","#fdf1e0"),
    ("暖秋型","大地焦糖·松弛感","#B5652B","#f6ead9"),
]
def quad(name, tag, accent, bg):
    return (f'<div style="background:{bg};display:flex;flex-direction:column;'
            f'align-items:center;justify-content:center;gap:16px">'
            f'<div style="font-size:64px;font-weight:800;color:{accent}">{name}</div>'
            f'<div style="font-size:36px;color:#5a4a3a;font-weight:600">{tag}</div></div>')
COVERS["biaoqian_renshe"] = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>{BASE_CSS}
body{{background:#fff}}
.grid{{position:absolute;inset:0;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr}}
.title{{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:5;
 background:#3a2a20;color:#fff;border-radius:30px;padding:30px 54px;white-space:nowrap;
 font-size:56px;font-weight:800;box-shadow:0 16px 40px rgba(0,0,0,.28)}}
</style></head><body>
<div class="tag" style="z-index:6">彩镜 · 免费 AI 测色</div>
<div class="grid">
 {quad(*seasons[0])}{quad(*seasons[1])}{quad(*seasons[2])}{quad(*seasons[3])}
</div>
<div class="title">你是哪个季型人设？</div>
<div class="foot" style="z-index:6">拍脸 30 秒对号入座 · 搜「彩镜测色」</div>
</body></html>"""

for name, html in COVERS.items():
    p = os.path.join(OUT, f"cover_{name}.html")
    open(p, "w").write(html)
    print("HTML:", p)
print(f"\n共 {len(COVERS)} 个封面 HTML -> {OUT}")
