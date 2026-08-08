#!/usr/bin/env node

/**
 * analytics-export.js
 * 从data.json导出各维度的分析数据
 *
 * Usage: node server/analytics-export.js [dimension] [format] [output]
 *   dimension: all, daily, cohort, funnel, traffic, products, payment, retention
 *   format: json, csv (default: json)
 *   output: 输出文件路径 (default: stdout)
 *
 * Examples:
 *   node server/analytics-export.js cohort json export/cohort.json
 *   node server/analytics-export.js traffic csv export/traffic.csv
 *   node server/analytics-export.js funnel json
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, './data.json');
const EXPORT_DIR = path.join(__dirname, '../server/export');

// 确保export目录存在
if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

/**
 * 加载数据
 */
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    console.warn('⚠️  data.json 不存在');
    return { daily_stats: {}, events: [], users: [] };
  }

  try {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error('❌ 读取data.json失败:', e.message);
    process.exit(1);
  }
}

/**
 * 导出日报数据
 */
function exportDaily(data) {
  const daily = data.daily_stats || {};
  const dates = Object.keys(daily).sort();

  return {
    export_type: 'daily_stats',
    record_count: dates.length,
    generated_at: new Date().toISOString(),
    data: dates.map(date => ({
      date,
      ...daily[date]
    }))
  };
}

/**
 * 导出cohort留存数据
 */
function exportCohort(data) {
  const users = data.users || [];

  // 按注册日期分组
  const cohorts = {};
  users.forEach(user => {
    const cohortDate = user.signup_date?.split('T')[0];
    if (!cohortDate) return;

    if (!cohorts[cohortDate]) {
      cohorts[cohortDate] = [];
    }
    cohorts[cohortDate].push(user);
  });

  // 计算每个cohort的留存
  const cohortRetention = Object.entries(cohorts)
    .sort()
    .map(([cohortDate, users]) => {
      const cohortSize = users.length;
      const signupTime = new Date(cohortDate).getTime();

      // 计算不同day的留存
      const retention = {
        cohort_date: cohortDate,
        size: cohortSize,
        day1: 0,
        day3: 0,
        day7: 0,
        day14: 0,
        day30: 0
      };

      users.forEach(user => {
        if (!user.last_active) return;

        const lastActiveTime = new Date(user.last_active).getTime();
        const daysSinceSignup = Math.floor((lastActiveTime - signupTime) / (1000 * 60 * 60 * 24));

        if (daysSinceSignup >= 0) retention.day1++;
        if (daysSinceSignup >= 2) retention.day3++;
        if (daysSinceSignup >= 6) retention.day7++;
        if (daysSinceSignup >= 13) retention.day14++;
        if (daysSinceSignup >= 29) retention.day30++;
      });

      // 转换为百分比
      return {
        ...retention,
        day1_rate: ((retention.day1 / cohortSize) * 100).toFixed(1),
        day3_rate: ((retention.day3 / cohortSize) * 100).toFixed(1),
        day7_rate: ((retention.day7 / cohortSize) * 100).toFixed(1),
        day14_rate: ((retention.day14 / cohortSize) * 100).toFixed(1),
        day30_rate: ((retention.day30 / cohortSize) * 100).toFixed(1)
      };
    });

  return {
    export_type: 'cohort_retention',
    record_count: cohortRetention.length,
    generated_at: new Date().toISOString(),
    data: cohortRetention
  };
}

/**
 * 导出转化漏斗
 */
