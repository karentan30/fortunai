# 投放启动前24小时检查清单 - 使用指南

**文档版本**: 1.0  
**更新日期**: 2026-08-08  
**有效期**: 2026-08-09 14:00 前  
**适用项目**: 善缘 ShenYuan 灵性平台

---

## 快速开始

### 📋 三份文件说明

你现在有三份互补的清单文件：

| 文件名 | 用途 | 谁用 | 格式 |
|------|------|------|------|
| **LAUNCH-READINESS-24H-CHECKLIST.md** | 完整详细版<br>含所有检查步骤和说明 | Claude开发者<br>QA工程师 | Markdown<br>可在IDE打开 |
| **LAUNCH-CHECKLIST-PRINTABLE.txt** | 简洁打印版<br>可直接打印或分屏显示 | Karen<br>DevOps<br>团队成员 | 纯文本<br>可打印 |
| **LAUNCH-TECH-QUICK-REFERENCE.sh** | 自动化检查脚本<br>一键执行所有检查 | DevOps<br>自动化 | Bash脚本<br>可执行 |

### 🎯 使用流程

```
【Day 1 - 2026-08-08】
  ├─ 18:00 - Karen阅读Karen待办清单(P0三项)
  └─ 20:00 - Claude准备好所有检查清单

【Day 2 - 2026-08-09】早上
  ├─ 08:00 - Karen执行P0三项操作
  ├─ 08:30 - Claude运行自动检查脚本
  ├─ 09:00 - 三方按LAUNCH-CHECKLIST-PRINTABLE.txt逐项检查
  ├─ 12:00 - 完整测试(支付路由+邀请系统)
  └─ 13:00 - 所有检查项✅通过

【投放启动】14:00
  ├─ 14:00 - 三方签名完成
  ├─ 14:05 - 运行最后部署脚本
  ├─ 14:10 - 监控启动
  └─ 14:15 - Karen发送第一条投放文案 🚀
```

---

## 详细使用说明

### 【推荐】完全自动化流程 (最快)

#### 1. 获取权限
```bash
# 将脚本加入PATH并赋予执行权限
chmod +x LAUNCH-TECH-QUICK-REFERENCE.sh
sudo cp LAUNCH-TECH-QUICK-REFERENCE.sh /usr/local/bin/launch-check
```

#### 2. 运行完整检查
```bash
# 运行完整自动检查 (约2分钟)
bash LAUNCH-TECH-QUICK-REFERENCE.sh check

# 输出示例:
# ════════════════════════════════════════════
# 【投放启动前 - 完整检查清单】
# ════════════════════════════════════════════
# 
# 第一部分: 数据备份检查
# ✅ data.json 文件存在
# ✅ 备份文件存在
# ...
# 
# 【检查结果统计】
# ✅ 通过: 10 项
# ❌ 失败: 0 项
# 🟢 所有关键检查都通过了! 可以投放
```

#### 3. 特定场景快速检查

```bash
# 只检查数据备份
bash LAUNCH-TECH-QUICK-REFERENCE.sh check | grep "数据备份" -A 5

# 测试支付路由
bash LAUNCH-TECH-QUICK-REFERENCE.sh test-payment

# 查看实时监控
bash LAUNCH-TECH-QUICK-REFERENCE.sh monitor

# 查看日志
bash LAUNCH-TECH-QUICK-REFERENCE.sh logs
```

---

### 【标准】三方协作流程 (推荐)

#### Step 1: Karen执行P0三项 (25分钟)

**操作人**: Karen  
**工具**: LAUNCH-CHECKLIST-PRINTABLE.txt (打印版)  
**时间**: 08:00-08:30

```
打印 LAUNCH-CHECKLIST-PRINTABLE.txt
↓
逐项完成 P0-1/P0-2/P0-3 三项操作
↓
记录结果和时间戳
↓
拍照或签名确认
```

**P0三项操作详见**:
- `docs/Karen待办清单-0808.md` (最简洁版)
- `LAUNCH-READINESS-24H-CHECKLIST.md` 第一阶段 (详细版)

#### Step 2: Claude运行自动检查 (5分钟)

**操作人**: Claude/DevOps  
**工具**: LAUNCH-TECH-QUICK-REFERENCE.sh  
**时间**: 08:30-08:35

```bash
bash LAUNCH-TECH-QUICK-REFERENCE.sh check
```

输出应该显示 🟢 所有检查通过

