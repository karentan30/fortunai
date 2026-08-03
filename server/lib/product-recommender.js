/**
 * 产品推荐引擎
 * 根据命理诊断结果推荐供奉/灵性产品（Dropshipping）
 */

/**
 * 产品库 v2 — 从淘宝爆品数据导入
 * 毛利率: 92% 平均 | 成本: ¥12-25/件 | 零售: $19.90-$39.90
 */
const PRODUCT_CATALOG = {
  // ═══════════════════════════════════════════════════════════
  // TOP 1: 沉香/檀香线香（销量35万+，毛利95%）
  // ═══════════════════════════════════════════════════════════
  incense_agarwood_gift: {
    id: 'incense_agarwood_001',
    name: '沉香线香礼盒装(越南进口)',
    category: 'incense',
    price_cny: 49,
    price_usd: 19.90,
    cost_cny: 8,
    image: 'https://cdn.shenyuan.app/products/agarwood-incense.jpg',
    description: '越南高级沉香，7小时长效香韵',
    supplier: 'dropship_taobao',
    supplier_link: 'https://item.taobao.com/item.htm?id=...',
    margin_pct: 95,
    keywords: ['incense', 'ritual', 'fire', 'high-end']
  },
  incense_sandalwood_combo: {
    id: 'incense_sandalwood_001',
    name: '檀香线香套装(3盒)',
    category: 'incense',
    price_cny: 39,
    price_usd: 12.90,
    cost_cny: 5,
    image: 'https://cdn.shenyuan.app/products/sandalwood-combo.jpg',
    description: '印度天然檀香，日常供奉必备',
    supplier: 'dropship_taobao',
    margin_pct: 97,
    keywords: ['incense', 'ritual', 'daily']
  },
  incense_tibetan_nag: {
    id: 'incense_tibetan_001',
    name: '藏香(纳格鼠尾草)',
    category: 'incense',
    price_cny: 59,
    price_usd: 24.90,
    cost_cny: 12,
    image: 'https://cdn.shenyuan.app/products/tibetan-nag.jpg',
    description: '西藏传统纳格香，净化空间',
    supplier: 'dropship_taobao',
    margin_pct: 92,
    keywords: ['incense', 'tibet', 'ritual', 'energy-clearing']
  },

  // ═══════════════════════════════════════════════════════════
  // TOP 2: 象神摆件（销量25万+，毛利92%）
  // ═══════════════════════════════════════════════════════════
  elephant_figurine_red: {
    id: 'elephant_red_001',
    name: '泰国象神摆件(赤陶红色)',
    category: 'elephant',
    price_cny: 59,
    price_usd: 29.90,
    cost_cny: 18,
    image: 'https://cdn.shenyuan.app/products/elephant-red.jpg',
    description: '泰国进口象神，手工赤陶，招财纳福',
    supplier: 'dropship_taobao',
    margin_pct: 92,
    keywords: ['fire', 'elephant', 'protection', 'thailand']
  },
  elephant_figurine_jade: {
    id: 'elephant_jade_001',
    name: '翡翠象神摆件(缅甸)',
    category: 'elephant',
    price_cny: 199,
    price_usd: 49.90,
    cost_cny: 45,
    image: 'https://cdn.shenyuan.app/products/elephant-jade.jpg',
    description: '缅甸翡翠雕刻象神，高端礼赠',
    supplier: 'dropship_amazon',
    margin_pct: 78,
    keywords: ['jade', 'elephant', 'wealth', 'premium']
  },
  elephant_figurine_gold: {
    id: 'elephant_gold_001',
    name: '黄铜象神摆件(12cm)',
    category: 'elephant',
    price_cny: 89,
    price_usd: 39.90,
    cost_cny: 22,
    image: 'https://cdn.shenyuan.app/products/elephant-brass.jpg',
    description: '印度黄铜工艺，手工打磨象神',
    supplier: 'dropship_taobao',
    margin_pct: 92,
    keywords: ['brass', 'elephant', 'india']
  },

  // ═══════════════════════════════════════════════════════════
  // TOP 3: LED供灯（销量22万+，毛利96%）
  // ═══════════════════════════════════════════════════════════
  lamp_led_lotus_red: {
    id: 'lamp_lotus_red_001',
    name: 'LED莲花供灯(红色,防风)',
    category: 'lamp',
    price_cny: 69,
    price_usd: 22.90,
    cost_cny: 5,
    image: 'https://cdn.shenyuan.app/products/led-lotus-red.jpg',
    description: '手工莲花灯，LED安全供奉，内置定时器',
    supplier: 'dropship_taobao',
    margin_pct: 96,
    keywords: ['lamp', 'offering', 'ritual', 'led']
  },
  lamp_led_lotus_gold: {
    id: 'lamp_lotus_gold_001',
    name: 'LED莲花供灯(金色,蜡烛风格)',
    category: 'lamp',
    price_cny: 79,
    price_usd: 26.90,
    cost_cny: 6,
    image: 'https://cdn.shenyuan.app/products/led-lotus-gold.jpg',
    description: '模拟蜡烛摇晃，供奉专用LED',
    supplier: 'dropship_taobao',
    margin_pct: 96,
    keywords: ['lamp', 'offering', 'gold', 'led']
  },
  lamp_butter_tea_light: {
    id: 'lamp_tea_light_001',
    name: '酥油灯(玻璃,供奉专用)',
    category: 'lamp',
    price_cny: 49,
    price_usd: 18.90,
    cost_cny: 8,
    image: 'https://cdn.shenyuan.app/products/butter-lamp.jpg',
    description: '藏传传统酥油灯，安全玻璃材质',
    supplier: 'dropship_taobao',
    margin_pct: 94,
    keywords: ['lamp', 'tibet', 'ritual']
  },

  // ═══════════════════════════════════════════════════════════
  // TOP 4: 水晶能量石（销量20万+，毛利90%）
  // ═══════════════════════════════════════════════════════════
  crystal_red_agate_bracelet: {
    id: 'crystal_red_agate_001',
    name: '红玛瑙手串(8mm,天然)',
    category: 'crystal',
    price_cny: 49,
    price_usd: 19.90,
    cost_cny: 12,
    image: 'https://cdn.shenyuan.app/products/red-agate.jpg',
    description: '天然红玛瑙手串，火能量激活',
    supplier: 'dropship_taobao',
    margin_pct: 90,
    keywords: ['fire', 'agate', 'energy', 'bracelet']
  },
  crystal_amethyst_cluster: {
    id: 'crystal_amethyst_001',
    name: '紫水晶簇(乌拉圭)',
    category: 'crystal',
    price_cny: 99,
    price_usd: 39.90,
    cost_cny: 25,
    image: 'https://cdn.shenyuan.app/products/amethyst-cluster.jpg',
    description: '乌拉圭紫水晶簇，冥想静修圣物',
    supplier: 'dropship_amazon',
    margin_pct: 85,
    keywords: ['wisdom', 'purple', 'meditation']
  },
  crystal_blue_aquamarine: {
    id: 'crystal_aquamarine_001',
    name: '海蓝宝手串(10mm)',
    category: 'crystal',
    price_cny: 79,
    price_usd: 24.90,
    cost_cny: 16,
    image: 'https://cdn.shenyuan.app/products/aquamarine.jpg',
    description: '海蓝宝水晶，情感平和+沟通开启',
    supplier: 'dropship_amazon',
    margin_pct: 88,
    keywords: ['water', 'emotion', 'calm']
  },

  // ═══════════════════════════════════════════════════════════
  // 护符/吉祥品
  // ═══════════════════════════════════════════════════════════
  amulet_dragon_necklace: {
    id: 'amulet_dragon_001',
    name: '龙纹护符(红绳颈链)',
    category: 'amulet',
    price_cny: 59,
    price_usd: 18.90,
    cost_cny: 12,
    image: 'https://cdn.shenyuan.app/products/dragon-amulet.jpg',
    description: '藏传龙纹护符，护佑平安',
    supplier: 'dropship_taobao',
    margin_pct: 90,
    keywords: ['dragon', 'protection', 'amulet']
  },
  amulet_eyes_tibetan: {
    id: 'amulet_eyes_001',
    name: '藏传眼睛护符(绿松石)',
    category: 'amulet',
    price_cny: 79,
    price_usd: 28.90,
    cost_cny: 18,
    image: 'https://cdn.shenyuan.app/products/tibetan-eyes.jpg',
    description: '藏传眼睛护符，辟邪挡煞',
    supplier: 'dropship_taobao',
    margin_pct: 91,
    keywords: ['eyes', 'protection', 'tibetan']
  },

  // ═══════════════════════════════════════════════════════════
  // 高端礼赠系列
  // ═══════════════════════════════════════════════════════════
  premium_incense_set: {
    id: 'incense_premium_001',
    name: '沉香/檀香豪华礼盒(3种)',
    category: 'incense_premium',
    price_cny: 189,
    price_usd: 49.90,
    cost_cny: 38,
    image: 'https://cdn.shenyuan.app/products/incense-premium-set.jpg',
    description: '沉香+檀香+藏香三种高级香韵礼盒',
    supplier: 'dropship_taobao',
    margin_pct: 90,
    keywords: ['incense', 'premium', 'gift-set']
  },
  bundle_spiritual_ritual: {
    id: 'bundle_ritual_001',
    name: '灵性修行套装(香+灯+护符)',
    category: 'bundle',
    price_cny: 299,
    price_usd: 79.90,
    cost_cny: 68,
    image: 'https://cdn.shenyuan.app/products/ritual-bundle.jpg',
    description: '完整供奉套装：高级香+LED灯+护符',
    supplier: 'dropship_taobao',
    margin_pct: 88,
    keywords: ['bundle', 'ritual', 'high-value']
  },
};

