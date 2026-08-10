/**
 * server/config/geo-pricing.js
 * 地理定价矩阵 - 按国家分类货币和价格
 * 用于前端显示价格 + 后端支付验证
 */

const GEO_PRICING = {
  // ════════════════════════════════════════════
  // 【北美 - 高价】
  // ════════════════════════════════════════════
  'US': {
    country: 'US',
    region: 'north-america',
    currency: 'USD',
    symbol: '$',
    bazi_full: 9.90,
    bazi_vip: 19.90,
    hehun_full: 19.90,
    member_monthly: 9.90,
    member_quarterly: 24.90,
    member_yearly: 69.00,
  },
  'CA': {
    country: 'CA',
    region: 'north-america',
    currency: 'CAD',
    symbol: '$',
    bazi_full: 12.90,
    bazi_vip: 25.90,
    hehun_full: 25.90,
    member_monthly: 12.90,
    member_quarterly: 32.90,
    member_yearly: 89.00,
  },
  'MX': {
    country: 'MX',
    region: 'north-america',
    currency: 'MXN',
    symbol: '$',
    bazi_full: 199,
    bazi_vip: 399,
    hehun_full: 399,
    member_monthly: 199,
    member_quarterly: 499,
    member_yearly: 1299,
  },

  // ════════════════════════════════════════════
  // 【欧洲 - 中等价】
  // ════════════════════════════════════════════
  'GB': {
    country: 'GB',
    region: 'europe',
    currency: 'GBP',
    symbol: '£',
    bazi_full: 7.90,
    bazi_vip: 15.90,
    hehun_full: 15.90,
    member_monthly: 7.90,
    member_quarterly: 19.90,
    member_yearly: 59.00,
  },
  'DE': {
    country: 'DE',
    region: 'europe',
    currency: 'EUR',
    symbol: '€',
    bazi_full: 8.90,
    bazi_vip: 17.90,
    hehun_full: 17.90,
    member_monthly: 8.90,
    member_quarterly: 22.90,
    member_yearly: 69.00,
  },
  'FR': {
    country: 'FR',
    region: 'europe',
    currency: 'EUR',
    symbol: '€',
    bazi_full: 8.90,
    bazi_vip: 17.90,
    hehun_full: 17.90,
    member_monthly: 8.90,
    member_quarterly: 22.90,
    member_yearly: 69.00,
  },
  // 东欧（便宜）
  'PL': {
    country: 'PL',
    region: 'europe-east',
    currency: 'EUR',
    symbol: '€',
    bazi_full: 4.90,
    bazi_vip: 9.90,
    hehun_full: 9.90,
    member_monthly: 4.90,
    member_quarterly: 12.90,
    member_yearly: 39.00,
  },
  'CZ': {
    country: 'CZ',
    region: 'europe-east',
    currency: 'EUR',
    symbol: '€',
    bazi_full: 4.90,
    bazi_vip: 9.90,
    hehun_full: 9.90,
    member_monthly: 4.90,
    member_quarterly: 12.90,
    member_yearly: 39.00,
  },
  'RO': {
    country: 'RO',
    region: 'europe-east',
    currency: 'EUR',
    symbol: '€',
    bazi_full: 4.90,
    bazi_vip: 9.90,
    hehun_full: 9.90,
    member_monthly: 4.90,
    member_quarterly: 12.90,
    member_yearly: 39.00,
  },

  // ════════════════════════════════════════════
  // 【亚太 - 多层次】
  // ════════════════════════════════════════════
  // 日本（高价）
  'JP': {
    country: 'JP',
    region: 'apac-developed',
    currency: 'JPY',
    symbol: '¥',
    bazi_full: 1980,
    bazi_vip: 3980,
    hehun_full: 3980,
    member_monthly: 1980,
    member_quarterly: 4980,
    member_yearly: 14800,
  },
  // 新加坡/澳洲（中高）
  'SG': {
    country: 'SG',
    region: 'apac-developed',
    currency: 'SGD',
    symbol: '$',
    bazi_full: 13.90,
    bazi_vip: 26.90,
    hehun_full: 26.90,
    member_monthly: 13.90,
    member_quarterly: 34.90,
    member_yearly: 99.00,
  },
  'AU': {
    country: 'AU',
    region: 'apac-developed',
    currency: 'AUD',
    symbol: '$',
    bazi_full: 14.90,
    bazi_vip: 29.90,
    hehun_full: 29.90,
    member_monthly: 14.90,
    member_quarterly: 37.90,
    member_yearly: 109.00,
  },
  // 泰国
  'TH': {
    country: 'TH',
    region: 'apac-developing',
    currency: 'THB',
    symbol: '฿',
    bazi_full: 299,
    bazi_vip: 599,
    hehun_full: 599,
    member_monthly: 299,
    member_quarterly: 749,
    member_yearly: 2199,
  },
  // 印度（便宜）
  'IN': {
    country: 'IN',
    region: 'apac-developing',
    currency: 'INR',
    symbol: '₹',
    bazi_full: 699,
    bazi_vip: 1299,
    hehun_full: 1299,
    member_monthly: 699,
    member_quarterly: 1699,
    member_yearly: 4999,
  },
  // 菲律宾/越南/柬埔寨等东南亚
  'PH': {
    country: 'PH',
    region: 'apac-developing',
    currency: 'USD',
    symbol: '$',
    bazi_full: 4.90,
    bazi_vip: 8.90,
    hehun_full: 8.90,
    member_monthly: 4.90,
    member_quarterly: 11.90,
    member_yearly: 34.00,
  },
  'VN': {
    country: 'VN',
    region: 'apac-developing',
    currency: 'USD',
    symbol: '$',
    bazi_full: 4.90,
    bazi_vip: 8.90,
    hehun_full: 8.90,
    member_monthly: 4.90,
    member_quarterly: 11.90,
    member_yearly: 34.00,
  },
  'KH': {
    country: 'KH',
    region: 'apac-developing',
    currency: 'USD',
    symbol: '$',
    bazi_full: 4.90,
    bazi_vip: 8.90,
    hehun_full: 8.90,
    member_monthly: 4.90,
    member_quarterly: 11.90,
    member_yearly: 34.00,
  },
  'ID': {
    country: 'ID',
    region: 'apac-developing',
    currency: 'USD',
    symbol: '$',
    bazi_full: 4.90,
    bazi_vip: 8.90,
    hehun_full: 8.90,
    member_monthly: 4.90,
    member_quarterly: 11.90,
    member_yearly: 34.00,
  },
  'MY': {
    country: 'MY',
    region: 'apac-developing',
    currency: 'USD',
    symbol: '$',
    bazi_full: 4.90,
    bazi_vip: 8.90,
    hehun_full: 8.90,
    member_monthly: 4.90,
    member_quarterly: 11.90,
    member_yearly: 34.00,
  },

  // ════════════════════════════════════════════
  // 【中文地区 - 固定价格】
  // ════════════════════════════════════════════
  'CN': {
    country: 'CN',
    region: 'chinese-world',
    currency: 'CNY',
    symbol: '¥',
    bazi_full: 99,
    bazi_vip: 199,
    hehun_full: 199,
    member_monthly: 99,
    member_quarterly: 199,
    member_yearly: 599,
  },
  'HK': {
    country: 'HK',
    region: 'chinese-world',
    currency: 'HKD',
    symbol: '$',
    bazi_full: 89,
    bazi_vip: 179,
    hehun_full: 179,
    member_monthly: 89,
    member_quarterly: 179,
    member_yearly: 549,
  },
  'TW': {
    country: 'TW',
    region: 'chinese-world',
    currency: 'TWD',
    symbol: '$',
    bazi_full: 299,
    bazi_vip: 599,
    hehun_full: 599,
    member_monthly: 299,
    member_quarterly: 599,
    member_yearly: 1799,
  },

  // ════════════════════════════════════════════
  // 【其他地区】
  // ════════════════════════════════════════════
  'BR': {
    country: 'BR',
    region: 'latin-america',
    currency: 'BRL',
    symbol: 'R$',
    bazi_full: 49,
    bazi_vip: 99,
    hehun_full: 99,
    member_monthly: 49,
    member_quarterly: 119,
    member_yearly: 349,
  },
  'RU': {
    country: 'RU',
    region: 'other',
    currency: 'USD',
    symbol: '$',
    bazi_full: 5.90,
    bazi_vip: 11.90,
    hehun_full: 11.90,
    member_monthly: 5.90,
    member_quarterly: 14.90,
    member_yearly: 44.00,
  },
  'KR': {
    country: 'KR',
    region: 'apac-developed',
    currency: 'KRW',
    symbol: '₩',
    bazi_full: 9900,
    bazi_vip: 19900,
    hehun_full: 19900,
    member_monthly: 9900,
    member_quarterly: 24900,
    member_yearly: 74900,
  },
};

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
