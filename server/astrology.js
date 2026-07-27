// 善缘 · Western Astrology Calculator v1.0
// 西方占星星盘计算引擎（简化版，够用即可）

// ── Sign names ──
const SIGNS_ZH = ['白羊','金牛','双子','巨蟹','狮子','处女','天秤','天蝎','射手','摩羯','水瓶','双鱼'];
const SIGNS_EN = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

// ── Elements ──
const ELEMENTS = ['火','土','风','水','火','土','风','水','火','土','风','水'];

// ── Solar return ──
function getSunSign(month, day) {
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 0;  // Aries
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 1;  // Taurus
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 2;  // Gemini
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 3;  // Cancer
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 4;  // Leo
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 5;  // Virgo
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 6; // Libra
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 7; // Scorpio
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 8; // Sagittarius
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 9;  // Capricorn
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 10; // Aquarius
  return 11; // Pisces
}

// ── Julian Date ──
function julianDate(year, month, day, hour, minute) {
  var y = year, m = month, d = day;
  if (m <= 2) { y--; m += 12; }
  var A = Math.floor(y / 100);
  var B = 2 - A + Math.floor(A / 4);
  var JD = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  JD += (hour + minute / 60) / 24;
  return JD;
}

// ── Days between two dates ──
function daysBetween(y1, m1, d1, y2, m2, d2) {
  return julianDate(y2, m2, d2, 12, 0) - julianDate(y1, m1, d1, 12, 0);
}

// ── Moon sign (approximate, based on sidereal cycle) ──
function getMoonSign(year, month, day) {
  // Reference: Jan 1, 2020, Moon mean longitude ≈ 308° (Aquarius 8°)
  var daysSinceRef = daysBetween(2020, 1, 1, year, month, day);
  // Moon completes 360° in ~27.32 days → ~13.176°/day
  var moonLong = (308 + daysSinceRef * 13.176) % 360;
  if (moonLong < 0) moonLong += 360;
  var signIndex = Math.floor(moonLong / 30) % 12;
  var degree = Math.floor(moonLong % 30);
  return { sign: signIndex, degree: degree, longitude: +moonLong.toFixed(2) };
}

// ── Rising sign (Ascendant) ──
// Uses Local Sidereal Time + latitude to compute approximate ascendant
function getRisingSign(year, month, day, hour, minute, latitude, longitude) {
  if (hour === undefined || hour === null) hour = 12;
  if (minute === undefined || minute === null) minute = 0;

  var JD = julianDate(year, month, day, hour, minute);
  var T = (JD - 2451545.0) / 36525; // centuries since J2000.0

  // Greenwich Mean Sidereal Time (degrees)
  var GMST = 280.46061837 + 360.98564736629 * (JD - 2451545.0) + 0.000387933 * T * T - T * T * T / 38710000;
  GMST = ((GMST % 360) + 360) % 360;

  // Local Sidereal Time
  var LST = (GMST + (longitude || 0)) % 360;
  if (LST < 0) LST += 360;

  // Obliquity of Ecliptic (simplified)
  var epsilon = 23.439291 - 0.0130042 * T;

  // Ascendant formula
  var lat = Math.PI / 180 * (latitude || 40);
  var eps = Math.PI / 180 * epsilon;
  var lst = Math.PI / 180 * LST;

  var ascDeg = Math.atan2(
    -Math.cos(lst),
    Math.sin(eps) * Math.tan(lat) + Math.cos(eps) * Math.sin(lst)
  ) * 180 / Math.PI;
  ascDeg = ((ascDeg + 360) % 360);

  var signIndex = Math.floor(ascDeg / 30) % 12;
  var degree = Math.floor(ascDeg % 30);
  return { sign: signIndex, degree: degree, longitude: +ascDeg.toFixed(2) };
}

