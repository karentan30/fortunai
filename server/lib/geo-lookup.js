/**
 * geo-lookup.js — 城市 → 经纬度 + 时区 查表
 * 为 Runae 吠陀占星真引擎(/jyotish)解锁精确 Lagna 计算。
 *
 * lookupCity(cityStr, countryStr) → { lat, lng, tz } | null
 *   - lat: 纬度(北正 / 南负)
 *   - lng: 经度(东正 / 西负)
 *   - tz : UTC 偏移小时(如中国 8 / 印度 5.5 / 美东 -5)
 *
 * 匹配顺序:
 *   1. 城市精确/模糊(去空格、小写、别名)匹配
 *   2. 匹配不到 → 按 country 返回该国首都坐标(兜底)
 *   3. 再不到 → 返回 null(由调用方兜底,本函数绝不 throw)
 *
 * ⚠️ 本文件只读数据 + 纯函数,不依赖 divination.js。
 */

const fs = require("fs");
const path = require("path");

// ---- 加载城市表(启动时一次,失败降级为空表不崩) ----
let CITIES = [];
try {
  const raw = fs.readFileSync(
    path.join(__dirname, "..", "data", "city-coords.json"),
    "utf8"
  );
  CITIES = JSON.parse(raw);
} catch (e) {
  // 数据缺失不应让整个引擎挂掉;记录后走空表(全部走首都兜底)
  console.error("[geo-lookup] 加载 city-coords.json 失败:", e.message);
  CITIES = [];
}

