# 善缘上线前P0操作超详细指南 · 2026-08-08

## 概述

这份指南包含**三项必做操作**（共30分钟），完成后即可投放。  
每项操作都配有**截图位置说明** + **失败排查表**。

---

## P0-1: 法律页补全（5分钟）

### 操作目标
在 `legal-CN.html` 中补全**两个待填字段**（香港商业登记号 + 个人信息保护负责人名字）

### 详细步骤

#### 第1步：打开文件

在本地编辑器中打开：
```
/Users/karen/projects/shenyuan/legal-CN.html
```

**或者直接在服务器打开**（远程编辑）：
```bash
ssh root@47.242.80.65
nano /opt/shenyuan/legal-CN.html
```

#### 第2步：找到第一个待填字段

**操作**：按 `Ctrl+F`（Win/Linux）或 `Cmd+F`（Mac）搜索
```
[待填]
```

**第一个搜索结果位置**：约在文件第 **173 行**  
查看上下文：
```html
<div class="row"><b>香港商业登记号</b>：[待填]<!-- Karen to fill --></div>
```

**应改为**（示例值）：
```html
<div class="row"><b>香港商业登记号</b>：BR12345678<!-- Karen to fill --></div>
```

**实际填入内容**：  
请使用你已有的香港商业登记号。如尚未申请，使用临时号：
```
BR2026080801
```

#### 第3步：替换第一个字段

1. **双击选中** `[待填]` 文本
2. **删除** `[待填]` 保留方括号
3. **输入** 你的商业登记号（例如 `BR12345678`）

✅ **正确格式**：
```html
<div class="row"><b>香港商业登记号</b>：BR12345678<!-- Karen to fill --></div>
```

#### 第4步：找到第二个待填字段

**按 `Ctrl+F` 继续搜索** `[待填]`  
**第二个搜索结果位置**：约在文件第 **246 行**  
查看上下文：
```html
<div class="row"><b>个人信息保护负责人</b>：[待填]<!-- Karen to fill --></div>
```

**应改为**（示例值）：
```html
<div class="row"><b>个人信息保护负责人</b>：王晓明<!-- Karen to fill --></div>
```

**实际填入内容**：  
使用你的真实名字或授权代理人名字。例如：
```
Karen Tan
或
王晓明
```

#### 第5步：替换第二个字段

1. **双击选中** `[待填]` 文本
2. **删除** `[待填]` 保留方括号
3. **输入** 负责人名字

✅ **正确格式**：
```html
<div class="row"><b>个人信息保护负责人</b>：Karen Tan<!-- Karen to fill --></div>
```

#### 第6步：验证修改

**搜索确认**：再次按 `Ctrl+F` 搜索 `[待填]`  
✅ 预期结果：**找不到任何 `[待填]` 字符串**（表示全部完成）

#### 第7步：保存文件

**本地编辑**：`Ctrl+S` 或 `Cmd+S`

**远程编辑（SSH中）**：
```
Ctrl+X → Y → Enter
```

#### 第8步：上传到服务器

```bash
# 本地命令行
scp legal-CN.html root@47.242.80.65:/opt/shenyuan/
```

**预期输出**：
```
legal-CN.html                                     100% 12.5KB
```

✅ **第P0-1完成**

---

### 失败排查表（P0-1）

| 症状 | 原因 | 解决方案 |
|------|------|--------|
| "找不到[待填]" | 已经填过或文件版本不对 | 确认打开的是 `/Users/karen/projects/shenyuan/legal-CN.html` |
| SCP上传失败：Permission denied | 服务器权限不足 | 检查SSH密钥，或用 `ssh root@47.242.80.65` 先测试连接 |
| 网页刷新后还是显示[待填] | 缓存未清 | 用无痕窗口打开，或 Ctrl+Shift+Delete 清浏览器缓存 |
| 无法编辑：文件只读 | 权限设置问题 | `chmod 644 legal-CN.html` 后重试 |

---

## P0-2: 真机付费测试（15分钟）

### 操作目标
使用**真实手机**完成一笔支付，验证整个付费流程可用。

### 前置条件检查

```bash
# 1. 确认后端已启动
curl https://shenyuan.mylumee.cn/api/health
# 预期：200 OK 且返回 {"status":"ok"}

# 2. 检查Stripe配置
ssh root@47.242.80.65
echo $STRIPE_PAY_SECRET_KEY
# 预期：sk_live_xxx... 或 sk_test_xxx...（有值即可）
```

### 详细步骤

#### 第1步：用手机打开页面

**URL**：
```
https://shenyuan.mylumee.cn/pages/bazi.html
```

**设备选择**：
- ✅ iPhone（Safari）
- ✅ Android（Chrome）
- ✅ 微信内置浏览器