// ── Planetary positions (very approximate, mean longitudes) ──
function calcPlanets(year, month, day) {
  var JD = julianDate(year, month, day, 12, 0);
  var T = (JD - 2451545.0) / 36525;

  // Heliocentric longitude formulas (mean orbital longitudes, very simplified)
  // Reference: Jean Meeus "Astronomical Algorithms" simplified mean elements
  var positions = {};

  // Mercury: ~88 day orbit
  var mMercury = ((252.250906 + 149472.6746358 * T) % 360 + 360) % 360;
  positions.mercury = { sign: Math.floor(mMercury / 30) % 12, degree: Math.floor(mMercury % 30), longitude: +mMercury.toFixed(2) };

  // Venus: ~225 day orbit
  var mVenus = ((181.979801 + 58517.815676 * T) % 360 + 360) % 360;
  positions.venus = { sign: Math.floor(mVenus / 30) % 12, degree: Math.floor(mVenus % 30), longitude: +mVenus.toFixed(2) };

  // Mars: ~687 day orbit
  var mMars = ((355.452994 + 19140.302828 * T) % 360 + 360) % 360;
  positions.mars = { sign: Math.floor(mMars / 30) % 12, degree: Math.floor(mMars % 30), longitude: +mMars.toFixed(2) };

  // Jupiter: ~12 year orbit
  var mJupiter = ((34.351484 + 3034.905675 * T) % 360 + 360) % 360;
  positions.jupiter = { sign: Math.floor(mJupiter / 30) % 12, degree: Math.floor(mJupiter % 30), longitude: +mJupiter.toFixed(2) };

  // Saturn: ~29.5 year orbit
  var mSaturn = ((50.077471 + 1222.113794 * T) % 360 + 360) % 360;
  positions.saturn = { sign: Math.floor(mSaturn / 30) % 12, degree: Math.floor(mSaturn % 30), longitude: +mSaturn.toFixed(2) };

  return positions;
}

// ── Sun ecliptic longitude (based on day of year) ──
function getSunLongitude(year, month, day) {
  // Sun moves ~0.9856 degrees/day. At vernal equinox (Mar 20) it's at 0° Aries
  var startOfYear = julianDate(year, 3, 20, 12, 0); // ~vernal equinox
  var currentDate = julianDate(year, month, day, 12, 0);
  var daysDiff = currentDate - startOfYear;
  var longitude = ((daysDiff * 0.9856) + 360) % 360;
  return longitude;
}

// ── Sun sign with degree ──
function getSunWithDegree(year, month, day) {
  var lon = getSunLongitude(year, month, day);
  var signIndex = getSunSign(month, day);
  // Calculate degree within sign
  var degree = Math.floor(lon % 30);
  return { sign: signIndex, degree: degree, longitude: +lon.toFixed(2) };
}

// ── Moon phase ──
function getMoonPhase(year, month, day) {
  // Use the sun-moon angle to determine phase
  var sunLon = getSunLongitude(year, month, day);
  var moon = getMoonSign(year, month, day);
  var moonLon = moon.longitude;
  var diff = ((moonLon - sunLon) % 360 + 360) % 360;

  var phase;
  if (diff < 45) phase = '新月 New Moon';
  else if (diff < 90) phase = '蛾眉月 Waxing Crescent';
  else if (diff < 135) phase = '上弦月 First Quarter';
  else if (diff < 180) phase = '盈凸月 Waxing Gibbous';
  else if (diff < 225) phase = '满月 Full Moon';
  else if (diff < 270) phase = '亏凸月 Waning Gibbous';
  else if (diff < 315) phase = '下弦月 Last Quarter';
  else phase = '残月 Waning Crescent';

  return { phase: phase, illumination: Math.round((1 - Math.cos(diff * Math.PI / 180)) / 2 * 100) + '%' };
}

// ── House system (simplified Equal House based on Ascendant) ──
function calcHouses(risingSign) {
  var houses = [];
  for (var i = 0; i < 12; i++) {
    var signIndex = (risingSign.sign + i) % 12;
    houses.push({
      number: i + 1,
      sign: signIndex,
      signZh: SIGNS_ZH[signIndex],
      signEn: SIGNS_EN[signIndex]
    });
  }
  return houses;
}

// ════════════════════════════════════════════
// MAIN EXPORTED FUNCTION
// ════════════════════════════════════════════

