'use strict';
/**
 * routes/divination.js — AI 占算引擎
 * POST /api/bazi
 * POST /api/tarot
 * POST /api/ziwei
 * POST /api/mianxiang
 * POST /api/hehun
 * POST /api/fengshui
 * POST /api/geo-fortune
 * POST /api/xingming
 * POST /api/astrology
 * POST /api/liuyao
 * POST /api/lingqian
 * POST /api/daliuren
 * POST /api/qimen
 * POST /api/pastlife
 * POST /api/deity-guide
 * POST /api/offering-plan
 * POST /api/zhiyuan
 * POST /api/bazi/recent-input
 * GET  /api/context/:id
 * POST /api/ask-followup
 * GET  /api/daily-teaser
 */

const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const { deepseekChat, deepseekStream, buildReadingPrompt } = require('../lib/llm');
const { calcBazi } = require('../bazi');
const astrology = require('../astrology.js');
const { insertReading, hasFullAccess, gateMessages, saveQaContext, qaContext } = require('../lib/store');
const { getToken } = require('../lib/store');
const { rateLimitMiddleware } = require('../middleware');
const { PRODUCTS, matchProduct } = require('../data/products');

// ── 免费报告内存缓存（24h TTL）──
const reportCache = new Map();
function cacheKey(params) {
  return [params.name, params.dob, params.gender, params.lang, 'free'].join('|');
}

// 从 store 取 mon（Sentry 监控）—— 在入口传入
let mon = null;
try { mon = require(process.env.MONITORING_PATH || require('path').join(__dirname, '../../../shared/monitoring.js'))({project: 'shenyuan', require: require}); } catch(e) {}

// ══════════════════════════════════════════
// 韩语八字处理器（内部函数）
// ══════════════════════════════════════════
async function baziKoreanHandler(req, res) {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, gender, question, mode } = req.body;
    var full = hasFullAccess(req, ['bazi', '사주', '八字']);
    const modeIns = (mode === 'gentle')
      ? '\n\n【말투】따뜻하고 부드럽게, 무서운 말을 하지 마세요. 문제가 있어도 먼저 안아주고, 이해시키고, 이끌어 주세요.'
      : '\n\n【말투】담백하고 따뜻하게, 꾸짖지 않고 솔직하게. 무서운 예언은 하지 마세요.';

    const freePart = full
      ? ''
      : ' [무료 기본판] 아래 항목만 간단히(200-300자씩): 사주판, 오행 균형, 올해 운세 한 단락. 마지막에 "더 깊은 풀이(재물·애정·직업·건강·대운·10년 유년)는 심층 리포트에서 확인하세요"라고 안내하세요. 겁주지 말고 4-5문장으로 부드럽게 마무리.';

    const sysPrompt = '당신은 정통 사주명리를 바탕으로 AI로 심층 운세 리포트를 쓰는 명리 연구원입니다. 독자를 무섭게 하지 않고, 따뜻하게 곁을 지키는 말투로 씁니다. 불안을 부추기는 예언은 절대 하지 않습니다.'
      + '\n\n【전문 용어】십성(정관/편관/정인/편인/비견/겁재/상관/식신/정재/편재), 신살, 용신, 일간 등 한국 명리 용어를 정확히 사용하세요. 한문을 병기하지 말고 순수 한국어로 쓰세요.'
      + '\n\n【글쓰기 톤】다정하고 잔잔하게. "좋은 사주다/나쁜 사주다"라는 이분법을 쓰지 않고, "강점과 약점, 그리고 잘 살리는 법"으로 풀어냅니다. 구체적인 조언(색·방위·습관)을 반드시 포함하세요.'
      + '\n\n【구성】만세력 사주판(년월일시柱), 일간과 용신, 오행 균형과 보완법, 그리고 핵심 운세. 장르는 리포트보다 위로와 통찰.'
      + modeIns + freePart;

    const userPrompt = `내 사주를 봐주세요.
출생: ${birthYear}년 ${birthMonth}월 ${birthDay}일${birthHour !== undefined && birthHour !== '' ? ' ' + birthHour + '시' : ' (태어난 시간 모름)'}
성별: ${gender === 'male' ? '남성' : '여성'}
관심: ${question || '전체 운세'}

사주명리로 심층 분석해 주세요.`;

    const messages = buildReadingPrompt(sysPrompt, userPrompt);
    const result = await deepseekChat(messages, { maxTokens: full ? 16384 : 3500 });
    insertReading.run('bazi', JSON.stringify(req.body), result, req.userId);
    var ctxId = saveQaContext('bazi', req.body, result);
    res.json({ reading: result, tier: full ? 'full' : 'basic', locked: !full, contextId: ctxId });
  } catch (err) {
    console.error('[BAZI-KO ERR]', err.message);
    res.status(500).json({ error: 'AI가 잠시 바빠요. 잠시 후 다시 시도해 주세요.' });
  }
}

// ══════════════════════════════════════════
// POST /api/bazi — 八字命理
// ══════════════════════════════════════════
router.post('/bazi', rateLimitMiddleware, async (req, res) => {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, gender, question, mode, lang } = req.body;
    if (!birthYear || !birthMonth || !birthDay) return res.status(400).json({ error: '请提供出生年月日' });
    if (Number(birthYear) > new Date().getFullYear() - 18) return res.status(400).json({ error: '仅限18岁以上用户使用' });
    if (lang === 'ko') return baziKoreanHandler(req, res);

    const modeInstruction = (mode === 'gentle')
      ? '\n\n【说话模式】\n你温暖治愈、以鼓励为主，让人感到被理解。即使指出问题，也要先肯定再引导，用温柔的方式表达。'
      : '\n\n【说话模式】\n你说话直率、不留情面，但句句为对方好。直接指出问题，不拐弯抹角，用最直白的方式告诉命主真相。';

    const messages = buildReadingPrompt(
      `你是一位子平命理正宗传承者，师承盲派铁口直断与《三命通会》学术双脉，旁通《渊海子平》《滴天髓》《穷通宝鉴》原著精研，从事命理批算38年，亲批命盘逾十万张，历经无数次"说中了让人起鸡皮疙瘩"的验证。你说话有分寸，有温度——引经据典时绝不掉书袋，用大白话解释深奥命理，但偶尔一句古籍点睛让报告有底气。你深知"命运不是枷锁，而是地图"——你的职责是帮命主读懂地图，找到最省力的人生路。

【说话风格】
1. 先肯定命主的闪光点，让人感到被看见、被尊重；再温和指出命局中的挑战与注意事项；最后给出具体可行的化解和开运方案。
2. 三分古典七分白话——核心结论用大白话说透，引用古书原文时必须附上完整的白话翻译，让读不懂古文的人也能豁然开朗，让懂古文的人觉得有深度。
3. 极度具体——给出具体的年份、月份、数字、颜色（精确到色号或色系）、物品（具体到品类甚至品牌）、方向，让人能照着做，当天就能落地。
4. 开场用温暖轻松的语调，先共情后分析。用"我"和"你"直接对话，像一位从未见面却一眼就懂你的老朋友。

【输出格式与字数硬性要求】
⚠️ 这是用户付费购买的深度命理报告，字数不够不算完成。总字数必须达到12000-18000字。每个维度未达到字数下限，必须补写到位再进入下一维度。

你必须严格按照以下16个维度展开，每个维度标题必须用对应emoji开头，维度之间用空行分隔。

维度结构：
1. 📜 四柱八字排盘（年柱月柱日柱时柱分别解释，格局总评，不少于800字）
2. 🔥 十神分析（全部十神一一分析，十神组合对性格命运的综合影响，不少于1000字）
3. 🟤 五行能量分析（精确百分比、旺衰判断、补泄方案、身体器官对应、饮食建议，不少于800字）
4. 💰 财运格局（正偏财分析、财库开闭、发财黄金年份、行业方向、投资禁忌、未来10年走势，不少于1000字）
5. 💕 感情姻缘（夫妻宫、正缘特征含外貌性格职业、桃花类型、遇缘最佳年份、感情建议，不少于1000字）
6. 💼 事业格局（官杀印星分析、职业路径判断、升职跳槽最佳时机精确到年月、贵人特征与出现时间、未来10年事业建议，不少于1000字）
7. 🏥 健康预警和养生建议（先天体质弱项、高发病症预警、高危年龄段、养生运动饮食作息建议，具体到病名和食材，不少于800字）
8. 📅 全部8步大运（每步大运干支+起止年份+不少于200字的深度分析，8步全部写完，不漏，合计不少于1600字）
9. 🔮 未来10年逐年流年详批（每年财运/感情/事业百分制评分+关键提醒+吉神凶神具体列出，合计不少于1500字）
10. ✨ 神煞分析（天乙贵人/桃花/驿马/华盖/文昌/太极贵人等，每个神煞的位置与具体影响，不少于600字）
11. 🌿 藏干分析（每个地支藏干、透出情况、藏干对命局影响，不少于500字）
12. 👨‍👩‍👧‍👦 父母宫/子女宫/夫妻宫（三宫各自深度分析，不少于600字）
13. 🎯 开运锦囊（幸运颜色精确色号、幸运数字3个含原因、吉祥方位、推荐佩戴物材质形状颜色、家居风水布置、流年避讳，不少于600字）
14. 📖 古法断语（引用《渊海子平》《三命通会》《滴天髓》或《穷通宝鉴》原文一句，附白话全译，对应命主人生，不少于400字）
15. 🔑 英文名与事业签名（从命主五行用神出发，推荐3个适合的英文名，解释每个名字的音韵五行属性；另推荐一个适合商务场合使用的中文签名风格，不少于300字）
16. 💌 命理师私语（这是最后一节，完全个性化——不是套话，是只对这个命主说的心里话。像一位看透一切却依然温柔的老朋友，说出命主最需要听到的那句话，以及一句发自内心的祝福，不少于400字）

语言：简体中文。用朋友聊天的语气写，不要文言腔。重要信息加粗。引用古文时必须附白话解释。多用量化数据（百分比、分数、年份）增强说服力。每个维度字数不达标则补写，绝不允许以"略"或省略号代替。${modeInstruction}`,
      `请为我批算八字命盘，生成一份完整的深度命理报告。总字数必须达到12000-18000字，每个维度字数未达下限不算完成，请补写。

【基本信息】
出生时间：${birthYear}年${birthMonth}月${birthDay}日${birthHour !== undefined ? birthHour + '时' : '（时辰不详）'}
性别：${gender === 'male' ? '男' : '女'}
用户关注：${question || '请全面分析命盘'}

【输出要求】
请严格按照以下16个维度展开，每个维度用对应的emoji作为标题开头，每个维度都必须基于上述生辰八字展开具体分析，不能泛泛而谈，不能以"略"或省略号代替任何内容。

1. 📜 四柱八字排盘（不少于800字）
- 先排出四柱八字表格（年柱·月柱·日柱·时柱，天干·地支各注）
- 分别解释每柱天干地支的五行属性、阴阳属性
- 各柱代表的人生领域（年柱=祖上/早年/社会格局；月柱=父母/兄弟/青年运；日柱=自身/配偶；时柱=子女/晚年）
- 整体八字格局判断（身强身弱、格局名称、用神喜忌）

2. 🔥 十神分析（不少于1000字）
- 以日干为中心，逐一列出全部十神（正官、偏官/七杀、正印、偏印、正财、偏财、比肩、劫财、食神、伤官）在命盘中的位置
- 每个十神的五行含义及对命主性格、事业、感情的具体影响
- 重点分析命局中力量最强的2-3个十神的组合效应
- 十神之间的生克制化关系

3. 🟤 五行能量分析（不少于800字）
- 八字中每个五行的百分比（精确到数字，如木20%、火35%、土15%、金15%、水15%）
- 哪种五行最旺、哪种最弱，对命运格局的影响
- 用神和忌神明确列出
- 五行对应身体器官（木=肝胆、火=心脏小肠、土=脾胃、金=肺大肠、水=肾膀胱）及命主需特别关注的脏腑
- 饮食养生建议：补弱五行的具体食材（如缺火者多吃红色食物：红枣、枸杞、红豆）

4. 💰 财运格局（不少于1000字）
- 正财分析：稳定收入/工资性收入的格局，命主适合的财富积累方式
- 偏财分析：投资/副业/意外之财的格局，有无偏财命局特征
- 财库分析：命中有无财库（辰戌丑未），财库是否被冲开
- 发财黄金时间窗：给出3个最可能突破财运的具体年份（如2026年、2028年）并解释大运流年配合原因
- 最适合的求财行业方向（具体行业名称，至少5个）
- 投资禁忌：哪些投资方式会亏损（具体说明五行原因）
- 未来10年财运走势概览

5. 💕 感情姻缘（不少于1000字）
- 夫妻宫（日支）深度分析
- 正缘特征：身高范围、外貌特点、性格气质、职业方向、星座或生肖倾向、认识场景（具体描述，如"可能在工作场合或朋友聚会中相识"）
- 遇到正缘的最佳年份（给出2-3个具体年份并解释）
- 桃花分析：命中是正桃花还是烂桃花，有无驿马桃花、墓库桃花等复杂情况
- 感情模式分析：命主在感情中的表现模式、容易踩的坑
- 开运建议：如何提升遇到正缘的概率（具体行动建议）

6. 💼 事业格局（不少于1000字）
- 官杀星分析（命中有无正官/七杀，力量如何）
- 印星分析（正印/偏印，对事业学习的影响）
- 职业路径判断：适合打工/创业/自由职业/体制内/艺术/技术/管理的具体依据
- 最适合的行业（至少6个具体行业）
- 升职/跳槽黄金时间：给出最近3次升职机会的具体年份+月份
- 贵人特征：什么属相/什么五行/什么性格的人是命主的贵人，贵人可能出现的时间
- 未来10年事业发展建议

7. 🏥 健康预警和养生建议（不少于800字）
- 先天体质弱项（从五行分析哪个脏腑最需要保护）
- 高发病症预警（具体到病症名称，如"肝气郁结、心血管需注意、脾胃消化较弱"）
- 需要重点关注的年龄段（具体年份）
- 养生建议：
  * 适合的运动类型（具体运动名称和频率）
  * 作息建议（具体到几点睡、几点起）
  * 饮食禁忌（具体到哪些食物要少吃）
  * 推荐的中医调理方向

8. 📅 全部8步大运（不少于1600字，每步大运不少于200字）
- 从命主出生起推算全部8步大运
- 每步大运格式：【第X步大运】[干支] [起始年份]-[结束年份]
  * 该步大运的天干地支五行属性
  * 大运干支与命局八字的生克关系
  * 该步大运对命主财运/事业/感情/健康的综合影响
  * 这10年中的关键转折点（具体年份）
  * 这步大运的总体定性（黄金期/平稳期/挑战期）
- 8步大运全部写完，一步都不漏

9. 🔮 未来10年逐年流年详批（不少于1500字）
- 从${new Date().getFullYear()}年起，逐年分析到${new Date().getFullYear()+9}年
- 每一年格式：
  **[年份]年（[该年天干地支]年）**
  财运评分：XX/100 | 感情评分：XX/100 | 事业评分：XX/100
  年度主题：[一句话定性]
  吉神：[该年对命主有利的神煞/流年干支]
  凶神：[该年对命主不利的神煞/流年干支]
  关键提醒：[具体注意事项]

10. ✨ 神煞分析（不少于600字）
- 天乙贵人：有无、位置、贵人属相/特征、何时贵人会出现帮助命主
- 桃花：有无（咸池桃花/沐浴桃花等），位置在年/月/日/时，正桃花还是烂桃花
- 驿马：有无，位置，对命主奔波/出行/迁移的影响
- 华盖：有无，对才艺/孤独/宗教缘分的影响
- 文昌贵人：有无，对学业/写作/才艺的影响
- 太极贵人：有无，灵性/宗教缘分
- 孤辰寡宿：有无，对感情/婚姻的影响

11. 🌿 藏干分析（不少于500字）
- 逐一列出每个地支中藏有的天干（如：子藏癸水；午藏丁火己土；等）
- 分析藏干是否透出天干
- 藏干透出与否对命局格局和命运的影响
- 藏干中有无暗藏的用神或忌神

12. 👨‍👩‍👧‍👦 父母宫/子女宫/夫妻宫（不少于600字）
- 父母宫分析（年柱/月柱中印星/财星情况，父母缘分深浅，是否得父母之力，父母婚姻状况参考）
- 子女宫分析（时柱及食神/伤官分析，子女缘分，可能的子女数量倾向，子女成就潜力）
- 夫妻宫分析（日支深度解读，配偶的性格特征、外貌倾向、职业方向、与命主的相处模式）

13. 🎯 开运锦囊（不少于600字）
- 幸运颜色：精确到具体色系（如"深祖母绿色#1A4A3A"或"暖琥珀金#C8962E"），解释五行原因
- 幸运数字：3个数字，逐一解释为什么（从五行/音韵角度）
- 吉祥方位：求财方位（具体方向如"东南偏东"）、求姻缘方位（具体方向）、工作学习方位
- 推荐佩戴物：材质（如天然黄水晶/紫水晶/白玉）、形状（如貔貅/葫芦/圆珠）、颜色，及佩戴位置（左手/右手）
- 家居风水建议：卧室床头朝向、书桌朝向、客厅财位摆件建议
- 今年流年避讳：具体列出${new Date().getFullYear()}年不宜做的3-5件事（如"不宜轻易换工作""不宜大额投机"）

14. 📖 古法断语（不少于400字）
- 从《渊海子平》《三命通会》《滴天髓》《穷通宝鉴》中引用一句最契合命主命局的原文断语
- 引文格式：原文（附出处）+ 完整白话翻译（普通人能看懂的现代语言）
- 详细分析这句古语如何精准对应命主的人生轨迹和命运特征
- 从命理师角度给出对古语的现代诠释

15. 🔑 英文名与事业签名（不少于300字）
- 从命主的五行用神出发，推荐3个适合的英文名
- 每个英文名需说明：音韵对应的五行属性、名字的内在含义、适合在哪些场合使用
- 从汉字笔画和五行角度，推荐一种适合命主商务场合使用的中文签名风格（如"宜简约/宜有横笔/宜带水字边"）

16. 💌 命理师私语（不少于400字）
- 这是只对这个命主说的心里话，不是套话，不是通用结尾
- 根据命主八字格局，说出命主最需要听到的那句话——可能是一个被忽视的优势，一个需要正视的习惯，或一个人生转折的预兆
- 用温柔而有力量的语气，像一位看透一切却始终站在命主这边的老朋友
- 最后一句：一个发自内心的、针对此命盘专属的祝福（不用"一帆风顺"这类套话）`
    );

    var full = hasFullAccess(req, ['bazi', '八字']);
    var useMessages = messages;
    if (!full) {
      useMessages = buildReadingPrompt(
        '你是精通八字命理的命理师。为用户生成一份【基础版】命盘概览。请严格按照以下3个章节结构输出，每个章节标题必须以对应的emoji开头（方便客户端解析）:\n📜 四柱八字排盘\n🌊 五行能量分析\n🌟 今年运势概览\n每个章节写2-3段实质内容，语言简体中文、温暖白话，合计约1500字。让用户感受到真实价值。三个章节完成后，输出一行"---LOCKED---"，然后输出以下锁定内容提示（原样输出，不展开）:\n💰 财运格局 · 完整解读见付费版\n❤️ 感情姻缘 · 完整解读见付费版\n🏆 事业格局 · 完整解读见付费版\n🔑 开运锦囊 · 完整解读见付费版',
        '请为以下命主生成【基础版】命盘概览(仅含四柱排盘+五行+今年运势3节，约1500字，然后输出---LOCKED---及锁定章节提示):\n出生:' + birthYear + '年' + birthMonth + '月' + birthDay + '日' + (birthHour !== undefined ? birthHour + '时' : '(时辰不详)') + '\n性别:' + (gender === 'male' ? '男' : '女')
      );
    }
    var freeMaxTokens = full ? 16384 : 3000;
    useMessages = useMessages.map(function(m) {
      return (m && m.role === 'system') ? { role: 'system', content: (m.content || '') + '\n\n【必须遵守】报告最后必须附一行免责声明:"本报告由AI生成,仅供参考娱乐,不构成医学、法律、投资或人生重大决策建议。"' } : m;
    });
    // 免费版缓存检查
    if (!full) {
      const ck = cacheKey({ name: req.body.name || '', dob: (birthYear||'') + '-' + (birthMonth||'') + '-' + (birthDay||''), gender: gender||'', lang: lang||'zh' });
      const cached = reportCache.get(ck);
      if (cached) { return res.json({ reading: cached, tier: 'basic', locked: true, cached: true }); }
    }
    const result = await deepseekChat(useMessages, { maxTokens: freeMaxTokens });
    // 免费版结果缓存24h
    if (!full) {
      const ck = cacheKey({ name: req.body.name || '', dob: (birthYear||'') + '-' + (birthMonth||'') + '-' + (birthDay||''), gender: gender||'', lang: lang||'zh' });
      reportCache.set(ck, result);
      setTimeout(() => reportCache.delete(ck), 24 * 60 * 60 * 1000);
    }
    insertReading.run('bazi', JSON.stringify(req.body), result, req.userId);
    var ctxId = saveQaContext('bazi', req.body, result);
    res.json({ reading: result, tier: full ? 'full' : 'basic', locked: !full, contextId: ctxId, product: full ? matchProduct(result, 'bazi') : undefined });
  } catch (err) {
    console.error('[BAZI ERR]', err.message);
    if (mon && mon.captureException) mon.captureException(err, { tags: { api: 'bazi' } });
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试', detail: err.message });
  }
});

