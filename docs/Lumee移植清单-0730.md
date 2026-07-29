# 善缘照抄 Lumee 基本功能 · 移植清单（0730）

> Karen"基本功能直接抄 Lumee"。行号指 `~/projects/lumee/server.py`（31,707行）。只读产出，未改任何文件。
> **优先级：①双计量钱包+成功才扣 → ②三轴军师引擎+危机护栏 → ③affiliate归因加固版。** 认证善缘已有简版，补游客token+claim即可。
> ⚠️ **memory 里的 `xs_ref` 当前 Lumee 已不存在**，现用 `ref`(URL)+`affiliate_code`(订单)。别照 memory 抄。

---

## 🥇 优先级1：钱包/额度/计费（变现命门·先抄）
**核心=双计量**：贵的一维（TTS/生图/代烧=clone）与便宜的一维（八字文字=text）**分开计量守毛利**。
- 常量：`CLONE_MONTHLY/TEXT_MONTHLY`(137)会员月额度按1号重置 · `REWARD_REGISTER=(20,50)`(143)注册即得手机去重 · `ADDON_PACKS`(2208)加油包**永不过期** · `COIN_PACKS`(2215)充值**服务端权威·忽略客户端金额(防篡改)** · `GUEST_*`(175)游客限额
- users字段：`clone_balance/text_balance`(永久pool)+`addon_balance`+`coin_balance`+`plan/plan_expires`+`reward_register`(去重flag)。计量表 `usage`(text) / `usage_clone`(clone)。
- 核心函数：`_consume_dim(token,kind)`(8642)统一扣1句·返回`info.source`供精确退费 / `check_quota`(8704) / `refund_quota(token,source)`(8880)成功才扣的另一半·按source精确退原桶 / `quota_contract`(8787)前端`/api/quota`契约 / `charge_coins`(8588)扣币+写`coin_ledger`
- **"成功才扣"3处联动**：`_gate`(18421)对话前先扣记`_charged_source` → 业务成功 → **dispatcher except兜底(15641)异常自动`refund_quota`**。
- `_maybe_daily_clone_refill`(8622)免费用户每天首次+5句养习惯·防白嫖三闸(真实账号/当日去重/pool<15才补)。

**善缘照抄(Node+`_M`)**：`usage`表→`_M.usage[token][ym]=n`嵌套对象；`_month_key`→`new Date().toISOString().slice(0,7)`；**Node单线程内同步块天然原子·只要读余额和写余额之间不await就无需锁**(比Python简单)；成功才扣用Express中间件`req._charged={token,source}`+外层try/catch；**充值服务端权威`COIN_PACKS[product]`决定到账·绝不信客户端amount**(防刷钱)。
**坑**：`info.source`必须一路带到退费(否则退错桶·贵的clone白送)；addon永不过期vs月额度重置别混；**`_M`内存态重启丢数据·余额/订单上线前必须落盘或上DB/Redis**。

## 🥈 优先级2：军师对话引擎（善缘=命理师/开运顾问）
**三轴 = scene场景 × role角色 × stage阶段 拼system prompt。**
- scene：`SCENE_PROMPTS`(537中)/`SCENE_PROMPTS_EN`(696英)9场景×(companion+advisor)双版
- role：`_chat_role_axis`(1371)归一 ta|advisor · `ADVISOR_BASES`(1443)军师base
- stage：`STAGE_MODIFIERS`(1522)嵌套`{scene:{stage:{role_axis:叠加文字}}}`
- 装配 `chat_system(...)`(2071)：选base→role分支→末尾叠stage mod。纯字符串拼接**零依赖逐行翻译即可(三套里最好抄)**。
- `/chat` `_chat`(18447)：请求`{scene_key,role,stage,history≤15,lang,...}`→响应`{text,quota,sentences_remaining,show_paywall,ai_disclosure,crisis}`；LLM `deepseek`(12567)model`deepseek-chat`·温度按场景分档(命理判词调低)。
- 付费墙时机 `_paywall_should_show`(8718)：会员/匿名不弹·逝者/纪念场景不弹·其余free第2条起弹。

**善缘照抄**：三轴词典→JS对象`{bazi:{advisor,companion},hehun:{...}}`；scene换命理场景、role换"麦玲玲式命理师/中立开运军师"；**护栏段(诚实/危机/不装真通灵)照抄=合规刚需**；`show_paywall+quota`回执直接搬给前端弹麦玲玲付费墙。
**坑**：危机override必须在扣费和LLM之前；history≤15控token；严肃场景调低温度别乱下断语。

