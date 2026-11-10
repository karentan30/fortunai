'use strict';
// 相生 · 相合局运营页：标记合作俱乐部、手动跑一次分组、看概况。凭据只放内存，不写入存储。
(function(){
  const $=s=>document.querySelector(s);
  let token='';
  const toast=m=>{const t=$('#toast');t.textContent=m;t.hidden=false;setTimeout(()=>{t.hidden=true;},3500);};
  const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
  async function call(path,body){
    if(!token)throw Error('请先输入管理凭据。');
    const r=await fetch('/api/friends/admin/heju'+path,{method:body?'POST':'GET',credentials:'omit',cache:'no-store',headers:{'X-Admin-Token':token,'X-Runae-Friends':'1','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    let d=null;try{d=await r.json();}catch(_){}
    if(r.status===401||r.status===403){token='';$('#ha-work').hidden=true;$('#ha-login').hidden=false;throw Error('管理凭据无效，请重新输入。');}
    if(!r.ok)throw Error((d&&d.error)||'操作没成功');
    return d||{};
  }
  async function refresh(){
    const [c,s]=await Promise.all([call('/clubs'),call('/summary')]);
    const ul=$('#ha-clubs');ul.replaceChildren();
    if(!c.clubs.length)ul.append(el('li','还没有合作俱乐部。'));
    for(const x of c.clubs)ul.append(el('li',x.name+(x.disabled?'（已停用）':'')));
    const box=$('#ha-summary');box.replaceChildren();
    box.append(el('p','登记：'+JSON.stringify(s.signups)),el('p','局：'+JSON.stringify(s.groups)),el('p','合作俱乐部：'+s.clubs+' 家 · 缺席记录：'+s.strikes+' 条'));return true;
  }
  async function run(fn,ok){try{const r=await fn();if(ok)toast(ok);return r;}catch(e){toast(e.message);return null;}}
  $('#ha-login-form').addEventListener('submit',async e=>{
    e.preventDefault();token=$('#ha-token').value.trim();$('#ha-token').value='';
    if(await run(refresh)){$('#ha-login').hidden=true;$('#ha-work').hidden=false;}
  });
  $('#ha-club-form').addEventListener('submit',async e=>{
    e.preventDefault();
    const name=$('#ha-name').value.trim(),who=$('#ha-who').value.trim(),disabled=$('#ha-off').checked;
    const send=async()=>{try{return await call('/clubs',{name,disabled,shareId:who});}catch(err){if(/没有找到这个卡片/.test(err.message))return call('/clubs',{name,disabled,userId:who});throw err;}};
    if(await run(send,disabled?'已停用':'已标记为合作俱乐部'))refresh().catch(()=>{});
  });
  $('#ha-run').addEventListener('click',async()=>{const r=await run(()=>call('/run',{}));if(r){toast('已跑完：新组 '+r.groups+' 个，补人 '+r.filled+' 人');refresh().catch(()=>{});}});
  $('#ha-exit').addEventListener('click',()=>{token='';$('#ha-work').hidden=true;$('#ha-login').hidden=false;});
})();
