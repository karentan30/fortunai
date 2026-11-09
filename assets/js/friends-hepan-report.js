'use strict';
// 合盘 v4 报告渲染（墨金样式）。只画服务端给的字段：免费/完整截断、对方命盘隐藏都已在服务端做完，
// 前端不补、不猜被锁内容。全部用 textContent，不拼 HTML。
(()=>{
 const NS='http://www.w3.org/2000/svg';
 const el=(tag,text,cls)=>{const x=document.createElement(tag);if(text!==undefined&&text!==null)x.textContent=text;if(cls)x.className=cls;return x;};
 const svg=(tag,attrs)=>{const x=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs||{}))x.setAttribute(k,v);return x;};
 const STEM_WX={甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'};
 const BRANCH_WX={子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水'};
 const NUM=['壹','贰','叁','肆','伍','陆'];
 const PILLARS=[['year','年柱'],['month','月柱'],['day','日主'],['hour','时柱']];
 const GOOD=new Set(['生','合','六合','三合','同']),BAD=new Set(['克','冲','刑','害']);
 const h2=t=>el('h2',[...t].join(' '),'hv-h');
 function medal(total){
  const box=el('div',undefined,'medal');box.setAttribute('role','img');box.setAttribute('aria-label','姻缘分 '+total+' 分，满分 100');
  const s=svg('svg',{viewBox:'0 0 132 132','aria-hidden':'true'});
  s.append(svg('circle',{cx:66,cy:66,r:64,stroke:'rgba(200,174,125,.32)','stroke-width':1}));
  s.append(svg('circle',{cx:66,cy:66,r:52,stroke:'rgba(200,174,125,.16)','stroke-width':3}));
  const c=2*Math.PI*52,arc=svg('circle',{cx:66,cy:66,r:52,stroke:'#c8ae7d','stroke-width':3,'stroke-linecap':'round','stroke-dasharray':(c*Math.max(0,Math.min(100,total))/100).toFixed(1)+' '+c.toFixed(1),transform:'rotate(-90 66 66)'});
  s.append(arc);
  for(let i=0;i<60;i++){const a=i*6*Math.PI/180,r1=47,r2=i%5===0?43:45;s.append(svg('line',{x1:66+r1*Math.sin(a),y1:66-r1*Math.cos(a),x2:66+r2*Math.sin(a),y2:66-r2*Math.cos(a),stroke:'rgba(200,174,125,.35)','stroke-width':1}));}
  const num=el('div',undefined,'num');num.append(el('b',String(total)),el('small','/ 100'));
  box.append(s,num);return box;
 }
 function scoreSection(r){
  const sec=el('section',undefined,'score');sec.setAttribute('aria-label',(r.purpose==='buddy'?'相处分':'姻缘分'));
  const top=el('div',undefined,'sc-top'),side=el('div');
  const tiers=el('div',undefined,'tiers');for(const t of r.tiers){const s=el('span',t);if(t===r.tierLabel)s.className='on';tiers.append(s);}
  side.append(el('p',[...(r.purpose==='buddy'?'相处分':'姻缘分')].join(' '),'sc-eb'),el('p',r.tierLabel,'sc-tier'),tiers,el('p',r.summary,'sc-sum'));
  top.append(medal(r.total),side);sec.append(top);
  const ul=el('ul',undefined,'subs');let anyLocked=false;
  for(const s of r.subs){
   const li=el('li'),r1=el('div',undefined,'r1'),b=el('b');
   if(s.locked){anyLocked=true;li.className='lkd';b.append('00',el('small','/'+s.max));}
   else b.append(String(s.score),el('small','/'+s.max));
   r1.append(el('span',s.label),b);
   const bar=el('div',undefined,'bar'),i=el('i');i.style.width=(s.locked?60:Math.round(s.score/s.max*100))+'%';bar.append(i);
   li.append(r1,bar);
   if(s.locked){const w=el('div',undefined,'why2');w.append(el('em','完整版查看'));li.append(w);}
   ul.append(li);
  }
  sec.append(ul);
  if(anyLocked)sec.append(el('p','总分免费 · 分项与依据含在完整版','sc-rule'));
  sec.append(el('p',r.footer[0],'sc-rule'));
  return sec;
 }
 function pillarGrid(p){
  const grid=el('div',undefined,'pillars');
  for(const [k,label] of PILLARS){
   const col=el('div',undefined,'col'+(k==='day'?' day':'')),gz=el('div',undefined,'gz');
   let wx='—';
   if(p.hidden){
    if(k==='day'){gz.append(el('span',p.dayMaster),el('span','?','q'));wx=STEM_WX[p.dayMaster]||'—';}
    else gz.append(el('span','?','q'),el('span','?','q'));
   }else{
    const v=p.pillars?.[k];
    if(v){const [s,b]=[...v];gz.append(el('span',s),el('span',b));wx=STEM_WX[s]+' · '+BRANCH_WX[b];}
    else gz.append(el('span','?','q'),el('span','?','q'));
   }
   col.append(el('div',label,'pos'),gz,el('div',wx,'wx'));grid.append(col);
  }
  return grid;
 }
 function whoLine(p,cls){
  const d=el('div',undefined,'who'+(cls?' '+cls:'')),b=el('b',p.label+(p.nickname?' · '+p.nickname:''));
  b.append(el('span',p.zao+'（'+(p.gender==='male'?'男':'女')+'）','sx'));
  d.append(b,el('span',p.hidden?'仅日主':p.pillars?.hour?'四柱完整':'三柱 · 时辰不详'));return d;
 }
 function relationSection(r){
  const wrap=el('div',undefined,'rel');wrap.setAttribute('role','img');
  const word=x=>x.locked?'完整版查看':x.type||'无',label=r.relations.map(x=>x.label+'：干'+word(x.stem)+'，支'+word(x.branch)).join('；');
  wrap.setAttribute('aria-label','双方逐柱关系：'+label);
  const pos=el('div',undefined,'pos4');for(const [,l] of PILLARS)pos.append(el('span',l==='日主'?'日柱':l));
  const lab=n=>{const d=el('div',undefined,'rlab');d.append(el('span',n),el('span'));return d;};
  const row=(p)=>{const rr=el('div',undefined,'rrow');for(const [k] of PILLARS){const pc=el('div',undefined,'pc'+(k==='day'?' day':''));const has=r.relations.some(x=>x.pillar===k);
   if(!has)pc.classList.add('none');
   if(p.hidden){const a=el('span'),b=el('span');if(k==='day')a.textContent=p.dayMaster;else a.append(el('i','?','q'));b.append(el('i','?','q'));pc.append(a,b);}
   else{const v=p.pillars?.[k];if(v){const [s,b]=[...v];pc.append(el('span',s),el('span',b));}else{const a=el('span'),b=el('span');a.append(el('i','?','q'));b.append(el('i','?','q'));pc.append(a,b);}}
   rr.append(pc);}return rr;};
  const links=el('div',undefined,'links');
  for(const [k] of PILLARS){const lk=el('div',undefined,'lk'),rel=r.relations.find(x=>x.pillar===k);
   for(const x of [rel?.stem,rel?.branch]){const t=x?.type;if(x?.locked){const ln=el('div',undefined,'ln n lkd');ln.append(el('b','?'));lk.append(ln);continue;}const kind=GOOD.has(t)?'':BAD.has(t)?' k':' n',ln=el('div',undefined,'ln'+kind),txt=!t||t==='无'?'—':t;ln.append(el('b',txt));lk.append(ln);}
   links.append(lk);}
  wrap.append(pos,lab('你'),row(r.people.me),links,row(r.people.ta),lab('TA'));
  const lg=el('div',undefined,'legend');const anyLocked=r.relations.some(x=>x.stem.locked||x.branch.locked);for(const [c,t] of [['','生 · 合（金线）'],['k','克 · 冲 · 刑 · 害（朱线）'],['n','无关系'],...(anyLocked?[['n lkd','? 完整版查看']]:[])]){const s=el('span'),i=el('i');if(c)i.className=c;s.append(i,t);lg.append(s);}
  wrap.append(lg);
  return wrap;
 }
 function item(x,i,kind){
  const it=el('div',undefined,'it'),body=el('div');
  it.append(el('span',NUM[i]||String(i+1),'no'+(kind==='mohe'?' k':'')));
  body.append(el('span',x.tag,'tagrel'+(kind==='mohe'?' k':'')),el('h3',x.title));
  const dl=el('dl',undefined,'trio');
  dl.append(el('dt','传统含义'),el('dd',x.meaning),el('dt','生活里'),el('dd',x.life));
  if(x.advice?.length){const dd=el('dd',undefined,'adv'),ul=el('ul');for(const a of x.advice)ul.append(el('li',a));dd.append(ul);dl.append(el('dt','相处建议'),dd);}
  body.append(dl);it.append(body);return it;
 }
 function starSection(r){
  const frag=document.createDocumentFragment();frag.append(h2(r.star.heading));
  const c=el('div',undefined,'couple');
  for(const [who,s] of [[r.people.me,r.star.mine],[r.people.ta,r.star.theirs]]){const d=el('div');d.append(el('b',who.zao+' · '+who.label),el('span',s.title));c.append(d);}
  frag.append(c);
  const it=el('div',undefined,'it'),body=el('div'),dl=el('dl',undefined,'trio');
  it.append(el('span','◎','no'));
  dl.append(el('dt','你这边'),el('dd',r.star.mine.text),el('dt','TA 那边'),el('dd',r.star.theirs.text));
  body.append(el('span',r.star.heading,'tagrel'),dl);it.append(body);frag.append(it);
  if(r.star.mode!=='spouse')frag.append(el('p','同性合盘，或以交朋友、找搭子为目的时，不看夫妻星，只看相处。','fq'));
  return frag;
 }

 // 磨合点之后：锁住时给解锁按钮（只有服务端说能卖才可点，点了交给 opts.onUnlock 开付款弹层）；磨合点不超过 1 处时不卖，直接说已全部展示。
 function tail(r,opts={}){
  if(r.lock){
   const lk=el('section',undefined,'lock');lk.append(el('h3','另有 '+r.lock.moreCount+' 处需磨合'),el('p',r.lock.text,'sub'));
   const g=el('ul',undefined,'ghostlines');g.setAttribute('aria-hidden','true');g.append(el('li'),el('li'),el('li'));lk.append(g);
   const b=el('button',r.lock.cta,'btn-o');b.type='button';b.disabled=!r.lock.available||typeof opts.onUnlock!=='function';
   if(!b.disabled)b.addEventListener('click',()=>opts.onUnlock(r));
   lk.append(b);
   if(r.lock.available&&r.pay?.refundRule)lk.append(el('p',r.pay.refundRule,'note'));
   return [lk];
  }
  if(r.allShown&&!r.unlocked){
   const a=el('section',undefined,'allshown end');a.append(el('span','◎','knot'),el('h3','你们的报告已全部展示'),el('p','只有一处需要磨合，上面已经写完。没有隐藏内容，不用再解锁。'));
   if(opts.endActions?.length){const acts=el('div',undefined,'acts');for(const [label,fn] of opts.endActions){const b=el('button',label,'ghost-btn');b.type='button';b.addEventListener('click',fn);acts.append(b);}a.append(acts);}
   return [a];
  }
  if(r.unlocked){const u=el('p',r.pay?.unlockedBy==='peer'?'这份完整报告由对方解锁，你们都能看。':'完整报告已解锁。','note');return [u];}
  return [];
 }
 // 完整报告看完后的私域入口：只有配置了顾问二维码才出现；不写价格、不卖东西。
 function advisor(r){
  const url=r.full&&r.pay?.advisorQrUrl;if(!url)return [];
  const c=el('section',undefined,'advisor');c.append(el('h3','加顾问微信，进玄学搭子交流群'),el('p','扫码添加，备注「相生」。','sub'));
  const img=el('img');img.src=url;img.alt='顾问微信二维码';img.width=img.height=160;img.loading='lazy';img.referrerPolicy='no-referrer';c.append(img);
  return [c];
 }
 function render(r,opts={}){
  const {upgrade}=opts;
  const root=el('article',undefined,'hv-report');
  if(upgrade){const u=el('p',undefined,'upgrade');u.append(el('b',upgrade+'　'),'对方或你还在旧版授权，重新授权后能看新版姻缘分。');root.append(u);}
  root.append(el('p',r.mode==='self'?'自 己 合 盘':(r.purpose==='buddy'?'相 处 报 告':'合 盘 报 告'),'eyebrow'));
  if(r.mode==='self'){const p=el('div',undefined,'private');p.append(el('span','仅 自 己 可 见'));root.append(p);}
  const names=el('p',undefined,'rp-names');
  const pp=(p)=>{const s=el('span',p.label==='你'?(p.nickname||'你'):(p.nickname||'TA'),'pp');s.append(el('em',p.zao+'（'+(p.gender==='male'?'男':'女')+'）'));return s;};
  names.append(pp(r.people.me),el('span','与','and2'),pp(r.people.ta));root.append(names);
  root.append(el('p',r.lead,'lead'));
  const epi=el('p',r.epigraph.text,'epi');epi.append(el('cite',r.epigraph.cite));root.append(epi);
  if(r.limited){const l=el('p',undefined,'limited');l.append(el('b','有限参考'),r.limitedNote);root.append(l);}
  root.append(scoreSection(r));
  root.append(h2('命盘'),whoLine(r.people.me),pillarGrid(r.people.me),whoLine(r.people.ta,'ta'),pillarGrid(r.people.ta));
  if(r.people.ta.hidden)root.append(el('p','邀请合盘中，TA 的其余命盘只有 TA 本人看得到。','note'));
  root.append(h2('生克合冲'),relationSection(r));
  if(r.star)root.append(starSection(r));
  root.append(h2('合之处'));
  if(r.he.length)r.he.forEach((x,i)=>root.append(item(x,i,'he')));else root.append(el('p','这次没有特别突出的相合之处，相处更多靠彼此经营。','empty'));
  root.append(h2('需磨合'));
  if(r.mohe.length)r.mohe.forEach((x,i)=>root.append(item(x,i,'mohe')));else root.append(el('p','没有明显需要磨合的地方。','empty'));
  root.append(...tail(r,opts));
  if(r.basis?.length){
   root.append(h2('计分依据'));const ul=el('ul',undefined,'basis');
   for(const b of r.basis){const li=el('li',undefined,b.points<0?'m':'');li.append(el('span',b.tag),el('span',(b.points>0?'+':'')+b.points*4));ul.append(li);}
   root.append(ul,el('p','每条规则分 ×4 计入对应分项，分项以 15 为基础、封顶 25。','note'));
  }
  const foot=el('p',undefined,'foot');
  if(r.aiLabel)foot.append(el('span',r.aiLabel,'ai'),el('br'));
  foot.append(r.footer.join(' · '));
  root.append(...advisor(r),foot);
  return root;
 }
 // 保存的自己合盘：只有档位、分数和解读条目（服务端不存干支），所以不画命盘和逐柱关系。
 function renderSaved(r,opts={}){
  const root=el('article',undefined,'hv-report');
  root.append(el('p','已 保 存 的 合 盘','eyebrow'));const p=el('div',undefined,'private');p.append(el('span','仅 自 己 可 见'));root.append(p);
  const names=el('p',undefined,'rp-names');names.append(el('span','你','pp'),el('span','与','and2'),el('span',r.nickname,'pp'));root.append(names);
  root.append(el('p',r.lead,'lead'));
  const sub=r.subs;// 服务端已按免费/完整截断，锁住的分项不带分数
  root.append(scoreSection({...r,tiers:['很合拍','大体合拍','磨合型'],subs:sub,footer:r.footer}));
  if(r.limited)root.append(el('p','当时至少一方不知道时辰，是有限参考。','note'));
  root.append(h2('合之处'));if(r.he.length)r.he.forEach((x,i)=>root.append(item(x,i,'he')));else root.append(el('p','这次没有特别突出的相合之处。','empty'));
  root.append(h2('需磨合'));if(r.mohe.length)r.mohe.forEach((x,i)=>root.append(item(x,i,'mohe')));else root.append(el('p','没有明显需要磨合的地方。','empty'));
  root.append(...tail(r,opts));
  root.append(...advisor(r),el('p',r.note,'note'),el('p',r.footer.join(' · '),'foot'));
  return root;
 }
 window.XsHepanReport={render,renderSaved};
})();
