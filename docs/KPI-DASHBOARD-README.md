# 善缘 KPI 实时监控仪表板

生产级实时数据监控解决方案，集成7大核心功能模块。

## 📦 文件清单

```
docs/
├── kpi-dashboard.html                 # 仪表板前端 (可独立访问)
├── kpi-dashboard-mock-data.js         # Mock数据生成工具 (测试用)
├── KPI-DASHBOARD-GUIDE.md             # 完整使用指南 (必读)
├── KPI-DASHBOARD-CHECKLIST.md         # 部署前清单 (必读)
└── KPI-DASHBOARD-README.md            # 本文件

server/
└── routes/kpi.js                      # 后端API实现

server/index.js                        # 已集成KPI路由
```

## 🚀 快速开始 (3分钟)

### 1️⃣ 生成Mock数据 (测试)
```bash
cd /Users/karen/projects/shenyuan
node docs/kpi-dashboard-mock-data.js
```

### 2️⃣ 启动后端服务
```bash
cd /Users/karen/projects/shenyuan/server
npm install  # 若需要
node index.js
```

### 3️⃣ 打开仪表板
```
http://localhost:3021/docs/kpi-dashboard.html
```

**期望结果**: 仪表板加载，显示 "连接正常" ✓

## 📊 功能清单

### ✅ 已实现的7大功能

| # | 功能 | 描述 | 文件 |
|---|------|------|------|
| 1 | **实时KPI展示** | DAU/付费用户/GMV/AOV/转化率 | kpi-dashboard.html L50-80 |
| 2 | **A/B测试排行** | 8页面转化率排名 + winning/losing标记 | kpi-dashboard.html L280-290 |
| 3 | **邀请排行榜** | Top10邀请者 + 转化数 + 返佣金额 | kpi-dashboard.html L340-360 |
| 4 | **支付方式分布** | 微信/Stripe/支付宝 占比饼图 | kpi-dashboard.html L620-650 |
| 5 | **用户留存曲线** | Day1/Day3/Day7 留存率折线图 | kpi-dashboard.html L550-580 |
| 6 | **错误告警系统** | 支付失败/Webhook异常/响应缓慢 | kpi-dashboard.html L900-950 |
| 7 | **地理分布** | 中国/海外/韩国用户占比 | kpi-dashboard.html L690-710 |
| + | **转化漏斗** | 访问→注册→首购 三层漏斗 | kpi-dashboard.html L770-800 |
| + | **支付趋势** | 7日支付方式趋势对比 | kpi-dashboard.html L730-760 |

### API Endpoints

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/kpi/metrics` | GET | 主要指标 + 所有图表数据 |
| `/api/kpi/ab-tests` | GET | A/B测试排行 |
| `/api/kpi/referrals` | GET | 邀请排行榜 |
| `/api/kpi/errors` | GET | 错误告警 |
| `/api/kpi/docs` | GET | API文档 (HTML) |

## 🎯 核心指标解释

### 1. DAU (Daily Active Users)
- **定义**: 过去24小时内至少访问一次的用户数
- **计算**: WHERE lastActive >= now - 24h
- **用途**: 衡量产品活跃度

### 2. GMV (Gross Merchandise Value)
- **定义**: 今日总成交金额
- **计算**: SUM(order.amount) WHERE status='paid' AND date=today
- **用途**: 衡量收入健康度

### 3. AOV (Average Order Value)
- **定义**: 平均单笔订单金额
- **计算**: GMV / 订单数
- **用途**: 衡量单客价值

### 4. 转化率 (Conversion Rate)
- **定义**: 有购买的用户占访问用户的比例
- **计算**: (付费用户数 / DAU) × 100%
- **用途**: 衡量产品商业化效率

### 5. 留存率 (Retention)
- **Day1**: 首日用户中，第2日还活跃的比例
- **Day3**: 首日用户中，第4日还活跃的比例
- **Day7**: 首日用户中，第8日还活跃的比例
- **用途**: 衡量产品粘性

## 📈 数据流向图

```
┌─ 前端事件 (用户访问、下单)
│
└─> 后端API 记录
    ├─ POST /api/orders          (订单创建)
    ├─ POST /api/auth/login      (用户活跃)
    └─ POST /api/referral/track  (邀请追踪)
    
        └─> 数据库 / data.json 存储
            ├─ users 表
            ├─ orders 表
            └─ abTests 表
            
            └─> KPI API 查询聚合
                ├─ GET /api/kpi/metrics    (每30秒调用)
                ├─ GET /api/kpi/ab-tests
                ├─ GET /api/kpi/referrals
                └─ GET /api/kpi/errors
                
                └─> 仪表板实时展示
                    ├─ Card 数值展示
                    ├─ Chart.js 图表
                    └─ ECharts 漏斗图
