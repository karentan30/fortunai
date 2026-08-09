# 善缘上线前完整检查 - 2026-08-09

> 上线前24小时·所有项目通用·必须全绿才能投放

---

## ✅ 服务器基建检查

### 1️⃣ PM2服务状态
```bash
ssh root@47.242.80.65 "pm2 status shenyuan"
```
**✅ Expected**: `online` 状态  
**❌ 失败时**: `pm2 restart shenyuan`

### 2️⃣ API健康检查
```bash
ssh root@47.242.80.65 "curl -s http://localhost:3021/api/health"
```
**✅ Expected**: 返回 `{"status":"ok","stripe":"connected"}`  
**❌ 失败时**: 检查环境变量和依赖

### 3️⃣ 数据库落盘
```bash
ssh root@47.242.80.65 "test -f /opt/shenyuan/data.json && wc -l /opt/shenyuan/data.json"
```
**✅ Expected**: 文件存在且大小 > 1KB  
**❌ 失败时**: 手动备份恢复

### 4️⃣ 备份检查
```bash
ssh root@47.242.80.65 "ls -lrt /opt/shenyuan/data.json.bak-* | tail -3"
```
**✅ Expected**: 至少3个备份文件，最新 < 1小时  
**❌ 失败时**: `cd /opt/shenyuan && cp data.json data.json.bak-$(date +%s)`

### 5️⃣ 磁盘空间
```bash
ssh root@47.242.80.65 "df -h /opt/shenyuan | tail -1"
```
**✅ Expected**: 使用率 < 80%  
**❌ 失败时**: 需要扩容或清理旧数据

---

## 📱 前端页面检查

### 1️⃣ 三语言首页加载
```
测试列表:
[ ] https://shenyuan.app (应该重定向到本地化版本)
[ ] https://shenyuan.app/pages/bazi.html (中文)
[ ] https://shenyuan.app/pages/bazi-en.html (英文)
[ ] https://shenyuan.app/pages/saju-landing-kr.html (韩文)
```
**验证**: 页面能加载，无404/500错误

### 2️⃣ 法律页面完整性
```
必须存在的页面:
[ ] pages/legal-us.html - Terms of Service
[ ] pages/legal-cn.html - 用户协议+隐私政策
[ ] pages/legal-kr.html - 이용약관+개인정보
[ ] pages/refund-policy.html - 退款政策
```
**验证**: 每个页面能打开，内容完整

### 3️⃣ 支付按钮可见性
```
对每个落地页检查:
[ ] 购买按钮显示位置正确
[ ] 价格显示对应货币 (USD/CNY/KRW)
[ ] 点击按钮能打开支付页面
```

---

## 💳 支付配置检查

### 1️⃣ Stripe密钥验证
```bash
ssh root@47.242.80.65 "grep -i 'STRIPE_PAY_SECRET_KEY' .env"
```
**✅ Expected**: 显示密钥 (以 `sk_test_` 或 `sk_live_` 开头)  
**❌ 失败时**: 更新 `.env` 文件

### 2️⃣ Webhook URL配置
```bash
# 登录 Stripe Dashboard: https://dashboard.stripe.com/webhooks
# 检查:
[ ] 端点URL: https://shenyuan.app/api/stripe-webhook
[ ] 监听事件: charge.succeeded / charge.failed
[ ] 最近事件日志应显示成功处理
```

### 3️⃣ Price IDs验证
```bash
# 检查 server/routes/payment.js 中的 STRIPE_PRICE_IDS
ssh root@47.242.80.65 "grep -A 10 'STRIPE_PRICE_IDS' /opt/shenyuan/server/routes/payment.js"
```
**✅ Expected**: 包含以下keys:
- `member_monthly`, `member_yearly` (USD)
- `bazi_full_krw`, `hehun_krw` (KRW)
- 其他需要的产品

### 4️⃣ 支付页面测试 (沙箱)
```
测试流程:
1. 选择产品 (¥99 报告 / $19.90会员)
2. 点击购买 → 进入支付
3. 使用测试卡: 4242 4242 4242 4242
4. 任意有效期/CVC
5. 验证: 
   [ ] 支付成功返回确认页面
   [ ] 后端日志记录 webhook 事件
   [ ] 订单出现在 /opt/shenyuan/data.json
```

