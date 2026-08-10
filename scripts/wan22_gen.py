#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Wan 2.2 定妆图出图脚本（阿里百炼 DashScope）· 一张一张实验用
用法:
  python3 wan22_gen.py --out A-1.png --size 1024*1024 --n 1 \
      --prompt-file /tmp/p.txt --neg-file /tmp/n.txt
必设: prompt_extend=false（关闭智能改写，防复活磨皮/网红笑）
模型默认 wan2.2-t2i-plus（写实人像，别用 flash）
key: 环境变量 DASHSCOPE_API_KEY
"""
import os, sys, json, time, argparse, urllib.request, urllib.error

CREATE = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis"
TASK   = "https://dashscope.aliyuncs.com/api/v1/tasks/{}"

def post(url, key, body, extra=None):
    h = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    if extra: h.update(extra)
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=h, method="POST")
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())

def get(url, key):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prompt-file", required=True)
    ap.add_argument("--neg-file", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--model", default="wan2.2-t2i-plus")
    ap.add_argument("--size", default="1024*1024")
    ap.add_argument("--n", type=int, default=1)
    a = ap.parse_args()

    key = os.environ.get("DASHSCOPE_API_KEY")
    if not key:
        sys.exit("缺 DASHSCOPE_API_KEY")
    prompt = open(a.prompt_file, encoding="utf-8").read().strip()
    neg    = open(a.neg_file, encoding="utf-8").read().strip()

    body = {
        "model": a.model,
        "input": {"prompt": prompt, "negative_prompt": neg},
        "parameters": {"size": a.size, "n": a.n, "prompt_extend": False},
    }
    print(f"[提交] model={a.model} size={a.size} n={a.n} prompt_extend=False")
    try:
        resp = post(CREATE, key, body, extra={"X-DashScope-Async": "enable"})
    except urllib.error.HTTPError as e:
        sys.exit(f"[提交失败] {e.code} {e.read().decode()}")
    task_id = resp.get("output", {}).get("task_id")
    if not task_id:
        sys.exit(f"[无task_id] {json.dumps(resp, ensure_ascii=False)}")
    print(f"[task] {task_id} 轮询中...")

    for i in range(60):
        time.sleep(3)
        st = get(TASK.format(task_id), key)
        status = st.get("output", {}).get("task_status")
        if status == "SUCCEEDED":
            results = st.get("output", {}).get("results", [])
            urls = [r["url"] for r in results if "url" in r]
            if not urls:
                sys.exit(f"[成功但无图] {json.dumps(st, ensure_ascii=False)}")
            for idx, u in enumerate(urls):
                out = a.out if len(urls) == 1 else a.out.replace(".png", f"-{idx+1}.png")
                urllib.request.urlretrieve(u, out)
                print(f"[已存] {out}")
            usage = st.get("usage", {})
            print(f"[usage] {json.dumps(usage, ensure_ascii=False)}")
            return
        if status in ("FAILED", "CANCELED", "UNKNOWN"):
            sys.exit(f"[任务失败] {json.dumps(st, ensure_ascii=False)}")
        print(f"  ...{status} ({i+1})")
    sys.exit("[超时] 轮询60次未完成")

if __name__ == "__main__":
    main()
