'use strict';
const XB=require('./friends-cross-border');
// 相生 manual verification (人工核验). Owner decision 2026-11-06:
//  - Users upload proof for 学历 / 职业(在职) / 年收入 / 资产. Max 3 files per item, 5MB each, JPEG/PNG/WEBP/PDF by magic bytes.
//  - Files are AES-256-GCM encrypted at rest in a private directory (never under the repo / static roots).
//  - Admin approves or rejects; in BOTH cases the original files (and any 学信网 code) are deleted immediately.
//    Only the result is kept: profile.verified[field]=true + profile.verifiedAt[field] on approval, or the reason on rejection.
//  - Display rule lives in friends-service.project(): only members (and the owner) ever receive verified data.
//  - 婚况 (owner decision 2026-11-06): user screen-records their own 「国家政务服务平台」 婚姻登记信息查询 (or screenshots).
//    Short video mp4/mov/webm ≤30MB via a raw-body route; no third-party API, no ID number collected.
//    Admin picks 未婚(无登记记录) / 已婚 / 离异(有离婚证照) / 无法判断. 无法判断 = not approved. Files deleted after review as above.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');

const VERIFY_FIELDS=Object.freeze(['education','occupation','income','assets','marital']);
const VERIFY_LABELS=Object.freeze({education:'学历',occupation:'职业/在职',income:'年收入',assets:'资产',marital:'婚况·政务平台自查'});
// Admin choices for 婚况. Only the first three approve; the stored value is the key, shown to members on the 认证条.
const MARITAL_RESULTS=Object.freeze({unmarried:'未婚(无登记记录)',married:'已婚',divorced:'离异(有离婚证照)'});
const MARITAL_CHOICES=Object.freeze({...MARITAL_RESULTS,unclear:'无法判断'});
const MARITAL_HINT='全国数据尚未完全联网，查无记录不等于法律意义上的未婚证明';
const MARITAL_GUIDE='在支付宝或微信打开「国家政务服务平台」→ 实名 → 我的证照/婚姻登记信息查询，录屏（从打开到结果页，含实名姓名）上传。已婚显示结婚证电子证照，未婚显示「无关联数据」。';
const MAX_VIDEO_BYTES=30*1024*1024;
const MAX_FILES=3,MAX_BYTES=5*1024*1024,DRAFT_TTL_MS=7*86400000,ORPHAN_GRACE_MS=10*60000;
const EXT={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf','video/mp4':'mp4','video/quicktime':'mov','video/webm':'webm'};
// Video by magic bytes: ISO-BMFF 'ftyp' (qt brand => mov) or EBML header (webm). Only accepted for 婚况.
function sniffVideo(buf){
  if(!Buffer.isBuffer(buf)||buf.length<12)return null;
  if(buf.toString('latin1',4,8)==='ftyp')return buf.toString('latin1',8,12)==='qt  '?'video/quicktime':'video/mp4';
  if(buf[0]===0x1a&&buf[1]===0x45&&buf[2]===0xdf&&buf[3]===0xa3)return 'video/webm';
  return null;
}
const fail=(status,message)=>{const e=Error(message);e.status=status;throw e;};

// Type is decided by content, never by file name or client-declared MIME.
function sniff(buf){
  if(!Buffer.isBuffer(buf))return null;
  if(buf.length>=3&&buf[0]===0xff&&buf[1]===0xd8&&buf[2]===0xff)return 'image/jpeg';
  if(buf.length>=8&&buf.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])))return 'image/png';
  if(buf.length>=12&&buf.toString('latin1',0,4)==='RIFF'&&buf.toString('latin1',8,12)==='WEBP')return 'image/webp';
  if(buf.length>=5&&buf.toString('latin1',0,5)==='%PDF-')return 'application/pdf';
  return null;
}
// Strict base64 decode with a size cap checked BEFORE decoding.
function decode(data){
  if(typeof data!=='string'||!data)fail(400,'请选择要上传的文件');
  const raw=data.replace(/^data:[^;,]{0,80};base64,/,'');
  if(raw.length>Math.ceil(MAX_BYTES/3)*4)fail(413,'单个文件不能超过5MB');
  if(!/^[A-Za-z0-9+/]*={0,2}$/.test(raw)||raw.length%4!==0)fail(400,'文件编码无效');
  const buf=Buffer.from(raw,'base64');
  if(!buf.length)fail(400,'文件为空');
  if(buf.length>MAX_BYTES)fail(413,'单个文件不能超过5MB');
  return buf;
}
const cleanName=v=>(typeof v==='string'?v:'').replace(/[\u0000-\u001f\u007f/\\]/g,'').trim().slice(0,80)||'文件';
const cleanCode=v=>{if(v===undefined||v===null||v==='')return null;if(typeof v!=='string'||!/^[A-Za-z0-9]{6,32}$/.test(v.trim()))fail(400,'学信网在线验证码格式无效');return v.trim();};
const checkField=f=>{if(!VERIFY_FIELDS.includes(f))fail(400,'核验项目无效');return f;};

