# 排行榜页面测试指南 | Test Guide

## 🧪 快速测试清单

### 视觉检查 (2分钟)
```
□ 中文版 leaderboard.html 打开无错误
□ 英文版 leaderboard-en.html 打开无错误
□ Top1/2/3 排名数字为金色系(#c9a84c) ✅
□ 浅色模式: 文字对比度清晰 ✅
□ 深色模式(系统设置): 金色→浅金(#e8d08a) ✅
```

### 响应式测试 (需要Chrome DevTools)
```
□ 桌面版 (1920px): 正常布局
□ iPad (768px): 表格正常
□ iPhone 12 (390px): 列宽压缩正常
□ iPhone 6s (375px): 超小屏适配 ✅
  - 表格列宽: 55px (最小)
  - 按钮: 44px 高度保留
  - 字体: 11px (表格), 16px (标题)
□ Android 360px: 可正常使用
```

### 功能测试

#### A. 邀请码复制 (复制粘贴)
```
1. 点击 "TikTok" 邀请码框
2. 验证:
   □ Toast提示 "已复制到剪贴板 ✓"
   □ 框背景变化(copied状态)
   □ 2秒后复原
3. 在别处粘贴 (Ctrl+V) → 邀请码正确
```

#### B. 分享卡生成 & 下载
```
1. 确保已登录 (有邀请码数据)
2. 点击 "生成分享卡" 按钮
3. 验证:
   □ Canvas卡片显示 ✓
   □ 卡片内文字清晰(375px以上)
   □ 等级、邀请数正确显示
4. 点击 "下载卡片 PNG"
5. 验证:
   □ 图片下载到 Downloads/
   □ 文件名: shenyuan-share-2026-08-11.png
   □ 图片清晰(不模糊)
6. 点击 "关闭" → 卡片隐藏
7. 再点 ESC 键 → 尝试关闭 (键盘导航)
```

#### C. 分享链接 (原生Share API)
```
1. 点击 "分享链接" 按钮
2. 验证:
   a) iOS/Android 系统:
      □ 弹出原生分享菜单 (WhatsApp/WeChat/etc)
      □ 标题: "善缘 · 邀请排行榜" ✓
   b) 桌面浏览器 (无Share API):
      □ Toast: "链接已复制 ✓"
      □ 粘贴验证链接正确
```

#### C. 排行榜加载 & 刷新
```
1. 打开页面
2. 等待排行榜加载 (应 <1.2s)
3. 验证:
   □ 加载动画: "加载排行榜中..." → 消失
   □ Top10 正确显示
   □ 金色数字颜色一致
4. 等待10秒 (自动刷新)
   □ 排行榜数据刷新 (如有变化)
   □ 页面不卡顿, 保持60fps
5. 点击语言切换 "EN" ↔ "中文"
   □ 正确跳转到英文版
   □ 数据重新加载
```

### 网络容错测试 (需代理工具)

#### 超时重试
```
1. Chrome DevTools → Network → Throttle
2. 选择 "Slow 3G" (30Kbps)
3. 刷新页面
4. 验证:
   □ 请求超时 (8s内)
   □ 自动重试 2 次
   □ 最后显示错误提示 (正常)
   □ 不会卡死页面
```

#### 401 过期Token
```
1. localStorage.removeItem('auth_token')
2. 刷新页面
3. 验证:
   □ "会话已过期，请重新登录" 消息
   □ 包含链接: <a href="/pages/bazi.html">重新登录</a>
   □ 排行榜仍可加载 (不依赖token)
```

#### CORS错误 (模拟)
```
1. Chrome DevTools → Console
2. 执行: fetchWithRetry('https://invalid-domain.com')
3. 验证:
   □ 控制台无崩溃错误
   □ Toast: "排行榜加载失败，请稍后重试"
   □ 页面仍可交互
```

### 无障碍测试

#### 屏幕阅读器 (VoiceOver/NVDA)
```
• macOS: CMD + F5 启用 VoiceOver
• Windows: NVDA (https://www.nvaccess.org/)

验证项:
□ 排名数字有 aria-label: "第 1 名"
□ 表格 role="list" 被读出
□ 按钮焦点清晰可见 (outline)
□ Tab 键可逐个导航按钮
```

#### 键盘导航
```
1. 不使用鼠标, 仅 Tab 键导航
2. 验证:
   □ Back 按钮可 focus
   □ Lang toggle 可 focus
   □ 所有按钮都可 focus (蓝色 outline)
   □ 复制按钮可用 Enter 激活
3. 生成卡片后, 按 ESC 关闭 ✓
```

