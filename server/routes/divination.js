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
 * POST /api/omikuji
 * POST /api/rune
 * POST /api/kyusei
 */

const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const { deepseekChat, deepseekStream, buildReadingPrompt } = require('../lib/llm');
const { analyzeFace, analyzePalm } = require('../lib/vision');
const { calcBazi } = require('../bazi');
const { buildBaziBlock } = require('../lib/bazi-engine/prompt-block');
const { computeBaziChart } = require('../lib/bazi-engine');
const astrology = require('../astrology.js');
const { buildWesternBlock } = require('../lib/western-astro-engine/prompt-block');
const { buildLiuyaoBlock } = require('../lib/liuyao-engine/prompt-block');
const { buildQimenBlock } = require('../lib/qimen-engine/prompt-block');
const { computeDaLiuRen } = require('../lib/daliuren-engine');
const { insertReading, hasFullAccess, hasVipAccess, hehunTier, hehunTierReadonly, gateMessages, gateReportAccess, memberTier, monthlyReportCreditRemaining, refundMonthlyReportCredit, saveQaContext, qaContext, _findOrder } = require('../lib/store');

// 🔴 P0-C helper(专家复审): 报告端点若本请求消费了月会员 credit(gateReportAccess/hehunTier 会在
//   req._syCreditUid 打标记), 而后续 LLM 生成抛错, 回补一次 credit, 防"扣了额度没拿到报告"。
//   只对本请求真正扣过 credit 的情况回补(靠标记), 不误退其他请求已合法消费的额度。
function _refundCreditOnFail(req) {
  try {
    if (req && req._syCreditUid != null) {
      refundMonthlyReportCredit(req._syCreditUid, req);
      req._syCreditUid = null; // 幂等: 只退一次
    }
  } catch (e) {}
}
const { getToken } = require('../lib/store');
const { rateLimitMiddleware } = require('../middleware');
const { PRODUCTS, matchProduct } = require('../data/products');

// ── 分层 tier 解析 helper ──
// 根据前端传入的 tier 参数 + gateMessages 返回的 full 标志，确定实际档位。
// 规则：
//   - full=false（未付费）→ 始终 'free'
//   - full=true + req.body.tier==='standard' → 'standard'（$9.9 档，~2500字·核心3-5维）
//   - full=true + 其他 → 'full'（$49 完整版）
// 前端付款完成后应在请求体中传 tier:'standard' 或省略（默认 full）。
function resolveReportTier(gateFull, reqTier) {
  if (!gateFull) return 'free';
  if (reqTier === 'standard') return 'standard';
  return 'full';
}

// ── 语言后缀 helper（SYSTEM prompt 末尾追加语言指令）──
// 八字已有独立语言 handler，此 helper 供其他方法使用。
// 返回应追加到 SYSTEM prompt 末尾的语言指令字符串。
function langSuffix(lang) {
  const MAP = {
    'en':    'Output the ENTIRE report in fluent English. Keep technical terms (e.g. rune names, Japanese terms, divination terms) in their original language with English explanation in parentheses.',
    'ko':    '전체 보고서를 유창한 한국어로 출력하세요. 핵심 술어는 원어를 유지하고 괄호 안에 한국어 설명을 추가하세요.',
    'pt-br': 'Produza o relatório COMPLETO em Português do Brasil fluente.',
    'th':    'แสดงรายงานทั้งหมดเป็นภาษาไทยที่คล่องแคล่ว',
    'es':    'Produce el informe COMPLETO en español fluido.',
  };
  return MAP[lang] ? '\n\n【语言】' + MAP[lang] : '';
}

// ── 合规免责尾注（所有报告必须附加）──
const DISCLAIMER_ZH = '\n\n本报告由AI辅助生成，仅供参考娱乐，不构成医学、法律、投资或人生重大决策建议。健康章节均为养生角度，非医疗诊断，如有健康疑虑请咨询专业医生。';
const DISCLAIMER_EN = '\n\nThis report is AI-assisted and for entertainment/reference only. It does not constitute medical, legal, investment, or life-decision advice. Health sections offer wellness perspectives only — consult a professional for medical concerns.';

// ── VIP/大师档探测（bazi_vip = $199 深度批命）──
// 三条命中路径：
//  1) ADMIN_TOKEN(审核绕过)
//  2) order_no → 查订单，product 精确 === 'bazi_vip'（hub 微信/支付宝无登录主路径）
//  3) 登录态 → hasVipAccess(req,'bazi_vip') 查该登录用户已完成、未过期的 bazi_vip 订单
//     product 精确匹配，普通 full 用户(bazi_full)不会被误判成 VIP。
function detectBaziVip(req) {
  try {
    var auth = req.headers['authorization'] || '';
    var token = auth.indexOf('Bearer ') === 0 ? auth.slice(7) : ((req.body && req.body.token) || '');
    if (process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN) return true;
    var _orderNo = (req.body && req.body.order_no) || '';
    if (_orderNo) {
      var _ord = _findOrder(_orderNo);
      if (_ord && _ord.payment_status === 'completed' && String(_ord.product) === 'bazi_vip') return true;
    }
    // 登录态购买 bazi_vip 的用户（此前只认 order_no 会被降级成 $19，此处补齐）
    if (hasVipAccess(req, 'bazi_vip')) return true;
  } catch (e) {}
  return false;
}

// $199【大师深度批命】相对 $19 完整版的真实增量段（不编造承诺·只加实打实的更深内容）
const BAZI_VIP_ADDON_ZH = `

━━━━━━━━━━━━━━━━━━━━━━
【以下为「大师深度批命」专属增量内容，必须在上述16维度全部写完后，另起以下4个专属章节，每章写实写透，不得省略】

17. 🗓️ 未来24个月逐月流月批（不少于1200字）
- 从当前月份起，逐月批算未来24个月（不止逐年，精确到每个月）
- 每月格式：**[年]年[月]月**：财/情/事三维吉凶+该月最宜做与最忌做的1件事+开运小提醒
- 标出这24个月中3个最关键的转折月份并说明原因

18. 🛡️ 深度化解与开运方案（不少于900字）
- 针对命局忌神/凶煞，给出分层化解方案：日常习惯层、风水布局层、择吉行事层
- 每项化解需说明"化解什么、为什么有效、具体怎么做、多久见效"
- 给出一份可执行的90天开运行动清单（按周排布）

19. 🔀 关键人生决策择时（不少于700字）
- 针对结婚/置业/创业/跳槽/大额投资等重大决策，分别给出未来3年内的最佳时间窗与应回避时段
- 每个决策附一句"若必须提前，如何用化解降低风险"

20. 👑 大师叮嘱与终身命理档案说明（不少于500字）
- 以最高档命理师身份，给命主一段专属的、有分量的终身叮嘱
- 说明本档为「终身命理档案」，命主可在人生关键节点回看本报告对照验证`;

const BAZI_VIP_ADDON_EN = `

━━━━━━━━━━━━━━━━━━━━━━
[The following is EXCLUSIVE to the "Master Deep Reading" tier. After completing all the standard chapters above, add these 4 exclusive chapters — write each fully, do not omit]

🗓️ Month-by-Month Forecast for the Next 24 Months
- Forecast every single month for the next 24 months (not just year-by-year — down to each month)
- Per month: wealth/love/career outlook + the single most-favorable and most-unfavorable action + one lucky tip
- Flag the 3 most pivotal months and explain why

🛡️ Deep Remedies & Fortune-Enhancement Plan
- Layered remedies for unfavorable elements: daily-habit layer, environment/feng-shui layer, timing-selection layer
- For each: what it remedies, why it works, exactly how to do it, and how long until effect
- Provide an actionable 90-day fortune plan laid out week by week

🔀 Optimal Timing for Major Life Decisions
- Best windows and windows to avoid over the next 3 years for marriage, property, starting a business, changing jobs, and large investments
- For each, add one line on how to reduce risk if it must happen earlier

👑 Master's Personal Charge & Lifetime Archive
- A weighty, personalized closing charge from a master-level reader
- Note this tier is a "Lifetime Destiny Archive" the reader can revisit at key life moments`;

// ── 海外语种精确排盘注入 helper ──
// 时辰不详(birthHour无效)时返回空串，不注入(避免编造假时柱)，降级回 LLM 处理"时辰不详"
function baziChartBlock({ birthYear, birthMonth, birthDay, birthHour, gender }) {
  const _hasHour = birthHour !== undefined && birthHour !== null && birthHour !== '';
  return _hasHour ? (buildBaziBlock({ birthYear, birthMonth, birthDay, birthHour, gender }) || '') : '';
}

// ── 视觉命盘卡数据 helper ──
// 返回干净 JSON 供前端渲染四柱图+五行图+格局/十神短卡。
// 五行算法：天干各算1份；地支按主气+藏干加权(本气1, 中气0.5, 余气0.3)。
// 失败时返回 null，前端降级到纯文字报告。
function baziChartData({ birthYear, birthMonth, birthDay, birthHour, gender }) {
  try {
    const ch = computeBaziChart({
      year: Number(birthYear), month: Number(birthMonth),
      day: Number(birthDay), hour: Number(birthHour) || 0,
      gender: gender || 'female', includeZiwei: false
    });
    const b = ch.bazi;
    const sz = b.siZhu;          // {year,month,day,hour:{gan,zhi}}
    const cg = b.cangGan;        // {year,month,day,hour:[{gan,shiShen},...]}
    const en = b.enrichment;
    const ss = b.shiShen;        // {year,month,day,hour: 十神名}

    // 四柱数组 (按年月日时)
    const PILLAR_LABELS_ZH = ['年', '月', '日', '时'];
    const pillars = ['year', 'month', 'day', 'hour'].map(function(k, i) {
      var cangArr = (cg && cg[k]) ? cg[k] : [];
      return {
        label: PILLAR_LABELS_ZH[i],
        gan: sz[k].gan,
        zhi: sz[k].zhi,
        shishen: (ss && ss[k]) ? ss[k] : '',
        cangGan: cangArr.map(function(c) { return c.gan + (c.shiShen ? '('+c.shiShen+')' : ''); }).join('·')
      };
    });

    // 五行分布（天干各1 + 地支本气1/中气0.5/余气0.3）
    const WU_XING_GAN_MAP = {甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'};
    var counts = { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0 };
    ['year','month','day','hour'].forEach(function(k) {
      // 天干 +1
      var ganElem = WU_XING_GAN_MAP[sz[k].gan];
      if (ganElem) counts[ganElem] = (counts[ganElem] || 0) + 1;
      // 地支藏干加权
      var cangArr = (cg && cg[k]) ? cg[k] : [];
      cangArr.forEach(function(c, idx) {
        var cElem = WU_XING_GAN_MAP[c.gan];
        if (!cElem) return;
        var weight = idx === 0 ? 1 : (idx === 1 ? 0.5 : 0.3);
        counts[cElem] = (counts[cElem] || 0) + weight;
      });
    });
    // 保留1位小数，归整
    Object.keys(counts).forEach(function(k) { counts[k] = Math.round(counts[k] * 10) / 10; });

    // 格局 / 旺衰 / 喜用
    var geju = (en && en['格局'] && en['格局'].primary) ? en['格局'].primary : '';
    var wangShuai = (en && en['旺衰'] && en['旺衰'].verdict) ? en['旺衰'].verdict : '';
    var yongshen = (en && en['调候用神'] && Array.isArray(en['调候用神'])) ? en['调候用神'].join('·') : '';
    var missing = (en && en['五行统计'] && en['五行统计'].missing) ? en['五行统计'].missing : [];
    var strongest = (en && en['五行统计'] && en['五行统计'].strongest) ? en['五行统计'].strongest : [];

    // 大运简表（前8步）
    var dayun = [];
    if (b.dayun && Array.isArray(b.dayun)) {
      dayun = b.dayun.slice(0, 8).map(function(d) {
        return {
          ganZhi: d.ganZhi ? (d.ganZhi.gan + d.ganZhi.zhi) : '',
          startAge: d.startAge,
          endAge: d.endAge,
          ganShiShen: d.ganShiShen || '',
          zhiShiShen: d.zhiShiShen || ''
        };
      });
    }

    return {
      pillars: pillars,
      dayMaster: b.dayMaster,
      dayMasterElement: (WU_XING_GAN_MAP[b.dayMaster] || ''),
      wuxing: counts,
      missing: missing,
      strongest: strongest,
      geju: geju,
      wangShuai: wangShuai,
      yongshen: yongshen,
      dayun: dayun
    };
  } catch (e) {
    console.warn('[baziChartData]', e && e.message);
    return null;
  }
}

// 各语言"严格使用上方精确排盘"指令（排盘块本体是中文·万年历术语通用·此句用本地语言强约束 LLM 不自排）
const CHART_STRICT = {
  en: '\n\n[PRECISE CHART — computed by a professional Chinese perpetual-calendar engine below. You MUST use exactly these Four Pillars, Day Master, Ten Gods, hidden stems, pattern, favorable elements and Luck Cycles (大运). Do NOT recompute, guess, or alter any pillar or Luck Cycle. Interpret only. Render all BaZi terms (Ten Gods 十神, symbolic stars 神煞, chart pattern 格局) using the STANDARD Chinese-English glossary — do NOT transliterate/phoneticize them.]\n',
  ko: '\n\n[정밀 만세력 사주판 — 아래는 전문 만세력 엔진이 계산한 결과입니다. 사주(년월일시柱)·일간·십성·지장간·용신·대운을 반드시 그대로 사용하고, 절대 스스로 다시 계산하거나 바꾸지 마세요. 해석만 하세요. 십성·신살·격국 등 명리 용어는 표준 한국 명리 역어로 쓰고, 음역(음차)하지 마세요.]\n',
  'pt-br': '\n\n[MAPA PRECISO — calculado por um motor profissional de calendário chinês abaixo. Use EXATAMENTE estes Quatro Pilares, Mestre do Dia, Dez Deuses, elementos e Ciclos de Sorte (大运). NÃO recalcule nem altere. Apenas interprete. Traduza os termos de BaZi (Dez Deuses 十神, estrelas simbólicas 神煞, padrão 格局) pelo glossário chinês-inglês PADRÃO — NÃO transliteie foneticamente.]\n',
  th: '\n\n[แผนภูมิที่แม่นยำ — คำนวณโดยเครื่องมือปฏิทินจีนมืออาชีพด้านล่าง โปรดใช้สี่เสา ธาตุประจำวัน สิบเทพ ธาตุ และวัฏจักรโชคชะตา (大运) ตามนี้ทุกประการ ห้ามคำนวณใหม่หรือแก้ไข ให้ตีความเท่านั้น คำศัพท์โหราศาสตร์ปาจี (สิบเทพ 十神, ดาวสัญลักษณ์ 神煞, รูปแบบดวง 格局) ให้ใช้คำแปลมาตรฐานจีน-อังกฤษ ห้ามทับศัพท์ตามเสียง]\n',
  es: '\n\n[MAPA PRECISO — calculado por un motor profesional de calendario chino abajo. Usa EXACTAMENTE estos Cuatro Pilares, Maestro del Día, Diez Dioses, elementos y Ciclos de Suerte (大运). NO recalcules ni modifiques. Solo interpreta. Traduce los términos de BaZi (Diez Dioses 十神, estrellas simbólicas 神煞, patrón 格局) con el glosario chino-inglés ESTÁNDAR — NO los transliteres fonéticamente.]\n',
  'en-in': '\n\n[PRECISE CHART — computed by a professional Chinese perpetual-calendar engine below. You MUST use exactly these Four Pillars, Day Master, Ten Gods, hidden stems, favorable elements and Luck Cycles (大运). Do NOT recompute or alter any pillar or cycle. Interpret only. Render all BaZi terms (Ten Gods 十神, symbolic stars 神煞, chart pattern 格局) using the STANDARD Chinese-English glossary — do NOT transliterate/phoneticize them.]\n'
};

// 各语言"健康章节软化"约束（与中文一致：不点名西医病名·改中医脏腑角度）
// 注入进各外语 sysPrompt。EN/KR/PT/TH/ES/IN 六语种。
const HEALTH_SOFT = {
  en: '\n\n[Health section: do NOT name Western biomedical diagnoses (nodules, hyperplasia, tumors, specific diseases). Instead describe from the TCM organ-system / constitution angle (e.g. liver-qi tends to stagnate, watch the digestive/cardiovascular system) and land on foods, habits and check-up directions. Never induce fear.]',
  ko: '\n\n[건강 항목: 결절·증식·종양 등 서양 의학 병명을 지목하지 마세요. 대신 한의학 장부·체질 관점(예: 간기 울결 경향, 소화기/심혈관계 주의)으로 서술하고, 음식·습관·정기검진 방향으로 마무리하세요. 겁주지 마세요.]',
  'pt-br': '\n\n[Seção de saúde: NÃO cite diagnósticos biomédicos ocidentais (nódulos, hiperplasia, tumores, doenças específicas). Descreva pelo ângulo dos sistemas de órgãos / constituição da MTC (ex.: o qi do fígado tende a estagnar, atenção ao sistema digestivo/cardiovascular) e finalize com alimentos, hábitos e direções de check-up. Nunca gere medo.]',
  th: '\n\n[หัวข้อสุขภาพ: ห้ามระบุชื่อโรคทางการแพทย์ตะวันตก (ก้อนเนื้อ ติ่งเนื้อ เนื้องอก โรคเฉพาะ) ให้บรรยายจากมุมระบบอวัยวะ/ธาตุเจ้าเรือนแบบแพทย์แผนจีน (เช่น ชี่ตับมักติดขัด ระวังระบบย่อยอาหาร/หัวใจหลอดเลือด) และปิดท้ายด้วยอาหาร นิสัย และแนวทางตรวจสุขภาพ อย่าทำให้ตกใจกลัว]',
  es: '\n\n[Sección de salud: NO nombres diagnósticos biomédicos occidentales (nódulos, hiperplasia, tumores, enfermedades específicas). Descríbelo desde el ángulo de los sistemas de órganos / constitución de la MTC (p. ej. el qi del hígado tiende a estancarse, atención al sistema digestivo/cardiovascular) y termina con alimentos, hábitos y direcciones de chequeo. Nunca generes miedo.]',
  'en-in': '\n\n[Health section: do NOT name Western biomedical diagnoses (nodules, hyperplasia, tumours, specific diseases). Instead describe from the TCM organ-system / constitution angle (e.g. liver-qi tends to stagnate, watch the digestive/cardiovascular system) and land on foods, habits and check-up directions. Never induce fear.]'
};

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
    var full = gateReportAccess(req, ['bazi', '사주', '八字']).full;
    // 订单号解锁：hub WeChat/Alipay 付款后无登录账号时使用
    if (!full) {
      var _orderNo = (req.body && req.body.order_no) || '';
      if (_orderNo) {
        var _ord = _findOrder(_orderNo);
        if (_ord && _ord.payment_status === 'completed' && ['bazi_full','bazi_vip'].includes(_ord.product)) full = true;
      }
    }
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
      + HEALTH_SOFT.ko + modeIns + freePart;

    const _chartKo = baziChartBlock({ birthYear, birthMonth, birthDay, birthHour, gender });
    const userPrompt = `내 사주를 봐주세요.
출생: ${birthYear}년 ${birthMonth}월 ${birthDay}일${birthHour !== undefined && birthHour !== '' ? ' ' + birthHour + '시' : ' (태어난 시간 모름)'}
성별: ${gender === 'male' ? '남성' : '여성'}
관심: ${question || '전체 운세'}
${_chartKo ? CHART_STRICT.ko + _chartKo + '\n' : ''}
사주명리로 심층 분석해 주세요.`;

    const messages = buildReadingPrompt(sysPrompt, userPrompt);
    const result = await deepseekChat(messages, { maxTokens: full ? 16384 : 3500 });
    insertReading.run('bazi', JSON.stringify(req.body), result, req.userId);
    var ctxId = saveQaContext('bazi', req.body, result);
    var _bz = null;
    try { _bz = calcBazi(Number(birthYear), Number(birthMonth), Number(birthDay), Number(birthHour)||0, gender||'female'); } catch(e) {}
    var pillars = _bz ? {
      year:  { gan: _bz.year.gan,  zhi: _bz.year.zhi,  label: '년주' },
      month: { gan: _bz.month.gan, zhi: _bz.month.zhi, label: '월주' },
      day:   { gan: _bz.day.gan,   zhi: _bz.day.zhi,   label: '일주' },
      hour:  { gan: _bz.hour.gan,  zhi: _bz.hour.zhi,  label: '시주' },
      dayMaster: _bz.dayMaster,
      dayMasterElement: _bz.dayMasterElement
    } : null;
    res.json({ reading: result, tier: full ? 'full' : 'basic', locked: !full, contextId: ctxId, pillars });
  } catch (err) {
    _refundCreditOnFail(req);
    console.error('[BAZI-KO ERR]', err.message);
    res.status(500).json({ error: 'AI가 잠시 바빠요. 잠시 후 다시 시도해 주세요.' });
  }
}

// ══════════════════════════════════════════
// 英语八字处理器
// ══════════════════════════════════════════
async function baziEnglishHandler(req, res) {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, gender, order_no } = req.body;
    var full = gateReportAccess(req, ['bazi', '사주', '八字']).full;
    if (!full && order_no) {
      var _o = _findOrder(order_no);
      if (_o && _o.payment_status === 'completed' && ['bazi_full','bazi_vip'].includes(_o.product)) full = true;
    }

    const freeSuffix = full ? '' : `\n\nIMPORTANT: This is the free preview. Output ONLY these 3 chapters:\n📜 Four Pillars Chart\n🌊 Five Elements Analysis\n🌟 This Year's Fortune\n\nAfter completing these 3 chapters (around 1000-1500 words total), output exactly:\n---LOCKED---\n\nThen output a brief teaser listing the locked chapters:\n💰 Wealth & Career Destiny — unlocked in full report\n💕 Love & Marriage Timing — unlocked in full report\n💼 Career Path & Peak Years — unlocked in full report\n📅 Ten-Year Luck Cycles (大运) — unlocked in full report\n🔮 Year-by-Year Forecast — unlocked in full report`;

    const sysPrompt = `You are a master BaZi (Four Pillars of Destiny) reader with 30+ years of experience, trained in classical Eastern metaphysics (BaZi / Four Pillars). You write warm, insightful, and practical reports in fluent English. You explain metaphysical concepts clearly without jargon, and always give specific, actionable advice. Never be scary or fatalistic — you help people understand their strengths and navigate challenges. Refer to this tradition as 'BaZi' or 'Eastern metaphysics' — avoid the word 'Chinese' in the reading itself to keep it culturally inclusive.${HEALTH_SOFT.en}${freeSuffix}`;

    const userPrompt = `Please analyze my BaZi chart and generate a deep destiny report.

Birth details:
- Date: ${birthYear}/${birthMonth}/${birthDay}${birthHour !== undefined && birthHour !== '' ? ', Hour: ' + birthHour + ':00' : ' (birth hour unknown)'}
- Gender: ${gender === 'male' ? 'Male' : 'Female'}

${full ? `Generate a comprehensive report with these sections (emoji heading required for each):
📜 Four Pillars Chart (year/month/day/hour pillars, Day Master analysis, chart pattern — min 600 words)
🌊 Five Elements Analysis (balance, strengths, what to cultivate — min 500 words)
🌟 This Year's Fortune (2026-2027 overview — min 400 words)
💰 Wealth & Finance Destiny (wealth stars, peak income years, best industries — min 600 words)
💕 Love & Relationships (marriage timing, ideal partner traits, relationship patterns — min 600 words)
💼 Career & Life Purpose (best career paths, peak career years, mentor directions — min 600 words)
📅 Ten-Year Luck Cycles (all major 大运 cycles with years and analysis — min 800 words)
🔮 Year-by-Year Forecast (next 10 years, rating each year — min 600 words)
🎯 Personalized Recommendations (favorable elements, auspicious directions, supportive colors, lifestyle rhythms aligned with your Day Master element, seasonal rituals — all grounded in Five Element theory — min 400 words)
💌 A Personal Message (warm, personalized closing note — min 300 words)` : `Generate a free preview with ONLY these 3 sections then the LOCKED separator.`}`;

    const _chartEn = baziChartBlock({ birthYear, birthMonth, birthDay, birthHour, gender });
    const userPromptEn = userPrompt + (_chartEn ? CHART_STRICT.en + _chartEn + '\n' : '');
    const messages = buildReadingPrompt(sysPrompt, userPromptEn);
    const result = await deepseekChat(messages, { maxTokens: full ? 16384 : 3500 });
    // $199 大师档增量（英文·第二次调用追加4个专属章节）
    let resultEn2 = result;
    if (full && detectBaziVip(req)) {
      try {
        const _vm = buildReadingPrompt('You are a master-tier BaZi reader.' + (_chartEn ? CHART_STRICT.en + _chartEn + '\n' : '') + BAZI_VIP_ADDON_EN,
          'This is the exclusive add-on for the same person. Output ONLY the 4 exclusive chapters (24-month monthly forecast / deep remedies / decision timing / master charge). Do not repeat earlier chapters. Birth: ' + birthYear + '/' + birthMonth + '/' + birthDay + (birthHour !== undefined && birthHour !== '' ? ' ' + birthHour + ':00' : '') + ', ' + (gender === 'male' ? 'Male' : 'Female'));
        const _vp = await deepseekChat(_vm, { maxTokens: full ? 16384 : 3500 });
        if (_vp && _vp.trim()) resultEn2 = result + '\n\n' + _vp;
      } catch (_e) { console.warn('[BAZI-EN VIP addon]', _e && _e.message); }
    }
    insertReading.run('bazi', JSON.stringify(req.body), resultEn2, req.userId);
    var ctxId = saveQaContext('bazi', req.body, resultEn2);
    var _bze = null;
    try { _bze = calcBazi(Number(birthYear), Number(birthMonth), Number(birthDay), Number(birthHour)||0, gender||'female'); } catch(e) {}
    var pillarsEn = _bze ? {
      year:  { gan: _bze.year.gan,  zhi: _bze.year.zhi,  label: 'Year Pillar' },
      month: { gan: _bze.month.gan, zhi: _bze.month.zhi, label: 'Month Pillar' },
      day:   { gan: _bze.day.gan,   zhi: _bze.day.zhi,   label: 'Day Pillar' },
      hour:  { gan: _bze.hour.gan,  zhi: _bze.hour.zhi,  label: 'Hour Pillar' },
      dayMaster: _bze.dayMaster,
      dayMasterElement: _bze.dayMasterElement
    } : null;
    res.json({ reading: resultEn2, tier: full ? 'full' : 'basic', locked: !full, contextId: ctxId, pillars: pillarsEn });
  } catch (err) {
    _refundCreditOnFail(req);
    console.error('[BAZI-EN ERR]', err.message);
    res.status(500).json({ error: 'The AI reader is temporarily busy. Please try again in a moment.' });
  }
}

// ══════════════════════════════════════════
// 葡语八字处理器 (PT-BR)
// ══════════════════════════════════════════
async function baziPtBrHandler(req, res) {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, gender, order_no } = req.body;
    var full = gateReportAccess(req, ['bazi', '사주', '八字']).full;
    if (!full && order_no) {
      var _o = _findOrder(order_no);
      if (_o && _o.payment_status === 'completed' && ['bazi_full','bazi_vip'].includes(_o.product)) full = true;
    }
    const freeSuffix = full ? '' : `\n\nIMPORTANTE: Esta é a prévia gratuita. Gere APENAS estes 3 capítulos:\n📜 Mapa dos Quatro Pilares\n🌊 Análise dos Cinco Elementos\n🌟 Fortuna deste Ano\n\nApós completar os 3 capítulos (~1000-1500 palavras), escreva exatamente:\n---LOCKED---\n\nDepois liste os capítulos bloqueados:\n💰 Destino Financeiro e Profissional — disponível no relatório completo\n💕 Amor e Relacionamentos — disponível no relatório completo\n💼 Carreira e Propósito de Vida — disponível no relatório completo\n📅 Ciclos de Sorte de 10 Anos — disponível no relatório completo\n🔮 Previsão Ano a Ano — disponível no relatório completo`;
    const sysPrompt = `Você é um mestre em BaZi (Quatro Pilares do Destino) com mais de 30 anos de experiência na metafísica clássica chinesa. Você escreve relatórios calorosos, perspicazes e práticos em português brasileiro fluente. Explique os conceitos metafísicos chineses claramente, sem jargões, e sempre dê conselhos específicos e acionáveis. Nunca seja assustador ou fatalista — ajude as pessoas a entender seus pontos fortes e navegar pelos desafios.${HEALTH_SOFT['pt-br']}${freeSuffix}`;
    const userPrompt = `Por favor, analise meu mapa BaZi e gere um relatório de destino.\n\nDados de nascimento:\n- Data: ${birthYear}/${birthMonth}/${birthDay}${birthHour !== undefined && birthHour !== '' ? ', Hora: ' + birthHour + ':00' : ' (hora de nascimento desconhecida)'}\n- Gênero: ${gender === 'male' ? 'Masculino' : 'Feminino'}\n\n${full ? `Gere um relatório completo com estas seções (título com emoji obrigatório):\n📜 Mapa dos Quatro Pilares (mín. 600 palavras)\n🌊 Análise dos Cinco Elementos (mín. 500 palavras)\n🌟 Fortuna deste Ano 2025-2026 (mín. 400 palavras)\n💰 Destino Financeiro (mín. 600 palavras)\n💕 Amor e Relacionamentos (mín. 600 palavras)\n💼 Carreira e Propósito (mín. 600 palavras)\n📅 Ciclos de Sorte de 10 Anos (mín. 800 palavras)\n🔮 Previsão Ano a Ano próximos 10 anos (mín. 600 palavras)\n🎯 Recomendações Personalizadas (mín. 400 palavras)\n💌 Mensagem Pessoal (mín. 300 palavras)` : `Gere apenas a prévia gratuita com os 3 capítulos e o separador LOCKED.`}`;
    const _chartPt = baziChartBlock({ birthYear, birthMonth, birthDay, birthHour, gender });
    const messages = buildReadingPrompt(sysPrompt, userPrompt + (_chartPt ? CHART_STRICT['pt-br'] + _chartPt + '\n' : ''));
    const result = await deepseekChat(messages, { maxTokens: full ? 16384 : 3500 });
    insertReading.run('bazi', JSON.stringify(req.body), result, req.userId);
    var ctxId = saveQaContext('bazi', req.body, result);
    res.json({ reading: result, tier: full ? 'full' : 'basic', locked: !full, contextId: ctxId });
  } catch (err) {
    _refundCreditOnFail(req);
    console.error('[BAZI-PT ERR]', err.message);
    res.status(500).json({ error: 'O leitor de IA está temporariamente ocupado. Tente novamente em breve.' });
  }
}

// ══════════════════════════════════════════
// 泰语八字处理器 (TH)
// ══════════════════════════════════════════
async function baziThHandler(req, res) {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, gender, order_no } = req.body;
    var full = gateReportAccess(req, ['bazi', '사주', '八字']).full;
    if (!full && order_no) {
      var _o = _findOrder(order_no);
      if (_o && _o.payment_status === 'completed' && ['bazi_full','bazi_vip'].includes(_o.product)) full = true;
    }
    const freeSuffix = full ? '' : `\n\nสำคัญ: นี่คือตัวอย่างฟรี กรุณาสร้างเฉพาะ 3 บทนี้:\n📜 แผนภูมิสี่เสา\n🌊 การวิเคราะห์ธาตุทั้งห้า\n🌟 โชคลาภปีนี้\n\nหลังจากเสร็จ 3 บท (ประมาณ 1000-1500 คำ) ให้เขียน:\n---LOCKED---\n\nจากนั้นระบุบทที่ล็อก:\n💰 โชคลาภและการเงิน — ปลดล็อกในรายงานฉบับเต็ม\n💕 ความรักและความสัมพันธ์ — ปลดล็อกในรายงานฉบับเต็ม\n💼 อาชีพและเส้นทางชีวิต — ปลดล็อกในรายงานฉบับเต็ม\n📅 วัฏจักรโชคชะตา 10 ปี — ปลดล็อกในรายงานฉบับเต็ม\n🔮 พยากรณ์รายปี — ปลดล็อกในรายงานฉบับเต็ม`;
    const sysPrompt = `คุณเป็นปรมาจารย์ด้านปาจี (สี่เสาแห่งโชคชะตา) ที่มีประสบการณ์มากกว่า 30 ปีในอภิปรัชญาจีนคลาสสิก คุณเขียนรายงานที่อบอุ่น เข้าถึงได้ และปฏิบัติได้จริงในภาษาไทยที่คล่องแคล่ว อธิบายแนวคิดจีนโบราณอย่างชัดเจน และให้คำแนะนำที่เป็นรูปธรรม ไม่มีการทำนายที่น่ากลัว — ช่วยให้ผู้คนเข้าใจจุดแข็งของตนเอง${HEALTH_SOFT.th}${freeSuffix}`;
    const userPrompt = `กรุณาวิเคราะห์แผนภูมิปาจีของฉันและสร้างรายงานโชคชะตา\n\nข้อมูลการเกิด:\n- วันที่: ${birthYear}/${birthMonth}/${birthDay}${birthHour !== undefined && birthHour !== '' ? ', เวลา: ' + birthHour + ':00' : ' (ไม่ทราบเวลาเกิด)'}\n- เพศ: ${gender === 'male' ? 'ชาย' : 'หญิง'}\n\n${full ? `สร้างรายงานฉบับเต็มพร้อมหัวข้อ emoji:\n📜 แผนภูมิสี่เสา (อย่างน้อย 600 คำ)\n🌊 การวิเคราะห์ธาตุทั้งห้า (อย่างน้อย 500 คำ)\n🌟 โชคลาภปีนี้ 2025-2026 (อย่างน้อย 400 คำ)\n💰 โชคลาภการเงิน (อย่างน้อย 600 คำ)\n💕 ความรักและความสัมพันธ์ (อย่างน้อย 600 คำ)\n💼 อาชีพและเส้นทางชีวิต (อย่างน้อย 600 คำ)\n📅 วัฏจักรโชคชะตา 10 ปี (อย่างน้อย 800 คำ)\n🔮 พยากรณ์รายปี 10 ปีข้างหน้า (อย่างน้อย 600 คำ)\n🎯 คำแนะนำส่วนตัว (อย่างน้อย 400 คำ)\n💌 ข้อความส่วนตัว (อย่างน้อย 300 คำ)` : `สร้างเฉพาะตัวอย่างฟรี 3 บทและตัวคั่น LOCKED`}`;
    const _chartTh = baziChartBlock({ birthYear, birthMonth, birthDay, birthHour, gender });
    const messages = buildReadingPrompt(sysPrompt, userPrompt + (_chartTh ? CHART_STRICT.th + _chartTh + '\n' : ''));
    const result = await deepseekChat(messages, { maxTokens: full ? 16384 : 3500 });
    insertReading.run('bazi', JSON.stringify(req.body), result, req.userId);
    var ctxId = saveQaContext('bazi', req.body, result);
    res.json({ reading: result, tier: full ? 'full' : 'basic', locked: !full, contextId: ctxId });
  } catch (err) {
    _refundCreditOnFail(req);
    console.error('[BAZI-TH ERR]', err.message);
    res.status(500).json({ error: 'นักพยากรณ์ AI ยุ่งชั่วคราว กรุณาลองใหม่อีกครั้ง' });
  }
}