## 危机护栏 + AI诚实护栏（跟军师绑死一起抄·硬合规）
- `detect_crisis(text)`(3935)→`self_harm|self_harm_soft|abuse|None`；关键词表(3251-3335)`_SELF_HARM_ZH_HARD`(直接触发)/`_SOFT`(丧词需第二信号共现防误弹)/`_CORROBORATE`/`_ABUSE`/`_IMMINENT`
- override(`_gate`18422)：命中危机→**不计费·不弹墙·不走AI人设**·直接返回热线卡`CRISIS_RESOURCES`(3197·已有12356/400-161-9995)+脱敏落`crisis_log`
- AI诚实(代码级非模型自觉)：`_is_ai_identity_challenge`(4180)→`_ai_honesty_reply`(4194)确定性回"我是AI"；`_is_revive_request`(4214)拒"变成我死去的妈"
- 善缘照抄：关键词表→JS数组·`.some(k=>text.includes(k))`·override在gate最前return。灵性场景"求消灾/想不开"不少·不能省。

## 🥉 优先级3：Affiliate推广码+归因分成（裂变·⚠️无xs_ref）
- 三表：`affiliates`(6023 code/kol_name/commission_rate默认0.20/统计) · `affiliate_attributions`(6043 anchor/code/landed_at·PK(anchor,code)=归因窗口表) · `orders.affiliate_code`(5992)
- 归因(last-touch·30天窗)：`GET /affiliate/{code}`(28185)记click→302到`/?ref=` → `POST /affiliate/track`(28124)前端读`?ref=`打点写归因表 → 下单`_read_affiliate_code`(28141)①body显式优先②否则`_affiliate_lookup_attribution`(12862)回查窗口内最近code兜底 → paid后`_affiliate_apply_commission`(12790)`commission=amount×rate`**仅统计不自动打款**
- helper：`_gen_affiliate_code`(12781)/`_affiliate_valid_code`(12829)/`_affiliate_record_landing`/`_affiliate_lookup_attribution`；admin `/admin/affiliate/create|stats`(28245/28289)
- **邀请系统与affiliate独立别混**：`invites`+`referrals`表·`_maybe_reward_inviter`(9111)好友留存后才发·幂等封顶防农场·`REWARD_INVITEE/INVITER`(148)

**善缘照抄**：三表→`_M.affiliates[code]`/`_M.affiliateAttr[anchor]`/订单带`affiliateCode`；**归因回查逻辑照搬加固版**。
**坑(Lumee血泪6035)**：归因断链——老链路只在下单当次body带code才归因→用户今天点几天后付(`?ref=`丢)→KOL白推。**修复=landing时就落归因表·下单无显式code回查窗口最近code**。善缘裂变必抄加固版。佣金率存码上(不同KOL不同)别写死。

## 认证+游客token（善缘已有简版·补差量）
- Lumee `/register`(26177)/`/login`(26262) token=uuid存users.token·PBKDF2·手机去重·注册奖励幂等
- **善缘值得补**：①游客token `/auth/guest`(24352)`g_`+32hex·7天·10次·每IP24h限3个 → "先算一卦"钩子 ②游客→注册claim合并`/clone/claim`(25130)`UPDATE SET token=? WHERE token=guest_token` → "游客算的命/生成的符注册后保留"

## 真人连麦（Agora·后期·只记接口层）
两路：咨询师发起`/consult/call/start`(14442)+用户拨`/call/create`(14736)。计费`_call_fee`(10229)=`ceil(秒/60)×元/分`**向上取整**；`/call/end`(14900)返`{fee_charged,credit_delta}`；`/call/timeout`(14971)超时退；双方同意才云录音；费率护栏3-30元/分。
善缘只抄**对外接口契约**(create返`{channel,agora_token,uid,app_id,expires_at}`/end收`{duration_seconds}`)+向上取整计费。接同一Agora账号即可·**优先级最低**(先靠八字付费墙+代烧)。

---
*Lumee 移植清单·0730·只读产出。配套：善缘裂变v1(邀请码+善缘币账本)已建，是上面affiliate/邀请体系的第一步。*
