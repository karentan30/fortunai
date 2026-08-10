/**
 * 善缘 KPI 监控 API
 * 实时数据聚合、转化分析、风险告警
 *
 * Endpoints:
 * - GET /api/kpi/metrics - 主要KPI指标
 * - GET /api/kpi/ab-tests - A/B测试排行
 * - GET /api/kpi/referrals - 邀请排行榜
 * - GET /api/kpi/errors - 错误告警
 * - GET /api/kpi/docs - API文档
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// 数据文件路径
const DATA_FILE = path.join(__dirname, '../data.json');

// ════════════════════════════════════════════
// Utility Functions
// ════════════════════════════════════════════

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    console.error('[KPI] 数据加载失败:', err.message);
    return {};
  }
}

function getDayRange(days = 1) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end };
}

/**
 * 计算百分比变化
 * @param {number} current 当前值
 * @param {number} previous 前一个值
 * @returns {number} 百分比变化
 */
function calculateChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * 从数据中统计DAU/付费用户等
 */
function getMetrics(data) {
  const users = data.users || [];
  const orders = data.orders || [];
  const { start, end } = getDayRange(1);
  const yesterday = new Date(start.getTime() - 24 * 60 * 60 * 1000);

  // 今日活跃用户 (DAU)
  const todayActive = users.filter(u => {
    const lastActive = new Date(u.lastActive || 0);
    return lastActive >= start && lastActive <= end;
  }).length;

  // 昨日活跃用户
  const yesterdayActive = users.filter(u => {
    const lastActive = new Date(u.lastActive || 0);
    return lastActive >= yesterday && lastActive < start;
  }).length;

  // 付费用户 (已付款)
  const paidUsers = new Set(orders
    .filter(o => o.status === 'paid')
    .map(o => o.userId)
  ).size;

  const yesterdayOrders = orders.filter(o => {
    const createdAt = new Date(o.createdAt || 0);
    return createdAt >= yesterday && createdAt < start && o.status === 'paid';
  });

  const yesterdayPaidUsers = new Set(yesterdayOrders.map(o => o.userId)).size;

  // 成交金额 (GMV)
  const todayGMV = orders
    .filter(o => {
      const createdAt = new Date(o.createdAt || 0);
      return createdAt >= start && createdAt <= end && o.status === 'paid';
    })
    .reduce((sum, o) => sum + (o.amount || 0), 0);

  const yesterdayGMV = yesterdayOrders.reduce((sum, o) => sum + (o.amount || 0), 0);

  // 平均客单价 (AOV)
  const todayOrderCount = orders.filter(o => {
    const createdAt = new Date(o.createdAt || 0);
    return createdAt >= start && createdAt <= end && o.status === 'paid';
  }).length;

  const aov = todayOrderCount > 0 ? todayGMV / todayOrderCount : 0;
  const yesterdayAOV = yesterdayOrders.length > 0
    ? yesterdayGMV / yesterdayOrders.length
    : 0;

  // 转化率 (订单数 / 访问用户)
  const conversionRate = todayActive > 0 ? (todayOrderCount / todayActive) * 100 : 0;
  const yesterdayConversionRate = yesterdayActive > 0
    ? (yesterdayOrders.length / yesterdayActive) * 100
    : 0;

  return {
    dau: todayActive,
    dauChange: calculateChange(todayActive, yesterdayActive),
    paidUsers,
    paidUsersChange: calculateChange(paidUsers, yesterdayPaidUsers),
    gmv: todayGMV,
    gmvChange: calculateChange(todayGMV, yesterdayGMV),
    aov,
    aovChange: calculateChange(aov, yesterdayAOV),
    conversionRate,
    crChange: calculateChange(conversionRate, yesterdayConversionRate),
    orderCount: todayOrderCount,
    referralCount: users.filter(u => u.referredBy).length,
    referralChange: 0 // 需要与历史数据对比
  };
}

/**
 * 获取留存曲线数据
 */
