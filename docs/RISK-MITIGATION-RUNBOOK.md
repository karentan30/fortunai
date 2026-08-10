# Phase 1 风险管理 & 应急预案

**项目**：三语报告页对齐  
**用途**：风险识别 + 缓解措施 + 应急响应流程  
**更新**：2026-08-10

---

## 🚨 风险矩阵（按严重度排序）

| 风险 | 概率 | 影响 | 严重度 | 业主 | 缓解措施 |
|-----|------|------|--------|------|----------|
| **Prompt 质量不达标（英文）** | 🟡 中 | 🔴 高 | **🔴🔴 10** | Content | W2 独立母语评审 + 10 样本验证 |
| **三语 UI 变形（移动端）** | 🟡 中 | 🟡 中 | **🟡🟡 6** | Frontend | W3 真机 3 屏冒烟测试 |
| **支付集成失败（韩国）** | 🟢 低 | 🔴 高 | **🟡🔴 7** | Backend | Phase 1 只用 Stripe，KakaoPay 1.5 迭代 |
| **数据库迁移失败** | 🟢 低 | 🔴 高 | **🟡🔴 7** | DevOps | 完整备份 + 回滚脚本 + 预演 |
| **DeepSeek API 限流/降级** | 🟢 低 | 🟡 中 | **🟡🟡 5** | Backend | 配额监控 + 缓存降级方案 |
| **法合规缺陷（医疗/宿命）** | 🟢 低 | 🔴 高 | **🟡🔴 7** | Legal | 法务审阅 + 自动化 grep 扫描 |
| **部署时打包错误（漏 file）** | 🟢 低 | 🟡 中 | **🟡🟡 5** | DevOps | deploy.sh 校验清单 + 部署前测试 |
| **用户投诉报告无用** | 🟡 中 | 🟡 中 | **🟡🟡 6** | Support | Beta 测试 50 人 + NPS ≥7 门禁 |

---

## 🎯 风险 #1：Prompt 质量不达标（英文）

### 问题描述
英文 Prompt 如果质量低（机翻、无文化对标、超 5000 词但无洞察），报告无法获得用户信任 → 转化率 0

### 预防措施（W2）

**Prompt 编写**
- [ ] 由 Content Lead 基于 PRD 10.2 的框架编写初稿
- [ ] 初稿 ≥ 4000 词，含 3 个样本八字的完整报告

**独立评审 (关键)**
- [ ] 招募英语母语 agent（非中国人，最好有占星背景）
- [ ] 评审维度：
  ```
  1. 语言自然度：是否像真人写？（非 AI 生成感）
  2. 文化准确性：西方占星对标是否恰当？
  3. 诚实度：是否避免"fate/destiny/must"等宿命词？
  4. 可读性：4000+ 词是否有冗余？
  5. 综合打分：≥8/10 才放行
  ```

**质量验证**
- [ ] 拿 10 个不同八字再次生成英文报告，逐一阅读
- [ ] 检查 GPT Detector（避免被识别为 AI）
- [ ] 检查 plagiarism（避免无意复制他人内容）

### 如果风险触发

**W2 发现 Prompt 质量 <8/10**

```
时间线：
Day 1: 意识到质量不够
  → 立刻通知 Karen + Content Lead
  → 触发应急改稿流程
  
Day 2-3: 重写 Prompt（降低期望或融合多个 Prompt 版本）
  → 重新生成 10 个样本
  → 独立评审方 Re-check
  
Day 4: 决策
  A. 质量现在 ≥8 → 继续 W2 开发（加班弥补时间）
  B. 质量还是 <8 → 降级为 Phase 1.5（英文先用机翻版本，后续打磨）
  C. 实在无法达标 → 挪到 Phase 2（不上线英文版本）
  
推荐：A 方案（加班 3-5 天补）
```

**回滚方案**
```
如果英文报告已上线（W7 后）但反馈很差：
→ 后端快速改 Prompt 文件 (server/prompts/bazi-en.txt)
→ PM2 reload（不需重新部署）
→ 实时生效（没有 deploy 滞后）
```

---

## 🎯 风险 #2：三语 UI 变形（移动端）

