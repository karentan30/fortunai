# CMO优化PRD — 善缘ShenYuan灵性平台

> 版本：v1.0 | 日期：2026-07-27 | 基于CMO全站审查结果
> 目标：将所有评分维度提升至 9.5/10，实现海外灵性赛道获客能力

---

## 评分概览与目标

| 维度 | 当前评分 | 目标评分 | 差距 | 优化后影响 |
|------|---------|---------|------|-----------|
| 品牌一致性 | 7/10 | 9.5/10 | 主题色统一+社交证明 | 信任度提升，降低跳出率 |
| SEO | 0/10 | 9.5/10 | **全链路缺失，P0紧急** | 自然搜索流量从0→有 |
| CTAs与转化漏斗 | 7/10 | 9.5/10 | 紧迫感+体验一致性 | 转化率预计提升30%+ |
| 内容质量 | 8/10 | 9.5/10 | 免责声明补全 | 合规风险归零 |
| 性能 | 6/10 | 9.5/10 | 图片压缩+字体缓存 | 加载速度提升40%+ |

---

## P0 — 紧急必做（直接影响获客与合规）

### 1. SEO全链路建设

**现状**：35个页面全部缺失 meta description / Open Graph / Twitter Card / JSON-LD结构化数据。Score: 0/10。

#### 1.1 全站 meta description 注入

- **优先级**：P0
- **工作量**：8小时（35页面 × 10分钟编写 + 2小时注入脚本）
- **实现方案**：
  - 在页面 `<head>` 中动态注入 `<meta name="description">`
  - 每个功能页面独立撰写中文description（140-160字），含核心关键词：命理、八字、塔罗、水晶、灵性
  - 英语版本页面补充英文description
  - 使用模板引擎或构建脚本批量生成（纯原生JS项目，统一在 header 片段中维护）
  - content样例：`"善缘ShenYuan — 海外华人首选灵性平台。AI八字命理、塔罗占卜、水晶疗愈、大师直播代烧。12800+用户信赖，36位认证大师在线。"`
- **验收标准**：
  - 所有35页 `<head>` 包含唯一 meta description
  - Google Search Console 可抓取到每页 description
  - description 含核心关键词且不重复（页面之间unique）

#### 1.2 Open Graph + Twitter Card 注入

- **优先级**：P0
- **工作量**：4小时（头部模板一次性接入 + 每页变量配置）
- **实现方案**：
  - 在 `<head>` 统一注入以下标签，根据当前页面动态填充：
    ```html
    <meta property="og:title" content="...">
    <meta property="og:description" content="...">
    <meta property="og:image" content="https://shenyuan.com/og-default.jpg">
    <meta property="og:url" content="...">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="...">
    <meta name="twitter:description" content="...">
    <meta name="twitter:image" content="...">
    ```
  - 每个功能页维护自己的 og_title/og_description 变量
  - 设计一张通用 OG 图片（深色底+金色"善缘ShenYuan"LOGO+玉绿点缀，1080x630px）
  - 部分高流量页面可定制 OG 图（如八字排盘、塔罗牌阵）
- **验收标准**：
  - 任一页面分享到微信/WhatsApp/Telegram/Twitter均显示正确标题+描述+预览图
  - Facebook Sharing Debugger 抓取无报错
  - Twitter Card Validator 验证通过

#### 1.3 JSON-LD 结构化数据

- **优先级**：P0
- **工作量**：6小时（模板+每页面定制字段）
- **实现方案**：
  - 全站基础：`WebSite` + `Organization` schema
    ```json
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "善缘ShenYuan",
      "alternateName": "ShenYuan Spiritual",
      "url": "https://shenyuan.com",
      "description": "..."
    }
    ```
  - AI功能页补充：`WebApplication` schema（含 applicationCategory=Multimedia/Spiritual）
  - 塔罗/八字页补充：`Service` schema
  - 大师页面补充：`Person` + `Service` schema
  - 定价页补充：`Product` / `Offer` schema
  - 所有JSON-LD放在 `</head>` 前注入
- **验收标准**：
  - Google Rich Results Test 所有页面通过
  - Search Console 结构化数据报0错误
  - 至少出现 WebSite、Organization、WebApplication 三种schema

#### 1.4 Sitemap 与 Robots 完善

- **优先级**：P0
- **工作量**：2小时
- **实现方案**：
  - 审计现有 sitemap.xml，确认包含全部35个页面+无404链接
  - 补充 lastmod / changefreq / priority 字段
  - 确认 robots.txt 无 Disallow 误伤，Allow 核心功能路径
  - 提交 Google Search Console + Bing Webmaster Tools
