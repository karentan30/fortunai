# NaverPay 商户申请 - 操作Prompt

## 目标
用 Capstone IQ Group Limited (HK) 的名义申请NaverPay韩国商户账户，获取API Key和Secret进行支付接入。

---

## 前置准备（申请前必读）

### 📋 需要上传的材料
- [ ] Capstone营业执照（NNC1）彩色扫描版 PDF/JPG
- [ ] 法人护照首页（Mutian Liu, EE3472440）复印件
- [ ] 公司地址证明（香港地址：Flat 902A, 9/F, Richmond Comm Bldg, 111 Argyle St, Mongkok）
- [ ] 银行账户开户证明（HSBC 040199499838）
- [ ] 营业执照中英文翻译（可选·平台通常接受英文）

### 💰 费用
- 商户注册：**免费**
- 交易手续费：约 **2.9-3.6%**（询问客服最终费率）

---

## 申请步骤

### 第一步：打开NaverPay商户申请页面
```
访问：https://pay.naver.com
点击：가맹점 신청 / Merchant Application / 商户申请
选择语言：English(추천) / 한국어
```

### 第二步：选择商户类型

| 选项 | 选择 | 说明 |
|------|------|------|
| **商户主体类型** | 해외사업자 / Overseas Business | HK公司选"海外商户" |
| **업종 / Industry** | 소프트웨어·인터넷서비스 / Software & Internet | SaaS平台 |

### 第三步：填写基本信息

| 字段名 | 填写内容 | 说明 |
|------|--------|------|
| **Company Name (영문)** | Capstone IQ Group Limited | 与营业执照一致 |
| **Company Name (한글/可选)** | 영교 그룹 리미티드 | 韩文音译(可跳过) |
| **사업자번호 / Registration ID** | 3054659 | CR号 |
| **Representative Name** | Mutian Liu | 法人名字 |
| **Representative Passport** | EE3472440 | 法人护照号 |
| **Company Address (HK)** | Flat 902A, 9/F, Richmond Comm Bldg, 111 Argyle St, Mongkok, Kowloon, Hong Kong | 完整地址 |
| **Phone Number** | +852-XXXX-XXXX | HK电话 |
| **Email Address** | [你的邮箱] | Karen或财务邮箱·关键 |
| **Website (선택)** | 如有善缘官网 | 可选 |

### 第四步：上传身份验证文件

在 **첨부 / Attachments** 部分上传：

```
1️⃣ 营业执照 (필수 / 必须)
   - 파일명: CR_Certificate_3054659
   - 형식: PDF or JPG
   - 요구사항: 彩色清晰·CR号3054659清晰可见

2️⃣ 法人护照首页 (필수 / 必须)
   - 파일명: Passport_Mutian_Liu
   - 형식: PDF or JPG  
   - 요구사항: 护照信息页·Passport No. EE3472440清晰

3️⃣ 地址证明 (필수 / 必须)
   - 파일명: Address_Proof
   - 형식: PDF or JPG
   - 可用: 水电账单/银行对账单/公司信函
   - 요구사항: 3个月内·包含公司名和111 Argyle St地址

4️⃣ 银行开户证明 (권장 / 推荐)
   - 파일명: Bank_Statement
   - 银行名称: HSBC
   - 账号: 040199499838
   - 说明: 加快审核
```

### 第五步：填写财务信息 (정산계좌)

| 字段名 | 填写内容 | 说明 |
|------|--------|------|
| **정산통화 / Settlement Currency** | HKD → KRW | HSBC港币账户自动换汇 |
| **은행명 / Bank Name** | The Hongkong and Shanghai Banking Corporation | HSBC |
| **계좌번호 / Account Number** | 040199499838 | HSBC账号 |
| **계좌명의 / Account Holder Name** | Capstone IQ Group Limited | 户名 |
| **SWIFT코드 / SWIFT Code** | HSBCHKHHHKH | 国际转账代码 |
| **예상 월 거래액 / Monthly Expected Sales** | $5,000 - $10,000 | 估计月交易额 |

### 第六步：填写业务说明

| 字段名 | 填写内容 | 说明 |
|------|--------|------|
| **사업 설명 / Business Description** | Online astrology, fortune reading, and spiritual guidance platform serving Korean users | 简述核心业务 |
| **주요 상품 / Main Products** | Saju (Four Pillars) reading reports, fortune predictions, consultations | 主要服务 |
| **고객층 / Target Customer** | 25-45 year old Korean women interested in fortune reading | 目标用户 |

### 第七步：审查、同意并提交