```

## 🔧 配置说明

### 后端配置 (server/index.js)

**已配置项** ✓:
- ✓ CORS 白名单 (包括本地+生产域名)
- ✓ KPI 路由注册 (L160-161)
- ✓ 静态文件服务 (HTML可直接访问)

**可选配置**:
```javascript
// 添加速率限制 (防止爬虫)
const rateLimit = require('express-rate-limit');
const kpiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100
});
app.use('/api/kpi', kpiLimiter);

// 添加缓存 (性能优化)
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 30 });
```

### 前端配置 (kpi-dashboard.html)

**可配置项**:

```javascript
// 行 9-10 修改刷新频率
const REFRESH_INTERVAL = 30000; // 改为其他值 (ms)

// 行 12 修改API基地址 (多环境支持)
const API_BASE = process.env.REACT_APP_API_BASE || window.location.origin;
```

## 🎨 UI特点

- **暗色主题** - 护眼设计，适合24/7监控
- **实时状态指示** - 右上角连接状态灯
- **响应式布局** - 完全适配手机/平板/桌面
- **图表多样化** - Chart.js (折线/饼图) + ECharts (漏斗)
- **错误告警** - 4色code: 红(错误)/橙(警告)/绿(正常)
- **缓存机制** - LocalStorage备份，离线也能查看

## 📱 响应式断点

| 设备 | 宽度 | 支持 |
|------|------|------|
| 手机 | < 600px | ✓ |
| 平板 | 600-1024px | ✓ |
| 桌面 | 1024-1920px | ✓ |
| 4K | 1920px+ | ✓ |

## 🔐 安全性

### ✓ 已实现
- ✓ CORS 白名单验证
- ✓ Cookie 鉴权
- ✓ 数据脱敏 (只显示聚合数据)
- ✓ 仅暴露metrics端点

### ⚠️ 建议加强
- [ ] 添加IP白名单 (仅内部网络访问)
- [ ] JWT Token 鉴权
- [ ] API密钥认证
- [ ] 审计日志记录

## 📊 数据延迟

| 数据源 | 延迟 |
|--------|------|
| 实时订单 | 0-30秒 |
| DAU计算 | 1-2分钟 (时间戳精度) |
| A/B测试 | 5分钟 (缓存) |
| 支付方式分布 | 5分钟 (缓存) |

**优化方案**: 将 data.json 替换为数据库查询 (MySQL/PostgreSQL)

## 🚀 生产部署

### HK服务器 (47.242.80.65)

```bash
# 1. SSH连接
ssh -i ~/.ssh/hk root@47.242.80.65

# 2. 拉取代码
cd /root/projects/shenyuan && git pull origin main

# 3. 重启服务
pm2 restart shenyuan

