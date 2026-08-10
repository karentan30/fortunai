/**
 * public/geo-pricing.js
 * 前端地理定价集成脚本
 * 在页面加载时自动检测IP地理位置，更新价格显示
 *
 * 使用方式:
 * 1. 在 HTML <head> 中引入: <script src="/geo-pricing.js"></script>
 * 2. 在价格元素上使用 data-price 属性: <span data-price="bazi_full">¥99</span>
 * 3. 支付时调用 getPricingData() 获取地理信息
 */

// ════════════════════════════════════════════
// 全局配置 & 存储
// ════════════════════════════════════════════
const GEO_PRICING_CONFIG = {
  apiBaseUrl: (window.location.origin || 'https://shenyuan.mylumee.cn'), // 修改为你的域名
  cacheKey: 'sy_user_geo',
  cacheDuration: 24 * 60 * 60 * 1000, // 24小时
  enableLogging: true,
};

// ════════════════════════════════════════════
// 日志函数
// ════════════════════════════════════════════
function geoLog(msg, data) {
  if (GEO_PRICING_CONFIG.enableLogging) {
    console.log(`[GEO] ${msg}`, data || '');
  }
}

function geoError(msg, err) {
  console.error(`[GEO ERROR] ${msg}`, err || '');
}

// ════════════════════════════════════════════
// 获取缓存的地理数据
// ════════════════════════════════════════════
function getCachedGeoData() {
  try {
    const cached = localStorage.getItem(GEO_PRICING_CONFIG.cacheKey);
    if (!cached) return null;

    const data = JSON.parse(cached);
    const now = Date.now();
    const age = now - (data._timestamp || 0);

    if (age > GEO_PRICING_CONFIG.cacheDuration) {
      localStorage.removeItem(GEO_PRICING_CONFIG.cacheKey);
      geoLog('Cache expired, fetching fresh data');
      return null;
    }

    geoLog('Using cached geo data', data);
    return data;
  } catch (e) {
    geoError('Cache parse error', e);
    return null;
  }
}

// ════════════════════════════════════════════
// 保存地理数据到缓存
// ════════════════════════════════════════════
function cacheGeoData(data) {
  try {
    const toCache = {
      ...data,
      _timestamp: Date.now(),
    };
    localStorage.setItem(GEO_PRICING_CONFIG.cacheKey, JSON.stringify(toCache));
    geoLog('Geo data cached');
  } catch (e) {
    geoError('Cache save error', e);
  }
}

