'use strict';
// 相生会员页：读取 /billing/membership/status，未开放时只显示「暂未开放购买」；开放时下单 → 扫码 → 轮询订单，服务器确认到账才算开通。
(()=>{
  const API='/api/friends/billing/membership';
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const yuan=m=>(m/100).toFixed(m%100?1:0).replace(/\.0$/,'');
  const day=iso=>{const d=new Date(Date.parse(iso)+8*3600000);return `${d.getUTCFullYear()}年${d.getUTCMonth()+1}月${d.getUTCDate()}日`;};
  const mobile=matchMedia('(max-width: 720px)').matches||/Mobi|Android|iPhone/i.test(navigator.userAgent);
  const CH={alipay:'支付宝',wechat:'微信支付'};
  const st={status:null,sku:'friends_year_v1',channel:null,order:null,timer:null,polls:0};
  async function call(path,opt={}){
    const r=await fetch(API+path,{credentials:'same-origin',...opt,headers:{'X-Runae-Friends':'1',...(opt.body?{'Content-Type':'application/json'}:{})}});
    const data=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(Error(data.error||'暂时连不上，请稍后再试'),{status:r.status});return data;
  }
  function err(m){$('#xp-error').textContent=m||'';}
  function qr(payload){
    if(typeof window.qrcode!=='function')throw Error('二维码暂时显示不了，请稍后刷新');
    const code=window.qrcode(0,'M');code.addData(payload);code.make();const n=code.getModuleCount(),cell=Math.max(2,Math.floor(232/(n+8)));
    const c=document.createElement('canvas');c.width=c.height=cell*(n+8);c.setAttribute('aria-label','本订单付款二维码');const x=c.getContext('2d');
    x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.fillStyle='#000';for(let r=0;r<n;r++)for(let k=0;k<n;k++)if(code.isDark(r,k))x.fillRect((k+4)*cell,(r+4)*cell,cell,cell);return c;
  }
  function renderMe(){
    const m=st.status?.member,el=$('#xp-me');
    if(m?.active){el.hidden=false;el.textContent=`你是会员，有效期到 ${day(m.until)}。再买一次会从到期日往后延。`;}else el.hidden=true;
  }
  function renderBuy(){
    const s=st.status,box=$('#xp-buy-body');
    if(!s?.open||!s.channels?.length||!s.products?.length){document.body.classList.add('xp-sales-closed');box.innerHTML='<div class="xp-closed-box" role="status"><p class="xp-closed">暂未开放购买</p><p class="xp-muted">会员即将开放，现在不能付款，也不会扣费。免费功能都能照常用。</p><a class="secondary xp-closed-back" href="/pages/friends-connect.html#discover">先去找朋友</a></div>';return;}
    document.body.classList.remove('xp-sales-closed');
    if(!st.channel||!s.channels.includes(st.channel))st.channel=s.channels[0];
    box.innerHTML=`<div class="xp-skus" role="radiogroup" aria-label="选择会员时长">${s.products.map(p=>`<label class="xp-sku${st.sku===p.sku?' is-on':''}"><input type="radio" name="xp-sku" value="${esc(p.sku)}"${st.sku===p.sku?' checked':''}><span>${p.accessMonths>=12?'年会员':'月会员'}</span><b>${yuan(p.amountMinor)} 元</b><small>${p.accessMonths>=12?'约 16.6 元/月':'按月购买'}</small></label>`).join('')}</div>
      <div class="xp-channels" role="radiogroup" aria-label="付款方式">${s.channels.map(c=>`<label class="xp-ch${st.channel===c?' is-on':''}"><input type="radio" name="xp-ch" value="${c}"${st.channel===c?' checked':''}>${CH[c]||c}</label>`).join('')}</div>
      <button type="button" class="primary xp-pay" id="xp-pay">去付款</button><p class="xp-muted">不自动续费 · 付款即表示同意<a href="/pages/friends-terms.html">服务条款</a></p>`;
    box.querySelectorAll('input[name=xp-sku]').forEach(i=>i.addEventListener('change',()=>{st.sku=i.value;renderBuy();}));
    box.querySelectorAll('input[name=xp-ch]').forEach(i=>i.addEventListener('change',()=>{st.channel=i.value;renderBuy();}));
    $('#xp-pay').addEventListener('click',checkout);
  }
  function renderOrder(){
    const o=st.order,box=$('#xp-order');if(!o){box.innerHTML='';return;}
    if(o.status==='paid'){box.innerHTML=`<div class="xp-done"><h3>开通好了</h3><p>${esc(o.name)} 有效期到 ${day(o.accessUntil)}。</p><a class="primary" href="/pages/friends-connect.html#discover">去找朋友</a></div>`;return;}
    if(o.status==='pending'){
      const payload=o.checkout?.codeUrl||o.checkout?.qrCode||'';
      box.innerHTML=`<div class="xp-pending"><p><b>${esc(o.name)} · ${yuan(o.amountMinor)} 元</b></p><div class="xp-qr"></div><p class="xp-muted" id="xp-poll">付款后这里会自动更新，不用重复付款。</p><p class="xp-muted">订单号 ${esc(o.id)}</p><button type="button" class="text-button" id="xp-refresh">我已付款，刷新</button></div>`;
      const slot=box.querySelector('.xp-qr');
      if(mobile&&o.channel==='alipay'&&/^https:\/\//.test(payload)){slot.innerHTML=`<a class="primary" href="${esc(payload)}" rel="noopener">打开支付宝付款</a>`;}
      else if(payload&&!/^(data:|javascript:)/i.test(payload)){try{slot.append(qr(payload));const hint=document.createElement('p');hint.className='xp-muted';hint.textContent=o.channel==='wechat'?(mobile?'请截图后用微信扫一扫识别，或用另一台手机扫码':'用微信扫一扫付款'):'用支付宝扫一扫付款';slot.append(hint);}catch(e){slot.textContent=e.message;}}
      else slot.textContent='付款码暂时显示不了，请稍后刷新';
      $('#xp-refresh').addEventListener('click',()=>poll(true));return;
    }
    const why={expired:'这个订单已过期，没有扣款的话可以重新下单。',failed:'下单没成功，没有扣款，可以再试一次。',payment_review:'付款信息需要人工核对，请走帮助与反馈，我们会尽快处理。',refunded:'这个订单已退款。'}[o.status]||'订单状态暂时无法确认，请稍后刷新。';
    box.innerHTML=`<p class="xp-muted">${why}</p>`;
  }
  function stop(){clearTimeout(st.timer);st.timer=null;}
  async function poll(manual){
    stop();if(!st.order)return;
    try{st.order=await call('/orders/'+encodeURIComponent(st.order.id));err('');}catch(e){err(e.message);}
    renderOrder();
    if(st.order.status==='paid'){await load();return;}
    if(st.order.status!=='pending')return;
    if(manual)st.polls=0;
    if(++st.polls<60)st.timer=setTimeout(()=>poll(false),6000);
    else{const p=$('#xp-poll');if(p)p.textContent='已经等了一会儿。付完款请点下面的刷新。';}
  }
  async function checkout(){
    err('');const b=$('#xp-pay');b.disabled=true;b.textContent='正在下单…';
    try{st.order=await call('/checkout',{method:'POST',body:JSON.stringify({sku:st.sku,channel:st.channel})});st.polls=0;renderOrder();st.timer=setTimeout(()=>poll(false),6000);}
    catch(e){err(e.status===401?'请先登录再购买。':e.message);if(e.status===401)$('#xp-error').insertAdjacentHTML('beforeend',' <a href="/pages/friends-connect.html#login">去登录</a>');}
    finally{b.disabled=false;b.textContent='去付款';}
  }
  async function load(){
    try{st.status=await call('/me');}catch{try{st.status=await call('/status');}catch{st.status={open:false};}}
    renderMe();renderBuy();
  }
  load();
})();
