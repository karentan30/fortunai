# TikTok广告物料生成 - 替代方案 (本地 + 免费工具)

> **当前状态**: Higgsfield额度已用完  
> **替代方案**: 本地ComfyUI + 免费工具组合

---

## 方案对比

| 方案 | 成本 | 质量 | 时间 | 推荐度 |
|------|------|------|------|--------|
| Higgsfield | $$$ | ⭐⭐⭐⭐⭐ | 5分钟 | ✅ (额度用完) |
| 本地ComfyUI | 免费 | ⭐⭐⭐⭐ | 10分钟 | ✅ 推荐 |
| Kling 3.0 试用 | 免费 | ⭐⭐⭐⭐⭐ | 3分钟 | ✅ 备选 |
| MidJourney | $$ | ⭐⭐⭐⭐ | 5分钟 | ❌ (需付费) |

---

## 方案A: 本地ComfyUI (推荐 ✅)

### 已安装环境检查
```bash
# 检查ComfyUI是否在线
curl -s http://127.0.0.1:8188/api/status || echo "ComfyUI未启动"

# 如果未启动，启动ComfyUI
cd ~/projects/ComfyUI
./run_cpu.sh &
# 或使用GPU: ./run_gpu.sh &
```

### 生成三个背景图片

#### 步骤1: 启动ComfyUI
```bash
cd ~/projects/ComfyUI
./run_cpu.sh > /tmp/comfyui.log 2>&1 &
sleep 10  # 等待启动
```

#### 步骤2: 访问Web界面
```
打开浏览器: http://127.0.0.1:8188
选择模型: Stable Diffusion XL (SDXL)
```

#### 步骤3: 生成图片

**图片1: 八字命理背景**
```
Prompt:
  An ethereal purple and gold mystical background with Chinese astrology symbols.
  Large glowing character "命" (destiny) in center, surrounded by yin-yang and 
  trigram symbols. Shimmering stars, cosmic energy, mysterious aurora glow.
  Ancient meets modern luxury. Professional design.
  
Negative: blurry, low quality, text, watermark
Resolution: 1080×1920 (9:16)
Steps: 30
CFG: 7.5
Model: SDXL-v1.0 或 RealVisXL
```

**图片2: 合婚配对背景**
```
Prompt:
  Romantic pink and gold background with two interlocking glowing hearts at center.
  Subtle zodiac constellations with star connections. Warm bokeh lights.
  Love and destiny theme, modern elegance. Professional premium design.
  
Negative: blurry, low quality, text, watermark, harsh lighting
Resolution: 1080×1920 (9:16)
Steps: 30
CFG: 7.5
Model: SDXL-v1.0
```

**图片3: 个性占卜背景**
```
Prompt:
  Golden mystical background with 12 Chinese zodiac animals in perfect circle.
  Ancient symbols, glowing energy center. Modern luxury design.
  Dragon, tiger, rabbit, snake, horse, goat, monkey, rooster, dog, pig, rat, ox.
  Bright, inspiring, energetic. Professional design.
  
Negative: blurry, text, watermark, distorted animals
Resolution: 1080×1920 (9:16)
Steps: 30
CFG: 7.5
Model: SDXL-v1.0
```

#### 步骤4: 下载并保存
```bash
# 生成的图片自动保存到:
~/projects/ComfyUI/output/

# 移到项目目录
cp ~/projects/ComfyUI/output/*.png ~/projects/shenyuan/assets/tiktok-bg/
```

**预计时间**: 3×(2分钟生成 + 1分钟下载) = 9分钟

---

## 方案B: Kling 3.0 免费试用 (备选)

如果要用Kling生成TikTok视频 (而非背景图):

```
网址: klingai.com
登录 → 选择"7天免费试用"
生成20秒竖屏视频
分辨率: 1080×1920
模型: Kling 3.0

使用次数: 每个账号7天内12-20次免费生成
```

**视频生成提示词**:
```
A mystical purple and gold Chinese astrology report interface.
User enters birth date, AI generates destiny report instantly.
Show the fortune-telling results with glowing text effects.
Beautiful cinematic lighting. Professional design.
9:16 vertical video. 20 seconds. English text.
```

---

## 方案C: 快速简化方案 (最快 ⚡)

如果时间紧张，使用**已有设计素材** + 文案:

```bash
# 检查已有资产
ls ~/projects/shenyuan/assets/
ls ~/projects/shenyuan/pages/  # 可以截图HTML页面

# 快速方案:
1. 用CapCut打开 pages/bazi.html 截屏
2. 在CapCut中编辑添加:
   - 文案 "What does your birth chart reveal?"
   - 音乐 (免费库)
   - 特效 (CapCut内置)
3. 导出为 1080×1920 MP4
4. 上传TikTok

时间: 5分钟
成本: 免费
质量: 7/10
```

---

## 🎬 TikTok视频制作完整流程

### 使用CapCut (完全免费, 网页版)

```
1. 打开 capcut.com 
2. 点击 "Create a video"
3. 选择宽高比: 9:16 (竖屏)
4. 选择模板或从头开始
5. 导入背景图片
6. 添加文案 + 音乐
7. 设置时长: 20秒
8. 预览 → 导出为 MP4
```

**CapCut模板** (免费):
- TikTok Trends
- Mystical / Spiritual
- Love Story
- Destiny / Fortune

---

## 💰 成本预算 (更新)

| 方案 | 背景图 | 视频 | 配音 | 总计 |
|------|--------|------|------|------|
| ComfyUI + CapCut | 免费 | 免费 | 免费 | **¥0** ✅ |
| Kling 3.0 试用 | 免费 | 免费 | 免费 | **¥0** ✅ |
| Higgsfield | $$$ | $$$ | $ | $20+ ❌ |

---

## 📋 立即行动步骤 (选择一个)

### 选项1: ComfyUI本地生成 (推荐 ✅)
```bash
# 1. 启动ComfyUI
cd ~/projects/ComfyUI && ./run_cpu.sh &

# 2. 打开浏览器
open http://127.0.0.1:8188

# 3. 用提示词生成3张图片 (15分钟)

# 4. 移到项目目录
cp ~/projects/ComfyUI/output/*.png ~/projects/shenyuan/assets/tiktok-bg/

# 5. 用CapCut制作视频 (20分钟)
open capcut.com
```

### 选项2: Kling 3.0快速出视频
```bash
# 1. 打开 klingai.com
# 2. 注册 + 申请免费试用
# 3. 生成3个20秒视频 (30分钟)
# 4. 下载MP4
# 5. 在TikTok上传
```

### 选项3: CapCut快速简化方案
```bash
# 1. 用浏览器截图现有页面
# 2. CapCut编辑 (15分钟)
# 3. 导出 + 上传TikTok
```

---

## ✅ 今天的目标

**方案A (ComfyUI) 预计总时间**: 45分钟
- 启动ComfyUI: 3分钟
- 生成3张背景: 9分钟
- CapCut制作视频: 20分钟
- 质量审核: 10分钟
- 上传TikTok: 3分钟

**可以在14:00前完成投放前准备**

---

现在选择: **方案A (ComfyUI)** / **方案B (Kling)** / **方案C (快速方案)** ?