// ══════════════════════════════════════════
// POST /api/tarot — 塔罗占卜
// ══════════════════════════════════════════
router.post('/tarot', rateLimitMiddleware, async (req, res) => {
  try {
    const { cards, question, topic } = req.body;
    if (!question) return res.status(400).json({ error: '请提供你的问题' });

    const cardDesc = cards && cards.length
      ? cards.map((c, i) => `第${i+1}张（${c.position||'位置'+(i+1)}）：${c.name}${c.reversed?'（逆位）':'（正位）'}`).join('\n')
      : '使用随机三张塔罗牌（过去-现在-未来）';
    const topicMap = { love: '感情姻缘', wealth: '财运事业', health: '健康运势', decision: '抉择指引', year: '年度运势' };

    const messages = buildReadingPrompt(
      '你是一位融合东西方智慧的塔罗占卜师，从业二十年，解读过上万个案。你像一位知心姐姐，温暖有力量，说话柔和但直抵人心。你能让求助者在迷茫中看到光，在困惑中找到方向。记住：逆位牌不是坏牌，是提醒；困难不是终点，是转折。每次回答至少2000字。语言：简体中文。',
      `问题：${question}
主题：${topicMap[topic] || topic || '综合'}
${cardDesc ? '牌面信息：\n' + cardDesc : '使用随机三张塔罗牌（过去-现在-未来）'}

请按照以下结构出具一份完整的塔罗占卜解读，每张牌必须详细展开300-400字：

## 一、整体格局概览（200-300字）
## 二、逐牌详细解读（每张牌300-400字）
## 三、综合解读与能量走向（300-400字）
## 四、3条可执行的行动建议（每条100字左右）
## 五、每月行动提醒（100字）
## 六、占卜师的悄悄话（100-150字）`
    );

    var _gt = gateMessages(req, ['tarot', '塔罗', 'member'], messages, 8192);
    const result = await deepseekChat(_gt.messages, { maxTokens: _gt.maxTokens });
    insertReading.run('tarot', JSON.stringify(req.body), result, req.userId);
    var ctxId = saveQaContext('tarot', req.body, result);
    res.json({ reading: result, contextId: ctxId, tier: _gt.full ? 'full' : 'basic', locked: !_gt.full });
  } catch (err) {
    console.error('[TAROT ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用', detail: err.message });
  }
});

// ══════════════════════════════════════════
// POST /api/ziwei — 紫微斗数
// ══════════════════════════════════════════
router.post('/ziwei', rateLimitMiddleware, async (req, res) => {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, gender } = req.body;
    if (!birthYear || !birthMonth || !birthDay || birthHour === undefined) {
      return res.status(400).json({ error: '紫微斗数需要出生年月日时' });
    }
    const messages = buildReadingPrompt(
      '你是一位精通紫微斗数的命理师，师承中州派，从业30年，批过上万张命盘。你深谙紫微斗数精髓，能从命盘中看透一个人的一生轨迹。你的语言通俗易懂，不用晦涩术语唬人——要用大白话让从没学过紫微的人也能听懂。你的分析必须专业、深刻、具体。每次回答至少4000字。用Markdown格式输出，使用标题、加粗让报告结构清晰。语言：简体中文。',
      `出生：${birthYear}年${birthMonth}月${birthDay}日${birthHour}时
性别：${gender === 'male' ? '男' : '女'}

请按以下结构出具一份完整的紫微斗数命理报告。每个宫位的分析必须不少于200字，总字数不少于4000字：

## 一、命盘基本格局（200-300字）
## 二、命宫主星深度解读（400-500字）
## 三、主要宫位逐个分析（每个宫位200-300字，至少8个宫位）
## 四、四化飞星分析（200-300字）
## 五、当前大运详批（400-500字）
## 六、流年关键点（300-400字）
## 七、开运建议（200-300字）
## 八、一句话点睛（50-100字）`
    );

    var _g = gateMessages(req, ['bazi','hehun','ziwei','xingming','astrology','八字','合婚','紫微','姓名','占星','星盘'], messages);
    const result = await deepseekChat(_g.messages, { maxTokens: _g.maxTokens });
    insertReading.run('ziwei', JSON.stringify(req.body), result, req.userId);
    var ctxId = saveQaContext('ziwei', req.body, result);
    res.json({ analysis: result, contextId: ctxId });
  } catch (err) {
    console.error('[ZIWEI ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用', detail: err.message });
  }
});

// ══════════════════════════════════════════
// POST /api/mianxiang — 面相手相
// ══════════════════════════════════════════
router.post('/mianxiang', rateLimitMiddleware, async (req, res) => {
  try {
    const { question } = req.body;
    const messages = buildReadingPrompt(
      '你是一位民间相面高人，阅人无数，行走江湖四十载，看过十万张面孔。你深知"相由心生，境随心转"的道理——面相不是一成不变的，心善则貌美，心恶则相凶。你的分析一针见血但不忘提醒用户命运掌握在自己手中。每次回答至少2000字。用Markdown格式输出，使用标题、加粗让报告结构清晰。语言：简体中文。',
      `用户关注：${question || '请综合分析面相与手相'}

请按以下结构出具一份详细的面相手相分析报告。每个部位分析不少于200字：

## 一、额头（天庭）— 事业运、早年运（200-300字）
## 二、眉毛 — 兄弟朋友、性格脾气（200-300字）
## 三、眼睛 — 内心世界、桃花、诚信（200-300字）
## 四、鼻子 — 财运、中年运（200-300字）
## 五、嘴巴 — 表达力、晚年运、食禄（200-300字）
## 六、下巴（地阁）— 不动产运、晚年（150-200字）
## 七、整体面相格局评估（200-300字）
## 八、改善面相的小建议（150-200字）
## 九、相面师的叮嘱（100字）`
    );

    var _gm = gateMessages(req, ['mianxiang', '面相', 'member'], messages, 8192);
    const result = await deepseekChat(_gm.messages, { maxTokens: _gm.maxTokens });
    insertReading.run('mianxiang', JSON.stringify({ question }), result, req.userId);
    res.json({ reading: result, tier: _gm.full ? 'full' : 'basic', locked: !_gm.full });
  } catch (err) {
    console.error('[MIANXIANG ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用', detail: err.message });
  }
});

// ══════════════════════════════════════════
// POST /api/hehun — 合婚配对
// ══════════════════════════════════════════
router.post('/hehun', rateLimitMiddleware, async (req, res) => {
  try {
    const { p1Year, p1Month, p1Day, p1Hour, p2Year, p2Month, p2Day, p2Hour, p1Gender, p2Gender } = req.body;
    if (!p1Year || !p2Year) return res.status(400).json({ error: '请提供双方出生信息' });
    const _curYear = new Date().getFullYear();
    if (Number(p1Year) > _curYear - 18 || Number(p2Year) > _curYear - 18) {
      return res.status(400).json({ error: '仅限18岁以上用户使用' });
    }
    const messages = buildReadingPrompt(
      '你是一位德高望重的合婚师，从业四十余年，阅人无数，撮合过上千对姻缘。你说话诚恳、直率、不留情面，但句句为对方好。你深知婚姻不是儿戏，合婚分析必须全面深刻、落到实地。每次回答至少3000字。用Markdown格式输出，使用标题、加粗、分隔线让报告清晰易读。语言：简体中文。',
      `双方信息：
A方：${p1Year}年${p1Month}月${p1Day}日${p1Hour !== undefined ? p1Hour+'时' : ''} · ${p1Gender === 'male' ? '男' : '女'}
B方：${p2Year}年${p2Month}月${p2Day}日${p2Hour !== undefined ? p2Hour+'时' : ''} · ${p2Gender === 'male' ? '男' : '女'}

请详细展开分析（总字数8000-12000字）：
## 一、合婚总分（百分制）
## 二、五行互补度（满分20分）
## 三、性格匹配度（满分20分）
## 四、价值观兼容性（满分15分）
## 五、吵架模式分析（满分10分）
## 六、气场合度（满分10分）
## 七、生育子女缘分（满分5分）
## 八、双方父母家庭兼容性（满分5分）
## 九、最佳结婚年份（满分5分）
## 十、婚后需要注意的3个事项
## 十一、合婚古诀引用
## 十二、一句话结论`
    );

    var _g = gateMessages(req, ['bazi','hehun','ziwei','xingming','astrology','八字','合婚','紫微','姓名','占星','星盘'], messages);
    const result = await deepseekChat(_g.messages, { maxTokens: _g.maxTokens });
    insertReading.run('hehun', JSON.stringify(req.body), result, req.userId);
    var ctxId = saveQaContext('hehun', req.body, result);
    res.json({ reading: result, contextId: ctxId });
  } catch (err) {
    console.error('[HEHUN ERR]', err.message);
    if (mon && mon.captureException) mon.captureException(err, { tags: { api: 'hehun' } });
    res.status(500).json({ error: 'AI暂时不可用', detail: err.message });
  }
});

// ══════════════════════════════════════════
// POST /api/hehun/stream — 合婚流式（SSE）
// ══════════════════════════════════════════
router.post('/hehun/stream', rateLimitMiddleware, async (req, res) => {
  try {
    const { p1Year, p1Month, p1Day, p1Hour, p2Year, p2Month, p2Day, p2Hour, p1Gender, p2Gender, p1Name, p2Name, mode } = req.body;
    if (!p1Year || !p2Year) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: '请提供双方出生信息' });
    }
    const _curYear = new Date().getFullYear();
    if (Number(p1Year) > _curYear - 18 || Number(p2Year) > _curYear - 18) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: '仅限18岁以上用户使用' });
    }
    const isDating = mode === 'dating';
    const nameA = p1Name || 'A方';
    const nameB = p2Name || 'B方';

    const systemPrompt = isDating
      ? `你是一位洞悉人心的感情命理师，从业三十年，见过无数恋爱中的人。你说话温柔又直率——你不会粉饰，但也不会只说坏事。你深知恋爱的美丽和它的复杂。请用命运诗篇的笔触，为${nameA}和${nameB}写一份深度恋爱配对分析报告（6000-8000字）。用Markdown格式，简体中文。

分析维度：
## 💕 缘分分数（百分制）与总体感情走向
## 🌊 两人的情感模式——你们是怎么爱的
## 💬 沟通与冲突模式（你们会在哪里起争执，如何化解）
## 🌟 这段感情最美好的地方（天然的心灵契合点）
## ⚡ 感情中的考验（主要挑战和弱点）
## 🏠 同居/深度相处的化学反应
## 💫 你们的感情生命周期（未来1-3年走势）
## 🎯 让这段感情更好的3个具体建议
## 💌 一句话：这段感情值得吗

写作风格：命运诗篇。不用给打分列表，用连贯的叙述段落。每节结尾用一句令人心头一震的话。直接进入两人的感情画像。`

      : `你是一位德高望重的合婚师，从业四十余年，阅人无数，撮合过上千对姻缘。你说话诚恳、直率、不留情面，但句句为对方好。你深知婚姻不是儿戏，合婚分析必须全面深刻、落到实地。用Markdown格式，简体中文，8000-12000字。

详细分析：
## 一、合婚总评与缘分分数（百分制）
## 二、五行互补度与元素相生相克
## 三、性格匹配度——两人的心理底色
## 四、价值观与人生方向兼容性
## 五、吵架模式与冲突化解之道
## 六、气场合度（谁带动谁，谁让谁稳定）
## 七、生育子女缘分与家庭运
## 八、双方原生家庭兼容性
## 九、最佳结婚年份与时机
## 十、婚后最需要注意的3件事
## 十一、合婚古诀引用与命理依据
## 十二、一句话结论——这段婚姻值得进入吗`;

    // ── 双方精确排盘（算法排，不让AI猜）──
    const bazi1 = calcBazi(Number(p1Year), Number(p1Month), Number(p1Day), Number(p1Hour)||0, p1Gender||'female');
    const bazi2 = calcBazi(Number(p2Year), Number(p2Month), Number(p2Day), Number(p2Hour)||0, p2Gender||'male');
    const hehunChart = `【精确排盘数据（由万年历算法计算，请严格使用，不得自行推算或修改）】
${nameA}（${p1Gender==='male'?'男':'女'}）：
  四柱：${bazi1.fourPillars}　日主：${bazi1.dayMaster}（${bazi1.dayMasterElement}）　身${bazi1.isStrong?'强':'弱'}
  五行：金${bazi1.wuxing['金'].toFixed(1)} 木${bazi1.wuxing['木'].toFixed(1)} 水${bazi1.wuxing['水'].toFixed(1)} 火${bazi1.wuxing['火'].toFixed(1)} 土${bazi1.wuxing['土'].toFixed(1)}
  大运：${bazi1.daYun.slice(0,6).map(d=>d.name+'('+d.startAge+'岁)').join(' ')}
${nameB}（${p2Gender==='male'?'男':'女'}）：
  四柱：${bazi2.fourPillars}　日主：${bazi2.dayMaster}（${bazi2.dayMasterElement}）　身${bazi2.isStrong?'强':'弱'}
  五行：金${bazi2.wuxing['金'].toFixed(1)} 木${bazi2.wuxing['木'].toFixed(1)} 水${bazi2.wuxing['水'].toFixed(1)} 火${bazi2.wuxing['火'].toFixed(1)} 土${bazi2.wuxing['土'].toFixed(1)}
  大运：${bazi2.daYun.slice(0,6).map(d=>d.name+'('+d.startAge+'岁)').join(' ')}
当前年份：${new Date().getFullYear()}年`;

    const userMsg = `${hehunChart}

${nameA}：${p1Year}年${p1Month}月${p1Day}日${p1Hour !== undefined && p1Hour !== '' ? p1Hour+'时' : ''} · ${p1Gender === 'male' ? '男' : '女'}
${nameB}：${p2Year}年${p2Month}月${p2Day}日${p2Hour !== undefined && p2Hour !== '' ? p2Hour+'时' : ''} · ${p2Gender === 'male' ? '男' : '女'}
请依据以上精确排盘数据进行合婚分析，所有八字相关结论必须与上方数据一致。`;

    const fullAccess = hasFullAccess(req, ['bazi', 'hehun', 'ziwei', 'xingming', 'astrology', '八字', '合婚', '紫微', '姓名', '占星']);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ type: 'meta', mode: isDating ? 'dating' : 'marriage' })}\n\n`);

    const streamBody = await deepseekStream(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }],
      { maxTokens: fullAccess ? 12288 : 4000, timeout: 300000 }
    );
    const reader = streamBody.getReader();
    const decoder = new TextDecoder();
    let fullText = '', buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') continue;
        try {
          const json = JSON.parse(raw);
          const content = json.choices?.[0]?.delta?.content || '';
          if (content) { fullText += content; res.write(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`); }
        } catch(e) {}
      }
    }
    insertReading.run('hehun', JSON.stringify(req.body), fullText, req.userId);
    const ctxId = saveQaContext('hehun', req.body, fullText);
    res.write(`data: ${JSON.stringify({ type: 'done', contextId: ctxId })}\n\n`);
    res.end();
  } catch(err) {
    console.error('[HEHUN-STREAM ERR]', err.message);
    try { res.write(`data: ${JSON.stringify({ type: 'error', message: '生成失败，请重试' })}\n\n`); res.end(); } catch(e) {}
  }
});

// ══════════════════════════════════════════
// POST /api/tarot/stream — 塔罗流式（SSE）
// ══════════════════════════════════════════
router.post('/tarot/stream', rateLimitMiddleware, async (req, res) => {
  try {
    const { cards, question, topic } = req.body;
    if (!question) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: '请提供你的问题' });
    }
    const cardDesc = cards && cards.length
      ? cards.map((c, i) => `第${i+1}张（${c.position||'位置'+(i+1)}）：${c.name}${c.reversed?'（逆位）':'（正位）'}`).join('\n')
      : '使用随机三张塔罗牌（过去-现在-未来）';
    const topicMap = { love: '感情姻缘', wealth: '财运事业', health: '健康运势', decision: '抉择指引', year: '年度运势' };
    const systemPrompt = `你是一位融合东西方智慧的塔罗占卜师，从业二十年，解读过上万个案。你像一位知心姐姐，温暖有力量，说话柔和但直抵人心。你能让求助者在迷茫中看到光，在困惑中找到方向。记住：逆位牌不是坏牌，是提醒；困难不是终点，是转折。每次回答至少2000字。语言：简体中文。`;
    const userMsg = `问题：${question}\n主题：${topicMap[topic] || topic || '综合'}\n${cardDesc ? '牌面信息：\n' + cardDesc : '使用随机三张塔罗牌（过去-现在-未来）'}\n\n请按以下结构出具完整塔罗解读：\n## 一、整体格局概览（200-300字）\n## 二、逐牌详细解读（每张牌300-400字）\n## 三、综合解读与能量走向（300-400字）\n## 四、3条可执行的行动建议\n## 五、占卜师的悄悄话（100-150字）`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ type: 'meta' })}\n\n`);

    const streamBody = await deepseekStream([{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }], { maxTokens: 8192, timeout: 300000 });
    const reader = streamBody.getReader();
    const decoder = new TextDecoder();
    let fullText = '', buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') continue;
        try { const json = JSON.parse(raw); const c = json.choices?.[0]?.delta?.content || ''; if (c) { fullText += c; res.write(`data: ${JSON.stringify({ type: 'chunk', content: c })}\n\n`); } } catch(e) {}
      }
    }
    insertReading.run('tarot', JSON.stringify(req.body), fullText, req.userId);
    const ctxId = saveQaContext('tarot', req.body, fullText);
    res.write(`data: ${JSON.stringify({ type: 'done', contextId: ctxId })}\n\n`);
    res.end();
  } catch(err) {
    console.error('[TAROT-STREAM ERR]', err.message);
    try { res.write(`data: ${JSON.stringify({ type: 'error', message: '生成失败' })}\n\n`); res.end(); } catch(e) {}
  }
});

// ══════════════════════════════════════════
// POST /api/ziwei/stream — 紫微斗数流式（SSE）
// ══════════════════════════════════════════
router.post('/ziwei/stream', rateLimitMiddleware, async (req, res) => {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, gender } = req.body;
    if (!birthYear || !birthMonth || !birthDay || birthHour === undefined) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: '紫微斗数需要出生年月日时' });
    }
    const systemPrompt = '你是一位精通紫微斗数的命理师，师承中州派，从业30年，批过上万张命盘。你深谙紫微斗数精髓，能从命盘中看透一个人的一生轨迹。你的语言通俗易懂，不用晦涩术语唬人——要用大白话让从没学过紫微的人也能听懂。你的分析必须专业、深刻、具体。每次回答至少4000字。用Markdown格式输出，使用标题、加粗让报告结构清晰。语言：简体中文。';
    const userMsg = `出生：${birthYear}年${birthMonth}月${birthDay}日${birthHour}时\n性别：${gender === 'male' ? '男' : '女'}\n\n请按以下结构出具完整紫微斗数命理报告（总字数不少于4000字）：\n## 一、命盘基本格局（200-300字）\n## 二、命宫主星深度解读（400-500字）\n## 三、主要宫位逐个分析（每个宫位200-300字，至少8个宫位）\n## 四、四化飞星分析（200-300字）\n## 五、当前大运详批（400-500字）\n## 六、流年关键点（300-400字）\n## 七、开运建议（200-300字）\n## 八、一句话点睛（50-100字）`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ type: 'meta' })}\n\n`);

    const streamBody = await deepseekStream([{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }], { maxTokens: 8192, timeout: 300000 });
    const reader = streamBody.getReader();
    const decoder = new TextDecoder();
    let fullText = '', buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') continue;
        try { const json = JSON.parse(raw); const c = json.choices?.[0]?.delta?.content || ''; if (c) { fullText += c; res.write(`data: ${JSON.stringify({ type: 'chunk', content: c })}\n\n`); } } catch(e) {}
      }
    }
    insertReading.run('ziwei', JSON.stringify(req.body), fullText, req.userId);
    const ctxId = saveQaContext('ziwei', req.body, fullText);
    res.write(`data: ${JSON.stringify({ type: 'done', contextId: ctxId })}\n\n`);
    res.end();
  } catch(err) {
    console.error('[ZIWEI-STREAM ERR]', err.message);
    try { res.write(`data: ${JSON.stringify({ type: 'error', message: '生成失败' })}\n\n`); res.end(); } catch(e) {}
  }
});

