# Runae 佛经内容库 + 每日修行打卡 · Product Vertical

> Runae Sutra Library (SEO magnet) + Daily Practice Tracker
> Status: **Shipped v1（纯前端静态页，localStorage，不接后端）**
> Owner: Karen · Draft: 2026-08-17
> 定位：英文为主的文化/学习内容 → SEO 流量磁铁 + 留存钩子，导流到 Runae 核心 vertical

---

## 0. TL;DR

- **两件事**：① 一个**佛经内容库**（SEO 磁铁，人搜经文原文/含义能搜到我们）② 一个**每日修行打卡**（习惯 tracker，纯 localStorage，攒连续天数，可截图分享）。
- **战略角色**：不是变现产品，是**免费内容漏斗顶端** —— 用「heart sutra text / diamond sutra meaning」这类高搜索量、零商业竞争的信息型关键词把人接进来，再内链导流到代祈福/供灯（`daishao-en.html`）、算命（`bazi-en.html`）、Runae hub（`explore.html`）。
- **打卡为什么用 localStorage**：题目明确要求**不接后端，避免与现有后端路由对撞**。v1 纯前端，数据只存用户设备。以后要跨设备/云存档再迁后端（见 §5）。
- **合规命门**：经文=文化/精神内容，功德=**文化框架**，**禁「念了必消灾/改运」**；全站文化/学习/参考免责；零编造经文；**零把「Chinese」当身份标签**（经文是文化不是族裔标签，可提 Buddhist / Eastern）。

---

## 1. 建了哪些文件

| 文件 | 是什么 | 目标关键词 |
|---|---|---|
| `pages/sutras.html` | 佛经库**索引页** + 功德文化框架 + 术语表 + 内链 | buddhist sutra library, sutra meaning |
| `pages/sutra-heart.html` | **心经**：原文（心經）+ 拼音 + 逐句英译 + 含义解读 + 咒语 | heart sutra text, heart sutra english translation, heart sutra meaning |
| `pages/sutra-diamond.html` | **金刚经**：核心段落原文（金剛經）+ 英译 + 含义 + 名句 | diamond sutra meaning, diamond sutra text |
| `pages/practice-tracker.html` | **每日修行打卡**：拜佛/诵经/供灯/静坐打卡 + streak + 30 天格 + 分享卡 | daily practice tracker, buddhist habit |

> 全部照 `home-en.html` 的绿玉奶白设计系统（jade #5bbfa0 / cream #faf8f5 / Playfair+Inter），加 `Noto Serif SC` 承载经文汉字。英文为主，汉字仅用于经文原文与术语锚点（双语参照，非身份标签）。

---

## 2. 功能明细

### 2.1 佛经内容库（SEO 磁铁）
- **索引 → 详情**两层：`sutras.html` 索引卡片导向两篇经文详情页。
- 每篇经文页结构：**原文（含汉字）→ 逐句/关键段英译 → 含义解读（plain English）→ 功德文化框架 → 相关内链**。
- 心经给**全文**（约 260 字 Xuanzang 本）+ 咒语；金刚经因原文过长，给**核心名句段落**（应无所住而生其心 / 凡所有相皆是虚妄 / 一切有为法如梦幻泡影等）+ 结构性摘要，诚实标注「节选、非全本」。
- 术语表：空/śūnyatā、般若波罗蜜多、菩萨、回向 —— 抓长尾词并教育用户。

### 2.2 每日修行打卡（留存钩子）
- **4 个可打卡项**：拜佛 🙏 / 诵经 📖 / 供灯 🕯️ / 静坐 🧘（任一即算当日打卡）。
- **仪式感设计**：
  - **Streak 连续天数**（火苗随天数进化 🌱→🕯️→🌿→🔥→✨→🏆）。
  - 统计卡：总天数 / 最佳连续 / 总打卡次数。
  - **30 天点阵**（填满=当天有修行，金框=今天）—— 像 GitHub 贡献图的仪式感版。
  - **回向意图**输入框（可写「为谁/为什么」，文化框架的 dedication）。
  - **分享卡浮层**：截图分享 streak（品牌卡，不含任何隐私数据）。

---

## 3. SEO 结构

- **每页独立**：title / meta description / keywords / canonical / OG / Twitter card，全部围绕单一信息型关键词簇（避免同类页互相打架）。
- **Schema.org JSON-LD**：
  - `sutras.html` → `CollectionPage` + `FAQPage`
  - `sutra-heart.html` / `sutra-diamond.html` → `Article` + `BreadcrumbList` + `FAQPage`
