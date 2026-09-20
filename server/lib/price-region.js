'use strict';
/**
 * lib/price-region.js — 0918 Karen：「按所在地定价：在中国显示人民币，在美国（及其它地区）显示美元」
 *
 * 唯一判定入口，展示价（/api/price-region）与实收价（/api/create-checkout）共用它，
 * 保证「页面上看到的币种/金额 = 实际扣的钱」。价格只从 PRODUCTS 目录取（amount=美分, amountCny=分）。
 *
 * 判定顺序：CDN 国家头 → 客户端 IP 查询（带缓存 + 短超时）→ 访问域名（mylumee.cn=国内）→ 默认 USD。
 * 生产在 Caddy 后，一般没有 cf-ipcountry，所以 IP 查询是主路径；查询失败时才用域名兜底。
 */

const { PRODUCTS } = require('./store');

const _cache = new Map(); // ip -> { cc, at }
const TTL_MS = 6 * 3600e3;
const MAX_CACHE = 5000;

function _isPrivate(ip) {
  return !ip || /^(::1|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::ffff:127\.|fc|fd|fe80)/i.test(ip);
}

async function _lookup(ip) {
  const hit = _cache.get(ip);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.cc;
  let cc = null;
  try {
    const r = await fetch('https://get.geojs.io/v1/ip/country/' + encodeURIComponent(ip) + '.json',
      { signal: AbortSignal.timeout(1500) });
    if (r.ok) { const d = await r.json(); cc = String(d.country || '').toUpperCase() || null; }
  } catch (e) { /* 查不到就换备用源 */ }
  // 备用源：与 Lumee 中台 /geo 同一个免费服务（ip-api，无 key）。
  // 主源抽风时不要直接落回美元——国内用户看到 $ 比慢 1 秒更糟。
  if (!cc) {
    try {
      const r2 = await fetch('http://ip-api.com/json/' + encodeURIComponent(ip) + '?fields=status,countryCode',
        { signal: AbortSignal.timeout(1500) });
      if (r2.ok) {
        const d2 = await r2.json();
        if (d2 && d2.status === 'success') cc = String(d2.countryCode || '').toUpperCase() || null;
      }
    } catch (e) { /* 两个源都不行才走域名兜底 */ }
  }
  if (cc) {
    if (_cache.size > MAX_CACHE) _cache.clear();
    _cache.set(ip, { cc, at: Date.now() });
  }
  return cc;
}

// 返回 'cn' | 'us'（'us' = 美元区，泛指中国以外）
async function priceRegion(req) {
  const h = req.headers || {};
  let cc = String(h['cf-ipcountry'] || h['x-vercel-ip-country'] || '').toUpperCase();
  if (!cc || cc === 'XX') {
    const ip = String(req.ip || '').replace(/^::ffff:/, '');
    if (!_isPrivate(ip)) cc = (await _lookup(ip)) || '';
  }
  if (cc) return cc === 'CN' ? 'cn' : 'us';
  const host = String(h['x-forwarded-host'] || h.host || '');
  return /mylumee\.cn/i.test(host) ? 'cn' : 'us';
}

// 目录价 → 展示字符串。整数不带小数（$9 / ¥39），有零头带两位（$11.99 / ¥44.90）
function fmt(cents, region) {
  const v = cents / 100;
  const s = Number.isInteger(v) ? String(v) : v.toFixed(2);
  return (region === 'cn' ? '¥' : '$') + s;
}

function amountFor(product, region) {
  const p = PRODUCTS[product];
  if (!p) return null;
  return region === 'cn' ? (p.amountCny || Math.round(p.amount / 100 * 725)) : p.amount;
}

function displayPrices(region, keys) {
  const out = {};
  (keys || Object.keys(PRODUCTS)).forEach(k => {
    const a = amountFor(k, region);
    if (a != null) out[k] = fmt(a, region);
  });
  return out;
}

// 原始金额（最小单位：美分/分）。前端算「月费×12」「直省多少」这类推导价要用数字，
// 不能拿格式化字符串去减，否则换成 ¥ 之后省多少还是按美元算的。
function rawAmounts(region, keys) {
  const out = {};
  (keys || Object.keys(PRODUCTS)).forEach(k => {
    const a = amountFor(k, region);
    if (a != null) out[k] = a;
  });
  return out;
}

module.exports = { priceRegion, fmt, amountFor, displayPrices, rawAmounts, _cache };
