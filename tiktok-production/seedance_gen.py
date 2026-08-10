#!/usr/bin/env python3
"""
善缘 TikTok 视频生产脚本 - 火山 ARK Seedance API
用法: python3 seedance_gen.py --script CN01
      python3 seedance_gen.py --all
开通模型: https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement
"""
import os, json, time, sys, argparse, urllib.request, urllib.error

ARK_KEY = os.environ.get("ARK_API_KEY", "")
MODEL = "doubao-seedance-2-0-260128"   # Seedance 2.0 已开通可用; 2.5 需控制台另行开通
BASE_URL = "https://ark.cn-beijing.volces.com/api/v3"
OUT_DIR = os.path.expanduser("~/projects/shenyuan/tiktok-production/output")

# ─── 脚本库 ───────────────────────────────────────────────────────────────────
SCRIPTS = {
    "CN01": {
        "title": "你知道为什么你的感情一直不顺吗？",
        "hook":  "你知道为什么你的感情一直不顺吗？",
        "lines": [
            "不是你不够好，是你的八字里，夫妻宫有冲。",
            "我用善缘测了一下，结果让我后背发凉——",
            "每段感情开始得轰轰烈烈，结尾却一地鸡毛。",
            "这不是运气的问题，这是命格写好的剧本。",
            "但知道了，你就能提前破局。",
            "主页链接，免费先看你的夫妻宫👆",
        ],
        "scenes": [
            # (时长秒, 画面描述, 摄像运动)
            (3,  "极近景：一位25岁中国女生面对镜头，眼神犹豫迷茫，背景是暖色调卧室，手机屏幕微微发光，竖屏9:16，电影感", "push in slow"),
            (4,  "手机屏幕特写：滑动打开善缘命理报告，停在'夫妻宫'分析页，金色文字在深色背景上，竖屏9:16", "zoom in slow"),
            (4,  "女生表情特写：微微睁大眼睛，嘴角轻轻张开，意想不到的表情，暖黄灯光，竖屏9:16", "static close"),
            (4,  "动态字幕场景：每段感情开始得轰轰烈烈 结尾却一地鸡毛，黑底白字，字体加粗，配花瓣凋落特效，竖屏9:16", "static"),
            (3,  "命理书籍翻页特写：古老易经文字若隐若现，金色粒子飘散，神秘氛围，竖屏9:16", "slow pull back"),
            (3,  "CTA画面：手机屏幕上出现善缘APP，女生手指向上指向主页链接，希望感十足，竖屏9:16", "static"),
        ],
        "voice_script": "你知道为什么你的感情一直不顺吗？不是你不够好，是你的八字里，夫妻宫有冲。我用善缘测了一下，结果让我后背发凉。每段感情开始得轰轰烈烈，结尾却一地鸡毛。这不是运气的问题，是命格写好的剧本。但知道了，你就能提前破局。主页链接，免费先看你的夫妻宫。",
        "hashtags": "#八字 #感情运势 #夫妻宫 #命理 #2026运势",
    },
    "CN02": {
        "title": "1991年出生的，2026年要注意了！",
        "hook":  "1991年出生的，2026年要注意了！",
        "lines": [
            "今年进入新的大运周期，命格开始转换。",
            "事业上可能出现一个没想到的机会，",
            "感情上，单身的今年有强烈桃花，",
            "有对象的，反而要注意感情稳定性。",
            "具体要怎么走？善缘的2026流年报告里有。",
        ],
        "scenes": [
            (3,  "文字特效：'1991'数字在金色光效中闪现，深紫色背景，大字压迫感，竖屏9:16", "zoom in"),
            (4,  "八字大运表格：手指滑动到2026年那行高亮，金色标注，命理图表感，竖屏9:16", "static"),
            (4,  "对比画面：左边机会浮现（光线从暗到亮），右边感情波动（温暖暖色），分屏竖版9:16", "pan"),
            (4,  "善缘APP报告页：2026流年运势标题清晰可见，手指点击展开，竖屏9:16", "zoom in slow"),
            (3,  "CTA：女生拿着手机展示报告，笑着指向屏幕，轻快自信，竖版9:16", "static"),
        ],
        "voice_script": "1991年出生的，2026年要注意了！今年进入新的大运周期，命格开始转换。事业上可能出现一个没想到的机会，感情上，单身的今年桃花很旺，但有对象的要注意稳定性。具体怎么走，善缘的2026流年报告里全都有。",
        "hashtags": "#1991 #2026运势 #大运 #流年 #八字命理",
    },
    "CN04": {
        "title": "测了10万人八字，发现一个共同规律",
        "hook":  "测了10万人八字之后，我发现了一个共同规律",
        "lines": [
            "那些在30岁之后突然翻盘的人，",
            "八字里都有一个共同的特征——",
            "食神生财格，或者伤官见官格。",
            "这两种格局，代表你的人生是后劲型。",
            "你有吗？善缘一键测格局。",
        ],
        "scenes": [
            (3,  "数据可视化：'10万+'人数字动态增长，深色背景，金色粒子，权威感，竖屏9:16", "zoom in"),
            (4,  "八字案例展示：多个不同人的八字命盘翻页，快速切换，数据感，竖版9:16", "quick cuts"),
            (4,  "重点特写：'食神生财'四个大字高亮，金色笔迹写出的感觉，神秘又清晰，竖版9:16", "push in"),
            (4,  "对比动画：后劲型人生时间线，30岁前平淡→30岁后突然腾飞，竖版9:16", "static"),
            (3,  "善缘APP格局测试页面，手指点击'立即测算'，竖版9:16", "zoom in"),
        ],
        "voice_script": "测了10万人八字之后，我发现了一个共同规律。那些在30岁之后突然翻盘的人，八字里都有一个特征，食神生财格，或者伤官见官格。这两种格局代表你是后劲型。你有吗？善缘一键测你的格局。",
        "hashtags": "#八字格局 #食神生财 #命理 #30岁翻盘 #运势",
    },
    "CN06": {
        "title": "每段感情都以分手收场，真的是我的问题吗？",
        "hook":  "每段感情都以分手收场，真的是我的问题吗？",
        "lines": [
            "不一定是你的问题。",
            "可能是你的夫妻宫，天生带刑克。",
            "测了善缘之后我才知道，",
            "原来我的八字里感情是'先破后立'——",
            "意思是要经历一次失败，才能遇到对的人。",
            "现在知道了，就能心平气和地等那个对的人。",
        ],
        "scenes": [
            (3,  "女生独自坐在窗边，轻微失落但不绝望，暖色调，情感共鸣画面，竖屏9:16", "slow push in"),
            (3,  "夫妻宫命盘特写：'刑克'二字被金色圆圈圈出，神秘命理图表，竖屏9:16", "zoom in"),
            (4,  "善缘感情分析页：'先破后立'章节，手机屏幕特写，金色文字清晰，竖屏9:16", "static"),
            (4,  "情绪转变：同一个女生表情从迷茫变为释然，内心清明感，温暖背光，竖屏9:16", "static"),
            (3,  "CTA：报告截图+主页链接，轻描淡写但有力的结尾，竖屏9:16", "pull back"),
        ],
        "voice_script": "每段感情都以分手收场，真的是我的问题吗？不一定。可能是你的夫妻宫，天生带刑克。测了善缘之后我才知道，原来我的八字里感情是先破后立，意思是经历一次失败，才能遇到对的人。现在知道了，就能心平气和地等。",
        "hashtags": "#夫妻宫 #感情八字 #先破后立 #命理 #感情运势",
    },
    "CN17": {
        "title": "评论你的生日，我告诉你你的日主是什么",
        "hook":  "评论你的生日，我告诉你你的日主是什么",
        "lines": [
            "日主，就是八字天干中的日柱，",
            "代表你这个人的本质性格和底层能量。",
            "甲木的人，自带领袖气场；",
            "壬水的人，思维最跳跃；",
            "丁火的人，感情最深沉。",
            "评论你的生日，我来告诉你你是哪个！",
        ],
        "scenes": [
            (3,  "八字日柱图表特写：十天干排列，金色字体，神秘背景，竖屏9:16", "zoom in"),
            (5,  "快速切换：甲木/壬水/丁火三种日主的性格描述卡片，每张停留1.5秒，竖屏9:16", "quick cuts"),
            (4,  "互动场景：评论区截图出现多个生日评论，博主逐一回复日主，竖屏9:16", "zoom in slow"),
            (3,  "CTA动画：'评论你的生日⬇️'大字出现，评论区互动感，竖屏9:16", "static"),
        ],
        "voice_script": "评论你的生日，我告诉你你的日主是什么。日主就是八字天干的日柱，代表你的本质性格。甲木自带领袖气场，壬水思维最跳跃，丁火感情最深沉。评论你的生日，我来告诉你你是哪个！",
        "hashtags": "#日主 #八字 #十天干 #命理科普 #互动",
    },
}

