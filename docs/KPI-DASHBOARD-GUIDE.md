# 善缘 KPI 实时监控仪表板完整指南

## 📊 概述

专为善缘平台设计的生产级实时KPI监控仪表板，支持以下核心功能：

- **实时数据展示**: DAU / 付费用户 / 成交金额 / 平均客单价
- **A/B测试排行**: 8个落地页的转化率实时排名
- **邀请统计**: 邀请人数 / 转化人数 / 返佣金额 / Top10排行榜
- **支付方式分布**: 微信 / Stripe / 支付宝 占比与趋势
- **用户留存曲线**: Day1/Day3/Day7 留存率动态追踪
- **错误告警**: 支付失败 / Webhook异常 / 服务宕机实时监测
- **地理分布**: 中国 / 海外 / 韩国用户占比

---

## 🚀 快速开始

### 1. 访问仪表板

#### 方式A: 独立访问
```
http://localhost:3021/docs/kpi-dashboard.html
或
https://shenyuan.mylumee.cn/docs/kpi-dashboard.html
```

#### 方式B: 内嵌到后台管理页面
```html
<iframe 
  src="/docs/kpi-dashboard.html" 
  width="100%" 
  height="800px"
  style="border: none; border-radius: 8px;"
></iframe>
```

### 2. API 端点速查表

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/kpi/metrics` | 主要KPI指标 + 图表数据 |
| GET | `/api/kpi/ab-tests` | A/B测试排行 |
| GET | `/api/kpi/referrals` | 邀请排行榜 |
| GET | `/api/kpi/errors` | 错误告警 |
| GET | `/api/kpi/docs` | API 文档 (HTML) |

### 3. 数据刷新频率

- **自动刷新**: 每 30 秒
- **手动刷新**: 点击「刷新数据」按钮
- **数据延迟**: ≤ 5 分钟

---

## 📡 API 详细文档

### 3.1 GET /api/kpi/metrics

获取所有主要KPI指标和图表数据（最重要的端点）。

**请求示例:**
```bash
curl -X GET http://localhost:3021/api/kpi/metrics \
  -H "Content-Type: application/json"
