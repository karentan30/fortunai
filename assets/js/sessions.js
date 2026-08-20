/* Runae 通用 session 前端组件 · 首个总览免费 + 其余 $3.99 + 一键全买 $11.99
   用法: RunaeSessions.render({ method:'ziwei', input:{year,month,day,hour,gender}, mount: el, methodLabel:'紫微斗数' }) */
(function(){
  var TOPICS = {
    ziwei: [
      { topic:'career', emoji:'💼', label:'事业官禄' },
      { topic:'wealth', emoji:'💰', label:'财帛财运' },
      { topic:'love',   emoji:'💕', label:'夫妻姻缘' },
      { topic:'dayun',  emoji:'📅', label:'大限流年' }
    ],
    astrology: [
      { topic:'career', emoji:'💼', label:'事业财富' },
      { topic:'love',   emoji:'💕', label:'爱情关系' },
      { topic:'growth', emoji:'🧠', label:'性格天赋' }
    ]
  };
  var ELEM = { '火':'#e0673a','土':'#c8a24a','金':'#d9d2b0','水':'#4a9fd4','木':'#5fae6a','风':'#8ab4d8','开创':'#e0673a','固定':'#c8a24a','变动':'#5fae6a' };
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\*\*(.+?)\*\*/g,'<b style="color:#f5e98a">$1</b>').replace(/(20\d\d\s*年?)/g,'<span style="color:#7fc4e8;font-weight:600">$1</span>'); }
  function bars(label,parts){ var rows=parts.map(function(p){var c=ELEM[p[0]]||'#8aa0c0';return '<div style="display:flex;align-items:center;gap:8px;margin:6px 0"><span style="width:56px;font-size:12px;color:#cbd4e4;text-align:right">'+p[0]+'</span><span style="flex:1;height:11px;background:rgba(255,255,255,.06);border-radius:6px;overflow:hidden"><span style="display:block;height:100%;width:'+p[1]+'%;background:'+c+'"></span></span><span style="width:34px;font-size:11px;color:#9fb0cc">'+p[1]+'%</span></div>';}).join('');return '<div style="margin:12px 0;padding:12px 16px;background:rgba(10,16,34,.5);border-radius:8px;border:1px solid rgba(212,180,110,.15)"><div style="font-size:12px;color:#c8b98a;margin-bottom:6px">'+esc(label)+'</div>'+rows+'</div>'; }
  function renderBody(text){ var lines=String(text||'').split('\n'),out=[],lead=false; for(var i=0;i<lines.length;i++){var s=lines[i].trim();if(!s||s.indexOf('---')===0)continue; if(s.indexOf('：')>0&&s.indexOf('%')>0){var seg=s.split('：'),parts=[],re=/([A-Za-z一-龥]+)\s*[A-Za-z]*\s*(\d+)%/g,m;while(m=re.exec(seg[1])){if(+m[2]<=100)parts.push([m[1],+m[2]]);}if(parts.length>=2){out.push(bars(seg[0].replace(/\*/g,''),parts));continue;}} var cm=s.match(/^(✅|⚠️|🔑|💡|📌)\s*(.+)/);if(cm){var w=cm[1]!=='✅';out.push('<div style="display:flex;gap:8px;font-size:14px;line-height:1.7;padding:10px 14px;margin:8px 0;border-radius:8px;background:'+(w?'rgba(224,150,60,.1)':'rgba(95,174,106,.1)')+';border:1px solid '+(w?'rgba(224,150,60,.32)':'rgba(95,174,106,.3)')+';color:'+(w?'#f0dcc0':'#cfe8d2')+'"><span>'+cm[1]+'</span><span>'+esc(cm[2])+'</span></div>');continue;} if(!lead&&s.length>12){var mm=s.match(/^[^。！？]*[。！？]/);var ld=mm?mm[0]:s,rest=mm?s.slice(mm[0].length):'';out.push('<div style="font-size:16px;line-height:1.7;color:#fff3cf;font-weight:600;padding:11px 15px;margin:2px 0 12px;border-left:4px solid #e6c874;background:linear-gradient(90deg,rgba(230,200,116,.14),transparent);border-radius:0 8px 8px 0">'+esc(ld)+'</div>');lead=true;if(rest.trim())out.push('<p style="margin:0 0 11px;line-height:1.9">'+esc(rest.trim())+'</p>');continue;} out.push('<p style="margin:0 0 11px;line-height:1.9">'+esc(s)+'</p>');} return out.join(''); }
  function tok(){ try{return localStorage.getItem('sy_token')||'';}catch(e){return '';} }
  function fetchSession(method,topic,input){ return fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok()},body:JSON.stringify({method:method,topic:topic,birthYear:input.year,birthMonth:input.month,birthDay:input.day,birthHour:input.hour,gender:input.gender,token:tok()})}).then(function(r){return r.json();}); }
  function checkout(product,btn){ if(!product)return; if(btn){btn.disabled=true;btn.textContent='跳转支付…';} fetch('/api/create-checkout',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok()},body:JSON.stringify({product:product,token:tok()})}).then(function(r){return r.json();}).then(function(d){if(d.url)location.href=d.url;else if(btn){btn.disabled=false;btn.textContent='重试';}}).catch(function(){if(btn){btn.disabled=false;btn.textContent='重试';}}); }
  window.RunaeSessions = {
    render: function(opts){
      var method=opts.method, input=opts.input, mount=opts.mount, bundle=method+'_full';
      var topics=TOPICS[method]||[];
      if(!mount||!input) return;
      var grid=topics.map(function(t){return '<button data-topic="'+t.topic+'" style="flex:1;min-width:96px;background:rgba(107,63,160,0.12);border:1px solid rgba(155,111,196,0.35);border-radius:12px;padding:14px 8px;color:#e8e0ff;font-size:13px;cursor:pointer;text-align:center"><div style="font-size:22px;margin-bottom:4px">'+t.emoji+'</div>'+t.label+'<div style="font-size:11px;color:rgba(245,233,138,0.7);margin-top:3px">$3.99</div></button>';}).join('');
      var wrap=document.createElement('div'); wrap.style.cssText='margin:24px auto 8px;max-width:720px';
      wrap.innerHTML='<div style="font-size:13px;color:rgba(74,159,212,0.75);letter-spacing:.1em;margin-bottom:6px;text-align:center">— '+(opts.methodLabel||'')+' Session · 总览免费，其余每个 $3.99 —</div>'+
        '<div id="rsOverview" style="margin:12px 0 18px"></div>'+
        '<div style="display:flex;gap:10px;flex-wrap:wrap">'+grid+'</div>'+
        '<div id="rsPanel" style="margin-top:16px"></div>'+
        '<div style="text-align:center;margin-top:18px;padding:16px;background:rgba(107,63,160,0.1);border:1px solid rgba(245,233,138,0.28);border-radius:14px"><div style="color:#f5e98a;font-size:14px;margin-bottom:4px">✨ 一键全买全部 Session</div><div style="color:rgba(232,224,255,0.6);font-size:12px;margin-bottom:10px">五折 <b style="color:#f5e98a">$11.99</b></div><button id="rsBundle" style="background:linear-gradient(135deg,#f0d98a,#c8a24a);border:none;border-radius:10px;padding:13px 34px;color:#2a1e08;font-size:15px;font-weight:700;cursor:pointer">一键全解锁 · $11.99</button></div>';
      mount.appendChild(wrap);
      wrap.querySelector('#rsBundle').onclick=function(){checkout(bundle,this);};
      wrap.querySelectorAll('button[data-topic]').forEach(function(b){ b.onclick=function(){ var panel=wrap.querySelector('#rsPanel'); wrap.querySelectorAll('button[data-topic]').forEach(function(x){x.style.background='rgba(107,63,160,0.12)';}); b.style.background='rgba(107,63,160,0.32)'; panel.innerHTML='<div style="text-align:center;padding:24px;color:rgba(232,224,255,0.7)">✦ 正在为你深挖…</div>'; fetchSession(method,b.getAttribute('data-topic'),input).then(function(d){ if(!d||!d.reading){panel.innerHTML='<div style="text-align:center;padding:20px;color:#e88">加载失败，请重试</div>';return;} var raw=String(d.reading||''),li=raw.indexOf('---LOCKED---'),free=li>=0?raw.slice(0,li):raw; var html='<div style="background:rgba(8,16,26,0.6);border:1px solid rgba(74,159,212,0.15);border-radius:14px;padding:20px 22px;color:#e8f0ff;font-size:15px">'+renderBody(free)+'</div>'; if(d.locked){html+='<div style="text-align:center;margin-top:14px"><div style="color:rgba(245,233,138,0.75);font-size:13px;margin-bottom:10px">🔒 完整「'+(d.title||'专项')+'」Session 已锁定</div><button style="background:linear-gradient(135deg,#9b6fc4,#6b3fa0);border:none;border-radius:10px;padding:13px 30px;color:#fff;font-size:15px;font-weight:600;cursor:pointer" onclick="RunaeSessions._buy(\''+(d.product||'')+'\',this)">解锁本 Session · $3.99</button><div style="margin-top:10px"><a style="color:rgba(245,233,138,0.85);font-size:13px;cursor:pointer;text-decoration:underline" onclick="RunaeSessions._buy(\''+bundle+'\',this)">或一键全买 · $11.99（五折）→</a></div></div>';} panel.innerHTML=html; panel.scrollIntoView({behavior:'smooth',block:'nearest'}); }).catch(function(){panel.innerHTML='<div style="text-align:center;padding:20px;color:#e88">网络错误，请重试</div>';}); }; });
      // auto-load free overview
      var ov=wrap.querySelector('#rsOverview'); ov.innerHTML='<div style="text-align:center;padding:16px;color:rgba(232,224,255,0.6)">✦ 总览生成中…</div>';
      fetchSession(method,'overview',input).then(function(d){ if(!d||!d.reading){ov.innerHTML='';return;} ov.innerHTML='<div style="font-size:13px;color:#f5e98a;letter-spacing:.1em;margin-bottom:8px">📜 '+(d.title||'总览')+' · 免费</div><div style="background:rgba(8,16,26,0.6);border:1px solid rgba(74,159,212,0.15);border-radius:14px;padding:18px 20px;color:#e8f0ff;font-size:15px">'+renderBody(d.reading)+'</div>'; }).catch(function(){ov.innerHTML='';});
    },
    _buy: function(p,el){ checkout(p,el); }
  };
})();
