# 善缘上线前全部门审查报告 (2026-08-03)

审计覆盖：安全、支付、UX、合规、SEO、国际化、基础设施、增长

---

## 各部门评分

| 部门 | 评分 | 核心问题 |
|------|------|----------|
| 安全审计 | 6.5/10 | data.json 被 express.static 直接暴露（任意人可拿全量用户数据）；/api/daily 无付费门可免费刷 AI |
| 支付系统 | 6.5/10 | member_quarterly 与 member_yearly 共用同一个 Stripe Price ID；bazi KRW 价格比需求高 50%；member_daily 走 payment mode 无法续费 |
| UX 审计 | 6.8/10 | bazi.html 无中英切换入口；多处 sticky CTA 文字在深色背景下不可读；gender/name input 触控面积 36px 不达标 |
| 合规审计 | 7.2/10 | legal-CN.html 有 6 处[占位]未填对外可见；英中法律文件运营主体名称不一致；英文产品页隐私政策链接指向中文 legal |
| SEO 技术健康 | 5.5/10 | daily-en.html 缺 canonical 和 schema；sitemap 缺 bazi-en.html 和 hehun-en.html 两个核心英文变现页 |
| 国际化 | 6.8/10 | 韩文版 saju-KR.html 页面显示 KRW 但 checkout 传 USD（定价欺诈风险）；KakaoPayi 按钮 disabled 无替代；时辰 value 错位 |
| 基础设施 | 6.0/10 | deploy.sh 漏同步 server/routes/ 和 server/middleware/，每次部署后端必然崩溃 |
| 增长 | 6.5/10 | RESEND_API_KEY 未配置续费失败邮件全部静默丢弃；首页 EN 入口指向代烧页非主漏斗；无英文会员中心 |

---

## P0 阻断项（上线前必须修，按严重程度排序）

### P0-1【数据泄露·最高优先级】data.json 被 express.static 直接暴露
- 文件：`server/index.js` 第 87-89 行 setHeaders 回调
- 问题：`express.static` 根目录是项目根 `shenyuan/`，`data.json` 在项目根，setHeaders 只设了 `Cache-Control:no-store` 没有拦截，任何人 `curl https://shenyuan.mylumee.cn/data.json` 即拿到所有用户邮箱、密码哈希、订单、命理历史、token
- 修复：在路由注册之前加一行明确的 403 拦截：
  ```js
  app.use('/data.json', (req, res) => res.status(403).json({ error: 'forbidden' }));
  ```

### P0-2【部署即崩溃】deploy.sh 漏同步 server/routes/ 和 server/middleware/
- 文件：`deploy.sh` 第 44 行只用 `scp server/*.js`
- 问题：server/index.js require 了 7 个子目录模块（routes/auth、routes/payment、routes/divination 等），全部不在 `scp server/*.js` 覆盖范围，服务器端旧版或缺失文件，PM2 重启后立即 MODULE_NOT_FOUND 崩溃
- 修复：在 deploy_backend 函数添加：
  ```bash
  ssh $HK_SERVER "mkdir -p $HK_PATH/server/routes $HK_PATH/server/middleware"
  scp server/routes/*.js "$HK_SERVER:$HK_PATH/server/routes/"
  scp server/middleware/*.js "$HK_SERVER:$HK_PATH/server/middleware/"
  ```

### P0-3【韩国定价欺诈风险】saju-KR.html checkout 显示 KRW 但传 USD
- 文件：`pages/saju-KR.html` 第 468 行
- 问题：`var priceMap = { 'bazi_full': 9.9, 'bazi_vip': 19.9, 'member': 6.9 }` 单位是美元，但页面显示 ₩14,900 / ₩24,900 / ₩12,900，用户被收美元却看到韩元价格
- 修复：priceMap 改为 KRW 金额并走 KRW Stripe Price ID，或显示价格同步改为 USD

### P0-4【韩国死按钮】saju-landing-KR.html KakaoPayi 按钮 disabled 无替代支付路径
- 文件：`docs/saju-landing-KR.html` 第 239 行
- 问题：主要结算按钮 `disabled`，韩国用户无法完成付款，只有 Stripe USD checkout，没有本地支付路径且无引导说明
- 修复：改为"준비 중 · 카드로 결제"引导用户走 Stripe，或完全隐藏并显示明确 CTA 指向 Stripe KRW 结算