- **验收标准**：
  - 35个页面全部在 sitemap.xml 中列出
  - GSC 索引率 ≥ 90%

---

## P1 — 重要优化（直接影响转化与信任）

### 2. 品牌一致性提升

**现状**：7/10。深色+金色+玉绿主设计系统统一，但会员页用紫、塔罗用紫黑、八字用棕，部分页面缺失英文品牌名，社交证明缺真实用户评价。

#### 2.1 页面主题色统一

- **优先级**：P1
- **工作量**：10小时（每页面主色调调整平均20分钟 + QA回归）
- **实现方案**：
  - 建立 CSS 变量系统（`:root`），统一色板：
    ```css
    :root {
      --color-bg-primary: #0a0a0f;      /* 深空底 */
      --color-gold: #c9a84c;            /* 金色主色 */
      --color-gold-light: #e8d48b;      /* 金色高光 */
      --color-jade: #4a9e8f;            /* 玉绿点缀 */
      --color-jade-light: #6bc5b4;      /* 玉绿浅色 */
      --color-accent: #c9a84c;          /* CTA统一用金 */
      --color-text-primary: #f0ece4;    /* 暖白主字 */
      --color-text-secondary: #8a867e;  /* 灰金辅助 */
    }
    ```
  - 会员页：紫色 → 金色+玉绿渐变，取消紫色独立调性
  - 塔罗页：紫黑 → 深空+金色点缀，保留神秘感但不偏色
  - 八字页：棕色 → 玉绿+金色，保持五行感
  - 全站所有CTA按钮统一使用 `var(--color-gold)` 为主色
- **验收标准**：
  - 任何两个页面截图并列，主色调无感知冲突
  - CSS变量覆盖率 ≥ 95% 的颜色引用
  - 无障碍对比度：金色文字在深色底上 ≥ 4.5:1

#### 2.2 英文品牌名全站覆盖

- **优先级**：P1
- **工作量**：2小时
- **实现方案**：
  - 所有页面header/Navbar添加 "SHENYUAN" 或 "ShenYuan" 英文标识
  - Logo区域统一格式：中文"善缘" + 英文"ShenYuan" 上下/左右排列
  - Footer补充英文品牌名和简短tagline
  - `<title>` 标签统一格式：`页面名 - 善缘ShenYuan | Spiritual Platform for Chinese Diaspora`
- **验收标准**：
  - 所有35个页面header可见 "ShenYuan" 英文标识
  - 浏览器tab标题统一格式
  - 截图中英文品牌名出现率 = 100%

#### 2.3 社交证明强化

- **优先级**：P1
- **工作量**：8小时（评价组件开发 + 数据采集方案）
- **实现方案**：
  - 在首页现有数字（12846用户/36大师/9.2分）下方增加真实用户评价轮播区
  - 评价组件：
    - 显示用户头像（首次字母生成）+ 昵称 + 星级 + 评价摘要
    - 每页3条，自动轮播，可手动滑动
    - 数据源：后端收集的用户反馈表 / 支付后邀请评价
  - 优先展示5条高质量的AI命理评价（可手动筛选）
  - 每条评价附带"已验证用户"标识增加可信度
  - 各功能页底部嵌入评价区，关联该功能（如八字页只显示八字相关评价）
- **验收标准**：
  - 首页可见 ≥ 5条真实评价
  - 评价区加载延迟 ≤ 1秒（懒加载）
  - 评价可点击展开全文
  - 至少80%的功能页底部有该功能关联评价

### 3. 转化漏斗优化

**现状**：7/10。首页→免费运势CTA明显，首页→会员有横幅，功能页→付费墙存在但不一致，无紧迫感。

#### 3.1 付费墙体验统一

- **优先级**：P1
- **工作量**：6小时（每功能页付费墙改造 + AB测试准备）
- **实现方案**：
  - 统一付费墙组件样式：半屏底部弹窗 / 居中卡片，所有功能一致
  - 付费墙内容统一：功能预览（免费x次用完）→ 价值主张 → 定价 → CTA
  - 免费次数用完后的体验路径标准化（不出现有的页面弹窗、有的跳转等不一致）
  - 付费墙在免费用户第n次触发时显示（n按功能配置）
- **验收标准**：
  - 所有11个AI功能付费墙样式完全一致
  - 从触发到展示 ≤ 1.5秒
  - 付费墙转化率相比改造前提升 ≥ 15%（由PostHog追踪）