#### Step 3: 三方逐项检查 (60分钟)

**操作人**: Karen/Claude/DevOps  
**工具**: LAUNCH-CHECKLIST-PRINTABLE.txt (可打印或屏幕显示)  
**时间**: 08:35-09:35

工作流:
1. 打印 `LAUNCH-CHECKLIST-PRINTABLE.txt` (共约10页)
2. 三方各拿一份
3. 逐项检查并勾选 ☐
4. 如有❌失败项，立刻标记为红色并调查
5. 所有项都✅才继续

#### Step 4: 完整测试 (90分钟)

**操作人**: Karen (真机)+Claude (API)+DevOps (日志监控)  
**工具**: 手机+API工具+LAUNCH-TECH-QUICK-REFERENCE.sh  
**时间**: 09:35-11:05

**Karen操作** (手机真机测试):
```
1️⃣ 中文版本 bazi.html
   - 输入生辰 1990-05-15 03:47
   - 完成¥9.9微信支付
   - 验证完整报告显示 ✓

2️⃣ 英文版本 bazi-en.html
   - 输入生辰 1990-05-15 03:47
   - 完成$9.90 Stripe支付
   - 验证完整报告显示 ✓

3️⃣ 韩文版本 saju-landing-KR.html
   - 输入生辰 1990-05-15 03:47
   - 完成支付
   - 验证完整报告显示 ✓

记录: 截屏或视频证明
```

**Claude操作** (邀请系统API测试):
```bash
# 生成邀请链接
curl -X POST https://shenyuan.mylumee.cn/api/referral/generate \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_123","share_platform":"wechat"}'

# 验证链接追踪
curl "https://shenyuan.mylumee.cn/api/referral/stats?referrer_id=test_123"

# 验证返佣计算
# 期望: {"total_referrals":1,"total_commission":0.99}
```

**DevOps操作** (日志监控):
```bash
# 实时跟踪日志
ssh root@47.242.80.65 'cd /opt/shenyuan && pm2 logs shenyuan --lines 0'

# 检查错误
ssh root@47.242.80.65 'tail -20 /opt/shenyuan/logs/error.log'

# 检查支付webhook处理
ssh root@47.242.80.65 'grep -i "webhook\|stripe" /opt/shenyuan/logs/access.log | tail -10'
```

#### Step 5: 签署确认 (5分钟)

**操作人**: Karen/Claude/DevOps  
**工具**: 笔或数字签名  
**时间**: 11:05-11:10

每个人在 LAUNCH-CHECKLIST-PRINTABLE.txt 的 【三方Sign-Off签名】 部分签名:

```
👩 Karen (产品负责人)
   确认三项P0已完成: ☑
   确认可投放: ☑
   签名: Karen Tan      日期: 2026-08-09

🤖 Claude (技术负责人)
   确认所有技术检查已通过: ☑
   系统就绪评级: ☑ 绿灯
   签名: Claude AI      日期: 2026-08-09

⚙️  DevOps (基础设施)
   确认服务器准备就绪: ☑
   监控已启动: ☑
   签名: DevOps Team    日期: 2026-08-09
```

#### Step 6: 投放启动 (5分钟)

**操作人**: Claude  
**工具**: LAUNCH-TECH-QUICK-REFERENCE.sh  
**时间**: 14:00

```bash
# 最后部署
cd /Users/karen/projects/shenyuan
./deploy-complete.sh prod

# 激活监控
ssh root@47.242.80.65 "systemctl start shenyuan-monitor"

# 通知团队 (发Slack/飞书消息)
# "🚀 投放启动 | 时间: 2026-08-09 14:00 HKT"
```

#### Step 7: 投放后监控 (持续24h)

**操作人**: DevOps  
**工具**: LAUNCH-TECH-QUICK-REFERENCE.sh monitor  
**时间**: 14:00-38:00 (24小时)

```bash
# 启动实时监控
bash LAUNCH-TECH-QUICK-REFERENCE.sh monitor

# 或者手动定期检查
bash LAUNCH-TECH-QUICK-REFERENCE.sh check
```

监控间隔:
- 首4小时: 每30分钟检查一次
- 首24小时: 每1小时检查一次
- 第2-7天: 每天1次
- 第8天+: 每周1次

---

## 【检查清单深度指南】

### 第一部分: 数据备份检查

**为什么重要**: 
- 防止数据丢失 (服务器崩溃/硬件故障/被黑)
- 如果出问题可以快速恢复
- 投放期间会产生大量用户数据