### P0-5【韩国数据错位】saju-landing-KR.html 时辰 option value 使用起始小时数非 0-11 索引
- 文件：`docs/saju-landing-KR.html` 第 221-232 行
- 问题：option value 是起始小时数（0,1,3,5,7...）而非 0-11 索引，与 saju-KR.html 期待体系不一致，跨页传参时辰错位
- 修复：统一改为 0-11 顺序索引

### P0-6【支付金额错误】bazi_full KRW amountKrw=14,900（需求 9,900），bazi_vip KRW=24,900（需求 19,900）
- 文件：`server/routes/payment.js` PRODUCTS 定义
- 问题：多收用户 5,000 韩元，与 Stripe Dashboard Price ID 实际金额若不一致则前端显示与实收不符
- 修复：将 `bazi_full.amountKrw` 改为 9900，`bazi_vip.amountKrw` 改为 19900，并确认 Stripe Dashboard 对应 Price ID 金额一致

### P0-7【支付逻辑缺陷】member_quarterly 与 member_yearly 共用同一个 Stripe Price ID
- 文件：`server/routes/payment.js` STRIPE_PRICE_IDS
- 问题：季度订阅实际按年收费或创建年度订阅，用户被多收费
- 修复：在 Stripe Dashboard 为 member_quarterly 创建独立 Price ID 并更新代码

### P0-8【会员逻辑缺陷】member_daily 不在 isSubscription 列表，走 payment mode
- 文件：`server/routes/payment.js` 第 isSubscription 判断行
- 问题：付款走一次性 payment 而非 subscription mode，24 小时后无法自动到期触发续费或阻断
- 修复：将 `member_daily` 加入 isSubscription 数组

### P0-9【内容不解锁】zhiyuan_full 和 daily_sub 在 UNLOCK_BY_CATEGORY 无对应映射
- 文件：`server/routes/payment.js` UNLOCK_BY_CATEGORY
- 问题：用户购买 zhiyuan_full 或 daily_sub 后，hasFullAccess 检查返回 false，内容不解锁，钱收了服务没给
- 修复：补充 `'zhiyuan': ['zhiyuan_full']` 和 `'daily': ['daily_sub']` 映射

### P0-10【免费刷 AI】POST /api/daily 无任何付费门控
- 文件：`server/routes/daily.js` 第 36-88 行
- 问题：未付费用户可免费调用 DeepSeek 生成 8192 token 完整每日运势报告，30次/小时无限刷
- 修复：添加 gateMessages 或 hasFullAccess 检查，与其他 AI 端点一致

### P0-11【法律文件草案对外暴露】legal-CN.html 有 6 处[占位]未填
- 文件：`legal-CN.html`
- 问题：生效日期×3、香港商业登记号、个人信息保护负责人姓名、页脚占位，均未填写，页面已有 draft-warn 提示条对外可见，法律文件处于草案状态
- 修复：填写所有[占位]字段并移除 draft-warn 提示条后方可上线

### P0-12【法律主体矛盾】英中法律文件运营主体名称不一致
- 文件：`legal-en.html` vs `legal-CN.html`
- 问题：英文版写"Capstone Development Limited"，中文版写"Capstone IQ Group Limited"，退款/纠纷时出现法律主体混淆
- 修复：确认正确主体名称，统一两份文件

### P0-13【GDPR 违规】英文产品页隐私政策链接指向中文 legal-CN.html
- 文件：`bazi-en.html`、`hehun-en.html` 中的 privacy checkbox 链接
- 问题：英语用户点开看到中文，GDPR/CCPA 要求信息可读性义务未达标
- 修复：链接改为 `href="/legal-en.html#privacy"`

### P0-14【增长断流】RESEND_API_KEY 未配置，续费失败邮件全部静默丢弃
- 文件：`server/.env`（缺失该 key）+ `server/lib/utils.js` 第 44 行
- 问题：所有续费失败邮件 console.log 后跳过发送，用户不知道会员即将断档，订阅续费率归零
- 修复：在 .env 配置 `RESEND_API_KEY`，并在 Resend 后台验证 hi@mylumee.cn 发件域名