# ─── API 调用 ─────────────────────────────────────────────────────────────────

def create_video_task(prompt: str, duration: int = 5) -> str:
    """提交 Seedance 视频生成任务，返回 task_id"""
    payload = {
        "model": MODEL,
        "content": [{"type": "text", "text": prompt}],
        "parameters": {
            "duration": duration,
            "resolution": "720p",
            "fps": 24,
            "aspect_ratio": "9:16",
        }
    }
    req = urllib.request.Request(
        f"{BASE_URL}/contents/generations/tasks",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {ARK_KEY}", "Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        resp = json.loads(r.read())
    return resp["id"]

def poll_task(task_id: str, timeout: int = 300) -> str:
    """轮询任务直到完成，返回视频 URL"""
    deadline = time.time() + timeout
    while time.time() < deadline:
        req = urllib.request.Request(
            f"{BASE_URL}/contents/generations/tasks/{task_id}",
            headers={"Authorization": f"Bearer {ARK_KEY}"},
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            resp = json.loads(r.read())
        status = resp.get("status", "")
        if status == "succeeded":
            return resp["content"][0]["video_url"]
        if status == "failed":
            raise RuntimeError(f"任务失败: {resp}")
        print(f"  [{status}] 等待中...")
        time.sleep(10)
    raise TimeoutError(f"任务超时 {timeout}s")

def download(url: str, path: str):
    urllib.request.urlretrieve(url, path)
    print(f"  ✅ 保存: {path}")

# ─── 主流程 ──────────────────────────────────────────────────────────────────

def gen_script(key: str):
    if key not in SCRIPTS:
        print(f"未知脚本 {key}, 可用: {list(SCRIPTS.keys())}")
        return
    s = SCRIPTS[key]
    os.makedirs(f"{OUT_DIR}/{key}", exist_ok=True)
    print(f"\n🎬 生成 {key}: {s['title']}")
    print(f"📝 口播文案保存位置: {OUT_DIR}/{key}/voiceover.txt")

    # 保存口播文稿
    with open(f"{OUT_DIR}/{key}/voiceover.txt", "w") as f:
        f.write(f"# {s['title']}\n\n")
        f.write(f"## 口播文稿（粘贴到TTS或自己录音）\n{s['voice_script']}\n\n")
        f.write(f"## 台词分句\n")
        for line in s["lines"]:
            f.write(f"- {line}\n")
        f.write(f"\n## 推荐话题标签\n{s['hashtags']}\n")

    # 逐镜头生成视频
    task_ids = []
    for i, (dur, prompt, movement) in enumerate(s["scenes"]):
        full_prompt = f"{prompt} 电影级画质，竖屏9:16，{movement}"
        print(f"  镜头 {i+1}/{len(s['scenes'])}: 提交任务...")
        try:
            tid = create_video_task(full_prompt, dur)
            task_ids.append((i+1, tid, dur))
            print(f"  task_id: {tid}")
        except Exception as e:
            print(f"  ❌ 镜头{i+1}提交失败: {e}")
            task_ids.append((i+1, None, dur))
        time.sleep(1)

    # 下载完成的视频
    for (idx, tid, dur) in task_ids:
        if not tid:
            continue
        print(f"  轮询镜头 {idx}...")
        try:
            url = poll_task(tid)
            download(url, f"{OUT_DIR}/{key}/scene_{idx:02d}.mp4")
        except Exception as e:
            print(f"  ❌ 镜头{idx}下载失败: {e}")

    print(f"\n✅ {key} 所有镜头完成")
    print(f"📁 文件位置: {OUT_DIR}/{key}/")
    print(f"🎵 后续: 用剪映/CapCut 拼接 scene_01~{len(s['scenes']):02d}.mp4 + 加入口播音频 + 字幕")

def main():
    if not ARK_KEY:
        print("❌ ARK_API_KEY 未设置，请 export ARK_API_KEY=你的key")
        sys.exit(1)
    parser = argparse.ArgumentParser()
    parser.add_argument("--script", help="脚本ID，如 CN01")
    parser.add_argument("--all", action="store_true", help="生成所有脚本")
    parser.add_argument("--list", action="store_true", help="列出所有可用脚本")
    args = parser.parse_args()
    if args.list or (not args.script and not args.all):
        print("可用脚本:")
        for k, v in SCRIPTS.items():
            print(f"  {k}: {v['title']}")
        return
    if args.all:
        for k in SCRIPTS:
            gen_script(k)
    elif args.script:
        gen_script(args.script)

if __name__ == "__main__":
    main()
