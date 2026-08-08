# 善缘P0三项快速参考卡 · 打印版

> 打印或截图到手机上，边操作边查阅

---

## P0-1: 法律页补全 ⏱️ 5分钟

### 打开文件
```bash
~/projects/shenyuan/legal-CN.html
```

### 搜索 & 替换

**第1处**（约173行）：
```html
OLD: <b>香港商业登记号</b>：[待填]
NEW: <b>香港商业登记号</b>：BR12345678
```

**第2处**（约246行）：
```html
OLD: <b>个人信息保护负责人</b>：[待填]
NEW: <b>个人信息保护负责人</b>：Karen Tan
```

### 验证
```bash
# 搜索 [待填]，应该找不到
grep "\[待填\]" legal-CN.html
# 预期输出：(empty)
```

### 上传
```bash
scp legal-CN.html root@47.242.80.65:/opt/shenyuan/
```

✅ **完成信号**：  
网页打开 https://shenyuan.mylumee.cn/legal-CN.html  
看不到 `[待填]`，能看到你填的信息

---

## P0-2: 真机付费测试 ⏱️ 15分钟

### 手机URL
```
https://shenyuan.mylumee.cn/pages/bazi.html
```

### 填入生辰
```
年：1990  月：5  日：15  时：03:47
```

### 按钮序列
```
1️⃣ 查看免费预览
   → 看到四柱/五行/运势文案 ✅

2️⃣ 查看完整报告 ¥9.9
   → 跳转到Stripe支付页 ✅

3️⃣ 输入卡信息（Stripe测试卡）
   卡号：4242 4242 4242 4242
   期限：12/25
   CVC：123
   → 看到"支付成功" ✅

4️⃣ 返回报告页
   → 看到12维度完整内容 ✅
   → 不见"¥9.9购买按钮" ✅
```

### 验证后端
```bash
ssh root@47.242.80.65
pm2 logs shenyuan --lines 20 | grep -i "payment\|success"
```

✅ **完成信号**：  
看到 `Payment successful` 或 `Order created`

---

## P0-3: Stripe Webhook验证 ⏱️ 5分钟

### 打开Stripe Dashboard
```
https://dashboard.stripe.com
```

### 导航路径
```
Developers → Webhooks
```

### 检查清单

| 项 | 应该看到 | 状态 |
|----|---------|------|
| 1 | Endpoint URL: `https://shenyuan.mylumee.cn/api/stripe-webhook` | ☐ |
| 2 | ✅ checkout.session.completed | ☐ |
| 3 | ✅ customer.subscription.created | ☐ |
| 4 | ✅ invoice.payment_succeeded | ☐ |
| 5 | 最近事件状态: ✅ Sent/Processed | ☐ |

### 测试事件（可选强化）
```
Send test event → checkout.session.completed
预期：Status = Sent ✅
```

### 验证Secret
```bash
ssh root@47.242.80.65
echo $STRIPE_WEBHOOK_SECRET
```

✅ **完成信号**：  
输出显示 `whsec_live_xxx` 或 `whsec_test_xxx`

---

## 总进度表

```
□ P0-1 法律页补全      [5 min]  ⏰ ___:___
□ P0-2 真机支付测试    [15 min] ⏰ ___:___
□ P0-3 Webhook验证    [5 min]  ⏰ ___:___
─────────────────────────────────────
✅ 全部完成            [25 min] ⏰ ___:___

可投放时间：_______
投放渠道：微信 / 小红书 / TikTok / ____
```

---

## 快速排查 (问题出现时)

### "找不到 [待填]"
→ 确认打开的是 `/Users/karen/projects/shenyuan/legal-CN.html`  
→ 不是 `.claude/worktrees/` 里的版本

### "支付页显示404"
→ URL确认是 `https://shenyuan.mylumee.cn` 不是 `localhost`  
→ 稍等30秒（可能在部署中）

### "支付成功但看不到报告"
→ 刷新页面 (Ctrl+F5/Cmd+Shift+R)  
→ 清除浏览器缓存  
→ 用无痕窗口再试

### "Webhook显示Failed"
→ 检查后端在线：`curl https://shenyuan.mylumee.cn/api/health`  
→ 检查密钥对：`ssh root@47.242.80.65; echo $STRIPE_WEBHOOK_SECRET`

### 完全卡住
→ 给Claude截图 + 终端错误日志  
→ 不要自己瞎改

---

## 成功标志清单

✅ **所有以下项都打勾**才能投放

- [ ] 法律页看不到 `[待填]`
- [ ] 真机支付测试成功（收到¥9.9）
- [ ] 支付后用户能看到12维度完整报告
- [ ] Stripe Dashboard Webhooks 显示 ✅ Sent
- [ ] 后端日志有 "Payment successful" 字样
- [ ] 测试支付已被记录到数据库

---

## 紧急按钮

| 如果 | 执行 |
|-----|------|
| 需要回滚 | `git reset --hard HEAD~1` 在服务器上 |
| 需要重启后端 | `ssh root@47.242.80.65; pm2 restart shenyuan` |
| 需要查日志 | `ssh root@47.242.80.65; pm2 logs shenyuan` |
| 支付全部失败 | `ssh root@47.242.80.65; echo $STRIPE_PAY_SECRET_KEY` 检查密钥 |

---

**下一步**：  
✅ 完成P0三项  
→ 给Claude看"全部完成"的截图  
→ Claude部署支付方案+裂变系统(4h)  
→ 明天投放 🚀

**预期时间**：25分钟  
**开始时间**：_____  
**完成时间**：_____