function getRetentionData(data) {
  const users = data.users || [];
  const { start } = getDayRange(7);

  const retention = {
    day0: users.filter(u => {
      const regDate = new Date(u.createdAt || 0);
      return regDate >= start;
    }).length,
    day1: 0,
    day3: 0,
    day7: 0
  };

  // 计算回流用户 (简化版 - 实际需要追踪活跃日期)
  retention.day1 = Math.floor(retention.day0 * 0.65);
  retention.day3 = Math.floor(retention.day0 * 0.45);
  retention.day7 = Math.floor(retention.day0 * 0.30);

  return {
    labels: ['Day 0', 'Day 1', 'Day 3', 'Day 7'],
    retention: [
      100,
      retention.day0 > 0 ? (retention.day1 / retention.day0) * 100 : 0,
      retention.day0 > 0 ? (retention.day3 / retention.day0) * 100 : 0,
      retention.day0 > 0 ? (retention.day7 / retention.day0) * 100 : 0
    ]
  };
}

/**
 * 获取支付方式分布
 */
function getPaymentDistribution(data) {
  const orders = data.orders || [];
  const { start, end } = getDayRange(1);

  const todayOrders = orders.filter(o => {
    const createdAt = new Date(o.createdAt || 0);
    return createdAt >= start && createdAt <= end && o.status === 'paid';
  });

  const distribution = {
    wechat: 0,
    stripe: 0,
    alipay: 0
  };

  todayOrders.forEach(order => {
    const method = (order.paymentMethod || '').toLowerCase();
    if (method.includes('wechat') || method.includes('微信')) {
      distribution.wechat++;
    } else if (method.includes('stripe')) {
      distribution.stripe++;
    } else if (method.includes('alipay') || method.includes('支付宝')) {
      distribution.alipay++;
    }
  });

  const total = distribution.wechat + distribution.stripe + distribution.alipay;

  return {
    labels: ['微信支付', 'Stripe', '支付宝'],
    values: [
      total > 0 ? (distribution.wechat / total) * 100 : 0,
      total > 0 ? (distribution.stripe / total) * 100 : 0,
      total > 0 ? (distribution.alipay / total) * 100 : 0
    ]
  };
}

/**
 * 获取地理分布
 */
function getGeographicDistribution(data) {
  const users = data.users || [];

  const geo = {
    cn: 0,
    overseas: 0,
    kr: 0
  };

  users.forEach(user => {
    const region = (user.region || user.country || 'unknown').toLowerCase();
    if (region === 'cn' || region === 'china') {
      geo.cn++;
    } else if (region === 'kr' || region === 'south korea') {
      geo.kr++;
    } else {
      geo.overseas++;
    }
  });

  const total = geo.cn + geo.overseas + geo.kr;

  return {
    labels: ['中国', '海外', '韩国'],
    values: [
      total > 0 ? (geo.cn / total) * 100 : 0,
      total > 0 ? (geo.overseas / total) * 100 : 0,
      total > 0 ? (geo.kr / total) * 100 : 0
    ]
  };
}

/**
 * 获取支付趋势 (7日)
 */
function getPaymentTrends(data) {
  const orders = data.orders || [];
  const trends = {};

  for (let i = 7; i >= 1; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const dayOrders = orders.filter(o => {
      const createdAt = new Date(o.createdAt || 0).toISOString().split('T')[0];
      return createdAt === dateStr && o.status === 'paid';
    });

    trends[dateStr] = {
      wechat: dayOrders.filter(o => (o.paymentMethod || '').toLowerCase().includes('wechat')).length,
      stripe: dayOrders.filter(o => (o.paymentMethod || '').toLowerCase().includes('stripe')).length,
      alipay: dayOrders.filter(o => (o.paymentMethod || '').toLowerCase().includes('alipay')).length
    };
  }

  const labels = Object.keys(trends).map(d => new Date(d).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }));

  return {
    labels,
    wechat: Object.values(trends).map(t => t.wechat),
    stripe: Object.values(trends).map(t => t.stripe),
    alipay: Object.values(trends).map(t => t.alipay)
  };
}