### 问题描述
某屏幕尺寸（如 iPad 横屏）字体/布局崩溃 → 用户无法正常使用 → 支付流程中断

### 预防措施（W3 QA 阶段）

**真机测试清单**
```
必测设备：
✅ iPhone 12/13/14 (390px, iOS)
✅ Samsung S21/S22 (375px, Android)
✅ iPad Pro (1024px, 横屏)
✅ Pixel Tablet (600px)

必测场景：
✅ 竖屏 320px（旧手机）
✅ 竖屏 390px（iPhone 主流）
✅ 竖屏 480px（大屏）
✅ 横屏 768px（iPad）
✅ 虚拟键盘弹出（iOS/Android）
✅ Notch/Punch hole（iPhone/新 Android）
```

**自动化 + 手测组合**
```
自动化：用 Puppeteer/Playwright 生成 screenshot，对比 golden image
手测：开发者 + QA 真机滑动，检查：
  • 文字有无截断
  • 按钮有无遮挡
  • 图片有无变形
  • 颜色在各屏幕准确度
```

**性能测试（顺便）**
```
检查项：
• 字体加载是否导致 CLS（Cumulative Layout Shift）
• 图片是否导致 LCP 延迟
• 列表滚动帧率 ≥60fps
```

### 如果风险触发

**W3 发现某设备崩溃**

```
严重度分类：
🔴 Critical（立刻改）：按钮完全不可点、文字看不见、无法付费
🟡 Major（今天改）：某屏幕字体缩小/拉大、图标稍微错位
🟢 Minor（可延期）：间距差 1px、某语言字体选择不最优

流程：
1. 截图 + 记录设备型号/系统版本
2. 开发者定位 CSS 问题
3. 改 report-unified.css 或 language.css
4. 重新真机验证
5. 打勾 QA checklist
```

**时间 buffer**
```
W3 是 1 周 QA 时间，但前 2 天已有 30% 信心测试完
如果 W3 中间发现崩溃，剩下 5 天足够修
最晚 W3 周五下班前必须全绿
```

---

## 🎯 风险 #3：支付集成失败（韩国）

### 问题描述
KakaoPay/NaverPay 密钥无法获得 OR 集成失败 → 韩国用户只能用 Stripe 美元支付 → 转化率大幅下降

### 预防措施（W2）

**Phase 1 策略：只用 Stripe（零依赖）**
```
✅ Stripe 美国个人号可以收美元
✅ 韩国用户可以用国际卡（Visa/MasterCard）支付美元
✅ 不依赖 KakaoPay/NaverPay/Toss 的任何密钥

风险度：🟢 低（100% 不依赖第三方审批）

KakaoPay 等支付方式 → **推迟到 Phase 1.5**（不是 P0）
```

**如果一定要 Phase 1 包含韩国支付**
```
方案 A（推荐）：用第三方 PG（支付网关）
  例：Inicis、KCP、Toss Payments
  优点：无需商户资质，直接调用 API
  缺点：需 2-3 周集成 + 按笔抽 2-3%
  
方案 B（不推荐）：自己申请 KakaoPay 商户
  优点：费用低（按笔 2-3%，但没有额外 PG 费）
  缺点：需要韩国法人 + 银行账户 + 审批 1-2 周
  
推荐：**Phase 1 用 Stripe，Phase 1.5 评估方案 A/B**
```

### 如果风险触发

**W2-3 发现 KakaoPay 无法 Phase 1 上线**

```
即时决策（不能拖）：
A. 坚持 Stripe Only → W7 按期上线（韩国用户用美元）
B. 延期 1 周接入 PG → W8 上线（成本 +2-3% 手续费）
C. 取消韩文版本 Phase 1 → 仅上线 CN + EN，KR 后续

推荐：A（Stripe Only）
理由：
  • 时间优先（春节峰不能错）
  • 韩国用户用国际卡付美元不稀奇（海外华人习惯）
  • 毛利短期 <2%（长期可升 KakaoPay 改善）
```

**回滚方案**
```
如果上线后才发现 KakaoPay 必须有：
→ 火速升级 Phase 1.5（1-2 周）
→ 前端加"选择支付方式"按钮
→ 后端路由到新支付方式
→ 无需重新部署整个 app（只改支付层）
```

---

