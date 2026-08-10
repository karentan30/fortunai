# 善缘数据备份与恢复标准操作程序 (SOP)
> Standard Operating Procedure for Backup & Recovery

**版本**: 1.0  
**最后更新**: 2026-08-10  
**维护者**: DevOps Team  
**紧急联系**: Karen (原始决策人)

---

## 📋 目录

1. [备份策略概述](#备份策略概述)
2. [备份文件规范](#备份文件规范)
3. [备份执行流程](#备份执行流程)
4. [恢复流程](#恢复流程)
5. [故障场景处理](#故障场景处理)
6. [验证检查清单](#验证检查清单)
7. [问题排查](#问题排查)

---

## 备份策略概述

### 备份目标 (RPO/RTO)

| 指标 | 目标值 | 说明 |
|-----|-------|------|
| **RPO** (Recovery Point Objective) | 6小时 | 最多丢失6小时数据 |
| **RTO** (Recovery Time Objective) | 10分钟 | 恢复需要10分钟内完成 |
| **备份频率** | 6小时 | 每6小时执行一次增量备份 |
| **全量备份** | 每天午夜 | 每天00:00执行全量备份 |
| **备份保留期** | 7天 | 保留最近7天的备份 |

### 备份类型

#### 1. 本地备份 (Local Backup)
```
位置: /opt/shenyuan/data.json.bak-YYYYMMDD-HHMMSS
频率: 每6小时
文件格式: JSON (纯文本)
保留数量: 最新7个备份
恢复难度: ⭐ 极简单 (5分钟)
```

**特点**:
- 快速恢复 (本地文件系统)
- 存储成本低
- 不依赖网络连接
- 仅适合本地故障恢复

#### 2. 跨域云备份 (远程备份) [可选]
```
位置: 阿里OSS / AWS S3 (待配置)
频率: 每天1次 (深夜)
文件格式: .tar.gz (压缩)
保留时间: 30天
恢复难度: ⭐⭐ 中等 (15分钟)
```

**特点**:
- 防止本地服务器故障
- 跨地域冗余
- 审计追踪完整
- 适合灾难恢复 (DR)

---

## 备份文件规范

### 文件命名规范

```
data.json.bak-YYYYMMDD-HHMMSS
         ↓
data.json.bak-20260810-143022
         ├─ 20260810: 日期 (年月日)
         ├─ 14: 小时 (24小时制)
         ├─ 30: 分钟
         └─ 22: 秒钟
```

**示例**:
```bash
data.json.bak-20260810-140000  # 今日14:00生成
data.json.bak-20260810-080000  # 今日08:00生成
data.json.bak-20260809-140000  # 昨日14:00生成
```

### 备份文件大小参考

| 数据量 | 文件大小 | 恢复时间 |
|-------|---------|---------|
| < 100K 用户 | 1-10 MB | < 1秒 |
| 100K-1M 用户 | 10-100 MB | 1-5秒 |
| 1M+ 用户 | 100+ MB | 5-10秒 |

**当前预期**: ~5-20 MB (善缘用户量50K-200K)

---

## 备份执行流程

### 自动备份 (推荐)

#### 1. 使用系统 Cron 定时备份

```bash
# 编辑crontab
crontab -e

# 添加备份任务
# 每6小时执行一次备份 (0点、6点、12点、18点)
0 */6 * * * /opt/shenyuan/scripts/backup-data.sh >> /opt/shenyuan/logs/backup.log 2>&1
```

#### 2. 备份脚本 (backup-data.sh)

```bash
#!/bin/bash
# 善缘数据备份脚本

set -e

# 配置
BACKUP_DIR="/opt/shenyuan"
DATA_FILE="$BACKUP_DIR/data.json"
BACKUP_FILE="$BACKUP_DIR/data.json.bak-$(date +%Y%m%d-%H%M%S)"
LOG_FILE="$BACKUP_DIR/logs/backup.log"
RETENTION_DAYS=7

# 创建日志目录
mkdir -p "$(dirname $LOG_FILE)"

# 记录备份开始
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始备份: $DATA_FILE" >> $LOG_FILE

# 检查源文件
if [ ! -f "$DATA_FILE" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ 错误: 数据文件不存在" >> $LOG_FILE
  exit 1
fi

# 执行备份
cp "$DATA_FILE" "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  FILE_SIZE=$(du -h "$BACKUP_FILE" | awk '{print $1}')
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ 备份成功: $BACKUP_FILE (大小: $FILE_SIZE)" >> $LOG_FILE
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ 备份失败" >> $LOG_FILE
  exit 1
fi

# 清理旧备份 (保留7天)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 清理 $RETENTION_DAYS 天前的备份..." >> $LOG_FILE
find "$BACKUP_DIR" -name "data.json.bak-*" -mtime +$RETENTION_DAYS -delete

# 统计当前备份数
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/data.json.bak-* 2>/dev/null | wc -l)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 当前备份数: $BACKUP_COUNT" >> $LOG_FILE

# 向告警系统报告 (可选)
# curl -s -X POST http://localhost:3007/alert/backup \
#   -H "Content-Type: application/json" \
#   -d '{"status": "success", "size": "$FILE_SIZE", "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' || true

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 备份流程完成" >> $LOG_FILE
```

#### 3. 使用 PM2 定时任务 (替代方案)

```javascript
// server/tasks/backup-scheduler.js

const fs = require('fs');
const path = require('path');
const CronJob = require('cron').CronJob;

class BackupScheduler {
  constructor() {
    this.backupDir = '/opt/shenyuan';
    this.dataFile = path.join(this.backupDir, 'data.json');
    this.retentionDays = 7;
  }

  start() {
    // 每6小时执行备份 (0点、6点、12点、18点)
    const job = new CronJob('0 */6 * * *', () => {
      this.executeBackup();
    });

    job.start();
    console.log('[BackupScheduler] 定时备份已启动 (每6小时)');
  }

  async executeBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const backupFile = path.join(this.backupDir, `data.json.bak-${timestamp}`);

      // 复制文件
      fs.copyFileSync(this.dataFile, backupFile);
      const stats = fs.statSync(backupFile);

      console.log(`[Backup] ✅ 备份成功: ${path.basename(backupFile)} (${(stats.size / 1024).toFixed(2)} KB)`);

      // 清理旧备份
      this.cleanupOldBackups();

      // 向告警系统报告
      await this.reportBackupStatus('success', stats.size);

    } catch (error) {
      console.error(`[Backup] ❌ 备份失败: ${error.message}`);
      await this.reportBackupStatus('failure', 0, error.message);
    }
  }

  cleanupOldBackups() {
    const files = fs.readdirSync(this.backupDir)
      .filter(f => f.startsWith('data.json.bak-'))
      .map(f => ({
        name: f,
        path: path.join(this.backupDir, f),
        time: fs.statSync(path.join(this.backupDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.time - a.time);

    // 保留最新7个
    files.slice(7).forEach(f => {
      fs.unlinkSync(f.path);
      console.log(`[Backup] 🗑️  删除旧备份: ${f.name}`);
    });
  }

  async reportBackupStatus(status, size, error = null) {
    try {
      await fetch('http://localhost:3007/alert/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          size,
          timestamp: new Date().toISOString(),
          ...(error && { error }),
        }),
      });
    } catch (e) {
      console.warn('[Backup] 告警系统报告失败:', e.message);
    }
  }
}

// 在 server/index.js 中启动
const backupScheduler = new BackupScheduler();
backupScheduler.start();
```

### 手动备份

#### 快速备份命令

```bash
# 在本地执行
ssh root@47.242.80.65 "cp /opt/shenyuan/data.json /opt/shenyuan/data.json.bak-$(date +%Y%m%d-%H%M%S)"

# 或者使用SCP下载备份到本地
scp root@47.242.80.65:/opt/shenyuan/data.json.bak-20260810-140000 ~/shenyuan-backup.json
```

#### 验证备份完整性

```bash
# SSH到服务器
ssh root@47.242.80.65

# 查看最新备份
ls -lhrt /opt/shenyuan/data.json.bak-* | tail -3

# 验证文件大小合理
du -h /opt/shenyuan/data.json*

# 检查JSON有效性
cat /opt/shenyuan/data.json.bak-20260810-140000 | jq . > /dev/null && echo "✅ JSON有效" || echo "❌ JSON无效"
```

---

## 恢复流程

### 恢复场景决策树

```
发现数据问题
    ↓
[是否是部分数据损坏]
    ├─ YES → 部分恢复 (见 §4.1)
    └─ NO  → 全量恢复 (见 §4.2)

[恢复前是否要备份当前数据]
    ├─ YES → 先备份 data.json (见 §4.3)
    └─ NO  → 直接恢复
```

### 4.1 全量恢复 (Complete Restore)

**场景**: 
- 数据文件完全损坏/丢失
- 服务器重启后数据异常
- 需要回滚到历史版本

**步骤**:

```bash
# 1️⃣ SSH到服务器
ssh root@47.242.80.65

# 2️⃣ 停止服务 (可选,建议做以防万一)
pm2 stop shenyuan

# 3️⃣ 备份当前数据 (先保存坏数据以供分析)
cp /opt/shenyuan/data.json /opt/shenyuan/data.json.corrupted-$(date +%Y%m%d-%H%M%S)

# 4️⃣ 查看可用备份
ls -lhrt /opt/shenyuan/data.json.bak-* | tail -10

# 5️⃣ 选择要恢复的备份 (例如: 20260810-140000)
# 建议选择最新的正常备份,而非最新备份
BACKUP_FILE="/opt/shenyuan/data.json.bak-20260810-140000"

# 6️⃣ 验证备份内容
cat "$BACKUP_FILE" | jq . > /dev/null && echo "✅ 备份文件有效"

# 7️⃣ 执行恢复
cp "$BACKUP_FILE" /opt/shenyuan/data.json

# 8️⃣ 验证恢复
ls -lh /opt/shenyuan/data.json
cat /opt/shenyuan/data.json | jq '.users | length' # 查看用户数

# 9️⃣ 重启服务
pm2 restart shenyuan

# 🔟 验证服务状态
pm2 status shenyuan
curl -s http://localhost:3021/api/health | jq .
```

**预期耗时**: 5-10分钟

### 4.2 部分恢复 (Partial Recovery)

**场景**: 
- 只有部分数据损坏 (例如某个用户信息)
- 需要精细化数据修复
- 保留其他用户的数据

**步骤**:

```bash
# 1️⃣ 下载备份文件到本地进行编辑
scp root@47.242.80.65:/opt/shenyuan/data.json.bak-20260810-140000 ~/shenyuan-backup.json

# 2️⃣ 下载当前文件
scp root@47.242.80.65:/opt/shenyuan/data.json ~/shenyuan-current.json

# 3️⃣ 使用JSON编辑工具对比和修复
# 可选工具: jq, Python脚本, VS Code等

# 示例: 恢复单个用户的订阅记录
jq '.subscriptions |= . + 
  [{"userId":"user-123","type":"paid","expiredAt":"2026-09-10"}]' \
  ~/shenyuan-current.json > ~/shenyuan-fixed.json

# 4️⃣ 验证修复结果
jq . ~/shenyuan-fixed.json > /dev/null && echo "✅ 修复后JSON有效"

# 5️⃣ 上传修复后的文件
scp ~/shenyuan-fixed.json root@47.242.80.65:/opt/shenyuan/data.json.fixed

# 6️⃣ SSH验证并替换
ssh root@47.242.80.65 << 'EOF'
  # 备份当前数据
  cp /opt/shenyuan/data.json /opt/shenyuan/data.json.pre-fix-$(date +%s)
  
  # 替换
  cp /opt/shenyuan/data.json.fixed /opt/shenyuan/data.json
  
  # 重启
  pm2 restart shenyuan
EOF

# 7️⃣ 验证
curl -s http://47.242.80.65:3021/api/health | jq .
```

**预期耗时**: 15-30分钟

### 4.3 恢复前备份策略

**为什么要备份**:
- 如果恢复后发现是错误的,可以快速回滚
- 保存坏数据以供分析根本原因
- 审计追踪(什么时候恢复的)

**操作**:

```bash
# 恢复前执行
ssh root@47.242.80.65 "cp /opt/shenyuan/data.json /opt/shenyuan/data.json.pre-restore-$(date +%s)"

# 恢复后如需回滚
ssh root@47.242.80.65 "cp /opt/shenyuan/data.json.pre-restore-1691656800 /opt/shenyuan/data.json && pm2 restart shenyuan"
```

---

## 故障场景处理

### 场景1: 备份文件损坏

**症状**:
```bash
$ cat /opt/shenyuan/data.json.bak-* | jq .
parse error: Expecting value: line 1 column 1 (char 0)
```

**原因可能**:
- 文件在备份过程中被截断
- 磁盘坏块导致文件损坏
- 备份命令执行失败但无错误日志

**恢复步骤**:

```bash
# 1️⃣ 检查备份文件大小
ls -lh /opt/shenyuan/data.json.bak-* | awk '{print $5, $9}' | sort -h

# 对比文件大小,异常小的文件通常是损坏的
# 正常: 1-20 MB
# 异常: < 100 bytes 或 0 bytes

# 2️⃣ 使用最大的备份文件 (通常是完整的)
LARGEST_BACKUP=$(ls -lhS /opt/shenyuan/data.json.bak-* | head -1 | awk '{print $NF}')
echo "使用备份: $LARGEST_BACKUP"

# 3️⃣ 尝试验证
cat "$LARGEST_BACKUP" | head -c 100 | cat -v
# 应该看到 {"users":[...

# 4️⃣ 执行恢复
cp "$LARGEST_BACKUP" /opt/shenyuan/data.json
pm2 restart shenyuan
```

### 场景2: 没有可用备份

**症状**:
```bash
$ ls /opt/shenyuan/data.json.bak-*
ls: cannot access '/opt/shenyuan/data.json.bak-*': No such file or directory
```

**原因可能**:
- 备份脚本未运行
- 磁盘满导致备份失败
- 备份文件被意外删除

**恢复步骤** (紧急处理):

```bash
# 1️⃣ 检查是否有其他备份位置
find /opt -name "data.json*" 2>/dev/null

# 2️⃣ 检查git历史 (如果有版本控制)
cd /opt/shenyuan && git log --oneline -- data.json | head -5
git show HEAD:data.json > /tmp/data-from-git.json

# 3️⃣ 检查系统快照 (如果配置了LVM/ZFS)
# 仅适用于配置了存储快照的系统

# 4️⃣ 最后手段: 使用最近的数据转储
# 如果应用有定期导出功能,尝试从导出恢复

# 如无以上选项,数据可能已丢失,需要:
# - 通知用户
# - 从备份恢复 (如有跨域云备份)
# - 数据库恢复 (如有其他冗余)
# - 最坏情况: 数据丢失,从零重建
```

### 场景3: 恢复过程中服务崩溃

**症状**:
```bash
$ pm2 restart shenyuan
[PM2] Restarting shenyuan in cluster mode
[PM2] Cluster mode not enabled. Restarting as fork mode.
[PM2] Error: spawn failed (exit code: 1)
```

**排查步骤**:

```bash
# 1️⃣ 查看详细错误日志
pm2 logs shenyuan --lines 50 --err

# 2️⃣ 验证数据文件有效性
cat /opt/shenyuan/data.json | jq . > /dev/null || echo "JSON无效"

# 3️⃣ 检查磁盘空间
df -h /opt/shenyuan

# 4️⃣ 检查文件权限
ls -la /opt/shenyuan/data.json
# 应该是 -rw-r--r-- root:root

# 5️⃣ 尝试手动启动应用以获得更多错误信息
cd /opt/shenyuan && node server/index.js

# 6️⃣ 回滚到已知的好备份
cp /opt/shenyuan/data.json.pre-restore-* /opt/shenyuan/data.json

# 7️⃣ 重新启动
pm2 restart shenyuan
```

---

## 验证检查清单

### 恢复后必须检查清单

恢复完成后,必须执行以下验证 (□ 表示检查项):

```
□ 数据文件存在且大小正常 (1-20 MB)
  $ ls -lh /opt/shenyuan/data.json
  
□ JSON格式有效
  $ cat /opt/shenyuan/data.json | jq . > /dev/null && echo "✅"
  
□ 用户数据完整
  $ cat /opt/shenyuan/data.json | jq '.users | length'
  应该 > 0
  
□ PM2服务在线
  $ pm2 status shenyuan | grep online
  
□ API健康检查通过
  $ curl -s http://localhost:3021/api/health | jq .
  应该返回 {"status":"ok",...}
  
□ 支付订阅信息完整
  $ curl -s http://localhost:3021/api/subscriptions | jq '.count'
  应该 > 0 (如果之前有付费用户)
  
□ 邀请排行榜完整
  $ curl -s http://localhost:3021/api/leaderboard | jq '.data | length'
  应该 > 0 (如果启用了邀请)
  
□ 没有错误日志
  $ pm2 logs shenyuan --lines 50 | grep -i error
  不应该有error/exception
  
□ 性能正常 (CPU/内存)
  $ ssh root@47.242.80.65 'pm2 monit'
  内存占用 < 500MB, CPU < 20%
  
□ 数据修改时间戳合理
  $ stat /opt/shenyuan/data.json | grep Modify
  应该在恢复时间附近
  
□ 告警系统收到恢复通知 (可选)
  查看 Slack #shenyuan-alerts 是否收到通知
```

---

## 问题排查

### Q1: 如何验证备份是否成功?

```bash
# 方法1: 查看日志
tail -f /opt/shenyuan/logs/backup.log

# 方法2: 验证文件存在和大小
ls -lh /opt/shenyuan/data.json.bak-* | tail -1

# 方法3: 验证JSON有效性
LATEST_BACKUP=$(ls -1t /opt/shenyuan/data.json.bak-* | head -1)
cat "$LATEST_BACKUP" | jq . > /dev/null && echo "✅ 备份有效"
```

### Q2: 恢复需要多长时间?

| 恢复类型 | 耗时 | 说明 |
|---------|------|------|
| 本地全量恢复 | 5-10分钟 | 复制+验证+重启 |
| 部分恢复 | 15-30分钟 | 包含编辑+验证 |
| 云备份恢复 | 30-60分钟 | 下载+验证+部署 |

### Q3: 如何恢复到一周前的数据?

```bash
# 查看备份历史
ls -lrt /opt/shenyuan/data.json.bak-* | head -5

# 找到7天前的备份
# 例如: data.json.bak-20260803-140000

# 恢复
cp /opt/shenyuan/data.json.bak-20260803-140000 /opt/shenyuan/data.json
pm2 restart shenyuan
```

### Q4: 备份文件占用空间太大,如何清理?

```bash
# 手动清理 (仅保留最新3个备份)
ls -1t /opt/shenyuan/data.json.bak-* | tail -n +4 | xargs rm

# 或使用脚本的自动清理 (保留7天)
find /opt/shenyuan -name "data.json.bak-*" -mtime +7 -delete
```

### Q5: 恢复后用户反映数据不对,怎么办?

1. **立即停止继续操作**，防止数据进一步损坏
2. **备份当前状态**
   ```bash
   cp /opt/shenyuan/data.json /opt/shenyuan/data.json.issue-$(date +%s)
   ```
3. **回滚到上一个已知好备份**
   ```bash
   cp /opt/shenyuan/data.json.pre-restore-* /opt/shenyuan/data.json
   pm2 restart shenyuan
   ```
4. **通知Karen和技术团队** - 需要分析根本原因
5. **保存异常数据供分析**
   ```bash
   scp /opt/shenyuan/data.json.issue-* ~/shenyuan-issues/
   ```

---

## 附录A: 备份恢复脚本模板

### 一键备份脚本 (快速手动备份)

```bash
#!/bin/bash
# 快速备份脚本

BACKUP_DIR="/opt/shenyuan"
BACKUP_FILE="$BACKUP_DIR/data.json.bak-$(date +%Y%m%d-%H%M%S)"

echo "🔄 正在备份..."
cp "$BACKUP_DIR/data.json" "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  SIZE=$(du -h "$BACKUP_FILE" | awk '{print $1}')
  echo "✅ 备份成功: $(basename $BACKUP_FILE) ($SIZE)"
else
  echo "❌ 备份失败"
  exit 1
fi

# 清理7天前的备份
find "$BACKUP_DIR" -name "data.json.bak-*" -mtime +7 -delete

# 显示最新备份
echo ""
echo "最新5个备份:"
ls -1t "$BACKUP_DIR/data.json.bak-"* 2>/dev/null | head -5 | while read f; do
  SIZE=$(du -h "$f" | awk '{print $1}')
  echo "  $(basename $f) - $SIZE"
done
```

### 一键恢复脚本 (快速恢复)

```bash
#!/bin/bash
# 快速恢复脚本

BACKUP_DIR="/opt/shenyuan"
BACKUP_TO_RESTORE="${1:-}"

if [ -z "$BACKUP_TO_RESTORE" ]; then
  echo "可用备份列表:"
  ls -1t "$BACKUP_DIR/data.json.bak-"* 2>/dev/null | head -10 | while read f; do
    SIZE=$(du -h "$f" | awk '{print $1}')
    echo "  $(basename $f) - $SIZE"
  done
  
  echo ""
  echo "用法: $0 <备份文件名>"
  echo "示例: $0 data.json.bak-20260810-140000"
  exit 1
fi

BACKUP_FILE="$BACKUP_DIR/$BACKUP_TO_RESTORE"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ 错误: 备份文件不存在: $BACKUP_FILE"
  exit 1
fi

echo "⚠️  警告: 即将恢复数据,此操作不可撤销"
echo "备份文件: $BACKUP_FILE"
echo "恢复目标: $BACKUP_DIR/data.json"
read -p "确认恢复? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "已取消"
  exit 0
fi

# 备份当前数据
echo "💾 先备份当前数据..."
cp "$BACKUP_DIR/data.json" "$BACKUP_DIR/data.json.pre-restore-$(date +%s)"

# 执行恢复
echo "🔄 正在恢复..."
cp "$BACKUP_FILE" "$BACKUP_DIR/data.json"

# 验证
if cat "$BACKUP_DIR/data.json" | jq . > /dev/null; then
  echo "✅ 数据有效"
else
  echo "❌ 数据无效,正在回滚..."
  # 恢复上一个备份
  exit 1
fi

# 重启服务
echo "🔄 重启服务..."
pm2 restart shenyuan

# 等待启动
sleep 3

# 最终验证
echo "验证服务状态..."
pm2 status shenyuan

curl -s http://localhost:3021/api/health | jq . && echo "✅ 恢复完成" || echo "⚠️ 服务验证失败"
```

---

## 附录B: 监控和告警

### 备份失败告警

在Slack告警系统中配置:

```json
{
  "name": "backup_failure",
  "description": "备份执行失败",
  "metric": "backup_status",
  "threshold": "failure",
  "severity": "critical",
  "message": "🚨 数据备份失败! 可能导致无法恢复",
  "action": "立刻SSH登录检查备份脚本日志"
}
```

### 备份文件监控

```bash
# 每天检查最新备份时间
0 9 * * * ssh root@47.242.80.65 "ls -lt /opt/shenyuan/data.json.bak-* | head -1 | xargs stat" | mail -s "备份状态" devops@shenyuan.com
```

---

## 附录C: 版本历史

| 版本 | 日期 | 变更 |
|-----|------|------|
| 1.0 | 2026-08-10 | 初始版本 - 本地备份+恢复流程 |
| 待办 | TBD | 跨域云备份集成 (AWS S3/Aliyun OSS) |
| 待办 | TBD | 数据库备份 (如适用) |
| 待办 | TBD | 增量备份优化 |

---

**维护者**: DevOps Team  
**最后审核**: Karen  
**下次审核时间**: 2026-12-10
