# 善缘全页面质量标准模板 (Quality Checklist)

**用途**：每个新页面/修改页面必须满足这个checklist才能上线  
**维护者**：CEO Claude  
**最后更新**：2026-07-23 21:30  

---

## 🎯 通用质量标准（ALL Pages）

### 视觉设计（Design）
- [ ] **色彩**：仅使用CSS变量 (--jade, --gold, --ink等) ，无硬编码hex
- [ ] **排版**：字体使用 Noto Serif SC / Cormorant Garamond，字体大小层级清晰
  - h1: 24px, h2: 18px, body: 14px, label: 12px, caption: 10px
- [ ] **间距**：所有 padding/margin 遵循 8px 基数（8/12/16/20/24/28等）
- [ ] **border-radius**：大元素 10px，中元素 8px，小元素 6px/4px
- [ ] **阴影**：突出用 0 4px 20px rgba(...,0.2)，分组用 0 1px 3px rgba(...,0.1)

### 交互（Interaction）
- [ ] **CTA 按钮**：有清晰的 hover 状态（色深 +10% 或向上偏移 -1px）
- [ ] **active 状态**：所有可点击元素都有 active/pressed 反馈
- [ ] **focus 状态**：所有表单元素都有 focus-visible 样式（不是 outline: none）
- [ ] **Loading**：所有异步操作都有 loading UI（最少 2.5s）
- [ ] **错误处理**：错误具体友好（"请选择年份" 不是 "Error"）
- [ ] **成功反馈**：成功操作有明确的 animation/color 反馈，不是无声的

### 文案（Microcopy）
- [ ] **CTA 标签明确**："推算合婚 →" 不是 "继续"
- [ ] **没有 happy talk**：删除"欢迎来到善缘"、"为了更好地为您服务"等套话
- [ ] **具体性**：所有建议/说明都包含 WHO/WHAT/WHEN/WHERE（谁做/做什么/何时/何处）
- [ ] **麦玲玲风格**：先说问题，再说解决方案（不是只有好话）
- [ ] **温度度**：用户感受到"有人在为我指引"而非"机器在赚我钱"

### 响应式（Responsive）
- [ ] **375px**(mobile)：所有元素可见可用，无水平滚动
- [ ] **768px**(tablet)：布局从竖变横（grid-template-columns变化）
- [ ] **1024px**(desktop)：全宽度合理，不超过 390px 的 mobile-first 视图就直接用桌面布局
- [ ] **font-size**：body 文本永远 >= 16px（mobile上）
- [ ] **touch target**：所有可点击元素 >= 44px（移动设备标准）

### 性能（Performance）
- [ ] **图片**：设置 width/height，使用 loading="lazy"
- [ ] **字体**：font-display: swap（不阻塞渲染）
- [ ] **CSS**：没有 @import（用 <link> 预连接）
- [ ] **JS**：没有 document.write（异步加载）
- [ ] **动画**：只用 transform 和 opacity（不用 width/height/top/left）

### 可访问性（A11y）
- [ ] **对比度**：body 文本 >= 4.5:1，大文本 >= 3:1（WCAG AA）
- [ ] **键盘导航**：Tab 可以访问所有交互元素
- [ ] **alt 文本**：所有图片都有 alt（即使是空字符串 ""）
- [ ] **label**：所有表单输入都有清晰的 label（不是 placeholder-only）
- [ ] **ARIA**：主要地标有 role（main, nav, aside等）或semantic HTML5

### 安全（Security）
- [ ] **CORS**：跨域请求都走 CORS header
- [ ] **无硬编码密钥**：所有 API key/password 都用环境变量
- [ ] **AIGC 标识**：AI 生成的内容都有标识（"🤖 AI 分析"）
- [ ] **XSS 防护**：用户输入都 escape（Vue/React 自动做）

---

## 📋 页面类型特定标准

### Type A: 计算/分析型（hehun/qiuzi/bazi等）

**额外需求**：
- [ ] 结果展示有 animation（分数环/进度条/卡片进入）
- [ ] 支持多个等级选择，各等级 CTA 清晰
- [ ] 故事/建议段落用**粗体**标记核心行动项
- [ ] 所有日期建议严格 <= 12 月
- [ ] 结果可分享（share.html 链接）
- [ ] 有"咨询大师"的后续 CTA

### Type B: 购物型（mingqi/shop等）