```

**响应示例 (200 OK):**
```json
{
  "success": true,
  "timestamp": "2026-08-08T12:00:00.000Z",
  "metrics": {
    "dau": 1234,
    "dauChange": 5.2,
    "paidUsers": 345,
    "paidUsersChange": 3.1,
    "gmv": 12500.50,
    "gmvChange": 8.5,
    "aov": 36.23,
    "aovChange": -2.1,
    "conversionRate": 12.5,
    "crChange": -1.2,
    "orderCount": 345,
    "referralCount": 123,
    "referralChange": 4.5
  },
  "charts": {
    "retention": {
      "labels": ["Day 0", "Day 1", "Day 3", "Day 7"],
      "retention": [100, 65, 45, 30]
    },
    "paymentDistribution": {
      "labels": ["微信支付", "Stripe", "支付宝"],
      "values": [45, 35, 20]
    },
    "geographic": {
      "labels": ["中国", "海外", "韩国"],
      "values": [60, 25, 15]
    },
    "paymentTrends": {
      "labels": ["D1", "D2", "D3", "D4", "D5", "D6", "D7"],
      "wechat": [100, 120, 115, 130, 125, 135, 140],
      "stripe": [80, 85, 95, 100, 105, 110, 115],
      "alipay": [45, 50, 55, 60, 65, 70, 75]
    },
    "funnel": {
      "conversion": [100, 85, 65],
      "dropoff": [15, 20]
    }
  },
  "errors": [
    {
      "id": "payment_failure_rate",
      "type": "error",
      "icon": "❌",
      "message": "支付失败率过高: 6.2% (阈值: 5%)"
    }
  ]
}
```

**字段说明:**

| 字段 | 类型 | 说明 |
|------|------|------|
| `dau` | number | 日活用户数 |
| `dauChange` | number | DAU环比变化 (%) |
| `paidUsers` | number | 付费用户总数 |
| `paidUsersChange` | number | 付费用户环比变化 (%) |
| `gmv` | number | 成交金额 (RMB) |
| `gmvChange` | number | 成交金额环比变化 (%) |
| `aov` | number | 平均客单价 (RMB) |
| `aovChange` | number | 平均客单价环比变化 (%) |
| `conversionRate` | number | 转化率 (%) |
| `crChange` | number | 转化率环比变化 (%) |
| `orderCount` | number | 今日订单数 |
| `referralCount` | number | 邀请人数 |
| `referralChange` | number | 邀请人数环比变化 (%) |

---

### 3.2 GET /api/kpi/ab-tests

获取A/B测试落地页的转化率排行。

**请求示例:**
```bash
curl -X GET http://localhost:3021/api/kpi/ab-tests
```

**响应示例 (200 OK):**
```json
{
  "success": true,
  "tests": [
    {
      "name": "页面A (控制组)",
      "visits": 850,
      "conversions": 127,
      "rate": 14.94,
      "trend": 2.5,
      "status": "winning"
    },
    {
      "name": "页面B (变体1)",
      "visits": 820,
      "conversions": 114,
      "rate": 13.90,
      "trend": -1.2,
      "status": "running"
    },
    {
      "name": "页面C (变体2)",
      "visits": 780,
      "conversions": 78,
      "rate": 10.00,
      "trend": -5.5,
      "status": "losing"
    }
  ]
}
```

**状态解释:**
- `winning` - 转化率 > 15% (明显优于控制组)
- `running` - 转化率 8%-15% (进行中)
- `losing` - 转化率 < 8% (明显劣于控制组)

---

### 3.3 GET /api/kpi/referrals

获取邀请裂变排行榜（Top 10）。

**请求示例:**
```bash
curl -X GET http://localhost:3021/api/kpi/referrals
```

**响应示例 (200 OK):**
```json
{
  "success": true,
  "referrers": [
    {
      "id": "user_12345",
      "name": "用户12345",
      "invited": 45,
      "converted": 12,
      "commission": 1250.50
    },
    {
      "id": "user_12346",
      "name": "用户12346",
      "invited": 38,
      "converted": 9,
      "commission": 945.25
    }
  ]
}
```

**转化率计算公式:**
```
转化率 = (已转化邀请数 / 邀请总数) × 100%
```

**返佣计算公式:**
```
返佣金额 = 邀请用户的总消费额 × 5%
```

---

### 3.4 GET /api/kpi/errors

获取实时错误告警和风险提示。

**请求示例:**
```bash
curl -X GET http://localhost:3021/api/kpi/errors
```

**响应示例 (200 OK):**
```json
{
  "success": true,
  "errors": [
    {
      "id": "payment_failure_rate",
      "type": "error",
      "icon": "❌",
      "message": "支付失败率过高: 6.2% (阈值: 5%)"
    },
    {
      "id": "slow_response",
      "type": "warning",
      "icon": "⏱️",
      "message": "API响应缓慢: 2.5s (阈值: 2s)"
    }
  ],
  "alerts": 2
}
```

**告警阈值表:**

| 类型 | 阈值 | 严重级别 |
|------|------|--------|
| 支付失败率 | > 5% | 🔴 Error |
| Webhook失败 | > 10 次/小时 | 🔴 Error |
| API响应时间 | > 2000ms | 🟠 Warning |
| 转化率下降 | > 20% | 🟠 Warning |

---

### 3.5 GET /api/kpi/docs

获取API文档（HTML格式）。

**使用场景:** 直接在浏览器中查看完整的API文档。

```
http://localhost:3021/api/kpi/docs
```

---

## 🔧 部署配置

### 后端集成 (Express)

#### 步骤1: 确保已注册KPI路由
```javascript
// server/index.js
const kpiRouter = require('./routes/kpi');
app.use('/api/kpi', kpiRouter);
```

#### 步骤2: 验证 data.json 结构
```json
{
  "users": [
    {
      "id": "user_123",
      "createdAt": "2026-08-01T00:00:00Z",
      "lastActive": "2026-08-08T12:00:00Z",
      "referredBy": "user_456",
      "region": "CN"
    }
  ],
  "orders": [
    {
      "id": "order_123",
      "userId": "user_123",
      "amount": 99.9,
      "paymentMethod": "wechat_pay",
      "status": "paid",
      "createdAt": "2026-08-08T10:00:00Z"
    }
  ]
}
```

#### 步骤3: 本地启动测试
```bash
cd /Users/karen/projects/shenyuan/server
node index.js
# 服务启动在 http://localhost:3021
```

#### 步骤4: 验证API
```bash
# 测试 metrics 端点
curl http://localhost:3021/api/kpi/metrics

