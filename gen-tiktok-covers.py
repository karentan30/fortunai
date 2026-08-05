"""
TikTok竖版封面图生成 - ComfyUI队列
尺寸：768×1344（9:16）  输出：~/projects/shenyuan/docs/ad-images/tiktok-covers/
"""
import json, urllib.request, time, os

COMFY_URL = "http://127.0.0.1:8188"
OUTPUT_DIR = os.path.expanduser("~/projects/shenyuan/docs/ad-images/tiktok-covers")

JOBS = [
    # 善缘
    {"name": "tiktok-shenyuan-1", "pos": "dramatic close-up of chinese fortune telling coins on dark purple silk, golden light, high contrast, cinematic, top third very dark for text overlay, 8k photorealistic", "neg": "text, watermark, bright top"},
    {"name": "tiktok-shenyuan-2", "pos": "mystical eye with galaxy reflection, deep purple and gold, dramatic shadows, surreal portrait, dark top area for text, 8k", "neg": "text, watermark, ugly"},
    {"name": "tiktok-shenyuan-3", "pos": "glowing tarot card emerging from darkness, golden particles, high contrast dramatic lighting, vertical portrait orientation, dark top for text overlay, 8k", "neg": "text, watermark, ugly"},
    # Lumee
    {"name": "tiktok-lumee-1", "pos": "young asian woman at night looking at glowing phone, warm purple light, emotional expression, cinematic portrait, dark top area for text, 8k", "neg": "text, watermark, sad, ugly"},
    {"name": "tiktok-lumee-2", "pos": "sound waves glowing pink and purple against black background, dramatic gradient, high impact minimal design, vertical orientation, 8k", "neg": "text, watermark, ugly"},
    {"name": "tiktok-lumee-3", "pos": "two hands almost touching through glowing phone screen, warm light, emotional connection, dramatic bokeh, portrait 8k, dark top for text", "neg": "text, watermark, ugly"},
    # 舞镜
    {"name": "tiktok-wujing-1", "pos": "asian female dancer frozen in powerful mid-air jump, red dramatic spotlight, pure black background, high energy, dark top space for text, 8k", "neg": "text, watermark, static, blurry"},
    {"name": "tiktok-wujing-2", "pos": "dancer silhouette against bright red and white neon lights, street style, high contrast, cinematic vertical, 8k", "neg": "text, watermark, ugly"},
    {"name": "tiktok-wujing-3", "pos": "close up of dancer feet in motion blur, studio wooden floor, dramatic red side lighting, dynamic energy, vertical 8k", "neg": "text, watermark, static"},
    # YiYi
    {"name": "tiktok-yiyi-1", "pos": "happy asian child face in pure excitement during english lesson, bright yellow background, joyful expression, high energy, dark top for text, 8k", "neg": "text, watermark, sad, ugly"},
    {"name": "tiktok-yiyi-2", "pos": "foreign caucasian teacher and chinese student high-five in bright classroom, genuine joy, warm colors, portrait 8k, natural top space", "neg": "text, watermark, ugly, formal"},
    {"name": "tiktok-yiyi-3", "pos": "confident asian child speaking english, bright blue and yellow background, expressive face, educational energy, portrait 8k", "neg": "text, watermark, shy, ugly"},
    # Slim
    {"name": "tiktok-slim-1", "pos": "beautiful colorful healthy food bowl overhead shot on white marble, fresh vegetables and protein, high saturation, styled food photography, dark top for text, 8k", "neg": "text, watermark, junk food, ugly"},
    {"name": "tiktok-slim-2", "pos": "confident smiling asian woman holding healthy meal prep containers, bright natural light, green accents, portrait 8k, genuine happiness", "neg": "text, watermark, sad, ugly"},
    {"name": "tiktok-slim-3", "pos": "dramatic side by side split: unhealthy junk food vs colorful healthy food, bold high contrast colors, clean white divider, vertical format 8k", "neg": "text, watermark, ugly"},
]

def queue_prompt(workflow):
    data = json.dumps({"prompt": workflow}).encode("utf-8")
    req = urllib.request.Request(f"{COMFY_URL}/prompt", data=data, headers={"Content-Type": "application/json"})
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read())

def make_workflow(pos, neg, name):
    return {
        "3": {"class_type": "KSampler", "inputs": {"cfg": 7.5, "denoise": 1, "latent_image": ["5", 0], "model": ["4", 0], "negative": ["7", 0], "positive": ["6", 0], "sampler_name": "dpm_2", "scheduler": "karras", "seed": abs(hash(name)) % 999999, "steps": 25}},
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "RealVisXL_V5.safetensors"}},
        "5": {"class_type": "EmptyLatentImage", "inputs": {"batch_size": 1, "height": 1344, "width": 768}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["4", 1], "text": pos}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["4", 1], "text": neg + ", nsfw, nude, logo, brand"}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": f"tiktok-covers/{name}", "images": ["8", 0]}},
    }

try:
    urllib.request.urlopen(f"{COMFY_URL}/system_stats", timeout=3)
    print("✅ ComfyUI运行中")
except:
    print("❌ ComfyUI未运行")
    exit(1)

os.makedirs(OUTPUT_DIR, exist_ok=True)

print(f"提交 {len(JOBS)} 张TikTok竖版封面...\n")
for i, job in enumerate(JOBS):
    wf = make_workflow(job["pos"], job["neg"], job["name"])
    result = queue_prompt(wf)
    pid = result.get("prompt_id", "?")
    print(f"[{i+1:02d}/{len(JOBS)}] {job['name']} → {pid}")
    time.sleep(0.3)

print(f"\n✅ 全部 {len(JOBS)} 张已入队")
print(f"输出目录: {OUTPUT_DIR}")
