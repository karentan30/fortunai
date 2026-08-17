# Runae 开源命理引擎/Skill 参考（vendor来源清单）

> 架构铁律：**脚本算卦·AI解卦**（天文计算+真随机交给代码，干支/牌义翻译成人话交给LLM）。别让LLM算八字，就像别让日历库写运势。
> 已vendor：`server/lib/bazi-engine/` ← 自 **bazi-ziwei-skill**（八字+紫微·命理专家验过零硬错·真太阳时校正）。

## ⭐最优先：全家桶引擎（vendor一个=拿一批系统真引擎·"最全AND真准"最快路）
- **metaphysics-synthesis** — 八字/梅花易数/六爻/风水/塔罗 **五合一**·Python各系统独立排盘·AI只翻译
- **ai-divination-skills** — 塔罗/易经/小六壬/八字 打包 + 自带MCP Server

## 榜单Top10（GitHub关注度）
- Renhuai123/ziwei-doushu — 紫微
- jinchenma94/bazi-skill — 八字排盘品类第一(840 installs·真太阳时)
- **dzcmemory-web/bazi-ziwei-skill** — 八字+紫微【我们已用】
- CNWU16/vedic-astro-skills — 吠陀(印度·大市场)
- learnwithu/mingli-master · hhszzzz/taibu · Brhiza/mingyu · Horace-Maxwell/horosa-skill
- **Sudo-Biao/suangua** — 六爻/算卦
- xuemian168/bazi-skill

## 按功能对应的vendor源
- 六爻/I-Ching → suangua / metaphysics-synthesis / ai-divination-skills
- 奇门遁甲/紫微 → FANzR-arch/Numerologist_skills · ziwei-doushu
- **吠陀 Vedic** → CNWU16/vedic-astro-skills · project-astrology-vedic(27 Nakshatras·120年大运)
- 塔罗 → tarot-guide(78牌·正逆位·元素) · metaphysics-synthesis
- **月老/姻缘** → **Ming-H/yinyuan-skills**（赛博红线·对应love-destiny功能）
- 韩国사주 → saju-fortune(494 installs·阴阳历转换)

## persona/角色类skill（Rún人设+病毒功能的料·以后做）
大师(xr843/Master-skill) · X导师(x-mentor) · 前任(therealXiaomanChu/ex-skill·暗黑但爆"chat with your ex") · 自己(yourself-skill·人格镜子) · 蒸馏(forge-skill·复刻思考方式) · 博主(chat_with_me)

## 市场信号（skills.sh）
玄学AI skill安装量比想象高：3体系(八字/吠陀/塔罗)16 skill 2000+安装·"白天debug代码晚上debug人生"。验证Runae"最全占卜平台"方向。

> license/依赖/能否node调 逐个vendor前核实（引擎vendor agent产出见 `runae-engines-vendor.md`）。
