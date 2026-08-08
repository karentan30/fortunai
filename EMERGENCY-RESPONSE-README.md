# 🚨 善缘 ShenYuan 投放突发事件应急手册

**完整文档套件 v1.0** | 2026-08-08

---

## 📦 文档清单

本应急手册包含 **4 份文档 + 1 个命令脚本**：

### 1️⃣ **EMERGENCY-INCIDENT-HANDBOOK.md** (27KB)
**核心应急手册** — 详细的全流程应对指南

**内容**：
- 5 大风险事件的症状、排查、恢复步骤
- 自动恢复流程说明（PM2/systemd 双层守护）
- 手动干预命令（4-5 个步骤）
- 验证恢复检查点
- 事后处理与补偿方案
- 监控告警配置
- 缓存、限流、扩容策略

**用途**：
- **第一次遇到** 某类事件时，完整查阅本文档
- **深度理解** 每个故障的根本原因
- **学习** 恢复流程与验证方法

**查阅场景**：
```
💼 支付失败? → Section 1 支付失败 (P1)
🔴 服务宕机? → Section 2 服务宕机 (P0)
🔗 链接失效? → Section 3 邀请链接失效 (P2)
🔐 数据泄露? → Section 4 数据泄露 (P0)
📈 流量暴增? → Section 5 流量暴涨宕机 (P0)
```

---

### 2️⃣ **EMERGENCY-CHECKLIST-PRINTABLE.txt** (14KB)
**可打印的快速检查清单** — 现场操作指南

**特点**：
- ☐ 清单格式，逐步确认
- 📋 可直接打印贴在工位
- ⏱️ 每个步骤都标注预期时间
- 🔗 命令可直接粘贴到终端
- 📱 纯文本格式，手机也能查看

**用途**：
- **第一时间** 快速定位问题（5 分钟内）
- **现场作业** 边对照清单边执行修复
- **新人培训** 帮助新工程师快速上手

**示例流程**：
```
症状确认 (1 min)
  ↓
快速诊断 (5 min)
  ↓
快速修复 (5-10 min)
  ↓
验证恢复 (2 min)
  ↓
事后处理 (10 min)
```

---

### 3️⃣ **QUICK-FIX-COMMANDS.sh** (21KB)
**15 个一键修复命令脚本** — 自动化工具

**功能**：
```bash
# 支付相关 (1-5)
bash QUICK-FIX-COMMANDS.sh 1   # 修复支付端点不响应
bash QUICK-FIX-COMMANDS.sh 2   # 修复微信密钥缺失
bash QUICK-FIX-COMMANDS.sh 3   # 修复支付宝回调 404
bash QUICK-FIX-COMMANDS.sh 4   # 补偿失败订单
bash QUICK-FIX-COMMANDS.sh 5   # 重置支付 webhook

# 服务可用性 (6-10)
bash QUICK-FIX-COMMANDS.sh 6   # 修复服务频繁重启
bash QUICK-FIX-COMMANDS.sh 7   # 修复内存泄漏
bash QUICK-FIX-COMMANDS.sh 8   # 修复 PM2 损坏
bash QUICK-FIX-COMMANDS.sh 9   # 修复 Caddy 反代
bash QUICK-FIX-COMMANDS.sh 10  # 启用集群模式

# 数据恢复 (11-15)
bash QUICK-FIX-COMMANDS.sh 11  # 从 Git 恢复数据
bash QUICK-FIX-COMMANDS.sh 12  # 从备份恢复数据
bash QUICK-FIX-COMMANDS.sh 13  # 重新生成邀请码
bash QUICK-FIX-COMMANDS.sh 14  # 修复数据不一致
bash QUICK-FIX-COMMANDS.sh 15  # 热修复代码补丁
```

**特点**：
- ✅ 自动 SSH 到生产服务器
- ✅ 内置确认提示（防止误操作）
- ✅ 一键执行 5-15 分钟的修复步骤
- ✅ 自动验证恢复状态
- ✅ 输出颜色化，易于阅读

**用法**：
```bash
# 查看帮助
bash QUICK-FIX-COMMANDS.sh help

# 执行命令 1
bash QUICK-FIX-COMMANDS.sh 1

# 或复制单个命令粘贴到终端
ssh root@47.242.80.65
pm2 restart shenyuan-api
```

---