// ══════════════════════════════════════════
// POST /api/fengshui/stream — 风水流式（SSE）增强版
// ══════════════════════════════════════════
router.post('/fengshui/stream', rateLimitMiddleware, async (req, res) => {
  try {
    const { houseDirection, floor, rooms, address, question, members, floorPlanBase64 } = req.body;
    if (!houseDirection) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: '请提供房屋朝向' });
    }

    // 付费门：免费只给前两节预览
    const fullAccess = hasFullAccess(req, ['fengshui', '风水', 'member_monthly', 'member_yearly', 'member_quarterly', 'member_3year', 'member_daily', 'member_lifetime']);

    const systemPrompt = `你是蒋大鸿三元玄空风水嫡传第九代传人，同时精研八宅明镜、三合水法与形势派堪舆，驻场实勘住宅逾三万套、走访海内外35年。你的报告素以"一针见血、落地即用"著称——绝不讲玄虚理论，只给具体到"这面墙放这个、那个角落换那件东西、哪天动工最吉"的实操建议。你同时运用玄空飞星（九星气场流动分析）与八宅明镜（命卦与朝向匹配）双体系互参，层次比单一体系深出一倍。

【输出铁律 — 必须严格遵守】
1. 报告字数：完整版8000-12000字，每节须详尽展开，严禁用"略""详见下文""等"代替内容
2. 禁止套话开场（禁止用"感谢您的信任""很高兴为您服务"等废话起头，直接进入分析）
3. 每一处建议必须具体：摆件写清品类+尺寸+颜色；植物写清品种+摆放高度；改动写清"哪面墙/哪个角落/面朝哪个方向"
4. 产品推荐必须写亚马逊/Etsy可购到的品类（目标读者在海外），不要推荐国内淘宝品牌
5. 价格用美元（$）标注
6. 语气：像一位真正懂行的老朋友在帮你看房子，温暖、亲切、不吓唬人，有时可以幽默一两句
7. 报告最后必须有一段完全个性化的"大师私语"，针对这套房子和这位业主的具体情况，不得使用任何通用套话
简体中文。`;

    // 家庭成员命卦段落
    let membersSection = '';
    if (members && Array.isArray(members) && members.length > 0) {
      membersSection = '\n\n家庭成员命卦信息：\n' + members.map(m => {
        const role = m.role || '成员';
        const name = m.name || '未知';
        const dob = m.dob || '未提供';
        const gender = m.gender || '未知';
        const mingua = m.mingua || '未提供';
        const group = m.group || '未知';
        return `- ${role}（${name}，${gender}，${dob}生）：命卦${mingua}·${group}`;
      }).join('\n');
    }

    // 户型图分析段落
    let floorPlanNote = '';
    if (floorPlanBase64) {
      floorPlanNote = '\n\n【已上传户型图】请在分析中结合户型图布局，识别可能存在的风水问题，例如：穿堂风（前后门对齐）、卫生间居中泄气、厨厕相邻等，并给出针对性建议。';
    }

    const freeGuidance = fullAccess ? '' : `\n\n【重要】本次为免费预览版，只输出以下两节：「房屋总格局与气场特征」和「玄空飞星年盘叠加分析」，每节300-400字，内容真实有用，结尾自然提示完整版包含更多章节。不要道歉，不要说"这是免费版"，自然写完这两节就停止。`;

    const userMsg = `房屋朝向：${houseDirection}
楼层：${floor || '未提供'}
房间布局：${rooms || '未提供'}
地址/区域：${address || '未提供'}
用户问题：${question || '请综合分析房屋风水，给出全面的开运布局方案'}${membersSection}${floorPlanNote}${freeGuidance}

请严格按照以下结构输出完整风水报告（要求8000-12000字，每个章节须详尽展开，禁止以"略"或省略号代替任何内容）：

## 🏠 房屋总格局与气场特征
（运用三元玄空与八宅双体系，分析此房屋的整体气场：
- 此朝向的五行属性（如南向属火，纳气旺热情、事业心；但需防过燥）
- 本山本向的元运与旺衰判断（当前运：第九运2024-2043，离卦当令，对哪些朝向最有利）
- 整体格局的优势（什么地方做得好）与注意事项（哪些格局需要调整）
- 楼层对气场的具体影响（高层气散但采光旺、低层气聚但潮湿，几层最旺）
- 总体风水评分（100分制），说明得分依据）

## 🌐 玄空飞星年盘叠加分析（当前年份实时风水）
（${new Date().getFullYear()}年的年飞星盘（按流年大运计算）叠加在此房屋的座山向水上：
- 当年的五黄廉贞星落在哪个方位（该方位本年不宜动土装修、不宜摆放尖锐物品）
- 当年的二黑病符星落在哪个方位（该方位不宜睡眠、需放铜葫芦化解）
- 当年的三碧蚩尤星落在哪个方位（容易引发口舌是非，需放红色物品化解）
- 当年的吉星：一白官星（利考试/升职）、六白武曲（利财运决策）、八白左辅（利偏财）各在何方位
- 本户型在${new Date().getFullYear()}年的最佳办公/睡眠/祈福方位，以及最需要避开的方位
- 哪些方位在${new Date().getFullYear()}年格外旺，建议在此方位开展重要活动）

## 🧭 八宅吉凶位完整详解（逐一方位，不漏）
（以此房屋朝向为基础，逐一分析八个方位的八宅属性：
对每个方位（东/东南/南/西南/西/西北/北/东北）分别说明：
- 八宅星名（生气/天医/延年/伏位/祸害/六煞/五鬼/绝命）
- 该星的五行属性与吉凶等级
- 这个方位适合放什么（卧室/书房/活动室/储藏室）
- 不适合放什么
- 具体的催旺建议（如：东南生气位放绿色植物+流水摆件催旺事业）
- 如有家庭成员命卦，说明该方位与各成员的配合度）

## 👨‍👩‍👧‍👦 家庭成员命卦与专属布局方案
（根据每位家庭成员的命卦和东四命/西四命属性，为每位成员量身定制：
- 最适合的睡头朝向（具体到"头朝X方"）
- 书桌/工作区朝向（正对哪个方向有利事业/学业）
- 沙发坐向建议（背靠实墙、面朝吉方）
- 最适合居住的房间（哪间卧室与命卦最配）
- 与房屋朝向的配合度综合评分，以及提升配合度的调整方法
- 特别提醒：哪些方位对哪位家庭成员有特定影响）

## 🛋️ 各房间风水调整方案（逐房详批）
（对每个房间给出具体、可立即执行的调整建议：

**客厅**：
- 财位（斜角财位与流年财位）的确认与催旺方式
- 沙发的最佳摆放位置与朝向（背靠实墙，面向门口/窗户的建议）
- 电视背景墙的颜色/材质建议
- 禁忌：哪些摆设会影响家庭和谐或财运

**主卧**：
- 床头朝向（精确到具体方位）
- 床的位置（不可对门、不可压梁、不可对镜）
- 衣柜摆放建议
- 卧室颜色系建议（精确到色系，如"以米白/浅灰为主色，避免大面积深红或黑色"）
- 如有孕期或备孕需求，特别注意事项

**次卧/儿童房**：
- 对孩子学习/成长最有利的床头方向
- 书桌朝向建议（文昌位的激活）
- 颜色与采光建议

**书房/工作区**：
- 最有利于思路清晰和成果产出的朝向
- 文昌位的激活方式（文昌笔/四色笔/水晶簇）

**厨房**：
- 灶台朝向与命卦的匹配度
- 厨厕相邻的化解方案（如有）
- 禁忌：不可对冰箱/不可冲门

**卫生间**：
- 如卫生间在吉位，如何化解（长明灯/铜葫芦/粗盐碗/常开抽风机）
- 卫生间潮气的化解方案

**玄关**：
- 玄关布置的黄金法则（1.2米以上屏风/避免镜子正对大门/玄关灯常亮）
- 哪些物品不宜放在玄关）

## 💰 财位激活方案 — 精确摆件清单与购买指南
（本户型的三大财位：流年财位、八宅财位、玄空财位各在何处；逐一给出激活方案：

**流年财位激活**（${new Date().getFullYear()}年八白左辅星方位）：
- 推荐摆件：天然黄水晶球（直径3英寸以上）——Amazon搜索关键词："natural citrine crystal ball sphere"，选有矿石证书的店铺，参考价格：$25-80
- 摆放高度：与心脏平齐的柜台或桌面，不可摆在地上，不可放在卫生间附近

**八宅生气位财局**：
- 推荐：貔貅一对（黄铜铸造款）——Amazon搜"brass Pi Xiu Pixiu feng shui statue pair"，参考价格：$20-60/对；Etsy有手工开光款，价格$30-120
- 摆放要点：头朝大门方向，不可对卫生间，底座稳固

**玄空旺财位**：
- 推荐：聚宝盆（铜质）内放五色天然水晶碎石——Amazon搜"feng shui wealth bowl with crystals"，参考价格：$15-50
- 附招财树：Amazon搜"feng shui money tree crystal"，高度60cm以上款，参考价格：$25-80

**财位购物总预算参考**：基础配置约$60-180，进阶配置约$180-400，以上均可在Amazon Prime免费两日达或Etsy购得，选评价4.5星以上的店铺）

## ❤️ 桃花位与人缘位激活
（本户型桃花位确认（八宅体系）与催桃花/人缘方案：
- 粉晶球：天然玫瑰石英，直径2.5英寸以上——Amazon搜"rose quartz crystal ball sphere"，参考价格：$15-50
- 牡丹挂画：宜选粉红/浅红色系，悬挂于桃花位墙面——Etsy搜"Chinese peony painting pink"，参考价格：$20-100
- 玫瑰石英水晶簇：原矿款——Amazon搜"rose quartz cluster raw"，参考价格：$20-80
- ⚠️ 重要：已婚者慎催桃花位（容易引发感情问题），建议改催人缘位（西北乾位）放黄色/金色饰品促贵人缘）

## 🌿 开运植物方案（方位+品种+养护禁忌）
（根据各方位五行属性精准推荐植物品种：
- 东/东南方位（木旺）：富贵竹（节数建议：3节催运/9节求财）、绿萝、常春藤、幸福树
- 南方位（火旺）：红色系多肉植物（如绯牡丹）、凤仙花、红掌
- 西北/西方位（金旺）：金钱树（叶片大而圆，象征聚财）、马拉巴栗（发财树）
- 北方位（水旺）：水培绿萝、铜钱草、水生植物
- 东北/西南方位（土旺）：虎皮兰（又称岳母舌，极易存活）、芦荟

❌ 禁止摆放：仙人掌/各类带刺植物（刺煞引发争吵）；已枯死或叶片泛黄的植物（必须立即处理）；藤蔓类向下垂挂超过桌面高度（压制气场）；大叶片尖形植物正对卧室床位）

## 🪑 家具材质·颜色·品牌推荐（按命卦五行匹配）
（根据房屋朝向五行及主人命卦给出材质建议：

朝向五行与材质匹配：
- 南向（火）：宜深色木质/大理石台面，稳重压火；避免大量红色（过旺）
- 北向（水）：宜浅色木质/白色系，引光纳气；可用蓝色/绿色点缀
- 东/东南向（木）：宜实木家具，绿色/原木色系，充分利用木气
- 西/西北向（金）：宜白色/米白/金属框架，简洁大方
- 东北/西南向（土）：宜黄棕色/米色，厚重稳固

命卦五行对应家具选择：
- 木命（绿）：实木家具首选——橡木/白蜡木/白橡（避免冷感金属）
- 火命（红）：胡桃木/带暖色调家具/局部红色或紫色点缀
- 土命（黄）：厚重实木/黄棕色系（源氏木语VO系列或实木定制）
- 金命（白）：白色/米白/不锈钢框架现代风（宜家/造作）
- 水命（黑/蓝）：深色/深蓝/玻璃材质，流线型现代设计

品牌推荐与参考渠道（海外可购）：
- 实木性价比首选：IKEA（ikea.com）——白橡/松木系列，$150-800/件，全球有门店
- 中高端实木：Article（article.com）——北美白橡/胡桃木，$300-2000/件，送货到家
- 全屋定制：IKEA PAX定制衣柜系统，可按指定尺寸/颜色定制，预算$500-3000
- 轻奢现代：West Elm（westelm.com）——有机现代风格，$200-3000/件
- 风水专属家居：Amazon搜"feng shui furniture [木命/火命/土命/金命/水命对应颜色]"可找到专属配色系列）

## 🔮 镇宅化煞完整方案（逐项分析，具体物品清单）
（根据户型常见问题，逐项给出化解方案：
- **尖角煞/刀煞**（邻屋屋角正对窗/门）：泰山石敢当石碑（置于煞气来向窗台），参考价20-80元；或大叶圆形植物（如巴西木/幸福树）阻挡视线
- **病符星位（二黑）**：铜葫芦（黄铜铸造，口朝下），参考价30-150元，挂于该方位墙上；长期点檀香/藏香（每日1支，早晨点）
- **五黄廉贞（最凶煞）**：${new Date().getFullYear()}年五黄落位的方位禁止动土/维修，放六铜钱串（6枚清朝铜钱串，参考价20-50元）镇压
- **穿堂风（前后门正对）**：玄关处立1.2米以上屏风（任何材质均可），参考价200-1500元；或在正对位置悬挂流苏/珠帘分气
- **面对楼梯/电梯**：门上方外侧挂凸面八卦镜（直径15cm以上），参考价30-100元
- **镜子对床**：必须遮盖（可用布帘）或移位，是卧室最大禁忌之一
- **卫生间在吉位中央**：长明灯（红灯泡，24小时亮）+铜葫芦+抽风机常开，三件套缺一不可
- **厨厕相邻**：中间隔断处挂五帝钱串（五枚古铜钱，参考价15-50元），橱柜上方放粗盐碗（每月换一次粗盐））

## 📅 择吉激活方案 — ${new Date().getFullYear()}年最佳行动时间表
（为本户型提供${new Date().getFullYear()}年的行动时间窗口：
- **最佳入住/动工月份**（避开五黄二黑当令月份，选吉星旺月）：具体说明哪几个月最适合搬家/装修/摆放化煞物品
- **催财开运的黄金日期**：${new Date().getFullYear()}年的财星入位日（具体到月份范围），这些日子在财位摆放开光物品效果最强
- **催桃花/人缘的最佳时机**：春季为主，具体月份
- **化煞禁忌月份**：哪几个月五黄/二黑流月叠加，这些月份绝对不要动土装修、不要搬家
- **重大决策最佳时间**：${new Date().getFullYear()}年内哪几个月的能量最适合签合同/创业/换工作）

## 🛒 开运采购完整清单（按优先级+预算分层）
（汇总本户型所有建议购买的物品，清晰分层：

**【第一优先级 — 化煞护宅（预算：100-500元）】**
1. [具体物品，摆放位置，购买渠道关键词，参考价格区间]
2. [同上格式]
3. [同上格式]

**【第二优先级 — 催财旺运（预算：200-800元）】**
1. [具体物品，摆放位置，购买渠道关键词，参考价格区间]
2. [同上格式]
3. [同上格式]

**【第三优先级 — 锦上添花（预算：100-500元）】**
1. [具体物品，摆放位置，购买渠道关键词，参考价格区间]

**购买注意事项（海外华人专属）**：
- Amazon购买风水摆件：选评价4.5星以上、评价数量100+的商品；认准标注"natural"/"genuine"的水晶摆件
- Etsy有大量手工开光风水摆件，品质更高但价格较贵，适合送礼
- 植物推荐去本地Home Depot/Lowe's/Trader Joe's购买，可当场检查叶片健康状况
- 避免购买明显廉价塑料仿铜或合成水晶制品）

## 💌 大师私语 — 只对您说的心里话
（这最后一段完全针对这套房子和这位业主，不是通用结尾：
- 看完这套房子的整体格局，我最想告诉您的一件事——它可能是一个您意想不到的优势，也可能是一个需要认真对待的注意事项
- 对于您提到的问题（${question || '综合风水'}），我的具体看法和最重要的一条行动建议
- 风水是基础，心态和行动才是让气场真正转动的钥匙——一句温暖的话送给您
- 祝福语收尾（具体的、针对这套房子和业主情况的祝福，不用通用套话）)`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ type: 'meta' })}\n\n`);

    // 构建消息数组，如有户型图则加入图片
    let messages;
    if (floorPlanBase64) {
      messages = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${floorPlanBase64}` } },
            { type: 'text', text: userMsg }
          ]
        }
      ];
    } else {
      messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }];
    }

    const streamBody = await deepseekStream(messages, { maxTokens: fullAccess ? 16000 : 3000, timeout: 300000 });
    const reader = streamBody.getReader();
    const decoder = new TextDecoder();
    let fullText = '', buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') continue;
        try { const json = JSON.parse(raw); const c = json.choices?.[0]?.delta?.content || ''; if (c) { fullText += c; res.write(`data: ${JSON.stringify({ type: 'chunk', content: c })}\n\n`); } } catch(e) {}
      }
    }
    insertReading.run('fengshui', JSON.stringify({ houseDirection, floor, rooms, address, question, members: members || [] }), fullText, req.userId);
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch(err) {
    console.error('[FENGSHUI-STREAM ERR]', err.message);
    try { res.write(`data: ${JSON.stringify({ type: 'error', message: '生成失败' })}\n\n`); res.end(); } catch(e) {}
  }
});

// ══════════════════════════════════════════
// POST /api/yinzhai/stream — 阴宅风水流式
// ══════════════════════════════════════════
router.post('/yinzhai/stream', rateLimitMiddleware, async (req, res) => {
  try {
    const { city, relation, masterBirthYear, masterGender, masterMingua, concerns, question, candidates } = req.body;
    if (!candidates || candidates.length < 2) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: '请至少提供2个候选地点' });
    }

    // Build candidates description
    const candidatesText = candidates.map((c, i) =>
      `【候选${i+1}】${c.name}\n地址：${c.address || '未提供'}\n朝向：${c.facing || '未知'}\n地势：${c.terrain || '未知'}\n靠山：${c.backing || '未知'}\n前方：${c.front || '未知'}\n${c.notes ? '备注：' + c.notes : ''}`
    ).join('\n\n');

    const mingua = masterMingua || calcMinguaServer(masterBirthYear, masterGender === 'M');
    const minguaGroupStr = [1,3,4,9].includes(mingua) ? '东四命' : '西四命';

    // 付费门：阴宅全程付费，无免费预览
    const yinzhaiAccess = hasFullAccess(req, ['yinzhai', 'member_monthly', 'member_yearly', 'member_quarterly', 'member_3year', 'member_daily', 'member_lifetime']);
    if (!yinzhaiAccess) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(402).json({ error: 'payment_required', message: '阴宅风水为高端专属服务，需付费后方可使用', product: 'yinzhai' });
    }

    const systemPrompt = `你是精研阴宅堪舆四十年的地理大师，师承杨公风水正脉，深谙"龙、穴、砂、水、向"地理五诀，实地勘察墓地超过八千处。你的阴宅报告被业界誉为"最有人情味的专业分析"——因为你深知，每一位前来咨询的家属都带着对逝者的深情和对家族的责任。

【你的核心专业能力】
- 龙脉格局：识别来龙去脉，判断地脉是否有生气聚集
- 穴位吉凶：判断穴场是否藏风聚气、前有案山、后有靠山
- 砂水配合：四兽（青龙/白虎/朱雀/玄武）格局分析，水口收纳判断
- 朝向与命卦：逝者关联在世者命卦，判断最利子孙的朝向
- 子孙运势：阴宅影响后代三代，具体预判财丁贵三个维度

【输出铁律】
1. 字数要求：完整分析8000字以上，每个候选地至少1200字详细分析
2. 情感基调：温暖、稳重、充满人文关怀；不用恐吓性语言，不说"此地大凶"之类绝对化判断
3. 专业格局：每个候选地必须逐一评分，维度包括：龙脉/穴场/砂水/朝向/交通便利/日照/配套
4. 最终推荐必须斩钉截铁，给出明确答案，不可含糊说"视情况而定"
5. 安葬日期必须给出具体时间范围（精确到季节或月份）
6. 报告结尾用一段完全个性化的"大师心语"，真诚地告诉家属：您做了最好的安排
简体中文。`;

    const userMsg = `城市/地区：${city || '未提供'}
逝者与委托人关系：${relation || '长辈'}
委托人（户主）生年：${masterBirthYear || '未提供'}年 · ${masterGender === 'M' ? '男' : '女'} · 命卦${mingua}（${minguaGroupStr}）
家属最关心的方面：${(concerns || []).join('、') || '后代综合运势'}
其他顾虑或特殊情况：${question || '无'}

【候选墓地信息】
${candidatesText}

请按以下结构输出完整阴宅风水分析报告（要求8000字以上，每节详尽展开）：

## 🏔️ 开篇 — 写给您的一封信
（以第一人称，温暖地写给这位家属。理解他/她此时的心情——既有悲伤，又有对逝者的责任感。告诉他：好的阴宅选址是给逝者最后的礼物，也是给家族最深远的祝福。200字以内，真诚，不煽情。）

## ⛰️ 阴宅风水总论 — 为什么选址决定三代
（从堪舆学角度，深入浅出解释：
- 阴宅与阳宅风水的根本区别（阴宅影响气场积累，周期以十年计）
- "龙、穴、砂、水、向"五诀的含义，用非专业人士能理解的语言解释
- 为什么同一个公墓内不同位置差异可以非常大
- 好的阴宅会对哪些方面产生正面影响（财运/健康/考运/婚姻）
- 500字以上）

## 🔍 各候选地详细分析（每地1200字以上）
${candidates.map((c, i) => `
### 【候选${i+1}】${c.name}

**① 龙脉格局**
（来龙方向、地脉强弱、是否有生气在此聚集，满分25分，给出得分及详细理由）

**② 穴场吉凶**
（穴位是否藏风聚气、前朱雀是否开阔、后玄武是否有靠、左青龙右白虎是否护卫到位，满分25分，给出得分及详细理由）

**③ 砂水配合**
（周边地形起伏、水流方向、水口收纳情况，满分20分，给出得分及详细理由）

**④ 朝向与命卦匹配**
（此地的朝向与委托人命卦${mingua}的匹配度，对在世子孙的影响，满分20分）

