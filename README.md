# 善缘 ShenYuan — 东方灵性平台

> 全球华人 + 韩国的 AI 八字命理/灵性平台。AI 深度报告 + 付费墙 + Stripe 收款 + 韩国出海(Phase-0)。
> 仓库: [karentan30/fortunai](https://github.com/karentan30/fortunai)

---

## 快速启动（本地开发）

```bash
cd server
npm install
# 复制环境变量模板，填真实 key（见「环境变量」）
cp .env.example .env
npm start        # http://localhost:3021
```

前端是纯静态 HTML（无构建步骤），浏览器直接打开 `index.html` 即可；页面用相对路径 `/api/*` 访问后端，所以**本地要全流程测，需在浏览器同源访问**（如 `http://localhost:3021/`）。

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | 纯静态 HTML/CSS/JS（mobile-first，max-width 390-480px），无框架无构建 |
| 后端 | Node.js + Express（`server/index.js`）|
| AI | DeepSeek API（`deepseek-chat` 系列）|
| 数据 | SQLite + **JSON 快照落盘**（`server/data.json`，扛 PM2 重启不丢单）|
| 支付 | Stripe（国际/韩国 KRW）+ 微信/支付宝（中国，`pay.js`）|
| 部署 | HK 服务器 47.242.80.65 · Caddy 反代 · PM2 |

---

## 目录结构

```
shenyuan/
├── index.html             # 中文首页
├── pages/                 # 全部功能页（65个）
│   ├── bazi.html          # 八字命理（主力付费品）
│   ├── hehun.html         # 合婚配对
│   ├── chat.html          # AI 命理聊天
│   ├── daily.html         # 每日天机
│   ├── saju-KR.html       # ★韩国 Phase-0 结果页（韩语）
│   ├── saju-landing-KR.html  # 韩国落地页
│   ├── saju-legal-KR.html # 韩国法律页
│   └── ...                # 其余 60 页
├── legal-CN.html          # 中文法律页（条款/隐私/退款）
├── server/
│   ├── index.js           # Express 入口 + 全部 API（拆分中）
│   ├── pay.js             # 微信/支付宝支付
│   ├── bazi.js            # 八字排盘引擎
│   ├── astrology.js       # 占星引擎
│   └── data.json          # 运行时数据（订单/用户/引用）⚠️生产数据，勿提交
├── docs/                  # PRD / 竞品调研 / 交接 / 韩国资料
├── assets/
│   ├── images/            # 图片资产（水晶/塔罗/冥器等）
│   ├── css/common.css     # 共享样式基座（返回键/toast/免责/sticky-CTA/触摸目标）
│   └── js/common.js       # 共享 JS（toast/主题切换/支付回流/api封装 `window.SY`）
├── api/index.js           # Vercel 兼容入口（架构已统一 HK PM2，仅托管前端用）
└── deploy.sh              # 部署脚本（见「部署」）
```

---

## 核心业务逻辑

### 变现闭环（关键，别弄坏）
1. **免费引流**：首页 → 八字输入生辰 → 后端 `/api/bazi` 返回「基础版」报告（免费预览，约4000字）
2. **付费墙**：`server/index.js` 的 `hasFullAccess(req, ['bazi','八字'])` 检查用户是否买过该产品。
   - 未付费 → `tier:'basic'` + `locked:true`，前端挂付费墙（Stripe 下单）
   - 已付费 → `tier:'full'`，返回完整 12+ 维度万字报告
3. **付费回流**：Stripe 支付成功 → `?paid=1` 回页 → 前端从 localStorage 或后端 `/api/bazi/recent-input` 读回入参 → 带 token 重拉完整报告

### AI 聊天（chat.html）
- 免费 5 条/天（后端按 IP/token 计数，`_M.chatUsage`），会员无限
- 未给生辰前，命理师必须先温和询问（防瞎编）

### 韩国 Phase-0（saju-KR.html）
- `/api/bazi` 带 `lang:'ko'` → 走 `baziKoreanHandler`（韩语温柔陪伴 prompt）
- 定价 KRW 9,900/19,900，`region:'kr'` 触发 Stripe 韩元 + KakaoPay/NaverPay
- ⚠️ 支付目前需要香港 Stripe 账户启用 KakaoPay（Karen 待办）

---

## 环境变量（server/.env）

生产 `.env` 在服务器 `/opt/shenyuan/server/.env`，**切勿提交到 git**。

| 变量 | 说明 |
|---|---|
| `PORT` | 服务端口（生产 3021）|
| `DS_KEY` / `DEEPSEEK_API_KEY` | DeepSeek API key（同值）|
| `STRIPE_PAY_SECRET_KEY` | Stripe 收款 key（当前是 Karen 美国个人号）|
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook 验签 secret（生产必配，否则 webhook 拒收）|
| `ADMIN_TOKEN` | 管理接口鉴权（`/api/orders` 等）|
| `SHENYUAN_BASE_URL` | 中国支付回调域名 |
| `WECHAT_APP_ID/MCH_ID/API_KEY` | 微信支付（未启用）|
| `ALIPAY_APP_ID/PRIVATE_KEY/...` | 支付宝（未启用）|

---

## 部署（HK 服务器 47.242.80.65）

```bash
bash deploy.sh frontend   # 只推前端 HTML
bash deploy.sh backend    # 只推 server/*.js + 重启 PM2
bash deploy.sh all        # 全量 + git push
```

- 生产目录：`/opt/shenyuan/`
- 进程：PM2 `shenyuan`（fork，port 3021）
- 域名：`https://shenyuan.mylumee.cn`（Caddy 反代 3021）· 备用 `https://www.mylumee.app/shenyuan/`
- 健康检查：`curl http://47.242.80.65:3021/api/health`

> ⚠️ 部署教训：deploy.sh 必须 scp `server/*.js` 全部文件（漏 pay.js 会 MODULE_NOT_FOUND 崩）。
> PM2 重启用 `pm2 restart shenyuan`，改 env 需 `--update-env`（且 dotenv 已加 `override:true` 根治）。

---

## 已知问题 / 待真人修复

### 🔴 P0（上线前必须）
1. **legal-CN.html 占位符**：公司地址/香港商业登记号/法定代表人/生效日期是 `[占位]`，需真实法务信息
2. **Karen 真机付费闭环**：未真正机走一遍（免费→付费→回流→看完整报告）
3. **韩国支付密钥**：KakaoPay/NaverPay/Toss 需韩国/香港商户资质（Karen 待办）

### 🟡 P1（尽快）
4. **首屏加载性能**：部分页面 Google Fonts + 大量动画，海外网络首屏慢
5. **付费回流 localStorage 依赖**：虽加了后端 `/api/bazi/recent-input` 兜底，但 hehun 页面仍只依赖 localStorage

### ✅ 已修复（0731 上线前审计·三线并行：安全/功能/合规）
- 🔴 **数据泄露**：`/server/data.json` 曾被 `express.static` 暴露可匿名下载 → 已 deny `/server /docs /node_modules` + dotfiles deny
- 🔴 **付费墙穿越**：¥1.99 `bazi_trial` 曾命中 `indexOf('bazi')` 解锁全套 → 已改精确白名单 `UNLOCK_BY_CATEGORY`
- 🔴 **根域名404**：static `index:false` 曾致 `GET /` 404 → 已加 `app.get('/')`
- 🔴 **伪造社会证明**：KR落地页假用户数/假在线/假倒计时 + 中文站"已服务12,000+" → 全删
- 🟠 **限流失效**：缺 `trust proxy` → 已设；`/api/mianxiang` `/api/daily` 无限流 → 已加
- 🟠 **会员按钮失效**：`bazi_member` 产品不存在 → 改 `member_monthly`
- 🟠 **反馈/聊天计数不持久**：重启即丢 → `_M` 加 `feedbacks` `chatUsage` 快照回读
- 🟢 **合规**：出生日期单独同意勾选(CN/KR) + 成年门(18+/19+) + chat AIGC标识 + token 不再走 query

### 🟢 其他
7. `server/index.js` 2300+ 行单体，已抽 `lib/llm.js`（DeepSeek封装+prompt构建），**路由级拆分**（routes/ 目录）是后续迭代——依赖图分析已产出方案
8. 65 个页面结构不统一：已建 `assets/css/common.css` + `assets/js/common.js` 作统一基座，**逐页迁移**是真人开发者的常规任务

---

## 战略背景（别跑偏）

- **收入模型**：算命（报告+订阅）= 稳定基本盘（90%毛利）；代烧祭祀 = 季节放大器，**不是主力**
- **差异化**：AI 万字深报告（全球无人主打）+ 真人连麦（复用 Lumee Agora）+ 韩国 신년운세 2027 年 12 月前上线吃流量峰
- **两条红线**：① 合规诚实（不制造焦虑，测测已爆雷前车之鉴）② 麦玲玲 IP 不具名（除非拿授权）
- **竞品**：Fatetell（港，最像）、测测、高人汇、Co-Star（已被 Midjourney 收购）

详见 `docs/` 下的 PRD、竞品调研、韩国市场调查。

---

## 相关文档索引

| 文档 | 内容 |
|---|---|
| `docs/上线前审查报告-0730.md` | 三线安全审计结论 |
| `docs/PRD-韩国MVP-0730.md` | 韩国 MVP 功能清单 |
| `docs/韩国市场调查-0730.md` | 韩国市场 + 竞品 |
| `docs/Lumee移植清单-0730.md` | 可复用的 Lumee 资产 |
| `DEPLOY.md` | 部署指南（旧）|
| `docs/handoff-2026-07-23.md` | 早期交接（已过期，参考）|

---

*整理时间: 2026-07-31 · 目标读者: 接手的真人开发者*
