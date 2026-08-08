# 善缘 KPI 仪表板 集成清单

## ✅ 部署前必做清单

### 阶段1: 本地验证 (5分钟)

- [ ] **1.1 生成Mock数据**
  ```bash
  cd /Users/karen/projects/shenyuan
  node docs/kpi-dashboard-mock-data.js
  # 期望输出: ✓ Users: 500 records, ✓ Orders: 300 records
  ```

- [ ] **1.2 启动后端服务**
  ```bash
  cd /Users/karen/projects/shenyuan/server
  node index.js
  # 期望输出: ╔═══════════════════════════╗ 且 Port: 3021 ✓
  ```

- [ ] **1.3 验证KPI API**
  ```bash
  curl http://localhost:3021/api/kpi/metrics
  # 期望: 返回 JSON 对象，包含 metrics/charts/errors 字段
  ```

- [ ] **1.4 打开仪表板**
  ```
  http://localhost:3021/docs/kpi-dashboard.html
  ```
  - [ ] 仪表板加载成功（无错误）
  - [ ] 显示 "连接正常" 状态指示
  - [ ] 所有卡片都有数据
  - [ ] 图表正常渲染
  - [ ] 表格有数据

- [ ] **1.5 测试实时刷新**
  - [ ] 自动刷新每30秒工作
  - [ ] 手动点击「刷新数据」按钮有效
  - [ ] 无console错误

### 阶段2: 后端集成 (10分钟)

- [ ] **2.1 确认KPI路由已注册**
  ```bash
  grep -n "kpiRouter" /Users/karen/projects/shenyuan/server/index.js
  # 期望: 找到 'const kpiRouter = require' 和 'app.use('/api/kpi'
  ```

- [ ] **2.2 检查data.json权限**
  ```bash
  ls -la /Users/karen/projects/shenyuan/server/data.json
  # 期望: 文件存在且大小 > 1KB
  ```

- [ ] **2.3 验证CORS配置**
  编辑 `server/index.js` 第30-49行，确保包含前端URL：
  ```javascript
  var ALLOWED_ORIGINS = [
    'http://localhost:3021',      // ✓
    'http://localhost:3000',      // ✓
    'https://shenyuan.mylumee.cn', // ✓
    // 添加其他域名...
  ];
  ```

- [ ] **2.4 性能基准测试**
  ```bash
  # 测试API响应时间
  time curl http://localhost:3021/api/kpi/metrics > /dev/null
  # 期望: real < 200ms (包括网络延迟)
  ```

- [ ] **2.5 检查日志配置**
  ```bash
  tail -f /tmp/shenyuan.log 2>/dev/null || tail -f /var/log/shenyuan.log
  # 验证没有ERROR日志
  ```

### 阶段3: 前端验证 (5分钟)

- [ ] **3.1 浏览器兼容性测试**
  - [ ] Chrome 最新版
  - [ ] Safari 最新版
  - [ ] Firefox 最新版
  - [ ] Edge 最新版

- [ ] **3.2 移动端响应式测试**
  ```
  Chrome DevTools → Toggle Device Toolbar (Cmd+Shift+M)
  ```
  - [ ] iPhone 12 Pro (390px)
  - [ ] iPad (768px)
  - [ ] 桌面 (1920px+)

- [ ] **3.3 暗色主题验证** (已内置)
  - [ ] 文本可读性 > 4.5:1 对比度
  - [ ] 无高亮/刺眼的颜色

- [ ] **3.4 网络状态测试**
  开启 Chrome DevTools → Network → Slow 3G
  - [ ] 仪表板仍可加载
  - [ ] 有loading状态提示
  - [ ] 无崩溃/卡死

- [ ] **3.5 缓存机制测试**
  ```javascript
  // 在浏览器console执行
  localStorage.getItem('kpi_dashboard_data')
  // 期望: 返回JSON字符串，包含data和timestamp
  ```

### 阶段4: 生产部署 (15分钟)

#### 4.1 HK 服务器部署

- [ ] **4.1.1 SSH连接验证**
  ```bash
  ssh -i ~/.ssh/hk root@47.242.80.65
  # 期望: 连接成功
  ```

- [ ] **4.1.2 拉取最新代码**
  ```bash
  cd /root/projects/shenyuan
  git pull origin main
  # 期望: 包含 routes/kpi.js 和 docs/kpi-dashboard.html
  ```

- [ ] **4.1.3 验证依赖安装**
  ```bash
  cd /root/projects/shenyuan/server
  npm list express cors
  # 期望: express@4.x, cors@2.x 已安装
  ```

- [ ] **4.1.4 重启服务**
  ```bash
  pm2 restart shenyuan
  sleep 3
  pm2 logs shenyuan --lines 20
  # 期望: 无ERROR日志，显示 "KPI Dashboard initialized"
  ```

- [ ] **4.1.5 远程验证API**
  ```bash
  curl https://shenyuan.mylumee.cn/api/kpi/metrics
  # 期望: 返回有效JSON，无CORS错误
  ```

- [ ] **4.1.6 验证仪表板访问**
  ```
  https://shenyuan.mylumee.cn/docs/kpi-dashboard.html
  ```
  - [ ] 页面加载（无404）
  - [ ] 连接正常
  - [ ] 数据显示

