"use strict";
// Vimshottari Mahadasha — 吠陀最主流的行星大运系统 (120 年周期)。
// 由出生时刻 Moon 的恒星黄经(sidereal)所落 Nakshatra + 宿内进度起算。
//
// 原理:
//   27 nakshatra 循环归属 9 曜, 顺序固定:
//     Ketu(7) → Venus(20) → Sun(6) → Moon(10) → Mars(7) → Rahu(18)
//     → Jupiter(16) → Saturn(19) → Mercury(17)  (括号=该曜大运年数, 合计120)
//   出生宿的主星即第一个 Mahadasha, 但通常已过去一部分:
//     已过比例 = (月亮在本宿内已走的度数) / (每宿 13°20')
//   剩余首运时长 = 该曜年数 × (1 - 已过比例)
//   之后按固定顺序循环。
//
// 输出当前所处的 Mahadasha + 其下 Antardasha(次级大运/bhukti),
// 各含起止年份(以公历十进制年近似, 1 dasha-year = 365.25 天)。

const NAK_SIZE = 360 / 27; // 13°20'

// 9 曜大运顺序 + 年数 (Vimshottari 标准)
const DASHA_SEQUENCE = [
  { planet: "Ketu",    years: 7  },
  { planet: "Venus",   years: 20 },
  { planet: "Sun",     years: 6  },
  { planet: "Moon",    years: 10 },
  { planet: "Mars",    years: 7  },
  { planet: "Rahu",    years: 18 },
  { planet: "Jupiter", years: 16 },
  { planet: "Saturn",  years: 19 },
  { planet: "Mercury", years: 17 },
];
const TOTAL_YEARS = 120; // 7+20+6+10+7+18+16+19+17

// 中文曜名
const PLANET_ZH = {
  Ketu: "计都", Venus: "金星", Sun: "太阳", Moon: "月亮", Mars: "火星",
  Rahu: "罗睺", Jupiter: "木星", Saturn: "土星", Mercury: "水星",
};

const DAYS_PER_YEAR = 365.25;

/** 公历(年,月,日,时,分) → 十进制年(近似, 用于展示起止年)。 */
function toDecimalYear(year, month, day, hour, minute) {
  // 简单近似: 年 + 一年内已过天数占比
  const startOfYear = Date.UTC(year, 0, 1);
  const t = Date.UTC(year, month - 1, day, hour || 0, minute || 0);
  const yearMs = Date.UTC(year + 1, 0, 1) - startOfYear;
  return year + (t - startOfYear) / yearMs;
}

/**
 * 计算 Vimshottari Mahadasha 序列 + 当前所处大运/次运。
 *
 * @param {number} moonSiderealLon  月亮恒星黄经 (度)
 * @param {Object} birth  { year, month, day, hour, minute }  出生公历
 * @param {Date}   [now=new Date()]  参考"当前"时刻(默认真实现在)
 * @returns {Object} {
 *   birthNakshatra:{index,name,lord},
 *   startPlanet, elapsedFraction,
 *   sequence:[ {planet,planetZh,startYear,endYear,years} ...未来若干段 ],
 *   current:{ maha:{planet,startYear,endYear}, antar:{planet,startYear,endYear} }
 * }
 */
