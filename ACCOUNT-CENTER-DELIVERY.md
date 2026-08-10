# 善缘个人中心 (Account Center) — 交付清单

**日期**: 2026-08-10  
**版本**: v1.0  
**状态**: Ready for Backend Integration

---

## 📦 交付物清单

### ✅ 前端完成
- [x] **pages/account.html** - 完整的个人中心页面 (3800+ 行)
  - 5 个功能模块 (Tab 式导航)
  - 响应式设计 (390px-1920px)
  - 多语言预留 (中文/英文/韩文)
  - 暖色系 UI (符合品牌规范)

### ✅ 文档完成
- [x] **docs/account-page-api-integration.md** - API 完整集成指南
- [x] **docs/account-backend-implementation.md** - 后端详细实现步骤
- [x] **server/routes/referral-enhancements.js** - 邀请管理补充实现参考

---

## 🎯 功能模块详解

### 1️⃣ 报告历史 (P0) ✅
**状态**: 前端完成，API 已有

```
UI: 报告卡片列表
├─ 产品名称 + 图标
├─ 购买日期 + 有期期
├─ [查看] [下载] 按钮
└─ 空状态: "暂无报告" + CTA 购买

API: GET /api/orders/mine
- 过滤逻辑: payment_status='completed' + 产品名含"报告"
- 前端做图标映射 (八字→命, 合婚→合, etc.)
```

**集成状态**: 
- ✓ 前端已调用 /api/orders/mine
- ✓ 后端已存在该端点

### 2️⃣ 邀请管理 (P0) ⚠️
**状态**: 前端完成，后端需补充

```
UI 结构:
├─ 【邀请码展示】5 渠道邀请码 (TikTok/小红书/YouTube/微信/自然流量)
│  ├─ 每个渠道显示邀请码 + [复制] 按钮
│  └─ 显示该渠道的使用人数
├─ 【邀请成果统计】
│  ├─ 已邀请数 | 已转化数 | 转化率 | 预期收益
│  └─ 当前等级 + 距离下一等级
└─ 【邀请详情表】分页展示邀请者
   └─ 日期 | 用户 | 渠道 | 状态 | 奖励

API: GET /api/referral/mine
- ✅ 已有: ref_codes, channel_urls, invited_count
- ❌ 缺失: converted_count, total_bonus, invitees[], invitees_by_channel
```

**后端 TODO**:
1. 在 routes/referral.js 的 GET /mine 补充 4 个字段
2. 详见: docs/account-backend-implementation.md §1

### 3️⃣ 订阅管理 (P0) ⚠️
**状态**: 前端完成，后端需微调

```
UI 结构:
├─ 【订阅状态卡】
│  ├─ 当前套餐等级 + 价格 (Premium/Yearly/Basic)
│  ├─ 有效期至 + 剩余天数 + 活跃徽章
│  └─ [立即续费] [升级到年卡]
└─ 【订阅历史表】显示过去订阅记录

API: GET /api/auth/me
- ✅ 已有: isMember, expiresAt
- ❌ 缺失: tier, price (套餐名称和价格)
```

**后端 TODO**:
1. 在 routes/auth.js 的 GET /me 补充 tier + price 字段
2. 根据 product_id 判断套餐类型
3. 详见: docs/account-backend-implementation.md §3

### 4️⃣ 账户设置 (P1) ✅
**状态**: 前端完成，部分 API 需新增

```
UI 结构:
├─ 【基本信息】
│  ├─ 昵称 (可编辑)
│  ├─ 邮箱 (只读)
│  ├─ 生日 (日期选择)
│  └─ 性别 (单选: 男/女/不透露)
├─ 【隐私设置】
│  ├─ [ ] 显示在排行榜上
│  ├─ [ ] 允许邮件通知
│  └─ [ ] 允许营销邮件
├─ 【账户安全】
│  ├─ 修改密码
│  ├─ 登出当前设备
│  └─ 登出所有设备
└─ [保存设置]

API: 
- GET /api/auth/me (获取现有字段)
- POST /api/user/profile (新增)
```

**后端 TODO**:
1. 新增 POST /api/user/profile 端点
2. 在 users 表补充字段: birthday, gender
3. 详见: docs/account-backend-implementation.md §2

### 5️⃣ 分享卡片 (P1) 📋
**状态**: UI 框架完成，功能待实现

```
UI 结构:
├─ Canvas 邀请卡预览 (生成中...)
├─ 卡片内容:
│  ├─ 头像 + 昵称
│  ├─ 已邀请数 + 当前等级
│  └─ "立即加入善缘，邀请朋友赚奖励"
└─ [下载 PNG] [分享微信/微博]
```

