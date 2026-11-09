'use strict';
const XB=require('./friends-cross-border');
// 相生 · 认真相亲页 (long personal page). Owner decision 2026-11-06:
//  - Only for people whose purposes include 享受恋爱(dating) or 认真结婚(serious). The short 交友卡 is unchanged.
//  - Every section is optional and has its own owner scope: private / connected / public (same model as profile fields).
//  - Photos (≤6) and a ≤5s voice greeting are AES-256-GCM encrypted at rest in their own directory (never under the repo),
//    with EXIF/GPS and other metadata stripped before encryption. Bytes are only served through an authenticated route
//    that re-checks the section scope. Owner delete removes the file immediately.
//  - The private marriage questionnaire is only reached through friends-serious-tags.pickedTags(): answers the owner
//    explicitly ticked, shown as short tags. Everything else in the payload comes from an explicit whitelist.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');

const SCOPES=['private','connected','public'];
const SECTIONS=['photos','voice','verify','about','family','ideal','hobby','plans','qtags'];
const T=require('./friends-serious-tags');
// Photos / voice / family background start at 互相认识后; text about yourself starts public. Owner can change each.
const DEFAULT_SCOPES=Object.freeze({photos:'connected',voice:'connected',verify:'public',about:'public',family:'connected',ideal:'public',hobby:'public',plans:'public',qtags:'connected'});
const TEXT_KEYS=['about','family','ideal'];
const TEXT_MAX=500,HOBBY_NAME_MAX=16;
const PLAN_TAGS=Object.freeze(['倾向结婚','享受恋爱为主','想要孩子','暂不考虑孩子','希望尽快见面','慢慢了解']);
const PLAN_EXCLUSIVE=[['倾向结婚','享受恋爱为主'],['想要孩子','暂不考虑孩子'],['希望尽快见面','慢慢了解']];
// 认证条. Only education / occupation / income have a review process today (friends-verification); the rest stay grey.
const VERIFY_STRIP=Object.freeze([['realName','实名',null],['education','学历','education'],['occupation','工作','occupation'],['marital','婚况·政务平台自查','marital'],['house','房产',null],['car','车产',null],['income','收入','income']]);
const {MARITAL_RESULTS,MARITAL_HINT}=require('./friends-verification');
const ASSET_FIELDS=['house','car','hukou'];
const MAX_PHOTOS=6,MAX_PHOTO_BYTES=5*1024*1024,MAX_PHOTO_EDGE=1600;
const MAX_VOICE_BYTES=200*1024,MAX_VOICE_MS=6000;
const fail=(status,message)=>{const e=Error(message);e.status=status;throw e;};
const eligible=p=>Array.isArray(p?.purposes)&&require('./friends-matching').purposesOf(p).some(k=>k==='dating'||k==='serious'); // purposesOf: a verified-married profile is never eligible
const clean=(v,n)=>typeof v==='string'?v.replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g,'').trim().slice(0,n):'';

function rows(s){if(s.seriousPages===undefined)s.seriousPages=[];if(!Array.isArray(s.seriousPages))throw Error('相亲资料存储格式异常');return s.seriousPages;}
const rowOf=(s,uid)=>(s.seriousPages||[]).find(r=>r.userId===uid)||null;
const blankRow=uid=>({userId:uid,about:'',family:'',ideal:'',hobby:{name:'',text:''},plans:[],qtags:[],scopes:{...DEFAULT_SCOPES},photos:[],voice:null,createdAt:new Date().toISOString()});

