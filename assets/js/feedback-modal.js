/**
 * feedback-modal.js — 通用反馈评分弹窗组件
 *
 * 使用方式：
 * 1. 在 report 页面引入: <script src="/assets/js/feedback-modal.js"></script>
 * 2. 报告生成完成后，调用: FeedbackModal.show({ readingType: 'bazi', lang: 'zh' })
 * 3. 支持自定义主题色
 */

const FeedbackModal = (function() {
  const CATEGORIES = {
    quality: '准确度',
    accuracy: '信息完整',
    ui: '界面体验',
    performance: '加载速度',
    other: '其他问题',
    general: '通用反馈'
  };

  const CATEGORIES_EN = {
    quality: 'Accuracy',
    accuracy: 'Completeness',
    ui: 'UI/UX',
    performance: 'Performance',
    other: 'Other',
    general: 'General Feedback'
  };

  const CATEGORIES_KR = {
    quality: '정확도',
    accuracy: '정보 완성도',
    ui: '인터페이스',
    performance: '로딩 속도',
    other: '기타 문제',
    general: '피드백'
  };

  let config = {
    readingType: '',
    lang: 'zh',
    onSuccess: null,
    onClose: null,
    apiEndpoint: '/api/feedback'
  };

  /**
   * 获取本地化文案
   */
  function t(key) {
    const translations = {
      zh: {
        title: '请对您的命书进行评分',
        subtitle: '您的反馈对我们改进服务至关重要',
        placeholder: '请描述您的感受或遇到的问题...',
        category: '问题分类',
        selectCategory: '-- 请选择问题类型 --',
        submit: '提交反馈',
        submitting: '提交中...',
        success: '感谢您的反馈！',
        error: '提交失败，请重试',
        close: '关闭'
      },
      en: {
        title: 'Rate Your Reading',
        subtitle: 'Your feedback helps us improve',
        placeholder: 'Please share your thoughts or any issues...',
        category: 'Category',
        selectCategory: '-- Select issue type --',
        submit: 'Submit Feedback',
        submitting: 'Submitting...',
        success: 'Thank you for your feedback!',
        error: 'Failed to submit. Please try again',
        close: 'Close'
      },
      kr: {
        title: '점수를 매겨주세요',
        subtitle: '당신의 피드백이 저희 서비스 개선에 도움이 됩니다',
        placeholder: '생각을 공유하거나 문제를 설명해주세요...',
        category: '카테고리',
        selectCategory: '-- 유형 선택 --',
        submit: '피드백 제출',
        submitting: '제출 중...',
        success: '피드백 감사합니다!',
        error: '제출 실패. 다시 시도해주세요',
        close: '닫기'
      }
    };

    const lang = config.lang || 'zh';
    return (translations[lang] && translations[lang][key]) || translations.zh[key];
  }

  /**
   * 获取分类选项（本地化）
   */
  function getCategoryOptions() {
    const categoryMap = {
      zh: CATEGORIES,
      en: CATEGORIES_EN,
      kr: CATEGORIES_KR
    };
    return categoryMap[config.lang] || CATEGORIES;
  }

  /**
   * 创建星级选择器 HTML
   */
  function createStarRating() {
    let html = '<div class="feedback-stars" style="display: flex; gap: 12px; justify-content: center; margin: 20px 0;">';
    for (let i = 1; i <= 5; i++) {
      html += `<button class="star-btn" data-rating="${i}" type="button" style="
        font-size: 32px;
        background: none;
        border: none;
        cursor: pointer;
        opacity: 0.4;
        transition: opacity 0.2s;
      ">★</button>`;
    }
    html += '</div><input type="hidden" id="feedbackRating" value="0">';
    return html;
  }

  /**
   * 创建分类选择器
   */
  function createCategorySelector() {
    const categories = getCategoryOptions();
    let html = `<div style="margin: 16px 0;">
      <label style="display: block; font-size: 12px; margin-bottom: 6px; color: rgba(80,70,55,0.7);">${t('category')}</label>
      <select id="feedbackCategory" style="
        width: 100%;
        padding: 8px 12px;
        border: 1px solid rgba(201,168,76,0.2);
        border-radius: 6px;
        font-family: 'Noto Serif SC', serif;
        background: #ffffff;
        color: rgba(40,35,30,0.92);
      ">
        <option value="">${t('selectCategory')}</option>`;

    for (const [key, label] of Object.entries(categories)) {
      html += `<option value="${key}">${label}</option>`;
    }

    html += '</select></div>';
    return html;
  }

  /**
   * 绑定星级选择事件
   */
  function bindStarEvents() {
    const stars = document.querySelectorAll('.star-btn');
    const ratingInput = document.getElementById('feedbackRating');

    stars.forEach(star => {
      star.addEventListener('click', function() {
        const rating = parseInt(this.dataset.rating);
        ratingInput.value = rating;

        // 更新星级显示
        stars.forEach((s, idx) => {
          s.style.opacity = (idx + 1) <= rating ? '1' : '0.4';
        });
      });

      // hover 效果
      star.addEventListener('mouseover', function() {
        const rating = parseInt(this.dataset.rating);
        stars.forEach((s, idx) => {
          s.style.opacity = (idx + 1) <= rating ? '0.8' : '0.3';
        });
      });
    });

    document.querySelector('.feedback-stars').addEventListener('mouseleave', function() {
      const rating = parseInt(ratingInput.value);
      stars.forEach((s, idx) => {
        s.style.opacity = (idx + 1) <= rating ? '1' : '0.4';
      });
    });
  }

  /**
   * 提交反馈
   */
  async function submitFeedback() {
    const rating = parseInt(document.getElementById('feedbackRating').value);
    const category = document.getElementById('feedbackCategory').value;
    const message = document.getElementById('feedbackMessage').value.trim();
    const nameEl = document.getElementById('feedbackName');
    const emailEl = document.getElementById('feedbackEmail');
    const name = nameEl ? nameEl.value.trim() : '';
    const email = emailEl ? emailEl.value.trim() : '';

    // 基础验证
    if (!message) {
      showToast(t('error') + '：请输入反馈内容', 'error');
      return;
    }

    if (rating === 0) {
      showToast(t('error') + '：请选择评分', 'error');
      return;
    }

    // 提交按钮禁用
    const submitBtn = document.querySelector('.feedback-submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = t('submitting');

    try {
      const response = await fetch(config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name || '匿名用户',
          email: email || '',
          message,
          rating,
          category: category || 'general',
          readingType: config.readingType,
          lang: config.lang
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        showToast(t('success'), 'success');
        setTimeout(() => {
          close();
          if (config.onSuccess) config.onSuccess(data);
        }, 1000);
      } else {
        showToast(data.error || t('error'), 'error');
      }
    } catch (err) {
      console.error('[Feedback Error]', err);
      showToast(t('error'), 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  /**
   * Toast 通知
   */
  function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 99999;
      max-width: 360px;
      width: 90%;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 12px;
      text-align: center;
      font-family: 'Noto Serif SC', serif;
      cursor: pointer;
      background: ${type === 'error' ? 'rgba(180,40,40,0.92)' : 'rgba(23,14,6,0.95)'};
      color: ${type === 'error' ? 'rgba(255,220,220,0.95)' : 'rgba(255,245,220,0.9)'};
      border: ${type === 'error' ? '1px solid rgba(220,80,80,0.4)' : '1px solid rgba(201,168,76,0.2)'};
    `;
    t.textContent = msg;
    t.onclick = function() {
      t.style.opacity = '0';
      t.style.transition = 'opacity 0.3s';
      setTimeout(() => t.remove(), 300);
    };
    document.body.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transition = 'opacity 0.3s';
      setTimeout(() => t.remove(), 300);
    }, 3000);
  }

  /**
   * 关闭弹窗
   */
  function close() {
    const modal = document.getElementById('feedbackModal');
    if (modal) {
      modal.style.opacity = '0';
      modal.style.transition = 'opacity 0.3s';
      setTimeout(() => {
        modal.remove();
        if (config.onClose) config.onClose();
      }, 300);
    }
  }

  /**
   * 显示反馈弹窗（主入口）
   */
  function show(options = {}) {
    config = Object.assign({}, config, options);

    // 创建 modal 容器
    const modal = document.createElement('div');
    modal.id = 'feedbackModal';
    modal.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99998;
      padding: 20px;
      opacity: 0;
      transition: opacity 0.3s;
    `;

    // 弹窗内容
    const content = document.createElement('div');
    content.style.cssText = `
      background: #ffffff;
      border-radius: 12px;
      padding: 28px 24px;
      max-width: 420px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
      animation: slideUp 0.3s ease-out;
    `;

    // 标题
    const title = document.createElement('div');
    title.style.cssText = `
      font-size: 18px;
      font-weight: 600;
      color: rgba(40,35,30,0.92);
      margin-bottom: 8px;
      text-align: center;
    `;
    title.textContent = t('title');

    // 副标题
    const subtitle = document.createElement('div');
    subtitle.style.cssText = `
      font-size: 12px;
      color: rgba(80,70,55,0.7);
      text-align: center;
      margin-bottom: 20px;
    `;
    subtitle.textContent = t('subtitle');

    // 星级评分
    const starsHtml = createStarRating();

    // 分类选择
    const categoryHtml = createCategorySelector();

    // 用户信息（可选）
    const userInfoHtml = `
      <div style="margin: 16px 0; display: none;">
        <div style="margin-bottom: 10px;">
          <input id="feedbackName" type="text" placeholder="您的名字（可选）" style="
            width: 100%;
            padding: 8px 12px;
            border: 1px solid rgba(201,168,76,0.2);
            border-radius: 6px;
            font-family: 'Noto Serif SC', serif;
            box-sizing: border-box;
          ">
        </div>
        <div>
          <input id="feedbackEmail" type="email" placeholder="您的邮箱（可选）" style="
            width: 100%;
            padding: 8px 12px;
            border: 1px solid rgba(201,168,76,0.2);
            border-radius: 6px;
            font-family: 'Noto Serif SC', serif;
            box-sizing: border-box;
          ">
        </div>
      </div>
    `;

    // 反馈文本
    const messageHtml = `
      <div style="margin: 16px 0;">
        <textarea id="feedbackMessage" placeholder="${t('placeholder')}" style="
          width: 100%;
          height: 100px;
          padding: 12px;
          border: 1px solid rgba(201,168,76,0.2);
          border-radius: 6px;
          font-family: 'Noto Serif SC', serif;
          font-size: 12px;
          color: rgba(40,35,30,0.92);
          resize: vertical;
          box-sizing: border-box;
        "></textarea>
      </div>
    `;

    // 按钮
    const buttonsHtml = `
      <div style="display: flex; gap: 12px; margin-top: 24px;">
        <button class="feedback-submit-btn" type="button" style="
          flex: 1;
          padding: 12px;
          background: rgba(91,191,160,0.9);
          color: #ffffff;
          border: none;
          border-radius: 6px;
          font-family: 'Noto Serif SC', serif;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.2s;
        ">${t('submit')}</button>
        <button type="button" onclick="document.getElementById('feedbackModal').remove()" style="
          padding: 12px 20px;
          background: rgba(201,168,76,0.1);
          color: rgba(40,35,30,0.92);
          border: none;
          border-radius: 6px;
          font-family: 'Noto Serif SC', serif;
          font-size: 13px;
          cursor: pointer;
        ">${t('close')}</button>
      </div>
    `;

    content.innerHTML = `
      ${title.outerHTML}
      ${subtitle.outerHTML}
      ${starsHtml}
      ${categoryHtml}
      ${userInfoHtml}
      ${messageHtml}
      ${buttonsHtml}
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // 添加动画
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideUp {
        from { transform: translateY(30px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      #feedbackModal .feedback-submit-btn:hover {
        background: rgba(91,191,160,1) !important;
      }
      #feedbackModal .feedback-submit-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `;
    document.head.appendChild(style);

    // 触发动画
    setTimeout(() => {
      modal.style.opacity = '1';
    }, 10);

    // 绑定事件
    bindStarEvents();

    // 提交按钮
    const submitBtn = content.querySelector('.feedback-submit-btn');
    submitBtn.addEventListener('click', submitFeedback);

    // 点击背景关闭
    modal.addEventListener('click', function(e) {
      if (e.target === this) close();
    });

    // 按 ESC 关闭
    const handleEsc = function(e) {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
  }

  return {
    show,
    close
  };
})();

// 导出到全局作用域
if (typeof window !== 'undefined') {
  window.FeedbackModal = FeedbackModal;
}
