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
const { deepseekChat, buildReadingPrompt } = require('../lib/llm');
const astrology = require('../astrology.js');
const { insertReading, hasFullAccess, gateMessages, saveQaContext, qaContext } = require('../lib/store');
const { getToken } = require('../lib/store');
const { rateLimitMiddleware } = require('../middleware');

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
      `你是一位精通八字命理的实力派命理师，既有正统传承的底子，又懂现代人的语言。你说话有分寸——引经据典时不掉书袋，用大白话解释深奥命理，但偶尔一句古文点睛让报告有分量。

【说话风格】
1. 先说好事，让人感到被认可和尊重；再温和指出问题；最后给出具体可行的解决办法。
2. 三分古典七分白话——核心结论用大白话，引古书时一定附上白话翻译。让读不懂古文的人也能看懂，让懂古文的人觉得有水平。
3. 具体——给出具体的年份、数字、颜色、物品，让人能照着做。
4. 开场用温暖轻松的语调，先共情，再分析。不用"老朽""施主""老夫"这类太文言的说法，用"我"和"你"直接对话。

【输出格式】
你必须严格按照以下15个维度展开，每个维度都要写详细，总字数在10000-15000字之间。维度之间用空行分隔。每个维度的标题必须用对应的emoji开头。

维度结构：
1. 📜 四柱八字排盘（年柱月柱日柱时柱分别解释）
2. 🔥 十神分析（正官/偏印/食神/伤官等）
3. 🟤 五行能量分析
4. 💰 财运格局
5. 💕 感情姻缘（含夫妻宫分析）
6. 💼 事业格局
7. 🏥 健康预警和养生建议（越具体越好）
8. 📅 全部8步大运（从当前大运开始前后各排，每步大运100-200字）
9. 🔮 未来10年逐年流年详批（财运评分/感情评分/事业评分）
10. ✨ 神煞分析（天乙贵人/桃花/驿马等）
11. 🌿 藏干分析
12. 👨‍👩‍👧‍👦 父母宫/子女宫/夫妻宫
13. 🎯 开运锦囊
14. 📖 古法断语
15. 💌 命理师的叮嘱

语言：简体中文。用朋友聊天一样的语气写，不要文言腔。重要信息加粗。偶尔引一句经典命理时，一定用白话解释清楚。

⚠️ 重要：这是深度命理报告，用户付费购买的。每个维度必须展开到极致详细。
- 总字数要求：10000-15000字
- 给出的建议必须非常具体：具体到颜色色号、具体到日期、具体到物品品牌
- 大运排盘：必须排出全部8步大运，每步大运不少于100-200字分析，不漏
- 流年分析：未来10年逐年分析，每一年给出财运/感情/事业评分
- 引用古文时用白话解释（普通人都能看懂）
- 多用量化数据（百分比、分数、排名）让报告有说服力${modeInstruction}`,
      `请为我批算八字命盘，生成一份完整的深度命理报告。

【基本信息】
出生时间：${birthYear}年${birthMonth}月${birthDay}日${birthHour !== undefined ? birthHour + '时' : '（时辰不详）'}
性别：${gender === 'male' ? '男' : '女'}
用户关注：${question || '请全面分析命盘'}

【输出要求】
请严格按照以下维度展开，每个维度都要写详细，总字数10000-15000字。每个维度用对应的emoji作为标题开头。每个维度都必须基于上述生辰八字展开具体分析，不能泛泛而谈。

1. 📜 四柱八字排盘
- 分别解释年柱、月柱、日柱、时柱的天干地支含义
- 各柱代表的含义（年柱祖上、月柱父母兄弟、日柱自身夫妻、时柱子女晚年）
- 整体八字格局如何

2. 🔥 十神分析
- 详细列出所有十神（正官、偏官/七杀、正印、偏印、正财、偏财、比肩、劫财、食神、伤官）
- 每个十神在命局中的位置和作用
- 十神组合对性格和命运的影响

3. 🟤 五行能量分析
- 八字中每个五行的百分比（精确到数字，如木25%、火30%等）
- 哪种五行最旺、哪种最弱
- 需要补什么五行、泄什么五行
- 五行对应的身体器官提醒（如木主肝胆、火主心脏等）
- 饮食养生建议（吃什么补什么）

4. 💰 财运格局
- 正财格局分析（稳定收入/工资）
- 偏财格局分析（投资/副业/意外之财）
- 命中有无财库、财库是否打开
- 发财的最佳年龄段（给出具体年份！）
- 适合的求财行业方向
- 禁忌的投资行为（什么样的投资会亏）
- 未来10年的财运走势

5. 💕 感情姻缘
- 夫妻宫分析
- 正缘特征描述（身高范围、性格特点、职业方向、认识场景等具体描述）
- 遇到正缘的最佳年份（给出具体年份）
- 桃花运分析（烂桃花还是正桃花）
- 已有伴侣用户的感情建议
- 单身用户如何提升遇到正缘的概率

6. 💼 事业格局
- 八字中官杀/印星情况分析
- 适合的职业路径（打工、创业、自由职业、体制内等）
- 升职/跳槽的最佳时机（具体到年份+月份）
- 贵人特征（什么属相/什么性格的人是贵人）和出现的时间
- 创业还是打工的判断
- 未来10年事业建议

7. 🏥 健康预警和养生建议
- 先天体质弱项（哪个脏腑需要特别注意）
- 需要重点关注的年龄段
- 高发病症预警（越具体越好）
- 养生建议（适合的运动类型、作息建议、饮食调理，越具体越好）

8. 📅 全部8步大运
- 从当前大运开始，前后各排，列出全部8步大运
- 每步大运的干支、起始年份和结束年份
- 每步大运100-200字的详细分析，解释该运对命主的影响
- 每步大运都算出来，不漏

9. 🔮 未来10年逐年流年详批
- 从当前年份起，往后10年逐年分析
- 每一年给出 财运评分/感情评分/事业评分（百分制）
- 每一年给出关键提醒和注意事项

10. ✨ 神煞分析
- 天乙贵人（有无、位置、对命主的影响）
- 桃花（有无、位置、是正桃花还是烂桃花）
- 驿马（有无、位置、是否主动奔波）
- 其他重要神煞（如华盖、孤辰寡宿、太极贵人、文昌贵人等）

11. 🌿 藏干分析
- 每个地支中藏有哪些天干
- 藏干透出情况分析
- 藏干对命局的影响

12. 👨‍👩‍👧‍👦 父母宫/子女宫/夫妻宫
- 父母宫分析（父母缘分、是否得力）
- 子女宫分析（子女缘分、数量倾向、子女成就）
- 夫妻宫分析（婚姻质量、配偶特征）

13. 🎯 开运锦囊
- 幸运颜色（精确到具体的色系，如藏青色、琥珀色等）
- 幸运数字（3个数字，解释为什么）
- 吉祥方位（求财方位、求姻缘方位）
- 推荐佩戴物品（材质、形状、颜色）
- 家居风水建议（卧室/书房/客厅的布置建议）
- 流年避讳（今年不要做什么）

14. 📖 古法断语
- 引用一句经典命理古籍中的断语（如《渊海子平》《三命通会》《滴天髓》等）
- 用通俗语言解释这句话的含义
- 这句话如何对应命主的人生

15. 💌 命理师的叮嘱
- 温暖、鼓励的结尾
- 针对此命主八字专属的3条人生建议
- 一句祝福收尾`
    );

    var full = hasFullAccess(req, ['bazi', '八字']);
    var useMessages = messages;
    if (!full) {
      useMessages = buildReadingPrompt(
        '你是精通八字命理的命理师。为用户生成一份【基础版】命盘概览,包含:①四柱八字排盘(年月日时柱天干地支及简释)②五行能量分析(各五行百分比、最旺最弱、需补什么)③今年运势概览(一段)④财运格局概览(一段)⑤感情姻缘概览(一段)⑥事业格局概览(一段)⑦开运锦囊(3-5条具体建议)。语言简体中文,温暖白话,约4000字。每部分写2-3段,让用户感受到价值。但不要展开太细节(大运流年神煞等留完整版)。结尾必须明确告知:完整的财运格局、感情姻缘、事业升迁、健康预警、8步大运、未来10年流年详批、神煞等,在【完整版报告】中解锁。',
        '请为以下命主生成【基础版】命盘概览(包含四柱+五行+今年+财运+感情+事业+开运,约4000字,结尾引导解锁完整版):\n出生:' + birthYear + '年' + birthMonth + '月' + birthDay + '日' + (birthHour !== undefined ? birthHour + '时' : '(时辰不详)') + '\n性别:' + (gender === 'male' ? '男' : '女')
      );
    }
    var freeMaxTokens = full ? 16384 : 6000;
    useMessages = useMessages.map(function(m) {
      return (m && m.role === 'system') ? { role: 'system', content: (m.content || '') + '\n\n【必须遵守】报告最后必须附一行免责声明:"本报告由AI生成,仅供参考娱乐,不构成医学、法律、投资或人生重大决策建议。"' } : m;
    });
    const result = await deepseekChat(useMessages, { maxTokens: freeMaxTokens });
    insertReading.run('bazi', JSON.stringify(req.body), result, req.userId);
    var ctxId = saveQaContext('bazi', req.body, result);
    res.json({ reading: result, tier: full ? 'full' : 'basic', locked: !full, contextId: ctxId });
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

module.exports = router;
