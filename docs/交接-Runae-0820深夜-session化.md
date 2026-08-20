# Runae 交接 · 0820 深夜（5 方法 Session 化 + 报告硬伤修复）

> 已全部部署验证。最新 commit `6359339`，push origin/main，server `/opt/shenyuan` git reset origin/main + `pm2 restart shenyuan --update-env`。

## 一句话
把八字/紫微/西占/九星/合婚 5 个方法从"一份读不下去、还让 LLM 写飘出幻觉的巨型报告"，重构成 **Session 制**（首个总览免费 + 其余每个 $3.99 + 一键全买五折 $11.99），并修掉一批"一眼假"的报告硬伤。

## 定价模型
- 每方法：**命格总览免费**（钩子）+ 其余每个 Session **$3.99** + 一键全买（≈六个五折）**$11.99**
- 动态 price_data：`<method>_full`=1199、`<method>_s_<topic>`=399（store.js amount，无需建 Stripe SKU）。`bazi_full`/`hehun_full` 已注释旧固定 price 走动态。

## 架构（复用即可扩展）
- 后端：八字走 `/api/bazi/topic`；紫微/西占/九星/合婚走**通用 `/api/session`**（`SESSION_CFG` config 驱动 + `buildSessionEngineBlock` 按方法复用各自真排盘引擎）。合婚 `twoPerson:true` 接双方 `buildBaziBlock` 真排盘。
- 前端：`assets/js/sessions.js` 通用组件 `RunaeSessions.render({method,input,mount})`，5 页（bazi/ziwei/astrology/kyusei/hehun）全接（去掉了 ziwei 旧的 rng 随机假命盘）。
- 真引擎注入全验：八字戊土·紫微天相·西占月亮处女·九星九紫·合婚双方日主生克。

## 修掉的硬伤（独立 agent 审 → 修 → 复验）
1. **西占正文行星对不上事实卡**：根因=旧 calcAstrology(默认北京) 与新 VSOP87 双注入冲突 → 统一 `computeWesternChart` 单一精确源建事实卡(`buildPreciseFactCard`)。
2. **上升自相矛盾**：无出生地时诚实标"需出生地精算"，不再用北京默认硬编。
3. **九星本命星算错**：公式修对（1991=九紫，非一白），前后端都修。
4. **八字日主写错**（把年柱辛未当日主）→ 加日主铁律，日主=日柱天干。
5. **编造既定往事当事实**（"2024年项目重启"）→ 真实性铁律：假设一律用"你很可能/倾向于"。
6. **伪造精确数字**（"80%以上""47天""1/4强度"）→ prompt 禁令 + **确定性后处理 `_dropFakeStats`**（LLM 不100%听话，代码强制神经掉）。

## 分数
独立审：首轮 7.9（紫微 6.5 拖后腿），紫微两条回潮硬伤已修透+复验。**未跑最终复审拿新数字**（下一步）。

## 🔴 待办 / 坑
1. **跑最终独立审**确认新总分（上次 7.9，紫微已修，估 ~8.5-9）。
2. **报告没图**是明显短板：命盘图/四柱图/五行图样张已建（`spike/ziwei_v2.png`）但**没接进 session**——零预算 Chrome 渲染真数据可补，建议接。手相图要生图卡预算。
3. E2E 只真机点通了 bazi（其余 4 页同组件+API 全验，风险低）；有空补点 ziwei/hehun。
4. 各页仍有旧巨型报告流程的**死代码**（unlockZiwei/streamZiwei 等），不显示但可清理。
5. `_dropFakeStats` 是兜底，长期更该在 prompt 层根治（deepseek 对紫微较顽固）。

## 首页(home-runae.html)本轮改动 + 遗留
- ✅ 去掉玉珠后面的星云（"一团火/一团云"=`hero-cosmos` 已隐藏）；右侧面相人脸调亮露出（`.hero-deco.mianxiang` opacity 0.5→0.9·遮罩软化）。已部署验证。
- 🔴 **代祈福圣地地图待重做**：现状=彩色 PNG(`samples/caijing/全球祈福圣地网络.png`) 但**中文标签被 overflow 裁掉("字都不全")且亚洲标签挤成一团**。Karen 要：**彩色 + 英文 + 地址 + 标签分散不重叠不截断**。
  - `scripts/build_blessmap.py` 已改成英文+地址+引线布局(REG 带 ax/ay 锚点+SVG 引线)，但**它渲染的是暗色版**(`.mapwrap svg path{fill:#3a2a18}`)——Karen 要彩色。**下一步**：把 svg path 改成按大洲分色填充(绿/蓝/棕/金，参考旧彩色图 image #21) + 跑脚本生成 HTML → Chrome 截图覆盖 PNG。别 ship 暗色版。
- ⚠️ 首页非我这轮原创(git 确认)，是早前提交(303b8c0/5d469f2)做的；本轮按 Karen 要求调整。

## 北极星没变
产品又厚了一截，真缺口仍是 **distribution（≈0 用户）**。小红书 AI 掌纹图方案在 `docs/获客-AI掌纹图-小红书-0820.md`。
