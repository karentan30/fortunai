'use strict';
// 账号级出境同意（PIPL）：任一相生写接口返回 code=XS_CROSS_BORDER_CONSENT_REQUIRED 时，统一弹一次同意框（默认不勾选），
// 勾选并确认后写入账号级记录，再自动重试原请求；取消则把原 400 交还页面自行提示。须在其他 friends 脚本之前加载。
(function(){
  if(window.__xsCrossBorder)return;window.__xsCrossBorder=true;
  const CODE='XS_CROSS_BORDER_CONSENT_REQUIRED',API='/api/friends/cross-border-consent',raw=window.fetch.bind(window);
  const TEXT='我单独同意：相生由香港公司运营，我在相生保存的个人资料（含生辰、交友资料、问卷、核验材料、合盘与报告）将存储在香港服务器并在香港处理。可随时撤回，撤回后不再新存资料。';
  let pending=null;
  const urlOf=input=>{try{return new URL(typeof input==='string'?input:input.url,location.href);}catch(_){return null;}};
  function ask(version){
    if(pending)return pending;
    pending=new Promise(resolve=>{
      const d=document.createElement('dialog');d.className='xs-xb-dialog';d.setAttribute('aria-labelledby','xs-xb-title');
      d.innerHTML='<form method="dialog" style="max-width:420px;line-height:1.6"><h2 id="xs-xb-title" style="font-size:1.1rem;margin:0 0 .5rem">个人信息出境单独同意</h2><p style="margin:0 0 .75rem">保存资料前需要你单独同意一次（账号级，版本更新时会再请你确认）。<a href="/pages/friends-privacy.html#cross-border" target="_blank" rel="noopener">查看出境告知 ↗</a></p><label style="display:flex;gap:.5rem;align-items:flex-start"><input type="checkbox" id="xs-xb-check"><span></span></label><p id="xs-xb-error" role="alert" style="color:#b42318;margin:.5rem 0 0"></p><div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:1rem"><button value="cancel" type="submit">暂不同意</button><button value="ok" id="xs-xb-ok" type="submit" disabled>同意并继续</button></div></form>';
      d.querySelector('label span').textContent=TEXT;
      const box=d.querySelector('#xs-xb-check'),ok=d.querySelector('#xs-xb-ok'),err=d.querySelector('#xs-xb-error');
      box.addEventListener('change',()=>{ok.disabled=!box.checked;});
      const done=v=>{pending=null;d.remove();resolve(v);};
      d.addEventListener('cancel',()=>done(false));
      d.querySelector('form').addEventListener('submit',async ev=>{
        const v=ev.submitter&&ev.submitter.value;if(v!=='ok'){ev.preventDefault();d.close();done(false);return;}
        ev.preventDefault();if(!box.checked)return;ok.disabled=true;err.textContent='';
        try{const r=await raw(API,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Runae-Friends':'1'},body:JSON.stringify({consent:true,version})});
          if(!r.ok)throw Error((await r.json().catch(()=>({}))).error||'保存同意失败，请稍后再试');d.close();done(true);}
        catch(e){err.textContent=e.message||'保存同意失败，请稍后再试';ok.disabled=false;}
      });
      document.body.appendChild(d);if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','');
    });
    return pending;
  }
  window.fetch=async function(input,init){
    const spare=input instanceof Request?input.clone():null,res=await raw(input,init),u=urlOf(input);
    if(res.status!==400||!u||u.origin!==location.origin||!u.pathname.startsWith('/api/friends/')||u.pathname===API)return res;
    let body;try{body=await res.clone().json();}catch(_){return res;}
    if(!body||body.code!==CODE)return res;
    return (await ask(body.version))?raw(spare||input,init):res;
  };
  window.xsCrossBorder={ask,CODE};
})();
