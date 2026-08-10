'use strict';
const path = require('path');
const fs = require('fs');

/**
 * 邮件服务库 - 善缘 ShenYuan
 *
 * 功能：
 * - 加载及编译邮件模板
 * - 发送邮件通过 Resend API
 * - 支持中/英/韩三语言
 * - 格式化订单/续费/邀请数据
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

/**
 * 加载模板文件并编译变量
 * @param {string} templateName - 模板名称（不含扩展名）
 * @param {string} lang - 语言码：cn/en/kr
 * @param {object} variables - 模板变量
 * @returns {string} - 编译后的 HTML
 */
function compileTemplate(templateName, lang, variables) {
  const filename = `${templateName}-${lang}.html`;
  const filepath = path.join(__dirname, '../email/templates', filename);

  try {
    let template = fs.readFileSync(filepath, 'utf8');

    // 简单的变量替换（{{key}} 格式）
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp('{{\\s*' + key + '\\s*}}', 'g');
      template = template.replace(placeholder, value || '');
    }

    return template;
  } catch (e) {
    console.error(`[email-service] template not found: ${filename}`, e.message);
    // fallback: 尝试加载英文版
    if (lang !== 'en') {
      return compileTemplate(templateName, 'en', variables);
    }
    throw e;
  }
}

/**
 * 通过 Resend API 发送邮件
 * @param {string} to - 收件人邮箱
 * @param {string} subject - 邮件主题
 * @param {string} html - HTML 内容
 * @returns {Promise<boolean>} - 是否成功
 */
async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY) {
    console.warn('[email-service] RESEND_API_KEY not set, skip send');
    return false;
  }

  try {
    const { Resend } = require('resend');
    const resend = new Resend(RESEND_API_KEY);

    const { error, data } = await resend.emails.send({
      from: '善缘命理 <noreply@shenyuan.mylumee.cn>',
      to,
      subject,
      html
    });

    if (error) {
      console.error('[email-service] resend error:', error);
      return false;
    }

    console.log('[email-service] sent to', to, 'id:', data?.id);
    return true;
  } catch (e) {
    console.error('[email-service] send failed:', e.message);
    return false;
  }
}

/**
 * 发送订单确认邮件
 * @param {string} email - 收件人邮箱
 * @param {object} order - 订单信息 {orderNo, product, amount, expiresAt}
 * @param {string} lang - 语言码
 * @returns {Promise<boolean>}
 */
async function sendOrderConfirmation(email, order, lang = 'cn') {
  const expiryDate = new Date(order.expiresAt);
  const variables = {
    orderNo: order.orderNo || '',
    product: order.product || '八字年运报告',
    amount: formatPrice(order.amount, lang),
    expiryDate: formatDate(expiryDate, lang),
    reportUrl: `https://shenyuan.mylumee.cn/pages/report.html?order=${order.orderNo}`,
    theme: getTheme(lang)
  };

  const html = compileTemplate('order_confirmation', lang, variables);
  const subject = {
    cn: '✅ 感谢您的购买 - 善缘订单确认',
    en: '✅ Thank You for Your Purchase - ShenYuan Order Confirmation',
    kr: '✅ 구매해주셔서 감사합니다 - 善缘 주문 확인'
  }[lang] || subject.cn;

  return sendEmail(email, subject, html);
}

/**
 * 发送续费提醒邮件
 * @param {string} email - 收件人邮箱
 * @param {object} subscription - 订阅信息 {planName, expiresAt, renewalPrice}
 * @param {string} lang - 语言码
 * @returns {Promise<boolean>}
 */
async function sendRenewalReminder(email, subscription, lang = 'cn') {
  const expiryDate = new Date(subscription.expiresAt);
  const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));

  const variables = {
    planName: subscription.planName || '年度会员',
    expiryDate: formatDate(expiryDate, lang),
    daysLeft: Math.max(0, daysLeft),
    renewalPrice: formatPrice(subscription.renewalPrice, lang),
    renewUrl: 'https://shenyuan.mylumee.cn/pages/bazi.html?tab=renew',
    theme: getTheme(lang)
  };

  const html = compileTemplate('renewal_reminder', lang, variables);
  const subject = {
    cn: '⏰ 您的会员即将到期 - 善缘',
    en: '⏰ Your Membership is About to Expire - ShenYuan',
    kr: '⏰ 회원권이 곧 만료됩니다 - 善缘'
  }[lang] || subject.cn;

  return sendEmail(email, subject, html);
}

/**
 * 发送邀请成功邮件
 * @param {string} email - 邀请者邮箱
 * @param {object} referral - 邀请信息 {inviteeName, reward, currentLevel, nextLevelRequired}
 * @param {string} lang - 语言码
 * @returns {Promise<boolean>}
 */
async function sendReferralSuccess(email, referral, lang = 'cn') {
  const variables = {
    inviteeName: referral.inviteeName || '新用户',
    reward: formatPrice(referral.reward, lang),
    currentLevel: referral.currentLevel || '青铜',
    nextLevelRequired: referral.nextLevelRequired || 5,
    leaderboardUrl: 'https://shenyuan.mylumee.cn/pages/leaderboard.html',
    theme: getTheme(lang)
  };

  const html = compileTemplate('referral_success', lang, variables);
  const subject = {
    cn: '🎉 恭喜！您的邀请成功了 - 善缘',
    en: '🎉 Congratulations! Your Referral is Successful - ShenYuan',
    kr: '🎉 축하합니다! 당신의 추천이 성공했습니다 - 善缘'
  }[lang] || subject.cn;

  return sendEmail(email, subject, html);
}

/**
 * 格式化价格显示
 * @param {number} amount - 金额（单位：分）
 * @param {string} lang - 语言码
 * @returns {string}
 */
function formatPrice(amount, lang) {
  const yuan = (amount / 100).toFixed(2);
  const symbol = {
    cn: '¥',
    en: '$',
    kr: '₩'
  }[lang] || '¥';

  if (lang === 'kr') {
    return `${Math.round(amount / 100 * 1200)}${symbol}`;
  }
  return `${symbol}${yuan}`;
}

/**
 * 格式化日期
 * @param {Date} date - 日期对象
 * @param {string} lang - 语言码
 * @returns {string}
 */
function formatDate(date, lang) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if (lang === 'cn') {
    return `${year}年${month}月${day}日`;
  } else if (lang === 'kr') {
    return `${year}년 ${month}월 ${day}일`;
  } else {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}

/**
 * 获取主题 CSS 对象（用于邮件样式）
 * @param {string} lang - 语言码
 * @returns {object}
 */
function getTheme(lang) {
  return JSON.stringify({
    primary: '#d4af37',
    dark: '#1a0f2e',
    text: 'rgba(240,238,230,0.85)'
  });
}

module.exports = {
  sendEmail,
  compileTemplate,
  sendOrderConfirmation,
  sendRenewalReminder,
  sendReferralSuccess,
  formatPrice,
  formatDate,
  getTheme
};