#### 3.2 紧迫感与限时策略

- **优先级**：P1
- **工作量**：4小时（倒计时组件 + 限时策略逻辑）
- **实现方案**：
  - 新用户注册后显示 "首单7折 · 剩余23:59:59" 倒计时（每人一次）
  - 付费墙可选文案 "限时优惠 · 今日加入省XX%"（配合A/B测）
  - 节假日/新月/满月等灵性节点自动触发限定折扣（如中秋/冬至/农历初一）
  - 不制造虚假紧迫（真限时，后台可配置时长）
- **验收标准**：
  - 新用户注册72h内可见限时优惠倒计时
  - 倒计时组件无闪烁/时间不同步bug
  - 限时策略对转化率的lift ≥ 20%（对比无紧迫感版本）

---

## P2 — 常规优化（体验优化与合规补全）

### 4. 内容质量增强

**现状**：8/10。AI prompt质量9分，定价清晰，会员权益对比表好，有隐私政策和服务条款。AI结果页缺免责声明。

#### 4.1 AI生成结果页免责声明

- **优先级**：P2
- **工作量**：1小时（统一组件注入）
- **实现方案**：
  - 所有AI生成结果（八字/塔罗/命理等11个功能）底部固定插入免责声明
  - 文案统一：`"⚠️ 仅供娱乐参考。AI命理结果由人工智能生成，不构成专业建议。"`
  - 样式：灰色小字，带⚠️图标，与结果区域间距 ≥ 16px
  - 英文页面补充英文版：`"⚠️ For entertainment purposes only. Results are AI-generated and not professional advice."`
  - 写死在HTML模板中，不依赖JS加载（保证即使API失败也有免责）
- **验收标准**：
  - 11个AI功能页面全部可见免责声明
  - 声明文字不可被用户关闭/跳过
  - 中英文版各自显示正确语言

#### 4.2 Prompt质量持续优化

- **优先级**：P2
- **工作量**：持续（每月review）
- **实现方案**：
  - 建立 prompt 版本管理（当前9分 → 目标10分）
  - 每两周收集用户反馈（喜欢/不喜欢的原因），迭代prompt
  - 添加结构化输出格式保证（JSON schema validation）
  - 引入温度参数AB测试（0.7 vs 0.9 哪个更受用户喜欢）
- **验收标准**：
  - 用户满意度评分（PostHog追踪）≥ 4.5/5
  - 回答长度控制在合理区间（无截断/无过长啰嗦）

### 5. 性能优化

**现状**：6/10。纯原生JS无框架(✓)、CSS内联(✓)、Google Fonts每次从Google拉(✗)、345张GPU图未压缩(✗)。

#### 5.1 Google Fonts 自托管

- **优先级**：P2
- **工作量**：2小时（下载+替换引用）
- **实现方案**：
  - 下载当前使用的Google Fonts字体文件（woff2格式）
  - 放入项目 `/assets/fonts/` 目录
  - 修改CSS中的 `@import` 或 `<link>` 为本地 `@font-face`
  - 添加 `font-display: swap` 保证FOUT体验
  - 预加载关键字体：`<link rel="preload" as="font" href="/assets/fonts/...">`
- **验收标准**：
  - 无外部Google Fonts请求（Network tab过滤0请求）
  - 字体加载时间从 ~500ms 降至 < 50ms
  - Lighthouse Performance 分数提升 ≥ 5分

#### 5.2 GPU图片批量压缩

- **优先级**：P2
- **工作量**：6小时（自动化脚本+质量抽查）
- **实现方案**：
  - 使用 `sharp` (Node.js) 或 `squoosh-cli` 批量处理345张图片
  - 压缩策略：
    - PNG → PNGquant (quality 65-80)
    - JPG → MozJPEG (quality 75-85)
    - 大图（>200KB）→ WebP 格式 + fallback
  - 保留原始文件备份，压缩后覆盖
  - 建立自动化脚本 `scripts/optimize-images.js`，后续新增图片自动走流程
- **验收标准**：
  - 总图片体积减少 ≥ 60%
  - 无肉眼可见画质损失（抽查10%样本）
  - 最大单图体积 < 150KB
  - 首页首屏图片加载 ≤ 2秒（3G模拟）

#### 5.3 其他性能优化

- **优先级**：P2
- **工作量**：3小时
- **实现方案**：
  - CSS内联好处保留，但将全局样式提取为单文件 `global.css` 并 `<link>` 引用（利用缓存）
  - 关键路径CSS内联 `<style>`，非关键CSS异步加载
  - 对JS脚本添加 `defer` / `async` 属性（按依赖关系选择）
  - 启用 HTTP/2（HK服务器 Caddy 已支持）确保多请求无队头阻塞