// ---- country → capital 兜底表(城市匹配不到时用) ----
// 键做过归一化(小写去空格);值 { lat, lng, tz }。
const CAPITALS = {
  中国: { lat: 39.9042, lng: 116.4074, tz: 8 },
  china: { lat: 39.9042, lng: 116.4074, tz: 8 },
  中国香港: { lat: 22.3193, lng: 114.1694, tz: 8 },
  hongkong: { lat: 22.3193, lng: 114.1694, tz: 8 },
  中国澳门: { lat: 22.1987, lng: 113.5439, tz: 8 },
  macau: { lat: 22.1987, lng: 113.5439, tz: 8 },
  中国台湾: { lat: 25.033, lng: 121.5654, tz: 8 },
  taiwan: { lat: 25.033, lng: 121.5654, tz: 8 },
  新加坡: { lat: 1.3521, lng: 103.8198, tz: 8 },
  singapore: { lat: 1.3521, lng: 103.8198, tz: 8 },
  马来西亚: { lat: 3.139, lng: 101.6869, tz: 8 },
  malaysia: { lat: 3.139, lng: 101.6869, tz: 8 },
  泰国: { lat: 13.7563, lng: 100.5018, tz: 7 },
  thailand: { lat: 13.7563, lng: 100.5018, tz: 7 },
  印度尼西亚: { lat: -6.2088, lng: 106.8456, tz: 7 },
  印尼: { lat: -6.2088, lng: 106.8456, tz: 7 },
  indonesia: { lat: -6.2088, lng: 106.8456, tz: 7 },
  菲律宾: { lat: 14.5995, lng: 120.9842, tz: 8 },
  philippines: { lat: 14.5995, lng: 120.9842, tz: 8 },
  越南: { lat: 21.0278, lng: 105.8342, tz: 7 },
  vietnam: { lat: 21.0278, lng: 105.8342, tz: 7 },
  柬埔寨: { lat: 11.5564, lng: 104.9282, tz: 7 },
  cambodia: { lat: 11.5564, lng: 104.9282, tz: 7 },
  缅甸: { lat: 16.8409, lng: 96.1735, tz: 6.5 },
  myanmar: { lat: 16.8409, lng: 96.1735, tz: 6.5 },
  老挝: { lat: 17.9757, lng: 102.6331, tz: 7 },
  laos: { lat: 17.9757, lng: 102.6331, tz: 7 },
  文莱: { lat: 4.9031, lng: 114.9398, tz: 8 },
  brunei: { lat: 4.9031, lng: 114.9398, tz: 8 },
  日本: { lat: 35.6762, lng: 139.6503, tz: 9 },
  japan: { lat: 35.6762, lng: 139.6503, tz: 9 },
  韩国: { lat: 37.5665, lng: 126.978, tz: 9 },
  southkorea: { lat: 37.5665, lng: 126.978, tz: 9 },
  korea: { lat: 37.5665, lng: 126.978, tz: 9 },
  朝鲜: { lat: 39.0392, lng: 125.7625, tz: 9 },
  northkorea: { lat: 39.0392, lng: 125.7625, tz: 9 },
  蒙古: { lat: 47.8864, lng: 106.9057, tz: 8 },
  mongolia: { lat: 47.8864, lng: 106.9057, tz: 8 },
  印度: { lat: 28.6139, lng: 77.209, tz: 5.5 },
  india: { lat: 28.6139, lng: 77.209, tz: 5.5 },
  尼泊尔: { lat: 27.7172, lng: 85.324, tz: 5.75 },
  nepal: { lat: 27.7172, lng: 85.324, tz: 5.75 },
  斯里兰卡: { lat: 6.9271, lng: 79.8612, tz: 5.5 },
  srilanka: { lat: 6.9271, lng: 79.8612, tz: 5.5 },
  孟加拉国: { lat: 23.8103, lng: 90.4125, tz: 6 },
  bangladesh: { lat: 23.8103, lng: 90.4125, tz: 6 },
  巴基斯坦: { lat: 33.6844, lng: 73.0479, tz: 5 },
  pakistan: { lat: 33.6844, lng: 73.0479, tz: 5 },
  美国: { lat: 38.9072, lng: -77.0369, tz: -5 }, // 华盛顿
  usa: { lat: 38.9072, lng: -77.0369, tz: -5 },
  us: { lat: 38.9072, lng: -77.0369, tz: -5 },
  unitedstates: { lat: 38.9072, lng: -77.0369, tz: -5 },
  america: { lat: 38.9072, lng: -77.0369, tz: -5 },
  加拿大: { lat: 45.4215, lng: -75.6972, tz: -5 }, // 渥太华
  canada: { lat: 45.4215, lng: -75.6972, tz: -5 },
  墨西哥: { lat: 19.4326, lng: -99.1332, tz: -6 },
  mexico: { lat: 19.4326, lng: -99.1332, tz: -6 },
  澳大利亚: { lat: -35.2809, lng: 149.13, tz: 10 }, // 堪培拉
  澳洲: { lat: -35.2809, lng: 149.13, tz: 10 },
  australia: { lat: -35.2809, lng: 149.13, tz: 10 },
  新西兰: { lat: -41.2865, lng: 174.7762, tz: 12 }, // 惠灵顿
  newzealand: { lat: -41.2865, lng: 174.7762, tz: 12 },
  英国: { lat: 51.5074, lng: -0.1278, tz: 0 },
  uk: { lat: 51.5074, lng: -0.1278, tz: 0 },
  unitedkingdom: { lat: 51.5074, lng: -0.1278, tz: 0 },
  england: { lat: 51.5074, lng: -0.1278, tz: 0 },
  britain: { lat: 51.5074, lng: -0.1278, tz: 0 },
  爱尔兰: { lat: 53.3498, lng: -6.2603, tz: 0 },
  ireland: { lat: 53.3498, lng: -6.2603, tz: 0 },
  法国: { lat: 48.8566, lng: 2.3522, tz: 1 },
  france: { lat: 48.8566, lng: 2.3522, tz: 1 },
  德国: { lat: 52.52, lng: 13.405, tz: 1 },
  germany: { lat: 52.52, lng: 13.405, tz: 1 },
  荷兰: { lat: 52.3676, lng: 4.9041, tz: 1 },
  netherlands: { lat: 52.3676, lng: 4.9041, tz: 1 },
  比利时: { lat: 50.8503, lng: 4.3517, tz: 1 },
  belgium: { lat: 50.8503, lng: 4.3517, tz: 1 },
  瑞士: { lat: 47.3769, lng: 8.5417, tz: 1 },
  switzerland: { lat: 47.3769, lng: 8.5417, tz: 1 },
  奥地利: { lat: 48.2082, lng: 16.3738, tz: 1 },
  austria: { lat: 48.2082, lng: 16.3738, tz: 1 },
  意大利: { lat: 41.9028, lng: 12.4964, tz: 1 },
  italy: { lat: 41.9028, lng: 12.4964, tz: 1 },
  西班牙: { lat: 40.4168, lng: -3.7038, tz: 1 },
  spain: { lat: 40.4168, lng: -3.7038, tz: 1 },
  葡萄牙: { lat: 38.7223, lng: -9.1393, tz: 0 },
  portugal: { lat: 38.7223, lng: -9.1393, tz: 0 },
  瑞典: { lat: 59.3293, lng: 18.0686, tz: 1 },
  sweden: { lat: 59.3293, lng: 18.0686, tz: 1 },
  丹麦: { lat: 55.6761, lng: 12.5683, tz: 1 },
  denmark: { lat: 55.6761, lng: 12.5683, tz: 1 },
  挪威: { lat: 59.9139, lng: 10.7522, tz: 1 },
  norway: { lat: 59.9139, lng: 10.7522, tz: 1 },
  芬兰: { lat: 60.1699, lng: 24.9384, tz: 2 },
  finland: { lat: 60.1699, lng: 24.9384, tz: 2 },
  波兰: { lat: 52.2297, lng: 21.0122, tz: 1 },
  poland: { lat: 52.2297, lng: 21.0122, tz: 1 },
  捷克: { lat: 50.0755, lng: 14.4378, tz: 1 },
  czech: { lat: 50.0755, lng: 14.4378, tz: 1 },
  匈牙利: { lat: 47.4979, lng: 19.0402, tz: 1 },
  hungary: { lat: 47.4979, lng: 19.0402, tz: 1 },
  希腊: { lat: 37.9838, lng: 23.7275, tz: 2 },
  greece: { lat: 37.9838, lng: 23.7275, tz: 2 },
  俄罗斯: { lat: 55.7558, lng: 37.6173, tz: 3 },
  russia: { lat: 55.7558, lng: 37.6173, tz: 3 },
  土耳其: { lat: 39.9334, lng: 32.8597, tz: 3 }, // 安卡拉
  turkey: { lat: 39.9334, lng: 32.8597, tz: 3 },
  阿联酋: { lat: 24.4539, lng: 54.3773, tz: 4 }, // 阿布扎比
  uae: { lat: 24.4539, lng: 54.3773, tz: 4 },
  卡塔尔: { lat: 25.2854, lng: 51.531, tz: 3 },
  qatar: { lat: 25.2854, lng: 51.531, tz: 3 },
  沙特阿拉伯: { lat: 24.7136, lng: 46.6753, tz: 3 },
  沙特: { lat: 24.7136, lng: 46.6753, tz: 3 },
  saudiarabia: { lat: 24.7136, lng: 46.6753, tz: 3 },
  以色列: { lat: 31.7683, lng: 35.2137, tz: 2 }, // 耶路撒冷
  israel: { lat: 31.7683, lng: 35.2137, tz: 2 },
  埃及: { lat: 30.0444, lng: 31.2357, tz: 2 },
  egypt: { lat: 30.0444, lng: 31.2357, tz: 2 },
  南非: { lat: -25.7479, lng: 28.2293, tz: 2 }, // 比勒陀利亚
  southafrica: { lat: -25.7479, lng: 28.2293, tz: 2 },
  肯尼亚: { lat: -1.2864, lng: 36.8172, tz: 3 },
  kenya: { lat: -1.2864, lng: 36.8172, tz: 3 },
  尼日利亚: { lat: 9.0765, lng: 7.3986, tz: 1 }, // 阿布贾
  nigeria: { lat: 9.0765, lng: 7.3986, tz: 1 },
  巴西: { lat: -15.7939, lng: -47.8828, tz: -3 }, // 巴西利亚
  brazil: { lat: -15.7939, lng: -47.8828, tz: -3 },
  阿根廷: { lat: -34.6037, lng: -58.3816, tz: -3 },
  argentina: { lat: -34.6037, lng: -58.3816, tz: -3 },
  智利: { lat: -33.4489, lng: -70.6693, tz: -3 },
  chile: { lat: -33.4489, lng: -70.6693, tz: -3 },
  秘鲁: { lat: -12.0464, lng: -77.0428, tz: -5 },
  peru: { lat: -12.0464, lng: -77.0428, tz: -5 },
  哥伦比亚: { lat: 4.711, lng: -74.0721, tz: -5 },
  colombia: { lat: 4.711, lng: -74.0721, tz: -5 },
};

