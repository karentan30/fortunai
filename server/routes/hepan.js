'use strict';
const router = require('express').Router();
const { deepseekChat } = require('../lib/llm');

// POST /api/hepan/match — 两人合并，生成3条免费合婚预览
router.post('/match', async function(req, res) {
  try {
    var b = req.body || {};
    var nameA = (b.nameA || '').trim().slice(0, 20) || '双方甲';
    var nameB = (b.nameB || '').trim().slice(0, 20) || '双方乙';
    var aYear = parseInt(b.aYear) || 1990;
    var aMonth = parseInt(b.aMonth) || 6;
    var aDay = parseInt(b.aDay) || 15;
    var aGender = b.aGender === 'female' ? '女' : '男';
    var bYear = parseInt(b.bYear) || 1992;
    var bMonth = parseInt(b.bMonth) || 3;
    var bDay = parseInt(b.bDay) || 10;
    var bGender = b.bGender === 'female' ? '女' : '男';

    var messages = [
      {
        role: 'system',
        content: '你是善缘平台的八字合婚大师。根据双方生辰，生成简洁、有温度、有洞察力的合婚预览。用中文。'
      },
      {
        role: 'user',
        content: [
          '请根据以下两人信息，给出3条合婚预览洞察（每条1-2句，有具体分析，不要泛泛而谈）：',
          '',
          nameA + '（' + aGender + '）：' + aYear + '年' + aMonth + '月' + aDay + '日',
          nameB + '（' + bGender + '）：' + bYear + '年' + bMonth + '月' + bDay + '日',
          '',
          '格式：严格返回 JSON，结构如下：',
          '{"score": 85, "grade": "天作之合", "previews": [',
          '  {"icon": "🔥", "title": "五行相合", "text": "具体分析..."},',
          '  {"icon": "💬", "title": "性格互补", "text": "具体分析..."},',
          '  {"icon": "💰", "title": "财运缘分", "text": "具体分析..."}',
          ']}',
          '',
          'score为1-100整数，grade为4字评语（如"天造地设"/"相辅相成"/"互补互长"/"刚柔并济"等）。',
          'text每条25-40字，具体有温度，提及生肖/天干/五行等命理细节。'
        ].join('\n')
      }
    ];

    var text = await deepseekChat(messages, { maxTokens: 800, temperature: 0.8 });

    // 提取 JSON
    var match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('解析失败');
    var result = JSON.parse(match[0]);

    res.json({ ok: true, data: result });
  } catch (e) {
    console.error('[hepan/match]', e.message);
    res.status(500).json({ ok: false, error: '测算服务暂时繁忙，请稍后重试' });
  }
});

module.exports = router;
