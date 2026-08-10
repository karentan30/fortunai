# 善缘 TikTok 剧本集 · 导演版 + Kling API Prompt
**日期**: 2026-08-10 | **状态**: 三合一专家审核通过 | **目标市场**: TikTok美区/海外华人

> 铁律：所有prompt和剧本由导演视角写，包含镜头/布光/焦距/色彩/负面词。产品经理写法打回重写。

---

## 剧本矩阵（6支）

| # | 钩子 | 情绪层 | 目标 | 优先级 |
|---|---|---|---|---|
| 1 | 感情那段我不播了 | 悬念 | 卖报告$9.90 | P0 |
| 2 | 比我妈还了解我 | 笑点 | 免费版拉新 | P0 |
| 3 | 过去的事儿他不知道 | 震惊 | 有机传播 | P1 |
| 4 | 合婚·对视那一秒 | 情感 | 情侣拉新 | P1 |
| 5 | 那未来，能给我指导吗 | 求助 | 付费转化 | P0 |
| 6 | 中元节·外婆 | 悲悯 | 代烧转化 | P0（限时8/18-8/20） |

> 漏斗逻辑：脚本2（笑）→ 脚本3（震惊）→ 脚本5（求助）→ 付钱。按顺序投是完整漏斗。

---

## 脚本1：卖报告·「感情那段我不播了」

**时长**: 20秒 | **格式**: 创作者出镜+屏录 | **目标**: 直接转化$9.90

### 口播文案
```
[0-3s]  我花了$9.90买了一份八字报告。
         让我告诉你里面有什么。

[4-7s]  第一部分：日主分析。
         它说我表面冷静，
         实际上在帮所有人兜着情绪。

[8-11s] 财运那段说，
         我最容易在「觉得不好意思开口」
         的时候损失钱。
         ……准得有点过分。

[12-15s] 感情那段我就不播了。
          我截图发给了我妈。
          她说「这写的是你。」

[16-17s] 5000字。9块9美元。比一杯咖啡便宜。

[18-19s] 链接在主页，基础版免费，想看完整的解锁就行。

[20s]    评论区告诉我，你最想知道哪一块？
```

### 镜头方案
| 镜 | 时段 | 景别 | 导演指示 |
|---|---|---|---|
| 镜1 | 0-3s | 中近景·正面 | 表情是「我有东西要给你看」，沉着不兴奋；过度兴奋=广告感，算法识别划走 |
| 镜2 | 4-7s | 屏录 | 直接跳报告结果页，手指划到「帮所有人兜着情绪」那句并停留；跳过输入流程 |
| 镜3 | 8-11s | 屏录+回镜切 | 滑到财运段，圈出那句，回镜头说「准得有点过分」前停顿0.5秒 |
| 镜4 | 12-15s | 中近景 | 眼神微微下移像在回忆，说完「感情那段我不播了」不继续解释；留白是最强悬念 |
| 镜5 | 16-20s | 中近景 | 说价格时轻描淡写，不强调划算；强调划算反而显贵 |

**封面**: 截镜4「感情那段我不播了」那帧，叠字：**「感情那段，我不播了。」**
**预估CTR**: 4%+

### Kling API Prompt（镜1）
```
Medium close-up portrait, Asian woman 26-30, natural face, minimal makeup, 
sitting in a warmly lit room. She holds a smartphone at chest height and 
looks directly into camera with a composed, knowing expression — 
not smiling, not performing. The face of someone about to share a secret.

LIGHTING: Warm tungsten lamp from left rear, 2800K, creates rim light. 
Soft diffused window daylight from right, 5000K, 30% fill. 
No ring light. Natural shadows on face.
CAMERA: 50mm f/1.8, Sony A7IV. Bokeh background — warm blurred interior.
MOTION: Camera static. Subject holds still with micro natural breathing movement.
COLOR GRADE: Kodak Vision3 250D — warm skin tones, lifted blacks, 
slight grain simulation.
DURATION: 3 seconds.
```
**Negative**: `ring light, beauty filter, smooth AI skin, dramatic lighting, influencer smile, stock photo, neon, hand pointing up`

---

## 脚本2：免费拉新·「比我妈还了解我」

**时长**: 18秒 | **格式**: 创作者独自出镜，极简 | **目标**: 免费试用·量大

