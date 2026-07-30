// ════════════════════════════════════════════════════════════════════
// 善缘 ShenYuan · 中国支付（微信 NATIVE 扫码 + 支付宝当面付扫码）
// 复刻 Lumee（server.py）已实测的真实收款流程，落到 Node/Express。
//
// 设计原则（真钱代码 · 红线）：
//   · out_trade_no 全部 `sy_` 前缀（善缘自己的订单空间，绝不与 Lumee 冲）
//   · notify_url 用善缘自己的域名（SHENYUAN_BASE_URL），绝不读 Lumee 的 NOTIFY_URL
//   · 回调必做：验签 + 金额校验 + 幂等（同 out_trade_no 只入账一次）
//   · 缺 env 时优雅降级：ready()=false，端点返 4xx「支付未配置」，绝不 mock 免费放行、绝不崩
//
// 微信：APIv2 MD5 签名（Node stdlib，零依赖，与 Lumee _wx_sign 逐字节一致）
// 支付宝：alipay-sdk 4.x（exec 走 v1 网关，对齐 python-alipay-sdk 的 precreate/query/verify）
// ════════════════════════════════════════════════════════════════════
'use strict';

const crypto = require('crypto');
const https = require('https');

// ── 善缘自己的域名（notify_url 用它，红线：不读 Lumee 的）──
// 生产部署时在 server/.env 里配 SHENYUAN_BASE_URL=https://<善缘正式域名>
const SHENYUAN_BASE_URL = (process.env.SHENYUAN_BASE_URL || 'https://shenyuan.mylumee.cn').replace(/\/+$/, '');

// ── 微信支付 env ──
const WECHAT_APP_ID  = process.env.WECHAT_APP_ID  || '';
const WECHAT_MCH_ID  = process.env.WECHAT_MCH_ID  || '';
const WECHAT_API_KEY = process.env.WECHAT_API_KEY || '';
const WECHAT_NOTIFY_URL = process.env.WECHAT_NOTIFY_URL || (SHENYUAN_BASE_URL + '/pay/wechat/notify');

// ── 支付宝 env ──
const ALIPAY_APP_ID      = process.env.ALIPAY_APP_ID || '';
const ALIPAY_PRIVATE_KEY = _readKeyEnv('ALIPAY_PRIVATE_KEY', 'ALIPAY_PRIVATE_KEY_PATH');
const ALIPAY_PUBLIC_KEY  = _readKeyEnv('ALIPAY_PUBLIC_KEY',  'ALIPAY_PUBLIC_KEY_PATH');
const ALIPAY_GATEWAY     = process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do';
const ALIPAY_NOTIFY_URL  = process.env.ALIPAY_NOTIFY_URL || (SHENYUAN_BASE_URL + '/pay/alipay/notify');

// 私钥/公钥既支持直接给 PEM 内容(env)，也支持给文件路径(env_PATH)
function _readKeyEnv(inlineVar, pathVar) {
  const inline = process.env[inlineVar];
  if (inline && inline.trim()) return inline.trim();
  const p = process.env[pathVar];
  if (p && p.trim()) {
    try { return require('fs').readFileSync(p.trim(), 'utf8').trim(); }
    catch (e) { console.warn('[pay] 读取密钥文件失败 ' + pathVar + '=' + p + ': ' + e.message); }
  }
  return '';
}

// ════════════════════════════════════════════════════════════════════
// 微信支付 NATIVE（APIv2 · MD5 签名）
// ════════════════════════════════════════════════════════════════════

function wechatReady() {
  return !!(WECHAT_APP_ID && WECHAT_MCH_ID && WECHAT_API_KEY);
}

// 与 Lumee _wx_sign 一致：key 升序、去空、去 sign，拼 &key= 后 MD5 大写
function wxSign(params, key) {
  const items = Object.keys(params)
    .filter(k => k !== 'sign' && params[k] !== '' && params[k] != null)
    .sort()
    .map(k => k + '=' + params[k]);
  const raw = items.join('&') + '&key=' + key;
  return crypto.createHash('md5').update(raw, 'utf8').digest('hex').toUpperCase();
}

function _xmlEscapeCDATA(v) {
  // CDATA 内不能出现 ]]>；微信参数值不含它，做个保险替换
  return String(v).replace(/\]\]>/g, ']]]]><![CDATA[>');
}

function wxToXml(params) {
  let s = '<xml>';
  for (const k of Object.keys(params)) {
    s += '<' + k + '><![CDATA[' + _xmlEscapeCDATA(params[k]) + ']]></' + k + '>';
  }
  return s + '</xml>';
}

function wxFromXml(text) {
  const out = {};
  if (!text) return out;
  // 轻量解析：<tag>value</tag>，值可能包 CDATA
  const re = /<([a-zA-Z0-9_]+)>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/\1>/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    out[m[1]] = m[2] !== undefined ? m[2] : (m[3] || '');
  }
  return out;
}

function _randNonce(len) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < (len || 24); i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// POST XML 到微信网关，返回解析后的 dict
function _wxPost(url, xmlBody, timeoutMs) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = Buffer.from(xmlBody, 'utf8');
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Content-Length': data.length },
    }, (resp) => {
      let chunks = '';
      resp.setEncoding('utf8');
      resp.on('data', d => { chunks += d; });
      resp.on('end', () => resolve(wxFromXml(chunks)));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs || 20000, () => { req.destroy(new Error('wechat request timeout')); });
    req.write(data);
    req.end();
  });
}

