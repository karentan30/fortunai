'use strict';
/**
 * lib/daily-personal.js — 按个人命盘算的「今日运势」（确定性·零 LLM 成本）
 *
 * 口径：用户日干（日主）× 今日日干 → 十神；再看今日日支与用户日支是否六冲/六合。
 * 同一个人同一天结果固定，可复算、可辩护——这是真排盘，不是按生肖/星座发的通稿。
 * 日柱与主报告共用 bazi-engine，避免「报告里是辛金、每日邮件里算成别的」。
 *
 * 用法：dailyReading({ year, month, day, hour, gender }, { date: 'YYYY-MM-DD', lang: 'en'|'zh' })
 */

const { computeBaziChart } = require('./bazi-engine');

const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const GAN_EL = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const GAN_PINYIN = { 甲: 'Jia', 乙: 'Yi', 丙: 'Bing', 丁: 'Ding', 戊: 'Wu', 己: 'Ji', 庚: 'Geng', 辛: 'Xin', 壬: 'Ren', 癸: 'Gui' };
const EL_EN = { 木: 'Wood', 火: 'Fire', 土: 'Earth', 金: 'Metal', 水: 'Water' };
const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };   // A 生 B
const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };      // A 克 B
const CHONG = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
const HE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };

// 生我者之色＝「补给色」：给日主加能量的五行对应的颜色
const EL_COLOR = {
  木: { zh: '青绿', en: 'green' }, 火: { zh: '红', en: 'red' }, 土: { zh: '米黄', en: 'warm beige' },
  金: { zh: '白', en: 'white' }, 水: { zh: '深蓝', en: 'navy' },
};

function yang(g) { return GAN.indexOf(g) % 2 === 0; }

function tenGod(dm, other) {
  const a = GAN_EL[dm], b = GAN_EL[other], same = yang(dm) === yang(other);
  if (a === b) return same ? '比肩' : '劫财';
  if (SHENG[a] === b) return same ? '食神' : '伤官';
  if (SHENG[b] === a) return same ? '偏印' : '正印';
  if (KE[a] === b) return same ? '偏财' : '正财';
  return same ? '七杀' : '正官';
}