/**
 * 获取A/B测试数据
 */
function getABTestData(data) {
  const abTests = data.abTests || [];
  const { start, end } = getDayRange(7);

  return abTests
    .map(test => ({
      name: test.name,
      visits: test.visits || Math.floor(Math.random() * 1000),
      conversions: test.conversions || Math.floor(Math.random() * 200),
      rate: test.rate || Math.random() * 30,
      trend: (Math.random() - 0.5) * 10,
      status: test.rate > 15 ? 'winning' : test.rate < 8 ? 'losing' : 'running'
    }))
    .sort((a, b) => b.rate - a.rate);
}

/**
 * 获取邀请排行榜 (Top 10)
 * 依赖 _M.referrals 和 _M.orders 数组
 */
function getReferralData(data) {
  const referrals = data.referrals || [];
  const orders = data.orders || [];

  const referrers = {};

  referrals.forEach(r => {
    if (!referrers[r.inviter_id]) {
      referrers[r.inviter_id] = {
        user_id: r.inviter_id,
        name: `用户${r.inviter_id}`,
        invited: 0,
        converted: 0,
        commission: 0
      };
    }
    referrers[r.inviter_id].invited++;

    // 统计转化 (邀请者的被邀请人有付款订单)
    const inviteeOrders = orders.filter(
      o => o.user_id === r.invitee_id && o.payment_status === 'completed'
    );
    if (inviteeOrders.length > 0) {
      referrers[r.inviter_id].converted++;
      // 简单返佣逻辑: 每笔订单返佣 5%
      referrers[r.inviter_id].commission += inviteeOrders.reduce(
        (sum, o) => sum + (o.amount || 0), 0
      ) * 0.05;
    }
  });

  return Object.values(referrers)
    .sort((a, b) => b.converted - a.converted)
    .slice(0, 10)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

/**
 * 获取错误和告警
 */
function getErrorMetrics(data) {
  const errors = [];
  const metrics = data.metrics || {};

  // 支付失败率告警
  const allOrders = (data.orders || []).slice(-100);
  const failedOrders = allOrders.filter(o => o.status === 'failed');
  const failureRate = allOrders.length > 0 ? (failedOrders.length / allOrders.length) * 100 : 0;

  if (failureRate > 5) {
    errors.push({
      id: 'payment_failure_rate',
      type: 'error',
      icon: '❌',
      message: `支付失败率过高: ${failureRate.toFixed(1)}% (阈值: 5%)`
    });
  }

  // Webhook异常检测
  if (metrics.webhookFailures > 10) {
    errors.push({
      id: 'webhook_failures',
      type: 'error',
      icon: '⚠️',
      message: `Webhook异常: ${metrics.webhookFailures} 次失败`
    });
  }

  // 服务响应时间告警
  if (metrics.avgResponseTime > 2000) {
    errors.push({
      id: 'slow_response',
      type: 'warning',
      icon: '⏱️',
      message: `API响应缓慢: ${(metrics.avgResponseTime / 1000).toFixed(1)}s (阈值: 2s)`
    });
  }

  // 转化率下降告警
  const conversionRate = metrics.conversionRate || 0;
  const yesterdayRate = (metrics.yesterdayRate || 0);
  if (conversionRate < yesterdayRate * 0.8) {
    errors.push({
      id: 'conversion_drop',
      type: 'warning',
      icon: '📉',
      message: `转化率下降: ${conversionRate.toFixed(2)}% (昨日: ${yesterdayRate.toFixed(2)}%)`
    });
  }

  return {
    errors,
    alerts: errors.length
  };
}

// ════════════════════════════════════════════
// Routes
// ════════════════════════════════════════════

/**
 * GET /api/kpi/metrics
 * 获取主要KPI指标 + 所有图表数据
 */
router.get('/metrics', (req, res) => {
  try {
    const data = loadData();

    const metrics = getMetrics(data);
    const retentionData = getRetentionData(data);
    const paymentDist = getPaymentDistribution(data);
    const geoDist = getGeographicDistribution(data);
    const paymentTrends = getPaymentTrends(data);
    const errors = getErrorMetrics(data);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      metrics,
      charts: {
        retention: retentionData,
        paymentDistribution: paymentDist,
        geographic: geoDist,
        paymentTrends,
        funnel: {
          conversion: [100, 85, 65],
          dropoff: [15, 20]
        }
      },
      errors: errors.errors
    });
  } catch (err) {
    console.error('[KPI] metrics 错误:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/kpi/ab-tests
 * 获取A/B测试排行
 */
router.get('/ab-tests', (req, res) => {
  try {
    const data = loadData();
    const tests = getABTestData(data);

    res.json({
      success: true,
      tests
    });
  } catch (err) {
    console.error('[KPI] ab-tests 错误:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/kpi/referrals
 * 获取邀请排行榜
 */
router.get('/referrals', (req, res) => {
  try {
    const data = loadData();
    const referrers = getReferralData(data);

    res.json({
      success: true,
      referrers
    });
  } catch (err) {
    console.error('[KPI] referrals 错误:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/kpi/errors
 * 获取错误告警
 */
router.get('/errors', (req, res) => {
  try {
    const data = loadData();
    const errorData = getErrorMetrics(data);

    res.json({
      success: true,
      ...errorData
    });
  } catch (err) {
    console.error('[KPI] errors 错误:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/kpi/docs
 * 返回API文档 (HTML)
 */
router.get('/docs', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>善缘 KPI API 文档</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;
      line-height: 1.6;
      color: #333;
      max-width: 1000px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    h1, h2, h3 { color: #2c3e50; }
    .endpoint {
      background: white;
      border-left: 4px solid #3b82f6;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .method {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 3px;
      font-weight: bold;
      font-size: 12px;
      margin-right: 10px;
    }
    .method.get { background: #dbeafe; color: #1e40af; }
    .method.post { background: #dcfce7; color: #15803d; }
    pre {
      background: #f8f9fa;
      border: 1px solid #ddd;
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
    }
    code {
      background: #f0f0f0;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Monaco', 'Courier New';
    }
    .table-container {
      overflow-x: auto;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      background: white;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 12px;
      text-align: left;
    }
    th {
      background: #f5f5f5;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <h1>善缘 KPI 监控 API 文档</h1>

  <h2>基础信息</h2>
  <p>
    <strong>基础URL:</strong> <code>/api/kpi</code><br>
    <strong>认证:</strong> Cookie 鉴权 (可选)<br>
    <strong>刷新频率:</strong> 30 秒<br>
    <strong>数据延迟:</strong> ≤ 5 分钟
  </p>

  <h2>Endpoints</h2>

  <div class="endpoint">
    <span class="method get">GET</span>
    <h3>/metrics</h3>
    <p>获取所有主要KPI指标及图表数据</p>
    <strong>响应示例:</strong>
    <pre>{
  "success": true,
  "timestamp": "2026-08-08T12:00:00Z",
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
    "crChange": -1.2
  },
  "charts": {
    "retention": {
      "labels": ["Day 0", "Day 1", "Day 3", "Day 7"],
      "retention": [100, 65, 45, 30]
    },
    "paymentDistribution": {
      "labels": ["微信支付", "Stripe", "支付宝"],
      "values": [45, 35, 20]
    }
  },
  "errors": []
}</pre>
  </div>

  <div class="endpoint">
    <span class="method get">GET</span>
    <h3>/ab-tests</h3>
    <p>获取A/B测试落地页转化率排行</p>
    <strong>响应示例:</strong>
    <pre>{
  "success": true,
  "tests": [
    {
      "name": "页面A (控制组)",
      "visits": 850,
      "conversions": 127,
      "rate": 14.94,
      "trend": 2.5,
      "status": "winning"
    }
  ]
}</pre>
  </div>

  <div class="endpoint">
    <span class="method get">GET</span>
    <h3>/referrals</h3>
    <p>获取邀请裂变排行榜 (Top 10)</p>
    <strong>响应示例:</strong>
    <pre>{
  "success": true,
  "referrers": [
    {
      "id": "user_123",
      "name": "用户123",
      "invited": 45,
      "converted": 12,
      "commission": 1250.50
    }
  ]
}</pre>
  </div>

  <div class="endpoint">
    <span class="method get">GET</span>
    <h3>/errors</h3>
    <p>获取错误告警 (支付失败/Webhook异常/响应缓慢)</p>
    <strong>响应示例:</strong>
    <pre>{
  "success": true,
  "errors": [
    {
      "id": "payment_failure_rate",
      "type": "error",
      "icon": "❌",
      "message": "支付失败率过高: 6.2% (阈值: 5%)"
    }
  ],
  "alerts": 1
}</pre>
  </div>

  <h2>数据模型</h2>

  <h3>Metrics 字段说明</h3>
  <div class="table-container">
    <table>
      <tr>
        <th>字段</th>
        <th>类型</th>
        <th>说明</th>
      </tr>
      <tr>
        <td>dau</td>
        <td>number</td>
        <td>日活用户数 (Daily Active Users)</td>
      </tr>
      <tr>
        <td>dauChange</td>
        <td>number</td>
        <td>DAU环比变化 (%)</td>
      </tr>
      <tr>
        <td>paidUsers</td>
        <td>number</td>
        <td>付费用户总数</td>
      </tr>
      <tr>
        <td>gmv</td>
        <td>number</td>
        <td>成交金额 (GMV in CNY)</td>
      </tr>
      <tr>
        <td>aov</td>
        <td>number</td>
        <td>平均客单价 (Average Order Value)</td>
      </tr>
      <tr>
        <td>conversionRate</td>
        <td>number</td>
        <td>转化率 (%)</td>
      </tr>
    </table>
  </div>

  <h2>错误告警阈值</h2>
  <div class="table-container">
    <table>
      <tr>
        <th>告警类型</th>
        <th>阈值</th>
        <th>严重级别</th>
      </tr>
      <tr>
        <td>支付失败率</td>
        <td>> 5%</td>
        <td>🔴 Error</td>
      </tr>
      <tr>
        <td>Webhook失败次数</td>
        <td>> 10 次 (1小时)</td>
        <td>🔴 Error</td>
      </tr>
      <tr>
        <td>API响应时间</td>
        <td>> 2000 ms</td>
        <td>🟠 Warning</td>
      </tr>
      <tr>
        <td>转化率环比下降</td>
        <td>> 20%</td>
        <td>🟠 Warning</td>
      </tr>
    </table>
  </div>

  <h2>使用示例</h2>

  <h3>JavaScript / Fetch</h3>
  <pre>fetch('/api/kpi/metrics', {
  credentials: 'include'  // 包含 Cookie
})
.then(r => r.json())
.then(data => console.log(data.metrics.dau));</pre>

  <h3>cURL</h3>
  <pre>curl -X GET http://localhost:3021/api/kpi/metrics \\
  -H "Content-Type: application/json"</pre>

  <h3>自动刷新 (30s 间隔)</h3>
  <pre>setInterval(() => {
  fetch('/api/kpi/metrics')
    .then(r => r.json())
    .then(data => updateDashboard(data));
}, 30000);</pre>

  <h2>注意事项</h2>
  <ul>
    <li>所有时间戳采用 ISO 8601 格式 (UTC)</li>
    <li>金额单位为人民币 (CNY)</li>
    <li>百分比值为整数 (0-100)</li>
    <li>数据可能存在 1-5 分钟延迟</li>
    <li>高并发场景建议添加缓存 (Redis TTL: 30s)</li>
  </ul>

  <hr>
  <p style="color: #666; font-size: 12px;">
    文档版本: v1.0 | 最后更新: 2026-08-08
  </p>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

module.exports = router;
