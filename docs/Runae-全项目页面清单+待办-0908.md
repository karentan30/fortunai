# Runae 全项目页面清单 + 待办蓝图（0908）

> 结论先说：**不是"之前做的都不行"。** 所有页面的**功能（排盘/报告/支付/裂变引擎）是真的、能用的、值钱的**——那是最难的部分。要升级的只是**视觉设计**（让次要页也到独角兽级别），而且**不是185个都要做**，很多是冗余/低流量，该删的删。

## 一、总量
- **185 个 html**，其中用户面向 **178**（admin/harness/demo 7 个不算）。

## 二、按状态分层

### ✅ 已独角兽（16）
6方法中英 + 首页(CN) + 合婚 + 报告页(中英+viz)：
`bazi/ziwei/tarot/astrology/mianxiang/daily`(+`-en`)、`hehun`、`index.html`、`report-cn/en`、`report-viz`

### 🔵 Tier-1 收费/账户/英文首页（**正在做·6 agent 跑**）
`account` · `member`/`member-en` · `pricing` · `invite`(裂变) · `home-en`/`en`(runae.app英文首页)

### 🟡 Tier-2 其它占卜方法页（~24·要独角兽化）
大六壬`daliuren`(+en) · 易经`iching-en` · 风水`fengshui`/`fengshui-intro`/`fengshui-runae` · 求签`fortune-sticks` · 断事`duanshi` · 测评`ceping` · 合盘`hepan` · 面相/手相`face-reading`/`palm-reading` · 代烧`daishao`(+en)/`daoshao` · 供奉`gongfeng` · 神仙指南`deity-guide` · 墓地`cemetery-guide` · 起名`chinese-name`/`english-name` · 择时`best-timing` · 每日签`daily-sign` · 交叉验证`cross-check` · 原型`chart-archetype` · 地理`geo-fortune`

### 🟡 Tier-3 内容/社交/SEO 页（~15）
`about`(+en) · `bio-cn/en` · `chat`/`chat-EN`/`chat-magic` · `explore` · `friends` · `fund` · `history` · `contact` · `refund`(+en)

### 🔴 韩文页（15·先放/后批量）
`saju-KR` · `home-kr` · `hehun-KR` · `bio-kr` · `chat-KR` · `explore-kr` · `best-timing-kr` · `legal-kr` · `lp-*-kr` 等

### ⚪ 疑似冗余/可删（先审再删·别都redesign）
多个首页变体：`home-runae` · `home-wow-preview` · 多个 `lp-*` 落地页变体 · KR 里多个 `lp-saju-kr-a`/`lp-kr-saju`/`lp-master-KR` 重复。**这些先判断是否还在用，能删就删，不浪费设计。**

## 三、整个项目还需做什么（不只页面）

### A. 页面独角兽化（按上面分层做，先Tier-1→2→3，KR和冗余最后）
### B. 功能待办
- **Google 登录按钮**（前端·账户页+付费解锁处·client_id在中台）
- **后端 lang 全端点扫**：英文页报告正文出英文（`/api/session` 已修，`/api/daily/card` 等还漏·要全扫）
- **每日运势 prompt v2**：专家审 5.5分→需**后端算好五行生克关系(relation)/score/幸运色方位再注入**，加 few-shot + 自检（不能让 LLM 自己推五行）
- **续费推送 + 裂变**（复用中台）
- **每月给用户推 PDF 报告**（留存）
### B2. 出报告后的裂变 share 系统 🔑（转化+增长钩子）
- 用户拿到报告后 → 引导「分享你的解读 / 邀请好友，双方各得X」的裂变流。
- **前端**：报告页底部/解锁后 弹一个好看的 share 模块（生成分享卡/链接·带 ref 码·独角兽设计）。
- **后端**：ref 归因 + 双向奖励发放 + 防刷（复用中台 hub 裂变；已有 `sy_ref`/`invite.html` 基础）。
- 现状：report/method 页有零散 shareBar/referralBanner，但**没有"出报告即触发的完整裂变闭环"**——要设计成一条流。

### C. 内容待办
- daily 内容**说人话零黑话**（prompt v2）
- 付款后报告**按付费档分层字数**
- 小红书选题：性格/合婚/命运
### D. 清理
- prune 冗余/死页（先扫哪些真在用）

## 四、建议顺序
1. Tier-1（收费/账户/英文首页）— **今天在做**
2. Google登录 + 后端lang全端点 + daily prompt v2（功能，影响体验/收入）
3. Tier-2 占卜方法页独角兽化
4. 冗余页清理 → Tier-3 → KR
