'use strict';
/**
 * routes/calendar.js — 农历 ↔ 公历换算（服务端唯一真源）
 *
 * 为什么必须有这个路由：
 *   pages/collect.html 有「阳历/农历」开关，但此前**全站没有任何地方做过换算** ——
 *   用户选了农历，原始数字被直接当成公历存进 runae_profile.bdate，
 *   下游每个报告页（report-v2.html 的 bd() 等）再把同一串数字当公历送去排盘。
 *   结果：用户亲手选了农历，拿到的却是一份按同样数字当公历排的错盘，
 *   页面上完全看不出来（引擎侧 isLunar 当时也是死字段，已另修）。
 *
 * 现在的分工：
 *   前端只把用户选的「农历年月日」原样传上来 → 这里换算成公历 → 存盘。
 *   存盘后 bdate 恒为公历，下游 ~10 个报告页零改动。
 *
 * 约定：
 *   · leap=1 表示闰月。不传 leap 时按**不闰**的那个月算——用户没勾闰月，
 *     就不该被当成闰月（猜错的代价是一整月的偏差，比报错坏得多）。
 *   · 该农历月没有那一天（如只有 29 天却传 30）→ 400 + monthDayCount，
 *     由前端提示用户；绝不静默滚到下个月。
 */
const router = require('express').Router();
const { Lunar, LunarMonth, LunarYear } = require('../lib/bazi-engine/vendor/lunar-typescript');

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

/**
 * 校验并汇总某个农历年月。
 * @returns {{error:string}|{y:number,m:number,leap:boolean,days:number,leapMonth:number}}
 */
function resolveMonth(y, m, leap) {
  if (!Number.isInteger(y) || y < MIN_YEAR || y > MAX_YEAR) {
    return { error: `年份需在 ${MIN_YEAR}–${MAX_YEAR} 之间` };
  }
  if (!Number.isInteger(m) || m < 1 || m > 12) {
    return { error: '月份需在 1–12 之间' };
  }
  // LunarYear.getLeapMonth() 无闰月时返回 0（不是 null）
  const leapMonth = LunarYear.fromYear(y).getLeapMonth() || 0;
  const useLeap = !!leap && leapMonth === m;
  // LunarMonth.fromYm 对非法闰月/越界返回 null —— 不是抛错，必须显式判空
  const lm = LunarMonth.fromYm(y, useLeap ? -m : m);
  if (!lm) return { error: `农历 ${y} 年 ${m} 月不存在` };
  return { y: y, m: m, leap: useLeap, days: lm.getDayCount(), leapMonth: leapMonth };
}

/**
 * GET /api/calendar/lunar?y=1991&m=8[&d=28][&leap=1]
 *
 * 带 d → 返回对应公历日期；不带 d → 只返回该农历月的天数和闰月信息
 * （供前端填「日」下拉、决定是否显示闰月勾选）。
 */
router.get('/calendar/lunar', function (req, res) {
  const y = parseInt(req.query.y, 10);
  const m = parseInt(req.query.m, 10);
  const leapQ = req.query.leap === '1' || req.query.leap === 'true';

  const rm = resolveMonth(y, m, leapQ);
  if (rm.error) return res.status(400).json({ ok: false, error: rm.error });

  const base = { ok: true, year: rm.y, month: rm.m, leap: rm.leap, monthDayCount: rm.days, leapMonth: rm.leapMonth };

  if (req.query.d === undefined || req.query.d === '') return res.json(base);

  const d = parseInt(req.query.d, 10);
  if (!Number.isInteger(d) || d < 1) {
    return res.status(400).json(Object.assign({}, base, { ok: false, error: '日期需为 1 以上的整数' }));
  }
  if (d > rm.days) {
    return res.status(400).json(Object.assign({}, base, {
      ok: false,
      error: `农历${rm.leap ? '闰' : ''}${rm.m}月只有 ${rm.days} 天`,
    }));
  }

  let solar;
  try {
    const s = Lunar.fromYmd(rm.y, rm.leap ? -rm.m : rm.m, d).getSolar();
    solar = { year: s.getYear(), month: s.getMonth(), day: s.getDay() };
  } catch (e) {
    // 上面已按天数校验过，走到这里说明历表与校验不一致——宁可 500 也别给错日期
    console.error('[calendar/lunar]', rm.y, rm.m, d, e && e.message);
    return res.status(500).json(Object.assign({}, base, { ok: false, error: '农历换算失败' }));
  }

  res.json(Object.assign({}, base, {
    day: d,
    solar: solar,
    lunarText: `${rm.y}年${rm.leap ? '闰' : ''}${rm.m}月${d}日`,
  }));
});

module.exports = router;