**实现方案**:
```javascript
// 使用 html2canvas 库生成图片
const canvas = await html2canvas(previewEl);
const link = document.createElement('a');
link.href = canvas.toDataURL();
link.download = 'shenyuan-referral-card.png';
link.click();
```

**TODO**: 
- [ ] 安装 html2canvas (npm install html2canvas)
- [ ] 实现 Canvas 绘制逻辑
- [ ] 测试各设备上的样式

---

## 🔌 API 端点完整清单

### 现有端点 (无需改动)
```
✅ GET  /api/auth/me
✅ GET  /api/orders/mine
✅ GET  /api/referral/mine (基础)
✅ POST /api/auth/register
✅ POST /api/auth/login
✅ POST /api/referral/claim
```

### 需补充的端点
```
⚠️  GET  /api/referral/mine (补充 4 字段)
❌ POST /api/user/profile (新增)
❌ GET  /api/auth/me (补充 2 字段)
```

### 可选端点 (Future)
```
📋 POST /api/user/logout
📋 POST /api/user/change-password
📋 GET  /api/user/avatar (头像上传)
📋 GET  /api/subscription/history (订阅历史详情)
```

---

## 📊 数据字段映射

### users 表需补充
```javascript
{
  id: number,
  email: string,
  name: string,
  birthday: string,    // ★ NEW
  gender: string,      // ★ NEW (M/F/N)
  ref_code: string,
  ref_codes: object,
  created_at: ISO8601
}
```

### referrals 表需确保
```javascript
{
  id: number,
  inviter_id: number,
  invitee_id: number,
  channel: string,        // ✓ MUST
  created_at: ISO8601,    // ✓ MUST
  invitee_email: string,  // ? 可选
  bonus: number           // ? 可选
}
```

---

## 🎨 设计规范

### 色彩系统
```css
--red: #8b1a1a          /* 主品牌色 */
--gold: #c9a84c         /* 辅助金色 */
--ink: #1a1208          /* 深灰文本 */
--cream: #faf6ee        /* 奶油背景 */
--jade: #5bbfa0         /* 成功绿 */
```

### 响应式断点
```css
390px   /* 移动端默认 (iPhone SE) */
768px   /* 平板 */
1024px  /* 桌面 */
```

### 字体
```css
Serif: 'Noto Serif SC'
Sans:  'Noto Sans SC'
Mono:  'Courier New'
```

---

## ✋ 后端集成步骤

### Step 1: 补充字段定义 (1 小时)
在 `server/lib/store.js` 补充 users/referrals 数据结构

```javascript
// 初始化新用户时补充
const ref_codes = genRefCodesForUser(); // 5 渠道邀请码
_M.users.push({
  id, email, password_hash,
  name: '',           // ✓ 已有
  birthday: '',       // ★ NEW
  gender: 'N',        // ★ NEW
  ref_codes,
  created_at
});
```

### Step 2: 实现 API 端点 (2-3 小时)
参考 docs/account-backend-implementation.md

- [ ] 补充 GET /api/referral/mine (§1)
- [ ] 新增 POST /api/user/profile (§2)
- [ ] 增强 GET /api/auth/me (§3)
- [ ] 添加单元测试

### Step 3: 数据迁移 (30 分钟)
为现有用户补充默认值

```javascript
_M.users.forEach(u => {
  if (!u.birthday) u.birthday = '';
  if (!u.gender) u.gender = 'N';
});
_persist();
```

### Step 4: 部署测试 (1 小时)
- 测试所有新 API 端点
- 检查 CORS 配置
- 验证前后端数据格式一致

### Step 5: 前端集成 (1 小时)
- 部署 account.html 到 shenyuan 项目
- 测试各 tab 的数据加载
- 验证移动端、平板、桌面响应式

---

## 🧪 测试检查清单

### 功能测试
- [ ] 未登录用户重定向 login.html
- [ ] 已登录用户正确显示邮箱 + 昵称
- [ ] Tab 切换不卡顿
- [ ] 报告列表显示正确 (含图标、日期、过期提醒)
- [ ] 邀请码 5 个渠道全显示
- [ ] 邀请统计数字正确 (已邀请/已转化/转化率)
- [ ] 邀请表显示用户邮箱、渠道、状态、奖励
- [ ] 订阅卡显示正确的套餐等级和到期日期
- [ ] 设置表单能保存并重新加载显示
- [ ] 复制邀请码有成功提示
- [ ] 登出成功重定向

### 兼容性测试
- [ ] iOS Safari (iPhone 12/14)
- [ ] Android Chrome (Pixel 6)
- [ ] iPad (768px)
- [ ] 桌面 Chrome/Safari/Firefox