/**
 * 推荐规则引擎
 */
const RECOMMENDATION_RULES = {
  // 八字五行推荐
  bazi: {
    fire: {
      elements: ['red', 'agate', 'lamp'],
      products: ['crystal_red_agate', 'offering_lamp_red', 'incense_sandalwood'],
      reason: '火命需要稳定能量，红色能量强化自信'
    },
    water: {
      elements: ['blue', 'crystal', 'calm'],
      products: ['crystal_blue_aquamarine', 'crystal_amethyst_cluster'],
      reason: '水命需要平和能量，蓝色宝石增进情感平衡'
    },
    wood: {
      elements: ['green', 'growth'],
      products: ['elephant_figurine_jade'],
      reason: '木命需要生长能量，翡翠象征和谐'
    },
    metal: {
      elements: ['white', 'gold'],
      products: ['offering_lamp_red'],
      reason: '金命需要流动能量'
    },
    earth: {
      elements: ['yellow', 'stability'],
      products: ['amulet_dragon'],
      reason: '土命需要稳定能量'
    }
  },

  // Jyotish月宫推荐
  jyotish: {
    water_signs: { // 巨蟹、天蝎、双鱼
      products: ['crystal_blue_aquamarine', 'crystal_amethyst_cluster'],
      reason: '水象月宫需要情感平和能量'
    },
    fire_signs: { // 白羊、狮子、射手
      products: ['crystal_red_agate', 'elephant_figurine_red'],
      reason: '火象月宫需要稳定锚点'
    },
    earth_signs: { // 金牛、处女、摩羯
      products: ['amulet_dragon', 'offering_lamp_red'],
      reason: '土象月宫需要护持能量'
    },
    air_signs: { // 双子、天秤、水瓶
      products: ['incense_sandalwood', 'crystal_amethyst_cluster'],
      reason: '风象月宫需要灵感激活'
    }
  },

  // Maya Kin推荐
  maya: {
    red_kin: {
      products: ['elephant_figurine_red', 'offering_lamp_red'],
      reason: '红色Kin需要创造能量聚焦'
    },
    white_kin: {
      products: ['crystal_amethyst_cluster', 'incense_sandalwood'],
      reason: '白色Kin需要灵感与清晰'
    },
    blue_kin: {
      products: ['crystal_blue_aquamarine', 'amulet_dragon'],
      reason: '蓝色Kin需要保护与流动'
    },
    yellow_kin: {
      products: ['elephant_figurine_jade', 'offering_lamp_red'],
      reason: '黄色Kin需要稳定与成熟'
    }
  },

  // Tibet推荐
  tibet: {
    dragon: {
      products: ['elephant_figurine_jade', 'amulet_dragon'],
      reason: '龙年生人需要龙纹护符保护'
    },
    fire_element: {
      products: ['crystal_red_agate', 'offering_lamp_red'],
      reason: '火元素需要稳定能量'
    },
    high_lungta: {
      products: ['elephant_figurine_red', 'incense_sandalwood'],
      reason: '风马强的年份加持更强能量'
    }
  }
};

