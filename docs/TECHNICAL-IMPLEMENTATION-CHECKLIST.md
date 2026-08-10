# Phase 1 技术实现检查清单

**项目**：三语报告页对齐 | **状态**：✋ 等待启动 | **更新**：2026-08-10

---

## 🎯 快速导航

**想快速上手？** 按优先级从上到下执行。每完成一个，打勾 ✅

---

## Phase 1.0：前置准备 (W1 周一)

### 后端环境检查
- [ ] 确认 DeepSeek API 配额充足 (目标：日 5000 req，现在多少？)
  ```bash
  curl -H "Authorization: Bearer ${DEEPSEEK_API_KEY}" \
       https://api.deepseek.com/v1/user/info
  ```
  记录：剩余额度 `_______`

- [ ] Stripe Live Key 确认（美国个人号 vs Capstone 公司号？）
  ```bash
  echo $STRIPE_SECRET_KEY | grep -o 'sk_live.*' | head -c 20
  ```
  确认环境变量：`sk_live_` ✅

- [ ] Supabase HK 区域确认，数据库连接无问题
  ```bash
  npm run db:health
  ```
  输出应该是：`✅ Supabase connected (HK region)`

- [ ] PM2 当前进程状态
  ```bash
  pm2 status
  ```
  记录：当前运行的 app 名称 `_______`

### 设计资产交接
- [ ] Figma 设计稿三语对齐
  - [ ] 中文版本（参考现有 bazi.html）
  - [ ] 英文版本（字号/间距调整 for English typography）
  - [ ] 韩文版本（韩文字体差异处理）
  - [ ] 设计稿链接：`https://figma.com/...`

- [ ] 颜色系统确认（复用 brand-tokens.css）
  ```css
  --bg: #faf8f5       /* 背景米白 */
  --gold: #c9a84c     /* 主色金 */
  --jade: #5bbfa0     /* 副色翠 */
  --ink-text: rgba(40,35,30,0.92)  /* 文字 */
  ```
  确认无新颜色需求：是 / 否

---

## Phase 1.1：API 层开发 (W2 周一-三)

### 新建 Prompt 文件
- [ ] 创建 `/server/prompts/bazi-en.txt`（复制下方模板）
  ```bash
  cat > server/prompts/bazi-en.txt << 'EOF'
  You are an expert in Four Pillars BaZi astrology...
  [完整 prompt 见 PRD 第 10.2 附录]
  EOF
  ```

- [ ] 创建 `/server/prompts/bazi-kr.txt`（基于现有样张，微调措辞）
  ```bash
  # 从 saju-report-KR.html 提取 prompt，调整为 txt 格式
  # 添加 AI 法合规声明（"연예 및 참고용"）
  ```

- [ ] 验证两个 prompt 都能读取
  ```bash
  wc -w server/prompts/bazi-*.txt
  # 应该各 800+ 字
  ```

### 后端路由开发
- [ ] 修改 `/server/routes/bazi.js`，支持三语
  ```javascript
  // 旧：只有 POST /api/bazi
  // 新：POST /api/bazi, /api/bazi-en, /api/bazi-kr（复用逻辑，改 prompt）
  
  async function generateBazi(year, month, day, hour, lang = 'cn') {
    const promptFile = `./prompts/bazi-${lang}.txt`;
    const prompt = fs.readFileSync(promptFile, 'utf-8');
    
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt + '\n\n' + JSON.stringify({...}) }]
    });
    
    return { id, lang, basic: {...}, full: {...} };
  }
  ```

- [ ] 新建 `/server/routes/bazi-en.js` 和 `/server/routes/bazi-kr.js`（或统一入口）
  - 入口 1（推荐）：`POST /api/bazi?lang=cn|en|kr`（一个端点）
  - 入口 2（现有习惯）：`POST /api/bazi-en` + `POST /api/bazi-kr`（三个端点）
  
  **选择：推荐入口 1**
  - [ ] 确认路由最终方案

- [ ] 修改 `/server/routes/order.js`，支持分级访问
  ```javascript
  // 新增逻辑：检查 order.status
  if (!order.completed) {
    // 返回 basic（四柱+五行）
    return { basic: {...}, full: null };
  } else {
    // 返回 full（加上大运/流年/运势）
    return { basic: {...}, full: {...} };
  }
  ```

- [ ] 添加 rate limiting（防止滥用）
  ```javascript
  // 使用 express-rate-limit
  const limiter = rateLimit({
    windowMs: 1 * 60 * 1000,  // 1 分钟
    max: 5,                    // 5 请求/分钟
    message: 'Too many requests'
  });
  
  app.post('/api/bazi*', limiter, generateBazi);
  ```

