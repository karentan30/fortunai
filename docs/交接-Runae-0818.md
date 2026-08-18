# Runae 交接 · 2026-08-18

> 承接 0817。本轮把英文站从"功能没露全+多处半成品"推到"20+功能全上线+拳头到10分"。

## 🔴 最紧急（都免费，就差一步，卡住两个功能）
1. **DeepSeek 余额**：曾用尽致报告全挂，已充值恢复。已加**免费兜底链**（`llm.js`：主力挂了自动切 Groq/Gemini），丢个免费 key 进 `server/.env` 更稳。
2. **Gemini 免费 key（GEMINI_API_KEY）**：去 aistudio.google.com 建免费key填 `server/.env`→重启。**同时解锁**面相手相"真读照片"(Gemini vision) + LLM免费兜底。你的 Gemini Max 订阅≠API，用不了，但这个 key 免费。
3. **Resend key**：邮件闭环已建，需 `server/.env` 有 Resend key 才真发信（无则静默降级）。

## 今天做完并上线（runae.app·记得URL带 .html）
- **八字报告拉到10分**（加载态命门/目录跳转/概览折叠/付费墙价值钩·命理9产品9设计9）
- **西方占星**新建（tropical真星盘·太阳月亮上升+相位）· **4东方系统英文页**（奇门/易经/紫微/大六壬·hub去coming soon）· **多语言起名 soul-name**（17语言）
- **面相手相**升麻衣神相（十二宫/八丘）+ 接免费Gemini vision真读照片 + 修了 lang=en 出中文的bug
- **3张病毒卡到10**（命格/身份卡/K线·9.5-9.8·晒卡门面）· **问事三件套深金分享卡**+真导PNG
- **会员权益**：chat 5→30/天·月费其他报告5折·年费去月度credit
- **邮箱闭环**：报告后要邮箱→发报告(链接回看)→进名单→5封每日营销模板(运势/安利/择时/裂变/升级)·全带HMAC退订
- **hub扩11→24功能** + **首页炫图样图** `home-wow-preview.html`（5护城河可视化·9.2·**待Karen拍板是否替换现素首页**）
- **dropshipping选品清单**（docs/marketing/runae/·Top5符文石/白鼠尾草/星座项链/星盘海报/塔罗牌·毛利65-75%）

## 待办
1. 填 Gemini/Resend 免费key（见上）。
2. **配图**（Karen要"各system画出来"+品牌头像+bio+掷筊/摇签真道具图）→ 下一步统一起草 ComfyUI prompt 给Karen过目再生成（本机免费）。
3. **首页**：定 home-wow-preview 是否替换素首页；替换前把占位数（稀有度%/竞品价/8000字）换真实数据。
4. **达人推广清单**（10个·agent在跑）+ 邮箱捕获目前加在 `bazi.html`(中)，Runae应挪到 `bazi-en.html`。
5. **"所有到10"**：目前到10的=八字报告+3张病毒卡；其余(西方占星8.5/麻衣面手/soul-name8.5/问事/4新系统)排队走审→改→复审loop。
6. 其它语言(PT/TH/ES/EN-IN)八字报告还留"2025-2026"和"chinese/gemstones"字样，待清。

## 红线/坑
- **零编造**：有引擎用引擎算(八字/星盘/奇门/易经)，LLM只解读；稀有度只显定性band不显假%。
- 零"Chinese"标签用"Eastern"·AI标识·娱乐参考免责·反宿命·14岁门·面手18+门+照片不存储披露。
- **celestine/引擎 dist 是 gitignore 的 build 产物**——曾致西方占星 require 时崩掉整个后端boot。已把 celestine 运行时强制入git。**以后 vendor 新引擎注意 dist 是否随部署**，且路由 require 失败要能降级不崩boot。
- runae.app 前端调API走**相对路径=同源**，不进CORS白名单。
- **SSH进HK用 `~/.ssh/id_ed25519`**（xinshen那把已失效）。部署：`ssh root@47.242.80.65 → cd /opt/shenyuan → git reset --hard origin/main → pm2 restart shenyuan`。
- Vercel攒批部署别每改必部署。

## 下一步
填两个免费key(Gemini/Resend) → 面手真读图+邮件+免费兜底全活。然后我起草配图prompt给Karen过目。
