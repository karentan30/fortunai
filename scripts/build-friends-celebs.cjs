'use strict';
// 明星日主库：读 assets/data/friends-celebs.json（姓名/类别/公开生日/来源），用现有日主引擎补全日主/星座/生肖，
// 并生成静态页：pages/friends-celebs.html（索引）+ pages/friends-celebs/<slug>.html（每人一页，稳定 URL 便于搜索收录）。
// 用法：node scripts/build-friends-celebs.cjs
const fs=require('node:fs'),path=require('node:path');
const {CATEGORIES,STEMS,TONES,compute,stemLine}=require('../server/lib/friends-celebs');
const root=path.resolve(__dirname,'..');
const DATA=path.join(root,'assets/data/friends-celebs.json');
const OUT_DIR=path.join(root,'pages/friends-celebs');
const ORIGIN='https://runae.app';
const CTA_URL='/pages/friends-connect.html?source=xhs&campaign=celeb#hello';
const STEM_ID={甲:'jia',乙:'yi',丙:'bing',丁:'ding',戊:'wu',己:'ji',庚:'geng',辛:'xin',壬:'ren',癸:'gui'};
const FOOTNOTE='文化兴趣参考，生日来自公开资料';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cnDate=d=>{const [y,m,dd]=d.split('-').map(Number);return `${y}年${m}月${dd}日`;};
const host=u=>{try{return new URL(u).hostname.replace(/^www\./,'');}catch{return u;}};

function head({title,description,canonical}){
  return `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f7f4ec"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${ORIGIN}${canonical}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><link rel="stylesheet" href="/assets/css/friends-tokens.css"><link rel="stylesheet" href="/assets/css/friends-celebs.css"></head>
<body class="cl-body">
<header class="cl-header"><a class="cl-brand" href="/pages/friends-connect.html" aria-label="相生 首页">相生</a><a class="cl-top-link" href="/pages/friends-celebs.html">明星日主库</a></header>
`;
}
const foot=`<footer class="cl-footer"><p>${FOOTNOTE}。按出生日期推算日柱，时辰未公开时按当日计算；生肖按农历春节。只作文化话题，不评价任何人的性格和感情。</p><nav aria-label="页脚"><a href="/pages/friends-privacy.html">隐私说明</a><a href="/pages/friends-terms.html">服务条款</a><a href="/pages/friends-help.html">帮助与反馈</a></nav></footer>
`;