// Text, tags and scopes only. Media is changed through the media service.
function normalizeSerious(body={},prev){
  if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'请求格式无效');
  for(const k of TEXT_KEYS)if(typeof body[k]==='string'&&body[k].trim().length>TEXT_MAX)fail(400,'每段最多500字');
  const out={};
  for(const k of TEXT_KEYS)out[k]=Object.hasOwn(body,k)?clean(body[k],TEXT_MAX):(prev?.[k]||'');
  const h=Object.hasOwn(body,'hobby')?body.hobby:prev?.hobby;
  if(typeof h?.text==='string'&&h.text.trim().length>TEXT_MAX)fail(400,'每段最多500字');
  out.hobby={name:clean(h?.name,HOBBY_NAME_MAX),text:clean(h?.text,TEXT_MAX)};
  if(Object.hasOwn(body,'plans')){
    if(!Array.isArray(body.plans)||body.plans.some(x=>!PLAN_TAGS.includes(x)))fail(400,'未来规划选项无效');
    const plans=PLAN_TAGS.filter(t=>body.plans.includes(t));
    for(const pair of PLAN_EXCLUSIVE)if(pair.every(t=>plans.includes(t)))fail(400,'「'+pair.join('」和「')+'」只能选一个');
    out.plans=plans;
  }else out.plans=prev?.plans||[];
  out.qtags=Object.hasOwn(body,'qtags')?T.normalizePicks(body.qtags):(prev?.qtags||[]);
  out.scopes={...DEFAULT_SCOPES,...(prev?.scopes||{})};
  if(body.scopes!==undefined){
    if(!body.scopes||typeof body.scopes!=='object')fail(400,'可见范围无效');
    for(const [k,v] of Object.entries(body.scopes)){if(!SECTIONS.includes(k)||!SCOPES.includes(v))fail(400,'可见范围无效');out.scopes[k]=v;}
  }
  return out;
}

// Builds the page from an explicit whitelist. `allows(scope)` is the shared profile visibility rule for this viewer;
// `fieldVisible(key)` is the existing per-field rule; `member` is the existing isMember() result.
// `ownerRecord` / `viewerRecord` are marriage-questionnaire records; only ticked, still-answered tags leave this function.
function buildSeriousPage({row,profile,self,allows,fieldVisible,member,ownerRecord=null,viewerRecord=null,viewerRow=null}){
  const r=row||blankRow(profile.userId),scopes={...DEFAULT_SCOPES,...(r.scopes||{})},can=k=>allows(scopes[k]);
  const sections={};
  if(can('photos')&&r.photos?.length)sections.photos=r.photos.map(x=>({id:x.id,w:x.w,h:x.h}));
  if(can('voice')&&r.voice)sections.voice={id:r.voice.id,durationMs:r.voice.durationMs,...(Array.isArray(r.voice.peaks)?{peaks:r.voice.peaks}:{})};
  for(const k of TEXT_KEYS)if(can(k)&&r[k])sections[k]=r[k];
  if(can('hobby')&&(r.hobby?.name||r.hobby?.text))sections.hobby={name:r.hobby.name||'',text:r.hobby.text||''};
  if(can('plans')&&r.plans?.length)sections.plans=[...r.plans];
  if(can('qtags')){
    const tags=T.pickedTags(ownerRecord,r.qtags);
    // 「一致」: the viewer ticked the very same tag on their own page (and it is still their answer). Only the viewer sees this.
    const mine=self?new Set():new Set(T.pickedTags(viewerRecord,viewerRow?.qtags).map(t=>t.key));
    if(tags.length)sections.qtags=tags.map(t=>({dimensionId:t.dimensionId,dimension:t.dimension,label:t.label,...(mine.has(t.key)?{same:true}:{})}));
  }
  // 是否已核验: owner and members only (existing rule). Everyone else gets one line, no per-item data at all.
  if(can('verify'))sections.verify=self||member?{items:VERIFY_STRIP.map(([key,label,field])=>{
    // 婚况 has no profile field of its own: it follows this section's scope. Result text only when admin-approved.
    const on=!!field&&profile.verified?.[field]===true&&(field==='marital'||fieldVisible(field));
    return {key,label,verified:on,...(field==='marital'?{hint:MARITAL_HINT,...(on&&MARITAL_RESULTS[profile.verifiedDetail?.marital]?{result:MARITAL_RESULTS[profile.verifiedDetail.marital]}:{})}:{})};})}:{membersOnly:true};
  const assets=ASSET_FIELDS.filter(k=>fieldVisible(k)&&profile.fields?.[k]&&profile.fields[k]!=='暂不提供').map(k=>[k,profile.fields[k]]);
  if(assets.length)sections.assets=Object.fromEntries(assets);
  const out={sections};
  if(self)out.scopes=scopes;
  return out;
}
// Whether the page has anything this viewer would see (drives the 「看TA的相亲资料」 link).
const hasContent=page=>Object.keys(page.sections).some(k=>k!=='assets'&&k!=='verify');