// ══════════════════════════════════════════
// 西班牙语八字处理器 (ES-LATAM)
// ══════════════════════════════════════════
async function baziEsHandler(req, res) {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, gender, order_no } = req.body;
    var full = gateReportAccess(req, ['bazi', '사주', '八字']).full;
    if (!full && order_no) {
      var _o = _findOrder(order_no);
      if (_o && _o.payment_status === 'completed' && ['bazi_full','bazi_vip'].includes(_o.product)) full = true;
    }
    const freeSuffix = full ? '' : `\n\nIMPORTANTE: Esta es la vista previa gratuita. Genera SOLO estos 3 capítulos:\n📜 Mapa de los Cuatro Pilares\n🌊 Análisis de los Cinco Elementos\n🌟 Fortuna de este Año\n\nTras completar los 3 capítulos (~1000-1500 palabras), escribe exactamente:\n---LOCKED---\n\nLuego lista los capítulos bloqueados:\n💰 Destino Financiero y Profesional — disponible en el reporte completo\n💕 Amor y Relaciones — disponible en el reporte completo\n💼 Carrera y Propósito de Vida — disponible en el reporte completo\n📅 Ciclos de Suerte de 10 Años — disponible en el reporte completo\n🔮 Pronóstico Año a Año — disponible en el reporte completo`;
    const sysPrompt = `Eres un maestro en BaZi (Cuatro Pilares del Destino) con más de 30 años de experiencia en metafísica clásica china. Escribes reportes cálidos, perspicaces y prácticos en español latinoamericano fluido. Explicas los conceptos metafísicos chinos con claridad, sin jergas, y siempre das consejos específicos y accionables. Nunca seas aterrador ni fatalista — ayuda a las personas a entender sus fortalezas y navegar los desafíos.${HEALTH_SOFT.es}${freeSuffix}`;
    const userPrompt = `Por favor analiza mi mapa BaZi y genera un reporte de destino profundo.\n\nDatos de nacimiento:\n- Fecha: ${birthYear}/${birthMonth}/${birthDay}${birthHour !== undefined && birthHour !== '' ? ', Hora: ' + birthHour + ':00' : ' (hora de nacimiento desconocida)'}\n- Género: ${gender === 'male' ? 'Masculino' : 'Femenino'}\n\n${full ? `Genera un reporte completo con estas secciones (título con emoji obligatorio):\n📜 Mapa de los Cuatro Pilares (mín. 600 palabras)\n🌊 Análisis de los Cinco Elementos (mín. 500 palabras)\n🌟 Fortuna de este Año 2025-2026 (mín. 400 palabras)\n💰 Destino Financiero (mín. 600 palabras)\n💕 Amor y Relaciones (mín. 600 palabras)\n💼 Carrera y Propósito (mín. 600 palabras)\n📅 Ciclos de Suerte de 10 Años (mín. 800 palabras)\n🔮 Pronóstico Año a Año próximos 10 años (mín. 600 palabras)\n🎯 Recomendaciones Personalizadas (mín. 400 palabras)\n💌 Mensaje Personal (mín. 300 palabras)` : `Genera solo la vista previa gratuita con los 3 capítulos y el separador LOCKED.`}`;
    const _chartEs = baziChartBlock({ birthYear, birthMonth, birthDay, birthHour, gender });
    const messages = buildReadingPrompt(sysPrompt, userPrompt + (_chartEs ? CHART_STRICT.es + _chartEs + '\n' : ''));
    const result = await deepseekChat(messages, { maxTokens: full ? 16384 : 3500 });
    insertReading.run('bazi', JSON.stringify(req.body), result, req.userId);
    var ctxId = saveQaContext('bazi', req.body, result);
    res.json({ reading: result, tier: full ? 'full' : 'basic', locked: !full, contextId: ctxId });
  } catch (err) {
    _refundCreditOnFail(req);
    console.error('[BAZI-ES ERR]', err.message);
    res.status(500).json({ error: 'El lector de IA está temporalmente ocupado. Por favor intenta de nuevo.' });
  }
}

// ══════════════════════════════════════════
// 印度英语八字处理器 (EN-IN)
// ══════════════════════════════════════════
async function baziInHandler(req, res) {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, gender, order_no } = req.body;
    var full = gateReportAccess(req, ['bazi', '사주', '八字']).full;
    if (!full && order_no) {
      var _o = _findOrder(order_no);
      if (_o && _o.payment_status === 'completed' && ['bazi_full','bazi_vip'].includes(_o.product)) full = true;
    }
    const freeSuffix = full ? '' : `\n\nIMPORTANT: This is the free preview. Output ONLY these 3 chapters:\n📜 Four Pillars Chart\n🌊 Five Elements Analysis\n🌟 This Year's Fortune\n\nAfter completing these 3 chapters (around 1000-1500 words total), output exactly:\n---LOCKED---\n\nThen list the locked chapters:\n💰 Wealth & Finance Destiny — unlocked in full report\n💕 Love & Marriage Timing — unlocked in full report\n💼 Career & Life Purpose — unlocked in full report\n📅 Ten-Year Luck Cycles — unlocked in full report\n🔮 Year-by-Year Forecast — unlocked in full report`;
    const sysPrompt = `You are a master BaZi (Four Pillars of Destiny) reader with 30+ years of experience. You blend Chinese BaZi wisdom with insights that resonate deeply with Indian users — drawing parallels to Jyotish concepts like Rashi, Dasha, and Karma where helpful, while keeping the analysis rooted in BaZi. You write warm, insightful, and practical reports in fluent Indian English. Never be scary or fatalistic. Give specific, actionable guidance.${HEALTH_SOFT['en-in']}${freeSuffix}`;
    const userPrompt = `Please analyse my BaZi chart and generate a deep destiny report.\n\nBirth details:\n- Date: ${birthYear}/${birthMonth}/${birthDay}${birthHour !== undefined && birthHour !== '' ? ', Time: ' + birthHour + ':00' : ' (birth time unknown)'}\n- Gender: ${gender === 'male' ? 'Male' : 'Female'}\n\n${full ? `Generate a comprehensive report with these sections (emoji heading required for each):\n📜 Four Pillars Chart (Day Master, chart pattern, parallels with Vedic concepts — min 600 words)\n🌊 Five Elements Analysis (balance, what to strengthen — min 500 words)\n🌟 This Year's Fortune 2025-2026 (min 400 words)\n💰 Wealth & Finance Destiny (peak income years, best fields, investment timing — min 600 words)\n💕 Love & Marriage (marriage timing, ideal partner, relationship karma — min 600 words)\n💼 Career & Life Purpose (best career paths, peak years, mentor directions — min 600 words)\n📅 Ten-Year Luck Cycles (all major cycles with years and analysis — min 800 words)\n🔮 Year-by-Year Forecast (next 10 years — min 600 words)\n🎯 Personalised Recommendations (lucky colours, numbers, gemstones, directions — min 400 words)\n💌 A Personal Message (warm, personalised closing — min 300 words)` : `Generate a free preview with ONLY these 3 sections then the LOCKED separator.`}`;
    const _chartIn = baziChartBlock({ birthYear, birthMonth, birthDay, birthHour, gender });
    const messages = buildReadingPrompt(sysPrompt, userPrompt + (_chartIn ? CHART_STRICT['en-in'] + _chartIn + '\n' : ''));
    const result = await deepseekChat(messages, { maxTokens: full ? 16384 : 3500 });
    insertReading.run('bazi', JSON.stringify(req.body), result, req.userId);
    var ctxId = saveQaContext('bazi', req.body, result);
    res.json({ reading: result, tier: full ? 'full' : 'basic', locked: !full, contextId: ctxId });
  } catch (err) {
    _refundCreditOnFail(req);
    console.error('[BAZI-IN ERR]', err.message);
    res.status(500).json({ error: 'The AI reader is temporarily busy. Please try again in a moment.' });
  }
}

// ══════════════════════════════════════════
// POST /api/bazi — 八字命理
// ══════════════════════════════════════════
router.post('/bazi', rateLimitMiddleware, async (req, res) => {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, gender, question, mode, lang } = req.body;
    if (!birthYear || !birthMonth || !birthDay) return res.status(400).json({ error: '请提供出生年月日' });
    if (Number(birthYear) > new Date().getFullYear() - 14) return res.status(400).json({ error: "仅限14岁以上用户使用" });
    if (lang === 'ko') return baziKoreanHandler(req, res);
    if (lang === 'en') return baziEnglishHandler(req, res);
    if (lang === 'pt-br') return baziPtBrHandler(req, res);
    if (lang === 'th') return baziThHandler(req, res);
    if (lang === 'es') return baziEsHandler(req, res);
    if (lang === 'en-in') return baziInHandler(req, res);

    // 精确排盘注入：用专业引擎预排盘，LLM 只解读不排盘（命理专家背书零硬错误）
    // 时辰不详时不注入（否则会编造假时柱），降级回 LLM 按"时辰不详"处理
    const _hasHour = birthHour !== undefined && birthHour !== null && birthHour !== '';
    const baziBlock = _hasHour ? buildBaziBlock({ birthYear, birthMonth, birthDay, birthHour, gender }) : '';

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
⚠️ 这是用户付费购买的深度命理报告。总字数控制在9000-11000字，务必写满、写透、写完整——16个维度一个都不能少、不能"略"、不能半途而止。字数分配要均衡，宁可每个维度写得扎实精炼，也不要前面铺张、后面（尤其大运/流年/命理师私语）被截断写不完。收尾维度（📅大运、🔮流年、💌命理师私语）必须完整写完，绝不允许写到一半戛然而止。

你必须严格按照以下16个维度展开，每个维度标题必须用对应emoji开头，维度之间用空行分隔。

维度结构：
1. 📜 四柱八字排盘（年柱月柱日柱时柱分别解释，格局总评，不少于800字）
2. 🔥 十神分析（全部十神一一分析，十神组合对性格命运的综合影响，不少于1000字）
3. 🟤 五行能量分析（精确百分比、旺衰判断、补泄方案、身体器官对应、饮食建议，不少于800字）
4. 💰 财运格局（正偏财分析、财库开闭、发财黄金年份、行业方向、投资禁忌、未来10年走势，不少于1000字）
5. 💕 感情姻缘（夫妻宫、正缘特征含外貌性格职业、桃花类型、遇缘最佳年份、感情建议，不少于1000字）
6. 💼 事业格局（官杀印星分析、职业路径判断、升职跳槽最佳时机精确到年月、贵人特征与出现时间、未来10年事业建议，不少于1000字）
7. 🏥 健康预警和养生建议（先天体质弱项、需留意的身体系统、建议定期体检关注的方向、养生运动饮食作息建议——按脏腑系统与中医体质角度描述，不点名具体西医病名，落到食材，不少于800字）
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
      `请为我批算八字命盘，生成一份完整的深度命理报告。总字数控制在9000-11000字，16个维度全部写完写透，字数均衡分配，务必保证收尾维度（大运/流年/命理师私语）完整不被截断。

【基本信息】
出生时间：${birthYear}年${birthMonth}月${birthDay}日${birthHour !== undefined ? birthHour + '时' : '（时辰不详）'}
性别：${gender === 'male' ? '男' : '女'}
用户关注：${question || '请全面分析命盘'}
${baziBlock ? '\n' + baziBlock + '\n\n⚠️ 维度1「四柱八字排盘」及全文的四柱/十神/藏干/格局/旺衰/用神/大运，必须严格采用上方【精确排盘结果】，不得自行推算或改动。\n' : ''}

【输出要求】
请严格按照以下16个维度展开，每个维度用对应的emoji作为标题开头，每个维度都必须基于上述生辰八字展开具体分析，不能泛泛而谈，不能以"略"或省略号代替任何内容。

1. 📜 四柱八字排盘（不少于800字）
- 照上方【精确排盘结果】誊写四柱八字表格（年柱·月柱·日柱·时柱，天干·地支各注），不得自行推算改动
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
- 正缘特征：气质类型、性格气场、职业圈层、星座或生肖倾向、相遇场景（具体描述，如"可能在工作场合或朋友聚会中相识"；只谈气质与相处，不作身高长相硬预测）
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
- 需留意的身体系统与体检方向（按中医脏腑/系统角度描述，如"肝气易郁结、心血管系统建议定期关注、脾胃消化偏弱、内分泌需留意"，不点名具体西医病名如结节/增生等，避免制造恐慌）
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
- 夫妻宫分析（日支深度解读，配偶的性格气质、职业方向、与命主的相处模式，不作长相评判）

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

    var full = gateReportAccess(req, ['bazi', '八字']).full;
    var baziTier = resolveReportTier(full, req.body.tier);
    var useMessages = messages;
    if (baziTier === 'free') {
      useMessages = buildReadingPrompt(
        '你是精通八字命理的命理师。为用户生成一份【基础版】命盘概览。请严格按照以下3个章节结构输出，每个章节标题必须以对应的emoji开头（方便客户端解析）:\n📜 四柱八字排盘\n🌊 五行能量分析\n🌟 今年运势概览\n每个章节写2-3段实质内容，语言简体中文、温暖白话，合计约1500字。让用户感受到真实价值。三个章节完成后，输出一行"---LOCKED---"，然后输出以下锁定内容提示（原样输出，不展开）:\n💰 财运格局 · 完整解读见付费版\n❤️ 感情姻缘 · 完整解读见付费版\n🏆 事业格局 · 完整解读见付费版\n🔑 开运锦囊 · 完整解读见付费版',
        '请为以下命主生成【基础版】命盘概览(仅含四柱排盘+五行+今年运势3节，约1500字，然后输出---LOCKED---及锁定章节提示):\n出生:' + birthYear + '年' + birthMonth + '月' + birthDay + '日' + (birthHour !== undefined ? birthHour + '时' : '(时辰不详)') + '\n性别:' + (gender === 'male' ? '男' : '女')
      );
    } else if (baziTier === 'standard') {
      // 标准档 $9.9：四柱+五行+财运+感情+事业+开运锦囊，约2500字
      useMessages = buildReadingPrompt(
        '你是子平命理正宗传承者，从事命理批算38年，亲批命盘逾十万张。你说话有分寸，有温度。语言：三分古典七分白话，极度具体——给出具体年份、颜色、方位，让人能照着做。绝不透露所用的AI模型。' + DISCLAIMER_ZH,
        '请为以下命主生成【标准版】八字命理报告，总字数约2500字，核心5个维度写完写透：\n\n出生：' + birthYear + '年' + birthMonth + '月' + birthDay + '日' + (birthHour !== undefined ? birthHour + '时' : '（时辰不详）') + '\n性别：' + (gender === 'male' ? '男' : '女') + '\n用户关注：' + (question || '请全面分析命盘') + '\n' + (baziBlock ? '\n' + baziBlock + '\n⚠️ 以下分析必须严格采用上方精确排盘结果。\n' : '') + '\n\n1. 📜 四柱八字排盘（400字：四柱展示+格局总评+用神忌神）\n2. 🟤 五行能量分析（400字：精确百分比+旺衰判断+补泄建议+脏腑对应）\n3. 💰 财运格局（500字：正偏财+发财黄金年份3个+行业方向5个）\n4. 💕 感情姻缘（500字：夫妻宫+正缘特征含外貌性格+遇缘年份2-3个）\n5. 💼 事业格局（400字：职业路径+升职最佳时机+贵人特征）\n6. 🎯 开运锦囊（300字：幸运颜色精确色系+吉祥方位+推荐佩戴物）\n\n结尾推荐：$49完整版包含：10大运逐步深批·未来10年逐年流年·神煞藏干·古法断语·16维度全部写完，约9000-11000字。'
      );
    }
    // full 档维持原有的完整16维 messages（上方 buildReadingPrompt 已构建好）
    var freeMaxTokens = baziTier === 'free' ? 3000 : (baziTier === 'standard' ? 6000 : 16384);
    useMessages = useMessages.map(function(m) {
      return (m && m.role === 'system') ? { role: 'system', content: (m.content || '') + '\n\n【必须遵守】报告最后必须附一行免责声明:"本报告由AI生成,仅供参考娱乐,不构成医学、法律、投资或人生重大决策建议。"' } : m;
    });
    // 免费版缓存检查
    if (baziTier === 'free') {
      const ck = cacheKey({ name: req.body.name || '', dob: (birthYear||'') + '-' + (birthMonth||'') + '-' + (birthDay||''), gender: gender||'', lang: lang||'zh' });
      const cached = reportCache.get(ck);
      if (cached) { return res.json({ reading: cached, tier: 'free', locked: true, cached: true }); }
    }
    let result = await deepseekChat(useMessages, { maxTokens: freeMaxTokens });
    // $199 大师档：真实增量——单独一次 LLM 调用生成4个专属章节并追加（绕开单次16384 token上限，物理上多给内容）
    if (baziTier === 'full' && detectBaziVip(req)) {
      try {
        const _vipMsgs = buildReadingPrompt(
          '你是最高档【大师深度批命】命理师。' + (baziBlock ? '\n' + baziBlock + '\n严格采用上方精确排盘，禁止自行推算。\n' : '') + BAZI_VIP_ADDON_ZH,
          '这是同一位命主的大师档专属增量部分。请只输出上述4个专属章节（🗓️逐月流月/🛡️深度化解/🔀择时/👑大师叮嘱），不要重复前面已写过的16个维度。出生:' + birthYear + '年' + birthMonth + '月' + birthDay + '日' + (birthHour !== undefined ? birthHour + '时' : '(时辰不详)') + '，性别:' + (gender === 'male' ? '男' : '女')
        );
        const _vipPart = await deepseekChat(_vipMsgs, { maxTokens: 16384 });
        if (_vipPart && _vipPart.trim()) result = result + '\n\n' + _vipPart;
      } catch (_ve) { console.warn('[BAZI VIP addon]', _ve && _ve.message); }
    }
    // 免费版结果缓存24h
    if (baziTier === 'free') {
      const ck = cacheKey({ name: req.body.name || '', dob: (birthYear||'') + '-' + (birthMonth||'') + '-' + (birthDay||''), gender: gender||'', lang: lang||'zh' });
      reportCache.set(ck, result);
      setTimeout(() => reportCache.delete(ck), 24 * 60 * 60 * 1000);
    }
    insertReading.run('bazi', JSON.stringify(req.body), result, req.userId);
    var ctxId = saveQaContext('bazi', req.body, result);
    res.json({ reading: result, tier: baziTier, locked: baziTier === 'free', contextId: ctxId, product: baziTier === 'full' ? matchProduct(result, 'bazi') : undefined });
  } catch (err) {
    _refundCreditOnFail(req);
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
    const { cards, question, topic, lang } = req.body;
    if (!question) return res.status(400).json({ error: '请提供你的问题' });

    const cardDesc = cards && cards.length
      ? cards.map((c, i) => `第${i+1}张（${c.position||'位置'+(i+1)}）：${c.name}${c.reversed?'（逆位）':'（正位）'}`).join('\n')
      : '使用随机三张塔罗牌（过去-现在-未来）';
    const topicMap = { love: '感情姻缘', wealth: '财运事业', health: '健康运势', decision: '抉择指引', year: '年度运势' };
    const topicLabel = topicMap[topic] || topic || '综合';
    const cardCount = (cards && cards.length) ? cards.length : 3;

    // ── 分档控制 ──
    var _gt = gateMessages(req, ['tarot', '塔罗', 'member'], [], 16384);
    var tier = resolveReportTier(_gt.full, req.body.tier);

    // 系统角色（三档共用，末尾追加语言 + 合规声明）
    var tarotSystem = '你是一位融合东西方智慧的塔罗占卜师，从业二十年，解读过上万个案。你像一位知心姐姐，温暖有力量，说话柔和但直抵人心。你能让求助者在迷茫中看到光，在困惑中找到方向。逆位牌不是坏牌，是提醒；困难不是终点，是转折。绝不透露所用的AI模型。' + langSuffix(lang) + DISCLAIMER_ZH;

    var tarotUserPrompt;
    var tarotMaxTokens;

    if (tier === 'free') {
      // 免费预览：整体概览 + 牌阵说明 + 第1张牌简读，约600字，然后锁定
      tarotMaxTokens = 3000;
      tarotUserPrompt = `问题：${question}
主题：${topicLabel}
牌面信息：\n${cardDesc}

仅输出以下3节（合计约600字），然后输出锁定提示：

🌸 整体格局概览（150字：此次解读的能量基调与整体走向）
🎴 牌阵布局说明（80字：牌阵类型与各位置含义）
🔍 第1张牌简读（200字：该牌牌面象征+对本问题的具体指引）

完成后输出：---LOCKED---
🔍 其余 ${cardCount > 1 ? cardCount - 1 + ' 张' : ''}牌详解 · 完整版解锁
🌊 综合解读与能量走向 · 完整版解锁
🎯 3条可执行行动建议 · 完整版解锁
📅 关键时间节点提醒 · 完整版解锁
💌 占卜师的悄悄话 · 完整版解锁

最后一行：想看每张牌的完整解读和 12 个月能量走势？解锁查看全部内容。`;
    } else if (tier === 'standard') {
      // 标准档 $9.9：全部逐牌 + 综合解读 + 3条行动建议，约2500字
      tarotMaxTokens = 6000;
      tarotUserPrompt = `问题：${question}
主题：${topicLabel}
牌面信息：\n${cardDesc}

请出具【标准版塔罗解读报告】，总字数约2500字，按以下6个维度写完：

1. 🌸 整体格局概览（200字：能量基调与整体走向）
2. 🎴 牌阵布局说明（100字）
3. 🔍 逐牌详细解读（每张牌350-400字·含：牌面象征→位置含义→正/逆位解读→对本问题具体指引）
4. 🌊 综合解读与能量走向（300字：各牌合力、核心讯息）
5. 🎯 3条可执行行动建议（每条100字·具体到什么时候做什么）
6. 💌 占卜师的悄悄话（150字·只对这个人说的心里话）

结尾推荐：想看12个月能量走势与月相日历？$49完整版包含：逐月解读·备用牌阵追加·深度心理层解析。`;
    } else {
      // 完整档 $49：全8维度，约6500字
      tarotMaxTokens = 16384;
      tarotUserPrompt = `问题：${question}
主题：${topicLabel}
牌面信息：\n${cardDesc}

请出具【完整版塔罗解读报告】，总字数6500字，所有维度写完写透：

1. 🌸 整体格局概览（200-300字）
2. 🎴 牌阵布局说明（100字）
3. 🔍 逐牌详细解读（每张牌350-450字·含：牌面象征→位置含义→正/逆位解读→对本问题具体指引）
4. 🌊 综合解读与能量走向（400字）
5. 🎯 3条可执行行动建议（每条120字·具体到时间和行动）
6. 📅 关键时间节点提醒（未来3个月每月一个关键词+一句提醒，200字）
7. 🌙 下月行动提醒（150字·专门给下个月的具体指导）
8. 💌 占卜师的悄悄话（150字·温柔有力量）

各节字数不达标不允许省略，全部写完写透。`;
    }

    const messages = [
      { role: 'system', content: tarotSystem },
      { role: 'user', content: tarotUserPrompt }
    ];
    const result = await deepseekChat(messages, { maxTokens: tarotMaxTokens });
    insertReading.run('tarot', JSON.stringify(req.body), result, req.userId);
    var ctxId = saveQaContext('tarot', req.body, result);
    res.json({ reading: result, contextId: ctxId, tier: tier, locked: tier === 'free' });
  } catch (err) {
    _refundCreditOnFail(req);
    console.error('[TAROT ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用', detail: err.message });
  }
});

// ══════════════════════════════════════════
// POST /api/ziwei — 紫微斗数
// ══════════════════════════════════════════
router.post('/ziwei', rateLimitMiddleware, async (req, res) => {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, gender, question, lang } = req.body;
    if (!birthYear || !birthMonth || !birthDay || birthHour === undefined) {
      return res.status(400).json({ error: '紫微斗数需要出生年月日时' });
    }

    // ── 紫微引擎注入（从 bazi-engine 中提取 ziwei 数据，禁 LLM 自排）──
    let ziweiBlock = '';
    try {
      const ch = computeBaziChart({
        year: Number(birthYear), month: Number(birthMonth),
        day: Number(birthDay), hour: Number(birthHour) || 0,
        gender: gender || 'female', includeZiwei: true
      });
      const zw = ch.ziwei;
      if (zw) {
        const palaceLines = (zw.gongs || []).map(g =>
          `  ${g.gong}(${g.tiangan||''}${g.dizhi||''})：主星${(g.mainStars||[]).join('·')||'无'} 辅星${(g.auxStars||[]).join('·')||'无'}`
        ).join('\n') || '（宫位数据不可用）';
        const mingGong = (zw.gongs || []).find(g => g.gong === '命宫');
        const mingStars = mingGong ? (mingGong.mainStars||[]).join('·') : '';
        const sihuaStr = (zw.gongs || []).flatMap(g =>
          (g.sihua || []).map(s => `${s.star}${s.hua}(${g.gong})`)
        ).join(' ');
        ziweiBlock = `【紫微斗数精确命盘（后端引擎排盘·禁止 LLM 自行推算或修改任何星曜宫位）】
命主：${birthYear}年${birthMonth}月${birthDay}日${birthHour}时 ${gender === 'male' ? '男' : '女'}命
五行局：${(zw.wuXingJu && zw.wuXingJu.name) || zw.wuXingJu || ''}　命宫：${mingGong ? (mingGong.tiangan||'')+(mingGong.dizhi||'') : ''}
命宫主星：${mingStars || '（命宫无主星·需借对宫）'}
十二宫星曜分布：
${palaceLines}
四化飞星：${sihuaStr || '（无四化数据）'}`;
      }
    } catch (e) {
      console.warn('[ZIWEI] 引擎注入失败，降级 LLM 自解：', e && e.message);
    }

    const ziweiSystemPrompt = `你是一位精通紫微斗数的命理师，师承中州派与飞星派双脉，从业30年，批过上万张命盘。
你深谙紫微精髓，能从命盘中看透一个人的一生轨迹。语言通俗易懂，绝不用晦涩术语唬人——大白话让完全不懂紫微的人也能听懂。

【输出格式】用 Markdown，标题分段，简体中文。总字数 9000-11000字，全部 17 个维度写完写透，每个维度字数不低于要求，严禁用"略"或"详见下文"代替内容。

${ziweiBlock ? `【精确命盘（后端注入·禁止 LLM 自行推算）】\n${ziweiBlock}\n` : ''}
【健康维度】只说脏腑养生方向，严禁点名具体西医病名，不制造恐慌。

【收尾合规】报告最后附一行：
"本报告由AI辅助生成，仅供参考娱乐，不构成医学、法律、投资或人生重大决策建议。"${langSuffix(lang)}`;

    const ziweiUserPrompt = `出生：${birthYear}年${birthMonth}月${birthDay}日${birthHour}时
性别：${gender === 'male' ? '男' : '女'}
用户关注：${question || '请给我全面的紫微斗数命盘解读'}

请严格按以下 17 个维度展开，每个维度标题用对应 emoji 开头：

1. 🌟 命盘格局总览（星曜格局、三方四正、格局定性，不少于600字）
2. ☀️ 命宫主星深度解读（主星特质、辅星配置、性格命运底色，不少于800字）
3. 💰 财帛宫（财星力量、聚财方式、最佳求财年份3个，不少于500字）
4. 💕 夫妻宫（正缘星位、配偶性格气质与相处模式、遇缘年份、感情模式，不作长相评判，不少于500字）
5. 👨‍👩‍👧‍👦 子女宫（子女缘分、亲子关系模式，不少于350字）
6. 🏠 田宅宫（不动产运、家宅风水方向，不少于350字）
7. 💼 官禄宫（事业星、职业路径、升职最佳年份，不少于500字）
8. 👥 奴仆宫（下属贵人、合作模式，不少于350字）
9. 🚀 迁移宫（异乡运、出行利弊、海外机遇，不少于350字）
10. 🏥 疾厄宫（体质倾向、养生方向——按中医脏腑角度，不点病名，不少于450字）
11. 🌈 福德宫（精神享受、宗教缘分、晚年态度，不少于350字）
12. 👨‍👩 父母宫（父母缘分、长辈贵人，不少于350字）
13. 🌀 四化飞星（化禄/化权/化科/化忌各自落宫及影响，不少于700字；必须分析四化星的飞入飞出、穿宫互涉关系，如"命宫化忌入夫妻"这类宫位间的牵动，而非孤立地各说四颗星）
14. 📅 当前大限深批（起止年份、主题、关键年份，不少于550字）
15. 🔮 未来10年逐年流年（每年财/情/事评分+一句主题，不少于900字）
16. 🎯 开运锦囊（幸运色精确色系、吉方、推荐佩戴物、流年避讳，不少于450字）
17. 💌 命理师私语（只对此命盘说的心里话，不少于350字）`;

    const messages = [
      { role: 'system', content: ziweiSystemPrompt },
      { role: 'user', content: ziweiUserPrompt }
    ];
    var _g = gateMessages(req, ['bazi','hehun','ziwei','xingming','astrology','八字','合婚','紫微','姓名','占星','星盘'], messages);
    const result = await deepseekChat(_g.messages, { maxTokens: Math.max(_g.maxTokens || 0, 16384) });
    insertReading.run('ziwei', JSON.stringify(req.body), result, req.userId);
    var ctxId = saveQaContext('ziwei', req.body, result);
    res.json({ analysis: result, contextId: ctxId });
  } catch (err) {
    _refundCreditOnFail(req);
    console.error('[ZIWEI ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用', detail: err.message });
  }
});

// ══════════════════════════════════════════
// POST /api/mianxiang — 面相（麻衣神相体系）
// body: { features: string, question: string }
// features = 视觉端描述的面部特征（用户自述或vision提取），可选
// ══════════════════════════════════════════
router.post('/mianxiang', rateLimitMiddleware, async (req, res) => {
  try {
    const { question, imageBase64, mimeType, lang } = req.body;
    // If front-end sent a photo, run vision extraction first; otherwise use caller-provided features (or none)
    let features = req.body.features || null;
    if (imageBase64 && !features) {
      features = await analyzeFace(imageBase64, mimeType);
      // analyzeFace returns null on no-key or error → graceful fallback (features stays null)
    }
    const _LANG = { en: 'English', ko: '한국어', 'pt-br': 'Português (Brasil)', th: 'ไทย', es: 'Español' }[lang];
    const _langLine = _LANG
      ? `Output the ENTIRE report in ${_LANG}. Translate all palace/zone names to ${_LANG} (keep the Ma Yi / pinyin term in parentheses once). Do NOT output Chinese prose. Avoid the word "Chinese" — say "Eastern physiognomy / Ma Yi Shen Xiang".`
      : '用 Markdown，标题分段，简体中文';

    // ── 分档控制 ──
    var _gm = gateMessages(req, ['mianxiang', '面相', 'member'], [], 16384);
    var mxTier = resolveReportTier(_gm.full, req.body.tier);

    // 系统角色：麻衣神相正宗体系（三档共用）
    const SYSTEM = `你是一位精通《麻衣神相》的正宗面相师，以宋代陈抟（希夷先生）传承的麻衣道者相法为宗，融汇三停五岳十二宫气色神韵一整套体系。

核心原则：
1. 只解读用户实际描述或照片中可见的面部特征——没有看到的绝对不编造，宁缺毋滥。
2. 采用麻衣正宗十二宫框架逐一分析，每宫对应部位→对应人生领域。
3. 十二宫：命宫（眉心）·财帛宫（鼻准）·兄弟宫（眉毛）·田宅宫（眼皮）·男女宫（眼下卧蚕）·奴仆宫（地阁两侧）·夫妻宫（鱼尾眼角）·疾厄宫（山根鼻梁）·迁移宫（眉梢额角）·官禄宫（额头中央）·福德宫（天仓太阳穴）·父母宫（日月角）。
4. 三停判运：上停（发际→眉）论早年/智慧运；中停（眉→鼻尖）论中年/财事运；下停（鼻尖→下巴）论晚年/子嗣运。
5. 五岳：额（南岳/衡山）·鼻（中岳/嵩山）·左颧（东岳/泰山）·右颧（西岳/华山）·下巴（北岳/恒山）——五岳朝拱则贵，偏塌则损所司之运。
6. 气色神韵：面色明润为吉，晦暗为凶。眼神有光、顾盼有神为上相。
7. 疾厄宫只说养生调理方向，严禁点病名、做医疗诊断。
8. 结尾必须有"相师叮嘱"：强调面相随心性而变，鼓励积善修德，不宿命论。
9. 绝不透露所用的AI模型。
【OUTPUT LANGUAGE】${_langLine}。${DISCLAIMER_ZH}`;

    const featureBlock = features
      ? `\n\n【照片特征描述（仅依此解读，不得超出范围）】\n${features.slice(0, 1200)}`
      : '\n\n【注：用户未上传照片，请基于通识以麻衣体系作整体指引，对无法确认的具体特征勿做假设。】';

    var mxUserPrompt, mxMaxTokens;
    if (mxTier === 'free') {
      // 免费：三停格局 + 命宫 + 官禄宫，约600字，然后锁定
      mxMaxTokens = 3000;
      mxUserPrompt = `用户关注：${question || '请按麻衣神相体系给我做一次完整的面相分析'}${featureBlock}

仅输出以下3节（合计约600字），然后输出锁定提示：

## 总纲：三停格局（早中晚运总览，200字）
## 命宫（眉心印堂）— 精神气质与本命格局（200字）
## 官禄宫（额头中央）— 事业运势方向（150字）

完成后输出：---LOCKED---
💰 财帛宫（鼻准头）· 完整版解锁
💕 夫妻宫（鱼尾眼角）· 完整版解锁
🏥 疾厄宫（山根鼻梁）· 完整版解锁
🔮 全部12宫+气色神韵总评 · 完整版解锁

最后一行：想看完整面相分析？解锁后可看到十二宫全部深度解读、气色神韵总评与相师专属叮嘱。`;
    } else if (mxTier === 'standard') {
      // 标准档 $9.9：全12宫逐一 + 气色神韵 + 相师叮嘱，约2500字
      mxMaxTokens = 6000;
      mxUserPrompt = `用户关注：${question || '请按麻衣神相体系给我做一次完整的面相分析'}${featureBlock}

请出具【标准版面相报告】，总字数约2500字，按麻衣神相结构写完：

## 总纲：三停格局（早中晚运总览，150字）
## 五岳朝拱（格局高低，100字）
## 十二宫逐一解读（每宫100-150字）
### 命宫·财帛宫·夫妻宫·官禄宫（重点宫位各150字）
### 田宅宫·男女宫·兄弟宫·奴仆宫·疾厄宫·迁移宫·福德宫·父母宫（每宫100字）
## 气色神韵总评（100字）
## 相师叮嘱（面相随心性而变·积善修德，150字）

结尾推荐：$49完整版包含：年龄段流年面相变化规律·面相与开运搭配·修相建议（相由心生维度），约8000字深度解读。`;
    } else {
      // 完整档 $49：全维度，约8000字
      mxMaxTokens = 16384;
      mxUserPrompt = `用户关注：${question || '请按麻衣神相体系给我做一次完整的面相分析'}${featureBlock}

请出具【完整版面相报告】，总字数8000字，所有维度写完写透，每宫不少于200字：

## 总纲：三停格局（早中晚运总览，300字）
## 五岳朝拱（格局高低，200字）
## 十二宫逐一深度解读（每宫200-300字）
### 命宫（眉心印堂）— 精神气质、本命贵贱
### 官禄宫（额头中央）— 事业运、早年运
### 财帛宫（鼻准头）— 财运、聚财能力
### 夫妻宫（鱼尾眼角）— 婚恋缘分、感情质量
### 田宅宫（上眼皮）— 不动产、家宅
### 男女宫（卧蚕）— 子嗣运、桃花
### 兄弟宫（眉毛）— 兄弟朋友、协作运
### 奴仆宫（地阁两侧）— 下属、晚年依靠
### 疾厄宫（山根鼻梁）— 体质倾向（养生方向，非诊断）
### 迁移宫（眉梢额角）— 出行、异乡运
### 福德宫（天仓太阳穴）— 福气、享受与精神满足
### 父母宫（日月角）— 与父母缘分、长辈贵人
## 气色神韵总评（300字）
## 年龄段面相变化规律（不同十年段面相重点变化，300字）
## 面相与开运搭配（颜色/方位/佩戴物，200字）
## 相师叮嘱（面相随心性而变·积善修德·专属叮嘱，300字）`;
    }

    const messages = buildReadingPrompt(SYSTEM, mxUserPrompt);

    const result = await deepseekChat(messages, { maxTokens: mxMaxTokens });
    insertReading.run('mianxiang', JSON.stringify({ question, features: features ? features.slice(0, 200) : null }), result, req.userId);
    res.json({ reading: result, tier: mxTier, locked: mxTier === 'free' });
  } catch (err) {
    _refundCreditOnFail(req);
    console.error('[MIANXIANG ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用', detail: err.message });
  }
});

