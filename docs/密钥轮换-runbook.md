# Runae 密钥轮换 Runbook

> ⚠️ **红线:本文件只写"流程",绝不写任何密钥的真实值。** 密钥的值只活在服务器 `/opt/shenyuan/server/.env`,永不进 git、永不贴聊天。
> 上次泄露事故的根因就是 `.env.bak` 被 `git add` 进了库。`.gitignore` 现已挡住 `.env` 和 `*.bak`。
>
> 两台机器如何"共享"密钥:**不共享值**,而是两台都 SSH 到同一台服务器(`47.242.80.65`)操作同一个 `server/.env`。值从不落到任何一台笔记本。

## 基础事实
- 生产服务器:`root@47.242.80.65`,项目 `/opt/shenyuan`,后端 cwd = `/opt/shenyuan/server`
- 环境变量来源:`server/.env`(由 `server/index.js` 顶部 `dotenv.config({ override:true })` 加载)
- PM2 进程名:`shenyuan`;改完 `.env` 必须 `pm2 restart shenyuan` 才生效
- admin 接口鉴权:`x-admin-token` 头 或 `?token=`,与 `process.env.ADMIN_TOKEN` 比对
- 改 `.env` 前先备份:`cp .env ".env.bak.$(date +%Y%m%d_%H%M%S)"`(`.bak` 已 gitignore)

---

## A. 轮换 ADMIN_TOKEN(可全自动·值不出服务器)

服务器上一条命令搞定(值用 `openssl` 在服务器现生成,不打印):

```bash
ssh root@47.242.80.65 'cd /opt/shenyuan/server
OLD=$(grep "^ADMIN_TOKEN=" .env | cut -d= -f2-)
NEW=$(openssl rand -hex 32)
cp .env ".env.bak.$(date +%Y%m%d_%H%M%S)"
sed -i.tmp "s|^ADMIN_TOKEN=.*|ADMIN_TOKEN=${NEW}|" .env && rm -f .env.tmp
pm2 restart shenyuan >/dev/null 2>&1; sleep 4
echo "新 token: $(curl -s -o /dev/null -w %{http_code} "http://localhost:3021/api/ab-stats?token=${NEW}") (期望200)"
echo "旧 token: $(curl -s -o /dev/null -w %{http_code} "http://localhost:3021/api/ab-stats?token=${OLD}") (期望401)"'
```

- 验证标准:新 token → 200,旧 token → 401,`pm2` 状态 online。
- 若哪台机器/脚本需要新值:SSH 上去 `grep "^ADMIN_TOKEN=" .env`,不要拷到 git。
- ⚠️ 下游消费者(若有硬编码旧 token 的定时任务/脚本/云 routine)需同步更新,否则会 401。目前代码内均走 `process.env`,重启即同步。

## B. 轮换 STRIPE_WEBHOOK_SECRET(需人工在 Stripe 后台 roll)

只有账户持有人能进 Stripe 后台 roll,分两步:

**① 在 Stripe 后台 roll(人工)**
1. 右上角 **Test mode 关掉**(生产用 Live 的 webhook)
2. **Developers → Webhooks**(新版可能叫 Event destinations)→ 点 URL = `https://runae.app/api/stripe-webhook` 那条端点
3. **Signing secret → Roll secret**,旧密钥失效选 **24 hours**(留缓冲防漏单)
4. Reveal 复制新的 `whsec_...`

**② 把新值装进服务器(值不进聊天/git)**
把新 `whsec_` 存成纯文本 `/tmp/whsec.txt`(只放那一串),然后:

```bash
cat /tmp/whsec.txt | tr -d "\n\r " | ssh root@47.242.80.65 'W=$(cat); cd /opt/shenyuan/server
cp .env ".env.bak.$(date +%Y%m%d_%H%M%S)"
sed -i.tmp "s|^STRIPE_WEBHOOK_SECRET=.*|STRIPE_WEBHOOK_SECRET=${W}|" .env && rm -f .env.tmp
pm2 restart shenyuan && echo OK'
rm -f /tmp/whsec.txt   # 用完立即删
```

- 用管道把值灌进 ssh 的 stdin,值**不出现在本地命令文本、不出现在服务器进程列表**。
- 验证:Stripe 端点页 **Send test webhook** → 返回 **200** 即成功;400/401 说明没对上。

---

## 出事回滚
- `.env` 每次改前都有 `.env.bak.<时间戳>`;回滚 = `cp .env.bak.<时间戳> .env && pm2 restart shenyuan`。

## 历史
- 2026-09-09:轮换 ADMIN_TOKEN(旧值作废验证 401)。STRIPE_WEBHOOK_SECRET 由 Karen 在 Stripe 后台 roll + 服务器装新值。
