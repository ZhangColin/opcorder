---
name: 付费订阅接入支付的关键规则
description: 工具平台/课程等接支付网关订单时的激活、幂等与账单口径规则
---

- 激活前必须服务端 `queryPaymentStatus` 核验:状态=已支付 且 网关金额==业务冻结金额,绝不信任回调 body(回调无验签,可被伪造)。
- 激活/记收益走 事务+FOR UPDATE,仅 pending_payment → active 转换时写收益,回调与前端轮询并发也只记一次。
- 已有 pending 订单再次发起购买时:先查网关,PENDING 则复用原订单返回原二维码,PAID 则直接激活,只有终结态才开新单——覆盖 paymentOrderNo 会导致用户付了旧单却无法激活。
- 待支付记录不允许"取消",否则支付后无法激活(扣款无服务);只允许取消 active。
- 账单口径以 paid_at 为事实来源,而非 status(cancelled/expired 也可能是已付费的)。
- 持久化顺序:先在短事务里提交「支付意向」(唯一 business_order_no),事务外调网关下单,再短事务回填 payment_order_no;激活/回调支持按 business_order_no 兜底补链——绝不在打开的事务里调网关下单,否则崩溃会留下无主可付订单。
- **How to apply:** 任何新业务接 createPaymentOrder 流程时照此模式。