// ══════════════════════════════════════════
// POST /api/mianxiang/stream — 面相流式 SSE
// ══════════════════════════════════════════
router.post('/mianxiang/stream', rateLimitMiddleware, async (req, res) => {
  try {
    const { question, imageBase64, mimeType, lang } = req.body;
    let features = req.body.features || null;

    // Phase 1: vision extraction (blocking, must finish before streaming)
    if (imageBase64 && !features) {
      features = await analyzeFace(imageBase64, mimeType);
    }

    const _LANG = { en: 'English', ko: '한국어', 'pt-br': 'Português (Brasil)', th: 'ไทย', es: 'Español' }[lang];
    const _langLine = _LANG
      ? `Output the ENTIRE report in ${_LANG}. Translate all palace/zone names to ${_LANG} (keep the Ma Yi / pinyin term in parentheses once). Do NOT output Chinese prose. Avoid the word "Chinese" — say "Eastern physiognomy / Ma Yi Shen Xiang".`
      : '用 Markdown，标题分段，简体中文';

    const SYSTEM = `你是一位精通《麻衣神相》的正宗面相师，以宋代陈抟（希夷先生）传承的麻衣道者相法为宗，融汇三停五岳十二宫气色神韵一整套体系。

核心原则：
1. 只解读用户实际描述或照片中可见的面部特征——没有看到的绝对不编造，宁缺毋滥。
2. 采用麻衣正宗十二宫框架逐一分析，每宫对应部位→对应人生领域。
3. 十二宫：命宫（眉心）·财帛宫（鼻准）·兄弟宫（眉毛）·田宅宫（眼皮）·男女宫（眼下卧蚕）·奴仆宫（地阁两侧）·夫妻宫（鱼尾眼角）·疾厄宫（山根鼻梁）·迁移宫（眉梢额角）·官禄宫（额头中央）·福德宫（天仓太阳穴）·父母宫（日月角）。
4. 三停判运：上停（发际→眉）论早年/智慧运；中停（眉→鼻尖）论中年/财事运；下停（鼻尖→下巴）论晚年/子嗣运。
5. 五岳：额（南岳/衡山）·鼻（中岳/嵩山）·左颧（东岳/泰山）·右颧（西岳/华山）·下巴（北岳/恒山）——五岳朝拱则贵，偏塌则损所司之运。
6. 气色神韵：面色明润为吉，晦暗为凶。眼神有光、顾盼有神为上相。
7. 疾厄宫只说养生调理方向，严禁点病名、做医疗诊断。
8. 结尾必须有"相师叮嘱"：强调面相随心性而变，鼓励积善修德，不宿命论。
9. 用Markdown，标题分段，每个宫位分析100-200字。
10. 【铁律】只论气运格局与人生领域，绝不评价容貌美丑，绝不使用"丑/难看/缺陷/畸形"等贬损字眼；一切表述温和、尊重、不制造容貌焦虑。
【OUTPUT LANGUAGE】${_langLine}。${DISCLAIMER_ZH}`;

    const featureBlock = features
      ? `\n\n【照片特征描述（仅依此解读，不得超出范围）】\n${features.slice(0, 1200)}`
      : '\n\n【注：用户未上传照片，请基于通识以麻衣体系作整体指引，对无法确认的具体特征勿做假设。】';

    const userPrompt = `用户关注：${question || '请按麻衣神相体系给我做一次完整的面相分析'}${featureBlock}

请按以下麻衣神相结构出具面相报告：

## 总纲：三停格局（早中晚运总览）
## 五岳朝拱（格局高低）
## 十二宫逐一解读
### 命宫（眉心印堂）— 精神气质、本命贵贱
### 官禄宫（额头中央）— 事业运、早年运
### 财帛宫（鼻准头）— 财运、聚财能力
### 夫妻宫（鱼尾眼角）— 婚恋缘分、感情质量
### 田宅宫（上眼皮）— 不动产、家宅
### 男女宫（卧蚕）— 子嗣运、桃花
### 兄弟宫（眉毛）— 兄弟朋友、协作运
### 奴仆宫（地阁两侧）— 下属、晚年依靠
### 疾厄宫（山根鼻梁）— 体质倾向（养生方向，非诊断）
### 迁移宫（眉梢额角）— 出行、异乡运
### 福德宫（天仓太阳穴）— 福气、享受与精神满足
### 父母宫（日月角）— 与父母缘分、长辈贵人

## 气色神韵总评
## 相师叮嘱（面相随心性而变·积善修德）`;

    const messages = buildReadingPrompt(SYSTEM, userPrompt);
    var _gm = gateMessages(req, ['mianxiang', '面相', 'member'], messages, 8192);

    // Open SSE — meta event clears the 30s frontend timeout immediately
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ type: 'meta', tier: _gm.full ? 'full' : 'basic', locked: !_gm.full })}\n\n`);

    const streamBody = await deepseekStream(_gm.messages, { maxTokens: _gm.maxTokens, timeout: 300000 });
    const reader = streamBody.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '', buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) { buf += decoder.decode(); break; }
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
    insertReading.run('mianxiang', JSON.stringify({ question, features: features ? features.slice(0, 200) : null }), fullText, req.userId);
    res.write(`data: ${JSON.stringify({ type: 'done', tier: _gm.full ? 'full' : 'basic', locked: !_gm.full })}\n\n`);
    res.end();
  } catch (err) {
    _refundCreditOnFail(req);
    console.error('[MIANXIANG-STREAM ERR]', err.message);
    try { res.write(`data: ${JSON.stringify({ type: 'error', message: '生成失败，请重试' })}\n\n`); res.end(); } catch(e) {}
  }
});

// ══════════════════════════════════════════
// POST /api/shouxiang — 手相（麻衣神相体系）
// body: { features: string, question: string, hand: 'left'|'right' }
// ══════════════════════════════════════════
router.post('/shouxiang', rateLimitMiddleware, async (req, res) => {
  try {
    const { question, hand, imageBase64, mimeType, lang } = req.body;
    let features = req.body.features || null;
    if (imageBase64 && !features) {
      features = await analyzePalm(imageBase64, mimeType);
    }
    const handLabel = hand === 'left' ? '左手' : '右手（主手）';
    const _LANG = { en: 'English', ko: '한국어', 'pt-br': 'Português (Brasil)', th: 'ไทย', es: 'Español' }[lang];
    const _langLine = _LANG
      ? `Output the ENTIRE report in ${_LANG}. Translate all line/mount names to ${_LANG} (keep the pinyin term in parentheses once). Do NOT output Chinese prose. Avoid the word "Chinese" — say "Eastern palmistry / Ma Yi".`
      : '用 Markdown，标题分段，简体中文';

    const SYSTEM = `你是一位精通《麻衣神相》手相篇的正宗手相师，以三大主线、八丘、特殊掌纹为核心体系断命。

核心原则：
1. 只解读用户实际描述或照片中可见的掌纹特征——看到什么说什么，不编造任何照片中没有的纹路。
2. 三大主线：感情线（心线，起自小指侧横过掌心）·智慧线（头线，起自食指下方斜向小鱼际）·生命线（起自拇指食指间弧绕金星丘）。
3. 辅助线：事业线（命运线，从手腕中央向中指延伸）·太阳线（无名指下竖纹，主名誉财运）·婚姻线（小指下方横纹）。
4. 八丘：金星丘（拇指根）·木星丘（食指根）·土星丘（中指根）·太阳丘（无名指根）·水星丘（小指根）·月丘（小鱼际）·上火星丘·下火星丘。
5. 特殊掌型：川字掌（感情线智慧线合一，主专注执着）·断掌/通贯手（贯穿全掌，主个性鲜明）。
6. 生命线长短不等于寿命长短——必须在此说明，避免用户恐慌。
7. 结尾"相师叮嘱"：强调掌纹随人生经历和心态变化，不宿命论。
8. 用Markdown，标题分段，每部分100-180字。
【OUTPUT LANGUAGE】${_langLine}。${DISCLAIMER_ZH}`;

    const featureBlock = features
      ? `\n\n【照片特征描述（${handLabel}，仅依此解读，不得超出范围）】\n${features.slice(0, 1200)}`
      : `\n\n【注：用户未上传照片，请以${handLabel}为参照，基于麻衣手相体系作整体指引，对无法确认的具体纹路勿做假设。】`;

    const userPrompt = `用户关注：${question || '请按麻衣神相手相体系给我做完整分析'}${featureBlock}

请按以下麻衣手相结构出具报告：

## 掌型总观（手掌形状、质感、整体格局）
## 三大主线精析
### 感情线（心线）— 情感模式、爱情风格
### 智慧线（头线）— 思维方式、决策风格
### 生命线 — 体质节律与人生重要节点（注意：线长≠寿长）
## 辅助线解读
### 事业线（命运线）— 事业方向与运势
### 太阳线 — 名誉、财运与贵人
### 婚姻线 — 婚恋时机与关系质量
## 八丘分析（重点突出明显的丘位）
## 特殊掌纹（如有川字掌/断掌/通贯手等）
## 相师叮嘱（掌纹随心态和经历变化·不宿命论）`;

    const messages = buildReadingPrompt(SYSTEM, userPrompt);

    var _gm = gateMessages(req, ['shouxiang', '手相', 'member'], messages, 8192);
    const result = await deepseekChat(_gm.messages, { maxTokens: _gm.maxTokens });
    insertReading.run('shouxiang', JSON.stringify({ question, hand, features: features ? features.slice(0, 200) : null }), result, req.userId);
    res.json({ reading: result, tier: _gm.full ? 'full' : 'basic', locked: !_gm.full });
  } catch (err) {
    _refundCreditOnFail(req);
    console.error('[SHOUXIANG ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用', detail: err.message });
  }
});

// ══════════════════════════════════════════
// POST /api/shouxiang/stream — 手相流式 SSE
// ══════════════════════════════════════════
router.post('/shouxiang/stream', rateLimitMiddleware, async (req, res) => {
  try {
    const { question, hand, imageBase64, mimeType, lang } = req.body;
    let features = req.body.features || null;
    if (imageBase64 && !features) {
      features = await analyzePalm(imageBase64, mimeType);
    }
    const handLabel = hand === 'left' ? '左手' : '右手（主手）';
    const _LANG = { en: 'English', ko: '한국어', 'pt-br': 'Português (Brasil)', th: 'ไทย', es: 'Español' }[lang];
    const _langLine = _LANG
      ? `Output the ENTIRE report in ${_LANG}. Translate all line/mount names to ${_LANG} (keep the pinyin term in parentheses once). Do NOT output Chinese prose. Avoid the word "Chinese" — say "Eastern palmistry / Ma Yi".`
      : '用 Markdown，标题分段，简体中文';

    const SYSTEM = `你是一位精通《麻衣神相》手相篇的正宗手相师，以三大主线、八丘、特殊掌纹为核心体系断命。

核心原则：
1. 只解读用户实际描述或照片中可见的掌纹特征——看到什么说什么，不编造任何照片中没有的纹路。
2. 三大主线：感情线（心线，起自小指侧横过掌心）·智慧线（头线，起自食指下方斜向小鱼际）·生命线（起自拇指食指间弧绕金星丘）。
3. 辅助线：事业线（命运线，从手腕中央向中指延伸）·太阳线（无名指下竖纹，主名誉财运）·婚姻线（小指下方横纹）。
4. 八丘：金星丘（拇指根）·木星丘（食指根）·土星丘（中指根）·太阳丘（无名指根）·水星丘（小指根）·月丘（小鱼际）·上火星丘·下火星丘。
5. 特殊掌型：川字掌（感情线智慧线合一，主专注执着）·断掌/通贯手（贯穿全掌，主个性鲜明）。
6. 生命线长短不等于寿命长短——必须在此说明，避免用户恐慌。
7. 结尾"相师叮嘱"：强调掌纹随人生经历和心态变化，不宿命论。
8. 用Markdown，标题分段，每部分100-180字。
【OUTPUT LANGUAGE】${_langLine}。${DISCLAIMER_ZH}`;

    const featureBlock = features
      ? `\n\n【照片特征描述（${handLabel}，仅依此解读，不得超出范围）】\n${features.slice(0, 1200)}`
      : `\n\n【注：用户未上传照片，请以${handLabel}为参照，基于麻衣手相体系作整体指引，对无法确认的具体纹路勿做假设。】`;

    const userPrompt = `用户关注：${question || '请按麻衣神相手相体系给我做完整分析'}${featureBlock}

请按以下麻衣手相结构出具报告：

## 掌型总观（手掌形状、质感、整体格局）
## 三大主线精析
### 感情线（心线）— 情感模式、爱情风格
### 智慧线（头线）— 思维方式、决策风格
### 生命线 — 体质节律与人生重要节点（注意：线长≠寿长）
## 辅助线解读
### 事业线（命运线）— 事业方向与运势
### 太阳线 — 名誉、财运与贵人
### 婚姻线 — 婚恋时机与关系质量
## 八丘分析（重点突出明显的丘位）
## 特殊掌纹（如有川字掌/断掌/通贯手等）
## 相师叮嘱（掌纹随心态和经历变化·不宿命论）`;

    const messages = buildReadingPrompt(SYSTEM, userPrompt);
    var _gm = gateMessages(req, ['shouxiang', '手相', 'member'], messages, 8192);

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ type: 'meta', tier: _gm.full ? 'full' : 'basic', locked: !_gm.full })}\n\n`);

    const streamBody = await deepseekStream(_gm.messages, { maxTokens: _gm.maxTokens, timeout: 300000 });
    const reader = streamBody.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '', buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) { buf += decoder.decode(); break; }
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
    insertReading.run('shouxiang', JSON.stringify({ question, hand, features: features ? features.slice(0, 200) : null }), fullText, req.userId);
    res.write(`data: ${JSON.stringify({ type: 'done', tier: _gm.full ? 'full' : 'basic', locked: !_gm.full })}\n\n`);
    res.end();
  } catch (err) {
    _refundCreditOnFail(req);
    console.error('[SHOUXIANG-STREAM ERR]', err.message);
    try { res.write(`data: ${JSON.stringify({ type: 'error', message: '生成失败，请重试' })}\n\n`); res.end(); } catch(e) {}
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
      '你是一位德高望重的合婚师，从业四十余年，阅人无数，撮合过上千对姻缘。你说话诚恳、直率、不留情面，但句句为对方好。你深知婚姻不是儿戏，合婚分析必须全面深刻、落到实地。每次回答至少3000字。用Markdown格式输出，使用标题、加粗、分隔线让报告清晰易读。语言：简体中文。' + DISCLAIMER_ZH,
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
## 九、最佳结婚年份与3个推荐吉日（满分5分·必须给出3个具体吉日：年份+月份，每个各附一句理由；此为传统择吉文化参考，非婚姻决策建议，请以双方感情与现实为准）
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
    _refundCreditOnFail(req);
    console.error('[HEHUN ERR]', err.message);
    if (mon && mon.captureException) mon.captureException(err, { tags: { api: 'hehun' } });
    res.status(500).json({ error: 'AI暂时不可用', detail: err.message });
  }
});

// ══════════════════════════════════════════
// POST /api/hehun/preview — 合婚免费预览·真日主五行基础分(无LLM·诚实·可辩护)
// ══════════════════════════════════════════
const _GAN_WUXING  = { '甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水' };
const _GAN_YINYANG = { '甲':'阳','丙':'阳','戊':'阳','庚':'阳','壬':'阳','乙':'阴','丁':'阴','己':'阴','辛':'阴','癸':'阴' };
const _WX_SHENG = { '木':'火','火':'土','土':'金','金':'水','水':'木' }; // A生B
const _WX_KE    = { '木':'土','土':'水','水':'火','火':'金','金':'木' }; // A克B
function _elemRelation(a, b){
  if (a === b) return '比和';
  if (_WX_SHENG[a] === b || _WX_SHENG[b] === a) return '相生';
  if (_WX_KE[a] === b || _WX_KE[b] === a) return '相克';
  return '比和';
}
function _hehunBaseScore(ea, eb, ya, yb){
  const rel = _elemRelation(ea, eb);
  // 五行关系定基础带(相生>比和>相克),带内按元素对确定性取值——非生日哈希
  const band = rel === '相生' ? [82,90] : rel === '比和' ? [74,82] : [62,72];
  const order = ['木','火','土','金','水'];
  const idx = (order.indexOf(ea) + order.indexOf(eb)) % (band[1] - band[0] + 1);
  let score = band[0] + idx + ((ya !== yb) ? 2 : -1); // 一阴一阳微加
  return { rel, score: Math.max(60, Math.min(92, score)) };
}
// 诚实点评:基于双方真日主五行生克关系的真话解读(非编造分数/预测),即时·零LLM
const _WX_EN = { '木':'Wood', '火':'Fire', '土':'Earth', '金':'Metal', '水':'Water' };
function _hehunCommentary(eA, eB, rel, lang){
  const en = lang === 'en';
  const A = en ? _WX_EN[eA] : eA, B = en ? _WX_EN[eB] : eB;
  if (rel === '相生'){
    const aGivesB = _WX_SHENG[eA] === eB;
    if (en) return aGivesB
      ? `Your ${A} nourishes their ${B} — you're naturally the giver who supports and lifts. Warmth flows easily; just keep it balanced so you receive too.`
      : `Their ${B} nourishes your ${A} — they naturally nurture and cushion you. You feel cared for; remember to give back so it's never taken for granted.`;
    return aGivesB
      ? `你的${A}生TA的${B}——你天然愿意扶持对方,是关系里主动付出的一方。相处顺、给予多;留意别让付出失衡,也给对方回馈的空间。`
      : `TA的${B}生你的${A}——对方天然愿意包容、滋养你,你常是被照顾的一方。暖意明显;记得也主动回应,别让好意被当作理所当然。`;
  }
  if (rel === '相克'){
    const aCtrlB = _WX_KE[eA] === eB;
    if (en) return aCtrlB
      ? `Your ${A} controls their ${B} — you tend to lead, they tend to yield. There's both tension and momentum; the key is measure — too forceful strains the bond, balanced it elevates you both.`
      : `Their ${B} controls your ${A} — they tend to lead, you tend to bend. Your flexibility is a real strength; just hold your boundaries so you don't lose yourself.`;
    return aCtrlB
      ? `你的${A}克TA的${B}——关系里你偏主导、对方偏包容,有张力也有推动力。克不是坏事,分寸是关键:强势过头易伤和气,拿捏好就是彼此成就。`
      : `TA的${B}克你的${A}——对方偏主导、你偏柔韧,你更懂让步。这份包容是你的力量;但也要守住底线,别一味退到失去自己。`;
  }
  if (en) return `You share the ${A} element — kindred energy, instant familiarity, quick rapport. But sameness means shared blind spots; stay intentional about complementing each other.`;
  return `你俩同属${A}——气场相近、容易一见如故,默契来得快。但同质也意味着盲区相同,遇事易一起钻牛角尖,需有意互补、给彼此提个醒。`;
}
router.post('/hehun/preview', rateLimitMiddleware, (req, res) => {
  try {
    const { p1Year, p1Month, p1Day, p1Hour, p1Gender, p2Year, p2Month, p2Day, p2Hour, p2Gender, lang } = req.body;
    if (!p1Year || !p1Month || !p1Day || !p2Year || !p2Month || !p2Day) {
      return res.status(400).json({ ok:false, error:'请提供双方出生年月日' });
    }
    // 日主由日柱决定,与时辰无关——时辰缺省不影响准确性
    const mk = (y,m,d,h,g) => computeBaziChart({ year:+y, month:+m, day:+d,
      hour: (h !== undefined && h !== '' && h !== null) ? +h : 12,
      gender: g === 'male' ? 'male' : 'female' });
    const cA = mk(p1Year, p1Month, p1Day, p1Hour, p1Gender);
    const cB = mk(p2Year, p2Month, p2Day, p2Hour, p2Gender);
    const dmA = cA.bazi.siZhu.day.gan, dmB = cB.bazi.siZhu.day.gan;
    const eA = _GAN_WUXING[dmA], eB = _GAN_WUXING[dmB];
    const { rel, score } = _hehunBaseScore(eA, eB, _GAN_YINYANG[dmA], _GAN_YINYANG[dmB]);
    res.json({
      ok: true,
      a: { dayMaster: dmA, element: eA },
      b: { dayMaster: dmB, element: eB },
      relationship: rel,
      baseScore: score,
      commentary: _hehunCommentary(eA, eB, rel, lang),
      note: '此为双方日主五行基础契合参考,完整八字深度合婚见解锁报告'
    });
  } catch (err) {
    console.error('[HEHUN PREVIEW ERR]', err.message);
    res.status(500).json({ ok:false, error:'计算失败,请重试' });
  }
});