# 4. 验证
curl https://shenyuan.mylumee.cn/api/kpi/metrics
```

**访问地址**:
```
https://shenyuan.mylumee.cn/docs/kpi-dashboard.html
```

### Vercel (可选备用)

```bash
vercel --prod
```

**访问地址**:
```
https://shenyuan.vercel.app/docs/kpi-dashboard.html
```

## 📚 文档索引

| 文档 | 用途 | 读者 |
|------|------|------|
| `KPI-DASHBOARD-GUIDE.md` | 完整使用手册 | CMO/PM/分析师 |
| `KPI-DASHBOARD-CHECKLIST.md` | 部署清单 | 工程师 |
| `/api/kpi/docs` | API文档 | 开发者 |
| 本文件 | 快速参考 | 所有人 |

## 🎓 使用案例

### Case 1: 日常监控 (5分钟)
```
打开仪表板 → 扫一眼关键指标 → 检查告警 → 完成
关键看: DAU趋势, GMV, 错误数
```

### Case 2: A/B测试评估 (10分钟)
```
点击「A/B落地页转化率排行」
→ 查看各页面排名
→ 自动判断winning/losing
→ 决策使用最优页面
```

### Case 3: 邀请激励 (5分钟)
```
点击「邀请排行榜」
→ 查看Top10邀请者
→ 发放奖励给高贡献者
→ 复制优秀者特征进行激励复制
```

### Case 4: 支付问题排查 (10分钟)
```
发现支付失败率告警
→ 查看「支付方式趋势」图
→ 判断是某个通道问题还是全面问题
→ 联系支付服务商或优化流程
```

## 🐛 常见问题

**Q: 仪表板显示"连接失败"**
A: 检查后端是否运行 `curl http://localhost:3021/api/kpi/metrics`

**Q: 数据都是0**
A: 检查 `server/data.json` 是否存在有效数据

**Q: 图表不显示**
A: 检查浏览器console中是否有JS错误，可能是CDN加载失败

**Q: 希望集成到后台管理系统**
A: 使用iframe标签嵌入: `<iframe src="/docs/kpi-dashboard.html"></iframe>`

**Q: 数据延迟太大**
A: 建议迁移到数据库 (MySQL/Supabase)，而不是用data.json

## 🔄 集成流程图

```
第1步: 生成Mock数据
  $ node docs/kpi-dashboard-mock-data.js

第2步: 启动后端
  $ cd server && node index.js
  
第3步: 打开仪表板 (本地)
  http://localhost:3021/docs/kpi-dashboard.html
  
第4步: 验证所有功能
  - [ ] 数据加载
  - [ ] 图表渲染
  - [ ] 自动刷新
  - [ ] 错误告警
  
第5步: 推送到生产
  $ git add docs/ server/routes/kpi.js server/index.js
  $ git commit -m "feat: add KPI dashboard"
  $ git push origin main
  
第6步: 部署到HK服务器
  ssh root@47.242.80.65
  cd /root/projects/shenyuan
  git pull && pm2 restart shenyuan
  
第7步: 验证生产访问
  https://shenyuan.mylumee.cn/docs/kpi-dashboard.html
```

## 💡 下一步优化

### 高优先级 (P0)
- [ ] 集成真实数据库 (MySQL查询而非data.json)
- [ ] 添加管理员认证 (仅内部访问)
- [ ] 性能监控 (API响应时间告警)

### 中优先级 (P1)
- [ ] WebSocket 实时推送 (替代30秒轮询)
- [ ] 导出功能 (PDF报告下载)
- [ ] 自定义仪表板 (用户能拖拽widget)

### 低优先级 (P2)
- [ ] 第三方集成 (Slack/钉钉告警)
- [ ] 历史数据对比 (月环比/年同比)
- [ ] 预测分析 (ML趋势预测)

## 📞 支持

- **技术问题**: 查看 `KPI-DASHBOARD-GUIDE.md` § 故障排查
- **功能建议**: 提交到 GitHub Issues
- **紧急故障**: 联系值班工程师

---

**版本**: v1.0  
**最后更新**: 2026-08-08  
**维护**: 善缘开发团队

**快速链接**:
- [完整指南](./KPI-DASHBOARD-GUIDE.md)
- [部署清单](./KPI-DASHBOARD-CHECKLIST.md)
- [仪表板](http://localhost:3021/docs/kpi-dashboard.html)
- [API文档](http://localhost:3021/api/kpi/docs)
