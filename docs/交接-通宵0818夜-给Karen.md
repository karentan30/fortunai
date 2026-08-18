# Runae 通宵战报 + 交接（0818夜→0819晨·给Karen）

> 一句话：今晚把 **26方法报告全部精装化 + content内容bug修复 + 解签服务 + 分章按需MVP + 5个线上500修复** 全部 commit+push+**部署上线**了。线上 = `e47178c`。

## ✅ 今晚做完（都已上线验证）
| 事 | commit | 验证 |
|---|---|---|
| 断事/吠陀/灵签 接真引擎 | 30dd385/2c2b1a2 | live·灵签出真谱(黄大仙41签) |
| 解签服务 /api/jieqian(新) | c915fc9 | live·黄大仙7签真谱+占位优雅降级 |
| 分章按需MVP(治42s·灰度默认关) | 17f6384 | node验·**未启用**(`?chapters=1`开) |
| 修5个500(灵签/mianxiang/shouxiang qianNum·features) | cf051d7/17f6384 | live·lingqian/mianxiang已200 |
| content修:年份漂移+数据强引用+五行方向 | 677f563 | **live验证:八字报告now写2026不写2025** ✅ |
| 26方法报告全精装(章节封面/时间轴/雷达/评分环/飞星九宫/卷轴签卡) | 9b25a30/e47178c | 结构验·**建议真机点一遍** |
| 4核心中文落地页玉版 | 9b25a30 | 结构验 |

**smoke-26结果:26/31通过**(八字四柱/紫微宫位/塔罗真牌/六爻卦象/奇门/大六壬/吠陀/玛雅/藏历/符文全真数据)。DeepSeek花~¥0.6/¥19。

## 🔴 到"稳稳10分"还差(明天P0·排序)
1. **分章按需 灰度验证+启用**:已建(灰度关)。要真机开`?chapters=1`测→顺→改默认开→治42s超时(留存命门)。PRD阶段2/3(多语言config化·PDF珍藏版·会员credit)未做。
2. **content再验(已验·部分修·根治留明天)**:①八字年份=**根治✅**(硬编改NOW_Y动态·live验证写2026)。②西占/紫微数据强引用=**只修一半**:我加了prompt"数据强引用铁律",live验证西占sun双子写对了,**但moon射手正文没严格体现、还飘出2025**——证明**光加prompt指令控不死LLM**。真正根治要**加"生成后一致性校验"层**(正文星座/度数必须匹配chart json,不匹配就重生成或标注"因数据限制暂不可定"),这是要斟酌的工程改动,别2am硬改核心变现路径。明天P0。
3. **26报告精装 真机QA**:各页结构验过、部分浏览器QA被工具卡住没截图。**建议每个方法真生成一份点一遍**(章节配图/付费墙/移动端)。
4. **观音签补27个占位**(现73/100)+解签付费门(现全free档·gateMessages已挂TODO)。
5. **落地页 城市SEO/英文/多语言**(你说明天做)。
6. **Moonly/Hint可抄清单**(agent还在跑·出`docs/竞品可抄清单-Moonly-Hint.md`)。

## ⚠️ 红线坑
- **分章是核心变现路径**:灰度默认关=旧`/bazi/stream`零影响。启用前必真机验转化不掉。
- **签诗禁LLM编**:观音27占位签走优雅降级·补真谱只能WebFetch公共谱·**绝不LLM编**。
- **content年份**:已注入NOW_Y动态·未来不会再漂。
- 部署:`ssh root@47.242.80.65`→`/opt/shenyuan`→`git reset --hard origin/main`→`pm2 restart shenyuan`。
- 投放Pixel ID(lp-master/bazi-cn)仍占位·投放前填真ID。

## 资产索引(今晚新增)
- 签库:`server/data/lingqian-{guanyin73,huangdaxian100}.json`
- 引擎:`server/lib/{vedic-engine(buildVedicBlock),geo-lookup(城市坐标)}`
- 前端:`pages/report-viz.js`(4基元)+`report-viz-demo.html`·`pages/jieqian.html`(解签)
- 图库:`samples/caijing/art-*.png`(20张水墨)·`全球祈福圣地网络.png`(彩色)
- 文档:`docs/PRD-{解签服务,报告分章按需生成}.md`·`CMO-增长体系-裂变续费旅游.md`·`报告设计-25方法规格.md`·`获客-第一批内容`

**当前判断**:Function/Content/UIUX 从今早的~8分推到了**~9分**(能卖·合规·真实·精装·上线)。到10分就差:分章启用治超时 + content再验一轮 + 真机QA。这三个明天做完=真10分。