function build(){
  const raw=JSON.parse(fs.readFileSync(DATA,'utf8'));
  const people=raw.people.map(p=>{
    if(!CATEGORIES.includes(p.category))throw Error('未知类别：'+p.name);
    if(!Array.isArray(p.sources)||new Set(p.sources).size<2)throw Error('来源不足2个：'+p.name);
    const {slug,name,category,birthDate,sources,ziHour}=p;
    return {slug,name,category,birthDate,sources,...(ziHour?{ziHour:true}:{}),...compute(p)};
  });
  const data={note:'明星日主库。birthDate 来自至少两个公开来源（sources）；dayMaster/dayPillar/constellation/zodiac 由 server/lib/friends-celebs.js 用现有日主引擎推算，勿手改。',people};
  fs.writeFileSync(DATA,JSON.stringify(data,null,1)+'\n');
  const byStem=Object.fromEntries(STEMS.map(s=>[s,people.filter(p=>p.dayMaster===s)]));

  // ---- 索引页 ----
  const groups=STEMS.map(s=>{
    const list=byStem[s];const el=['木','木','火','火','土','土','金','金','水','水'][STEMS.indexOf(s)];
    return `<section class="cl-group" id="stem-${STEM_ID[s]}" data-element="${TONES[el]}" aria-labelledby="h-${STEM_ID[s]}"><h2 id="h-${STEM_ID[s]}">${s}${el}<small>${list.length}位</small></h2><p class="cl-trait">${esc(stemLine(s))}</p>${list.length?`<ul class="cl-list">${list.map(p=>`<li class="cl-row" data-name="${esc(p.name)}" data-cat="${esc(p.category)}"><a href="/pages/friends-celebs/${p.slug}.html"><b>${esc(p.name)}</b><span class="cl-cat">${esc(p.category)}</span><span class="cl-types">${s}${el} · ${esc(p.constellation)} · 属${esc(p.zodiac)}</span></a></li>`).join('')}</ul>`:'<p class="cl-empty">暂未收录。</p>'}</section>`;
  }).join('\n');
  const stemNav=STEMS.map(s=>{const el=['木','木','火','火','土','土','金','金','水','水'][STEMS.indexOf(s)];return `<a href="#stem-${STEM_ID[s]}" data-element="${TONES[el]}" aria-label="${s}${el}">${s}${el}</a>`;}).join('');
  const index=head({title:'明星日主库：明星都是什么日主？ · 相生',description:`收录${people.length}位公众人物，按公开生日推算日主、星座和生肖。搜名字，看看谁和你同一个日主。`,canonical:'/pages/friends-celebs.html'})+
`<main class="cl-wrap" id="main">
<h1>明星日主库</h1>
<p class="cl-lead">按公开生日推算的日主、星座和生肖。看看谁和你同一个日主。</p>
<div class="cl-tools"><label class="cl-search"><input id="cl-q" type="search" placeholder="搜名字，比如周杰伦" aria-label="搜索名字" autocomplete="off" enterkeyhint="search"></label>
<div class="cl-chips" role="group" aria-label="按类别筛选"><button type="button" class="cl-chip" data-cat="" aria-pressed="true">全部</button>${CATEGORIES.filter(c=>people.some(p=>p.category===c)).map(c=>`<button type="button" class="cl-chip" data-cat="${c}" aria-pressed="false">${c}</button>`).join('')}</div></div>
<nav class="cl-stems" aria-label="按日主跳转">${stemNav}</nav>
${groups}
<p class="cl-empty" id="cl-none" hidden>没有找到，换个名字试试。</p>
<div class="cl-bottom-cta"><p>不知道自己是什么日主？填生日就能看，不用注册。</p><a class="cl-primary" href="${CTA_URL}">测测我是什么日主</a></div>
</main>
${foot}<script src="/assets/js/friends-celebs.js" defer></script>
</body></html>
`;
  fs.writeFileSync(path.join(root,'pages/friends-celebs.html'),index);

  // ---- 每人一页 ----
  fs.rmSync(OUT_DIR,{recursive:true,force:true});fs.mkdirSync(OUT_DIR,{recursive:true});
  for(const p of people){
    const sv=p.dayMaster+p.element,tone=TONES[p.element];
    const same=byStem[p.dayMaster].filter(x=>x.slug!==p.slug);
    const desc=`${p.name}生于${cnDate(p.birthDate)}（公开资料），按生日推算日柱${p.dayPillar}，日主${sv}，${p.constellation}，属${p.zodiac}。测测你和TA相不相生。`;
    const note=p.ziHour?'公开资料记载生于23点以后，按23点换日推算；若按0点换日，日主会不同。生肖按农历春节。':'时辰未公开，按出生当日推算日柱；生肖按农历春节。';
    const html=head({title:`${p.name}是什么日主？${sv} · 相生`,description:desc,canonical:`/pages/friends-celebs/${p.slug}.html`})+
`<main class="cl-wrap" id="main" data-element="${tone}">
<nav class="cl-crumb" aria-label="位置"><a href="/pages/friends-celebs.html">明星日主库</a><span aria-hidden="true">/</span><a href="/pages/friends-celebs.html#stem-${STEM_ID[p.dayMaster]}">${sv}</a><span aria-hidden="true">/</span><span class="cl-crumb-current" aria-current="page">${esc(p.name)}</span></nav>
<section class="cl-hero"><div class="cl-glyph" aria-hidden="true">${p.dayMaster}<small>${p.element}</small></div><div><h1>${esc(p.name)}是什么日主？</h1><p class="cl-answer">按公开生日推算，${esc(p.name)}是<strong>${sv}</strong>。</p></div></section>
<p class="cl-trait">${esc(stemLine(p.dayMaster))}日主是认识的起点，合不合得来，相处了才知道。</p>
<a class="cl-primary" href="${CTA_URL}">测测你和TA相不相生</a>
<p class="cl-cta-note">填生日看自己的日主，不用注册。</p>
<dl class="cl-facts"><dt>类别</dt><dd>${esc(p.category)}</dd><dt>公开生日</dt><dd>${cnDate(p.birthDate)}</dd><dt>日柱</dt><dd>${esc(p.dayPillar)}</dd><dt>星座</dt><dd>${esc(p.constellation)}</dd><dt>生肖</dt><dd>${esc(p.zodiac)}</dd></dl>
<p class="cl-note">${note}</p>
${same.length?`<section class="cl-same" aria-labelledby="same-h"><h2 id="same-h">同是${sv}的还有</h2><ul>${same.map(x=>`<li><a href="/pages/friends-celebs/${x.slug}.html">${esc(x.name)}</a></li>`).join('')}</ul></section>`:''}
<details class="cl-sources"><summary>生日来源（${p.sources.length}个）</summary><ul>${p.sources.map(u=>`<li><a href="${esc(u)}" rel="nofollow noopener" target="_blank">${esc(host(u))}</a></li>`).join('')}</ul></details>
</main>
${foot}</body></html>
`;
    fs.writeFileSync(path.join(OUT_DIR,p.slug+'.html'),html);
  }
  return people;
}
if(require.main===module){const people=build();console.log('明星日主库：'+people.length+'人，'+STEMS.map(s=>s+people.filter(p=>p.dayMaster===s).length).join(' '));}
module.exports={build,CTA_URL,STEM_ID};