---

## 📊 监控告警检查

### 1️⃣ Slack Webhook配置
```bash
ssh root@47.242.80.65 "grep -i 'SLACK_WEBHOOK' .env"
```
**✅ Expected**: 显示有效的Slack webhook URL  
**❌ 失败时**: 创建新的Slack webhook

### 2️⃣ 告警规则验证
```bash
# 健康检查脚本应该能正常运行
./scripts/health-check.sh
```
**✅ Expected**: 所有检查通过 (✅ 标记)

### 3️⃣ 邀请码生成
```bash
node scripts/generate-refcodes.js all
# 应该生成 CSV/JSON/TXT 文件
```
**✅ Expected**: 生成100个渠道邀请码

---

## 🔍 代码质量检查

### 1️⃣ 编译/Lint检查
```bash
npm run lint 2>/dev/null || echo "No lint configured"
npm run build 2>/dev/null || echo "Build optional"
```
**✅ Expected**: 无重大错误

### 2️⃣ 环境变量检查
```bash
ssh root@47.242.80.65 "cat .env | wc -l"
```
**✅ Expected**: 至少10个环境变量  
**关键变量**:
- [ ] STRIPE_PAY_SECRET_KEY
- [ ] STRIPE_WEBHOOK_SECRET
- [ ] SLACK_WEBHOOK_URL
- [ ] FRONTEND_URL
- [ ] PORT (3021)

### 3️⃣ 关键文件检查
```bash
cd ~/projects/shenyuan
# 确保以下文件存在且不为空:
[ ] server/routes/payment.js (支付路由)
[ ] server/lib/store.js (数据存储)
[ ] pages/bazi.html (中文首页)
[ ] pages/bazi-en.html (英文首页)
[ ] LAUNCH-KPI-TARGETS.md (投放KPI)
[ ] scripts/health-check.sh (健康检查)
```

---

## 🚀 投放前最后检查

### 1️⃣ KPI目标签字
```
【投放启动】: 2026-08-09 20:00
【Day 1目标】: DAU 30+ / 付费 3-5 / 转化 5-8%
【Day 7目标】: DAU 100+ / 付费 8-12 / 转化 5-8%
【成功信号】: 所有指标达标 → Week 2加码
【失败信号】: Day 3 DAU < 20 或 转化率 < 3% → 停投分析
```

### 2️⃣ 邀请码分配
```bash
# 邀请码应该已分配到各渠道:
[ ] 微信 (WX前缀) - 30个
[ ] 小红书 (XHS前缀) - 25个
[ ] TikTok (TK前缀) - 20个
[ ] YouTube (YT前缀) - 10个
[ ] 自然流量 (ORG前缀) - 15个
```

### 3️⃣ 应急工具就位
```bash
ls -la scripts/health-check.sh
ls -la EMERGENCY-RESPONSE.md
ls -la docs/P0-Troubleshooting-Flowchart-0808.md
```
**✅ Expected**: 所有应急工具都存在

---

## ✅ 最终签字

```
【上线检查完成时间】: ____________

【检查确认】:
- 服务器: ✅ / ❌
- 前端页面: ✅ / ❌
- 支付配置: ✅ / ❌
- 监控告警: ✅ / ❌
- 代码质量: ✅ / ❌
- 投放准备: ✅ / ❌

【问题清单】:
_________________________________________________________________

【允许上线】: ✅ YES / ❌ NO

签字: ___________________ (日期: _________)
```

---

## 🆘 如果某项失败

| 项目 | 快速修复 |
|------|---------|
| PM2离线 | `pm2 restart shenyuan` |
| API失败 | 检查端口3021是否监听 + .env变量 |
| 数据丢失 | 从最新备份恢复: `cp data.json.bak-* data.json` |
| 支付失败 | 检查Stripe密钥 + webhook配置 |
| 法律页缺失 | 补充缺失的legal-*.html文件 |
| 邀请码未生成 | 运行 `node scripts/generate-refcodes.js all` |

---

**所有项目通过 ✅ 才能发投放通知**
