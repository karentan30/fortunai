# 善缘投放启动前24小时 - 最终检查清单

**项目**: 善缘 ShenYuan 灵性平台  
**日期**: 2026-08-09  
**时间**: 08:00-14:00 HKT  
**目标**: 完成所有关键检查，确保投放安全启动

---

## 打印版检查表

### 使用说明
- ✅ 打印本清单（最好3份：Karen/Claude/DevOps各一份）
- 📝 逐项检查完毕后勾选方框
- 🔴 任何`红线`项失败立刻停止，不继续投放
- ✋ 完成所有项后需要三方签名才能投放

---

## 【第一部分】数据备份检查

| 检查项 | 内容 | 状态 | 备注 |
|------|------|------|------|
| **1.1** | `data.json` 存在于服务器 `/opt/shenyuan/data.json` | ☐ | 🔴红线项 |
| **1.2** | 最新备份文件存在 `data.json.bak-*` | ☐ | 至少1个备份 |
| **1.3** | 备份文件大小 > 100KB (非空) | ☐ | 验证备份有效 |
| **1.4** | 数据库连接字符串已验证 | ☐ | `.env` 已检查 |
| **1.5** | 每小时自动备份脚本已启用 | ☐ | `crontab -l` 检查 |

**验证命令**:
```bash
ssh root@47.242.80.65
ls -lah /opt/shenyuan/data.json*
# 应该看到: data.json (20+KB) + data.json.bak-*
```

**失败情景**:
- ❌ 文件不存在 → 立刻恢复备份
- ❌ 文件为空 → 检查最后一次成功备份时间
- ❌ 脚本未启用 → 运行 `./setup-backup.sh`

---

## 【第二部分】环境变量验证

| 检查项 | 配置名 | 状态 | 优先级 |
|------|------|------|------|
| **2.1** | `STRIPE_SECRET_KEY` | ☐ | 🔴必需 |
| **2.2** | `STRIPE_PUBLISHABLE_KEY` | ☐ | 🔴必需 |
| **2.3** | `DEEPSEEK_API_KEY` | ☐ | 🟠重要 |
| **2.4** | `ADMIN_TOKEN` (管理后台) | ☐ | 🟠重要 |
| **2.5** | `ALIPAY_MERCHANT_ID` (支付宝) | ☐ | 🟡可选 |
| **2.6** | `WECHAT_MERCHANT_ID` (微信) | ☐ | 🟡可选 |
| **2.7** | `JWT_SECRET` | ☐ | 🔴必需 |
| **2.8** | `DOMAIN` (当前域名) | ☐ | 🔴必需 |

**验证命令**:
```bash
# 登录服务器
ssh root@47.242.80.65

# 检查环境变量是否已设置
cat /opt/shenyuan/.env | grep -E "STRIPE|DEEPSEEK|ADMIN_TOKEN|JWT_SECRET"

# 验证关键值（不暴露完整secret）
echo "✓ STRIPE_SECRET_KEY=" $(echo $STRIPE_SECRET_KEY | cut -c1-10)...
```

**红线检查**:
```bash
# 所有关键环境变量都应该有值
env | grep -E "^(STRIPE_|DEEPSEEK_|ADMIN_|JWT_|DOMAIN)" | wc -l
# 应该 >= 8
```

**失败恢复**:
- 重新编辑 `/opt/shenyuan/.env`
- 运行 `pm2 restart shenyuan --update-env`
- 等待30秒后检查

---

## 【第三部分】服务启动验证

| 检查项 | 预期结果 | 状态 | 记录 |
|------|--------|------|------|
| **3.1** | PM2进程列表显示 `shenyuan` online | ☐ | 🔴红线 |
| **3.2** | 进程CPU使用率 < 30% | ☐ | - |
| **3.3** | 进程内存使用率 < 200MB | ☐ | - |
| **3.4** | 进程运行时间 > 60秒 (已稳定) | ☐ | - |
| **3.5** | `/api/health` 返回 HTTP 200 | ☐ | 🔴红线 |
| **3.6** | 健康检查JSON包含 `"status":"ok"` | ☐ | 🔴红线 |
| **3.7** | `"stripe":"connected"` 显示连接成功 | ☐ | 🟠重要 |
| **3.8** | `"llm":"deepseek"` 显示就绪 | ☐ | 🟠重要 |