/**
 * 主推荐函数
 * @param {Object} userProfile - 用户命理诊断结果
 *   {
 *     bazi_element: 'fire|water|wood|metal|earth',
 *     jyotish_rashi: 'cancer|leo|...',
 *     maya_kin_color: 'red|white|blue|yellow',
 *     tibet_zodiac: 'dragon|...',
 *     tibet_element: 'fire|water|...'
 *   }
 * @returns {Array} 推荐产品列表
 */
function recommendProducts(userProfile) {
  const recommended = new Set();
  const reasons = [];

  // 八字推荐
  if (userProfile.bazi_element && RECOMMENDATION_RULES.bazi[userProfile.bazi_element]) {
    const baziRule = RECOMMENDATION_RULES.bazi[userProfile.bazi_element];
    baziRule.products.forEach(p => recommended.add(p));
    reasons.push(baziRule.reason);
  }

  // Jyotish推荐
  if (userProfile.jyotish_category) {
    const jyotishRule = RECOMMENDATION_RULES.jyotish[userProfile.jyotish_category];
    if (jyotishRule) {
      jyotishRule.products.forEach(p => recommended.add(p));
      reasons.push(jyotishRule.reason);
    }
  }

  // Maya推荐
  if (userProfile.maya_kin_color && RECOMMENDATION_RULES.maya[userProfile.maya_kin_color]) {
    const mayaRule = RECOMMENDATION_RULES.maya[userProfile.maya_kin_color];
    mayaRule.products.forEach(p => recommended.add(p));
    reasons.push(mayaRule.reason);
  }

  // Tibet推荐
  if (userProfile.tibet_zodiac && RECOMMENDATION_RULES.tibet[userProfile.tibet_zodiac]) {
    const tibetRule = RECOMMENDATION_RULES.tibet[userProfile.tibet_zodiac];
    tibetRule.products.forEach(p => recommended.add(p));
    reasons.push(tibetRule.reason);
  }

  // 构建返回对象
  const products = Array.from(recommended)
    .slice(0, 5) // 最多推荐5个
    .map(productId => ({
      ...PRODUCT_CATALOG[productId],
      recommended_reason: reasons[0] // 用第一个推荐理由
    }));

  return {
    products,
    total: products.length,
    all_reasons: reasons
  };
}

module.exports = {
  PRODUCT_CATALOG,
  RECOMMENDATION_RULES,
  recommendProducts
};