### 口播文案
```
[0-3s]  有个AI算命，
         算的太准了，
         比我妈还了解我。
         不是星座。不是生肖。输入你的生日就行。

[4-8s]  叫「日主」。
         壬水的人——帮所有人想清楚了，自己却最迷茫。
         甲木的人——看起来很强，其实最怕被否定。

[9-12s] 我输入生日，30秒就知道我的日主了。
         它说的那段话，
         我发给三个朋友，三个人都说「说的是你」。

[13-15s] 免费的。不用注册。30秒。

[16-17s] 链接在主页，去查一下。

[17-18s] 评论区告诉我你是什么日主。
```

### 封面
文字：**「算的太准了，比我妈还了解我」**
**预估CTR**: 5%+（妈妈梗全球华人共鸣+悬念双叠）

### Kling API Prompt（镜1·同镜风格）
```
Medium close-up, Asian woman 26-30, casual home setting, natural daylight. 
She looks at phone briefly then looks up at camera with a slightly amused, 
lightly disbelieving expression — like she just read something surprisingly accurate.

LIGHTING: Pure window daylight, overcast soft, 6500K. No additional lights. 
Slight natural shadow under chin.
CAMERA: 50mm f/2.0. Shallow focus on face. Background: blurred white/warm wall.
MOTION: Hold 2 seconds then light exhale — visible but not dramatic.
COLOR GRADE: Clean, slightly cool. Fujifilm 400H simulation. Minimal grain.
DURATION: 3 seconds.
```
**Negative**: `dramatic, ring light, beauty filter, shock face, hands pointing, neon, studio setup`

---

## 脚本3：有机传播·「过去的事儿他不知道，却都告诉了我」

**时长**: 18秒 | **格式**: 创作者出镜 | **目标**: 有机传播·算法推流

### 口播文案
```
[0-3s]  过去的事儿，
         他不知道，
         却都告诉了我。

[4-8s]  我只输入了生日。
         它说，我26岁有一段很重要的事情戛然而止——
         那年的事，我从来没跟任何人讲过。

[9-12s] 我盯着那段话看了很久。
         它说的是「伤官见官」，是八字里的一个格局。不是猜的。

[13-15s] 我不知道该怎么解释这件事。

[16-17s] 免费版在主页。你去试，然后告诉我准不准。

[17-18s] 评论区说一个它说中了你的哪件事。
```

### 封面
文字：**「过去的事儿，他不知道，却都告诉了我」**
**预估CTR**: 5.5%+（神秘感+不可能感，停下来想「什么事？」）

### 投流建议
优先跑有机，神秘感内容算法天然推，不需要烧钱。评论区「说一个它说中了你的哪件事」会带大量UGC评论形成内容池。

---

## 脚本4：合婚·「对视那一秒」

**时长**: 20秒 | **格式**: 真人出镜（最好两人）+屏录 | **目标**: 情侣拉新

### 口播文案
```
[0-3s]  我和男友用中国命理测了合婚，然后……
         （停顿，眼神侧移）

[4-8s]  你输入两个人的生辰，AI对比你们的五行和命盘。

[9-12s] 报告说：
         「初期摩擦明显，30岁后反而是彼此最强支撑。」
         我们俩同时抬头看对方。

[12-14s] ← 【关键帧】两人真实对视·不说话·就那个眼神

[15-18s] 然后那段关于「她需要空间」的——他截图存下来了。我偷看到了。

[19-20s] 评论区告诉我你们测了多少分💕 免费版在主页。
```

### 导演注意
12-14s那一秒是全片情绪peak，截这帧做封面。**不要笑，不要说话，就是那一秒懂了的眼神。**

### 封面
截两人对视帧，叠字：**「他截图了那段话」**
**预估CTR**: 4%+（情感类人脸封面最高）

---

## 脚本5：付费转化·「那未来，是否能给我一些指导呢」

**时长**: 20秒 | **格式**: 创作者出镜+屏录 | **目标**: $9.90报告转化

### 口播文案
```
[0-4s]  它说中了我过去的事之后，
         我问了它一句话——
         「那未来，是否能给我一些指导呢。」

[5-9s]  它说，2026年下半年，有一个机会会以「麻烦」的形式出现。
         如果你习惯性回避麻烦，你会错过它。

[10-13s] 我看了三遍。
          因为我就是那种习惯性回避麻烦的人。

[14-16s] 这段在完整报告里。$9.90。5000字。

[17-18s] 我觉得值。

[19-20s] 链接在主页。评论区告诉我，你最想知道哪一年。
```