### 4️⃣ **INCIDENT-RESPONSIBILITY-MATRIX.md** (14KB)
**责任人矩阵与流程文档** — 组织与授权

**内容**：
- 📋 角色定义与权限表
- 🎯 事件类型 × 责任人矩阵（支付/宕机/泄露等）
- ⏰ 在班人员表（HK 时间）
- 🔀 升级决策树（P0/P1/P2 流程）
- 🔐 权限审计与密钥轮换计划
- 📝 事故报告模板
- 💬 沟通模板（Slack/邮件）
- ✋ 假期 / 离职交接清单

**用途**：
- **明确分工** — 知道谁负责什么
- **权限管理** — 知道谁有什么权限
- **流程规范** — 知道事件如何升级
- **交接培训** — 新人上手的完整检查清单

**关键矩阵示例**：
```
事件类型  | 发现人 | 主责人         | 预期恢复 | 需通知
---------|-------|------|----------|------
支付失败  | 用户  | Payment Eng   | 15 min  | CFO
服务宕机  | 监控  | DevOps Lead   | 10 min  | CMO
邀请失效  | 产品  | Backend Eng   | 30 min  | -
数据泄露  | 监控  | Security + DevOps | 5 min | 法务
流量暴增  | 监控  | DevOps Lead   | 5 min   | -
```

---

## 🎯 快速导航

### 我应该用哪份文档？

| 场景 | 推荐文档 | 用法 |
|------|---------|------|
| 🔥 **现在就要修复** (紧急) | CHECKLIST 或 QUICK-FIX | 1️⃣ 打开对应清单 → 2️⃣ 逐步执行 |
| 📚 **想全面了解** | HANDBOOK | 1️⃣ 读 Section 对应的事件 → 2️⃣ 理解原理 |
| ❓ **不知道谁负责** | RESPONSIBILITY MATRIX | 查 Section 2-4 矩阵表 |
| 🤖 **想用自动化命令** | QUICK-FIX-COMMANDS.sh | `bash QUICK-FIX-COMMANDS.sh [1-15]` |
| 📋 **打印带现场** | CHECKLIST-PRINTABLE.txt | 打印 + 贴工位 |

### 5 大风险速查表

```
┌─────────────────────────────────────────────────────────────┐
│ 风险 1: 支付失败 (P1)              预期修复: 5-15 min       │
│ ├─ 症状: 用户充不了值 / 订单未入账                          │
│ ├─ 快速修复: QUICK-FIX-COMMANDS.sh 1-5                     │
│ └─ 详细: HANDBOOK Section 1 + CHECKLIST Section 1          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 风险 2: 服务宕机 (P0)              预期修复: 2-10 min       │
│ ├─ 症状: 网站打不开 / 502 错误                              │
│ ├─ 自动恢复: PM2 + systemd (无需手工干预)                    │
│ ├─ 快速修复: QUICK-FIX-COMMANDS.sh 6-10                    │
│ └─ 详细: HANDBOOK Section 2 + CHECKLIST Section 2          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 风险 3: 邀请链接失效 (P2)          预期修复: 5-30 min       │
│ ├─ 症状: 邀请码无法建立配对 / 404 错误                      │
│ ├─ 快速修复: QUICK-FIX-COMMANDS.sh 13                      │
│ └─ 详细: HANDBOOK Section 3 + CHECKLIST Section 3          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 风险 4: 数据泄露 (P0) ⚠️ 最严重!  预期响应: <5 min         │
│ ├─ 症状: 敏感文件在公网可见 / 用户邮箱泄露                  │
│ ├─ 立即行动: 隔离服务器 + 通知 CMO/CFO + 重置密钥           │
│ ├─ 快速修复: QUICK-FIX-COMMANDS.sh (无一键命令，需人工)     │
│ └─ 详细: HANDBOOK Section 4 + CHECKLIST Section 4 + 法务   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 风险 5: 流量暴增宕机 (P0)          预期修复: 1-5 min        │
│ ├─ 症状: QPS >1000 / 响应时间 >5s / CPU >90%                │
│ ├─ 自动恢复: PM2 cluster 自动扩容 + 限流                    │
│ ├─ 快速修复: QUICK-FIX-COMMANDS.sh 10                      │
│ └─ 详细: HANDBOOK Section 5 + CHECKLIST Section 5          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 使用示例

### 场景 1: 支付端点返回 5xx 错误

**时间: T+0:00**
```bash
# 第 1 步：打开 CHECKLIST，找"支付失败"
# 第 2 步：按清单逐步执行（预期 5 分钟定位）

