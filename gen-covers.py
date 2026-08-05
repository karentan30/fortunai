#!/usr/bin/env python3
"""善缘封面图生成 v2 — 专家评审后优化版 · ComfyUI · RealVisXL_V5 · 9:16竖版"""

import json, urllib.request, urllib.parse, time, os, random

API = "http://127.0.0.1:8188"
OUT = os.path.expanduser("~/projects/shenyuan/docs/ad-images/covers")
os.makedirs(OUT, exist_ok=True)

IMAGES = [
    {
        "name": "cover1-bazi-v2",
        "positive": (
            "minimalist Chinese BaZi destiny chart, four elegant vertical columns arranged side by side, "
            "each column containing two glowing golden Chinese seal characters heavenly stems earthly branches, "
            "ultra-thin gold grid lines framing each cell, deep midnight blue-violet background, "
            "floating gold dust particles, soft inner glow on characters, premium luxury aesthetic, "
            "negative space dominant, clean modern layout, spiritual mystical atmosphere, "
            "8k, ultra-detailed, cinematic lighting"
        ),
        "negative": (
            "zodiac wheel, circular chart, Western astrology, busy composition, people, faces, "
            "red background, dragon motifs, neon, low quality, blurry text, cluttered, photorealistic human"
        ),
    },
    {
        "name": "cover2-tarot-v2",
        "positive": (
            "single mystical tarot card levitating in dark void, slight tilt angle, "
            "golden ornate frame glowing intensely, blinding light burst erupting from card center, "
            "moon crescent symbol on card face radiating white gold light, "
            "dense glowing particles and stardust swirling around card, "
            "deep violet midnight blue background, dramatic chiaroscuro lighting, "
            "cinematic lens flare, hyperdetailed card texture, "
            "8k, ultra sharp, breathtaking, award winning digital art"
        ),
        "negative": (
            "flat lighting, dull, low contrast, static, boring composition, "
            "photorealistic face, horror, multiple cards, "
            "low quality, blurry, washed out colors, plain background"
        ),
    },
    # cover3 跑3次取最佳（SD人物一致性有限，多跑选好的）
    {
        "name": "cover3-restore-v2a",
        "positive": (
            "left-right split image, photo restoration concept, "
            "left half extremely blurry faded sepia black and white vintage photograph of elderly Chinese woman face, "
            "torn damaged edges, film grain, water stains, barely visible features, 1950s style, "
            "right half same elderly Chinese woman face beautifully restored colorized, "
            "warm skin tones, sharp clear eyes, gentle smile, bright colors, detailed hair strands, "
            "vertical glowing golden light beam dividing center, "
            "emotional nostalgic mood, tender bittersweet atmosphere, 8k cinematic"
        ),
        "negative": (
            "two different people, modern background, horror, ugly, distorted face, "
            "anime, cartoon, top-bottom split, harsh lighting, clinical cold tone"
        ),
    },
    {
        "name": "cover3-restore-v2b",
        "positive": (
            "side by side photo comparison before and after restoration, "
            "left side old damaged black white photograph elderly asian grandmother, blurry grainy faded, torn edges, sepia vintage, "
            "right side same grandmother photo fully restored, colorized warm amber tones, clear sharp details, gentle expression, "
            "golden vertical light divider in center glowing, "
            "emotional memory healing concept, nostalgia, love, 8k photorealistic"
        ),
        "negative": (
            "different people, top bottom split, modern setting, scary, horror, "
            "cartoon, anime, cold blue lighting, low quality"
        ),
    },
    {
        "name": "cover3-restore-v2c",
        "positive": (
            "photo restoration split screen, left dark vintage monochrome portrait elderly Chinese woman, "
            "heavily degraded worn damaged photograph aesthetic, "
            "right side restored version same woman vivid colors warm lighting clear features detailed, "
            "center vertical golden light streak separation, "
            "cinematic emotional tender mood, photorealistic, 8k"
        ),
        "negative": (
            "two different women, top bottom layout, modern city background, horror, ugly, "
            "painting, illustration, blurry both sides, cold tone"
        ),
    },
]

def build_workflow(positive, negative, seed):
    return {
        "3": {"class_type": "KSampler", "inputs": {
            "seed": seed, "steps": 30, "cfg": 7.0,
            "sampler_name": "dpmpp_2m", "scheduler": "karras",
            "denoise": 1.0, "model": ["4", 0],
            "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0]
        }},
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {
            "ckpt_name": "RealVisXL_V5.safetensors"
        }},
        "5": {"class_type": "EmptyLatentImage", "inputs": {
            "width": 832, "height": 1216, "batch_size": 1
        }},
        "6": {"class_type": "CLIPTextEncode", "inputs": {
            "text": positive, "clip": ["4", 1]
        }},
        "7": {"class_type": "CLIPTextEncode", "inputs": {
            "text": negative, "clip": ["4", 1]
        }},
        "8": {"class_type": "VAEDecode", "inputs": {
            "samples": ["3", 0], "vae": ["4", 2]
        }},
        "9": {"class_type": "SaveImage", "inputs": {
            "filename_prefix": "shenyuan_cover", "images": ["8", 0]
        }},
    }

def queue(workflow):
    data = json.dumps({"prompt": workflow}).encode()
    req = urllib.request.Request(f"{API}/prompt", data=data,
                                  headers={"Content-Type": "application/json"})
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read())["prompt_id"]

def wait(prompt_id):
    while True:
        resp = urllib.request.urlopen(f"{API}/history/{prompt_id}")
        hist = json.loads(resp.read())
        if prompt_id in hist:
            return hist[prompt_id]
        time.sleep(2)

def save(result, name):
    for node in result["outputs"].values():
        if "images" in node:
            for img in node["images"]:
                url = f"{API}/view?filename={urllib.parse.quote(img['filename'])}&subfolder={img['subfolder']}&type={img['type']}"
                resp = urllib.request.urlopen(url)
                path = os.path.join(OUT, f"{name}.png")
                with open(path, "wb") as f:
                    f.write(resp.read())
                print(f"  ✅ {path}")
                return path

print(f"🎨 善缘封面图 v2（专家优化版）· 共 {len(IMAGES)} 张\n")

for img in IMAGES:
    print(f"⏳ {img['name']} ...")
    seed = random.randint(0, 2**32 - 1)
    wf = build_workflow(img["positive"], img["negative"], seed)
    pid = queue(wf)
    result = wait(pid)
    save(result, img["name"])

print("\n🎉 完成！cover3 出了 a/b/c 三版，选最佳那张用。")
print(f"📁 {OUT}")
