# ShenYuan Dropshipping 完整工作流指南

> 从命理报告到产品推荐，再到用户收货的端到端流程

## 目录
1. [系统架构](#系统架构)
2. [用户流程](#用户流程)
3. [产品库管理](#产品库管理)
4. [推荐规则](#推荐规则)
5. [订单管理](#订单管理)
6. [供应商管理](#供应商管理)
7. [财务模型](#财务模型)

---

## 系统架构

```
用户完成命理诊断
       ↓
后端计算诊断结果（五行/月宫/Kin/Mewa等）
       ↓
触发推荐引擎（/api/recommend-products）
       ↓
前端展示5个推荐产品 + 价格 + 打包套餐
       ↓
用户选择购买
       ↓
生成订单 → Stripe/微信支付
       ↓
发送淘宝/Amazon dropshipping商户
       ↓
商户发货 → 用户
       ↓
订单完成 + 评价
```

---

## 用户流程

### Stage 1: 诊断报告页面

**页面流程**：
```
打开 /jyotish.html (或 /maya.html / /tibet.html)
  ↓
填表格（出生日期/性别/城市等）
  ↓
点"生成报告"
  ↓
显示免费部分（前300字）+ 解锁提示
  ↓
显示"推荐为你选择的产品" 
  ↓ 【触发推荐引擎】
  ↓
展示5个推荐产品卡片
```

### Stage 2: 产品推荐展示区

**样式参考**：（见下方前端代码）

```html
<div class="products-recommendation">
  <h3>根据你的<诊断系统>，我们为你精选了这些灵性产品</h3>
  
  <div class="products-grid">
    <!-- 推荐产品卡片 -->
    <div class="product-card">
      <img src="product.image" />
      <h4>product.name</h4>
      <p class="reason">{{ product.recommended_reason }}</p>
      <div class="price">
        <span class="usd">${{ product.price_usd }}</span>
        <span class="cny">¥{{ product.price_cny }}</span>
      </div>
      <button class="add-to-cart">加入购物车</button>
    </div>
  </div>
  
  <!-- 打包建议 -->
  <div class="bundle-suggestions">
    <h4>或购买套装（节省10-15%）</h4>
    <div class="bundles">
      <div class="bundle basic">
        <h5>基础套装</h5>
        <ul><!-- 前2个产品 --></ul>
        <span class="price">$49.99（节省$9.81）</span>
      </div>
      <div class="bundle premium">
        <h5>完整套装</h5>
        <ul><!-- 全5个产品 --></ul>
        <span class="price">$99.99（节省$14.41）</span>
      </div>
    </div>
  </div>
</div>
```

### Stage 3: 购物车 & 支付

**流程**：
```
点击"加入购物车" 
  ↓
弹出购物车浮窗（右侧滑出）
  ↓
显示选中产品 + 小计
  ↓
选择"结账"
  ↓
跳转 /checkout 页面
  ↓
输入运送地址
  ↓
选择支付方式（Stripe / WeChat Pay）
  ↓
完成支付
  ↓
订单创建成功 → 订单号发送邮件/短信
  ↓
后台自动发送淘宝/Amazon订单
```

---

## 产品库管理

### 产品数据结构

```javascript
{
  id: 'unique_product_id',
  name: '产品中文名称',
  category: 'incense|crystal|lamp|elephant|amulet|bundle',
  
  // 定价（双币）
  price_cny: 49,        // 人民币价格
  price_usd: 19.90,     // 美元价格
  
  // 成本与利润
  cost_cny: 12,         // 淘宝进价
  margin_pct: 90,       // 利润率 %
  
  // 媒体与描述
  image: 'https://...',
  description: '简短描述',
  
  // 供应商信息
  supplier: 'dropship_taobao',        // dropship_taobao | dropship_amazon
  supplier_link: 'https://taobao.com/...',
  
  // 分类与搜索
  keywords: ['fire', 'crystal', 'energy']
}
```

### 产品导入流程

**每周更新产品库**：

1. **查看淘宝/Amazon TOP 20热销**
   ```bash
   # 查看当前热销清单
   cat docs/taobao-procurement-list-cn.md
   ```

2. **新增或更新产品**
   ```bash
   # 编辑产品库
   vim server/lib/product-recommender.js
   ```

3. **部署到生产**
   ```bash
   git add -A
   git commit -m "Update product catalog: add 3 new incense SKUs"
   git push
   ssh 47.242.80.65 'cd /www/shenyuan && git pull && pm2 restart shenyuan'
   ```

---

## 推荐规则

### 规则映射表

#### 八字 → 产品推荐

| 五行 | 推荐产品 | 理由 |
|------|--------|------|
| **火** | 红玛瑙 + 红灯 + 沉香 | 火命需要稳定锚点 |
| **水** | 海蓝宝 + 紫晶簇 + 藏香 | 水命需要平和能量 |
| **木** | 翡翠象神 + 檀香 | 木命需要生长象征 |
| **金** | 黄铜象神 + 灯 | 金命需要流动能量 |
| **土** | 龙纹护符 + 灯 | 土命需要稳定护持 |

#### Jyotish（印度占星） → 产品推荐

| 月宫 | 推荐 | 理由 |
|------|------|------|
| **水象**（巨蟹/天蝎/双鱼） | 海蓝宝 + 紫晶 | 平和+冥想 |
| **火象**（白羊/狮子/射手） | 红玛瑙 + 象神 | 稳定+保护 |
| **土象**（金牛/处女/摩羯） | 龙符 + 灯 | 护持+仪式感 |
| **风象**（双子/天秤/水瓶） | 藏香 + 紫晶 | 灵感+清晰 |

#### Maya Tzolkin → 产品推荐

| Kin颜色 | 推荐 |
|---------|------|
| **红色Kin** | 红灯 + 象神 + 玛瑙 |
| **白色Kin** | 紫晶 + 藏香 |
| **蓝色Kin** | 海蓝宝 + 护符 |
| **黄色Kin** | 翡翠象神 + 红灯 |

#### Tibet（藏传） → 产品推荐

| Mewa/生肖 | 推荐 |
|----------|------|
| **龙年/火** | 龙符 + 象神 |
| **火元素** | 红玛瑙 + 红灯 + 沉香 |
| **Mewa 7** | 任何红色产品（行动宫） |

### 推荐引擎代码

已在 `server/lib/product-recommender.js` 实现：

```javascript
recommendProducts(userProfile) {
  // userProfile 包含：
  // - bazi_element: 'fire'|'water'|'wood'|'metal'|'earth'
  // - jyotish_category: 'water_signs'|'fire_signs'|...
  // - maya_kin_color: 'red_kin'|'white_kin'|...
  // - tibet_zodiac: 'dragon'|...
  
  // 返回最多5个推荐产品 + 理由
  return {
    products: [...],
    all_reasons: [...]
  }
}
```

---

## 订单管理

### 订单生命周期

```
PENDING_PAYMENT      → 用户已创建订单，待支付
                       ↓ (Stripe/WeChat回调成功)
PAYMENT_CONFIRMED   → 支付成功，待发送淘宝
                       ↓ (后台自动/人工发送)
SENT_TO_SUPPLIER    → 订单已发送淘宝/Amazon
                       ↓ (Webhook: supplier发货通知)
SHIPPED             → 商户已发货，追踪号已获取
                       ↓ (自动+邮件通知用户)
DELIVERED           → 用户已收货
                       ↓ (用户确认/7天自动)
COMPLETED_REVIEW    → 用户已评价
```

### 订单数据存储（Supabase）

```sql
-- 订单表
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  order_code TEXT UNIQUE,  -- ORDER_1234567890
  total_price DECIMAL(10,2),
  currency TEXT,  -- USD | CNY
  shipping_address JSONB,
  payment_method TEXT,  -- stripe | wechat
  status TEXT,  -- PENDING_PAYMENT | PAYMENT_CONFIRMED | ...
  
  -- Supplier info
  supplier_name TEXT,  -- taobao | amazon
  supplier_order_id TEXT,
  tracking_number TEXT,
  
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- 订单项明细
CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  product_id TEXT,
  product_name TEXT,
  quantity INT,
  price DECIMAL(10,2),
  
  created_at TIMESTAMP
);
```

### 订单API

```bash
# 创建订单
POST /api/products/purchase
{
  userId: "user_123",
  productIds: ["incense_agarwood_001", "elephant_red_001"],
  quantity: 1,
  shippingAddress: { name, street, city, zip, country },
  paymentMethod: "stripe"  // or "wechat"
}

# 获取订单详情
GET /api/orders/:orderId

# 订单历史
GET /api/users/:userId/orders

# 供应商Webhook（自动更新订单状态）
POST /api/orders/:orderId/webhook
{
  status: "shipped",
  trackingNumber: "1234567890",
  supplier: "taobao"
}
```

---

## 供应商管理

### 淘宝 Dropshipping 对接

**步骤**：

1. **注册淘宝店铺代发账户**
   - 访问 `taobao.com/partners/dropshipping`
   - 提供营业执照（或个体工商户）
   - 获得代发API密钥

2. **集成淘宝API**（后续可选）
   ```javascript
   // server/lib/taobao-api.js
   const TaobaoAPI = require('taobao-sdk');
   
   async function sendOrderToTaobao(order) {
     const client = new TaobaoAPI({
       key: process.env.TAOBAO_API_KEY,
       secret: process.env.TAOBAO_API_SECRET
     });
     
     return client.createDropshipOrder({
       items: order.items.map(item => ({
         sku_id: item.taobao_sku_id,
         quantity: item.quantity
       })),
       receiver: order.shippingAddress
     });
   }
   ```

3. **手动订单转接**（目前简易方案）
   ```
   每日检查 orders 表中 status = PAYMENT_CONFIRMED 的订单
   ↓
   复制订单信息到淘宝购物车（或Excel导出）
   ↓
   在淘宝后台提交代发订单
   ↓
   淘宝给追踪号 → 更新 tracking_number 字段
   ↓
   自动邮件通知用户"您的订单已发货"
   ```

### Amazon Dropshipping（美国/欧洲）

**对接方式**：
- 高端产品（翡翠象神、紫晶簇等）直接从Amazon或速卖通采购
- 集成 FBA（Fulfilled by Amazon）加速物流
- 自动化：使用 Melaleuca 或 Jungle Scout API

---

## 财务模型

### 单产品利润计算

```
产品: 沉香线香礼盒
------
成本（淘宝进价）    ¥8 ($1.20)
零售价（美国）      $19.90
零售价（中国）      ¥49

毛利：
  美国：$19.90 - $1.20 = $18.70 (94%)
  中国：¥49 - ¥8 = ¥41 (84%)
  
运费（邮寄到美国）  $2-3/件
平台费（Stripe 2.9%+0.3）  $0.90
最终净利：
  美国：$18.70 - $2.50 - $0.90 = $15.30 (77%)
  中国：¥41 - ¥12 - ¥1.50 = ¥27.50 (56%)
```

### 月度财务预测

| 月份 | 订单数 | 客单价 | GMV | 毛利 | 净利 | 说明 |
|------|--------|--------|------|------|------|------|
| **M1** | 40 | $39.90 | $1,596 | $1,356 (85%) | $1,050 | 种子用户 |
| **M2** | 100 | $39.90 | $3,990 | $3,392 (85%) | $2,630 | 逐步增长 |
| **M3** | 180 | $39.90 | $7,182 | $6,105 (85%) | $4,720 | 加社媒投放 |
| **M4** | 280 | $45.00 | $12,600 | $10,710 (85%) | $8,300 | 加代烧线 |
| **M6** | 500 | $50.00 | $25,000 | $21,250 (85%) | $16,500 | 全量上线 |

**假设**：
- 转化率：3-5%（种子到种子+运营）
- 平均客单价：$39.90（报告）→ $45-50（加产品）
- 毛利率：85%（已包含国际运费+支付费率）
- 获客成本：$0-5（初期SNS有机）

---

## 运营清单

- [ ] 产品库：目前有12+产品（TOP品类），目标100+
- [ ] 推荐规则：四轨系统（八字/Jyotish/Maya/Tibet）已实现
- [ ] API接口：/api/recommend-products 已部署
- [ ] 前端widget：待集成到三个诊断页面
- [ ] 订单系统：Supabase表结构已设计
- [ ] 支付集成：Stripe测试中（微信支付待)
- [ ] 淘宝对接：手动流程已确认
- [ ] 通知系统：订单邮件+短信待实现

---

## 部署清单

**立即部署**：
```bash
# 1. 更新服务器代码
ssh 47.242.80.65
cd /www/shenyuan
git pull

# 2. 安装新依赖（如需）
npm install

# 3. 重启应用
pm2 restart shenyuan

# 4. 测试推荐API
curl "http://localhost:3000/api/recommend-products/test-report?bazi_element=fire&jyotish_category=fire_signs"
```

**前端集成**：
待下文详细代码

---

## 常见问题

**Q: 如果用户在美国，为什么要从淘宝买？**
A: 淘宝在亚洲的供给链效率最高。邮寄到美国5-7天，总成本仍然低于美国本土采购。

**Q: 毛利率85%，还要付运费？**
A: 85%是已经包含平均运费的（$2-3/件）。单笔订单实际毛利约75-80%。

**Q: 如何对付供应商缺货？**
A: 产品库中选了TOP品类，月销量35万+，不会缺货。同时保留3-5个替代SKU。

**Q: 是否需要自己做FBA？**
A: 暂不需要。初期用邮寄（成本低），用户体验满意度 > 95%后再考虑FBA。

---

**最后更新**: 2026-08-03  
**维护者**: ShenYuan Product Team  
**下一阶段**: Phase-2 真人连麦代烧服务
