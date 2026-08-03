# 产品推荐系统 — 快速集成指南

> 从代码提交到上线的完整清单（5-10分钟）

## 🚀 部署步骤

### Step 1: 服务器部署

```bash
# SSH进入服务器（用您的密钥）
ssh -i ~/.ssh/key.pem root@47.242.80.65

# 进入项目目录
cd /www/shenyuan

# 拉取最新代码
git pull origin main

# 安装依赖（如需）
npm install

# 重启应用
pm2 restart shenyuan

# 验证日志
pm2 logs shenyuan --lines 30
```

### Step 2: 前端集成

**在三个报告页面（jyotish.html/maya.html/tibet.html）中添加以下代码：**

**在</head>前加入样式引入：**
```html
<!-- 产品推荐样式 -->
<link rel="stylesheet" href="/css/product-recommender.css">
```

**在报告显示区下方加入：**
```html
<!-- 产品推荐Widget -->
<div id="product-recommender-root"></div>

<!-- 产品推荐脚本 -->
<script src="/js/product-recommender-widget.js"></script>
```

**在报告生成成功后调用：**
```javascript
// 示例：在生成Jyotish报告的函数中
async function generateJyotishReport(birthData) {
  const report = await fetch('/api/jyotish', {
    method: 'POST',
    body: JSON.stringify(birthData)
  }).then(r => r.json());

  // 显示报告
  document.getElementById('report-display').innerHTML = report.report;

  // 触发产品推荐 ← 新增
  const diagnostics = {
    bazi_element: report.diagnostics.bazi_element,
    jyotish_category: report.diagnostics.jyotish_category,
    maya_kin_color: report.diagnostics.maya_kin_color,
    tibet_zodiac: report.diagnostics.tibet_zodiac
  };
  
  window.showProductRecommendations(diagnostics);
}
```

### Step 3: API测试

**测试推荐API：**
```bash
# 基础测试
curl "http://localhost:3000/api/recommend-products/test?bazi_element=fire&jyotish_category=fire_signs"

# 完整测试（四轨系统）
curl "http://localhost:3000/api/recommend-products/test?bazi_element=fire&jyotish_category=fire_signs&maya_kin_color=red_kin&tibet_zodiac=dragon"
```

**预期响应：**
```json
{
  "success": true,
  "reportId": "test",
  "recommendations": {
    "products": [
      {
        "id": "incense_agarwood_001",
        "name": "沉香线香礼盒(越南进口)",
        "price_usd": 19.90,
        "price_cny": 49,
        "recommended_reason": "火命需要稳定锚点",
        "description": "越南高级沉香..."
      },
      ...
    ],
    "total": 5,
    "reasons": ["火命需要稳定能量，红色能量强化自信"]
  }
}
```

---

## 📁 文件清单

### 后端文件
- ✅ `server/lib/product-recommender.js` — 推荐引擎（16个SKU产品库）
- ✅ `server/routes/products.js` — 产品API端点
- ⏳ `server/routes/divination.js` — 需要集成products路由

### 前端文件
- ✅ `pages/components/product-recommender-widget.html` — Widget HTML/CSS/JS
- ⏳ 需要拆分为：
  - `pages/css/product-recommender.css`
  - `pages/js/product-recommender-widget.js`

### 文档文件
- ✅ `docs/dropshipping-workflow-guide.md` — 完整工作流指南
- ✅ `docs/taobao-procurement-list-cn.md` — 淘宝采购清单
- ✅ `docs/ShenYuan定价建议-Executive-Summary-0803.md` — 定价策略
- ✅ `docs/sample-reports-multitrack.md` — 样报告展示

---

## 🔌 API集成清单

### 在 server/index.js 中注册路由

```javascript
// 在现有的 app.use() 中添加
const productRoutes = require('./routes/products');
app.use('/api', productRoutes);

// 验证路由已注册
// curl http://localhost:3000/api/recommend-products/test
```

### Supabase数据库迁移（可选，初期使用内存）

```sql
-- 创建订单表（初期可选，代码中已注释）
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  order_code TEXT UNIQUE,
  total_price DECIMAL(10,2),
  currency TEXT DEFAULT 'USD',
  payment_method TEXT,
  status TEXT DEFAULT 'pending_payment',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- 创建订单项表
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  product_id TEXT,
  quantity INT DEFAULT 1,
  price DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT now()
);
```

---