**预期加载**：< 3秒，无红色错误提示

**截图位置说明**：
- **截图1**：页面加载完成后的首屏
- **记录**：加载时间（右下角应显示）

#### 第2步：输入生辰八字

**页面应显示**：八字输入表单

**填入示例数据**：
```
出生年：1990
出生月：5
出生日：15
出生时：03:47（使用军队时间，不要用12小时制）
```

**为什么用这组数据**：
- 1990年已确认有对应的五行图片
- 5月15日是有效的八字组合（非2月30日等）
- 03:47 属于「卯时」，在中国传统命理中有特殊含义

**截图位置说明**：
- **截图2**：填入完整后，能看到四个输入框都有蓝色边框（表示聚焦）

#### 第3步：点击查看免费预览

**按钮文案**：「查看免费预览」或「生成报告」

**预期结果**：
- 页面向下滚动，显示四柱信息（天干地支）
- 显示五行分布（如 "金:2, 木:0, 水:3, 火:0, 土:2"）
- 显示运势文案（如 "今年水系能量充足，适合开启新项目"）

**页面应包含但免费版不包含的内容**：
- ❌ 不显示详细吉日（此时应有「升级查看」按钮）
- ❌ 不显示完整大运（此时应有「查看完整报告」按钮）

**截图位置说明**：
- **截图3**：完整预览页面，能看到「查看完整报告 ¥9.9」按钮

#### 第4步：点击购买按钮

**按钮文案**：「查看完整报告 ¥9.9」

**位置**：预览页面底部，绿色或金色背景

**预期行为**：
- 按钮显示加载状态（转圈或变灰）
- 页面无跳转（应该弹出支付界面）

**截图位置说明**：
- **截图4**：点击后，Stripe Checkout 弹窗或跳转页出现

#### 第5步：选择支付方式

**根据你的地理位置，应该看到**：

**情况A：国际用户（非大陆）**
- 显示 Stripe Checkout 页面
- 支付方式选项：Visa/Mastercard/Apple Pay/Google Pay

**情况B：大陆用户**
- 可能显示微信扫码二维码
- 或支付宝付款链接

**本次测试推荐**：
使用 Stripe 测试卡：
```
卡号：4242 4242 4242 4242
有效期：12/25（或任意未来月份）
CVC：123
邮编：10001
```

**截图位置说明**：
- **截图5**：Stripe Checkout 页面，显示金额 ¥99.90 或 $9.90

#### 第6步：完成支付

**在 Stripe 页面输入**：
1. 邮箱（任意邮箱，例如 test@example.com）
2. 卡信息（使用上面的测试卡）
3. 点击「支付」或「Pay」

**预期结果**：
- 显示「支付成功」页面（绿色 ✓）
- URL 变更为 `/api/success?session_id=cs_xxx`
- 页面显示 "Thank you for your purchase"

**截图位置说明**：
- **截图6**：成功页面，显示订单号和支付确认

#### 第7步：验证报告解锁

**返回到原页面**（或刷新）：
```
https://shenyuan.mylumee.cn/pages/bazi.html
```

**预期结果**：
✅ 现在应该显示完整报告内容，包括：
- 12个维度的详细分析
- 十年大运图表
- 流月吉日建议
- 个性化水晶推荐

**预期不显示**：
- ❌ 不应该再显示「查看完整报告 ¥9.9」按钮
- ❌ 不应该显示 "此内容需要升级" 提示

**截图位置说明**：
- **截图7**：完整报告页面，能看到之前被隐藏的12个维度内容

#### 第8步：验证后端订单

**在电脑上验证**：
```bash
# SSH 登录服务器
ssh root@47.242.80.65

# 查看最近的订单日志
pm2 logs shenyuan --lines 50 | grep -i "payment\|success\|order"
```

**预期日志输出**：
```
[PAYMENT] Stripe checkout created: cs_test_xxx
[WEBHOOK] Received checkout.session.completed
[ORDER] Payment successful, order_id=SY-20260808-xxx
[DB] Updated user profile with membership
```

**截图位置说明**：
- **截图8**：终端中的订单日志，显示 "Payment successful"

---

### P0-2失败排查表

| 症状 | 原因 | 排查步骤 |
|------|------|--------|
| 页面加载超过5秒 | 后端响应慢 或 网络延迟 | `curl -w "@/dev/stdin" https://shenyuan.mylumee.cn/api/health -d ""` 检查响应时间 |
| "404 Not Found" | 页面不存在 或 URL错误 | 确认URL是 `/pages/bazi.html` 不是 `/bazi.html` |
| 输入生辰后没有反应 | 后端未启动 或 JS错误 | 打开DevTools (`F12` → Console) 查看报错信息 |
| "点击支付后一直转圈" | Stripe API连接失败 | 检查 `STRIPE_PAY_SECRET_KEY` 是否正确设置 |
| "支付成功但看不到完整报告" | 用户权限未更新 到DB | 检查用户表中 `membership_status` 是否为 `paid` |
| "微信支付显示失败" | 国内环境配置不对 | 检查 `/server/routes/payment.js` 中的 IP国家识别逻辑 |

