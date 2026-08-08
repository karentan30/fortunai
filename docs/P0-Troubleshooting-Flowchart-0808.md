# P0操作失败排查决策树 · 快速诊断指南

> 当遇到问题时，从"症状"开始，按照流程图找到"解决方案"

---

## 症状 ① : 网页无法打开 / 404 / 网络超时

```
遇到 404 / "网站无法访问" / "连接超时"?
│
├─→ 【检查URL】
│   │
│   ├─→ URL包含 "localhost"?
│   │   └─→ ❌ 改用生产URL：https://shenyuan.mylumee.cn/pages/bazi.html
│   │
│   ├─→ URL拼写错误? 如 /bazi 而不是 /pages/bazi
│   │   └─→ ❌ 改正URL重试
│   │
│   └─→ URL正确但仍然404?
│       └─→ 【检查后端】
│
├─→ 【检查后端是否在线】
│   │
│   │   运行命令：curl https://shenyuan.mylumee.cn/api/health
│   │
│   ├─→ 返回 {"status":"ok"}?
│   │   └─→ ✅ 后端正常，问题可能是浏览器缓存
│   │      → 清除缓存（Ctrl+Shift+Delete）
│   │      → 用无痕窗口重试
│   │
│   ├─→ 返回 "Connection refused" / "502 Bad Gateway"?
│   │   └─→ ❌ 后端宕机
│   │      → SSH登录：ssh root@47.242.80.65
│   │      → 查看状态：pm2 status shenyuan
│   │      → 如果显示"stopped"：pm2 start shenyuan
│   │      → 等待30秒后重试
│   │
│   └─→ 返回其他错误?
│       └─→ ❌ 收集错误信息，找Claude
│
└─→ 【信号】① 可能的原因 ② 后续排查
    解决步骤不工作 → 立即升报 Claude + 截图
```

---

## 症状 ② : P0-1 "找不到待填字段" / 文件已填但网页还是显示旧内容

```
搜索 [待填] 找不到 OR 网页看到旧内容?
│
├─→ 【检查你编辑的是否是正确文件】
│   │
│   │   文件路径应该是：/Users/karen/projects/shenyuan/legal-CN.html
│   │   NOT：/Users/karen/projects/shenyuan/.claude/worktrees/xxx/legal-CN.html
│   │
│   ├─→ 用find确认：find ~/projects/shenyuan -name "legal-CN.html" -type f
│   │
│   └─→ 如果有多个文件，编辑最新修改时间的那个
│       → 用 ls -ltr ~/projects/shenyuan/legal-CN.html 查看
│
├─→ 【检查内容是否真的保存】
│   │
│   ├─→ 用cat验证本地文件：cat ~/projects/shenyuan/legal-CN.html | grep "商业登记号"
│   │
│   ├─→ 看到你填的值 (如 BR12345678)?
│   │   └─→ ✅ 本地正确，问题是SCP上传失败
│   │      → 重新上传：scp legal-CN.html root@47.242.80.65:/opt/shenyuan/
│   │      → 验证服务器文件：ssh root@47.242.80.65; cat /opt/shenyuan/legal-CN.html | grep "商业"
│   │
│   └─→ 还是看到 [待填]?
│       └─→ ❌ 你编辑的可能是错文件
│          → 关闭所有编辑器
│          → 重新打开 /Users/karen/projects/shenyuan/legal-CN.html (确认路径!)
│          → 再编辑一次
│
├─→ 【检查浏览器缓存】
│   │
│   │   如果文件已更新，网页还显示旧内容
│   │
│   ├─→ 用硬刷新：Ctrl+Shift+R (Windows) 或 Cmd+Shift+R (Mac)
│   ├─→ 或清除缓存：Ctrl+Shift+Delete
│   └─→ 或用无痕窗口打开
│
└─→ 【信号】文件本地正确 & 已SCP上传 → ✅ P0-1完成
```

---