**验证脚本** (复制到终端):
```bash
#!/bin/bash
echo "=== PM2 进程检查 ==="
ssh root@47.242.80.65 "pm2 list"

echo -e "\n=== 健康检查 ==="
ssh root@47.242.80.65 "curl -s http://localhost:3021/api/health | jq ."

echo -e "\n=== 最近错误 ==="
ssh root@47.242.80.65 "pm2 logs shenyuan --lines 10 --err"

echo -e "\n=== 系统资源 ==="
ssh root@47.242.80.65 "free -h && df -h /opt"
```

**健康检查响应示例** (应该看到):
```json
{
  "status": "ok",
  "uptime": "2h 34m",
  "timestamp": "2026-08-09T06:15:23Z",
  "stripe": "connected",
  "llm": "deepseek",
  "database": "connected",
  "version": "2.0.0"
}
```

**常见问题排查**:

| 症状 | 原因 | 解决方案 |
|-----|------|--------|
| `offline` | 进程崩溃 | `pm2 restart shenyuan` |
| `error: ECONNREFUSED` | 端口被占用 | `lsof -i :3021` 杀死旧进程 |
| `"stripe":"disconnected"` | 密钥错误 | 重新检查 `STRIPE_SECRET_KEY` |
| `"database":"error"` | DB连接失败 | 检查 MongoDB/Supabase连接 |

---

## 【第四部分】代码部署验证

| 检查项 | 要求 | 状态 | 优先级 |
|------|------|------|------|
| **4.1** | 最新commit已推送到 `main` 分支 | ☐ | 🔴红线 |
| **4.2** | 没有未提交的本地更改 (clean working tree) | ☐ | 🔴红线 |
| **4.3** | 最新commit标签 >= `launch-*` | ☐ | 🟠重要 |
| **4.4** | 代码在服务器 `/opt/shenyuan` 是最新版本 | ☐ | 🔴红线 |
| **4.5** | `server/index.js` 已部署 | ☐ | 🔴红线 |
| **4.6** | `pages/bazi-*.html` 已部署 (CN/EN/KR) | ☐ | 🔴红线 |
| **4.7** | `legal-*.html` 合规页已部署 | ☐ | 🔴红线 |
| **4.8** | 所有依赖已安装 (`npm install` 成功) | ☐ | 🟠重要 |

**验证命令** (本地执行):
```bash
# 检查本地git状态
git status
# 应该显示: On branch main, nothing to commit, working tree clean

# 查看最近的commit
git log --oneline -5

# 检查标签
git tag | grep launch | tail -3

# 推送最新commit
git push origin main
```

**服务器验证**:
```bash
ssh root@47.242.80.65 "cd /opt/shenyuan && \
  echo '=== Git状态 ===' && \
  git log --oneline -1 && \
  echo '=== 前端文件 ===' && \
  ls -lah pages/bazi*.html && \
  echo '=== 合规页 ===' && \
  ls -lah legal*.html && \
  echo '=== 后端检查 ===' && \
  ls -lah server/index.js"
```

**失败恢复**:
1. 本地: `git add . && git commit -m "feat: 投放前最后更新"` → `git push`
2. 服务器: `cd /opt/shenyuan && git pull origin main`
3. 重启: `pm2 restart shenyuan`

---

## 【第五部分】支付路由测试 (三语言)

> 🔴 **这是最关键的段落** - 必须三语言都通过

### 测试前准备
- 📱 准备一台手机(iPhone或Android)
- 🌐 WiFi或4G网络
- 💳 准备测试支付卡（Stripe测试卡：4242 4242 4242 4242）

### 测试流程

#### 【测试5.1】中文版本 (CN) - 微信支付路线