**红线项**: `1.1 data.json 存在` (❌失败 = 不能投放)

**检查命令**:
```bash
ssh root@47.242.80.65 "
  echo '=== 检查主数据文件 ===' && \
  ls -lh /opt/shenyuan/data.json && \
  echo '' && \
  echo '=== 检查备份文件 ===' && \
  ls -lh /opt/shenyuan/data.json.bak-* | head -5
"
```

**失败恢复**:
```bash
# 如果data.json丢失
ssh root@47.242.80.65 "
  ls -t /opt/shenyuan/data.json.bak-* | head -1 | \
  xargs -I {} cp {} /opt/shenyuan/data.json
  pm2 restart shenyuan
"
```

---

### 第二部分: 环境变量验证

**为什么重要**:
- Stripe密钥决定支付是否工作
- DeepSeek密钥决定AI生成是否工作
- Admin Token决定后台管理是否工作

**红线项**: STRIPE_SECRET_KEY, JWT_SECRET, DOMAIN

**检查命令**:
```bash
ssh root@47.242.80.65 "
  echo '=== 环境变量检查 ===' && \
  cat /opt/shenyuan/.env | grep -E '^[A-Z_]+=' | cut -d= -f1 | sort
"
```

**正确输出应包含**:
```
ADMIN_TOKEN
ALIPAY_MERCHANT_ID
DEEPSEEK_API_KEY
DOMAIN
JWT_SECRET
STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
WECHAT_MERCHANT_ID
```

**失败恢复**:
```bash
# 编辑.env文件
ssh root@47.242.80.65 "nano /opt/shenyuan/.env"

# 重启应用以读取新环境变量
ssh root@47.242.80.65 "cd /opt/shenyuan && pm2 restart shenyuan --update-env"
```

---

### 第三部分: 服务启动验证

**为什么重要**:
- PM2离线 = 用户无法访问服务
- 内存过高 = 可能有内存泄漏
- 健康检查失败 = 某个依赖有问题

**红线项**: PM2进程在线 + 健康检查HTTP 200

**检查命令**:
```bash
# 1. 查看PM2状态
ssh root@47.242.80.65 "pm2 status"

# 2. 查看完整健康检查
ssh root@47.242.80.65 "curl -s http://localhost:3021/api/health | jq ."

# 预期输出:
# {
#   "status": "ok",
#   "uptime": "2h 34m",
#   "stripe": "connected",
#   "llm": "deepseek",
#   "database": "connected"
# }
```

**失败恢复**:
```bash
# 如果显示offline
ssh root@47.242.80.65 "pm2 restart shenyuan"

# 如果仍然offline，查看错误
ssh root@47.242.80.65 "pm2 logs shenyuan --err --lines 50"

# 如果启动失败，检查端口占用
ssh root@47.242.80.65 "lsof -i :3021"

# 如果显示stripe disconnected，检查STRIPE_SECRET_KEY
ssh root@47.242.80.65 "echo \$STRIPE_SECRET_KEY"
```

---

### 第四部分: 代码部署验证

**为什么重要**:
- 本地代码和生产代码必须一致
- 未提交的更改会导致不一致
- 被遗忘的文件会导致功能失效

**红线项**: 
- 本地clean working tree
- 最新commit已push
- 所有关键文件已在服务器

**检查命令**:
```bash
# 1. 本地检查
git status  # 应显示 nothing to commit, working tree clean

# 2. 推送到GitHub
git push origin main

# 3. 服务器检查
ssh root@47.242.80.65 "cd /opt/shenyuan && git log --oneline -1"

# 4. 对比版本
echo "本地版本: $(git log --oneline -1)"
echo "服务器版本: $(ssh root@47.242.80.65 'cd /opt/shenyuan && git log --oneline -1')"

# 5. 检查关键文件
ssh root@47.242.80.65 "
  echo '=== 前端文件 ===' && \
  ls -la /opt/shenyuan/pages/bazi*.html && \
  echo '=== 后端文件 ===' && \
  ls -la /opt/shenyuan/server/index.js && \
  echo '=== 合规页 ===' && \
  ls -la /opt/shenyuan/legal*.html
"
```

**失败恢复**:
```bash
# 如果本地有未提交的更改
git add .
git commit -m "feat: 投放前最后更新"
git push origin main

# 同步到服务器
ssh root@47.242.80.65 "cd /opt/shenyuan && git pull origin main"

# 重启应用
ssh root@47.242.80.65 "pm2 restart shenyuan"
```