- [ ] 集成 Sentry 事件追踪
  ```javascript
  Sentry.captureEvent({
    message: 'ai_report_generated',
    level: 'info',
    tags: { lang, reportId, wordsCount }
  });
  ```

### 数据库迁移
- [ ] 创建 Supabase 迁移脚本
  ```sql
  /* supabase/migrations/20260810_add_lang_to_bazi.sql */
  ALTER TABLE bazi_reports ADD COLUMN IF NOT EXISTS lang TEXT DEFAULT 'cn';
  CREATE INDEX idx_bazi_lang ON bazi_reports(lang);
  ```

- [ ] 创建 rate limit 表
  ```sql
  CREATE TABLE IF NOT EXISTS api_rate_limits (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT,
    endpoint TEXT,
    attempts INT DEFAULT 1,
    reset_at TIMESTAMP DEFAULT now() + interval '1 minute',
    created_at TIMESTAMP DEFAULT now()
  );
  CREATE INDEX idx_rate_limit_user ON api_rate_limits(user_id, endpoint);
  ```

- [ ] 执行迁移（staging 先）
  ```bash
  cd /opt/shenyuan
  npm run db:migrate:staging
  # 验证：检查 bazi_reports 表有 lang 列
  ```

### API 测试（Postman 或 curl）
- [ ] `POST /api/bazi?lang=cn` 生成中文报告
  ```bash
  curl -X POST http://localhost:3021/api/bazi?lang=cn \
    -H "Content-Type: application/json" \
    -d '{"year":1990,"month":5,"day":15,"hour":14,"gender":"M"}'
  # 预期：`{ id: "bazi_xxxxx", lang: "cn", basic: {...} }`
  ```

- [ ] `POST /api/bazi?lang=en` 生成英文报告
  ```bash
  curl -X POST http://localhost:3021/api/bazi?lang=en \
    -H "Content-Type: application/json" \
    -d '{"year":1990,"month":5,"day":15,"hour":14,"gender":"M"}'
  # 预期：English report ≥ 4000 words
  ```

- [ ] `POST /api/bazi?lang=kr` 生成韩文报告
  ```bash
  curl -X POST http://localhost:3021/api/bazi?lang=kr \
    -H "Content-Type: application/json" \
    -d '{"year":1990,"month":5,"day":15,"hour":14,"gender":"M"}'
  # 预期：Korean report, 한국어
  ```

---

## Phase 1.2：前端开发 (W2 周三-五)

### 创建 i18n 系统
- [ ] 创建 `/assets/js/i18n.js`（复用下方模板）
  ```javascript
  // 见 PRD 第 5.3 节，粘贴完整文件
  ```

- [ ] 验证翻译覆盖（没有漏掉的 key）
  ```bash
  # 检查所有 t('...') 调用
  grep -r "t('" pages/bazi.html | cut -d"'" -f2 | sort -u
  # 验证每个 key 都在 i18n 三种语言中有定义
  ```

### 创建统一 CSS
- [ ] 创建 `/assets/css/report-unified.css`
  ```css
  /* 合并 bazi.html 和 bazi-en.html 的 <style> */
  /* 保留所有 .sizhu-grid, .zhu, .fortune-sec 等通用类 */
  /* 删除重复定义 */
  ```

- [ ] 创建 `/assets/css/language.css`（语言特异）
  ```css
  html[lang="zh-CN"] {
    --font-serif: 'Noto Serif SC', serif;
    --font-sans: 'Noto Serif SC', serif;
  }
  html[lang="en"] {
    --font-serif: 'Cormorant Garamond', serif;
    --font-sans: 'Inter', sans-serif;
  }
  html[lang="ko"] {
    --font-serif: 'Noto Serif KR', serif;
    --font-sans: 'Noto Sans KR', sans-serif;
  }
  
  /* 细微微调（如果需要） */
  html[lang="en"] .fortune-title { letter-spacing: 0.04em; }  /* EN 紧凑 */
  html[lang="ko"] .fortune-title { letter-spacing: 0.06em; }  /* KR 宽松 */
  ```

- [ ] 合并到 bazi.html：删除 <style> 中重复部分，改为引入
  ```html
  <link rel="stylesheet" href="/assets/css/report-unified.css">
  <link rel="stylesheet" href="/assets/css/language.css">
  ```

### 前端逻辑开发
- [ ] 创建 `/assets/js/bazi-form.js`（复用下方框架）
  ```javascript
  class BaziForm {
    constructor() {
      this.lang = document.documentElement.lang || 'cn';
      this.bindEvents();
    }
    
    async submit() {
      const endpoint = {
        'cn': '/api/bazi',
        'en': '/api/bazi-en',
        'kr': '/api/bazi-kr'
      }[this.lang];
      // ... 请求逻辑
    }
  }
  
  new BaziForm();
  ```