// ══════════════════════════════════════════
// POST /api/hehun/stream — 合婚流式（SSE）
// ══════════════════════════════════════════
router.post('/hehun/stream', rateLimitMiddleware, async (req, res) => {
  try {
    const { p1Year, p1Month, p1Day, p1Hour, p2Year, p2Month, p2Day, p2Hour, p1Gender, p2Gender, p1Name, p2Name, mode, lang } = req.body;
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
    const hehunLang = lang || 'zh';
    // 合婚三档分档（teaser=完全未付费）— 仅 zh 分支据此控制报告深度
    const tier = hehunTier(req) || 'teaser';

    // Deterministic compatibility score — same pair always gets same score
    const hashInput = [p1Year, p1Month, p1Day, p2Year, p2Month, p2Day].join('-');
    let hashVal = 0;
    for (let i = 0; i < hashInput.length; i++) hashVal = (hashVal * 31 + hashInput.charCodeAt(i)) & 0x7fffffff;
    const compatScore = 65 + (hashVal % 32);
    const dims = {
      wuxing:        60 + (hashVal >> 3)  % 40,
      personality:   60 + (hashVal >> 7)  % 40,
      values:        60 + (hashVal >> 11) % 40,
      communication: 60 + (hashVal >> 15) % 40,
      emotional:     60 + (hashVal >> 19) % 40,
      future:        60 + (hashVal >> 23) % 40
    };

    const nameA = p1Name || (hehunLang === 'ko' ? 'A' : hehunLang === 'en' ? 'Person A' : 'A方');
    const nameB = p2Name || (hehunLang === 'ko' ? 'B' : hehunLang === 'en' ? 'Person B' : 'B方');

    let systemPrompt;
    if (hehunLang === 'en') {
      systemPrompt = isDating
        ? `You are a warm, insightful relationship compatibility reader with 30 years of experience in BaZi (Four Pillars of Destiny). You write honest, compassionate reports in fluent English. Use Markdown format. Write 4000-6000 words.

Analysis sections:
## 💕 Compatibility Score & Overall Outlook
## 🌊 How You Each Love — Emotional Patterns
## 💬 Communication & Conflict Styles
## 🌟 Where You Naturally Connect
## ⚡ Relationship Challenges to Navigate
## 🏠 Day-to-Day Chemistry & Living Together
## 💫 Your Relationship Journey (next 1-3 years)
## 🎯 3 Actionable Tips to Strengthen This Bond
## 💌 The Bottom Line: Is This Love Worth Pursuing?

Style: Flowing narrative, not bullet lists. End each section with one memorable line. Use the pre-computed compatibility score provided.`
        : `You are a respected BaZi compatibility analyst with 40+ years of experience. You write warm, direct, and practical compatibility reports in fluent English. Use Markdown format, 6000-8000 words.

Analysis sections:
## 1. Overall Compatibility Score & Summary
## 2. Five Elements Harmony & Clash Analysis
## 3. Personality Compatibility — Core Natures
## 4. Values & Life Goals Alignment
## 5. Conflict Patterns & How to Resolve Them
## 6. Who Leads, Who Grounds — Energy Dynamics
## 7. Family & Children Prospects
## 8. Extended Family Compatibility
## 9. Best Marriage Timing — Auspicious Years & 3 Recommended Dates (you MUST give 3 specific auspicious dates: year + month, each with a one-line reason; this is traditional date-selection culture for reference only, not marriage-decision advice — let the couple's feelings and reality lead)
## 10. Top 3 Things to Work On After Marriage
## 11. Classical BaZi Compatibility Wisdom
## 12. Final Verdict — Should You Build a Life Together?

Use the pre-computed compatibility score provided. Give specific year recommendations.`;
    } else if (hehunLang === 'ko') {
      systemPrompt = isDating
        ? `당신은 30년 경력의 따뜻하고 통찰력 있는 궁합 전문 명리사입니다. 사주명리를 바탕으로 솔직하고 따뜻한 궁합 리포트를 한국어로 작성합니다. 마크다운 형식, 4000-6000자.

분석 항목:
## 💕 궁합 점수 및 전체 흐름
## 🌊 두 사람의 감정 패턴 — 어떻게 사랑하나요
## 💬 소통 방식과 갈등 패턴
## 🌟 자연스럽게 통하는 부분
## ⚡ 함께 넘어야 할 도전
## 🏠 함께 살면 어떨까 — 일상의 궁합
## 💫 이 관계의 앞날 (1-3년 전망)
## 🎯 관계를 더 좋게 만드는 3가지 조언
## 💌 한마디 결론 — 이 사랑 계속할 가치 있나요?

스타일: 리스트보다 흐르는 문장으로. 제공된 궁합 점수를 활용하세요.`
        : `당신은 40년 이상 경력의 사주명리 궁합 전문가입니다. 따뜻하고 직접적이며 실용적인 궁합 리포트를 한국어로 작성합니다. 마크다운 형식, 6000-8000자.

분석 항목:
## 1. 궁합 총평 및 점수
## 2. 오행 상생상극 분석
## 3. 성격 궁합 — 두 사람의 본성
## 4. 가치관과 인생 방향의 일치도
## 5. 갈등 패턴과 해결 방법
## 6. 누가 이끌고 누가 안정시키나 — 에너지 역학
## 7. 자녀 및 가정운
## 8. 양가 가족과의 궁합
## 9. 최적 결혼 시기와 추천 길일 3개 (반드시 구체적인 길일 3개: 연도+월, 각각 이유 한 줄 포함; 이는 전통 택일 문화 참고용이며 결혼 결정 조언이 아닙니다 — 두 분의 감정과 현실을 우선하세요)
## 10. 결혼 후 꼭 주의해야 할 3가지
## 11. 고전 사주 궁합 원리
## 12. 최종 결론 — 이 인연, 맺어야 할까요?

제공된 궁합 점수를 사용하세요. 구체적인 연도 추천을 포함하세요.`;
    } else {
      // ── zh 分支：按 tier 控制报告深度 ──
      const _persona = '你是一位德高望重的合婚师，从业四十余年，阅人无数，撮合过上千对姻缘。你说话诚恳、直率、不留情面，但句句为对方好。你深知婚姻不是儿戏，合婚分析必须全面深刻、落到实地。用Markdown格式，简体中文。';
      const _datingPersona = '你是一位洞悉人心的感情命理师，从业三十年，见过无数恋爱中的人。你说话温柔又直率——你不会粉饰，但也不会只说坏事。你深知恋爱的美丽和它的复杂。用Markdown格式，简体中文。';
      if (tier === 'teaser') {
        // 未付费预览：总分 + 1段核心结论，然后锁
        systemPrompt = `${isDating ? _datingPersona : _persona}

这是一份【免费预览版】，请只输出约400字：
## 💕 合婚总分（百分制）
（用已提供的缘分分数，一句话点评这个分数意味着什么）
## 核心结论预览
（写1段约250字的核心结论：概括两人最关键的一个匹配点或最需要留意的一个隐患，写到最动人处戛然而止，不展开细节）

结尾必须另起一行写：「完整的四柱排盘、六维合婚详批、感情流年与开运化解，请解锁基础版（¥9.9）或完整版查看。」不要输出其它内容。`;
      } else if (tier === 'basic') {
        // 基础版：四柱 + 总分 + 3段核心结论，约1500字，然后锁
        systemPrompt = `${isDating ? _datingPersona : _persona}

这是一份【基础版】报告，约1500字，请按以下结构输出：
## 一、双方四柱与合婚总分
（列出双方四柱与日主，给出合婚总分及一句话总评，务必与上方精确排盘数据一致）
## 二、性格互补
（约400字：两人性格底色如何互补或相冲）
## 三、沟通方式
（约400字：两人沟通与冲突模式，会在哪里起争执）
## 四、长期走势
（约400字：这段关系的长期走向与最需留意之处）

结尾必须另起一行写：「以上为基础版。完整的六维合婚详批（价值观/气场合度/子女缘/最佳结婚年份/古诀依据等）请解锁完整版（¥39.9）查看。」到此为止，不要展开更多维度。`;
      } else if (tier === 'master') {
        // 大师批婚：完整六维 + 4节大师专属
        systemPrompt = `${isDating ? _datingPersona : _persona}本次为最高档【大师批婚】，字数8000-12000字。

第一部分·完整六维合婚：
## 一、合婚总评与缘分分数（百分制）
## 二、五行互补度与元素相生相克
## 三、性格匹配度——两人的心理底色
## 四、价值观与人生方向兼容性
## 五、吵架模式与冲突化解之道
## 六、气场合度（谁带动谁，谁让谁稳定）
## 七、生育子女缘分与家庭运
## 八、双方原生家庭兼容性
## 九、最佳结婚年份与3个推荐吉日（必须给出3个具体吉日：年份+月份，每个各附一句理由；此为传统择吉文化参考，非婚姻决策建议，请以双方感情与现实为准）
## 十、婚后最需要注意的3件事
## 十一、合婚古诀引用与命理依据
## 十二、一句话结论——这段婚姻值得进入吗

第二部分·👑大师批婚专属（务必逐节展开）：
## 👑 一、未来5年逐年感情流年（从今年起逐年，每年给一个感情运势评分+一条关键提醒）
## 👑 二、婚礼/订婚择日建议（结合双方八字给出具体吉利月份及理由）
## 👑 三、双方开运化解方案（针对各自八字弱点给出方位/颜色/日常化解与增运之法）
## 👑 四、命理师私语（用命理师第一人称，写一段只对这两个人说的、个性化的贴心话）

请使用已提供的缘分分数。`;
      } else {
        // full：现有完整六维合婚报告
        systemPrompt = isDating
          ? `${_datingPersona}请用命运诗篇的笔触，为${nameA}和${nameB}写一份深度恋爱配对分析报告（6000-8000字）。

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

写作风格：命运诗篇。不用给打分列表，用连贯的叙述段落。每节结尾用一句令人心头一震的话。直接进入两人的感情画像。请使用已提供的缘分分数。`
          : `${_persona}字数8000-12000字。

详细分析：
## 一、合婚总评与缘分分数（百分制）
## 二、五行互补度与元素相生相克
## 三、性格匹配度——两人的心理底色
## 四、价值观与人生方向兼容性
## 五、吵架模式与冲突化解之道
## 六、气场合度（谁带动谁，谁让谁稳定）
## 七、生育子女缘分与家庭运
## 八、双方原生家庭兼容性
## 九、最佳结婚年份与3个推荐吉日（必须给出3个具体吉日：年份+月份，每个各附一句理由；此为传统择吉文化参考，非婚姻决策建议，请以双方感情与现实为准）
## 十、婚后最需要注意的3件事
## 十一、合婚古诀引用与命理依据
## 十二、一句话结论——这段婚姻值得进入吗

请使用已提供的缘分分数。`;
      }
    }

    // 🔴 合规免责：所有 hehun/stream 分支 systemPrompt 末尾统一附娱乐免责
    systemPrompt += (hehunLang === 'en' ? DISCLAIMER_EN : DISCLAIMER_ZH);

    // ── 双方精确排盘（算法排，不让AI猜）──
    const bazi1 = calcBazi(Number(p1Year), Number(p1Month), Number(p1Day), Number(p1Hour)||0, p1Gender||'female');
    const bazi2 = calcBazi(Number(p2Year), Number(p2Month), Number(p2Day), Number(p2Hour)||0, p2Gender||'male');

    let hehunChart, userMsg;
    if (hehunLang === 'en') {
      hehunChart = `[Pre-computed BaZi Chart Data — use exactly as provided, do not recalculate]
${nameA} (${p1Gender==='male'?'Male':'Female'}):
  Four Pillars: ${bazi1.fourPillars}  Day Master: ${bazi1.dayMaster} (${bazi1.dayMasterElement})  ${bazi1.isStrong?'Strong':'Weak'} chart
  Five Elements: Metal${bazi1.wuxing['金'].toFixed(1)} Wood${bazi1.wuxing['木'].toFixed(1)} Water${bazi1.wuxing['水'].toFixed(1)} Fire${bazi1.wuxing['火'].toFixed(1)} Earth${bazi1.wuxing['土'].toFixed(1)}
${nameB} (${p2Gender==='male'?'Male':'Female'}):
  Four Pillars: ${bazi2.fourPillars}  Day Master: ${bazi2.dayMaster} (${bazi2.dayMasterElement})  ${bazi2.isStrong?'Strong':'Weak'} chart
  Five Elements: Metal${bazi2.wuxing['金'].toFixed(1)} Wood${bazi2.wuxing['木'].toFixed(1)} Water${bazi2.wuxing['水'].toFixed(1)} Fire${bazi2.wuxing['火'].toFixed(1)} Earth${bazi2.wuxing['土'].toFixed(1)}
Pre-computed compatibility score: ${compatScore}/100`;
      userMsg = `${hehunChart}

${nameA}: Born ${p1Year}/${p1Month}/${p1Day}${p1Hour !== undefined && p1Hour !== '' ? ' at '+p1Hour+':00' : ''} · ${p1Gender === 'male' ? 'Male' : 'Female'}
${nameB}: Born ${p2Year}/${p2Month}/${p2Day}${p2Hour !== undefined && p2Hour !== '' ? ' at '+p2Hour+':00' : ''} · ${p2Gender === 'male' ? 'Male' : 'Female'}
Please analyze compatibility using the chart data above. Use ${compatScore}/100 as the overall score.`;
    } else if (hehunLang === 'ko') {
      hehunChart = `[사전 계산된 사주 데이터 — 정확하게 사용하고 재계산 금지]
${nameA} (${p1Gender==='male'?'남':'여'}):
  사주: ${bazi1.fourPillars}  일간: ${bazi1.dayMaster} (${bazi1.dayMasterElement})  ${bazi1.isStrong?'신강':'신약'}
  오행: 금${bazi1.wuxing['金'].toFixed(1)} 목${bazi1.wuxing['木'].toFixed(1)} 수${bazi1.wuxing['水'].toFixed(1)} 화${bazi1.wuxing['火'].toFixed(1)} 토${bazi1.wuxing['土'].toFixed(1)}
${nameB} (${p2Gender==='male'?'남':'여'}):
  사주: ${bazi2.fourPillars}  일간: ${bazi2.dayMaster} (${bazi2.dayMasterElement})  ${bazi2.isStrong?'신강':'신약'}
  오행: 금${bazi2.wuxing['金'].toFixed(1)} 목${bazi2.wuxing['木'].toFixed(1)} 수${bazi2.wuxing['水'].toFixed(1)} 화${bazi2.wuxing['火'].toFixed(1)} 토${bazi2.wuxing['土'].toFixed(1)}
사전 계산된 궁합 점수: ${compatScore}/100`;
      userMsg = `${hehunChart}

${nameA}: ${p1Year}년 ${p1Month}월 ${p1Day}일${p1Hour !== undefined && p1Hour !== '' ? ' '+p1Hour+'시' : ''} · ${p1Gender === 'male' ? '남성' : '여성'}
${nameB}: ${p2Year}년 ${p2Month}월 ${p2Day}일${p2Hour !== undefined && p2Hour !== '' ? ' '+p2Hour+'시' : ''} · ${p2Gender === 'male' ? '남성' : '여성'}
위 데이터를 바탕으로 궁합을 분석해주세요. 종합 점수는 ${compatScore}/100을 사용하세요.`;
    } else {
      hehunChart = `【精确排盘数据（由万年历算法计算，请严格使用，不得自行推算或修改）】
${nameA}（${p1Gender==='male'?'男':'女'}）：
  四柱：${bazi1.fourPillars}　日主：${bazi1.dayMaster}（${bazi1.dayMasterElement}）　身${bazi1.isStrong?'强':'弱'}
  五行：金${bazi1.wuxing['金'].toFixed(1)} 木${bazi1.wuxing['木'].toFixed(1)} 水${bazi1.wuxing['水'].toFixed(1)} 火${bazi1.wuxing['火'].toFixed(1)} 土${bazi1.wuxing['土'].toFixed(1)}
  大运：${bazi1.daYun.slice(0,6).map(d=>d.name+'('+d.startAge+'岁)').join(' ')}
${nameB}（${p2Gender==='male'?'男':'女'}）：
  四柱：${bazi2.fourPillars}　日主：${bazi2.dayMaster}（${bazi2.dayMasterElement}）　身${bazi2.isStrong?'强':'弱'}
  五行：金${bazi2.wuxing['金'].toFixed(1)} 木${bazi2.wuxing['木'].toFixed(1)} 水${bazi2.wuxing['水'].toFixed(1)} 火${bazi2.wuxing['火'].toFixed(1)} 土${bazi2.wuxing['土'].toFixed(1)}
  大运：${bazi2.daYun.slice(0,6).map(d=>d.name+'('+d.startAge+'岁)').join(' ')}
当前年份：${new Date().getFullYear()}年
预计算缘分分数：${compatScore}/100`;
      userMsg = `${hehunChart}

${nameA}：${p1Year}年${p1Month}月${p1Day}日${p1Hour !== undefined && p1Hour !== '' ? p1Hour+'时' : ''} · ${p1Gender === 'male' ? '男' : '女'}
${nameB}：${p2Year}年${p2Month}月${p2Day}日${p2Hour !== undefined && p2Hour !== '' ? p2Hour+'时' : ''} · ${p2Gender === 'male' ? '男' : '女'}
请依据以上精确排盘数据进行合婚分析，缘分总分使用${compatScore}/100，所有八字相关结论必须与上方数据一致。`;
    }

    // 🔴 0817: tier 已由 hehunTier(req) 统一判定(含月会员 credit 消费)。
    //   en/ko 非三档分支直接复用 tier 结果, 避免月会员在 hehunTier 已扣 credit 后
    //   又被 hasFullAccess 判为无权限造成"扣了 credit 却只给 basic"的漏账。
    const isFullTier = (tier === 'full' || tier === 'master');
    const fullAccess = isFullTier;
    let maxTokens;
    if (hehunLang === 'zh') {
      maxTokens = tier === 'master' ? 14336 : tier === 'full' ? 12288 : tier === 'basic' ? 3000 : 1200;
    } else {
      maxTokens = fullAccess ? 12288 : 4000;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ type: 'meta', mode: isDating ? 'dating' : 'marriage', score: compatScore, dims, lang: hehunLang, tier, locked: !isFullTier })}\n\n`);

    const streamBody = await deepseekStream(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }],
      { maxTokens, timeout: 300000 }
    );
    const reader = streamBody.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '', buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) { buf += decoder.decode(); break; }
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
    const _doneEvt = { type: 'done', contextId: ctxId, tier };
    if (tier === 'master') _doneEvt.masterUnlock = true;
    res.write(`data: ${JSON.stringify(_doneEvt)}\n\n`);
    res.end();
  } catch(err) {
    _refundCreditOnFail(req);
    console.error('[HEHUN-STREAM ERR]', err.message);
    try { res.write(`data: ${JSON.stringify({ type: 'error', message: '生成失败，请重试' })}\n\n`); res.end(); } catch(e) {}
  }
});

// ══════════════════════════════════════════
// POST /api/hehun/book-consult — 大师档真人连麦预约录单（MVP·只录单给运营）
// ══════════════════════════════════════════
router.post('/hehun/book-consult', rateLimitMiddleware, async (req, res) => {
  try {
    // 需登录
    const auth = req.headers['authorization'] || '';
    const token = auth.indexOf('Bearer ') === 0 ? auth.slice(7) : ((req.body && req.body.token) || '');
    const t = token ? getToken.get(token) : null;
    if (!t) return res.status(401).json({ error: '请先登录' });
    // 仅大师档可约。🔴 P0-B: 用只读版, 避免误消费月会员本月报告 credit(空扣漏账)。
    if (hehunTierReadonly(req) !== 'master') {
      return res.status(403).json({ error: '真人连麦预约仅限大师批婚用户', code: 'MASTER_REQUIRED' });
    }
    const { contact, preferredTime, note } = req.body || {};
    if (!contact) return res.status(400).json({ error: '请留下联系方式' });
    const booking = { contact, preferredTime: preferredTime || '', note: note || '' };
    // 录单：复用 insertReading（type=hehun_consult_booking）
    insertReading.run('hehun_consult_booking', JSON.stringify(booking), '', t.user_id);
    // 可选飞书通知（无则跳过）
    try {
      if (mon && mon.feishuAlert) {
        mon.feishuAlert('合婚·真人连麦预约', `联系方式:${contact} 期望时间:${booking.preferredTime} 备注:${booking.note}`, 'info');
      }
    } catch (e) {}
    return res.json({ ok: true });
  } catch (err) {
    console.error('[HEHUN-BOOK ERR]', err.message);
    if (mon && mon.captureException) mon.captureException(err, { tags: { api: 'hehun_book' } });
    return res.status(500).json({ error: '预约失败，请重试' });
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
    const topicMap = { love: '感情姻缘', wealth: '财运事业', health: '健康运势', decision: '抉择指引', year: '年度运势', recent: '近期预测' };
    const isRecent = topic === 'recent';
    const systemPrompt = `你是一位融合东西方智慧的塔罗占卜师，从业二十年，解读过上万个案。你像一位知心姐姐，温暖有力量，说话柔和但直抵人心。你能让求助者在迷茫中看到光，在困惑中找到方向。记住：逆位牌不是坏牌，是提醒；困难不是终点，是转折。每次回答至少2000字。语言：简体中文。`;
    const userMsg = isRecent
      ? `问题：${question}\n主题：近期预测（未来30天内将发生什么）\n${cardDesc ? '牌面信息：\n' + cardDesc : '使用随机三张塔罗牌（过去能量-当下现状-即将到来）'}\n\n你是一位精准的近期事件预言师。请用塔罗牌告诉我接下来约30天内可能发生的具体事情。\n\n请按以下结构输出（至少2500字）：\n\n## ✨ 近期能量总览（未来30天的整体气场）\n（描述接下来这段时间整体的能量走向，是动荡期还是稳定期，是机会期还是蛰伏期；说明这段时间的底色情绪是什么）\n\n## 📅 三张牌代表的三个时间节点\n（把三张牌分别对应"本周至10天内""10-20天""20-30天"，每个节点：\n- 这张牌揭示这段时间的主要能量是什么\n- 在感情/财运/工作/健康/人际关系这几个维度，最可能发生什么具体的事（要具体，不能只说"会有变化"，要说"可能收到一个意外消息""身边可能有人提出合作""一段旧情感可能重新浮现"）\n- 需要特别注意什么）\n\n## 🌟 最值得期待的机会窗口\n（在这30天内，哪些日子/哪段时间能量最旺？适合做什么重要的事：签合同、告白、开始新项目、谈判、求职……）\n\n## ⚠️ 需要提防的风险信号\n（这30天内最需要警惕什么？是某类人、某类决定、还是自己的某种情绪状态？给出具体的"如果你看到这个信号，一定要小心"的提示）\n\n## 💌 占卜师给你的近期锦囊\n（2-3条针对这段时间的专属行动建议，具体到"这段时间可以主动联系某人""这段时间适合储蓄而非消费""这段时间每天早晨做这一件小事会让能量更稳"）\n\n## 🔮 一句话预言\n（用一句话精准描述这30天的总体走向，让人能记住、能对照、能在结束时回来验证）`
      : `问题：${question}\n主题：${topicMap[topic] || topic || '综合'}\n${cardDesc ? '牌面信息：\n' + cardDesc : '使用随机三张塔罗牌（过去-现在-未来）'}\n\n请按以下结构出具完整塔罗解读：\n## 一、整体格局概览（200-300字）\n## 二、逐牌详细解读（每张牌300-400字）\n## 三、综合解读与能量走向（300-400字）\n## 四、3条可执行的行动建议\n## 五、占卜师的悄悄话（100-150字）`;

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ type: 'meta' })}\n\n`);

    const streamBody = await deepseekStream([{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }], { maxTokens: 8192, timeout: 300000 });
    const reader = streamBody.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '', buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) { buf += decoder.decode(); break; }
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
    // 🔴 P1修复(专家复审): 原为硬 402 全锁死, 违背"所有报告统一免费预览段"。
    //   改为: 全解锁会员/单买/月会员(消费credit)→完整版; 未付费→免费预览段(命盘格局+命宫主星2节+锁定引导)。
    const ziweiAccess = gateReportAccess(req, ['ziwei_full', 'ziwei']).full;
    const { question: zwQuestion, lang: zwLang } = req.body;

    // ── 紫微引擎注入（无论免费/完整版都注入，让免费预览也有真实排盘数据）──
    let zwEngineBlock = '';
    try {
      const ch = computeBaziChart({
        year: Number(birthYear), month: Number(birthMonth),
        day: Number(birthDay), hour: Number(birthHour) || 0,
        gender: gender || 'female', includeZiwei: true
      });
      const zw = ch.ziwei;
      if (zw) {
        const palaceLines = (zw.gongs || []).map(g =>
          `  ${g.gong}(${g.tiangan||''}${g.dizhi||''})：主星${(g.mainStars||[]).join('·')||'无'} 辅星${(g.auxStars||[]).join('·')||'无'}`
        ).join('\n') || '（宫位数据不可用）';
        const mingGong = (zw.gongs || []).find(g => g.gong === '命宫');
        const mingStars = mingGong ? (mingGong.mainStars||[]).join('·') : '';
        const sihuaStr = (zw.gongs || []).flatMap(g =>
          (g.sihua || []).map(s => `${s.star}${s.hua}(${g.gong})`)
        ).join(' ');
        zwEngineBlock = `【紫微斗数精确命盘（后端引擎排盘·禁止 LLM 自行推算或修改任何星曜宫位）】
命主：${birthYear}年${birthMonth}月${birthDay}日${birthHour}时 ${gender === 'male' ? '男' : '女'}命
五行局：${(zw.wuXingJu && zw.wuXingJu.name) || zw.wuXingJu || ''}　命宫：${mingGong ? (mingGong.tiangan||'')+(mingGong.dizhi||'') : ''}
命宫主星：${mingStars || '（命宫无主星·需借对宫）'}
十二宫星曜分布：
${palaceLines}
四化飞星：${sihuaStr || '（无四化数据）'}`;
      }
    } catch (e) {
      console.warn('[ZIWEI-STREAM] 引擎注入失败，降级 LLM 自解：', e && e.message);
    }

    const zwEngineSection = zwEngineBlock ? `\n${zwEngineBlock}\n` : '';
    const ziweiSystemFull = `你是一位精通紫微斗数的命理师，师承中州派与飞星派双脉，从业30年，批过上万张命盘。你深谙紫微精髓，能从命盘中看透一个人的一生轨迹。语言通俗易懂，大白话让完全不懂紫微的人也能听懂。分析必须专业、深刻、具体。

【输出格式】用 Markdown，标题分段，简体中文。总字数 9000-11000字，全部 17 个维度写完写透，每个维度字数不低于要求，严禁用"略"或"详见下文"代替内容。
${zwEngineSection}【健康维度】只说脏腑养生方向，严禁点名具体西医病名，不制造恐慌。

【收尾合规】报告最后附一行："本报告由AI辅助生成，仅供参考娱乐，不构成医学、法律、投资或人生重大决策建议。"${langSuffix(zwLang)}`;

    const ziweiSystemPreview = `你是一位精通紫微斗数的命理师，师承中州派，从业30年。这是【免费预览版】，只输出前3节让用户感受真实价值，然后停止并引导解锁完整版。语言通俗易懂、用大白话。用Markdown格式。语言：简体中文。${zwEngineSection}`;

    const systemPrompt = ziweiAccess ? ziweiSystemFull : ziweiSystemPreview;
    const userMsg = ziweiAccess
      ? `出生：${birthYear}年${birthMonth}月${birthDay}日${birthHour}时\n性别：${gender === 'male' ? '男' : '女'}\n用户关注：${zwQuestion || '请给我全面的紫微斗数命盘解读'}\n\n请严格按以下 17 个维度展开，每个维度标题用对应 emoji 开头：\n\n1. 🌟 命盘格局总览（不少于600字）\n2. ☀️ 命宫主星深度解读（不少于800字）\n3. 💰 财帛宫（财星力量、聚财方式、最佳求财年份3个，不少于500字）\n4. 💕 夫妻宫（正缘星位、配偶特征、遇缘年份、感情模式，不少于500字）\n5. 👨‍👩‍👧‍👦 子女宫（不少于350字）\n6. 🏠 田宅宫（不少于350字）\n7. 💼 官禄宫（事业星、职业路径、升职最佳年份，不少于500字）\n8. 👥 奴仆宫（不少于350字）\n9. 🚀 迁移宫（不少于350字）\n10. 🏥 疾厄宫（养生方向，中医脏腑角度，不点病名，不少于450字）\n11. 🌈 福德宫（不少于350字）\n12. 👨‍👩 父母宫（不少于350字）\n13. 🌀 四化飞星（化禄/化权/化科/化忌各自落宫及影响，不少于550字）\n14. 📅 当前大限深批（起止年份、主题、关键年份，不少于550字）\n15. 🔮 未来10年逐年流年（每年财/情/事评分+一句主题，不少于900字）\n16. 🎯 开运锦囊（幸运色、吉方、推荐佩戴物、流年避讳，不少于450字）\n17. 💌 命理师私语（只对此命盘说的心里话，不少于350字）`
      : `出生：${birthYear}年${birthMonth}月${birthDay}日${birthHour}时\n性别：${gender === 'male' ? '男' : '女'}\n\n这是【免费预览版】，只输出以下3节（合计约700字，内容真实有用）：\n\n🌟 命盘格局总览（2-3段，200字）\n☀️ 命宫主星（2段，200字）\n🌙 今年大限流年（1段，200字）\n\n完成后输出：---LOCKED---\n💰 财帛宫深度解读 · 完整版解锁\n💕 夫妻宫 · 完整版解锁\n💼 官禄宫 · 完整版解锁\n🌀 四化飞星 · 完整版解锁\n🔮 未来10年流年 · 完整版解锁\n\n最后一行：想看完整紫微斗数报告？解锁后可看到 17 个维度全部深度批算，含精准婚期、事业贵人年份与开运锦囊。`;

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ type: 'meta', tier: ziweiAccess ? 'full' : 'basic', locked: !ziweiAccess })}\n\n`);

    const streamBody = await deepseekStream([{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }], { maxTokens: ziweiAccess ? 16384 : 3000, timeout: 300000 });
    const reader = streamBody.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '', buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) { buf += decoder.decode(); break; }
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
    _refundCreditOnFail(req);
    console.error('[ZIWEI-STREAM ERR]', err.message);
    try { res.write(`data: ${JSON.stringify({ type: 'error', message: '生成失败' })}\n\n`); res.end(); } catch(e) {}
  }
});

// ══════════════════════════════════════════
// POST /api/fengshui/stream — 风水流式（SSE）增强版
// ══════════════════════════════════════════
router.post('/fengshui/stream', rateLimitMiddleware, async (req, res) => {
  try {
    const { houseDirection, floor, rooms, address, question, members, floorPlanBase64, houseStatus, decoratedPhotos, emptyRoomPhotos, designPlanPhotos } = req.body;
    if (!houseDirection) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: '请提供房屋朝向' });
    }

    // 付费门：免费只给前两节预览
    const fullAccess = gateReportAccess(req, ['fengshui', '风水']).full;

    const systemPrompt = `你是蒋大鸿三元玄空风水嫡传第九代传人，同时精研八宅明镜、三合水法与形势派堪舆，驻场实勘住宅逾三万套、走访海内外35年。你的报告素以"一针见血、落地即用"著称——绝不讲玄虚理论，只给具体到"这面墙放这个、那个角落换那件东西、哪天动工最吉"的实操建议。你同时运用玄空飞星（九星气场流动分析）与八宅明镜（命卦与朝向匹配）双体系互参，层次比单一体系深出一倍。

【输出铁律 — 必须严格遵守】
1. 报告字数：完整版8000-12000字，每节须详尽展开，严禁用"略""详见下文""等"代替内容
2. 禁止套话开场（禁止用"感谢您的信任""很高兴为您服务"等废话起头，直接进入分析）
3. 每一处建议必须具体：摆件写清品类+尺寸+颜色；植物写清品种+摆放高度；改动写清"哪面墙/哪个角落/面朝哪个方向"
4. 产品推荐必须写亚马逊/Etsy可购到的品类（目标读者在海外），不要推荐国内淘宝品牌
5. 价格用美元（$）标注
6. 语气：像一位真正懂行的老朋友在帮你看房子，温暖、亲切、不吓唬人，有时可以幽默一两句
7. 报告最后必须有一段完全个性化的"大师私语"，针对这套房子和这位业主的具体情况，不得使用任何通用套话
简体中文。${DISCLAIMER_ZH}`;

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

    // 房屋状态与图片分析段落
    const status = houseStatus || 'decorated';
    let photoNote = '';
    if (floorPlanBase64) {
      photoNote += '\n\n【已上传户型平面图】请仔细识别户型格局，分析穿堂风（前后门对齐）、卫生间居中泄气、厨厕相邻、入户直冲等问题，并给出针对性建议。';
    }
    if (status === 'decorated' && decoratedPhotos && decoratedPhotos.length > 0) {
      photoNote += `\n\n【已上传${decoratedPhotos.length}张装修后室内照片】请逐张分析现有布局存在的风水问题：家具摆放位置是否压了煞气方位、颜色搭配与五行是否匹配、哪些物品需要移位或更换，并说明每条建议的风水原理（为什么这样做）。`;
    }
    if (status === 'empty' && emptyRoomPhotos && emptyRoomPhotos.length > 0) {
      photoNote += `\n\n【已上传${emptyRoomPhotos.length}张空房照片】这是未装修的毛坯空间。请根据空间实际情况，从零开始规划：床应放在哪个位置（头朝哪个方向）、沙发如何摆、书桌朝向、各房间功能分区——每条建议必须详细说明为什么这样放（风水原理、气场流动、命卦匹配原因）。`;
    }
    if (status === 'design' && designPlanPhotos && designPlanPhotos.length > 0) {
      photoNote += `\n\n【已上传${designPlanPhotos.length}张设计图/效果图】请仔细审阅设计方案，从风水角度逐一点评：哪些设计符合风水原则（说明为什么好）、哪些需要调整（说明为什么有问题以及如何改），并给出具体修改建议（如"将床从北墙移到东南角，因为东南为木旺之位，配合户主坎命东四命吉向"）。`
    }
    const floorPlanNote = photoNote; // backward compat alias

    const freeGuidance = fullAccess ? '' : `\n\n【重要】本次为免费预览版，按以下方式输出：
1. 「📸 现状诊断」章节：只输出1条最重要的问题（完整格式：[现象] → [风水原理] → [具体改法]），然后在该条结尾括号内自然注明"（完整版共诊断X处问题，解锁后查看）"，不要继续输出更多诊断条目。
2. 「🏠 房屋总格局与气场特征」：完整输出，300-400字，内容真实有用。
3. 「🌐 玄空飞星年盘叠加分析」：完整输出，300-400字。
4. 之后停止，结尾自然提示完整版包含剩余8个章节+完整购物清单。不要道歉，不要说"这是免费版"。`;

    const statusLabel = { decorated: '已装修入住', empty: '毛坯空房（未装修）', design: '设计图阶段' }[status] || '已装修入住';
    const userMsg = `房屋朝向：${houseDirection}
楼层：${floor || '未提供'}
房间布局：${rooms || '未提供'}
地址/区域：${address || '未提供'}
房屋现状：${statusLabel}
用户问题：${question || '请综合分析房屋风水，给出全面的开运布局方案'}${membersSection}${floorPlanNote}${freeGuidance}

请严格按照以下结构输出完整风水报告（要求8000-12000字，每个章节须详尽展开，禁止以"略"或省略号代替任何内容）：

## 📸 现状诊断${status === 'empty' ? '（空房规划）' : status === 'design' ? '（设计图审阅）' : '（现有布局诊断）'}
（${status === 'decorated' ? '根据上传的室内照片，逐一诊断现有布局的风水问题；若无照片则根据户型描述推断。每条问题必须说明：[现象] → [风水原理解释：为什么这样会有影响] → [具体改法]。格式示例："沙发背对窗户无靠山 → 风水讲究\'背有靠、面有望\'，气流从窗户涌入无实墙承托，主人运势起伏不稳、缺乏贵人扶持 → 建议在沙发背后挂一幅山景画（实木框，尺寸60cm以上），或将沙发移至有实墙的一侧"' : status === 'empty' ? '这是毛坯空房，从零开始规划。逐一说明每个功能区的最佳位置，必须详细解释为什么这样规划（风水原理 + 命卦配合 + 气场流动 + 生活实用性）。格式示例："主卧床位建议放在房间东南角，头朝东南 → 原因：[1]东南为巽卦，属木，主文昌与财运；[2]户主命卦为坎卦（东四命），东南为\'延年\' 吉位，头朝吉向让睡眠中也在吸纳吉气；[3]气场从东南方的窗户流入，过床后向西流出，形成\'纳气\'格局而非\'冲射\'格局"' : '逐一审阅设计图中的每个区域，给出风水评分（10分制）和修改建议，必须解释为什么这样设计好或不好（风水原理 + 具体影响 + 改法）。'})

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
- 推荐摆件：天然黄水晶球（直径3英寸以上）—— [Amazon一键购买](https://www.amazon.com/s?k=natural+citrine+crystal+ball+sphere&tag=shenyuan-20)，选有矿石证书的店铺，参考价格：$25-80
- 摆放高度：与心脏平齐的柜台或桌面，不可摆在地上，不可放在卫生间附近

**八宅生气位财局**：
- 推荐：貔貅一对（黄铜铸造款）—— [Amazon一键购买](https://www.amazon.com/s?k=brass+Pi+Xiu+Pixiu+feng+shui+statue+pair&tag=shenyuan-20)，参考价格：$20-60/对；[Etsy手工开光款](https://www.etsy.com/search?q=pixiu+feng+shui+brass)，价格$30-120
- 摆放要点：头朝大门方向，不可对卫生间，底座稳固

**玄空旺财位**：
- 推荐：聚宝盆（铜质）内放五色天然水晶碎石—— [Amazon一键购买](https://www.amazon.com/s?k=feng+shui+wealth+bowl+with+crystals&tag=shenyuan-20)，参考价格：$15-50
- 附招财树：[Amazon一键购买](https://www.amazon.com/s?k=feng+shui+money+tree+crystal&tag=shenyuan-20)，高度60cm以上款，参考价格：$25-80

**财位购物总预算参考**：基础配置约$60-180，进阶配置约$180-400，以上均可在Amazon Prime免费两日达或Etsy购得，选评价4.5星以上的店铺）

## ❤️ 桃花位与人缘位激活
（本户型桃花位确认（八宅体系）与催桃花/人缘方案：
- 粉晶球：天然玫瑰石英，直径2.5英寸以上—— [Amazon一键购买](https://www.amazon.com/s?k=rose+quartz+crystal+ball+sphere&tag=shenyuan-20)，参考价格：$15-50
- 牡丹挂画：宜选粉红/浅红色系，悬挂于桃花位墙面—— [Etsy搜索](https://www.etsy.com/search?q=Chinese+peony+painting+pink)，参考价格：$20-100
- 玫瑰石英水晶簇：原矿款—— [Amazon一键购买](https://www.amazon.com/s?k=rose+quartz+cluster+raw&tag=shenyuan-20)，参考价格：$20-80
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
- **尖角煞/刀煞**（邻屋屋角正对窗/门）：泰山石敢当石碑，[Amazon购买](https://www.amazon.com/s?k=feng+shui+stone+tablet+taishan&tag=shenyuan-20)，参考价$8-25；或大叶圆形植物（如巴西木/幸福树）阻挡视线
- **病符星位（二黑）**：铜葫芦（黄铜铸造，口朝下），[Amazon购买](https://www.amazon.com/s?k=brass+feng+shui+gourd+wu+lu&tag=shenyuan-20)，参考价$12-45，挂于该方位墙上；长期点檀香/藏香（每日1支，早晨点）
- **五黄廉贞（需重点化解的方位）**：${new Date().getFullYear()}年五黄落位的方位禁止动土/维修，放六铜钱串，[Amazon购买](https://www.amazon.com/s?k=feng+shui+six+emperor+coins&tag=shenyuan-20)，参考价$8-20
- **穿堂风（前后门正对）**：玄关处立1.2米以上屏风，[Amazon搜索](https://www.amazon.com/s?k=room+divider+screen+feng+shui&tag=shenyuan-20)，参考价$60-400；或在正对位置悬挂流苏/珠帘分气
- **面对楼梯/电梯**：门上方外侧挂凸面八卦镜（直径15cm以上），[Amazon购买](https://www.amazon.com/s?k=bagua+mirror+convex+feng+shui&tag=shenyuan-20)，参考价$12-35
- **镜子对床**：必须遮盖（可用布帘）或移位，是卧室最大禁忌之一
- **卫生间在吉位中央**：长明灯（红灯泡，24小时亮）+铜葫芦+抽风机常开，三件套缺一不可
- **厨厕相邻**：中间隔断处挂五帝钱串，[Amazon购买](https://www.amazon.com/s?k=5+emperor+coins+feng+shui&tag=shenyuan-20)，参考价$6-15；橱柜上方放粗盐碗（每月换一次粗盐））

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

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ type: 'meta' })}\n\n`);

    // 构建消息数组，收集所有上传图片
    const imageContents = [];
    if (floorPlanBase64) imageContents.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${floorPlanBase64}` } });
    const roomImgs = (status === 'decorated' ? decoratedPhotos : status === 'empty' ? emptyRoomPhotos : designPlanPhotos) || [];
    for (const b64 of roomImgs.slice(0, 5)) {
      if (b64) imageContents.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } });
    }

    let messages;
    if (imageContents.length > 0) {
      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: [...imageContents, { type: 'text', text: userMsg }] }
      ];
    } else {
      messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }];
    }

    const streamBody = await deepseekStream(messages, { maxTokens: fullAccess ? 16000 : 3000, timeout: 300000 });
    const reader = streamBody.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '', buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) { buf += decoder.decode(); break; }
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') continue;
        try { const json = JSON.parse(raw); const c = json.choices?.[0]?.delta?.content || ''; if (c) { fullText += c; res.write(`data: ${JSON.stringify({ type: 'chunk', content: c })}\n\n`); } } catch(e) {}
      }
    }
    insertReading.run('fengshui', JSON.stringify({ houseDirection, floor, rooms, address, question, houseStatus: status, members: members || [], photoCount: imageContents.length }), fullText, req.userId);
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch(err) {
    _refundCreditOnFail(req);
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
    // 阴宅=高端报告(全程付费, 无免费预览)。全解锁会员/单买放行; 月会员消费本月 credit 放行。
    const yinzhaiAccess = gateReportAccess(req, ['yinzhai']).full;
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
- 子孙运势：阴宅影响后代三代、子孙运势的说法为传统堪舆象征说法，非确定预言、非科学因果，仅供参考；可从财丁贵三个维度作象征性阐释

【输出铁律】
1. 字数要求：完整分析8000字以上，每个候选地至少1200字详细分析
2. 情感基调：温暖、稳重、充满人文关怀；不用恐吓性语言，不说"此地大凶"之类绝对化判断
3. 专业格局：每个候选地必须逐一评分，维度包括：龙脉/穴场/砂水/朝向/交通便利/日照/配套
4. 最终推荐必须斩钉截铁，给出明确答案，不可含糊说"视情况而定"
5. 安葬日期必须给出具体时间范围（精确到季节或月份）
6. 报告结尾用一段完全个性化的"大师心语"，真诚地告诉家属：您做了最好的安排
简体中文。${DISCLAIMER_ZH}`;

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

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
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
    const decoder = new TextDecoder('utf-8');
    let fullText = '', buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) { buf += decoder.decode(); break; }
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
    _refundCreditOnFail(req);
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
    _refundCreditOnFail(req);
    console.error('[FENGSHUI ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试' });
  }
});