```
步骤1: 打开页面
  [ ] 手机浏览器 → https://shenyuan.mylumee.cn/pages/bazi.html
  [ ] 页面加载完成 (应该显示中文界面)
  [ ] 看到"生辰八字命盘" 标题

步骤2: 输入测试数据
  [ ] 出生年: 1990
  [ ] 出生月: 5
  [ ] 出生日: 15
  [ ] 出生时: 03:47
  [ ] 点击 "生成命盘" 按钮

步骤3: 验证免费预览
  [ ] 看到 "四柱": 庚午 辛卯 丁亥 丁寅
  [ ] 看到 "五行分析": 金1 木2 水2 火2
  [ ] 看到 "今年运势": 3-4行文字预测
  [ ] 下方出现 "查看完整报告 ¥9.9 →" 按钮

步骤4: 点击支付按钮
  [ ] 点击 "查看完整报告 ¥9.9 →" 
  [ ] 弹窗出现支付方式选择 (2秒内)
  [ ] 显示选项:
       ☐ 微信支付 (¥9.90)
       ☐ Stripe信用卡 ($9.90)
       ☐ Google Pay / Apple Pay

步骤5: 完成支付 (选择微信支付)
  [ ] 点击 "微信支付"
  [ ] 出现二维码或确认界面
  [ ] 用另一台手机/电脑扫二维码
  [ ] 在微信app中确认支付 (输入密码或Face ID)
  [ ] 点击 "确认支付"

步骤6: 验证支付成功 ⭐ 最关键
  [ ] 页面自动跳转回 bazi.html
  [ ] 顶部不再显示 "查看完整报告" 按钮
  [ ] 显示 "完整命盘" 标题
  [ ] 看到12维完整数据:
       ☐ 纳音五行 (数据表格)
       ☐ 十神分析
       ☐ 大运流年
       ☐ 财运详解
       ☐ 姻缘指数
       ☐ 性格剖析
       ☐ 事业分析
       ☐ 健康预测
       ☐ 克制关系
       ☐ 喜用五行
       ☐ 大运周期
       ☐ 流年预测
  [ ] 底部有 "分享命盘" 按钮
  [ ] 能点击分享按钮

失败排查:
  ❌ 页面不加载 → 清理浏览器缓存，刷新
  ❌ 数据不显示 → 检查服务器日志: pm2 logs shenyuan
  ❌ 支付弹窗不出现 → 检查STRIPE_PUBLISHABLE_KEY
  ❌ 支付失败 → 查看Stripe Dashboard错误信息
  ❌ 支付成功但不显示完整报告 → 检查webhook是否处理成功
```

**检查项总结 CN版本**:
| 环节 | 状态 | 记录时间 |
|-----|------|--------|
| 页面加载 | ☐ | - |
| 免费预览显示 | ☐ | - |
| 支付弹窗出现 | ☐ | - |
| 微信支付完成 | ☐ | - |
| 完整报告显示 | ☐ 🔴必需 | - |
| 分享按钮可用 | ☐ | - |

---

#### 【测试5.2】英文版本 (EN) - Stripe信用卡路线

```
步骤1: 打开页面
  [ ] 手机浏览器 → https://shenyuan.mylumee.cn/pages/bazi-en.html
  [ ] 或自动语言检测: https://shenyuan.mylumee.cn/ (选择English)
  [ ] 页面应该显示英文界面 "Your Destiny Bazi Chart"

步骤2: 输入测试数据 (英文界面)
  [ ] Birth Year: 1990
  [ ] Birth Month: 5
  [ ] Birth Day: 15
  [ ] Birth Hour: 03:47 AM
  [ ] 点击 "Generate Chart" 按钮

步骤3: 验证免费预览 (英文)
  [ ] 看到 "Four Pillars": Geng Wu, Xin Mao, Ding Hai, Ding Yin
  [ ] 看到 "Five Elements": Gold 1, Wood 2, Water 2, Fire 2
  [ ] 看到 "This Year's Fortune": 英文预测文本
  [ ] 出现 "View Full Report $9.90 →" 按钮

步骤4: 点击支付
  [ ] 点击 "View Full Report $9.90 →"
  [ ] 支付方式弹窗出现
  [ ] 显示 "Stripe Card" 选项

步骤5: 完成信用卡支付
  [ ] 点击 "Stripe Card"
  [ ] 输入测试卡信息:
       Card: 4242 4242 4242 4242
       Date: 12/25
       CVC: 123
       Name: Test User
  [ ] 点击 "Pay $9.90"

步骤6: 验证支付成功 ⭐ 最关键
  [ ] 页面回跳到 bazi-en.html
  [ ] 显示 "Full Destiny Chart" 标题
  [ ] 显示12维英文数据 (Five Elements, Ten Gods, etc.)
  [ ] "Share Chart" 按钮可用
```

