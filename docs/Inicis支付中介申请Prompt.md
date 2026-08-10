# Inicis 支付中介申请 - 操作Prompt

## 目标
通过Inicis (이니시스·韩国最大支付聚合商) 快速接入KakaoPay/NaverPay/信用卡支付，为韩国用户提供多种支付方式。

**优势**：韩国最稳定的PG·已集成所有主流支付方式·审核2-3天

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
- 交易手续费：**2.7-3.5%**（取决于交易量）
- 结算周期：**T+1或T+2**

---

## 申请步骤

### 第一步：打开Inicis官网

```
官网：https://www.inicis.com
选择语言：English / 한국어
点击：Merchants / 가맹점 신청 / Apply Now
```

或直接打开商户申请页面：
```
https://www.inicis.com/merchant/apply
```

### 第二步：选择商户类型

| 字段 | 选择 | 说明 |
|------|------|------|
| **Merchant Type** | General Merchant / 일반 가맹점 | 在线商户 |
| **Country** | Hong Kong | |
| **Business Type** | E-Commerce / Software & Services | 选E-Commerce |
| **Business Category** | Digital Services / Consultation | 或选Entertainment |

### 第三步：填写公司信息

| 字段 | 填写内容 | 说明 |
|------|--------|------|
| **Company Name (English)** | Capstone IQ Group Limited | 营业执照名称 |
| **Company Name (Korean/选填)** | 캡스톤 아이큐 그룹 리미티드 | 可跳过 |
| **Registration Number** | 3054659 | CR号 |
| **Business Address** | Flat 902A, 9/F, Richmond Comm Bldg, 111 Argyle St, Mongkok, Kowloon, Hong Kong | 完整地址 |
| **Phone Number** | +852-XXXX-XXXX | HK电话 |
| **Email Address** | [Karen@email.com] | 收通知用 |
| **Website (선택)** | 如有善缘官网 | 可选 |

### 第四步：填写代表人信息

| 字段 | 填写内容 | 说明 |
|------|--------|------|
| **Representative Name** | Mutian Liu / 劉牧天 | 法人名字 |
| **Passport Number** | EE3472440 | 法人护照号 |
| **Date of Birth** | 1989-03-10 | 法人生日 |
| **Contact Email** | [邮箱] | 个人邮箱(如有) |

### 第五步：填写结算账户

| 字段 | 填写内容 | 说明 |
|------|--------|------|
| **Settlement Currency** | HKD 或 KRW | 建议选HKD(自动换汇) |
| **Bank Name** | The Hongkong and Shanghai Banking Corporation | HSBC |
| **Account Number** | 040199499838 | 账号 |
| **Account Holder** | Capstone IQ Group Limited | 户名 |
| **SWIFT Code** | HSBCHKHHHKH | 国际代码 |

### 第六步：上传身份文件

在 **Documents / 첨부파일** 部分上传：

```
✓ Business License (营业执照NNC1)
  - 文件名: Capstone-NNC1-Certificate.pdf
  - 要求: 彩色清晰

✓ Representative Passport (法人护照)
  - 文件名: Mutian-Liu-Passport-EE3472440.pdf
  - 要求: 护照信息页清晰

✓ Address Proof (地址证明)
  - 文件名: Address-Proof-111-Argyle-St.pdf
  - 要求: 3个月内

✓ Bank Proof (银行证明)
  - 文件名: Bank-Proof-HSBC-040199499838.pdf
  - 要求: 最新的
```

### 第七步：填写业务信息

| 字段 | 填写内容 | 说明 |
|------|--------|------|
| **Business Description** | Online fortune reading and astrology services. We provide saju (Four Pillars) reading reports and divination services for Korean users. | 简述业务 |
| **Monthly Sales Volume (예상)** | $5,000 - $10,000 USD | 预估月交易额 |
| **Primary Customer Base** | South Korea | 主要市场 |
| **Payment Methods Needed** | Credit Card / Debit Card / KakaoPay / NaverPay | 需要的支付方式 |

### 第八步：同意条款并提交

```
✓ 检查所有信息无误
✓ 同意 이용약관 (服务条款)
✓ 同意 개인정보처리방침 (隐私政策)
✓ 点击 신청 / Submit / 提交
```

---

## 预期结果

### ⏱️ 审核时间
**2-3个工作日** — 韩国最快的PG

### 📧 获得信息
审核通过后收到邮件，包含：
```
Merchant ID (가맹점ID)    : xxxxx
API Key                   : sk_inicis_live_xxxxx
Secret Key               : sk_secret_xxxxx
Settlement Account Setup  : 完毕
Ready to go live!
```

### 下一步
1. 收到Key后通知我
2. 我改代码接入Inicis
3. 测试 → 上线
4. **费用比直接申请多2.7-3.5%，但能快速live**
5. KakaoPay/NaverPay批了后切换过去（省钱）

---

## Inicis 的优势

✅ 韩国最大PG·市场占有率最高  
✅ 已集成KakaoPay/NaverPay/信用卡  
✅ 审核快(2-3天)  
✅ 稳定性最高  
✅ 24/7客服支持  

---

## 常见问题

**Q: 为什么要用PG中介？**  
A: 快速live。直接申请KakaoPay/NaverPay要5-6天，中介2-3天就能收款。等官方批了再切换。

**Q: 用了Inicis后，KakaoPay/NaverPay还能用吗？**  
A: 当然。Inicis就是个临时方案。官方支付方式批了后，改代码切换过去，停用Inicis即可。

**Q: 费用会不会很贵？**  
A: Inicis 2.7-3.5% vs 官方2.9-3.6%，差不多。但能快速上线，值得。

**Q: 能同时申请多个PG吗？**  
A: 可以。我们同时申请了SmartRro，哪个先批就先用哪个。

**Q: 支付流程是怎样的？**  
A: 用户选支付方式 → Inicis收款 → T+1/T+2入账HSBC → 到账

---

## 💡 小贴士

1. **邮箱很关键** — 所有通知都发邮箱，确保能收到
2. **文件命名** — 必须英文名(不要中文)
3. **银行信息准确** — 否则入账有问题
4. **回复及时** — 客服问题要24小时内回复

---

## ✅ 提交前检查清单

- [ ] 所有字段已填写
- [ ] 营业执照清晰彩色
- [ ] 护照号正确(EE3472440)
- [ ] 银行信息准确(HSBC 040199499838)
- [ ] 文件名都是英文
- [ ] 邮箱能正常接收
- [ ] 已同意条款

**提交！** → 等2-3天 → 获得Key → 通知我改代码