function exportFunnel(data) {
  const daily = data.daily_stats || {};
  const funnelData = [];

  Object.keys(daily)
    .sort()
    .forEach(date => {
      const day = daily[date];
      funnelData.push({
        date,
        page_views: day.page_views || 0,
        report_generated: day.report_generated || 0,
        checkout_started: day.checkout_started || 0,
        payment_completed: day.payment_completed || 0,
        payment_completed_rate: day.page_views > 0
          ? ((day.payment_completed / day.page_views) * 100).toFixed(2)
          : '0.00'
      });
    });

  // 聚合数据
  const aggregate = {
    total_views: funnelData.reduce((sum, d) => sum + d.page_views, 0),
    total_reports: funnelData.reduce((sum, d) => sum + d.report_generated, 0),
    total_checkouts: funnelData.reduce((sum, d) => sum + d.checkout_started, 0),
    total_payments: funnelData.reduce((sum, d) => sum + d.payment_completed, 0)
  };

  return {
    export_type: 'funnel_analysis',
    record_count: funnelData.length,
    generated_at: new Date().toISOString(),
    aggregate: {
      ...aggregate,
      view_to_report_rate: aggregate.total_views > 0
        ? ((aggregate.total_reports / aggregate.total_views) * 100).toFixed(2)
        : '0.00',
      report_to_checkout_rate: aggregate.total_reports > 0
        ? ((aggregate.total_checkouts / aggregate.total_reports) * 100).toFixed(2)
        : '0.00',
      checkout_to_payment_rate: aggregate.total_checkouts > 0
        ? ((aggregate.total_payments / aggregate.total_checkouts) * 100).toFixed(2)
        : '0.00'
    },
    daily: funnelData
  };
}

/**
 * 导出流量来源
 */
function exportTraffic(data) {
  const daily = data.daily_stats || {};
  const traffic = {};

  Object.values(daily).forEach(day => {
    Object.entries(day.top_sources || {}).forEach(([source, count]) => {
      traffic[source] = (traffic[source] || 0) + count;
    });
  });

  const trafficArray = Object.entries(traffic)
    .sort((a, b) => b[1] - a[1])
    .map(([source, visits], idx) => ({
      rank: idx + 1,
      source,
      visits,
      percentage: ((visits / Object.values(traffic).reduce((a, b) => a + b, 0)) * 100).toFixed(2)
    }));

  return {
    export_type: 'traffic_sources',
    record_count: trafficArray.length,
    generated_at: new Date().toISOString(),
    total_visits: trafficArray.reduce((sum, t) => sum + t.visits, 0),
    data: trafficArray
  };
}

/**
 * 导出商品销售
 */
function exportProducts(data) {
  const daily = data.daily_stats || {};
  const products = {};

  Object.values(daily).forEach(day => {
    Object.entries(day.top_products || {}).forEach(([product, count]) => {
      products[product] = (products[product] || 0) + count;
    });
  });

  const productArray = Object.entries(products)
    .sort((a, b) => b[1] - a[1])
    .map(([product, orders], idx) => ({
      rank: idx + 1,
      product,
      orders,
      percentage: ((orders / Object.values(products).reduce((a, b) => a + b, 0)) * 100).toFixed(2)
    }));

  return {
    export_type: 'product_sales',
    record_count: productArray.length,
    generated_at: new Date().toISOString(),
    total_orders: productArray.reduce((sum, p) => sum + p.orders, 0),
    data: productArray
  };
}

/**
 * 导出支付方式
 */
function exportPayment(data) {
  const daily = data.daily_stats || {};
  const payments = {};

  Object.values(daily).forEach(day => {
    Object.entries(day.payment_methods || {}).forEach(([method, count]) => {
      payments[method] = (payments[method] || 0) + count;
    });
  });

  const paymentArray = Object.entries(payments)
    .sort((a, b) => b[1] - a[1])
    .map(([method, count], idx) => ({
      rank: idx + 1,
      method,
      count,
      percentage: ((count / Object.values(payments).reduce((a, b) => a + b, 0)) * 100).toFixed(2)
    }));

  return {
    export_type: 'payment_methods',
    record_count: paymentArray.length,
    generated_at: new Date().toISOString(),
    total: paymentArray.reduce((sum, p) => sum + p.count, 0),
    data: paymentArray
  };
}

/**
 * 导出留存率
 */