## 症状 ③ : P0-2 支付一直卡着 / 无法跳转到Stripe / 支付后看不到报告

```
支付页面卡顿 / 无反应 / 看不到Stripe弹窗?
│
├─→ 【检查网络连接】
│   │
│   ├─→ 手机能打开其他网站吗? (如 google.com)
│   │   └─→ ❌ 无→修复手机网络
│   │   └─→ ✅ 有→网络没问题
│   │
│   └─→ 再试一遍，看是否是临时卡顿 (等30秒)
│
├─→ 【打开浏览器开发者工具检查错误】
│   │
│   │   按 F12 → 选择 Console 标签
│   │
│   ├─→ 看到红色错误信息?
│   │   └─→ 【分析错误信息】
│   │      ├─→ 如果包含 "CORS" / "cross-origin"?
│   │      │   └─→ ❌ 后端CORS配置问题
│   │      │      → 告诉Claude具体错误信息
│   │      │
│   │      ├─→ 如果包含 "404" / "payment"?
│   │      │   └─→ ❌ 支付路由未配置
│   │      │      → 检查 /server/routes/payment.js 是否存在
│   │      │
│   │      ├─→ 如果包含 "stripe" / "sk_" ?
│   │      │   └─→ ❌ Stripe密钥未配置或错误
│   │      │      → 检查：ssh root@47.242.80.65; echo $STRIPE_PAY_SECRET_KEY
│   │      │
│   │      └─→ 其他错误?
│   │          └─→ ❌ 截图错误信息，给Claude分析
│   │
│   └─→ 没有红色错误，只是卡着?
│       └─→ 【查看Network标签】
│          ├─→ 看到请求发出去了吗? (看 /api/create-checkout 这个请求)
│          ├─→ 如果请求Pending (黄色)超过10秒
│          │   └─→ ❌ 后端响应太慢或无响应
│          │      → 检查后端：curl https://shenyuan.mylumee.cn/api/health
│          │      → 检查日志：pm2 logs shenyuan --lines 50
│          │
│          └─→ 如果请求失败 (红色 ❌)
│              └─→ ❌ 服务器断开或无权限
│                 → 检查防火墙/权限
│
├─→ 【支付成功但看不到报告】
│   │
│   ├─→ 刷新页面 (Ctrl+F5 / Cmd+Shift+R)
│   ├─→ 等待5秒（可能在更新用户权限）
│   ├─→ 退出登录，重新登录
│   │
│   └─→ 还是看不到?
│       └─→ ❌ 数据库未更新支付状态
│          → 检查后端日志：pm2 logs shenyuan | grep "payment_status"
│          → 告诉Claude订单号，手动更新
│
└─→ 【信号】支付页显示 ✅ 完成 → P0-2完成
```

---

## 症状 ④ : P0-3 Stripe Webhook显示Failed / 显示没有webhook

