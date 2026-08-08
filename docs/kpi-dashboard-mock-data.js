/**
 * KPI 仪表板 Mock 数据生成工具
 * 用于测试和演示仪表板功能
 *
 * 使用方法:
 * node kpi-dashboard-mock-data.js
 */

const fs = require('fs');
const path = require('path');

// ════════════════════════════════════════════
// Mock Data Generator
// ════════════════════════════════════════════

function generateMockData() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // ── Generate Users ──
  const users = [];
  for (let i = 1; i <= 500; i++) {
    const createdAt = new Date(sevenDaysAgo.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000);
    const lastActive = new Date(now.getTime() - Math.random() * 2 * 24 * 60 * 60 * 1000);

    users.push({
      id: `user_${i}`,
      name: `用户${i}`,
      createdAt: createdAt.toISOString(),
      lastActive: lastActive.toISOString(),
      referredBy: Math.random() > 0.75 ? `user_${Math.floor(Math.random() * 100)}` : null,
      region: ['CN', 'KR', 'US', 'SG', 'JP'][Math.floor(Math.random() * 5)]
    });
  }

  // ── Generate Orders ──
  const orders = [];
  const paymentMethods = ['wechat_pay', 'stripe', 'alipay'];
  const orderStatuses = ['paid', 'paid', 'paid', 'paid', 'pending', 'failed']; // 80% paid

  let orderId = 1;
  for (let i = 0; i < 300; i++) {
    const createdAt = new Date(sevenDaysAgo.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000);
    const user = users[Math.floor(Math.random() * users.length)];

    orders.push({
      id: `order_${orderId++}`,
      userId: user.id,
      amount: Math.round((Math.random() * 500 + 50) * 100) / 100, // 50-550 RMB
      paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
      status: orderStatuses[Math.floor(Math.random() * orderStatuses.length)],
      createdAt: createdAt.toISOString()
    });
  }

  // ── Generate A/B Tests ──
  const abTests = [
    {
      name: '页面A (控制组)',
      visits: 850,
      conversions: 127,
      rate: 14.94,
      trend: 2.5,
      status: 'winning'
    },
    {
      name: '页面B (变体1)',
      visits: 820,
      conversions: 114,
      rate: 13.90,
      trend: -1.2,
      status: 'running'
    },
    {
      name: '页面C (变体2)',
      visits: 780,
      conversions: 78,
      rate: 10.00,
      trend: -5.5,
      status: 'losing'
    },
    {
      name: '页面D (变体3)',
      visits: 920,
      conversions: 146,
      rate: 15.87,
      trend: 4.2,
      status: 'winning'
    },
    {
      name: '页面E (变体4)',
      visits: 710,
      conversions: 85,
      rate: 11.97,
      trend: -2.8,
      status: 'running'
    },
    {
      name: '页面F (变体5)',
      visits: 650,
      conversions: 65,
      rate: 10.00,
      trend: 0,
      status: 'running'
    },
    {
      name: '页面G (变体6)',
      visits: 790,
      conversions: 95,
      rate: 12.03,
      trend: -1.9,
      status: 'running'
    },
    {
      name: '页面H (变体7)',
      visits: 880,
      conversions: 105,
      rate: 11.93,
      trend: -3.1,
      status: 'losing'
    }
  ];

  // ── Generate Metrics ──
  const metrics = {
    dau: 1234,
    dauChange: 5.2,
    paidUsers: 345,
    paidUsersChange: 3.1,
    gmv: 12500.50,
    gmvChange: 8.5,
    aov: 36.23,
    aovChange: -2.1,
    conversionRate: 12.5,
    crChange: -1.2,
    orderCount: 345,
    referralCount: 123,
    referralChange: 4.5,
    webhookFailures: 2,
    avgResponseTime: 450
  };

  return {
    users,
    orders,
    abTests,
    metrics,
    generatedAt: now.toISOString()
  };
}

// ════════════════════════════════════════════
// Data Validation
// ════════════════════════════════════════════

function validateData(data) {
  const issues = [];

  if (!Array.isArray(data.users)) {
    issues.push('❌ users 不是数组');
  } else if (data.users.length === 0) {
    issues.push('⚠️  users 为空');
  } else {
    console.log(`✓ Users: ${data.users.length} records`);
  }

  if (!Array.isArray(data.orders)) {
    issues.push('❌ orders 不是数组');
  } else if (data.orders.length === 0) {
    issues.push('⚠️  orders 为空');
  } else {
    const paidOrders = data.orders.filter(o => o.status === 'paid');
    console.log(`✓ Orders: ${data.orders.length} records (${paidOrders.length} paid)`);
  }

  if (!Array.isArray(data.abTests)) {
    issues.push('❌ abTests 不是数组');
  } else if (data.abTests.length < 2) {
    issues.push('⚠️  abTests 至少需要 2 个测试');
  } else {
    console.log(`✓ A/B Tests: ${data.abTests.length} tests`);
  }

  if (!data.metrics || typeof data.metrics !== 'object') {
    issues.push('❌ metrics 对象格式错误');
  } else {
    console.log(`✓ Metrics: ${Object.keys(data.metrics).length} fields`);
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

// ════════════════════════════════════════════
// Main
// ════════════════════════════════════════════

function main() {
  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║  KPI Dashboard Mock Data Generator   ║');
  console.log('╚═══════════════════════════════════════╝\n');

  // Generate data
  console.log('📊 正在生成Mock数据...');
  const mockData = generateMockData();

  // Validate
  console.log('\n🔍 验证数据完整性...');
  const validation = validateData(mockData);

  if (!validation.valid) {
    console.log('\n❌ 数据验证失败:');
    validation.issues.forEach(issue => console.log(`  ${issue}`));
    process.exit(1);
  }

  // Output to data.json
  const dataFile = path.join(__dirname, '..', 'server', 'data.json');
  fs.writeFileSync(dataFile, JSON.stringify(mockData, null, 2));
  console.log(`\n✅ 数据已保存到: ${dataFile}`);

  // Summary
  console.log('\n📋 数据概览:');
  console.log(`  Users: ${mockData.users.length}`);
  console.log(`  Orders: ${mockData.orders.length}`);
  console.log(`  A/B Tests: ${mockData.abTests.length}`);
  console.log(`  GMV: ¥${mockData.metrics.gmv.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`);
  console.log(`  DAU: ${mockData.metrics.dau}`);
  console.log(`  Conversion Rate: ${mockData.metrics.conversionRate.toFixed(2)}%`);

  console.log('\n🚀 下一步:');
  console.log('  1. 启动后端服务: node server/index.js');
  console.log('  2. 打开仪表板: http://localhost:3021/docs/kpi-dashboard.html');
  console.log('  3. 验证数据显示');

  console.log('\n');
}

// Run
if (require.main === module) {
  main();
}

module.exports = { generateMockData, validateData };