## 📊 测试场景

### 场景1: 火命用户推荐

```
输入: bazi_element=fire
期望输出: 红玛瑙 + 红灯 + 沉香
```

### 场景2: 水象月宫推荐

```
输入: jyotish_category=water_signs
期望输出: 海蓝宝 + 紫晶簇
```

### 场景3: 红色Kin推荐

```
输入: maya_kin_color=red_kin
期望输出: 象神红色版 + 红灯
```

### 场景4: 龙年生肖推荐

```
输入: tibet_zodiac=dragon
期望输出: 龙纹护符 + 翡翠象神
```

### 场景5: 完整四轨推荐

```
输入: bazi_element=fire&jyotish_category=fire_signs&maya_kin_color=red_kin&tibet_zodiac=dragon
期望输出: 最多5个产品，涵盖所有四个系统的建议
```

---

## 🛒 购物车测试

### 本地测试（浏览器Console）

```javascript
// 模拟诊断数据
const diagnostics = {
  bazi_element: 'fire',
  jyotish_category: 'fire_signs',
  maya_kin_color: 'red_kin',
  tibet_zodiac: 'dragon'
};

// 初始化widget
window.showProductRecommendations(diagnostics);

// 添加到购物车
window.productRecommender.addToCart('incense_agarwood_001', 19.90);

// 查看购物车
console.log(window.productRecommender.cart);

// 查询总价
console.log(window.productRecommender.cart.reduce((sum, item) => sum + item.price_usd, 0));
```

---

## 💰 定价验证

### 检查产品定价是否正确

```javascript
// 在Console中执行
fetch('/api/products/incense_agarwood_001')
  .then(r => r.json())
  .then(data => console.log(data.product))

// 预期输出：
// {
//   name: "沉香线香礼盒(越南进口)",
//   price_usd: 19.90,
//   price_cny: 49,
//   margin_pct: 95,
//   ...
// }
```

---

## 🎯 上线前检查清单

- [ ] 后端代码已部署到 /www/shenyuan
- [ ] `npm install` 成功（包括 express-rate-limit）
- [ ] `pm2 restart shenyuan` 无错误
- [ ] API端点 `/api/recommend-products/test` 可访问
- [ ] 前端widget代码已分离为 css 和 js 文件
- [ ] 三个报告页面已集成widget
- [ ] 测试推荐API响应正确产品
- [ ] 购物车功能正常工作
- [ ] 响应式设计在手机上正常显示
- [ ] 产品图片显示正常
- [ ] 支付按钮跳转到结账页面

---

## 🚨 常见问题

**Q: Widget不显示？**
A: 检查浏览器Console是否有错误。确保以下文件存在：
- `pages/components/product-recommender-widget.html`
- 检查API是否返回200和正确的JSON

**Q: 推荐产品为空？**
A: 确保诊断参数正确传递。检查：
```javascript
// 在Console中验证
fetch('/api/recommend-products/test?bazi_element=fire')
  .then(r => r.json())
  .then(d => console.log(d.recommendations.products.length))
// 应该返回 > 0
```

**Q: 购物车数据丢失？**
A: 这是预期行为（初期使用内存存储）。刷新页面会清空购物车。
**解决方案**：集成Supabase数据库后，数据会持久化。

**Q: 支付集成在哪里？**
A: `/checkout` 页面需要单独实现：
- Stripe集成（美国/国际用户）
- 微信支付集成（中国用户）
详见: `docs/dropshipping-workflow-guide.md` 订单管理章节

---

## 🎬 演示流程（3分钟）

1. 打开 https://localhost:3000/jyotish.html
2. 填表格，点"生成报告"
3. 等待报告生成（免费部分显示）
4. 自动出现5个推荐产品
5. 点"加入购物车"（演示两个产品）
6. 右侧购物车浮窗显示小计
7. 点"立即结账"（跳转到支付页面 — 待实现）

---

## 📈 后续优化（Phase 2）

- [ ] Stripe支付网关集成
- [ ] 微信支付集成
- [ ] Supabase订单存储
- [ ] 邮件通知系统
- [ ] 淘宝API自动订单转接
- [ ] 用户评价系统
- [ ] 产品库动态更新
- [ ] A/B测试框架

---

**版本**: v1.0 (2026-08-03)  
**维护**: Karen + Product Team  
**反馈**: 在SHENYUAN Slack #product-roadmap 频道讨论
