#!/usr/bin/env python3
"""善缘50条内容封面图生成 · 10张 A-J · ComfyUI · RealVisXL_V5"""

import json, urllib.request, urllib.parse, time, os, random

API = "http://127.0.0.1:8188"
OUT = os.path.expanduser("~/projects/shenyuan/docs/ad-images/covers")
os.makedirs(OUT, exist_ok=True)

IMAGES = [
    {"name":"cover-A-hehun","label":"合婚/爱情（#05/#24/#42/#47）",
     "positive":"two silhouettes facing each other, surrounded by glowing golden Chinese BaZi characters floating in air, deep violet midnight background, warm golden particles, yin yang symbol, romantic spiritual atmosphere, premium luxury aesthetic, 8k cinematic",
     "negative":"photorealistic faces, modern city, horror, cartoon, busy background, low quality, blurry"},
    {"name":"cover-B-huoma","label":"火马年（#02/#25/#40）",
     "positive":"majestic fire horse running through golden flames, traditional Chinese art style meets modern luxury, crimson and gold color palette, 2026 year of horse, spiritual power, dramatic cinematic lighting, 8k ultra detailed",
     "negative":"cartoon, anime, western style, ugly, low quality, dark horror, blurry"},
    {"name":"cover-C-caiyun","label":"财运（#07/#18/#28）",
     "positive":"golden coins and ancient Chinese currency floating in mystical void, glowing wealth symbols, dark navy background with gold particles, prosperity concept, luxury financial aesthetic, ancient wisdom meets modern wealth, 8k cinematic",
     "negative":"modern bank, cartoon money, western symbols, low quality, busy, blurry"},
    {"name":"cover-D-daily","label":"每日运势（#16/#43/#46）",
     "positive":"elegant star map and moon phases in ancient Chinese astronomical style, deep indigo background, silver and gold celestial lines, daily guidance concept, mystical almanac aesthetic, floating light particles, 8k ultra detailed",
     "negative":"western zodiac wheel, cartoon, low quality, bright neon colors, busy, blurry"},
    {"name":"cover-E-haiwai","label":"海外思乡（#08/#13/#30/#38）",
     "positive":"misty bridge between two worlds, left side modern city skyline right side traditional Chinese architecture, warm nostalgic amber tones, overseas Chinese diaspora, fog and longing atmosphere, photorealistic, 8k cinematic",
     "negative":"cartoon, anime, bright neon colors, horror, low quality, blurry, cold tone"},
    {"name":"cover-F-jieqi","label":"节气/自然（#09/#19/#44/#48）",
     "positive":"ancient Chinese solar terms seasonal wheel, lotus flowers blooming in moonlit water, ink wash painting style meets luxury gold, four seasons transition, nature and cosmic harmony, 8k ultra detailed",
     "negative":"western seasons, cartoon, modern style, low quality, blurry, harsh colors"},
    {"name":"cover-G-dongxi","label":"东西方命理（#10/#27/#34/#39）",
     "positive":"split composition left BaZi chart golden right western astrology wheel silver, golden light dividing line in center, deep purple background, East meets West spiritual wisdom, luxury aesthetic, 8k",
     "negative":"busy, cluttered, low quality, cartoon, harsh colors, blurry"},
    {"name":"cover-H-moon","label":"月亮/中秋（#19/#37/#47）",
     "positive":"full moon over misty mountains with traditional Chinese pavilion silhouette, lanterns floating upward, Mid-Autumn Festival atmosphere, silver and warm gold tones, romantic lonely overseas mood, cinematic 8k ultra detailed",
     "negative":"modern city, cartoon, anime, low quality, daylight, cold colors, blurry"},
    {"name":"cover-I-tarot","label":"塔罗（#14/#22/#32）",
     "positive":"ornate tarot card levitating in void, Chinese dragon and phoenix motifs on card face, golden patterns on deep violet velvet background, mystical glowing edges and particle effects, luxury spiritual aesthetic, 8k ultra detailed",
     "negative":"western only, cheap, low quality, flat, modern minimalism, blurry, cartoon"},
    {"name":"cover-J-wuxing","label":"五行能量（#01/#06/#12/#17/#33）",
     "positive":"five glowing energy orbs representing Wu Xing: emerald green wood, crimson fire, golden earth, white metal, deep blue water, arranged in Chinese cycle pattern, dark void background, energy streams connecting them, sacred geometry, 8k cinematic",
     "negative":"flat icons, cartoon, low quality, western chakra style, busy background, blurry"},
]

def build_wf(pos, neg, seed):
    return {
        "3":{"class_type":"KSampler","inputs":{"seed":seed,"steps":30,"cfg":7.0,"sampler_name":"dpmpp_2m","scheduler":"karras","denoise":1.0,"model":["4",0],"positive":["6",0],"negative":["7",0],"latent_image":["5",0]}},
        "4":{"class_type":"CheckpointLoaderSimple","inputs":{"ckpt_name":"RealVisXL_V5.safetensors"}},
        "5":{"class_type":"EmptyLatentImage","inputs":{"width":832,"height":1216,"batch_size":1}},
        "6":{"class_type":"CLIPTextEncode","inputs":{"text":pos,"clip":["4",1]}},
        "7":{"class_type":"CLIPTextEncode","inputs":{"text":neg,"clip":["4",1]}},
        "8":{"class_type":"VAEDecode","inputs":{"samples":["3",0],"vae":["4",2]}},
        "9":{"class_type":"SaveImage","inputs":{"filename_prefix":"sy50","images":["8",0]}},
    }

def queue(wf):
    data=json.dumps({"prompt":wf}).encode()
    req=urllib.request.Request(f"{API}/prompt",data=data,headers={"Content-Type":"application/json"})
    return json.loads(urllib.request.urlopen(req).read())["prompt_id"]

def wait(pid):
    while True:
        hist=json.loads(urllib.request.urlopen(f"{API}/history/{pid}").read())
        if pid in hist: return hist[pid]
        time.sleep(3)

def save(result,name):
    for node in result["outputs"].values():
        if "images" in node:
            for img in node["images"]:
                url=f"{API}/view?filename={urllib.parse.quote(img['filename'])}&subfolder={img['subfolder']}&type={img['type']}"
                path=os.path.join(OUT,f"{name}.png")
                with open(path,"wb") as f: f.write(urllib.request.urlopen(url).read())
                return path

print(f"🎨 善缘内容封面 10张 · 约{len(IMAGES)*3}分钟\n")
for i,img in enumerate(IMAGES,1):
    print(f"[{i}/{len(IMAGES)}] ⏳ {img['name']} ({img['label']})...")
    t0=time.time()
    pid=queue(build_wf(img["positive"],img["negative"],random.randint(0,2**32-1)))
    result=wait(pid)
    path=save(result,img["name"])
    print(f"  ✅ {path}（{int(time.time()-t0)}秒）")
print(f"\n🎉 完成！全部保存至 {OUT}/")