#### 4.2 Vercel部署 (可选)

- [ ] **4.2.1 检查Vercel配置**
  ```bash
  ls -la /Users/karen/projects/shenyuan/vercel.json
  ```

- [ ] **4.2.2 验证环境变量**
  Vercel Dashboard → Settings → Environment Variables
  - [ ] REACT_APP_API_BASE = (生产后端地址)
  - [ ] NODE_ENV = production

- [ ] **4.2.3 部署**
  ```bash
  cd /Users/karen/projects/shenyuan
  vercel --prod
  ```

- [ ] **4.2.4 验证部署**
  ```
  https://shenyuan.vercel.app/docs/kpi-dashboard.html
  ```

### 阶段5: 监控告警 (5分钟)

- [ ] **5.1 Sentry集成验证**
  ```bash
  # 检查是否捕获错误
  grep -n "mon.captureException" /Users/karen/projects/shenyuan/server/routes/kpi.js
  ```

- [ ] **5.2 日志聚合**
  - [ ] 配置日志输出到文件或ELK
  - [ ] 每日API错误数 < 0.1%

- [ ] **5.3 性能监控**
  - [ ] 配置PostHog或Google Analytics
  - [ ] 追踪 "Dashboard Page View" 事件
  - [ ] 追踪 API 响应时间

- [ ] **5.4 告警规则**
  ```
  设置告警:
  - API返回错误率 > 1% → 飞书通知
  - 响应时间 > 2s → 飞书通知  
  - 支付失败率 > 5% → 飞书+邮件通知
  ```

### 阶段6: 文档 & 培训 (10分钟)

- [ ] **6.1 用户文档**
  - [ ] `KPI-DASHBOARD-GUIDE.md` 已存放在 docs/ 目录
  - [ ] 所有endpoints有示例代码
  - [ ] 故障排查章节完整

- [ ] **6.2 内部培训**
  - [ ] CMO / 产品经理已看过演示
  - [ ] 知道如何访问仪表板
  - [ ] 理解各指标的含义

- [ ] **6.3 API文档**
  ```
  http://localhost:3021/api/kpi/docs
  ```
  - [ ] 页面加载成功
  - [ ] 所有endpoints都列出来了
  - [ ] 响应示例清晰

- [ ] **6.4 数据字典**
  创建 `docs/KPI-DATA-DICTIONARY.md`:
  ```
  - DAU: 日活用户数 (过去24小时内活跃的用户)
  - GMV: 成交金额 (Gross Merchandise Value)
  - AOV: 平均客单价 (订单总额 / 订单数)
  - CR: 转化率 (订单数 / 访问数)
  ```

## 🎯 最终验收标准

| 项目 | 验收标准 | 状态 |
|------|--------|------|
| 本地加载 | 仪表板在 localhost:3021 加载且无错误 | ✓ |
| 数据展示 | 所有卡片和图表都有数据 | ✓ |
| 实时刷新 | 每30秒自动刷新 | ✓ |
| API文档 | /api/kpi/docs 可访问 | ✓ |
| 生产部署 | https://shenyuan.mylumee.cn/docs/kpi-dashboard.html 可访问 | ✓ |
| 性能 | API 响应时间 < 500ms | ✓ |
| 监控 | 错误告警正常运作 | ✓ |

## 📝 故障排查快速参考

### 问题: "连接失败" 错误

**第一步**: 检查后端
```bash
curl http://localhost:3021/api/kpi/metrics
# 应该返回 JSON，不是 404 或 500
```

**第二步**: 检查CORS
```bash
# 浏览器console输出 CORS 错误?
# → 检查 server/index.js 的 ALLOWED_ORIGINS
```

**第三步**: 检查网络
```bash
# Chrome DevTools → Network tab
# 查看 /api/kpi/metrics 请求
# - Status: 200? 404?
# - Response: 有内容?
```

### 问题: 图表不显示

```bash
# 浏览器console执行
console.log(window.Chart)  // 应该是函数
console.log(window.echarts) // 应该是对象

# 如果都是 undefined, CDN 加载失败
# 解决: 刷新页面，或检查网络连接
```

### 问题: 数据为0

```bash
# 检查 data.json 是否存在且有数据
ls -lah server/data.json

# 手动验证 API
curl http://localhost:3021/api/kpi/metrics | jq '.metrics.dau'
# 应该输出数字，不是 null 或 0
```

## 🚀 上线后检查清单

- [ ] 监控告警配置完成
- [ ] 日志保留策略设置 (7天/30天/永久)
- [ ] 备份策略配置 (data.json 每日备份到 S3)
- [ ] 定期测试灾难恢复流程
- [ ] 组织使用培训完成
- [ ] 用户反馈收集渠道建立

## 📞 紧急联系方式

- **技术问题**: 开发团队 / Slack #shenyuan-tech
- **产品问题**: CMO / 产品经理
- **监控告警**: 值班工程师 (24/7 on-call)

---

**清单版本**: v1.0
**最后更新**: 2026-08-08
**维护者**: 善缘开发团队

✅ 所有项目完成后，可发起首次生产部署
