# 密钥轮换 Runbook（Runae / 善缘）

> 本文档被 `docs/交接-Runae大重构-0910.md` 引用，但此前从未提交过（悬空引用）。
> 由 CEO 会话于 2026-09-11 补齐。**只写步骤，不写任何密钥值。**

---

## 0. 为什么要轮换

**事故**：0908–0909 收尾时用 `git add -A` 误把 `server/.env.bak`（含 `ADMIN_TOKEN` +
`STRIPE_WEBHOOK_SECRET`）提交并 push 到 GitHub `karentan30/fortunai`。

**已做的补救**：`filter-branch` 从整个分支历史清除 + force-push + 本地/服务器清理 +
`.gitignore *.bak`。哈希比对确认泄露的 2 个值**当时就是生产在用的值**（不是旧废值）。

**为什么补救不等于根治**：GitHub 可能短期仍保留旧 commit 对象（直连 SHA 仍可访问，
直到它 GC）；在泄露时间窗内 clone/fork 过的人手里就有；GitHub secret scanning 可能
已把 Stripe secret 标记。**只有轮换能根治。**

---

## 1. 当前状态（2026-09-11 核实）

| 密钥 | 状态 | 说明 |
|---|---|---|
| `ADMIN_TOKEN` | ✅ 已轮换 | 0910 交接记录 |
| `STRIPE_WEBHOOK_SECRET` | ❌ **待轮换** | 只有你能进 Stripe 后台 |
| 生产盘上的 `.env.bak.*` | ❌ **未清** | 见第 4 节，文件还在 |

**已核实的事实**（本次 SSH 直查，未读取任何值）：
- 生产 env 文件 = `/opt/shenyuan/server/.env`（root:root，1151 字节）
- 其中确实存在 `STRIPE_WEBHOOK_SECRET` 这一行
- 同目录下还留着两个**含密钥的备份**：
  - `/opt/shenyuan/server/.env.bak.20260908_1247`
  - `/opt/shenyuan/server/.env.bak.20260909_195519`

**代码侧的硬约束**（决定了"改完必须重启"）：

```
server/routes/payment.js:76    const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
server/routes/payment.js:315   event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
```

这是**模块加载时**读进常量的 —— 改了 `.env` 只 `pm2 reload` 不够，**必须 `pm2 restart shenyuan`**。
验签失败时代码会拒绝事件并打 `[WEBHOOK] 缺 STRIPE_WEBHOOK_SECRET, 拒绝未验签事件`。

---

## 2. 轮换 `STRIPE_WEBHOOK_SECRET`（约 5 分钟）

> ⚠️ **先做这步再删 .env.bak**。轮换后旧值自动失效，残留文件的危害才真正归零。

### Step 1 — Stripe 后台 roll secret（只有你能做）

1. 登录 Stripe Dashboard → **Developers（开发者）** → **Webhooks**
2. 找到指向 `https://runae.app/api/stripe-webhook` 的那个 endpoint
   （**注意：可能有多个 endpoint，逐个确认哪个在用它**）
3. 点进 endpoint → **Roll secret**（或 "Roll signing secret"）
4. 复制新的 `whsec_...`

> 📌 Stripe 的 roll 是**立即生效**：旧 secret 在那一刻起验签失败。
> 所以 Step 1 和 Step 3 之间有个**空窗**，期间到达的 webhook 会被拒。
> 建议挑低峰期做，并且**准备好马上执行 Step 2–3**（不要 roll 完就走开）。

### Step 2 — 更新生产 `.env`

```bash
ssh -i ~/.ssh/hk_deploy root@47.242.80.65

# 先备份（这次备份放对地方：不要留在 web 根目录，见第 4 节）
cp /opt/shenyuan/server/.env /root/.env.backup.$(date +%Y%m%d_%H%M)

# 编辑，只改 STRIPE_WEBHOOK_SECRET 这一行
nano /opt/shenyuan/server/.env
```

> 本机（Windows）Git Bash 的 ssh 需要显式 `-i`，见 `docs/交接-0907最新-已上线状态.md` 的部署命令。

### Step 3 — 重启 + 验证

```bash
pm2 restart shenyuan
pm2 logs shenyuan --lines 50        # 确认没有 "[WEBHOOK] 缺 STRIPE_WEBHOOK_SECRET"
```

**验证必须做真实回调**，不能只看进程起没起来：

- [ ] Stripe Dashboard → Webhooks → 该 endpoint → **Send test webhook**
      （选 `checkout.session.completed`）→ 应返回 **200**，不是 400