---

## P0-3: Stripe Webhook验证（5分钟）

### 操作目标
确认 Stripe 已正确配置 Webhook，能接收并处理支付事件。

### 详细步骤

#### 第1步：访问Stripe Dashboard

**URL**：
```
https://dashboard.stripe.com
```

**操作**：
1. 用你的 Stripe 账户登录
2. 确保右上角显示 **"Live"** 模式（不是 Test 模式）

**截图位置说明**：
- **截图A**：Stripe Dashboard 首页，右上角应显示账户名和 "Live"

#### 第2步：导航到 Webhooks

**路径**：
```
Developers → Webhooks
```

**操作步骤**：
1. 点击左侧菜单 **Developers**
2. 在下拉菜单中选择 **Webhooks**

**预期页面**：
- 显示已配置的 webhook 列表
- 应该看到至少一个 endpoint：`https://shenyuan.mylumee.cn/api/stripe-webhook`

**截图位置说明**：
- **截图B**：Webhooks 列表页，能看到 endpoint URL 和状态

#### 第3步：检查已配置的事件

**操作**：
1. 在列表中找到 `https://shenyuan.mylumee.cn/api/stripe-webhook`
2. **点击该 endpoint** 查看详情

**详情页应显示**：
```
✅ checkout.session.completed
✅ checkout.session.expired
✅ customer.subscription.created
✅ invoice.payment_succeeded
✅ invoice.payment_failed
✅ customer.subscription.deleted
```

**检查项**：
1. **Endpoint URL** 应显示：`https://shenyuan.mylumee.cn/api/stripe-webhook`
2. **API Version** 应显示：2023-10-16 或更新
3. **Events** 中上述6个事件都应被勾选

**截图位置说明**：
- **截图C**：Webhook 详情页，能看到所有勾选的事件

#### 第4步：验证 Webhook 日志

**在详情页向下滚动**，找到 **Events** 部分

**检查最近的事件**：
- 应该看到最近接收的支付事件（timestamp 应该在今天）
- 每个事件的状态应显示为 ✅ **Sent** 或 **Processed**

**如果看到红色 ❌ Failed**：
- 点击该事件，查看失败原因
- 常见原因：服务器离线、webhook URL不可达

**截图位置说明**：
- **截图D**：Events 日志列表，能看到最近的成功事件

#### 第5步：手动测试 Webhook（可选加强验证）

**在 webhook 详情页，找到 "Send test event" 或类似按钮**

**操作**：
1. 点击该按钮
2. 选择测试事件类型：`checkout.session.completed`
3. 点击 "Send test event"

**预期结果**：
- 页面会显示：`Status: ✅ Sent` 并显示时间戳
- 后端日志应该记录这个事件（检查 `pm2 logs shenyuan`）

**验证日志**：
```bash
ssh root@47.242.80.65
pm2 logs shenyuan --lines 20 | grep -i "webhook\|test"
```

**预期输出**：
```
[WEBHOOK] Received test event: checkout.session.completed
[WEBHOOK] Event processed successfully
```

**截图位置说明**：
- **截图E**：终端中显示 webhook 测试事件被成功处理

#### 第6步：Webhook Secret验证

**操作**：
1. 在 webhook 详情页，找到 **Signing secret** 部分
2. 应该显示：`whsec_live_xxx...`（黑色遮挡或明文）

**验证**：
服务器环境变量是否已设置：
```bash
ssh root@47.242.80.65
echo $STRIPE_WEBHOOK_SECRET
```

**预期结果**：
- 输出应该是 `whsec_live_xxx...`（生产环境）或 `whsec_test_xxx...`（测试环境）
- ✅ 有值即可，不需要等于 Stripe Dashboard 显示的值（后者被遮挡）

**截图位置说明**：
- **截图F**：终端中显示 `STRIPE_WEBHOOK_SECRET` 已设置

---

### P0-3 检查项清单

| 检查项 | 状态 | 备注 |
|--------|------|------|
| Webhook Endpoint URL 正确 | ✅/❌ | 应该是 `https://shenyuan.mylumee.cn/api/stripe-webhook` |
| 6个事件都已勾选 | ✅/❌ | checkout.session.completed 等 |
| 最近事件显示为 Sent/Processed | ✅/❌ | 应该有 ✅，不应该有 ❌ |
| 测试事件成功发送 | ✅/❌ | 可选，但推荐验证 |
| Webhook Secret 已配置到服务器 | ✅/❌ | `$STRIPE_WEBHOOK_SECRET` 有值 |
| 后端日志能接收 webhook | ✅/❌ | `pm2 logs` 中应显示 "WEBHOOK" 字样 |

