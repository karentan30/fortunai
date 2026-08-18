#!/usr/bin/env python3
"""Batch-generate Runae report ambiance art via local ComfyUI (RealVisXL_V5)."""
import json, random, time, sys, urllib.request, urllib.error

COMFY = "http://127.0.0.1:8188"

STYLE = ("Chinese ink wash painting on aged rice paper, shan shui landscape, "
         "muted teal and sage green tones with warm gold amber accents and coral red highlights, "
         "atmospheric misty negative space, loose elegant brushwork, "
         "traditional oriental art, serene poetic mood, soft ink gradients, "
         "masterpiece, highly detailed, fine art")

NEG = ("text, letters, chinese characters, words, signature, watermark, "
       "human face closeup, portrait, ugly, low quality, blurry, deformed, "
       "modern, photorealistic western, oversaturated, cartoon, 3d render, frame, border")

# theme -> subject description
THEMES = {
    "family": "a warm family reunion scene under a full moon, cozy village houses with glowing lanterns, wild geese flying home together, tender togetherness, autumn warmth",
    "children": "gentle new life, tender lotus buds and sprouting seedlings by calm water, a mother swallow feeding hatchlings in nest, soft dawn light, hope and renewal",
    "study": "scholarly bamboo grove and open ancient scrolls and bamboo slips on a desk, ink brush and inkstone, quiet study pavilion, wisdom and learning, morning light through bamboo",
    "travel": "a winding mountain path into cloud sea, distant traveler crossing bridge, wild geese returning across misty peaks, journey and departure, vast open horizon",
    "spirit": "zen meditation moonlit night, a lone figure silhouette meditating by still lake, quiet temple in mountains, inner peace, tranquil moon reflection, contemplative stillness",
    "marriage": "romantic union, intertwined red silk thread of destiny, twin mandarin ducks and paired blooming lotus flowers, harmony and love, soft rosy dusk",
    "ziwei": "purple starry night sky over floating celestial palaces and pavilions, constellations and swirling star clusters, mystical purple violet cosmos, ancient tower silhouette",
    "tarot": "mystical candlelit scene, flowing velvet drapery curtains, tarot mystery, crescent and full moon phases, glowing candles, western esoteric mystique, deep indigo and gold",
    "astrology": "western astrology, an ornate golden zodiac star chart wheel floating in warm amber cosmos, constellations and planets, celestial mysticism, glowing gold on deep blue",
    "fengshui": "feng shui geomancy landscape, flowing mountain dragon veins and winding river, an antique luopan compass motif, auspicious terrain, harmonious energy flow, misty valleys",
    "pastlife": "past life reincarnation, a long river of time flowing through cosmos, drifting lotus flowers on eternal waters, ethereal spiritual journey, soft glowing mist, timeless",
    "blessing": "temple blessing and offering, rising incense smoke and auspicious clouds, ancient mountain temple with lanterns, sacred serene atmosphere, golden divine light, prayer",
    "fortune-year": "four seasons cycle in one landscape, spring blossoms summer green autumn maple winter snow flowing together, wheel of the year, changing fortunes, harmonious transition",
}

def submit(theme, subj, seed):
    prompt = f"{subj}, {STYLE}"
    wf = {
        "4": {"class_type": "CheckpointLoaderSimple",
              "inputs": {"ckpt_name": "RealVisXL_V5.safetensors"}},
        "6": {"class_type": "CLIPTextEncode",
              "inputs": {"text": prompt, "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode",
              "inputs": {"text": NEG, "clip": ["4", 1]}},
        "5": {"class_type": "EmptyLatentImage",
              "inputs": {"width": 1216, "height": 832, "batch_size": 1}},
        "3": {"class_type": "KSampler",
              "inputs": {"seed": seed, "steps": 30, "cfg": 6.5,
                         "sampler_name": "dpmpp_2m", "scheduler": "karras",
                         "denoise": 1.0, "model": ["4", 0],
                         "positive": ["6", 0], "negative": ["7", 0],
                         "latent_image": ["5", 0]}},
        "8": {"class_type": "VAEDecode",
              "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage",
              "inputs": {"filename_prefix": f"runae_{theme}", "images": ["8", 0]}},
    }
    data = json.dumps({"prompt": wf}).encode()
    req = urllib.request.Request(f"{COMFY}/prompt", data=data,
                                 headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=30).read())["prompt_id"]

def wait(pid, timeout=300):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            h = json.loads(urllib.request.urlopen(f"{COMFY}/history/{pid}", timeout=15).read())
            if pid in h:
                outs = h[pid]["outputs"]
                for n in outs.values():
                    if "images" in n:
                        return n["images"][0]["filename"]
        except urllib.error.URLError:
            pass
        time.sleep(3)
    return None

def main():
    only = sys.argv[1:] if len(sys.argv) > 1 else list(THEMES.keys())
    for theme in only:
        subj = THEMES[theme]
        seed = random.randint(1, 2**31)
        try:
            pid = submit(theme, subj, seed)
        except Exception as e:
            print(f"FAIL {theme}: submit error {e}", flush=True)
            continue
        fn = wait(pid)
        print(f"{'OK' if fn else 'TIMEOUT'} {theme} seed={seed} -> {fn}", flush=True)

if __name__ == "__main__":
    main()