// ══════════════════════════════════════════
// POST /api/geo-fortune — 地域命理分析
// ══════════════════════════════════════════
router.get('/geo-fortune', (req, res) => res.status(405).json({ error: 'Method Not Allowed', hint: 'Use POST' }));
router.post('/geo-fortune', rateLimitMiddleware, async (req, res) => {
  try {
    const { latitude, longitude, birthYear, birthMonth, birthDay, gender, lang } = req.body;
    if (latitude === undefined || longitude === undefined) return res.status(400).json({ error: '请提供经纬度' });

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const latDir = lat >= 0 ? '北半球' : '南半球';
    const lngDir = lng >= 0 ? '东经' : '西经';

    // ── 多维五行映射（经度+纬度综合判断，比原来单一区间精确）──
    // 传统地理五行：东方木·南方火·中央土·西方金·北方水（以东经120°为参照）
    let regionElement = '土';
    let regionNotes = '';
    if (lat > 60) {
      regionElement = '水'; regionNotes = '极北寒带·水气盛';
    } else if (lat > 35) {
      // 中高纬度：偏金水
      if (lng >= 100 && lng <= 135) { regionElement = '木'; regionNotes = '东亚温带·木气旺（生发之地）'; }
      else if (lng > 135 || (lng >= -180 && lng < -100)) { regionElement = '水'; regionNotes = '北太平洋区域·水木交汇'; }
      else if (lng >= 60 && lng < 100) { regionElement = '金'; regionNotes = '中亚高原·金气收敛'; }
      else if (lng >= -100 && lng < -60) { regionElement = '金'; regionNotes = '北美大陆·金水之气'; }
      else if (lng >= 0 && lng < 60) { regionElement = '土'; regionNotes = '欧亚大陆中心·土气稳重'; }
      else { regionElement = '金'; regionNotes = '西欧·金水之气'; }
    } else if (lat > 15) {
      // 中低纬度：偏火土
      if (lng >= 100 && lng <= 125) { regionElement = '木'; regionNotes = '东南亚·木火交汇，生机旺盛'; }
      else if (lng >= 65 && lng < 100) { regionElement = '火'; regionNotes = '南亚次大陆·火气炎烈（创造力旺）'; }
      else if (lng >= 125 || (lng >= -180 && lng < -65)) { regionElement = '水'; regionNotes = '太平洋区域·水气通达'; }
      else { regionElement = '火'; regionNotes = '热带近赤道·火土之气'; }
    } else if (lat >= -15) {
      regionElement = '火'; regionNotes = '赤道区域·纯火极旺（热情·能量·变化快）';
    } else if (lat >= -35) {
      regionElement = '火'; regionNotes = '南半球热带·火气余韵';
    } else {
      regionElement = '水'; regionNotes = '南半球高纬度·水寒之气';
    }

    // 若有出生信息，推算命主日主（简化：用生年五行）
    let birthElementNote = '';
    if (birthYear) {
      const yearMod10 = ((parseInt(birthYear) - 4) % 10 + 10) % 10;
      const tianGan = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'][yearMod10];
      const tianGanElem = {甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'}[tianGan] || '土';
      birthElementNote = `\n命主生年天干：${tianGan}（五行属${tianGanElem}）`;
    }

    const geoSystemPrompt = `你是一位精通中国传统堪舆地理与五行方位之学的命理师，从业三十余年，也熟悉现代人居环境（气候、地形、城市产业与文化氛围）对人的影响，善于把传统方位理论与现实居住体验结合，给出务实的参考建议。
【合规铁律】：只作环境适配的文化参考，绝不诱导搬家/迁居等重大决策，不作任何效果承诺。
你分析不同地域对个人运势的影响时，结合五行方位（东木·南火·中土·西金·北水）、地形地貌（山岳/平原/海滨/高原）、气候节律与城市产业文化氛围综合判断。
分析要具体、落地、可参考——不说"此地宜居"这种废话，而是从环境适配角度说明什么"类型"的环境更契合命主，以及在当前所在地可调整的开运方位建议。

【输出格式】Markdown，标题分段，简体中文。总字数 4500字，8 个维度全部写完写透，每个维度字数不低于要求，严禁用"略"代替内容。

【收尾合规】末尾加："本报告由AI辅助生成，仅供参考娱乐，不构成医学、法律、投资或人生重大决策建议；去留是重大人生选择，请结合现实工作、家庭与经济综合判断。"${langSuffix(lang)}`;

    const geoUserPrompt = `用户位置：纬度 ${lat}（${latDir}），经度 ${lng}（${lngDir}）
地域五行分析：${regionElement} · ${regionNotes}
出生信息：${birthYear ? birthYear + '年' : ''}${birthMonth ? birthMonth + '月' : ''}${birthDay ? birthDay + '日' : ''}${birthElementNote}
性别：${gender || '未提供'}

请按以下 8 个维度出具完整地域命理分析报告（总字数 4500字）：

1. 🌍 地域能量全景（不少于800字）
   - 此纬度/气候带的地理五行属性分析（${regionElement}气如何影响居住者的精神状态？）
   - 地形地貌特征（平原/山地/沿海/内陆）的命理解读
   - 此地的历史与文化能量积淀（人杰地灵的成因分析）
   - 气候节律（四季变化节奏）对气场的周期性影响

2. 🧭 与命主的五行匹配（不少于700字）
   ${birthYear ? `- 命主的天干五行（${birthElementNote.replace(/\n/,'')}）与此地${regionElement}气的生克关系` : '- 基于一般五行原理分析此地对命主的匹配度'}
   - 此地的五行对命主日常状态（精力/心情/睡眠质量）的具体影响
   - 若五行相克：化解的生活方式调整建议（室内装饰/颜色选择/日常习惯）

3. 💰 财运地理分析（不少于700字）
   - 此地产业结构的五行属性（适合哪类行业发展？）
   - 城市经济能量场：处于快速发展期（木）/成熟稳定期（土）/转型期（金）/扩张期（火）/积累期（水）？
   - 具体职业方向建议（5个与此地能量场最匹配的行业）
   - 财运最旺的城区方位与时间节点

4. ❤️ 感情与人际地理（不少于600字）
   - 此地文化对感情关系的影响（开放/保守/多元/传统）
   - 移民聚居地的"气场混合"对感情的特殊影响
   - 此地人际关系的主要特征（直接/含蓄/社群感强/个人主义）
   - 在此地结识正缘的最佳方式与时间窗

5. 🏃 健康与体质地理（不少于600字，只说养生方向，禁止点病名）
   - 此气候带对身体五脏六腑的影响（中医角度）
   - 高纬度/低纬度/沿海/高原对体质的具体影响
   - 在此地应强化的养生方向（饮食/作息/运动类型）
   - 节气转换时期的特别注意（哪些月份最需要调整？）

6. 🎯 在此地发展的3年规划建议（不少于700字）
   - 第一年：在此地站稳脚跟的关键策略（具体到行动）
   - 第二年：深耕此地资源的路径
   - 第三年：评估是否继续留守的命理信号
   - 此地最适合在哪个年龄段（20s/30s/40s/50s+）深扎？

7. 📍 环境适配与开运方位（不少于600字）
   - 从五行适配角度，说明什么"类型"的环境（气候/产业氛围/文化调性）更契合命主——仅作自我了解参考，不构成迁居建议，绝不诱导搬家
   - 重点：在当前所在城市内可调整的旺运方位（居所朝向/城区方向/社区类型/办公位）
   - 强调：去留是重大人生决策，应结合现实工作/家庭/经济综合判断，命理只作参考

8. 💌 地理命理师的叮嘱（不少于300字）
   - 只对这个具体地理位置+这个命主说的心里话
   - 有没有什么命理上值得特别注意的"地域业力"？
   - 在此地最重要的一件事是什么？`;

    const messages = [
      { role: 'system', content: geoSystemPrompt },
      { role: 'user', content: geoUserPrompt }
    ];
    var _gl = gateMessages(req, ['bazi','hehun','ziwei','xingming','astrology','fengshui','liuyao','qimen','daliuren','lingqian','pastlife','风水','六爻','奇门','大六壬','灵签','前世','紫微','合婚','姓名','占星'], messages, 16384);
    const analysis = await deepseekChat(_gl.messages, { maxTokens: _gl.maxTokens });
    res.json({ analysis, location: { lat, lng, regionElement, regionNotes } });
  } catch (err) {
    _refundCreditOnFail(req);
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
      '你是一位精通姓名学的命理大师，深谙五格剖象法（天格、人格、地格、外格、总格）与生肖喜忌之道，从业三十余年，为成千上万人改过名。你的分析专业深刻——笔画数理、五行补益、生肖适配，面面俱到。你的语气亲切实在，用大白话解释深奥姓名学原理，不故弄玄虚。每个建议都给出具体的新名字选项，让人能照着做。' + DISCLAIMER_ZH,
      `用户姓名：${surname}${givenName}
姓氏：${surname}，名字：${givenName}，生肖：${zodiac || '未提供'}，性别：${gender === 'male' ? '男' : gender === 'female' ? '女' : '未提供'}

请按以下结构出具一份完整的姓名学分析报告，总字数不少于3000字：
## 一、📊 五格数理分析（600-800字）
## 二、🦊 生肖喜忌分析（400-600字）
## 三、🔥 五行补益分析（300-400字）
## 四、🎯 姓名综合评分（100-200字）
## 五、📈 姓名对各方面运势的影响（500-600字）
## 六、💡 改名建议（600-800字·姓名是文化符号，非命运决定因素；改名纯属个人选择，不断言现名不好、不制造焦虑，语气正向温和）
## 七、📝 姓名能量提升小技巧（200-300字）
## 八、💌 姓名学师的叮嘱（100-200字）`
    );
    var _g = gateMessages(req, ['bazi','hehun','ziwei','xingming','astrology','八字','合婚','紫微','姓名','占星','星盘'], messages);
    const result = await deepseekChat(_g.messages, { maxTokens: _g.maxTokens });
    insertReading.run('xingming', JSON.stringify(req.body), result, req.userId);
    var ctxId = saveQaContext('xingming', req.body, result);
    res.json({ reading: result, contextId: ctxId });
  } catch (err) {
    _refundCreditOnFail(req);
    console.error('[XINGMING ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试', detail: err.message });
  }
});

// ══════════════════════════════════════════
// POST /api/astrology — 西方占星
// ══════════════════════════════════════════
router.post('/astrology', rateLimitMiddleware, async (req, res) => {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, birthMinute, latitude, longitude, gender, question, lang } = req.body;
    if (!birthYear || !birthMonth || !birthDay) return res.status(400).json({ error: '请提供出生日期' });

    // ── 旧版 astrology.calcAstrology 引擎（提供三大星座/宫位等基础数据）──
    const chart = astrology.calcAstrology(
      parseInt(birthYear), parseInt(birthMonth), parseInt(birthDay),
      birthHour !== undefined ? parseInt(birthHour) : undefined,
      birthMinute !== undefined ? parseInt(birthMinute) : undefined,
      latitude !== undefined ? parseFloat(latitude) : 40.0,
      longitude !== undefined ? parseFloat(longitude) : 116.0
    );

    // ── 新版 western-astro-engine 精确排盘（VSOP87天文算法，含相位）──
    // 两块注入：旧引擎的中文数据 + 新引擎的精确行星经度/宫位/相位
    const chartSummaryOld = `【三大重要星座（旧引擎）】
太阳 Sun：${chart.sun.signZh}(${chart.sun.signEn}) ${chart.sun.degree}°
月亮 Moon：${chart.moon.signZh}(${chart.moon.signEn}) ${chart.moon.degree}°
上升 Ascendant：${chart.rising.signZh}(${chart.rising.signEn}) ${chart.rising.degree}°

【元素分布】${chart.elements.map(e => e.name + ': ' + e.percentage + '% (' + e.count + '个)').join(' · ')}
【模式分布】${chart.modalities.map(m => m.name + ': ' + m.percentage + '% (' + m.count + '个)').join(' · ')}
【月亮相位】${chart.moonPhase.phase} (照明度 ${chart.moonPhase.illumination})
【宫位系统（等宫制）】${chart.houses.map(h => '第' + h.number + '宫:' + h.signZh).join(' ')}`;

    // 精确天文引擎注入（含相位）
    const westernEngineBlock = buildWesternBlock({
      birthYear: parseInt(birthYear), birthMonth: parseInt(birthMonth), birthDay: parseInt(birthDay),
      birthHour: birthHour !== undefined ? parseInt(birthHour) : undefined,
      birthMinute: birthMinute !== undefined ? parseInt(birthMinute) : 0,
      lat: latitude !== undefined ? parseFloat(latitude) : undefined,
      lng: longitude !== undefined ? parseFloat(longitude) : undefined,
      tz: latitude !== undefined ? Math.round(parseFloat(longitude || 116) / 15) : undefined,
    });

    const fullChartBlock = `【西方占星精确星盘数据（后端注入·禁 LLM 自算或修改任何行星位置）】
出生：${birthYear}/${birthMonth}/${birthDay} ${birthHour !== undefined ? birthHour + ':' + (birthMinute || '00') : '时间不详（精确月亮/上升不可用）'}
性别：${gender === 'male' ? '男 Male' : gender === 'female' ? '女 Female' : '未知'}
出生地经纬度：${latitude !== undefined ? latitude + '°N/S' : '未提供'}，${longitude !== undefined ? longitude + '°E/W' : '未提供'}

${chartSummaryOld}

${westernEngineBlock || '（精确天文引擎数据不可用，请仅基于上方基础星盘数据解读）'}`;

    // ── 分档控制 ──
    var _gm = gateMessages(req, ['bazi','hehun','ziwei','xingming','astrology','八字','合婚','紫微','姓名','占星','星盘'], [], 16384);
    const astroTier = resolveReportTier(_gm.full, req.body.tier);

    const astroSystemPrompt = `你是一位精通西方占星学的资深占星师，融合古典占星与现代心理占星，从业20年，为上千人解读过本命星盘。
你的语言：70%中文 + 30%英文关键术语（星座名/行星名用英文，其余中文解释），让用户既能看懂又能学到占星知识。
解读深刻、温暖、具体——不说"你可能比较有创意"，说"当你的金星在双子与火星射手形成对分时，你的创意来自于……"。

【精确星盘数据（后端注入·禁 LLM 自算）】
${fullChartBlock}

【健康章节】只说中医/西医体质养生倾向，严禁做医疗诊断，不点具体病名，不制造恐慌。
【收尾合规】报告最后附一行免责声明："本报告由AI辅助生成，仅供参考娱乐，不构成医学、法律、投资或人生重大决策建议。"${langSuffix(lang)}`;

    let astroUserPrompt, astroMaxTokens;
    if (astroTier === 'free') {
      astroMaxTokens = 3000;
      astroUserPrompt = `出生：${birthYear}/${birthMonth}/${birthDay}
用户关注：${question || '请给我完整的星盘解读'}

请仅输出以下3节（合计约700字），然后输出锁定提示：

## 🌟 星盘格局总览（三大支柱概述、主导元素，约200字）
## ☀️🌙⬆️ 三大支柱简读（太阳/月亮/上升各60字，合计约200字）
## 📅 今年木星/土星运行对你的影响（约200字）

完成后输出：---LOCKED---
🪐 行星落座详析（10颗行星）· 完整版解锁
🏠 12宫位深度解读 · 完整版解锁
📐 主要相位详解 · 完整版解锁
💰💕💼🏥 人生领域深度分析 · 完整版解锁
📅 未来3年行运 · 完整版解锁

最后一行：解锁完整版可看到10颗行星落座、12宫位全析、主要相位与未来3年行运详解。`;
    } else if (astroTier === 'standard') {
      astroMaxTokens = 8000;
      astroUserPrompt = `出生：${birthYear}/${birthMonth}/${birthDay}
性别：${gender === 'male' ? '男 Male' : '女 Female'}
用户关注：${question || '请给我完整的星盘解读'}

请按以下结构出具标准版西方占星报告（总字数约2500字）：

1. 🌟 星盘格局总览（三大支柱/主导元素/模式，300字）
2. ☀️🌙⬆️ 三大支柱详解（太阳/月亮/上升各200字，合计600字）
3. 🪐 行星落座摘要（选最关键的5颗行星，各100字）
4. 🏠 宫位简析（12宫各30字，合计360字）
5. 💰💕💼 人生核心领域（财/情/事各100字）
6. 📅 今年木星/土星关键过境
7. 💌 占星师寄语（100字）

结尾：想看完整版？$49完整版包含：10颗行星精确解析、主要相位详解、未来3年逐年行运与月相日历。`;
    } else {
      astroMaxTokens = 16384;
      astroUserPrompt = `出生：${birthYear}/${birthMonth}/${birthDay} ${birthHour !== undefined ? birthHour + ':' + (birthMinute || '00') : '时间不详'}
出生地：${latitude !== undefined ? '纬度' + latitude + '° 经度' + longitude + '°' : '未提供（宫位/上升不可用）'}
性别：${gender === 'male' ? '男 Male' : '女 Female'}
用户关注：${question || '请给我完整的星盘解读'}

请根据上方精确星盘数据，按以下 10 个维度出具完整西方占星解读报告（总字数 9000字）：

1. 🌟 星盘格局总览（三大支柱概述、主导元素与模式、格局定性，400字）

2. ☀️🌙⬆️ 三大支柱深度解读（每个至少400字）
   - 太阳（Sun）：核心自我/生命目标/身份认同
   - 月亮（Moon）：情感需求/内在安全感/本能反应
   - 上升（Rising）：外在形象/第一印象/处世方式

3. 🪐 行星落座详析（共10颗行星，每颗至少150字）
   - 各行星所在星座+宫位的具体意义
   - 与太阳/月亮的主要相位说明

4. 🔥🌍💨💧 元素与模式分析（400字）
   - 四元素（火/土/风/水）分布与偏重
   - 三模式（本位/固定/变动）分布与含义
   - 元素缺乏者的补偿方式

5. 🏠 12宫位简析（每宫位60字，共720字）

6. 📐 主要相位解读（选3-5个最重要相位，每个200字；必须逐条引用上方注入数据中真实存在的相位——写出对应的行星、度数与容许度(orb)，严禁杜撰盘里不存在的相位）

7. 🌙 月相解读（当前月相+对本命月相的影响，200字）

8. 💰💕💼🏥 人生领域深度分析（每领域300字）
   - 财运：2宫/8宫/木星/金星综合
   - 感情：5宫/7宫/金星/火星综合，给出遇缘时机窗口
   - 事业：6宫/10宫/土星/木星综合，给出最佳发展阶段
   - 健康：1宫/6宫与先天体质倾向（中医体质角度补充，养生方向）

9. 📅 未来3年行运提醒（每年200字）
   - 木星过境哪宫+土星过境哪宫+核心主题

10. 💌 占星师寄语（只对这张星盘说的话，150字）`;
    }

    const messages = [
      { role: 'system', content: astroSystemPrompt },
      { role: 'user', content: astroUserPrompt }
    ];

    var _g = gateMessages(req, ['bazi','hehun','ziwei','xingming','astrology','八字','合婚','紫微','姓名','占星','星盘'], messages);
    const result = await deepseekChat(_g.messages, { maxTokens: astroMaxTokens || _g.maxTokens });
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
    _refundCreditOnFail(req);
    console.error('[ASTROLOGY ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试', detail: err.message });
  }
});

// ══════════════════════════════════════════
// POST /api/liuyao — 六爻占卜
// ══════════════════════════════════════════
router.post('/liuyao', rateLimitMiddleware, async (req, res) => {
  try {
    const { question, topic, lang } = req.body;
    if (!question) return res.status(400).json({ error: '请提供你要问的事情' });

    // ── 真实六爻引擎排盘（京房八宫法·纳甲装卦）──
    const liuyaoBlock = await buildLiuyaoBlock({ date: new Date() });

    const liuyaoSystem = `你是一位精通《周易》六爻纳甲的民间大师，京房八宫嫡传，从业四十余年。
你擅长用通俗语言解读卦象——让求问者立刻明白"能不能做、什么时候做、怎么做"。语气：亲切、直接、实用，不绕弯子。

【卦象数据（后端精确排盘·禁止 LLM 自行起卦或修改任何爻/亲/神数据）】
${liuyaoBlock || '（引擎暂不可用，请基于通识给出六爻解读框架）'}
（含：本卦六爻、动爻位置、变卦、六亲、纳甲地支、六神、世应、空亡）

【输出格式】Markdown，标题分段，简体中文。总字数 4000字，7 个维度全部写完写透（与用神/世应无关的闲爻可从略），严禁重要维度简略。

【收尾合规】末尾加："本报告由AI辅助生成，仅供参考娱乐，不构成医学、法律、投资或人生重大决策建议。"${langSuffix(lang)}`;

    const liuyaoUser = `用户问题：${question}
主题类型：${topic || '综合'}（感情/事业/财运/健康/出行）

请基于上方精确卦象数据，按以下 7 个维度出具完整六爻断事报告（总字数 4000字，闲爻可略）：

1. 🔮 本卦解读（卦名+卦象图示+卦辞含义+整体象征。基于引擎排出的本卦名，写卦的内涵与整体象，不少于500字）

2. 📖 六爻逐爻详解（每爻含：爻位/纳甲地支/六亲/六神/对问题的具体指向。共6爻×约200字，合计约1200字）
   - 严格依据上方【卦象数据】里排出的每一爻纳甲地支、六亲、六神逐爻分析，从初爻到上爻，不得自行虚构爻的地支或六亲
   - 逐爻结合所问之事说明该爻的具体指向

3. 🔄 变卦分析（动爻化出的变卦+本变卦对比分析。若为静卦则说明静卦意义，不少于400字）

4. 🎯 针对问题的具体指引（直接回答"能/不能""什么时候""怎么做"，不含废话，不少于500字）
   - 用神是哪个六亲？用神地支旺衰状态如何？
   - 忌神是否克用神？克力强弱？
   - 世爻与用神的生克关系对问题有何启示？

5. ⏰ 应期判断（用爻象推算结果出现的时间窗口，精确到月份或季节，不少于300字）
   - 动爻化出的地支对应哪个月份？
   - 空亡地支对冲时为应期的逻辑

6. 💡 行动建议（3条，每条约120字，含：做什么/不做什么/注意什么）

7. ⚠️ 忌神化解（忌神克制用神时的化解思路，不少于200字）`;

    const messages = [
      { role: 'system', content: liuyaoSystem },
      { role: 'user', content: liuyaoUser }
    ];
    var _gl = gateMessages(req, ['bazi','hehun','ziwei','xingming','astrology','fengshui','liuyao','qimen','daliuren','lingqian','pastlife','风水','六爻','奇门','大六壬','灵签','前世','紫微','合婚','姓名','占星'], messages, 16384);
    const reading = await deepseekChat(_gl.messages, { maxTokens: _gl.maxTokens });
    var ctxId = saveQaContext('liuyao', req.body, reading);
    res.json({ reading, contextId: ctxId, liuyaoData: liuyaoBlock ? liuyaoBlock.slice(0, 400) : null });
  } catch (err) {
    _refundCreditOnFail(req);
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
      { role: 'system', content: '你是一位在名山古寺修行多年的解签僧人。解签时语气温和、充满智慧，既点明签文深意又给人希望。' + DISCLAIMER_ZH },
      { role: 'user', content: `求签地点：${temple || '善缘灵境'}\n用户问题：${question || '请指点迷津'}\n抽得签号：第${qianNum}签（${qianType}）\n\n请生成：\n1. 📜 签诗（四句七言古诗，原创）\n2. 🏮 解签（签文含义，300字左右）\n3. 🎯 对你的启示\n4. 💡 行动建议\n5. 🙏 祈福方法\n\n结尾请附一句娱乐参考免责。` }
    ];
    var _gl = gateMessages(req, ['bazi','hehun','ziwei','xingming','astrology','fengshui','liuyao','qimen','daliuren','lingqian','pastlife','风水','六爻','奇门','大六壬','灵签','前世','紫微','合婚','姓名','占星'], messages, 8192);
    const reading = await deepseekChat(_gl.messages, { maxTokens: _gl.maxTokens });
    var ctxId = saveQaContext('lingqian', req.body, reading);
    res.json({ reading, contextId: ctxId, qian: { number: qianNum, type: qianType } });
  } catch (err) {
    _refundCreditOnFail(req);
    console.error('[LINGQIAN ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试' });
  }
});

// ══════════════════════════════════════════
// POST /api/daliuren — 大六壬预测
// ══════════════════════════════════════════
router.post('/daliuren', rateLimitMiddleware, async (req, res) => {
  try {
    const { question, birthYear, gender, lang } = req.body;
    if (!question) return res.status(400).json({ error: '请提供你要问的事情' });

    // ── 大六壬真实排盘引擎（三传四课·天干地支·神将）──
    let liurenBlock = '';
    let liurenData = null;
    try {
      liurenData = await computeDaLiuRen({ date: new Date() });
      // 从引擎返回中提取关键结构（真实字段：fourLessons/threeTransmissions/lessonSummary…）
      const ganzhi = liurenData.ganzhi || {};
      const fourLessonsStr = (liurenData.fourLessons || []).map(l =>
        `${l.name}[上${l.upper}下${l.lower}·${l.god}·${l.relation}]`
      ).join('　') || '（四课数据不可用）';
      const transStr = (liurenData.threeTransmissions || []).map(t =>
        `${t.stage}${t.branch}(${t.god}·${t.wuxing}·${t.seasonState}${t.isVoid ? '·旬空' : ''})`
      ).join(' → ') || '（三传数据不可用）';
      const guaTi = Array.isArray(liurenData.guaTi) ? liurenData.guaTi.join('·') : (liurenData.guaTi || '');
      const patternTags = Array.isArray(liurenData.patternTags) ? liurenData.patternTags.join('·') : (liurenData.patternTags || '');
      const shenSha = liurenData.shenShaSummary || '';
      const xunKong = Array.isArray(liurenData.xunKong) ? liurenData.xunKong.join('·') : (liurenData.xunKong || '');
      liurenBlock = `【大六壬精确起课（真实三传四课·禁止 LLM 自行起课或修改课象）】
干支：年${ganzhi.year||''} 月${ganzhi.month||''} 日${ganzhi.day||''} 时${ganzhi.hour||''}
课体：${guaTi}${patternTags ? `（${patternTags}）` : ''}
四课：${fourLessonsStr}
三传（初→中→末）：${transStr}
课体断语：${liurenData.lessonSummary || ''}
三传断语：${liurenData.transmissionSummary || ''}
神煞：${shenSha}　旬空：${xunKong}`;
    } catch (e) {
      console.warn('[DALIUREN] 引擎排盘失败，改用诚实框架：', e && e.message);
      // 引擎不可用时，不随机编造，而是用诚实框架
      const nowDate = new Date();
      const ymd = `${nowDate.getFullYear()}年${nowDate.getMonth()+1}月${nowDate.getDate()}日`;
      liurenBlock = `【注：大六壬引擎当前不可用。以下按传统大六壬框架进行文化解读，不代表精确排盘结果。起测时间：${ymd}】
请在报告开头声明："本次大六壬解读为文化参考，引擎精确排盘暂不可用，仅供娱乐参考。"`;
    }

    const daliurenSystem = `你是一位研习大六壬四十余年的术数研究者，民间称大六壬善断。
你深谙六壬三传四课之精妙，以三传四课为据推演，语气平和笃定，引经据典但深入浅出，重实证不故弄玄虚。

【大六壬起课数据（后端注入·依此解读，不得自行起课或编造三传四课）】
${liurenBlock}

【输出格式】Markdown，标题分段，简体中文。总字数 4000字，6 个维度全部写完写透，严禁简略。

【收尾合规】末尾加："本报告由AI辅助生成，仅供参考娱乐，不构成医学、法律、投资或人生重大决策建议。"${langSuffix(lang)}`;

    const daliurenUser = `用户问题：${question}
出生年份：${birthYear || '未提供'}
性别：${gender === 'male' ? '男' : gender === 'female' ? '女' : '未提供'}

请基于上方精确起课数据，按以下 6 个维度出具完整大六壬断事报告（总字数 4000字）：

1. 📜 课名解读与课体总评（课名的文化含义、此课的整体气场与类象，不少于700字）
   - 课名出于何种传统文献？含义与形成条件？
   - 此课适合问哪类事？对本次问题的整体指示

2. 🏮 三传四课精析（不少于1200字）
   - 四课：第一课到第四课各干支的上下神关系与类象
   - 初传（发用）：发用神是什么？如何克应到问题的初期阶段？
   - 中传（引就）：中传神如何引导事情发展方向？
   - 末传（归结）：末传神预示最终结果是什么？

3. 🎯 针对问题的具体断语（不少于800字）
   - 直接回答：此事"能/不能""何时成/何时败""注意什么"
   - 三传所示的吉凶与用神力量分析
   - 神将吉凶对事情的辅助判断

4. ⏰ 应期判断（不少于400字）
   - 末传地支对应哪个月份？用神旺相时为应期？
   - 给出最可能的应期月份和季节

5. 💡 行动建议（3条，每条约150字）
   - 每条包含：做什么 / 不做什么 / 具体时机

6. ⚠️ 注意事项与化解（不少于350字）
   - 凶神落何处？如何化解凶星影响？`;

    const messages = [
      { role: 'system', content: daliurenSystem },
      { role: 'user', content: daliurenUser }
    ];
    var _gl = gateMessages(req, ['bazi','hehun','ziwei','xingming','astrology','fengshui','liuyao','qimen','daliuren','lingqian','pastlife','风水','六爻','奇门','大六壬','灵签','前世','紫微','合婚','姓名','占星'], messages, 16384);
    const reading = await deepseekChat(_gl.messages, { maxTokens: _gl.maxTokens });
    var ctxId = saveQaContext('daliuren', req.body, reading);
    res.json({ reading, contextId: ctxId, liurenData: liurenData ? { ganzhi: liurenData.ganzhi } : null });
  } catch (err) {
    _refundCreditOnFail(req);
    console.error('[DALIUREN ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试' });
  }
});

