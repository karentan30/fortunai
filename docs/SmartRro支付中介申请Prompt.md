# SmartRro 支付中介申请 - 操作Prompt

## 目标
通过SmartRro (스마트알로·新兴快速PG) 快速接入支付，为韩国用户提供KakaoPay/NaverPay/信用卡支付。

**优势**：审核最快(1-2天)·初创友好·零门槛·已集成主流支付

---

## 前置准备

### 📋 需要的材料
- [ ] Capstone营业执照(NNC1) PDF
- [ ] 法人护照首页 PDF
- [ ] 公司地址证明 PDF
- [ ] 银行账户证明(HSBC 040199499838) PDF
- [ ] 公司邮箱
- [ ] HK电话号码

### 💰 费用结构
- 注册费：**免费**
- 交易手续费：**2.5-3.2%**（比Inicis便宜一点)
- 结算周期：**T+1**（更快）

---

## 申请步骤

### 第一步：打开SmartRro官网

```
官网：https://smartro.kr
选择语言：English / 中文
点击：Merchants / 가맹점 / Sign Up
```

或直接打开商户申请：
```
https://smartro.kr/merchant/signup
```

### 第二步：选择账户类型

| 字段 | 选择 | 说明 |
|------|------|------|
| **Account Type** | Business / 사업자 | 企业账户 |
| **Business Type** | E-Commerce / 전자상거래 | 在线商务 |
| **Country** | Hong Kong / 홍콩 | |

### 第三步：填写基本信息

| 字段 | 填写内容 | 说明 |
|------|--------|------|
| **Company Name (English)** | Capstone IQ Group Limited | 营业执照名称 |
| **Company Name (Korean/선택)** | 캡스톤 아이큐 그룹 | 可选 |
| **Business Registration Number** | 3054659 | CR号 |
| **Industry** | Digital Services / Software | SaaS/在线服务 |
| **Company Website** | 如有善缘官网 | 可选 |
| **Phone (Company)** | +852-XXXX-XXXX | HK电话 |
| **Email (Company)** | [Karen@email.com] | 必填·很关键 |

### 第四步：填写法人信息

| 字段 | 填写内容 | 说明 |
|------|--------|------|
| **Representative Name** | Mutian Liu | 法人名字 |
| **Passport/ID Number** | EE3472440 | 护照号 |
| **Date of Birth** | 1989-03-10 | 生日 |
| **Nationality** | Chinese | 国籍 |
| **Personal Email** | [邮箱] | 个人邮箱 |
| **Personal Phone** | +852-XXXX-XXXX | 个人电话 |

### 第五步：填写结算账户

| 字段 | 填写内容 | 说明 |
|------|--------|------|
| **Account Currency** | HKD | 港币(自动换KRW) |
| **Bank Name** | The Hongkong and Shanghai Banking Corporation | HSBC |
| **Account Number** | 040199499838 | 账号 |
| **Account Holder Name** | Capstone IQ Group Limited | 户名 |
| **SWIFT Code** | HSBCHKHHHKH | 国际代码 |

### 第六步：上传文件

在 **Documents / 서류** 上传：

```
✓ Business License (营业执照)
  - 文件名: Capstone-NNC1-Certificate.pdf
  - 格式: PDF or JPG
  - 要求: 彩色清晰·CR号清晰

✓ Passport (法人护照)
  - 文件名: Mutian-Liu-Passport-EE3472440.pdf
  - 要求: 护照首页清晰

✓ Address Proof (地址证明)
  - 文件名: Address-Proof-111-Argyle.pdf
  - 要求: 3个月内·包含公司名

✓ Bank Statement (银行证明)
  - 文件名: Bank-Proof-HSBC-040199499838.pdf
  - 要求: 最近的
```

### 第七步：填写业务说明