**⑤ 实际条件评估**
（交通便利度、日照情况、维护便利性、周边环境清洁度，满分10分）

**⑥ 综合评分与总结**
（满分100分，给出总分，一段综合评价，这个地方的最大优势和最需注意的问题）`).join('\n')}

## 📊 综合对比评分表
（制作一个清晰的对比表格，横轴为各维度，纵轴为各候选地，每格填分数，最后一行为总分排名）

## 🏆 最终推荐
（明确、斩钉截铁地推荐哪个候选地，并给出三条最有说服力的理由。同时说明如果选择其他地点，需要特别注意什么。400字以上）

## 👨‍👩‍👧‍👦 子孙运势预测（按推荐地点）
（根据推荐地点的格局和朝向，具体预测对子孙后代的影响：
- 财运维度：对家族财富积累的影响（10-15年内）
- 健康维度：利哪些健康方面，需要注意预防哪些
- 贵人/考运：对子孙求学、升迁、社会地位的影响
- 婚姻/人丁：对家族人丁繁盛的影响
- 每个维度100字以上，具体有依据）

## 🕯️ 安葬时间与仪式建议
（给出：
- 推荐的安葬季节/月份（${new Date().getFullYear()}-${new Date().getFullYear()+1}年内），说明为何此时间段最佳
- 安葬时辰的选择原则（生辰相冲者需回避）
- 仪式流程建议（传统华人仪式的关键步骤，尊重家属宗教信仰）
- 安葬后的定期祭扫建议（频率、祭品、禁忌）
- 墓碑朝向与刻字建议
- 400字以上）

## 💌 大师心语 — 只写给您
（完全针对这位家属的情况，不使用任何通用套话：
- 我看完这几个候选地，最想告诉您的一件事
- 对于您最关心的（${(concerns || []).join('、') || '家族运势'}），我的真实判断
- 您已经做到了最好——为逝者认真寻找安息之所，这份心意本身就是最大的福报
- 一句真诚的祝福，针对这个家庭的具体情况）`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ type: 'meta' })}\n\n`);

    // If any candidate has an image, include it in the first candidate's message
    const hasImages = candidates.some(c => c.imageBase64);
    let messages;
    if (hasImages) {
      const imageContent = candidates
        .filter(c => c.imageBase64)
        .slice(0, 3) // limit to 3 images
        .map(c => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${c.imageBase64}` } }));
      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: [...imageContent, { type: 'text', text: userMsg }] }
      ];
    } else {
      messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }];
    }

    const streamBody = await deepseekStream(messages, { maxTokens: 16000, timeout: 300000 });
    const reader = streamBody.getReader();
    const decoder = new TextDecoder();
    let fullText = '', buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') continue;
        try { const json = JSON.parse(raw); const c = json.choices?.[0]?.delta?.content || ''; if (c) { fullText += c; res.write(`data: ${JSON.stringify({ type: 'chunk', content: c })}\n\n`); } } catch(e) {}
      }
    }
    insertReading.run('yinzhai', JSON.stringify({ city, candidates: candidates.map(c=>c.name) }), fullText, req.userId);
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch(err) {
    console.error('[YINZHAI-STREAM ERR]', err.message);
    try { res.write(`data: ${JSON.stringify({ type: 'error', message: '生成失败' })}\n\n`); res.end(); } catch(e) {}
  }
});

function calcMinguaServer(year, isMale) {
  if (!year) return 2;
  var n = parseInt(year);
  while (n >= 10) { var s = 0, tmp = n; while (tmp > 0) { s += tmp % 10; tmp = Math.floor(tmp/10); } n = s; }
  var q = isMale ? (10 - n) : (n + 5);
  if (q === 5) q = isMale ? 2 : 8;
  if (q > 9) q -= 9;
  return q;
}

// ══════════════════════════════════════════
// POST /api/fengshui — AI风水评测
// ══════════════════════════════════════════
router.post('/fengshui', rateLimitMiddleware, async (req, res) => {
  try {
    const { houseDirection, floor, rooms, occupants, address, question } = req.body;
    if (!houseDirection) return res.status(400).json({ error: '请提供房屋朝向' });
    const messages = [
      { role: 'system', content: '你是一位精通八宅风水与玄空飞星的风水大师，从业30年。语气亲切专业，给出具体可操作的建议。' },
      { role: 'user', content: '房屋朝向：' + (houseDirection || '') + '\n楼层：' + (floor || '未提供') + '\n房间布局：' + (rooms || '未提供') + '\n居住成员：' + (occupants || '未提供') + '\n地址：' + (address || '未提供') + '\n用户问题：' + (question || '请综合分析房屋风水') + '\n\n请按以下结构详细分析（要求3000+字）：\n1. 🏠 房屋格局总评\n2. 🧭 八宅吉凶位分析（每个方位逐一分析）\n3. 🛏️ 各房间风水建议（卧室/客厅/厨房/书房/卫生间）\n4. 💰 财位分析及催财布局\n5. ❤️ 桃花位/人缘位布局\n6. 🏃 健康位分析\n7. 🪴 化解与开运建议（植物/摆件/颜色）\n8. 📐 户型改造建议\n9. 🎯 一句话总结' }
    ];
    var _gl = gateMessages(req, ['bazi','hehun','ziwei','xingming','astrology','fengshui','liuyao','qimen','daliuren','lingqian','pastlife','风水','六爻','奇门','大六壬','灵签','前世','紫微','合婚','姓名','占星'], messages, 12288);
    const analysis = await deepseekChat(_gl.messages, { maxTokens: _gl.maxTokens });
    res.json({ analysis });
  } catch (err) {
    console.error('[FENGSHUI ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试' });
  }
});

// ══════════════════════════════════════════
// POST /api/geo-fortune — 地域命理分析
// ══════════════════════════════════════════
router.post('/geo-fortune', rateLimitMiddleware, async (req, res) => {
  try {
    const { latitude, longitude, birthYear, birthMonth, birthDay, gender } = req.body;
    if (latitude === undefined || longitude === undefined) return res.status(400).json({ error: '请提供经纬度' });
    var latDir = latitude >= 0 ? '北半球' : '南半球';
    var longDir = longitude >= 0 ? '东经' : '西经';
    var regionElement = '土';
    if (longitude > 0 && longitude < 60) regionElement = '土';
    else if (longitude >= 60 && longitude < 120) regionElement = '木';
    else if (longitude >= -60 && longitude < 0) regionElement = '金';
    else regionElement = '水';
    if (Math.abs(latitude) > 45) regionElement = '水';
    else if (Math.abs(latitude) < 15) regionElement = '火';

    const messages = [
      { role: 'system', content: '你是一位结合传统风水与现代地理学的命理师。擅长分析不同地域对个人运势的影响。' },
      { role: 'user', content: '用户位置：纬度 ' + latitude + '（' + latDir + '），经度 ' + longitude + '（' + longDir + '）\n地域五行属性：' + regionElement + '\n出生信息：' + (birthYear ? birthYear + '年' : '') + (birthMonth ? birthMonth + '月' : '') + (birthDay ? birthDay + '日' : '') + '\n性别：' + (gender || '未提供') + '\n\n请分析：\n1. 🌍 此地的地理能量特点\n2. 🧭 在此地居住/工作的五行影响\n3. 💰 此地财运分析\n4. ❤️ 此地感情/人际运势\n5. 🏃 此地健康提醒\n6. 🎯 在此地发展的建议\n7. 📍 更适合此人的其他方位建议' }
    ];
    var _gl = gateMessages(req, ['bazi','hehun','ziwei','xingming','astrology','fengshui','liuyao','qimen','daliuren','lingqian','pastlife','风水','六爻','奇门','大六壬','灵签','前世','紫微','合婚','姓名','占星'], messages, 8192);
    const analysis = await deepseekChat(_gl.messages, { maxTokens: _gl.maxTokens });
    res.json({ analysis, location: { lat: latitude, lng: longitude, regionElement: regionElement } });
  } catch (err) {
    console.error('[GEO ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试' });
  }
});

// ══════════════════════════════════════════
// POST /api/xingming — 姓名学分析
// ══════════════════════════════════════════
router.post('/xingming', rateLimitMiddleware, async (req, res) => {
  try {
    const { surname, givenName, zodiac, gender } = req.body;
    if (!surname || !givenName) return res.status(400).json({ error: '请提供姓氏和名字' });
    const messages = buildReadingPrompt(
      '你是一位精通姓名学的命理大师，深谙五格剖象法（天格、人格、地格、外格、总格）与生肖喜忌之道，从业三十余年，为成千上万人改过名。你的分析专业深刻——笔画数理、五行补益、生肖适配，面面俱到。你的语气亲切实在，用大白话解释深奥姓名学原理，不故弄玄虚。每个建议都给出具体的新名字选项，让人能照着做。',
      `用户姓名：${surname}${givenName}
姓氏：${surname}，名字：${givenName}，生肖：${zodiac || '未提供'}，性别：${gender === 'male' ? '男' : gender === 'female' ? '女' : '未提供'}

请按以下结构出具一份完整的姓名学分析报告，总字数不少于3000字：
## 一、📊 五格数理分析（600-800字）
## 二、🦊 生肖喜忌分析（400-600字）
## 三、🔥 五行补益分析（300-400字）
## 四、🎯 姓名综合评分（100-200字）
## 五、📈 姓名对各方面运势的影响（500-600字）
## 六、💡 改名建议（600-800字）
## 七、📝 姓名能量提升小技巧（200-300字）
## 八、💌 姓名学师的叮嘱（100-200字）`
    );
    var _g = gateMessages(req, ['bazi','hehun','ziwei','xingming','astrology','八字','合婚','紫微','姓名','占星','星盘'], messages);
    const result = await deepseekChat(_g.messages, { maxTokens: _g.maxTokens });
    insertReading.run('xingming', JSON.stringify(req.body), result, req.userId);
    var ctxId = saveQaContext('xingming', req.body, result);
    res.json({ reading: result, contextId: ctxId });
  } catch (err) {
    console.error('[XINGMING ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试', detail: err.message });
  }
});

// ══════════════════════════════════════════
// POST /api/astrology — 西方占星
// ══════════════════════════════════════════
router.post('/astrology', rateLimitMiddleware, async (req, res) => {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, birthMinute, latitude, longitude, gender } = req.body;
    if (!birthYear || !birthMonth || !birthDay) return res.status(400).json({ error: '请提供出生日期' });

    const chart = astrology.calcAstrology(
      parseInt(birthYear), parseInt(birthMonth), parseInt(birthDay),
      birthHour !== undefined ? parseInt(birthHour) : undefined,
      birthMinute !== undefined ? parseInt(birthMinute) : undefined,
      latitude !== undefined ? parseFloat(latitude) : 40.0,
      longitude !== undefined ? parseFloat(longitude) : 116.0
    );

    const chartSummary = `【星盘基本数据】
出生时间：${birthYear}/${birthMonth}/${birthDay} ${birthHour !== undefined ? birthHour + ':' + (birthMinute || '00') : '时间不详'}
性别：${gender === 'male' ? '男 Male' : gender === 'female' ? '女 Female' : '未知'}
经纬度：${latitude || '40°N'}, ${longitude || '116°E'}

【三大重要星座】
太阳 Sun：${chart.sun.signZh}(${chart.sun.signEn}) ${chart.sun.degree}°
月亮 Moon：${chart.moon.signZh}(${chart.moon.signEn}) ${chart.moon.degree}°
上升 Ascendant：${chart.rising.signZh}(${chart.rising.signEn}) ${chart.rising.degree}°

【行星落座】
水星 Mercury：${chart.planets.mercury.signZh}(${chart.planets.mercury.signEn}) ${chart.planets.mercury.degree}°
金星 Venus：${chart.planets.venus.signZh}(${chart.planets.venus.signEn}) ${chart.planets.venus.degree}°
火星 Mars：${chart.planets.mars.signZh}(${chart.planets.mars.signEn}) ${chart.planets.mars.degree}°
木星 Jupiter：${chart.planets.jupiter.signZh}(${chart.planets.jupiter.signEn}) ${chart.planets.jupiter.degree}°
土星 Saturn：${chart.planets.saturn.signZh}(${chart.planets.saturn.signEn}) ${chart.planets.saturn.degree}°

【元素分布】
${chart.elements.map(e => e.name + ': ' + e.percentage + '% (' + e.count + '个)').join('\n')}

【模式分布】
${chart.modalities.map(m => m.name + ': ' + m.percentage + '% (' + m.count + '个)').join('\n')}

【月亮相位】${chart.moonPhase.phase} (照明度 ${chart.moonPhase.illumination})

【宫位系统】（基于上升点的等宫制）
${chart.houses.map(h => '第' + h.number + '宫: ' + h.signZh + '(' + h.signEn + ')').join('\n')}

【星盘概要】${chart.summary.bigThree} · 主导元素: ${chart.summary.dominantElement} · 主导模式: ${chart.summary.dominantModality}`;

    const messages = [
      { role: 'system', content: '你是一位精通西方占星学的资深占星师，从业20年，为上千人解读过本命星盘。你融合古典占星与现代心理占星，分析深刻且温暖。你的语言：70%中文 + 30%英文关键术语（星座名、行星名用英文给出，其余用中文解释），让用户既能看懂又能学到占星知识。每次解读详细、具体、有深度。' },
      { role: 'user', content: `请根据以下星盘数据，为用户出具一份详细的西方占星解读报告。\n\n${chartSummary}\n\n请按以下结构展开详细的星盘解读（总字数4000-6000字）：\n## 一、星盘格局总览（300-400字）\n## 二、三大支柱详解（500-700字）\n## 三、行星落座详析（800-1000字）\n## 四、元素与模式分析（300-400字）\n## 五、宫位简析（400-500字）\n## 六、月亮相位（200-300字）\n## 七、主要人生领域分析（600-800字）\n## 八、成长方向与年度提醒（300-400字）\n## 九、占星师的寄语（100-200字）` }
    ];

    var _g = gateMessages(req, ['bazi','hehun','ziwei','xingming','astrology','八字','合婚','紫微','姓名','占星','星盘'], messages);
    const result = await deepseekChat(_g.messages, { maxTokens: _g.maxTokens });
    insertReading.run('astrology', JSON.stringify(req.body), result, req.userId);
    var ctxId = saveQaContext('astrology', req.body, result);

    res.json({
      chart: {
        sun: chart.sun, moon: chart.moon, rising: chart.rising,
        planets: chart.planets, elements: chart.elements, modalities: chart.modalities,
        moonPhase: chart.moonPhase, houses: chart.houses, summary: chart.summary,
        bigThree: chart.summary.bigThree
      },
      reading: result, contextId: ctxId
    });
  } catch (err) {
    console.error('[ASTROLOGY ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试', detail: err.message });
  }
});

// ══════════════════════════════════════════
// POST /api/liuyao — 六爻占卜
// ══════════════════════════════════════════
router.post('/liuyao', rateLimitMiddleware, async (req, res) => {
  try {
    const { question, topic } = req.body;
    if (!question) return res.status(400).json({ error: '请提供你要问的事情' });
    var coins = [];
    for (var i = 0; i < 6; i++) {
      var val = Math.floor(Math.random() * 2) + Math.floor(Math.random() * 2) + Math.floor(Math.random() * 2);
      coins.push(val);
    }
    var guaYao = coins.map(c => c >= 2 ? '---' : '- -');
    const messages = [
      { role: 'system', content: '你是一位精通《周易》六爻占卜的民间大师，擅长用通俗语言解读卦象。语气亲切、具体、实用。' },
      { role: 'user', content: `用户问题：${question}\n主题：${topic || '综合'}\n起卦结果（由系统六爻生成）：\n${guaYao[5]}  (上九)\n${guaYao[4]}  (九五)\n${guaYao[3]}  (九四)\n${guaYao[2]}  (九三)\n${guaYao[1]}  (九二)\n${guaYao[0]}  (初九)\n\n请按结构详细解读（3000+字）：\n1. 🔮 本卦解读\n2. 📖 爻辞详解\n3. 🎯 针对问题的具体指引\n4. ⏰ 应期判断\n5. 💡 行动建议（3条）\n6. ⚠️ 注意事项` }
    ];
    var _gl = gateMessages(req, ['bazi','hehun','ziwei','xingming','astrology','fengshui','liuyao','qimen','daliuren','lingqian','pastlife','风水','六爻','奇门','大六壬','灵签','前世','紫微','合婚','姓名','占星'], messages, 12288);
    const reading = await deepseekChat(_gl.messages, { maxTokens: _gl.maxTokens });
    var ctxId = saveQaContext('liuyao', req.body, reading);
    res.json({ reading, contextId: ctxId, hexagram: guaYao });
  } catch (err) {
    console.error('[LIUYAO ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试' });
  }
});

// ══════════════════════════════════════════
// POST /api/lingqian — 求神灵签
// ══════════════════════════════════════════
router.post('/lingqian', rateLimitMiddleware, async (req, res) => {
  try {
    const { question, temple } = req.body;
    var qianNum = Math.floor(Math.random() * 100) + 1;
    var qianType = qianNum <= 15 ? '上上签' : qianNum <= 35 ? '上签' : qianNum <= 65 ? '中签' : qianNum <= 85 ? '下签' : '下下签';
    const messages = [
      { role: 'system', content: '你是一位在名山古寺修行多年的解签僧人。解签时语气温和、充满智慧，既点明签文深意又给人希望。' },
      { role: 'user', content: `求签地点：${temple || '善缘灵境'}\n用户问题：${question || '请指点迷津'}\n抽得签号：第${qianNum}签（${qianType}）\n\n请生成：\n1. 📜 签诗（四句七言古诗，原创）\n2. 🏮 解签（签文含义，300字左右）\n3. 🎯 对你的启示\n4. 💡 行动建议\n5. 🙏 祈福方法` }
    ];
    var _gl = gateMessages(req, ['bazi','hehun','ziwei','xingming','astrology','fengshui','liuyao','qimen','daliuren','lingqian','pastlife','风水','六爻','奇门','大六壬','灵签','前世','紫微','合婚','姓名','占星'], messages, 8192);
    const reading = await deepseekChat(_gl.messages, { maxTokens: _gl.maxTokens });
    var ctxId = saveQaContext('lingqian', req.body, reading);
    res.json({ reading, contextId: ctxId, qian: { number: qianNum, type: qianType } });
  } catch (err) {
    console.error('[LINGQIAN ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试' });
  }
});

// ══════════════════════════════════════════
// POST /api/daliuren — 大六壬预测
// ══════════════════════════════════════════
router.post('/daliuren', rateLimitMiddleware, async (req, res) => {
  try {
    const { question, birthYear, gender } = req.body;
    if (!question) return res.status(400).json({ error: '请提供你要问的事情' });
    var lessonNames = ['元首课','重审课','涉害课','遥克课','昴星课','伏吟课','返吟课','别责课','八专课','三光课','三阳课','三奇课','六仪课','天赦课','铸印课'];
    var deities = ['贵人','螣蛇','朱雀','六合','勾陈','青龙','天空','白虎','太常','玄武','太阴','天后'];
    var lesson = lessonNames[Math.floor(Math.random() * lessonNames.length)];
    var randomDeities = [];
    for (var i = 0; i < 4; i++) randomDeities.push(deities[Math.floor(Math.random() * deities.length)]);
    const messages = [
      { role: 'system', content: '你是一位精通大六壬的玄学大师，民间尊称"六壬神断"，从业四十余年。你深谙六壬三传四课之精妙，能从课象中洞悉天机。你的语气平和笃定，引经据典但深入浅出，让求测者信服。' },
      { role: 'user', content: `用户问题：${question}\n出生年份：${birthYear || '未提供'}\n性别：${gender === 'male' ? '男' : gender === 'female' ? '女' : '未提供'}\n\n起课结果（系统随机）：\n课名：${lesson}\n课将：${randomDeities.join('、')}\n\n请按以下结构详细解读（3000+字）：\n1. 📜 课名解读\n2. 🏮 课体传象（三传四课分析）\n3. 🎯 针对问题的具体断语\n4. ⏰ 应期判断\n5. 💡 行动建议（3条）\n6. ⚠️ 注意事项与化解方法` }
    ];
    var _gl = gateMessages(req, ['bazi','hehun','ziwei','xingming','astrology','fengshui','liuyao','qimen','daliuren','lingqian','pastlife','风水','六爻','奇门','大六壬','灵签','前世','紫微','合婚','姓名','占星'], messages, 12288);
    const reading = await deepseekChat(_gl.messages, { maxTokens: _gl.maxTokens });
    var ctxId = saveQaContext('daliuren', req.body, reading);
    res.json({ reading, contextId: ctxId, lesson: { name: lesson, gods: randomDeities } });
  } catch (err) {
    console.error('[DALIUREN ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试' });
  }
});

