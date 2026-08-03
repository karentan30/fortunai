/**
 * routes/products.js — 产品推荐 & Dropshipping
 * GET  /api/recommend-products/:reportId — 根据命理报告推荐产品
 * POST /api/products/purchase — 创建购单（Dropshipping）
 * GET  /api/products/:id — 获取产品详情
 */

const router = require('express').Router();
const { recommendProducts, PRODUCT_CATALOG } = require('../lib/product-recommender');
const { rateLimitMiddleware } = require('../middleware');

// ══════════════════════════════════════════════════════════════
// GET /api/recommend-products/:reportId
// 根据用户的命理诊断结果推荐产品
// ══════════════════════════════════════════════════════════════
router.get('/recommend-products/:reportId', rateLimitMiddleware, async (req, res) => {
  try {
    const { reportId } = req.params;

    // 从数据库获取用户的诊断数据
    // 这里假设reportId对应的诊断结果已保存
    const userDiagnostic = {
      bazi_element: req.query.bazi_element || 'fire', // 用户的五行
      jyotish_category: req.query.jyotish_category || 'fire_signs', // Jyotish分类
      maya_kin_color: req.query.maya_kin_color || 'red_kin', // Maya Kin颜色
      tibet_zodiac: req.query.tibet_zodiac || 'dragon', // Tibet生肖
      tibet_element: req.query.tibet_element || 'fire_element' // Tibet元素
    };

    // 调用推荐引擎
    const recommendations = recommendProducts(userDiagnostic);

    res.json({
      success: true,
      reportId,
      recommendations: {
        products: recommendations.products,
        total: recommendations.total,
        reasons: recommendations.all_reasons,
        // 打包建议（可选）
        bundle_suggestions: {
          basic: {
            name: '基础供奉套装',
            products: recommendations.products.slice(0, 2),
            total_price_usd: recommendations.products.slice(0, 2).reduce((sum, p) => sum + p.price_usd, 0),
            discount: 0.1 // 10%优惠
          },
          premium: {
            name: '完整供奉套装',
            products: recommendations.products,
            total_price_usd: recommendations.products.reduce((sum, p) => sum + p.price_usd, 0),
            discount: 0.15 // 15%优惠
          }
        }
      }
    });
  } catch (err) {
    console.error('[RECOMMEND_ERR]', err.message);
    res.status(500).json({ error: '推荐系统暂时不可用' });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/products/purchase
// 创建Dropshipping购单
// ══════════════════════════════════════════════════════════════
router.post('/products/purchase', rateLimitMiddleware, async (req, res) => {
  try {
    const {
      userId,
      productIds, // 产品ID数组
      quantity = 1,
      shippingAddress,
      paymentMethod // 'stripe' or 'wechat'
    } = req.body;

    if (!userId || !productIds || productIds.length === 0) {
      return res.status(400).json({ error: '缺少必需字段' });
    }

    // 计算订单总价
    let totalPrice = 0;
    const orderItems = productIds.map(productId => {
      const product = PRODUCT_CATALOG[productId];
      if (!product) return null;
      const itemPrice = paymentMethod === 'wechat' ? product.price_cny : product.price_usd;
      totalPrice += itemPrice * quantity;
      return {
        productId,
        name: product.name,
        quantity,
        price: itemPrice,
        supplier: product.supplier
      };
    }).filter(Boolean);

    if (orderItems.length === 0) {
      return res.status(400).json({ error: '产品不存在' });
    }

    // 创建订单记录
    const orderId = `ORDER_${Date.now()}`;
    const order = {
      orderId,
      userId,
      items: orderItems,
      totalPrice,
      currency: paymentMethod === 'wechat' ? 'CNY' : 'USD',
      shippingAddress,
      paymentMethod,
      status: 'pending_payment',
      createdAt: new Date().toISOString(),
      fulfillmentStatus: 'not_started' // pending, processing, shipped, delivered
    };

    // TODO: 保存到数据库
    // await saveOrder(order);

    // 触发支付流程
    let paymentLink = null;
    if (paymentMethod === 'stripe') {
      // 创建Stripe Checkout Session
      paymentLink = `https://stripe.com/checkout/${orderId}`;
    } else if (paymentMethod === 'wechat') {
      // 创建微信支付二维码
      paymentLink = `https://api.wechat.pay/${orderId}`;
    }

    res.json({
      success: true,
      order,
      paymentLink,
      message: '订单已创建，请完成支付'
    });
  } catch (err) {
    console.error('[PURCHASE_ERR]', err.message);
    res.status(500).json({ error: '购单创建失败' });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/products/:id
// 获取单个产品详情
// ══════════════════════════════════════════════════════════════
router.get('/products/:id', async (req, res) => {
  try {
    const product = PRODUCT_CATALOG[req.params.id];

    if (!product) {
      return res.status(404).json({ error: '产品不存在' });
    }

    res.json({
      success: true,
      product: {
        ...product,
        // 添加动态信息
        inStock: true,
        estimatedShipping: '3-7天',
        reviews: {
          rating: 4.8,
          count: 1250
        }
      }
    });
  } catch (err) {
    console.error('[PRODUCT_ERR]', err.message);
    res.status(500).json({ error: '获取产品信息失败' });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/orders/:orderId/webhook
// Dropshipping供应商的发货通知Webhook
// ══════════════════════════════════════════════════════════════
router.post('/orders/:orderId/webhook', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, trackingNumber, supplier } = req.body;

    // 更新订单状态
    // await updateOrderStatus(orderId, { status, trackingNumber });

    // 如果已发货，发送通知给用户
    if (status === 'shipped') {
      // 发送邮件/短信通知
      // await notifyUser(orderId, `您的订单已发货，追踪号：${trackingNumber}`);
    }

    res.json({ success: true, message: '订单状态已更新' });
  } catch (err) {
    console.error('[WEBHOOK_ERR]', err.message);
    res.status(500).json({ error: 'Webhook处理失败' });
  }
});

module.exports = router;