**检查项总结 EN版本**:
| 环节 | 状态 | 记录时间 |
|-----|------|--------|
| 英文页面加载 | ☐ | - |
| 英文预览显示 | ☐ | - |
| Stripe弹窗 | ☐ | - |
| 信用卡支付成功 | ☐ 🔴必需 | - |
| 英文完整报告显示 | ☐ 🔴必需 | - |

---

#### 【测试5.3】韩文版本 (KR) - 支付宝/KakaoPay路线

```
步骤1: 访问韩文页面
  [ ] https://shenyuan.mylumee.cn/pages/saju-landing-KR.html
  [ ] 或IP检测韩国 → 自动跳转 사주 페이지
  [ ] 页面显示 "당신의 사주 명반" (您的四柱命盘)

步骤2: 输入测试数据
  [ ] 출생년: 1990
  [ ] 출생월: 5
  [ ] 출생일: 15
  [ ] 출생시: 03:47
  [ ] "명반 생성" (生成命盘) 按钮

步骤3: 验证免费预览
  [ ] 四주 (四柱) 显示
  [ ] 오행 (五行) 显示
  [ ] 올해 운세 (今年运势) 显示

步骤4: 支付流程
  [ ] 점 "전체 명반 보기 ₩10,000 →" (查看完整报告)
  [ ] 支付方式选择 (预计支持):
       ☐ Stripe Card (USD $9.90)
       ☐ 알리페이 (支付宝, 若已配置)
       ☐ KakaoPay (若已集成)

步骤5: 验证支付成功
  [ ] 完整報告顯示 (12維數據, 韓文)
  [ ] "명반 공유" (分享命盤) 按鈕可用
```

**检查项总结 KR版本**:
| 环节 | 状态 | 记录时间 |
|-----|------|--------|
| 韩文页面加载 | ☐ | - |
| 韩文预览显示 | ☐ | - |
| 支付方式弹窗 | ☐ | - |
| 支付完成 | ☐ 🔴必需 | - |
| 完整韩文报告显示 | ☐ 🔴必需 | - |

---

### 【测试5.4】支付路由总结表

| 语言 | URL | 货币 | 支付方式 | 状态 | 问题 |
|-----|-----|------|--------|------|------|
| **中文** | `/bazi.html` | ¥ | 微信+Stripe | ☐ | - |
| **英文** | `/bazi-en.html` | $ | Stripe+Apple Pay | ☐ | - |
| **韩文** | `/saju-landing-KR.html` | ₩ | Stripe+Alipay | ☐ | - |

**全部通过的标志**:
```
✅ 三个语言版本都能加载
✅ 三个版本都能显示免费预览
✅ 三个版本都能打开支付弹窗
✅ 三个支付完成后都能显示完整报告
✅ 没有浏览器错误或网络错误
```

---

## 【第六部分】邀请系统测试

| 检查项 | 要求 | 状态 | 优先级 |
|------|------|------|------|
| **6.1** | 邀请链接可以生成 (`/api/referral/generate`) | ☐ | 🔴红线 |
| **6.2** | 邀请链接格式正确 (包含referrer_id) | ☐ | 🔴红线 |
| **6.3** | 邀请链接可以分享 (复制/分享到微信) | ☐ | 🟠重要 |
| **6.4** | 被邀请者点击链接 → 追踪成功 | ☐ | 🔴红线 |
| **6.5** | 邀请人完成付费 → 返佣记录生成 | ☐ | 🔴红线 |
| **6.6** | 排行榜实时更新 (Top 10邀请人) | ☐ | 🟠重要 |
| **6.7** | 返佣金额计算正确 | ☐ | 🔴红线 |
| **6.8** | 邀请统计数据准确 (总邀请数/转化数) | ☐ | 🟠重要 |

**邀请系统测试流程**:

### Step 1: 生成邀请链接
```bash
# 用测试用户ID生成邀请链接
curl -X POST https://shenyuan.mylumee.cn/api/referral/generate \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_user_123","share_platform":"wechat"}'

# 预期响应:
{
  "success": true,
  "referral_url": "https://shenyuan.mylumee.cn/pages/bazi.html?ref=abc123def456",
  "referral_code": "abc123def456",
  "short_url": "https://shenyuan.win/r/abc123def456"  // 如果启用短链
}
```