# 或直接用一键命令：
bash QUICK-FIX-COMMANDS.sh 1  # 自动检查 + 重启 + 验证
```

**若 5 分钟后仍未恢复**
```bash
# 打开 HANDBOOK Section 1
# 查看更深层的排查步骤（支付密钥检查 / API 测试 / 第三方平台检查）

# 可能需要手工执行：
ssh root@47.242.80.65
cat /opt/shenyuan/server/.env | grep WECHAT_
curl -X POST "http://47.242.80.65/api/create-checkout" ...
```

---

### 场景 2: 网站 502，流量一下子暴涨

**时间: T+0:00**
```bash
# 症状识别：
# · 用户报告"打不开"
# · PostHog 显示 QPS >1000
# · CPU 占用 >90%

# 预期恢复过程：
# 1. PM2 cluster 自动 fork 多进程 (自动 2 min 内完成)
# 2. 确认扩容是否生效：
ps aux | grep "node.*index.js" | wc -l  # 应该 ≥4 个进程

# 若仍未恢复，启用限流：
bash QUICK-FIX-COMMANDS.sh 10
```

**验证恢复**
```bash
# 查看 QPS 是否恢复正常
time curl -s http://47.242.80.65/api/health  # 应该 <500ms

# 发送 Slack 通知给 CMO（可选）
# "流量暴增已处理，服务恢复正常 ✅"
```

---

### 场景 3: 数据泄露（最严重！）

**时间: T+0:00 - 立即行动，无延迟**

```bash
# ⚠️ 这是 P0 最高级别事件，激活应急流程

# 第 1 步：隔离服务器（2 min）
ssh root@47.242.80.65
sudo iptables -A OUTPUT -j DROP  # 断掉出站连接，防止黑客继续渗透

# 第 2 步：通知紧急小组（电话）
# · Karen (DevOps Lead)
# · CMO/CFO
# · 法务

# 第 3 步：保存审计日志（2 min）
mkdir -p /tmp/incident_$(date +%s)
pm2 logs shenyuan-api --lines 10000 > /tmp/incident_*/api.log
git -C /opt/shenyuan log --all --oneline > /tmp/incident_*/git.log
tar czf /tmp/incident.tar.gz /tmp/incident_*

# 第 4 步：重置所有密钥（3 min）
nano /opt/shenyuan/server/.env
# 手工修改所有 KEY/SECRET (WECHAT_API_KEY / ALIPAY_PRIVATE_KEY / JWT_SECRET)

# 第 5 步：恢复干净备份（2 min）
cp /opt/shenyuan/.backups/data-preincident.json /opt/shenyuan/server/data.json
pm2 restart shenyuan-api

# 详细步骤见：HANDBOOK Section 4 或 CHECKLIST Section 4
```

**总耗时：5-10 分钟隔离 + 24h 后续处理**

---

## 📖 文档如何维护？

### 季度更新 (每 3 个月)

```bash
# 1. 汇总这 3 个月的所有 P0/P1 事件
# 2. 从事故报告中提取新经验、新命令
# 3. 更新对应 Section 的排查步骤
# 4. 新增/删除过时的命令
# 5. 更新人员联系方式、on-call 值班表
# 6. git commit "docs: quarterly update [date]"
```

### 发生事件后 (立即)

```bash
# 1. 按模板生成事故报告：/opt/shenyuan/docs/incidents/[YYYY-MM-DD]-[type].md
# 2. 记录新发现的问题、新的修复手段
# 3. 若发现文档缺陷，立即补充 + git push
# 4. 下次同类事件时参考本次报告
```

---

## 🔒 密钥存储位置

⚠️ **不要把密钥放在代码里！**

敏感信息已存储在：
- `~/.ssh/` — SSH 私钥
- `~/.config/karen-api-keys.env` — API 密钥（本地）
- 密钥管理服务（阿里云 / 1Password 等）— 生产密钥
- `.env` 文件（生产服务器本地）— 运行时读取

**查看时需要**：
1. SSH 权限 (仅 Karen/DevOps Lead)
2. 密钥管理服务权限 (需 CFO 批准)
3. 审计日志记录所有查看操作

---

## 📞 紧急联系方式

| 角色 | 名字 | 电话 | Slack | 邮箱 |
|------|------|------|-------|------|
| DevOps Lead | Karen | +852-XXXX-XXXX | @karen | karen@... |
| Backend Eng | [NAME] | +852-XXXX-XXXX | @[name] | ... |
| Payment Eng | [NAME] | +852-XXXX-XXXX | @[name] | ... |
| CMO | [NAME] | +852-XXXX-XXXX | @cmo | ... |
| CFO | [NAME] | +852-XXXX-XXXX | @cfo | ... |

**第三方支持电话**：
- 微信商户: 4006008888 (工作时间)
- 支付宝: 95188 (7x24)
- 阿里云 HK: +86-400-606-5500

---

## ✅ 完整性检查清单

在使用这套文档之前，确保：

```
☐ 1. 所有 4 份文档都已在项目目录下
     ├─ EMERGENCY-INCIDENT-HANDBOOK.md (27KB)
     ├─ EMERGENCY-CHECKLIST-PRINTABLE.txt (14KB)
     ├─ INCIDENT-RESPONSIBILITY-MATRIX.md (14KB)
     └─ QUICK-FIX-COMMANDS.sh (21KB)

