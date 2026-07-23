require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3020;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Database setup ─────────────────────────────────────────────────────────────
const db = new Database('./shenyuan.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT UNIQUE,
    donor_name TEXT,
    recipient_name TEXT,
    contact TEXT,
    wish_text TEXT,
    temple_id TEXT,
    timing TEXT,
    items TEXT,
    total INTEGER,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    input TEXT,
    result TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const insertOrder = db.prepare(`
  INSERT INTO orders (order_no, donor_name, recipient_name, contact, wish_text, temple_id, timing, items, total)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertReading = db.prepare(`
  INSERT INTO readings (type, input, result) VALUES (?, ?, ?)
`);

// ── Ollama helper ──────────────────────────────────────────────────────────────
function ollamaChat(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [{ role: 'user', content: prompt }],
      stream: false
    });

    const url = new URL(`${OLLAMA_URL}/api/chat`);
    const options = {
      hostname: url.hostname,
      port: url.port || 11434,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.message?.content || parsed.response || '');
        } catch (e) {
          reject(new Error('Ollama parse error: ' + data.slice(0, 200)));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Ollama timeout')); });
    req.write(body);
    req.end();
  });
}

// ── Health ─────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: '善缘 ShenYuan', port: PORT });
});

// ── POST /api/order ────────────────────────────────────────────────────────────
app.post('/api/order', (req, res) => {
  try {
    const { donorName, recipientName, contact, wishText, templeId, timing, items, total } = req.body;
    if (!donorName || !contact || !wishText) {
      return res.status(400).json({ error: '缺少必填字段：姓名、联系方式、祝愿词' });
    }

    const orderNo = `SY-${Date.now()}`;
    insertOrder.run(
      orderNo, donorName, recipientName || '', contact,
      wishText, templeId || '', timing || '',
      JSON.stringify(items || []), total || 0
    );

    console.log(`[ORDER] ${orderNo} — ${donorName} → ${templeId} $${total}`);
    res.json({ orderId: orderNo, status: 'confirmed' });
  } catch (err) {
    console.error('[ORDER ERR]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/orders ────────────────────────────────────────────────────────────
app.get('/api/orders', (req, res) => {
  try {
    const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 100').all();
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/bazi ─────────────────────────────────────────────────────────────
app.post('/api/bazi', async (req, res) => {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, gender, question } = req.body;
    if (!birthYear || !birthMonth || !birthDay) {
      return res.status(400).json({ error: '请提供出生年月日' });
    }

    const prompt = `你是一位精通四柱八字命理的大师。请根据以下信息进行八字分析：

生辰：${birthYear}年${birthMonth}月${birthDay}日${birthHour !== undefined ? birthHour + '时' : ''}
性别：${gender === 'male' ? '男' : '女'}
提问：${question || '请综合分析命盘'}

请详细解析：
1. 日主分析（日干五行属性、强弱）
2. 五行强弱（哪个五行旺？哪个缺？）
3. 大运流年（目前运势走向，未来3年重要节点）
4. 关键吉凶（财运、感情、健康、事业各方面）
5. 建议与化解（如何趋吉避凶）

语言：简体中文，亲切自然，不要太学术。`;

    const reading = await ollamaChat(prompt);
    insertReading.run('bazi', JSON.stringify(req.body), reading);

    // Extract structured fields from the response (simple heuristics)
    const daymasterMatch = reading.match(/日主[是为：:]\s*([^\n，。]{2,10})/);
    res.json({
      reading,
      daymaster: daymasterMatch ? daymasterMatch[1].trim() : '需结合完整命盘分析',
      elements: '详见解读',
      lucky_period: '详见大运分析'
    });
  } catch (err) {
    console.error('[BAZI ERR]', err);
    res.status(500).json({ error: 'Ollama暂时不可用，请稍后重试', detail: err.message });
  }
});

// ── POST /api/tarot ────────────────────────────────────────────────────────────
app.post('/api/tarot', async (req, res) => {
  try {
    const { cards, question, topic } = req.body;
    if (!cards || !cards.length || !question) {
      return res.status(400).json({ error: '请提供牌面和问题' });
    }

    const cardDesc = cards.map((c, i) =>
      `第${i + 1}张（${c.position || '位置' + (i + 1)}）：${c.name}${c.reversed ? '（逆位）' : '（正位）'}`
    ).join('\n');

    const topicMap = { love: '感情姻缘', wealth: '财运事业', health: '健康运势', decision: '抉择指引', year: '年度运势', custom: '综合问询' };
    const topicText = topicMap[topic] || topic || '综合';

    const prompt = `你是一位融合东西方智慧的塔罗占卜师。

问题主题：${topicText}
提问者问题：${question}

抽到的牌：
${cardDesc}

请：
1. 综合解读这组牌阵（200字左右，深入但不晦涩）
2. 给出具体、实用的建议行动（3条，简洁明了）
3. 语气温柔有力，既给出洞见又不武断

格式：
【解读】（正文）
【建议】
- 第一条
- 第二条
- 第三条`;

    const result = await ollamaChat(prompt);
    insertReading.run('tarot', JSON.stringify(req.body), result);

    const interpMatch = result.match(/【解读】([\s\S]*?)(?=【建议】|$)/);
    const adviceMatch = result.match(/【建议】([\s\S]*)/);

    res.json({
      interpretation: interpMatch ? interpMatch[1].trim() : result,
      advice: adviceMatch ? adviceMatch[1].trim() : ''
    });
  } catch (err) {
    console.error('[TAROT ERR]', err);
    res.status(500).json({ error: 'Ollama暂时不可用', detail: err.message });
  }
});

// ── POST /api/ziwei ────────────────────────────────────────────────────────────
app.post('/api/ziwei', async (req, res) => {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, gender } = req.body;
    if (!birthYear || !birthMonth || !birthDay || birthHour === undefined) {
      return res.status(400).json({ error: '紫微斗数需要出生年月日时' });
    }

    const prompt = `你是一位精通紫微斗数的命理师。

出生：${birthYear}年${birthMonth}月${birthDay}日${birthHour}时
性别：${gender === 'male' ? '男' : '女'}

请进行紫微斗数分析：
1. 命宫主星（命宫的主要星曜及其含义）
2. 本命强弱（整体格局评估）
3. 今年流年运势（${new Date().getFullYear()}年的主要运势）
4. 十二宫简析（重点说明命宫、财帛宫、官禄宫、夫妻宫、疾厄宫）
5. 一句话总结此人命运特点

语言：简体中文，通俗易懂，让没学过紫微的人也能理解。`;

    const analysis = await ollamaChat(prompt);
    insertReading.run('ziwei', JSON.stringify(req.body), analysis);

    res.json({
      mainStars: '详见分析',
      palaces: '详见十二宫简析',
      yearFortune: `${new Date().getFullYear()}年流年`,
      analysis
    });
  } catch (err) {
    console.error('[ZIWEI ERR]', err);
    res.status(500).json({ error: 'Ollama暂时不可用', detail: err.message });
  }
});

// ── POST /api/mianxiang ────────────────────────────────────────────────────────
app.post('/api/mianxiang', async (req, res) => {
  try {
    const { question } = req.body;
    // Vision model integration placeholder — use Ollama vision when available
    const prompt = `你是一位擅长面相手相的民间相士。用户的问题是：${question || '请综合分析'}

请基于传统面相学，给出一份通用但有洞见的分析，包括：
1. 额头（思维、早年运）
2. 眼神（内心世界、感情运）
3. 鼻子（财运、中年运）
4. 嘴（表达力、晚年运）
5. 整体面相气场建议

注：真实面相需要照片，此为AI推演，仅供参考。`;

    const reading = await ollamaChat(prompt);
    insertReading.run('mianxiang', JSON.stringify({ question }), reading);

    res.json({
      reading,
      traits: ['AI分析版', '需上传照片获取精准分析'],
      note: '完整面相分析需上传正面照，AI视觉版本即将上线'
    });
  } catch (err) {
    console.error('[MIANXIANG ERR]', err);
    res.status(500).json({ error: 'Ollama暂时不可用', detail: err.message });
  }
});

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n善缘 ShenYuan Backend running on port ${PORT}`);
  console.log(`Ollama: ${OLLAMA_URL} (model: ${OLLAMA_MODEL})`);
  console.log(`Health: http://localhost:${PORT}/api/health\n`);
});
