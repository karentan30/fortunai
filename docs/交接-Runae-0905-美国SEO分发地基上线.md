# Runae 交接 · 0905（美国市场 SEO/AEO 分发地基上线 + 全量公网验证）

> main 已 push（`28ab541 → a1ad926`，3 个 SEO commit）+ 服务器 `/opt/shenyuan` git reset origin/main + `pm2 restart shenyuan` + health 200。**外加一处 Caddy 基建修复（不在 git 里，见红线）。**

## 一句话
Runae 产品已封板，本轮把"美国自然流"的分发地基做齐并**在真实公网 runae.app URL 上逐条验证 10/10**：新增 `llms.txt`(AEO) + 英文 `sitemap-en.xml`(51 URL) + `robots.txt` 显式欢迎 AI 爬虫 + 3 个 money/hub 页补 FAQPage schema。QA loop 抓出并修掉两个"服务器本地对、公网 404"的 Caddy 地雷。

## 做了什么（全部已上线 + 公网验证 200）
- **`/llms.txt`**（新建）：让 ChatGPT/Perplexity/Claude 回答八字/命理问题时引用 runae.app。含方法定义(BaZi/Day Master/Five Elements) + 18 个链接，全部实存。
- **`robots.txt`**（重写）：显式 `Allow` GPTBot/OAI-SearchBot/ChatGPT-User/PerplexityBot/ClaudeBot/Google-Extended/Applebot-Extended 等 + 挂 `sitemap-en.xml`。
- **`sitemap-en.xml`**（新建）：51 条**纯英文** URL（en.html 首页 + bazi/hehun/ziwei/iching/qimen 等方法页 + 15 篇英文指南 + 24 个程序化SEO页），全部 runae.app 域，不混中文。
- **FAQPage schema**（喂 Google People Also Ask / AI 摘要）：加在 `pages/bazi-en.html`(money) + `pages/en.html`(公网英文首页) + `pages/hehun-en.html`(合婚 money)。答案守诚实红线（自我认知/娱乐/AI 标识/非宿命/不给医疗法律财务建议）。

英文内容其实早备齐（6 方法页 + 15 篇英文指南 + P2 元素页 10 + 合婚页 ~14），**真缺口一直是 distribution 不是内容**——本轮补的是"让美国搜索/AI 找得到并引用"。

## 🔴 红线 / 坑（必读）
1. **Caddy `@bare` 重写地雷（本轮修复·不在 git）**：`runae.app` 的 Caddy 块有 `@bare { path *.html; not path /pages/* } → rewrite /pages{path}`，会把**所有非 /pages/ 的 .html 改写到 /pages/**。后果：`/blog/*.html` 被改写成不存在的 `/pages/blog/*.html` → **15 篇英文博客公网全 404**（服务器 localhost:3021 却是 200，极易被骗过）。
   - **已修**：给 `@bare` 加 `not path /blog/*`，`caddy validate` 通过 + reload，54 条 URL 复验全 200。
   - **备份**：`/etc/caddy/Caddyfile.bak.0905`。**此修改在服务器 `/etc/caddy/Caddyfile`，不在仓库**——重装/迁服务器务必重做，否则博客再次全 404。
   - 同源既有地雷 [[reference_shenyuan_hk_infra_landmines]]（Caddy 强制 /pages 重写 + 要直接访问的 html 必放 pages/）。
2. **`/en.html` 公网 serve 的是 `pages/en.html` 不是根 `en.html`**（同一 @bare 重写）。改英文首页要改 `pages/en.html`；根 `en.html` 只有 Node localhost 能到，公网够不着。
3. **sitemap/robots 曾硬编码 shenyuan.mylumee.cn**（大陆域名）。已改指 runae.app。英文页 canonical 本来就已是 runae.app（HTML 里 0 处 .cn）——**别再以为要迁域名**。
4. 旧 `sitemap.xml`（.cn·800 行·含中文站）保留服务 .cn 大陆站，未动。英文站独立走 `sitemap-en.xml`。

## 待办（需 Karen / 下一步）
1. **提交 Google Search Console**（真正触发收录的开关·需你的 GSC 账号）：加 runae.app 资源 → Sitemaps 提交 `https://runae.app/sitemap-en.xml` → 用 URL Inspection 抓 3-5 个重点页请求收录（en.html / bazi-en / what-is-a-day-master）。
2. **Bing Webmaster Tools** 同样提交 sitemap-en.xml（Bing 喂 ChatGPT 搜索，AEO 重要）。
3. **抢 @runae**（TikTok/IG handle·比域名更急·见 [[project_shenyuan_english_name_runae]]）。
4. 部署红线仍在：付款 E2E 逐方法自测（见 [[交接-Runae-0903]]），与本轮 SEO 无关。

## 下一步（分发实验，非本轮）
SEO/AEO 是慢引擎（2-3 月见效），已埋好。快引擎走内容分发：Runae 美国走 TikTok 占卜赛道自然流 + 小红书 AI 掌纹图冷启动（钩子见 `docs/获客-AI掌纹图-小红书-0820.md`）。
