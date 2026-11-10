'use strict';
// 相生 · 增长看板 (admin). 只读：管理凭据放在内存里，走 /api/friends/admin/growth；中台密钥永远不到浏览器。
(()=>{
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let token='',days=7,epoch=0;
  function exit(){token='';$('#dash-token').value='';$('#dash-workspace').hidden=true;$('#dash-login').hidden=false;$('#dash-exit').hidden=true;}
  async function request(path){
    if(!token)throw Error('请先输入管理凭据。');
    const r=await fetch('/api/friends/admin'+path,{credentials:'omit',cache:'no-store',headers:{'X-Admin-Token':token,'X-Runae-Friends':'1'}});
    if(r.status===401){exit();$('#dash-auth-error').textContent='管理凭据无效，请重新输入。';throw Error('管理凭据无效');}
    let data;try{data=await r.json();}catch{throw Error('后台暂时不可用，请稍后重试。');}
    if(!r.ok)throw Error(data.error||'数据暂时取不到');return data;
  }
  const fmt=v=>v===null||v===undefined?'—':String(v);
  function targetCell(t,m){const v=t[m];return v===null||v===undefined?'<span class="dash-na">—</span>':esc(v)+(t.unit?'<small> '+esc(t.unit)+'</small>':'');}
  // 只对数值目标判断：全部达标=绿；一个都没达标=橙；其余不着色。区间目标和无目标不判。
  function status(t){
    const nums=['m1','m2','m3'].map(k=>t[k]).filter(v=>typeof v==='number');
    if(!nums.length||t.actual===null||t.actual===undefined)return '';
    if(nums.every(n=>t.actual>=n))return 'dash-ok';
    return nums.some(n=>t.actual>=n)?'':'dash-behind';
  }
  function render(d){
    $('#dash-targets').innerHTML='<thead><tr><th>指标</th><th>实际</th><th>第 1 月</th><th>第 2 月</th><th>第 3 月</th></tr></thead><tbody>'+
      d.targets.map(t=>`<tr><td>${esc(t.label)}</td><td class="${status(t)}">${esc(fmt(t.actual))}</td><td>${targetCell(t,'m1')}</td><td>${targetCell(t,'m2')}</td><td>${targetCell(t,'m3')}</td></tr>`).join('')+'</tbody>';
    const max=Math.max(1,...d.funnel.map(f=>f.distinct));
    $('#dash-funnel').innerHTML=d.funnel.map(f=>`<div class="dash-step"><span>${esc(f.label)}</span><div class="dash-bar"><i style="width:${Math.round(f.distinct/max*100)}%"></i></div><em>${f.distinct}${f.fromPrev===null?'':' · '+f.fromPrev+'%'}</em></div>`).join('');
    $('#dash-note').textContent=`北京时间自然日 · 近 ${d.days} 天 · 每格 = 事件次数（名片被打开每张卡每天计 1 次）。`;
    const cols=d.events;
    $('#dash-days').innerHTML='<thead><tr><th>日期</th>'+cols.map(c=>`<th>${esc(c.label)}</th>`).join('')+'</tr></thead><tbody>'+
      d.rows.slice().reverse().map(r=>`<tr><td>${esc(r.day.slice(5))}</td>${cols.map(c=>{const n=r.events[c.event]?.count||0;return `<td class="${n?'':'is-zero'}">${n}</td>`;}).join('')}</tr>`).join('')+
      `<tr><td><b>合计</b></td>${cols.map(c=>`<td><b>${d.windowTotals[c.event]||0}</b></td>`).join('')}</tr></tbody>`;
  }
  async function load(){
    const my=++epoch;$('#dash-error').textContent='';
    try{const d=await request('/growth?days='+days);if(my===epoch)render(d);}catch(e){if(my===epoch&&token)$('#dash-error').textContent=e.message;}
  }
  $('#dash-auth-form').addEventListener('submit',async e=>{
    e.preventDefault();token=$('#dash-token').value.trim();$('#dash-auth-error').textContent='';
    try{const d=await request('/growth?days='+days);$('#dash-login').hidden=true;$('#dash-workspace').hidden=false;$('#dash-exit').hidden=false;render(d);}
    catch(err){if(token){$('#dash-auth-error').textContent=err.message;token='';}}
  });
  document.querySelectorAll('.dash-toggle button').forEach(b=>b.addEventListener('click',()=>{days=Number(b.dataset.days);document.querySelectorAll('.dash-toggle button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));load();}));
  $('#dash-refresh').addEventListener('click',load);
  $('#dash-exit').addEventListener('click',exit);
})();
