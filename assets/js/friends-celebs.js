'use strict';
// 明星日主库索引页：按名字搜索、按类别筛选。只在已渲染的静态列表上显示/隐藏，不请求任何数据。
(()=>{
  const q=document.getElementById('cl-q'),chips=[...document.querySelectorAll('.cl-chip')],none=document.getElementById('cl-none');
  if(!q)return;
  let cat='';
  function apply(){
    const term=q.value.trim().toLowerCase();let shown=0;
    for(const g of document.querySelectorAll('.cl-group')){
      let n=0;
      for(const row of g.querySelectorAll('.cl-row')){
        const ok=(!cat||row.dataset.cat===cat)&&(!term||row.dataset.name.toLowerCase().includes(term));
        row.hidden=!ok;if(ok)n++;
      }
      g.hidden=(term||cat)?n===0:false;shown+=n;
    }
    none.hidden=shown>0;
  }
  q.addEventListener('input',apply);
  for(const c of chips)c.addEventListener('click',()=>{cat=c.dataset.cat;for(const x of chips)x.setAttribute('aria-pressed',String(x===c));apply();});
})();
