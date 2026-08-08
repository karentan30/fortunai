# 善缘投放渠道工具包 - 完整指南

**版本**: 1.0  
**生成日期**: 2026-08-08  
**适用**: 所有营销投放人员  
**更新周期**: 每月月末 (下月计划前)

---

## 📦 工具包内容清单

### 1. 📜 生成脚本
**文件**: `/scripts/generate-refcodes.js`

```bash
# 生成100个跨渠道邀请码 (5个渠道混合)
node scripts/generate-refcodes.js

# 生成所有渠道完整配置 (推荐首次使用)
node scripts/generate-refcodes.js all

# 生成单个渠道邀请码 (50个微信专用)
node scripts/generate-refcodes.js wechat 50

# 生成单个渠道邀请码 (25个小红书专用)
node scripts/generate-refcodes.js xiaohongshu 25
```

**输出文件**:
- `data/refcodes-YYYYMMDD.csv` - Excel可直接导入的邀请码清单
- `data/refcode-mapping.json` - 后端追踪配置 (渠道→邀请码映射)
- `data/refcodes-YYYYMMDD.txt` - 可分享的纯码格式

---

### 2. 🗺️ 邀请码映射表
**文件**: `/data/refcode-mapping.json`

**用途**:
- 后端追踪系统的源数据
- 渠道KPI目标的参考标准
- 邀请码→用户转化的归因模型

**关键字段解读**:

```json
{
  "wechat": {
    "name": "微信",
    "prefix": "WX",          // 邀请码前缀 (WX0001-WX0030)
    "total_codes": 30,       // 为微信分配30个
    "codes": ["WX0001", "WX0002", ...],  // 具体邀请码列表
    "tracking_url_template": "https://shenyuan.app?ref={ref_code}&channel=wechat",
    "usage_by_subgroup": [
      {
        "name": "财经投资群",
        "code_range": "WX0001-WX0006",
        "target_users": 50     // 这6个码的目标激活人数
      }
    ],
    "kpi": {
      "target_signups": 30,              // 目标新注册30人
      "target_conversion_rate": "20%",   // 转化率20% (6人首单)
      "target_cac": "¥50"                // 单人获客成本¥50
    }
  }
}
```

---

### 3. ✅ 投放前检查清单
**文件**: `/LAUNCH-CHANNELS-CHECKLIST.md`

**结构**:
- 总体5项通用检查 (所有渠道必过)
- 每渠道5项专用检查 (5个渠道 × 5项 = 25项)

**使用流程**:

```
投放前2周 → 产品组过通用5项检查
投放前1周 → 各渠道负责人过各自5项检查
投放前3天 → Karen最终审批所有绿灯
投放后1周 → 复查检查项 (找问题改源头)
```

**绿灯标准**:
- 🟢 所有项目都打 ✅ → 可投放
- 🟡 有个别黄旗项但有备选 → 风险可接受，继续
- 🔴 任何红旗 → 暂停投放，修复后重试

---

### 4. 📅 内容日历
**文件**: `/CONTENT-CALENDAR-2026-09.md`

**包含**:
- 每渠道详细投放计划 (微信/小红书/TikTok/YouTube/博客)
- 邀请码到内容的映射 (追踪哪篇内容引流最好)
- 每日KPI目标 (播放/转化/CAC)
- 成本分配表 (总投入¥9000)
- 周度检查清单 (每周一汇总数据)

**快速使用**:

```markdown
# 9月计划概览
- 微信: 4篇/周 × 4周 = 16篇  (预期30注册 | 6首单)
- 小红书: 2篇/周 × 4周 = 8篇 (预期20注册 | 3首单)
- TikTok: 3篇/周 × 4周 = 12篇 + 4场直播 (预期30注册 | 4首单)
- YouTube: 3篇 (预期5注册 | 1首单)
- 博客: 2篇 (预期15注册 | 6首单)

总计: 45个内容资源 | 100人新注册 | 20人首单
```

---

## 🚀 投放快速开始 (3步)

### 步骤1: 生成邀请码 (5分钟)

