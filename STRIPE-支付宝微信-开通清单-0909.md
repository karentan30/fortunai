# Stripe 开通支付宝 / 微信 · 后台操作清单（0909）

> Karen 自己登录 Stripe 后台照着点。我不碰你的账号。
> 每一步都写了菜单名 → 按钮名，以及点完之后该看到什么。

---

## 0. 先记住两条限制（这决定了能做什么、不能做什么）

**① Stripe 的支付宝和微信支付都只能用于一次性付款，不能用于订阅。**

这不是我们的实现限制，是 Stripe 自己的产品限制。Stripe 官方文档在 Alipay 和
WeChat Pay 两页的「产品支持」里都写着同一句脚注：

> Checkout：**在 subscription 模式或 setup 模式下不支持**。

所以：
- 一次性产品（完整命盘 ¥99.90 / 代烧 / 单次报告）→ ✅ 可以用支付宝、微信
- 会员（`member_monthly` / `member_yearly` / `member_quarterly` / `member_3year` /
  `daily_companion_*` / `monthly_report_year`）→ ❌ **必须继续走信用卡**

Stripe 确实有「支付宝/微信自动续费」的**内测**（alipay_recurring_beta_preview /
wechat_recurring_beta_preview），但要单独申请、是 private preview，
**不要按内测来规划这次上线**。

**② 微信支付要单独申请，不是勾了支付宝就一起有；而且可用国家比支付宝少一大截。**

| | 支付宝 Alipay | 微信 WeChat Pay |
|---|---|---|
| 可用的**商户注册国**数量 | 39 个 | 22 个 |
| 美国 US / 英国 GB / 香港 HK / 新加坡 SG / 日本 JP | ✅ 都可以 | ✅ 都可以 |
| 马来西亚 MY / 新西兰 NZ | ✅ 可以 | ❌ **不支持** |
| 东南欧多国（BG CY CZ EE GR HR HU LT LV MT RO SI SK）、GI、LI | ✅ 可以 | ❌ **不支持** |
| 结算货币 | cny（任何国家）+ 本国货币 | cny（任何国家）+ 本国货币 |

**微信 WeChat Pay 完整可用国家名单（22 个）**：
AT AU BE CA CH DE DK ES FI FR GB HK IE IT JP LU NL NO PT SE SG US

所以第一步必须先确认账号注册在哪个国家 —— 我在代码里查不到这个信息
（仓库里只能看出默认结算货币是 usd、另外支持 krw/cny 计价，
推不出账号的注册国），只有后台能看。

---

## 1. 确认账号注册国 + 看这个地区能开哪些方式

**路径**：Stripe Dashboard → 左下角 **Settings（设置）** → **Business（业务）** →
**Business details / 业务详情** → 看 **Country / 国家** 字段。

这个国家在开户时就定了，**之后改不了**（要换国家只能新开账号）。

然后：

**路径**：Dashboard → **Settings** → **Payments（支付）** → **Payment methods（支付方式）**
直达链接：`https://dashboard.stripe.com/settings/payment_methods`

在这一页你会看到全部支付方式列表。**关键是看 Alipay 和 WeChat Pay 这两条右边的状态**：
- 显示 **Turn on / 开启** 按钮 → 你这个地区支持，可以直接开
- 显示 **Request access / 申请** → 需要提交申请等审核
- **压根没有这一条** → 你的账号注册国不支持它（对照上面表格）

> 📌 把这一页截图发我，我就能确定后面代码要怎么改。

---

## 2. 开通支付宝

**路径**：Settings → Payments → Payment methods → 找到 **Alipay** → 点 **Turn on**

- 不需要单独签合同
- 开通后状态会从 pending 变成 **Live**（有时会收到确认邮件）
- 注意 Stripe 和支付宝各自都有**禁止业种清单**。我们是命理/占卜类内容服务，
  这一类在部分支付渠道会被归到限制业种。**如果开通被拒或者一直 pending，
  多半是这个原因**，需要联系 Stripe support 说明业务性质，别以为是点错了。

## 3. 开通微信支付

**路径**：同一页 → 找到 **WeChat Pay** → 点 **Turn on** 或 **Request access**

- 微信**不会**随支付宝一起开通，必须单独点
- 如果账号注册国不在上面那 22 个里，这一条不会出现
- 同样受禁止业种清单约束

