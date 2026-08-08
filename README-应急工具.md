# 善缘应急工具包 - 快速开始指南

**最后更新**: 2026-08-08 | **文件位置**: /Users/karen/projects/shenyuan/

---

## 📦 生成的4个工具文件

所有工具已生成并可立即使用：

### 1️⃣ EMERGENCY-RESPONSE.md (8.5 KB)
**快速参考 SOP** — 5大风险的谁处理/怎么处理/预计时间

**用途**: 发生事件时的第一查询  
**内容**: 
- 5大风险速查表（支付失败/服务宕机/邀请失效/数据泄露/流量暴增）
- 每个风险的快速修复流程
- 响应时间 SLA
- 关键电话联系方式

**快速使用**:
```
事件发生时 → 打开本文件 → 找到对应症状 → 按流程执行
```

---

### 2️⃣ quick-fixes.sh (15 KB) ⭐ 最常用
**15个一键修复命令** — 自动化修复脚本

**用途**: 现场一键执行常见修复  
**内容**:
```bash
# 支付相关
bash quick-fixes.sh 1   # 重启支付服务
bash quick-fixes.sh 2   # 检查微信密钥
bash quick-fixes.sh 3   # 修复支付宝 webhook
bash quick-fixes.sh 4   # 补偿失败订单
bash quick-fixes.sh 5   # 重置 webhook

# 服务可用性
bash quick-fixes.sh 6   # 重启服务
bash quick-fixes.sh 7   # 修复内存泄漏
bash quick-fixes.sh 8   # 修复 PM2 损坏
bash quick-fixes.sh 9   # 修复 Caddy 反代
bash quick-fixes.sh 10  # 启用限流保护

# 数据恢复
bash quick-fixes.sh 11  # 从 Git 恢复
bash quick-fixes.sh 12  # 从备份恢复
bash quick-fixes.sh 13  # 重新生成邀请码
bash quick-fixes.sh 14  # 修复数据不一致
bash quick-fixes.sh 15  # 热修复代码补丁
```

**特点**:
- ✅ 自动 SSH 到生产服务器
- ✅ 执行前需确认（防误操作）
- ✅ 自动验证恢复状态
- ✅ 彩色输出，易阅读

**快速使用**:
```bash
bash quick-fixes.sh help      # 查看帮助
bash quick-fixes.sh 1         # 修复支付服务
bash quick-fixes.sh [1-15]    # 执行对应命令
```

---

### 3️⃣ incident-checklist.md (11 KB)
**事件管理完整清单** — 从发现到事后总结

**用途**: 规范化处理任何事件  
**内容**:
- 阶段 0: 预防（日常）
- 阶段 1: 发现 (T+0:00) — 症状识别、快速诊断、通知
- 阶段 2: 隔离与修复 (T+0:05-0:25) — 选择快速修复命令
- 阶段 3: 验证恢复 (T+0:25-0:30) — 功能测试、回归测试
- 阶段 4: 事后处理 (T+0:30-1:00) — 事故报告、补偿、知识库更新

**快速使用**:
```
事件发生 → 按阶段打开清单 → 逐项勾选 → 事后填事故报告
```

---

### 4️⃣ health-check-dashboard.html (27 KB)
**服务器健康检查看板** — 可视化监控界面

**用途**: 实时观察系统状态  
**内容**:
- 🌐 服务状态（API/数据库/缓存）
- 💾 内存占用、CPU占用、磁盘使用
- 📊 API 性能（响应时间、QPS、错误率）
- 🔒 安全检查（HTTPS、证书有效期、密钥）
- 📦 服务详情（PID、内存、连接数）
- 📜 实时日志
- ⚙️ 快速操作按钮

**快速使用**:
```
1. 在浏览器打开: file:///Users/karen/projects/shenyuan/health-check-dashboard.html
   或: 复制到生产服务器，通过 Web 访问

2. 观察指示器颜色:
   ✅ 绿色 = 正常
   ⚠️  黄色 = 轻微异常
   ❌ 红色 = 严重错误

3. 点击快速操作按钮执行修复
```

---

## 🚀 现场应急工作流 (5-30 分钟)

