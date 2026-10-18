# Runae 英文站上线候选与 Stripe 商户名交接

日期：2026-10-18

仓库：projects/shenyuan

分支：deploy-main-compliance

## 本次交付

- 英文会员页改为 Runae 深色玉绿视觉，并按现行商品目录呈现月、季、年会员权益；增加独立英文价格页和首页价格入口。
- 首页到资料页、选读页保留用户预选的阅读方式；面相、手相改为在相应报告页上传照片，不再用资料页的假解锁标记控制入口。
- 增加资料提交 18+ 确认与面相上传年龄/照片归属确认；面相、手相付费回跳所需的压缩图片改存当前标签页 `sessionStorage`，恢复后清除。
- 更新英文条款、退款、关于页面对服务、照片处理、运营方及退款条件的说明，删除无法核实的捐赠、团队和仪式服务说法。
- 修复 Vision 默认模型为 `qwen3-vl-plus`，并补上英文价格目录断言及资料/照片流程回归断言。
- 新增浏览器默认请求用的根目录 `favicon.ico`。

## 已记录的验证

详见 [Runae launch candidate QA](qa/runae-launch-candidate-2026-10-16.md)。截至 2026-10-16 的记录包括：后端测试 162/162、目标价格测试 4/4、代码解析检查、生产页面/API 健康检查及合成图像 API 调用。浏览器文件选择和最终上传提交未完成；Stripe 只验证到创建 Checkout Session 和商品行展示，没有提交付款，因此付费履约、取消及退款仍未验证。法律文案尚未由律师审阅。

## Stripe 状态与待办

生产 API 收款账号为 `acct_1Q4uA5EAXrE2Ygcr`。其月、季、年产品名称已改为 Runae，Price ID、价格、周期及 active 状态不变。新 Checkout Session 的商品行显示 Runae，但 Stripe 页眉及 Link 授权仍显示 LUMEE。

当前登录的 Stripe Dashboard 是另一账号 `acct_1UQIDEIuJpiKahac`。该错误账号的账号名和公开商户名曾被改为 Runae；这不改变生产收款账号的商户资料。生产账号资料不能通过该 API key 更新，需登录 `acct_1Q4uA5EAXrE2Ygcr` 的 Dashboard，将公开商户名称及相关 Checkout 展示资料改为 Runae，再新建测试 Checkout 核对页眉和 Link 展示。期间没有提交真实付款。

因此，这批代码和页面不是“Stripe 商户展示已全部切换”的完成证明。继续处理前先登录正确的 Stripe Dashboard，并确认账号 ID。

## 变更边界

提交时排除本机 `.playwright-cli/`、`_work/` 临时目录，以及与本批交付无关的 `server/lib/monitoring-singleton.test.js`。工作区其他已有改动不纳入本次提交。
