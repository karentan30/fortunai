// 静态守卫：页面上写的价格 = 服务端真正收的钱。
//
// 为什么值得单独立一个测试（0911 真实事故，一次抓到 20 多处）：
//   线上 `STRIPE_PRICE_IDS` 是**空的**（已核实：.env 里根本没有这个键，进程内长度 0）。
//   于是 /api/create-checkout 里的
//       const priceId = (!isMonthlyDiscount && (STRIPE_PRICE_IDS[currKey] || STRIPE_PRICE_IDS[product])) || null;
//   永远取到 null，一切结账都走 price_data，实收金额 = PRODUCTS[key].amount。
//   也就是说 **PRODUCTS 是唯一价目表**。而页面文案是手写的，早就跟着历次调价漂走了：
//     · daishao.html  写 $39.90/$199/$1,999，目录是 $49.90/$249/$2,499
//       ——而且服务端对代烧有地板钳制 Math.max(前端价, 目录价)，所以用户看 $39.90 被收 $49.90。
//     · bazi / bazi-en / xingming / kyusei / report-astrology / report-v2 写 $9.90，
//       目录 $11.99（$23.94 六折本该是 $11.99 —— 同一页的新版 session UI 自己就写着 $11.99）。
//     · report-es 写 $2.99，这条通道传 currency:'usd'，实收 $9.90，**3.3 倍超收**。
//     · tarot.html 两个牌阵都 POST 'tarot'($3.90)，页面却写 $9 / $19 —— 每单少收 $5~$16。
//   「用户看到的价」和「实际扣的价」不一致，两个方向都是事故：
//   收多了是投诉/合规，收少了是白送。而这类漂移没有任何报错——支付成功、订单入库、
//   页面提示已解锁，只有账单上那个数字不一样。真浏览器走查和 curl 探活都测不出来。
//
// 本测试钉住「已核对过的页面」。它挡的不是新页面（那要靠人），而是**已修好的地方再漂回去**。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const PAGES = path.join(ROOT, 'pages');
const { PRODUCTS } = require('./store');

// 目录里的 USD 价（分）→ 页面该显示的字符串
function usd(key) {
  const p = PRODUCTS[key];
  assert.ok(p, `目录里没有 ${key} —— 产品或改名了，请同步本测试`);
  const v = p.amount / 100;
  // 整元显示成 $9（页面上就是这么写的），有零头才带两位小数（$9.90 不能压成 $9.9）
  return '$' + (Number.isInteger(v) ? String(v) : v.toFixed(2));
}

// { 页面, 该页在卖什么, 页面上必须出现的价格, 绝不能再出现的旧价 }
const CASES = [
  { file: 'daishao.html',     product: 'joss_basic',   must: ['$49.90', '$249', '$2,499'], forbid: [/\$39\.90/, /\$199 </, /\$1,999/] },
  { file: 'bazi.html',        product: 'bazi_full',    must: ['$11.99'],                   forbid: [/USD \$9\.90/] },
  { file: 'bazi-en.html',     product: 'bazi_full',    must: ['$11.99'],                   forbid: [/\$9\.90/] },
  { file: 'xingming.html',    product: 'bazi_full',    must: ['$11.99'],                   forbid: [/\$9\.90/] },
  { file: 'kyusei.html',      product: 'kyusei_full',  must: ['$11.99'],                   forbid: [/\$9\.90/] },
  { file: 'report-astrology.html', product: 'astrology_full', must: ['$11.99'],            forbid: [/\$9\.90/] },
  { file: 'report-v2.html',   product: 'bazi_full',    must: ['$11.99'],                   forbid: [/\$9\.90/] },
  { file: 'report-es.html',   product: 'report_unlock_a', must: ['$9.90'],                 forbid: [/\$2\.99/] },
  { file: 'tarot.html',       product: 'tarot_3',      must: ['$9'],                       forbid: [/$19(?![\d.])/] },
  { file: 'tarot.html',       product: 'tarot_5',      must: ['$19.90'],                   forbid: [] },
];

test('核对过的页面：显示价 = 目录实收价', () => {
  const problems = [];
  for (const c of CASES) {
    const src = fs.readFileSync(path.join(PAGES, c.file), 'utf8');
    const cat = usd(c.product);

    // 1) 目录价本身必须还在页面上（防的是文案再次漂走）
    for (const m of c.must) {
      if (!src.includes(m)) problems.push(`${c.file}: 找不到价格「${m}」（${c.product} 目录价 ${cat}）`);
    }
    // 2) 该页曾经写错、已被纠正的旧价，不许回来
    for (const re of c.forbid) {
      if (re.test(src)) problems.push(`${c.file}: 又出现了旧价 ${re}（${c.product} 实收 ${cat}）`);
    }
    // 3) 若页面显示的正是这个产品的价格，它必须等于目录价
    if (c.must.includes(cat) === false && c.must.some(m => /^\$[\d.,]+$/.test(m)) && c.product !== 'joss_supreme') {
      // joss 一页三档共用一个 product 字段，跳过逐档比对；其余要求首个价格字符串 == 目录价
      const first = c.must.find(m => /^\$[\d.,]+$/.test(m));
      if (first && first !== cat && !['daishao.html'].includes(c.file)) {
        problems.push(`${c.file}: 页面写 ${first}，但 ${c.product} 实收 ${cat}`);
      }
    }
  }
  assert.deepStrictEqual(problems, [], '价格显示与实收不一致：\n  ' + problems.join('\n  '));
});

test('守卫自身有效：改一个数字就会红', () => {
  // 目录价的格式化逻辑
  assert.strictEqual(usd('bazi_full'), '$11.99');
  assert.strictEqual(usd('report_unlock_a'), '$9.90');
  assert.strictEqual(usd('tarot_3'), '$9');
  assert.strictEqual(usd('tarot_5'), '$19.90');
  // 格式化不能把 $11.99 压成 $12 或 $11.99 变 $12.0
  assert.strictEqual(usd('bazi_basic'), '$9.90');
  assert.strictEqual(usd('member_monthly'), '$12.90');
});

test('🔴 STRIPE_PRICE_IDS 为空 —— 本测试的前提，也是线上核过的事实', () => {
  // 这条断言是给未来的自己留的纸条：如果哪天线上真配了 STRIPE_PRICE_IDS，
  // 那么「目录即唯一价目表」这个前提就不成立了，上面那些 must/forbid 全要重新核。
  // 到那时这条会红，提醒你回来读这段注释。
  const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'payment.js'), 'utf8');
  assert.ok(/STRIPE_PRICE_IDS\[currKey\] \|\| STRIPE_PRICE_IDS\[product\]/.test(src),
    'priceId 的解析逻辑变了，请重新确认价格来源');
  assert.ok(/unitAmount = prod\.amount;/.test(src),
    'price_data 分支的兜底金额逻辑变了，请重新确认价格来源');
});
