/**
 * server/routes/geo.js
 * 地理位置检测 + 定价 API
 * GET /api/geo/detect — 检测用户IP地理位置并返回定价
 * GET /api/geo/pricing/:country — 获取指定国家定价
 * POST /api/geo/validate-price — 验证前端报价（支付时使用）
 */

const router = require('express').Router();
const { getPricingByCountry, getAllPricing } = require('../config/geo-pricing');

// ════════════════════════════════════════════
// 免费 IP 地理位置检测服务
// ════════════════════════════════════════════
// 方案1: ip-api.com (免费, 45req/min)
// 方案2: geojs.io (免费, 无限制)
// 方案3: CloudFlare headers (最准确，生产推荐)

/**
 * 调用免费地理位置 API
 */
async function detectCountryFromIP(ip) {
  // 先尝试 geojs.io（更稳定）
  try {
    const response = await fetch(`https://get.geojs.io/geolocation/ip.json?ip=${ip}`, {
      timeout: 3000,
    });
    if (response.ok) {
      const data = await response.json();
      if (data && data.country_code) {
        return data.country_code.toUpperCase();
      }
    }
  } catch (e) {
    console.error('[geo] geojs.io failed:', e.message);
  }

  // 降级到 ip-api.com
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`, {
      timeout: 3000,
    });
    if (response.ok) {
      const data = await response.json();
      if (data && data.countryCode) {
        return data.countryCode.toUpperCase();
      }
    }
  } catch (e) {
    console.error('[geo] ip-api.com failed:', e.message);
  }

  return null;
}

// ══════════════════════════════════════════════════════════════
// GET /api/geo/detect
// 检测用户地理位置 + 返回定价
// ══════════════════════════════════════════════════════════════
router.get('/detect', async (req, res) => {
  try {
    let country = null;
    let ip = null;
    let source = 'unknown';

    // 优先级1: CloudFlare headers (生产Caddy反代时可用)
    if (req.headers['cf-ipcountry']) {
      country = req.headers['cf-ipcountry'];
      ip = req.headers['cf-connecting-ip'];
      source = 'cloudflare';
    }
    // 优先级2: Vercel headers
    else if (req.headers['x-vercel-ip-country']) {
      country = req.headers['x-vercel-ip-country'];
      ip = req.headers['x-vercel-ip'];
      source = 'vercel';
    }
    // 优先级3: 手动从 IP 检测
    else {
      ip = req.ip || req.connection.remoteAddress || '';
      // 过滤掉 localhost 和内网 IP
      if (ip && !['127.0.0.1', '::1', 'localhost'].includes(ip) && !ip.startsWith('192.168.') && !ip.startsWith('10.')) {
        country = await detectCountryFromIP(ip);
        source = 'ip-api';
      }
    }

    // 获取定价
    const pricing = getPricingByCountry(country);

    // 日志（调试用）
    if (country) {
      console.log(`[GEO] ${ip} → ${country} (${source})`);
    } else {
      console.log(`[GEO] ${ip} → DEFAULT (${source})`);
    }

    // 返回响应
    res.json({
      country: pricing.country,
      region: pricing.region,
      currency: pricing.currency,
      symbol: pricing.symbol,
      ip: ip,
      source: source,
      // 价格列表
      bazi_full: pricing.bazi_full,
      bazi_vip: pricing.bazi_vip,
      hehun_full: pricing.hehun_full,
      member_monthly: pricing.member_monthly,
      member_quarterly: pricing.member_quarterly,
      member_yearly: pricing.member_yearly,
    });
  } catch (err) {
    console.error('[geo/detect ERR]', err);
    // 失败时返回默认
    const def = getPricingByCountry('US');
    res.json({
      country: def.country,
      region: def.region,
      currency: def.currency,
      symbol: def.symbol,
      bazi_full: def.bazi_full,
      bazi_vip: def.bazi_vip,
      hehun_full: def.hehun_full,
      member_monthly: def.member_monthly,
      member_quarterly: def.member_quarterly,
      member_yearly: def.member_yearly,
      error: 'fallback',
    });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/geo/pricing/:country
// 获取指定国家的定价
// ══════════════════════════════════════════════════════════════
router.get('/pricing/:country', (req, res) => {
  const country = req.params.country;
  const pricing = getPricingByCountry(country);
  res.json(pricing);
});

// ══════════════════════════════════════════════════════════════
// POST /api/geo/validate-price
// 后端验证前端报价（支付时使用）
// 防止VPN用户或客户端伪造价格
// ══════════════════════════════════════════════════════════════
router.post('/validate-price', (req, res) => {
  try {
    const { country, product, amount } = req.body;

    if (!country || !product || amount === undefined) {
      return res.status(400).json({
        error: 'Missing country, product, or amount',
      });
    }

    const pricing = getPricingByCountry(country);
    const serverPrice = pricing[product];

    if (serverPrice === undefined) {
      return res.status(400).json({
        error: 'Invalid product',
        valid_products: Object.keys(pricing).filter((k) => !k.startsWith('country') && !k.startsWith('region') && !k.startsWith('currency') && !k.startsWith('symbol')),
      });
    }

    // 允许 ±10% 偏差（汇率浮动）
    const minPrice = serverPrice * 0.9;
    const maxPrice = serverPrice * 1.1;

    const isValid = amount >= minPrice && amount <= maxPrice;

    res.json({
      ok: isValid,
      country: pricing.country,
      product,
      currency: pricing.currency,
      server_price: serverPrice,
      client_price: amount,
      min_allowed: minPrice,
      max_allowed: maxPrice,
      message: isValid ? 'Price OK' : 'Price mismatch - possible fraud attempt',
    });
  } catch (err) {
    console.error('[geo/validate-price ERR]', err);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/geo/all (admin only)
// 查看所有定价矩阵
// ══════════════════════════════════════════════════════════════
router.get('/all', (req, res) => {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken || req.headers['x-admin-token'] !== adminToken) {
    return res.status(403).json({ error: 'forbidden' });
  }
  res.json(getAllPricing());
});

module.exports = router;