### 镜头方案（6镜·含Kling API）

#### 镜1｜0-4s｜开场·拿手机抬头
**Kling API Prompt:**
```
Medium close-up portrait, Asian woman 25-28, natural face no heavy makeup, 
sitting near window, holding smartphone at chest level, looks up directly 
into camera with a quiet, slightly puzzled expression — not smiling, not dramatic.

LIGHTING: Single window light from left, 5000K soft daylight. 
Warm fill from right, 2800K low intensity lamp, 20% strength. 
No ring light. Shadows visible on right side of face.
CAMERA: 50mm, f/2.0, Sony A7IV. Shallow depth of field. 
Background: blurred warm interior, wood tones.
MOTION: Camera holds still. Subject shifts gaze from phone screen 
upward toward lens in first 1.5 seconds.
COLOR GRADE: Kodak Portra 400 — warm skin, lifted blacks.
DURATION: 4 seconds.
```
**Negative**: `ring light, beauty filter, smooth AI skin, dramatic lighting, neon, stock photo smile, influencer aesthetic, hand pointing up`

#### 镜2｜5-9s｜屏幕录制
**执行**: 真实屏录报告「2026年下半年」那段，手指划到「习惯性回避麻烦」那句停留2秒。**无需Kling生成。**

#### 镜3｜10-13s｜「我看了三遍」
**Kling API Prompt:**
```
Medium close-up, same Asian woman as Shot 1, same window lighting setup. 
She sets her phone down just out of frame. Exhales gently — visible chest movement.
Eyes drift down briefly (1 second), then return to camera.
Expression: quiet recognition, not surprise, not performance.

CAMERA: 50mm f/2.0, locked off. No movement.
LIGHTING: Identical to Shot 1.
MOTION: Minimal. One exhale, one eye movement, then stillness.
COLOR GRADE: Match Shot 1 exactly.
DURATION: 3 seconds.
```
**Negative**: `tears, dramatic reaction, over-acting, smile, nodding, gesturing`

#### 镜4｜14-16s｜屏录·价格页
**执行**: 录解锁页面，「$9.90」清晰可见，手机略倾斜握持。**无需Kling生成。**

#### 镜5｜17-18s｜「我觉得值」
**Kling API Prompt:**
```
Medium close-up, same Asian woman, same setup. She looks directly at lens.
After speaking: slow single nod, then holds still.
Expression: settled, decided. The way someone looks after making a 
small purchase they're at peace with.

CAMERA: 50mm f/2.0. Locked.
DURATION: 2 seconds.
COLOR GRADE: Match Shot 1.
```
**Negative**: `thumbs up, big smile, sales face, pointing at camera`

#### 镜6｜19-20s｜空镜收尾
**Kling API Prompt:**
```
Still life, extreme close-up. A ceramic tea cup on a wooden windowsill. 
Steam rising slowly. Warm afternoon light from window right, 4500K, 
casting long shadow left. Out-of-focus bokeh in background.

CAMERA: 100mm macro, f/2.8. Camera static.
MOTION: Steam drifts upward, slight air movement. 2 seconds.
COLOR GRADE: Warm amber shadows, cool highlights at steam edges. 
Heavy grain simulation.
DURATION: 2 seconds.
```
**Negative**: `phone, logo, text in frame, hands, people, neon, digital elements`

### 封面
截镜3「我看了三遍」那帧，叠字：**「那未来，是否能给我一些指导呢」**
**预估CTR**: 5%+（文艺感封面，与算命内容惯用震惊体完全差异化）

### 投流建议
- 纯转化向，投purchases优化目标
- 落地页直接跳报告解锁页，不跳首页
- 跑3天，CPP<$15就加量

---

## 脚本6：中元节代烧·「外婆」（限时8/18-8/20）

**时长**: 18秒 | **格式**: 创作者出镜+屏录 | **目标**: 代烧服务转化 | ⚠️ 时效限制

### 口播文案
```
[0-3s]  我外婆走了三年了。
         每年中元节，我都觉得自己在亏欠她。

[4-7s]  海外没有院子，公寓不让烧香，连纸都不知道在哪买。

[8-11s] 我在善缘上填了她的名字和生辰，选了莲花灯和金元宝。
         寺庙代为供奉，发给我供奉证明。

[12-15s] 我知道这不一定「有用」。但这是我唯一能做到的心意。

[16-17s] 中元节代烧，链接在主页🙏

[17-18s] 评论区告诉我，你想对他们说什么。
```

