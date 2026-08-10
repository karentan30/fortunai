# 善缘视频通话 - 测试指南

## 本地测试环境搭建

### 前置条件

```bash
# 检查 Node.js 版本
node --version    # 需要 v14+

# 检查 npm
npm --version     # 需要 v6+

# 检查现有依赖
cd server && npm list agora-access-token
```

### 环境配置

**1. 获取 Agora 测试凭证**

访问 [Agora Console](https://console.agora.io) 或使用既有凭证：

```
App ID:    a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
App Cert:  abc123def456ghi789jkl012mno345pqr
```

**2. 配置 .env**

```bash
cat > server/.env << 'EOF'
PORT=3021
AGORA_APP_ID=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
AGORA_APP_CERT=abc123def456ghi789jkl012mno345pqr
AGORA_CALL_TOKEN_TTL_SEC=3600
EOF
```

**3. 启动服务**

```bash
cd server
npm install
npm start
```

预期输出：

```
╔═══════════════════════════════════╗
║   善缘 ShenYuan v2.0              ║
║   Port: 3021                      ║
║   Agora: ✓                        ║
╚═══════════════════════════════════╝
[video-call] Agora 服务初始化完成
```

---

## API 功能测试

### Test 1: 健康检查

```bash
curl -i http://localhost:3021/api/video-call/health
```

**预期响应（200 OK）：**
```json
{
  "ok": true,
  "agoraReady": true,
  "activeSessions": 0,
  "message": "Agora 服务就绪"
}
```

**失败诊断：**
- ❌ `"agoraReady": false` → 检查 .env 中 AGORA_APP_ID/CERT 是否设置
- ❌ 连接拒绝 → 服务未启动，运行 `npm start`

### Test 2: 发起通话（咨询师端）

```bash
curl -X POST http://localhost:3021/api/video-call/start-session \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order-test-001",
    "userId": 10001,
    "userEmail": "user@example.com",
    "consultantId": 20001,
    "consultantName": "Test Consultant"
  }'
```

**预期响应（200 OK）：**
```json
{
  "ok": true,
  "session": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "channel": "consult-c20001-u10001-abc123xyz",
    "appId": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "uid": 100020001,
    "token": "006a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6Ag...",
    "role": "consultant",
    "expiresAt": "2026-08-11T12:00:00Z"
  }
}
```

**验证检查：**
- ✅ `session.id` 是 UUID 格式
- ✅ `session.channel` 包含 `consult-` 前缀
- ✅ `session.token` 以 `006` 开头（Agora v3+ 格式）
- ✅ `session.uid` 是正整数

**保存返回的 `sessionId`：**
```bash
SESSION_ID="550e8400-e29b-41d4-a716-446655440000"
```

### Test 3: 用户获取 Token

使用上面生成的 `SESSION_ID`：

```bash
curl -X POST http://localhost:3021/api/video-call/token \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer user_test_token" \
  -d "{\"sessionId\": \"$SESSION_ID\"}"
```

**预期响应（200 OK）：**
```json
{
  "ok": true,
  "session": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "channel": "consult-c20001-u10001-abc123xyz",
    "appId": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "uid": 100010001,
    "token": "006a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6Bn...",
    "role": "user",
    "consultantName": "Test Consultant",
    "expiresAt": "2026-08-11T12:00:00Z"
  }
}
```

**验证检查：**
- ✅ 返回的 `channel` 与发起通话时一致
- ✅ 返回的 `uid` 不同于咨询师 UID（✅ 100010001 ≠ 100020001）
- ✅ 返回的 `token` 不同于咨询师 token（双方各有唯一 token）
- ✅ `role` 为 `user`

### Test 4: 查询会话状态

```bash
curl -i http://localhost:3021/api/video-call/session/$SESSION_ID
```

**预期响应（200 OK）：**
```json
{
  "ok": true,
  "session": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "channel": "consult-c20001-u10001-abc123xyz",
    "status": "connected",
    "consultantName": "Test Consultant",
    "userEmail": "user@example.com",
    "startTime": "2026-08-11T11:00:00Z",
    "endTime": null,
    "durationSeconds": 0,
    "recordingId": null
  }
}
```

**验证检查：**
- ✅ `status` 从 `initiated` → `connected`（用户加入后自动更新）
- ✅ `endTime` 为 null（通话未结束）
- ✅ `recordingId` 为 null（未启动录音）

### Test 5: 结束通话

```bash
curl -X POST http://localhost:3021/api/video-call/end-session \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"durationSeconds\": 1800
  }"
```

**预期响应（200 OK）：**
```json
{
  "ok": true,
  "session": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "durationSeconds": 1800,
    "durationFormatted": "30m 0s",
    "recordingId": null,
    "endTime": "2026-08-11T11:30:00Z"
  }
}
```

**验证检查：**
- ✅ `durationSeconds` 正确记录为 1800
- ✅ `durationFormatted` 正确格式化为 "30m 0s"
- ✅ `endTime` 设置为当前时间戳

### Test 6: 查询已结束会话

```bash
curl http://localhost:3021/api/video-call/session/$SESSION_ID
```

**预期响应：**
```json
{
  "ok": true,
  "session": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "channel": "consult-c20001-u10001-abc123xyz",
    "status": "ended",
    "consultantName": "Test Consultant",
    "userEmail": "user@example.com",
    "startTime": "2026-08-11T11:00:00Z",
    "endTime": "2026-08-11T11:30:00Z",
    "durationSeconds": 1800,
    "recordingId": null
  }
}
```

**验证检查：**
- ✅ `status` 为 `ended`
- ✅ `endTime` 已设置

---

## 前端 UI 测试

### 打开通话页面

在浏览器中访问：

```
http://localhost:3021/pages/video-call.html?sessionId=550e8400-e29b-41d4-a716-446655440000
```

### 验证清单

| 检查项 | 预期行为 | 状态 |
|--------|---------|------|
| 页面加载 | 无错误，显示"等待连接..." | ☐ |
| 咨询师名字 | 显示"Test Consultant" | ☐ |
| 麦克风图标 | 默认启用（绿色背景） | ☐ |
| 摄像头图标 | 默认禁用（灰色背景） | ☐ |
| 屏幕共享按钮 | 可点击（暂不可用） | ☐ |
| 挂断按钮 | 红色，可点击 | ☐ |
| 计时器 | 显示 "00:00:00"，每秒更新 | ☐ |
| 浏览器控制台 | 无红色错误 | ☐ |
| Agora SDK 加载 | 控制台无 CORS 错误 | ☐ |

### 浏览器控制台检查

打开 F12 → Console，查看日志：

```javascript
// 预期看到的日志
[video-call] 初始化通话...
[video-call] 获取 token 成功
[joinChannel] 成功加入频道并发布音频
[connection-state] CONNECTING
[connection-state] CONNECTED
```

### 常见错误诊断

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| `GET .../AgoraRTC_N-latest.js 404` | CDN 不可达 | 检查网络连接或科学上网 |
| `Cannot read property 'createClient'` | Agora SDK 未加载 | 等待 CDN 加载完成 |
| `connectionStateChange: FAILED` | Token 无效或过期 | 检查 token 有效期 |
| `sessionId 缺失` | URL 参数不完整 | 确保 `?sessionId=...` 存在 |

---

## 端到端（E2E）测试

### 场景 1: 本机双浏览器模拟

**Step 1: 启动两个浏览器窗口**

- 窗口 A：咨询师
- 窗口 B：用户

**Step 2: 执行测试流程**

```bash
# Terminal 1: 启动服务
cd server && npm start

# Terminal 2: 执行测试序列
SESSION_ID=$(curl -s -X POST http://localhost:3021/api/video-call/start-session \
  -H "Content-Type: application/json" \
  -d '{...}' | jq -r '.session.id')

echo "Session ID: $SESSION_ID"
```

**Step 3: 在浏览器中打开**

```
窗口 A：http://localhost:3021/pages/video-call.html?sessionId=$SESSION_ID&role=consultant
窗口 B：http://localhost:3021/pages/video-call.html?sessionId=$SESSION_ID&role=user
```

**Step 4: 观察**

- [ ] 两个窗口都显示对方信息
- [ ] 计时器同步增长
- [ ] 点击麦克风切换正常
- [ ] 点击挂断返回首页

### 场景 2: 网络延迟模拟（Chrome DevTools）

1. F12 → Network 标签
2. 设置 Throttling: "Fast 3G" 或 "Slow 3G"
3. 重新加载页面
4. 观察连接时间和错误恢复

### 场景 3: 长时间通话测试

1. 启动通话
2. 让页面运行 65 分钟（超过 1 小时 token 有效期）
3. 观察是否自动刷新 token（目前未实现，需要前端改进）

---

## 性能测试

### 内存占用

```bash
# 启动服务前
free -h

# 启动服务
npm start

# 创建 10 个并发会话
for i in {1..10}; do
  curl -X POST http://localhost:3021/api/video-call/start-session \
    -d "{\"orderId\": \"test-$i\", \"userId\": $i, \"consultantId\": $((i+1000))}" &
done

# 查看内存
ps aux | grep node
```

**预期：**
- 启动占用：~50-100 MB
- 每个会话额外占用：~1-2 KB

### API 响应时间

```bash
# 使用 ab（Apache Bench）
ab -n 1000 -c 10 http://localhost:3021/api/video-call/health

# 或使用 wrk
wrk -t4 -c100 -d30s http://localhost:3021/api/video-call/health
```

**预期：**
- 响应时间：<100 ms (p99)
- 吞吐量：>100 req/s

---

## 负面测试（Error Cases）

### Test N1: 无效的 sessionId

```bash
curl -i http://localhost:3021/api/video-call/session/invalid-uuid
```

**预期：404 Not Found**
```json
{ "error": "会话不存在" }
```

### Test N2: 缺少必要字段

```bash
curl -X POST http://localhost:3021/api/video-call/start-session \
  -H "Content-Type: application/json" \
  -d '{"orderId": "test"}'
```

**预期：400 Bad Request**
```json
{ "error": "缺少必要字段: orderId, userId, consultantId" }
```

### Test N3: Token 过期

```bash
# 生成一个只有 1 秒有效期的 token
AGORA_CALL_TOKEN_TTL_SEC=1 npm start

# 等待 2 秒后尝试加入
sleep 2
curl -X POST http://localhost:3021/api/video-call/token \
  -d "{\"sessionId\": \"$SESSION_ID\"}"
```

**预期：后端返回 token，但 Agora SDK 会在前端拒绝过期 token**

### Test N4: Agora 未配置

```bash
# 启动时不设置 AGORA_APP_ID
AGORA_APP_ID="" npm start

curl http://localhost:3021/api/video-call/health
```

**预期：**
```json
{
  "ok": true,
  "agoraReady": false,
  "message": "Agora 服务未配置"
}
```

---

## 持续集成检查清单

创建 `scripts/test-video-call.sh`：

```bash
#!/bin/bash
set -e

echo "🧪 视频通话测试套件"

# 1. 检查依赖
echo "✓ 检查 agora-access-token 依赖..."
npm list agora-access-token || exit 1

# 2. 检查环境
echo "✓ 检查 Agora 凭证..."
test -n "$AGORA_APP_ID" || { echo "❌ 缺少 AGORA_APP_ID"; exit 1; }
test -n "$AGORA_APP_CERT" || { echo "❌ 缺少 AGORA_APP_CERT"; exit 1; }

# 3. 健康检查
echo "✓ 启动服务..."
npm start &
PID=$!
sleep 3

echo "✓ 健康检查..."
curl -f http://localhost:3021/api/video-call/health || { kill $PID; exit 1; }

# 4. API 测试
echo "✓ 测试 start-session..."
RESULT=$(curl -s -X POST http://localhost:3021/api/video-call/start-session \
  -d '{...}')
SESSION_ID=$(echo $RESULT | jq -r '.session.id')
test -n "$SESSION_ID" || { kill $PID; exit 1; }

# 5. 清理
kill $PID
echo "✅ 所有测试通过！"
```

运行：
```bash
chmod +x scripts/test-video-call.sh
./scripts/test-video-call.sh
```

---

## 故障排查决策树

```
症状：无法连接视频通话
  ├─ 错误：sessionId 无效？
  │   └─ 解决：检查 URL 中 sessionId 参数
  │
  ├─ 错误：Agora SDK 加载失败？
  │   └─ 解决：检查 CDN 可达性（https://download.agora.io）
  │
  ├─ 错误：获取 token 失败？
  │   ├─ HTTP 503？→ Agora 未配置（检查 .env）
  │   ├─ HTTP 404？→ sessionId 不存在（先调用 start-session）
  │   └─ HTTP 500？→ 后端错误（查看服务器日志）
  │
  ├─ 错误：无音频/视频？
  │   ├─ 浏览器权限？→ 允许麦克风/摄像头访问
  │   ├─ 设备断开？→ 检查物理硬件
  │   └─ 防火墙阻止？→ Agora 需要 UDP 端口
  │
  └─ 其他错误？
      └─ 查看：https://docs.agora.io/cn/
```

---

## 已知问题与 Workaround

| 问题 | 复现条件 | Workaround |
|------|---------|-----------|
| 屏幕共享按钮无效 | 点击"屏幕共享" | 功能待实现，暂不支持 |
| 通话超 1 小时断开 | 连接 >3600 秒 | 前端需实现 token 刷新机制 |
| 移动端摄像头不转向 | iPad 竖屏转横屏 | 需要 CSS media query 适配 |
| Safari 播放无声音 | iOS Safari | 需要用户交互后启用音频播放 |

---

**最后更新：2026-08-11**  
**问题反馈**：向 Karen 或 Sentry 提交