### 场景 1: 用户反馈支付失败

**T+0:00 — 发现**
```bash
# 打开快速参考
cat EMERGENCY-RESPONSE.md | grep "支付失败" -A 20
```

**T+0:05 — 快速修复**
```bash
bash quick-fixes.sh 1   # 重启支付服务
bash quick-fixes.sh 2   # 检查密钥
bash quick-fixes.sh 5   # 重置 webhook
```

**T+0:20 — 验证**
```bash
# 测试新订单
curl -X POST http://47.242.80.65/api/create-checkout \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test", "amount": 0.01}'
```

**T+0:30 — 事后**
```bash
# 填写事故报告
nano /opt/shenyuan/docs/incidents/2026-08-08-payment-failure.md

# 补偿失败订单
bash quick-fixes.sh 4
```

---

### 场景 2: 网站返回 502 错误

**T+0:00 — 发现**
```bash
# 运行诊断
bash /opt/shenyuan/health-check.sh
```

**T+0:02 — 快速修复**
```bash
bash quick-fixes.sh 6   # 重启服务
bash quick-fixes.sh 10  # 启用限流（若流量暴增）
```

**T+0:10 — 验证**
```bash
curl http://47.242.80.65/api/health
pm2 status
```

---

### 场景 3: 磁盘满或内存泄漏

**T+0:00 — 发现**
```bash
# 打开看板
open health-check-dashboard.html
# 或 SSH 查看
ssh root@47.242.80.65 "free -h && df -h"
```

**T+0:05 — 快速修复**
```bash
bash quick-fixes.sh 7   # 修复内存泄漏 + 增加 swap
```

**T+0:15 — 验证**
```bash
ssh root@47.242.80.65 "free -h && df -h"
```

---

## 📋 关键命令速查

```bash
# 实时监控
pm2 monit

# 查看日志
pm2 logs shenyuan-api --lines 100

# SSH 到服务器
ssh root@47.242.80.65

# 健康检查
bash /opt/shenyuan/health-check.sh

# 快速修复
bash /opt/shenyuan/quick-fixes.sh [1-15]

# 一键诊断所有
bash /opt/shenyuan/quick-fixes.sh help
```

---

## ✅ 快速检查清单（上线前）

```
☐ 已将 4 个文件复制到生产服务器
  scp /Users/karen/projects/shenyuan/EMERGENCY-RESPONSE.md root@47.242.80.65:/opt/shenyuan/
  scp /Users/karen/projects/shenyuan/quick-fixes.sh root@47.242.80.65:/opt/shenyuan/
  scp /Users/karen/projects/shenyuan/incident-checklist.md root@47.242.80.65:/opt/shenyuan/
  scp /Users/karen/projects/shenyuan/health-check-dashboard.html root@47.242.80.65:/opt/shenyuan/

☐ 已测试 quick-fixes.sh 脚本
  bash quick-fixes.sh help

☐ 已在服务器验证脚本可用
  ssh root@47.242.80.65 "bash /opt/shenyuan/quick-fixes.sh help"

☐ 已收藏 EMERGENCY-RESPONSE.md 的快捷链接
  或打印出来贴在工位

☐ 所有工程师都知道这些工具的位置

☐ 团队联系方式已更新（见 EMERGENCY-RESPONSE.md 底部）

☐ 已配置 PM2 + systemd 自动守护

☐ 已配置数据库每 6h 备份

☐ 已配置日志轮换（避免磁盘爆满）
```

---

## 📞 紧急联系方式

| 角色 | 名字 | 电话 | Slack |
|------|------|------|-------|
| DevOps Lead | Karen | +852-XXXX-XXXX | @karen |
| Payment Eng | [NAME] | +852-XXXX-XXXX | @[name] |
| Backend Eng | [NAME] | +852-XXXX-XXXX | @[name] |
| CFO | [NAME] | +852-XXXX-XXXX | @cfo |
| CMO | [NAME] | +852-XXXX-XXXX | @cmo |

**第三方支持**:
- 微信商户: 4006008888 (工作时间)
- 支付宝: 95188 (7x24)
- 阿里云 HK: +86-400-606-5500