### 镜头方案（5镜）
| 镜 | 时段 | 导演指示 | 为什么 |
|---|---|---|---|
| 镜1 | 0-3s | 创作者正面，室内自然光，平静不悲伤，直视镜头 | 具体的人+具体年份，观众秒代入自己失去的谁；算法爱人脸开场 |
| 镜2 | 4-7s | 创作者俯拍手部，空手或握手机，三个障碍逐字说出 | 三个具体障碍比「在海外很难」强10倍 |
| 镜3 | 8-11s | 屏录·代烧页面·手指填写名字（真名打码）·选供品 | 真实操作是可信度锚点，没这镜观众不信 |
| 镜4 | 12-15s | 创作者回镜头，轻呼气，「我知道这不一定有用」 | 反向诚实是对灵性内容最有效的说服方式，承认不确定反而建立信任 |
| 镜5 | 16-18s | 保持同景别，自然说CTA+评论钩子，不突兀切换 | 情感类CTA必须无缝衔接，硬切logo会毁掉情绪 |

### Kling API Prompt（镜1）
```
Medium close-up portrait, Asian woman 28-35, natural face, plain clothing. 
She sits indoors near a window, looking directly into camera.
Expression: composed, not crying, not smiling — the face of someone 
holding a quiet weight. She has done her grieving; this is acceptance.

LIGHTING: Overcast window daylight only, 6000K. No artificial fill.
Soft, even, slightly cool light. Visible catchlight in eyes.
CAMERA: 85mm f/1.8. Face sharp. Background completely blurred — 
suggestion of warm interior only.
MOTION: Absolutely still. One slow blink around second 2. Nothing else.
COLOR GRADE: Desaturated, slightly cool overall. Skin tones preserved but 
not warm. Reference: winter afternoon light.
DURATION: 3 seconds.
```
**Negative**: `tears, dramatic grief, theatrical expression, smiling, candle in frame, dark background, horror mood, heavy shadows, ghost aesthetic`

### 封面
截镜1直视镜头那帧，叠字：**「海外没有院子，我只能这样了」**
**预估CTR**: 3.5%+（中元节时效性+真实痛点+人脸三叠加）

### 投流建议（中元节专项）
- 投放窗口：**8月18日-8月20日**，72小时
- 不投Broad，精准叠Interest：overseas Chinese / ancestral traditions / Chinese diaspora
- CPM $8-12，宁贵打准

---

## 执行清单

### 需要拍摄的镜头
| 视频 | 真人拍什么 | Kling生成什么 |
|---|---|---|
| 脚本1 | 创作者独自出镜 | 镜1（开场） |
| 脚本2 | 创作者独自出镜 | 镜1（开场） |
| 脚本3 | 创作者独自出镜 | 镜1 |
| 脚本4 | **两人出镜**·对视那一秒 | 无（真实感更重要） |
| 脚本5 | 屏录×2（镜2+镜4） | 镜1、镜3、镜5、镜6 |
| 脚本6 | 屏录×1（镜3） | 镜1 |

### Kling API调用汇总（共7个clip）
| Clip | 对应脚本 | 镜号 | 时长 |
|---|---|---|---|
| clip_01 | 脚本1 | 镜1 | 3s |
| clip_02 | 脚本2 | 镜1 | 3s |
| clip_03 | 脚本3 | 镜1 | 3s |
| clip_04 | 脚本5 | 镜1 | 4s |
| clip_05 | 脚本5 | 镜3 | 3s |
| clip_06 | 脚本5 | 镜5 | 2s |
| clip_07 | 脚本5 | 镜6·茶杯 | 2s |
| clip_08 | 脚本6 | 镜1 | 3s |

### 中元节倒计时
- 8/18（周二）：素材必须完成
- 8/19：剪辑+字幕+发布
- 8/20（中元节当天）：评论区运营

---

*所有prompt由导演视角撰写，含镜头类型/布光方案/摄影机参数/色彩分级/负面词。*
*参考导演风格：张艺谋（色彩符号）+ Wong Kar-wai（景深氛围）+ Roger Deakins（单光源）*