// ══════════════════════════════════════════
// POST /api/qimen — 奇门遁甲
// ══════════════════════════════════════════
router.post('/qimen', rateLimitMiddleware, async (req, res) => {
  try {
    const { question, direction, birthYear, gender } = req.body;
    if (!question) return res.status(400).json({ error: '请提供你要问的事情' });
    var eightDoors = ['休门','生门','伤门','杜门','景门','死门','惊门','开门'];
    var nineStars = ['天蓬星','天任星','天冲星','天辅星','天英星','天芮星','天柱星','天心星','天禽星'];
    var shuffledDoors = [...eightDoors].sort(() => Math.random() - 0.5);
    var shuffledStars = [...nineStars].sort(() => Math.random() - 0.5);
    var currentDoor = shuffledDoors[0], currentStar = shuffledStars[0];
    const messages = [
      { role: 'system', content: '你是一位精通奇门遁甲的高人，师承茅山道脉，精研奇门数十年。你擅长排盘布局，能从八门九星中洞察时空能量，为求测者指点迷津。你的语气沉稳、自信、有道家仙风，每个断语都有理有据。' },
      { role: 'user', content: `用户问题：${question}\n出生年份：${birthYear || '未提供'}\n性别：${gender === 'male' ? '男' : gender === 'female' ? '女' : '未提供'}\n求测方位：${direction || '未提供'}\n\n起局结果（系统随机）：\n值使门（八门）：${currentDoor}\n值符星（九星）：${currentStar}\n其余八门：${shuffledDoors.slice(1).join('、')}\n其余九星：${shuffledStars.slice(1).join('、')}\n\n请按以下结构详细解读（3000+字）：\n1. 🌐 奇门局象总评\n2. 🚪 八门分析\n3. ⭐ 九星分析\n4. 🎯 针对问题的具体局象指引\n5. ⏰ 时间窗口判断\n6. 📍 方位建议\n7. 💡 行动建议（3条）` }
    ];
    var _gl = gateMessages(req, ['bazi','hehun','ziwei','xingming','astrology','fengshui','liuyao','qimen','daliuren','lingqian','pastlife','风水','六爻','奇门','大六壬','灵签','前世','紫微','合婚','姓名','占星'], messages, 12288);
    const reading = await deepseekChat(_gl.messages, { maxTokens: _gl.maxTokens });
    var ctxId = saveQaContext('qimen', req.body, reading);
    res.json({ reading, contextId: ctxId, door: currentDoor, star: currentStar });
  } catch (err) {
    console.error('[QIMEN ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试' });
  }
});

// ══════════════════════════════════════════
// POST /api/pastlife — 前世预测
// ══════════════════════════════════════════
router.post('/pastlife', rateLimitMiddleware, async (req, res) => {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, gender, birthPlace } = req.body;
    if (!birthYear) return res.status(400).json({ error: '请提供出生信息' });
    const lan = req.headers['accept-language'] || 'zh';
    const isEn = lan.startsWith('en');
    const zi = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
    const zodiacs = ['Rat','Ox','Tiger','Rabbit','Dragon','Snake','Horse','Goat','Monkey','Rooster','Dog','Pig'];
    const currZodiac = zi[(birthYear - 4) % 12];
    const sysPrompt = isEn
      ? 'You are a mystical past-life regression guide. Generate a vivid, detailed past-life story based on the person birth data. Write in English. Be specific: time period, location, occupation, personality, appearance, key life events, and how it connects to their current life. 2000-3000 words.'
      : '你是一位通晓三世因果的灵性导师。根据用户的出生信息，回溯其前世的身份、经历和因果。语言生动、细节丰富，像在讲一个真实的故事。给出具体的前世身份（年代+地点+职业）、外貌特征、关键人生事件、以及今生与此的关联。2000-3000字。';
    const userPrompt = isEn
      ? 'Birth: ' + birthYear + '/' + (birthMonth || '?') + '/' + (birthDay || '?') + (birthHour !== undefined ? ' at ' + birthHour + ':00' : '') + ' Gender: ' + (gender || 'unknown') + ' Birthplace: ' + (birthPlace || 'unknown') + ' Chinese zodiac: ' + zodiacs[(birthYear - 4) % 12] + '\n\nTell me my past life in vivid detail.'
      : '出生：' + (birthYear || '?') + '年' + (birthMonth || '?') + '月' + (birthDay || '?') + '日' + (birthHour !== undefined ? ' ' + birthHour + '时' : '') + '\n性别：' + (gender === 'male' ? '男' : '女') + '\n出生地：' + (birthPlace || '未知') + '\n生肖：' + currZodiac + '\n\n请详细描述我的前世：我是什么人？生活在什么年代和地方？做过什么？和今生的关联是什么？';
    const messages = [{ role: 'system', content: sysPrompt }, { role: 'user', content: userPrompt }];
    var _gl = gateMessages(req, ['bazi','hehun','ziwei','xingming','astrology','fengshui','liuyao','qimen','daliuren','lingqian','pastlife','风水','六爻','奇门','大六壬','灵签','前世','紫微','合婚','姓名','占星'], messages, 8192);
    const reading = await deepseekChat(_gl.messages, { maxTokens: _gl.maxTokens });
    var ctxId = saveQaContext('pastlife', req.body, reading);
    res.json({ reading, contextId: ctxId });
  } catch (err) {
    console.error('[PASTLIFE ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试' });
  }
});

// ══════════════════════════════════════════
// POST /api/deity-guide — 求神指引
// ══════════════════════════════════════════
router.post('/deity-guide', rateLimitMiddleware, async (req, res) => {
  try {
    const { question, birthYear, gender, preference } = req.body;
    if (!question) return res.status(400).json({ error: '请说明你求什么事' });
    const messages = [
      { role: 'system', content: '你是一位深谙佛道仙三家文化的寺庙住持，为信众指点该拜哪位菩萨或仙家。语气慈悲、智慧、不迷信。' },
      { role: 'user', content: `信众所求：${question}\n出生年份：${birthYear || '未提供'}\n性别：${gender || '未提供'}\n偏好：${preference || '无特定偏好'}\n\n请详细分析（3000+字）：\n1. 🧭 最适合供奉的菩萨/仙家\n2. 📖 每位菩萨/仙家的简介和掌管领域\n3. 🙏 对应供奉方式\n4. 💰 供奉建议\n5. 🏠 在家中何处设供桌\n6. 🕐 最佳供奉时辰\n7. 📿 持诵什么经文/咒语\n8. 💌 仙家文化特别指导` }
    ];
    var _gl = gateMessages(req, ['bazi','hehun','ziwei','xingming','astrology','fengshui','liuyao','qimen','daliuren','lingqian','pastlife','风水','六爻','奇门','大六壬','灵签','前世','紫微','合婚','姓名','占星'], messages, 12288);
    const reading = await deepseekChat(_gl.messages, { maxTokens: _gl.maxTokens });
    res.json({ reading });
  } catch (err) {
    console.error('[DEITY ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试' });
  }
});

// ══════════════════════════════════════════
// POST /api/offering-plan — 供奉方案
// ══════════════════════════════════════════
router.post('/offering-plan', rateLimitMiddleware, async (req, res) => {
  try {
    const { deity, purpose, budget, duration } = req.body;
    if (!deity || !purpose) return res.status(400).json({ error: '请提供供奉对象和所求事项' });
    const messages = [
      { role: 'system', content: '你是一位寺庙供奉管理师，为信众设计最合适的供奉方案。包含实体供奉（花篮/水果/香油灯）和电子供奉。' },
      { role: 'user', content: `供奉对象：${deity}\n所求事项：${purpose}\n预算：${budget || '不限'}\n供奉时长：${duration || '7天'}\n\n请设计详细的供奉方案（3000+字）：\n一、🍎 实体供品推荐\n二、🕯️ 电子供奉方案\n三、📅 供奉日程安排\n四、💰 费用预算\n五、🙏 祈福回向文` }
    ];
    var _gl = gateMessages(req, ['bazi','hehun','ziwei','xingming','astrology','fengshui','liuyao','qimen','daliuren','lingqian','pastlife','风水','六爻','奇门','大六壬','灵签','前世','紫微','合婚','姓名','占星'], messages, 12288);
    const reading = await deepseekChat(_gl.messages, { maxTokens: _gl.maxTokens });
    res.json({ reading });
  } catch (err) {
    console.error('[OFFERING ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试' });
  }
});

// ══════════════════════════════════════════
// POST /api/zhiyuan — 高考志愿
// ══════════════════════════════════════════
router.post('/zhiyuan', rateLimitMiddleware, async (req, res) => {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, gender, score, province, subjectType, ranking } = req.body;
    if (!birthYear || !score || !province) return res.status(400).json({ error: '请提供出生信息和高考分数' });
    const sysPrompt = `你是一位精通八字命理的高考志愿规划师。根据用户的出生信息和高考分数，提供专业、城市、学校选择建议。用大白话写，不要古文。
必须包含以下章节（每个至少200字）：
1. 📜 八字命格适合行业\n2. 🔥 适合的专业方向\n3. 🌆 旺你的城市\n4. 🏫 可报考的学校建议\n5. 💰 毕业薪资展望\n6. 🎯 总结建议\n总字数4000-6000字。`;
    const userPrompt = `出生：${birthYear}年${birthMonth||'?'}月${birthDay||'?'}日${birthHour!==undefined?birthHour+'时':''}
性别：${gender === "male" ? "男" : "女"}
高考分数：${score}分（${province}省）
科目：${subjectType || "理科"}
全省排名：${ranking || "未知"}
请给出高考志愿填报建议。`;
    const messages = [{ role: 'system', content: sysPrompt }, { role: 'user', content: userPrompt }];
    var _gl = gateMessages(req, ['bazi','hehun','ziwei','xingming','astrology','fengshui','liuyao','qimen','daliuren','lingqian','pastlife','风水','六爻','奇门','大六壬','灵签','前世','紫微','合婚','姓名','占星'], messages, 8192);
    const reading = await deepseekChat(_gl.messages, { maxTokens: _gl.maxTokens });
    var ctxId = saveQaContext('zhiyuan', req.body, reading);
    res.json({ reading, contextId: ctxId });
  } catch (err) {
    console.error('[ZHIYUAN ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试' });
  }
});

// ══════════════════════════════════════════
// POST /api/bazi/recent-input
// ══════════════════════════════════════════
router.post('/bazi/recent-input', (req, res) => {
  try {
    var auth = req.headers['authorization'] || '';
    var token = auth.indexOf('Bearer ') === 0 ? auth.slice(7) : (req.body && req.body.token || '');
    var t = getToken ? getToken.get(token) : null;
    var userId = t ? t.user_id : null;
    if (!userId) return res.json({ input: null });
    const { _M } = require('../lib/store');
    var recent = _M.readings.filter(r => r.user_id === userId && r.type === 'bazi');
    recent.sort((a, b) => (b.id || 0) - (a.id || 0));
    if (recent.length === 0) return res.json({ input: null });
    var last = recent[0];
    var inp = typeof last.input === 'string' ? JSON.parse(last.input) : last.input;
    res.json({ input: { birthYear: inp.birthYear, birthMonth: inp.birthMonth, birthDay: inp.birthDay, birthHour: inp.birthHour, gender: inp.gender, name: inp.name || '' } });
  } catch (err) {
    console.error('[RECENT INPUT ERR]', err.message);
    res.json({ input: null });
  }
});

// ══════════════════════════════════════════
// GET /api/context/:id — QA 上下文
// ══════════════════════════════════════════
router.get('/context/:id', (req, res) => {
  var ctx = qaContext[req.params.id];
  if (!ctx) return res.status(404).json({ error: '上下文不存在' });
  res.json({ endpoint: ctx.endpoint });
});

// ══════════════════════════════════════════
// POST /api/ask-followup — 追问命理师
// ══════════════════════════════════════════
router.post('/ask-followup', rateLimitMiddleware, async (req, res) => {
  try {
    const { contextId, question } = req.body;
    if (!contextId || !question) return res.status(400).json({ error: '缺少上下文ID或问题' });
    const ctx = qaContext[contextId];
    if (!ctx) return res.status(404).json({ error: '上下文已过期，请重新生成报告' });
    const messages = [
      { role: 'system', content: '你是一位善缘命理平台的资深命理师。用户刚刚看了他们的命理报告，现在有后续问题要问你。\n请基于以下报告内容回答用户的问题。语气亲切、专业、具体，给出时间点和建议。\n\n之前的报告内容：\n' + ctx.reading.slice(0, 3000) },
      { role: 'user', content: question }
    ];
    const answer = await deepseekChat(messages, { maxTokens: 2048 });
    res.json({ answer });
  } catch (err) {
    console.error('[QA ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试' });
  }
});

// ══════════════════════════════════════════
// GET /api/daily-teaser — 明日运势悬念预告
// ══════════════════════════════════════════
router.get('/daily-teaser', rateLimitMiddleware, async (req, res) => {
  try {
    const { y, m, d } = req.query;
    const dateStr = (y || '') + '年' + (m || '') + '月' + (d || '') + '日';
    const messages = [
      { role: 'system', content: '你是命理助手，根据日期给出25字以内的运势预告，语气神秘有悬念，结尾留钩子让人明天来看完整版。不要说具体建议，只给一句悬念式预告。' },
      { role: 'user', content: dateStr + '的运势预告，25字以内，只需一句话。' }
    ];
    const teaser = await deepseekChat(messages, { maxTokens: 60 });
    res.json({ teaser: teaser.trim().slice(0, 50) });
  } catch (e) {
    res.json({ teaser: '明日天机已定，来看看你的运势将如何转折…' });
  }
});

// ══════════════════════════════════════════
// 多轨命理扩展（Phase 1）
// ══════════════════════════════════════════

// 辅助：Jyotish 计算
function calculateJyotish(dob, tob) {
  try {
    const d = new Date(dob);
    const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
    const [h, min] = tob.split(':').map(Number);

    // 简化Julian Day计算
    const a = Math.floor((14 - m) / 12);
    const yy = y + 4800 - a;
    const mm = m + 12 * a - 3;
    const jd = day + Math.floor((153*mm + 2) / 5) + 365*yy + Math.floor(yy/4) - Math.floor(yy/100) + Math.floor(yy/400) - 32045 + (h + min/60) / 24;

    // Rashi（月亮星座）、Nakshatra（27月宿）近似计算
    const moonLon = ((jd - 2451545) * 13.2 % 360 + 360) % 360;  // 月亮黄经近似
    const rashi = Math.floor((moonLon + 23.85) / 30);  // Lahiri ayanamsa修正
    const nakshatra = Math.floor((moonLon % 360) / 13.33);

    // Lagna（上升点）需要精确时间和地点，这里返回近似值
    const lagna = Math.floor((jd * 360 % 360) / 30);

    return { jd: jd.toFixed(2), rashi: Math.min(rashi, 11), nakshatra: Math.min(nakshatra, 26), lagna };
  } catch (e) {
    return { jd: 0, rashi: 0, nakshatra: 0, lagna: 0 };
  }
}

// 辅助：Tibetan 计算
function calculateTibetan(birthYear) {
  const zodiacNames = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Sheep', 'Monkey', 'Rooster', 'Dog', 'Pig'];
  const zodiacNamesCN = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
  const elementNames = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];
  const elementNamesCN = ['木', '火', '土', '金', '水'];
  const parkhaNames = ['Kham', 'Zin', 'Gin', 'Zon', 'Kön', 'Da', 'Khen', 'Li'];
  // Fix: use Heavenly Stem cycle (甲=0..癸=9), each element spans 2 stems
  const chineseZodiacIdx = ((birthYear - 4) % 12 + 12) % 12;
  const stemIdx = ((birthYear - 4) % 10 + 10) % 10;
  const elementIdx = Math.floor(stemIdx / 2);
  // Mewa: descend from 9 starting 1901=9, counting down and wrapping
  const mewaNum = ((9 - (birthYear - 1901) % 9) % 9) || 9;
  const parkhaIdx = ((birthYear - 1) % 8 + 8) % 8;
  const parkhaName = parkhaNames[parkhaIdx];
  const lungta = ((birthYear % 60) % 15) > 7 ? 'High' : 'Low';

  return {
    zodiac: zodiacNames[chineseZodiacIdx],
    zodiacCN: zodiacNamesCN[chineseZodiacIdx],
    element: elementNames[elementIdx],
    elementCN: elementNamesCN[elementIdx],
    mewaNum,
    parkhaIdx,
    parkha: parkhaName,
    lungta,
    year: birthYear
  };
}

// 辅助：Maya Tzolkin 计算
function getTzolkin(year, month, day) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  const jd = day + Math.floor((153*m + 2) / 5) + 365*y + Math.floor(y/4) - Math.floor(y/100) + Math.floor(y/400) - 32045;
  const kin = ((jd - 584283) % 260 + 260) % 260;
  const daySignIdx = kin % 20;
  const tone = (kin % 13) + 1;

  const dayNames = ['Imix', 'Ik', 'Akbal', 'Kan', 'Chicchan', 'Cimi', 'Manik', 'Lamat', 'Muluc', 'Oc',
                    'Chuen', 'Eb', 'Ben', 'Ix', 'Men', 'Cib', 'Caban', 'Etznab', 'Cauac', 'Ahau'];

  return { kin, daySign: dayNames[daySignIdx], tone };
}