// ══════════════════════════════════════════
// POST /api/qimen — 奇门遁甲
// ══════════════════════════════════════════
router.post('/qimen', rateLimitMiddleware, async (req, res) => {
  try {
    const { question, direction, birthYear, gender, lang } = req.body;
    if (!question) return res.status(400).json({ error: '请提供你要问的事情' });

    // ── 奇门遁甲真实排盘（拆补定局·转盘·时家）──
    const qimenBlock = await buildQimenBlock({ date: new Date(), method: 'zhuanpan', scope: 'hour', juMethod: 'chaibu' });

    const qimenSystem = `你是一位精研时家奇门正统数十年的奇门遁甲研究者，深研烟波钓叟歌与时家奇门正统口诀，断事重实证、不故弄玄虚。
你擅长排盘布局，能从八门九星八神中洞察时空能量，为求测者指点迷津。语气沉稳、自信、平实，每个断语都有理有据。

【奇门遁甲精确局盘（后端真实起局·禁止 LLM 自行起局或随机改盘）】
${qimenBlock || '（引擎暂不可用，请按奇门遁甲通识框架作文化解读并声明）'}

【输出格式】Markdown，标题分段，简体中文。总字数 8000字，7 个维度全部写完写透，严禁简略。

【收尾合规】末尾加："本报告由AI辅助生成，仅供参考娱乐，不构成医学、法律、投资或人生重大决策建议。"${langSuffix(lang)}`;

    const qimenUser = `用户问题：${question}
出生年份：${birthYear || '未提供'}
性别：${gender === 'male' ? '男' : gender === 'female' ? '女' : '未提供'}
求测方位：${direction || '未提供'}

请基于上方精确局盘数据，按以下 7 个维度出具完整奇门遁甲断事报告（总字数 8000字）：

1. 🌐 奇门局象总评（阴/阳遁、局数、整体能量气场，不少于600字）
   - 此时家奇门局的阴阳遁与局数意味着什么？
   - 整体时空能量对求测者的问题有何基础指向？
   - 值符星与值使门的组合类象总评

2. 🚪 八门深析（不少于800字）
   - 值使门（主门）：对应哪个宫位？八门五行属性？对求测者有何具体指引？
   - 其余各门落宫分布：开门/休门/生门在哪方？对应事业/财运/健康的具体信息
   - 格局说明（若有奇门特殊格局如三奇入墓、天地人三奇等，详细解读）

3. ⭐ 九星深析（不少于800字）
   - 值符星：五行属性与对应领域，对问题的主要指向
   - 天蓬/天任/天冲等关键宫星的落宫与含义
   - 九星对财运、情感、事业各领域的分宫指示

4. 🎯 针对问题的具体局象指引（不少于800字）
   - 直接回答"能/不能""何时成""注意什么"
   - 用神宫位与生克关系如何回应此问题？
   - 驿马宫和空亡宫对问题时机的影响

5. ⏰ 时间窗口判断（不少于500字）
   - 起局时间的干支与当前局数如何指向应期？
   - 空亡冲破时为应期的推断依据
   - 给出最可能的应验月份和季节

6. 📍 方位择吉（不少于500字）
   - 基于此局的生门/开门方位，给出具体吉方
   - 求测者的具体行动应朝哪个方向？
   - 此时宜去的城市/区域方向

7. 💡 行动建议（3条，每条约150字）
   - 每条包含：做什么/不做什么/最佳时机`;

    const messages = [
      { role: 'system', content: qimenSystem },
      { role: 'user', content: qimenUser }
    ];
    var _gl = gateMessages(req, ['bazi','hehun','ziwei','xingming','astrology','fengshui','liuyao','qimen','daliuren','lingqian','pastlife','风水','六爻','奇门','大六壬','灵签','前世','紫微','合婚','姓名','占星'], messages, 16384);
    const reading = await deepseekChat(_gl.messages, { maxTokens: _gl.maxTokens });
    var ctxId = saveQaContext('qimen', req.body, reading);
    res.json({ reading, contextId: ctxId, qimenSummary: qimenBlock ? qimenBlock.slice(0, 300) : null });
  } catch (err) {
    _refundCreditOnFail(req);
    console.error('[QIMEN ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试' });
  }
});

// ══════════════════════════════════════════
// POST /api/pastlife — 前世预测
// ══════════════════════════════════════════
router.post('/pastlife', rateLimitMiddleware, async (req, res) => {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, gender, birthPlace, lang } = req.body;
    if (!birthYear) return res.status(400).json({ error: '请提供出生信息' });
    // 语言判断：优先用 req.body.lang，降级到 Accept-Language 头
    const _effectiveLang = lang || (req.headers['accept-language'] || 'zh').split(',')[0].split('-')[0];
    const isEn = _effectiveLang.startsWith('en');
    const zi = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
    const zodiacs = ['Rat','Ox','Tiger','Rabbit','Dragon','Snake','Horse','Goat','Monkey','Rooster','Dog','Pig'];
    const currZodiac = zi[(birthYear - 4) % 12];
    const currZodiacEn = zodiacs[(birthYear - 4) % 12];

    // 基于出生信息推算一些叙事锚点
    const birthMonth12 = birthMonth ? parseInt(birthMonth) : 6;
    const seasonHints = ['冬末','初春','仲春','暮春','初夏','盛夏','盛夏','初秋','仲秋','暮秋','初冬','深冬'];
    const seasonEn = ['late winter','early spring','mid-spring','late spring','early summer','midsummer','midsummer','early autumn','mid-autumn','late autumn','early winter','deep winter'];
    const season = seasonHints[birthMonth12 - 1] || '春';
    const seasonE = seasonEn[birthMonth12 - 1] || 'spring';

    const sysPrompt = isEn
      ? `You are a mystical past-life regression guide with deep knowledge of world history and karmic cycles.

IMPORTANT: This is spiritual entertainment content. Always include a clear disclaimer at the start:
"✨ Past-Life Story (Spiritual Entertainment) — Not a factual historical claim. Created for reflection and entertainment."

Your storytelling is cinematic, emotionally resonant, and deeply personal. You are NOT a fortune-teller — you are a storytelling guide helping people explore the poetic mirror of their soul's journey.

STRUCTURE: Write in 8 narrative chapters. Total: 4000-5000 words in vivid, literary English.

DISCLAIMER at end: "This story is a creative spiritual narrative for entertainment and reflection only. It makes no claims about actual historical events or real past-life experiences."${langSuffix(lang)}`
      : `你是一位通晓三世因果的灵性叙事师，善用电影感语言讲述灵魂旅程。

【重要说明（必须在报告开头输出）】
✨《前世灵性故事》· 娱乐参考性质，非历史事实陈述，供灵性探索与娱乐参考。

你的叙述：电影镜头感强、情感共鸣深、细节丰富——像在讲一部真实的人物传记，让读者感受到"被看见"的共鸣。你不是算命师，你是灵魂旅程的说书人。

【输出格式】Markdown，标题分段，简体中文。总字数 5000-6000字，8 个章节全部写完写透，语言文学化而非列表化。

【收尾合规】末尾加："本故事为灵性娱乐叙事，非历史事实陈述，不构成任何人生重大决策建议，仅供探索与娱乐参考。"`;

    const userPrompt = isEn
      ? `Birth data: ${birthYear}/${birthMonth || '?'}/${birthDay || '?'}${birthHour !== undefined ? ' at ' + birthHour + ':00' : ''}
Gender: ${gender || 'unknown'}
Birthplace: ${birthPlace || 'unknown'}
Chinese zodiac: ${currZodiacEn}
Birth season energy: ${seasonE}

Write a vivid, detailed past-life story in 8 chapters (4000-5000 words total):

**Chapter 1: Who You Were** (600 words)
Specific time period (century + location + social status + name). Describe physical appearance in detail — face, hands, how they moved, what they wore. What language did they speak? What was the first thing they did each morning?

**Chapter 2: The World They Lived In** (500 words)
The sights, sounds, smells of their daily life. The political climate, what people feared, what they celebrated. One vivid scene from an ordinary Tuesday in their life.

**Chapter 3: Their Greatest Love** (600 words)
The most significant relationship of that life. How they met. What drew them together. How love shaped their decisions. What was left unfinished.

**Chapter 4: Their Greatest Wound** (500 words)
The hardest thing they faced. A betrayal, a loss, a burden they carried alone. How this shaped their soul's learning.

**Chapter 5: What They Built and Left Behind** (400 words)
Their life's work. What they created, protected, or destroyed. What they were proud of. What they regretted.

**Chapter 6: Their Final Hours** (400 words)
How did that life end? What were the last thoughts? What was unresolved? What was the soul's final emotion — regret, peace, longing, gratitude?

**Chapter 7: The Karmic Thread** (500 words)
How does that past life connect to THIS life? What echoes forward — a recurring pattern, a fear that has no logical source, a skill that came unnaturally easily, a type of person they're magnetically drawn to or repelled by?

**Chapter 8: The Soul's Message** (300 words)
If that past-life self could send one message across time to who you are now — what would they say? Not advice. A whisper. Make it land like poetry.`
      : `出生：${birthYear}年${birthMonth || '?'}月${birthDay || '?'}日${birthHour !== undefined ? birthHour + '时' : ''}
性别：${gender === 'male' ? '男' : '女'}
出生地：${birthPlace || '未知'}
生肖：${currZodiac}
出生时节能量：${season}

请用电影化语言写一个完整的前世灵性故事，共 8 个章节（总字数 5000-6000字）：

**第一章：你是谁**（不少于600字）
具体的时代背景（世纪+地区+社会阶层+姓名）。细致描述外貌——面容、双手、走路姿态、穿着。说什么语言？每天早晨第一件事是什么？

**第二章：你生活的世界**（不少于500字）
日常生活中的气味、声音、色彩。政治气候、人们恐惧什么、庆祝什么。用一个平凡的"星期三下午"场景来让时代感跃然纸上。

**第三章：你最深的爱**（不少于600字）
那一生中最重要的关系。如何相遇？什么吸引了彼此？爱如何塑造了那个人的命运？有什么遗憾没有说出口？

**第四章：你最深的伤**（不少于500字）
那一生最难的时刻。背叛、失去、或独自承担的重量。这个伤口如何塑造了灵魂的学习功课？

**第五章：你留下了什么**（不少于400字）
那一生的工作与创造。建立了什么、守护了什么、毁掉了什么？引以为傲的事，未竟的事。

**第六章：最后的时刻**（不少于400字）
那一生是如何结束的？最后的念头是什么？灵魂最后的情绪——遗憾、平静、牵挂、还是释然？

**第七章：因果的线索**（不少于500字）
那一生如何连接到今生？哪些模式在重复——一种没有来源的恐惧、一种不需要学习就会的技能、一类总是被吸引或总是回避的人？

**第八章：灵魂跨越时间的悄悄话**（不少于300字）
如果那个前世的自己能向今天的你发出一句跨越时间的低语——那会是什么？不是建议，是心声。写得像诗一样落地。`;

    const messages = [{ role: 'system', content: sysPrompt }, { role: 'user', content: userPrompt }];
    var _gl = gateMessages(req, ['bazi','hehun','ziwei','xingming','astrology','fengshui','liuyao','qimen','daliuren','lingqian','pastlife','风水','六爻','奇门','大六壬','灵签','前世','紫微','合婚','姓名','占星'], messages, 16384);
    const reading = await deepseekChat(_gl.messages, { maxTokens: _gl.maxTokens });
    var ctxId = saveQaContext('pastlife', req.body, reading);
    res.json({ reading, contextId: ctxId });
  } catch (err) {
    _refundCreditOnFail(req);
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
      { role: 'system', content: '你是一位深谙佛道仙三家文化的寺庙住持，为信众介绍传统供奉文化。语气慈悲、智慧、不迷信。【合规铁律】：只做文化介绍与心意寄托，绝不承诺"拜了就灵/有求必应"，绝不制造"不供奉就有灾祸"的恐吓，不替代医疗/投资/法律决策。结尾必须加一句免责："以上为传统文化参考，重在心意，不构成宗教承诺或任何效果保证，仅供参考娱乐。"' },
      { role: 'user', content: `信众所求：${question}\n出生年份：${birthYear || '未提供'}\n性别：${gender || '未提供'}\n偏好：${preference || '无特定偏好'}\n\n请从传统文化角度详细介绍（约2000字，客观介绍不作效果承诺）：\n1. 🧭 传统上与此类祈愿相关的菩萨/仙家\n2. 📖 每位的文化简介和象征领域\n3. 🙏 传统供奉方式（作为文化习俗介绍）\n4. 💰 供奉心意参考（不承诺回报）\n5. 🏠 在家中何处设供桌\n6. 🕐 传统供奉时辰\n7. 📿 相关经文/咒语文化\n8. 💌 温暖的文化寄语\n\n结尾加免责声明。` }
    ];
    var _gl = gateMessages(req, ['bazi','hehun','ziwei','xingming','astrology','fengshui','liuyao','qimen','daliuren','lingqian','pastlife','风水','六爻','奇门','大六壬','灵签','前世','紫微','合婚','姓名','占星'], messages, 12288);
    const reading = await deepseekChat(_gl.messages, { maxTokens: _gl.maxTokens });
    res.json({ reading });
  } catch (err) {
    _refundCreditOnFail(req);
    console.error('[DEITY ERR]', err.message);
    res.status(500).json({ error: 'AI暂时不可用，请稍后重试' });
  }
});

