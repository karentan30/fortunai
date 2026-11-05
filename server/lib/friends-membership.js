'use strict';
const PILOT_CATALOG=Object.freeze({
 friends_pair_report_v1:{sku:'friends_pair_report_v1',name:'双人详细报告',amountMinor:2990,currency:'CNY',reportCredits:1,creditUnit:'pair_report',accessDays:0,pilot:true},
 friends_month_v1:{sku:'friends_month_v1',name:'相生月会员',amountMinor:2990,currency:'CNY',reportCredits:2,creditUnit:'pair_report',accessDays:31,accessMonths:1,matchingMembership:true,monthlyReportCredits:2,pilot:true},
 friends_year_v1:{sku:'friends_year_v1',name:'相生年会员',amountMinor:19900,currency:'CNY',reportCredits:2,creditUnit:'pair_report',accessDays:366,accessMonths:12,matchingMembership:true,monthlyReportCredits:2,pilot:true}
});
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
// Payments are hard-closed in the pilot, so in practice this returns false for everyone until billing is accepted.
function isMember(state,viewerId,now=Date.now()){
 if(viewerId===undefined||viewerId===null||viewerId==='')return false;
 return (state?.billingOrders||[]).some(o=>o.userId===viewerId&&o.matchingMembership===true&&o.benefitsVerified===true&&o.status==='paid'&&Number.isFinite(Date.parse(o.paidAt))&&Date.parse(o.paidAt)<=now&&Number.isFinite(Date.parse(o.accessUntil))&&Date.parse(o.accessUntil)>now);
}
module.exports={PILOT_CATALOG,anniversary,period,isMember};