---

### 第五部分: 支付路由测试 (最关键)

**为什么重要**:
- 这是投放的核心价值 = 收钱
- 三语言支付都必须工作
- 如果支付失败，投放等于零收入

**红线项**: 
- 中文+微信支付成功
- 英文+Stripe支付成功
- 韩文+支付方式打开

**详细流程**见 LAUNCH-READINESS-24H-CHECKLIST.md 第五部分 (约20页详细步骤)

**快速验证**:
```bash
# 检查Stripe连接
curl -H "Authorization: Bearer $STRIPE_SECRET_KEY" \
  https://api.stripe.com/v1/account

# 应该返回账户信息，不是错误

# 检查支付页面是否可访问
curl -I https://shenyuan.mylumee.cn/pages/bazi.html
# 应该返回 HTTP 200

# 检查支付webhook
curl -I https://shenyuan.mylumee.cn/api/webhooks/stripe
# 应该返回 HTTP 200 或 405 (POST required)
```

**失败排查**:
```bash
# 如果显示支付弹窗但提交失败
ssh root@47.242.80.65 "grep -i 'stripe\|payment' /opt/shenyuan/logs/error.log | tail -20"

# 如果显示"不支持该国家/地区"
# 检查Stripe账户地区设置

# 如果显示"参数错误"
# 检查前端是否传递了正确的Price ID
ssh root@47.242.80.65 "curl http://localhost:3021/api/health | grep -i stripe"
```

---

### 第六部分: 邀请系统测试

**为什么重要**:
- 邀请是投放后第一周的主要增长引擎
- 必须能生成链接、追踪、计算返佣
- 如果失败，用户邀请朋友无法获得奖励

**红线项**:
- 能生成邀请链接
- 能追踪被邀请者
- 能计算返佣

**快速测试**:
```bash
# 1. 生成邀请链接
RESPONSE=$(curl -s -X POST https://shenyuan.mylumee.cn/api/referral/generate \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_user_123","share_platform":"wechat"}')

echo "生成的邀请链接:"
echo $RESPONSE | jq .

# 2. 检查链接格式
REFERRAL_CODE=$(echo $RESPONSE | jq -r '.referral_code')
echo "邀请代码: $REFERRAL_CODE"

# 3. 查看邀请人的数据
curl "https://shenyuan.mylumee.cn/api/referral/stats?referrer_id=test_user_123" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

**预期返回**:
```json
{
  "success": true,
  "referral_url": "https://shenyuan.mylumee.cn/pages/bazi.html?ref=abc123def456",
  "referral_code": "abc123def456",
  "short_url": "https://shenyuan.win/r/abc123def456"
}
```

**失败排查**:
```bash
# 检查邀请系统是否已实现
ssh root@47.242.80.65 "grep -r 'referral' /opt/shenyuan/server/routes/"

# 检查数据库表
ssh root@47.242.80.65 "curl -s http://localhost:3021/api/referral/stats?referrer_id=test | jq ."
```

---

## 【签署规范】

### 何时需要签署

当以下情况之一发生时:
1. ✅ 所有8部分检查都通过
2. 📊 自动化脚本返回 "🟢 所有关键检查都通过"
3. 🎯 每个人都完成了自己的检查
4. 📋 所有测试都通过 (支付+邀请)

### 签署流程

#### 步骤1: 打印 LAUNCH-CHECKLIST-PRINTABLE.txt

```bash
# 在Mac上直接打印
lpr LAUNCH-CHECKLIST-PRINTABLE.txt

# 或者转换为PDF后打印
enscript -B -p LAUNCH-CHECKLIST-PRINTABLE.pdf LAUNCH-CHECKLIST-PRINTABLE.txt
```

#### 步骤2: 三方各拿一份

- Karen 一份
- Claude/技术负责人 一份
- DevOps 一份

#### 步骤3: 逐项检查并勾选

每个人用笔在自己的打印版上逐项检查，用 ☑ 标记已通过

#### 步骤4: 在【三方Sign-Off签名】部分签名

```
👩 Karen (产品负责人)
   确认三项P0已完成: ☑
   确认可投放: ☑
   签名: ________________  日期: 2026-08-09

🤖 Claude (技术负责人)
   确认所有技术检查已通过: ☑
   系统就绪评级: ☑ 绿灯
   签名: ________________  日期: 2026-08-09