---

## 🔗 文件位置映射

```
本机开发环境:
  /Users/karen/projects/shenyuan/EMERGENCY-RESPONSE.md
  /Users/karen/projects/shenyuan/quick-fixes.sh
  /Users/karen/projects/shenyuan/incident-checklist.md
  /Users/karen/projects/shenyuan/health-check-dashboard.html

生产服务器 (47.242.80.65):
  /opt/shenyuan/EMERGENCY-RESPONSE.md
  /opt/shenyuan/quick-fixes.sh
  /opt/shenyuan/incident-checklist.md
  /opt/shenyuan/health-check-dashboard.html
```

---

## 📚 与现有文档的关系

本工具包**补充**现有的详细文档：

```
现有完整应急文档:
├─ EMERGENCY-INCIDENT-HANDBOOK.md (27KB) — 深度排查指南
├─ EMERGENCY-CHECKLIST-PRINTABLE.txt (14KB) — 可打印版
├─ INCIDENT-RESPONSIBILITY-MATRIX.md (14KB) — 责任分工
└─ QUICK-FIX-COMMANDS.sh (旧版 21KB)

新增精简工具包:
├─ EMERGENCY-RESPONSE.md (8.5KB) ⭐ 快速查询，发现时首先
├─ quick-fixes.sh (15KB) ⭐ 改进的自动化脚本
├─ incident-checklist.md (11KB) ⭐ 流程化清单
└─ health-check-dashboard.html (27KB) ⭐ 实时可视化
```

**使用建议**:
- **快速参考** → EMERGENCY-RESPONSE.md + quick-fixes.sh
- **深度理解** → EMERGENCY-INCIDENT-HANDBOOK.md
- **流程规范** → incident-checklist.md
- **实时监控** → health-check-dashboard.html

---

## 🎯 成功标志

✅ **安装成功的标志**:
```bash
# 在服务器执行，应该能看到 4 个文件
ls -lh /opt/shenyuan/{EMERGENCY-RESPONSE,quick-fixes.sh,incident-checklist,health-check-dashboard.html}

# 脚本可执行
bash /opt/shenyuan/quick-fixes.sh help
```

❌ **如果看不到这些**:
```
1. 确认文件是否复制到服务器
2. 检查文件权限 (应该是 -rw-r--r-- 或 -rwxr-xr-x)
3. 确认服务器路径是 /opt/shenyuan (不是其他)
```

---

## 📖 学习路径（新人）

### 第 1 天 (30 min)
1. 阅读本文件 (README-应急工具.md) — 15 min
2. 阅读 EMERGENCY-RESPONSE.md — 15 min

### 第 2 天 (1 小时)
1. 测试所有 quick-fixes.sh 命令 — 30 min
2. 了解 incident-checklist 流程 — 30 min

### 第 3 天 (30 min)
1. 打开 health-check-dashboard.html 体验 — 15 min
2. 学习如何读日志和告警 — 15 min

### 第 4+ 天
1. 参加 on-call 值班
2. 处理真实事件，熟能生巧

---

## 💾 备份与版本管理

本工具包已在 Git 中版本控制：

```bash
git add EMERGENCY-RESPONSE.md quick-fixes.sh incident-checklist.md health-check-dashboard.html README-应急工具.md
git commit -m "docs: 生成应急工具包 v1.0 (4 文件)"
git push
```

**季度更新计划**:
- 每 3 个月汇总事件反馈
- 更新命令和流程
- 新增/删除过时工具

---

## 🤝 反馈与改进

如果发现：
- ❌ 命令不工作
- 🔍 文档缺漏
- 💡 可以改进的地方
- 📈 新发现的风险

**请**:
1. 在 GitHub Issue 记录 (标签 `#incident` `#tools`)
2. Slack @Karen 紧急通知 (若影响生产)
3. 下次季度更新纳入

---

**工具包生成日期**: 2026-08-08  
**维护者**: Claude Code  
**生产验证**: 待 Karen 确认  

**🎯 记住**: 快速识别 → 隔离问题 → 自动恢复 → 验证 → 事后总结

**祝应急顺利！** 💪