// ══════════════════════════════════════════
// POST /api/offering-plan — 供奉方案
// ══════════════════════════════════════════
router.post('/offering-plan', rateLimitMiddleware, async (req, res) => {
  try {
    const { deity, purpose, budget, duration, birthYear, gender, lang } = req.body;
    if (!deity || !purpose) return res.status(400).json({ error: '请提供供奉对象和所求事项' });

    // ── 供奉方案 vs 求神指引 的差异化定位：
    // 求神指引(deity-guide)：回答"拜哪位神/为什么"
    // 供奉方案(offering-plan)：回答"具体怎么拜/用什么/按什么仪轨/花多少钱/设在哪里"
    // 本端点聚焦于【仪轨落地执行手册】，而非神灵知识科普。

    const offeringSystem = `你是一位在闽南和台湾传统宫庙供奉文化中深耕三十年的资深供奉师，通晓佛道仙三家供奉仪轨，也了解海外华人在家中设坛的实操难题。
你的工作是给信众设计一份【可立即执行的供奉仪轨手册】——不是科普神灵知识（那是求神指引的工作），而是给具体的行动方案：
供什么品？怎么摆？什么时辰？念什么咒？烧什么纸？香怎么插？如何回向？出现什么象征视为感应？

【核心差异化原则】
- 本端点只聚焦于"怎么做"的仪轨执行细节，不重复"为什么拜这位神"的背景（由 deity-guide 负责）
- 每一步都给出具体数字（香的根数/水果的数量/日程的时分/回向文的字数）
- 海外信众实情：超市可购的替代品要注明（如：鲜花可用植物花卉替代，写明品种）
- 禁止模糊说"适量"——写"一斤500克"的梨，3根线香，每支约45分钟燃尽

【输出格式】Markdown，标题分段，简体中文。总字数 6000字，8 个章节全部写完写透，每章字数不低于要求，严禁简略。

【收尾合规】末尾加："本方案为文化参考，不构成宗教承诺或医学、投资建议。如有宗教疑问请咨询专业宗教人士。"${langSuffix(lang)}`;

    const offeringUser = `供奉对象：${deity}
所求事项：${purpose}
可用预算：${budget || '未提供（请按低/中/高三档各给方案）'}
供奉时长：${duration || '7天（常见参考时长）'}
信众出生年份：${birthYear || '未提供'}
性别：${gender === 'male' ? '男' : gender === 'female' ? '女' : '未提供'}

请设计一份完整的【${deity}供奉仪轨执行手册】，聚焦于"怎么做"的具体步骤，总字数 6000字：

1. 🏛️ 神位选址与坛台设置（不少于700字）
   - 家中供奉${deity}的最佳方位（东/南/西/北方向，具体到房间）
   - 坛台高度要求（距地面多少厘米？）
   - 神像/神牌的材质建议与尺寸规范
   - 坛台上物品的摆放顺序（从中心到两侧的精确布局）
   - 忌讳的摆放位置（哪里绝对不能放？）
   - 海外信众的简化坛台方案（公寓族如何处理？）

2. 🍎 供品详单（不少于800字）
   分低预算（$20以内）/ 中预算（$20-80）/ 高预算（$80+）三档各列完整清单：
   - 水果：品种+数量+摆放数量（单数/双数？）
   - 鲜花：品种+颜色+瓶数（禁忌花种写明）
   - 食品供物：具体品类+分量（如：红豆汤一碗，约200ml）
   - 香烛：线香品种/根数/燃香时长；蜡烛颜色/高度/燃放方式
   - 特殊供品：${deity}独有的特殊喜好供品（如观音的莲花/财神的元宝等）
   - 海外替代品：每类供品在当地超市/Amazon可购的具体替代选项

3. 📅 ${duration || '7天'}完整日程（不少于700字）
   - 第1天：开坛启请仪式（步骤1-步骤N，每步说清楚）
   - 第2-6天：日常供奉节律（具体到早晨几点上香/换水/换花）
   - 第7天：圆满回向仪式（结坛步骤）
   - 每日最佳供奉时辰（子/寅/巳/午/酉时各对应哪个时段？）

4. 🕯️ 线香与香烛仪轨（不少于500字）
   - 上香的正确手法（三指捏香/九十度鞠躬/插香深度）
   - 根数规定（三根/七根/十二根各代表什么？${deity}通常用几根？）
   - 燃香顺序（从哪一边先点？）
   - 香灰处理（满了怎么清？清的时间选在哪天？）
   - 海外无法点明火时的替代方案（电子香/香薰的使用规则）

5. 📿 持诵仪轨（不少于600字）
   - ${deity}对应的核心咒语/心咒（附拼音或原文）
   - 每日持诵遍数建议（基础版/进阶版/圆满版各几遍？）
   - 持诵时的手印或身体姿势要求
   - 持诵前的净心准备动作
   - 无法记全咒语时的简化替代（念名号的正确方式）

6. 🔥 烧化与回向（不少于500字）
   - 何时烧化供纸/元宝（几天一次？在哪个时辰？）
   - 烧化时需要说的回向文（给出完整示例文，约200字）
   - 在没有户外条件的城市/公寓如何替代（电子烧化的正确意念引导方式）
   - 回向给谁：先回向${deity}，再回向所求之事，最后普回向给众生的顺序与文辞

7. 🌟 感应辨识与调整（不少于500字）
   - 哪些现象代表${deity}已纳受供奉（正向感应信号，列举8-10个）
   - 哪些现象代表方法需调整（非灵验信号，列举5-6个）
   - 出现梦境或梦见${deity}时如何解读
   - 供品出现发霉/蜡烛异常燃烧时的正确处理

8. 💌 供奉师叮嘱（不少于400字）
   - 只对"求${purpose}之事"的信众说的心里话
   - 供奉之外，心态上最重要的一件事
   - 什么情况下应该停止供奉或换方式？`;

    const messages = [
      { role: 'system', content: offeringSystem },
      { role: 'user', content: offeringUser }
    ];
    var _gl = gateMessages(req, ['bazi','hehun','ziwei','xingming','astrology','fengshui','liuyao','qimen','daliuren','lingqian','pastlife','风水','六爻','奇门','大六壬','灵签','前世','紫微','合婚','姓名','占星'], messages, 16384);
    const reading = await deepseekChat(_gl.messages, { maxTokens: _gl.maxTokens });
    res.json({ reading });
  } catch (err) {
    _refundCreditOnFail(req);
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
    const sysPrompt = `你是一位结合八字命理与升学数据的高考志愿参考顾问。根据用户的出生信息和高考分数，提供专业、城市、学校的参考方向。用大白话写，不要古文。
【合规铁律】：命理只作性格兴趣的参考视角，不替代分数线/招生数据/本人兴趣/家长老师意见；第5章只客观介绍"相关行业的普遍收入水平"作为行业了解，绝不承诺"你毕业能拿多少薪资"；结尾必须加免责："本报告为参考娱乐，志愿填报请以官方分数线、招生计划及本人兴趣为准，重大决策请与家长老师充分商量。"
必须包含以下章节（每个至少200字）：
1. 📜 八字命格适合的行业倾向\n2. 🔥 适合的专业方向\n3. 🌆 适合发展的城市类型\n4. 🏫 可报考的学校建议（结合分数）\n5. 💰 相关行业的一般收入水平参考（客观介绍行业普遍情况·非个人薪资承诺）\n6. 🎯 总结建议（附免责）\n总字数4000-6000字。`;
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
    _refundCreditOnFail(req);
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
// GET /api/hehun/recent-input
// ══════════════════════════════════════════
router.get('/hehun/recent-input', (req, res) => {
  try {
    var auth = req.headers['authorization'] || '';
    var token = auth.indexOf('Bearer ') === 0 ? auth.slice(7) : (req.query.token || '');
    var t = getToken ? getToken.get(token) : null;
    var userId = t ? t.user_id : null;
    if (!userId) return res.json({ input: null });
    const { _M: _hM } = require('../lib/store');
    var recent = _hM.readings.filter(r => r.user_id === userId && r.type === 'hehun');
    recent.sort((a, b) => (b.id || 0) - (a.id || 0));
    if (recent.length === 0) return res.json({ input: null });
    var last = recent[0];
    var inp = typeof last.input === 'string' ? JSON.parse(last.input) : last.input;
    res.json({ input: {
      p1Year: inp.p1Year, p1Month: inp.p1Month, p1Day: inp.p1Day, p1Hour: inp.p1Hour,
      p2Year: inp.p2Year, p2Month: inp.p2Month, p2Day: inp.p2Day, p2Hour: inp.p2Hour,
      p1Gender: inp.p1Gender, p2Gender: inp.p2Gender, p1Name: inp.p1Name || '', p2Name: inp.p2Name || '',
      lang: inp.lang || 'zh', mode: inp.mode || 'marriage'
    }});
  } catch (err) {
    console.error('[HEHUN RECENT INPUT ERR]', err.message);
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
    const full = gateReportAccess(req, ['jyotish_full', 'jyotish']).full;

    // 吠陀真引擎注入（VSOP87+Lahiri·真Lagna/月亮Rashi/Nakshatra/九曜/Vimshottari大运·替代随机近似·禁LLM自算）
    let vedicInject = '';
    try {
      const { buildVedicBlock } = require('../lib/vedic-engine/prompt-block');
      const { lookupCity } = require('../lib/geo-lookup');
      const co = lookupCity(city, country) || { lat: 28.6139, lng: 77.2090, tz: 5.5 };
      const dp = String(dob).split(/[-/.]/).map(Number);
      const tp = String(tob).split(/[:：]/).map(Number);
      const vb = buildVedicBlock({ year: dp[0], month: dp[1], day: dp[2], hour: tp[0] || 0, minute: tp[1] || 0, latitude: co.lat, longitude: co.lng, timezone: co.tz });
      if (vb) vedicInject = `\n\n【AUTHORITATIVE PRECISE VEDIC CHART — computed by a real astronomical engine (VSOP87 + Lahiri ayanamsa). Use ONLY these values for Lagna/Ascendant, Moon Rashi, Nakshatra, planetary positions and the current Vimshottari Dasha. Do NOT self-calculate or contradict this data; ignore any other Rashi/Nakshatra/Lagna mentioned above.】\n${vb}\n`;
    } catch (e) { console.warn('[JYOTISH] vedic-engine 不可用，降级:', e && e.message); }

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
Describe the energetic themes and life stage of the current Dasha period — which planet's mahadasha broadly colors this chapter of life, what themes it activates, what tends to open and what tends to close. Speak in terms of life-stage energy and themes rather than exact calendar dates. Sketch the general arc of the coming Dasha periods and the kinds of experiences each tends to bring for ${rashiName}/${nakshatraName} natives. End with a shloka on time.

## 🏠 Full 12-House Analysis — The Architecture of Destiny [1200 words]
Note upfront: because of limits on the precision of birth time and place, the house (Lagna-based) placements here are a reference-level layout, not an exact chart. Systematically analyze all 12 houses with their lords and key planetary tenants:
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
Describe their Ayurvedic constitutional tendency (Vata/Pitta/Kapha) based on Lagna and its lord — as a constitutional inclination, not a medical diagnosis; never name specific diseases. Body areas traditionally associated with their Lagna to support proactively. General life phases to pay more attention to wellbeing. Dietary wisdom from Jyotish — foods to favor and reduce. Yoga practices aligned with their chart. Frame all of this as wellness guidance, and advise consulting a qualified professional for any real health concern. End with a shloka on vitality.

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

语言：${outputLang}。写作风格：命运诗篇——每一章是旅途的一步，每个章节结尾有一句金句（如梵语意境的一行诗）。场景感代替抽象描述。严禁bullet points。直接进入命运叙述，温暖而有文学质感。${DISCLAIMER_EN}`

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

结尾：写一段温暖而具体的话——"你的吠陀命盘还藏着……"，列出5件完整版才揭晓的事（Dasha大运周期的能量主题与人生阶段、全部12宫位分析、5年运势主题预测、关系业力兼容、具体补救措施），让人真心好奇。

语言：${outputLang}。直接从${name}的命运开始叙述，结尾附一句娱乐参考免责。`;

    // 免费版缓存检查（jyotish）
    if (!full) {
      const ck = cacheKey({ name: name||'', dob: dob||'', gender: '', lang: lang||'en' });
      const cached = reportCache.get(ck + '|jyotish');
      if (cached) { return res.json({ reading: cached, tier: 'basic', data: jyotishData, unlockUrl: '/pages/jyotish.html#unlock', cached: true }); }
    }
    const reading = await deepseekChat([
      { role: 'system', content: systemPrompt + vedicInject },
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
    _refundCreditOnFail(req);
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
    const full = gateReportAccess(req, ['maya_full', 'maya']).full;

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

语言：${mayaLang}。写作风格：命运诗篇——每一章是旅途的一步，每个章节结尾有一句令人心头一震的金句。场景感代替抽象，严禁bullet points，直接进入命运叙述，神秘而有文学质感。${DISCLAIMER_EN}`

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

语言：${mayaLang}。直接从${name}的命运开始，结尾附一句娱乐参考免责。`;

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
    _refundCreditOnFail(req);
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
    const full = gateReportAccess(req, ['tibet_full', 'tibet']).full;

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
Tibetan medicine (Sowa Rigpa) is inseparable from astrology — the nyes pa (humors): Lung (wind/air), Tripa (bile/fire), and Bekan (phlegm/water-earth) map onto the elemental constitution. Describe ${tibetData.element} ${tibetData.zodiac}'s constitutional tendency as an inclination only — this is a wellness perspective, not a medical diagnosis; never name specific diseases. Body areas to support proactively (general systems). Foods to favor and reduce per Tibetan dietary wisdom for this constitution. General life phases of greater vitality fluctuation. Longevity practices suited to their Mewa and element combination; advise consulting a qualified professional for real health concerns. End with dharma poetry.

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

语言：${tibetLang}。写作风格：命运诗篇——每一章是旅途的一步，每个章节结尾有一句金句或禅语。场景感代替抽象描述。文言+现代融合，流动有温度。严禁bullet points。直接进入命运叙述。${DISCLAIMER_EN}`

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
    _refundCreditOnFail(req);
    console.error('[TIBET ERR]', err.message);
    res.status(500).json({ error: '生成藏传报告失败，请重试' });
  }
});

// ══════════════════════════════════════════
// POST /api/bazi/stream — 八字流式输出（SSE）
// ══════════════════════════════════════════

// VIP 增量：主体流完后，若命中 bazi_vip，追加一次 LLM 调用生成4个专属章节，
// 逐 token 继续以 type:'chunk' 流给前端（前端把 chunk 直接拼进正文，无需改前端）。
// 全程 try/catch 兜底：追加调用挂了也不能让已发出主体的 stream 崩溃——静默跳过即可。
// 返回追加的文本（供落库拼接），失败返回空串。
async function streamBaziVipAddon(res, { sysAddon, userAddon }) {
  var addonText = '';
  try {
    var vipMsgs = buildReadingPrompt(sysAddon, userAddon);
    var vipBody = await deepseekStream(vipMsgs, { maxTokens: 16384, timeout: 300000 });
    var vipReader = vipBody.getReader();
    var vipDecoder = new TextDecoder('utf-8');
    var vipBuf = '';
    // 先发一个分隔换行，让增量段与主体正文有间隔
    res.write(`data: ${JSON.stringify({ type: 'chunk', content: '\n\n' })}\n\n`);
    while (true) {
      var _rv = await vipReader.read();
      if (_rv.done) { vipBuf += vipDecoder.decode(); break; }
      vipBuf += vipDecoder.decode(_rv.value, { stream: true });
      var vLines = vipBuf.split('\n');
      vipBuf = vLines.pop();
      for (var _vl of vLines) {
        if (!_vl.startsWith('data: ')) continue;
        var _vraw = _vl.slice(6).trim();
        if (_vraw === '[DONE]') continue;
        try {
          var _vj = JSON.parse(_vraw);
          var _vc = (_vj.choices && _vj.choices[0] && _vj.choices[0].delta && _vj.choices[0].delta.content) || '';
          if (_vc) { addonText += _vc; res.write(`data: ${JSON.stringify({ type: 'chunk', content: _vc })}\n\n`); }
        } catch (e) {}
      }
    }
  } catch (_ve) {
    console.warn('[BAZI-STREAM VIP addon]', _ve && _ve.message);
  }
  return addonText;
}

router.post('/bazi/stream', rateLimitMiddleware, async (req, res) => {
  try {
    const { birthYear, birthMonth, birthDay, birthHour, gender, question, mode, lang } = req.body;
    if (!birthYear || !birthMonth || !birthDay) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: '请提供出生年月日' });
    }
    const full = gateReportAccess(req, ['bazi', '八字', '사주']).full;

    // ── 精确排盘（真实算法，不依赖AI猜算）──
    const bazi = calcBazi(Number(birthYear), Number(birthMonth), Number(birthDay), Number(birthHour) || 0, gender);

    // ── 共用 SSE 建连逻辑 ──
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    // ── 韩文 사주 流式分支 ──
    if (lang === 'ko') {
      var pillarsKo = {
        year:  { gan: bazi.year.gan,  zhi: bazi.year.zhi,  label: '년주' },
        month: { gan: bazi.month.gan, zhi: bazi.month.zhi, label: '월주' },
        day:   { gan: bazi.day.gan,   zhi: bazi.day.zhi,   label: '일주' },
        hour:  { gan: bazi.hour.gan,  zhi: bazi.hour.zhi,  label: '시주' },
        dayMaster: bazi.dayMaster,
        dayMasterElement: bazi.dayMasterElement
      };
      var _chartDataKo = baziChartData({ birthYear, birthMonth, birthDay, birthHour, gender });
      res.write(`data: ${JSON.stringify({ type: 'meta', pillars: pillarsKo, tier: full ? 'full' : 'basic', locked: !full, chart: _chartDataKo })}\n\n`);

      var modeInsKo = (mode === 'gentle')
        ? '\n\n【말투】따뜻하고 부드럽게, 무서운 말을 하지 마세요. 문제가 있어도 먼저 안아주고, 이해시키고, 이끌어 주세요.'
        : '\n\n【말투】담백하고 따뜻하게, 꾸짖지 않고 솔직하게. 무서운 예언은 하지 마세요.';
      var freePartKo = full
        ? ''
        : ' [무료 미리보기] 아래 두 가지만 출력하세요:\n① 사주판 요약 — 일주·오행 핵심 특징 1~2가지를 따뜻하게 2-3문장으로 (명반 그래프는 이미 표시됨)\n② 오늘의 핵심 메시지 — 이 사주가 품은 가장 빛나는 자질 하나를 200-300자로.\n두 항목이 끝나면 정확히 한 줄: ---LOCKED---\n그 아래에 잠긴 항목만 나열 (내용 없이):\n💰 재물·사업 운세 · 심층 리포트에서 확인\n💕 연애·결혼 운세 · 심층 리포트에서 확인\n💼 직업·대운 상세 · 심층 리포트에서 확인\n🏥 건강 예보 · 심층 리포트에서 확인\n절대 잠긴 항목을 전개하지 마세요.';
      var sysKo = '당신은 정통 사주명리를 바탕으로 AI로 심층 운세 리포트를 쓰는 명리 연구원입니다. 독자를 무섭게 하지 않고, 따뜻하게 곁을 지키는 말투로 씁니다. 불안을 부추기는 예언은 절대 하지 않습니다.'
        + '\n\n【전문 용어】십성(정관/편관/정인/편인/비견/겁재/상관/식신/정재/편재), 신살, 용신, 일간 등 한국 명리 용어를 정확히 사용하세요. 한문을 병기하지 말고 순수 한국어로 쓰세요.'
        + '\n\n【글쓰기 톤】다정하고 잔잔하게. "좋은 사주다/나쁜 사주다"라는 이분법을 쓰지 않고, "강점과 약점, 그리고 잘 살리는 법"으로 풀어냅니다. 구체적인 조언(색·방위·습관)을 반드시 포함하세요.'
        + '\n\n【구성】만세력 사주판(년월일시柱), 일간과 용신, 오행 균형과 보완법, 그리고 핵심 운세. 장르는 리포트보다 위로와 통찰.'
        + HEALTH_SOFT.ko + modeInsKo + freePartKo;
      var _chartKoS = baziChartBlock({ birthYear, birthMonth, birthDay, birthHour, gender });
      var userKo = `내 사주를 봐주세요.\n출생: ${birthYear}년 ${birthMonth}월 ${birthDay}일${birthHour !== undefined && birthHour !== '' ? ' ' + birthHour + '시' : ' (태어난 시간 모름)'}\n성별: ${gender === 'male' ? '남성' : '여성'}\n관심: ${question || '전체 운세'}${_chartKoS ? CHART_STRICT.ko + _chartKoS + '\n' : ''}\n\n사주명리로 심층 분석해 주세요.`;

      var messagesKo = buildReadingPrompt(sysKo, userKo);
      var streamBodyKo = await deepseekStream(messagesKo, { maxTokens: full ? 16384 : 3500, timeout: 300000 });
      var readerKo = streamBodyKo.getReader();
      var decoderKo = new TextDecoder('utf-8');
      var fullTextKo = '';
      var bufKo = '';
      while (true) {
        var _rKo = await readerKo.read();
        if (_rKo.done) { bufKo += decoderKo.decode(); break; }
        bufKo += decoderKo.decode(_rKo.value, { stream: true });
        var linesKo = bufKo.split('\n');
        bufKo = linesKo.pop();
        for (var _lKo of linesKo) {
          if (!_lKo.startsWith('data: ')) continue;
          var _rawKo = _lKo.slice(6).trim();
          if (_rawKo === '[DONE]') continue;
          try { var _jKo = JSON.parse(_rawKo); var _cKo = (_jKo.choices && _jKo.choices[0] && _jKo.choices[0].delta && _jKo.choices[0].delta.content) || ''; if (_cKo) { fullTextKo += _cKo; res.write(`data: ${JSON.stringify({ type: 'chunk', content: _cKo })}\n\n`); } } catch(e) {}
        }
      }
      // 韩语暂无 bazi_vip 销售，也无 BAZI_VIP_ADDON_KR 文案，故不追加 VIP 增量。
      // 若日后韩国上线 VIP，补一份 ADDON_KR 后照 EN/ZH 分支加 detectBaziVip + streamBaziVipAddon 即可。
      insertReading.run('bazi', JSON.stringify(req.body), fullTextKo, req.userId);
      var ctxIdKo = saveQaContext('bazi', req.body, fullTextKo);
      res.write(`data: ${JSON.stringify({ type: 'done', contextId: ctxIdKo })}\n\n`);
      res.end();
      return;
    }

    // ── 英文 BaZi 流式分支 ──
    if (lang === 'en') {
      var pillarsEn = {
        year:  { gan: bazi.year.gan,  zhi: bazi.year.zhi,  label: 'Year Pillar' },
        month: { gan: bazi.month.gan, zhi: bazi.month.zhi, label: 'Month Pillar' },
        day:   { gan: bazi.day.gan,   zhi: bazi.day.zhi,   label: 'Day Pillar' },
        hour:  { gan: bazi.hour.gan,  zhi: bazi.hour.zhi,  label: 'Hour Pillar' },
        dayMaster: bazi.dayMaster,
        dayMasterElement: bazi.dayMasterElement
      };
      var _chartDataEn = baziChartData({ birthYear, birthMonth, birthDay, birthHour, gender });
      res.write(`data: ${JSON.stringify({ type: 'meta', pillars: pillarsEn, tier: full ? 'full' : 'basic', locked: !full, chart: _chartDataEn })}\n\n`);

      var freeSuffixEn = full ? '' : `\n\nIMPORTANT: Free preview mode. Output ONLY two things:\n① Chart summary — 2-3 warm sentences on the Day Master and 1-2 standout Five-Element traits (the visual chart card is already rendered for the user)\n② Core insight — the single most luminous quality of this chart, 200-300 words\n\nWhen done, output exactly one line:\n---LOCKED---\n\nThen list locked sections WITHOUT content:\n💰 Wealth & Finance · unlock in full report\n💕 Love & Marriage · unlock in full report\n💼 Career & Luck Cycles · unlock in full report\n🏥 Health Forecast · unlock in full report\n\nDo NOT expand any locked section.`;
      var sysEn = `You are a master BaZi (Four Pillars of Destiny) reader with 30+ years of experience, trained in classical Chinese metaphysics. You write warm, insightful, and practical reports in fluent English. Never be scary or fatalistic — you help people understand their strengths and navigate challenges.${HEALTH_SOFT.en}${freeSuffixEn}`;
      var _chartEnS = baziChartBlock({ birthYear, birthMonth, birthDay, birthHour, gender });
      var userEn = `Please analyze my BaZi chart and generate a deep destiny report.\nBirth details:\n- Date: ${birthYear}/${birthMonth}/${birthDay}${birthHour !== undefined && birthHour !== '' ? ', Hour: ' + birthHour + ':00' : ' (birth hour unknown)'}\n- Gender: ${gender === 'male' ? 'Male' : 'Female'}${_chartEnS ? CHART_STRICT.en + _chartEnS + '\n' : ''}\n\n${full ? 'Generate a comprehensive report covering: Four Pillars Chart, Five Elements Analysis, This Year Fortune, Wealth & Career, Love & Relationships, Ten-Year Luck Cycles, Year-by-Year Forecast, Personalized Recommendations, and a Personal Message.' : 'Generate a free preview with ONLY 3 sections then the LOCKED separator.'}`;

      var messagesEn = buildReadingPrompt(sysEn, userEn);
      var streamBodyEn = await deepseekStream(messagesEn, { maxTokens: full ? 16384 : 3500, timeout: 300000 });
      var readerEn = streamBodyEn.getReader();
      var decoderEn = new TextDecoder('utf-8');
      var fullTextEn = '';
      var bufEn = '';
      while (true) {
        var _rEn = await readerEn.read();
        if (_rEn.done) { bufEn += decoderEn.decode(); break; }
        bufEn += decoderEn.decode(_rEn.value, { stream: true });
        var linesEn = bufEn.split('\n');
        bufEn = linesEn.pop();
        for (var _lEn of linesEn) {
          if (!_lEn.startsWith('data: ')) continue;
          var _rawEn = _lEn.slice(6).trim();
          if (_rawEn === '[DONE]') continue;
          try { var _jEn = JSON.parse(_rawEn); var _cEn = (_jEn.choices && _jEn.choices[0] && _jEn.choices[0].delta && _jEn.choices[0].delta.content) || ''; if (_cEn) { fullTextEn += _cEn; res.write(`data: ${JSON.stringify({ type: 'chunk', content: _cEn })}\n\n`); } } catch(e) {}
        }
      }
      // ── $199 大师档增量（英文·主体流完后追加4个专属章节·带兜底）──
      if (full && detectBaziVip(req)) {
        var _addonEn = await streamBaziVipAddon(res, {
          sysAddon: 'You are a master-tier BaZi reader.' + (_chartEnS ? CHART_STRICT.en + _chartEnS + '\n' : '') + BAZI_VIP_ADDON_EN,
          userAddon: 'This is the exclusive add-on for the same person. Output ONLY the 4 exclusive chapters (24-month monthly forecast / deep remedies / decision timing / master charge). Do not repeat earlier chapters. Birth: ' + birthYear + '/' + birthMonth + '/' + birthDay + (birthHour !== undefined && birthHour !== '' ? ' ' + birthHour + ':00' : '') + ', ' + (gender === 'male' ? 'Male' : 'Female')
        });
        if (_addonEn) fullTextEn = fullTextEn + '\n\n' + _addonEn;
      }
      insertReading.run('bazi', JSON.stringify(req.body), fullTextEn, req.userId);
      var ctxIdEn = saveQaContext('bazi', req.body, fullTextEn);
      res.write(`data: ${JSON.stringify({ type: 'done', contextId: ctxIdEn })}\n\n`);
      res.end();
      return;
    }

    // ── 中文八字流式（默认）──
    const modeInstruction = (mode === 'gentle')
      ? '\n\n【说话模式】你温暖治愈，以鼓励为主，让人感到被理解。'
      : '\n\n【说话模式】你说话直率，但句句为对方好，直接指出问题。';

    // 优先用专业引擎(专家背书)富排盘；异常时降级回 bazi.js 简版
    const baziChart = buildBaziBlock({ birthYear, birthMonth, birthDay, birthHour, gender }) || `【精确排盘结果（由万年历算法计算，请严格使用以下数据，不得自行推算或修改）】
年柱：${bazi.year.gan}${bazi.year.zhi}　月柱：${bazi.month.gan}${bazi.month.zhi}　日柱：${bazi.day.gan}${bazi.day.zhi}　时柱：${bazi.hour.gan}${bazi.hour.zhi}
四柱：${bazi.fourPillars}
日主：${bazi.dayMaster}（${bazi.dayMasterElement}）　身${bazi.isStrong ? '强' : '弱'}
五行：金${bazi.wuxing['金'].toFixed(1)} 木${bazi.wuxing['木'].toFixed(1)} 水${bazi.wuxing['水'].toFixed(1)} 火${bazi.wuxing['火'].toFixed(1)} 土${bazi.wuxing['土'].toFixed(1)}
生肖：${bazi.zodiac}　时辰：${bazi.shiChen}
大运（依次）：${bazi.daYun.map(d => d.name+'('+d.startAge+'-'+d.endAge+'岁)').join('　')}
当前年份：${new Date().getFullYear()}年`;

    const sysPay = full
      ? `你是一位精通八字命理的实力派命理师，既有正统传承，又懂现代人语言。\n\n${baziChart}\n\n你必须严格按照15个维度展开，总字数控制在9000-11000字，字数均衡分配，务必保证收尾维度（大运/流年/命理师叮嘱）完整写完不被截断。维度用emoji开头：\n1.📜四柱八字排盘 2.🔥十神分析 3.🟤五行分析 4.💰财运格局 5.💕感情姻缘 6.💼事业格局 7.🏥健康预警 8.📅全部8步大运（使用上方精确大运数据） 9.🔮未来10年逐年流年（每年评分，从当前年份算起） 10.✨神煞分析 11.🌿藏干 12.👨‍👩‍👧‍👦父母/子女/夫妻宫 13.🎯开运锦囊 14.📖古法断语 15.💌命理师叮嘱\n每个维度必须基于上方排盘数据展开，给出具体年份/数字/颜色/物品。所有涉及年份的内容必须以当前年份为基准向未来推算。${modeInstruction}`
      : `你是一位八字命理师。\n\n${baziChart}\n\n【免费预览版·极简模式】只输出以下两项：\n① 命盘简述 — 用2-3句温暖白话点出日主特质与1-2个五行亮点（视觉命盘卡已由前端展示，无需重复铺排）\n② 核心亮点 — 这张命盘最闪光的一个特质，200-300字，让命主感到被看见\n\n两项结束后输出恰好一行：---LOCKED---\n\n其后仅列出锁定章节名称（不展开内容）：\n💰 财运格局 · 完整解读见付费版\n❤️ 感情姻缘 · 完整解读见付费版\n💼 事业大运 · 完整解读见付费版\n🏥 健康预警 · 完整解读见付费版\n\n禁止展开任何锁定章节内容。${modeInstruction}`;

    const userPrompt = `请为我批算八字。出生：${birthYear}年${birthMonth}月${birthDay}日${birthHour !== undefined ? birthHour + '时' : ''}，性别：${gender === 'male' ? '男' : '女'}，关注：${question || '请全面分析命盘'}`;

    // 发送元数据（含视觉命盘卡数据）
    var _chartDataZh = baziChartData({ birthYear, birthMonth, birthDay, birthHour, gender });
    res.write(`data: ${JSON.stringify({ type: 'meta', tier: full ? 'full' : 'basic', locked: !full, chart: _chartDataZh })}\n\n`);

    const streamBody = await deepseekStream(
      buildReadingPrompt(sysPay, userPrompt),
      { maxTokens: full ? 16384 : 3000, timeout: 300000 }
    );

    const reader = streamBody.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) { buf += decoder.decode(); break; }
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

    // ── $199 大师档增量（中文·主体流完后追加4个专属章节·带兜底）──
    if (full && detectBaziVip(req)) {
      const _addonZh = await streamBaziVipAddon(res, {
        sysAddon: '你是最高档【大师深度批命】命理师。' + (baziChart ? '\n' + baziChart + '\n严格采用上方精确排盘，禁止自行推算。\n' : '') + BAZI_VIP_ADDON_ZH,
        userAddon: '这是同一位命主的大师档专属增量部分。请只输出上述4个专属章节（🗓️逐月流月/🛡️深度化解/🔀择时/👑大师叮嘱），不要重复前面已写过的维度。出生:' + birthYear + '年' + birthMonth + '月' + birthDay + '日' + (birthHour !== undefined ? birthHour + '时' : '(时辰不详)') + '，性别:' + (gender === 'male' ? '男' : '女')
      });
      if (_addonZh) fullText = fullText + '\n\n' + _addonZh;
    }

    // 存储 & 发送结束信号
    insertReading.run('bazi', JSON.stringify(req.body), fullText, req.userId);
    const ctxId = saveQaContext('bazi', req.body, fullText);
    const product = full ? matchProduct(fullText, 'bazi') : undefined;
    res.write(`data: ${JSON.stringify({ type: 'done', contextId: ctxId })}\n\n`);
    if (product) res.write(`data: ${JSON.stringify({ type: 'product', product })}\n\n`);
    res.end();
  } catch (err) {
    _refundCreditOnFail(req);
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
    const full = gateReportAccess(req, ['jyotish_full', 'jyotish']).full;

    // 吠陀真引擎注入（stream·同 non-stream）
    let vedicInject = '';
    try {
      const { buildVedicBlock } = require('../lib/vedic-engine/prompt-block');
      const { lookupCity } = require('../lib/geo-lookup');
      const co = lookupCity(city, country) || { lat: 28.6139, lng: 77.2090, tz: 5.5 };
      const dp = String(dob).split(/[-/.]/).map(Number);
      const tp = String(tob).split(/[:：]/).map(Number);
      const vb = buildVedicBlock({ year: dp[0], month: dp[1], day: dp[2], hour: tp[0] || 0, minute: tp[1] || 0, latitude: co.lat, longitude: co.lng, timezone: co.tz });
      if (vb) vedicInject = `\n\n【AUTHORITATIVE PRECISE VEDIC CHART — real astronomical engine (VSOP87 + Lahiri). Use ONLY these values for Lagna/Moon Rashi/Nakshatra/planets/current Vimshottari Dasha; ignore any other astrological values mentioned above.】\n${vb}\n`;
    } catch (e) { console.warn('[JYOTISH-STREAM] vedic-engine 不可用，降级:', e && e.message); }
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
Mahadasha and Antardasha — the energy themes and life-stage that dominate this chapter now, and the general direction of the next shift. Speak in themes and life stages, not exact calendar dates. 500 words.

## 🏠 12-House Analysis
Lagna: ${RASHI_EN[jyotishData.lagna] || 'unknown'} (note: because of birth time/place precision limits, house placements are a reference-level layout). Key houses 1st/4th/7th/10th with planetary influences. 800 words.

## 💰 Wealth & Career Destiny
Career paths, financial patterns, best years for wealth, business vs service. 500 words.

## 💕 Love & Relationships
Romantic patterns, ideal partner, marriage timing, relationship karma. 500 words.

## 🏥 Health & Vitality
Ayurvedic constitutional tendency (as an inclination, not a medical diagnosis — never name specific diseases), body areas to support proactively, lifestyle and wellness recommendations; advise consulting a professional for real health concerns. 400 words.

## 📅 5-Year Forecast (${new Date().getFullYear()}-${new Date().getFullYear()+4})
Year-by-year: career, love, finances, personal growth. 600 words.

## 💎 Remedies & Mantras
Gemstone with carat and finger, daily mantra with pronunciation, charity, auspicious days. 400 words.

## 🎯 Your Personal Fortune Toolkit
Make your destiny work in daily modern life: (1) English name energy — what letter/sound vibration resonates with ${rashiName} and ${nakshatraName}? Suggest 2-3 English names that amplify their chart. (2) WeChat/social media avatar strategy — what colors and visual mood should their profile photo carry to attract destined fortune? Base this on their Rashi element. Give specific color guidance. (3) 3 lucky objects to keep nearby. (4) The most powerful morning ritual for ${nakshatraName}. 500 words.

Language: ${outputLangFull}. Writing style: destiny poetry. Scene over abstraction. No bullet points. Warm literary quality.${DISCLAIMER_EN}`

      : `你是一位精通吠陀占星（Jyotish）的大师，同时拥有诗人的灵魂。为${name}写一份命运诗篇式的免费吠陀占星解读。月亮星座（Rashi）：${rashiName}；月宿（Nakshatra）：${nakshatraName}。关注重点：${concern || '整体命运'}。

写作风格：命运诗篇，沉浸式第二人称叙述，场景感代替抽象，严禁bullet points。每章结尾一句金句。

内容章节：
🌙 你的月亮星座：${rashiName}（500字，以金句结尾）
✨ 你的月宿：${nakshatraName}（400字，以金句结尾）
🌟 灵魂天赋与业力（400字，以金句结尾）
📅 ${new Date().getFullYear()}年宇宙能量（400字）
💎 吠陀蓝图幸运指引（宝石/幸运色/方位/咒语，200字）

结尾：温暖地列出5件完整版才揭晓的事（包含专属英文名能量分析+微信头像颜色方案），让人真心好奇。
语言：${outputLangFull}。直接进入叙述，结尾附一句娱乐参考免责。`;

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    res.write(`data: ${JSON.stringify({ type: 'meta', tier: full ? 'full' : 'basic', locked: !full, data: jyotishData })}\n\n`);

    const streamBody = await deepseekStream(
      [{ role: 'system', content: systemPrompt + vedicInject }, { role: 'user', content: `Please generate the Vedic Jyotish report for ${name}.` }],
      { maxTokens: full ? 16384 : 4000, timeout: 300000 }
    );

    const reader = streamBody.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '', buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) { buf += decoder.decode(); break; }
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
    _refundCreditOnFail(req);
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
    const full = gateReportAccess(req, ['tibet_full', 'tibet']).full;
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
Tibetan medicine constitutional tendency (as an inclination, a wellness perspective — not a medical diagnosis; never name specific diseases), general body areas to support, dietary wisdom; advise consulting a professional for real health concerns. 500 words.

## 🙏 Spiritual Practices & Protections
Mantras, deity practices, offerings, auspicious days, navigating challenges. 600 words.

## 🎯 Your Tibetan Luck Optimization Toolkit
Make ancient wisdom work in your modern life: (1) English name energy — what sound/letter vibration strengthens ${tibetData.element} ${tibetData.zodiac} Lungta? Suggest 2-3 English names for ${name}. (2) WeChat/social avatar strategy — based on Mewa ${tibetData.mewaNum}'s sacred color and ${tibetData.element} element, what specific colors should dominate their profile photo? Give precise descriptions (not just "red" but the exact warmth and shade). (3) 3 Tibetan lucky symbols or objects to keep in living/work space. (4) The single morning practice that most powerfully activates Wind Horse energy. 500 words.

Language: ${tibetLangFull}. Writing style: destiny poetry — each chapter is a step on a mountain pilgrimage, each section ends with a golden line or Buddhist insight. Scene over abstraction. No bullet points. Warm literary quality.${DISCLAIMER_EN}`

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
语言：${tibetLangFull}。直接进入${name}的命运叙述，结尾附一句娱乐参考免责。`;

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
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
    const decoder = new TextDecoder('utf-8');
    let fullText = '', buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) { buf += decoder.decode(); break; }
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
    _refundCreditOnFail(req);
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
    const full = gateReportAccess(req, ['maya_full', 'maya']).full;
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

Language: ${mayaLangFull}. Writing style: destiny poetry — each chapter ends with a copper drum resonance moment. Scene over abstraction. No bullet points. Mystical literary quality.${DISCLAIMER_EN}`

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
语言：${mayaLangFull}。直接进入${name}的命运叙述，结尾附一句娱乐参考免责。`;

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
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
    const decoder = new TextDecoder('utf-8');
    let fullText = '', buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) { buf += decoder.decode(); break; }
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
    _refundCreditOnFail(req);
    console.error('[MAYA-STREAM ERR]', err.message);
    try { res.write(`data: ${JSON.stringify({ type: 'error', message: 'Generation failed, please retry' })}\n\n`); res.end(); } catch(e) {}
  }
});

// ══════════════════════════════════════════
// POST /api/duanshi/stream — 断事问卦（六爻AI判断）
// ══════════════════════════════════════════
router.post('/duanshi/stream', async (req, res) => {
  try {
    const { question, topic, method } = req.body;
    if (!question || question.length < 5) return res.status(400).json({ error: 'question required' });

    // 六爻真实起卦（与 /liuyao 同款引擎·纳甲/六亲/六神/世应/空亡·禁 LLM 自编卦象）
    let liuyaoBlock = '';
    try { liuyaoBlock = await buildLiuyaoBlock({ date: new Date() }); }
    catch (e) { console.warn('[DUANSHI] 六爻引擎不可用，降级:', e && e.message); }

    const now = new Date();
    const dateStr = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日`;

    const systemPrompt = `你是精通六爻预测的命理大师，精通《增删卜易》《断易天机》，擅长以六爻卦象断事。
你的风格：直接、有力、不绕弯子。给出明确的"宜/不宜/等待"判断，配上卦象解释和具体行动建议。所有判断均为传统术数参考，仅供娱乐参考，不构成任何决策建议——请在 summary 或 analysis 中体现这一分寸，不作绝对化承诺。
【铁律】必须严格依据下方【六爻真实卦象】里排出的本卦/变卦/纳甲/六亲/六神/世应/空亡断事，禁止自行编造或改动任何爻象。
你必须返回严格的JSON格式，不要有任何markdown或额外文字。`;

    const userMsg = `今日${dateStr}，来问一件事：${question}

起卦方法：六爻摇钱卦
【六爻真实卦象】
${liuyaoBlock || '（六爻引擎暂不可用，请就所问事项审慎给出参考判断，并在analysis中说明卦象暂缺）'}
事项类别：${topic||'综合'}

请以六爻断事，返回如下JSON（不要任何markdown代码块，直接返回JSON对象）：
{
  "verdict": "yi|buyi|deng",
  "summary": "一句话总结判断（20字以内，有力直接）",
  "analysis": "卦象解析（3-4句，引用卦名和爻象，解释吉凶原因）",
  "timing_desc": "时机研判（具体说几月/几周后，给出动作节点）",
  "timing_val": "时机评分如'75分'或'30分'",
  "actions": ["行动建议1", "行动建议2", "行动建议3"]
}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMsg }
    ];

    const raw = await deepseekChat(messages, { maxTokens: 800 });

    // 解析JSON
    let parsed;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch(e) {
      // 解析失败给默认结果
      parsed = {
        verdict: 'deng',
        summary: '卦象复杂，宜静待，勿仓促行事。',
        analysis: `世爻持守，应爻动而不发，此卦主静不主动。当下时机尚未成熟，急进则失，缓图则得。`,
        timing_desc: '建议观望一个月，待局势明朗再做决定。',
        timing_val: '50分',
        actions: ['暂缓最终决定，给自己留出观察期', '做充分调查和准备工作', '一个月后重新评估']
      };
    }

    res.json(parsed);
  } catch(e) {
    res.status(500).json({ error: e.message });
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

// ══════════════════════════════════════════
// POST /api/omikuji — おみくじ 日本御神签
// ══════════════════════════════════════════
router.post('/omikuji', rateLimitMiddleware, async (req, res) => {
  try {
    const { question, lang } = req.body;
    const OMIKUJI_GRADES = [
      { grade: '大吉', weight: 5, en: 'Dai-kichi (Great Blessing)', cls: 'excellent' },
      { grade: '吉', weight: 16, en: 'Kichi (Blessing)', cls: 'good' },
      { grade: '中吉', weight: 15, en: 'Chū-kichi (Middle Blessing)', cls: 'good' },
      { grade: '小吉', weight: 10, en: 'Shō-kichi (Small Blessing)', cls: 'mid' },
      { grade: '末吉', weight: 8, en: 'Sue-kichi (Future Blessing)', cls: 'mid' },
      { grade: '凶', weight: 11, en: 'Kyō (Caution)', cls: 'bad' },
      { grade: '大凶', weight: 5, en: 'Dai-kyō (Great Caution)', cls: 'worst' }
    ];
    var totalWeight = OMIKUJI_GRADES.reduce(function(s, g){ return s + g.weight; }, 0);
    var rand = Math.floor(Math.random() * totalWeight);
    var accumulated = 0;
    var drawn = OMIKUJI_GRADES[0];
    for (var i = 0; i < OMIKUJI_GRADES.length; i++) {
      accumulated += OMIKUJI_GRADES[i].weight;
      if (rand < accumulated) { drawn = OMIKUJI_GRADES[i]; break; }
    }

    // ── 分档控制 ──
    var _gl = gateMessages(req, ['bazi','hehun','ziwei','xingming','astrology','fengshui','liuyao','qimen','daliuren','lingqian','pastlife','omikuji','rune','kyusei'], [], 16384);
    var omkTier = resolveReportTier(_gl.full, req.body.tier);

    var isEn = (lang === 'en');
    var systemPrompt = isEn
      ? 'You are a wise Shinto shrine priest at a sacred Japanese shrine, deeply versed in omikuji (御神籤) tradition. Your voice is calm, gentle, and filled with wabi-sabi wisdom. Each reading is personal and poetic. Never mention which AI model powers this.' + DISCLAIMER_EN
      : '你是一位精通日本御神签（おみくじ）传统的神社神职，同时深谙汉字与和歌的诗意之美。你用温暖、平静、充满禅意的简体中文为参拜者传达神的旨意。绝不透露所用的AI模型。' + langSuffix(lang) + DISCLAIMER_ZH;

    var userPrompt, omkMaxTokens;

    if (omkTier === 'free') {
      // 免费：签级 + 和歌 + 总运解读（约600字），然后锁定
      omkMaxTokens = 3000;
      userPrompt = isEn
        ? `The visitor drew: ${drawn.grade} — ${drawn.en}\nTheir question: ${question || 'General guidance for my life path'}\n\nOutput ONLY the following 3 sections (about 600 words total), then the lock notice:\n\n🎋 Fortune Level: ${drawn.en} (50 words, Japanese + English bilingual display)\n🌸 Sacred Waka Poem (original 5-7-5-7-7, poetic English translation, 50-word reflection)\n🏯 Overall Fortune Reading (3 paragraphs, 300 words)\n\nThen output:\n---LOCKED---\n❤️ Love & Relationships · Unlock full version\n📚 Study & Career · Unlock full version\n💰 Wealth · Unlock full version\n📅 12-Month Monthly Forecast · Unlock full version\n🙏 Ritual Guidance · Unlock full version\n\nLast line: The deeper message of your fortune awaits — unlock to see love, wealth, monthly forecasts and personalized ritual guidance.`
        : `参拜者所求签文：${drawn.grade}\n所问之事：${question || '请为我指引人生方向'}\n\n仅输出以下3节（合计约600字），然后输出锁定提示：\n\n🎋 签级（日中双语展示，50字）\n🌸 御神歌（日文五七五七七原文 + 中文诗意译文 + 50字解读）\n🏯 ${drawn.grade} 总运解读（3段，300字）\n\n完成后输出：---LOCKED---\n❤️ 恋爱姻缘 · 完整版解锁\n📚 学业事业运 · 完整版解锁\n💰 财运 · 完整版解锁\n📅 12个月月运 · 完整版解锁\n🙏 祈愿仪式 · 完整版解锁\n\n最后一行：签文的深层启示还在等你——解锁可看到恋爱、财运、月度运势与专属祈愿仪式的完整指引。`;
    } else if (omkTier === 'standard') {
      // 标准档 $9.9：全9维，每维度约150字，总计约2500字
      omkMaxTokens = 6000;
      userPrompt = isEn
        ? `The visitor drew: ${drawn.grade} — ${drawn.en}\nTheir question: ${question || 'General guidance for my life path'}\n\nPlease generate a STANDARD omikuji reading (~2500 words total) covering all 9 sections:\n\n1. 🎋 Fortune Level (${drawn.en}, Japanese + English, 100 words)\n2. 🌸 Sacred Waka Poem (original 5-7-5-7-7 + translation + 200-word reflection)\n3. 🏯 Overall Fortune Reading (500 words)\n4. ❤️ Love & Relationships (250 words)\n5. 📚 Study & Career (250 words)\n6. 💰 Wealth & Fortune (200 words)\n7. 🌿 Health & Vitality (200 words)\n8. 🧳 Travel (150 words)\n9. 🎋 Shrine Priest's Whisper (200 words, personal)\n\nEnd with: For 12-month monthly forecasts, 24-solar-term guidance and detailed ritual instructions, see the full $49 report.`
        : `参拜者所求签文：${drawn.grade}\n所问之事：${question || '请为我指引人生方向'}\n\n请出具【标准版御神签解读报告】，总字数约2500字，按以下9个维度写完：\n\n1. 🎋 签级与神启（日中双语，100字）\n2. 🌸 御神歌（日文五七五七七原文 + 中文诗意译文 + 200字和歌背景解读）\n3. 🏯 ${drawn.grade} 签文总运详解（500字·语言温暖有力）\n4. ❤️ 恋爱姻缘（250字·感情能量+遇缘指引+落地建议）\n5. 📚 学业事业运（250字·机遇与阻碍+时机建议）\n6. 💰 财运（200字·财运走势+求财建议）\n7. 🌿 健康运（200字·身心养生，不点病名）\n8. 🧳 出行（150字·吉方与时机）\n9. 🎋 神职者叮嘱（200字·专属叮嘱与祝福，非套话）\n\n结尾推荐：$49完整版包含：12个月逐月月运·24节气运势·守护神灵深度解读·寺社参拜具体指引。`;
    } else {
      // 完整档 $49：全维度 + 12个月月运 + 祈愿仪式，约8000字
      omkMaxTokens = 16384;
      userPrompt = isEn
        ? `The visitor drew: ${drawn.grade} — ${drawn.en}\nTheir question: ${question || 'General guidance for my life path'}\n\nPlease generate a COMPLETE omikuji reading (8000 words), all sections written fully:\n\n1. 🎋 Fortune Level & Divine Opening (${drawn.en}, Japanese + English bilingual, 100 words)\n2. 🌸 Sacred Waka Poem (original 5-7-5-7-7 in Japanese + poetic English translation + 200-word background interpretation)\n3. 🏯 Overall Fortune Reading (${drawn.en}) — 500 words, energy field, how to approach this period\n4. ❤️ Love & Relationships — 400 words: current energy, near-future guidance, one concrete suggestion\n5. 📚 Study & Career — 400 words: opportunities, obstacles, optimal timing\n6. 💰 Wealth & Fortune — 300 words: wealth trajectory, guidance\n7. 🌿 Health & Vitality — 300 words (wellness angle only, no medical diagnoses)\n8. 🧳 Travel & Movement — 200 words: auspicious directions and timing\n9. 🔍 Lost Items — 200 words: directional and timing guidance\n10. 📅 12-Month Monthly Forecast — one line per month: month + keyword + one most-auspicious action\n11. 🙏 Ritual Guidance — 300 words: specific time of day, offerings, prayer direction, type of o-mamori\n12. 🎋 Shrine Priest's Personal Whisper — 200 words, heartfelt and personal`
        : `参拜者所求签文：${drawn.grade}\n所问之事：${question || '请为我指引人生方向'}\n\n请出具【完整版御神签解读报告】，总字数8000字，所有维度写完写透：\n\n1. 🎋 签级与神启（日中双语，100字）\n2. 🌸 御神歌（日文五七五七七原文 + 中文诗意译文 + 200字和歌背景解读）\n3. 🏯 ${drawn.grade} 总运详解（500字·天机显现·能量场·应对心态）\n4. ❤️ 恋爱姻缘（400字·感情能量·近期缘分走向·落地建议）\n5. 📚 学业事业运（400字·机遇与阻碍·最佳时机·行动建议）\n6. 💰 财运（300字·走势+求财方式）\n7. 🌿 健康运（300字·身心养生，不点病名）\n8. 🧳 出行（200字·吉方与时机）\n9. 🔍 寻物（200字·方向与时机提示）\n10. 📅 12个月月运短批（每月一行：月份+关键词+最宜做的一件事）\n11. 🙏 祈愿仪式指引（300字·具体到参拜时间段/供奉物/祝词方向/御守类型）\n12. 🎋 神职者的耳语（200字·专属叮嘱与祝福，非套话）`;
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
    const reading = await deepseekChat(messages, { maxTokens: omkMaxTokens });
    insertReading.run('omikuji', JSON.stringify(req.body), reading, req.userId);
    var ctxId = saveQaContext('omikuji', req.body, reading);
    res.json({ reading, contextId: ctxId, omikuji: { grade: drawn.grade, gradeEn: drawn.en, cls: drawn.cls }, tier: omkTier, locked: omkTier === 'free' });
  } catch (err) {
    _refundCreditOnFail(req);
    console.error('[OMIKUJI ERR]', err.message);
    res.status(500).json({ error: 'AI temporarily unavailable, please try again' });
  }
});

// ══════════════════════════════════════════
// POST /api/rune — 北欧卢恩符文占卜
// ══════════════════════════════════════════
const ELDER_FUTHARK = [
  { name:'Fehu', unicode:'ᚠ', aett:1, keywords:['wealth','abundance','beginnings'], upright:'A new cycle of abundance opens. Material and spiritual gains await — act on opportunities with confidence, but share what you receive.', reversed:'Wealth may slip away or stagnate. Re-evaluate what you truly value. Avoid greed; loss here is a lesson, not a sentence.' },
  { name:'Uruz', unicode:'ᚢ', aett:1, keywords:['strength','vitality','change'], upright:'Raw power and primal strength surge through you. A period of major change brings growth — embrace it even if it feels disruptive.', reversed:'Your energy is scattered or blocked. Rest and recover. Resist forcing outcomes; let the storm pass before acting.' },
  { name:'Thurisaz', unicode:'ᚦ', aett:1, keywords:['protection','conflict','threshold'], upright:'A gateway stands before you. Thor\'s hammer clears the path — face conflict directly rather than avoiding it. Protection is yours.', reversed:'Danger of rash action. Pause before reacting. Hidden enemies or self-sabotage may be at work; reflect carefully.' },
  { name:'Ansuz', unicode:'ᚨ', aett:1, keywords:['communication','wisdom','divine message'], upright:'Odin\'s breath — a message or revelation comes. Trust your voice; speak with authority. Wisdom flows through you now.', reversed:'Miscommunication or deceit. Check your sources; not all advice is trustworthy. Seek clarity before committing.' },
  { name:'Raidho', unicode:'ᚱ', aett:1, keywords:['journey','movement','rhythm'], upright:'A journey — physical or inner — is underway. You are on the right road. Trust the rhythm of your progress.', reversed:'Delays, detours, or loss of direction. Stop and reassess your route; the destination is right but the path needs adjustment.' },
  { name:'Kenaz', unicode:'ᚲ', aett:1, keywords:['creativity','illumination','knowledge'], upright:'The torch of creativity blazes. New knowledge, artistic breakthroughs, or romantic sparks ignite. Illuminate what was hidden.', reversed:'Inspiration dims or a relationship cools. Release what no longer serves you; new light cannot enter a cluttered room.' },
  { name:'Gebo', unicode:'ᚷ', aett:1, keywords:['gift','partnership','exchange'], upright:'A gift freely given and received. Partnership, generosity, and balance in relationships. Honor the exchange — give as much as you take.', reversed:'Gebo has no reversal — its gift is unconditional. Consider where imbalance exists in a relationship or transaction.' },
  { name:'Wunjo', unicode:'ᚹ', aett:1, keywords:['joy','harmony','success'], upright:'Joy arrives. Harmony, wish-fulfillment, and a sense of belonging. Celebrate — this is a moment of genuine happiness.', reversed:'Clouds gather over the celebration. Alienation, stubbornness, or misaligned expectations dim the light. Seek common ground.' },
  { name:'Hagalaz', unicode:'ᚺ', aett:2, keywords:['disruption','hail','transformation'], upright:'The hailstorm strips everything bare — then nourishes the earth. Disruption is the universe clearing space for something better.', reversed:'Hagalaz carries no traditional reversal; the storm comes regardless. Surrender to transformation rather than resisting it.' },
  { name:'Nauthiz', unicode:'ᚾ', aett:2, keywords:['need','constraint','patience'], upright:'Necessity is the teacher now. Constraint builds character. Endure this period with patience; what you forge in hardship will last.', reversed:'Resist the temptation to take shortcuts or blame others for your circumstances. Inner work is required before outer change.' },
  { name:'Isa', unicode:'ᛁ', aett:2, keywords:['stillness','freeze','clarity'], upright:'Everything pauses. Use this frozen moment for introspection and clarity. Plans must wait; the ice will melt in its own time.', reversed:'Isa has no conventional reversal. The stillness is complete. Avoid forcing movement — there is wisdom in waiting.' },
  { name:'Jera', unicode:'ᛃ', aett:2, keywords:['harvest','cycle','reward'], upright:'The harvest arrives. Your patience and effort over a full cycle now yield their fruit. Celebrate — you have earned this.', reversed:'Jera carries no reversal. If the harvest is thin, examine what was planted. Adjust and replant with greater care.' },
  { name:'Eihwaz', unicode:'ᛇ', aett:2, keywords:['endurance','yew tree','death-rebirth'], upright:'Yggdrasil\'s strength: you stand at the axis of worlds. Endure through seeming endings — death here is transformation, not termination.', reversed:'Weakness or confusion at a crossroads. Gather your inner resources; the way forward requires patience and deeper roots.' },
  { name:'Perthro', unicode:'ᛈ', aett:2, keywords:['fate','mystery','hidden'], upright:'The mystery unfolds. What was hidden comes to light — a secret revealed, a fate accepted. Embrace the unknown with curiosity.', reversed:'Hidden forces work against you or secrets remain locked. Do not chase what is not ready to be revealed.' },
  { name:'Algiz', unicode:'ᛉ', aett:2, keywords:['protection','defense','higher self'], upright:'The elk stands guard. Powerful protection surrounds you. Connect with your higher self and intuition — you are shielded.', reversed:'Your defenses are down. Be cautious of those who drain your energy or exploit your vulnerability. Rest and protect yourself.' },
  { name:'Sowilo', unicode:'ᛊ', aett:2, keywords:['sun','victory','wholeness'], upright:'The sun wheel burns bright. Victory, clarity, and life force are yours. Move forward with confidence — the light is on your side.', reversed:'Sowilo has no traditional reversal. Beware of ego inflation or burning too bright; direct your power wisely.' },
  { name:'Tiwaz', unicode:'ᛏ', aett:3, keywords:['justice','honor','sacrifice'], upright:'Tyr\'s sword: justice prevails. Commit to your path with honor, even if sacrifice is required. Victory comes through integrity, not cunning.', reversed:'Injustice or stalled legal matters. Someone may lack integrity in the situation. Reassess commitments that no longer align with your values.' },
  { name:'Berkano', unicode:'ᛒ', aett:3, keywords:['growth','birth','nurturing'], upright:'Birch tree awakens. New beginnings, new life, family blessings. Nurture what is newly born with patience and care.', reversed:'Growth is stunted by anxiety or a stale environment. Release what blocks new life; sometimes the tree must be pruned to bloom.' },
  { name:'Ehwaz', unicode:'ᛖ', aett:3, keywords:['movement','horse','partnership'], upright:'Horse and rider in perfect harmony. A partnership brings swift movement toward your goal. Trust your allies and your own momentum.', reversed:'Mistrust, restlessness, or reckless haste. Slow down and rebuild the trust between yourself and those you travel with.' },
  { name:'Mannaz', unicode:'ᛗ', aett:3, keywords:['humanity','self','community'], upright:'The human rune: you are not alone. Cooperation and community strengthen you. Know yourself fully — both light and shadow.', reversed:'Isolation, arrogance, or losing yourself in others\' opinions. Return to your authentic self; seek genuine connection, not approval.' },
  { name:'Laguz', unicode:'ᛚ', aett:3, keywords:['water','flow','intuition'], upright:'Deep waters speak. Trust your intuition; emotions are data, not drama. Flow with the current rather than fighting it.', reversed:'Emotional overwhelm or self-deception. You may be swimming against the current. Pause and listen to what you have been ignoring.' },
  { name:'Ingwaz', unicode:'ᛜ', aett:3, keywords:['fertility','potential','completion'], upright:'The seed holds everything it needs. A cycle completes, making space for the next. Your potential is fully charged — prepare to act.', reversed:'Ingwaz rarely reverses. If energy feels blocked, the seed is not yet ready. Trust the timing of your own gestation.' },
  { name:'Dagaz', unicode:'ᛞ', aett:3, keywords:['dawn','breakthrough','transformation'], upright:'Dawn breaks after the longest night. A breakthrough, an awakening, a fundamental shift in perspective. The old world ends; the new begins.', reversed:'Dagaz rarely reverses. If light feels delayed, the darkness is doing necessary work. Transformation is closer than it appears.' },
  { name:'Othala', unicode:'ᛟ', aett:3, keywords:['heritage','home','inheritance'], upright:'The ancestral home grounds you. Heritage, inheritance — material or spiritual — is yours. Honor your roots; they give you wings.', reversed:'Cut off from roots, or burdened by legacy. Heal ancestral patterns that no longer serve; claim your inheritance without its wounds.' }
];

router.post('/rune', rateLimitMiddleware, async (req, res) => {
  try {
    const { question, spread, lang } = req.body;
    // spread: 'single' (default) or 'three' (past/present/future)
    var spreadType = spread === 'three' ? 'three' : 'single';
    var shuffled = ELDER_FUTHARK.slice().sort(function(){ return Math.random() - 0.5; });
    var drawnRunes = spreadType === 'three' ? shuffled.slice(0, 3) : [shuffled[0]];
    // Each rune has ~30% chance of being reversed
    var drawnWithPos = drawnRunes.map(function(r) {
      var reversed = Math.random() < 0.3;
      return { name: r.name, unicode: r.unicode, aett: r.aett, keywords: r.keywords, reversed: reversed, meaning: reversed ? r.reversed : r.upright };
    });
    var isEn = (lang === 'en');
    var runeDesc = spreadType === 'three'
      ? drawnWithPos.map(function(r, i) {
          var pos = isEn ? ['Past','Present','Future'][i] : ['过去','现在','未来'][i];
          return (isEn ? pos + ': ' : pos + '：') + r.unicode + ' ' + r.name + (r.reversed ? (isEn ? ' (Reversed)' : '（逆位）') : (isEn ? ' (Upright)' : '（正位）'));
        }).join('\n')
      : drawnWithPos[0].unicode + ' ' + drawnWithPos[0].name + (drawnWithPos[0].reversed ? (isEn ? ' (Reversed)' : '（逆位）') : (isEn ? ' (Upright)' : '（正位）'));

    // ── 分档控制 ──
    var _gl = gateMessages(req, ['bazi','hehun','ziwei','xingming','astrology','fengshui','liuyao','qimen','daliuren','lingqian','pastlife','omikuji','rune','kyusei'], [], 16384);
    var runeTier = resolveReportTier(_gl.full, req.body.tier);

    var systemPrompt = isEn
      ? 'You are a Northern European rune reader with deep knowledge of Elder Futhark, Norse mythology, and the Eddas. Your interpretations are poetic, grounded, and empowering. Rune reversal is not doom — it is redirection. Never reveal which AI model powers this reading.' + DISCLAIMER_EN
      : '你是一位精通 Elder Futhark 古北欧符文的占师，深谙北欧神话与埃达诗歌。你的解读诗意、接地气、赋予力量。逆位符文不是诅咒，而是转向。绝不透露解读所用的 AI 模型。' + langSuffix(lang) + DISCLAIMER_ZH;

    var userPrompt, runeMaxTokens;

    if (runeTier === 'free') {
      // 免费：能量基调 + 第1个符文简读，约500字，然后锁定
      runeMaxTokens = 3000;
      userPrompt = isEn
        ? `Seeker's question: ${question || 'What guidance do the runes offer me now?'}\nRunes drawn:\n${runeDesc}\n\nOutput ONLY the following (about 500 words), then the lock notice:\n\nᚠ Opening — the energy this reading carries (100 words)\n🔮 First Rune: ${drawnWithPos[0].unicode} ${drawnWithPos[0].name} — deep reading with Norse myth context and ${drawnWithPos[0].reversed ? 'reversed' : 'upright'} guidance (300 words)\n🌊 One-sentence energy summary (50 words)\n\nThen output:\n---LOCKED---\n🔍 Remaining rune(s) full interpretation · Unlock full version\n🌊 Synthesis & combined guidance · Unlock full version\n🎯 Practical action guidance · Unlock full version\n📖 Norse mythology deep exploration · Unlock full version\n\nLast line: These runes have deeper stories to tell — unlock to see each rune's Norse myth context and your 3-month action guide.`
        : `问卦者的问题：${question || '请符文为我指引方向'}\n抽出的符文：\n${runeDesc}\n\n仅输出以下内容（约500字），然后输出锁定提示：\n\nᚠ 开场——此次解读的能量基调（100字）\n🔮 第1个符文：${drawnWithPos[0].unicode} ${drawnWithPos[0].name} 深度解读（含北欧神话语境与${drawnWithPos[0].reversed ? '逆位' : '正位'}指引，300字）\n🌊 整体能量一句话（50字）\n\n完成后输出：---LOCKED---\n🔍 其余符文完整解读 · 完整版解锁\n🌊 符文合力综合解读 · 完整版解锁\n🎯 行动建议与三月日历 · 完整版解锁\n📖 北欧神话深探 · 完整版解锁\n\n最后一行：这些符文还有更深的故事——解锁后可看到每个符文背后的诺斯神话语境与三个月行动指引。`;
    } else if (runeTier === 'standard') {
      // 标准档 $9.9：全部符文详解 + 综合解读 + 行动建议，约2500字
      runeMaxTokens = 6000;
      userPrompt = isEn
        ? `Seeker's question: ${question || 'What guidance do the runes offer me now?'}\nRunes drawn:\n${runeDesc}\n\nPlease provide a STANDARD rune reading (~2500 words):\n\n1. ᚠ Opening — energy of this reading (100 words)\n2. 🔮 Each Rune Deep Interpretation (600-700 words per rune)\n   - Ancient Norse name + Unicode + meaning\n   - Mythology source (deity/myth)\n   - Upright/reversed core meaning\n   - Specific guidance for the seeker's question\n   - One wisdom quote from the Eddas\n3. 🌊 Synthesis — how the runes answer your question together (300 words)\n4. 🎯 3 Practical Action Points (each 100 words, with timeframe)\n5. 🔥 Reader's Closing Word (70 words, poetic)\n\nEnd with: For Norse myth deep dives, 3-month action calendar and rune meditation guides, see the full $49 report.`
        : `问卦者的问题：${question || '请符文为我指引方向'}\n抽出的符文：\n${runeDesc}\n\n请出具【标准版卢恩符文解读报告】，总字数约2500字：\n\n1. ᚠ 符文能量开场（100字）\n2. 🔮 逐符文深度解读（每个符文600-700字）\n   - 符文名（古北欧语名 + 中文译名 + Unicode 字符）\n   - 神话来源（对应神灵、神话场景）\n   - 正/逆位核心含义\n   - 对提问者的具体指引\n   - 一句符文智慧金句\n3. 🌊 符文合力综合解读（300字）\n4. 🎯 3条可落地行动建议（每条100字·含时间窗）\n5. 🔥 占师结语（70字·诗意）\n\n结尾推荐：$49完整版包含：北欧神话背景深探·三个月行动日历·符文冥想引导，约8000-9000字。`;
    } else {
      // 完整档 $49：全7维度，约8000-9000字
      runeMaxTokens = 16384;
      userPrompt = isEn
        ? `Seeker's question: ${question || 'What guidance do the runes offer me now?'}\nRunes drawn:\n${runeDesc}\n\nPlease provide a COMPLETE rune reading (8000-9000 words), all sections written fully:\n\n1. ᚠ Opening — energy of this reading with Norsemythic framing (150 words)\n2. 🔮 Each Rune Deep Interpretation (600-800 words per rune)\n   - Ancient Norse name + Unicode + meaning\n   - Mythology: associated deity and myth scene\n   - Upright/reversed meaning\n   - Specific guidance for the seeker's question\n   - One wisdom quote from Poetic Edda or Prose Edda\n3. 🌊 Synthesis — how all runes answer together (300 words)\n4. 🎯 3 Practical Action Points (each 100 words)\n5. 📖 Norse Mythology Deep Exploration — myth most relevant to this reading (500 words, literary quality)\n6. 📅 3-Month Action Calendar (each month: core keyword + one concrete action)\n7. 🔥 Reader's Closing Word (70 words, poetic, like a Norse wind across a moor)`
        : `问卦者的问题：${question || '请符文为我指引方向'}\n抽出的符文：\n${runeDesc}\n\n请出具【完整版卢恩符文解读报告】，总字数8000-9000字，所有维度写完写透：\n\n1. ᚠ 符文能量开场（150字·北欧宇宙观引入）\n2. 🔮 逐符文深度解读（每个符文600-800字）\n   - 符文名（古北欧语名 + 中文译名 + Unicode 字符）\n   - 神话来源（对应神灵、神话场景）\n   - 正/逆位核心含义\n   - 对提问者的具体指引\n   - 一句符文智慧金句（从古北欧诗歌/箴言提炼）\n3. 🌊 符文合力综合解读（300字）\n4. 🎯 3条可落地行动建议（每条100字·含时间窗）\n5. 📖 北欧神话背景深探（与本次符文最相关的神话故事，500字，文学质感）\n6. 📅 三个月行动日历（每月：核心关键词+一件具体要做的事）\n7. 🔥 占师结语（70字·诗意·如北欧旷野的一阵风）`;
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
    const reading = await deepseekChat(messages, { maxTokens: runeMaxTokens });
    insertReading.run('rune', JSON.stringify(req.body), reading, req.userId);
    var ctxId = saveQaContext('rune', req.body, reading);
    res.json({ reading, contextId: ctxId, runes: drawnWithPos, spread: spreadType, tier: runeTier, locked: runeTier === 'free' });
  } catch (err) {
    _refundCreditOnFail(req);
    console.error('[RUNE ERR]', err.message);
    res.status(500).json({ error: 'AI temporarily unavailable, please try again' });
  }
});

// ══════════════════════════════════════════
// POST /api/kyusei — 九星気学 Nine Star Ki
// ══════════════════════════════════════════
const KYUSEI_STARS = {
  1: { name:'一白水星', nameEn:'1 White Water Star', element:'水 Water', keywords:['智慧','灵活','交流'], keywordsEn:['wisdom','adaptability','communication'], description:'Water flows and adapts. Your life path carries deep intelligence and diplomatic grace. You thrive through connection and intuition.', descriptionZH:'水善利万物而不争。你天生具备深邃的智慧与外交天赋，善于倾听与沟通，以柔克刚。' },
  2: { name:'二黑土星', nameEn:'2 Black Earth Star', element:'土 Earth', keywords:['勤劳','滋养','耐力'], keywordsEn:['diligence','nurturing','endurance'], description:'Earth absorbs and nourishes all. You are the steady foundation others rely on — devoted, patient, and deeply caring.', descriptionZH:'厚德载物，你是他人的精神支柱。勤勉、包容、脚踏实地，厚积薄发，是值得信赖的守护者。' },
  3: { name:'三碧木星', nameEn:'3 Jade Wood Star', element:'木 Wood', keywords:['活力','创新','开拓'], keywordsEn:['vitality','innovation','pioneering'], description:'Young spring wood shoots upward with unstoppable energy. You are a trailblazer — innovative, enthusiastic, and always reaching for new horizons.', descriptionZH:'初春之木，生机勃勃。你是天生的开拓者，充满活力与创新精神，勇于突破边界，点燃身边人的热情。' },
  4: { name:'四绿木星', nameEn:'4 Green Wood Star', element:'木 Wood', keywords:['信用','成长','风'], keywordsEn:['trust','growth','wind'], description:'Mature wood sways with the wind yet stands firm. You build lasting trust through consistency — a natural networker and mediator.', descriptionZH:'如风似木，你以诚信和温和赢得人心。善于积累人脉，沟通协调，长期经营的信用是你最大的财富。' },
  5: { name:'五黄土星', nameEn:'5 Yellow Earth Star', element:'土 Earth', keywords:['领导','中心','命运'], keywordsEn:['leadership','center','destiny'], description:'The center of all nine stars — the axis around which change revolves. You carry great power and responsibility; your choices ripple far.', descriptionZH:'居中央，统御八方。你生来承担命运的重量，具有领导潜力与影响力，但需以责任驾驭力量。' },
  6: { name:'六白金星', nameEn:'6 White Metal Star', element:'金 Metal', keywords:['权威','完美','天空'], keywordsEn:['authority','precision','heaven'], description:'Heaven\'s metal — bright, clear, and authoritative. You set high standards and lead by example, commanding respect through excellence.', descriptionZH:'乾金之气，刚健清明。你天生具备领导气质，追求卓越与完美，以身作则，赢得众人的尊重与信赖。' },
  7: { name:'七赤金星', nameEn:'7 Red Metal Star', element:'金 Metal', keywords:['魅力','表达','享乐'], keywordsEn:['charisma','expression','joy'], description:'The metallic shimmer of autumn — charming, expressive, and magnetic. You are a natural performer who brings joy and beauty wherever you go.', descriptionZH:'秋金华彩，你天生具有魅力与表现力。善于表达、富有创意，在社交场合中总能成为焦点，带给周围人欢乐。' },
  8: { name:'八白土星', nameEn:'8 White Earth Star', element:'土 Earth', keywords:['变革','山','财富'], keywordsEn:['transformation','mountain','wealth'], description:'The mountain stands through all seasons. You accumulate wealth and wisdom through steadfast effort — your transformation is dramatic but earned.', descriptionZH:'艮山之稳，你蓄势待发，终能厚积薄发。善于积累财富与经验，一旦时机成熟，爆发力惊人。' },
  9: { name:'九紫火星', nameEn:'9 Purple Fire Star', element:'火 Fire', keywords:['热情','名誉','洞察'], keywordsEn:['passion','fame','insight'], description:'Fire illuminates everything it touches. You burn with passion, intuition, and a desire to be seen — fame and recognition are in your nature.', descriptionZH:'离火燃烧，光照四方。你热情洋溢、洞察力强，渴望被看见。名誉与荣耀是你命中注定的追求与考验。' }
};

// Nine Star Ki calculation (Sonoda formula, public domain)
// Adjusted birth year for Setsubun (立春, ~Feb 4): if birthday is Jan 1 - Feb 3, use previous year
function calcKyuseiStar(year, month, day) {
  var adjYear = year;
  if (month === 1 || (month === 2 && day <= 3)) adjYear = year - 1;
  var star = (10 - ((adjYear - 2) % 9)) % 9;
  return star === 0 ? 9 : star;
}

router.post('/kyusei', rateLimitMiddleware, async (req, res) => {
  try {
    const { birthYear, birthMonth, birthDay, question, lang } = req.body;
    if (!birthYear || !birthMonth || !birthDay) {
      return res.status(400).json({ error: 'Please provide birth year, month, and day' });
    }
    var starNum = calcKyuseiStar(Number(birthYear), Number(birthMonth), Number(birthDay));
    var star = KYUSEI_STARS[starNum];
    if (!star) return res.status(400).json({ error: 'Invalid birth date' });

    // ── 分档控制 ──
    var _gl = gateMessages(req, ['bazi','hehun','ziwei','xingming','astrology','fengshui','liuyao','qimen','daliuren','lingqian','pastlife','omikuji','rune','kyusei'], [], 16384);
    var kyuTier = resolveReportTier(_gl.full, req.body.tier);

    var isEn = (lang === 'en');
    var systemPrompt = isEn
      ? 'You are a Japanese metaphysics master specializing in Kyūsei Kigaku (九星気学 Nine Star Ki), the ancient Japanese art of destiny based on birth year energy. Your readings are precise, culturally rooted, and deeply insightful. Never reveal which AI model generates this reading.' + DISCLAIMER_EN
      : '你是一位精通九星気学（Kyūsei Kigaku）的日本命理大师，同时兼修阴阳五行与风水方位学。你的解读精准、文化底蕴深厚，语言兼顾中日两种传统——中文写作为主，关键术语保留日语并加中文解释。绝不透露解读所用的AI模型。' + langSuffix(lang) + DISCLAIMER_ZH;

    var starBlock = isEn
      ? `Birth Star: ${star.nameEn} (${star.element})\nCore Energy: ${star.keywordsEn.join(', ')}\nPath: ${star.description}`
      : `本命星：${star.name}（${star.element}）\n核心能量：${star.keywords.join('・')}\n命途：${star.descriptionZH}`;

    var userPrompt, kyuMaxTokens;
    var currentYear = new Date().getFullYear();

    if (kyuTier === 'free') {
      // 免费：本命星展示 + 今年运势一段，约500字，然后锁定
      kyuMaxTokens = 3000;
      userPrompt = isEn
        ? `${starBlock}\nSeeker's question: ${question || 'What is my Nine Star Ki destiny telling me?'}\nBorn: ${birthYear}-${String(birthMonth).padStart(2,'0')}-${String(birthDay).padStart(2,'0')}\n\nOutput ONLY these 2 sections (about 500 words), then lock notice:\n\n⭐ Your Star Essence — what ${star.nameEn} reveals about your core nature (300 words)\n📅 This Year's Energy — one paragraph about ${currentYear} for ${star.nameEn} (150 words)\n\nThen output:\n---LOCKED---\n💼 Career & Life Path · Unlock full version\n❤️ Love & Relationships · Unlock full version\n💰 Wealth & Resources · Unlock full version\n🏠 Auspicious Directions · Unlock full version\n🔑 3 Lifetime Keys · Unlock full version\n\nLast line: Your star has more to reveal — unlock to see career, love, wealth, directional guidance and your 5-year forecast.`
        : `${starBlock}\n问卦者的问题：${question || '九星気学告诉我的命运是什么？'}\n出生：${birthYear}年${birthMonth}月${birthDay}日\n\n仅输出以下2节（约500字），然后输出锁定提示：\n\n⭐ 本命星精髓——${star.name}揭示的你的核心本质（300字）\n📅 今年运势——${currentYear}年${star.name}的整体运势（150字）\n\n完成后输出：---LOCKED---\n💼 事业与人生道路 · 完整版解锁\n❤️ 恋爱与人际关系 · 完整版解锁\n💰 财运与资源 · 完整版解锁\n🏠 方位择吉详解 · 完整版解锁\n🔑 三大人生密钥 · 完整版解锁\n\n最后一行：你的本命星还有更多秘密——解锁后可看到事业、财运、恋爱、方位指引与未来5年流年详批。`;
    } else if (kyuTier === 'standard') {
      // 标准档 $9.9：全9维，每维度约250字，总计约2500字
      kyuMaxTokens = 6000;
      userPrompt = isEn
        ? `${starBlock}\nSeeker's question: ${question || 'What is my Nine Star Ki destiny telling me?'}\nBorn: ${birthYear}-${String(birthMonth).padStart(2,'0')}-${String(birthDay).padStart(2,'0')}\n\nPlease provide a STANDARD Nine Star Ki reading (~2500 words), all 9 sections:\n\n1. ⭐ Star Essence — ${star.nameEn} core nature, worldview, shadow side (500 words)\n2. 💼 Career & Life Path — best industries, optimal work style, career timing (300 words)\n3. ❤️ Love & Relationships — love style, best compatible stars, timing windows (300 words)\n4. 💰 Wealth & Resources — wealth accumulation style, best financial years (250 words)\n5. 🌿 Health & Vitality — Five Element body constitution, wellness direction (200 words)\n6. 📅 This Year ${currentYear} — current palace position, key themes, auspicious months (300 words)\n7. 🗓️ Next 3 Years Overview — each year: palace + theme + one key action (200 words)\n8. 🔑 3 Lifetime Keys — deepest wisdom of this star (250 words)\n9. 🌸 Closing (70 words, poetic)\n\nEnd with: For 5-year detailed forecast, auspicious direction charts and compatibility analysis, see the full $49 report.`
        : `${starBlock}\n问卦者的问题：${question || '九星気学告诉我的命运是什么？'}\n出生：${birthYear}年${birthMonth}月${birthDay}日\n\n请出具【标准版九星気学解读报告】，总字数约2500字，按以下9个维度写完：\n\n1. ⭐ 本命星精髓（${star.name}的核心能量、世界观、阴面，500字）\n2. 💼 事业与人生道路（最适行业·工作风格·职业时机，300字）\n3. ❤️ 恋爱与人际关系（恋爱模式·最相性星号·遇缘时机，300字）\n4. 💰 财运与资源（聚财方式·最强财运年份，250字）\n5. 🌿 健康与活力（五行体质弱项·养生方向，不点病名，200字）\n6. 📅 今年运势（${currentYear}年本命星宫位·主题·吉月，300字）\n7. 🗓️ 未来3年方位走势（每年：宫位+主题+最宜做一件大事，200字）\n8. 🔑 三大人生密钥（本命星最深智慧，250字）\n9. 🌸 结语（70字，诗意收尾）\n\n结尾推荐：$49完整版包含：未来5年逐年宫位详批·方位择吉详解（家居/出行/工位）·相性兼容性分析，约8000字。`;
    } else {
      // 完整档 $49：全维度，约6500字
      kyuMaxTokens = 16384;
      userPrompt = isEn
        ? `${starBlock}\nSeeker's question: ${question || 'What is my Nine Star Ki destiny telling me?'}\nBorn: ${birthYear}-${String(birthMonth).padStart(2,'0')}-${String(birthDay).padStart(2,'0')}\n\nPlease provide a COMPLETE Nine Star Ki reading (~6500 words), all sections written fully:\n\n1. ⭐ Star Essence — ${star.nameEn} (500 words: core energy, worldview, giver/receiver dynamic, shadow side)\n2. 💼 Career & Life Path (600 words: 6+ best industries with Five-Element rationale, best/worst work styles, 3 career timing windows in next 5 years, ideal partner traits)\n3. ❤️ Love & Relationships (600 words: love style, most/least compatible stars, 2 timing windows in next 3 years, how to attract the right partner)\n4. 💰 Wealth & Resources (500 words: wealth accumulation style, top financial years next 5 years, wealth-building advice, what to avoid)\n5. 🌿 Health & Vitality (400 words: Five Element organ weaknesses, wellness direction — no disease names, recommended exercise and rhythm)\n6. 📅 This Year ${currentYear} — palace position detailed (500 words: which palace, effect on career/wealth/love/home, auspicious directions for wealth/romance/benefactors, 3 key months)\n7. 🗓️ Next 5 Years Palace Forecast (each year 150 words: palace + theme keyword + best action + what to avoid)\n8. 🏠 Auspicious Direction Guide (600 words: bedroom/desk directions, travel auspicious vs inauspicious, office seat direction, one immediately actionable adjustment)\n9. 🔑 3 Lifetime Keys (400 words: the 3 most important things for this star in one lifetime; if only one thing to remember, that is: [one key star truth])\n10. 🌸 Closing Message (100 words, poetic, like autumn water flowing clear)`
        : `${starBlock}\n问卦者的问题：${question || '九星気学告诉我的命运是什么？'}\n出生：${birthYear}年${birthMonth}月${birthDay}日\n\n请出具【完整版九星気学解读报告】，总字数6500字，所有维度写完写透：\n\n1. ⭐ 本命星精髓（${star.name}，500字：核心能量·世界观·感知模式·阴面·给予者还是接受者）\n2. 💼 事业与人生道路（600字：最适行业至少6个含五行原因·最佳创业vs打工vs自由职业·未来5年3个升职/事业突破年份·适合的工作环境与合作伙伴特质）\n3. ❤️ 恋爱与人际关系（600字：恋爱风格·最相性星号与最有摩擦星号·近3年2个遇缘时机·提升人际运具体方法）\n4. 💰 财运与资源（500字：正财/偏财倾向·最强财运年份·理财建议·不宜的投资方式）\n5. 🌿 健康与活力（400字：五行脏腑先天弱项·养生方向，不点病名·适合运动类型和作息节律）\n6. 📅 今年运势（${currentYear}年本命星宫位详批，500字：宫位位置·对事业/财运/感情/家宅的具体影响·今年3个吉方·今年3个关键月份）\n7. 🗓️ 未来5年宫位走势（每年150字：宫位+主题关键词+最宜做的一件大事+最忌做的一件事）\n8. 🏠 方位择吉详解（600字：家居卧室床头/书桌/玄关方向·出行今年吉方与凶方·工位最佳方向·一件可立即执行的方位调整建议）\n9. 🔑 三大人生密钥（400字：这颗星一生最重要的三件事·如果只能记住一件事那就是：[一句最关键的星语]）\n10. 🌸 命理师结语（100字，诗意，如晚秋清水拂过）`;
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
    const reading = await deepseekChat(messages, { maxTokens: kyuMaxTokens });
    insertReading.run('kyusei', JSON.stringify(req.body), reading, req.userId);
    var ctxId = saveQaContext('kyusei', req.body, reading);
    res.json({ reading, contextId: ctxId, star: { number: starNum, name: star.name, nameEn: star.nameEn, element: star.element, keywords: star.keywords, keywordsEn: star.keywordsEn }, tier: kyuTier, locked: kyuTier === 'free' });
  } catch (err) {
    _refundCreditOnFail(req);
    console.error('[KYUSEI ERR]', err.message);
    res.status(500).json({ error: 'AI temporarily unavailable, please try again' });
  }
});

module.exports = router;
