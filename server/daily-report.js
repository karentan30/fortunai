#!/usr/bin/env node

/**
 * daily-report.js
 * 每天早8点自动生成昨天的投放数据报告
 *
 * Usage: node server/daily-report.js [date]
 *   date: YYYY-MM-DD 格式，默认昨天
 *
 * Cron setup:
 *   0 8 * * * cd /Users/karen/projects/shenyuan && node server/daily-report.js
 */

const fs = require('fs');
const path = require('path');

// 数据存储路径
const DATA_DIR = path.join(__dirname, '../server/data');
const DATA_FILE = path.join(__dirname, '../server/data.json');
const REPORTS_DIR = path.join(__dirname, '../server/reports');

// 确保目录存在
[DATA_DIR, REPORTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * 获取指定日期的数据
 */
function getDailyData(dateStr) {
  if (!fs.existsSync(DATA_FILE)) {
    return createEmptyDayRecord();
  }

  try {
    const rawData = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(rawData);

    return data.daily_stats?.[dateStr] || createEmptyDayRecord();
  } catch (e) {
    console.error('Error reading data.json:', e.message);
    return createEmptyDayRecord();
  }
}

/**
 * 创建空记录
 */
function createEmptyDayRecord() {
  return {
    date: new Date().toISOString().split('T')[0],
    page_views: 0,
    unique_visitors: 0,
    report_generated: 0,
    checkout_started: 0,
    payment_completed: 0,
    payment_failed: 0,
    referral_clicked: 0,
    share_clicked: 0,
    revenue: 0,
    currency: 'USD',
    avg_session_duration: 0,
    bounce_rate: 0,
    top_sources: {},
    top_products: {},
    payment_methods: {}
  };
}

/**
 * 计算转化率
 */
function calculateConversions(data) {
  return {
    view_to_checkout: data.page_views > 0
      ? ((data.checkout_started / data.page_views) * 100).toFixed(2)
      : 0,
    checkout_to_payment: data.checkout_started > 0
      ? ((data.payment_completed / data.checkout_started) * 100).toFixed(2)
      : 0,
    view_to_payment: data.page_views > 0
      ? ((data.payment_completed / data.page_views) * 100).toFixed(2)
      : 0,
    payment_success_rate: (data.payment_completed + data.payment_failed) > 0
      ? ((data.payment_completed / (data.payment_completed + data.payment_failed)) * 100).toFixed(2)
      : 0
  };
}

/**
 * 计算关键指标
 */
function calculateMetrics(data) {
  const conversions = calculateConversions(data);
  const dau = data.unique_visitors || 0;
  const arpu = dau > 0 ? (data.revenue / dau).toFixed(2) : 0;

  return {
    dau: dau,
    views: data.page_views,
    reports_generated: data.report_generated,
    checkouts: data.checkout_started,
    payments: data.payment_completed,
    failed_payments: data.payment_failed,
    revenue: data.revenue.toFixed(2),
    arpu: arpu,
    conversions: conversions,
    referrals: data.referral_clicked,
    shares: data.share_clicked,
    avg_session_duration: data.avg_session_duration.toFixed(0),
    bounce_rate: data.bounce_rate.toFixed(1),
    top_sources: sortObject(data.top_sources, 5),
    top_products: sortObject(data.top_products, 5),
    payment_methods: sortObject(data.payment_methods, 5)
  };
}

/**
 * 排序对象并返回前N项
 */
function sortObject(obj, limit = 5) {
  if (!obj || typeof obj !== 'object') return {};

  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .reduce((acc, [key, val]) => {
      acc[key] = val;
      return acc;
    }, {});
}

/**
 * 与前一日对比
 */
function compareToPrevDay(today, yesterday) {
  if (!yesterday) return null;

  return {
    dau_change: ((today.unique_visitors - yesterday.unique_visitors) / (yesterday.unique_visitors || 1) * 100).toFixed(1),
    views_change: ((today.page_views - yesterday.page_views) / (yesterday.page_views || 1) * 100).toFixed(1),
    revenue_change: ((today.revenue - yesterday.revenue) / (yesterday.revenue || 1) * 100).toFixed(1),
    payment_change: ((today.payment_completed - yesterday.payment_completed) / (yesterday.payment_completed || 1) * 100).toFixed(1)
  };
}

/**
 * 生成报告
 */
function generateReport(dateStr) {
  const today = getDailyData(dateStr);
  const yesterday = getDailyData(getYesterdayDate(dateStr));

  const metrics = calculateMetrics(today);
  const comparison = compareToPrevDay(today, yesterday);

  const report = {
    generated_at: new Date().toISOString(),
    date: dateStr,
    summary: {
      dau: metrics.dau,
      revenue: metrics.revenue,
      payments: metrics.payment_completed,
      conversion_rate: metrics.conversions.view_to_payment
    },
    metrics: metrics,
    comparison: comparison,
    insights: generateInsights(today, metrics, comparison),
    data: today
  };

  return report;
}

/**
 * 生成洞察
 */
function generateInsights(data, metrics, comparison) {
  const insights = [];

  // DAU 洞察
  if (comparison && parseFloat(comparison.dau_change) > 20) {
    insights.push({
      type: 'positive',
      message: `DAU环比增长 ${comparison.dau_change}%，保持增长势头`
    });
  } else if (comparison && parseFloat(comparison.dau_change) < -20) {
    insights.push({
      type: 'alert',
      message: `⚠️ DAU环比下降 ${comparison.dau_change}%，需要关注`
    });
  }

  // 转化率洞察
  const ctop = parseFloat(metrics.conversions.view_to_payment);
  if (ctop > 5) {
    insights.push({
      type: 'positive',
      message: `转化率 ${ctop}%，表现优异`
    });
  } else if (ctop < 1) {
    insights.push({
      type: 'warning',
      message: `⚠️ 转化率 ${ctop}%，需优化路径`
    });
  }

  // 支付成功率
  const psr = parseFloat(metrics.conversions.payment_success_rate);
  if (psr < 90) {
    insights.push({
      type: 'alert',
      message: `⚠️ 支付成功率 ${psr}%，有 ${data.payment_failed} 笔失败订单需排查`
    });
  }

  // 顶级来源
  if (Object.keys(data.top_sources).length > 0) {
    const topSource = Object.entries(data.top_sources)[0];
    insights.push({
      type: 'info',
      message: `主要流量来源: ${topSource[0]} (${topSource[1]} 访问)`
    });
  }

  // 最畅销产品
  if (Object.keys(data.top_products).length > 0) {
    const topProduct = Object.entries(data.top_products)[0];
    insights.push({
      type: 'info',
      message: `最畅销产品: ${topProduct[0]} (${topProduct[1]} 笔订单)`
    });
  }

  return insights;
}

/**
 * 获取前一天日期
 */
function getYesterdayDate(dateStr) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
}