// 统一下单（NATIVE 扫码）。totalFeeCents=分。返回微信响应 dict（含 code_url）。
async function wxUnifiedOrder(outTradeNo, totalFeeCents, bodyDesc, clientIp) {
  const params = {
    appid: WECHAT_APP_ID,
    mch_id: WECHAT_MCH_ID,
    nonce_str: _randNonce(24),
    body: bodyDesc,
    out_trade_no: outTradeNo,
    total_fee: String(Math.round(totalFeeCents)),
    spbill_create_ip: clientIp || '127.0.0.1',
    notify_url: WECHAT_NOTIFY_URL,   // 🔴 善缘自己的域名
    trade_type: 'NATIVE',
    product_id: outTradeNo,
  };
  params.sign = wxSign(params, WECHAT_API_KEY);
  return _wxPost('https://api.mch.weixin.qq.com/pay/unifiedorder', wxToXml(params));
}

// 主动查单
async function wxOrderQuery(outTradeNo) {
  const params = {
    appid: WECHAT_APP_ID,
    mch_id: WECHAT_MCH_ID,
    out_trade_no: outTradeNo,
    nonce_str: _randNonce(24),
  };
  params.sign = wxSign(params, WECHAT_API_KEY);
  return _wxPost('https://api.mch.weixin.qq.com/pay/orderquery', wxToXml(params), 15000);
}

// 校验回调 XML 签名（返回 {ok, data}）
function wxVerifyNotify(rawXml) {
  const data = wxFromXml(rawXml);
  const sign = data.sign || '';
  delete data.sign;
  const ok = !!sign && wxSign(data, WECHAT_API_KEY) === sign;
  return { ok, data };
}

// 回调应答 XML
function wxReplyXml(ok, msg) {
  return wxToXml({ return_code: ok ? 'SUCCESS' : 'FAIL', return_msg: msg || (ok ? 'OK' : 'FAIL') });
}

// ════════════════════════════════════════════════════════════════════
// 支付宝当面付（alipay-sdk 4.x · exec 走 v1 网关）
// ════════════════════════════════════════════════════════════════════

let _alipayClient = null;
let _alipayInitTried = false;

function getAlipay() {
  if (_alipayInitTried) return _alipayClient;
  _alipayInitTried = true;
  if (!(ALIPAY_APP_ID && ALIPAY_PRIVATE_KEY && ALIPAY_PUBLIC_KEY)) return null;
  try {
    const { AlipaySdk } = require('alipay-sdk');
    _alipayClient = new AlipaySdk({
      appId: ALIPAY_APP_ID,
      privateKey: ALIPAY_PRIVATE_KEY,
      alipayPublicKey: ALIPAY_PUBLIC_KEY,
      gateway: ALIPAY_GATEWAY,
      signType: 'RSA2',
      timeout: 15000,
    });
    console.log('[alipay] client ready');
  } catch (e) {
    console.error('[alipay] init failed: ' + e.message);
    _alipayClient = null;
  }
  return _alipayClient;
}

function alipayReady() {
  return !!getAlipay();
}

// 当面付预下单：alipay.trade.precreate → 返回 qr_code
// 返回 { ok, qr_code?, msg? }
async function alipayPrecreate(outTradeNo, totalAmountYuan, subject) {
  const client = getAlipay();
  if (!client) return { ok: false, msg: '支付宝未配置' };
  try {
    const res = await client.exec('alipay.trade.precreate', {
      notifyUrl: ALIPAY_NOTIFY_URL,   // 🔴 善缘自己的域名
      bizContent: {
        out_trade_no: outTradeNo,
        total_amount: String(totalAmountYuan),
        subject: subject,
      },
    });
    // exec 返回已 camelCase 化：code / qrCode / subMsg / msg
    if (String(res.code) === '10000' && res.qrCode) {
      return { ok: true, qr_code: res.qrCode };
    }
    return { ok: false, msg: res.subMsg || res.msg || '未知错误', raw: res };
  } catch (e) {
    return { ok: false, msg: e.message, error: e };
  }
}

// 主动查单：alipay.trade.query → { paid, tradeNo?, msg? }
async function alipayQuery(outTradeNo) {
  const client = getAlipay();
  if (!client) return { paid: false, msg: '支付宝未配置' };
  try {
    const res = await client.exec('alipay.trade.query', {
      bizContent: { out_trade_no: outTradeNo },
    });
    const paid = String(res.code) === '10000' &&
      (res.tradeStatus === 'TRADE_SUCCESS' || res.tradeStatus === 'TRADE_FINISHED');
    return { paid, tradeNo: res.tradeNo || '', totalAmount: res.totalAmount || '', raw: res };
  } catch (e) {
    return { paid: false, msg: e.message };
  }
}

// 回调验签：postData=form-urlencoded 解析后的对象（含 sign）。返回 bool
function alipayVerifyNotify(postData) {
  const client = getAlipay();
  if (!client) return false;
  try {
    return !!client.checkNotifySign(postData);
  } catch (e) {
    console.error('[alipay/notify] verify err ' + e.message);
    return false;
  }
}

// ── 订单号生成：sy_ 前缀（红线）──
function genOutTradeNo(channel) {
  const ts = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  return 'sy_' + (channel || 'wx') + '_' + ts + '_' + crypto.randomBytes(3).toString('hex');
}

module.exports = {
  SHENYUAN_BASE_URL,
  WECHAT_NOTIFY_URL, ALIPAY_NOTIFY_URL,
  // wechat
  wechatReady, wxUnifiedOrder, wxOrderQuery, wxVerifyNotify, wxReplyXml,
  // alipay
  alipayReady, alipayPrecreate, alipayQuery, alipayVerifyNotify,
  // shared
  genOutTradeNo,
};
