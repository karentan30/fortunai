#!/usr/bin/env python3
"""Runae celestial/mystical hero image generator. Zero credit, pure local, RealVisXL_V5.
Usage: cd ~/ComfyUI && ./venv/bin/python <thisfile> [--test]
"""
import json, urllib.request, urllib.parse, time, os, random, sys

SERVER = "127.0.0.1:8188"
CKPT = "RealVisXL_V5.safetensors"
OUTDIR = os.path.dirname(os.path.abspath(__file__))
POS_SUFFIX = "cinematic still, film grain, shallow depth of field, deep indigo navy and warm gold color grade, mystical celestial ethereal, no people, no text"
NEG = "people, person, human, face, hands, text, letters, chinese characters, red lantern, temple, watermark, harsh lighting, oversaturated, cartoon, deformed, cluttered, low quality"
W, H, STEPS, CFG = 896, 1152, 30, 6.5

JOBS = [
    ("hero-01-moon.png",         "full moon over deep indigo starry night sky, golden stars, ethereal", None),
    ("hero-02-nebula.png",       "cosmic nebula deep blue and purple, glowing gold stardust", None),
    ("hero-03-divination.png",   "candlelit dark table with mystical divination objects, soft golden glow", None),
    ("hero-04-incense.png",      "incense smoke curling in dark moody air lit by warm gold", None),
    ("hero-05-book.png",         "open antique book with faint celestial astrological diagrams, warm lamp", None),
    ("hero-06-crystals.png",     "quartz crystals on dark surface, soft ethereal glow", None),
    ("hero-07-window.png",       "moonlit window with starry constellation sky beyond, dreamy", None),
    ("hero-08-constellation.png","glowing golden constellation lines on deep navy, abstract cosmic", None),
    ("hero-09-water.png",        "golden light ripples on dark still water at night, serene", None),
    ("hero-10-galaxy.png",       "silhouetted mountains under vast starry galaxy sky, deep blue", None),
    ("hero-11-lightrays.png",    "soft golden light rays through dark misty ethereal space", None),
    ("hero-12-crescent.png",     "crescent moon and drifting clouds in deep violet night sky", None),
]

def build_workflow(pos, seed):
    return {
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CKPT}},
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": W, "height": H, "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": pos + ", " + POS_SUFFIX, "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": NEG, "clip": ["4", 1]}},
        "3": {"class_type": "KSampler", "inputs": {
            "seed": seed, "steps": STEPS, "cfg": CFG,
            "sampler_name": "dpmpp_2m", "scheduler": "karras", "denoise": 1.0,
            "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "runae_tmp", "images": ["8", 0]}},
    }

def submit(wf):
    data = json.dumps({"prompt": wf}).encode()
    req = urllib.request.Request(f"http://{SERVER}/prompt", data=data, headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req).read())["prompt_id"]

def wait(pid, timeout=300):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            h = json.loads(urllib.request.urlopen(f"http://{SERVER}/history/{pid}").read())
            if pid in h and h[pid].get("outputs"):
                return h[pid]["outputs"]
        except Exception:
            pass
        time.sleep(2)
    raise TimeoutError(pid)

def fetch_image(info):
    for node in info.values():
        for im in node.get("images", []):
            q = urllib.parse.urlencode({"filename": im["filename"], "subfolder": im.get("subfolder",""), "type": im.get("type","output")})
            return urllib.request.urlopen(f"http://{SERVER}/view?{q}").read()
    return None

def run_one(fname, pos, seed):
    s = seed if seed is not None else random.randint(1, 2**31)
    print(f"[gen] {fname} seed={s}", flush=True)
    pid = submit(build_workflow(pos, s))
    out = wait(pid)
    data = fetch_image(out)
    path = os.path.join(OUTDIR, fname)
    with open(path, "wb") as f:
        f.write(data)
    print(f"[done] {path} {len(data)} bytes", flush=True)

def main():
    jobs = JOBS[:1] if "--test" in sys.argv else JOBS
    for fname, pos, seed in jobs:
        run_one(fname, pos, seed)

if __name__ == "__main__":
    main()