## 🎯 风险 #4：数据库迁移失败

### 问题描述
`ALTER TABLE bazi_reports ADD COLUMN lang` 失败 OR 回滚时丢数据

### 预防措施（W2 迁移前）

**完整备份**
```bash
# AWS S3 完整备份
pg_dump -Fc shenyuan_prod > /tmp/shenyuan_backup_20260810.sql
aws s3 cp /tmp/shenyuan_backup_20260810.sql s3://shenyuan-backups/

# Supabase 内置备份也会自动做
```

**预演（staging 先跑）**
```bash
# 1. 在 staging 数据库跑迁移
supabase migration deploy --staging

# 2. 验证新表结构
SELECT * FROM information_schema.columns WHERE table_name = 'bazi_reports';

# 3. 验证旧数据还在
SELECT COUNT(*) FROM bazi_reports WHERE lang IS NULL;
# 应该 = 现有记录数

# 4. 模拟一些查询
SELECT * FROM bazi_reports LIMIT 1;
# 应该能拉出数据
```

**回滚脚本（事先写好）**
```sql
-- rollback-migration-20260810.sql
-- 如果迁移失败，运行这个
ALTER TABLE bazi_reports DROP COLUMN lang;
DROP INDEX IF EXISTS idx_bazi_lang;
DROP TABLE IF EXISTS api_rate_limits;
```

### 如果风险触发

**迁移失败（数据库不可用）**

```
时间线：
T+0 分钟：Sentry 告警（所有 API 返回 5xx）
  → 立刻 ROLL BACK（运行 rollback-migration.sql）
  → PM2 自动重启（应该恢复）
  
T+5 分钟：验证服务恢复
  curl http://localhost:3021/health
  # 应该返回 200 OK
  
T+10 分钟：根因分析
  • 迁移脚本有 bug？
  • Supabase quota 不够？
  • 权限问题？
  
T+30 分钟：修 bug，重新运行迁移（或推迟到 W3 再试）
```

**操作规范（避免回滚悲剧）**
```
✅ DO：
  1. 总是在 staging 先迁移
  2. 迁移成功后等 24h 观察，再对 prod 迁
  3. 迁移前通知 Karen（防止用户高峰期）
  4. 迁移时有 on-call 工程师待命
  
❌ DON'T：
  1. 直接对 prod 跑迁移（未在 staging 预演）
  2. 迁移后立刻上线新代码（给 24h buffer）
  3. 迁移时还有用户在高峰操作（选低谷时段）
```

---

## 🎯 风险 #5：DeepSeek API 限流

### 问题描述
月度配额超限 OR 被临时限流 → 报告生成超时 → 用户体验崩溃

### 预防措施

**额度监控**
```
配额设定：日上限 5000 请求
  = 月上限 150k 请求
  = 每个请求平均 0.3 美元
  = 月成本 ~$45-50（可控）
  
监控点：
  ✅ 每日 10 点 POST slack：今日已用额度
  ✅ Sentry tag: `deepseek_requests`
  ✅ 告警阈值：日用量 >3000 req 时告警
```

**流量预测**
```
按 7 月实际数据：
  • 中文报告：日 100 份
  • 英文报告（新）：日 30 份（冷启动）
  • 韩文报告（新）：日 30 份（冷启动）
  合计：日 160 份
  
假设每份报告调用 1.5 次（init + regenerate：
  日总 requests = 160 × 1.5 = 240 req
  月总 = 240 × 30 = 7200 req
  
结论：月 7.2k 请求，远低于 150k 限额（占比 4.8%）
安全度：🟢 低风险
```

### 如果风险触发

**接近限额或被限流**

```
实时防控：
1. Sentry 告警 → DevOps 看到
2. 启用缓存降级
   • 查 Redis 看有无 cached report
   • 如果有，直接返回缓存（可能不是最新，但比 timeout 好）
   • 在返回体中注 "cached_at: 3 days ago"
3. 降低 prompt 质量（短 Prompt，节省 token）
   • basic 版本改为 1500 词而非 3500 词
4. 队列机制
   • 新请求加入队列，而非立刻调用 API
   • 队列处理优先级（付费用户优先）
5. 通知用户
   • "系统负载高，报告生成中，稍候..."
   • 而非直接 timeout 错误

时间表：
T+0 min：感知限流
T+5 min：启用缓存 + 队列
T+30 min：缓解压力，逐步恢复
T+2 hr：分析根因（真的超限了？还是临时高峰？）

决策：
  • 如果确实超限 → 申请增额度（DeepSeek）
  • 如果是高峰 → 加队列处理即可
```

