# 善缘定妆图 · Wan 2.2 出图 prompt + 参数 · 2026-08-10

> 引擎：阿里通义万相 **wan2.2-t2i-plus**（选它因为有真 `negative_prompt` 字段；wan2.5/2.6/2.7 不支持负向词）。
> 铁律：本文件是"生图前给 Karen 看的 prompt"，Karen 点头才生。B 已修正为**女性**（原设定=外婆外孙女，专家压缩档案漏了性别）。

## 锁脸工作流（纯 T2I+seed 锁不住脸）
1. **Hero**：A-1 / B-1 用 T2I，`n=4` 各出 4 张，人工挑 1 张脸全对的做黄金参考图，记 seed。
2. **其余 5 张走图生图**，以对应 Hero 为参考图，strength：大改角度(侧脸)0.52–0.55 / 小改(表情口型)0.4 / 手部 0.5。
3. **人工三点校验**：①痣/疤同侧（A 左鼻翼 / B 右眉尾）②瞳深棕（B 冷光下别发灰）③B 素圈银戒在右手无名指、无宝石。任一不对弃图重生。

## 必设参数
| 项 | 值 |
|---|---|
| 模型 | `wan2.2-t2i-plus`（Hero 与图生图同档） |
| prompt_extend | **false**（关闭智能改写，否则复活磨皮/网红笑） |
| size | 正脸/表情 `1024*1024`；手部竖版 `768*1152` |
| n | Hero=4，其余=2 挑 1 |
| 图生图端点 | 万相图像编辑/参考生图（`wanx2.x-imageedit` 类）**确切端点名待核实** |
| 价格 | flash ¥0.14/张（核实）· plus ~¥0.20/张（待核实到分）· 可能有 500 张免费额度 |

---

## 角色 A「算命博主」28 岁女性

**A 共用负向：**
```
ring light, catchlight ring, beauty filter, smooth AI skin, poreless skin, plastic skin, influencer smile, heavy makeup, colored contacts, false eyelashes, dramatic cinematic lighting, hard shadows, stock photo look, neon, logo, watermark, text, manicure, nail art, long nails, rings on fingers, earrings, ear piercing, bangs, Southeast Asian features, tanned skin, oversharpened, HDR, extra fingers, deformed hands, mirrored mole, mole on right side of nose
```

**A-1 正脸 Hero（T2I，n=4 挑 1）**
```
A photorealistic frontal portrait of a 28-year-old Han Chinese woman, East Asian features, gentle rounded oval face with medium non-protruding cheekbones, soft jawline and a slightly short round chin. Flat pale sparse eyebrows, monolid-to-inner-double eyelids, slightly wide-set eyes, deep brown irises, medium nose bridge with a rounded tip, thin-to-medium lips. There is a single small mole on her LEFT nostril crease, about 1cm below the nostril — the mole is on HER LEFT side (image right), do not mirror it. Bare ears, no earrings, no ear piercing. Fitzpatrick III warm-yellow healthy skin tone, not pale, natural visible pores and faint freckles, no skin smoothing. Natural black-brown hair worn down, center part, no bangs, reaching 2cm below the collarbone, slightly full cheeks. She wears a slightly loose oatmeal-colored cable-knit crew-neck sweater with long sleeves and ribbed cuffs. Calm composed expression, not smiling, looking straight at camera. Warm homey wooden window light, 2800K tungsten rim light from back-left plus 5000K window fill from right, soft square catchlight from the right window. Shot on Kodak Portra 400, 50mm lens, medium close-up.
```

**A-2 3/4 侧脸（图生图 ref=A-1，strength≈0.52）**
```
Same woman, identical face, three-quarter side view turned slightly to her left. Han Chinese, gentle rounded oval face, deep brown eyes, thin-to-medium lips, calm not smiling. The single small mole stays on her LEFT nostril crease (image right in frontal terms) — keep it on the same side, do not mirror. Bare ears, no earrings. Natural visible pores, no smoothing, Fitzpatrick III warm skin. Center-part black-brown hair down to below collarbone, oatmeal cable-knit crew-neck sweater. Warm wooden window light, 2800K rim from back-left, 5000K fill from right, soft square catchlight. Kodak Portra 400, 50mm, medium close-up.
```

**A-3 手持手机手部特写（图生图 ref=A-1，strength≈0.5）**
```
Close-up of the same woman's hand holding a smartphone at chest height as if screen-recording, her face partly visible and slightly out of focus in the upper frame, identical face and skin. Bare short rounded natural nails, no manicure, no nail art, no rings. A very thin delicate silver chain on her right wrist, the ribbed knit cuff of the oatmeal cable-knit sweater bunched at the wrist. Fitzpatrick III warm skin, natural pores. Warm wooden window light, 2800K rim back-left, 5000K fill right. Kodak Portra 400, 50mm, medium close-up focused on the hand.
```

