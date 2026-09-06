# Runae 上线 Runbook（2026-09-07 夜准备）

> 夜里我把优化都做完并**准备好一个可安全部署的分支**，但**没有擅自部署**——因为发现生产环境和分支**分叉**了（见下），盲部署会回退线上 SEO 并可能动到支付逻辑，这类必须你醒着＋能测支付时做。

## 现状（关键）
- 生产服务器 `47.242.80.65:/opt/shenyuan`，跑在 **main @ a1ad926**，PM2 进程 `shenyuan`（端口 3021，健康 200，已跑 28h）。
- 生产有**未入库的手改**：一堆 `.bak`、`pages/divination.js`、`server/data/affiliates.json`（**运行数据·别删**）。这些是 untracked，`git checkout` 不会动它们，但说明生产是手工维护态。
- 我夜里的工作在 **`launch-en-shop`**（已 push）。它和 main **分叉**：main 有 4 个线上 SEO/AEO 提交（en.html 的 FAQ schema、canonical 修正、Caddy /blog 重写修复），launch-en-shop 没有；两边都各自改过 `store.js/divination.js/payment.js`。
- **好消息：两者合并零冲突。** 我已生成合并分支 **`deploy-candidate-0907`**（= launch-en-shop + main），本地 `node --check` 全过、**能干净启动**（端口 3021），en.html 已确认**同时保留** main 的 FAQ schema 和我删 Blessing 的改动。已 push。

## 推荐上线步骤（你醒后，约10分钟）
> 用 `deploy-candidate-0907`（已合并 main，不会回退线上 SEO）。

```bash
ssh root@47.242.80.65
cd /opt/shenyuan

# 0) 备份当前生产 commit（回滚锚点）
PREV=$(git rev-parse HEAD); echo "ROLLBACK-> $PREV"    # 应为 a1ad926 附近
pm2 save

# 1) 拉取候选分支
git fetch origin
git checkout deploy-candidate-0907 || git checkout -b deploy-candidate-0907 origin/deploy-candidate-0907
git reset --hard origin/deploy-candidate-0907          # 注意：untracked 的 .bak/affiliates.json 不受影响

# 2) 依赖 + 重启后端
cd server && npm install --omit=dev && cd ..
pm2 restart shenyuan && sleep 3

# 3) 冒烟（三关都要过）
curl -s -o /dev/null -w "home:%{http_code}\n" http://localhost:3021/
# 3a 生成：真出报告（换成真实生辰）——必须返回含 reading 的 JSON
curl -s -X POST http://localhost:3021/api/bazi -H 'Content-Type: application/json' \
  -d '{"birthYear":1990,"birthMonth":6,"birthDay":15,"birthHour":10,"gender":"male","lang":"zh"}' | head -c 300; echo
# 3b 支付初始化：必须返回 checkout url / session（不用真付）
curl -s -X POST http://localhost:3021/api/create-checkout -H 'Content-Type: application/json' \
  -d '{"product":"report_unlock_a","currency":"usd"}' | head -c 300; echo

# 4) 若任一冒烟失败 → 立即回滚
# git checkout main && git reset --hard $PREV && cd server && pm2 restart shenyuan
```

## 上线后必查（防赔钱三洞——务必确认）
1. **生成类接口是否有鉴权+限频**：`/api/bazi`、`/api/daily` 等——免费无限调用=烧算力。middleware 已有 `rateLimitMiddleware`（payment 用了），确认生成路由也挂上。
2. **免费层限次**：同设备/同用户每日免费生成次数上限（前端 localStorage + 服务端）。
3. **付费正文不进未付费 DOM**：report-cn/report-en 付费段必须服务端鉴权后才下发，别只 CSS 遮罩。

## 仍需你决策/后续
- **report-en 价格 $2.99/$4.99 → $9.90**：价格由 Stripe 产品 `report_unlock_a/b` 决定（不是页面字符串）。要在 Stripe 后台改 price 或换 product，改完再同步页面显示，否则会"显示$9.90扣$2.99"。**需你在能测支付的环境做。**
- **#4 免费计算器→报告页 生辰透传**（免重输）：见 `launch-en-shop`，属前端增强，测通 prefill 后并入下次部署。
- 生产的 untracked `.bak`/`pages/divination.js` 建议清理归档（确认非线上依赖后）。

## 回滚一句话
`cd /opt/shenyuan && git checkout main && git reset --hard <PREV> && cd server && pm2 restart shenyuan`
