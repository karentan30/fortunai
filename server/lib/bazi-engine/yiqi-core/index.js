"use strict";
// 统一排盘接口
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXAMPLE_BIRTH_INFO = void 0;
exports.createChart = createChart;
exports.validateBirthInfo = validateBirthInfo;
exports.runAllTests = runAllTests;
exports.formatChartResult = formatChartResult;
const bazi_1 = require("./bazi");
const ziwei_standard_1 = require("./ziwei-standard");
const lunar_typescript_1 = require("../vendor/lunar-typescript");
/**
 * 农历输入 → 公历。排盘全程按公历计算，只在这里换算一次。
 *
 * 🔴 为什么必须有这个函数：`isLunar` 原来是**死字段**——createBaziChart /
 *   createZiweiChart 都直接 `Solar.fromYmdHms(birthInfo.year, ...)`，把农历数字
 *   当公历算。不报错、不警告，静默出错误命盘（月柱、日柱、大运全错）。
 *   实例：农历1991年八月廿八 06:00 正解是 `辛未 丁酉 戊申 乙卯`，
 *   按旧行为算成阳历 1991-08-28 → 月柱错成 `丙申`。
 *
 * 约定：month 为负表示闰月（lunar-typescript 约定，如 -4 = 闰四月）。
 *   农历日期不存在时 Lunar.fromYmd 会抛错，这里让它继续抛——
 *   宁可报错，也不要静默滚到下个月（那又是一次"看起来正常"的错盘）。
 */
function normalizeBirthInfo(birthInfo) {
    if (!birthInfo || !birthInfo.isLunar)
        return birthInfo;
    let solar;
    try {
        solar = lunar_typescript_1.Lunar.fromYmd(birthInfo.year, birthInfo.month, birthInfo.day).getSolar();
    }
    catch (e) {
        throw new Error(`农历日期不存在：${birthInfo.year}年${birthInfo.month}月${birthInfo.day}日` +
            `（闰月请用负数月份，如 -4 表示闰四月）`);
    }
    return Object.assign({}, birthInfo, {
        year: solar.getYear(),
        month: solar.getMonth(),
        day: solar.getDay(),
        isLunar: false,
    });
}
exports.normalizeBirthInfo = normalizeBirthInfo;
/**
 * 创建完整的排盘（八字 + 紫微斗数）
 * @param birthInfo 生辰信息（isLunar=true 时按农历输入，内部换算为公历）
 * @returns 完整排盘结果
 */
function createChart(birthInfo) {
    try {
        // 农历入口统一在此换算；下游（含 ziwei 里的虚岁/大运年份）一律只认公历
        const solarInfo = normalizeBirthInfo(birthInfo);
        const bazi = (0, bazi_1.createBaziChart)(solarInfo);
        const ziwei = (0, ziwei_standard_1.createZiweiChart)(solarInfo);
        return {
            bazi,
            ziwei
        };
    }
    catch (error) {
        throw new Error(`排盘计算失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * 验证生辰信息的有效性
 * @param birthInfo 生辰信息
 * @returns 验证结果
 */
function validateBirthInfo(birthInfo) {
    const errors = [];
    // 验证年份
    if (birthInfo.year < 1900 || birthInfo.year > 2100) {
        errors.push('年份应在1900-2100之间');
    }
    // 验证月份
    if (birthInfo.month < 1 || birthInfo.month > 12) {
        errors.push('月份应在1-12之间');
    }
    // 验证日期
    if (birthInfo.day < 1 || birthInfo.day > 31) {
        errors.push('日期应在1-31之间');
    }
    // 验证时辰
    if (birthInfo.hour < 0 || birthInfo.hour > 23) {
        errors.push('小时应在0-23之间');
    }
    // 验证分钟
    if (birthInfo.minute < 0 || birthInfo.minute > 59) {
        errors.push('分钟应在0-59之间');
    }
    // 验证性别
    if (birthInfo.gender !== 'male' && birthInfo.gender !== 'female') {
        errors.push('性别必须为男性或女性');
    }
    // 简单的闰年和月份天数验证
    if (birthInfo.month === 2) {
        const isLeapYear = (birthInfo.year % 4 === 0 && birthInfo.year % 100 !== 0) || (birthInfo.year % 400 === 0);
        if (birthInfo.day > (isLeapYear ? 29 : 28)) {
            errors.push('2月份日期超出范围');
        }
    }
    else if ([4, 6, 9, 11].includes(birthInfo.month)) {
        if (birthInfo.day > 30) {
            errors.push('该月份只有30天');
        }
    }
    return {
        valid: errors.length === 0,
        errors
    };
}
/**
 * 运行所有算法测试
 * @returns 综合测试结果
 */
function runAllTests() {
    const baziResults = (0, bazi_1.runBaziTests)();
    const ziweiResults = (0, ziwei_standard_1.runZiweiTests)();
    const totalPassed = baziResults.passed + ziweiResults.passed;
    const totalFailed = baziResults.failed + ziweiResults.failed;
    return {
        bazi: baziResults,
        ziwei: ziweiResults,
        summary: {
            totalPassed,
            totalFailed,
            success: totalFailed === 0
        }
    };
}
/**
 * 格式化排盘结果为可读字符串（用于调试）
 * @param chart 排盘结果
 * @returns 格式化的字符串
 */
function formatChartResult(chart) {
    let result = '=== 排盘结果 ===\n\n';
    // 八字部分
    result += '【八字排盘】\n';
    result += `年柱: ${chart.bazi.siZhu.year.gan}${chart.bazi.siZhu.year.zhi}\n`;
    result += `月柱: ${chart.bazi.siZhu.month.gan}${chart.bazi.siZhu.month.zhi}\n`;
    result += `日柱: ${chart.bazi.siZhu.day.gan}${chart.bazi.siZhu.day.zhi}\n`;
    result += `时柱: ${chart.bazi.siZhu.hour.gan}${chart.bazi.siZhu.hour.zhi}\n`;
    result += `日主: ${chart.bazi.dayMaster}\n`;
    result += `大运起运: ${chart.bazi.dayunStart}岁\n`;
    result += `前三步大运: ${chart.bazi.dayun.slice(0, 3).map(dy => `${dy.ganZhi.gan}${dy.ganZhi.zhi}`).join(' ')}\n\n`;
    // 紫微斗数部分
    result += '【紫微斗数】\n';
    result += `命宫: ${chart.ziwei.gongs[0].dizhi}宫\n`;
    const shenGongDizhi = chart.ziwei.gongs[chart.ziwei.shenGongIndex]?.dizhi || '未知';
    result += `身宫: ${shenGongDizhi}宫\n`;
    // 显示有主星的宫位
    chart.ziwei.gongs.forEach(gong => {
        if (gong.mainStars.length > 0) {
            result += `${gong.gong}(${gong.dizhi}): ${gong.mainStars.join('、')}`;
            if (gong.auxStars.length > 0) {
                result += ` [${gong.auxStars.join('、')}]`;
            }
            if (gong.sihua.length > 0) {
                result += ` {${gong.sihua.map(s => `${s.star}${s.hua}`).join('、')}}`;
            }
            result += '\n';
        }
    });
    return result;
}
// 导出示例用法
exports.EXAMPLE_BIRTH_INFO = {
    year: 1990,
    month: 5,
    day: 15,
    hour: 14,
    minute: 30,
    isLunar: false,
    gender: 'male',
    timeZone: 8
};