---

## 🎯 风险 #6：法合规缺陷（医疗/宿命索赔）

### 问题描述
报告中出现"你会得心脏病"（医学索赔）或"你命中注定 XXX"（宿命论）→ 法务风险 → 监管处罚/用户投诉

### 预防措施（法务审阅）

**Prompt 禁用词清单**
```
❌ 医疗禁词：
  "易患" / "会得" / "风险" / "症状" / "疾病" / "健康问题"
  
✅ 替代词：
  "健康倾向" / "需关注" / "能量弱" / "需调理"
  
例子：
❌ "你命盘显示易患高血压"
✅ "你的健康倾向可能需要重视心血管养护"

---

❌ 宿命论禁词：
  "一定" / "必然" / "命中注定" / "不可改变" / "无法避免"
  
✅ 替代词：
  "可能" / "趋势" / "引导" / "有助于" / "参考"
  
例子：
❌ "你命中注定会成功"
✅ "你的八字暗示在创业领域有天赋，可以朝这方向发展"
```

**自动化扫描**
```bash
#!/bin/bash
# scan_compliance.sh

forbidden_medical=("易患" "会得" "风险" "症状" "疾病")
forbidden_fate=("一定会" "命中注定" "不可改变" "必然")

for word in "${forbidden_medical[@]}" "${forbidden_fate[@]}"; do
  count=$(grep -o "$word" reports/*.txt | wc -l)
  if [ $count -gt 0 ]; then
    echo "❌ Found '$word' in $count reports"
  fi
done

# 在 CI/CD 里跑这个脚本，发现禁词自动 fail
```

**法务审阅流程（W4）**

```
QA 全绿后 → 选 5 份中英韩报告样本 → 送法务
法务逐句检查：
  ✓ 医疗条款合法性
  ✓ 隐私政策覆盖 AI
  ✓ 免责声明足够明确
  ✓ 无虚假承诺
  
如果有问题 → 改 Prompt / Disclaimer → 重新送审
直到法务签字 OK
```

### 如果风险触发

**W4 法务发现医疗/宿命词**

```
时间：需在 W5 上线前修完
方法：
1. 改 Prompt（根禁词表）
2. 重新生成 5 份报告
3. 法务复审
4. 如果还有遗漏 → 加强自动化扫描

费用：法务咨询费（已在预算内）
```

**已上线后发现风险**
```
• 中文主站（已上线）：立刻改 Prompt → PM2 reload（无需重新部署）
• 英文版（新上线）：同上
• 韩文版（即将上线）：上线前必修完

应急方案：
  如果改太急导致 Prompt 质量下降
  → 通知用户"报告生成中"（显示缓存版本 or 降级版本）
  → 给 12 小时改进时间
  → 重新上线
```

---

## 🚨 总应急流程（任何风险触发时）

### 第 1 步：告警 & 初判（T+0 - T+5 min）

```
工程师看到 Sentry/Grafana 告警：
  → 点开 alert 看详情
  → 初判是什么风险（参考上面 6 种）
  → @ 相关业主在 Slack（CTO/DevOps/Content Lead）
  
示例 Slack message：
"🚨 URGENT: bazi API timeout spike detected (p99: 12s, normal: 3s)
Risk: DeepSeek API rate limit or backend overload
Severity: Critical (payments affected)
Owner: @Backend-Lead
Action: Check error logs + DeepSeek quota"
```

### 第 2 步：隔离 & 止血（T+5 - T+30 min）

```
根据风险类型：

如果是代码 bug：
  • 立刻 git revert 最新 commit
  • 验证服务恢复
  • 不要尝试快速补丁（往往更糟）

如果是外部 API（DeepSeek/Stripe）：
  • 启用缓存降级
  • 降低功能级别（basic 而非 full）
  • 队列处理（而非立刻调用）

如果是数据库：
  • 运行回滚脚本
  • 等待恢复（验证健康检查通过）
  • 禁止继续迁移

如果是UI变形：
  • 无法立刻修（需要代码改 + 测试）
  • 通知用户（桌面版可用，移动版已知问题）
```

