/**
 * server/test-geo.js
 * 地理定价系统测试脚本
 * 用法: node server/test-geo.js
 */

const { getPricingByCountry, getAllPricing, GEO_PRICING } = require('./config/geo-pricing');

console.log('\n╔════════════════════════════════════════╗');
console.log('║ 善缘地理定价系统 - 测试脚本              ║');
console.log('╚════════════════════════════════════════╝\n');

// ════════════════════════════════════════════
// 测试 1: 验证定价配置
// ════════════════════════════════════════════
console.log('【测试 1】验证所有国家定价完整性\n');

const requiredFields = [
  'country',
  'region',
  'currency',
  'symbol',
  'bazi_full',
  'bazi_vip',
  'hehun_full',
  'member_monthly',
  'member_quarterly',
  'member_yearly',
];

const allPricing = getAllPricing();
let errors = 0;

Object.entries(allPricing).forEach(([countryCode, pricing]) => {
  const missingFields = requiredFields.filter((f) => pricing[f] === undefined);
  if (missingFields.length > 0) {
    console.error(`❌ ${countryCode}: 缺少字段 ${missingFields.join(', ')}`);
    errors++;
  }
});

if (errors === 0) {
  console.log(`✅ 所有 ${Object.keys(allPricing).length} 个国家定价配置完整\n`);
} else {
  console.log(`❌ 发现 ${errors} 个错误\n`);
}

// ════════════════════════════════════════════
// 测试 2: 测试各地区定价
// ════════════════════════════════════════════
console.log('【测试 2】测试各地区定价\n');

const testCases = [
  'US',
  'CN',
  'JP',
  'GB',
  'DE',
  'IN',
  'BR',
  'KR',
  'HK',
  'TW',
  'AU',
  'SG',
  'TH',
  'PL',
  'UNKNOWN',
];

testCases.forEach((country) => {
  const pricing = getPricingByCountry(country);
  console.log(
    `${country.padEnd(10)} → ${pricing.currency.padEnd(4)} ${pricing.symbol} ${String(pricing.bazi_full).padEnd(8)} (${pricing.region})`
  );
});

console.log();

// ════════════════════════════════════════════
// 测试 3: 价格对比
// ════════════════════════════════════════════
console.log('【测试 3】定价对比 - 基础报告 (bazi_full)\n');

const regions = {};

Object.entries(allPricing).forEach(([country, pricing]) => {
  if (!regions[pricing.region]) {
    regions[pricing.region] = [];
  }
  regions[pricing.region].push({
    country,
    currency: pricing.currency,
    price: pricing.bazi_full,
  });
});

Object.entries(regions).forEach(([region, countries]) => {
  console.log(`\n${region.toUpperCase()}`);
  console.log('─'.repeat(50));

  countries.forEach(({ country, currency, price }) => {
    console.log(`  ${country.padEnd(5)} ${currency.padEnd(6)} ${String(price).padStart(10)}`);
  });
});

console.log();

// ════════════════════════════════════════════
// 测试 4: 转化率预测
// ════════════════════════════════════════════
console.log('\n【测试 4】转化率预测 - 相对于 USD $9.90\n');

const usdPrice = 9.90;
const comparisons = [
  { country: 'US', label: 'USA (基准)' },
  { country: 'IN', label: 'India' },
  { country: 'BR', label: 'Brazil' },
  { country: 'JP', label: 'Japan' },
  { country: 'PL', label: 'Poland' },
  { country: 'CN', label: 'China' },
];

console.log('国家'.padEnd(20) + '本地价格'.padEnd(15) + '购买力对比' + '\n' + '─'.repeat(50));

