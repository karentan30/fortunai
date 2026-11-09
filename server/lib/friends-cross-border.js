'use strict';
// 个人信息出境（PIPL）账号级单独同意：相生由香港公司运营、资料存储在香港服务器。
// 一条用户级记录（时间+版本）；所有会保存个人资料的相生写接口统一检查。版本变化后旧同意失效，需重新同意。
const {CROSS_BORDER_VERSION:VERSION}=require('./friends-chart');
const CODE='XS_CROSS_BORDER_CONSENT_REQUIRED',MESSAGE='请先单独同意：相生资料存储在香港服务器';
const key=uid=>String(uid);
const rows=s=>{if(s.crossBorderConsents===undefined)s.crossBorderConsents=[];if(!Array.isArray(s.crossBorderConsents))throw Error('出境同意数据损坏');return s.crossBorderConsents;};
const recordOf=(s,uid)=>(Array.isArray(s?.crossBorderConsents)?s.crossBorderConsents:[]).find(r=>r.userId===key(uid))||null;
const has=(s,uid)=>{const r=recordOf(s,uid);return !!r&&r.version===VERSION&&!r.withdrawnAt;};
const required=()=>{throw Object.assign(Error(MESSAGE),{status:400,code:CODE,version:VERSION});};
const valid=uid=>uid!==undefined&&uid!==null&&uid!=='';
const login=()=>{throw Object.assign(Error('请先登录'),{status:401});};
// Inside a transaction: write/refresh the account record. Same version keeps the first consent time.
function record(s,uid,now=Date.now()){if(!valid(uid))login();const list=rows(s),at=new Date(now).toISOString();let r=list.find(x=>x.userId===key(uid));if(!r){r={userId:key(uid)};list.push(r);}if(r.version!==VERSION||r.withdrawnAt||!r.at){r.version=VERSION;r.at=at;delete r.withdrawnAt;}return {version:r.version,at:r.at};}
// Inside a transaction: an explicit field-level consent (legacy profile/authorize forms) also writes the account record.
function ensure(s,uid,body,now){if(body&&body.crossBorderConsent===true)return record(s,uid,now);if(!valid(uid))login();if(!has(s,uid))required();return recordOf(s,uid);}
// Outside a transaction: fail before any write or external call.
function check(store,uid){if(!valid(uid))login();if(store&&!has(store.read(),uid))required();}// no store = nothing can be saved (config-only checks)
function accept(store,uid,body,now){if(body&&body.crossBorderConsent===true)return store.transaction(s=>record(s,uid,now));check(store,uid);return null;}
function status(s,uid){const r=recordOf(s,uid);return {version:VERSION,consented:has(s,uid),at:has(s,uid)?r.at:null};}
function withdraw(s,uid,now=Date.now()){const r=recordOf(s,uid);if(r&&!r.withdrawnAt)r.withdrawnAt=new Date(now).toISOString();return status(s,uid);}
// Error body for routes: keep the code so the front end can show the consent dialog and retry.
const errorBody=e=>({error:e.message,...(e.code===CODE?{code:CODE,version:e.version}:{})});
module.exports={VERSION,CODE,MESSAGE,has,record,ensure,check,accept,status,withdraw,errorBody,recordOf};
// Seed helper (tests / fixtures): record current-version consent for the given accounts.
module.exports.grant=(store,...uids)=>{store.transaction(s=>{for(const uid of uids)record(s,uid);});return store;};