**检查项**:
- [ ] HTTP 200 响应
- [ ] 包含 `referral_url` 和 `referral_code`
- [ ] URL格式有效且能分享

### Step 2: 用邀请链接访问页面
```bash
# 邀请人分享链接给朋友
https://shenyuan.mylumee.cn/pages/bazi.html?ref=abc123def456

# 新用户点击链接
[ ] 浏览器打开上述链接
[ ] 页面能正常加载
[ ] 浏览器console无错误
[ ] 跟踪像素已触发 (检查analytics)
```

**检查方法** (F12开发者工具):
```javascript
// 在浏览器console输入
console.log(window.__referral_tracking__)
// 应该输出: {referrer_id: "abc123def456", tracked: true, timestamp: "..."}
```

### Step 3: 被邀请者完成付费
```bash
[ ] 被邀请者在页面上输入生辰
[ ] 点击 "查看完整报告" 并完成支付
[ ] 支付成功跳转回页面
[ ] 后台记录了邀请关系
```

### Step 4: 验证返佣
```bash
# 检查返佣数据库记录
ssh root@47.242.80.65 "curl -X GET \
  'https://shenyuan.mylumee.cn/api/referral/stats?referrer_id=test_user_123' \
  -H 'Authorization: Bearer $ADMIN_TOKEN'"

# 预期响应:
{
  "referrer_id": "test_user_123",
  "total_referrals": 1,
  "successful_conversions": 1,
  "total_commission": 0.99,  // 10%返佣
  "currency": "CNY",
  "status": "pending"  // 未提现
}
```

**检查项总结 邀请系统**:
| 环节 | 状态 | 金额 | 记录 |
|-----|------|------|------|
| 邀请链接生成 | ☐ 🔴必需 | - | - |
| 链接追踪 | ☐ 🔴必需 | - | - |
| 转化记录 | ☐ 🔴必需 | ¥9.9 | - |
| 返佣计算 | ☐ 🔴必需 | ¥0.99 | - |
| 排行榜显示 | ☐ 🟠重要 | - | - |

---

## 【第七部分】日志监控启动

| 检查项 | 配置 | 状态 | 验证方式 |
|------|------|------|--------|
| **7.1** | PM2日志已启用 | ☐ | `pm2 logs` 可查看 |
| **7.2** | 日志按日期轮转 (daily rotate) | ☐ | `ls /opt/shenyuan/logs/` |
| **7.3** | 错误日志被记录 (error.log) | ☐ | `tail error.log` |
| **7.4** | 访问日志被记录 (access.log) | ☐ | `tail access.log` |
| **7.5** | Stripe webhook日志记录 | ☐ | 搜索 `webhook` 关键字 |
| **7.6** | 邀请系统日志记录 | ☐ | 搜索 `referral` 关键字 |
| **7.7** | 日志级别设置为 INFO (非DEBUG) | ☐ | `.env` 中 `LOG_LEVEL=info` |
| **7.8** | 日志文件大小限制 (防爆满) | ☐ | PM2 config中配置 |

**PM2日志配置验证**:
```bash
# 检查PM2生态文件配置
cat ecosystem.config.js | grep -A 5 "out_file\|error_file\|log_rotate"

# 应该显示:
# out_file: "logs/access.log",
# error_file: "logs/error.log",
# log_rotate: { max_size: "100M", retain: 10 }
```

**实时日志监控**:
```bash
# 登录服务器后，启动日志跟踪
ssh root@47.242.80.65
cd /opt/shenyuan

# 1. 查看最近的错误
tail -50 logs/error.log

# 2. 实时跟踪所有日志
pm2 logs shenyuan --lines 0 --err

# 3. 筛选特定关键字
pm2 logs shenyuan --lines 100 | grep "stripe\|webhook\|referral"

# 4. 检查日志大小
du -sh logs/
```

**投放期间的日志监控计划**:
```
【投放启动后24h内】
- 每小时检查一次 error.log
- 如看到超过3条相同错误 → 立刻调查
- Stripe webhook失败 → 最高优先级处理

【关键日志告警字符串】
ERROR
WARN
stripe.error
webhook.failed
payment.timeout
referral.failed
database.error
```