---

## P1 改进项（上线后一周内）

### 安全类
- P1-S1：多个 AI 端点（lingqian/daliuren/qimen/pastlife/deity-guide/offering-plan/zhiyuan/astrology/geo-fortune/ask-followup）未进入 RATE_LIMITED_PREFIXES 主列表，防御纵深不足，建议统一收录
- P1-S2：GET /api/context/:id 无鉴权，任意人知道 contextId 可取命盘上下文，建议加 token 绑定校验
- P1-S3：POST /api/ask-followup 可绕过 chat 5次/天配额，建议合并到同一配额池
- P1-S4：webhook 中 subscription retrieve 为 async then chain，失败时 expires_at 不写但订单已 completed，导致会员永不过期

### 支付类
- P1-P1：member.html 支付成功回流参数 `?paid=1` 无任何代码处理，toast 不触发，用户无付费成功反馈
- P1-P2：member_3year 无 Stripe Price ID，走 price_data 动态建，Stripe Dashboard 无法追踪产品维度收入统计
- P1-P3：member.html "8折续费优惠"文案无对应实际折扣 code，是空头支票

### UX 类
- P1-U1：所有 .back-btn 触控面积约 26px（padding:4px 0），三个 EN 页面均存在，修复：加 `min-height:44px`
- P1-U2：bazi-en.html .qa-btn 高度约 38px，Referral banner 三个小按钮约 38px，修复：加 `min-height:44px`
- P1-U3：所有表单缺 `<label for="">` 可访问性关联，建议将 .field-label span 换成正规 label 元素
- P1-U4：daily-en.html .gender-opt 高度约 38px；.sy-disclaimer 对比度不足（rgba(201,168,76,0.4) 约 2:1）
- P1-U5：daily-en.html 缺 `<link rel="canonical">` 标签
- P1-U6：bazi.html common.css 引入位置在自定义 style 后，可能导致 common 样式失效
- P1-U7：hehun-en.html startCalc 用 setTimeout(3000) 模拟加载，非真实 API loading 控制

### 合规类
- P1-C1：hehun-en.html 低分情形"Strongly recommend consulting a specialist"紧跟付费墙，构成负面命理结论促付费，部分英语市场有不公平商业行为风险
- P1-C2：英中法律文件联系邮箱不一致（support@shenyuan.app vs hi@mylumee.cn），统一为一个对外邮箱
- P1-C3：韩文版页面 19+ 同意门、AIGC 标识状态未经本次审计，需补查
- P1-C4：bazi.html 转运钩子用 `当前月份+2` 硬编码生成"X月开始转运"，与页面"仅供参考"免责声明逻辑矛盾

### SEO 类
- P1-E1：bazi-en.html meta description 164 字符超限 160，需截短
- P1-E2：四个页面 og:image 使用相对路径 `/og-card.png`，应改为绝对 URL `https://shenyuan.mylumee.cn/og-card.png`
- P1-E3：sitemap 包含 /pages/login.html 和 /pages/account.html 等低价值页面，应移除；robots.txt 应补充 Disallow /api/
- P1-E4：hehun-en.html 缺 BreadcrumbList schema（bazi-en 有，不一致）
- P1-E5：index.html 第 25 行 `rel="preload"` 与第 26 行直接 link 同一 Google Fonts URL 重复，清理冗余

### 国际化类
- P1-I1：daily-en.html 时辰命名用拼音写法（"Zi 子"），与 bazi-en/hehun-en 的动物名（"Rat Hour"）不一致，统一改为动物名
- P1-I2：saju-KR.html 评论区文字颜色 #e0c874 在 rgba(201,168,76,0.06) 背景上对比度不足 3:1
- P1-I3：saju-KR.html 每日运势链接指向 `/pages/daily.html`（中文页），改为 `/pages/daily-en.html`
- P1-I4：hehun-en.html 行 638 `→gen←` 调试字符串暴露在用户界面，改为"✦ Generating"
- P1-I5：선연 品牌名在 saju-landing-KR.html 内拼法不一致，统一用"선연"

