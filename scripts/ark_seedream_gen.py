#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""火山 ARK Seedream 出图（对比用）· key=ARK_API_KEY"""
import os, sys, json, argparse, urllib.request, urllib.error
URL = "https://ark.cn-beijing.volces.com/api/v3/images/generations"

def gen(key, model, prompt, size, out):
    body = {"model": model, "prompt": prompt, "size": size, "n": 1, "response_format": "url"}
    req = urllib.request.Request(URL, data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=120) as r:
        resp = json.loads(r.read())
    url = resp["data"][0]["url"]
    urllib.request.urlretrieve(url, out)
    print(f"[已存] {out}  (model={model})")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prompt-file", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--size", default="1024x1024")
    ap.add_argument("--model", default="")
    a = ap.parse_args()
    key = os.environ.get("ARK_API_KEY")
    if not key: sys.exit("缺 ARK_API_KEY")
    prompt = open(a.prompt_file, encoding="utf-8").read().strip()
    candidates = [a.model] if a.model else [
        "doubao-seedream-4-0-250828",
        "doubao-seedream-3-0-t2i-250415",
        "doubao-seedream-3-5-t2i",
    ]
    last = None
    for m in candidates:
        try:
            gen(key, m, prompt, a.size, a.out); return
        except urllib.error.HTTPError as e:
            last = f"{m} → {e.code} {e.read().decode()[:200]}"
            print(f"[试 {m} 失败] {last}")
    sys.exit(f"[全部失败] {last}")

if __name__ == "__main__":
    main()
