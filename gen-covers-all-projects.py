"""
批量生成5个项目封面图 - ComfyUI队列
运行前确保ComfyUI在 http://127.0.0.1:8188
"""
import json, urllib.request, time, os

COMFY_URL = "http://127.0.0.1:8188"
OUTPUT_BASE = os.path.expanduser("~/projects/shenyuan/docs/ad-images/covers")

JOBS = [
    # 善缘 - 深紫金神秘风（已有A-J，补充人物/场景）
    {"name": "shenyuan-bagua", "prompt": "mystical chinese bagua symbol floating in dark purple cosmic space, golden light rays, ethereal energy, dramatic lighting, 8k, photorealistic", "neg": "text, watermark, ugly"},
    {"name": "shenyuan-tarot-hand", "prompt": "elegant asian woman hands holding glowing tarot card, purple crystal bokeh background, golden particles, mystical atmosphere, 8k", "neg": "text, logo, ugly, western"},
    
    # Lumee - 暖紫粉情感风
    {"name": "lumee-emotion", "prompt": "young chinese woman sitting by window at night, warm purple light, looking at phone with gentle smile, emotional moment, soft bokeh, 8k cinematic", "neg": "text, watermark, sad, crying"},
    {"name": "lumee-voice", "prompt": "sound wave visualization in soft pink and purple gradient, golden particles floating, dreamy background, emotional warmth, minimalist 8k", "neg": "text, ugly, dark"},
    {"name": "lumee-couple", "prompt": "couple silhouette looking at glowing phone screen together, warm evening light, purple sky, romantic atmosphere, 8k", "neg": "text, explicit, ugly"},
    
    # 舞镜 - 黑红动感街头
    {"name": "wujing-dance-energy", "prompt": "dynamic female dancer mid-movement, red and black dramatic lighting, motion blur, street dance energy, professional photography, 8k", "neg": "text, static, ugly, blurry"},
    {"name": "wujing-kpop", "prompt": "young asian dancer kpop style, stage lighting red and white, powerful pose, sparkles, professional concert photography, 8k", "neg": "text, ugly, amateur"},
    {"name": "wujing-practice", "prompt": "dance studio mirror reflection, asian woman practicing ballet modern fusion, warm natural light, clean minimal space, 8k", "neg": "text, ugly, dark"},
    
    # YiYi英语 - 活泼教育蓝黄
    {"name": "yiyi-teacher", "prompt": "friendly caucasian female teacher with asian child student, bright classroom, yellow and blue accents, genuine smile, educational warmth, 8k", "neg": "text, ugly, formal, stiff"},
    {"name": "yiyi-learning", "prompt": "child happily speaking english with tablet showing foreign teacher, cozy home environment, warm lighting, joyful expression, 8k", "neg": "text, sad, ugly, dark"},
    
    # Slim - 健康清新绿白
    {"name": "slim-food-healthy", "prompt": "beautiful healthy asian food bowl, colorful vegetables and protein, clean white background, top down view, natural light, food photography 8k", "neg": "text, junk food, ugly, dark"},
    {"name": "slim-body-positive", "prompt": "asian woman doing yoga in bright minimal studio, green plant wall background, natural morning light, healthy and confident, 8k", "neg": "text, ugly, dark, sad"},
]

def queue_prompt(prompt_data):
    data = json.dumps({"prompt": prompt_data}).encode('utf-8')
    req = urllib.request.Request(f"{COMFY_URL}/prompt", data=data, headers={'Content-Type': 'application/json'})
    response = urllib.request.urlopen(req)
    return json.loads(response.read())

def make_workflow(positive, negative, filename):
    return {
        "3": {"class_type": "KSampler", "inputs": {"cfg": 7, "denoise": 1, "latent_image": ["5", 0], "model": ["4", 0], "negative": ["7", 0], "positive": ["6", 0], "sampler_name": "dpm_2", "scheduler": "karras", "seed": hash(filename) % 999999, "steps": 20}},
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "RealVisXL_V5.safetensors"}},
        "5": {"class_type": "EmptyLatentImage", "inputs": {"batch_size": 1, "height": 1216, "width": 832}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["4", 1], "text": positive}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["4", 1], "text": negative + ", nsfw, nude, watermark, logo"}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": filename, "images": ["8", 0]}}
    }

# 检查ComfyUI是否运行
try:
    urllib.request.urlopen(f"{COMFY_URL}/system_stats", timeout=3)
    print("✅ ComfyUI运行中")
except:
    print("❌ ComfyUI未运行，请先启动：cd ~/projects/vocab-project/ComfyUI && venv/bin/python main.py")
    exit(1)

os.makedirs(OUTPUT_BASE, exist_ok=True)

print(f"开始批量提交 {len(JOBS)} 个任务...")
for i, job in enumerate(JOBS):
    out_dir = os.path.join(OUTPUT_BASE, "projects")
    workflow = make_workflow(job["prompt"], job["neg"], f"projects/{job['name']}")
    result = queue_prompt(workflow)
    print(f"[{i+1}/{len(JOBS)}] 已提交: {job['name']} → prompt_id: {result.get('prompt_id','?')}")
    time.sleep(0.5)

print(f"\n✅ 全部 {len(JOBS)} 个任务已入队，ComfyUI后台自动处理")
print(f"完成后图片存放在: {OUTPUT_BASE}/projects/")