# 测试仪表板
open http://localhost:3021/docs/kpi-dashboard.html
```

---

### 生产部署 (HK 服务器)

#### 服务器信息
- **地址**: 47.242.80.65:3021
- **域名**: https://shenyuan.mylumee.cn
- **进程管理**: PM2

#### 部署步骤

1. **更新代码**
```bash
ssh -i ~/.ssh/hk root@47.242.80.65
cd /root/projects/shenyuan
git pull origin main
```

2. **重启服务**
```bash
pm2 restart shenyuan
pm2 logs shenyuan  # 查看日志
```

3. **验证部署**
```bash
curl https://shenyuan.mylumee.cn/api/kpi/metrics
```

#### 访问地址
```
https://shenyuan.mylumee.cn/docs/kpi-dashboard.html
```

---

## 📈 使用场景

### 场景1: 日常监控 (CMO)
每天上班第一件事打开仪表板，查看：
- DAU / 付费用户 / GMV（趋势）
- 支付方式分布（是否需要优化某个通道）
- 邀请裂变排行（激励Top用户）
- 错误告警（第一时间发现问题）

**时间成本**: ~5 分钟/天

### 场景2: 落地页A/B测试评估
1. 创建新的落地页变体
2. 运行 7-14 天的A/B测试
3. 在仪表板「A/B落地页转化率排行」查看实时排名
4. 自动标记: winning / running / losing
5. 当某个变体显著优于控制组时，切换为新默认

### 场景3: 营销活动效果评估
- 支付趋势图：查看营销投入是否带来收入提升
- 邀请排行榜：找出最活跃的裂变者，进行精准激励
- 地理分布：评估不同地区的市场表现

### 场景4: 风险预警
- 支付失败率 > 5%：立即联系支付服务商排查
- API响应时间 > 2s：可能是数据库或网络问题
- 转化率 > 20% 下降：可能的原因分析
  - 页面上线bug
  - 支付流程异常
  - 市场竞争加剧

---

## 🎯 定制化需求

### 需求1: 添加自定义指标
修改 `server/routes/kpi.js` 中的 `getMetrics()` 函数：

```javascript
function getMetrics(data) {
  // ... 现有代码 ...
  
  // 添加自定义指标
  return {
    // ... 现有指标 ...
    customMetric: calculateCustomMetric(data),
    customMetricChange: 5.2
  };
}
```

### 需求2: 修改刷新频率
编辑 `docs/kpi-dashboard.html`：

```javascript
const REFRESH_INTERVAL = 60000; // 改为 60 秒
```

### 需求3: 添加新的A/B测试
修改 `server/routes/kpi.js` 中的 `getABTestData()` 函数，确保 data.json 包含 `abTests` 数组。

### 需求4: 集成数据库 (推荐)
当前实现从 data.json 读取，建议迁移到：
- **MySQL**: 查询订单表 / 用户表（推荐）
- **MongoDB**: 灵活的文档存储
- **Supabase**: 无运维的PostgreSQL

示例迁移代码：
```javascript
async function getMetrics(data) {
  const db = require('../lib/db'); // 数据库连接

  // 从数据库查询今日订单
  const todayOrders = await db.query(`
    SELECT COUNT(*) as count, SUM(amount) as gmv 
    FROM orders 
    WHERE DATE(created_at) = CURRENT_DATE 
    AND status = 'paid'
  `);

  return {
    gmv: todayOrders[0].gmv,
    orderCount: todayOrders[0].count,
    // ... 其他指标
  };
}
```

---

## 📊 数据缓存策略

### 现状
- 每次请求都从 data.json 读取（简单但低效）
- 适合 DAU < 10K 的场景

### 优化方案 (推荐)
使用 Redis 缓存：

```javascript
const redis = require('redis');
const client = redis.createClient();