```
Webhook状态显示 ❌ Failed OR 完全看不到endpoint?
│
├─→ 【没有webhook记录】
│   │
│   ├─→ 这是Stripe Dashboard的第一次设置?
│   │   └─→ ✅ 正常，需要手动创建
│   │      步骤：
│   │      1. Developers → Webhooks → Add endpoint
│   │      2. URL：https://shenyuan.mylumee.cn/api/stripe-webhook
│   │      3. Events：勾选以下6个
│   │         ✓ checkout.session.completed
│   │         ✓ checkout.session.expired
│   │         ✓ customer.subscription.created
│   │         ✓ invoice.payment_succeeded
│   │         ✓ invoice.payment_failed
│   │         ✓ customer.subscription.deleted
│   │      4. 创建
│   │      5. 复制 Signing secret → 更新服务器 .env
│   │
│   └─→ 之前有webhook，现在消失了?
│       └─→ ❌ 可能被误删或过期
│          → 重新创建一遍 (上面的步骤)
│
├─→ 【Webhook显示Failed】
│   │
│   ├─→ 【第一步：检查服务器是否在线】
│   │   │
│   │   │   curl https://shenyuan.mylumee.cn/api/health
│   │   │
│   │   ├─→ 收到 {"status":"ok"}?
│   │   │   └─→ ✅ 服务器在线
│   │   │
│   │   └─→ 返回 "Connection refused" / 504?
│   │       └─→ ❌ 服务器宕机或离线
│   │          → 检查后端：ssh root@47.242.80.65
│   │          → 查状态：pm2 status shenyuan
│   │          → 如果 stopped：pm2 start shenyuan
│   │          → 等30秒后测试
│   │
│   ├─→ 【第二步：检查Webhook URL是否正确】
│   │   │
│   │   │   Stripe Dashboard 中的 URL 应该是：
│   │   │   https://shenyuan.mylumee.cn/api/stripe-webhook
│   │   │
│   │   ├─→ URL 写错了? (如 /webhook 而不是 /stripe-webhook)
│   │   │   └─→ ❌ 删除这个错的 endpoint
│   │   │      → 创建新的，URL一定要 /stripe-webhook
│   │   │
│   │   └─→ URL 正确?
│   │       └─→ 【检查服务器防火墙】
│   │          → Stripe IP是否被防火墙阻止?
│   │          → 检查：iptables -L (Linux) 或 pfctl -s rules (Mac)
│   │          → 如果有规则拦截，允许 Stripe IP 范围
│   │
│   ├─→ 【第三步：检查Signing Secret配置】
│   │   │
│   │   │   Stripe Dashboard: Webhooks → 你的endpoint → Signing secret
│   │   │
│   │   └─→ 复制这个 secret 到服务器：
│   │       ssh root@47.242.80.65
│   │       nano /opt/shenyuan/server/.env
│   │       # 找到或添加：STRIPE_WEBHOOK_SECRET=whsec_live_xxxxx
│   │       # 确保值一定要 whsec_live (生产) 不是 whsec_test
│   │       # Ctrl+X → Y → Enter 保存
│   │       # 然后 pm2 restart shenyuan
│   │
│   ├─→ 【第四步：检查后端webhook处理代码】
│   │   │
│   │   │   ❌ Failed 通常意味着后端返回了 400-500 错误
│   │   │
│   │   └─→ 查看错误日志：
│   │       ssh root@47.242.80.65
│   │       pm2 logs shenyuan --lines 100 | grep -i "webhook\|error"
│   │       # 找到错误信息，截图给Claude分析
│   │
│   └─→ 【第五步：重新发送测试事件】
│       │
│       │   在 Stripe Dashboard webhook 详情页
│       │   找 "Send test event" 按钮
│       │
│       └─→ 点击 → 选择 "checkout.session.completed" → Send
│           观察结果是否变为 ✅ Sent
│           同时检查后端日志看是否有新日志
│
└─→ 【信号】Webhook显示 ✅ Sent & 后端日志有"WEBHOOK" → P0-3完成
```

---

## 症状 ⑤ : 其他异常 / 数据库错误 / 502错误