// ---------------- media bytes: type sniffing, metadata stripping, size ----------------
function sniffImage(b){
  if(!Buffer.isBuffer(b))return null;
  if(b.length>=3&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff)return 'image/jpeg';
  if(b.length>=8&&b.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])))return 'image/png';
  if(b.length>=12&&b.toString('latin1',0,4)==='RIFF'&&b.toString('latin1',8,12)==='WEBP')return 'image/webp';
  return null;
}
const SOF=new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
// Keeps only what is needed to decode: JFIF(APP0), ICC(APP2), Adobe(APP14) and the coding segments. Drops APP1 (EXIF/GPS/XMP),
// APP3–APP13 (incl. Photoshop/IPTC), APP15 and comments.
function cleanJpeg(b){
  const parts=[b.subarray(0,2)];let i=2,w=0,h=0;
  while(i<b.length){
    if(b[i]!==0xff)fail(415,'图片文件损坏');
    let m=b[i+1];while(m===0xff){i++;m=b[i+1];}
    if(m===undefined)fail(415,'图片文件损坏');
    if(m===0xd9){parts.push(b.subarray(i,i+2));break;}
    if((m>=0xd0&&m<=0xd7)||m===0x01){parts.push(b.subarray(i,i+2));i+=2;continue;}
    if(i+4>b.length)fail(415,'图片文件损坏');
    const len=b.readUInt16BE(i+2),end=i+2+len;if(len<2||end>b.length)fail(415,'图片文件损坏');
    if(m===0xda){parts.push(b.subarray(i));i=b.length;break;}
    if(SOF.has(m)&&len>=7){h=b.readUInt16BE(i+5);w=b.readUInt16BE(i+7);}
    const app=m>=0xe0&&m<=0xef,keep=!app&&m!==0xfe||m===0xe0||m===0xee||(m===0xe2&&b.toString('latin1',i+4,i+15)==='ICC_PROFILE');
    if(keep)parts.push(b.subarray(i,end));
    i=end;
  }
  return {body:Buffer.concat(parts),w,h};
}
const PNG_KEEP=new Set(['IHDR','PLTE','IDAT','IEND','tRNS','gAMA','cHRM','sRGB','iCCP','sBIT','bKGD','pHYs']);
// Whitelist of decoding chunks. Drops eXIf, tEXt/zTXt/iTXt, tIME and anything unknown.
function cleanPng(b){
  const parts=[b.subarray(0,8)];let i=8,w=0,h=0,ended=false;
  while(i+12<=b.length){
    const len=b.readUInt32BE(i),type=b.toString('latin1',i+4,i+8),end=i+12+len;if(end>b.length)fail(415,'图片文件损坏');
    if(type==='IHDR'){w=b.readUInt32BE(i+8);h=b.readUInt32BE(i+12);}
    if(PNG_KEEP.has(type))parts.push(b.subarray(i,end));
    i=end;if(type==='IEND'){ended=true;break;}
  }
  if(!ended)fail(415,'图片文件损坏');
  return {body:Buffer.concat(parts),w,h};
}
// Drops EXIF and XMP chunks and clears their VP8X flags.
function cleanWebp(b){
  const chunks=[];let i=12,w=0,h=0;
  while(i+8<=b.length){
    const type=b.toString('latin1',i,i+4),len=b.readUInt32LE(i+4),end=i+8+len+(len&1);if(i+8+len>b.length)fail(415,'图片文件损坏');
    let chunk=b.subarray(i,Math.min(end,b.length));
    if(type==='VP8X'&&len>=10){chunk=Buffer.from(chunk);chunk[8]&=~0x0c;w=1+chunk.readUIntLE(12,3);h=1+chunk.readUIntLE(15,3);}
    else if(type==='VP8 '&&len>=10&&!w){w=b.readUInt16LE(i+14)&0x3fff;h=b.readUInt16LE(i+16)&0x3fff;}
    else if(type==='VP8L'&&len>=5&&!w){const v=b.readUInt32LE(i+9);w=(v&0x3fff)+1;h=((v>>>14)&0x3fff)+1;}
    if(type!=='EXIF'&&type!=='XMP ')chunks.push(chunk);
    i=end;
  }
  const body=Buffer.concat(chunks),head=Buffer.alloc(12);head.write('RIFF',0,'latin1');head.writeUInt32LE(body.length+4,4);head.write('WEBP',8,'latin1');
  return {body:Buffer.concat([head,body]),w,h};
}
function cleanImage(buf){
  const mime=sniffImage(buf);if(!mime)fail(415,'照片只支持 JPG、PNG、WEBP');
  const out=(mime==='image/jpeg'?cleanJpeg:mime==='image/png'?cleanPng:cleanWebp)(buf);
  if(!out.w||!out.h)fail(415,'无法读取照片尺寸');
  if(Math.max(out.w,out.h)>MAX_PHOTO_EDGE)fail(413,'照片边长不能超过1600像素，请在页面内上传（会自动压缩）');
  return {mime,...out};
}

