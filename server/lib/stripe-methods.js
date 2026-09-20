/**
 * Stripe 支付方式选择 —— 抽成纯函数，只为一件事：
 * **绝不把支付宝/微信放进 subscription 模式。**
 *
 * ── 背景（0909 查证）────────────────────────────────────────────────────────
 * Stripe 的 alipay / wechat_pay 都**只支持一次性付款**，不能用于 subscription。
 * 但 server/routes/payment.js 的 /api/create-checkout 里，付款方式和 mode 是
 * 各算各的：
 *
 *   const isCNY   = !isKR && (region === 'cn' || currency === 'cny');   // 看请求体
 *   const payMethods = isCNY ? ['card','alipay'] : ['card'];
 *   ...
 *   const isSubscription = ['member_yearly', ...].includes(product);    // 看产品
 *   stripe.checkout.sessions.create({ payment_method_types: payMethods,
 *                                     mode: isSubscription ? 'subscription' : 'payment' })
 *
 * 上面那道 `isCN` 拦截只看 **IP**（cf-ipcountry / x-vercel-ip-country），
 * 而 `isCNY` 看的是 **请求体**。所以只要是非大陆 IP（港澳台/新马/海外华人/任何 VPN）
 * 且请求体带 region:'cn' 或 currency:'cny'，买的又是订阅产品，就会组合出
 * `['card','alipay']` + `mode:'subscription'` → Stripe 直接报错 → 那个 catch
 * 返回 500，用户根本订不了。
 *
 * ── 现在炸没炸？没有。但马上就会 ──────────────────────────────────────────
 * 实测查过：当前所有前端调用 /api/create-checkout 时都**不传** region/currency
 * （pages/*.html 里只传 product / ref_code / price / lang 这些），所以 isCNY 恒为
 * false，这条路今天走不到。
 * 但 req.body 是客户端可控的，任何人手工构造就能触发 500；
 * **更要紧的是：一旦按这次的需求把 CNY/支付宝接进前端，这个洞就被立刻激活。**
 * 所以在开通支付宝之前先把它堵上，而不是开通之后再来查为什么订阅全挂。
 */

/** Stripe 里只能用于一次性付款、不能用于 subscription 的支付方式。 */
const ONE_TIME_ONLY_METHODS = ['alipay', 'wechat_pay'];

/**
 * 按 mode 收敛支付方式。
 *
 * @param {string[]} methods       原本打算用的 payment_method_types
 * @param {boolean}  isSubscription 这一单是不是订阅（mode==='subscription'）
 * @returns {{ methods: string[], dropped: string[] }}
 *          methods = 实际可用的；dropped = 因为订阅而被剔除的（便于打日志/埋点）
 *
 * 订阅单里若剔除后一个都不剩，回落到 ['card'] —— 订阅本来就只能刷卡，
 * 返回空数组会让 Stripe 报另一个错，等于把问题换了个样子而不是解决。
 */
function resolvePaymentMethods(methods, isSubscription) {
  const list = Array.isArray(methods) ? methods.filter(Boolean) : [];
  if (!isSubscription) return { methods: list, dropped: [] };

  const dropped = list.filter(m => ONE_TIME_ONLY_METHODS.includes(m));
  const kept = list.filter(m => !ONE_TIME_ONLY_METHODS.includes(m));
  return { methods: kept.length ? kept : ['card'], dropped };
}

/**
 * 整单被 Stripe 拒时的降级：摘掉最后一个非卡通道，返回下一次要试的清单；
 * 已经只剩 card（或空）时返回 null，表示别再重试了——那就是真错误，要抛出去。
 *
 * 为什么不是一拒就塌回 ['card']：支付方式是在 Stripe 后台一个一个开通的
 * （0920 Karen 那边 Alipay 开了、微信没开）。只要有一个没开通 Stripe 就整单拒，
 * 一步塌回只收卡的话，刚开通的支付宝/KakaoPay 会跟着一起丢掉，等于白开。
 */
function nextMethods(methods) {
  const list = Array.isArray(methods) ? methods.filter(Boolean) : [];
  if (!list.some(m => m !== 'card')) return null;
  return list.slice(0, -1);
}

module.exports = { resolvePaymentMethods, nextMethods, ONE_TIME_ONLY_METHODS };