// 十神 → 今日主题。分数 1-5：energy/love/work/money。每条两种措辞，按日序轮换，免得十天一轮一字不差。
const GODS = {
  比肩: {
    en: { name: 'Peer', title: 'Stand on your own feet', body: ['Today mirrors your own element back at you. Confidence is high and you would rather do things your way.', 'A self-reliant day: your own element shows up in the sky, so you feel steady and hard to push around.'],
      love: 'Say what you want plainly; hinting will not land today.', work: 'Good for solo work you can finish end to end.', money: 'Split costs evenly and keep your own accounts clear.', do: 'Start the thing you keep postponing', avoid: 'Arguing to prove a point' },
    zh: { name: '比肩', title: '靠自己站稳', body: ['今天天上的气和你的日主同类，底气足，事情更想按自己的方式来。', '自立的一天：同类之气来助，你心里稳，不容易被人左右。'],
      love: '想要什么就直说，今天暗示对方接不住。', work: '适合一个人从头做到尾的事。', money: '账目分清，AA 最省心。', do: '把拖了很久的事开个头', avoid: '为争一口气去辩输赢' },
    s: [4, 3, 4, 3],
  },
  劫财: {
    en: { name: 'Rival', title: 'Guard your time and wallet', body: ['A day of friendly competition. People around you want a share of your attention, and sometimes your money.', 'Energy runs high but it pulls outward: friends, rivals and group plans compete for you.'],
      love: 'Watch for jealousy, yours or theirs; reassure early.', work: 'Team up, but get the credit and roles in writing.', money: 'Skip impulse buys and do not lend today.', do: 'Work out or burn energy physically', avoid: 'Lending money or co-signing' },
    zh: { name: '劫财', title: '守好时间和钱包', body: ['同类相争的一天，身边的人都想分走你的注意力，有时还有你的钱。', '劲头很足但往外散：朋友、对手、饭局都在抢你。'],
      love: '留意醋意，不管是你的还是对方的，早点安抚。', work: '可以合作，但分工和功劳先说清楚。', money: '别冲动消费，今天不宜借钱给人。', do: '运动出汗，把劲用在身体上', avoid: '借钱、担保' },
    s: [4, 2, 3, 2],
  },
  食神: {
    en: { name: 'Artist', title: 'Enjoy and create', body: ['Your element feeds today’s energy, which makes this an easy, generous day. Pleasure and creativity come naturally.', 'A soft, expressive day. What you make or share today tends to be received warmly.'],
      love: 'Plan something small and delicious together.', work: 'Great for writing, design and pitching ideas.', money: 'Spend on experiences, not things.', do: 'Cook, make or share something', avoid: 'Overcommitting out of good mood' },
    zh: { name: '食神', title: '享受，也适合创作', body: ['你的日主去生今天的气，这是松弛、大方的一天，享受和灵感都来得自然。', '柔和、好表达的一天，你今天做出来或说出来的东西，容易被好好接住。'],
      love: '安排一顿好吃的，两个人小小地开心一下。', work: '适合写东西、做设计、讲想法。', money: '钱花在体验上，比买东西值。', do: '下厨、动手做点什么或分享出去', avoid: '心情好就一口答应太多事' },
    s: [4, 4, 4, 3],
  },
  伤官: {
    en: { name: 'Rebel', title: 'Sharp mind, careful tongue', body: ['Your ideas are unusually sharp today, and so are your words. Brilliant for breakthroughs, risky for diplomacy.', 'A clever, restless day. You will see what is wrong with everything, which is useful if you say it kindly.'],
      love: 'Criticism will sting more than you mean it to.', work: 'Solve the hard problem; skip the politics.', money: 'Good day to renegotiate, calmly.', do: 'Brainstorm and fix what is broken', avoid: 'Replying to authority while annoyed' },
    zh: { name: '伤官', title: '脑子快，嘴上留情', body: ['今天点子特别锋利，话也锋利。适合突破，不适合打圆场。', '聪明又坐不住的一天，你一眼看出哪里不对，好好说出来就是本事。'],
      love: '一句挑剔，对方会比你以为的更疼。', work: '去解决难题，别掺和人事。', money: '适合心平气和地谈价。', do: '头脑风暴，把坏掉的东西修好', avoid: '带着火气回复领导或长辈' },
    s: [4, 2, 4, 3],
  },
  偏财: {
    en: { name: 'Windfall', title: 'Opportunity is loose today', body: ['You control today’s element, which shows up as money and chances that move fast. Say yes to the unexpected, with a limit.', 'A lucky-feeling, social day. Deals, invitations and side income are in the air.'],
      love: 'Charm is easy; be sure you mean it.', work: 'Network, follow up, send the proposal.', money: 'Small bets fine, big bets not. Set a cap.', do: 'Reach out to someone who can open a door', avoid: 'Gambling past your set limit' },
    zh: { name: '偏财', title: '机会松动的一天', body: ['你克今天的气，化成来得快的钱和机会。可以对意外说好，但给自己设个上限。', '手气不错、适合社交的一天，合作、邀约、副业收入都在空气里。'],
      love: '魅力在线，但要确定自己是认真的。', work: '适合跑关系、跟进、把方案发出去。', money: '小试可以，重注不行，先定上限。', do: '联系一个能帮你开门的人', avoid: '超过预设额度的冒险' },
    s: [4, 4, 4, 5],
  },
  正财: {
    en: { name: 'Steady Wealth', title: 'Build, do not gamble', body: ['A practical, grounded day. Effort turns into results in a straight line, so finish things properly.', 'Money and duty line up today. Not flashy, but what you build now holds.'],
      love: 'Show care with actions: plan, fix, show up.', work: 'Close tasks, send invoices, tidy the details.', money: 'Review budgets and pay what you owe.', do: 'Finish one task completely', avoid: 'Get-rich-quick offers' },
    zh: { name: '正财', title: '一砖一瓦，不赌', body: ['务实踏地的一天，付出和回报是直线，把事情收尾收干净。', '钱和责任今天对得上，不花哨，但今天搭起来的东西很稳。'],
      love: '用行动表达在乎：安排好、修好、到场。', work: '适合收尾、开票、抠细节。', money: '看看预算，该还的还上。', do: '把一件事彻底做完', avoid: '一夜暴富的机会' },
    s: [3, 4, 4, 4],
  },
  七杀: {
    en: { name: 'Pressure', title: 'Pressure that makes you stronger', body: ['Today’s element pushes against yours. Expect pressure or a deadline, and meet it head on rather than dodge it.', 'A tough, high-stakes day. Discipline wins; drama loses.'],
      love: 'Do not make it a power struggle; ask for help instead.', work: 'Face the difficult conversation or the hard deadline.', money: 'Protect what you have; no risky moves.', do: 'Exercise, or tackle the scariest task first', avoid: 'Confrontation while tired' },
    zh: { name: '七杀', title: '压力会让你更强', body: ['今天的气直冲你的日主，会有压力或截止日，正面迎上比躲更好。', '硬仗日，靠纪律赢，靠情绪输。'],
      love: '别较劲比强弱，开口求助反而更近。', work: '去面对那场难谈的对话或那条硬截止。', money: '守住现有的，不做冒险动作。', do: '运动，或者先啃最怕的那件事', avoid: '累的时候和人正面冲突' },
    s: [3, 2, 3, 2],
  },
  正官: {
    en: { name: 'Authority', title: 'Be seen doing it right', body: ['Structure is on your side today. Rules, reputation and recognition all favour doing things properly.', 'A day for responsibility. People who matter are watching, in a good way.'],
      love: 'Commitment talk goes well; be reliable.', work: 'Good for reviews, interviews and formal requests.', money: 'Sort paperwork, taxes and contracts.', do: 'Ask for the promotion, sign the form', avoid: 'Cutting corners' },
    zh: { name: '正官', title: '把事做对，被看见', body: ['今天规矩站在你这边，名声、认可都偏向按规矩办事的人。', '担责任的一天，重要的人在看你，是好的那种看。'],
      love: '适合谈承诺，靠谱就是加分。', work: '适合述职、面试、正式申请。', money: '整理票据、税务和合同。', do: '提出升职，把表签了', avoid: '走捷径' },
    s: [3, 4, 5, 3],
  },
  偏印: {
    en: { name: 'Intuition', title: 'Trust the quiet signal', body: ['Today’s element feeds yours from an unusual angle. Intuition is strong and solitude helps.', 'An inward, perceptive day. You notice what others miss; you may also want to be left alone.'],
      love: 'Tell them you need space, kindly, before you take it.', work: 'Research, study, strategy. Skip crowded meetings.', money: 'Hold. Not a day to commit funds.', do: 'Read, journal or walk alone', avoid: 'Overthinking a single message' },
    zh: { name: '偏印', title: '相信那个安静的直觉', body: ['今天的气从偏的角度来生你，直觉强，独处有帮助。', '向内、敏锐的一天，你会注意到别人漏掉的，也可能只想一个人待着。'],
      love: '需要空间就先温柔说一声，别直接消失。', work: '适合研究、学习、想策略，少开大会。', money: '按兵不动，今天不宜投钱。', do: '看书、写日记或一个人走走', avoid: '反复琢磨一条消息' },
    s: [3, 3, 3, 2],
  },
  正印: {
    en: { name: 'Support', title: 'Let yourself be helped', body: ['Today’s element nourishes yours directly. Help, advice and comfort come easily if you accept them.', 'A supported, restoring day. Good for learning, rest and people who care about you.'],
      love: 'Receive care without deflecting it.', work: 'Ask a mentor; learn something new.', money: 'Steady; good day to plan, not to spend.', do: 'Call family or someone older and wiser', avoid: 'Refusing help out of pride' },
    zh: { name: '正印', title: '允许自己被照顾', body: ['今天的气直接生你的日主，帮助、建议、安慰都来得容易，接住就好。', '有人撑腰、可以回血的一天，适合学习、休息，和在乎你的人待在一起。'],
      love: '对方的好，别推开，收下。', work: '请教前辈，学点新东西。', money: '平稳，适合做计划，不适合花钱。', do: '给家人或长辈打个电话', avoid: '因为面子拒绝帮助' },
    s: [5, 4, 3, 3],
  },
};