```bash
cd /Users/karen/projects/shenyuan
node scripts/generate-refcodes.js all
```

**输出检查**:
```
✅ CSV已生成: data/refcodes-20260808.csv
✅ 映射表已生成: data/refcode-mapping.json
✅ 可分享格式: data/refcodes-20260808.txt

📊 渠道分布:
   微信 (wechat):      30个 (前缀: WX)
   小红书 (xiaohongshu): 25个 (前缀: XHS)
   TikTok (tiktok):     20个 (前缀: TK)
   YouTube (youtube):   10个 (前缀: YT)
   自然流量 (organic):   15个 (前缀: ORG)
```

### 步骤2: 分配邀请码给渠道负责人 (30分钟)

```bash
# 打开CSV文件
open data/refcodes-20260808.csv

# 复制Google Sheets → 分享给各渠道负责人
# 格式: 邀请码 | 渠道 | 负责人 | 投放位置 | 预期触达 | 已激活 | 激活率
```

**分配模板**:

| 邀请码范围 | 渠道 | 负责人 | 投放位置 | 预期触达 | 截止日期 |
|-----------|------|--------|---------|---------|---------|
| WX0001-0006 | 微信 | Lisa | 财经投资群 | 50人 | 9/3 |
| WX0007-0012 | 微信 | Tom | 心灵修养群 | 40人 | 9/3 |
| XHS0001-0008 | 小红书 | Amy | 八字科普笔记 | 2K展现 | 9/4 |
| TK0001-0012 | TikTok | Mike | 视频+直播 | 200万播放 | 9/28 |

### 步骤3: 上线前72小时最终检查 (1小时)

```bash
# 打开检查清单
open LAUNCH-CHANNELS-CHECKLIST.md

# 分段完成检查
- 通用5项 (产品组) ← 标记完成时间
- 微信5项 (Lisa) ← 标记完成时间
- 小红书5项 (Amy) ← 标记完成时间
- TikTok5项 (Mike) ← 标记完成时间
- YouTube5项 (Jack) ← 标记完成时间
- 自然流量5项 (SEO组) ← 标记完成时间

# 所有人核实后 → Karen发启动令 → T-0执行
```

---

## 📊 邀请码追踪体系

### 后端追踪集成

```javascript
// 后端需实现的追踪逻辑

// 1. 注册时捕获邀请码
app.post('/register', (req, res) => {
  const { ref_code } = req.query;  // ?ref=WX0001&channel=wechat
  
  // 2. 保存到用户记录
  user.referral_code = ref_code;
  user.referral_channel = req.query.channel;
  user.referral_source = req.headers.referer;
  user.signup_ip = req.ip;
  
  // 3. 更新邀请码的激活计数
  await updateRefCodeStats(ref_code, {
    activated_at: new Date(),
    user_id: user.id,
    signup_ip: req.ip
  });
});

// 4. 首单时触发转化
app.post('/checkout/success', (req, res) => {
  const { user_id, amount } = req.body;
  const user = await User.findById(user_id);
  
  // 更新邀请码的转化统计
  await updateRefCodeStats(user.referral_code, {
    converted_at: new Date(),
    conversion_amount: amount,
    conversion_type: 'first_order'
  });
});
```

### 数据埋点 (前端)

```javascript
// Google Analytics 埋点

// 邀请码来源追踪
gtag('event', 'view_content', {
  content_type: 'refcode_landing_page',
  content_id: getUrlParam('ref'),
  channel: getUrlParam('channel')
});

// 注册埋点
gtag('event', 'sign_up', {
  signup_method: getUrlParam('channel'),  // wechat, xiaohongshu, etc
  referral_code: getUrlParam('ref')
});

// 转化埋点
gtag('event', 'purchase', {
  transaction_id: order.id,
  value: order.amount,
  currency: 'CNY',
  referral_code: user.referral_code,
  referral_channel: user.referral_channel
});
```

### BI仪表板必看指标

