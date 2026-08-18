# Runae 交接 · 2026-08-18 晚

## 做了什么（本轮·全部已上线）
- **救活四大东方系统**：奇门/易经/大六壬生产 500（mingyu-core 引擎被 gitignore 漏掉没部署）→ force-add vendor 入 git 修复。
- **面相/手相"真读照片"从假读变真读**：HK 服务器被 Google Gemini API 地理封锁，vision 改用 **Qwen-VL**（Qwen-VL 实测真读五官/守不编造红线）；前端不再暴露模型名（"Google Gemini"→"our secure AI"）；vision 切更快的 qwen-vl-plus。
- **生成"failed to generate"修复**：真凶=DeepSeek key 402 余额空 + 前端 30s 超时（报告要 40-54s）。装了 Karen 给的**新 DeepSeek key**（`sk-0979...`，有钱），实测八字/面相都能出报告。LLM 兜底链 Qwen 主力兜底正常。
- **会员徽章右上角中文重叠修复**：common.js 全站注入的 "👑会员已解锁" 硬编码中文压住 lang-toggle → 按语言本地化(en/ko/zh) + 下移 top:52px 防重叠。
- **品牌 SEO 全站统一 Runae**：11 个英文页 title/og/canonical/hreflang/可见logo/社交handle 从 ShenYuan+shenyuan.mylumee.cn → **Runae+runae.app**（0 残留）。
- **炫图首页(home-wow-preview)**：清红线假数据(假稀有度%/编造竞品Portveller/假8000字)+对齐真实定价；出**克制版**(砍抽卡稀有度+竞品对比两段·收敛5段)。部署在 `runae.app/pages/home-wow-preview.html`，未替换现首页。
- **多体系交叉验证 PRD**：PM初稿→专家审6.5分→按4个P0改到可动工版，存 `docs/PRD-多体系交叉验证-v2-可动工.md`。

## 待办 · Karen 拍板
1. **英文定价统一**：PRD阶梯 问事$2.90/3次包$6.90/单报告$9.90/合婚$19.90/会员$9.90月·$69年 —— 确认后全站对齐(CMO说现在4个价打架)。
2. **多体系PRD Phase1 是否开工**（~4周三期）。
3. **中文首页瘦身**（CMO：首屏15+入口太乱→1主CTA+4卡）。
4. **炫图版是否替换现素首页**。
5. **社交账号**：@runae 的 ins/tiktok/reddit 是否已注册（链接已改，账号要你建）。

## 待办 · 技术(拍完板我做)
- CMO高杠杆修改：定价全站对齐 · 首页瘦身 · bazi-en表单去两段宣传 · **面相/手相上传前明示价格**(现在传了照片才撞付费墙·退出率高)
- **面相/手相流式提速**(现54s阻塞·改流式像八字·真正"变快")
- 多语言报告残留脏字样(PT/TH/ES的"2025-2026/chinese/gemstones")
- 邮箱捕获挪到 bazi-en.html

## 红线/坑
- **DeepSeek key 会换账号**：服务器旧key(sk-8597..)402空·新key(sk-0979..)Karen昨天充值的账号。付费key只在服务器`server/.env`手动填·不进git。
- **HK服务器地理封锁 Gemini**：面手vision/LLM兜底都别指望Google，用Qwen(DASHSCOPE)。`LLM_PRIORITY=qwen,deepseek,groq`在.env。
- **vendor引擎dist被gitignore**：新vendor引擎必须force-add运行时入git + 部署后服务器smoke真跑(见 [[reference_shenyuan_hk_infra_landmines]])。
- **前端30s超时守卫**：报告要40-54s·阻塞式端点会撞超时报failed。八字是流式(meta秒回清守卫)所以OK·面手是阻塞式待改流式。
- **不对用户暴露用哪个model**（Karen铁律）。
- 部署：`ssh -i ~/.ssh/id_ed25519 root@47.242.80.65` → `/opt/shenyuan` → `git fetch && git reset --hard origin/main` → 静态文件无需重启·改后端`pm2 restart shenyuan --update-env`。大传输加`ServerAliveInterval=15`。

## 下一步
Karen 定①定价②PRD开工③首页 三件 → 我批量执行 CMO 修改 + 起 Phase1。