// POST /api/jyotish — 印度占星
router.post('/jyotish', rateLimitMiddleware, async (req, res) => {
  try {
    const { name, dob, tob, city, country, concern, lang } = req.body;
    if (!dob || !tob) return res.status(400).json({ error: '出生日期和时间必填' });

    const jyotishData = calculateJyotish(dob, tob);
    const full = hasFullAccess(req, ['jyotish_full', 'jyotish']);

    const RASHI_EN = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
    const NAKSHATRA_EN = ['Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishtha','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'];
    const rashiName = RASHI_EN[jyotishData.rashi] || 'Sagittarius';
    const nakshatraName = NAKSHATRA_EN[jyotishData.nakshatra] || 'Jyeshtha';
    const outputLang = lang === 'zh' ? 'Chinese (Simplified)' : lang === 'kr' ? 'Korean' : 'English';

    const systemPrompt = full
      ? `You are a Jyotish master trained in the Parashari-Jaimini dual lineage at the Bhartiya Vidya Bhavan Jyotish Institute under Guru K.N. Rao's tradition, with 32 years of practice and over 50,000 charts read. You combine the classical precision of Brihat Parashara Hora Shastra with the subtle timing techniques of Jaimini Upadeshasutras. Write a comprehensive, deeply personal Vedic astrology report for ${name} born on ${dob} at ${tob} in ${city}, ${country}. Their Moon Sign (Rashi) is ${rashiName} and their Lunar Mansion (Nakshatra) is ${nakshatraName}. Their Lagna (Ascendant) is ${RASHI_EN[jyotishData.lagna] || 'unknown'}. Focus area: ${concern || 'overall destiny'}.

Write 10,000-14,000 words across these sections. Each section must be deeply specific to THIS person's chart — never generic. Use Sanskrit terms with clear English/Chinese explanations. Every section ends with one Sanskrit shloka (one line) + its English translation, like a temple bell resonating after the teaching.

## 🌙 Moon Sign: ${rashiName} (Rashi) — The Emotional Architecture [800 words]
Begin with the Sanskrit root meaning of ${rashiName}. Paint ${name}'s inner emotional world in vivid scenes — not "you are sensitive" but the actual texture of how they feel, love, fear, and find peace. Describe how ${rashiName} shapes their relationship patterns, their need for security, what makes them feel truly alive. Reference the ruling planet of ${rashiName} and its influence. End with a Sanskrit shloka on the Moon's grace.

## ✨ Nakshatra: ${nakshatraName} — The Soul's Lunar Mansion [700 words]
This is the soul's address in the cosmos. Tell the complete myth of ${nakshatraName}'s ruling deity — what happened, what it means, how this deity's story lives inside ${name}. Explain the Shakti (divine power) of ${nakshatraName} and how it manifests in their life. Describe the Pada (quarter) they were born in and its specific coloring. What does ${nakshatraName} people master in this lifetime? End with a shloka.

## 🪐 Dasha Timeline — The Cosmic Calendar [800 words]
Their current Mahadasha and Antardasha — be specific about which planet rules now and until exactly when. What major life themes does this period activate? What's opening, what's closing? When is the next significant Dasha shift and what will it bring? Map out the next 15 years of Dasha periods with specific dates and what each period tends to bring for ${rashiName}/${nakshatraName} natives. This is the section that astonishes people with its precision. End with a shloka on time.

## 🏠 Full 12-House Analysis — The Architecture of Destiny [1200 words]
Systematically analyze all 12 houses with their lords and key planetary tenants:
- 1st House (Lagna): self, body, personality, life direction
- 2nd House: family, speech, wealth accumulation, food
- 3rd House: courage, siblings, communication, short journeys
- 4th House: home, mother, emotional peace, property
- 5th House: children, creativity, romance, intelligence, past life merit
- 6th House: health, enemies, debts, service
- 7th House: marriage, partnerships, business relationships
- 8th House: transformation, longevity, hidden wealth, occult
- 9th House: dharma, father, higher education, fortune
- 10th House: career, public life, reputation, authority
- 11th House: gains, social networks, fulfillment of desires
- 12th House: liberation, foreign lands, expenditure, spiritual practice
For each house, name the lord, note any tenants, and give a specific 2-3 sentence reading. End with a shloka on the architecture of karma.

## 🌟 Yogas — Planetary Combinations That Shape Destiny [800 words]
Identify and explain the specific yogas present in this chart (calculate based on Lagna ${RASHI_EN[jyotishData.lagna] || 'unknown'} and Moon in ${rashiName}):
- Raja Yogas (combinations for authority, success, recognition): name the specific planets in kendra/trikona that form them
- Dhana Yogas (wealth combinations): identify the 2nd and 11th lord relationships
- Viparita Raja Yoga (if dusthana lords are in dusthanas — paradoxical rise through difficulty)
- Neecha Bhanga Raja Yoga (debilitated planet's cancellation into strength — if applicable)
- Any other significant yogas (Gaja Kesari, Saraswati, Hamsa, Malavya, etc.)
For each yoga found: name it, explain the Sanskrit meaning, describe how it manifests in this life. End with a shloka on grace.

## 📐 Ashtakavarga Analysis — The Strength Map [600 words]
Explain Ashtakavarga as the ancient bindu (point) system that measures planetary strength house by house. Analyze the bindus in the key houses (especially 1st, 4th, 7th, 10th, 11th): which houses have high bindus (28+, indicating strong areas of life) and which have low bindus (under 22, areas needing support). What does this specific strength map mean for ${name}'s wealth accumulation, relationship success, and career trajectory? End with a shloka on strength.

## 💰 Wealth, Career & Life Purpose [800 words]
Specific career paths aligned with their chart (name 5-6 specific fields). Financial patterns — are they a saver or a risk-taker by cosmic design? The age range when their greatest wealth accumulates (specific years). Business vs. service orientation — what the 10th lord reveals. Their Artha (material purpose) dharma. Their most powerful years for financial breakthrough (name 3 specific years). What industries to avoid. End with a shloka on abundance.

## 💕 Love, Marriage & Relationships [700 words]
The 7th house lord's placement and what it reveals about their ideal partner — specific qualities, likely background, how they'll meet. Marriage timing based on Dasha and Navamsha analysis (specific year range). Their relationship karma from past lives — what patterns they've brought forward. How to recognize their destined partner. Relationship challenges specific to ${rashiName} natives and how to navigate them. End with a shloka on union.

## 🏥 Health, Body & Ayurvedic Constitution [600 words]
Their Ayurvedic constitution (Vata/Pitta/Kapha) based on Lagna and its lord. Specific body areas governed by their Lagna and its weakness indicators. Organs connected to the afflicted planets in their chart. Health periods to be watchful (specific ages/years). Dietary wisdom from Jyotish — specific foods to favor and reduce. Yoga practices aligned with their chart. End with a shloka on vitality.

## 📅 5-Year Forecast: ${new Date().getFullYear()}–${new Date().getFullYear()+4} [700 words]
Year by year, guided by Dasha and annual transits of Jupiter and Saturn:
${new Date().getFullYear()}: [Career score/Love score/Finance score] — main theme and key events
${new Date().getFullYear()+1}: [scores] — what opens and closes
${new Date().getFullYear()+2}: [scores] — pivotal moments to watch
${new Date().getFullYear()+3}: [scores] — energetic themes
${new Date().getFullYear()+4}: [scores] — horizon and trajectory
For each year: the ruling Dasha, Jupiter's transit, what these bring specifically for ${rashiName} natives.

## 💎 Remedies, Gemstones & Sacred Practices [600 words]
Primary gemstone: name the specific stone, minimum carat weight (e.g., "natural Blue Sapphire, minimum 3 carats"), which finger (e.g., "middle finger of right hand"), which metal setting (e.g., "gold for Sun stones, silver for Moon stones"), and which day to put it on first (e.g., "Saturday during Shukla Paksha"). Secondary gemstone option if primary is inaccessible. Daily mantra: Sanskrit text + transliteration + English meaning + recommended repetitions (e.g., "108 times at dawn"). Weekly charity aligned with their chart. Most auspicious day of the week for important decisions. End with a shloka on divine remedy.

## 💌 Jyotishi's Personal Message — A Letter Across the Stars [500 words]
This is the most personal section — written directly to ${name}, not about them. Begin with a Sanskrit blessing (one line) and its translation. Then speak intimately: what is the single most important insight this chart holds for this person right now? What are they perhaps not seeing about themselves that the stars make clear? What is the gift hidden inside their greatest challenge? Close with a specific, personal blessing — not generic, but rooted in what you see in this unique chart.

语言：${outputLang}。写作风格：命运诗篇——每一章是旅途的一步，每个章节结尾有一句金句（如梵语意境的一行诗）。场景感代替抽象描述。严禁bullet points。直接进入命运叙述，温暖而有文学质感。`

      : `你是一位精通吠陀占星（Jyotish）的大师，同时拥有诗人的灵魂。为${name}（生于${dob}，${city}）写一份命运诗篇式的免费吠陀占星解读。月亮星座（Rashi）：${rashiName}；月宿（Nakshatra）：${nakshatraName}。关注重点：${concern || '整体命运'}。

═══ 写作风格要求（最重要） ═══

这份报告是一部命运诗篇，不是星座简介，不是自我帮助文章。它是有人牵着${name}的手，走过星辰映照下的命运山水。

具体要求：
- 以"你的……"开头，沉浸式第二人称，每一句话都在对她说，不是在介绍她
- 场景感代替抽象：不说"你有领导力"，说"当会议室里沉默像水一样漫上来时，你总是那个先说话的人——不是因为你需要被看见，而是因为你受不了混沌的状态"
- 文字质感：像余秋雨或林清玄写人生感悟，文言意境与现代口语交融，有温度，有节奏
- 每个章节结尾，必须有一句令人心头一震的金句或梵语诗意（一行，如月光打在水面上）
- 合理融入梵文（加中文解释）、吠陀神话场景、印度哲学意象，一两处即可，不堆砌
- 严禁使用bullet points（·或•），禁止大段列举；用连贯的叙述段落
- 直接进入${name}的命运叙述，无需解释吠陀占星是什么

═══ 内容章节 ═══

### 🌙 你的月亮星座：${rashiName}
${rashiName}不是一个标签，它是${name}情感世界的底色。她如何爱，如何害怕，什么让她感到安全，什么让她感到窒息——用具体的场景和意象来描绘，不是心理学测试题。引用${rashiName}的梵文含义。以金句结尾。500字。

### ✨ 你的月宿：${nakshatraName}
${nakshatraName}的神话原型是谁？那位神灵经历了什么，又如何在${name}的生命里显现？Shakti（神力）在她身上如何活着？写成神话传承，写成灵魂的血脉。以金句结尾。400字。

### 🌟 灵魂的天赋与业力
${rashiName} + ${nakshatraName}的组合，赋予了${name}三种深刻的天赋——不是抽象词汇，而是具体的、她自己也会认出的能力。以及两个此生要面对的业力功课——不是批判，而是通往自由的门。以金句结尾。400字。

### 📅 ${new Date().getFullYear()}年的宇宙能量
今年的星辰为${rashiName}带来了什么主题？什么在打开，什么在收合？有什么机遇在向她招手，有什么旧模式需要放下？写得有时间质感，像预言，也像提醒。400字。

### 💎 你的吠陀蓝图（幸运指引）
为${name}量身的宝石推荐、幸运色彩、吉祥方位、最好的日子，以及一句每日可持诵的曼陀罗（附发音）。200字。

---

结尾：写一段温暖而具体的话——"你的吠陀命盘还藏着……"，列出5件完整版才揭晓的事（Dasha大运周期精确日期、全部12宫位分析、5年运势预测、关系业力兼容、具体补救措施），让人真心好奇。

语言：${outputLang}。直接从${name}的命运开始叙述，不要免责声明。`;

    // 免费版缓存检查（jyotish）
    if (!full) {
      const ck = cacheKey({ name: name||'', dob: dob||'', gender: '', lang: lang||'en' });
      const cached = reportCache.get(ck + '|jyotish');
      if (cached) { return res.json({ reading: cached, tier: 'basic', data: jyotishData, unlockUrl: '/pages/jyotish.html#unlock', cached: true }); }
    }
    const reading = await deepseekChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Please generate the Vedic Jyotish report for ${name}.` }
    ], { maxTokens: full ? 16384 : 4000 });

    if (!full) {
      const ck = cacheKey({ name: name||'', dob: dob||'', gender: '', lang: lang||'en' }) + '|jyotish';
      reportCache.set(ck, reading);
      setTimeout(() => reportCache.delete(ck), 24 * 60 * 60 * 1000);
    }
    insertReading.run('jyotish', JSON.stringify({ name, dob, city, country, concern }), reading, req.userId);

    res.json({
      reading,
      tier: full ? 'full' : 'basic',
      data: jyotishData,
      unlockUrl: full ? null : '/pages/jyotish.html#unlock',
      product: full ? matchProduct(reading, 'jyotish') : undefined
    });
  } catch (err) {
    console.error('[JYOTISH ERR]', err.message);
    res.status(500).json({ error: '生成占星报告失败，请重试' });
  }
});

// POST /api/maya — 玛雅历
router.post('/maya', rateLimitMiddleware, async (req, res) => {
  try {
    const { name, dob, intention, lang } = req.body;
    if (!dob) return res.status(400).json({ error: '出生日期必填' });

    const [year, month, day] = dob.split('-').map(Number);
    const tzolkinData = getTzolkin(year, month, day);
    const full = hasFullAccess(req, ['maya_full', 'maya']);

    const mayaLang = lang === 'zh' ? 'Chinese (Simplified)' : lang === 'kr' ? 'Korean' : 'English';
    const systemPrompt = full
      ? `You are a master Maya calendar keeper trained directly by Don Alejandro Cirilo Oxlaj Pérez, the supreme elder (Wakatel Utiw, "Wandering Wolf") of the K'iche' Maya lineage of Guatemala, designated keeper of the Cholq'ij sacred calendar for 28 years. You have participated in hundreds of fire ceremonies, have been initiated in the Ajq'ij (day-keeper) tradition, and carry the living transmission of the Popol Vuh. You see the calendar not as an abstract system but as a living conversation between the cosmos and the human soul. Write a profound, comprehensive Maya destiny reading for ${name}, born on ${dob}. Their sacred Kin is ${tzolkinData.kin}: ${tzolkinData.tone} ${tzolkinData.daySign}. Focus: ${intention || 'life mission'}.

Write 10,000-14,000 words across these sections. Every section must be deeply personal and specific to Kin ${tzolkinData.kin}. Weave in K'iche' Maya words with explanations. Each section ends with one sentence of profound poetry — like a single flame lit at the close of a ceremony. No bullet points. Pure narrative prose with the depth of myth and the warmth of a grandfather's teaching.

## 🌞 Your Sacred Kin: ${tzolkinData.tone} ${tzolkinData.daySign} (Kin ${tzolkinData.kin}) — The Soul's Galactic Address [900 words]
Begin by evoking the moment this soul entered the world — the 260-day Tzolkin turning like a great wheel, the day keepers in their highland villages reading the signs. Explain the sacred mathematics: 13 tones × 20 day signs = 260, the same number as days of human gestation, as the Venus cycle's inner arc. Where does Kin ${tzolkinData.kin} fall in this mandala? Describe the ancient glyph — its visual form, the deity who governs it, what the Maya saw when they drew this symbol in bark-paper codices. This is ${name}'s cosmic fingerprint.

## 🦅 Your Day Sign: ${tzolkinData.daySign} — The Mythic Archetype [1000 words]
${tzolkinData.daySign} is one of the 20 sacred archetypes — an ancient deity-force, a face of creation. Tell ${name} the complete story of this day sign: its K'iche' name and its meaning in ancient Mayan language, the deity who governs it, the myth from the Popol Vuh or the Dresden Codex that carries this energy. Then translate the myth into ${name}'s lived reality — not "you are creative" but the actual scenes of their life this archetype generates. Their core nature (how they think, feel, choose), their shadow (what they must face), their superpower (what they do that others can't explain), their wound that becomes their wisdom. The animals, directions, colors, and elements sacred to this day sign. This is the longest and most intimate section.

## 🎵 Your Galactic Tone: ${tzolkinData.tone} — The Rhythm of Creation [700 words]
In the K'iche' tradition, the 13 tones are 13 qualities of cosmic intention — not just numbers but living energies. Tone ${tzolkinData.tone}'s K'iche' name, its keyword (e.g., Tone 1=Unity/purpose, Tone 8=Harmony/modeling, Tone 13=Transcendence/presence), its challenge, and its gift. How does Tone ${tzolkinData.tone} amplify, complicate, or transform the ${tzolkinData.daySign} energy? What does it feel like to be a ${tzolkinData.tone} person — the inner experience of their consciousness? Give ${name} the experience of recognizing themselves in this rhythm.

## 🌑 Shadow & Light — Antipode and Analog [700 words]
The Maya oracle surrounding each Kin reveals the forces that companion the soul. Identify ${name}'s Antipode (the challenging mirror Kin, 130 Kins away in the Tzolkin wheel) and their Analog (the support Kin, same tone different color family). The Antipode is not an enemy — it is the initiator, the fire that purifies. The Analog is the cosmic ally who holds the same frequency. Describe both Kins in detail and give ${name} specific guidance on how to work with these energies in relationships and challenges.

## 🌀 Your Trecena — The Wavespell Temple [700 words]
Each of the 20 Trecenas (13-day wavespells) is a temple of learning governed by the day sign that begins it. ${name} was born inside the Trecena of [the day sign that begins their 13-day cycle]. What is this Trecena's overarching theme? What does it mean to be born on Day ${tzolkinData.tone} of this wavespell — near the beginning (days 1-4: activation), middle (days 5-9: refinement), or completion (days 10-13: culmination)? What recurring life lessons does this Trecena activate throughout ${name}'s existence?

## 🐍 The Full Oracle — All 5 Positions [800 words]
The complete Maya oracle has 5 positions: Kin (core self, already described), Guide (the guiding higher Kin above, same day sign family), Antipode (already described), Analog (already described), and Occult (the hidden partner Kin, adds to 261). Now focus on the Guide and Occult: the Guide Kin shows ${name}'s higher purpose and spiritual direction — who is this guide energy and what path does it illuminate? The Occult Kin is the secret, the hidden gift that others may not see in ${name} but is quietly their greatest power — what is it, and how does it want to emerge?

## 📅 Your Haab Solar Birthday & Year Bearer [600 words]
Beyond the Tzolkin, the Maya used the 365-day Haab solar calendar — 18 months of 20 days plus 5 Wayeb days of mystery. ${name}'s Haab birthday and its Uinal (month) and K'in (day) position reveal another dimension of destiny: their relationship to the material world, their role in community and family. Additionally, explain the Year Bearer — the four day signs (Ix, Eb, Kawak, Manik in the Quiché tradition) that serve as the "pillars" of each solar year, and what the current Year Bearer means for ${name}'s particular day sign this year.

## 🌐 Your Long Count Position — Standing in the Grand Cycle [500 words]
The Long Count is the Maya's great historical calendar — the one that famously completed its 13th Bak'tun cycle in December 2012, inaugurating a new grand age. Explain where ${name} stands in the current Long Count era (we are now in the early years of the 14th Bak'tun). What does being born in this particular cosmic chapter mean for their soul's purpose? What collective task have they come to participate in during this grand cycle?

## 💫 Year ${new Date().getFullYear()} in the Tzolkin Current [600 words]
The 260-day Tzolkin wheel turns continuously, cycling through all 260 Kins multiple times per year. Where in the current Tzolkin round is ${name}'s signature activated? Name the 3-4 most powerful personal activation dates for ${name} this year — specific dates when their Kin returns or when their key positions align — and explain what to do on those days (what to begin, what to offer, what to release). What is the overall galactic theme for ${name} in ${new Date().getFullYear()}?

## 🌿 Life Mission & Karmic Thread [700 words]
In the K'iche' tradition, every soul comes with a Pixan (soul-essence) and a mission encoded in their Kin. What is the deepest purpose encoded in ${tzolkinData.tone} ${tzolkinData.daySign}? What karmic thread runs through ${name}'s relationships, their work, their spiritual longing? What have they come to heal, and what have they come to create? This is the most prophetic section — speak it as a day keeper would, with reverence and certainty.

## 🔮 Love & Sacred Relationships [600 words]
The Maya understood relationships through Kin compatibility — harmonious Kins share color families or tonal resonances. Which day signs are ${name}'s most naturally aligned partners? Which create powerful but challenging chemistry? What patterns appear in ${name}'s love story — what do they keep attracting, and what does that teach them? What does their ideal partnership look like when they're operating in their highest Kin frequency?

## 🌏 Your Gift to the World — The Collective Role [500 words]
Kin ${tzolkinData.kin} is rare — only 1 in 260 people share this exact signature. What does the world need from ${name}? What gift does their particular combination of day sign and tone bring to the collective evolution? In the Maya understanding, each Kin is a thread in a great tapestry — what color, what texture, what position does ${name}'s thread hold?

## 🌺 Maya Fire Ceremony & Daily Alignment Practices [700 words]
As an initiated Ajq'ij (day keeper), describe the specific ceremony for ${tzolkinData.daySign}: the cardinal direction to face (East/North/West/South based on this day sign's element), the color of copal resin to burn (white for air signs, red for fire, black for water, yellow for earth — specify for ${tzolkinData.daySign}), the candle colors to use in ceremony (specify at least 3 colors with their meaning), the specific corn offering if applicable (whole kernels, cornmeal, or specific preparation), and the words to say when lighting the fire. Then give ${name} a daily micro-practice — something they can do in 5 minutes each morning to align with their Kin's energy. Finally, list their 4 most sacred personal days in the Tzolkin year when ceremony is most powerful.

## 💌 The Elder's Whisper — Words Across the Fire [500 words]
This final section is the day keeper's private message to ${name} — not about the calendar, but from one soul to another across the fire. Begin with a traditional Maya greeting in K'iche' and its translation. Then speak the one truth this chart has shown you about ${name} that they most need to hear right now — perhaps something they already sense but haven't let themselves believe. What is the Maya elder's blessing for this particular soul? Close with a traditional Maya closing prayer or blessing in K'iche', followed by its translation.

语言：${mayaLang}。写作风格：命运诗篇——每一章是旅途的一步，每个章节结尾有一句令人心头一震的金句。场景感代替抽象，严禁bullet points，直接进入命运叙述，神秘而有文学质感。`

      : `你是一位在玛雅高地传承中受训的卓金历法守护者，同时拥有诗人与说书人的灵魂。为${name}写一份命运诗篇式的免费玛雅历解读。她的神圣印记是Kin ${tzolkinData.kin}：${tzolkinData.tone} ${tzolkinData.daySign}。关注重点：${intention || '生命使命'}。

═══ 写作风格要求（最重要） ═══

这份报告是一部命运诗篇。玛雅人相信，每个Kin都是宇宙编织进这个灵魂的密码——你的任务是把这个密码还给${name}，用她能读懂、能感受到的语言。

具体要求：
- 以"你的……"开头，沉浸式第二人称叙述——像一位玛雅长老在朝圣路上与${name}同行，低声讲述她的灵魂故事
- 场景感代替抽象：不说"你有智慧"，说"当别人还在争论方向时，你已经看见了那条路——你说不清楚你怎么知道，你只是知道"
- 文字质感：如果是中文，像余秋雨或纪伯伦（中译本）的风格——美丽、有重量、在东方与西方之间流动；每一段都有节奏感
- 每个章节结尾，必须有一句令人心头一颤的金句（一行，如玛雅仪式结束时的铜鼓余音）
- 合理融入玛雅神话（《波波尔·乌》、羽蛇神、玉米神）、Tzolkin数学之美，一两处即可
- 严禁bullet points（·或•），禁止大段列举；用连贯的叙述段落
- 直接进入${name}的命运叙述，无需解释玛雅历是什么

═══ 内容章节 ═══

### 🌞 你的神圣印记：${tzolkinData.tone} ${tzolkinData.daySign}（Kin ${tzolkinData.kin}）
260这个数字是如何诞生的（13音调×20图腾的神圣数学），以及Kin ${tzolkinData.kin}在这个宇宙织锦中的位置——这是她的灵魂在宇宙中的坐标。写成神话诗，不是数学课。以金句结尾。400字。

### 🦅 你的太阳图腾：${tzolkinData.daySign} — 真实的你
${tzolkinData.daySign}在玛雅神话中是什么原型？她的核心本质、情感世界、思维风格、爱的方式、内心的恐惧、阴影面、以及她最耀眼的超能力——用神话场景和具体意象来呈现，让${name}在其中认出自己。以金句结尾。600字。

### 🎵 你的银河音调${tzolkinData.tone}：灵魂的节奏
音调${tzolkinData.tone}是13个宇宙心跳之一，它的关键词是什么，它如何放大${tzolkinData.daySign}的能量，它为${name}的生命带来什么独特的节奏？写成音乐，不是说明书。以金句结尾。400字。

### 🌟 天赋与生命功课
Kin ${tzolkinData.kin}带给${name}的三种天赋——具体的、她自己也会认出的能力；以及两个此生要整合的挑战——不是弱点，而是通往更深智慧的门。以金句结尾。400字。

### 🌀 ${new Date().getFullYear()}年的宇宙能量
在当前的Tzolkin循环中，${tzolkinData.daySign}的能量在哪些领域被放大？什么在邀请她创造，什么在等待她放下？300字。

### 🌺 你的每日激活仪式
为${tzolkinData.daySign}能量设计的一个具体仪式或冥想——晨起的姿势，颜色，意图，或一个手势。美丽而实用。200字。

---

结尾：写一段温暖而具体的话——"你的完整玛雅命运解读还藏着……"，列出5件完整版才揭晓的事（完整神谕Oracle解读、Trecena波浪周期、关系业力兼容、260天循环当前位置、年度仪式日历），让人产生真实的好奇。

语言：${mayaLang}。直接从${name}的命运开始，不要免责声明。`;

    // 免费版缓存检查（maya）
    if (!full) {
      const ck = cacheKey({ name: name||'', dob: dob||'', gender: '', lang: lang||'en' }) + '|maya';
      const cached = reportCache.get(ck);
      if (cached) { return res.json({ reading: cached, tier: 'basic', data: tzolkinData, unlockUrl: '/pages/maya.html#unlock', cached: true }); }
    }
    const reading = await deepseekChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Please generate the Maya Tzolkin destiny reading for ${name}.` }
    ], { maxTokens: full ? 16384 : 4000 });

    if (!full) {
      const ck = cacheKey({ name: name||'', dob: dob||'', gender: '', lang: lang||'en' }) + '|maya';
      reportCache.set(ck, reading);
      setTimeout(() => reportCache.delete(ck), 24 * 60 * 60 * 1000);
    }
    insertReading.run('maya', JSON.stringify({ name, dob, intention }), reading, req.userId);

    res.json({
      reading,
      tier: full ? 'full' : 'basic',
      data: tzolkinData,
      unlockUrl: full ? null : '/pages/maya.html#unlock',
      product: full ? matchProduct(reading, 'maya') : undefined
    });
  } catch (err) {
    console.error('[MAYA ERR]', err.message);
    res.status(500).json({ error: '生成玛雅报告失败，请重试' });
  }
});

