// vision.js — Gemini vision 面相/手相特征提取
// 走 Gemini 的 OpenAI 兼容端点（免费·gemini-2.0-flash）
// 没有 GEMINI_API_KEY 时返回 null，上层优雅降级，不崩。
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), override: true });

const GEMINI_VISION_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const GEMINI_MODEL = 'gemini-2.0-flash';

/**
 * 内部：调 Gemini vision，返回文字描述；失败返回 null。
 * @param {string} systemPrompt
 * @param {string} userText
 * @param {string} imageBase64  — 纯 base64，无 data: 前缀
 * @param {string} mimeType     — 默认 image/jpeg
 */
async function _callGeminiVision(systemPrompt, userText, imageBase64, mimeType) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.info('[vision] GEMINI_API_KEY 未配置，跳过 vision 分析，走降级路径');
    return null;
  }

  const mime = mimeType || 'image/jpeg';
  const body = JSON.stringify({
    model: GEMINI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: userText },
          { type: 'image_url', image_url: { url: `data:${mime};base64,${imageBase64}` } }
        ]
      }
    ],
    temperature: 0.2,
    max_tokens: 800
  });

  try {
    const res = await fetch(GEMINI_VISION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body,
      signal: AbortSignal.timeout(30000)
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.warn('[vision] Gemini vision 请求失败:', res.status, err.slice(0, 120));
      return null;
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    if (!content) { console.warn('[vision] Gemini vision 返回空内容'); return null; }
    return content;
  } catch (e) {
    console.warn('[vision] Gemini vision 网络/超时错误:', e.message);
    return null;
  }
}

/**
 * analyzeFace — 面相照片客观特征提取
 * @param {string} imageBase64  纯 base64 字符串（无 data: 前缀）
 * @param {string} [mimeType]   如 'image/png'，默认 image/jpeg
 * @returns {Promise<string|null>} 结构化特征描述，或 null（无 key / 图片读不清）
 */
async function analyzeFace(imageBase64, mimeType) {
  const SYSTEM = `你是一名专业的面部特征客观描述助手。你的唯一任务是描述照片中**可见**的面部特征，供后续面相解读使用。

严格规则：
1. 只描述照片中**实际可见**的特征，看不清楚的部位明确说"看不清"。
2. 严禁编造、推断、假设任何看不到的特征。
3. 不做任何命运/运势/性格判断——那是后续面相师的工作。
4. 如果照片不是人脸（如风景、物体、模糊），直接说"照片中未检测到清晰人脸"。
5. 输出简体中文，结构清晰，每部分一行。`;

  const USER = `请按以下结构客观描述这张照片中可见的面部特征：

三停比例：上停（发际线到眉头）/ 中停（眉头到鼻尖）/ 下停（鼻尖到下巴）的比例是否均等，哪停偏长或偏短？
五岳形态：额头（宽/窄/饱满/塌陷）、鼻型（鼻准饱满度/鼻梁挺直程度）、左右颧骨（突出/平/饱满）、下巴（圆/尖/宽/短）。
命宫（眉心印堂）：是否宽阔、有无竖纹川字纹、气色（红润/暗沉/正常）。
眼部：眼形（杏眼/丹凤眼/三角眼等）、眼神（有神/无神）、眼皮（单/双）、卧蚕（有无/明显程度）。
眉毛：形状（剑眉/柳叶眉/八字眉等）、浓淡、长短、是否整齐。
鼻子：鼻准（圆润/尖薄/宽大）、鼻梁（挺/塌/高低）。
嘴唇：厚薄、上下唇比例、嘴角（上翘/下垂/平）。
整体气色：面色（红润/偏黄/偏白/偏暗）、皮肤状态（光滑/粗糙）。
其他可见特征：如痣、疤痕、明显特征（可见才写，无则略去）。`;

  return _callGeminiVision(SYSTEM, USER, imageBase64, mimeType);
}

/**
 * analyzePalm — 手相照片客观特征提取
 * @param {string} imageBase64  纯 base64 字符串
 * @param {string} [mimeType]   默认 image/jpeg
 * @returns {Promise<string|null>} 结构化掌纹描述，或 null
 */
async function analyzePalm(imageBase64, mimeType) {
  const SYSTEM = `你是一名专业的掌纹特征客观描述助手。你的唯一任务是描述照片中**可见**的手掌和掌纹特征，供后续手相解读使用。

严格规则：
1. 只描述照片中**实际可见**的特征，看不清楚的部位明确说"看不清"。
2. 严禁编造、推断、假设任何看不到的纹路特征。
3. 不做任何命运/运势/性格判断——那是后续手相师的工作。
4. 生命线相关描述必须注明"线的长短不代表寿命长短"。
5. 如果照片不是手掌，直接说"照片中未检测到清晰手掌"。
6. 输出简体中文，结构清晰，每部分一行。`;

  const USER = `请按以下结构客观描述这张照片中可见的手掌和掌纹特征：

掌型整体：手掌形状（方形/长形/宽短等）、皮肤质感（细腻/粗糙/厚实/偏薄）、整体线纹清晰程度。
感情线（心线）：起点位置（小指下方/无名指下方）、走向（弧形上扬/平直/下弯）、线的深浅、是否有断点或支线、长度（延伸到食指/中指下方）。
智慧线（头线）：起点（与生命线共起/分开）、走向（平直/斜向小鱼际）、长度、深浅、有无支线。
生命线：弧度（大弧/小弧紧贴拇指根）、深浅、长度延伸范围（注：线长不代表寿命）、有无断点或支线。
事业线（命运线）：是否可见、起点位置（手腕/生命线内/月丘）、延伸方向（中指/食指）、清晰程度。
太阳线：无名指下方是否有竖纹，清晰还是模糊。
婚姻线：小指下方是否有横纹，条数和深浅。
八丘饱满度：金星丘（拇指根内侧）饱满/平坦；月丘（小鱼际）饱满/凹陷；木星丘（食指根下）饱满程度。
特殊掌型：是否有通贯手/断掌（感情线与智慧线合为一条横贯全掌）、川字掌或其他明显特征。`;

  return _callGeminiVision(SYSTEM, USER, imageBase64, mimeType);
}

module.exports = { analyzeFace, analyzePalm };
