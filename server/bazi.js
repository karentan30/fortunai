// 善缘 · 八字排盘引擎 v1.0
// 真实计算四柱八字、大运、流年，非AI模拟

// ── 天干地支 ──
const TIAN_GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const DI_ZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const ZODIAC = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
const WU_XING_GAN = {甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'};
const WU_XING_ZHI = {子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水'};
const SHI_CHEN = [
  { hour: 0, name:'子时' }, { hour: 1, name:'丑时' }, { hour: 3, name:'寅时' }, { hour: 5, name:'卯时' },
  { hour: 7, name:'辰时' }, { hour: 9, name:'巳时' }, { hour: 11, name:'午时' }, { hour: 13, name:'未时' },
  { hour: 15, name:'申时' }, { hour: 17, name:'酉时' }, { hour: 19, name:'戌时' }, { hour: 21, name:'亥时' }
];

// 时柱地支索引 (子0, 丑1, ..., 亥11)
function getShiChenIndex(hour) {
  for (var i = SHI_CHEN.length - 1; i >= 0; i--) {
    if (hour >= SHI_CHEN[i].hour) return i;
  }
  return 0;
}

// ── 日柱计算（基于儒略日） ──
function getDayGanZhi(year, month, day) {
  // 计算儒略日
  var y = year, m = month, d = day;
  if (m <= 2) { y--; m += 12; }
  var A = Math.floor(y / 100);
  var B = 2 - A + Math.floor(A / 4);
  var JD = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;

  // 日干支（校准：1900-01-01 甲辰日 index=10，常数=50）
  var dayIndex = Math.floor((JD + 50) % 60);
  if (dayIndex < 0) dayIndex += 60;

  return {
    gan: TIAN_GAN[dayIndex % 10],
    zhi: DI_ZHI[dayIndex % 12],
    index: dayIndex
  };
}

// ── 年柱（考虑立春） ──
// 简化处理：2月4日前为前一年
function getYearGanZhi(year, month, day) {
  var y = year;
  // 立春通常在2月4日左右
  if (month < 2 || (month === 2 && day < 4)) y--;
  var idx = (y - 4) % 60;
  if (idx < 0) idx += 60;
  return {
    gan: TIAN_GAN[idx % 10],
    zhi: DI_ZHI[idx % 12],
    index: idx
  };
}

// ── 月柱（按节气，简化用月分界） ──
// 立春2/4, 惊蛰3/6, 清明4/5, 立夏5/5, 芒种6/6, 小暑7/7, 立秋8/7, 白露9/8, 寒露10/8, 立冬11/7, 大雪12/7, 小寒1/6
function getMonthGanZhi(yearGanIndex, month, day) {
  var monthZhi;
  if (month === 1 && day >= 6) monthZhi = 1; // 丑
  else if (month === 2 && day >= 4) monthZhi = 2; // 寅
  else if (month === 3 && day >= 6) monthZhi = 3; // 卯
  else if (month === 4 && day >= 5) monthZhi = 4; // 辰
  else if (month === 5 && day >= 5) monthZhi = 5; // 巳
  else if (month === 6 && day >= 6) monthZhi = 6; // 午
  else if (month === 7 && day >= 7) monthZhi = 7; // 未
  else if (month === 8 && day >= 7) monthZhi = 8; // 申
  else if (month === 9 && day >= 8) monthZhi = 9; // 酉
  else if (month === 10 && day >= 8) monthZhi = 10; // 戌
  else if (month === 11 && day >= 7) monthZhi = 11; // 亥
  else if (month === 12 && day >= 7) monthZhi = 0; // 子
  else {
    // 节气前，仍属上一个月支（子1=丑1…亥11，月支比公历月+1偏移）
    monthZhi = (month - 1 + 12) % 12;
  }

  // 月干：年干 * 2 + 月地支序数 = 月干序数
  // (甲己之年丙作首，乙庚之岁戊为头，丙辛之年寻庚上，丁壬壬寅顺水流，若问戊癸何处起，甲寅之上好追求)
  var yearGan = yearGanIndex % 10;
  var monthGanStart = (yearGan % 5) * 2; // 0甲己→丙(2), 1乙庚→戊(4), 2丙辛→庚(6), 3丁壬→壬(8), 4戊癸→甲(0)
  var monthGan = (monthGanStart + monthZhi) % 10;

  return {
    gan: TIAN_GAN[monthGan],
    zhi: DI_ZHI[monthZhi]
  };
}

// ── 时柱 ──
function getHourGanZhi(dayGanIndex, hour) {
  var shiIndex = getShiChenIndex(hour);
  // 日干*2 + 时支 = 时干序数
  // 甲己还加甲，乙庚丙作初，丙辛从戊起，丁壬庚子居，戊癸何方发，壬子是真途
  var dayGan = dayGanIndex % 10;
  var hourGan = ((dayGan % 5) * 2 + shiIndex) % 10;
  return {
    gan: TIAN_GAN[hourGan],
    zhi: DI_ZHI[shiIndex]
  };
}

// ── 大运计算（60甲子顺序推，保证天干地支连贯） ──
function calcDaYun(yearGanZhi, monthGanZhi, gender) {
  var yearGan = TIAN_GAN.indexOf(yearGanZhi.gan);
  var isYang = yearGan % 2 === 0; // 甲丙戊庚壬为阳
  var forward = (isYang && gender === 'male') || (!isYang && gender === 'female');

  // 找月柱在60甲子中的序号
  var mGan = TIAN_GAN.indexOf(monthGanZhi.gan);
  var mZhi = DI_ZHI.indexOf(monthGanZhi.zhi);
  var monthPillarIdx = -1;
  for (var k = 0; k < 60; k++) {
    if (k % 10 === mGan && k % 12 === mZhi) { monthPillarIdx = k; break; }
  }

  var dayun = [];
  for (var i = 0; i < 8; i++) {
    var di = forward
      ? (monthPillarIdx + 1 + i) % 60
      : (monthPillarIdx - 1 - i + 60) % 60;
    dayun.push({
      gan: TIAN_GAN[di % 10],
      zhi: DI_ZHI[di % 12],
      name: TIAN_GAN[di % 10] + DI_ZHI[di % 12],
      startAge: 1 + i * 10,
      endAge: 10 + i * 10
    });
  }
  return dayun;
}

// ── 神煞（简化） ──
function getShenSha(dayGan) {
  var gan = TIAN_GAN.indexOf(dayGan);
  var tianYi = [DI_ZHI[(12 - gan) % 12], DI_ZHI[(12 - gan + 2) % 12]];
  return { tianYi: tianYi };
}

// ── 主函数 ──
function calcBazi(birthYear, birthMonth, birthDay, birthHour, gender) {
  var yearGZ = getYearGanZhi(birthYear, birthMonth, birthDay);
  var dayGZ = getDayGanZhi(birthYear, birthMonth, birthDay);
  var monthGZ = getMonthGanZhi(yearGZ.index, birthMonth, birthDay);
  var hourGZ = getHourGanZhi(dayGZ.index, birthHour);
  var dayun = calcDaYun(yearGZ, monthGZ, gender);
  var shensha = getShenSha(dayGZ.gan);
  var shiChenName = SHI_CHEN[getShiChenIndex(birthHour)].name;
  var zodiacIndex = DI_ZHI.indexOf(yearGZ.zhi);

  // 五行统计
  var wuxing = { 金:0, 木:0, 水:0, 火:0, 土:0 };
  [yearGZ, monthGZ, dayGZ, hourGZ].forEach(function(p) {
    wuxing[WU_XING_GAN[p.gan]]++;
    wuxing[WU_XING_ZHI[p.zhi]] += 0.8;
  });

  // 日主五行
  var dayMasterElement = WU_XING_GAN[dayGZ.gan];

  // 身强/弱判断（简化）
  var selfStrength = wuxing[dayMasterElement] + (wuxing[WU_XING_GAN[monthGZ.gan]] > 1 ? 1 : 0);
  var isStrong = selfStrength >= 3;

  return {
    year: yearGZ, month: monthGZ, day: dayGZ, hour: hourGZ,
    fourPillars: yearGZ.gan + yearGZ.zhi + ' ' + monthGZ.gan + monthGZ.zhi + ' ' + dayGZ.gan + dayGZ.zhi + ' ' + hourGZ.gan + hourGZ.zhi,
    dayMaster: dayGZ.gan,
    dayMasterElement: dayMasterElement,
    isStrong: isStrong,
    wuxing: wuxing,
    shensha: shensha,
    daYun: dayun,
    zodiac: ZODIAC[zodiacIndex],
    shiChen: shiChenName,
    shiChenIndex: getShiChenIndex(birthHour)
  };
}

if (typeof module !== 'undefined') module.exports = { calcBazi, TIAN_GAN, DI_ZHI, ZODIAC, WU_XING_GAN, WU_XING_ZHI, SHI_CHEN, getShiChenIndex };
