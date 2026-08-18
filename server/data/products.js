// 善缘开光手串产品目录
// 每位用户只推一件，根据命格最弱项匹配

const PRODUCTS = {
  red_agate: {
    id: 'red_agate',
    name: '开光红玛瑙手串',
    name_en: 'Consecrated Red Agate Bracelet',
    emoji: '🔴',
    price: 68,
    price_usd: 9.90,
    tagline: '红玛瑙·属火·传统习俗心意',
    description: '经寺院诵经开光，红玛瑙在传统五行中属火，常寓意热情与活力。传统文化寓意，不作效果承诺。',
    match: ['缺火', '火弱', '财运弱', '流年破财', '玛雅火图腾'],
    element: 'fire',
    // image_url: '/assets/products/red-agate.jpg'  // TODO: add product photos
  },
  black_obsidian: {
    id: 'black_obsidian',
    name: '开光黑曜石貔貅手串',
    name_en: 'Consecrated Black Obsidian Pi Xiu Bracelet',
    emoji: '⚫',
    price: 88,
    price_usd: 12.90,
    tagline: '黑曜石貔貅·传统习俗心意',
    description: '貔貅为传统招财神兽题材，黑曜石为常见文玩材质，经寺院开光加持。传统文化寓意，不作效果承诺。',
    match: ['风马低', '煞星', '多病', '小人多', '辟邪', '西藏护身'],
    element: 'protection',
  },
  yellow_crystal: {
    id: 'yellow_crystal',
    name: '开光黄水晶手串',
    name_en: 'Consecrated Yellow Citrine Bracelet',
    emoji: '🟡',
    price: 78,
    price_usd: 11.90,
    tagline: '黄水晶·属土·传统习俗心意',
    description: '黄水晶在传统五行中属土，常与财帛宫相对应，经寺院开光。传统文化寓意，不作效果承诺。',
    match: ['缺土', '土弱', '财库薄', '木星弱', '吠陀财运'],
    element: 'earth',
  },
  green_phantom: {
    id: 'green_phantom',
    name: '开光绿幽灵手串',
    name_en: 'Consecrated Green Phantom Bracelet',
    emoji: '🟢',
    price: 128,
    price_usd: 18.90,
    tagline: '绿幽灵·属木·传统习俗心意',
    description: '绿幽灵在传统五行中属木，常寓意生长与进取，内含天然矿物层叠如山峦。传统文化寓意，不作效果承诺。',
    match: ['缺木', '木弱', '事业弱', '升职难', '事业瓶颈'],
    element: 'wood',
  },
  white_crystal: {
    id: 'white_crystal',
    name: '开光白水晶手串',
    name_en: 'Consecrated Clear Quartz Bracelet',
    emoji: '⚪',
    price: 58,
    price_usd: 8.90,
    tagline: '白水晶·属金·传统习俗心意',
    description: '白水晶通透纯净，在传统五行中属金，常寓意清明与专注。传统文化寓意，不作效果承诺。',
    match: ['缺金', '金弱', '思维乱', '决策难', '净化'],
    element: 'metal',
  },
  tibetan_bracelet: {
    id: 'tibetan_bracelet',
    name: '五色藏式开光手串',
    name_en: 'Consecrated Tibetan Five-Color Prayer Bracelet',
    emoji: '🔵',
    price: 98,
    price_usd: 14.90,
    tagline: '藏式五色·传统习俗心意',
    description: '五色对应藏传文化中的五大元素（白/蓝/黄/红/绿），由藏族喇嘛诵经加持，为藏式传统题材手串。传统文化寓意，不作效果承诺。',
    match: ['风马低', '风马中', '藏传命理', '元素失衡', '全面守护'],
    element: 'tibetan',
  },
};

// 根据报告关键词自动匹配产品
function matchProduct(reportText, tradition) {
  if (tradition === 'tibet') {
    // 风马低优先推藏式手串
    if (/风马.*低|低.*风马|Lungta.*Low|Low.*Lungta/i.test(reportText)) {
      return PRODUCTS.tibetan_bracelet;
    }
  }

  // 五行缺失匹配
  if (/缺火|火.*弱|火气不足/.test(reportText)) return PRODUCTS.red_agate;
  if (/缺木|木.*弱|木气不足/.test(reportText)) return PRODUCTS.green_phantom;
  if (/缺水|水.*弱/.test(reportText)) return PRODUCTS.black_obsidian;
  if (/缺土|土.*弱|土气不足/.test(reportText)) return PRODUCTS.yellow_crystal;
  if (/缺金|金.*弱|金气不足/.test(reportText)) return PRODUCTS.white_crystal;

  // 吠陀木星弱
  if (/木星.*弱|Jupiter.*weak|Guru.*weak/i.test(reportText)) return PRODUCTS.yellow_crystal;

  // 默认：黑曜石护身（适合几乎所有人）
  return PRODUCTS.black_obsidian;
}

module.exports = { PRODUCTS, matchProduct };
