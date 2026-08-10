# 善缘韩国支付申请指南｜KakaoPay + NaverPay

**目标**：用 Capstone IQ Group Limited (HK) 申请KakaoPay和NaverPay商户账户  
**耗时**：各平台30-60分钟 + 3-5天审核  
**成本**：免费（仅按笔抽成2-3%）

---

## 📋 Capstone 公司信息（已整理）

```
公司名称 (English)  : Capstone IQ Group Limited
公司名称 (中文)     : 英橋集團有限公司
CR 号               : 3054659
法人/创始人         : Mutian Liu (劉苒天)
法人护照号          : ID2201041989031038S1
注册地址            : Flat 902A, 9/F, Richmond Comm Bldg, 111 Argyle St, Mongkok, Kowloon, Hong Kong
公司秘书            : Hongkong Richung Service Limited (2837005)
公司类型            : Private Company Limited by Shares
成立日期            : 3 June 2021
股本                : HKD 10,000
```

### 申请前确保已备好：

- [x] Capstone营业执照（NNC1·已扫描存档）
- [x] 公司注册证明（CR·已整理）
- [x] 法人身份信息（Mutian Liu·护照号已记录）
- [x] 公司注册地址（111 Argyle St, Mongkok）
- [x] 银行账户（HSBC·040199499838）

---

## 1️⃣ KakaoPay 商户申请

### 第一步：打开申请页面
```
官网：https://business.kakao.com
选择语言：English / 中文（找客服帮翻）
```

### 第二步：创建商户账户
| 字段 | 填写内容 | 备注 |
|------|--------|------|
| **Business Name** | Capstone IQ Group Limited | 与营业执照一致 |
| **Business Type** | Corporation | ✅已选 |
| **Country** | Hong Kong | |
| **Registration Number** | 3054659 | ✅HK Companies Registry CR号 |
| **Business Address** | 111 Argyle St, Flat 902A, Richmond Bldg, Hong Kong | |
| **Contact Email** | [Karen@email.com] | |
| **Contact Phone** | [+852-XXXX-XXXX] | |
| **Representative** | Mutian Liu | 法人 |

### 第三步：身份验证
- 上传营业执照（PDF/JPG）
- 上传法人护照/身份证首页
- 上传地址证明

### 第四步：银行账户绑定
| 字段 | 填写内容 |
|------|--------|
| **Bank Name** | The Hongkong and Shanghai Banking Corporation Limited (HSBC) |
| **Account Holder Name** | Capstone IQ Group Limited |
| **Account Number** | 040199499838 |
| **SWIFT Code** | HSBCHKHHHKH |
| **Currency** | HKD（港币）先收港币，平台自动换KRW |
| **Bank Address** | HSBC Main Building, 1 Queen's Road Central, Hong Kong |

### 第五步：商业信息
| 字段 | 填写内容 | 备注 |
|------|--------|------|
| **Business Category** | Entertainment / Software / Consulting | 选 Software/SaaS |
| **Monthly Transaction Volume** | 估计多少（可填 $10,000+） | 越高约快批 |
| **Website** | [如果有] | 可选 |

### ✅ 提交申请
- 审核时间：**2-3个工作日**
- 获得：Merchant ID / API Key / Secret Key

---

## 2️⃣ NaverPay 商户申请

### 第一步：打开申请页面
```
官网：https://pay.naver.com
选择"가맹점 신청"（商户申请）
```

### 第二步：填写基本信息
| 字段 | 填写内容 | 备注 |
|------|--------|------|
| **Company Name** | Capstone IQ Group Limited | |
| **Registration Number** | 3054659 | ✅HK Companies Registry |
| **Country** | Hong Kong | |
| **Business Category** | Software/SaaS | |
| **Representative Name** | Mutian Liu | 法人 |
| **Email** | [Karen@email.com] | |
| **Phone** | [+852-XXXX-XXXX] | |
| **Address** | 111 Argyle St, Flat 902A, Richmond Bldg, Hong Kong | |

### 第三步：财务信息
| 字段 | 填写内容 |
|------|--------|
| **Settlement Currency** | KRW → HKD (自动换汇) |
| **Settlement Account** | 040199499838 (HSBC) |
| **Monthly Expected Sales** | $5,000-10,000 |
| **Bank Name** | The Hongkong and Shanghai Banking Corporation Limited |
| **SWIFT Code** | HSBCHKHHHKH |

### 第四步：文件上传
- [ ] 营业执照
- [ ] 法人身份证/护照
- [ ] 银行账户开户证明
- [ ] 公司地址证明

### ✅ 提交申请
- 审核时间：**2-3个工作日**
- 获得：Merchant ID / API Key / Secret

---

## 📝 获得Key后的配置

申请批复后，你会收到：

### KakaoPay
```
KAKAO_PAY_MERCHANT_ID = "xxxxx"
KAKAO_PAY_API_KEY = "sk_kakao_live_xxxxx"
KAKAO_PAY_SECRET = "sk_secret_xxxxx"
KAKAO_PAY_CID = "C0123456789"  # Merchant ID
```

### NaverPay
```
NAVER_PAY_MERCHANT_ID = "M12345678"
NAVER_PAY_API_KEY = "sk_naver_live_xxxxx"
NAVER_PAY_SECRET = "sk_secret_xxxxx"
NAVER_PAY_PARTNER_ID = "xxxxx"
```

**配置位置**：
```bash
# HK服务器 /etc/systemd/system/xinshen.service.d/env.conf
# 或 Slim：/root/.env

KAKAO_PAY_MERCHANT_ID=xxxxx
KAKAO_PAY_API_KEY=sk_kakao_live_xxxxx
# ... etc
```

配置后重启：
```bash
ssh root@47.242.80.65 'systemctl restart xinshen.service'
```

---

## 🔗 快速链接

| 平台 | 申请链接 | 客服 |
|------|--------|------|
| **KakaoPay** | https://business.kakao.com | support@kakao.com |
| **NaverPay** | https://pay.naver.com | help@naver.com |

---

## ⏱️ 时间表

```
D0（今天）   → Karen/财务提交KakaoPay申请
D1           → Karen/财务提交NaverPay申请
D2-D4        → 等审核（2-3工作日）
D5           → 收到Key，配置到.env
D6           → 我改代码集成，Staging测试
D7           → 生产live ✓
```

---

## 🆘 常见问题

**Q: 需要韩国银行账户吗？**  
A: 不需要。HK账户直接收韩元即可（需支持KRW的国际账户）。

**Q: 申请被拒了怎么办？**  
A: 最常见原因是营业执照不清晰。重新上传高清扫描即可。

**Q: 多久能收到钱？**  
A: 商户批复后1-2个工作日就能开始收款。settlement周期通常T+1或T+3。

**Q: 手续费多少？**  
A: KakaoPay/NaverPay通常2.9-3.3%（询问申请时确认）。

---

**下一步**：
1. 打印本文档
2. 你或财务按步骤填表
3. 提交申请
4. 3-5天后收到Key
5. 通知我key → 我改代码

💬 有问题随时问！
