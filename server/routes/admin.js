'use strict';
/**
 * routes/admin.js — 管理/公共接口
 * GET /api/health
 * GET /api/masters
 * GET /api/inspiration
 */

const router = require('express').Router();

const DEEPSEEK_API_KEY = process.env.DS_KEY || process.env.DEEPSEEK_API_KEY;
const PORT = process.env.PORT || 3021;

// ── Masters data（真人大师入驻）──
const MASTERS = [
  { id: 1, name: '张明远', title: '八字命理师', exp: '30年', specialty: '八字/风水', rating: 4.9, price: '$19.9/次', desc: '师承正统子平命理，擅长八字批命和家居风水。为数百位企业家指点过运势，客户遍及海内外。', avatarInitial: '张', tags: ['命理泰斗', '风水'] },
  { id: 2, name: '李灵素', title: '塔罗占卜师', exp: '15年', specialty: '塔罗/感情', rating: 4.8, price: '$9.9/次', desc: '精通韦特塔罗和雷诺曼，擅长感情和事业占卜。以温暖细腻的解牌风格深受用户喜爱。', avatarInitial: '李', tags: ['情感专家', '塔罗'] },
  { id: 3, name: 'Sarah Moon', title: 'Astrologer', exp: '20年', specialty: '西方占星/合盘', rating: 4.7, price: '$14.9/次', desc: 'Western astrology specialist. Natal charts, synastry, and transit analysis in English & Chinese.', avatarInitial: 'S', tags: ['Western', 'Astrology'] },
  { id: 4, name: '王道正', title: '奇门遁甲师', exp: '25年', specialty: '奇门遁甲/六壬', rating: 4.6, price: '$24.9/次', desc: '道家正一派传人，深研奇门遁甲与大六壬。擅长择吉、趋吉避凶、商业决策咨询。', avatarInitial: '王', tags: ['奇门', '道家'] },
  { id: 5, name: '陈慧心', title: '心理咨询师', exp: '12年', specialty: '心理占星/性格分析', rating: 4.9, price: '$12.9/次', desc: '心理学硕士，融合西方心理学与东方命理。擅长用MBTI+星盘帮你认识真正的自己。', avatarInitial: '陈', tags: ['心理学', '星盘'] },
  { id: 6, name: '玄机子', title: '紫微斗数命理师', exp: '40年', specialty: '紫微斗数/风水', rating: 4.8, price: '$29.9/次', desc: '台湾紫微斗数名家，著作等身。精通紫微斗数排盘与阳宅风水，桃李遍天下。', avatarInitial: '玄', tags: ['紫微泰斗', '风水'] }
];

