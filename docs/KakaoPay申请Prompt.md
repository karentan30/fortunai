# KakaoPay 商户申请 - 操作Prompt

## 目标
用 Capstone IQ Group Limited (HK) 的名义申请KakaoPay韩国商户账户，获取API Key和Secret进行支付接入。

---

## 前置准备（申请前必读）

### 📋 需要上传的材料
- [ ] Capstone营业执照（NNC1）彩色扫描版 PDF/JPG
- [ ] 法人护照首页（Mutian Liu, EE3472440）复印件
- [ ] 公司地址证明（香港地址：Flat 902A, 9/F, Richmond Comm Bldg, 111 Argyle St, Mongkok）
- [ ] 银行账户开户证明（HSBC 040199499838）

### 💰 费用
- 商户注册：**免费**
- 交易手续费：约 **2.9-3.3%**（询问客服最终费率）

---

## 申请步骤

### 第一步：打开KakaoPay商户申请页面
```
访问：https://business.kakao.com
选择语言：English 或 中文
点击：가맹점 신청 / Merchant Sign Up / 商户申请
```

### 第二步：填写基本信息

| 字段名 | 填写内容 | 说明 |
|------|--------|------|
| **Business Name (英文)** | Capstone IQ Group Limited | 与营业执照一致 |
| **Business Name (中文/可选)** | 英橋集團有限公司 | 公司中文名 |
| **Business Type** | Corporation / 法人 | 选择法人企业 |
| **Country/Region** | Hong Kong | |
| **Registration Number** | 3054659 | CR号 |
| **Business Address** | Flat 902A, 9/F, Richmond Comm Bldg, 111 Argyle St, Mongkok, Kowloon, Hong Kong | 完整HK地址 |
| **Representative Name** | Mutian Liu / 劉牧天 | 法人名字 |
| **Contact Email** | [你的邮箱] | Karen或财务邮箱 |
| **Contact Phone** | +852-XXXX-XXXX | HK手机号 |

### 第三步：上传身份验证文件

逐个上传以下文件：
```
1. 营业执照 (NNC1)
   - 要求：彩色清晰、所有文字可读
   - 格式：PDF 或 JPG
   
2. 法人护照首页
   - 要求：护照信息页清晰
   - 注意：Mutian Liu, Passport No. EE3472440
   
3. 地址证明
   - 可用：水电账单/公司信函/银行对账单
   - 要求：3个月内、包含公司名和地址
```

### 第四步：填写财务信息

| 字段名 | 填写内容 | 说明 |
|------|--------|------|
| **Settlement Currency** | HKD 或 KRW | 建议先选 HKD (自动换汇成KRW) |
| **Settlement Account** | 040199499838 | HSBC账号 |
| **Account Holder Name** | Capstone IQ Group Limited | 账户户名 |
| **Bank Name** | The Hongkong and Shanghai Banking Corporation Limited | 银行名 |
| **SWIFT Code** | HSBCHKHHHKH | HSBC的SWIFT |
| **Monthly Expected Sales** | $5,000 - $10,000 | 预估月交易额（越高批得越快） |

### 第五步：商业信息

| 字段名 | 填写内容 | 说明 |
|------|--------|------|
| **Business Category** | Software / SaaS / Technology | 选择最接近的 |
| **Business Description** | Online astrology & fortune reading platform | 简述业务 |
| **Website (可选)** | 如有善缘官网填入 | 可选 |

### 第六步：审查并提交

- 确认所有信息无误
- 同意服务条款
- 点击 **提交申请**

---

## 预期结果

### ⏱️ 审核时间
- **2-3个工作日** 批复

### 📧 获得信息
审核通过后会收到邮件，包含：
```
Merchant ID (商户ID)      : MXXXXXXX
API Key (应用密钥)        : sk_kakao_live_xxxxx
Secret Key (密钥)         : sk_secret_xxxxx
CID (收单ID)             : CXXXXXXX
```

### 下一步
收到上述信息 → 通知我 → 我配置到善缘后端 → Staging测试 → 生产上线

---

## 常见问题

**Q: 需要韩国银行账户吗？**  
A: 不需要。HSBC港币账户可以直接收KRW，KakaoPay会自动换汇。

**Q: 审批被拒了怎么办？**  
A: 最常见原因是营业执照不清晰。重新上传高清彩色扫描重新申请。

**Q: 多久能开始收款？**  
A: 批复后立即生效，第一笔通常T+1入账。

**Q: 手续费怎么算？**  
A: 你收¥100用户支付，KakaoPay抽3%=¥3，善缘到账¥97。

---

## 💡 小贴士

1. **邮箱很关键** - 所有通知都发邮箱，确保能收到
2. **营业执照清晰度** - 是审批最常见卡点，务必彩色清晰上传
3. **24小时内**补充资料如果客服要求，争取快速反馈
4. **客服邮箱** - support@kakao.com (英文/中文可问)

---

## ✅ 提交前检查清单

- [ ] 所有字段已填写
- [ ] 营业执照彩色清晰
- [ ] 护照号正确（EE3472440）
- [ ] 银行信息准确（HSBC 040199499838）
- [ ] 邮箱地址正确且能收到邮件
- [ ] 已同意服务条款
- [ ] 准备好在3-5天内补充资料（如需）

**提交！** → 等待邮件 → 拿到Key通知我
