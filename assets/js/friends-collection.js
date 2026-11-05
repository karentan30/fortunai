'use strict';
// 相生 · 打卡图鉴 (#collection). Self-contained: friends.js route() calls XiangshengCollection.show().
// Data: GET /api/friends/collection (owner-only). The share image is drawn ONLY from `share` (types and counts):
// no other person's nickname, photo or id is ever painted.
(()=>{
  const main=document.getElementById('main');if(!main)return;
  const $=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const EL={wood:['#2f6e55','#e1ede4'],fire:['#ad3f2c','#f6e1d9'],earth:['#8a5f17','#f1e5c8'],metal:['#56606b','#eaecee'],water:['#1d3550','#dfe6ee']};
  const BRAND=['#24473a','#e3ebe4'],PAPER='#f7f4ec',INK='#1f2a26',MUTED='#5d665e',LINE='#e2dccd';
  const SERIF='"Noto Serif SC","Source Han Serif SC","Songti SC","STSong",serif',SANS='-apple-system,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
  const COLS={dayMaster:5,mbti:4,constellation:4,zodiac:6};
  const cellText=(key,c)=>key==='dayMaster'?c.name:key==='zodiac'?c.value:c.value;
  async function api(path){
    const r=await fetch('/api/friends'+path,{credentials:'same-origin',cache:'no-store',headers:{'X-Runae-Friends':'1'}});
    let body;try{body=await r.json();}catch{throw Error('服务暂时不可用，请稍后再试。');}
    if(!r.ok){const e=Error(body.error||'没有打开，请重试。');e.status=r.status;throw e;}
    return body;
  }
  let data=null,share=null,referral=null,png=null,seq=0;

  function shell(inner){main.innerHTML='<section class="page-wrap xc-page">'+inner+'</section>';window.scrollTo({top:0,behavior:'instant'});}
  function gate(title,text,label,href){shell(`<div class="xc-gate"><h1>${title}</h1><p>${text}</p><a class="primary xc-btn" href="${href}">${label}</a></div>`);}

  async function show(){
    const my=++seq;shell('<p class="loading">正在打开图鉴…</p>');
    try{
      const r=await api('/collection');if(my!==seq)return;data=r.collection;share=r.share;
      try{const ref=await api('/referral');referral=/^r[0-9a-f]{11}$/.test(ref.code||'')?ref.code:null;}catch{referral=null;}
      if(my!==seq)return;
    }catch(e){
      if(my!==seq)return;
      if(e.status===401)return gate('登录后查看你的图鉴','每认识一位朋友，就点亮一种日主、MBTI、星座和生肖。','登录','#login');
      return gate('图鉴暂时打不开',esc(e.message),'重试','#collection');
    }
    if(!data.hasProfile||!data.listed)return gate('先发布你的交友卡','图鉴只记录互相接受认识的朋友，发布交友卡后就能开始收集。','去完善卡片','#profile');
    render();
  }

  function render(){
    const cats=data.categories,dm=cats.find(c=>c.key==='dayMaster');
    const tone=EL[data.owner?.element]||BRAND;
    const stats=cats.map(c=>`<a class="xc-stat" href="#xc-${c.key}"><span>${c.label}</span><b>${c.litCount}<small>/${c.total}</small></b></a>`).join('');
    const sections=cats.map(c=>{
      const missing=c.cells.filter(x=>!x.lit).map(x=>x.name);
      const hint=!c.litCount?'认识第一位朋友，就亮起第一格':missing.length>3?`还差 ${missing.length} 种，点格子看看`:missing.length?'还差'+missing.map(n=>`<span class="xc-nw">${esc(n)}</span>`).join('、'):'全部点亮';
      const cells=c.cells.map((x,i)=>{const t=x.element?EL[x.element]:BRAND;
        return `<button type="button" class="xc-cell${x.lit?' is-lit':''}" data-cat="${c.key}" data-i="${i}" style="--c:${t[0]};--cs:${t[1]}" aria-label="${esc(x.name)}${x.lit?'，已认识 '+x.count+' 位':'，还没认识'}"><span class="xc-cell-name">${esc(cellText(c.key,x))}</span>${x.lit?`<span class="xc-cell-n">${x.count}位</span>`:''}</button>`;}).join('');
      return `<section class="xc-block" id="xc-${c.key}"><div class="xc-block-head"><h2>${c.label}</h2><span class="xc-count"><b>${c.litCount}</b>/${c.total}</span></div>
        <div class="xc-bar" aria-hidden="true"><i style="width:${Math.round(c.litCount/c.total*100)}%"></i></div>
        <div class="xc-grid" style="--cols:${COLS[c.key]}">${cells}</div><p class="xc-hint">${hint}</p></section>`;
    }).join('');
    shell(`<header class="xc-head" style="--c:${tone[0]};--cs:${tone[1]}">
        <div class="xc-me"><span class="xc-me-stem">${esc(data.owner?.dayMasterName||'')}</span><div><h1>${esc(data.owner?.nickname||'')}的相生图鉴</h1><p>认识一位，点亮一格。只算互相接受认识的朋友。</p><p class="xc-legend"><span class="xc-legend-lit" aria-hidden="true"></span>亮的格子 = 你认识的朋友是这一类（不算你自己）<span class="xc-legend-off" aria-hidden="true"></span>暗的 = 还没认识</p></div></div>
        <p class="xc-headline">${esc(dm.headline)}</p>
        <div class="xc-stats">${stats}</div></header>
      ${sections}
      <section class="xc-share"><div class="xc-block-head"><h2>分享我的图鉴</h2></div>
        <p class="xc-share-note">图片只有类型和数量，不含任何朋友的昵称或照片。</p>
        <div class="xc-share-stage"><img id="xc-png" alt="我的相生图鉴分享图"></div>
        <p class="xc-share-tip">手机上长按图片即可保存</p>
        <button type="button" class="primary xc-btn" id="xc-download">保存图鉴图片</button>
        <a class="secondary xc-btn" href="#discover">去找朋友，点亮下一格</a>
      </section>
      <dialog class="xc-sheet" id="xc-sheet"><div class="xc-sheet-body"></div><form method="dialog"><button class="secondary xc-btn">知道了</button></form></dialog>`);
    main.querySelectorAll('.xc-cell').forEach(b=>b.addEventListener('click',()=>openCell(b.dataset.cat,Number(b.dataset.i))));
    $('#xc-download').addEventListener('click',download);
    drawShare().then(url=>{const img=$('#xc-png');if(img&&url)img.src=url;});
  }

  function openCell(key,i){
    const c=data.categories.find(x=>x.key===key),x=c.cells[i],sheet=$('#xc-sheet');if(!sheet)return;
    $('.xc-sheet-body',sheet).innerHTML=x.lit
      ?`<h2>你认识的${esc(x.name)}</h2><ul class="xc-names">${x.people.map(n=>`<li>${esc(n)}</li>`).join('')}</ul><p class="xc-hint">只有你自己能看到这份名单。</p>`
      :`<h2>还没认识${esc(x.name)}的朋友</h2><p class="xc-hint">互相接受认识后，这一格会亮起来。</p><a class="primary xc-btn" href="#discover">去找朋友</a>`;
    sheet.showModal();
  }

  // ---- Share image (1080×1440, 3:4) ----
  function destination(){
    const u=new URL(location.origin+'/pages/friends-connect.html');
    u.searchParams.set('source','xhs');u.searchParams.set('campaign','collection');if(referral)u.searchParams.set('xref',referral);
    u.hash='hello';return u.toString();
  }
  function paintQr(ctx,url,x,y,max){
    if(typeof window.qrcode!=='function')return 0;
    const qr=window.qrcode(0,'M');qr.addData(url);qr.make();const n=qr.getModuleCount(),cell=Math.floor(max/(n+8)),size=cell*(n+8);
    ctx.fillStyle='#fff';ctx.fillRect(x,y,size,size);ctx.fillStyle='#172b20';
    for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(qr.isDark(r,c))ctx.fillRect(x+(c+4)*cell,y+(r+4)*cell,cell,cell);
    return size;
  }
  // Wrap to max width; never leave a single character alone on the last line.
  function wrap(ctx,text,max){
    // Break between tokens only, so a type name such as「庚金」never splits across lines.
    const tokens=text.match(/[A-Za-z0-9]+|[^、，\s]{1,2}[、，]?|\s+/g)||[text];
    const lines=[];let cur='';
    for(const tk of tokens){if(ctx.measureText((cur+tk).trimEnd()).width>max&&cur.trim()){lines.push(cur.trimEnd());cur=tk.trimStart();}else cur+=tk;}
    if(cur)lines.push(cur);
    if(lines.length>1&&[...lines[lines.length-1]].length<2){const prev=[...lines[lines.length-2]];lines[lines.length-1]=prev.pop()+lines[lines.length-1];lines[lines.length-2]=prev.join('');}
    return lines;
  }
  function round(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
  async function drawShare(){
    if(!share)return null;
    try{await document.fonts?.ready;}catch{}
    const W=1080,H=1440,M=72,cv=document.createElement('canvas');cv.width=W;cv.height=H;const ctx=cv.getContext('2d');
    const owner=share.owner||{},tone=EL[owner.element]||BRAND;
    ctx.fillStyle=PAPER;ctx.fillRect(0,0,W,H);
    // Masthead
    ctx.fillStyle=BRAND[0];ctx.font='600 46px '+SERIF;ctx.textBaseline='alphabetic';ctx.fillText('相生',M,104);
    ctx.textAlign='right';ctx.fillStyle=MUTED;ctx.font='28px '+SANS;ctx.fillText('打卡图鉴',W-M,100);ctx.textAlign='left';
    ctx.fillStyle=INK;ctx.fillRect(M,134,W-2*M,2);
    // Owner
    ctx.fillStyle=tone[0];ctx.font='700 132px '+SERIF;ctx.fillText(owner.dayMasterName||'',M-4,292);
    const stemW=ctx.measureText(owner.dayMasterName||'').width;
    ctx.fillStyle=INK;ctx.font='600 40px '+SANS;
    const nameX=M+stemW+36,nameMax=W-M-nameX;let nick=String(owner.nickname||'');while(nick&&ctx.measureText(nick).width>nameMax)nick=nick.slice(0,-1);
    ctx.fillText(nick,nameX,226);ctx.fillStyle=MUTED;ctx.font='30px '+SANS;ctx.fillText(`已认识 ${share.knownCount} 位朋友`,nameX,280);
    // Headline
    const dm=share.categories.find(c=>c.key==='dayMaster');
    ctx.fillStyle=INK;ctx.font='700 54px '+SERIF;let y=392;
    for(const line of wrap(ctx,dm.headline,W-2*M).slice(0,2)){ctx.fillText(line,M,y);y+=70;}
    // Grids
    y=Math.max(y-6,470);
    const layout={dayMaster:{cols:10,h:100},mbti:{cols:8,h:56,font:'600 26px '},constellation:{cols:12,h:60,font:'600 26px '},zodiac:{cols:12,h:60,font:'700 32px '}};
    const gap=10;
    for(const c of share.categories){
      const L=layout[c.key];
      ctx.fillStyle=INK;ctx.font='600 30px '+SANS;ctx.fillText(c.label,M,y+28);
      ctx.textAlign='right';ctx.font='28px '+SANS;const tw=ctx.measureText(`/${c.total}`).width;ctx.fillStyle=MUTED;ctx.fillText(`/${c.total}`,W-M,y+30);
      ctx.font='700 36px '+SERIF;ctx.fillStyle=BRAND[0];ctx.fillText(`${c.litCount}`,W-M-tw-2,y+30);ctx.textAlign='left';
      y+=44;
      const cw=(W-2*M-gap*(L.cols-1))/L.cols,rows=Math.ceil(c.cells.length/L.cols),ch=c.key==='dayMaster'?L.h:L.h;
      c.cells.forEach((x,i)=>{
        const col=i%L.cols,row=Math.floor(i/L.cols),cx=M+col*(cw+gap),cy=y+row*(ch+gap),t=x.element?EL[x.element]:BRAND;
        round(ctx,cx,cy,cw,ch,12);
        if(x.lit){ctx.fillStyle=t[0];ctx.fill();}else{ctx.fillStyle='#efebe1';ctx.fill();ctx.strokeStyle=LINE;ctx.lineWidth=2;ctx.stroke();}
        ctx.fillStyle=x.lit?'#fffdf8':'#8b9088';ctx.textAlign='center';
        if(c.key==='dayMaster'){ctx.font='700 40px '+SERIF;ctx.fillText(x.value,cx+cw/2,cy+46);ctx.font='26px '+SANS;ctx.fillText(x.name.slice(1),cx+cw/2,cy+80);}
        else{ctx.font=L.font+(c.key==='zodiac'?SERIF:SANS);ctx.fillText(c.key==='constellation'?x.value.replace(/座$/,''):x.value,cx+cw/2,cy+ch/2+11);}
        ctx.textAlign='left';
      });
      y+=rows*ch+(rows-1)*gap+24;
    }
    // Footer: QR back to the app (same source/campaign as the poster, plus the anonymous referral code).
    const fy=Math.max(y+4,1130),fh=H-56-fy;
    round(ctx,M-12,fy,W-2*M+24,fh,22);ctx.fillStyle=BRAND[1];ctx.fill();
    const q=paintQr(ctx,destination(),W-M-fh+28,fy+18,fh-36);
    ctx.fillStyle=BRAND[0];ctx.font='700 46px '+SERIF;ctx.fillText('你认识几种日主？',M+20,fy+fh/2-8);
    ctx.fillStyle=INK;ctx.font='28px '+SANS;ctx.fillText('扫码测测你的日主，开始收集',M+20,fy+fh/2+42);
    void q;
    ctx.fillStyle=MUTED;ctx.font='22px '+SANS;ctx.fillText('相生 · 相遇有迹 · 五行文化参考',M,H-22);
    png=cv;return cv.toDataURL('image/png');
  }
  async function download(){
    if(!png)await drawShare();if(!png)return;
    const a=document.createElement('a');a.download='相生-打卡图鉴-'+(share.categories[0].litCount)+'of10-1080x1440.png';a.href=png.toDataURL('image/png');document.body.appendChild(a);a.click();a.remove();
    try{fetch('/api/friends/events',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Runae-Friends':'1'},body:JSON.stringify({event:'poster_export',source:'xhs',campaign:'poster_a'})});}catch{}
  }

  // Entry on 「我的卡片」: one compact link card, injected (keeps friends.js untouched here).
  async function addEntry(){
    if(main.querySelector('#xc-entry'))return;
    const host=main.querySelector('.page-heading');if(!host)return;
    const a=document.createElement('a');a.id='xc-entry';a.className='xc-entry';a.href='#collection';
    a.innerHTML='<span class="xc-entry-title">我的相生图鉴</span><span class="xc-entry-sub">认识一位，点亮一格</span><span class="xc-entry-go" aria-hidden="true">›</span>';
    host.after(a);
    try{const r=await api('/collection');const c=r.collection;if(c.listed){const dm=c.categories.find(x=>x.key==='dayMaster');a.querySelector('.xc-entry-sub').textContent=`日主 ${dm.litCount}/${dm.total} · 已认识 ${c.knownCount} 位`;}}catch{}
  }
  new MutationObserver(()=>{if(main.querySelector('#profile-form')&&!main.querySelector('#xc-entry'))addEntry();}).observe(main,{childList:true});
  if(main.querySelector('#profile-form'))addEntry();
  window.XiangshengCollection={show,_draw:drawShare};
  if(location.hash==='#collection')show();
})();
