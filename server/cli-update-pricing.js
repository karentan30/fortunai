#!/usr/bin/env node

/**
 * server/cli-update-pricing.js
 * 命令行工具 - 快速调整地理定价
 * 用法:
 *   node server/cli-update-pricing.js update CN bazi_full 129
 *   node server/cli-update-pricing.js list
 *   node server/cli-update-pricing.js show CN
 *   node server/cli-update-pricing.js export > pricing-backup.json
 */

const fs = require('fs');
const path = require('path');
const { GEO_PRICING, getPricingByCountry } = require('./config/geo-pricing');

const args = process.argv.slice(2);
const command = args[0];

// ════════════════════════════════════════════
// 帮助信息
// ════════════════════════════════════════════
function showHelp() {
  console.log(`
╔════════════════════════════════════════════╗
║ 善缘地理定价 - CLI 管理工具                   ║
╚════════════════════════════════════════════╝

用法：
  node cli-update-pricing.js <command> [args]

命令：
  list                    列出所有国家定价
  show <COUNTRY>          显示某国详细定价
  update <COUNTRY> <PRODUCT> <PRICE>
                          更新特定产品价格
  exchange <CURRENCY> <RATE>
                          批量更新某货币的汇率
  export [FILE]           导出定价为 JSON
  import <FILE>           从 JSON 导入定价
  backup                  备份当前定价
  restore <FILE>          从备份恢复定价
  validate                验证定价完整性

示例：
  # 显示所有国家
  node cli-update-pricing.js list

  # 显示中国定价
  node cli-update-pricing.js show CN

  # 更新中国基础报告价格为 129 元
  node cli-update-pricing.js update CN bazi_full 129

  # 批量更新欧元汇率（1 EUR = 1.1 USD）
  node cli-update-pricing.js exchange EUR 1.1

  # 备份定价
  node cli-update-pricing.js backup

  # 导出为 JSON
  node cli-update-pricing.js export pricing.json

  # 导入 JSON
  node cli-update-pricing.js import pricing.json
`);
}

// ════════════════════════════════════════════
// 列出所有定价
// ════════════════════════════════════════════
function listPricing() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║ 所有国家定价列表                           ║');
  console.log('╚════════════════════════════════════════════╝\n');

  const regions = {};

  Object.entries(GEO_PRICING).forEach(([country, pricing]) => {
    if (!regions[pricing.region]) {
      regions[pricing.region] = [];
    }
    regions[pricing.region].push([country, pricing]);
  });

  Object.entries(regions).forEach(([region, countries]) => {
    console.log(`【${region.toUpperCase()}】`);
    console.log('─'.repeat(65));

    countries.forEach(([country, pricing]) => {
      console.log(
        `${country.padEnd(5)} ${pricing.currency.padEnd(4)} ${String(pricing.bazi_full).padEnd(8)} ` +
        `(${pricing.symbol}${pricing.bazi_full}) - ${pricing.region}`
      );
    });
    console.log();
  });
}

// ════════════════════════════════════════════
// 显示某国详细定价
// ════════════════════════════════════════════
function showCountry(country) {
  const pricing = getPricingByCountry(country);

  console.log(`\n╔════════════════════════════════════════════╗`);
  console.log(`║ ${country.padEnd(45)} ║`);
  console.log('╚════════════════════════════════════════════╝\n');

  console.log(`国家：${pricing.country}`);
  console.log(`地区：${pricing.region}`);
  console.log(`货币：${pricing.currency} (${pricing.symbol})\n`);

  console.log('产品定价：');
  console.log('─'.repeat(40));

  Object.entries(pricing)
    .filter(([k]) => !['country', 'region', 'currency', 'symbol'].includes(k))
    .forEach(([product, price]) => {
      console.log(`  ${product.padEnd(25)} ${pricing.symbol}${String(price).padStart(10)}`);
    });

  console.log();
}