function _chart(y, m, d, h, g) {
  return computeBaziChart({ year: y, month: m, day: d, hour: h, gender: g || 'female' }).bazi;
}

function _parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  return { y: +m[1], m: +m[2], d: +m[3] };
}

/**
 * @returns {object|null} null = 生日不完整/非法（调用方别兜底编内容）
 */
function dailyReading(birth, opts) {
  opts = opts || {};
  const lang = opts.lang === 'zh' ? 'zh' : 'en';
  const by = +birth.year, bm = +birth.month, bd = +birth.day;
  if (!by || !bm || !bd || by < 1900 || by > 2100 || bm < 1 || bm > 12 || bd < 1 || bd > 31) return null;
  // 时辰未知 → 取正午，日柱不受影响（只有 23 点后的子时换日才有差别，未知时辰按正午是保守口径）
  const bh = (birth.hour === undefined || birth.hour === null || birth.hour === '' || isNaN(+birth.hour)) ? 12 : +birth.hour;
  const today = _parseDate(opts.date) || (function () {
    const n = new Date(); return { y: n.getUTCFullYear(), m: n.getUTCMonth() + 1, d: n.getUTCDate() };
  })();

  let natal, sky;
  try {
    natal = _chart(by, bm, bd, bh, birth.gender).siZhu.day;
    sky = _chart(today.y, today.m, today.d, 12, 'male').siZhu.day;
  } catch (e) { return null; }

  const dm = natal.gan, god = tenGod(dm, sky.gan), G = GODS[god], T = G[lang];
  const variant = (GAN.indexOf(sky.gan) + today.d) % 2;
  const clash = CHONG[natal.zhi] === sky.zhi, harmony = HE[natal.zhi] === sky.zhi;
  const supportEl = Object.keys(SHENG).find(k => SHENG[k] === GAN_EL[dm]);
  const scores = { energy: G.s[0], love: G.s[1], work: G.s[2], money: G.s[3] };
  if (clash) { scores.energy = Math.max(1, scores.energy - 1); scores.love = Math.max(1, scores.love - 1); }
  if (harmony) { scores.love = Math.min(5, scores.love + 1); }

  const note = clash
    ? (lang === 'zh' ? `今日${sky.zhi}冲你日支${natal.zhi}：节奏容易被打乱，出门留余量，重要的话隔天再说。`
                     : `Today’s branch clashes with your day branch: expect a change of plans. Leave buffer time and sleep on big decisions.`)
    : harmony
      ? (lang === 'zh' ? `今日${sky.zhi}与你日支${natal.zhi}相合：人和顺，适合约见、和好、谈合作。`
                       : `Today’s branch pairs with your day branch: people feel easy to be with. Good for meeting up, making up or teaming up.`)
      : '';

  return {
    date: `${today.y}-${String(today.m).padStart(2, '0')}-${String(today.d).padStart(2, '0')}`,
    lang,
    dayMaster: { gan: dm, element: GAN_EL[dm], label: lang === 'zh' ? `${dm}${GAN_EL[dm]}` : `${GAN_PINYIN[dm]} ${EL_EN[GAN_EL[dm]]}` },
    todayPillar: sky.gan + sky.zhi,
    tenGod: { key: god, name: T.name },
    title: T.title,
    body: T.body[variant],
    love: T.love, work: T.work, money: T.money,
    do: T.do, avoid: T.avoid,
    note,
    scores,
    color: EL_COLOR[supportEl][lang],
  };
}

module.exports = { dailyReading, tenGod };