function sniffAudio(b){
  if(!Buffer.isBuffer(b)||b.length<12)return null;
  if(b[0]===0x1a&&b[1]===0x45&&b[2]===0xdf&&b[3]===0xa3)return 'audio/webm';
  if(b.toString('latin1',0,4)==='OggS')return 'audio/ogg';
  if(b.toString('latin1',4,8)==='ftyp')return 'audio/mp4';
  if(b.toString('latin1',0,4)==='RIFF'&&b.toString('latin1',8,12)==='WAVE')return 'audio/wav';
  return null;
}
// Best-effort real duration (ms). null = unknown (e.g. Chrome's MediaRecorder WebM carries no Duration element).
function audioDurationMs(b,mime){
  try{
    if(mime==='audio/wav'){let i=12,rate=0;while(i+8<=b.length){const id=b.toString('latin1',i,i+4),len=b.readUInt32LE(i+4);if(id==='fmt ')rate=b.readUInt32LE(i+16);if(id==='data'&&rate)return Math.round(len/rate*1000);i+=8+len+(len&1);}return null;}
    if(mime==='audio/mp4'){const at=b.indexOf('mvhd',0,'latin1');if(at<0)return null;const v=b[at+4],scale=b.readUInt32BE(at+(v===1?24:16)),dur=v===1?Number(b.readBigUInt64BE(at+28)):b.readUInt32BE(at+20);return scale&&dur?Math.round(dur/scale*1000):null;}
    if(mime==='audio/ogg'){
      if(b.indexOf('OpusHead',0,'latin1')<0)return null;const pre=b.readUInt16LE(b.indexOf('OpusHead',0,'latin1')+10);
      const last=b.lastIndexOf('OggS',b.length-1,'latin1');if(last<0)return null;const g=Number(b.readBigInt64LE(last+6));return g>0?Math.round(Math.max(0,g-pre)/48):null;
    }
    if(mime==='audio/webm'){
      let scale=1e6;const ts=b.indexOf(Buffer.from([0x2a,0xd7,0xb1]));if(ts>=0){const n=b[ts+3]&0x0f||0;if(b[ts+3]>=0x81&&b[ts+3]<=0x88){scale=b.readUIntBE(ts+4,Math.min(6,b[ts+3]-0x80));void n;}}
      const d=b.indexOf(Buffer.from([0x44,0x89]));if(d<0)return null;
      if(b[d+2]===0x88)return Math.round(b.readDoubleBE(d+3)*scale/1e6);if(b[d+2]===0x84)return Math.round(b.readFloatBE(d+3)*scale/1e6);
      return null;
    }
  }catch(_){return null;}
  return null;
}
// MP4: turn udta/meta boxes (may carry ©xyz location, device, names) into zero-filled 'free' boxes of the same size, so
// sample offsets stay valid. WAV: LIST/INFO chunks become zero-filled JUNK.
function cleanAudio(buf,mime){
  const b=Buffer.from(buf);
  if(mime==='audio/mp4'){
    const walk=(start,end)=>{let i=start;while(i+8<=end){let size=b.readUInt32BE(i),head=8;const type=b.toString('latin1',i+4,i+8);if(size===1){size=Number(b.readBigUInt64BE(i+8));head=16;}else if(size===0)size=end-i;if(size<head||i+size>end)break;
      if(type==='udta'||type==='meta'){b.write('free',i+4,'latin1');b.fill(0,i+head,i+size);}else if(['moov','trak','mdia','minf'].includes(type))walk(i+head,i+size);i+=size;}};
    walk(0,b.length);
  }
  if(mime==='audio/wav'){let i=12;while(i+8<=b.length){const id=b.toString('latin1',i,i+4),len=b.readUInt32LE(i+4);if(id==='LIST'||id==='id3 '||id==='ID3 '){b.write('JUNK',i,'latin1');b.fill(0,i+8,Math.min(b.length,i+8+len));}i+=8+len+(len&1);}}
  return b;
}
function decode(data,max,label){
  if(typeof data!=='string'||!data)fail(400,'请选择要上传的'+label);
  const raw=data.replace(/^data:[^;,]{0,80};base64,/,'');
  if(raw.length>Math.ceil(max/3)*4)fail(413,label+'不能超过'+(max>=1048576?max/1048576+'MB':Math.round(max/1024)+'KB'));
  if(!/^[A-Za-z0-9+/]*={0,2}$/.test(raw)||raw.length%4!==0)fail(400,'文件编码无效');
  const buf=Buffer.from(raw,'base64');if(!buf.length)fail(400,'文件为空');
  if(buf.length>max)fail(413,label+'不能超过'+(max>=1048576?max/1048576+'MB':Math.round(max/1024)+'KB'));
  return buf;
}
const peaksOf=v=>Array.isArray(v)&&v.length>=8&&v.length<=64&&v.every(x=>typeof x==='number'&&Number.isFinite(x))?v.map(x=>Math.round(Math.min(1,Math.max(0,x))*100)/100):null;

