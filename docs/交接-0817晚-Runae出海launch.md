# 善缘/Runae · 交接 2026-08-17晚

## 做了什么（本会话·多数已commit）

| 模块 | 一句话 | 状态 |
|---|---|---|
| chat神秘风页 | 切正式版·移动端/合规修 | ✅committed·prod |
| 八字精确排盘引擎 | yiqi-core进后端·中文路径注入(替代LLM猜盘) | ✅committed·prod·命理专家满分背书 |
| 合婚三档付费 | ¥9.9/39.9/199+大师连麦录单/api/hehun/book-consult | ✅committed |
| 合婚reframe | 默认恋爱(缘/你们的缘分)·囍只留"谈婚论嫁"档 | ✅committed(未部署) |
| **Runae品牌定名** | 出海英文名=Runae·域名**runae.app**(Gname支付宝已注册) | ✅ 见[[project_shenyuan_english_name_runae]] |
| Runae英文首页 home-en | 绿玉模板+"Get your life report"→bazi-en·金CTA·零编造 | ✅committed·prod(2efef72) |
| 韩语首页 home-kr | 绿玉+**선연**(韩区用本土名)+纯本土사주+sticky | ✅committed |
| PWA基建 | manifest/sw(api不缓存)/真PNG图标/离线页/推送脚手架 | ✅committed·prod |
| 落地页wave1→9.5 | 英文lp-en-bazi/master-EN/tarot-en/los-angeles + 韩语3页(선연)·**杀光假内容** | ✅committed(b7182a5·未部署) |
| 双语内容工厂 | bazi报告+缘分裂变 各10 TikTok+10 IG+hook公式(抄포스텔러) | ✅committed·docs/marketing/runae/ |

## 🚩 红线 / 关键发现

- **🚨报告质量审计=中文6/海外4.5·3个P0**（命理专家审出·付费核心硬伤）：
  ① **海外6语种(EN/KR/TH/ES/PT/IN)没接排盘引擎**→让LLM猜盘·会算错四柱·满盘皆错·$19卖瑕疵品（**Runae漏斗全导向这个·必修**）
  ② **token断裂**：prompt要1.2-1.8万字但maxTokens只够8-9千字→报告写到维度10-12就**硬截断**
  ③ **$199大师版虚价**：跟$19同prompt同开关无增量
  → **报告P0修复agent进行中·输出在working tree未提交未审**
- **价格全站不一致**：home=$19报告/$9.90会员·lp-master-EN=$4.99/$9.99/$24.99·韩语₩19000 vs ₩9900 → **待统一**
- **品牌双轨**：英文**Runae** / 韩国**선연**(去中国化·本土)
- **git/部署**：两会话并行·生产在HK **c76df47**(已含我的2efef72 Runae首页+PWA)·**本机代理挡GitHub·push/fetch不通**→部署一律**SSH到HK**·本地backend divination.js==生产(安全)·别覆盖c76df47的"合婚3吉日"

## ⚠️ 报告P0修复=agent已完成·**未审·勿直接部署**（已单独commit）
`server/routes/divination.js`（node --check过）：
- ✅P0-1 海外6 handler(KR/EN/PT/TH/ES/IN)+2 stream分支 全接排盘(baziChartBlock复用buildBaziBlock+各语言"禁自排"强约束)
- ✅P0-2 模型=qwen-plus·真实上限16384token(已到顶·调不高)→字数目标降"9000-11000字"+强调收尾不截断
- ✅P0-3 $199 VIP=detectBaziVip命中后**第二次LLM调用追加4专属章节**(24个月逐月/分层化解/择时/终身叮嘱·中英已做)
- ✅P1 健康维度去西医病名点名
- **坑**：VIP只认order_no路径(登录购买bazi_vip可能不含增量·需store.js加baziTier才全覆盖·代码已注释)·stream版+pt/th/es/in的VIP增量未做
- **🚦下轮必做：命理专家复审这份P0修改→达标才SSH部署HK**（付费核心·产审分离·别跳过）

## ⚠️ 未完成（agent撞Karen额度挂了·working tree里是半成品）
- `pages/lp-new-york/toronto/vancouver/sydney.html` 4地理页**没做完·半成品·下轮重做**（别用别commit当前working tree版本）

## 待办（优先级）
1. **P0** 报告3个P0修完→命理专家复审→SSH部署HK（Runae能上线的前提）
2. **P0** 4地理页做完+审+commit
3. **P0** 全站价格统一（报告$19/会员$9.90/大师$199/韩语档）
4. **P0** runae.app配DNS→HK `47.242.80.65`+Caddy自动HTTPS+PWA start_url·然后部署Runae前后端上线
5. P1 ES/PT/TH/IN落地页 wave2
6. P1 @runae社媒开铺内容工厂(docs/marketing/runae/已备料)
7. Karen手上：微信¥9.9亲测·法律页Capstone·hi@lumee.cn收信·PortOne·韩文校正

## 下一步
先修报告P0(否则给破报告导流=白烧)→统一价格→配runae.app DNS→部署Runae上线→开投流+铺内容工厂
