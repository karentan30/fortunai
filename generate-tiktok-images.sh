#!/bin/bash

# TikTok广告背景图片生成脚本 (ComfyUI)
# 生成三个高质量背景图: 八字 / 合婚 / 占卜

set -e

COMFYUI_URL="http://127.0.0.1:8188"
OUTPUT_DIR="$(pwd)/assets/tiktok-bg"
mkdir -p "$OUTPUT_DIR"

echo "🎨 开始生成TikTok广告背景图片..."
echo "📍 输出目录: $OUTPUT_DIR"
echo ""

# 函数: 检查ComfyUI连接
check_comfyui() {
  if ! curl -s "$COMFYUI_URL/api/status" > /dev/null 2>&1; then
    echo "❌ ComfyUI未连接。请启动: cd ~/projects/ComfyUI && ./run_cpu.sh"
    exit 1
  fi
  echo "✅ ComfyUI已连接"
}

# 函数: 从ComfyUI获取图片
generate_image() {
  local name=$1
  local prompt=$2

  echo "⏳ 生成: $name"

  # 简化的ComfyUI API调用
  # (完整的workflow需要在ComfyUI UI中配置)

  # 这里返回提示信息，用户需要在ComfyUI Web UI中手动生成
  echo "   Prompt: $prompt"
  echo "   分辨率: 1080×1920 (9:16)"
  echo "   模型: SDXL v1.0"
  echo ""
}

check_comfyui

echo "📋 三个背景图片生成计划:"
echo ""

generate_image "八字命理背景" \
  "An ethereal purple and gold mystical background with Chinese astrology symbols. Large glowing character '命' (destiny) in center, surrounded by yin-yang and trigram symbols. Shimmering stars, cosmic energy, mysterious aurora glow. Ancient meets modern luxury design. Professional high quality."

generate_image "合婚配对背景" \
  "Romantic pink and gold background with two interlocking glowing hearts at center. Subtle zodiac constellations with star connections. Warm bokeh lights like floating embers. Love and destiny theme, modern elegance. Premium high-quality design."

generate_image "个性占卜背景" \
  "Golden mystical background with 12 Chinese zodiac animals arranged in perfect circle. Ancient symbols, glowing energy radiating from center. Modern luxury design. Dragon, tiger, rabbit, snake, horse, goat, monkey, rooster, dog, pig, rat, ox. Bright, inspiring, energetic. Professional premium quality."

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 打开ComfyUI Web UI生成图片:"
echo "   open http://127.0.0.1:8188"
echo ""
echo "步骤:"
echo "  1. 选择模型: SDXL v1.0 或 RealVisXL"
echo "  2. 复制上面的Prompt到输入框"
echo "  3. 设置: 1080×1920 分辨率, Steps: 30"
echo "  4. 点击Generate生成"
echo "  5. 下载保存到: $OUTPUT_DIR"
echo ""
echo "⚠️ 每张图片生成时间: 2-3分钟"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