☐ 2. QUICK-FIX-COMMANDS.sh 已设置执行权限
     chmod +x QUICK-FIX-COMMANDS.sh

☐ 3. 所有团队成员都已读此文档（本 README）

☐ 4. 每个工程师都清楚自己的角色 (见 MATRIX Section 1)

☐ 5. 联系方式已更新到最新 (见 MATRIX Section 6)

☐ 6. 关键数字已备在本地：
     ├─ SSH 私钥: ~/.ssh/id_rsa
     ├─ 服务器: 47.242.80.65
     ├─ 服务路径: /opt/shenyuan
     └─ PM2 app: shenyuan-api

☐ 7. 文档已打印或加入 Slack 置顶

☐ 8. 新人已完成一轮 on-call 值班（学习用）
```

---

## 📊 文档统计

| 文档 | 大小 | 行数 | 主要内容 |
|------|------|------|---------|
| HANDBOOK | 27KB | 800+ | 详细排查 + 恢复流程 |
| CHECKLIST | 14KB | 400+ | 逐步清单 + 可打印 |
| MATRIX | 14KB | 350+ | 责任分工 + 权限 |
| QUICK-FIX | 21KB | 600+ | 15 个自动化命令 |
| **总计** | **76KB** | **2150+** | 完整应急套件 |

---

## 🎓 新人培训路径

### 第 1 天
```
1. 阅读本 README (15 min)
2. 阅读 INCIDENT-RESPONSIBILITY-MATRIX Section 1 (15 min)
3. 了解自己的角色和权限 (10 min)
总耗时: 40 min
```

### 第 2 天
```
1. 阅读 HANDBOOK (1 小时，了解全景)
2. 阅读对应角色的 CHECKLIST section (30 min)
3. 学习对应的 QUICK-FIX 命令 (30 min)
总耗时: 2 小时
```

### 第 3 天
```
1. 参加一次模拟演练 (30 min)
2. 学习事故报告模板 (15 min)
3. 准备好应急时用的工具 (15 min)
总耗时: 1 小时
```

### 第 4 天+
```
1. 参加实际 on-call 值班
2. 与老工程师配对
3. 处理真实事件，学习完整流程
```

---

## 🔄 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|---------|
| v1.0 | 2026-08-08 | 初版发布，覆盖 5 大风险 + 15 命令 |
| v1.1 | TBD | 第一次季度更新（基于实际事件反馈） |

---

## 📞 反馈与更新

如果在使用中发现：
- ❌ 命令不工作
- 🔍 文档缺漏
- 💡 可以改进的地方
- 📈 新发现的风险

**请**：
1. 在 GitHub Issue 记录 (标签 `#incident` `#docs`)
2. Slack @Karen 紧急通知 (若是关键问题)
3. 等待下次季度更新纳入

---

**文档维护者**: Karen (DevOps Lead)  
**最后更新**: 2026-08-08  
**下次审查**: 2026-11-08

**相关文档**: [部署指南](./DEPLOY.md) | [最佳实践](./BEST-PRACTICES.md) | [持续优化](./CONTINUOUS-OPTIMIZATION.md)

---

🎯 **记住：快速识别 → 隔离问题 → 自动恢复 → 验证 → 事后总结**

**预祝事件尽快解决！** 💪