comparisons.forEach(({ country, label }) => {
  const pricing = getPricingByCountry(country);
  const localPrice = pricing.bazi_full;

  // 简单的购买力对比（基于 PPP）
  let purchasingPower = usdPrice / localPrice;
  if (pricing.currency === 'CNY') purchasingPower = (usdPrice * 7.3) / localPrice;
  else if (pricing.currency === 'JPY') purchasingPower = (usdPrice * 140) / localPrice;
  else if (pricing.currency === 'INR') purchasingPower = (usdPrice * 80) / localPrice;
  else if (pricing.currency === 'BRL') purchasingPower = (usdPrice * 4.8) / localPrice;
  else if (pricing.currency === 'PLN') purchasingPower = (usdPrice * 4.0) / localPrice;

  const comparison =
    purchasingPower > 1.0
      ? `💰 价格更便宜 (${(purchasingPower * 100).toFixed(0)}%)`
      : purchasingPower < 1.0
        ? `⬆️ 价格更贵 (${(purchasingPower * 100).toFixed(0)}%)`
        : '═ 等价';

  console.log(
    label.padEnd(20) +
      `${pricing.symbol}${String(localPrice).padEnd(12)}` +
      comparison
  );
});

console.log();

// ════════════════════════════════════════════
// 测试 5: 会员定价对比
// ════════════════════════════════════════════
console.log('\n【测试 5】会员年度价格对比 (member_yearly)\n');

const yearlyComparisons = [
  'US',
  'CN',
  'JP',
  'GB',
  'DE',
  'IN',
];

console.log('国家'.padEnd(10) + '年度会员价格'.padEnd(15) + '月均成本\n' + '─'.repeat(45));

yearlyComparisons.forEach((country) => {
  const pricing = getPricingByCountry(country);
  const yearly = pricing.member_yearly;
  const monthly = yearly / 12;

  console.log(
    country.padEnd(10) +
      `${pricing.symbol}${String(yearly).padEnd(12)}` +
      `${pricing.symbol}${monthly.toFixed(2)}/月`
  );
});

console.log();

// ════════════════════════════════════════════
// 测试 6: 验证汇率合理性
// ════════════════════════════════════════════
console.log('\n【测试 6】验证各货币定价合理性\n');

const exchangeRates = {
  // 参考 2025 年汇率（需定期更新）
  'USD': 1.0,
  'EUR': 1.1,
  'GBP': 1.27,
  'JPY': 0.0072,
  'CNY': 0.14,
  'INR': 0.012,
  'BRL': 0.2,
  'CAD': 0.75,
  'AUD': 0.65,
  'SGD': 0.75,
  'HKD': 0.128,
  'TWD': 0.031,
  'KRW': 0.00077,
  'THB': 0.028,
  'MXN': 0.058,
};

const baselinePriceUSD = 9.90;

let warningsCount = 0;

Object.entries(allPricing)
  .slice(0, 15) // 显示前 15 个
  .forEach(([country, pricing]) => {
    const rate = exchangeRates[pricing.currency];
    if (!rate) return;

    const expectedUSD = pricing.bazi_full * rate;
    const deviation = Math.abs(expectedUSD - baselinePriceUSD) / baselinePriceUSD;

    if (deviation > 0.3) {
      // 超过 30% 偏差
      console.warn(
        `⚠️  ${country}: 定价与基准相差 ${(deviation * 100).toFixed(1)}% (预期 $${baselinePriceUSD}, 实际 $${expectedUSD.toFixed(2)})`
      );
      warningsCount++;
    } else {
      console.log(
        `✅ ${country}: 定价合理 ($${expectedUSD.toFixed(2)} ≈ $${baselinePriceUSD})`
      );
    }
  });

if (warningsCount === 0) {
  console.log('\n✅ 所有定价偏差在合理范围内（±30%）\n');
} else {
  console.log(`\n⚠️  发现 ${warningsCount} 个定价需要调整\n`);
}

// ════════════════════════════════════════════
// 总结
// ════════════════════════════════════════════
console.log('╔════════════════════════════════════════╗');
console.log('║ 测试完成！                               ║');
console.log('╚════════════════════════════════════════╝');
console.log(`\n总国家数: ${Object.keys(allPricing).length}`);
console.log(`总地区数: ${Object.keys(regions).length}`);
console.log('\n建议：');
console.log('1. 定期更新汇率（每周一次）');
console.log('2. 监控各地转化率，根据数据调整定价');
console.log('3. 每季度评估价格策略');
console.log('4. 对新兴市场做 A/B 测试\n');