### 性能测试
- [ ] 首屏加载 < 2s
- [ ] Tab 切换 < 500ms
- [ ] 邀请表格虚拟滚动 (>100条记录)
- [ ] 图片/字体加载使用 CDN

### 安全测试
- [ ] XSS 防护 (用户输入转义)
- [ ] CSRF token 验证
- [ ] Token 过期处理
- [ ] 邀请码不暴露他人数据

---

## 📱 多语言支持 (待扩展)

当前实现: **中文** (account.html)

### 扩展方案
```
account.html       → 中文版 ✅
account-en.html    → 英文版 (复制 + 翻译)
account-kr.html    → 韩文版 (复制 + 翻译)
```

**关键文案翻译**:
| 中文 | English | 한국어 |
|------|---------|--------|
| 我的账户 | My Account | 내 계정 |
| 报告历史 | Reports | 보고서 |
| 邀请管理 | Referrals | 초대 관리 |
| 订阅管理 | Subscription | 구독 관리 |
| 账户设置 | Settings | 계정 설정 |
| 已邀请 | Invited | 초대됨 |
| 已转化 | Converted | 전환됨 |

---

## 🚀 上线前检查清单

部署前 **必须** 全绿:

- [ ] 所有后端 API 已实现 + 单元测试通过
- [ ] account.html 已部署到前端服务器
- [ ] CORS 已配置允许前端域名
- [ ] 前后端数据格式一致 (无字段不匹配)
- [ ] 邀请码逻辑验证 (ref_codes 5 渠道全部正确)
- [ ] 报告列表过滤逻辑正确 (仅显示已支付订单)
- [ ] 订阅状态显示准确 (含到期日期 + 剩余天数)
- [ ] 个人资料编辑功能正常
- [ ] 移动端响应式测试通过
- [ ] 错误处理完善 (404/500/timeout 都有友好提示)
- [ ] Sentry 错误日志已配置
- [ ] 生产环境监控已启用 (PostHog/GA)

---

## 📚 相关文档索引

| 文档 | 路径 | 说明 |
|------|------|------|
| API 集成指南 | docs/account-page-api-integration.md | 前后端接口详解 |
| 后端实现指南 | docs/account-backend-implementation.md | 后端代码详细步骤 |
| 参考实现 | server/routes/referral-enhancements.js | 邀请管理的补充实现 |
| 本交付清单 | ACCOUNT-CENTER-DELIVERY.md | 当前文档 |

---

## 📞 支持信息

### 前端开发
- 文件: `/pages/account.html`
- 框架: 原生 HTML/CSS/JS (无依赖)
- 测试: 在 Chrome DevTools 中调试

### 后端开发
- 路由: `/server/routes/auth.js`, `/server/routes/referral.js`
- 数据层: `/server/lib/store.js`
- 测试: Postman/curl 验证 API

### 部署
- 前端: Vercel (shenyuan.vercel.app) 或 Nginx
- 后端: HK 服务器 (47.242.80.65:3021)
- 监控: Sentry (错误跟踪)

### 问题反馈
- 遇到问题先查阅文档
- 文档不清楚则提交 Issue
- 需要调整需求则联系产品

---

## ⏱️ 预计工期

| 阶段 | 工时 | 负责人 |
|------|------|--------|
| 前端完成 | 16h | Karen / Frontend |
| 后端实现 | 4-6h | Backend Team |
| 测试验证 | 4-6h | QA Team |
| 上线部署 | 2h | DevOps |
| **总计** | **26-30h** | |

**关键路径**: 后端实现 → 前端集成 → QA 测试 → 生产部署

---

## ✅ 最终验收标准

### 功能完整性
- ✓ 5 个模块全部可用 (报告/邀请/订阅/设置/分享卡)
- ✓ 所有 API 端点响应正确
- ✓ 数据显示准确无误

### 用户体验
- ✓ 页面加载快速 (< 2s)
- ✓ 交互流畅 (无卡顿)
- ✓ 移动端完美适配
- ✓ 错误提示友好

### 代码质量
- ✓ 遵守编码规范
- ✓ 无 console 错误
- ✓ 有适当注释
- ✓ 支持浏览器兼容性

### 安全性
- ✓ 数据隐私保护 (不暴露他人邀请码)
- ✓ XSS/CSRF 防护
- ✓ 敏感操作需登录

---

**准备完毕，可以开始后端集成！** 🚀

问题? 查阅 `/docs/account-page-api-integration.md` 或 `/docs/account-backend-implementation.md`