### 基础设施类
- P1-IF1：server/index.js 缺全局 uncaughtException 和 unhandledRejection 处理器，异步抛出异常直接让 Node 进程退出
- P1-IF2：项目缺 ecosystem.config.js，服务器重启后 PM2 进程需手动重建，无日志路径/内存限制配置
- P1-IF3：data.json 无备份/轮转机制，服务器磁盘故障时所有订单/用户数据永久丢失，建议仿 Lumee 接 6h OSS 备份

### 增长类
- P1-G1：首页 EN 按钮和 hreflang 均指向 daishao-en.html（代烧页），英文用户找不到 bazi-en.html 主漏斗入口
- P1-G2：缺失英文会员中心 member-en.html，英文订阅用户无法查看到期时间或续费
- P1-G3：bazi-en.html 零社会证明（无评价、无星级、无用户数），英文付费转化率低
- P1-G4：缺乏主动"X 天后到期"提醒邮件，只有被动 payment_failed，续费提前唤醒缺失
- P1-G5：daishao-en Supreme $2,499 档无社会证明支撑，高客单转化接近零

---

## 上线裁决

**🔴 RED — 禁止上线**

当前存在 14 个 P0 阻断问题，其中：

- **P0-1（data.json 暴露）**：任何人可下载全量用户数据，是直接的数据安全事故，上线即违规
- **P0-2（deploy.sh 崩溃）**：每次部署后端服务必然崩溃，当前部署流程在生产环境不可用
- **P0-3/P0-4/P0-5（韩国问题）**：韩国用户无法付款 + 定价欺诈风险 + 数据错位，韩国线上线即出事
- **P0-11/P0-12/P0-13（法律合规）**：法律文件草案对外暴露 + 主体名称矛盾 + GDPR 违规，监管风险

最低上线条件（必须全部完成才能转为 YELLOW）：
1. P0-1 data.json 403 拦截 — 30 分钟内可修
2. P0-2 deploy.sh 补 routes/middleware scp — 30 分钟内可修
3. P0-10 /api/daily 加付费门 — 1 小时内可修
4. P0-11/P0-12/P0-13 法律文件填占位/统一主体/修链接 — 需 Karen 确认主体名称和生效日期
5. 韩国线暂不上线（P0-3/4/5/6/7）或完整修复后单独灰度

---

## 下一步行动（优先级排序）

| 优先级 | 行动 | 预估耗时 | 负责方 |
|--------|------|----------|--------|
| 1 | 修 P0-1：server/index.js 加 data.json 403 路由 | 30 min | Claude |
| 2 | 修 P0-2：deploy.sh 加 routes/ middleware/ scp 命令 | 30 min | Claude |
| 3 | 修 P0-10：daily.js 加付费门控 | 1 h | Claude |
| 4 | 修 P0-8/P0-9：member_daily 加入 isSubscription；补 UNLOCK_BY_CATEGORY 映射 | 1 h | Claude |
| 5 | 修 P0-13：bazi-en/hehun-en privacy 链接改为 legal-en.html | 30 min | Claude |
| 6 | Karen 确认：运营主体正式名称、生效日期、商业登记号、负责人姓名 | - | Karen |
| 7 | 修 P0-11/P0-12：填写 legal-CN.html 占位、统一两份文件主体名 | 1 h（需 Karen 确认后） | Claude |
| 8 | 修 P0-14：.env 配置 RESEND_API_KEY | 15 min（需 Karen 提供 key） | Karen + Claude |
| 9 | 韩国线修复：P0-3/4/5/6（定价/死按钮/时辰/KRW 价格）| 2-3 h | Claude |
| 10 | 修 P0-6/P0-7：Stripe KRW 价格对齐 + member_quarterly 独立 Price ID | 1 h（需 Stripe Dashboard 操作） | Karen + Claude |
| 11 | sitemap 补 bazi-en.html 和 hehun-en.html（P1-E3）| 15 min | Claude |
| 12 | daily-en.html 补 canonical + hreflang + schema（P1-E/P0-SEO）| 30 min | Claude |
| 13 | P1 UX 批量修复（back-btn/触控/对比度）| 2 h | Claude |
| 14 | 增长 P1：首页 EN 按钮指向 bazi-en.html；建 member-en.html | 2 h | Claude |

---

*报告生成：2026-08-03 · 善缘 CEO 审阅*
