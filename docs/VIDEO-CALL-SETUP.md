# 善缘实时视频通话功能 - 实现指南

> 真人连麦通话功能，支持咨询师与用户进行实时音视频对话、屏幕共享及录音回放。

## 快速开始

### 1. 环境配置

在 `server/.env` 中添加 Agora 凭证：

```env
# Agora RTC 配置（必需）
AGORA_APP_ID=your_agora_app_id_here
AGORA_APP_CERT=your_agora_app_certificate_here
AGORA_CALL_TOKEN_TTL_SEC=3600        # Token 有效期（秒），默认 1 小时
```

**获取 Agora 凭证：**

1. 访问 [Agora Console](https://console.agora.io)
2. 创建新项目
3. 进入 **Basic Information** 获取：
   - `App ID` → 填入 `AGORA_APP_ID`
   - `App Certificate` → 填入 `AGORA_APP_CERT`（启用证书认证）

### 2. 安装依赖

```bash
cd server
npm install
# 或更新现有依赖
npm update
```

新增依赖包：`agora-access-token@^2.0.9`

### 3. 启动服务

```bash
npm run dev    # 开发模式（自动重载）
# 或
npm start      # 生产模式
```

检查 Agora 服务状态：

```bash
curl http://localhost:3021/api/video-call/health
```

预期响应：
```json
{
  "ok": true,
  "agoraReady": true,
  "activeSessions": 0,
  "message": "Agora 服务就绪"
}
```

---

## API 端点

### 1. 发起通话（咨询师）

**Endpoint:** `POST /api/video-call/start-session`

**请求头：**
```
Authorization: Bearer {consultant_token}
Content-Type: application/json
```

**请求体：**
```json
{
  "orderId": "order-123456",
  "userId": 789,
  "userEmail": "user@example.com",
  "consultantId": 456,
  "consultantName": "李师傅"
}
```

**响应（成功）：**
```json
{
  "ok": true,
  "session": {
    "id": "uuid-session-id",
    "channel": "consult-c456-u789-xyzabc",
    "appId": "your_agora_app_id",
    "uid": 100456,
    "token": "006your_agora_token_here",
    "role": "consultant",
    "expiresAt": "2026-08-11T12:00:00Z"
  }
}
```

### 2. 加入通话（用户）

**Endpoint:** `POST /api/video-call/token`

**请求头：**
```
Authorization: Bearer {user_token}
Content-Type: application/json
```

**请求体：**
```json
{
  "sessionId": "uuid-session-id"
}
```

**响应（成功）：**
```json
{
  "ok": true,
  "session": {
    "id": "uuid-session-id",
    "channel": "consult-c456-u789-xyzabc",
    "appId": "your_agora_app_id",
    "uid": 100789,
    "token": "006your_agora_token_here",
    "role": "user",
    "consultantName": "李师傅",
    "expiresAt": "2026-08-11T12:00:00Z"
  }
}
```

### 3. 结束通话（双方）

**Endpoint:** `POST /api/video-call/end-session`

**请求体：**
```json
{
  "sessionId": "uuid-session-id",
  "durationSeconds": 1800,
  "recordingUrl": "https://example.com/recordings/xxx.m3u8"
}
```

**响应：**
```json
{
  "ok": true,
  "session": {
    "id": "uuid-session-id",
    "durationSeconds": 1800,
    "durationFormatted": "30m 0s",
    "recordingId": "rec-123",
    "endTime": "2026-08-11T11:30:00Z"
  }
}
```

### 4. 查询通话状态

**Endpoint:** `GET /api/video-call/session/:id`

**响应：**
```json
{
  "ok": true,
  "session": {
    "id": "uuid-session-id",
    "channel": "consult-c456-u789-xyzabc",
    "status": "connected",
    "consultantName": "李师傅",
    "userEmail": "user@example.com",
    "startTime": "2026-08-11T11:00:00Z",
    "endTime": null,
    "durationSeconds": 0,
    "recordingId": null
  }
}
```

### 5. 获取录音

**Endpoint:** `GET /api/video-call/recording/:sessionId`

**响应（成功）：**
```json
{
  "ok": true,
  "recording": {
    "id": "rec-123",
    "url": "https://example.com/recordings/session-id.m3u8",
    "durationSeconds": 1800,
    "createdAt": "2026-08-11T11:30:00Z"
  }
}
```

---

## 前端集成

### 1. 打开通话界面

用户付款后，获得 `sessionId`，跳转到通话页面：

```html
<!-- 用户进入通话 -->
<a href="/pages/video-call.html?sessionId=uuid-session-id">接听通话</a>
```

### 2. 页面流程

**`pages/video-call.html` 自动处理：**

1. **解析 URL 参数** → 获取 `sessionId`
2. **获取 token** → POST `/api/video-call/token`
3. **初始化 Agora 客户端** → 创建 RTC 连接
4. **发布本地音频** → 默认启用麦克风
5. **订阅远程媒体** → 接收咨询师音视频
6. **启动计时器** → 显示通话时长
7. **处理挂断** → POST `/api/video-call/end-session` 记录数据

### 3. 客户端 API

页面内置事件处理：

```javascript
// 切换麦克风
document.getElementById('micBtn').click();

// 切换摄像头（可选功能）
document.getElementById('cameraBtn').click();

// 屏幕共享（开发中）
document.getElementById('screenShareBtn').click();

// 挂断
document.getElementById('hangupBtn').click();
```

---

## 数据存储结构

### 会话表（store.js）

```javascript
_M.videoCallSessions = [
  {
    id: 'uuid-...',
    channel: 'consult-c456-u789-xyzabc',
    consultantId: 456,
    consultantName: '李师傅',
    consultantUid: 100456,
    userId: 789,
    userEmail: 'user@example.com',
    userUid: 100789,
    status: 'connected',  // initiated | connected | ended | failed
    startTime: '2026-08-11T11:00:00Z',
    endTime: null,
    recordingId: null,
    durationSeconds: 0,
    orderId: 'order-123456',
    createdAt: '2026-08-11T11:00:00Z',
    updatedAt: '2026-08-11T11:05:00Z'
  }
]
```

### 录音表

```javascript
_M.videoCallRecordings = [
  {
    id: 'rec-123',
    sessionId: 'uuid-...',
    consultantId: 456,
    userId: 789,
    url: 'https://example.com/recordings/session-id.m3u8',
    durationSeconds: 1800,
    createdAt: '2026-08-11T11:30:00Z'
  }
]
```

---

## 安全性考虑

### 权限检查

- **发起通话** → 仅咨询师（待实现：验证 `req.user.role === 'consultant'`）
- **加入通话** → 仅已支付用户（sessionId 必须存在且状态有效）
- **查询状态** → 仅参与方或管理员

### Token 过期处理

- 生成的 Agora token 默认有效期：1 小时
- 长时间通话（>1小时） → 前端需实现 token 刷新机制

```javascript
// 前端实现（video-call.html 中）
setInterval(async () => {
  if (state.startTime && Date.now() - state.startTime > 55 * 60 * 1000) {
    // 接近过期，刷新 token
    const res = await fetch('/api/video-call/token', {
      method: 'POST',
      body: JSON.stringify({ sessionId: state.sessionId })
    });
    const data = await res.json();
    if (data.ok) {
      state.token = data.session.token;
      // Agora SDK 自动使用新 token
    }
  }
}, 60000); // 每分钟检查一次
```

### 隐私保护

- 录音默认存储于本地服务器（未上传云端）
- 生产环境建议配置 S3/OSS 存储
- 7 天自动删除过期录音（cron job 待实现）
- 录音访问需要身份验证

---

## 故障排查

### Agora 服务未配置

**错误信息：**
```json
{
  "error": "Agora 服务未配置"
}
```

**解决方案：**

1. 检查 `server/.env` 中 `AGORA_APP_ID` 和 `AGORA_APP_CERT` 是否设置
2. 确保值不为空
3. 重启服务：`npm start`

### Token 生成失败

**错误信息：**
```json
{
  "error": "Token 生成失败: ..."
}
```

**可能原因：**

1. Agora 凭证过期或无效
2. 频道名格式不正确（包含特殊字符）
3. UID 值超出范围（应为 0-4294967295）

**检查命令：**
```bash
# 测试 token 生成
node -e "
const agora = require('./lib/agora-integration');
const token = agora.generateAgoraToken('test-channel', 123, 'publisher');
console.log(token);
"
```

### 无法连接视频

**排查步骤：**

1. 打开浏览器控制台（F12 → Console），查看错误日志
2. 检查网络连接（测试 https://sd-rtn.agora.io 是否可达）
3. 确保本地防火墙未阻止 UDP 端口（Agora RTC 使用 UDP）
4. 验证 token 是否过期：检查 `expiresAt` 时间戳

### 录音不可用

**可能原因：**

1. 本地磁盘空间不足
2. 录音文件被意外删除
3. 文件权限不正确（无法读取）

**检查命令：**
```bash
# 列出所有录音
ls -lh server/data/recordings/

# 检查磁盘使用情况
du -sh server/data/
```

---

## 部署建议

### 开发环境

```bash
# 启动本地开发服务
npm run dev
```

### 生产环境

1. **Agora 凭证** → 通过环境变量或密钥管理系统注入
2. **HTTPS** → Agora Web SDK 要求 HTTPS 连接
3. **录音存储** → 迁移到 S3/OSS（可选，目前本地存储）
4. **监控告警** → 集成 Sentry 追踪异常

### HK 服务器部署（47.242.80.65）

```bash
# 1. SSH 连接
ssh root@47.242.80.65

# 2. 进入项目目录
cd /root/shenyuan

# 3. 更新代码并安装依赖
git pull
npm install

# 4. 重启服务
systemctl restart shenyuan.service

# 5. 验证健康检查
curl http://localhost:3021/api/video-call/health
```

---

## 扩展功能（Roadmap）

- [ ] **屏幕共享** → Agora SDK 支持，需前端 UI 适配
- [ ] **通话录制** → Cloud Recording 集成（OSS 存储）
- [ ] **实时字幕** → 集成 STT（语音转文字）
- [ ] **消息记录** → 通话期间的文字聊天
- [ ] **咨询师排班系统** → 日历 + 可用时间槽管理
- [ ] **评分反馈** → 通话后用户给咨询师评分
- [ ] **支付集成** → Stripe/微信/支付宝完整对接
- [ ] **多语言支持** → 英文/韩文通话界面

---

## 相关文件

```
server/
├── lib/
│   └── agora-integration.js      # Agora 核心库（token 生成、会话管理）
├── routes/
│   └── video-call.js             # API 端点（启动、加入、结束、查询）
├── index.js                       # 路由挂载
└── .env                           # 环境配置（需要 AGORA_APP_ID/CERT）

pages/
└── video-call.html               # 前端 UI（RTC 视频界面、控制栏）

docs/
└── VIDEO-CALL-SETUP.md           # 本文件（实现指南）
```

---

## 参考资源

- [Agora RTC Web SDK 文档](https://docs.agora.io/cn/Video/API%20Reference/web/index.html)
- [Agora Token 生成](https://docs.agora.io/cn/Agora%20Platform/token)
- [ShenYuan 后端架构](./README.md)
- [Lumee 视频通话参考](https://github.com/karentan30/lumee)

---

**最后更新：2026-08-11**  
**维护者：Karen（CLI Agent）**
