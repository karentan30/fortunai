# Runae 后端待办（给后端对话·自成一体·0908）

> 项目：/Users/karen/projects/shenyuan · 生产分支 `deploy-candidate-0907` · Node 后端(端口3021·PM2名 shenyuan) · 前端 pages/ 由另一会话负责，**你只改 `server/` + 共享脚本(sessions.js/common.js)，别碰 pages/*.html**。
> 部署：改完先 `python3 -m py_compile`/node 校验 + curl 实测，push 用 `git -c http.version=HTTP/1.1 push`（本机代理会 HTTP2 报错），服务器 `git reset --hard origin/deploy-candidate-0907 && pm2 restart shenyuan`。提交只 `git add` 自己的 server 文件，绝不 `-A`。

---

## 🔴 P0-1：lang 全端点扫（英文页报告正文出中文的根因）
- 现象：英文方法页 UI 全英文，但 AI 生成的**报告/卡片正文还是中文**。
- 已修：`/api/session`。**还漏**：`/api/daily/card`（在 `server/routes/divination.js` ~916行）等。
- 做：**全端点扫一遍**所有"生成报告/卡片/session"的端点，凡是能收 `lang` 的都加 `lang==='en'` 英文 persona/prompt 分支（照 `server/routes/daily.js:78` 已有的英文分支写）。curl 带 `lang:'en'` 验证返回英文。

## 🔴 P0-2：每日运势卡 `/api/daily/card` 重做（专家审 5.5→9分）
**核心：五行生克/分数/幸运色方位必须在【后端代码】算好再注入 prompt，别让 LLM 自己推（LLM 五行推理极不稳）。**

### (a) 代码里先算好这些，作为结构化输入注入 prompt：
```
日主五行 rz_element、身强/弱 strength、最缺五行 lacking（已有 calcBazi 能出）
今日流日 day_gz、其五行 day_element（已有 _dailyDayPillar）
relation = 今日流日五行 对 日主/所缺五行 的关系：生/克/助/泄/耗（代码算，直接给 LLM）
```
### (b) score 按 relation 公式（代码算或强约束）：
```
基础分：生=75 助=70 泄=60 耗=50 克=45；±10 浮动
```
### (c) luckyColor / luckyDir 用五行硬规则（代码直接生成，不经 LLM）：
```
木→绿/青·东  火→红/橙·南  土→黄/棕·中  金→白/银·西  水→黑/深蓝·北
（取"今日需补五行"对应色/方位）
```
### (d) 补 `时辰` 空字段：加 `luckyHour` 或让前端隐藏该栏。
### (e) prompt v2 文案（system + 字段规则，替换现有）：
```
你是 Runae 每日运势顾问。融合 The Pattern(命理数据全翻成大白话心理语言)、
Co-Star(像朋友直白点你)、Chani(给具体能做的事、照顾真实处境)。

【已给你算好的锚点】日主/五行/身强弱/最缺五行、今日流日及其五行、relation(生克助泄耗)。
你必须用 relation 驱动 score/宜/忌/insight：
 relation=生/助→偏进取；克/耗→偏保守修整；泄→偏输出表达。
绝不脱离这些锚点写通用鸡汤；不同 relation 的人同一天，宜/忌/insight 必须明显不同。

【零黑话铁律】命盘/五行/干支/十神(日主/酉金/庚食神/身强弱等)只用于内部推理，
绝不能出现在任何用户可见输出。全部大白话+具体建议。

【诚实】自我觉察+娱乐，不做命定断言/不吓唬/不承诺结果。只输出严格 JSON。

字段规则：
- insight：像朋友当面说的一句话，≤45字，含[今天能量状态]+[对这个人具体的一个行动]。
  换一个不同 relation 的人还成立=太泛，重写。
  ✅"今天推力够，那个你一直没启动的计划，动一步比等下去强。"
  ❌"能量聚焦，适时而动，把握当下。"（废话，禁）
- yi(3条)/ji(2条)：具体场景化行动("开会提方案"非"推进工作")；第1条 yi 必须扣今日 relation。
- qian.text：大白话一两句，禁文言黑话。
- 输出前自检：insight/yi[0] 换个 relation 还成立吗？score 在 relation 区间吗？不合格重写。
```
### (f) 加分项：注入"过去3天 insight 历史，禁止语义重复"（防同一人7天雷同）。

## 🟡 P1
- **报告按付费档分层字数**：后端按 tier 控制生成长度（低档短/高档长）。
- **续费**（到期提醒/挽留）+ **裂变结算**：复用中台 hub。
- **每月给订阅用户生成+推送 PDF 报告**（留存钩子）。

## 🟢 P2 / 确认
- **DeepSeek**：Karen 会充值——充值后确认 failover 正常（或保留强制 deepseek）。
- **Google 登录**：后端已接 `/api/auth/google`(`a6eb5f6`)，等前端加按钮后联调一次真登录。
