# 安全/支付/性能修复清单 v1.0

## 🔴 CRITICAL 安全漏洞

### 1. API密钥硬编码暴露 [文件:2]
- ✅ `/Users/karen/projects/shenyuan/docs/gen-karen-reports.js:4` - DeepSeek key暴露
- ✅ `/Users/karen/projects/shenyuan/blog/generate.js:7` - 备用key暴露
- 修复: 改用 `process.env.DEEPSEEK_API_KEY`
- 密钥状态: **需立即轮换** (sk-8597ac6c84d344039e09c8f947e4022b)

### 2. XSS漏洞 (innerHTML使用 56处)
文件:
- `/Users/karen/projects/shenyuan/pages/bazi.html` (21处)
- `/Users/karen/projects/shenyuan/docs/report-100pages-CN.html`
- `/Users/karen/projects/shenyuan/docs/report-100pages-EN.html`
- `/Users/karen/projects/shenyuan/server/routes/payment.js`
- 等6+ 其他文件

关键位置:
- `bazi.html:735-737` - 年月日下拉框 (需用textContent替换)
- `bazi.html:782` - 按钮加载态 HTML
- `bazi.html:837` - 报告流式输出
- `bazi.html:1014-1069` - 支付模态框
- `bazi.html:1213,1227,1235,1256,1270` - 核心报告/订阅UI

修复: 所有 `innerHTML =` 改 `textContent =` (关键数据);纯HTML用DOMParser验证

### 3. Token存储在localStorage [22处]
- `bazi.html:798,805` - fetchBaziReport时读token
- `bazi.html:878,881` - fetchQAReport时读token
- `bazi.html:1026,1035,1049` - createCheckout/支付时读token
- `bazi.html:1127-1131` - handlePaidReturn读token
- `bazi.html:1951,1957` - 订阅/推荐码时读token

修复: 改用 `document.cookie` with `httpOnly=true` (仅服务器设置)

### 4. ref_code无格式验证 [3处]
- `index.html:463` - 无正则验证 `sy_ref`
- `bazi.html:1957` - 无验证推荐码
- 支付链路无CSRF protection

修复:
```javascript
// 白名单正则
const REF_CODE_PATTERN = /^[a-zA-Z0-9_-]{1,32}$/;
if (!REF_CODE_PATTERN.test(refCode)) throw new Error('Invalid ref code');

// CSRF token: 支付前生成并验证
const csrfToken = generateCSRFToken(); // 存sessionStorage
fetch('/api/create-checkout', {
  headers: { 'X-CSRF-Token': csrfToken }
})
```

### 5. 敏感信息日志泄露
- `bazi.html:1342` - 网络错误明文输出
- 后端日志可能记录邮箱/生日
- 支付响应无脱敏处理

修复: 日志不输出邮箱/phone/birth_date; 支付单号用prefix隐藏

---

## 🟠 P0 支付Bugs

### 1. localStorage字段不匹配 [bazi.html:1123]
```javascript
// BUG: 保存时用 'sy_last_bazi'，读时检查year字段但input结构或JSON parse失败
try { saved = JSON.parse(localStorage.getItem('sy_last_bazi') || 'null'); } catch(e){}
if (saved && saved.year) { // ← saved可能是{year,month,day,hour,name,gender} 但结构不清晰
```

修复: 统一schema:
```javascript
const BAZI_SCHEMA = {year, month, day, hour, name, gender, ts: Date.now()};
// 读时验证结构
function validateBaziInput(obj) {
  return obj && typeof obj.year === 'number' && obj.year >= 1900 && obj.year <= 2099;
}
```

### 2. 韩文支付函数缺失 (startKrPayment未实现)
- saju-landing-KR.html 无韩文支付流
- 韩国사주 报告页无payment path
- Stripe/PG integration incomplete

修复: 实现Korea-specific checkout:
```javascript
function startKrPayment(product, price) {
  fetch('/api/create-checkout', {
    body: JSON.stringify({
      product, price,
      region: 'KR',
      currency: 'KRW'
    })
  })
}
```

### 3. 微信支付无超时处理 [bazi.html:1082-1091]
```javascript
var pollTimer = setInterval(function(){
  fetch('/api/pay/wechat/query?out_trade_no=...') // 无超时·无重试次数限制
    .then(...).catch(function(){});
}, 3000);
// ← 永久轮询！60秒后应显示"支付超时"提示
```