**额外需求**：
- [ ] 商品图清晰，至少 2 张（主图+细节图）
- [ ] 价格突出，无隐藏费用（运费在价格里）
- [ ] 数量选择器（不是固定"1"）
- [ ] 加购物车，展示成功反馈
- [ ] 库存状态显示（"剩余3件"/"预售"/"缺货"）

### Type C: 预约型（master/gongfeng等）

**额外需求**：
- [ ] 时间选择清晰（日期+时间段）
- [ ] 价格清晰，包含所有费用
- [ ] 确认页显示完整信息（谁/哪天/多少钱）
- [ ] 支付选项（Stripe/微信/支付宝 - 后续）
- [ ] 预约确认邮件 CTA

### Type D: 内容型（jinian/gongfeng/share等）

**额外需求**：
- [ ] 故事/内容核心内容清晰（不用翻页理解）
- [ ] 情感共鸣强（用户感受到温暖/尊重）
- [ ] 没有"我们做得多好"的自吹自擂
- [ ] 有具体的行动建议（"现在就点燃一盏灯"，不是"了解更多"）
- [ ] 分享按钮（各平台）

---

## ❌ AI Slop 黑名单（Forbidden）

这些都是 AI 生成的明显标志，**绝对禁止**：

1. 💜 紫色/蓝紫渐层背景
2. 🎨 icon-in-circle 式的"3列功能卡"阵列
3. 📌 彩色左边框卡片（border-left: 3px solid #color）
4. 🎯 centered everything（所有标题/描述都 text-align: center）
5. 🔄 均匀的大 border-radius（每个元素都 border-radius: 20px）
6. 🌊 装饰性 blob/wavy dividers
7. 🚀 emoji 作设计元素（"🚀解锁功能"这样的）
8. 📝 generic hero copy（"Unlock the power of..."、"Welcome to..."）
9. 🔁 cookie-cutter section 节奏（每个 section 高度都一样，都有 icon+title+desc）
10. 🔤 默认字体栈（system-ui 或 -apple-system 作 primary 字体）

---

## ✅ AI Slop 检测通过示例

```html
<!-- ❌ 不好（AI slop）-->
<div class="section purple-gradient">
  <div class="grid-3">
    <div class="feature-card">
      <div class="icon-circle">🚀</div>
      <h3>快速</h3>
      <p>秒级响应</p>
    </div>
    <!-- ... repeated x3 -->
  </div>
</div>

<!-- ✅ 好（有设计观点）-->
<div class="story-section">
  <h2>你们有着稳固的缘分基础</h2>
  <p class="lead">命格相合，感情频率接近</p>
  <blockquote>
    <strong>行动建议：</strong>在8月选吉日举办仪式。
  </blockquote>
</div>
```

---

## 🔍 自检清单（Before Commit）

每次 commit 前，跑这个 mental checklist：

```
[ ] 打开页面，没有 console error
[ ] 点击所有 button/link，都有反馈
[ ] 表单填完，提交有 loading 效果
[ ] 结果展示，字体/颜色/间距整洁
[ ] 手机翻译看 375px 样子，没有水平滚动
[ ] 文案读一遍，删除所有"欢迎"、"感谢"之类的套话
[ ] 按钮标签明确（不是"继续"、"提交"）
[ ] 没有硬编码 color: #xxx（都是 var(--)）
[ ] 动画只用 transform/opacity
[ ] 所有日期/月份逻辑没有 > 12 的情况
```

---

## 📊 质量打分标准

| 等级 | 标准 | 示例 |
|------|------|------|
| ⭐⭐⭐ (10分) | 每一个细节都精心设计，用户感受到专业 | hehun.html v2.0 ✅ |
| ⭐⭐ (7-8分) | 功能完整，视觉清晰，有几个小遗漏 | 大多数页面目前 |
| ⭐ (5-6分) | 功能能用，但视觉/文案有明显缺陷 | — |
| — (<5分) | 有 bug 或用户体验明显差 | ❌ 不能上线 |

**上线标准**：>= 7 分（ ⭐⭐）

---

## 🚀 如何使用这个模板

1. **新页面开发**：先读这个 checklist，明确目标
2. **代码审查**：用这个 checklist 检查别人（或自己）的代码
3. **上线前检查**：跑一遍自检清单，确保没有遗漏

---

## 历史变更

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2026-07-23 | 初版，基于 hehun 10分标准 |

---

**维护者**：CEO Claude | **适用项目**：善缘 ShenYuan  
*如果你发现新的质量问题，请立即更新这个文件*
