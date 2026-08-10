# 善缘账户中心 — 入口链接配置

## 概述

这份文档说明如何在现有页面添加"个人中心"入口，以及多语言版本的部署方案。

---

## 📍 入口链接位置

### 1️⃣ 已有入口 (无需修改)
这些页面已在底部或菜单中添加了账户中心链接:
- ✅ `/pages/login.html` - 登录页已有链接到 account.html

### 2️⃣ 需要添加入口的页面

#### **bazi.html** (八字命理首页 - 中文)
**位置**: 导航菜单或顶部工具栏  
**操作**: 仅登录用户显示

```html
<!-- 在 bazi.html 的导航菜单中添加 -->
<a href="/pages/account.html" class="nav-link">👤 个人中心</a>

<!-- 或在用户头像处添加下拉菜单 -->
<div class="user-menu">
  <a href="/pages/account.html">我的账户</a>
  <a href="/pages/member.html">会员中心</a>
  <button onclick="logout()">登出</button>
</div>
```

#### **bazi-en.html** (八字命理首页 - 英文)
**位置**: 导航菜单  
**操作**: 保持一致

```html
<!-- 英文版本 -->
<a href="/pages/account-en.html" class="nav-link">👤 My Account</a>
```

#### **saju-landing-KR.html** (사주 着陆页 - 韩文)
**位置**: 导航菜单  
**操作**: 链接韩文版本

```html
<!-- 韩文版本 -->
<a href="/pages/account-kr.html" class="nav-link">👤 내 계정</a>
```

#### **member.html** (会员中心)
**位置**: 页面顶部或侧边栏  
**操作**: 添加返回账户中心的链接

```html
<!-- 会员中心导航 -->
<div class="breadcrumb">
  <a href="/pages/account.html">我的账户</a> > 
  <span>会员中心</span>
</div>
```

---

## 🌐 多语言版本部署方案

### 方案 A: 三个独立文件 (推荐)

```
/pages/
├─ account.html       (中文版) ✅ 已创建
├─ account-en.html    (英文版) 📋 需创建
└─ account-kr.html    (韩文版) 📋 需创建
```

**创建步骤**:
1. 复制 account.html 为 account-en.html
2. 使用查找替换翻译文案 (见翻译清单)
3. 复制 account.html 为 account-kr.html
4. 使用查找替换翻译文案 (见翻译清单)

### 方案 B: 单文件 + 客户端切换 (需 JS)

```html
<!-- account.html 中添加语言切换 -->
<script>
var LANG = new URLSearchParams(location.search).get('lang') || 'zh';
var TEXTS = {
  zh: { title: '我的账户', reports: '报告历史', ... },
  en: { title: 'My Account', reports: 'Reports', ... },
  kr: { title: '내 계정', reports: '보고서', ... }
};
document.title = TEXTS[LANG].title;
// ... 动态替换文案
</script>
```

**推荐**: 方案 A 更简洁，避免 JS 复杂度

---

## 🎯 翻译清单

### 核心文案

| 中文 | English | 한국어 |
|------|---------|--------|
| 我的账户 | My Account | 내 계정 |
| 报告历史 | Reports | 보고서 |
| 邀请管理 | Referrals | 초대 관리 |
| 订阅管理 | Subscription | 구독 관리 |
| 账户设置 | Settings | 계정 설정 |
| 基本信息 | Basic Info | 기본 정보 |
| 隐私设置 | Privacy | 개인정보 보호 |
| 账户安全 | Security | 계정 보안 |

### 操作按钮

| 中文 | English | 한국어 |
|------|---------|--------|
| 查看 | View | 보기 |
| 复制 | Copy | 복사 |
| 下载 | Download | 다운로드 |
| 续费 | Renew | 갱신 |
| 升级 | Upgrade | 업그레이드 |
| 保存设置 | Save | 저장 |
| 登出 | Logout | 로그아웃 |
| 返回 | Back | 돌아가기 |

### 统计标签