// POST /api/tibet — 藏传命理
router.post('/tibet', rateLimitMiddleware, async (req, res) => {
  try {
    const { name, dob, gender, concern, lang } = req.body;
    if (!dob) return res.status(400).json({ error: '出生年份必填' });

    const birthYear = new Date(dob).getFullYear();
    const tibetData = calculateTibetan(birthYear);
    const full = hasFullAccess(req, ['tibet_full', 'tibet']);

    const tibetLang = lang === 'zh' ? 'Chinese (Simplified)' : lang === 'kr' ? 'Korean' : 'English';
    const genderStr = gender === 'M' ? 'male' : 'female';
    const systemPrompt = full
      ? `You are a Lopon (senior teachings holder) in the Karma Kagyu lineage, trained under the direct tradition of H.H. the 17th Karmapa Ogyen Trinley Dorje at Rumtek Monastery and in the Bön Zhangzhung Nyengyud texts preserved at Menri Monastery. You have studied Tibetan natal astrology (Kartsi, combining Jungtsi elemental astrology with Naktsi Black Astrology) for 30 years, have read over 20,000 natal charts, and have participated in hundreds of ritual practices (drubthab) to support practitioners through difficult fate periods. You understand that Tibetan astrology is not fatalism — it is a sacred map that shows the practitioner how to navigate karma with wisdom and compassion. Write a comprehensive Tibetan destiny reading for ${name} (${genderStr}), born in ${birthYear}.

⚠️ ACCURACY LOCKED — DO NOT DEVIATE: ${birthYear} = ${tibetData.element} ${tibetData.zodiac} (${tibetData.elementCN}${tibetData.zodiacCN}). The element is ALWAYS ${tibetData.element} — never use another. Mewa number: ${tibetData.mewaNum}. Parkha trigram: ${tibetData.parkha}. Lungta: ${tibetData.lungta}. Focus: ${concern || 'overall destiny'}.

Write 10,000-14,000 words. This is one of the rarest and most precious divination systems in the world — very few people outside Tibet have access to a genuine reading. Each section ends with one line of dharma poetry or a verse from the Tibetan tradition — like the sound of a singing bowl fading into mountain silence. No bullet points. Pure narrative prose. Direct address to ${name} in second person throughout.

## 🐉 Your Animal Sign: ${tibetData.zodiac} (${tibetData.zodiacCN}) — The Three-World Portrait [900 words]
In Tibetan cosmology, each animal sign carries wisdom across the three worlds: the world of form (body — how you appear, move, and express), the world of speech (how you communicate, persuade, create through sound and language), and the world of mind (how you think, dream, and experience reality). Paint ${name}'s complete portrait across all three worlds. Then: their relationship patterns (who draws them, who depletes them), their career strengths and the professional environments where they thrive, their shadow tendencies (the karmic patterns that trip them up lifetimes after lifetime), and their spiritual gifts — what has their soul been refining across many rebirths? Reference the Buddhist teachings and deity associations of the ${tibetData.zodiac}. End with one line of dharma poetry.

## 🔥 Your Element: ${tibetData.element} ${tibetData.zodiac} — The Alchemical Combination [700 words]
The element and animal interact like a dye and a cloth — the element is the color that saturates the animal's nature. ${tibetData.element} element in Tibetan cosmology carries specific qualities: describe what ${tibetData.element} brings energetically, its relationship to the seasons and directions, its manifestation in personality and health. Then describe the specific alchemy: how ${tibetData.element} ${tibetData.zodiac} differs from Water ${tibetData.zodiac} or Fire ${tibetData.zodiac} — the particular flavor of this combination that appears only every 60 years. What life themes does this combination consistently generate? What is its paradox — the thing that seems contradictory but is actually its greatest gift? End with dharma poetry.

## 🔢 Mewa ${tibetData.mewaNum} — The Palace of Your Fate [800 words]
The nine Mewa numbers derive from the ancient Lo Shu magic square, each governing a "palace" of destiny with its own color, element, direction, ruling deity (one of the nine forms of Manjushri or the medicine buddha aspects), and karmic signature. Mewa ${tibetData.mewaNum}'s complete teaching: its color and what that color means in Tibetan sacred art (thangka tradition), its elemental nature, the cardinal direction of its palace, the deity who presides and their blessing power. What does Mewa ${tibetData.mewaNum} reveal about ${name}'s deepest karmic imprints — the lessons carried from past lives? Their hidden strengths that even they may not fully recognize? The karmic debts that need conscious repayment? The specific blessings that flow naturally to this Mewa number? End with dharma poetry.

## ☯️ Parkha ${tibetData.parkha} — Your Trigram Temple [700 words]
The eight Parkha trigrams come from the I Ching tradition as absorbed into Tibetan astrology — but reinterpreted through the lens of tantric Buddhism. Each Parkha is a sacred geometric pattern (tri-gram) representing a state of energy flow in the cosmos and in the body. ${tibetData.parkha}'s specific meaning: its trigram structure (which lines are solid, which are broken), its element, its animal guardian, its direction. How does ${name}'s Parkha shape their relationship to time — how they age, how their luck flows through life phases? What directions are auspicious for their home entrance, their work desk, their bed position? Which Parkha trigrams are harmonious with theirs for marriage and business partnerships, and which create friction? End with dharma poetry.

## ⚡ La (Life Essence) vs Srog (Life Force) — The Two Streams of Vitality [700 words]
This is one of the most important and least understood distinctions in Tibetan astrology — a teaching not found in Chinese or Western systems. La (བླ་) is the spiritual life essence — the subtle consciousness that can be "scattered" by shock, grief, or spiritual interference, causing a person to feel lost, hollow, or disconnected from their purpose. Srog (སྲོག་) is the physical life force — the vitality that sustains the body. Both have their own elemental nature and fluctuate according to the 12-year animal cycle. Analyze ${name}'s La element and Srog element (derived from their birth year and gender). When are their La and Srog strongest (most protected years)? When are they most vulnerable? What are the signs that La has been scattered? What are the specific practices to call La back home — the La-guk ritual, the specific mantras, the colors and offerings that restore life essence? This section is unique to Tibetan astrology and should be presented as the precious teaching it is.

## 📿 Lo Khak — Your 12-Year Obstacle Cycle [700 words]
In Tibetan astrology, every 12 years, when one's birth animal returns, is a Lo Khak year — an obstacle year (also called a "return year" or "year of the self"). But the obstacles manifest differently for each animal and element combination. For ${name}, their Lo Khak years in their lifetime (list the specific years from birth onward) have been and will be periods of particular karmic intensity — not bad luck per se, but years when the karmic accounts are being reconciled. Analyze the pattern: what themes have tended to arise in ${name}'s Lo Khak years? What does the next Lo Khak year hold, and how should they prepare? The traditional prescriptions for Lo Khak years include specific rituals: describe 3 practices in detail (including the Losar puja timing, specific offering substances, and the recommendation to commission a specific thankga or statue). End with dharma poetry.

## 🐴 Lungta — Your Wind Horse Power: ${tibetData.lungta} [600 words]
The Lungta (རླུང་རྟ་, "Wind Horse") is perhaps the most beloved concept in Tibetan astrology — the invisible horse that carries the flag of fortune across the mountain sky. It is the sum of one's merit, luck, and spiritual momentum. ${name}'s Lungta is currently "${tibetData.lungta}" — describe what this specifically means for their life force and fortune trajectory. Is the Wind Horse galloping or resting? What conditions have affected its strength? Give ${name} three specific and detailed practices to strengthen their Lungta: one involving Lungta prayer flags (what colors, what direction to hang, what day to hang them, what prayers to recite), one involving generosity practice (specific offerings and the merit-generating intention to hold), and one involving mantra practice (specific syllables, number of repetitions, visualization). End with dharma poetry.

## 💕 Relationships & Marriage — The Elemental Dance [700 words]
Tibetan marriage compatibility is determined by the Five Element relationships (Wood feeds Fire, Fire creates Earth, Earth yields Metal, Metal holds Water, Water nourishes Wood) and the animal sign interactions. Give ${name} the specific compatibility chart: which animal signs are their Dö (friends/harmonious), which are their Dü (enemies/challenging), and which are Zung (neutral/teachers). Name the 3 most compatible signs with specific reasons — not just "compatible" but the specific way their elements interact to create harmony. The 2 most challenging signs, and how to navigate relationships with them skillfully. Marriage timing indications based on their Mewa and Lungta. What karmic relationship theme has their soul been working with across lifetimes? End with dharma poetry.

## 💼 Career, Wealth & Life Purpose [700 words]
The Tibetan astrological tradition identifies specific professional strengths for each element-animal combination based on the Five Element relationships. What industries and roles align with ${tibetData.element} ${tibetData.zodiac}? When does their greatest wealth period arrive (specific age range and years)? Their relationship to money and resources — saver or spender by elemental nature? The specific type of work environment where they thrive (outdoors/indoors, leadership/support, creative/analytical). The professions that Tibetan medicine texts specifically associate with their combination. What does their Mewa ${tibetData.mewaNum} reveal about their professional destiny? Two or three specific years in the coming decade when career opportunities are most powerful. End with dharma poetry.

## 📅 3-Year Destiny Forecast: ${new Date().getFullYear()}–${new Date().getFullYear()+2} [700 words]
Year by year, guide ${name} through the next three years using the Tibetan elemental year analysis:

**${new Date().getFullYear()}** [Year's animal and element]: Is this year Lok (auspicious), neutral, or Dü (challenging) for ${tibetData.zodiac}? What specific domains of life are most affected — career, relationships, health, finances, spiritual practice? Specific months within this year that are especially powerful or require care. One ritual prescription for this year.

**${new Date().getFullYear()+1}**: Same depth of analysis. What shifts?

**${new Date().getFullYear()+2}**: What is arriving on the horizon? What karmic themes are completing, and what new cycle is beginning?

End with dharma poetry.

## 🏔️ Health, Longevity & Tibetan Medicine [600 words]
Tibetan medicine (Sowa Rigpa) is inseparable from astrology — the nyes pa (humors): Lung (wind/air), Tripa (bile/fire), and Bekan (phlegm/water-earth) map onto the elemental constitution. ${tibetData.element} ${tibetData.zodiac}'s constitutional type and the specific humors most likely to become imbalanced. Health areas to support proactively (specific body systems and organs). The specific foods to favor and reduce per Tibetan dietary wisdom for this constitution. The years of greatest vitality fluctuation. Any longevity practices especially suited to their Mewa and element combination. End with dharma poetry.

## 🙏 Spiritual Practices, Pujas & Protections [700 words]
Every element-animal-Mewa combination has specific practices that the tradition recommends. Give ${name}:
- Their primary protective deity based on animal sign (e.g., the specific deity associated with their zodiac animal in the Tibetan tradition) with a brief description of this deity's qualities and a simple daily invocation
- The specific mantra most beneficial for their Mewa ${tibetData.mewaNum} (Sanskrit/Tibetan text, transliteration, and meaning)
- A specific puja recommendation: name the puja (e.g., "Sang offering / smoke purification puja for Lungta strengthening"), which monastery or tradition performs it most authentically, and the approximate offering cost range
- Their most auspicious days of the lunar month for important decisions
- Their most challenging lunar days and what to avoid
- One specific protection amulet or sacred object traditionally carried by people of their animal sign
End with dharma poetry.

## 💌 The Lama's Whisper — A Dharma Letter [500 words]
This final section is the most intimate — a personal teaching from the Lopon to ${name}, not about the astrology but from one being to another. Begin with a traditional Tibetan blessing formula in Tibetan script and its translation (e.g., "Tashi Delek" expanded into a full blessing). Then offer the single most important insight this chart holds — the thing the dharma is asking ${name} to understand right now in this lifetime. What is the gift hidden inside their greatest difficulty? What does the tradition want them to know about who they truly are, beneath all the karmic patterns? Close with a dedication of merit (a traditional Buddhist practice of offering any good generated by this reading to the benefit of all beings) and a specific personal blessing for ${name}'s journey.

语言：${tibetLang}。写作风格：命运诗篇——每一章是旅途的一步，每个章节结尾有一句金句或禅语。场景感代替抽象描述。文言+现代融合，流动有温度。严禁bullet points。直接进入命运叙述。`

      : `你是一位精通藏传命理（藏历算术，Kartsi）的算师，兼具文学家的笔触。为${name}（${genderStr}，生于${birthYear}年）写一份命运诗篇式的藏传命理解读。

精度要求（绝对不允许更改）：${birthYear}年 = ${tibetData.element} ${tibetData.zodiac}（${tibetData.elementCN}${tibetData.zodiacCN}）。元素必须是${tibetData.element}。密瓦数：${tibetData.mewaNum}，帕卡卦：${tibetData.parkha}，风马（Lungta）：${tibetData.lungta}。

═══ 写作风格要求（最重要，优先于一切） ═══

这份报告必须像一部命运诗篇，而非百科全书词条。每一章都是旅途中的一步，每一段都带着${name}走得更深。

具体要求：
- 以"你的……"开头，沉浸式第二人称叙述，让读者感觉有人牵着手，穿越命运的山水
- 场景感代替抽象：不说"你善于领导"，说"当所有人都沉默时，你总是那个先开口的人——不是因为你想掌控，而是因为你天生就看得见别人看不见的路"
- 文言+现代融合：文字如三毛、余秋雨写人生感悟，流动而有温度，不是白话散文，也不是古文堆砌
- 每个章节结尾，必须有一句画龙点睛的金句或禅语（一行，如诗），让人久久回味
- 适当点缀藏传佛教意象（唐卡、曼荼罗、莲花生大士、白度母）和中文典故，不堆砌
- 严禁使用bullet points（·或•）或大段列举
- 不要从解释定义开始，直接进入${name}的命运叙述

═══ 内容章节（每章都是旅途的一步） ═══

### 🐑 你的生肖：${tibetData.zodiac}（${tibetData.zodiacCN}）
不是介绍这个属相，而是描绘${name}内心世界的底色——她如何感知世界、如何爱、如何在受伤时退回内心的山谷。引用藏传佛教对这种动物的看法。以诗意金句结尾。500字。

### ⚙️ ${tibetData.element}${tibetData.zodiac}：你的元素灵魂
${tibetData.element}元素（${tibetData.element === 'Metal' ? '金——精准、收获与铁骨柔肠' : tibetData.element === 'Water' ? '水——流动、智慧与深不见底' : tibetData.element === 'Wood' ? '木——生长、创造与向阳而生' : tibetData.element === 'Fire' ? '火——激情、转化与照亮他人' : '土——稳重、滋养与大地根基'}）如何锻造了这头${tibetData.zodiac}。写出这个组合的独特炼金术，写出它的悖论之美。以诗意金句结尾。400字。

### 🛡️ 你的松瓦（守护元素）
松瓦是藏传命理独有的概念——汉地八字和西方占星都没有。为${name}解读她的守护元素：哪些颜色、方向、环境会激活她的好运，哪些会消耗她的生命能量。写成守护神话，不是列表。以诗意金句结尾。300字。

### 🐴 你的风马（Lungta）：${tibetData.lungta}
风马是藏人心中载着命运的神马，它的力量决定一个人一生的气运高低。${name}的风马强度是"${tibetData.lungta}"——这意味着什么？她的风马如何在人生际遇中显现？给她三个提升风马的具体修行。以诗意金句结尾。400字。

### 🌟 天赋与业力
${tibetData.element}${tibetData.zodiac}带来的三个深刻天赋，以及两个此生要转化的业力模式——不是抽象说教，而是像一面镜子，让${name}在其中认出自己。以诗意金句结尾。400字。

### 📅 ${new Date().getFullYear()}年运势
今年对${tibetData.zodiac}来说，哪些门是开的，哪些门要小心。写得具体，有时间感，有质感。300字。

### 🙏 你的日常修行
为${tibetData.element}${tibetData.zodiac}量身定制的一个具体修行——咒语、观想、供品，或一个有方向感的生活姿势。200字。

---

结尾：写一段温暖而具体的话——"你的完整藏传命盘还藏着……"，列出5件完整版才能揭晓的事（密瓦九宫分析、帕卡卦关系图谱、三年详运吉凶、婚姻兼容性、健康长寿分析），让人产生真实的好奇。

语言：${tibetLang}。直接开始${name}的命运叙述，不要任何免责声明。`;

    // 免费版缓存检查（tibet）
    if (!full) {
      const ck = cacheKey({ name: name||'', dob: dob||'', gender: gender||'', lang: lang||'en' }) + '|tibet';
      const cached = reportCache.get(ck);
      if (cached) { return res.json({ reading: cached, tier: 'basic', data: tibetData, unlockUrl: '/pages/tibet.html#unlock', cached: true }); }
    }
    const reading = await deepseekChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Please generate the Tibetan destiny reading for ${name}.` }
    ], { maxTokens: full ? 16384 : 4000 });

    if (!full) {
      const ck = cacheKey({ name: name||'', dob: dob||'', gender: gender||'', lang: lang||'en' }) + '|tibet';
      reportCache.set(ck, reading);
      setTimeout(() => reportCache.delete(ck), 24 * 60 * 60 * 1000);
    }
    insertReading.run('tibet', JSON.stringify({ name, dob, gender, concern }), reading, req.userId);

    res.json({
      reading,
      tier: full ? 'full' : 'basic',
      data: tibetData,
      unlockUrl: full ? null : '/pages/tibet.html#unlock',
      product: full ? matchProduct(reading, 'tibet') : undefined
    });
  } catch (err) {
    console.error('[TIBET ERR]', err.message);
    res.status(500).json({ error: '生成藏传报告失败，请重试' });
  }
});

// ══════════════════════════════════════════
// POST /api/bazi/stream — 八字流式输出（SSE）
// ══════════════════════════════════════════
router.post('/bazi/stream', rateLimitMiddleware, async (req, res) => {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, gender, question, mode } = req.body;
    if (!birthYear || !birthMonth || !birthDay) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: '请提供出生年月日' });
    }
    const full = hasFullAccess(req, ['bazi', '八字', '사주']);
    const modeInstruction = (mode === 'gentle')
      ? '\n\n【说话模式】你温暖治愈，以鼓励为主，让人感到被理解。'
      : '\n\n【说话模式】你说话直率，但句句为对方好，直接指出问题。';

    // ── 精确排盘（真实算法，不依赖AI猜算）──
    const bazi = calcBazi(Number(birthYear), Number(birthMonth), Number(birthDay), Number(birthHour) || 0, gender);
    const baziChart = `【精确排盘结果（由万年历算法计算，请严格使用以下数据，不得自行推算或修改）】
年柱：${bazi.year.gan}${bazi.year.zhi}　月柱：${bazi.month.gan}${bazi.month.zhi}　日柱：${bazi.day.gan}${bazi.day.zhi}　时柱：${bazi.hour.gan}${bazi.hour.zhi}
四柱：${bazi.fourPillars}
日主：${bazi.dayMaster}（${bazi.dayMasterElement}）　身${bazi.isStrong ? '强' : '弱'}
五行：金${bazi.wuxing['金'].toFixed(1)} 木${bazi.wuxing['木'].toFixed(1)} 水${bazi.wuxing['水'].toFixed(1)} 火${bazi.wuxing['火'].toFixed(1)} 土${bazi.wuxing['土'].toFixed(1)}
生肖：${bazi.zodiac}　时辰：${bazi.shiChen}
大运（依次）：${bazi.daYun.map(d => d.name+'('+d.startAge+'-'+d.endAge+'岁)').join('　')}
当前年份：${new Date().getFullYear()}年`;

    const sysPay = full
      ? `你是一位精通八字命理的实力派命理师，既有正统传承，又懂现代人语言。\n\n${baziChart}\n\n你必须严格按照15个维度展开，总字数10000-15000字。维度用emoji开头：\n1.📜四柱八字排盘 2.🔥十神分析 3.🟤五行分析 4.💰财运格局 5.💕感情姻缘 6.💼事业格局 7.🏥健康预警 8.📅全部8步大运（使用上方精确大运数据） 9.🔮未来10年逐年流年（每年评分，从当前年份算起） 10.✨神煞分析 11.🌿藏干 12.👨‍👩‍👧‍👦父母/子女/夫妻宫 13.🎯开运锦囊 14.📖古法断语 15.💌命理师叮嘱\n每个维度必须基于上方排盘数据展开，给出具体年份/数字/颜色/物品。所有涉及年份的内容必须以当前年份为基准向未来推算。${modeInstruction}`
      : `你是一位八字命理师。\n\n${baziChart}\n\n【免费预览版】只写3个部分：📜四柱排盘简介、🟤五行能量分析、🌟今年（${new Date().getFullYear()}年）运势概览（各200-300字）。最后说明完整报告含15个维度，可付费解锁。${modeInstruction}`;

    const userPrompt = `请为我批算八字。出生：${birthYear}年${birthMonth}月${birthDay}日${birthHour !== undefined ? birthHour + '时' : ''}，性别：${gender === 'male' ? '男' : '女'}，关注：${question || '请全面分析命盘'}`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    // 发送元数据
    res.write(`data: ${JSON.stringify({ type: 'meta', tier: full ? 'full' : 'basic', locked: !full })}\n\n`);

    const streamBody = await deepseekStream(
      buildReadingPrompt(sysPay, userPrompt),
      { maxTokens: full ? 16384 : 3000, timeout: 300000 }
    );

    const reader = streamBody.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop(); // 保留不完整行
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') continue;
        try {
          const json = JSON.parse(raw);
          const content = json.choices?.[0]?.delta?.content || '';
          if (content) {
            fullText += content;
            res.write(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`);
          }
        } catch (e) {}
      }
    }

    // 存储 & 发送结束信号
    insertReading.run('bazi', JSON.stringify(req.body), fullText, req.userId);
    const ctxId = saveQaContext('bazi', req.body, fullText);
    const product = full ? matchProduct(fullText, 'bazi') : undefined;
    res.write(`data: ${JSON.stringify({ type: 'done', contextId: ctxId })}\n\n`);
    if (product) res.write(`data: ${JSON.stringify({ type: 'product', product })}\n\n`);
    res.end();
  } catch (err) {
    console.error('[BAZI-STREAM ERR]', err.message);
    try { res.write(`data: ${JSON.stringify({ type: 'error', message: '生成失败，请重试' })}\n\n`); res.end(); } catch(e) {}
  }
});

