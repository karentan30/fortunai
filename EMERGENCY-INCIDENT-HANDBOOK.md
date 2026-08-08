# 🚨 善缘 ShenYuan — 投放突发事件应急手册

**文档版本**: v1.0  
**最后更新**: 2026-08-08  
**适用范围**: 生产环境 | HK 服务器 47.242.80.65  
**查看权限**: 全技术团队 + CMO/CFO  

---

## 📋 快速导航

| 事件类型 | 严重级别 | 恢复时间 | 负责人 | 页面位置 |
|---------|---------|--------|------|--------|
| 支付失败 | P1 | 5-15min | DevOps/Payment | [Section 1](#1-支付失败p1) |
| 服务宕机 | P0 | 2-10min | DevOps | [Section 2](#2-服务宕机p0) |
| 邀请链接失效 | P2 | 5-30min | 后端工程 | [Section 3](#3-邀请链接失效p2) |
| 数据泄露 | P0 | 立即 | 安全/合规 | [Section 4](#4-数据泄露p0) |
| 流量暴涨宕机 | P0 | 1-5min | DevOps/基建 | [Section 5](#5-流量暴涨宕机p0) |

---

## 1️⃣ 支付失败 (P1)

### 1.1 症状识别

**用户反馈信号**：
- "我充不了值"（微信/支付宝）
- "订单一直待支付"
- 扣款成功但没获得商品/权限
- 重复扣款（通常是回调丢失）

**监控告警**：
- Sentry: `payment.create-checkout 5xx`
- PostHog: 支付转化率 <5%（常态 30%+）
- 微信商户平台: 拒付/退款申请激增
- 日志: `/api/pay/wechat/notify` 或 `/api/pay/alipay/notify` 4xx 错误

### 1.2 排查步骤 (5 分钟内完成)

**第 1 步：确认是哪个支付渠道**
```bash
# SSH 进服务器，查最近 100 条支付日志
ssh root@47.242.80.65
pm2 logs shenyuan-api --lines 100 | grep -E "pay|payment" | tail -20
```

**第 2 步：检查支付渠道配置**
```bash
# 查环境变量是否配置
cat /opt/shenyuan/server/.env | grep -E "WECHAT_|ALIPAY_"
# 输出示例（不得缺少）:
# WECHAT_APP_ID=wx...
# WECHAT_MCH_ID=123...
# WECHAT_API_KEY=XXXX...
# ALIPAY_APP_ID=2021...
# ALIPAY_PRIVATE_KEY=-----BEGIN...
```

**第 3 步：测试支付端点健康**
```bash
# 查获当前商品列表
curl -s "http://47.242.80.65/api/products" | jq '.'

# 测试微信创建订单
curl -X POST "http://47.242.80.65/api/create-checkout" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "bazi-report",
    "paymentMethod": "wechat_native"
  }' | jq '.'

# 测试支付宝创建订单
curl -X POST "http://47.242.80.65/api/create-checkout" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "bazi-report",
    "paymentMethod": "alipay_native"
  }' | jq '.'
```

**第 4 步：确认第三方支付平台状态**
- 微信: 登录 [商户平台](https://pay.weixin.qq.com) → 交易中心 → 查看是否有告警/限流/API返回 4xx
- 支付宝: 登录 [开放平台](https://open.alipay.com) → 查看订单、API日志

**第 5 步：数据库订单状态**
```bash
# 查数据库最近失败订单（若用 Supabase）
curl -s "http://47.242.80.65/api/admin/orders?status=failed&limit=10" | jq '.'

# 查某用户订单历史
curl -s "http://47.242.80.65/api/admin/orders?user_email=user@example.com" | jq '.'
```

### 1.3 恢复步骤

**原因：支付环境变量缺失**
```bash
# 方案 A：补充缺失 env（若密钥已在密钥管理服务）
ssh root@47.242.80.65
cat >> /opt/shenyuan/server/.env << 'EOF'
# 微信支付补充
WECHAT_APP_ID=wx_xxxxx
WECHAT_MCH_ID=1234567890
WECHAT_API_KEY=your_api_key_here
EOF

# 重启服务
pm2 restart shenyuan-api
pm2 logs shenyuan-api | head -20  # 确认启动无错
```

**原因：支付渠道 API 返回 4xx/5xx**
```bash
# 方案 B：查看完整错误日志
pm2 logs shenyuan-api --err | tail -50

# 常见错误及对应方案：
# · "Invalid signature" → 密钥/商户ID不对，重新检查
# · "Timeout" → 网络问题或第三方宕机，等待或切换备用渠道
# · "Merchant not activated" → 商户账户未激活，联系财务/商务
```

**原因：回调 Webhook 丢失/处理失败**
```bash
# 方案 C：补偿性重试（手动触发订单完成）
ssh root@47.242.80.65
cd /opt/shenyuan
node << 'EOF'
const axios = require('axios');
// 模拟支付成功回调（仅当确认用户真实支付成功）
axios.post('http://localhost:3021/api/pay/wechat/notify', {
  out_trade_no: 'sy_20260808_xxxxx',  // 订单号
  transaction_id: 'wx_real_tx_id',     // 微信交易号
  total_fee: 999,  // 金额（分）
  // ... 其他字段
}, {
  headers: { 'Content-Type': 'application/xml' }
}).then(r => console.log('触发成功:', r.data))
  .catch(e => console.error('触发失败:', e.message));
EOF
```

### 1.4 验证恢复

```bash
# ✅ 确认支付端点恢复
curl -X POST "http://47.242.80.65/api/create-checkout" \
  -H "Content-Type: application/json" \
  -d '{"productId": "bazi-report", "paymentMethod": "wechat_native"}' | jq '.code'
# 期望输出: 200 或 "SUCCESS"

# ✅ 确认订单回调正常处理
pm2 logs shenyuan-api | grep "notify" | tail -5
# 期望看到: "[REQ] POST /api/pay/wechat/notify 200 XXms"
```

### 1.5 事后处理

**通知用户**（若多人受影响）
```bash
# 生成补偿列表（已失败但真实支付的订单）
ssh root@47.242.80.65
curl -s "http://47.242.80.65/api/admin/orders?status=payment_failed&from=2026-08-08T00:00:00Z" \
  | jq '.[] | {email, amount, failed_at}' > /tmp/failed_orders.json

# 导出给财务/客服，发补偿通知
cat /tmp/failed_orders.json
```

**事故总结**（记录在此档案库）
- 时间: YYYY-MM-DD HH:MM UTC
- 渠道: [微信/支付宝]
- 影响用户数: NNN
- 根因: [XXX]
- 恢复耗时: X分钟
- 后续行动: [XXX]

---

## 2️⃣ 服务宕机 (P0)

### 2.1 症状识别

**立即检查**：
```bash
# 前端无法加载
curl -s http://47.242.80.65 | head -20  # 应返回 HTML（200）

# API 无响应
curl -s http://47.242.80.65/api/health  # 应返回 {"status":"ok"}

# 后端服务挂起
ssh root@47.242.80.65
pm2 status  # 查 shenyuan-api 是否 "online" 或 "stopped"
```

**监控告警**：
- UptimeRobot: 持续 5min 返回 5xx
- Sentry: 错误率 >50%
- 用户报告: "网站打不开"

### 2.2 自动恢复流程（1-2 分钟）

善缘采用 **PM2 + systemd 双层守护** + **watchdog 自愈**：

```bash
# ✅ 自动恢复已启用（无需手工干预）
ssh root@47.242.80.65

# 查看自动恢复状态
pm2 status
# 若 shenyuan-api 状态为 "stopped"，PM2 会在 10s 内自动重启

# 查看 systemd 守护状态（2 层防护）
systemctl status shenyuan-api-pm2
# 应输出 "active (running)"
```

### 2.3 手动重启（若自动恢复失效）

**级别 1：PM2 重启**（快速，保留内存状态）
```bash
ssh root@47.242.80.65
pm2 restart shenyuan-api
pm2 logs shenyuan-api | head -30  # 查启动日志
# 等待 ~10s 后确认启动成功（看输出 "Server running on port 3021"）
```

**级别 2：完整重启服务** (若 PM2 重启失败)
```bash
ssh root@47.242.80.65
# 彻底杀死旧进程
killall -9 node
sleep 2

# 重新启动
pm2 start /opt/shenyuan/server/index.js --name "shenyuan-api" --instances 1
pm2 logs shenyuan-api | head -30

# 确保开机自启
pm2 save
pm2 startup
```

**级别 3：依赖检查** (若级别 2 仍失败)
```bash
ssh root@47.242.80.65
cd /opt/shenyuan/server

# 检查依赖是否损坏
npm list --depth=0 2>&1 | grep -i "extraneous\|missing"

# 若有损坏，重装
rm -rf node_modules package-lock.json
npm install --production

# 重试启动
pm2 restart shenyuan-api
```

### 2.4 数据恢复

**检查数据存储是否损坏**
```bash
ssh root@47.242.80.65

# 若使用 JSON 文件存储
ls -lh /opt/shenyuan/server/data.json
file /opt/shenyuan/server/data.json  # 应返回 "JSON text data"

# 若 JSON 损坏（文件截断）
git -C /opt/shenyuan checkout server/data.json  # 恢复最后一个 commit 版本

# 若使用 Supabase
curl -s "http://47.242.80.65/api/health?check=db" | jq '.db_status'  # 应返回 "connected"
```

**重要：备份位置**
```bash
# 自动备份在此位置（每 6h 一份）
ls -lh /opt/shenyuan/.backups/
# 若需恢复旧版本：
cp /opt/shenyuan/.backups/data-2026-08-07-12.json /opt/shenyuan/server/data.json
pm2 restart shenyuan-api
```

### 2.5 验证恢复

```bash
# ✅ 检查所有关键端点
for endpoint in "/api/health" "/api/products" "/api/admin/health"; do
  echo "Testing $endpoint..."
  curl -s "http://47.242.80.65$endpoint" | head -50
done

# ✅ 检查响应时间
time curl -s http://47.242.80.65/api/health > /dev/null
# 应 <500ms

# ✅ 检查内存使用（异常泄漏会导致频繁重启）
ssh root@47.242.80.65
ps aux | grep node | grep -v grep
```

---

## 3️⃣ 邀请链接失效 (P2)

### 3.1 症状

- 用户通过邀请链接点进来，无法建立配对或自动关联
- 链接返回 404 或静默跳转到首页
- 已生成的邀请码无法查询

### 3.2 排查

**第 1 步：确认邀请链接格式**
```bash
# 邀请链接格式（2 种）：
# · 合婚配对: https://shenyuan.mylumee.cn/hepan?invite_code=ABC123
# · 推荐码裂变: https://shenyuan.mylumee.cn?ref=alice

# 查后端是否支持这些参数
ssh root@47.242.80.65
pm2 logs shenyuan-api | grep -E "invite_code|ref=" | tail -10
```

**第 2 步：检查邀请数据库**
```bash
# 查现有邀请记录
curl -s "http://47.242.80.65/api/admin/invites?limit=10" | jq '.'

# 查某邀请码是否存在
curl -s "http://47.242.80.65/api/admin/invites?code=ABC123" | jq '.'
```

**第 3 步：测试链接生成**
```bash
# 生成新邀请码
curl -X POST "http://47.242.80.65/api/invite/generate" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user@example.com", "type": "hepan"}' | jq '.invite_code'
```

### 3.3 快速修复

**原因：邀请表损坏**
```bash
ssh root@47.242.80.65
# 从备份恢复邀请表（若使用 Supabase）
npm run restore-invites-backup  # 若脚本存在

# 或手动重新生成（仅在非生产环境）
cd /opt/shenyuan
node << 'EOF'
// 补偿性生成缺失邀请码
const fs = require('fs');
const invites = require('./server/data.json').invites || [];
const missing = invites.filter(i => !i.code);
missing.forEach(i => {
  i.code = 'sy_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
});
fs.writeFileSync('./server/data.json', JSON.stringify({...require('./server/data.json'), invites}, null, 2));
console.log(`Generated ${missing.length} codes`);
EOF
```

**原因：前端路由无法解析邀请码参数**
```bash
# 检查前端是否正确处理 ?invite_code= 和 ?ref=
grep -r "invite_code" /opt/shenyuan --include="*.html" --include="*.js" | head -5
# 若缺失，需更新前端代码
```

**原因：邀请链接过期** (默认 30 天)
```bash
# 重新发送新链接给用户，或延长过期时间
# 在 .env 中修改
echo "INVITE_EXPIRY_DAYS=90" >> /opt/shenyuan/server/.env
pm2 restart shenyuan-api
```

### 3.4 补偿方案

**若多人受影响**：
```bash
# 导出失效邀请用户列表
ssh root@47.242.80.65
curl -s "http://47.242.80.65/api/admin/invites?expired=true" | jq '.[] | {email, expired_at}' > /tmp/expired_invites.json

# 批量重新发送链接或人工补偿（余额/试读)
cat /tmp/expired_invites.json
```

---

## 4️⃣ 数据泄露 (P0)

### 4.1 检测

**立即执行**（第 1 分钟）：
```bash
ssh root@47.242.80.65

# 查是否有异常文件访问（特别是 data.json / .env）
last -f /var/log/wtmp | head -20  # SSH 登录日志

# 查是否有无授权 API 调用
pm2 logs shenyuan-api --err | grep -E "403|unauthorized|denied" | tail -20

# 查网络连接是否有异常出站
netstat -tulpn | grep -E "ESTABLISHED|LISTEN" | grep -v "47.242.80.65"
```

**第 2 步：判断泄露范围**
```bash
# 查最近修改的敏感文件时间戳
ls -l /opt/shenyuan/server/data.json
ls -l /opt/shenyuan/server/.env
git -C /opt/shenyuan log --oneline -5  # 查最近 commit

# 若 data.json 被异常修改，立即恢复
cp /opt/shenyuan/.backups/data-latest.json /opt/shenyuan/server/data.json
```

**第 3 步：确认数据内容是否泄露**
```bash
# 查数据库是否有异常删除/导出操作
pm2 logs shenyuan-api --err | grep -E "export|download|DELETE|UPDATE" | wc -l

# 查敏感信息（用户邮箱、支付记录）是否在公网可见
curl -s "http://47.242.80.65/data.json" | head  # 应返回 403
curl -s "http://47.242.80.65/server/.env" | head  # 应返回 403
```

### 4.2 立即响应流程

**P0 泄露响应（5 分钟内）**

| 步骤 | 操作 | 负责人 | 时间 |
|------|------|------|------|
| 1 | 隔离服务器（断网/只读 IP） | DevOps | 即时 |
| 2 | 通知 CMO/CFO/法务 | 技术负责人 | 1min |
| 3 | 保存审计日志（git log + pm2 logs） | DevOps | 2min |
| 4 | 撤销/重置所有 API 密钥 | 安全 | 3min |
| 5 | 恢复干净备份，验证数据完整性 | DevOps | 4min |
| 6 | 上线通知页面（"我们发现安全问题，已修复"） | CMO | 5min |

```bash
# Step 1: 隔离服务器
ssh root@47.242.80.65
# 切换到只读模式（若支持）
mount -o remount,ro /opt/shenyuan
# 或断掉出站连接
iptables -A OUTPUT -j DROP

# Step 2: 保存证据
mkdir -p /tmp/incident_$(date +%s)
pm2 logs shenyuan-api --lines 10000 > /tmp/incident_*/api.log
git -C /opt/shenyuan log --all --oneline > /tmp/incident_*/git.log
tar czf /tmp/incident.tar.gz /tmp/incident_*

# Step 3: 重置密钥
# 在 .env 中重新生成所有密钥
# STRIPE_KEY, WECHAT_API_KEY, ALIPAY_PRIVATE_KEY 等
```

**Step 4: 法律/用户通知**
```
邮件模板：

主题: 数据安全通知 - 善缘账户检查建议

尊敬的用户：

我们最近发现并立即修复了一个数据安全问题（已于 [时间] 
完全恢复）。根据初步调查，[泄露范围描述]。

我们已采取以下措施：
• 隔离受影响系统，防止进一步泄露
• 撤销所有 API 密钥和会话
• 恢复系统到已知安全状态
• 加强访问控制和监控

对您造成的不便，我们表示歉意。无需任何操作；
如有疑问，请联系 support@shenyuan.com。

善缘安全团队
```

### 4.3 验证恢复

```bash
# ✅ 确认敏感文件不可公访问
curl -s http://47.242.80.65/data.json | head -1  # 应返回 403
curl -s http://47.242.80.65/server/.env | head -1  # 应返回 403

# ✅ 确认密钥已更新
ssh root@47.242.80.65
diff /opt/shenyuan/server/.env.old /opt/shenyuan/server/.env | grep -E "KEY|SECRET"
# 应显示所有 KEY/SECRET 已变更

# ✅ 确认已禁用泄露的旧 Session/Token
pm2 logs shenyuan-api | grep "Revoking\|Invalidating" | wc -l
# 应 >0

# ✅ 查审计日志是否完整
git -C /opt/shenyuan log --all --oneline | wc -l
# 应 >初始提交数
```

### 4.4 事后合规

**记录事故报告**（GDPR/CCPA 合规）
```bash
# 生成事故报告（含用户影响范围）
ssh root@47.242.80.65
cat > /tmp/security_incident_report.md << 'EOF'
# 安全事故报告

## 基本信息
- **事故时间**: 2026-08-08 14:30 UTC
- **发现时间**: 2026-08-08 14:35 UTC
- **修复时间**: 2026-08-08 14:42 UTC
- **总影响时间**: 7 分钟
- **影响用户数**: NNN

## 泄露范围
- [x] 用户邮箱
- [ ] 支付信息
- [ ] 密码哈希
- [其他...]

## 根因分析
[XXX]

## 修复措施
[XXX]

## 预防措施
[XXX]

---
报告人: DevOps | 日期: 2026-08-08
EOF

cat /tmp/security_incident_report.md
```

**通知相关部门**：
- 法务：泄露范围、合规影响
- CFO/CMO：用户通知计划、公关声明
- 用户支持：准备常见问题答案

---

## 5️⃣ 流量暴涨宕机 (P0)

### 5.1 症状

- 用户报告"速度很慢"或"无法连接"
- 监控显示请求堆积 (queue depth >1000)
- CPU/内存占用 >90%
- 响应时间 >5s (常态 <500ms)

### 5.2 自动扩容（1-2 分钟）

善缘采用 **PM2 cluster 模式 + 自动 fork** 应对突增流量：

```bash
ssh root@47.242.80.65

# ✅ 已启用的自动扩容
pm2 status
# 输出应显示 shenyuan-api 有多个 fork（e.g. "cluster" 模式，4 个进程）

# 若未启用，立即启用
pm2 delete shenyuan-api
pm2 start /opt/shenyuan/server/index.js --name "shenyuan-api" --instances max
pm2 save

# 查 cluster 模式是否工作
pm2 status | grep shenyuan-api
# 应显示:
# shenyuan-api  cluster  0  online  ...
# shenyuan-api  cluster  1  online  ...
# shenyuan-api  cluster  2  online  ...
# shenyuan-api  cluster  3  online  ...
```

**验证扩容生效**：
```bash
# 查当前进程数
ps aux | grep "node.*index.js" | grep -v grep | wc -l
# 应 ≥4

# 查每个进程内存占用（应均匀分散）
ps aux | grep "node.*index.js" | grep -v grep | awk '{print $2, $6" MB"}' | head
```

### 5.3 限流规则

**若扩容后仍受限，启动限流** (Caddy 层 / 应用层)：

```bash
ssh root@47.242.80.65

# 检查当前限流规则
grep -A 5 "rate_limit" /etc/caddy/Caddyfile

# 若无限流，添加
cat >> /etc/caddy/Caddyfile << 'EOF'
# 限流规则（Caddy）
(rate_limit) {
  rate 100/s              # 全局: 100 req/s
  rate 10/s @expensive    # 昂贵操作: 10 req/s
}
EOF

sudo systemctl reload caddy
```

**应用层限流检查**：
```bash
# 查后端是否已实现限流中间件
grep -r "rateLimit" /opt/shenyuan/server --include="*.js" | head -3

# 检查配置阈值
grep -r "limit.*req\|threshold" /opt/shenyuan/server/.env | head -5
# 应输出类似: RATE_LIMIT_REQ=1000, RATE_LIMIT_WINDOW=60s
```

### 5.4 预警阈值

**实时监控指标**（应在仪表板配置）：

| 指标 | 黄色警告 | 红色告警 | 响应 |
|------|---------|---------|------|
| QPS | 500 | 1000+ | 启用限流 + 扩容 |
| CPU | 70% | 85%+ | 扩容 + 启用备机 |
| 内存 | 75% | 90%+ | 检查泄漏 + 重启 |
| 响应时间 | 1s | 5s+ | 启用缓存 + 限流 |
| 错误率 | 1% | 5%+ | 回滚 + 查日志 |

**设置告警**（Sentry/UptimeRobot）：
```bash
ssh root@47.242.80.65

# 查现有告警规则
grep -r "alert\|threshold" /opt/shenyuan/server --include="*.js" | grep -i "rate\|cpu\|memory"

# 若未配置，添加到 index.js
cat >> /opt/shenyuan/server/index.js << 'EOF'
// 流量告警中间件
app.use((req, res, next) => {
  const now = Date.now();
  if (!global.metrics) {
    global.metrics = { requests: 0, start: now };
  }
  global.metrics.requests++;
  
  const elapsed = (now - global.metrics.start) / 1000;
  const qps = global.metrics.requests / elapsed;
  
  if (qps > 1000) {
    console.error('[ALERT] High QPS:', qps);
    // 发送告警（钉钉/飞书）
  }
  next();
});
EOF

pm2 restart shenyuan-api
```

### 5.5 缓存策略（降低后端压力）

**启用 Redis 缓存**（若已安装）:
```bash
# 查是否已启用 Redis
ssh root@47.242.80.65
ps aux | grep redis  # 应返回 redis-server

# 若未启用，检查是否已安装
redis-cli ping  # 应返回 "PONG"

# 若未安装，快速装 Redis
apt-get install redis-server
systemctl start redis-server

# 配置后端使用 Redis
echo "REDIS_URL=redis://localhost:6379" >> /opt/shenyuan/server/.env
pm2 restart shenyuan-api
pm2 logs shenyuan-api | grep -i redis  # 确认连接
```

**缓存热点数据**：
```bash
# 预热常访问的数据（商品列表、大师列表、热词等）
ssh root@47.242.80.65
node << 'EOF'
const redis = require('redis');
const client = redis.createClient({ url: process.env.REDIS_URL });

client.connect().then(() => {
  // 缓存商品列表 (30min)
  client.setEx('products:all', 1800, JSON.stringify([
    { id: 'bazi-report', name: '八字命盘', price: 99 },
    // ...
  ]));
  
  // 缓存热门大师 (1h)
  client.setEx('masters:trending', 3600, JSON.stringify([
    // ...
  ]));
  
  console.log('Cache warmed');
  process.exit(0);
}).catch(e => {
  console.error('Redis fail:', e);
  process.exit(1);
});
EOF
```

### 5.6 验证恢复

```bash
# ✅ 确认扩容成功
ps aux | grep "node.*index.js" | grep -v grep | wc -l
# 应 ≥4

# ✅ 确认 QPS 恢复正常
for i in {1..100}; do curl -s http://47.242.80.65/api/products > /dev/null & done
pm2 logs shenyuan-api | grep QPS | tail -3
# 应显示 QPS 恢复到 <500

# ✅ 确认响应时间 <500ms
time curl -s http://47.242.80.65/api/products > /dev/null
# real: <0.5s

# ✅ 确认缓存工作
curl -s "http://47.242.80.65/api/products?from_cache=true" | jq '.cache_hit'
# 应返回 true
```

---

## 🔧 15 个一键修复命令

### 支付相关
```bash
# 1. 修复：支付端点不响应
ssh root@47.242.80.65 && pm2 restart shenyuan-api && sleep 5 && curl -s http://47.242.80.65/api/health | jq '.'

# 2. 修复：微信支付密钥缺失
ssh root@47.242.80.65 && echo "WECHAT_APP_ID=PASTE_HERE" >> /opt/shenyuan/server/.env && pm2 restart shenyuan-api

# 3. 修复：支付宝回调 404
ssh root@47.242.80.65 && grep -r "alipay/notify" /opt/shenyuan/server && pm2 logs shenyuan-api --lines 50 | grep "alipay"

# 4. 补偿：手动入账失败订单
ssh root@47.242.80.65 && cd /opt/shenyuan && node scripts/compensate-payment.js --order_id=sy_20260808_xxx

# 5. 恢复：重置支付 webhook
ssh root@47.242.80.65 && curl -X POST http://47.242.80.65/api/admin/reset-webhooks
```

### 服务可用性
```bash
# 6. 修复：服务频繁重启
ssh root@47.242.80.65 && pm2 logs shenyuan-api --err | tail -50 && pm2 status

# 7. 修复：内存泄漏（需重启）
ssh root@47.242.80.65 && pm2 restart shenyuan-api --force && ps aux | grep node | head -1

# 8. 修复：PM2 损坏
ssh root@47.242.80.65 && pm2 kill && sleep 2 && pm2 start npm --name "shenyuan-api" -- start

# 9. 修复：Caddy 反代失效
ssh root@47.242.80.65 && sudo systemctl reload caddy && curl -I http://47.242.80.65/api/health

# 10. 启用集群模式应对流量
ssh root@47.242.80.65 && pm2 delete shenyuan-api && pm2 start /opt/shenyuan/server/index.js --name "shenyuan-api" --instances max && pm2 save
```

### 数据恢复
```bash
# 11. 恢复：数据损坏（从 Git）
ssh root@47.242.80.65 && git -C /opt/shenyuan checkout server/data.json && pm2 restart shenyuan-api

# 12. 恢复：从最近备份还原
ssh root@47.242.80.65 && cp /opt/shenyuan/.backups/data-latest.json /opt/shenyuan/server/data.json && pm2 restart shenyuan-api

# 13. 修复：邀请链接无效
ssh root@47.242.80.65 && curl -X POST http://47.242.80.65/api/admin/regenerate-invites

# 14. 修复：用户数据不一致
ssh root@47.242.80.65 && cd /opt/shenyuan && node scripts/verify-data-integrity.js --fix

# 15. 热修复：生产环境代码补丁
ssh root@47.242.80.65 && cd /opt/shenyuan && git pull origin main && pm2 restart shenyuan-api && pm2 logs shenyuan-api | head -20
```

---

## 📊 责任人分工表

### 角色定义与权限

| 角色 | 名称 | 事件权限 | 紧急权力 | 通知权限 |
|------|------|---------|---------|---------|
| **DevOps Lead** | Karen / 代理 | P0/P1 完全访问 + SSH | 隔离服务器、回滚代码 | 立即通知 CMO/CFO |
| **Payment Eng** | [待指派] | P1 支付相关 | 手动入账补偿 | 通知财务 |
| **Security** | [待指派] | P0 数据泄露 | 撤销密钥、隔离网络 | 通知法务 + 用户 |
| **Backend** | [待指派] | P1/P2 代码修复 | 紧急上线补丁 | 通知 DevOps |
| **Frontend** | [待指派] | P2 UI 相关 | 显示维护页面 | 通知 DevOps |
| **CMO/Content** | [待指派] | P0 公关声明 | 发公告 + 用户通知 | 通知所有部门 |

### 在班表（UTC+8）

```
工作时间: 09:00 - 23:00 HKT (UTC+8)
备班时间: 23:00 - 09:00 HKT

主班 (09:00-17:00):
  - DevOps: [NAME]
  - Backend: [NAME]
  - Frontend: [NAME]

晚班 (17:00-23:00):
  - DevOps: [NAME]
  - On-call Support: [NAME]

夜班 (23:00-09:00, 无常驻):
  - 依赖 UptimeRobot 告警 → 电话通知 on-call
  - 预期响应: 10min 内接到电话
```

### 升级路径

**P0 事件 (如同时影响多个模块)：**
```
发现人 (工程师)
    ↓
DevOps Lead (确认 & 隔离)
    ↓
技术负责人 (Karen/指定代理)
    ↓
CMO/CFO (用户通知 & 公关)
```

**P1 事件 (单模块，<5min 恢复期望)：**
```
发现人 (工程师)
    ↓
模块负责人 (Payment / Backend / Frontend)
    ↓
DevOps Lead (需要时参与基建)
    ↓
CMO (若影响用户体验)
```

**P2 事件 (非关键路径)：**
```
发现人 (工程师)
    ↓
模块负责人 (当日完成修复)
    ↓
事故报告 (记录 + 复盘)
```

### 联系方式

| 场景 | 首选 | 备选 | 超时 |
|------|------|------|------|
| 紧急支付故障 | Slack #incident-alert | 电话通知 | 5min |
| 数据泄露/安全 | 电话 + Slack @security | 飞书紧急消息 | 2min |
| 流量暴增 | Slack + 自动扩容 | 电话确认 | 3min |
| 普通 bug | Slack #backend + issue | GitHub Issue | 24h |

**关键号码** (存储在密钥管理)：
```bash
ssh root@47.242.80.65 && cat ~/.emergency_contacts.txt
# Karen (DevOps Lead): +852-XXXX-XXXX
# 财务/客服: +852-XXXX-XXXX
# 微信商户支持: 4006008888
# 支付宝商户支持: 95188
```

---

## 📋 事故报告模板

**用途**：每次 P0/P1 事件后的复盘 & 知识库沉淀

**时间**：事件恢复后 24h 内完成

**位置**：`/opt/shenyuan/docs/incidents/[YYYY-MM-DD]-[event-type].md`

```markdown
# 事故报告: [简述]

## 基本信息
- **报告人**: [姓名]
- **事件时间**: [YYYY-MM-DD HH:MM UTC]
- **发现时间**: [YYYY-MM-DD HH:MM UTC]
- **恢复时间**: [YYYY-MM-DD HH:MM UTC]
- **总持续时间**: [X 分钟]
- **严重级别**: [P0/P1/P2]
- **用户影响范围**: [NNN 用户 / NNN 交易]

## 事件描述
[用户看到了什么？如何发现的？]

## 根因分析
[为什么发生？]

## 时间线 (分钟精度)
- T+0:00 - [事件发生]
- T+2:30 - [告警触发]
- T+5:45 - [修复完成]

## 采取的措施
1. [隔离 / 重启 / 回滚 / ...]
2. [...]

## 验证恢复
- [x] 服务正常响应
- [x] 数据完整性确认
- [x] 用户可正常访问

## 根本原因
[深层分析，防止重复]

## 后续改进
- [ ] 实施 [改进项] (所有权: [人], 期限: [日期])
- [ ] ...

## 相关资源
- Git 提交: [hash]
- Sentry 链接: [URL]
- 日志存档: /opt/shenyuan/logs/incident-[timestamp].log
```

---

## ✅ 上线前自检清单

**部署新版本前必过**（防止事故扩大）：

```bash
ssh root@47.242.80.65

# 1. 数据备份
cp /opt/shenyuan/server/data.json /opt/shenyuan/.backups/data-precommit-$(date +%s).json

# 2. 语法检查
cd /opt/shenyuan && npm run lint --if-present

# 3. 单元测试
npm test 2>&1 | tail -20

# 4. 热部署（先在 staging 验证）
git -C /opt/shenyuan checkout develop
npm install --production
pm2 restart shenyuan-api
pm2 logs shenyuan-api | head -50 | grep -i "error\|warn"

# 5. 冒烟测试
for endpoint in "/api/health" "/api/products" "/api/admin/health"; do
  echo "Testing $endpoint..."
  curl -s "http://47.242.80.65$endpoint" | jq '.status' || echo "FAILED"
done

# 6. 性能检查
time curl -s http://47.242.80.65/api/health > /dev/null
# 应 <500ms

# 7. 日志检查
pm2 logs shenyuan-api --err | wc -l
# 应 = 0 (无错误)

# 若全部通过，才合并到 main 并生产部署
git -C /opt/shenyuan checkout main && git merge develop
```

---

## 🎯 总结

本手册覆盖善缘最高频的 5 大投放风险。核心原则：

1. **快速识别** - 用症状表快速定位
2. **自动恢复** - PM2 + systemd 自动处理 >80% 故障
3. **手动干预** - 明确的一键命令 + 权限划分
4. **验证恢复** - 每步都有验证检查点
5. **事后总结** - 记录 + 复盘，防止重复

**维护者**: Karen (DevOps Lead)  
**最后更新**: 2026-08-08  
**下次审查**: 2026-09-08

---

**附录**：[服务器基建文档](./DEPLOY.md) | [监控配置](./ANALYTICS-TRACKING-SETUP.md) | [最佳实践](./BEST-PRACTICES.md)