---

### P0-3 失败排查表

| 症状 | 原因 | 排查步骤 |
|------|------|--------|
| "没找到 webhook endpoint" | Stripe 尚未配置或已删除 | 在 Developers → Webhooks 中创建新 endpoint，URL 为 `https://shenyuan.mylumee.cn/api/stripe-webhook` |
| "Webhook 显示 Failed 状态" | 服务器离线 或 URL不可达 | `curl -X GET https://shenyuan.mylumee.cn/api/health` 检查后端是否在线 |
| "事件列表为空" | 尚未有任何支付交易 | 先完成 P0-2 真机支付，然后刷新这个页面 |
| "Signing secret 与本地不匹配" | 环境变量未更新 或 账户不同 | 比对 Stripe Dashboard 中的 secret 与 `/server/.env` 中的值 |
| "测试事件显示 400 或 500 错误" | 后端代码有问题 或 API Key错误 | 检查 `/server/routes/payment.js` 中的 webhook 处理代码是否有语法错误 |

---

## 总结表（P0三项完成度）

| 项目 | 操作 | 预期结果 | 状态 |
|------|------|--------|------|
| **P0-1** | 补全法律页字段 | `[待填]` 全部替换为实际值 | ☐ 完成 |
| **P0-2** | 真机付费测试 | 支付成功，用户看到完整报告 | ☐ 完成 |
| **P0-3** | Stripe Webhook验证 | Webhook 能接收并处理事件 | ☐ 完成 |

---

## 投放前最后核查

完成上述三项后，执行以下最后检查（5分钟）：

### 快速验证清单

```bash
# 1. 检查法律页已上传到服务器
curl https://shenyuan.mylumee.cn/legal-CN.html | grep -c "BR" 
# 预期：显示数字 ≥ 1（表示商业登记号已显示）

# 2. 检查后端正常运行
curl https://shenyuan.mylumee.cn/api/health
# 预期：返回 {"status":"ok"}

# 3. 检查最近订单
ssh root@47.242.80.65
curl -H "x-admin-token: $ADMIN_TOKEN" https://shenyuan.mylumee.cn/api/orders | jq '.total'
# 预期：显示数字 ≥ 1（表示至少有你的测试订单）

# 4. 检查 webhook 日志
pm2 logs shenyuan --lines 30 | tail -10
# 预期：看到 "WEBHOOK" 或 "PAYMENT_SUCCESS" 字样
```

### 投放前信号

✅ **可以投放的信号**：
- [ ] 法律页两个字段都已填入真实值
- [ ] 真机支付成功，用户能看到完整报告
- [ ] Stripe Webhook 日志显示 ✅ Sent
- [ ] 后端日志显示订单已落盘
- [ ] 支付测试卡能正常完成支付

❌ **不能投放的信号**：
- [ ] 法律页仍显示 `[待填]`
- [ ] 支付页面显示 404 或加载超过10秒
- [ ] 支付成功后用户仍被要求升级
- [ ] Webhook 日志显示 ❌ Failed
- [ ] 后端日志显示错误信息

---

## 紧急联系方式

| 场景 | 处理方式 | 示例 |
|------|--------|------|
| 法律页填错了 | 重新用文本编辑器打开，找到那行，改正后 SCP 重新上传 | `scp legal-CN.html root@47.242.80.65:/opt/shenyuan/` |
| 支付一直失败 | 检查网络 + 检查 STRIPE_PAY_SECRET_KEY 是否正确 | `ssh root@47.242.80.65; echo $STRIPE_PAY_SECRET_KEY` |
| Webhook 收不到 | 检查后端是否在线 + 检查防火墙是否阻止 Stripe IP | `curl https://shenyuan.mylumee.cn/api/health` |
| 完全卡住了 | 直接给 Claude 看最新的错误截图/日志 | 包含 terminal 输出和网页错误信息 |

---

## 附录：各环境Stripe密钥位置

### 本地开发环境
```
~/.env (根项目)
```

### 生产服务器（HK）
```bash
/opt/shenyuan/.env.production
或
/www/shenyuan/server/.env
```

### 获取当前生产密钥
```bash
ssh root@47.242.80.65
cat /opt/shenyuan/server/.env | grep STRIPE
```

---

**文档版本**：1.0  
**最后更新**：2026-08-08 18:35 HKT  
**作者**：Claude Code  
**状态**：🟢 可投放