#### 对比度检查 (Lighthouse)
```
1. Chrome DevTools → Lighthouse
2. 勾选 "Accessibility"
3. Run audit
4. 验证:
   □ 得分 ≥ 95/100
   □ "Color contrast issues": 无
   □ "Missing alt text": 无
```

### 性能测试 (Lighthouse)

#### 核心指标
```
1. Chrome DevTools → Lighthouse
2. 勾选: Performance, Accessibility, Best Practices, SEO
3. Run audit (Mobile)
4. 验证:
   □ Performance: ≥ 90
   □ Accessibility: ≥ 95
   □ Best Practices: ≥ 90
   □ SEO: ≥ 90

指标明细:
   □ First Contentful Paint (FCP): < 1.0s
   □ Largest Contentful Paint (LCP): < 1.5s
   □ Time to Interactive (TTI): < 1.8s
   □ Cumulative Layout Shift (CLS): < 0.05
```

#### 内存泄漏检查
```
1. Chrome DevTools → Memory
2. 选 "Heap snapshots"
3. Take snapshot (初始)
4. 点击 5 次 "刷新排行榜"
5. Take snapshot (刷新后)
6. 对比:
   □ JS Heap 内存未持续增长 (正常 ±2MB)
   □ 事件监听器未重复绑定
```

### 跨浏览器测试

| 浏览器 | 版本 | 状态 | 备注 |
|--------|------|------|------|
| Chrome | 90+ | ✅ | 完全支持 |
| Safari | 14+ | ✅ | iOS WebKit |
| Firefox | 88+ | ✅ | 支持 |
| WeChat | 任意 | ✅ | iOS/Android内置浏览器 |
| Edge | 90+ | ✅ | Chromium内核 |

---

## 🔍 常见问题排查

### Canvas 不清晰
```
症状: 分享卡文字模糊
排查:
1. 检查设备像素比 (window.devicePixelRatio)
2. 验证 canvas 宽高 (600×800)
3. 确认 image-rendering: -webkit-optimize-contrast;
解决: 刷新页面重试
```

### 复制不工作
```
症状: 点击邀请码无反应
排查:
1. 检查 navigator.clipboard 支持 (HTTPS环境)
2. 查看 Console 是否有权限错误
3. 尝试 fallbackCopy() (textarea复制)
解决: 升级到最新浏览器版本
```

### 排行榜加载超时
```
症状: "排行榜加载超时" Toast持续显示
排查:
1. 检查网络连接 (WiFi/LTE)
2. 检查后端服务是否在线
3. 查看浏览器控制台 Network 标签
解决: 刷新页面 (自动重试 2 次)
```

### 暗模式没开启
```
症状: 深色背景不显示
排查:
1. 检查系统设置: 浅色 ↔ 深色
   - macOS: System Preferences → General → Appearance
   - iOS: Settings → Display & Brightness → Dark
   - Windows: Settings → Colors → Dark
2. 刷新浏览器标签页
验证: DevTools → Console 执行:
   getComputedStyle(document.documentElement)
     .getPropertyValue('--bg')
```

---

## 📊 测试结果表格

```
日期: ________
测试人: ________

视觉检查:         □ 通过  □ 失败
响应式 (375px):   □ 通过  □ 失败
邀请码复制:       □ 通过  □ 失败
分享卡生成:       □ 通过  □ 失败
排行榜加载:       □ 通过  □ 失败
网络容错:         □ 通过  □ 失败
无障碍 (WCAG AA): □ 通过  □ 失败
性能 (Lighthouse):□ 通过  □ 失败
暗模式:           □ 通过  □ 失败
国际化:           □ 通过  □ 失败

综合评分: ___ / 10

备注:
_________________________________________
_________________________________________
```

---

## ✅ 上线前最后检查 (Pre-launch)

- [ ] 所有测试项通过
- [ ] 后端 API 文档已同步
- [ ] CORS 配置已设置
- [ ] 域名 DNS 已指向生产服务器
- [ ] SSL 证书有效 (HTTPS)
- [ ] 监控告警已配置 (Sentry/UptimeRobot)
- [ ] 回滚方案已准备
- [ ] 用户文档已更新

---

**测试指南版本**: 1.0  
**最后更新**: 2026-08-11