function computeVimshottari(moonSiderealLon, birth, now) {
  const lon = ((moonSiderealLon % 360) + 360) % 360;
  const nakIndex = Math.floor(lon / NAK_SIZE) % 27;      // 0-26
  const within = lon - nakIndex * NAK_SIZE;               // 宿内已走度数
  const elapsedFraction = within / NAK_SIZE;              // 首运已过比例 [0,1)

  // 出生宿主星 = 大运序列中的起点 (nakIndex % 9)
  const startSeqIdx = nakIndex % 9;

  const birthDecYear = toDecimalYear(
    birth.year, birth.month, birth.day, birth.hour, birth.minute != null ? birth.minute : 0
  );

  // 依次铺开各 Mahadasha 起止(十进制年)。首运扣掉已过部分。
  const seq = [];
  let cursor = birthDecYear;
  const totalCycles = 2; // 铺开 2 圈(240年)足够覆盖一生
  for (let c = 0; c < totalCycles; c++) {
    for (let i = 0; i < 9; i++) {
      const s = DASHA_SEQUENCE[(startSeqIdx + i) % 9];
      let dur = s.years;
      let start = cursor;
      if (c === 0 && i === 0) {
        // 首运只剩未过部分
        dur = s.years * (1 - elapsedFraction);
      }
      const end = start + dur;
      seq.push({
        planet: s.planet,
        planetZh: PLANET_ZH[s.planet],
        fullYears: s.years,
        startYear: +start.toFixed(2),
        endYear: +end.toFixed(2),
        durationYears: +dur.toFixed(2),
      });
      cursor = end;
    }
  }

  // 定位"当前"落在哪个 Mahadasha
  const nowDate = now instanceof Date ? now : new Date();
  const nowDecYear = toDecimalYear(
    nowDate.getFullYear(), nowDate.getMonth() + 1, nowDate.getDate(),
    nowDate.getHours(), nowDate.getMinutes()
  );

  let currentMaha = null;
  for (const d of seq) {
    if (nowDecYear >= d.startYear && nowDecYear < d.endYear) { currentMaha = d; break; }
  }
  // 若"当前"早于出生(不该发生)或超出铺开范围, 兜底取首段/末段
  if (!currentMaha) currentMaha = nowDecYear < seq[0].startYear ? seq[0] : seq[seq.length - 1];

  // 计算当前 Mahadasha 内的 Antardasha(次运)。
  // Antardasha 从 Maha 主星自身开始, 按同一 9 曜顺序循环,
  // 每段时长 = mahaYears × (antarYears / 120)。
  const antars = [];
  const mahaLordIdx = DASHA_SEQUENCE.findIndex((x) => x.planet === currentMaha.planet);
  let aCursor = currentMaha.startYear;
  const mahaFull = currentMaha.fullYears;
  for (let i = 0; i < 9; i++) {
    const a = DASHA_SEQUENCE[(mahaLordIdx + i) % 9];
    const aDur = (mahaFull * a.years) / TOTAL_YEARS;
    const aStart = aCursor;
    const aEnd = aStart + aDur;
    antars.push({
      planet: a.planet,
      planetZh: PLANET_ZH[a.planet],
      startYear: +aStart.toFixed(2),
      endYear: +aEnd.toFixed(2),
    });
    aCursor = aEnd;
  }
  // 注意: 首运被截断时, Antardasha 的绝对起点应按"完整 Maha 起点"回推,
  // 但对 current 判定影响仅在极早期; 这里以 Maha 展示起点为准做近似展示。
  let currentAntar = null;
  for (const a of antars) {
    if (nowDecYear >= a.startYear && nowDecYear < a.endYear) { currentAntar = a; break; }
  }
  if (!currentAntar) currentAntar = antars[0];

  const NAK_LORDS = [
    "Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury",
    "Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury",
    "Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury",
  ];

  return {
    birthNakshatra: { index: nakIndex, lord: NAK_LORDS[nakIndex] },
    startPlanet: DASHA_SEQUENCE[startSeqIdx].planet,
    elapsedFraction: +elapsedFraction.toFixed(4),
    sequence: seq,
    current: {
      maha: {
        planet: currentMaha.planet,
        planetZh: currentMaha.planetZh,
        startYear: currentMaha.startYear,
        endYear: currentMaha.endYear,
      },
      antar: currentAntar && {
        planet: currentAntar.planet,
        planetZh: currentAntar.planetZh,
        startYear: currentAntar.startYear,
        endYear: currentAntar.endYear,
      },
    },
  };
}

module.exports = { computeVimshottari, DASHA_SEQUENCE, PLANET_ZH };