function createSeriousMediaService({store,dir,key,clock=()=>Date.now(),repoRoot=path.resolve(__dirname,'../..')}){
  if(!store)throw Error('相亲资料缺少存储');
  if(typeof dir!=='string'||!path.isAbsolute(dir))throw Error('相亲照片目录必须是绝对路径');
  const rel=path.relative(path.resolve(repoRoot),path.resolve(dir));
  if(!rel.startsWith('..')&&!path.isAbsolute(rel))throw Error('相亲照片目录不能位于网站目录内');
  if(!/^[a-f0-9]{64}$/i.test(key||''))throw Error('相亲照片加密密钥无效');
  const secret=Buffer.from(crypto.hkdfSync('sha256',Buffer.from(key,'hex'),Buffer.alloc(0),Buffer.from('xiangsheng-serious-media-v1'),32));
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const fileOf=id=>{if(!/^[a-f0-9]{32}$/.test(id))fail(404,'文件不存在');return path.join(dir,id+'.bin');};
  const aad=id=>Buffer.from('xs-serious-media:'+id);
  function write(id,buf){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',secret,iv);c.setAAD(aad(id));const data=Buffer.concat([c.update(buf),c.final()]);fs.writeFileSync(fileOf(id),Buffer.concat([Buffer.from([1]),iv,c.getAuthTag(),data]),{flag:'wx',mode:0o600});}
  function read(id){const b=fs.readFileSync(fileOf(id));if(b[0]!==1||b.length<29)throw Error('文件格式无效');const d=crypto.createDecipheriv('aes-256-gcm',secret,b.subarray(1,13));d.setAAD(aad(id));d.setAuthTag(b.subarray(13,29));return Buffer.concat([d.update(b.subarray(29)),d.final()]);}
  const unlink=ids=>{for(const id of ids){try{fs.rmSync(fileOf(id),{force:true});}catch(_){}}};
  const now=()=>new Date(clock()).toISOString();
  const needEligible=(s,uid)=>{const p=(s.profiles||[]).find(x=>x.userId===uid);if(!p)fail(400,'请先保存交友卡');if(!eligible(p))fail(400,'认识目的选了「享受甜甜的恋爱」或「认真考虑婚恋」，才能填写相亲资料');return p;};
  const own=(s,uid)=>{let r=rowOf(s,uid);if(!r){r=blankRow(uid);rows(s).push(r);}return r;};
  const view=r=>({photos:(r?.photos||[]).map(x=>({id:x.id,w:x.w,h:x.h})),voice:r?.voice?{id:r.voice.id,durationMs:r.voice.durationMs}:null});
  // Write the encrypted file first, then commit the reference; on any failure the new file is removed.
  function commit(id,fn){try{return store.transaction(fn);}catch(e){unlink([id]);throw e;}}
  return {
    addPhoto(uid,{data}={}){XB.check(store,uid);
      needEligible(store.read(),uid);
      const img=cleanImage(decode(data,MAX_PHOTO_BYTES,'照片')),id=crypto.randomBytes(16).toString('hex');
      write(id,img.body);
      return commit(id,s=>{needEligible(s,uid);const r=own(s,uid);if(r.photos.length>=MAX_PHOTOS)fail(400,'最多6张照片');r.photos.push({id,mime:img.mime,w:img.w,h:img.h,size:img.body.length,uploadedAt:now()});r.updatedAt=now();return view(r);});
    },
    removePhoto(uid,id){
      const out=store.transaction(s=>{const r=rowOf(s,uid);if(!r||!r.photos.some(x=>x.id===id))fail(404,'照片不存在');r.photos=r.photos.filter(x=>x.id!==id);r.updatedAt=now();return view(r);});
      unlink([id]);return out;
    },
    setVoice(uid,{data,durationMs,peaks}={}){XB.check(store,uid);
      needEligible(store.read(),uid);
      const raw=decode(data,MAX_VOICE_BYTES,'语音'),mime=sniffAudio(raw);if(!mime)fail(415,'语音格式不支持，请用页面录音');
      const claimed=Number(durationMs),known=audioDurationMs(raw,mime);
      if(!Number.isFinite(claimed)||claimed<=0)fail(400,'语音时长无效');
      if(claimed>MAX_VOICE_MS||(known!==null&&known>MAX_VOICE_MS))fail(400,'打招呼语音最长5秒');
      const body=cleanAudio(raw,mime),id=crypto.randomBytes(16).toString('hex');
      write(id,body);let old=null;
      const out=commit(id,s=>{needEligible(s,uid);const r=own(s,uid);old=r.voice?.id||null;r.voice={id,mime,size:body.length,durationMs:Math.round(Math.min(MAX_VOICE_MS,known??claimed)),...(peaksOf(peaks)?{peaks:peaksOf(peaks)}:{}),uploadedAt:now()};r.updatedAt=now();return view(r);});
      if(old)unlink([old]);return out;
    },
    removeVoice(uid){
      let id=null;const out=store.transaction(s=>{const r=rowOf(s,uid);if(!r?.voice)fail(404,'还没有语音');id=r.voice.id;r.voice=null;r.updatedAt=now();return view(r);});
      unlink([id]);return out;
    },
    // Decrypted bytes. Callers must have passed friends-service.seriousMedia() (scope check) first.
    open(id){const s=store.read();let meta=null;for(const r of s.seriousPages||[]){meta=r.photos?.find(x=>x.id===id)||(r.voice?.id===id?r.voice:null);if(meta)break;}if(!meta)fail(404,'文件不存在');let body;try{body=read(id);}catch(_){fail(404,'文件不存在');}return {mime:meta.mime,body};},
    // Owner deleted the whole profile: drop the page and every file.
    purgeUser(uid){let ids=[];store.transaction(s=>{const r=rowOf(s,uid);if(r)ids=[...r.photos.map(x=>x.id),...(r.voice?[r.voice.id]:[])];s.seriousPages=rows(s).filter(x=>x.userId!==uid);return null;});unlink(ids);return {filesDeleted:ids.length};},
    _paths:{dir,fileOf},_read:read
  };
}

module.exports={SCOPES,SECTIONS,DEFAULT_SCOPES,PLAN_TAGS,VERIFY_STRIP,TEXT_MAX,MAX_PHOTOS,MAX_PHOTO_BYTES,MAX_PHOTO_EDGE,MAX_VOICE_BYTES,MAX_VOICE_MS,
  eligible,rows,rowOf,blankRow,normalizeSerious,buildSeriousPage,hasContent,sniffImage,cleanImage,sniffAudio,audioDurationMs,cleanAudio,createSeriousMediaService};
