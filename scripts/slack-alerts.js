#!/usr/bin/env node

/**
 * 善缘监控告警系统 - Slack通知模块
 * 功能: 支付事件/邀请激活/服务器健康/异常错误监听+Slack实时通知
 * 部署: pm2 start slack-alerts.js -i 1 --env production
 * 日志: pm2 logs slack-alerts
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

// ============= 配置加载 =============
const CONFIG = {
  // Slack Webhook URLs (从环境变量读取)
  webhooks: {
    alerts: process.env.SLACK_WEBHOOK_ALERTS || 'https://hooks.slack.com/services/YOUR/WEBHOOK/ALERTS',
    payment: process.env.SLACK_WEBHOOK_PAYMENT || 'https://hooks.slack.com/services/YOUR/WEBHOOK/PAYMENT',
    invites: process.env.SLACK_WEBHOOK_INVITES || 'https://hooks.slack.com/services/YOUR/WEBHOOK/INVITES',
    infra: process.env.SLACK_WEBHOOK_INFRA || 'https://hooks.slack.com/services/YOUR/WEBHOOK/INFRA',
  },

  // 服务器设置
  server: {
    port: process.env.ALERT_SERVER_PORT || 3007,
    host: '127.0.0.1', // 仅本地接收(nginx反向代理)
  },

  // 告警阈值
  thresholds: {
    paymentError: 0.05, // 5% 支付失败率触发告警
    paymentDelay: 5000, // 5秒支付处理延迟触发告警
    inviteDropoff: 0.3, // 邀请-激活流失率>30% 触发告警
    serverMemory: 80, // 内存使用>80% 触发告警
    serverDisk: 85, // 磁盘使用>85% 触发告警
    errorRate: 0.02, // 2% 错误率触发告警
    apiResponseTime: 3000, // 3秒API响应时间触发告警
  },

  // 告警缓冲(防止重复告警)
  alertDelay: {
    same: 300, // 同类型告警300秒内只发一次
    critical: 60, // 严重告警60秒内只发一次
  },
};

// ============= 告警状态管理 =============
const AlertState = {
  lastAlerts: {}, // 记录上次告警时间
  metrics: {
    payment: { success: 0, failed: 0, total: 0, avgTime: 0 },
    invites: { sent: 0, activated: 0, total: 0 },
    server: { memory: 0, disk: 0, cpu: 0 },
    api: { errors: 0, requests: 0, slowRequests: 0 },
  },
  lastUpdate: Date.now(),
};

// ============= Slack消息构建器 =============
class SlackMessage {
  static payment(type, data) {
    const color = type === 'success' ? '36a64f' : 'ff0000';
    const emoji = type === 'success' ? ':moneybag:' : ':warning:';

    return {
      attachments: [{
        color,
        title: `${emoji} 支付事件通知`,
        fields: [
          {
            title: '类型',
            value: type === 'success' ? '支付成功' : '支付失败',
            short: true,
          },
          {
            title: '金额',
            value: `¥${data.amount || 0}`,
            short: true,
          },
          {
            title: '订单ID',
            value: data.orderId || 'N/A',
            short: true,
          },
          {
            title: '用户',
            value: data.userId || 'Anonymous',
            short: true,
          },
          {
            title: '时间',
            value: new Date().toLocaleString('zh-CN'),
            short: false,
          },
          ...(data.error ? [{
            title: '错误信息',
            value: `\`${data.error}\``,
            short: false,
          }] : []),
        ],
        footer: '善缘命理平台 | 支付监控',
        ts: Math.floor(Date.now() / 1000),
      }],
    };
  }

  static invite(data) {
    return {
      attachments: [{
        color: '0099ff',
        title: ':rocket: 邀请激活事件',
        fields: [
          {
            title: '邀请者',
            value: data.referrer || 'N/A',
            short: true,
          },
          {
            title: '被邀请者',
            value: data.invitee || 'N/A',
            short: true,
          },
          {
            title: '状态',
            value: data.activated ? '已激活 ✅' : '待激活 ⏳',
            short: true,
          },
          {
            title: '激活时间',
            value: data.activatedAt ? new Date(data.activatedAt).toLocaleString('zh-CN') : '未激活',
            short: true,
          },
          {
            title: '报酬',
            value: data.reward ? `¥${data.reward}` : '-',
            short: true,
          },
          {
            title: '时间',
            value: new Date().toLocaleString('zh-CN'),
            short: true,
          },
        ],
        footer: '善缘命理平台 | 邀请系统',
        ts: Math.floor(Date.now() / 1000),
      }],
    };
  }

  static alert(level, title, details) {
    const colors = {
      critical: 'ff0000',
      warning: 'ff9900',
      info: '0099ff',
    };

    const emojis = {
      critical: ':rotating_light:',
      warning: ':warning:',
      info: ':information_source:',
    };

    return {
      attachments: [{
        color: colors[level] || '999999',
        title: `${emojis[level] || ':grey_question:'} ${title}`,
        text: details,
        footer: '善缘命理平台 | 系统告警',
        ts: Math.floor(Date.now() / 1000),
      }],
    };
  }

  static metric(label, value, unit, status) {
    const color = status === 'good' ? '36a64f' : status === 'warning' ? 'ff9900' : 'ff0000';
    const emoji = status === 'good' ? ':white_check_mark:' : status === 'warning' ? ':warning:' : ':x:';

    return {
      attachments: [{
        color,
        title: `${emoji} ${label}`,
        fields: [{
          title: '数值',
          value: `${value}${unit}`,
          short: true,
        }, {
          title: '状态',
          value: status,
          short: true,
        }, {
          title: '时间',
          value: new Date().toLocaleString('zh-CN'),
          short: false,
        }],
        footer: '善缘命理平台 | 指标监控',
        ts: Math.floor(Date.now() / 1000),
      }],
    };
  }
}

// ============= Slack发送器 =============
function sendToSlack(webhookUrl, payload) {
  return new Promise((resolve, reject) => {
    if (!webhookUrl || webhookUrl.includes('YOUR')) {
      console.warn('[WARN] Slack webhook未配置:', webhookUrl);
      return resolve({ success: false, reason: 'webhook_not_configured' });
    }

    const data = JSON.stringify(payload);
    const parsedUrl = url.parse(webhookUrl);

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({ success: true });
        } else {
          reject(new Error(`Slack API returned ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ============= 告警去重逻辑 =============
function shouldAlert(alertKey, level = 'normal') {
  const now = Date.now();
  const lastAlert = AlertState.lastAlerts[alertKey];
  const delayMs = level === 'critical' ? CONFIG.alertDelay.critical * 1000 : CONFIG.alertDelay.same * 1000;

  if (!lastAlert || (now - lastAlert) > delayMs) {
    AlertState.lastAlerts[alertKey] = now;
    return true;
  }

  return false;
}

// ============= 支付事件处理 =============
async function handlePaymentEvent(data) {
  const { type, amount, orderId, userId, error, processingTime } = data;

  // 更新指标
  AlertState.metrics.payment.total++;
  if (type === 'success') {
    AlertState.metrics.payment.success++;
    AlertState.metrics.payment.avgTime =
      (AlertState.metrics.payment.avgTime + (processingTime || 0)) / 2;
  } else {
    AlertState.metrics.payment.failed++;
  }

  // 发送通知
  const payload = SlackMessage.payment(type, data);
  await sendToSlack(CONFIG.webhooks.payment, payload);

  // 检查支付失败率
  const failureRate = AlertState.metrics.payment.failed / AlertState.metrics.payment.total;
  if (failureRate > CONFIG.thresholds.paymentError && shouldAlert('payment-error-rate', 'warning')) {
    const alertPayload = SlackMessage.alert(
      'warning',
      '支付失败率超过阈值',
      `失败率: ${(failureRate * 100).toFixed(2)}% (阈值: ${(CONFIG.thresholds.paymentError * 100).toFixed(2)}%)\n` +
      `总交易: ${AlertState.metrics.payment.total} | 失败: ${AlertState.metrics.payment.failed}`,
    );
    await sendToSlack(CONFIG.webhooks.alerts, alertPayload);
  }

  // 检查处理延迟
  if (processingTime > CONFIG.thresholds.paymentDelay && shouldAlert('payment-delay', 'warning')) {
    const alertPayload = SlackMessage.alert(
      'warning',
      '支付处理延迟',
      `处理时间: ${processingTime}ms (阈值: ${CONFIG.thresholds.paymentDelay}ms)\n订单: ${orderId}`,
    );
    await sendToSlack(CONFIG.webhooks.alerts, alertPayload);
  }
}

// ============= 邀请事件处理 =============
async function handleInviteEvent(data) {
  const { referrer, invitee, activated, activatedAt, reward } = data;

  // 更新指标
  AlertState.metrics.invites.total++;
  if (activated) {
    AlertState.metrics.invites.activated++;
  }

  // 发送通知
  const payload = SlackMessage.invite(data);
  await sendToSlack(CONFIG.webhooks.invites, payload);

  // 检查激活流失率
  const conversionRate = AlertState.metrics.invites.activated / AlertState.metrics.invites.total;
  if ((1 - conversionRate) > CONFIG.thresholds.inviteDropoff && shouldAlert('invite-dropoff', 'warning')) {
    const alertPayload = SlackMessage.alert(
      'warning',
      '邀请激活流失率过高',
      `流失率: ${((1 - conversionRate) * 100).toFixed(2)}% (阈值: ${(CONFIG.thresholds.inviteDropoff * 100).toFixed(2)}%)\n` +
      `总邀请: ${AlertState.metrics.invites.total} | 激活: ${AlertState.metrics.invites.activated}`,
    );
    await sendToSlack(CONFIG.webhooks.alerts, alertPayload);
  }
}

// ============= 服务器健康事件处理 =============
async function handleServerMetrics(data) {
  const { memory, disk, cpu, errors, requests } = data;

  // 更新指标
  AlertState.metrics.server = { memory, disk, cpu };
  AlertState.metrics.api.errors += errors || 0;
  AlertState.metrics.api.requests += requests || 0;

  // 检查内存使用
  if (memory > CONFIG.thresholds.serverMemory && shouldAlert('server-memory', 'warning')) {
    const payload = SlackMessage.metric('服务器内存占用过高', memory, '%', 'warning');
    await sendToSlack(CONFIG.webhooks.infra, payload);
  }

  // 检查磁盘使用
  if (disk > CONFIG.thresholds.serverDisk && shouldAlert('server-disk', 'warning')) {
    const payload = SlackMessage.metric('服务器磁盘占用过高', disk, '%', 'warning');
    await sendToSlack(CONFIG.webhooks.infra, payload);
  }

  // 检查错误率
  const errorRate = AlertState.metrics.api.errors / Math.max(AlertState.metrics.api.requests, 1);
  if (errorRate > CONFIG.thresholds.errorRate && shouldAlert('api-error-rate', 'warning')) {
    const payload = SlackMessage.alert(
      'warning',
      'API错误率过高',
      `错误率: ${(errorRate * 100).toFixed(2)}% (阈值: ${(CONFIG.thresholds.errorRate * 100).toFixed(2)}%)\n` +
      `总请求: ${AlertState.metrics.api.requests} | 错误: ${AlertState.metrics.api.errors}`,
    );
    await sendToSlack(CONFIG.webhooks.alerts, payload);
  }
}

// ============= HTTP服务器 =============
const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'POST' && req.url === '/alert/payment') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        await handlePaymentEvent(data);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error('Payment alert error:', err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else if (req.method === 'POST' && req.url === '/alert/invite') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        await handleInviteEvent(data);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error('Invite alert error:', err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else if (req.method === 'POST' && req.url === '/alert/server') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        await handleServerMetrics(data);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error('Server metrics alert error:', err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/metrics') {
    res.writeHead(200);
    res.end(JSON.stringify({
      timestamp: new Date().toISOString(),
      metrics: AlertState.metrics,
      uptime: process.uptime(),
    }));
  } else if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'healthy', pid: process.pid }));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

// ============= 启动服务器 =============
server.listen(CONFIG.server.port, CONFIG.server.host, () => {
  console.log(`[START] 善缘告警系统启动`);
  console.log(`[INFO] 监听地址: http://${CONFIG.server.host}:${CONFIG.server.port}`);
  console.log(`[INFO] 端点:`);
  console.log(`  - POST /alert/payment (支付事件)`);
  console.log(`  - POST /alert/invite (邀请事件)`);
  console.log(`  - POST /alert/server (服务器指标)`);
  console.log(`  - GET /metrics (指标查询)`);
  console.log(`  - GET /health (健康检查)`);
});

// ============= 优雅关闭 =============
process.on('SIGTERM', () => {
  console.log('[STOP] 收到SIGTERM信号，优雅关闭...');
  server.close(() => {
    console.log('[EXIT] 服务已关闭');
    process.exit(0);
  });
});

// ============= 错误处理 =============
process.on('unhandledRejection', (reason, promise) => {
  console.error('[ERROR] 未处理的Promise拒绝:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[ERROR] 未捕获的异常:', error);
  process.exit(1);
});