/**
 * 保存报告
 */
function saveReport(report) {
  const filename = `report-${report.date}.json`;
  const filepath = path.join(REPORTS_DIR, filename);

  fs.writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`✅ 报告已保存: ${filepath}`);
  return filepath;
}

/**
 * 输出报告到控制台
 */
function printReport(report) {
  console.log('\n' + '='.repeat(60));
  console.log(`📊 善缘投放数据报告 - ${report.date}`);
  console.log('='.repeat(60) + '\n');

  console.log('📈 核心指标:');
  console.log(`  DAU: ${report.summary.dau}`);
  console.log(`  收入: $${report.summary.revenue}`);
  console.log(`  订单数: ${report.summary.payments}`);
  console.log(`  转化率: ${report.summary.conversion_rate}%\n`);

  if (report.comparison) {
    console.log('📊 环比变化:');
    console.log(`  DAU: ${report.comparison.dau_change}%`);
    console.log(`  访问: ${report.comparison.views_change}%`);
    console.log(`  收入: ${report.comparison.revenue_change}%`);
    console.log(`  订单: ${report.comparison.payment_change}%\n`);
  }

  console.log('💡 关键洞察:');
  report.insights.forEach(insight => {
    const icon = insight.type === 'positive' ? '✅' : insight.type === 'alert' ? '🔴' : 'ℹ️';
    console.log(`  ${icon} ${insight.message}`);
  });

  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * 主函数
 */
function main() {
  const dateArg = process.argv[2];
  let targetDate;

  if (dateArg) {
    targetDate = dateArg;
  } else {
    // 默认：昨天
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    targetDate = yesterday.toISOString().split('T')[0];
  }

  console.log(`🚀 生成 ${targetDate} 的投放数据报告...\n`);

  try {
    const report = generateReport(targetDate);
    saveReport(report);
    printReport(report);

    process.exit(0);
  } catch (error) {
    console.error('❌ 报告生成失败:', error.message);
    process.exit(1);
  }
}

// 导出用于测试和集成
module.exports = {
  generateReport,
  getDailyData,
  calculateMetrics,
  saveReport
};

// 如果直接运行
if (require.main === module) {
  main();
}