- **内链网**：索引 ↔ 两篇经文 ↔ 打卡页 互链；每页 footer/相关卡导流到 `daishao-en.html`（代祈福/供灯，接 §附 merit vertical）、`bazi-en.html`（算命）、`explore.html`（hub）。
- **为什么这些词好**：信息型（heart sutra text / diamond sutra meaning）搜索量大、意图明确、**商业竞争几乎为零**（对手都在卖算命，没人做干净的经文库）→ 低成本吃自然流量，再用内链把「查经文的人」转成「用 Runae 的人」。

---

## 4. 打卡怎么做的（localStorage · 技术）

- **单一 key**：`runae_practice_v1`，存 `{ days:{ 'YYYY-MM-DD':['bow','recite',...] }, best:Number, intent:String }`。
- **日期用本地时区** `YYYY-MM-DD`（避免 UTC 跨日错位）。
- **Streak 算法**：从「今天（或今天没打则昨天）」往回数连续有记录的天数；`best` 持久化历史最佳。
- **纯客户端**：无 fetch、无后端、无三方上传。刷新/重开浏览器保留；清缓存/换设备会丢（v1 已在 UI 明示「只存本设备」）。
- **无依赖**：原生 JS IIFE，try/catch 包 localStorage（隐私模式/禁用 storage 不报错，降级为不留存）。

---

## 5. 以后接后端存档（不在 v1）

> v1 刻意不碰后端。要做云存档时按此走，别改现有路由，新增独立端点。

- **触发点**：用户登录后 → 打卡数据从 localStorage **迁移/合并**到账户（首次登录做一次性 merge）。
- **建议端点**（新增，不复用/不污染现有）：`POST /api/practice/sync`（上行本地记录）、`GET /api/practice/log`（下行历史）。
- **数据模型**：`practice_log(user_id, date, acts[], intent, created_at)`，按 `user_id+date` 唯一。
- **冲突策略**：本地与云取并集（同日 acts 合并去重）。
- **别做的**：不要在 v1 就为了「以后」提前接后端 —— 会跟现有路由/部署对撞，违背题目红线。

---

## 6. 合规红线（最高优先级）

1. **经文=文化/精神内容**：定位为文化传承与学习参考，非宗教指导、非法本/仪轨定本（页面已明示 wording varies by edition、interpretive）。
2. **功德=文化框架**：`merit / gongde（功德）` 讲成**意图与价值的传统框架**，**禁**任何「念了/抄了必消灾、改运、治病、保佑成真」承诺。金刚经页更进一步：借经文本身「无所住行于布施」把功德概念也 empty 掉，强调不执着于回报。
3. **零编造**：只用真实存在的经文与公认释义；含义解读走保守、学术/心理向（emptiness=心理上放下执着的提醒），不发明教义、不伪造译文权威性。
4. **打卡不承诺功效**：明示「a personal ritual tool, not a religious claim」「for calm & reflection only」「nothing promises any specific outcome」。
5. **零族裔标签**：**不把「Chinese」当身份标签**贴给经文/用户。经文属于 Buddhist / Eastern spiritual tradition —— 用文化/传统措辞，不用族裔。
6. **全站免责**：footer 统一「cultural & study reference · not medical, legal, financial, or religious advice」。
7. **隐私**：打卡数据仅存本地、不上传（v1）；接后端后按 PIPL/隐私处理，回向对象姓名等敏感字段谨慎。

---

## 7. 坑 / 注意事项

- **金刚经不是全本**：原文太长，页面给核心段落 + 摘要并诚实标注「节选」。若要上全本，需单独排版长页 + 校对，别偷偷当全文发。
- **经文校对**：汉字原文与拼音需人工/专家过一遍（尤其咒语转写），避免 OCR/输入错字 —— 经文错字对这个受众是硬伤，损信任。建议出片前找懂佛学的人复审一遍（符合「专家复审」铁律）。
- **localStorage 会丢**：清缓存/隐私模式/换设备即丢；UI 已明示，但用户投诉「streak 没了」是可预期的 —— 这是 v1 有意的权衡，接后端才根治。
- **`daishao-en.html` 内链**：代祈福/供灯 vertical（见附）目前是 backlog，落地页在但功能未必跑通；内链先埋着，vertical 起来自然承接。
- **分享卡是浮层不是图片**：v1 靠用户截图分享（无 canvas 生成 PNG），足够 MVP；要做「一键生成图片分享」再加 canvas/html2canvas。
- **未接 sitemap/robots**：新页需加进站点 sitemap 才被快速收录（部署侧动作，不在本页）。

---

## 附：关联资产
- 设计源：`pages/home-en.html`（绿玉奶白系统）
- 内链目标：`pages/daishao-en.html`（Sacred Offerings/代祈福供灯）、`pages/bazi-en.html`（算命）、`pages/explore.html`（Runae hub）
- 关联 vertical：`docs/product/runae-temple-merit-vertical.md`（代办功德 —— 功德文化框架与本库同源，供灯/代诵经可与打卡/经文库交叉导流）