```
✓ 检查所有信息
✓ 同意 서비스약관 (服务条款)
✓ 同意 개인정보처리방침 (隐私政策)
✓ 점击 신청 / Apply / 提交申请
```

---

## 预期结果

### ⏱️ 审核时间
- **2-3个工作日** 邮件通知结果

### 📧 获得信息（审批通过）
邮件内容包含：
```
Merchant ID (상인번호)     : MXXXXXXXX
API Key (API키)           : sk_naver_live_xxxxx  
Secret Key (비밀번호)      : sk_secret_xxxxx
Partner ID (파트너ID)     : PXXXXXXX
Merchant Name (상인명)    : Shenyuan
```

### 下一步操作
收到Key → 通知我 → 我配置到善缘后端 → Staging测试 → 韩国上线

---

## NaverPay 独特要点

**NaverPay vs KakaoPay 区别**：
- ✅ NaverPay：偏B2B·流程相对严格·需要更多文件
- ✅ KakaoPay：更快速·C端熟悉度高(KakaoTalk内置)
- 💡 建议：同时申请两个·KakaoPay可能更快批

**NaverPay特殊要求**：
- 账户必须是港币或韩元（不能是美元）
- 法人信息必须与护照完全一致
- 邮箱要监控好，客服可能会要求补充资料

---

## 常见问题

**Q: NaverPay 和 KakaoPay 哪个先批？**  
A: 通常KakaoPay快2-3天。建议同时申请，先拿到谁就先用谁。

**Q: 手续费多少？**  
A: 约2.9-3.6%（询问客服确认)。假如用户支付¥100，NaverPay抽3%=¥3，善缘收¥97。

**Q: 需要韩国银行账户吗？**  
A: 不需要。HSBC港币账户可以直接收韩元，NaverPay自动换汇。

**Q: 申请被拒了怎么办？**  
A: 最常见原因：
   - 营业执照不清晰 → 重新上传彩色版
   - 法人信息与护照不符 → 检查名字拼写
   - 地址证明过期 → 上传最新的

**Q: 多久能开始收款？**  
A: 批复后1-2个工作日生效，可立即开始交易。

---

## 💡 小贴士

1. **邮箱监控** - NaverPay会频繁邮件沟通，务必每天检查邮箱
2. **文件命名** - 英文清晰命名（不要用中文·避免编码问题）
3. **护照信息** - Mutian Liu必须与NNC1中的名字完全一致
4. **24小时回复** - 客服要求补充资料时要快速响应
5. **客服邮箱** - help@naver.com (한국어/English可问)

---

## ✅ 提交前最终检查清单

- [ ] 所有必填字段已完成
- [ ] 营业执照清晰彩色·CR号3054659清晰
- [ ] 法人护照号正确（EE3472440）
- [ ] 法人名字与护照完全一致（Mutian Liu）
- [ ] 银行信息正确（HSBC 040199499838）
- [ ] 邮箱地址能正常收发（已测试）
- [ ] 地址证明在3个月内
- [ ] 所有文件已上传
- [ ] 已阅读并同意 서비스약관 (服务条款)

**准备好了？点 신청 提交！**  
→ 等邮件 → 3-5天内拿到Key → 通知我配置

---

## ⚠️ 重要：海外商户身份认证（额外步骤）

**NaverPay强制要求实名认证**，海外商户的流程：

### 问题
NaverPay申请时会弹出身份认证要求：
- i-PIN (韩国个人号) ❌ 不适用
- 韩国手机验证 ❌ 不适用
- 海外商户认证 ✅ **我们用这个**

### 解决方案（自动触发）

提交申请后，NaverPay会邮件通知：
```
"신원인증이 필요합니다" (需要身份认证)
```

**你需要做**：
1. 回邮件说：`"We are an overseas merchant (해외사업자)"`
2. 客服会要求补充：
   - 法人护照翻译件（英文版）
   - 营业执照认证
   - 银行账户证明
3. 客服人工审核（2-3天）
4. 通过 → 实名认证完成 → Key发放

### 预期时间
- 申请提交：D0
- 邮件要求补充：D1-D2
- 你补充资料：D2
- 客服审核：D3-D5
- **总计：5-6天**（比预计多2-3天）

### 💡 提前准备
现在就准备：
- [ ] 法人护照的英文翻译件（可用Google Translate翻译截图）
- [ ] 营业执照的英文版本
- 这样客服要求时能秒回

---

## 📞 官方支持

- **웹사이트**: https://pay.naver.com/docs
- **고객센터**: help@naver.com
- **한국어 지원**: 가능 (이메일/채팅)
- **응답시간**: 평일 24시간 이내