- [ ] `pm2 logs` 里**没有**验签失败
- [ ] 用一笔**真实小额订单**走完整链路：付款 → webhook 回来 → 发货/解锁正常
      （测试模式用 test key 即可，见 `STRIPE-支付宝微信-开通清单-0909.md` 第 6 节）

---

## 3. 顺带确认 `ADMIN_TOKEN` 真的换过了

0910 交接记录说已轮换，但**没有验证记录**。确认方式（不打印值）：

```bash
# 值变没变：和泄露的旧值比对哈希即可（旧值你手上有）
ssh -i ~/.ssh/hk_deploy root@47.242.80.65 \
  'grep "^ADMIN_TOKEN=" /opt/shenyuan/server/.env | sha256sum'
```

`ADMIN_TOKEN` 是**全能钥匙** —— `store.js` 里 5 处判定它是 `unlimited` / `master` 权限，
`divination.js` 里是审核绕过。泄露 = 任何人可白嫖全部付费内容。**这个比 webhook secret 更致命。**

---

## 4. 清掉生产盘上的 `.env.bak.*`（轮换后做）

```bash
ssh -i ~/.ssh/hk_deploy root@47.242.80.65

# 先确认轮换已完成、服务正常，再删
rm -f /opt/shenyuan/server/.env.bak.20260908_1247
rm -f /opt/shenyuan/server/.env.bak.20260909_195519

# 确认清干净
ls -la /opt/shenyuan/server/.env*
```

> ⚠️ **删之前先确认第 2 节已完成**。这两个文件里就是泄露过的那两个值；
> 在轮换之前删掉它们只是减少暴露面，不等于消除风险。
>
> 同时注意：以后备份 env **不要放在 `/opt/shenyuan/server/` 下**——
> 那是 git 仓库目录，`git add -A` 一次就重演事故。放 `/root/`。

---

## 5. 红线

- **密钥值永不进 git、永不进聊天、永不进截图**。本文档只写变量名和步骤。
- 改 `.env` 后**必须 `pm2 restart shenyuan`**（`payment.js:76` 是模块加载时读常量）。
- 轮换有**短暂空窗**（旧 secret 立即失效），挑低峰期、一次做完。
- Stripe 后台**可能有多个 webhook endpoint**，确认你 roll 的是生产在用的那个。

---

## 6. 做完之后

- [ ] 更新 `docs/交接-*.md`：把"webhook secret 待轮换"从待办里划掉
- [ ] 本文件第 1 节的状态表同步为"✅ 已轮换"
- [ ] `docs/自检清单-上线前必过.md` 第 11 条的"模拟付款回调"命令 —— 改用测试订单号
      走真实链路验证（见第 7 节）

---

## 7. 相关：那条自己发布的"绕过说明书"

`docs/自检清单-上线前必过.md` 第 11 条，把以下命令写成"模拟付款回调"的验证手段：

```javascript
localStorage.setItem('sy_unlock_a', '1');   // 八字
localStorage.setItem('sy_paid_duanshi', '1'); // 断事问卦
localStorage.setItem('sy_hehun_paid', '1');   // 合婚
```

在付费墙还是**前端 CSS 遮罩**的年代，这等于**我们自己发布了一份绕过说明书** ——
而且它"能通过"恰恰说明付费墙是假的。所以这三个开关**必须逐个确认已失效**。

**本文档作者实测确认的（2026-09-11，匿名请求生产）：**

```
POST https://runae.app/api/bazi   （无鉴权、无订单号）
→ HTTP 200, 10,464 字节
→ reading 9,219 字符，含 ---LOCKED---
→ 但 ---LOCKED--- 之后只有 274 字符，内容是"去付款解锁"目录占位，
   不是真报告内容
→ 响应带 locked: true, tier: "basic"
```

**结论：`sy_unlock_a` 这条已失效** —— 服务端已改为切分下发，前端就算解锁也拿不到内容。
这是个真修复。

**⚠️ 但本条只覆盖 `/api/bazi`。** `sy_paid_duanshi`（断事）和 `sy_hehun_paid`（合婚）
**尚未实测**，不能假定同架构 —— 0909 留言板点名它们"待逐个核查"。
在后端确认之前，不要把这条当成已解决。

**该做的**：把清单第 11 条改成用**测试订单号走真实链路**验证
（付款 → webhook → 解锁），而不是前端伪造状态。伪造状态能"验过"的东西，
本来就不该出现在上线门禁里。