```markdown
# 实时监控 (刷新频率: 每小时)

## 渠道对比 (按激活率排序)
| 渠道 | 邀请码数 | 激活数 | 激活率 | 首单 | 转化率 | CAC | 排名 |
|-----|----------|--------|--------|------|--------|-----|------|
| 自然流量 | 15 | 12 | 80% | 3 | 25% | ¥30 | 🥇 |
| 小红书 | 25 | 15 | 60% | 2 | 13% | ¥60 | 🥈 |
| 微信 | 30 | 10 | 33% | 2 | 20% | ¥50 | 🥉 |
| TikTok | 20 | 10 | 50% | 1 | 10% | ¥80 | 4️⃣ |
| YouTube | 10 | 2 | 20% | 0 | 0% | N/A | 5️⃣ |

## 日度转化漏斗 (今日截止20:00)
注册: 49人 → 首单: 8人 → 转化率: 16.3% (目标20%)
→ CAC: ¥110 (目标¥90) ⚠️

## 邮件告警
- 🔴 TikTok激活率<40% → Mike需优化内容
- 🟡 YouTube转化率0% → 需A/B测试文案
- 🟢 自然流量CAC最低 → 加大投入预算
```

---

## 💡 最佳实践

### 微信投放技巧
✅ **群内分享**: 不同群用不同邀请码 → 追踪哪个群转化最好  
✅ **朋友圈**: 海报含邀请码二维码 → 扫码落地  
✅ **分享激励**: 邀请成功后给分享人赠品 → 病毒传播  
❌ **禁止**: 微信支付异常/邀请码失效 → 每天核查  

