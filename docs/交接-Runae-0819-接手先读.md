# Runae 接手先读（0819 · 无context新会话从这份开始）

## 0. 产品一句话
Runae（中文=善缘）= 东西方命理合断平台·主收海外华人/留学生。**26个命理报告**（八字/紫微/西占/塔罗/风水/合婚…都真引擎数据+精装UI）+ 解签服务(真庙谱) + AI追问 + 每日运势(在建) + 真人连麦(规划) + 祈福代烧。分层付费 $29/$59/$99 + 会员。**至今≈0用户，最大缺口=distribution不是功能。** 团队=Karen一人+AI。线上=`https://runae.app`。

## 1. 🔴 今天(0819)修的最关键bug——"网络异常"根因(三层)
反复出现的"八字网络异常/服务暂时不可用"根因**三层叠加**，都已修：
1. **CORS白名单没有 runae.app**(`server/index.js:31 ALLOWED_ORIGINS`只有旧shenyuan/fortunai域名)→真实浏览器从runae.app发的请求全被CORS拦→500。**这是真根因**(curl无Origin头才没触发·所以"我测得通你却网络异常")。已加runae.app/runae.net。
2. **qwen百炼没激活**：LLM_PRIORITY=`qwen,deepseek,groq`但进程没reload到DASHSCOPE key→qwen被跳过→只用DeepSeek单打。已`pm2 restart --update-env`激活qwen主力。
3. **DeepSeek余额烧干**：测试生成几十份把¥19烧光→402。Karen充了¥20·且现在qwen主力+DeepSeek兜底不怕单点没钱。
**铁律**：改LLM_PRIORITY/CORS/env后**必须`pm2 restart --update-env`让进程reload `/opt/shenyuan/server/.env`**·并curl带`-H "Origin: https://runae.app"`验证真200(不带Origin测不出CORS问题)。

## 2. 现在什么能推(0819 QA+验证后)
- ✅ **~24个报告能推**：真引擎数据+精装(章节封面art图/时间轴/五行雷达/评分环/飞星九宫/卷轴签卡)+合规。qwen百炼出报告质量好。
- ✅ **解签服务** live(`/api/jieqian`·观音92/黄大仙100真谱·占位签优雅降级不编)· **邮箱留资**(报告后"留邮箱享八折"+订阅+邮件发报告)· **分层付费**。
- ✅ content: 西占/紫微加**命盘事实卡**(代码渲染太阳月亮上升100%准)·八字年份写2026不漂。
- 🟡 **分章按需**(治42s超时)：后端`/api/bazi/chapter`✅(9.6秒单章)但**前端点按钮仍不出章节·灰度默认关·别启用·还有bug**。
- ❌ 每日运势(PRD好·/api/daily已建·3-5天可Phase1) · 真人连麦(Agora引擎现成·**供给=命理师从哪来待Karen定**)。

## 3. 硅谷CEO审查的3条最狠(见 docs/硅谷CEO审查-Runae.md)
1. **26功能是负资产不是护城河**·8个prompt≤7分(大六壬6/地域6/奇门6.5)在损害品牌·建议砍/别主推。
2. **护城河只在2处**：解签真谱(竞品全LLM编签诗·"诚实"是真moat) + 日主×今日干支真个性化日运。
3. **最该做的1件事**：观音签补完100→解签MVP→Karen亲发小红书"清水寺抽到凶签用Runae 3秒看懂"。**旅游×解签=唯一有场景唯一性的增长入口**。⚠️还要复查:定价页CTA跳转/$99旗舰无聚合器(cross-check只跑八字+紫微2体系·文案已改真实待再确认)。

## 4. 部署/服务器/红线
- **部署**：`ssh -i ~/.ssh/id_ed25519 root@47.242.80.65`→`cd /opt/shenyuan`→`git fetch && git reset --hard origin/main && pm2 restart shenyuan --update-env`。进程从`/opt/shenyuan/server/index.js`跑·env在`/opt/shenyuan/server/.env`(dotenv override加载·DEEPSEEK/DASHSCOPE key都在里面·付费key别贴聊天别入git)。
- **LLM**：`server/lib/llm.js`多provider兜底链(qwen→deepseek→groq)·`deepseekChat/deepseekStream`走这个链。测试用qwen百炼便宜(Karen有免费开源maas模型`ws-...cn-beijing.maas.aliyuncs.com`可更省·要切给QWEN_BASE_URL+QWEN_MODEL)。
- **红线**：签诗禁LLM编(观音8个占位是真实来源分歧·补真谱只能WebFetch公共谱)·不暴露AI模型名(用中性)·娱乐免责·付费墙锁定内容不进DOM·不打麦玲玲IP·代码全在git(karentan30/fortunai)推了就不丢。
- **Caddy**：把/xxx.html重写到/pages/·要直接访问的html放pages/下。

## 5. 关键资产/文档索引
- 签库`server/data/lingqian-{guanyin92,huangdaxian100}.json`·引擎`server/lib/{vedic-engine,geo-lookup}`·前端`pages/report-viz.js`(4基元)/`jieqian.html`·图库`samples/caijing/art-*.png`(20张)+彩色`全球祈福圣地网络.png`
- docs/: `硅谷CEO审查` `CMO-增长体系-裂变续费旅游` `功能介绍-26功能` `竞品可抄清单-Moonly-Hint` `PRD-{解签服务,每日运势日活,报告分章按需生成}` `报告设计-25方法规格` `交接-通宵0818夜`(更详细的今日战报)

## 6. 明天P0(排序)
1. **真机验网络异常真好了**(浏览器点报告·现在CORS修了应该好)+跑通付费流程
2. **观音签补100 → 解签MVP完整 → 小红书发第一条**(CEO说的增长第一步)
3. **分章前端第二个bug**(点按钮不出章节·治42s)或先不主推
4. content：西占/紫微LLM仍会飘写错星座(事实卡兜底了·彻底根治要生成后校验层)·免费预览偏短(~580字·该~1500)
5. 每日运势Phase1(留存命门·3-5天)·真人连麦(定供给)
6. distribution(唯一真缺口)：10条小红书已写(docs/获客-第一批内容)·旅游×解签角度

## 7. 0819接手·八字报告付费墙2 bug(已定位·本地已修#1·未部署)
- **bug#1 少显示1章**：后端免费预览生成3章(四柱/五行/本年流年)，但前端 `pages/bazi.html` 的 `renderUltimateReport` 原 `shouldBlur = isLocked && i>=2` → 把后端当免费送的第3章(本年流年)也盖成付费墙，用户只看到2章就撞墙。**已改 i>=3**(本地·待部署)。流年是最强情绪钩子，放开=预览更抓人、转化更高。
- **bug#2 白底黄字看不见**：基础 `:root` 是浅色(`--bg:#faf8f5 --card:#fff`)，暗色主题只在 `html[data-page='bazi']` 生效。而 **report-cn/report/report-demo/lp-bazi-cn-a·b·c 全都没挂 data-page='bazi'** → 报告落在白底 + 金字(#c9a84c/#f0d060)=看不见。bazi.html 自己是暗的。**待确认Karen从哪个页面看到白底**再定精修点(给该报告页挂暗色 or 底部元素给显式暗底)。
- ⚠️ **解签=CEO钦点#1变现漏斗**：必须同样自查 `jieqian.html` 有没有这两个bug(锁章错位/白底)，别只修八字漏了最赚钱的解签。
- ⚠️ 复查红线(CEO点名今天必改)：定价页CTA是否仍全跳bazi.html + 是否仍有"$99/约100页"承诺(后端无聚合器)。
