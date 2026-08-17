# Runae 交接 · 2026-08-17

## 🔴 最紧急（挡住核心付费功能）
**报告全线挂 = DeepSeek 账户余额用尽（`Insufficient Balance`）。不是代码bug。**
- 所有报告/AI解读都走 DeepSeek 出文，钱一空 → 前端"failed to generate report"。
- **修法：Karen 去 platform.deepseek.com 充值**（或换一个有余额的LLM key填进 server/.env 的 `DS_KEY`，重启 `pm2 restart shenyuan`）。
- 充完即恢复，无需改代码。

## 今天做完
- **英文hub扩 11→24 功能**（explore.html·5分区·"20+ readings"锚点）+ 首页3个"所有功能"入口 → 解决"英文没功能"的showcase缺口。已上线runae.app。
- **best-timing（求复合择时）**接真后端排盘、去客户端假date，路由已挂 `/api/best-timing`。
- **病毒卡**：真html2canvas导图PNG + 深金luxury卡（UR/SSR徽章+出现率条，无假%）。
- 合规红线修：面相/手相加18+门+隐私、风水去efficacy措辞、广告代祈福移出付费池。

## 待办
1. **充DeepSeek**（见上，Karen亲自）。
2. 4个中文only系统（紫微/易经/奇门/大六壬）hub里暂显"coming soon"——要英文页才能放开死链（改explore.html对应卡的 `data-soon`→`data-go`）。
3. 麻衣神相canon做进面相/手相逻辑（Karen要"麻衣的那种"，未做）。
4. 快跟进后端：chat放宽（别5次/天）、月费给其他报告5折、年费去掉月度master credit。
5. Western/modern占星（celestine引擎）补齐竞品超集。
6. 12个faceless星座号矩阵运营SOP + 本机ComfyUI出IG图（prompt待Karen过目）。

## 红线/坑
- **零编造**：报告/日期/排盘一律真引擎算，LLM只解读（脚本排盘·AI解卦）。best-timing之前就是栽在客户端编date。
- **零"Chinese"标签**用"Eastern"；每功能AI标识+娱乐参考免责+反宿命论。
- runae.app 前端调API走**相对路径=同源**，不用进CORS白名单（日志里的CORS FATAL是别的域/bot，无害）。
- SSH进HK用 `~/.ssh/id_ed25519`（xinshen那把已失效）。
- 部署：`ssh root@47.242.80.65 → cd /opt/shenyuan → git reset --hard origin/main → pm2 restart shenyuan`。Vercel攒批别每改必部署。

## 下一步
Karen充DeepSeek → 报告恢复 → 真机走一遍英文报告全链路确认好。