| 字段 | 填写内容 | 说明 |
|------|--------|------|
| **Business Description** | We provide online fortune reading and astrology services (Saju, Four Pillars divination). Our service targets Korean users and offers detailed fortune reports and predictions. | 简述业务 |
| **Service Type** | Digital Service / Subscription | 选数字服务 |
| **Expected Monthly Volume** | $5,000 - $10,000 | 预估月交易额 |
| **Primary Market** | South Korea | 主市场 |
| **Payment Methods** | Credit Card / Debit Card / KakaoPay / NaverPay | 需要支付方式 |

### 第八步：选择支付方式

SmartRro会列出可用的支付方式，勾选：
```
☑ Credit Card / Debit Card
☑ KakaoPay (카카오페이)
☑ NaverPay (네이버페이)
☑ Toss (토스) [可选]
```

### 第九步：同意条款

```
✓ 검토 및 동의 (阅读并同意)
✓ 서비스 이용약관 (服务条款)
✓ 개인정보 처리방침 (隐私政策)
✓ 점击 신청완료 / Submit / 提交
```

---

## 预期结果

### ⏱️ 审核时间
**1-2个工作日** — 韩国最快PG

### 📧 获得信息
邮件包含：
```
Merchant ID           : SR_xxxxx
API Key (라이브)       : sk_smartro_live_xxxxx
Secret Key            : sk_secret_xxxxx
Webhook URL           : [配置地址]
Ready to accept payments
```

### 下一步
1. 收到Key → 通知我
2. 我改代码接SmartRro
3. 测试 → 上线
4. **SmartRro先live(1-2天)，Inicis后live(2-3天)**
5. KakaoPay/NaverPay官方批了 → 全部切换到官方(省钱)

---

## SmartRro vs Inicis

| 对比 | SmartRro | Inicis |
|------|----------|--------|
| **审核速度** | ⭐⭐⭐⭐⭐ 1-2天 | ⭐⭐⭐⭐ 2-3天 |
| **手续费** | 2.5-3.2% | 2.7-3.5% |
| **稳定性** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **市场占有率** | 新兴(小) | 最大(大) |
| **初创友好** | ✅ 很友好 | ✅ 友好 |

**结论**：SmartRro快速上线·Inicis稳定运营·两个都申请最保险

---

## 常见问题

**Q: SmartRro和Inicis哪个先申请？**  
A: 同时申请。哪个先批就先用哪个。

**Q: SmartRro会不会不稳定？**  
A: SmartRro虽然小，但在快速支付领域口碑不错。而且我们有Inicis作备选。

**Q: 用SmartRro的同时还能用Stripe KRW吗？**  
A: 当然。用户可同时选择信用卡(Stripe) / SmartRro / Inicis 多种方式。

**Q: 费用真的比Inicis便宜？**  
A: 是的。SmartRro 2.5-3.2% vs Inicis 2.7-3.5%，便宜一点。但差异不大。

**Q: 结算快吗？**  
A: SmartRro T+1(最快)。Inicis T+1/T+2。都不错。

---

## 💡 小贴士

1. **邮箱最关键** — SmartRro会频繁邮件确认，务必监控邮箱
2. **文件必须英文名** — 不要中文·不要韩文
3. **24小时内回复** — 客服要求时要快速响应(SmartRro会催)
4. **电话可能会打过来** — 做好接电话的准备
5. **业务说明要诚实** — SmartRro对业务内容审查比较严(但占卜/占星是合法的)

---

## ✅ 提交前检查清单

- [ ] 所有必填字段完成
- [ ] 营业执照彩色清晰(CR号清晰)
- [ ] 护照号准确(EE3472440)
- [ ] 银行信息无误(HSBC 040199499838)
- [ ] 所有文件英文命名(无中文)
- [ ] 邮箱能正常接收
- [ ] 业务说明清晰准确
- [ ] 已同意所有条款

**提交！** → 等1-2天 → 获得Key → 通知我

---

## SmartRro 客服

- **웹사이트**: https://smartro.kr
- **고객센터**: support@smartro.kr
- **회사번호**: +82-2-XXXX-XXXX
- **응답시간**: 평일 9:00-18:00 (韩国时间)

**邮件优先** — 国际商户用邮件沟通更清楚