⚙️  DevOps (基础设施)
   确认服务器准备就绪: ☑
   监控已启动: ☑
   签名: ________________  日期: 2026-08-09
```

#### 步骤5: 收集打印版

将三份签署完的打印版收集在一起，放在项目根目录备档:

```bash
# 归档签署版本
mkdir -p docs/launch-checklist-archives/
cp /path/to/signed-checklist.txt docs/launch-checklist-archives/LAUNCH-CHECKLIST-SIGNED-20260809.txt
```

---

## 【常见问题排查】

### Q1: "❌ PM2进程 shenyuan 离线"

**症状**: pm2 list 显示 stopped 或 errored

**诊断**:
```bash
# 1. 查看错误日志
ssh root@47.242.80.65 "pm2 logs shenyuan --err --lines 50"

# 2. 尝试重启
ssh root@47.242.80.65 "pm2 restart shenyuan"

# 3. 检查启动日志
ssh root@47.242.80.65 "pm2 logs shenyuan --lines 50 | head -30"
```

**常见原因和解决方案**:

| 错误信息 | 原因 | 解决方案 |
|--------|------|--------|
| `EADDRINUSE` | 端口被占用 | `lsof -i :3021 \| kill -9 <PID>` |
| `Cannot find module` | 依赖未安装 | `npm install` |
| `STRIPE_SECRET_KEY not defined` | 环境变量未设置 | 检查`.env`文件 |
| `ECONNREFUSED` | 数据库连接失败 | 检查MongoDB/Supabase |
| `Module version mismatch` | Node版本不兼容 | 检查`nvm use node` |

---

### Q2: "❌ 健康检查返回 'stripe':'disconnected'"

**症状**: `/api/health` 返回 stripe: disconnected

**诊断**:
```bash
# 1. 检查Stripe密钥
ssh root@47.242.80.65 "echo \$STRIPE_SECRET_KEY | cut -c1-10"

# 2. 验证密钥有效
curl -H "Authorization: Bearer sk_test_xxxxx" \
  https://api.stripe.com/v1/account

# 3. 检查后端代码是否正确初始化
ssh root@47.242.80.65 "grep -A5 'stripe.*initialize' /opt/shenyuan/server/index.js"
```

**解决方案**:
1. 确认 `STRIPE_SECRET_KEY` 在 `.env` 文件中
2. 重启PM2读取环境变量: `pm2 restart shenyuan --update-env`
3. 如果仍然失败，从Stripe Dashboard复制新的Secret Key

---

### Q3: "❌ 支付弹窗不显示"

**症状**: 点击"查看完整报告"按钮无反应，没有弹窗

**诊断**:
```bash
# 1. 在浏览器F12打开开发者工具
# 2. 查看Console是否有JavaScript错误
# 3. 查看Network是否有API调用失败

# 4. 检查前端是否有正确的Price ID
curl https://shenyuan.mylumee.cn/pages/bazi.html | \
  grep -i "price_" | head -5

# 5. 检查Stripe Publishable Key是否正确
curl https://shenyuan.mylumee.cn/pages/bazi.html | \
  grep -i "pk_" | head -5
```

**解决方案**:
1. 检查浏览器Console是否有错误信息
2. 确认 `STRIPE_PUBLISHABLE_KEY` 正确且已部署到前端
3. 清理浏览器缓存后刷新
4. 尝试用无痕模式打开页面

---

### Q4: "❌ 支付完成但不显示完整报告"

**症状**: 支付成功跳转回页面，但仍然显示"查看完整报告"按钮

**诊断**:
```bash
# 1. 检查webhook是否处理成功
ssh root@47.242.80.65 "tail -20 /opt/shenyuan/logs/access.log | grep webhook"

# 2. 检查数据库中是否有付费记录
ssh root@47.242.80.65 "curl http://localhost:3021/api/admin/payments?user_id=xxx"