```
看到 500 / 502 / 503 / 数据库错误 / "Internal Server Error"?
│
├─→ 【检查后端是否正常启动】
│   │
│   │   ssh root@47.242.80.65
│   │   pm2 status shenyuan
│   │
│   ├─→ 显示 "online" / "running"?
│   │   └─→ ✅ 进程在线，但可能发生了运行时错误
│   │      → 查看日志：pm2 logs shenyuan --lines 50
│   │      → 找到红色错误信息，截图给Claude
│   │
│   └─→ 显示 "stopped" / "errored"?
│       └─→ ❌ 进程崩溃了
│          → 查看崩溃原因：pm2 logs shenyuan --err --lines 30
│          → 尝试重启：pm2 restart shenyuan
│          → 等待30秒后重试
│          → 如果还是失败，告诉Claude完整的错误日志
│
├─→ 【检查磁盘空间】
│   │
│   │   df -h
│   │
│   ├─→ 如果某个分区显示 100% / 99%?
│   │   └─→ ❌ 磁盘满了
│   │      → 清理：pm2 flush (清日志)
│   │      → 或删除旧的备份文件
│   │
│   └─→ 都在 50% 以下?
│       └─→ ✅ 磁盘没问题
│
├─→ 【检查数据库连接】
│   │
│   │   pm2 logs shenyuan | grep -i "sqlite\|database\|db"
│   │
│   ├─→ 看到 "cannot read database" / "locked"?
│   │   └─→ ❌ SQLite被锁定或文件损坏
│   │      → 尝试修复：sqlite3 /opt/shenyuan/database.db "PRAGMA integrity_check;"
│   │      → 如果输出 "ok" 则数据库没问题
│   │      → 如果输出错误，备份后重建数据库
│   │
│   └─→ 没有数据库相关错误?
│       └─→ 【其他原因】
│          → 收集完整的错误日志
│          → 截图 + 日志内容给Claude分析
│
└─→ 【信号】无法自行解决 → 立即给Claude完整日志 + 问题截图
    不要反复重试，浪费时间
```

---

## 快速判断：问题严重程度

```
🟢 绿色 (可自己解决)
├─ 网页404 → 检查URL
├─ 支付卡顿 → 刷新/清缓存
├─ 浏览器错误 → 用无痕窗口试
└─ Webhook显示Failed → 检查服务器在线状态

🟡 黄色 (可能需要Claude帮助)
├─ 后端返回500错误 → 查看日志
├─ 支付成功但数据未保存 → 检查webhook是否处理
├─ Stripe密钥配置 → 验证环境变量
└─ 浏览器控制台有 CORS/跨域错误 → 后端配置问题

🔴 红色 (立即升报Claude)
├─ 后端完全宕机，无法启动
├─ 数据库文件损坏
├─ 多个功能同时崩溃
├─ 无法理解的错误信息
└─ 多次尝试仍未解决
```

---

## 决策树底部：行动清单

### 如果问题在"🟢绿色"范围内
```
✅ 自己按照上面流程图修复
✅ 修复后重新测试
✅ 如果工作了，记录步骤以防下次
```

### 如果问题在"🟡黄色"范围内
```
1️⃣ 按照流程图诊断尽可能多的信息
2️⃣ 收集以下信息：
   - 完整的错误信息 (截图或复制)
   - pm2 日志最后30行
   - curl 命令的返回结果
   - 你尝试过什么
3️⃣ 发送给Claude，描述：
   "尝试过XXX，现在看到YYY错误，预期应该是ZZZ"
```

### 如果问题在"🔴红色"范围内
```
1️⃣ STOP - 不要再尝试修复
2️⃣ 立即收集：
   - pm2 logs shenyuan --lines 100
   - curl https://shenyuan.mylumee.cn/api/health (的完整错误)
   - ls -la /opt/shenyuan/ (查看文件状态)
   - 清晰的截图（标注问题位置）
3️⃣ 发送给Claude + 你已经尝试过什么
4️⃣ 等待Claude回复（通常 < 15分钟）
```

---

## 终极大招：完全重置 (仅在Claude建议时使用!)

```bash
⚠️  这会删除所有本地改动，仅在无法修复时用

ssh root@47.242.80.65

# 停止服务
pm2 stop shenyuan

# 回滚到上一个稳定版本
cd /opt/shenyuan
git log --oneline | head -5  # 查看最近提交
git reset --hard <commit_id>  # 用上一个好的版本号

# 重新安装依赖
npm install

# 重启
pm2 start shenyuan

# 验证
curl https://shenyuan.mylumee.cn/api/health
```

---

**如果这个决策树没能解决你的问题**  
→ 你已经尽力了  
→ 该是给Claude的时候了  
→ 提供决策树中收集的所有信息  
→ Claude 2分钟内会有方案