**A-4 浅笑露齿表情基准（图生图 ref=A-1，strength≈0.4）**
```
Same woman, identical face, a light natural smile showing a hint of teeth — teeth are naturally aligned, not bleached white. Han Chinese, deep brown eyes, single small mole on her LEFT nostril crease (same side, do not mirror), bare ears no earrings, natural pores no smoothing, Fitzpatrick III warm skin. Center-part black-brown hair down, oatmeal cable-knit crew-neck sweater. Warm wooden window light, 2800K rim back-left, 5000K fill right, soft square catchlight from right window. Kodak Portra 400, 50mm, medium close-up, relaxed and slightly amused.
```

---

## 角色 B「中元哀思人」33 岁女性（外婆的外孙女）

**B 共用负向（⚠️ 绝不能放 ring/band/silver，否则抹掉信物银戒）：**
```
tears, crying, dramatic grief, theatrical expression, smiling, candle in frame, dark background, horror mood, ghost aesthetic, heavy shadows, warm color tones, festive clothing, sickly pale, deathly pale, manicure, nail art, ring light, beauty filter, smooth AI skin, poreless skin, colored contacts, grey eyes, logo, watermark, text, Southeast Asian features, mirrored scar, scar on left eyebrow, extra fingers, deformed hands
```

**B-1 正脸 Hero（T2I，n=4 挑 1）**
```
A photorealistic frontal portrait of a 33-year-old Han Chinese woman, East Asian features, slim long oval face with slightly visible cheekbones, clear jawline and a slightly pointed chin. Flat dark eyebrows; there is a very faint old scar / small notch at the OUTER end of the RIGHT eyebrow — it is on HER RIGHT eyebrow (image left), do not mirror it. Narrow double eyelids, standard eye spacing, deep brown irises that stay deep brown even under cool light (never grey). Medium-high nose bridge, medium natural-color lips. Bare ears, no earrings. Rounded forehead hairline with no widow's peak. Fitzpatrick III neutral-to-cool but healthy skin, not sickly pale, natural pores. Deep black medium-length hair to the shoulders in a low loose ponytail, no bangs, a few loose strands, natural hairline. She wears a fitted navy-blue plain cotton crew-neck long-sleeve thin shirt, smooth weave no texture. Calm closed-lip expression, looking straight at camera, neither crying nor smiling. Indoor near a window, background fully blurred (no candles, no darkness), pure overcast window light 6000K, cool even soft, no fill light, soft vertical catchlight from a small window at front-left. Slightly desaturated cool skin rendering, kept cool but not sickly pale. Shot at 85mm, medium close-up, frontal direct gaze.
```

**B-2 戴信物手部特写（图生图 ref=B-1，strength≈0.5）**
```
Close-up of the same woman's right hand, identical skin, lighting a small memorial lamp or holding a phone screen-recording. Bare short natural nails, no manicure, no wrist accessories, sleeve cuff flat. On the RIGHT ring finger there is a plain thin silver band, matte finish, no gemstone, no engraving — a simple keepsake ring (not a wedding ring, and it is on the ring finger of the RIGHT hand). Fitzpatrick III neutral-cool skin, natural pores, no smoothing. Fully blurred bright indoor window background, pure overcast 6000K cool even light, soft vertical catchlight front-left. 85mm, medium close-up focused on the hand and the silver band.
```

**B-3 平静闭唇口型基准（图生图 ref=B-1，strength≈0.4）**
```
Same woman, identical face, calm closed-lip mouth as a lip-sync baseline, teeth naturally aligned and not visible. Han Chinese, deep brown eyes staying deep brown under cool light, faint old scar/notch at the OUTER end of the RIGHT eyebrow (same side, do not mirror), bare ears, rounded forehead hairline no widow's peak, natural pores, Fitzpatrick III neutral-cool skin not sickly pale. Low loose shoulder-length ponytail, navy plain cotton crew-neck shirt. Fully blurred bright window background, pure overcast 6000K cool even light, soft vertical catchlight front-left, frontal direct gaze, neither crying nor smiling. 85mm, medium close-up.
```

---

## 生图前待核实/待办
- [ ] `wan2.2-t2i-plus` 到分单价 + 图生图端点名 + 账号免费额度（可能 500 张够白嫖）
- [ ] 写火山/百炼 ARK 出图脚本（读 env key，指定 plus + prompt_extend=false）
- [ ] Karen 点头 prompt → 生 A-1/B-1 两张 Hero → 挑脸 → 图生图 5 张 → 三点校验
- [ ] 待 Karen 定 A 主脚本（脚本2 拉新 / 脚本1 卖报告）