### 第 3 步：沟通 & 决策（T+30 min）

```
内部同步会议（15 min）：
  参加：CTO + DevOps + 相关业主
  议题：
    1. 根因确认？
    2. 影响用户数？
    3. 快速修复 vs 等待下个 release？
    4. 预计恢复时间？

决策：
  A. <1 小时能修 → 修完再告诉 Karen
  B. 1-4 小时能修 → 立刻通知 Karen（可能需要沟通用户）
  C. >4 小时或无法修 → 立刻决策是否 rollback
  
发 Karen 消息模板：
"[incident] Phase 1 报告页出现 [问题]
  • 影响：[X 个用户无法生成报告]
  • 根因：[原因]
  • 修复 ETA：[时间]
  • 用户沟通：[方案]
  请批准 [决策]"
```

### 第 4 步：恢复 & 验证（T+30 min - T+2 hr）

```
修复完成后：
1. 本地验证（开发者自测）
2. Staging 验证（QA 测试）
3. Canary 验证（1% 流量）
4. 生产验证（监控 5 min）
5. 通知 Karen（恢复完成）

监控指标：
  ✅ Sentry 错误率 <1%
  ✅ 报告生成 p99 <5s
  ✅ 支付成功率 >95%
  ✅ 用户反馈无新投诉

如果验证失败 → 回到第 2 步（重新止血）
```

### 第 5 步：复盘（事后 24hr）

```
发起团队复盘会：
  1. 时间线重述（谁看到、谁处理、花多长时间）
  2. 根本原因分析（为什么会发生）
  3. 改进方案（防止再发生）
  4. 更新应急 runbook（下次更快）

记录在 Slack channel：#incidents
```

---

## 📋 应急联系方式

**随时可用**（任何时间告警）

| 角色 | 联系方式 | 响应时间 | 可做决策 |
|-----|---------|--------|----------|
| **CTO** | Slack @CTO | <5 min | ✅ 技术决策/回滚 |
| **DevOps** | Slack @DevOps | <5 min | ✅ 部署/监控/回滚 |
| **Karen** | WeChat / Slack @Karen | <30 min | ✅ 商业决策/沟通用户 |
| **Content Lead** | Slack @Content | <30 min | ✅ Prompt 调整 |
| **法务** | Email / 工作日 | <24 hr | ✅ 合规审查 |

**Escalation 路径**
```
工程师发现问题
  ↓
立刻 @ CTO/DevOps（Slack channel #incidents）
  ↓ (如果 CTO 5 min 内没回复)
立刻 @ Karen（紧急 WeChat）
  ↓
Karen 决定是否 rollback 或沟通用户
```

---

## 📊 风险追踪看板

**每周复查** (每周五 16:00 Standup)

```
风险编号 | 风险描述 | 当前状态 | 所有者 | 进展
---------|---------|--------|--------|------
#1 | 英文 Prompt 质量 | 🟡 In Design | Content Lead | 等待初稿
#2 | 三语 UI 变形 | 🟢 Preparing | Frontend | W3 开始测
#3 | 韩国支付 | 🟢 Mitigation | Karen | Phase 1.5
#4 | DB 迁移失败 | 🟢 Prevention | DevOps | 预演中
#5 | DeepSeek 限流 | 🟢 Monitoring | Backend | 配额监控
#6 | 法合规缺陷 | 🟡 Review | Legal | W4 法务审
```

---

## ✅ 预上线检查（W7 上线前必过）

```
[ ] Sentry 错误告警已配置
[ ] Grafana 仪表板已创建（可看 API 延迟、错误率）
[ ] 应急 Slack channel #incidents 已建
[ ] DevOps on-call 已排班（24/7）
[ ] 回滚脚本已测试（staging 预演）
[ ] 用户沟通文案已准备（如果有问题）
[ ] Karen 已同意应急决策树
```

---

**记住**：好的应急预案让问题 50% 更快解决。反之亦然。

最后更新：2026-08-10