| 中文 | English | 한국어 |
|------|---------|--------|
| 已邀请 | Invited | 초대된 수 |
| 已转化 | Converted | 전환된 수 |
| 转化率 | Conversion Rate | 전환율 |
| 当前等级 | Current Tier | 현재 레벨 |
| 预期收益 | Expected Bonus | 예상 수익 |
| 有效期至 | Expires At | 만료일 |
| 剩余天数 | Days Left | 남은 날 |

---

## 🔗 导航逻辑

### 自动语言检测 (可选)

```javascript
// 根据浏览器语言自动重定向
function detectLanguage() {
  const userLang = navigator.language.split('-')[0];
  let accountPage = '/pages/account.html'; // 默认中文

  if (userLang === 'en') {
    accountPage = '/pages/account-en.html';
  } else if (userLang === 'ko') {
    accountPage = '/pages/account-kr.html';
  }

  return accountPage;
}

// 在登录成功后调用
if (isLoggedIn) {
  window.location.href = detectLanguage();
}
```

### 显式语言选择链接

```html
<!-- 页面底部或设置中添加 -->
<div class="language-selector">
  <a href="/pages/account.html">中文</a>
  <a href="/pages/account-en.html">English</a>
  <a href="/pages/account-kr.html">한국어</a>
</div>
```

---

## 📱 现有页面的导航链接

### bazi.html (中文八字首页)
**添加位置**: 顶部导航菜单

```html
<!-- 示例: 在现有菜单中添加 -->
<nav class="header-nav">
  <a href="/pages/bazi.html">八字</a>
  <a href="/pages/daily.html">每日</a>
  <a href="/pages/fengshui.html">风水</a>
  <!-- ★ 新增: 个人中心 -->
  <a href="/pages/account.html" id="accountLink" style="display:none">👤 个人中心</a>
</nav>

<script>
  // 仅登录用户显示
  if (localStorage.getItem('sy_token')) {
    document.getElementById('accountLink').style.display = 'inline-block';
  }
</script>
```

### member.html (会员页)
**添加位置**: 页面顶部导航或面包屑

```html
<!-- 在 member.html 顶部添加返回链接 -->
<div class="member-header">
  <a href="/pages/account.html" class="back-link">‹ 返回账户中心</a>
  <h1>会员中心</h1>
</div>
```

### 登录/注册流程
**添加位置**: 登录成功后

```javascript
// login.html 登录成功回调
fetch('/api/auth/login', { ... })
  .then(r => r.json())
  .then(data => {
    localStorage.setItem('sy_token', data.token);
    // ★ 重定向到账户中心
    window.location.href = '/pages/account.html';
  });
```

---

## 🎨 样式集成建议

### 导航菜单样式
```css
.nav-link {
  display: inline-block;
  padding: 10px 16px;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 13px;
  text-decoration: none;
  color: #8b1a1a;
  transition: all 0.2s;
}

.nav-link:hover {
  background: #f9eaea;
  border-radius: 4px;
}
```

### 用户菜单下拉
```css
.user-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background: white;
  border: 1px solid #e8dcc8;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  overflow: hidden;
  z-index: 1000;
}

.user-menu a {
  display: block;
  padding: 12px 16px;
  text-decoration: none;
  color: #1a1208;
  border-bottom: 1px solid #e8dcc8;
  transition: background 0.2s;
}

.user-menu a:last-child {
  border-bottom: none;
}

.user-menu a:hover {
  background: #faf6ee;
}
```

---

## 🚀 部署检查清单

### 前端部署
- [ ] account.html 部署到 /pages/
- [ ] account-en.html 创建并部署
- [ ] account-kr.html 创建并部署
- [ ] CSS/JS 资源加载正确 (无 404)
- [ ] 响应式测试 (390px/768px/1024px)

### 导航链接
- [ ] bazi.html 添加账户中心入口
- [ ] bazi-en.html 添加入口
- [ ] saju-landing-KR.html 添加入口
- [ ] member.html 添加返回账户中心链接
- [ ] 登录页重定向正确

### 功能测试
- [ ] 未登录隐藏账户中心链接
- [ ] 登录后显示账户中心链接
- [ ] 点击链接正确跳转 account.html
- [ ] 语言切换链接工作正常
- [ ] 返回链接不产生死循环

