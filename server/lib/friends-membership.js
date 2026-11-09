'use strict';
// friends_pair_report_v1（旧双人详细报告）不卖。friends_pair_report_v2 = 合盘 v4 完整版单次解锁，走收款中台
// （friends-hepan-pay，FRIENDS_HEPAN_PAY_ENABLED 默认关），价格以 FRIENDS_HEPAN_PRICE 为准（默认 9.9 元）。
// 两者都没有 `sellable`，会员直连收款永远卖不到它们。
// 会员每自然月含 2 份合盘完整版（monthlyReportCredits，单位 hepan_v4，记在 hepanCredits）；
// 旧计费的 pair_report 月度发放只认 monthlyCreditUnit 为 pair_report 的商品，所以这里不会多发旧次数。
const PILOT_CATALOG=Object.freeze({
 friends_pair_report_v1:{sku:'friends_pair_report_v1',name:'双人详细报告',amountMinor:2990,currency:'CNY',reportCredits:1,creditUnit:'pair_report',accessDays:0,pilot:true},
 friends_pair_report_v2:{sku:'friends_pair_report_v2',name:'合盘完整报告',amountMinor:990,currency:'CNY',reportCredits:0,creditUnit:'hepan_v4',accessDays:0,pilot:true},
 friends_month_v1:{sku:'friends_month_v1',name:'相生月会员',amountMinor:2990,currency:'CNY',reportCredits:0,creditUnit:'pair_report',accessDays:31,accessMonths:1,matchingMembership:true,monthlyReportCredits:2,monthlyCreditUnit:'hepan_v4',autoRenew:false,sellable:true,pilot:true},
 friends_year_v1:{sku:'friends_year_v1',name:'相生年会员',amountMinor:19900,currency:'CNY',reportCredits:0,creditUnit:'pair_report',accessDays:366,accessMonths:12,matchingMembership:true,monthlyReportCredits:2,monthlyCreditUnit:'hepan_v4',autoRenew:false,sellable:true,pilot:true}
});
// Benefits actually enforced in code (quotas, card viewers, member filters, 已核验/婚况). Shown on the membership page.
const MEMBER_BENEFITS=Object.freeze({free:{requestsPerDay:3},member:{requestsPerDay:20}});
Object.values(PILOT_CATALOG).forEach(Object.freeze);
// Asia/Shanghai calendar anniversaries (UTC+8); clamp month-end without drifting.
function anniversary(paidAt,months){
 const start=new Date(Date.parse(paidAt)+8*3600000);if(!Number.isFinite(start.getTime()))throw Error('会员起始时间无效');
 const year=start.getUTCFullYear(),month=start.getUTCMonth()+months;
 const last=new Date(Date.UTC(year,month+1,0)).getUTCDate();
 return Date.UTC(year,month,Math.min(start.getUTCDate(),last),start.getUTCHours(),start.getUTCMinutes(),start.getUTCSeconds(),start.getUTCMilliseconds())-8*3600000;
}
function period(order,now){
 if(!order.matchingMembership||order.status!=='paid'||!Number.isInteger(order.accessMonths)||order.accessMonths<1||order.accessMonths>12)return null;
 const start=Date.parse(order.paidAt),end=Date.parse(order.accessUntil);
 if(!Number.isFinite(start)||!Number.isFinite(end)||now<start||now>=end)return null;
 for(let i=order.accessMonths-1;i>=0;i--)if(now>=anniversary(order.paidAt,i))return {key:String(i),startsAt:anniversary(order.paidAt,i),expiresAt:Math.min(end,anniversary(order.paidAt,i+1))};
 return null;
}
// Single membership predicate (相生会员 = paid matching membership whose benefits were verified and is inside its access window).
// Paid via direct 支付宝/微信 sales (friends-membership-sales, FRIENDS_SALES_OPEN) or the hub path (closed).
function isMember(state,viewerId,now=Date.now()){
 if(viewerId===undefined||viewerId===null||viewerId==='')return false;
 return (state?.billingOrders||[]).some(o=>o.userId===viewerId&&o.matchingMembership===true&&o.benefitsVerified===true&&o.status==='paid'&&Number.isFinite(Date.parse(o.paidAt))&&Date.parse(o.paidAt)<=now&&Number.isFinite(Date.parse(o.accessUntil))&&Date.parse(o.accessUntil)>now);
}
// Latest still-valid membership end for a user (ms), or 0. Used to extend a manual renewal instead of overlapping it.
function memberUntil(state,viewerId,now=Date.now()){
 let end=0;for(const o of state?.billingOrders||[])if(o.userId===viewerId&&o.matchingMembership===true&&o.benefitsVerified===true&&o.status==='paid'){const t=Date.parse(o.accessUntil);if(Number.isFinite(t)&&t>now&&t>end)end=t;}
 return end;
}
module.exports={PILOT_CATALOG,MEMBER_BENEFITS,anniversary,period,isMember,memberUntil};