function ensureCollection(s){if(s.verificationRequests===undefined)s.verificationRequests=[];if(!Array.isArray(s.verificationRequests))throw Error('核验记录损坏');return s.verificationRequests;}

function createVerificationService({store,dir,key,clock=()=>Date.now(),repoRoot=path.resolve(__dirname,'../..')}){
  if(!store)throw Error('核验服务缺少存储');
  if(typeof dir!=='string'||!path.isAbsolute(dir))throw Error('核验文件目录必须是绝对路径');
  // A directory under the repo could be served statically. Refuse it outright.
  const rel=path.relative(path.resolve(repoRoot),path.resolve(dir));
  if(!rel.startsWith('..')&&!path.isAbsolute(rel))throw Error('核验文件目录不能位于网站目录内');
  if(!/^[a-f0-9]{64}$/i.test(key||''))throw Error('核验文件加密密钥无效');
  // Separate sub-key so the file key is never the database key itself.
  const secret=Buffer.from(crypto.hkdfSync('sha256',Buffer.from(key,'hex'),Buffer.alloc(0),Buffer.from('xiangsheng-verification-files-v1'),32));
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const fileOf=id=>{if(!/^[a-f0-9]{32}$/.test(id))fail(400,'文件编号无效');return path.join(dir,id+'.bin');};
  const aad=id=>Buffer.from('xs-verify-file:'+id);
  function writeEncrypted(id,buf){
    const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',secret,iv);c.setAAD(aad(id));
    const data=Buffer.concat([c.update(buf),c.final()]);
    fs.writeFileSync(fileOf(id),Buffer.concat([Buffer.from([1]),iv,c.getAuthTag(),data]),{flag:'wx',mode:0o600});
  }
  function readDecrypted(id){
    const b=fs.readFileSync(fileOf(id));if(b[0]!==1||b.length<29)throw Error('核验文件格式无效');
    const d=crypto.createDecipheriv('aes-256-gcm',secret,b.subarray(1,13));d.setAAD(aad(id));d.setAuthTag(b.subarray(13,29));
    return Buffer.concat([d.update(b.subarray(29)),d.final()]);
  }
  const unlink=ids=>{const failed=[];for(const id of ids){try{fs.rmSync(fileOf(id),{force:true});}catch(_){failed.push(id);}}return failed;};
  const now=()=>new Date(clock()).toISOString();
  const findOwn=(s,uid,field)=>ensureCollection(s).find(r=>r.userId===uid&&r.field===field);
  const ownerView=r=>{
    if(!r)return {status:'none'};
    const out={status:r.status};
    if(r.status==='draft'||r.status==='pending')Object.assign(out,{files:r.files.map(f=>({id:f.id,name:f.name,mime:f.mime,size:f.size})),hasCode:!!r.code});
    if(r.status==='pending')out.submittedAt=r.submittedAt;
    if(r.status==='rejected')Object.assign(out,{reason:r.reason,reviewedAt:r.reviewedAt});
    if(r.status==='approved')out.reviewedAt=r.reviewedAt;
    return out;
  };

  function addFile(uid,field,name,buf,mime){
      const pre=store.read();
      if(!(pre.profiles||[]).some(p=>p.userId===uid))fail(400,'请先保存个人资料，再申请核验');
      const id=crypto.randomBytes(16).toString('hex');
      writeEncrypted(id,buf);
      try{
        return store.transaction(s=>{
          let r=findOwn(s,uid,field);
          if(r?.status==='pending')fail(409,'该项目正在审核中，请等待结果');
          if(!r||r.status==='approved'||r.status==='rejected'){
            if(r)s.verificationRequests.splice(s.verificationRequests.indexOf(r),1);
            r={id:crypto.randomUUID(),userId:uid,field,status:'draft',files:[],code:null,createdAt:now()};s.verificationRequests.push(r);
          }
          if(r.files.length>=MAX_FILES)fail(400,'每项最多上传3个文件');
          r.files.push({id,name:cleanName(name),mime,size:buf.length,uploadedAt:now()});r.updatedAt=now();
          return ownerView(r);
        });
      }catch(e){unlink([id]);throw e;}
  }

  return {
    VERIFY_FIELDS,
    // Owner-only status: 审核中 / 已核验 / 未通过+原因.
    status(uid){
      const s=store.read(),p=(s.profiles||[]).find(x=>x.userId===uid),list=s.verificationRequests||[];
      const fields={};
      for(const f of VERIFY_FIELDS){const r=list.find(x=>x.userId===uid&&x.field===f);fields[f]={...ownerView(r),verified:p?.verified?.[f]===true,...(p?.verified?.[f]===true?{verifiedAt:p.verifiedAt?.[f]||null}:{})};}
      if(p?.verified?.marital===true&&MARITAL_RESULTS[p.verifiedDetail?.marital])fields.marital.result=MARITAL_RESULTS[p.verifiedDetail.marital];
      return {fields,labels:VERIFY_LABELS,limits:{maxFiles:MAX_FILES,maxBytes:MAX_BYTES,maxVideoBytes:MAX_VIDEO_BYTES,types:Object.keys(EXT)},marital:{guide:MARITAL_GUIDE,hint:MARITAL_HINT},hasProfile:!!p};
    },
    upload(uid,{field,name,data}={}){XB.check(store,uid);
      checkField(field);
      const buf=decode(data),mime=sniff(buf);
      if(!mime)fail(415,field==='marital'?'图片请用 JPG/PNG/WEBP；录屏请用「上传录屏」':'只支持 JPG、PNG、WEBP 图片或 PDF 文件');
      if(field==='marital'&&mime==='application/pdf')fail(415,'婚况请上传录屏或截图');
      return addFile(uid,field,name,buf,mime);
    },
    // Raw-body upload for the 婚况 screen recording (≤30MB). Route passes the Buffer; type by magic bytes only.
    uploadVideo(uid,{field,name,buf}={}){XB.check(store,uid);
      if(field!=='marital')fail(400,'只有婚况可以上传录屏');
      if(!Buffer.isBuffer(buf)||!buf.length)fail(400,'请选择要上传的录屏');
      if(buf.length>MAX_VIDEO_BYTES)fail(413,'录屏不能超过30MB，请只录从打开到结果页');
      const mime=sniffVideo(buf);if(!mime)fail(415,'录屏只支持 MP4、MOV、WEBM');
      return addFile(uid,field,name,buf,mime);
    },
    removeFile(uid,fileId){
      const r=store.transaction(s=>{
        const r=ensureCollection(s).find(x=>x.userId===uid&&x.files.some(f=>f.id===fileId));
        if(!r)fail(404,'文件不存在');if(r.status!=='draft')fail(409,'已提交审核的文件不能修改');
        r.files=r.files.filter(f=>f.id!==fileId);r.updatedAt=now();return ownerView(r);
      });
      unlink([fileId]);return r;
    },
    submit(uid,{field,code}={}){XB.check(store,uid);
      checkField(field);const clean=cleanCode(code);
      if(clean&&field!=='education')fail(400,'只有学历可以填写学信网验证码');
      const result=store.transaction(s=>{
        if(!(s.profiles||[]).some(p=>p.userId===uid))fail(400,'请先保存个人资料，再申请核验');
        let r=findOwn(s,uid,field);
        if(r?.status==='pending')fail(409,'该项目正在审核中，请等待结果');
        if(!r||r.status!=='draft'){
          if(!clean)fail(400,'请先上传证明文件');
          if(r)s.verificationRequests.splice(s.verificationRequests.indexOf(r),1);
          r={id:crypto.randomUUID(),userId:uid,field,status:'draft',files:[],code:null,createdAt:now()};s.verificationRequests.push(r);
        }
        if(clean)r.code=clean;
        if(!r.files.length&&!r.code)fail(400,field==='education'?'请上传学信网截图或填写在线验证码':'请先上传证明文件');
        r.status='pending';r.submittedAt=now();r.updatedAt=r.submittedAt;return ownerView(r);
      });
      return result;
    },
    // ---- admin (route is behind adminAuth) ----
    pending(){
      const s=store.read();
      return (s.verificationRequests||[]).filter(r=>r.status==='pending').sort((a,b)=>String(a.submittedAt).localeCompare(String(b.submittedAt))).map(r=>{
        const p=(s.profiles||[]).find(x=>x.userId===r.userId);
        return {id:r.id,field:r.field,fieldLabel:VERIFY_LABELS[r.field],submittedAt:r.submittedAt,code:r.code||null,
          profile:p?{shareId:p.shareId,nickname:p.nickname,city:p.city,claimed:p.fields?.[r.field]??null}:null,
          files:r.files.map(f=>({id:f.id,name:f.name,mime:f.mime,size:f.size})),...(r.field==='marital'?{choices:MARITAL_CHOICES}:{})};
      });
    },
    // Returns decrypted bytes for an admin-authenticated request only. Never written to a public path.
    file(requestId,fileId){
      const r=(store.read().verificationRequests||[]).find(x=>x.id===requestId&&x.status==='pending');
      const f=r?.files.find(x=>x.id===fileId);if(!f)fail(404,'文件不存在或已删除');
      let body;try{body=readDecrypted(f.id);}catch(_){fail(410,'文件已删除或无法读取');}
      return {mime:f.mime,body,filename:'verify-'+f.id.slice(0,8)+'.'+EXT[f.mime]};
    },
    decide(requestId,{decision,reason,result}={},actor='admin-token'){
      if(!['approve','reject'].includes(decision))fail(400,'审核结果无效');
      let why=typeof reason==='string'?reason.trim().slice(0,200):'';
      const target=(store.read().verificationRequests||[]).find(x=>x.id===requestId);
      if(target?.field==='marital'){
        // 婚况: the admin must pick one of the four results. 无法判断 never lights the mark.
        if(!Object.hasOwn(MARITAL_CHOICES,result))fail(400,'请选择婚况结果');
        if(decision==='approve'&&!Object.hasOwn(MARITAL_RESULTS,result))fail(400,'「无法判断」不能通过，请选未通过并说明原因');
        if(decision==='reject'&&!why&&result==='unclear')why='录屏无法判断婚况，请按说明从打开到结果页完整录制（含实名姓名）后重新提交';
      }
      if(decision==='reject'&&!why)fail(400,'请填写未通过原因（会展示给用户）');
      let toDelete=[];
      const out=store.transaction(s=>{
        const r=ensureCollection(s).find(x=>x.id===requestId);
        if(!r)fail(404,'核验申请不存在');if(r.status!=='pending')fail(409,'该申请已处理');
        const at=now();
        if(decision==='approve'){
          const p=(s.profiles||[]).find(x=>x.userId===r.userId);if(!p)fail(409,'用户资料已删除，无法核验');
          p.verified={...(p.verified||{}),[r.field]:true};p.verifiedAt={...(p.verifiedAt||{}),[r.field]:at};
          if(r.field==='marital')p.verifiedDetail={...(p.verifiedDetail||{}),marital:result};
          r.status='approved';r.reason=null;
        }else{r.status='rejected';r.reason=why;}
        toDelete=r.files.map(f=>f.id);
        // Only the result is kept: drop file metadata and the 学信网 code together with the files.
        r.files=[];r.code=null;r.reviewedAt=at;r.updatedAt=at;
        if(!Array.isArray(s.auditLogs))s.auditLogs=[];
        s.auditLogs.push({id:crypto.randomUUID(),actor,action:'verification.'+decision,target:r.id,detail:{field:r.field,...(r.field==='marital'?{result}:{}),...(decision==='reject'?{reason:why}:{}),filesDeleted:toDelete.length},createdAt:at});
        return {id:r.id,status:r.status,field:r.field,reviewedAt:at};
      });
      const failed=unlink(toDelete);
      return {...out,filesDeleted:toDelete.length-failed.length,...(failed.length?{deleteRetry:failed.length}:{})};
    },
    // Remove every request + file for a user (profile deletion).
    purgeUser(uid){
      let ids=[];
      store.transaction(s=>{const list=ensureCollection(s);ids=list.filter(r=>r.userId===uid).flatMap(r=>r.files.map(f=>f.id));s.verificationRequests=list.filter(r=>r.userId!==uid);return null;});
      unlink(ids);return {filesDeleted:ids.length};
    },
    // Housekeeping: expire stale drafts and delete any encrypted file no longer referenced by a draft/pending request.
    sweep(){
      const cutoff=clock()-DRAFT_TTL_MS;
      store.transaction(s=>{const list=ensureCollection(s);s.verificationRequests=list.filter(r=>!(r.status==='draft'&&Date.parse(r.updatedAt||r.createdAt)<cutoff));return null;});
      const live=new Set((store.read().verificationRequests||[]).filter(r=>['draft','pending'].includes(r.status)).flatMap(r=>r.files.map(f=>f.id)));
      const stale=[];
      for(const name of fs.readdirSync(dir)){
        const m=/^([a-f0-9]{32})\.bin$/.exec(name);if(!m||live.has(m[1]))continue;
        try{if(clock()-fs.statSync(path.join(dir,name)).mtimeMs>ORPHAN_GRACE_MS)stale.push(m[1]);}catch(_){}
      }
      unlink(stale);return {deleted:stale.length};
    },
    _paths:{dir,fileOf}
  };
}

module.exports={createVerificationService,sniff,sniffVideo,MARITAL_RESULTS,MARITAL_CHOICES,MARITAL_HINT,MARITAL_GUIDE,MAX_VIDEO_BYTES,VERIFY_FIELDS,VERIFY_LABELS,MAX_FILES,MAX_BYTES};