function exportRetention(data) {
  const users = data.users || [];
  const cohorts = {};

  users.forEach(user => {
    const cohortDate = user.signup_date?.split('T')[0];
    if (!cohortDate) return;

    if (!cohorts[cohortDate]) {
      cohorts[cohortDate] = {
        date: cohortDate,
        signups: 0,
        active_day1: 0,
        active_day3: 0,
        active_day7: 0,
        active_day14: 0,
        active_day30: 0
      };
    }

    cohorts[cohortDate].signups++;

    if (!user.last_active) return;

    const signupTime = new Date(cohortDate).getTime();
    const lastActiveTime = new Date(user.last_active).getTime();
    const daysSince = Math.floor((lastActiveTime - signupTime) / (1000 * 60 * 60 * 24));

    if (daysSince >= 0) cohorts[cohortDate].active_day1++;
    if (daysSince >= 2) cohorts[cohortDate].active_day3++;
    if (daysSince >= 6) cohorts[cohortDate].active_day7++;
    if (daysSince >= 13) cohorts[cohortDate].active_day14++;
    if (daysSince >= 29) cohorts[cohortDate].active_day30++;
  });

  const retentionArray = Object.values(cohorts)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(c => ({
      ...c,
      day1_rate: ((c.active_day1 / c.signups) * 100).toFixed(1),
      day3_rate: ((c.active_day3 / c.signups) * 100).toFixed(1),
      day7_rate: ((c.active_day7 / c.signups) * 100).toFixed(1),
      day14_rate: ((c.active_day14 / c.signups) * 100).toFixed(1),
      day30_rate: ((c.active_day30 / c.signups) * 100).toFixed(1)
    }));

  return {
    export_type: 'retention_analysis',
    record_count: retentionArray.length,
    generated_at: new Date().toISOString(),
    data: retentionArray
  };
}

/**
 * 导出所有数据
 */
function exportAll(data) {
  return {
    generated_at: new Date().toISOString(),
    exports: {
      daily: exportDaily(data),
      funnel: exportFunnel(data),
      cohort: exportCohort(data),
      traffic: exportTraffic(data),
      products: exportProducts(data),
      payment: exportPayment(data),
      retention: exportRetention(data)
    }
  };
}

/**
 * 转换为CSV格式
 */
function jsonToCsv(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return '';
  }

  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h];
        if (typeof val === 'string' && val.includes(',')) {
          return `"${val}"`;
        }
        return val;
      }).join(',')
    )
  ];

  return csv.join('\n');
}

/**
 * 保存文件
 */
function saveFile(content, format, outputPath) {
  if (!outputPath) {
    console.log(content);
    return;
  }

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const contentStr = format === 'json' ? JSON.stringify(content, null, 2) : content;
  fs.writeFileSync(outputPath, contentStr, 'utf8');

  console.log(`✅ 数据已导出: ${outputPath}`);
}

/**
 * 主函数
 */
function main() {
  const dimension = process.argv[2] || 'all';
  const format = process.argv[3] || 'json';
  let outputPath = process.argv[4];

  if (outputPath && !path.isAbsolute(outputPath)) {
    outputPath = path.join(EXPORT_DIR, outputPath);
  }

  const data = loadData();

  let result;

  switch (dimension) {
    case 'daily':
      result = exportDaily(data);
      break;
    case 'cohort':
      result = exportCohort(data);
      break;
    case 'funnel':
      result = exportFunnel(data);
      break;
    case 'traffic':
      result = exportTraffic(data);
      break;
    case 'products':
      result = exportProducts(data);
      break;
    case 'payment':
      result = exportPayment(data);
      break;
    case 'retention':
      result = exportRetention(data);
      break;
    case 'all':
      result = exportAll(data);
      break;
    default:
      console.error(`❌ 未知维度: ${dimension}`);
      console.log('支持的维度: all, daily, cohort, funnel, traffic, products, payment, retention');
      process.exit(1);
  }

  if (format === 'csv') {
    if (dimension === 'all') {
      console.error('❌ CSV格式不支持导出所有维度');
      process.exit(1);
    }
    const csvContent = jsonToCsv(result.data);
    saveFile(csvContent, 'csv', outputPath);
  } else {
    saveFile(result, 'json', outputPath);
  }
}

// 导出用于集成
module.exports = {
  loadData,
  exportDaily,
  exportCohort,
  exportFunnel,
  exportTraffic,
  exportProducts,
  exportPayment,
  exportRetention,
  exportAll,
  jsonToCsv
};

if (require.main === module) {
  main();
}