// ---- 归一化: 小写 + 去所有空白/常见标点(引号/点/连字符) ----
function norm(s) {
  if (s == null) return "";
  return String(s)
    .toLowerCase()
    .replace(/[\s'’`.\-_,]/g, "")
    .trim();
}

// ---- 预建索引: 归一化 key → { lat, lng, tz } ----
const CITY_INDEX = new Map();
for (const c of CITIES) {
  if (!c || typeof c.lat !== "number" || typeof c.lng !== "number") continue;
  const coords = { lat: c.lat, lng: c.lng, tz: c.tz };
  const keys = [c.city, ...(Array.isArray(c.aliases) ? c.aliases : [])];
  for (const k of keys) {
    const nk = norm(k);
    if (nk && !CITY_INDEX.has(nk)) CITY_INDEX.set(nk, coords);
  }
}

/**
 * 城市 → 坐标查询
 * @param {string} cityStr    城市名(中/英/别名皆可)
 * @param {string} [countryStr] 国家名(城市匹配不到时用于首都兜底)
 * @returns {{lat:number,lng:number,tz:number}|null}
 */
function lookupCity(cityStr, countryStr) {
  // 1. 城市精确/别名匹配
  const nCity = norm(cityStr);
  if (nCity && CITY_INDEX.has(nCity)) {
    return { ...CITY_INDEX.get(nCity) };
  }

  // 2. 城市模糊: 输入包含某条 key 或某条 key 包含输入(处理 "北京市"/"greater london" 类)
  if (nCity && nCity.length >= 2) {
    for (const [k, v] of CITY_INDEX) {
      if (k.length >= 2 && (nCity.includes(k) || k.includes(nCity))) {
        return { ...v };
      }
    }
  }

  // 3. 按 country 首都兜底
  const nCountry = norm(countryStr);
  if (nCountry && CAPITALS[nCountry]) {
    return { ...CAPITALS[nCountry] };
  }
  // 3b. country 模糊(输入含国名或国名含输入)
  if (nCountry && nCountry.length >= 2) {
    for (const k of Object.keys(CAPITALS)) {
      if (nCountry.includes(k) || k.includes(nCountry)) {
        return { ...CAPITALS[k] };
      }
    }
  }

  // 4. 全部落空 → null(调用方兜底)
  return null;
}

module.exports = { lookupCity };
