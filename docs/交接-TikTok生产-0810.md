# 善缘 TikTok 生产交接 — 0810

## 当前状态

5支视频脚本已完成，prompts已清死亡词，**等Karen执行出片**。

---

## 文件位置

| 文件 | 用途 |
|---|---|
| `tiktok-production/jimeng_prompts.md` | 即梦网页端prompt包，直接复制粘贴 |
| `tiktok-production/seedance_gen.py` | 火山ARK API自动生成脚本 |
| `tiktok-production/voiceovers/cn_voiceovers.txt` | 5支口播文案（TTS或自录）|
| `tiktok-production/output/` | 生成视频存放目录 |

---

## 5支脚本概览

| ID | 钩子 | 类型 | 优先级 |
|---|---|---|---|
| CN01 | 感情一直不顺的人，问题大概率不在对方 | 情感共鸣 | ★★★★★ |
| CN02 | 1991年出生的，2026年要注意了 | 年份定向 | ★★★★★ |
| CN04 | 测了10万人八字，发现一个共同规律 | 权威数据 | ★★★★★ |
| CN06 | 每段感情都以分手收场，真的是我的问题吗 | 情感共鸣 | ★★★★★ |
| CN17 | 评论你的生日，我告诉你你的日主 | 互动涨粉 | ★★★★★ |

---

## 出片方式选择

### 方式A：即梦网页端（Karen自己操作，免费）
1. 打开 [jimeng.jianying.com](https://jimeng.jianying.com)
2. 选"文生视频" → 竖版9:16
3. 复制 `jimeng_prompts.md` 里每个镜头的prompt粘贴进去
4. 时长选对应秒数（3-5秒）
5. 下载 → 存到 `output/CN0X/scene_0X.mp4`
6. 剪映拼接 + 加配音 + 加字幕

### 方式B：火山ARK API（自动批量，每支视频约¥3-5）
- **必须先给Karen看prompt → Karen点头 → 才运行**
- 命令：`python3 tiktok-production/seedance_gen.py --script CN01`
- 当前模型：Seedance 2.0（已开通）
- Seedance 2.5需要Karen在火山控制台另行开通

---

## Seedream 5.0 出图（角色参考图）

已确认可用，正确参数：
```bash
# 出图前给Karen看prompt，Karen批准后才运行
curl "https://ark.cn-beijing.volces.com/api/v3/images/generations" \
  -H "Authorization: Bearer $ARK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seedream-5-0-260128",
    "prompt": "你的prompt",
    "size": "1920x1920",
    "n": 1
  }'
```
- 最小尺寸：1920×1920（3.6M像素）
- 每张约¥0.1

---

## 人物形象规范（所有视频保持一致）

```
25岁东亚汉族女生，warm yellow undertone肤色，
单眼皮，直黑发，无过度妆容，自然真实感
negative: cinematic, polished, makeup ad, CGI
```

---

## 死亡禁词（所有prompt禁止出现）

- 电影感 / cinematic / film grain
- 磨皮 / 完美皮肤
- 金色粒子 / 花瓣飘落 / 八卦纹理
- 手指向上指
- 口播 > 35秒

---

## 后期流程（剪映，每支约30分钟）

1. 导入所有镜头 → 按顺序拼接
2. 加口播配音（自录 或 豆包TTS）
3. 全程字幕（白字黑描边，每句1行）
4. BGM：玄幻轻音乐，前3秒静音增紧张感
5. 导出 1080×1920，60fps

---

## 发布建议

- 发布时间：工作日 12:00-13:00 或 20:00-22:00
- 标题：直接用hook第一句
- 话题：每支固定5个（见各脚本）
- 先发CN17（评论互动型，最容易涨粉）

---

## 花钱铁律

**任何付费API调用前：给Karen看完整prompt → Karen说可以 → 才调用**  
火山ARK控制台可设每日消费上限，建议设¥10/天作为保险。