// ════════════════════════════════════════════
// 更新价格
// ════════════════════════════════════════════
function updatePrice(country, product, price) {
  if (!GEO_PRICING[country]) {
    console.error(`❌ 错误：国家 ${country} 不存在`);
    process.exit(1);
  }

  const newPrice = parseFloat(price);
  if (isNaN(newPrice)) {
    console.error(`❌ 错误：价格 ${price} 无效`);
    process.exit(1);
  }

  const pricing = GEO_PRICING[country];

  if (!(product in pricing)) {
    console.error(`❌ 错误：产品 ${product} 不存在`);
    console.log(`可用产品：${Object.keys(pricing).filter((k) => !k.startsWith('_')).join(', ')}`);
    process.exit(1);
  }

  const oldPrice = pricing[product];
  pricing[product] = newPrice;

  console.log(`✅ 更新成功`);
  console.log(`国家：${country}`);
  console.log(`产品：${product}`);
  console.log(`原价：${oldPrice} → 新价：${newPrice}`);
  console.log(`变化：${((newPrice - oldPrice) / oldPrice * 100).toFixed(1)}%\n`);

  // 保存回文件
  savePricingToFile();
}

// ════════════════════════════════════════════
// 根据汇率批量更新
// ════════════════════════════════════════════
function updateByExchangeRate(currency, rate) {
  const newRate = parseFloat(rate);
  if (isNaN(newRate) || newRate <= 0) {
    console.error(`❌ 错误：汇率 ${rate} 无效`);
    process.exit(1);
  }

  const baseUSD = 9.90; // 基准 USD 价格
  const targetPrice = baseUSD / newRate;

  let updated = 0;

  Object.entries(GEO_PRICING).forEach(([country, pricing]) => {
    if (pricing.currency === currency) {
      const oldPrice = pricing.bazi_full;
      pricing.bazi_full = parseFloat(targetPrice.toFixed(2));

      // 按比例更新其他产品
      const ratio = pricing.bazi_full / oldPrice;
      Object.keys(pricing).forEach((product) => {
        if (!['country', 'region', 'currency', 'symbol'].includes(product) && product !== 'bazi_full') {
          const oldVal = pricing[product];
          pricing[product] = parseFloat((oldVal * ratio).toFixed(2));
        }
      });

      updated++;
    }
  });

  console.log(`✅ 批量更新完成`);
  console.log(`货币：${currency}`);
  console.log(`汇率：1 USD = ${rate}`);
  console.log(`目标基础价：${targetPrice.toFixed(2)} ${currency}`);
  console.log(`影响国家数：${updated}\n`);

  savePricingToFile();
}

// ════════════════════════════════════════════
// 导出定价
// ════════════════════════════════════════════
function exportPricing(file) {
  const output = file || 'pricing-export.json';
  const data = {
    timestamp: new Date().toISOString(),
    version: '1.0',
    pricing: GEO_PRICING,
  };

  fs.writeFileSync(output, JSON.stringify(data, null, 2));
  console.log(`✅ 已导出到 ${output}`);
}