# 3. 查看浏览器LocalStorage是否保存了付费状态
# 在F12 → Application → Local Storage → 检查是否有paid_status
```

**解决方案**:
1. **最可能原因**: Webhook没有正确处理支付成功事件
   ```bash
   # 在Stripe Dashboard中手动重新发送webhook
   # https://dashboard.stripe.com/account/webhooks
   # → 选择charge.succeeded event
   # → 点"Resend Event"
   ```

2. **次可能原因**: 前端没有重新加载付费状态
   ```bash
   # 刷新页面或清理浏览器缓存
   ```

3. **检查webhook配置**:
   ```bash
   ssh root@47.242.80.65 "grep -A10 'webhook.*stripe' /opt/shenyuan/server/routes/webhooks.js"
   ```

---

### Q5: "❌ 邀请链接生成失败"

**症状**: API返回 404 或 500

**诊断**:
```bash
# 1. 检查referral路由是否存在
ssh root@47.242.80.65 "ls -la /opt/shenyuan/server/routes/ | grep referral"

# 2. 查看错误日志
ssh root@47.242.80.65 "grep -i referral /opt/shenyuan/logs/error.log | tail -10"

# 3. 检查API端点
curl -X POST https://shenyuan.mylumee.cn/api/referral/generate \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test"}' -v
```

**解决方案**:
1. 确认 `server/routes/referral.js` 已部署
2. 确认PM2已重启以加载新路由
3. 检查数据库中邀请表是否已创建
4. 查看完整错误日志获取更多信息

---

## 【投放后的24h监控】

投放启动后，需要持续执行自动检查:

```bash
# 启动实时监控 (自动每30秒刷新一次)
bash LAUNCH-TECH-QUICK-REFERENCE.sh monitor

# 或者设置定时检查
crontab -e
# 添加:
# */30 * * * * bash /Users/karen/projects/shenyuan/LAUNCH-TECH-QUICK-REFERENCE.sh check >> /tmp/launch-monitor.log
```

**监控关键指标**:

| 指标 | 目标 | 告警阈值 |
|-----|------|--------|
| API响应时间 | < 1秒 | > 5秒 |
| 错误率 | < 1% | > 5% |
| PM2内存 | < 200MB | > 300MB |
| Stripe成功率 | > 99% | < 95% |
| 数据库连接 | 正常 | 失败 |

---

## 【技术支持】

### 紧急问题

| 问题 | 电话/邮件 | 优先级 | 预计响应 |
|-----|---------|------|--------|
| 服务完全宕机 | 紧急电话 | 🔴 P0 | 5分钟 |
| 支付功能失效 | 邮件+Slack | 🔴 P0 | 15分钟 |
| 数据丢失 | 紧急电话 | 🔴 P0 | 5分钟 |
| 某语言支付异常 | Slack | 🟠 P1 | 30分钟 |
| 邀请系统bug | 邮件 | 🟡 P2 | 1小时 |

### 获得帮助

1. **自动排查**: 运行检查脚本获得诊断信息
   ```bash
   bash LAUNCH-TECH-QUICK-REFERENCE.sh check > /tmp/diagnosis.txt
   ```

2. **查看详细日志**:
   ```bash
   bash LAUNCH-TECH-QUICK-REFERENCE.sh logs
   ```

3. **查看所有备份**:
   ```bash
   bash LAUNCH-TECH-QUICK-REFERENCE.sh recover
   # 选择选项3
   ```

4. **联系技术支持**: 
   - 提供上述诊断输出
   - 描述现象和预期行为
   - 提供最近一次成功的时间

---

## 【总结】

### ✅ 投放前的关键检查

1. **数据备份** - 防止数据丢失
2. **环境变量** - 确保Stripe/DeepSeek/Admin密钥配置正确
3. **服务启动** - PM2进程在线且健康
4. **代码部署** - 最新代码已部署到服务器
5. **支付路由** - 三语言支付都能完成
6. **邀请系统** - 邀请链接和返佣工作正常
7. **日志监控** - 日志系统已启动
8. **告警通知** - 告警渠道已配置

### 📋 使用哪个文件

- 👨‍💻 开发者/QA: `LAUNCH-READINESS-24H-CHECKLIST.md` (详细)
- 👩 产品/运营: `LAUNCH-CHECKLIST-PRINTABLE.txt` (简洁)
- ⚙️ DevOps/自动化: `LAUNCH-TECH-QUICK-REFERENCE.sh` (脚本)

### 🚀 一键启动

```bash
# 完整检查
bash LAUNCH-TECH-QUICK-REFERENCE.sh check

# 所有通过后，投放启动
./deploy-complete.sh prod
```

---

**文件版本**: 1.0  
**最后更新**: 2026-08-08  
**有效期**: 2026-08-09 14:00 前  
**下一版本**: 投放后收集反馈并优化

祝投放顺利! 🚀