### 小红书投放技巧
✅ **笔记矩阵**: 8个笔记×3个账号 = 24条内容触达  
✅ **话题参与**: 每笔记必须参与2-3个热门话题 (#测八字 #命理)  
✅ **评论互动**: 点赞评论>500后再置顶邀请码引导  
❌ **禁止**: 直接在笔记标题/文案中放链接 → 容易被判违规  

### TikTok投放技巧
✅ **视频多样性**: 30秒快闪 + 1分钟演示 + 3分钟讲座 配比  
✅ **直播销售**: 直播间可设购物车链接 (需满足粉丝门槛)  
✅ **达人合作**: 与命理/心灵类达人合作UGC → 天然匹配  
❌ **禁止**: 硬广告堆砌 → TikTok算法严重降权  

### 自然流量(SEO)投放技巧
✅ **长期投资**: SEO见效慢(3-6月) 但转化率最高(25%)  
✅ **长尾词**: "八字入门教程" 比 "八字" 竞争小转化高  
✅ **内容沉淀**: 每月2-3篇深度内容 → 积累搜索权重  
❌ **禁止**: 关键词堆砌/买反链 → Google永久降权  

---

## 🛠️ 故障排查

### 问题1: 邀请码无法激活

```bash
# 检查清单
1. 后端是否正确捕获了ref参数?
   → 打开浏览器控制台 → 查看Network → 确认URL含ref=WX0001

2. 邀请码是否已部署到生产?
   → 检查 refcode-mapping.json 是否已发布到服务器
   
3. 数据库是否有注册记录?
   → 登后台 → 查询该邀请码的activation_log
   
4. 如果都没问题，检查是否遭遇反爬虫拦截
   → 检查服务器日志 403/429 错误 → 调整WAF规则
```

### 问题2: 首单转化数字为0

```bash
# 排查流程
1. 是否有人完成注册? (查活跃用户数)
   → 如果0人注册 → 邀请码激活都有问题，先解决问题1

2. 注册人是否尝试支付? (查支付流量)
   → 支付页面是否有访问 → 查询checkout事件数

3. 支付是否成功? (查交易记录)
   → Stripe/微信支付后台查订单 → 是否真实交易

4. 如果支付成功但未记录首单，检查webhook
   → 后端是否接收了payment success事件?
   → 是否正确更新了user.first_order字段?
```

### 问题3: 邀请码被滥用 (同IP多次激活)

```bash
# 应急方案
1. 即时暂停该邀请码
   UPDATE refcodes SET status = 'suspended' WHERE ref_code = 'WX0001';

2. 查找所有异常激活
   SELECT * FROM refcode_activations 
   WHERE signup_ip = '192.168.1.1' AND activated_at > NOW() - INTERVAL 1 HOUR
   ORDER BY activated_at DESC;

3. 手动审核异常账户 (比如同IP激活5个邮箱)
   → 标记为fraud账户 → 后续关闭时不计入转化

4. 调查根因 (是否有人写爬虫批量激活?)
   → 联系安全团队 → 加强WAF规则

5. 补救措施
   → 该IP未来邀请码激活需人工审核
   → 通知所有渠道检查流量质量
```

---

## 📋 月度工作流程

### 月初 (投放前2周)

```
Day 1:  生成邀请码 (scripts/generate-refcodes.js)
Day 2:  内容日历定稿 (CONTENT-CALENDAR-2026-09.md)
Day 3-5: 产品组过检查清单 ← 通用5项 (合规/性能/支付等)
Day 6-10: 渠道组过检查清单 ← 各自5项 (内容/渠道配置/数据追踪等)
Day 11-13: Karen审批 + 最后72小时核查
Day 14: 启动投放 ✨
```

### 月中 (投放进行中)

```
每日:    邀请码激活/首单数据刷新 (BI仪表板)
每周一:   渠道数据汇总报告 (发给Karen)
每周四:   优化执行 (根据数据调整文案/预算)
问题时:   触发应急预案 (邀请码失效/支付崩溃等)
```

### 月末 (复盘优化)

```
Day 25-27: 全月数据汇总 (转化率/CAC/LTV等)
Day 28-29: 战略分析 (TOP渠道×2/低效渠道砍掉)
Day 30:   下月计划定稿 (预留10月优化版本)
```

---

## 🔗 关键文档速查

| 文档 | 用途 | 谁用 | 频率 |
|-----|------|------|------|
| `/scripts/generate-refcodes.js` | 生成邀请码 | 技术/CMO | 月初 1次 |
| `/data/refcode-mapping.json` | 后端集成/数据追踪 | 后端/数据 | 投放中 持续 |
| `/LAUNCH-CHANNELS-CHECKLIST.md` | 投放前验收 | 全员 | 投放前 |
| `/CONTENT-CALENDAR-2026-09.md` | 内容排期/KPI | 内容/运营 | 投放中 每周 |
| `/LAUNCH-TOOLKIT-README.md` | 本文·完整指南 | 全员 | 随时查阅 |

---

## ❓ 常见问题 (FAQ)

**Q: 邀请码格式可以改吗? (比如改成中文)**  
A: 不建议。邀请码需英文+数字便于URL参数传输。前缀已区分渠道足够了。

**Q: 邀请码有有效期吗?**  
A: 无硬性有效期，但建议30天未激活标记inactive。防止陈旧码误用。

**Q: 是否可以重复使用邀请码?**  
A: 不建议。每个邀请码映射唯一的营销活动。重复会影响追踪准确度。

**Q: 如何区分是"邀请"还是"自然来访"?**  
A: 自然来访使用 ORG前缀的邀请码。后端在没有?ref参数时自动分配ORG码。

**Q: 邀请码激活后能删除吗?**  
A: 不能。保留所有历史记录便于审计。标记status='used'即可。

---

## 📞 联系人

| 角色 | 姓名 | 负责 | 紧急电话 |
|-----|------|------|---------|
| CMO | Karen | 投放战略/审批 | +86 138-1234-5678 |
| 内容负责人 | Leo | 文案/脚本 | +86 138-2222-2222 |
| 运营负责人 | Amy | 邀请码/渠道 | +86 138-3333-3333 |
| 数据分析 | Jack | 追踪/仪表板 | +86 138-4444-4444 |
| 技术联系 | Dev Team | 后端集成 | dev@shenyuan.app |

---

**文档版本**: 1.0  
**最后更新**: 2026-08-08  
**下个版本**: 2026-09-30 (10月计划) 

有问题? 📧 camp@shenyuan.app | 飞书@Karen