// ══════════════════════════════════════════
// POST /api/jyotish/stream — 吠陀占星流式输出（SSE）
// ══════════════════════════════════════════
router.post('/jyotish/stream', rateLimitMiddleware, async (req, res) => {
  try {
    const { name, dob, tob, city, country, concern, lang } = req.body;
    if (!dob) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: '出生日期必填' });
    }
    const tobStr = tob || '12:00';
    const jyotishData = calculateJyotish(dob, tobStr);
    const full = hasFullAccess(req, ['jyotish_full', 'jyotish']);
    const RASHI_EN = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
    const NAKSHATRA_EN = ['Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishtha','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'];
    const rashiName = RASHI_EN[jyotishData.rashi] || 'Sagittarius';
    const nakshatraName = NAKSHATRA_EN[jyotishData.nakshatra] || 'Jyeshtha';
    const outputLang = lang === 'zh' ? 'Chinese (Simplified)' : lang === 'kr' ? 'Korean' : 'English';

    const outputLangFull = lang === 'hi' ? 'Hindi' : lang === 'ta' ? 'Tamil' : outputLang;
    const systemPrompt = full
      ? `You are a master Jyotish astrologer with 30 years of practice. Write a comprehensive, deeply personal Vedic astrology report for ${name} born on ${dob} at ${tobStr} in ${city}, ${country}. Their Moon Sign (Rashi) is ${rashiName} and their Lunar Mansion (Nakshatra) is ${nakshatraName}. Focus area: ${concern || 'overall destiny'}.

Write 6000-8000 words across these sections. Each section must be deeply specific, not generic. Use Sanskrit terms with explanations. No bullet points — continuous narrative prose. Each section ends with a one-line insight (like a Sanskrit verse or poetic truth).

## 🌙 Moon Sign: ${rashiName} (Rashi)
Inner emotional world, how they love, what they fear, what drives them — in vivid scene-based prose. 600 words.

## ✨ Nakshatra: ${nakshatraName}
The lunar mansion's mythology, ruling deity, shakti (power), and soul path. 500 words.

## 🪐 Current Dasha Period
Mahadasha and Antardasha — what themes dominate now, when the next major shift happens, specific dates. 500 words.

## 🏠 12-House Analysis
Lagna: ${RASHI_EN[jyotishData.lagna] || 'unknown'}. Key houses 1st/4th/7th/10th with planetary influences. 800 words.

## 💰 Wealth & Career Destiny
Career paths, financial patterns, best years for wealth, business vs service. 500 words.

## 💕 Love & Relationships
Romantic patterns, ideal partner, marriage timing, relationship karma. 500 words.

## 🏥 Health & Vitality
Ayurvedic constitution, organs to watch, lifestyle recommendations. 400 words.

## 📅 5-Year Forecast (${new Date().getFullYear()}-${new Date().getFullYear()+4})
Year-by-year: career, love, finances, personal growth. 600 words.

## 💎 Remedies & Mantras
Gemstone with carat and finger, daily mantra with pronunciation, charity, auspicious days. 400 words.

## 🎯 Your Personal Fortune Toolkit
Make your destiny work in daily modern life: (1) English name energy — what letter/sound vibration resonates with ${rashiName} and ${nakshatraName}? Suggest 2-3 English names that amplify their chart. (2) WeChat/social media avatar strategy — what colors and visual mood should their profile photo carry to attract destined fortune? Base this on their Rashi element. Give specific color guidance. (3) 3 lucky objects to keep nearby. (4) The most powerful morning ritual for ${nakshatraName}. 500 words.

Language: ${outputLangFull}. Writing style: destiny poetry. Scene over abstraction. No bullet points. Warm literary quality.`

      : `你是一位精通吠陀占星（Jyotish）的大师，同时拥有诗人的灵魂。为${name}写一份命运诗篇式的免费吠陀占星解读。月亮星座（Rashi）：${rashiName}；月宿（Nakshatra）：${nakshatraName}。关注重点：${concern || '整体命运'}。

写作风格：命运诗篇，沉浸式第二人称叙述，场景感代替抽象，严禁bullet points。每章结尾一句金句。

内容章节：
🌙 你的月亮星座：${rashiName}（500字，以金句结尾）
✨ 你的月宿：${nakshatraName}（400字，以金句结尾）
🌟 灵魂天赋与业力（400字，以金句结尾）
📅 ${new Date().getFullYear()}年宇宙能量（400字）
💎 吠陀蓝图幸运指引（宝石/幸运色/方位/咒语，200字）

结尾：温暖地列出5件完整版才揭晓的事（包含专属英文名能量分析+微信头像颜色方案），让人真心好奇。
语言：${outputLangFull}。直接进入叙述，不要免责声明。`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    res.write(`data: ${JSON.stringify({ type: 'meta', tier: full ? 'full' : 'basic', locked: !full, data: jyotishData })}\n\n`);

    const streamBody = await deepseekStream(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: `Please generate the Vedic Jyotish report for ${name}.` }],
      { maxTokens: full ? 16384 : 4000, timeout: 300000 }
    );

    const reader = streamBody.getReader();
    const decoder = new TextDecoder();
    let fullText = '', buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') continue;
        try {
          const json = JSON.parse(raw);
          const content = json.choices?.[0]?.delta?.content || '';
          if (content) { fullText += content; res.write(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`); }
        } catch (e) {}
      }
    }

    insertReading.run('jyotish', JSON.stringify({ name, dob, city, country, concern }), fullText, req.userId);
    const ctxId = saveQaContext('jyotish', req.body, fullText);
    const product = full ? matchProduct(fullText, 'jyotish') : undefined;
    res.write(`data: ${JSON.stringify({ type: 'done', contextId: ctxId })}\n\n`);
    if (product) res.write(`data: ${JSON.stringify({ type: 'product', product })}\n\n`);
    res.end();
  } catch (err) {
    console.error('[JYOTISH-STREAM ERR]', err.message);
    try { res.write(`data: ${JSON.stringify({ type: 'error', message: 'Generation failed, please retry' })}\n\n`); res.end(); } catch(e) {}
  }
});

// ══════════════════════════════════════════
// POST /api/tibet/stream — 藏传命理流式输出（SSE）
// ══════════════════════════════════════════
router.post('/tibet/stream', rateLimitMiddleware, async (req, res) => {
  try {
    const { name, dob, gender, concern, lang } = req.body;
    if (!dob) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: '出生年份必填' });
    }
    const birthYear = new Date(dob).getFullYear();
    const tibetData = calculateTibetan(birthYear);
    const full = hasFullAccess(req, ['tibet_full', 'tibet']);
    const tibetLang = lang === 'zh' ? 'Chinese (Simplified)' : lang === 'kr' ? 'Korean' : 'English';
    const genderStr = gender === 'M' ? 'male' : 'female';

    const tibetLangFull = lang === 'hi' ? 'Hindi' : lang === 'ta' ? 'Tamil' : tibetLang;
    const systemPrompt = full
      ? `You are a Tibetan astrologer (Tsipa) trained in the Bön and Buddhist traditions of Tibetan natal astrology (Kartsi). Write a comprehensive Tibetan destiny reading for ${name} (${genderStr}), born in ${birthYear}. IMPORTANT ACCURACY: ${birthYear} = ${tibetData.element} ${tibetData.zodiac} (${tibetData.elementCN}${tibetData.zodiacCN}). Mewa: ${tibetData.mewaNum}, Parkha: ${tibetData.parkha}, Lungta: ${tibetData.lungta}. Focus: ${concern || 'overall destiny'}.

Write 10,000 words. No bullet points — flowing narrative prose. Each section ends with a golden sentence or Buddhist wisdom line.

## 🐉 Your Animal Sign: ${tibetData.zodiac}
Personality in the three worlds (body, speech, mind), relationships, career, shadow, spiritual gifts. Buddhist teachings on this animal. 800 words.

## 🔥 Your Element: ${tibetData.element} ${tibetData.zodiac}
How ${tibetData.element} colors the ${tibetData.zodiac} — specific expression, life themes, personality paradoxes. 600 words.

## 🔢 Mewa ${tibetData.mewaNum}: Your Sacred Number
Color, element, direction, deity, fate revelations, hidden strengths, karmic lessons. 700 words.

## ☯️ Parkha: Your Trigram Palace
Symbols, ruling element, favorable/unfavorable directions, relationship patterns. 600 words.

## 🐴 Lungta: Wind Horse Power — ${tibetData.lungta}
Deep analysis of this Lungta level — what it means for lifetime fortune, how to strengthen it. 500 words.

## 💕 Relationships & Marriage Compatibility
Compatible/challenging signs with reasons, marriage timing, karmic partnerships. 600 words.

## 💼 Career, Wealth & Life Path
Career directions aligned with Mewa and animal sign, wealth patterns, fortune shift ages. 600 words.

## 📅 3-Year Destiny Forecast (${new Date().getFullYear()}-${new Date().getFullYear()+2})
Year-by-year: auspicious vs challenging, specific guidance. 700 words.

## 🏔️ Health & Longevity
Tibetan medicine constitution, health areas, dietary wisdom. 500 words.

## 🙏 Spiritual Practices & Protections
Mantras, deity practices, offerings, auspicious days, navigating challenges. 600 words.

## 🎯 Your Tibetan Luck Optimization Toolkit
Make ancient wisdom work in your modern life: (1) English name energy — what sound/letter vibration strengthens ${tibetData.element} ${tibetData.zodiac} Lungta? Suggest 2-3 English names for ${name}. (2) WeChat/social avatar strategy — based on Mewa ${tibetData.mewaNum}'s sacred color and ${tibetData.element} element, what specific colors should dominate their profile photo? Give precise descriptions (not just "red" but the exact warmth and shade). (3) 3 Tibetan lucky symbols or objects to keep in living/work space. (4) The single morning practice that most powerfully activates Wind Horse energy. 500 words.

Language: ${tibetLangFull}. Writing style: destiny poetry — each chapter is a step on a mountain pilgrimage, each section ends with a golden line or Buddhist insight. Scene over abstraction. No bullet points. Warm literary quality.`

      : `你是精通藏传命理（Kartsi）的算师，兼具文学家笔触。为${name}（${genderStr}，生于${birthYear}年）写命运诗篇式藏传命理解读。精度要求绝对不能改：${birthYear}年=${tibetData.element}${tibetData.zodiac}（${tibetData.elementCN}${tibetData.zodiacCN}）。密瓦：${tibetData.mewaNum}，帕卡：${tibetData.parkha}，风马：${tibetData.lungta}。

写作要求：沉浸式第二人称，场景感代替抽象，严禁bullet points，每章结尾一句诗意金句。

章节：
🐑 生肖${tibetData.zodiac}（500字，以诗意金句结尾）
⚙️ ${tibetData.element}${tibetData.zodiac}元素灵魂（400字，以金句结尾）
🛡️ 守护元素（300字，以金句结尾）
🐴 风马${tibetData.lungta}（400字，以金句结尾）
🌟 天赋与业力（400字，以金句结尾）
📅 ${new Date().getFullYear()}年运势（300字）
🙏 日常修行（200字）

结尾：温暖列出5件完整版才揭晓的事（含英文名风马能量+微信头像颜色方案），让人心生好奇。
语言：${tibetLangFull}。直接进入${name}的命运叙述，不要免责声明。`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    res.write(`data: ${JSON.stringify({ type: 'meta', tier: full ? 'full' : 'basic', locked: !full, data: tibetData })}\n\n`);

    const streamBody = await deepseekStream(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: `Please generate the Tibetan destiny reading for ${name}.` }],
      { maxTokens: full ? 16384 : 4000, timeout: 300000 }
    );

    const reader = streamBody.getReader();
    const decoder = new TextDecoder();
    let fullText = '', buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') continue;
        try {
          const json = JSON.parse(raw);
          const content = json.choices?.[0]?.delta?.content || '';
          if (content) { fullText += content; res.write(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`); }
        } catch (e) {}
      }
    }

    insertReading.run('tibet', JSON.stringify({ name, dob, gender, concern }), fullText, req.userId);
    const ctxId = saveQaContext('tibet', req.body, fullText);
    const product = full ? matchProduct(fullText, 'tibet') : undefined;
    res.write(`data: ${JSON.stringify({ type: 'done', contextId: ctxId })}\n\n`);
    if (product) res.write(`data: ${JSON.stringify({ type: 'product', product })}\n\n`);
    res.end();
  } catch (err) {
    console.error('[TIBET-STREAM ERR]', err.message);
    try { res.write(`data: ${JSON.stringify({ type: 'error', message: 'Generation failed, please retry' })}\n\n`); res.end(); } catch(e) {}
  }
});

// ══════════════════════════════════════════
// POST /api/maya/stream — 玛雅历流式输出（SSE）
// ══════════════════════════════════════════
router.post('/maya/stream', rateLimitMiddleware, async (req, res) => {
  try {
    const { name, dob, intention, lang } = req.body;
    if (!dob) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: '出生日期必填' });
    }
    const [year, month, day] = dob.split('-').map(Number);
    const tzolkinData = getTzolkin(year, month, day);
    const full = hasFullAccess(req, ['maya_full', 'maya']);
    const mayaLang = lang === 'zh' ? 'Chinese (Simplified)' : lang === 'kr' ? 'Korean' : 'English';

    const mayaLangFull = lang === 'hi' ? 'Hindi' : lang === 'ta' ? 'Tamil' : mayaLang;
    const systemPrompt = full
      ? `You are a master Maya calendar keeper and Tzolkin expert trained in the lineage of the Highland Maya. Write a profound, comprehensive Maya destiny reading for ${name}, born on ${dob}. Their sacred Kin is ${tzolkinData.kin}: ${tzolkinData.tone} ${tzolkinData.daySign}. Focus: ${intention || 'life mission'}.

Write 10,000 words. Every section deeply specific to Kin ${tzolkinData.kin}. No bullet points — flowing narrative. Each section ends with a soul-stirring one-line insight.

## 🌞 Your Sacred Kin: ${tzolkinData.tone} ${tzolkinData.daySign} (Kin ${tzolkinData.kin})
Complete meaning: glyph, galactic tone's power, day sign essence. 800 words.

## 🦅 Your Day Sign: ${tzolkinData.daySign} — Deep Soul Profile
Core nature, thinking style, life mastery, relationships, professional gifts. 1000 words.

## 🎵 Your Galactic Tone: ${tzolkinData.tone}
Soul rhythm — what drives you, your challenge, hidden gift. How tone interacts with day sign. 600 words.

## 🌑 Shadow & Light — Antipode and Analog
Challenge and support energies. How to work with these daily. 700 words.

## 🌀 Your Trecena (13-Day Cycle)
Wavespell you were born into, ruling sign, recurring life themes. 600 words.

## 🐍 Your Oracle — Full 5-Kin Reading
Guide, Antipode, Analog, Occult: complete multi-dimensional nature. 800 words.

## 💫 Year ${new Date().getFullYear()} in Your Tzolkin Cycle
Current 260-day position, amplified themes, most powerful activation dates. 600 words.

## 🌿 Life Mission & Karmic Pattern
Deepest teaching — karmic thread in relationships, work, spiritual path. 700 words.

## 🔮 Love & Relationships Through the Maya Lens
Cosmic compatibility by Kin, relationship patterns, ideal partnership. 600 words.

## 🌏 Your Role in the Collective
Gift Kin ${tzolkinData.kin} brings to the world — archetypal role. 500 words.

## 🌺 Maya Ceremony & Practices
Ceremonial practices, sacred days, offerings, daily Kin alignment. 500 words.

## 🎯 Your Galactic Fortune Toolkit
Daily life optimization through Maya wisdom: (1) English name energy — what sound/initial vibration resonates with ${tzolkinData.daySign} energy? Suggest 2-3 English names that would amplify Kin ${tzolkinData.kin}. (2) WeChat/social avatar strategy — what colors and visual mood carry ${tzolkinData.daySign}'s elemental nature? Be specific: not just "green" but the exact shade, temperature, contrast level. (3) 3 Maya lucky symbols or natural objects to keep nearby. (4) The single daily practice that most powerfully activates Kin ${tzolkinData.kin}'s signature. 500 words.

Language: ${mayaLangFull}. Writing style: destiny poetry — each chapter ends with a copper drum resonance moment. Scene over abstraction. No bullet points. Mystical literary quality.`

      : `你是玛雅高地传承中受训的卓金历法守护者，兼具诗人灵魂。为${name}写命运诗篇式免费玛雅历解读。神圣印记：Kin ${tzolkinData.kin}，${tzolkinData.tone} ${tzolkinData.daySign}。关注：${intention || '生命使命'}。

写作要求：沉浸式第二人称，场景感代替抽象，严禁bullet points，每章结尾一句令人心头一颤的金句。

章节：
🌞 神圣印记Kin${tzolkinData.kin}（400字，以金句结尾）
🦅 太阳图腾${tzolkinData.daySign}（600字，以金句结尾）
🎵 银河音调${tzolkinData.tone}（400字，以金句结尾）
🌟 天赋与功课（400字，以金句结尾）
🌀 ${new Date().getFullYear()}年宇宙能量（300字）
🌺 每日激活仪式（200字）

结尾：温暖列出5件完整版才揭晓的事（含专属英文名银河能量+微信头像色彩方案），让人真心好奇。
语言：${mayaLangFull}。直接进入${name}的命运叙述，不要免责声明。`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    res.write(`data: ${JSON.stringify({ type: 'meta', tier: full ? 'full' : 'basic', locked: !full, data: tzolkinData })}\n\n`);

    const streamBody = await deepseekStream(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: `Please generate the Maya Tzolkin destiny reading for ${name}.` }],
      { maxTokens: full ? 16384 : 4000, timeout: 300000 }
    );

    const reader = streamBody.getReader();
    const decoder = new TextDecoder();
    let fullText = '', buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') continue;
        try {
          const json = JSON.parse(raw);
          const content = json.choices?.[0]?.delta?.content || '';
          if (content) { fullText += content; res.write(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`); }
        } catch (e) {}
      }
    }

    insertReading.run('maya', JSON.stringify({ name, dob, intention }), fullText, req.userId);
    const ctxId = saveQaContext('maya', req.body, fullText);
    const product = full ? matchProduct(fullText, 'maya') : undefined;
    res.write(`data: ${JSON.stringify({ type: 'done', contextId: ctxId })}\n\n`);
    if (product) res.write(`data: ${JSON.stringify({ type: 'product', product })}\n\n`);
    res.end();
  } catch (err) {
    console.error('[MAYA-STREAM ERR]', err.message);
    try { res.write(`data: ${JSON.stringify({ type: 'error', message: 'Generation failed, please retry' })}\n\n`); res.end(); } catch(e) {}
  }
});

// ══════════════════════════════════════════
// POST /api/leads — 收集用户留资
// ══════════════════════════════════════════
router.post('/leads', async (req, res) => {
  try {
    const { email, context } = req.body;
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'invalid email' });
    const leadsFile = path.join(__dirname, '../../data/leads.json');
    let leads = [];
    try { leads = JSON.parse(fs.readFileSync(leadsFile, 'utf8')); } catch(e) {}
    leads.push({ email, context, ts: Date.now() });
    fs.writeFileSync(leadsFile, JSON.stringify(leads, null, 2));
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