修复:
```javascript
var pollCount = 0, maxPolls = 20; // 20 * 3s = 60s timeout
var pollTimer = setInterval(function(){
  pollCount++;
  if (pollCount > maxPolls) {
    clearInterval(pollTimer);
    modal.remove();
    showToast('支付超时，请重试', 'error');
    return;
  }
  fetch(...)
}, 3000);
```

### 4. 微信二维码无倒计时显示 [bazi.html:1073]
- 用户不知道二维码多久过期
- UX反馈不足

修复: 加倒计时:
```html
<div id="cnPayCountdown" style="font-size:12px;color:#c9820a;margin-top:8px">
  二维码有效期: <span id="countdownSec">60</span>秒
</div>
<script>
var sec = 60;
setInterval(() => {
  document.getElementById('countdownSec').textContent = --sec;
  if (sec <= 0) modal.remove();
}, 1000);
</script>
```

### 5. 支付失败无"重试"按钮 [bazi.html:1051-1056]
```javascript
if(pd.code_url) { showCnPayModal(...); }
else { showToast('支付服务暂不可用，请稍后重试', 'error'); }
// ← Toast后按钮还是disable状态，用户卡住
```

修复: 显示retry button:
```javascript
else {
  btn.disabled = false; btn.textContent = label;
  showToast('支付服务暂不可用，点击重试', 'error');
}
```

### 6. API失败原因不说明
- 所有 catch 只输出generic "网络异常"
- 用户无法debug (DNS? timeout? 400?)

修复: 级联错误信息:
```javascript
.catch(function(err) {
  var msg = err.message;
  if (msg.includes('Failed to fetch')) msg = '网络连接失败';
  if (msg.includes('timeout')) msg = '请求超时(60s)';
  showToast(msg, 'error');
})
```

---

## 🟡 P1 补充修复

### 1. 18+年龄门 (缺失)
- 所有支付页无年龄确认
- 合规风险: 未成年人可能购买灵性服务

修复: 支付前确认:
```javascript
// 中国/韩国
<input type="checkbox" id="ageConfirm" required>
  <label>我年满18周岁，理解本服务为娱乐用途</label>
// 海外版本：同意PIPL数据处理
```

### 2. 支付超时提示 (30s+)
- bazi.html:175-200 loading屏无超时提示
- 用户以为崩了

修复: 加提示:
```javascript
if (timeElapsed > 30000) {
  showToast('报告生成中…若超过60秒请刷新页面', 'warning');
}
```

### 3. 无支付完成失败回退
- 支付modal关闭后若query失败，用户卡在报告页
- 需"返回重新排盘"按钮

修复:
```javascript
function showCnPayModal(codeUrl, outTradeNo, amountFen) {
  // 加按钮
  '<button onclick="closePayment()">返回重新排盘</button>'
}
function closePayment() {
  document.getElementById('cnPayModal').remove();
  document.getElementById('reportScreen').style.display = 'none';
  document.getElementById('inputScreen').style.display = 'block';
}
```

---

## 🟢 性能优化

### 1. 首屏加载 8s → <5s
- 优化: 移除unused styles (90KB → <50KB)
- 代码分割: `gen-karen-report-v3.js` 延迟加载
- image lazy-load

### 2. 文件大小
- `bazi.html` - 已压缩 (需gzip)
- 移除冗余CSS (fontface未用+hex颜色重复)

### 3. 报告生成 15s → <10s
- 缓存DeepSeek response (1h TTL)
- Stripe redirect直接跳，勿等响应

---

## ✅ 修复优先级

| 优先级 | 项目 | 工作量 | 影响 |
|------|------|------|------|
| P0-1 | 轮换DeepSeek key | 5min | 防止API滥用 |
| P0-2 | XSS修复 (innerHTML→textContent) | 2h | 代码注入防护 |
| P0-3 | Token→httpOnly cookie | 2h | 防XSS/CSRF |
| P0-4 | ref_code正则+CSRF token | 1h | 推荐链接安全 |
| P1-1 | 微信支付超时+倒计时 | 30min | UX改进 |
| P1-2 | 18+年龄门 | 20min | 合规 |
| P1-3 | 性能优化 (gzip+lazy) | 1h | 体验 |

---

## 🚀 验证方案

1. **XSS测试**: 注入 `<img src=x onerror="alert('XSS')">` 到name字段 → 应blocked
2. **CSRF测试**: curl支付API时不带X-CSRF-Token → 应401
3. **Token测试**: 删localStorage后刷新 → 应读cookie not localStorage
4. **支付超时**: 故意断网60s → 应显示"支付超时"不infinite loop

---

生成时间: 2026-08-11
目标完成: 2026-08-11 EOD
