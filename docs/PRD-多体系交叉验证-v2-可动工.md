# PRD: 多体系交叉验证 (Cross-System Verification) · v2.0 可动工版
> 2026-08-18 · 经产品PM初稿 → 变现专家复审6.5/10 → 按4个P0修订至可动工 → 待Karen拍板定价+开工

## 一句话
用户问一个问题 → 八字+紫微+奇门+易经四体系同时作答 → **诚实标共识与分歧**（分歧不藏不硬凑）→ 付费解锁完整分析。护城河=多个独立传统体系交叉印证，单体系竞品做不到。

## 四个关键设计（解决专家致命隐患）
1. **不慢**：LLM 压到 3 次全并行(八字+紫微合1/奇门+易经合1/比对合成1) + SSE 流式进度条 → 25-35秒体感更短。**综合报告改异步**(填完离开→后台worker生成15次LLM→邮件/站内通知)，躲开 Vercel 60s 超时。maxTokens分层(分析≤600/合成≤800)。
2. **不编造**：比对层 prompt **硬编码禁令**("你是诚实比对器不是解释器·3:1就说3:1分歧·禁止用'整体倾向'掩盖·分歧是信息")；overallConsensus **只能枚举**(STRONG_CONSENSUS≥3/4 · PARTIAL 2/4 · SPLIT 2v2 · DIVERGENT)，后端强校验非法值retry。
3. **不误导**：八字紫微(本命盘) vs 奇门易经(问卦时刻) 认识论不同，**两个独立 gauge 绝不合成一个数字**。synthesisAdvice固定模板("从命盘看X·从时机看Y·两者一致/不一致的含义")。
4. **合规**：不暴露模型名 · AI标识放每个verdict旁+合成段上方(非footer) · 娱乐免责表单提交前可见。

## 定价阶梯（待Karen确认·对齐真实Stripe）
| 问事单次 | 问事3次包 | 单报告 | 合婚 | 月会员 | 季会员 | 年会员 |
|---|---|---|---|---|---|---|
| $2.90 | $6.90 | $9.90 | $19.90 | $9.90 | $24.90 | $69 |

权限：免费=看钩子(最强共识体系1句话verdict) · 月会员问事5次/月 · 年会员问事无限+报告1份/月。3次包给非会员、与月会员不冲突可叠加。

## MVP 三期(~4周)
- **P1(2周·可交付)**：cross-check.js改3次LLM并行 + `/api/cross-check/stream` SSE + 前端进度条 + 两独立gauge UI + 比对层硬编码禁令 + synthesisAdvice模板 + 免费钩子 + AI标识 + 分歧亮色标签
- **P2(+1周·付费闭环)**：Stripe单次/3次包/会员 + 权限中间件 + 付费墙(不遮钩子) + 3次包扣减
- **P3(+1周·报告异步)**：`/api/report/queue` + reports表(pending/processing/ready) + 后台worker + 邮件通知 + 报告查看页

## 工程红线
①引擎算LLM不算 ②overallConsensus必须枚举后端校验 ③两gauge禁止合并(组件不接受合并分数prop) ④综合报告必走异步 ⑤不暴露模型名 ⑥娱乐免责不可display:none

## 复用点
`server/routes/cross-check.js`(已有BaZi+ZiWei骨架+交叉比对)扩展：SYSTEMS加qimen(`computeQimen(new Date())`)+iching(`computeLiuyao(Date.now())`)；新增`/ask`(问事)和`/report`(报告)路由；requireEntitlement当前默认ok:false(安全·mount前必接权限闸防烧钱)。

## 二期
Western入问事(需出生地) · 择时日历精确到本月最佳3天 · 合婚×交叉 · Korean사주 · DaLiuRen第5体系 · 流年预警季度推送 · "权贵人脉"章节(需先建体系-维度映射表否则LLM编造)