- [ ] 集成支付流程（三语价格自适应）
  ```javascript
  detectRegion() {
    // 方案 1：IP 地理位置（后端传）
    // 方案 2：localStorage 用户选择（前端优先级）
    // 方案 3：URL query ?region=cn|en|kr
    
    const priceMap = {
      'cn': { amount: 999, currency: 'USD', text: '¥99.9' },
      'en': { amount: 999, currency: 'USD', text: '$9.9' },
      'kr': { amount: 9900, currency: 'KRW', text: '₩9,900' }
    };
    
    return priceMap[this.lang];
  }
  ```

- [ ] 添加进度条翻译（三语）
  ```javascript
  const loadingSteps = {
    'cn': ['算盘排八字...', '分析五行大势...', '生成命理深度报告...'],
    'en': ['Calculating Four Pillars...', 'Analyzing Elemental Pattern...', 'Generating Deep Reading...'],
    'kr': ['사주 계산 중...', '오행 분석 중...', '심층 리포트 생성 중...']
  };
  ```

### 前端测试
- [ ] 三语表单提交测试
  - [ ] 中文：点按钮 → 报告生成 ✅
  - [ ] 英文：点按钮 → 报告生成 ✅
  - [ ] 韩文：点按钮 → 报告生成 ✅

- [ ] 三语支付流程测试
  - [ ] 中文：解锁 → $9.9 Stripe ✅
  - [ ] 英文：解锁 → $9.9 Stripe ✅
  - [ ] 韩文：解锁 → ₩9,900 Kakao ✅

---

## Phase 1.3：测试 & 优化 (W3)

### QA 测试清单（30+ 场景）
见 PRD 第 4.2 节 **测试矩阵**，逐条执行：
- [ ] 有效生日输入 ✅
- [ ] 无效日期报错 ✅
- [ ] 性别未选禁用按钮 ✅
- [ ] 加载态转圈 ✅
- [ ] 超时提示 (>60s) ✅
- [ ] 三语文本无漏翻 ✅
- [ ] 三屏响应式 (320/375/480) ✅
- [ ] 按钮 ≥44px ✅
- [ ] 对比度 ≥4.5:1 ✅
- [ ] 付费墙锁定显示 ✅
- [ ] 支付成功回流 ✅
- [ ] 弱网模拟 ✅
- [ ] iOS notch 不遮挡 ✅
- [ ] Android nav bar 不遮挡 ✅
- ... (30+ 总共)

### 性能优化
- [ ] Lighthouse 测试（目标 >90）
  ```bash
  npm run lighthouse -- https://staging.shenyuan.app/pages/bazi.html
  ```
  记录：LCP `____ms`, FID `____ms`, CLS `__._`

- [ ] 报告生成延迟 (backend profiling)
  ```bash
  # 后端日志中抓 elapsed time
  # 目标：<8s
  ```

- [ ] 字体加载优化（字段缩小 woff2）
  ```html
  <!-- 现在：加载 3 个字体 Noto Serif SC/EN/KR = ~200KB -->
  <!-- 改后：subsetting + woff2 压缩 = ~80KB -->
  ```

### 支付测试（Staging）
- [ ] Stripe Test Key 配置
  ```bash
  export STRIPE_SECRET_KEY=sk_test_...
  # Stripe Webhook 转发
  stripe listen --forward-to localhost:3021/webhook/stripe
  ```

- [ ] Mock 支付流程（Postman 调用 webhook）
  ```bash
  curl -X POST http://localhost:3021/webhook/stripe \
    -H "Content-Type: application/json" \
    -d '{"type": "checkout.session.completed", "data": {"object": {"id": "cs_test_...", "payment_status": "paid"}}}'
  # 验证：order 状态改为 completed
  ```

- [ ] KakaoPay Mock（如果有测试 key）
  ```bash
  # 类似 Stripe，测试支付成功回调
  ```

---

## Phase 1.4：部署准备 (W4-5)

### 部署脚本更新
- [ ] 更新 `deploy-phase1.sh`（见 PRD 第 5.2）
  ```bash
  #!/bin/bash
  # 生成 Prompt 文件
  cat > server/prompts/bazi-en.txt << 'EOF'
  ...
  EOF
  # 更新 API 路由
  # 执行 DB 迁移
  # PM2 重启
  ```

- [ ] 验证 PM2 配置（ecosystem.config.js）
  ```bash
  pm2 ecosystem
  # 验证配置是否正确
  ```