// ── Inspiration quotes library ──
const INSPIRATION_QUOTES = [
  {cn:'万物皆有裂痕，那是光照进来的地方', en:'There is a crack in everything, that is how the light gets in', src:'Leonard Cohen'},
  {cn:'当你真心渴望某件事，整个宇宙都会来帮忙', en:'When you truly want something, the universe conspires to help you', src:'Paulo Coelho'},
  {cn:'顺其自然，不是放弃而是让一切发生', en:'Go with the flow, not giving up but letting things happen', src:'Tao Te Ching'},
  {cn:'此心安处是吾乡', en:'Where the heart finds peace, there is home', src:'Su Shi'},
  {cn:'行到水穷处，坐看云起时', en:'Walk to the edge of water, sit and watch clouds rise', src:'Wang Wei'},
  {cn:'心若向阳，无畏悲伤', en:'Face the sun and the shadows fall behind you', src:'Chinese Proverb'},
  {cn:'一念放下，万般自在', en:'Let go of one thought and find ten thousand freedoms', src:'Zen Wisdom'},
  {cn:'天行健，君子以自强不息', en:'As heaven moves with strength, the noble strives unceasingly', src:'I Ching'},
  {cn:'知足者常乐，能忍者自安', en:'Contentment brings lasting joy, patience brings inner peace', src:'Ancient Wisdom'},
  {cn:'塞翁失马，焉知非福', en:'A blessing in disguise — who knows what fortune misfortune brings', src:'Huainanzi'},
  {cn:'红尘万丈，只为渡你一人', en:'Through ten thousand worlds, I cross only for you', src:'Buddhist Proverb'},
  {cn:'本来无一物，何处惹尘埃', en:'From nothing comes nothing — where can dust gather', src:'Huineng'},
  {cn:'不忘初心，方得始终', en:'Stay true to your heart and you will find your way', src:'Buddhist Scripture'},
  {cn:'上善若水，水善利万物而不争', en:'The highest good is like water, benefiting all without striving', src:'Lao Tzu'},
  {cn:'山不向我走来，我便向山走去', en:'If the mountain won\'t come to me, I will go to the mountain', src:'Chinese Idiom'},
  {cn:'命里有时终须有，命里无时莫强求', en:'What is meant for you will come; what is not, let it go', src:'Ancient Proverb'},
  {cn:'大音希声，大象无形', en:'Great sound is silent, great form is formless', src:'Lao Tzu'},
  {cn:'人生如逆旅，我亦是行人', en:'Life is a journey, and I too am a traveler', src:'Su Shi'},
  {cn:'长风破浪会有时，直挂云帆济沧海', en:'The wind will rise and break the waves, set sail across the vast sea', src:'Li Bai'},
  {cn:'不以物喜，不以己悲', en:'Let not joy from possessions nor sorrow from self prevail', src:'Fan Zhongyan'},
  {cn:'The only way out is through', en:'The only way out is through', src:'Robert Frost'},
  {cn:'This too shall pass', en:'This too shall pass', src:'Sufi Wisdom'},
  {cn:'Be the change you wish to see in the world', en:'Be the change you wish to see in the world', src:'Mahatma Gandhi'},
  {cn:'In the middle of difficulty lies opportunity', en:'In the middle of difficulty lies opportunity', src:'Albert Einstein'},
  {cn:'The soul becomes dyed with the color of its thoughts', en:'The soul becomes dyed with the color of its thoughts', src:'Marcus Aurelius'},
  {cn:'To love oneself is the beginning of a lifelong romance', en:'To love oneself is the beginning of a lifelong romance', src:'Oscar Wilde'},
  {cn:'What you seek is seeking you', en:'What you seek is seeking you', src:'Rumi'},
  {cn:'Let the beauty of what you love be what you do', en:'Let the beauty of what you love be what you do', src:'Rumi'},
  {cn:'The wound is the place where the light enters you', en:'The wound is the place where the light enters you', src:'Rumi'},
  {cn:'You are the universe experiencing itself', en:'You are the universe experiencing itself', src:'Alan Watts'},
  {cn:'The quieter you become, the more you can hear', en:'The quieter you become, the more you can hear', src:'Rumi'},
  {cn:'知之者不如好之者，好之者不如乐之者', en:'To know is good, to love is better, to delight is best', src:'Confucius'},
  {cn:'己所不欲，勿施于人', en:'Do not do to others what you do not want done to yourself', src:'Confucius'},
  {cn:'学而不思则罔，思而不学则殆', en:'Learning without thought is lost; thought without learning is perilous', src:'Confucius'},
  {cn:'道生一，一生二，二生三，三生万物', en:'The Tao gives birth to one, one to two, two to three, three to all things', src:'Lao Tzu'},
  {cn:'天地与我并生，万物与我为一', en:'Heaven and earth exist with me; all things and I are one', src:'Zhuangzi'},
  {cn:'至人无己，神人无功，圣人无名', en:'The perfect man has no self; the spiritual man has no achievement; the sage has no name', src:'Zhuangzi'},
  {cn:'祸兮福之所倚，福兮祸之所伏', en:'Misfortune rests upon fortune; fortune conceals misfortune', src:'Lao Tzu'},
  {cn:'柔弱胜刚强', en:'Gentleness overcomes strength', src:'Lao Tzu'},
  {cn:'千里之行，始于足下', en:'A journey of a thousand miles begins with a single step', src:'Lao Tzu'}
];

// GET /api/health
router.get('/health', (req, res) => {
  // 动态获取 stripe 状态（避免循环依赖，直接检测 env）
  const stripeReady = !!(process.env.STRIPE_PAY_SECRET_KEY);
  res.json({
    status: 'ok',
    service: '善缘 ShenYuan',
    version: 'v2.0',
    port: PORT,
    stripe: stripeReady ? 'connected' : 'not_configured',
    llm: DEEPSEEK_API_KEY ? 'deepseek' : 'unavailable'
  });
});

// GET /api/masters
router.get('/masters', (req, res) => {
  res.json({ masters: MASTERS });
});

// GET /api/inspiration
router.get('/inspiration', (req, res) => {
  var now = new Date();
  var idx = (now.getFullYear() * 365 + (now.getMonth() + 1) * 31 + now.getDate()) % INSPIRATION_QUOTES.length;
  res.json({ date: now.toISOString().split('T')[0], quote: INSPIRATION_QUOTES[idx], total: INSPIRATION_QUOTES.length });
});

module.exports = router;