## 4. 确认结算货币

**路径**：Settings → **Business** → **Bank accounts and currencies（银行账户与货币）**

支付宝/微信默认按 **CNY** 向用户展示金额。要用 CNY 收款，账号得支持这个币种；
不支持的话联系 Stripe support 逐案添加。

---

## 5. 代码这边已经准备好的部分

### 现有 Stripe 调用点清单（全仓查证，只有一处）

| 位置 | 接口 | payment_method_types | mode |
|---|---|---|---|
| `server/routes/payment.js:271` | `stripe.checkout.sessions.create` | `payMethods` → 韩国 `KR_PAY_METHODS`(默认 `['card']`) / CNY `['card','alipay']` / 其他 `['card']` | `isSubscription ? 'subscription' : 'payment'` |

全仓没有第二处 `checkout.sessions.create`、没有 `paymentIntents.create`、
也没有 `subscriptions.create` —— 收钱入口只有这一个，改动面很小。

另有三条**不走 Stripe** 的自建中台路径（微信/支付宝扫码，无代扣资质，手动周期包）：
`/api/pay/wechat/create`（payment.js:590）、`/api/pay/alipay/qr`（:688）、
`/api/pay/stripe/create`（:767，走中台转 Stripe）。这次不动它们。

### 🔴 查到一个会被「开通支付宝」这个动作激活的洞（已在本分支修好）

`payMethods` 和 `isSubscription` 此前是**各算各的**：

```js
const isCN   = ipCountry === 'CN';            // ← 只看 IP
if (isCN) return res.json({ channel:'cn', ... });   // 大陆 IP 在这里被拦走

const isCNY  = !isKR && (region === 'cn' || currency === 'cny');  // ← 看请求体
const payMethods = isCNY ? ['card','alipay'] : ['card'];
...
const isSubscription = ['member_yearly', ...].includes(product);   // ← 看产品
stripe.checkout.sessions.create({ payment_method_types: payMethods,
                                  mode: isSubscription ? 'subscription' : 'payment' })
```

拦截看 **IP**，但计价看 **请求体**。所以非大陆 IP（港澳台 / 新马 / 海外华人 /
任何 VPN）只要请求体里带 `region:'cn'` 或 `currency:'cny'`，买的又是会员，
就会组合出 `['card','alipay']` + `mode:'subscription'` → **Stripe 直接拒掉 →
那个 catch 返回 500 → 用户根本订不了。**

**现在炸没炸？没有。** 实测查过：当前所有前端调用 `/api/create-checkout` 都
不传 `region`/`currency`（`pages/*.html` 里只传 product / ref_code / price / lang），
所以 `isCNY` 恒为 false，这条路今天走不到。

**但这正是这次要做的改动会激活的洞** —— 一旦把 CNY/支付宝接进前端，会员就订不了了。
所以先堵：`server/lib/stripe-methods.js` 的 `resolvePaymentMethods()`
在 `mode==='subscription'` 时把 alipay/wechat_pay 剔掉并回落到 `['card']`，
剔除时打一条 warn 日志。9 个单测覆盖（含「本来就只有 card 不受影响」的负面验证）。

---

## 6. 后台开通之后要做的验收（**这条必须做**）

踩过一次：塔罗付费门第一版把买 $19.90 和 $9.00 的用户全挡了，
因为传的产品键不在 `UNLOCK_BY_CATEGORY` 表里。所以：

- [ ] **用真实的已付费订单回归**，确认没有把已付费用户挡在外面
- [ ] 一次性产品：CNY 计价 → 支付宝渠道出现 → 能付 → webhook 回来 → 发货正常
- [ ] 会员订阅：CNY 计价 → **只出现信用卡**、不报 500 → 能订 → 续费正常
- [ ] 美元一次性 / 美元订阅：与改动前完全一致（不能被这次改动影响）
- [ ] 韩国 KRW 路径：`KR_PAY_METHODS` 自定义方式不被误剔（单测已覆盖，线上再确认一次）

> 本机没有 `STRIPE_SECRET_KEY`，收钱链路跑不了真实下单，
> 按铁律「收钱链路本地跑不了就出说明书不出代码」，
> 这次只改了纯逻辑（支付方式选择）并单测覆盖，真实回归留给后台开通后做。
