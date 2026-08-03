#!/usr/bin/env python3
"""
善缘 300张图片批量生成脚本
使用 ComfyUI + RealVisXL_V5
"""
import os
import json
import time
import requests
from pathlib import Path

# ComfyUI 配置
COMFYUI_URL = "http://localhost:8188"
OUTPUT_DIR = "/Users/karen/projects/shenyuan/generated-images"
PROMPT_DIR = "/Users/karen/projects/shenyuan/docs/marketing"

# 优先级队列（按ROI排序）
GENERATION_PRIORITY = [
    ("copy-bazi.md", 30, "八字命理"),
    ("copy-hehun.md", 30, "合婚配对"),
    ("copy-brand.md", 30, "品牌故事"),
    ("copy-crystal.md", 30, "水晶能量"),
    ("copy-tarot.md", 30, "塔罗解读"),
    ("copy-ziwei.md", 30, "紫微斗数"),
    ("copy-fengshui.md", 30, "风水格局"),
    ("copy-jizu.md", 30, "吉祥用品"),
    ("copy-jinian.md", 30, "纪念相册"),
]

class ImageGenerator:
    def __init__(self):
        self.output_dir = Path(OUTPUT_DIR)
        self.output_dir.mkdir(exist_ok=True, parents=True)
        self.generated_count = 0
        self.failed_count = 0
        self.log_file = self.output_dir / "generation_log.txt"

    def log(self, message):
        """记录日志"""
        print(f"[{time.strftime('%H:%M:%S')}] {message}")
        with open(self.log_file, "a") as f:
            f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {message}\n")

    def extract_prompts(self, markdown_file):
        """从markdown文件提取所有【图片Prompt】"""
        prompts = []
        try:
            with open(markdown_file, 'r', encoding='utf-8') as f:
                content = f.read()
                # 查找所有【图片Prompt 1-3】模式
                import re
                pattern = r'【图片Prompt (\d+)】\s*\nPrompt: (.*?)\n<!-- cfg'
                matches = re.findall(pattern, content, re.DOTALL)
                for idx, prompt in matches:
                    # 提取cfg/steps/sampler等参数
                    param_pattern = r'<!-- cfg:(\d+), steps:(\d+), sampler:([\w\s+]+), size:(\d+x\d+) -->'
                    param_match = re.search(param_pattern, prompt)
                    if param_match:
                        prompts.append({
                            'idx': idx,
                            'prompt': prompt.split('\n<!-- cfg')[0].strip(),
                            'cfg': int(param_match.group(1)),
                            'steps': int(param_match.group(2)),
                            'sampler': param_match.group(3).strip(),
                            'size': param_match.group(4)
                        })
        except Exception as e:
            self.log(f"❌ 提取prompt失败 {markdown_file}: {e}")
        return prompts

    def generate_via_comfyui(self, prompt_data):
        """调用ComfyUI生成单张图"""
        try:
            # ComfyUI API负载
            payload = {
                "prompt": prompt_data['prompt'],
                "cfg": prompt_data['cfg'],
                "steps": prompt_data['steps'],
                "sampler_name": prompt_data['sampler'],
                "scheduler": "normal",
                "width": int(prompt_data['size'].split('x')[0]),
                "height": int(prompt_data['size'].split('x')[1]),
                "seed": int(time.time()) % 2**32,  # 随机seed
                "model": "RealVisXL_V5"
            }

            # 发送请求到ComfyUI
            response = requests.post(
                f"{COMFYUI_URL}/api/generate",
                json=payload,
                timeout=300
            )

            if response.status_code == 200:
                result = response.json()
                return result.get('image_path')
            else:
                self.log(f"⚠️ ComfyUI返回错误: {response.status_code}")
                return None
        except Exception as e:
            self.log(f"❌ 生成失败: {e}")
            return None

    def run(self):
        """启动批量生成"""
        self.log("=" * 60)
        self.log("🚀 善缘 300张图片批量生成启动")
        self.log(f"📁 输出目录: {self.output_dir}")
        self.log("=" * 60)

        total_to_generate = sum(count for _, count, _ in GENERATION_PRIORITY)
        self.log(f"📊 计划生成: {total_to_generate} 张图片")

        for filename, count, category in GENERATION_PRIORITY:
            filepath = Path(PROMPT_DIR) / filename
            if not filepath.exists():
                self.log(f"⚠️ 跳过 {category}: 文件不存在")
                continue

            self.log(f"\n🎨 开始生成 {category} ({count}张)")
            prompts = self.extract_prompts(filepath)

            if not prompts:
                self.log(f"❌ {category}: 未找到有效prompt")
                continue

            # 生成该类别的所有图片
            for i, prompt_data in enumerate(prompts[:count], 1):
                self.log(f"  [{i}/{count}] 生成中... (cfg:{prompt_data['cfg']} steps:{prompt_data['steps']})")

                image_path = self.generate_via_comfyui(prompt_data)
                if image_path:
                    # 保存到分类目录
                    category_dir = self.output_dir / category
                    category_dir.mkdir(exist_ok=True)
                    self.generated_count += 1
                    self.log(f"  ✅ 已保存: {category}/{image_path}")
                else:
                    self.failed_count += 1
                    self.log(f"  ❌ 生成失败")

                # 进度反馈
                if self.generated_count % 10 == 0:
                    self.log(f"📈 进度: {self.generated_count}/{total_to_generate} 已完成")

        # 最终统计
        self.log("\n" + "=" * 60)
        self.log("✅ 批量生成完成")
        self.log(f"📊 成功: {self.generated_count} 张")
        self.log(f"❌ 失败: {self.failed_count} 张")
        self.log(f"📁 输出: {self.output_dir}")
        self.log("=" * 60)

if __name__ == "__main__":
    generator = ImageGenerator()
    generator.run()