---

## 【第八部分】告警通知配置

| 告警渠道 | 配置状态 | 接收人 | 验证方式 |
|--------|--------|--------|--------|
| **8.1** | Slack通知已启用 | ☐ | 发送测试消息 |
| **8.2** | Slack频道: #shenyuan-alerts | ☐ | 检查channel权限 |
| **8.3** | 飞书(Feishu)通知已启用 | ☐ | 发送测试消息 |
| **8.4** | 飞书群组: 善缘运营 | ☐ | 检查webhook URL |
| **8.5** | 邮件告警已启用 | ☐ | 检查邮箱配置 |
| **8.6** | 邮件收件人: tan42204@gmail.com | ☐ | 测试发送邮件 |
| **8.7** | 错误级别告警 (ERROR+) | ☐ | 配置 log_level=ERROR |
| **8.8** | 性能告警 (响应时间>2s) | ☐ | 配置告警阈值 |

### 告警类型和优先级

```
【P0 - 立刻告警】(需要立即处理)
- 服务宕机 (HTTP 503)
- 支付失败 (Stripe webhook error)
- 数据库连接失败
- 致命错误日志出现

【P1 - 10分钟内处理】(需要人工检查)
- 错误率 > 5%
- 响应时间 > 5秒
- 邀请系统失败
- 日志磁盘空间不足

【P2 - 每小时检查】(可以延迟处理)
- 警告日志出现
- API调用超时 (但最后成功)
- 缓存命中率低
```

### Slack通知测试

```bash
# 发送测试通知到Slack
curl -X POST $SLACK_WEBHOOK_URL \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "🚀 善缘投放启动前测试 - 所有系统就绪",
    "attachments": [{
      "color": "good",
      "title": "投放检查清单",
      "fields": [
        {"title": "日期", "value": "2026-08-09", "short": true},
        {"title": "状态", "value": "✅ 就绪", "short": true}
      ]
    }]
  }'

# 应该在 Slack 中看到消息
```

### 飞书通知测试

```bash
# 发送测试通知到飞书
curl -X POST $FEISHU_WEBHOOK_URL \
  -H 'Content-Type: application/json' \
  -d '{
    "msg_type": "text",
    "content": {
      "text": "✅ 善缘投放启动前检查完成 - 所有系统就绪"
    }
  }'
```

**验证告警配置**:
```bash
# 检查告警脚本是否存在
ssh root@47.242.80.65 "ls -la /opt/shenyuan/scripts/alerts/"

# 检查crontab是否已配置告警检查任务
ssh root@47.242.80.65 "crontab -l | grep alert"
# 应该看到: */5 * * * * /opt/shenyuan/scripts/alerts/check-health.sh
```

---

## 【最终检查清单总结】

### 快速评分表 (0-100分)

```
【第一部分】数据备份       [  ]/10 分
【第二部分】环境变量       [  ]/10 分
【第三部分】服务启动       [  ]/15 分
【第四部分】代码部署       [  ]/15 分
【第五部分】支付路由       [  ]/25 分 ⭐ 最重要
【第六部分】邀请系统       [  ]/15 分
【第七部分】日志监控       [  ]/5 分
【第八部分】告警通知       [  ]/5 分
━━━━━━━━━━━━━━━━━━━━━
【总分】                 [  ]/100 分

投放绿灯要求: >= 90分，且所有🔴红线项都✅
```

---

## 【Sign-Off 签名页】

### Karen 操作确认

```
投放前操作完成情况:

☐ P0-1: 法律页已补全且已部署
☐ P0-2: 真机付费测试已通过 (三语言)
☐ P0-3: Stripe Webhook已验证

投放意愿确认:
☐ 确认所有检查项已通过
☐ 确认能承受第一周的日均8-12单交易量
☐ 确认已备好应急预案

签名: ________________    日期: ________________

备注:
```

---

### Claude 验证确认

