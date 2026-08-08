# 善缘周报 | Week {{WEEK_NUMBER}} ({{START_DATE}} - {{END_DATE}})

> **周期**: {{START_DATE}} 到 {{END_DATE}}  
> **生成时间**: {{GENERATED_AT}}

---

## 📊 本周核心指标

| 指标 | 数值 | 目标 | 完成度 | 环比 |
|------|------|------|--------|------|
| **DAU** | {{DAU_COUNT}} | {{DAU_TARGET}} | {{DAU_PCT}}% | {{DAU_CHANGE}} |
| **访问量** | {{PV_COUNT}} | {{PV_TARGET}} | {{PV_PCT}}% | {{PV_CHANGE}} |
| **订单数** | {{ORDER_COUNT}} | {{ORDER_TARGET}} | {{ORDER_PCT}}% | {{ORDER_CHANGE}} |
| **总收入** | ${{REVENUE}} | ${{REVENUE_TARGET}} | {{REV_PCT}}% | {{REV_CHANGE}} |
| **平均ARPU** | ${{ARPU}} | ${{ARPU_TARGET}} | {{ARPU_PCT}}% | - |
| **转化率** | {{CONVERSION_RATE}}% | {{CONVERSION_TARGET}}% | {{CONVERSION_PCT}}% | {{CONVERSION_CHANGE}} |

---

## 📈 流量来源分析

### 流量分布 (Top 10)

```
{{TRAFFIC_SOURCES}}
```

| 来源 | 访问 | 占比 | DAU | 转化率 |
|------|------|------|-----|--------|
{{TRAFFIC_TABLE}}

**主要观察**:
- {{TRAFFIC_INSIGHT_1}}
- {{TRAFFIC_INSIGHT_2}}
- {{TRAFFIC_INSIGHT_3}}

---

## 💰 商品销售分析

### 销售排行 (Top 10)

| 排名 | 商品 | 订单数 | 收入 | 平均客单价 | 订单占比 |
|------|------|--------|------|-----------|---------|
{{PRODUCT_TABLE}}

**产品洞察**:
- {{PRODUCT_INSIGHT_1}}
- {{PRODUCT_INSIGHT_2}}
- {{PRODUCT_INSIGHT_3}}

### 支付方式分布

```
{{PAYMENT_METHODS_CHART}}
```

| 支付方式 | 笔数 | 金额 | 占比 | 成功率 |
|---------|------|------|------|--------|
{{PAYMENT_TABLE}}

---

## 🔄 转化漏斗分析

```
页面访问 ({{PV_COUNT}})
    ↓ ({{VIEW_TO_REPORT_PCT}}%)
命盘生成 ({{REPORT_COUNT}})
    ↓ ({{REPORT_TO_CHECKOUT_PCT}}%)
进入支付 ({{CHECKOUT_COUNT}})
    ↓ ({{CHECKOUT_TO_PAYMENT_PCT}}%)
支付成功 ({{ORDER_COUNT}})
```

**转化率对标**:
- 页面 → 报告: {{VIEW_TO_REPORT_PCT}}% (目标: {{VIEW_TO_REPORT_TARGET}}%)
- 报告 → 支付: {{REPORT_TO_PAYMENT_PCT}}% (目标: {{REPORT_TO_PAYMENT_TARGET}}%)
- 整体转化: {{OVERALL_CONVERSION}}% (目标: {{OVERALL_CONVERSION_TARGET}}%)

---

## 📱 用户行为分析

### 用户留存

| 时间 | Cohort人数 | Day 1 | Day 3 | Day 7 | Day 14 | Day 30 |
|------|-----------|-------|-------|-------|--------|--------|
{{COHORT_TABLE}}

**留存对标**:
- Day 1 留存: {{D1_RETENTION}}% (行业: ~45-50%)
- Day 3 留存: {{D3_RETENTION}}% (行业: ~25-30%)
- Day 7 留存: {{D7_RETENTION}}% (行业: ~15-20%)

### 会话行为

| 指标 | 数值 | 对标 |
|------|------|------|
| 平均会话时长 | {{AVG_SESSION_DURATION}}s | >120s |
| 人均页数 | {{AVG_PAGES_PER_SESSION}} | >3 |
| 反弹率 | {{BOUNCE_RATE}}% | <50% |
| 人均停留 | {{AVG_STAY_TIME}}s | >60s |

---

## 🎯 裂变传播分析

### 邀请/分享数据

| 指标 | 数值 | 占比 | 环比 |
|------|------|------|------|
| **邀请链接点击** | {{REFERRAL_CLICKS}} | {{REFERRAL_PCT}}% | {{REFERRAL_CHANGE}} |
| **分享操作** | {{SHARE_COUNT}} | {{SHARE_PCT}}% | {{SHARE_CHANGE}} |
| **邀请转化率** | {{REFERRAL_CONVERSION}}% | - | {{REFERRAL_CONV_CHANGE}} |

**来自邀请的收入**: ${{REFERRAL_REVENUE}} (占比 {{REFERRAL_REV_PCT}}%)

**裂变洞察**:
- {{REFERRAL_INSIGHT_1}}
- {{REFERRAL_INSIGHT_2}}

---

## ⚠️ 关键问题 & 优化方向

### 🔴 Critical Issues (P0)

{{CRITICAL_ISSUES}}

### 🟡 High Priority (P1)

{{HIGH_PRIORITY_ISSUES}}

### 📋 待优化项

{{OPTIMIZATION_BACKLOG}}

---

## ✅ 本周完成事项

- {{COMPLETED_ITEM_1}}
- {{COMPLETED_ITEM_2}}
- {{COMPLETED_ITEM_3}}
- {{COMPLETED_ITEM_4}}

---

## 📅 下周计划

| 优先级 | 任务 | 负责 | 截止 |
|--------|------|------|------|
| P0 | {{NEXT_P0_1}} | {{OWNER}} | {{DUE_DATE}} |
| P0 | {{NEXT_P0_2}} | {{OWNER}} | {{DUE_DATE}} |
| P1 | {{NEXT_P1_1}} | {{OWNER}} | {{DUE_DATE}} |
| P1 | {{NEXT_P1_2}} | {{OWNER}} | {{DUE_DATE}} |

---

## 📊 对标与目标

### 年度目标进度

```
Q3 DAU目标: 100,000
━━━━━━━━━━━╋━━━━━━━━━━━ {{Q3_PROGRESS}}%

Q3 收入目标: $500,000
━━━━━━━━━━╋━━━━━━━━━━━ {{Q3_REVENUE_PROGRESS}}%

月度新增用户: {{MONTHLY_NEW_USERS}}
(目标: 30,000)
```

### 竞品对标

| 产品 | DAU | ARPU | 转化率 | 留存D7 |
|------|-----|------|--------|--------|
| 善缘 | {{OUR_DAU}} | ${{OUR_ARPU}} | {{OUR_CONVERSION}}% | {{OUR_D7}}% |
| 竞品A | {{COMP_A_DAU}} | ${{COMP_A_ARPU}} | {{COMP_A_CONVERSION}}% | {{COMP_A_D7}}% |
| 竞品B | {{COMP_B_DAU}} | ${{COMP_B_ARPU}} | {{COMP_B_CONVERSION}}% | {{COMP_B_D7}}% |

---

## 💬 备注

{{NOTES}}

---

**报告负责**: Data Team  
**下周报告时间**: {{NEXT_REPORT_DATE}}

