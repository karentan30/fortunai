'use strict';
// 站内「联系我们」：不公示客服邮箱时的法定联系渠道（查阅/复制、更正、删除、撤回出境同意、投诉举报）。
// 留言和回复跟其他交友数据一样存在加密库里；用户只能看到自己的留言；运营回复与改状态都写操作记录（只记动作，不抄留言正文）。
const crypto=require('node:crypto');
const TYPES=Object.freeze({access:'查阅/复制',correct:'更正',delete:'删除',xb_withdraw:'撤回出境同意',complaint:'投诉举报',other:'其他'});
const STATUS=Object.freeze({open:'待处理',done:'已处理'});
const DAILY_LIMIT=5,MAX_TEXT=1000,DAY=86400000;
function fail(status,message){const e=Error(message);e.status=status;throw e;}
const same=(a,b)=>String(a)===String(b);
function cleanText(v,label){if(typeof v!=='string')fail(400,'请填写'+label);const t=v.replace(/\r\n?/g,'\n').trim();if(!t)fail(400,'请填写'+label);if([...t].length>MAX_TEXT)fail(400,label+'最多'+MAX_TEXT+'字');return t;}
function createSupportService({store,clock=()=>Date.now()}={}){
 const rows=s=>{if(!Array.isArray(s.supportMessages))s.supportMessages=[];return s.supportMessages;};
 const userView=m=>({id:m.id,type:m.type,typeLabel:TYPES[m.type]||'其他',text:m.text,status:m.status,statusLabel:STATUS[m.status],createdAt:m.createdAt,updatedAt:m.updatedAt,replies:(m.replies||[]).map(r=>({text:r.text,at:r.at}))});
 const adminView=(s,m)=>{const p=(s.profiles||[]).find(x=>same(x.userId,m.userId));return {...userView(m),userId:String(m.userId),profile:p?{nickname:p.nickname||'',shareId:p.shareId||''}:null};};
 return {
  TYPES,STATUS,DAILY_LIMIT,MAX_TEXT,
  submit(uid,{type,text}={}){
   if(uid===undefined||uid===null||uid==='')fail(401,'请先登录');
   if(!Object.hasOwn(TYPES,type))fail(400,'请选择留言类型');const body=cleanText(text,'留言内容');
   return store.transaction(s=>{const list=rows(s),now=clock();
    if(list.filter(m=>same(m.userId,uid)&&now-Date.parse(m.createdAt)<DAY).length>=DAILY_LIMIT)fail(429,'每天最多留言'+DAILY_LIMIT+'条，请明天再来');
    const at=new Date(now).toISOString(),m={id:crypto.randomUUID(),userId:String(uid),type,text:body,status:'open',createdAt:at,updatedAt:at,replies:[]};
    list.push(m);
    return userView(m);});
  },
  mine(uid){return rows(structuredClone(store.read())).filter(m=>same(m.userId,uid)).slice().reverse().map(userView);},
  list(status){if(status!==undefined&&status!==''&&!Object.hasOwn(STATUS,status))fail(400,'状态无效');const s=store.read();return rows(structuredClone(s)).filter(m=>!status||m.status===status).slice().reverse().map(m=>adminView(s,m));},
  reply(id,{reply,status}={},actor='admin-token'){
   const text=reply===undefined||reply===null||reply===''?null:cleanText(reply,'回复');
   if(status!==undefined&&!Object.hasOwn(STATUS,status))fail(400,'状态无效');if(!text&&status===undefined)fail(400,'请填写回复或修改状态');
   return store.transaction(s=>{const m=rows(s).find(x=>x.id===id);if(!m)fail(404,'留言不存在');const before=m.status,now=new Date(clock()).toISOString();
    if(text)(m.replies||(m.replies=[])).push({text,at:now});m.status=status||(text?'done':m.status);m.updatedAt=now;
    if(!Array.isArray(s.auditLogs))s.auditLogs=[];s.auditLogs.push({id:crypto.randomUUID(),actor:String(actor||'admin-token'),action:'support.reply',target:id,detail:{before,status:m.status,replied:!!text},createdAt:now});
    return adminView(s,m);});
  }
 };
}
module.exports={createSupportService,TYPES,STATUS,DAILY_LIMIT,MAX_TEXT};