// ════════════════════════════════════════════
// 导入定价
// ════════════════════════════════════════════
function importPricing(file) {
  if (!fs.existsSync(file)) {
    console.error(`❌ 文件不存在：${file}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));

  Object.assign(GEO_PRICING, data.pricing);
  savePricingToFile();

  console.log(`✅ 已导入 ${Object.keys(data.pricing).length} 个国家的定价`);
}

// ════════════════════════════════════════════
// 备份定价
// ════════════════════════════════════════════
function backupPricing() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = `pricing-backup-${timestamp}.json`;

  exportPricing(file);
  console.log(`📦 备份已保存`);
}

// ════════════════════════════════════════════
// 恢复定价
// ════════════════════════════════════════════
function restorePricing(file) {
  if (!fs.existsSync(file)) {
    console.error(`❌ 备份文件不存在：${file}`);
    process.exit(1);
  }

  // 备份当前状态
  backupPricing();

  importPricing(file);
  console.log(`✅ 已从 ${file} 恢复定价`);
}

// ════════════════════════════════════════════
// 验证定价
// ════════════════════════════════════════════
function validatePricing() {
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

  let errors = 0;
  let warnings = 0;

  console.log('\n验证定价配置...\n');

  Object.entries(GEO_PRICING).forEach(([country, pricing]) => {
    // 检查必需字段
    const missing = requiredFields.filter((f) => pricing[f] === undefined);
    if (missing.length > 0) {
      console.error(`❌ ${country}: 缺少字段 ${missing.join(', ')}`);
      errors++;
    }

    // 检查价格合理性
    if (pricing.bazi_vip < pricing.bazi_full) {
      console.warn(`⚠️  ${country}: VIP 价格低于基础价格`);
      warnings++;
    }

    if (pricing.bazi_full <= 0) {
      console.error(`❌ ${country}: 基础价格无效`);
      errors++;
    }
  });

  console.log(`\n结果：`);
  console.log(`  ✅ 检查国家数：${Object.keys(GEO_PRICING).length}`);
  console.log(`  ❌ 错误：${errors}`);
  console.log(`  ⚠️  警告：${warnings}\n`);

  if (errors === 0) {
    console.log('✅ 定价配置有效！\n');
  } else {
    process.exit(1);
  }
}

// ════════════════════════════════════════════
// 保存定价到文件
// ════════════════════════════════════════════
function savePricingToFile() {
  const filePath = path.join(__dirname, 'config', 'geo-pricing.js');

  let content = `/**
 * server/config/geo-pricing.js
 * 地理定价矩阵 - 按国家分类货币和价格
 * 用于前端显示价格 + 后端支付验证
 * 最后更新: ${new Date().toISOString()}
 */

const GEO_PRICING = ${JSON.stringify(GEO_PRICING, null, 2)};

// 默认配置（IP 查不到时使用）
const DEFAULT_PRICING = {
  country: 'US',
  region: 'default',
  currency: 'USD',
  symbol: '$',
  bazi_full: 9.90,
  bazi_vip: 19.90,
  hehun_full: 19.90,
  member_monthly: 9.90,
  member_quarterly: 24.90,
  member_yearly: 69.00,
};

/**
 * 根据国家代码获取定价
 * @param {string} countryCode - ISO 国家代码 (e.g. 'US', 'CN', 'JP')
 * @returns {object} 定价对象
 */
function getPricingByCountry(countryCode) {
  if (!countryCode) return DEFAULT_PRICING;
  const code = String(countryCode).toUpperCase();
  return GEO_PRICING[code] || DEFAULT_PRICING;
}

/**
 * 获取所有定价配置（admin 查看）
 */
function getAllPricing() {
  return GEO_PRICING;
}

module.exports = {
  GEO_PRICING,
  DEFAULT_PRICING,
  getPricingByCountry,
  getAllPricing,
};
`;

  fs.writeFileSync(filePath, content);
  console.log(`💾 已保存到 ${filePath}`);
}

// ════════════════════════════════════════════
// 主程序
// ════════════════════════════════════════════
function main() {
  if (!command) {
    showHelp();
    return;
  }

  switch (command) {
    case 'list':
      listPricing();
      break;

    case 'show':
      if (!args[1]) {
        console.error('❌ 缺少国家代码');
        process.exit(1);
      }
      showCountry(args[1].toUpperCase());
      break;

    case 'update':
      if (!args[1] || !args[2] || !args[3]) {
        console.error('❌ 用法: update <COUNTRY> <PRODUCT> <PRICE>');
        process.exit(1);
      }
      updatePrice(args[1].toUpperCase(), args[2], args[3]);
      break;

    case 'exchange':
      if (!args[1] || !args[2]) {
        console.error('❌ 用法: exchange <CURRENCY> <RATE>');
        process.exit(1);
      }
      updateByExchangeRate(args[1].toUpperCase(), args[2]);
      break;

    case 'export':
      exportPricing(args[1]);
      break;

    case 'import':
      if (!args[1]) {
        console.error('❌ 用法: import <FILE>');
        process.exit(1);
      }
      importPricing(args[1]);
      break;

    case 'backup':
      backupPricing();
      break;

    case 'restore':
      if (!args[1]) {
        console.error('❌ 用法: restore <FILE>');
        process.exit(1);
      }
      restorePricing(args[1]);
      break;

    case 'validate':
      validatePricing();
      break;

    case 'help':
    case '-h':
    case '--help':
      showHelp();
      break;

    default:
      console.error(`❌ 未知命令：${command}`);
      showHelp();
      process.exit(1);
  }
}

main();