```
技术验收清单:

☐ 第一部分: 数据备份 ✓ (已验证)
☐ 第二部分: 环境变量 ✓ (已验证)
☐ 第三部分: 服务启动 ✓ (已验证)
☐ 第四部分: 代码部署 ✓ (已验证)
☐ 第五部分: 支付路由 ✓ (已验证)
☐ 第六部分: 邀请系统 ✓ (已验证)
☐ 第七部分: 日志监控 ✓ (已启动)
☐ 第八部分: 告警通知 ✓ (已启动)

系统就绪评级: ☐ 绿灯 (Go) / ☐ 黄灯 (Caution) / ☐ 红灯 (Stop)

签名: ________________    日期: ________________

备注/已知问题:
```

---

### DevOps 就绪确认

```
基础设施检查:

☐ 服务器资源充足 (CPU<50%, 内存<70%, 磁盘>20%)
☐ PM2监控已启动
☐ 自动备份脚本已启用
☐ 监控告警已发送到所有渠道
☐ 应急回滚计划已准备好

可投放状态: ☐ 就绪 / ☐ 未就绪

签名: ________________    日期: ________________

备注:
```

---

## 【投放启动指令】

当所有三方都签署上述确认后，执行以下指令启动投放:

### 指令 1: 最后部署 (可选)
```bash
cd /Users/karen/projects/shenyuan
./deploy-complete.sh prod
```

### 指令 2: 激活监控
```bash
ssh root@47.242.80.65 "systemctl start shenyuan-monitor"
```

### 指令 3: 启动数据追踪
```bash
# 在Slack/飞书发送通知
curl -X POST $SLACK_WEBHOOK_URL -d '{
  "text": "🚀 投放启动 | 时间: 2026-08-09 14:00 HKT"
}'
```

### 指令 4: 第一条投放文案
> Karen在微信/小红书发送邀请链接:
```
嘿！我发现了一个神奇的八字命盘工具 ✨

生成你的专属命盘，了解今年运势 🌟
只需输入出生日期，瞬间秒生成

▶ 点这里查看你的命盘: [邀请链接]

邀请朋友，双方都有奖励!
```

---

## 【投放后的24h内检查清单】

投放启动后，需要持续监控:

### 每30分钟检查一次 (首4小时)
- [ ] API响应时间 < 2秒
- [ ] 错误日志无 P0 级别错误
- [ ] Stripe webhook 处理成功率 > 99%
- [ ] 没有用户投诉 (邮件/社群)

### 每1小时检查一次 (首24小时)
- [ ] DAU (日活) >= 10
- [ ] 付费转化 >= 1单
- [ ] 邀请参与率 > 0%
- [ ] 平均响应时间 < 1秒
- [ ] 磁盘空间消耗 < 100MB

### 关键指标追踪 (Dashboard)
```
实时KPI看板应该显示:
- 访问人数: ___
- 付费单数: ___
- 转化率: ___%
- 邀请参与: ___%
- 服务器状态: ☐ 正常
```

---

## 【应急热线】

如果投放中出现问题:

| 问题类型 | 联系方式 | 优先级 |
|--------|--------|------|
| 支付完全失败 | Claude 紧急修复 | 🔴 P0 |
| 服务宕机 | DevOps 重启 | 🔴 P0 |
| 数据丢失 | 恢复最近备份 | 🔴 P0 |
| 某语言支付不工作 | 回滚 + 修复 | 🟠 P1 |
| 邀请系统异常 | 检查数据库 | 🟠 P1 |
| 性能下降 | 检查日志 | 🟡 P2 |

---

**清单版本**: 1.0  
**最后更新**: 2026-08-08  
**有效期**: 2026-08-09 14:00 前  
**下一次更新**: 投放后72h

---

## 附录：快速参考卡

### 关键API端点
```
生成邀请链接:
  POST /api/referral/generate
  
邀请统计:
  GET /api/referral/stats?referrer_id=xxx
  
支付webhook:
  POST /api/webhooks/stripe
  
健康检查:
  GET /api/health
```

### 关键服务器路径
```
代码: /opt/shenyuan
数据: /opt/shenyuan/data.json
日志: /opt/shenyuan/logs/
备份: /opt/shenyuan/data.json.bak-*
```

### 紧急命令
```bash
# 查看服务状态
pm2 status

# 重启服务
pm2 restart shenyuan

# 查看错误
pm2 logs shenyuan --err

# 恢复备份
cp /opt/shenyuan/data.json.bak-latest /opt/shenyuan/data.json
pm2 restart shenyuan
```

---

**准备好了吗? Let's Go! 🚀**