// ════════════════════════════════════════════
// 从后端获取地理位置 + 定价
// ════════════════════════════════════════════
async function fetchGeoData() {
  try {
    const url = GEO_PRICING_CONFIG.apiBaseUrl + '/api/geo/detect';
    geoLog('Fetching geo data from', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    geoLog('Geo data received', data);

    cacheGeoData(data);
    return data;
  } catch (err) {
    geoError('Failed to fetch geo data', err);
    // 返回默认值（美国/USD）
    return {
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
      error: 'fallback',
    };
  }
}

// ════════════════════════════════════════════
// 初始化地理定价
// ════════════════════════════════════════════
async function initGeoPricing() {
  try {
    // 1. 尝试从缓存获取
    let geoData = getCachedGeoData();

    // 2. 如果没有缓存，从后端获取
    if (!geoData) {
      geoData = await fetchGeoData();
    }

    // 3. 更新页面上所有价格元素
    updatePriceDisplay(geoData);

    // 4. 保存到全局对象供支付时使用
    window.SY_GEO_DATA = geoData;

    return geoData;
  } catch (err) {
    geoError('Failed to init geo pricing', err);
  }
}

// ════════════════════════════════════════════
// 更新页面中的价格显示
// ════════════════════════════════════════════
function updatePriceDisplay(geoData) {
  if (!geoData) return;

  // 更新所有 data-price="productId" 的元素
  document.querySelectorAll('[data-price]').forEach((el) => {
    const productId = el.getAttribute('data-price');
    const price = geoData[productId];

    if (price !== undefined) {
      const formatted = formatPrice(price, geoData.currency);
      el.textContent = formatted;
      el.setAttribute('data-currency', geoData.currency);
      geoLog(`Updated price for ${productId}: ${formatted}`);
    }
  });

  // 更新货币符号显示
  document.querySelectorAll('[data-currency-symbol]').forEach((el) => {
    el.textContent = geoData.symbol;
  });

  // 触发自定义事件（让其他脚本知道价格已更新）
  const event = new CustomEvent('geopricing-updated', {
    detail: geoData,
  });
  document.dispatchEvent(event);
  geoLog('Price display updated');
}

// ════════════════════════════════════════════
// 格式化价格
// ════════════════════════════════════════════
function formatPrice(amount, currency) {
  // 对于不同货币，使用不同的小数位数
  let decimalPlaces = 2;
  if (['JPY', 'CNY', 'KRW', 'THB', 'INR', 'BRL', 'MXN', 'RUB'].includes(currency)) {
    decimalPlaces = 0; // 亚洲货币通常不显示小数
  }

  const formatted = parseFloat(amount).toLocaleString(undefined, {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });

  return formatted;
}

// ════════════════════════════════════════════
// 获取当前地理定价数据（支付时使用）
// ════════════════════════════════════════════
function getPricingData() {
  return window.SY_GEO_DATA || getCachedGeoData() || {
    country: 'US',
    currency: 'USD',
    symbol: '$',
  };
}

// ════════════════════════════════════════════
// 主动更新价格（用户手动选择国家时调用）
// ════════════════════════════════════════════
async function updatePricingByCountry(countryCode) {
  try {
    const response = await fetch(
      `${GEO_PRICING_CONFIG.apiBaseUrl}/api/geo/pricing/${countryCode}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const pricing = await response.json();
    // 添加时间戳（当作新获取的数据）
    pricing._timestamp = Date.now();

    cacheGeoData(pricing);
    updatePriceDisplay(pricing);
    window.SY_GEO_DATA = pricing;

    geoLog('Pricing updated for', countryCode);
    return pricing;
  } catch (err) {
    geoError('Failed to update pricing', err);
  }
}

// ════════════════════════════════════════════
// 支付时验证价格（可选的后端验证）
// ════════════════════════════════════════════
async function validatePriceBeforeCheckout(product, amount) {
  const geoData = getPricingData();

  try {
    const response = await fetch(
      `${GEO_PRICING_CONFIG.apiBaseUrl}/api/geo/validate-price`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country: geoData.country,
          product: product,
          amount: amount,
        }),
      }
    );

    const result = await response.json();

    if (!result.ok) {
      geoError('Price validation failed', result);
      return false;
    }

    geoLog('Price validation passed', result);
    return true;
  } catch (err) {
    geoError('Price validation error', err);
    // 失败时允许继续（don't block payment）
    return true;
  }
}

// ════════════════════════════════════════════
// 支付函数集成示例
// ════════════════════════════════════════════
function createCheckout(product) {
  const geoData = getPricingData();
  const amount = geoData[product];

  if (!amount) {
    alert('产品不可用');
    return;
  }

  // 调用支付 API（假设后端端点为 /api/create-checkout 或 /pay/wechat/create）
  const payload = {
    product: product,
    currency: geoData.currency,
    country: geoData.country,
    amount: amount,
  };

  geoLog('Starting checkout', payload);

  // 如果是大陆用户，使用微信/支付宝
  if (geoData.country === 'CN') {
    checkoutCN(product, payload);
  }
  // 如果是韩国用户，使用 KRW
  else if (geoData.currency === 'KRW') {
    checkoutStripe(product, payload);
  }
  // 其他用户走 Stripe
  else {
    checkoutStripe(product, payload);
  }
}

// 国内支付（微信/支付宝）
async function checkoutCN(product, payload) {
  try {
    const response = await fetch(
      `${GEO_PRICING_CONFIG.apiBaseUrl}/api/pay/wechat/create`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    if (data.ok) {
      // 显示支付二维码或跳转
      if (data.code_url) {
        // 微信支付：显示二维码
        showQRCode(data.code_url);
      } else if (data.url) {
        // Stripe：跳转到支付页
        window.location.href = data.url;
      }
    } else {
      alert('支付创建失败：' + (data.error || '未知错误'));
    }
  } catch (err) {
    geoError('Checkout error', err);
    alert('支付系统出错，请稍后重试');
  }
}

// Stripe 支付
async function checkoutStripe(product, payload) {
  try {
    const response = await fetch(
      `${GEO_PRICING_CONFIG.apiBaseUrl}/api/create-checkout`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    if (data.url) {
      // 跳转到 Stripe Checkout
      window.location.href = data.url;
    } else if (data.channel === 'cn') {
      // 国内用户
      checkoutCN(product, payload);
    } else {
      alert('支付创建失败：' + (data.error || '未知错误'));
    }
  } catch (err) {
    geoError('Checkout error', err);
    alert('支付系统出错，请稍后重试');
  }
}

// 显示二维码
function showQRCode(codeUrl) {
  // 这里可以集成 qrcode.js 库来生成二维码
  // 或者直接显示后端返回的二维码图片
  alert('请扫描二维码进行支付:\n' + codeUrl);
}

// ════════════════════════════════════════════
// 自动初始化（页面加载时）
// ════════════════════════════════════════════
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGeoPricing);
} else {
  initGeoPricing();
}

// ════════════════════════════════════════════
// 导出供外部使用
// ════════════════════════════════════════════
window.GEO = {
  getPricingData,
  updatePricingByCountry,
  validatePriceBeforeCheckout,
  createCheckout,
  initGeoPricing,
  geoLog,
};