router.get('/metrics', async (req, res) => {
  // 先查缓存
  const cached = await client.get('kpi:metrics');
  if (cached) {
    return res.json(JSON.parse(cached));
  }

  // 计算指标
  const metrics = getMetrics(data);

  // 写入缓存 (TTL: 30 秒)
  await client.setex('kpi:metrics', 30, JSON.stringify(metrics));

  res.json(metrics);
});
```

---

## 🚨 故障排查

### 问题1: 仪表板显示「连接失败」
**排查步骤:**
1. 检查后端服务是否启动: `curl http://localhost:3021/api/kpi/metrics`
2. 检查 CORS 配置: server/index.js 的 ALLOWED_ORIGINS
3. 查看浏览器控制台错误

**解决方案:**
```bash
# 查看后端日志
cd /Users/karen/projects/shenyuan/server
tail -f logs/app.log

# 重启服务
pm2 restart shenyuan
```

### 问题2: data.json 找不到
**原因:** KPI路由 require 路径错误

**解决方案:**
```javascript
// server/routes/kpi.js 第 9 行
const DATA_FILE = path.join(__dirname, '../data.json');
// 确保路径正确，可用 console.log(__dirname) 验证
```

### 问题3: 图表不显示
**排查步骤:**
1. 检查 Chart.js 和 ECharts CDN 是否加载
2. 打开浏览器控制台查看 JS 错误
3. 检查 API 返回的数据格式

**解决方案:**
```html
<!-- 在 kpi-dashboard.html <head> 中验证 -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
```

### 问题4: 数据延迟 > 5 分钟
**原因:** 数据源更新不及时

**解决方案:**
- 从 data.json 迁移到数据库（关键）
- 添加实时事件流（支付成功时推送到队列）
- 使用 WebSocket 替代轮询

---

## 🔐 安全考虑

### 认证与授权
当前实现不需要特殊认证，但建议添加：

```javascript
// 添加管理员鉴权
router.get('/metrics', requireAuth(['admin', 'cmo']), (req, res) => {
  // ...
});
```

### 数据脱敏
确保不泄露用户隐私信息：

```javascript
// ✓ 安全 - 只返回聚合数据
{ dau: 1234, gmv: 12500 }

// ✗ 不安全 - 泄露用户ID
{ userIds: ['user_123', 'user_456'] }
```

### 速率限制
防止恶意爬取：

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 60 * 1000,     // 1 分钟
  max: 10,                 // 10 次请求
  message: '请求过于频繁'
});

router.get('/metrics', limiter, (req, res) => { /* ... */ });
```

---

## 📱 移动端适配

仪表板已实现全响应式设计：
- ✓ 桌面端 (1920px+)
- ✓ 平板 (768px-1200px)
- ✓ 手机 (< 768px)

**测试方法:**
```
Chrome DevTools → Toggle Device Toolbar (Ctrl+Shift+M)
```

---

## 🎓 学习资源

- Chart.js 文档: https://www.chartjs.org/
- ECharts 文档: https://echarts.apache.org/
- 业界标准KPI: https://en.wikipedia.org/wiki/Key_performance_indicator

---

## 📞 支持与反馈

- **问题报告**: 在仪表板右下角点击「反馈」
- **功能建议**: 联系 CMO / 产品经理
- **技术支持**: 查看 `/api/kpi/docs` 在线文档

---

**版本**: v1.0
**最后更新**: 2026-08-08
**维护者**: 善缘开发团队
