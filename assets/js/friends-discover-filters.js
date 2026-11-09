'use strict';
// 找朋友：年龄 / 身高范围（双端滑块，免费）+「高级选项」折叠（会员筛选，由 friends-membership-ui 渲染进来）。
// 预设只来自本人资料：年龄 = 本人年龄 ±5（18–99 内）；身高 = 本人身高 ±20cm（140–210 内）。资料里没有性别字段，
// 所以不套用任何按性别的惯例。没有本人数据就是全范围（不筛）。两端拖到头 = 那一端不限，不发参数。
// 服务端才是权限和校验真相（friends-service rangeFilters）：只按对方公开给你的年龄/身高比较。
(()=>{
  const SPEC={age:{label:'年龄',min:18,max:99,step:1,pad:5,unit:'岁'},height:{label:'身高',min:140,max:210,step:1,pad:20,unit:'cm'}};
  const PARAMS={age:['ageMin','ageMax'],height:['heightMin','heightMax']};
  const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
  const own=(p,k)=>{const n=Number(k==='age'?(p?.fields?.age??p?.chart?.age):p?.fields?.height);return Number.isFinite(n)&&n>0?Math.round(n):null;};
  function defaults(profile){
    const out={preset:false};
    for(const [k,s] of Object.entries(SPEC)){const v=own(profile,k);if(v===null){out[k]=[s.min,s.max];continue;}out.preset=true;out[k]=[clamp(v-s.pad,s.min,s.max),clamp(v+s.pad,s.min,s.max)];}
    return out;
  }
  // Only a narrowed side is sent; a handle at the end of the track means 不限 on that side.
  function toParams(values){
    const out=[];
    for(const [k,s] of Object.entries(SPEC)){const [lo,hi]=values[k]||[s.min,s.max];if(lo>s.min)out.push([PARAMS[k][0],String(lo)]);if(hi<s.max)out.push([PARAMS[k][1],String(hi)]);}
    return out;
  }
  const text=(k,[lo,hi])=>{const s=SPEC[k];if(lo<=s.min&&hi>=s.max)return '不限';if(lo<=s.min)return hi+s.unit+'及以下';if(hi>=s.max)return lo+s.unit+'及以上';return lo===hi?lo+s.unit:lo+'–'+hi+s.unit;};
  const pos=(k,v)=>{const s=SPEC[k];return ((v-s.min)/(s.max-s.min)).toFixed(4);};
  if(typeof module==='object'&&module.exports){module.exports={defaults,toParams,text,SPEC};return;}

  const st={root:null,reload:null,values:null,preset:false,base:null,owner:null,timer:0};
  function group(k){
    const s=SPEC[k],[lo,hi]=st.values[k],id='xsr-'+k;
    const input=(i,v,name)=>`<input type="range" id="${id}-${i}" min="${s.min}" max="${s.max}" step="${s.step}" value="${v}" data-k="${k}" data-i="${i}" aria-label="${s.label}${name}" aria-valuetext="${s.label}${name} ${v}${s.unit}">`;
    return `<div class="xsr-group" role="group" aria-labelledby="${id}-t"><div class="xsr-head"><span id="${id}-t">${s.label}</span><output id="${id}-v" for="${id}-0 ${id}-1">${text(k,[lo,hi])}</output></div>
<div class="xsr-track" style="--lo:${pos(k,lo)};--hi:${pos(k,hi)}"><span class="xsr-rail" aria-hidden="true"></span>${input(0,lo,'最小')}${input(1,hi,'最大')}</div>
<div class="xsr-scale" aria-hidden="true"><span>${s.min}</span><span>${s.max}${s.unit}</span></div></div>`;
  }
  function render(){
    const root=st.root;if(!root||!root.isConnected)return;
    root.className='xsr';root.setAttribute('aria-label','年龄和身高范围');
    root.innerHTML=`${group('age')}${group('height')}<p class="xsr-note"><span>${st.preset?'已按你的资料预设，可拖动调整':'拖动两端设定范围'}</span><button type="button" class="text-button xsr-reset"${moved()?'':' hidden'}>${st.preset?'恢复预设':'恢复不限'}</button></p>
<p class="xsr-fine">没公开年龄或身高的人，在设了这项范围时不会出现。</p>
<details class="xsr-adv"><summary>高级选项</summary><div id="xsr-adv-body"></div></details>`;
    root.querySelectorAll('input[type=range]').forEach(el=>{el.addEventListener('input',onInput);el.addEventListener('change',schedule);});
    root.querySelector('.xsr-reset')?.addEventListener('click',()=>{st.values={age:[...st.base.age],height:[...st.base.height]};paintAll();schedule();st.root.querySelector('#xsr-age-0')?.focus();});
  }
  // Update in place while dragging (no re-render: keeps focus and pointer capture).
  function paint(k){
    const s=SPEC[k],v=st.values[k],track=st.root.querySelector(`#xsr-${k}-0`)?.parentElement;if(!track)return;
    track.style.setProperty('--lo',pos(k,v[0]));track.style.setProperty('--hi',pos(k,v[1]));
    [0,1].forEach(i=>{const el=st.root.querySelector(`#xsr-${k}-${i}`);el.value=v[i];el.setAttribute('aria-valuetext',`${s.label}${i?'最大':'最小'} ${v[i]}${s.unit}`);});
    st.root.querySelector(`#xsr-${k}-v`).textContent=text(k,v);
    // Keep the lower handle reachable when both sit at the top end.
    st.root.querySelector(`#xsr-${k}-0`).style.zIndex=v[0]>=s.max-(s.max-s.min)*0.1?3:'';
  }
  function paintAll(){paint('age');paint('height');}
  function onInput(e){
    const el=e.currentTarget,k=el.dataset.k,i=Number(el.dataset.i),v=[...st.values[k]];
    let n=Number(el.value);if(i===0)n=Math.min(n,v[1]);else n=Math.max(n,v[0]);v[i]=n;st.values[k]=v;paint(k);
  }
  const moved=()=>JSON.stringify(st.values)!==JSON.stringify({age:st.base.age,height:st.base.height});
  function schedule(){const b=st.root?.querySelector('.xsr-reset');if(b)b.hidden=!moved();clearTimeout(st.timer);st.timer=setTimeout(()=>st.reload?.(),250);}
  window.XSRange={
    // profile: the viewer's own saved card (state.profile). Values survive re-mounts for the same person in this tab.
    mount(root,{profile,reload}={}){
      if(!root)return;st.root=root;st.reload=reload;
      const owner=profile?.shareId||null;
      if(!st.values||st.owner!==owner){const d=defaults(profile);st.base={age:d.age,height:d.height};st.preset=d.preset;st.values={age:[...d.age],height:[...d.height]};st.owner=owner;}
      render();
    },
    params(){return st.values?toParams(st.values):[];},
    advancedRoot(){return st.root?.querySelector('#xsr-adv-body')||null;}
  };
})();
