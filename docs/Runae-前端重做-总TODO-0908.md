# Runae 前端重做 · 总 TODO（0908·Karen 口述·防丢）

> 结论：昨天(0907)的独角兽设计 mockup 在 `~/Documents/产品demo-0907/`（八字/紫微/塔罗/西占/面相/每日运势/裂变），但**没落地到线上**（线上还是简化方框版）。现在照 mockup 逐页实现。

## ✅ 进行中（6个 Sonnet agent 并行·照 mockup 实现·不commit不部署·全做完统一部署+Karen一起验）
- [ ] 八字 bazi.html ← runae-八字-redesign-mockup.html
- [ ] 紫微 ziwei.html ← runae-紫微-redesign-mockup.html
- [ ] 塔罗 tarot.html ← runae-塔罗-redesign-mockup.html
- [ ] 西占 astrology.html ← runae-西占-redesign-mockup.html
- [ ] 面相 mianxiang.html ← runae-面相-redesign-mockup.html
- [ ] 每日运势 daily.html ← runae-每日运势-mockup.html

## 📋 待办（Karen 新加·排队做）

### A. 设计范围要扩到"进去后的页面"
- **进入后产生的页面（报告页/结果页）也要有设计**，不能只做 landing/输入页。报告页现在功能在但样式要跟上独角兽设计。

### B. 英文页全套（按同一设计·只翻译中英文）
- 英文方法页（bazi-en/ziwei-en/hehun-en/mianxiang-en/lp-tarot-en）**照中文这套独角兽设计做，内容中译英**。
- ⚠️ 英文西占页缺失（无 astrology-en），要补。

### C. 合婚页
- 合婚（hehun）**没有 mockup**，需先出设计稿再实现。

### D. 接入中台 Google OAuth 登录
- Runae 接**增长中台(hub)的 Google 一键登录**（hub 已有 `Google/Apple id_token 验证流`）。功能任务。

### E. 后端问题：手相
- 之前 Runae **后端有问题·手相(shouxiang)**。需排查 `/api/shouxiang` 后端逻辑（历史：无照片时不该编造手相纹路；照片守卫）。待 Karen 补充具体现象。

### F. 🔴找回"消失的好看英文八字页"
- Karen：**之前英文八字有一个好看的页面，现在没有了**（疑被覆盖）。→ 从 git 历史 / 浏览器历史找回。

### G. 付款后报告页设计（参照之前）
- 付款后生成的报告：**文字/内容/长短/按不同价格分层**——**参照之前设计的**（Karen 电脑里有导出的 PDF 可作参考）。
- 报告 PDF 参考位置待定位（`~/Documents` 下有 Runae 营销PDF，用户报告PDF样张待找）。

### H. 每月给用户发 PDF（留存功能）
- 订阅用户**每月自动生成并推送一份 PDF 报告**（留存/续费钩子）。

### I. 推续费 + 裂变
- **续费推送**（到期提醒/挽留）+ **裂变**（邀请奖励·堵刷）——复用中台 hub 的续费/裂变能力。

### J. 🔴找回"绿色圆环"总页面
- Karen：Runae **总页面(首页)有个绿色圆环的好看版本，现在没了**。→ 挖 git 历史找回（待确认是中文首页 index.html 还是英文 home-en.html）。

### K. AI 对话功能
- Runae 的 **AI 对话**那块（待 Karen 明确：是命理问答对话？还是心声姐类陪聊？）也要做/接。

### L. 报告字数按付费分层（确认）
- **不同付费档限制不同字数的报告**（历史有"字数节奏铁律"）——低档短、高档长。报告 PDF 也要好看。

### M. 找回/复用之前的 Runae 裂变海报
- Karen 之前**做过 Runae 裂变海报**，找出来复用（待定位）。

### N. 小红书内容方向
- 小红书选题：**性格、合婚、命运** 类。

## 已修/已上线（别重复做）
- bazi 桌面滚动 bug ✅（commit 91ebe95 已部署）
- 昨天(0907)那批：时柱算错、假数据清理、报告可视化、三首页重构、$9.9超收 ✅ 已上线

## 规矩
- 设计先行（mockup 先给 Karen 拍板）；禁框套框；禁编造假数据（合规红线）；同意门文字对比度足够。
- 生产分支 `deploy-candidate-0907`；部署 = push + 服务器 `git reset --hard` + `pm2 restart`（纯前端可不 restart）。
