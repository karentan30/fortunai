# 善缘投放前最终检查表 (上线前24h)

> **用途**: 投放启动前的Golden Checklist  
> **时间**: 2026-08-09 08:00-14:00  
> **负责**: Karen + Claude + DevOps

---

## 第一阶段: Karen操作 (今天0808 or 明天早08:00)

### ✅ P0-1: 法律页补全

```
[ ] 打开文件: legal-CN.html (在项目根目录)
[ ] Cmd+F 搜索 "[待填]" 共2处
    [ ] 第1处: 香港商业登记号 → 替换为 BR12345678 (你的实际号)
    [ ] 第2处: 个人信息保护负责人 → 替换为 王晓明 (你的实际名字)
[ ] Cmd+S 保存文件
[ ] 部署: 运行 scp legal-CN.html root@47.242.80.65:/opt/shenyuan/
[ ] 验证: 用SSH查看文件是否已部署 ✅
```

### ✅ P0-2: 真机付费测试走通

**准备**:
- 手机 (iPhone/Android均可)
- 网络 (WiFi/4G)
- 支付工具 (微信/Stripe卡)

**步骤**:

```
1️⃣  打开页面
   [ ] 用手机Chrome/Safari打开: https://shenyuan.mylumee.cn/pages/bazi.html
   [ ] 页面加载完成 (约3秒)

2️⃣  输入生辰
   [ ] 出生年: 1990
   [ ] 出生月: 5
   [ ] 出生日: 15
   [ ] 出生时: 03:47 (凌晨)
   [ ] 点击"生成命盘" 按钮

3️⃣  验证免费预览 ✅ 关键步骤
   [ ] 能看到"四柱" (庚午 辛卯 丁亥 丁寅)
   [ ] 能看到"五行" (金1 木2 水2 火2 土0)
   [ ] 能看到"这年运势" (3-4行文字)
   [ ] 下方有橙色按钮: "查看完整报告 ¥9.9 →"
   
   ❌ 如果看不到上面内容 → 刷新页面重试

4️⃣  点击购买
   [ ] 点击 "查看完整报告 ¥9.9 →" 按钮
   [ ] 出现支付方式弹窗 (2秒内)
   [ ] 看到选项:
       [ ] 微信支付 (¥9.90)
       [ ] Stripe信用卡 ($9.90)
       [ ] Google Pay / Apple Pay

5️⃣  完成支付 (选其中一种)

   **选项A: 微信支付** (推荐)
   [ ] 点"微信支付"
   [ ] 看到二维码 (用另一部手机扫)
   [ ] 确认支付 ✅ 9.90元
   [ ] 等待跳转 (15秒内回到页面)

   **选项B: Stripe信用卡**
   [ ] 点"信用卡"
   [ ] 输入卡号: 4242 4242 4242 4242
   [ ] 输入日期: 12/25
   [ ] 输入CVC: 123
   [ ] 点"支付"
   [ ] 等待跳转 (15秒内回到页面)

6️⃣  验证成功 ✅ 最关键
   [ ] 回到bazi.html
   [ ] 看到"完整命盘" 标题
   [ ] 看到完整的12维数据:
       [ ] 纳音五行
       [ ] 十神分析
       [ ] 大运流年
       [ ] 财运详解
       [ ] 姻缘指数
       [ ] ... (共12个维度)
   [ ] 底部有 "分享命盘" 按钮
   
   ❌ 如果看不到完整报告:
       - 清理浏览器缓存重试
       - 用无痕模式重试
       - 立刻通知Claude检查webhook
```

### ✅ P0-3: Stripe Webhook验证

```
[ ] 打开 Stripe Dashboard: https://dashboard.stripe.com/account/webhooks
[ ] 登录账户: tan42204@gmail.com (password自己填)
[ ] 进入 "Webhooks" 页面
[ ] 检查以下事件类型已监听:
    [ ] charge.succeeded
    [ ] charge.failed
    [ ] customer.subscription.updated
    
[ ] 检查以下Price ID已在监听中 (搜索):
    [ ] price_1TzAjGEAXrE2YgcrRzUY78Ko (member_monthly)
    [ ] price_1TzAjQEAXrE2YgcrHYurEL8Z (member_yearly)
    [ ] price_1U0BwvEAXrE2YgcrTU0PFGZm (member_quarterly) ⭐ 新的
    [ ] price_1TzrGREAXrE2Ygcr1dOkiv2O (bazi_full_krw)

[ ] 可选: 发送test event验证
    [ ] 点 "Send test event"
    [ ] 选 "charge.succeeded"
    [ ] 应该看到 HTTP 200 回应
```

**完成后**: 给Claude发消息 "三个P0已完成✅"

---

## 第二阶段: Claude集成 (明天08:00-13:00)

### 支付配置集成
- [ ] 更新STRIPE_PRICE_IDS表 (docs/STRIPE-PRICE-IDS-REFERENCE.json)
- [ ] 测试三语言checkout流程
- [ ] 验证webhook处理逻辑
- [ ] 部署到生产

### 裂变系统集成
- [ ] 创建referral路由 (server/routes/referral.js)
- [ ] 实现邀请链接API
- [ ] 前端邀请入口集成
- [ ] 分享卡Canvas实现
- [ ] 返佣自动发放逻辑

### QA验证
- [ ] 三语言支付都能走通
- [ ] 邀请系统能追踪+返佣
- [ ] 排行榜实时更新
- [ ] 日志无错误

### 部署生产
- [ ] 代码push + commit
- [ ] 生产部署 + health check
- [ ] 备份数据
- [ ] 监控启动

---

## 第三阶段: 投放启动 (明天14:00+)

### 服务器检查
```bash
ssh root@47.242.80.65

# 1. 检查服务状态
pm2 list
# 应该显示 shenyuan online

# 2. 检查健康
curl http://localhost:3021/api/health
# 应该返回 {"status":"ok","stripe":"connected","llm":"deepseek"}

# 3. 检查日志
pm2 logs shenyuan --lines 20
# 应该无ERROR

# 4. 检查备份
ls -la /opt/shenyuan/data.json*
# 应该有 data.json + data.json.bak
```

### 投放前最后确认
- [ ] 法律页已更新
- [ ] 真机付费测试已通过
- [ ] 所有代码已部署
- [ ] 监控已启动
- [ ] 告警已配置

### 投放启动
- [ ] Karen确认一切就绪
- [ ] 发送第一条投放文案到微信/小红书
- [ ] 启动数据追踪
- [ ] 24h值班模式启动

---

## 🚨 风险清单

| 风险 | 概率 | 影响 | 应急 |
|------|------|------|------|
| 支付失败 | 5% | 高 | 检查webhook + 回滚 |
| 地理路由失效 | 3% | 中 | 手动URL投放 |
| 服务宕机 | 2% | 高 | PM2自启+手动restart |
| 数据丢失 | 1% | 高 | 恢复备份 |
| 邀请链接失效 | 5% | 中 | IP限制排查 |

---

## ✅ 最终Sign-Off

当所有项目都打勾后，填写下方签名:

```
Karen确认: _____ 日期: _____
Claude验证: _____ 日期: _____
DevOps就绪: _____ 日期: _____

可投放: ☐ 是 ☐ 否
```

---

**预计完成时间**: 2026-08-09 14:00  
**投放启动时间**: 2026-08-09 14:00+

**Go/No-Go Decision**: _____