---

## 🔒 权限控制

### 仅登录用户可访问

```javascript
// account.html 顶部加入权限检查
(function() {
  const token = localStorage.getItem('sy_token');
  if (!token) {
    // 未登录 - 重定向到登录页
    window.location.href = '/pages/login.html?redirect=/pages/account.html';
    return;
  }
  // 已登录 - 继续加载
})();
```

### 导航菜单条件显示

```html
<!-- 仅登录用户显示的链接 -->
<a href="/pages/account.html" id="accountLink" style="display:none">
  👤 个人中心
</a>

<script>
  document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('sy_token');
    if (token) {
      document.getElementById('accountLink').style.display = 'inline-block';
    }
  });
</script>
```

---

## 📊 分析建议

### 追踪入口

```javascript
// 记录用户访问账户中心的来源
function trackAccountCenterEntry(source) {
  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'account_center_entry',
      source: source,  // 'nav', 'member', 'login', etc.
      timestamp: new Date().toISOString()
    })
  });
}

// 在导航链接点击时调用
document.getElementById('accountLink').addEventListener('click', () => {
  trackAccountCenterEntry('nav');
});
```

### 事件埋点

```javascript
// 在 account.html 中埋点关键操作
function trackEvent(event, tab) {
  if (window.ga) {
    ga('send', 'event', 'Account Center', event, tab);
  }
}

// Tab 切换时
function switchTab(tabName) {
  trackEvent('tab_switch', tabName);
  // ... 切换逻辑 ...
}

// 邀请码复制时
function copyRefCode(code) {
  trackEvent('copy_ref_code', code);
  // ... 复制逻辑 ...
}
```

---

## 🌍 SEO 配置

### Meta 标签
```html
<!-- account-en.html 中 -->
<meta name="description" 
      content="ShenYuan account center - manage reports, referrals, and subscription">
<meta property="og:title" content="My Account - ShenYuan">
<meta property="og:url" content="https://shenyuan.mylumee.cn/pages/account-en.html">
```

### robots 配置
```
# account.html 应该可被 Google 索引吗? 
# 通常: 否 (私人账户页面)

# robots.txt 中添加
User-agent: *
Disallow: /pages/account*.html
```

---

## 🎯 最终检查清单

- [ ] 三个语言版本的 account.html 已创建
- [ ] 入口链接已添加到 bazi/member/landing 页
- [ ] 权限控制已配置 (未登录重定向)
- [ ] 导航菜单样式已调整
- [ ] 多语言自动检测已实现 (可选)
- [ ] 分析埋点已配置
- [ ] SEO meta 标签已添加
- [ ] 所有链接已测试 (无死链)

---

## 📞 示例代码

### 完整的导航集成示例

```html
<!-- 在 bazi.html 中的导航栏模板 -->
<nav class="header-nav">
  <a href="/index.html" class="nav-logo">善缘</a>
  <div class="nav-links">
    <a href="/pages/bazi.html" class="nav-item">八字</a>
    <a href="/pages/daily.html" class="nav-item">每日</a>
    <a href="/pages/member.html" class="nav-item">会员</a>
  </div>
  
  <!-- 用户菜单 -->
  <div id="userMenuContainer" style="display:none">
    <button class="user-avatar" onclick="toggleUserMenu()">👤</button>
    <div class="user-menu" id="userMenu">
      <a href="/pages/account.html">我的账户</a>
      <a href="/pages/member.html">会员中心</a>
      <hr>
      <button onclick="handleLogout()">登出</button>
    </div>
  </div>
</nav>

<script>
  // 初始化用户菜单
  document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('sy_token');
    const container = document.getElementById('userMenuContainer');
    
    if (token) {
      container.style.display = 'block';
    } else {
      container.style.display = 'none';
    }
  });

  function toggleUserMenu() {
    const menu = document.getElementById('userMenu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  }

  function handleLogout() {
    localStorage.removeItem('sy_token');
    window.location.href = '/pages/login.html';
  }
</script>
```

---

**完成以上配置后，用户就能从各处便捷地访问个人中心了!** ✨
