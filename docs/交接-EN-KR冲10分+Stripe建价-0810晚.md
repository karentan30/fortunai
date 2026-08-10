# 善缘 ShenYuan · 英文/韩文冲 10 分 + Stripe 自建价 交接（2026-08-10 晚）

> 接手先读这份。目标：EN/KR 版做到与中文版同级（marketing/产品/UX 10 分）。
> **本轮只 commit + push，尚未部署**（守攒批部署铁律）。生产 `/opt/shenyuan` 仍是旧版，需 Karen 发话后一次性 `bash deploy.sh all`。

---

## 一、本轮做了什么

### 1. EN/KR 全面优化（多轮 产审分离 + QA loop）
- 6 份顶尖专家评审 → 3 个实现 agent → 集成补丁 + 修复 → 2 个 Opus 验收 → 3 个 wave-3 收尾 → **第 3 轮独立专家验收团**。
- **英文**：首页/八字/合婚/聊天/会员/关于/退款全套，定价统一、Day Master 免费钩子、SSE 流式（hehun）、无障碍、金色统一 `#c4a24a`。
- **韩文**：saju 四柱盘渲染（일주 금색高亮）、分享卡真八字、Pretendard 去明朝体、去中国感（烟雾/酱金/子시→자시）、术语 合婚→궁합、SSE 逐段流式、₩ 定价。

### 2. Stripe 价格 —— 我自己建的（Karen 授权 "stripe id 你自己建"）
用服务器 `.env` 的 `STRIPE_PAY_SECRET_KEY` 调 Stripe API 建了 **5 个缺失的 USD price**（key 全程只在服务器内，未外泄）：

| SKU | 金额 | priceId |
|---|---|---|
| bazi_full | $9.90 一次性 | price_1U2uotEAXrE2YgcrdOvtLSB6 |
| hehun_full | $19.90 一次性 | price_1U2uotEAXrE2YgcrnW5iYdrj |
| member_monthly | $9.90/月 | price_1U2uouEAXrE2YgcrhD1McCY5 |
| member_quarterly | $24.90/3月 | price_1U2uouEAXrE2YgcrjtiXb7h6 |
| member_yearly | $69/年 | price_1U2uovEAXrE2YgcrwvxdsOUC |

全部与 `server/lib/store.js` 的 amount 逐一核对一致（990/1990/990/2490/6900），已填入 `payment.js` 的 `STRIPE_PRICE_IDS` 并启用。

### 3. 抓到一个「会乱收钱」的 KRW bug（已修）
3 个旧韩元 price 与 store.js 当前降价不符（韩国用户看 ₩9,900 却会被扣更多）：
- bazi_full_krw 旧 ₩14,900 vs store ₩9,900
- bazi_vip_krw 旧 ₩24,900 vs store ₩19,900
- member_monthly_krw 旧 ₩12,900 vs store ₩9,900

**修法**：停用这 3 个固定 price，改走 `price_data` 动态（`unitAmount = amountKrw`，永远与前端展示一致）。对得上的 3 个韩元 price（saju_kr_full ₩9,900 / hehun ₩4,900 / hehun_kr_full ₩19,900）保留固定 priceId。

### 4. 第 3 轮验收后修的 P1（本会话手改的 6 个前端文件）
- **member-en.html**：删除 4 条编造具名 5 星好评（Chloe L./Sydney 等，PIPL/FTC 虚假证言风险）→ 改为合规的产品价值陈述。
- **bazi-en.html**：删「2,847 people have set their reminder」假人数 → 软化文案 + 提对比度。
- **chat-EN.html**：补免责行（算命聊天页原本 0 处免责，其余 -en 页都有 4-5 处）。
- **pages/en.html**：孤立旧首页（Aug5，锁缩放 + 旧价 $4.99/$1.99 + 把英文用户甩去中文页）→ 替换为 301 式重定向到真首页根 `/en.html`（无站内引用，安全）。
- **hehun-KR.html / saju-KR.html**：免责/付款脚注 10px→11px（法务可读性）。

---

## 二、第 3 轮验收结论（独立专家评审团）

| 版本 | 营销 | 产品 | UX | 总 | 结论 |
|---|---|---|---|---|---|
| 英文 | 8.5 | 8.0 | 8.5 | **8.3/10** | 可上线（主付费链路核价通过·不乱收钱不崩） |
| 韩文 | 10 | 9.5 | 9.0 | **28.5/30** | GO（无 P0/P1） |

两版**主付费链路收款安全**（价格=后端、product 字段正确、SSE 无 `r.json()` 误用）。

---

## 三、剩余待办（明日项，均非阻断上线）

**P1（体验冲刺）**
- [ ] **bazi-en 流式对齐**：`bazi-en.html:502` 仍用 `/api/bazi` + `r.json()`（阻塞式），后端已有 `/api/bazi/stream` SSE（divination.js:2416）。照 hehun-en 的 `getReader()` 模式改，让旗舰付费品也逐段揭示。

**P2（打磨/卫生）**
- [ ] 韩文死 CSS 清理：saju-KR `.mini-review*`/`.activity-toast`（:133-144）、saju-landing-KR `.dday`（:125-128）—— 无 JS/HTML 调用，删掉防未来误启用假证据。
- [ ] EN 正文 11px 触底项提到 12px：bazi-en:741、根 en.html:77 review-text。
- [ ] 低对比金字（alpha 0.35）承载信息处提到 ≥0.6。

**Karen 亲自闸（我不能代做）**
- [ ] **Kakao JS key**：`saju-landing-KR.html` 的 `window._kakaoJsKey=''`，去 developers.kakao.com 注册拿 JS 键填入即激活分享（代码已 ready，空 key 安全空转）。
- [ ] **Stripe webhook**：确认生产 `STRIPE_WEBHOOK_SECRET` 已配 + 在 Stripe 后台注册 webhook 端点。
- [ ] **真机付费自测**：免费→付费→回流→看完整报告，走一遍 USD + KRW。
- [ ] **发话部署**：`bash deploy.sh all`（前端+后端+git push 一次性）。

---

## 四、部署备忘（别踩坑）
- 生产：HK `47.242.80.65` · PM2 `shenyuan` · port 3021 · `/opt/shenyuan/`
- `deploy.sh` 必须 scp 全部 `server/*.js` + `server/lib/` + `server/routes/` + `server/middleware/`（漏传即 MODULE_NOT_FOUND 崩）
- `server/data.json` = 生产数据，已被 gitignore，**永不提交/覆盖**
- Vercel 那个是过时 demo，架构已统一 HK PM2

---

*整理：2026-08-10 晚 · 本轮零生图零部署，纯 commit+push*