function calcAstrology(birthYear, birthMonth, birthDay, birthHour, birthMinute, latitude, longitude) {
  // --- Sun ---
  var sun = getSunWithDegree(birthYear, birthMonth, birthDay);

  // --- Moon ---
  var moon = getMoonSign(birthYear, birthMonth, birthDay);

  // --- Rising ---
  var rising = getRisingSign(birthYear, birthMonth, birthDay, birthHour, birthMinute, latitude, longitude);

  // --- Planets ---
  var planets = calcPlanets(birthYear, birthMonth, birthDay);

  // --- Houses ---
  var houses = calcHouses(rising);

  // --- Moon phase ---
  var moonPhase = getMoonPhase(birthYear, birthMonth, birthDay);

  // --- Elements balance ---
  var elementCount = { 火: 0, 土: 0, 风: 0, 水: 0 };
  var allBodies = [sun, moon, rising, planets.mercury, planets.venus, planets.mars, planets.jupiter, planets.saturn];
  allBodies.forEach(function(b) {
    if (b && b.sign !== undefined) {
      var el = ELEMENTS[b.sign];
      elementCount[el] = (elementCount[el] || 0) + 1;
    }
  });

  // --- Modality ---
  var MODALITIES = ['开创','固定','变动','开创','固定','变动','开创','固定','变动','开创','固定','变动'];
  var modalityCount = { 开创: 0, 固定: 0, 变动: 0 };
  allBodies.forEach(function(b) {
    if (b && b.sign !== undefined) {
      var mod = MODALITIES[b.sign];
      modalityCount[mod] = (modalityCount[mod] || 0) + 1;
    }
  });

  return {
    sun: {
      sign: sun.sign,
      signZh: SIGNS_ZH[sun.sign],
      signEn: SIGNS_EN[sun.sign],
      degree: sun.degree,
      element: ELEMENTS[sun.sign]
    },
    moon: {
      sign: moon.sign,
      signZh: SIGNS_ZH[moon.sign],
      signEn: SIGNS_EN[moon.sign],
      degree: moon.degree,
      element: ELEMENTS[moon.sign]
    },
    rising: {
      sign: rising.sign,
      signZh: SIGNS_ZH[rising.sign],
      signEn: SIGNS_EN[rising.sign],
      degree: rising.degree,
      element: ELEMENTS[rising.sign]
    },
    planets: {
      mercury: {
        sign: planets.mercury.sign,
        signZh: SIGNS_ZH[planets.mercury.sign],
        signEn: SIGNS_EN[planets.mercury.sign],
        degree: planets.mercury.degree,
        element: ELEMENTS[planets.mercury.sign],
        longitude: planets.mercury.longitude
      },
      venus: {
        sign: planets.venus.sign,
        signZh: SIGNS_ZH[planets.venus.sign],
        signEn: SIGNS_EN[planets.venus.sign],
        degree: planets.venus.degree,
        element: ELEMENTS[planets.venus.sign],
        longitude: planets.venus.longitude
      },
      mars: {
        sign: planets.mars.sign,
        signZh: SIGNS_ZH[planets.mars.sign],
        signEn: SIGNS_EN[planets.mars.sign],
        degree: planets.mars.degree,
        element: ELEMENTS[planets.mars.sign],
        longitude: planets.mars.longitude
      },
      jupiter: {
        sign: planets.jupiter.sign,
        signZh: SIGNS_ZH[planets.jupiter.sign],
        signEn: SIGNS_EN[planets.jupiter.sign],
        degree: planets.jupiter.degree,
        element: ELEMENTS[planets.jupiter.sign],
        longitude: planets.jupiter.longitude
      },
      saturn: {
        sign: planets.saturn.sign,
        signZh: SIGNS_ZH[planets.saturn.sign],
        signEn: SIGNS_EN[planets.saturn.sign],
        degree: planets.saturn.degree,
        element: ELEMENTS[planets.saturn.sign],
        longitude: planets.saturn.longitude
      }
    },
    houses: houses,
    moonPhase: moonPhase,
    elements: [
      { name: '火 Fire', count: elementCount['火'], percentage: Math.round(elementCount['火'] / allBodies.length * 100) },
      { name: '土 Earth', count: elementCount['土'], percentage: Math.round(elementCount['土'] / allBodies.length * 100) },
      { name: '风 Air', count: elementCount['风'], percentage: Math.round(elementCount['风'] / allBodies.length * 100) },
      { name: '水 Water', count: elementCount['水'], percentage: Math.round(elementCount['水'] / allBodies.length * 100) }
    ],
    modalities: [
      { name: '开创 Cardinal', count: modalityCount['开创'], percentage: Math.round(modalityCount['开创'] / allBodies.length * 100) },
      { name: '固定 Fixed', count: modalityCount['固定'], percentage: Math.round(modalityCount['固定'] / allBodies.length * 100) },
      { name: '变动 Mutable', count: modalityCount['变动'], percentage: Math.round(modalityCount['变动'] / allBodies.length * 100) }
    ],
    summary: {
      bigThree: `${SIGNS_ZH[rising.sign]}上升 · ${SIGNS_ZH[sun.sign]}太阳 · ${SIGNS_ZH[moon.sign]}月亮`,
      dominantElement: elementCount['火'] >= elementCount['土'] && elementCount['火'] >= elementCount['风'] && elementCount['火'] >= elementCount['水'] ? '火 Fire' :
                        elementCount['土'] >= elementCount['风'] && elementCount['土'] >= elementCount['水'] ? '土 Earth' :
                        elementCount['风'] >= elementCount['水'] ? '风 Air' : '水 Water',
      dominantModality: modalityCount['开创'] >= modalityCount['固定'] && modalityCount['开创'] >= modalityCount['变动'] ? '开创 Cardinal' :
                          modalityCount['固定'] >= modalityCount['变动'] ? '固定 Fixed' : '变动 Mutable'
    }
  };
}

if (typeof module !== 'undefined') module.exports = { calcAstrology, SIGNS_ZH, SIGNS_EN, ELEMENTS };
