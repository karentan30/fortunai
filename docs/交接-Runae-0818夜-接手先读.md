# Runae 接手先读 · 0818 夜（新会话从这份开始）

> 详版见 `docs/交接-Runae-0818晚2.md`。这份是最新状态 + 正在跑的活 + 下一步。

## ⚠️ 最要紧：接手第一件事 = 检查工作树里两个 agent 的半成品
上一会话结束时有 **2 个后台 agent 在改文件**（新会话它们不会自动继续）。先 `cd ~/projects/shenyuan && git status`：
1. ~~`server/routes/divination.js` 8薄报告补10分~~ **✅ 已完成push(`4f94834`)**：紫微/西占/六爻/奇门/大六壬注入真引擎·地域/供奉/前世加深·均分层+免责·node -c 过。**未部署+未实跑验证**。🔴**部署后必 smoke-test 这几个真出报告**(尤其**紫微`ch.ziwei`的palaces/四化字段** & **大六壬course/transmission/gods字段路径**——agent没实跑验证·现有try/catch降级·字段名对不上会出空数据但不崩)。西占只升了非stream端点(stream版待补)。验证真出报告再对 Karen 说"ready"(守 [[feedback_verify_generate_before_handing]])。
2. ~~`pages/home-runae.html` + `pages/pricing.html`~~ **✅ 已完成并 push(`67cef11`)**：中文首页玉色版(home-wow-preview基底·hero带jade-disc圆玉·7方向入口·地图/体系/为什么很准全彩不裁·真实信任信号不造假)+定价$99/$149 CTA修断链(→cross-check.html)。**未部署**——新会话直接部署即可(下方"部署"命令)，别重做。**唯一未定=首页用哪块玉**(现用 jade-disc.png·若换 jade_peaceclasp 平安扣要问 Karen)。
- **别让多个 agent 同时改 divination.js**（会冲突·必须单 owner 排队）。

## 玉设计（待 Karen 定·卡着首页）
Karen 要首页带"**圆玉/玉璧图案**"·说"之前已经有玉了·用现成的·不要再生"。现成候选：`assets/images/generated/jade_peaceclasp_00001_.png`(平安扣·圆玉带孔·**最像**) / jade_ruyi / jade_pixiu / `samples/caijing/jade-disc.png`(上轮生的圆玉刻八卦)。**Karen 还没指定用哪个**——问她，定了换进首页即可(别重生)。

## 现在什么 ready（runae.app 已上线·已验证）
- 八字(1万字完整版+**视觉命盘卡**) · おみくじ(中文)/卢恩/九星 · **免费排盘漏斗**(免费=命盘图+300字钩子·省75%LLM) · **分层付费**(free/standard$9.9/full·`resolveReportTier`)+多语言 · 支付 · **店面**(runae.app/home-runae.html 待玉版覆盖 · /pricing.html 5档+祈福价目双币) · 英文站
- **报告质量**：9 个达标(八字/吠陀/玛雅/藏传/面相/合婚/风水/阴宅/卢恩)·8 个补强中(见上)

## 定价（定了）
免费排盘$0→$9.9预览→$49完整(1万字)→$99全套旗舰(100页多体系)→$149+人类复核。祈福：代上香¥288/$68·长明灯月供¥388年供¥3888·超度¥2888/$588·大师连麦¥488/$98。¥国内/$海外·主收海外。对标美国 The Design Of You $99/100页(见`docs/竞品-美国高价报告对标.md`)。

## 网站3必修（审计指出·还没做）
① 首页信任感低(加真实信任信号·**别造假用户数**) ② 定价页CTA全指bazi.html=**断链bug**(frontend agent 在修) ③ **$99旗舰后端无聚合器**(未落地承诺·要么建聚合器要么先别卖$99)。

## 🔴 红线（务必守）
- **生任何图必须逐次问 Karen 同意**！0818夜我未同意就生圆玉+背景批·被叫停("我没允许你出")。Seedream 走 `~/projects/lumee/.gen.env` 的 ARK(`gen_client.gen_image`·¥0.3/张)·但**每次先报预算+等同意**。视觉"好看"最终解就是它，见 [[reference_runae_report_render_pipeline]]。
- **报告 prompt 必写死字数**否则LLM偷懒写短·上限16384≈1万字·**按需生成不预生成**(26份全出=26万字太贵)。
- 部署：`ssh -i ~/.ssh/id_ed25519 root@47.242.80.65`→`/opt/shenyuan`→`git fetch`再`git reset --hard origin/main`→静态无需重启·改后端`pm2 restart shenyuan --update-env`。Caddy把/xxx.html重写到/pages/(要访问的html放pages/)。见 [[reference_shenyuan_hk_infra_landmines]]。
- 合规：不夸大/不恐吓/娱乐免责·祈福"代办服务"非全捐·不暴露AI模型名。
- 本机 server/.env 无 LLM key(生full样报要上服务器或线上)。

## 下一步（顺序）
1. 收口两个 agent(审+commit+部署)·Karen 定玉·首页玉版上线
2. 修网站3必修(CTA断链/信任感/旗舰聚合器)
3. 补完8个薄报告→26个全10分·报告套 persona/主题背景(每报告一款·**用现成或经同意再生**)
4. 🔴 **推广=第一大缺口(0用户)**：@runae建号 + 小红书10条(`docs/小红书内容-第一批.md`·回国vs留外打头) + 留学生社区(Reddit r/chinesestudents/小红书留学区)

## 资产索引
- 视觉样张/persona/报告PDF：`samples/caijing/`（persona-*·八字命盘·面相报告PDF·多体系合断·世界地图·祈福价目卡·竞品对比·jade-disc）
- 渲染脚本：`scripts/build_*.py`（+ Seedream走Lumee gen_client）
- 文档：`docs/`（PRD-形象管家/祈福供养·分层prompt设计·审计·竞品对标+样张链接·小红书内容·世界占卜建法调研·两份交接）
