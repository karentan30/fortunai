# 交接 · Runae 大重构(2026-09-10)

> 本轮把 Runae 从"48个各自为政的方法页/185页乱产品"重构成**统一的 3 页流程 + 文档版报告**,中英双语,深色玉金统一设计。全部 commit + push + 部署上线。

## 0. 生产事实 / 部署
- **生产分支 = `main`**(服务器 `/opt/shenyuan` 跑 main·PM2 名 `shenyuan`·端口 3021)。本地开发在 `deploy-main-compliance`,部署方式:`git push origin HEAD:main` → 服务器 `git fetch && git reset --hard origin/main`(后端改动加 `pm2 restart shenyuan`)。
- 域名:**runae.app**(英文·根页 `pages/home-en.html`)/ **shenyuan.mylumee.cn**(中文·根页 `index.html`)。二者同一台服务器。
- push 用 `git -c http.version=HTTP/1.1 push`(本机代理会 HTTP/2 报错)。

## 1. 本轮做完(全部上线)
**3 页流程(新·统一设计)**:`collect.html`(收集:生日三下拉+方向+可选照片·存 localStorage `runae_profile`)→ `pick.html`(选 7 个热门方法·按方向排序·缺照片置灰)→ 各方法**报告页**。
**7 方法报告页**(全新设计·接真引擎·双语):`report-v2`(八字·文档版)/`report-daily`/`report-astrology`(/api/western-astrology)/`report-tarot`/`report-hehun`/`report-palm`/`report-face` + `advisor-chat`(AI顾问·/api/chat)+ `booking`(真人预约·/api/support-ticket·中性占位命理师)。
**八字文档版报告**(参照 Slim 逆龄医疗报告·Karen 拍板):核心洞察(格局/用神/缺五行·真数据)→ 四柱命盘(金字+拼音)→ 五行能量条 → **人生运势曲线SVG**(大运确定性算分·当前段高亮)→ 深度解读(分章流式)→ 大运时间轴 → 开运锦囊 → **开运品带货位**(按用神/缺五行推·链 shop·合规)→ 付费墙 → 交叉印证 → 顾问。**免费/付费内建**(免费=命盘+五行+核心洞察+性格;付费墙后=大运深度+逐年+事业财运感情)。
**设计**:深色玉金(bg `#060e0d`+玉 `#4fbfa0`+金 `#dcc082`·同首页)·serif 标题·10分样图专家审 7.3→10(`docs/mockups/runae-mockup-10-FINAL.html`)。首页(中英)也重做成这套设计。
**性能**:八字报告分章流式(命盘~1.5s 秒出·替 36s 白屏);确定性数据(命盘/五行/大运/曲线)从 `/api/bazi/stream` meta 秒出不烧 LLM。
**双语**:全流程 `?lang=en` + localStorage `runae_lang`·首页写死语言锚;母语英文改写去 Chinglish;八字术语翻译(戊土→Wu·Earth·天干地支拼音·十神英文)。
**合规**:清了 gongfeng/life-events/seo-bazi/7语言LP 的编造证言+疗效承诺+假数据(见 `交接-0909夜-优化到10-合规审计+已修+待Karen.md`);付费墙后端切分不漏;真人预约零编造。
**修的坑**:日期原生控件深色看不清→color-scheme:dark;英文页显中文年月日→三下拉;报告空生日→守卫回collect;匿名限流 30→150/小时(分章一次~11调用)。

## 2. 🔴 待 Karen 拍板/提供(我做不了)
- **真人命理师**:`booking.html` 现为中性占位,等你给真人名字/资质/定价(合规红线·我不编造)。
- **masters.html**:旧页有 6 个虚构收费命理师,未清(产品决策·要不要下线/换真人)。
- **DeepSeek 充值**(可选):qwen 免费已能跑全部;充了 DeepSeek 文笔更好(prod `.env` LLM_PRIORITY 现 qwen 在前)。
- **Stripe webhook secret 轮换**:上次 `.env.bak` 泄露·ADMIN_TOKEN 已轮换·webhook 待你后台 roll(见 `docs/密钥轮换-runbook.md`)。
- **付费真单回归**:Windows 机用 test key 验 tarot_5/tarot_3/saju_kr_full 真付费用户不被误挡(见协作留言板)。

## 3. 待办(可继续做)
- life-events "病情推算/临终时辰"服务(涉疾病/死亡·建议下线或改写)、gongfeng 疗效措辞、7语言LP编造证言改写(参照 `lp-bazi-en-b:1353` illustrative examples)。
- 旧散页逐步下线/路由到新流程(首页主 CTA 已接 collect)。
- 报告标题占位、其余小 P1。

## 4. 红线 / 坑
- **密钥值永不进 git/聊天**(`.env.bak` 事故教训)。
- **另一会话/Windows机也在 fortunai 提交**(同 karen 身份)·改前先 pull·协作看 `~/projects/shared/协作/留言板.md`。
- runae.app 根=home-en(英文)·中文在 .cn;runae.app 上没有中文首页(/index.html 报错)。
- 原生 select/date 控件在 Mac 深色下需 color-scheme:dark + option 显式深底亮字。

## 5. 样板/关键文件
- 样板:`docs/mockups/runae-report-sample.html`(文档报告样张)· `runae-mockup-10-FINAL.html`(3页流程10分定稿)
- 真实:`pages/report-v2.html`(八字真报告)· `collect.html`/`pick.html`/`report-*.html`/`advisor-chat.html`/`booking.html`
- 设计token:深色玉金(见任一 pages/report-v2.html :root)