- **验收标准**：
  - Lighthouse Performance ≥ 85
  - First Contentful Paint ≤ 1.5s
  - 页面完全加载 ≤ 3s (4G模拟)

### 6. 技术排障

**现状**：HK服务器运行正常，Vercel前端缺环境变量不可用。

#### 6.1 Vercel环境变量配置

- **优先级**：P1（阻塞线上更新和Stripe收款）
- **工作量**：1小时
- **实现方案**：
  - 在 Vercel Dashboard → Project Settings → Environment Variables 添加：
    - `DS_KEY` = DeepSeek API Key（同HK服务器上的key）
    - `STRIPE_SECRET_KEY` = Stripe Secret Key
    - `STRIPE_PUBLISHABLE_KEY` = Stripe Publishable Key
    - `NEXT_PUBLIC_SITE_URL` = Vercel部署域名
  - 或者通过 Vercel CLI 批量设置：`vercel env add`
  - 部署后验证：访问Vercel域名，确认AI功能和支付正常
- **验收标准**：
  - Vercel前端访问无500错误
  - AI命理功能可正常调用DeepSeek API
  - Stripe支付流程可用（测试模式）

---

## 实施优先级总表

| 编号 | 项目 | 优先级 | 估时 | 依赖 | 预期效果 |
|------|------|--------|------|------|---------|
| 1.1 | meta description | P0 | 8h | 无 | SEO从0分起步 |
| 1.2 | OG + Twitter Card | P0 | 4h | 1.1（description可复用） | 社交分享有预览 |
| 1.3 | JSON-LD | P0 | 6h | 无 | 搜索引擎富摘要 |
| 1.4 | Sitemap完善 | P0 | 2h | 无 | 索引率提升 |
| 2.1 | 主题色统一 | P1 | 10h | 无 | 品牌感知一致 |
| 2.2 | 英文品牌名覆盖 | P1 | 2h | 无 | 国际化品牌识别 |
| 2.3 | 社交证明强化 | P1 | 8h | 后端评价数据接口 | 信任转化 |
| 3.1 | 付费墙统一 | P1 | 6h | 无 | 转化率提升 |
| 3.2 | 限时紧迫感 | P1 | 4h | 3.1（付费墙改造后） | 转化率提升 |
| 4.1 | 免责声明 | P2 | 1h | 无 | 合规 |
| 4.2 | Prompt优化 | P2 | 持续 | 无 | 用户满意度 |
| 5.1 | 字体自托管 | P2 | 2h | 无 | 加载速度 |
| 5.2 | 图片压缩 | P2 | 6h | 无 | 加载速度 |
| 5.3 | 其他性能 | P2 | 3h | 5.1（字体先做） | 加载速度 |
| 6.1 | Vercel环境变量 | P1 | 1h | 无 | 线上可用 |

**总估时**：~63小时（含持续项）

---

## 风险与注意事项

1. **SEO的0分是最大风险** — 35个页面在搜索引擎中完全不可见，等于线上获客渠道为0。P0项必须在本周内全部上线。
2. **Vercel环境变量缺失阻塞部署** — 如果未来切换到Vercel部署为主，需优先解决；短期以HK服务器为生产环境。
3. **图片压缩不可过度** — 灵性/命理类用户对视觉质感敏感，WebP压缩建议 quality ≥ 80，每次上线前人工抽查10张关键图片。
4. **付费墙改造需A/B测试** — 不要盲目上线新付费墙，用PostHog分50%流量测试7天使数据说话。
5. **免责声明是法律底线** — 命理/灵性属于敏感行业，AI生成内容缺免责声明在海外有诉讼风险。4.1不可跳过。

---

## 验收总则

当以下条件全部满足时，CMO优化视为完成：

1. SEO：35页全部有唯一 meta description + OG tags + JSON-LD，GSC索引率 ≥ 90%
2. 品牌：所有页面主题色统一于 `--color-gold` + `--color-jade` 体系，英文标识全覆盖，首页 ≥ 5条真实用户评价
3. 转化：11个AI功能付费墙样式一致，新用户可见限时倒计时
4. 合规：11个AI结果页全部含免责声明
5. 性能：Lighthouse ≥ 85，所有图片压缩后总大小减半，Google Fonts 0外部请求
6. 技术：Vercel前端可用，AI+Stripe功能正常