### 环境变量检查
- [ ] 生产环境变量清单（.env.production）
  ```
  NODE_ENV=production
  PORT=3021
  DATABASE_URL=...
  DEEPSEEK_API_KEY=...
  STRIPE_SECRET_KEY=sk_live_...
  STRIPE_WEBHOOK_SECRET=whsec_...
  KAKAO_API_KEY=... (韩国)
  SENTRY_DSN=...
  ```
  - [ ] 每个 key 都确认存在且有效
  - [ ] 没有测试 key 混入生产

### 监控告警设置
- [ ] Sentry 项目配置
  ```bash
  npm install @sentry/node
  # 在 server/index.js 初始化 Sentry
  Sentry.init({ dsn: process.env.SENTRY_DSN });
  ```

- [ ] PostHog 事件追踪（可选）
  ```javascript
  posthog.capture({
    distinctId: userId,
    event: 'bazi_report_generated',
    properties: { lang, wordsCount, duration }
  });
  ```

- [ ] Grafana 仪表板创建
  - 关键指标：API 延迟、错误率、支付成功率
  - 告警：5xx 错误 >5, timeout >10%

---

## Phase 1.5：Staging 验收 (W4)

### 端到端测试（Staging 环境）
- [ ] Staging 域名确认
  ```
  staging.shenyuan.app (或 staging.mylumee.cn)
  ```

- [ ] 三语完整流程测试（没有 mock，全真实）
  - [ ] CN：生日输入 → 中文报告 → 付费 → Stripe real flow
  - [ ] EN：生日输入 → 英文报告 → 付费 → Stripe real flow
  - [ ] KR：생일입력 → 한국어 리포트 → 결제 → KakaoPay test

- [ ] 支付成功确认
  - [ ] 后端 order 表状态 = completed
  - [ ] 前端显示 full report（大运/流年/运势）

### Beta 用户测试（50 人）
- [ ] 招募 50 人 beta 用户（各语言）
  - CN: 20 人
  - EN: 15 人
  - KR: 15 人

- [ ] 反馈收集（Typeform 或自研表单）
  ```
  1. 报告内容理解度 (1-5)
  2. 支付流程顺畅度 (1-5)
  3. 自由意见
  ```

- [ ] NPS 目标：≥7（推荐意愿）
  ```
  NPS = (%Promoters - %Detractors) / 100
  目标 ≥ 7 表示产品可接受
  ```

---

## Phase 1.6：生产部署 (W6-7)

### 灰度发布（10% → 50% → 100%）

**W6 周二：10% 灰度（中文主站）**
- [ ] 更新 server code
  ```bash
  cd /opt/shenyuan
  git pull origin main
  npm install
  npm run db:migrate:prod
  pm2 restart shenyuan --update-env
  ```

- [ ] 健康检查
  ```bash
  curl -f http://localhost:3021/health || exit 1
  # 监控 Sentry 5 分钟内的错误
  ```

- [ ] 金丝雀监控（看关键指标）
  - API 延迟 p99 <5s
  - 错误率 <1%
  - 支付成功率 >95%

- [ ] 持续 7 天无异常 ✅

**W6 周五：50% 灰度（中文 + 英文）**
- [ ] 重复上述步骤

**W7 周二：100% 全量（三语正式）**
- [ ] 重复上述步骤

### 上线公告
- [ ] 更新网站公告（landing page）
  ```
  🎉 三语报告升级完成！
  - 英文报告新增（西方占星对标解析）
  - 韩文报告支持支付（KakaoPay）
  - 所有语言新增付费墙，解锁大运/流年深度分析
  ```

- [ ] 邮件通知现有用户
  ```
  Subject: 你的八字报告升级了！
  Content: 点进查看新的深度分析
  ```

---

## 📊 验收签字单

**项目名**：Phase 1 三语报告页对齐  
**交付日期**：2026-09-27  
**负责人**：CTO / Tech Lead  

### 功能验收
- [ ] 三语 API 正常（cn/en/kr）
- [ ] 报告分级（basic/full）显示正确
- [ ] 付费墙工作（Stripe/Kakao）
- [ ] 支付成功回流

**签字**：Karen __________ 日期 ________

### 性能验收
- [ ] LCP <3s (Lighthouse)
- [ ] 报告生成 <8s
- [ ] 支付跳转 <200ms

**签字**：DevOps __________ 日期 ________

### 安全验收
- [ ] AIGC 标注完整
- [ ] 无医学索赔
- [ ] Webhook 验签
- [ ] 用户数据加密

**签字**：Security __________ 日期 ________

---

**最后一步**：打勾所有 ✅，关闭此文档，开始开发！

