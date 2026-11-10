'use strict';
// 合盘完整版解锁弹层（底部弹层，墨金样式）。价格、渠道、会员余量都来自服务端 report.pay，前端不传金额。
// 付款：支付宝/微信二维码（手机上支付宝给「打开支付宝」按钮），每 3 秒查一次单，到账后回调 onUnlocked 重新拉报告。
(()=>{
 const API='/api/friends/compatibility/pay';
 const el=(tag,text,cls)=>{const x=document.createElement(tag);if(text!==undefined&&text!==null)x.textContent=text;if(cls)x.className=cls;return x;};
 const yuan=m=>(m/100).toFixed(m%100?(m%10?2:1):0);
 const mobile=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'');
 async function api(path,{method='GET',body}={}){
  const r=await fetch(path,{method,credentials:'same-origin',cache:'no-store',referrerPolicy:'no-referrer',headers:{'X-Runae-Friends':'1',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(Error(data.error||'暂时连不上，请稍后再试'),{status:r.status});return data;
 }
 function qr(payload){
  if(typeof window.qrcode!=='function')throw Error('二维码暂时显示不了，请稍后刷新');
  const code=window.qrcode(0,'M');code.addData(payload);code.make();const n=code.getModuleCount(),cell=Math.max(2,Math.floor(200/(n+8)));
  const c=document.createElement('canvas');c.width=c.height=cell*(n+8);c.setAttribute('aria-label','本订单付款二维码');const x=c.getContext('2d');
  x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.fillStyle='#000';for(let r=0;r<n;r++)for(let k=0;k<n;k++)if(code.isDark(r,k))x.fillRect((k+4)*cell,(r+4)*cell,cell,cell);return c;
 }
 let current=null;
 function close(){if(!current)return;clearTimeout(current.timer);current.dim.remove();current.sheet.remove();document.removeEventListener('keydown',current.esc);current.opener?.focus?.();current=null;}
 // target: {type:'pair'|'self'|'mychart', id}；pay: 报告里的 pay 字段；onUnlocked: 解锁成功后调用。
 function open({target,pay,onUnlocked}){
  close();if(!pay||!pay.sellable||pay.unlocked)return;
  const dim=el('div',undefined,'hp-dim'),sheet=el('section',undefined,'hp-sheet hv4');sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-label','解锁完整报告');
  const x=el('button','×','hp-close');x.type='button';x.setAttribute('aria-label','关闭');x.addEventListener('click',close);dim.addEventListener('click',close);
  const h=el('h3','解锁完整报告 ');h.append(el('b','¥'+yuan(pay.priceMinor)));
  const inc=el('ul',undefined,'hp-inc'),row=(a,b)=>{const li=el('li');li.append(el('span',a),el('span',b));inc.append(li);};
  const mine=target.type==='mychart';
  // 我的命盘：单人完整报告，没有磨合/邀请这些合盘行，也不走会员份数。
  if(mine){row('16 章完整命盘解读','AI 辅助生成');row('只你自己可见','不进卡片、不给任何人看');row('报告长期保存','可随时回看');}
  else row('4 项分项分与理由','全部打开');
  if(!mine&&pay.moheCount)row(pay.moheCount+' 处需磨合 · 逐条解读','每处 2–3 条建议');
  if(!mine&&pay.basisCount)row('解读依据',pay.basisCount+' 条');
  if(mine);else if(target.type==='self')row('报告长期保存','可随时回看');
  else row('邀请有效期内可回看',pay.keepUntil?'到 '+new Date(pay.keepUntil).toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'})+'（邀请到期或撤回后关闭）':'邀请到期或撤回后关闭');
  const body=el('div',undefined,'hp-body'),err=el('p','','hp-err');err.setAttribute('role','alert');
  sheet.append(el('div',undefined,'hp-grab'),x,h,el('p',mine?'我的命盘 · 传统文化参考，仅供娱乐与自我了解':target.type==='self'?'只你自己可见，记在这条保存的合盘上':'一方解锁，双方都能看','hp-sub'),inc,el('p',pay.refundRule,'hp-refund'),body,err);
  const done=()=>{close();onUnlocked?.();};
  function choose(){
   body.replaceChildren();
   if(pay.creditEnabled){const b=el('button','用会员份数解锁（本月还剩 '+pay.memberRemaining+' 份）','hp-credit');b.type='button';b.addEventListener('click',async()=>{b.disabled=true;err.textContent='';try{await api(API+'/credit',{method:'POST',body:target});done();}catch(e){b.disabled=false;err.textContent=e.message;}});body.append(b);}
   if(pay.payEnabled&&pay.channels?.length){const g=el('div',undefined,'hp-pay');for(const c of pay.channels){const b=el('button',undefined,'hp-ch');b.type='button';const i=el('i');i.style.background=c==='alipay'?'#1677ff':'#07c160';b.append(i,c==='alipay'?'支付宝':'微信支付');b.addEventListener('click',()=>checkout(c,g));g.append(b);}body.append(g);}
   if(!pay.creditEnabled&&!pay.payEnabled)body.append(el('p','完整版暂未开放购买，现在不会扣费。','hp-sub'));
   if(!pay.member&&!mine){const a=el('a','会员每月含 '+(pay.memberMonthly||2)+' 份 · 了解会员 ›','hp-member');a.href='/pages/friends-membership.html';body.append(a);}
  }
  async function checkout(channel,g){
   for(const b of g.querySelectorAll('button'))b.disabled=true;err.textContent='';
   try{const o=await api(API+'/orders',{method:'POST',body:{...target,channel}});showOrder(o);}
   catch(e){err.textContent=e.message;for(const b of g.querySelectorAll('button'))b.disabled=false;}
  }
  function showOrder(o){
   if(o.status==='paid')return done();
   body.replaceChildren();
   const slot=el('div',undefined,'hp-qr'),payload=o.checkout?.codeUrl||o.checkout?.qrCode||'';
   if(mobile&&o.channel==='alipay'&&/^https:\/\//.test(payload)){const a=el('a','打开支付宝付款','btn-p');a.href=payload;a.rel='noopener';slot.append(a);}
   else if(payload&&/^(https:\/\/|weixin:\/\/)/.test(payload)){try{slot.append(qr(payload));slot.append(el('p',o.channel==='wechat'?(mobile?'请截图后用微信扫一扫识别，或用另一台手机扫码':'用微信扫一扫付款'):'用支付宝扫一扫付款','hp-sub'));}catch(e){slot.textContent=e.message;}}
   else slot.textContent='付款码暂时显示不了，请稍后再试';
   const note=el('p','付款后这里会自动更新，不用重复付款。','hp-sub'),again=el('button','我已付款，刷新','hp-member');again.type='button';
   body.append(slot,note,again);
   let n=0;
   const poll=async manual=>{clearTimeout(current?.timer);if(!current)return;try{const r=await api(API+'/orders/'+encodeURIComponent(o.id));if(r.status==='paid')return done();if(['failed','expired','payment_review'].includes(r.status)){note.textContent=r.status==='payment_review'?'这笔付款需要人工核对，核对后会自动解锁；有疑问请在「联系我们」留言。':'订单已失效，请关闭后重新下单。';return;}}catch(e){if(manual)err.textContent=e.message;}
    if(manual)n=0;if(++n<100&&current)current.timer=setTimeout(()=>poll(false),3000);else note.textContent='已经等了一会儿。付完款请点「我已付款，刷新」。';};
   again.addEventListener('click',()=>poll(true));
   current.timer=setTimeout(()=>poll(false),3000);
  }
  choose();
  document.body.append(dim,sheet);
  const esc=e=>{if(e.key==='Escape')close();};document.addEventListener('keydown',esc);
  current={dim,sheet,esc,timer:null,opener:document.activeElement};x.focus();
 }
 window.XsHepanPay={open,close};
})();
