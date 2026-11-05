'use strict';
// 明星日主库 → 8 篇小红书图文素材（文字卡，无明星照片）。
// 名单全部从 assets/data/friends-celebs.json 读取（日主由引擎推算），文案不写死任何人的日主，避免对不上。
// 用法：node scripts/xiangsheng-celeb-xhs-pack.cjs [--png]
//   默认只写 docs/xiangsheng-content/celeb-xhs-pack-2026-11-06.md；--png 再用本机 Chrome 渲染 1080×1440 卡片。
const fs=require('node:fs'),path=require('node:path');
const {stemLine,STEMS}=require('../server/lib/friends-celebs');
const root=path.resolve(__dirname,'..');
const {people}=JSON.parse(fs.readFileSync(path.join(root,'assets/data/friends-celebs.json'),'utf8'));
const OUT_MD=path.join(root,'docs/xiangsheng-content/celeb-xhs-pack-2026-11-06.md');
const OUT_PNG=path.join(root,'docs/xiangsheng-content/celeb-cards');
const LINK='https://runae.app/pages/friends-connect.html?source=xhs&campaign=celeb#hello';
const EL=s=>'木木火火土土金金水水'[STEMS.indexOf(s)];
const TONE={木:'wood',火:'fire',土:'earth',金:'metal',水:'water'};
const SV=s=>s+EL(s);
const of=s=>people.filter(p=>p.dayMaster===s);
// 优先不同类别，顺序固定。
function pick(list,n){const seen=new Set(),out=[];for(const p of list)if(out.length<n&&!seen.has(p.category)){seen.add(p.category);out.push(p);}for(const p of list)if(out.length<n&&!out.includes(p))out.push(p);return out;}
const names=list=>list.map(p=>p.name).join('、');
const byCat=list=>{const m=new Map();for(const p of list){if(!m.has(p.category))m.set(p.category,[]);m.get(p.category).push(p.name);}return [...m].map(([c,n])=>`${c}：${n.join('、')}`);};
const TAIL='生日来自公开资料，时辰不公开，按出生当天算。';
const CTA='想对照自己的，可以去测一下日主，填生日就行，不用注册（链接在主页）。';
const TAGS=['#日主','#天干','#五行','#明星生日','#传统文化'];

const biggest=[...STEMS].sort((a,b)=>of(b).length-of(a).length)[0];
const diverse=[...STEMS].sort((a,b)=>new Set(of(b).map(p=>p.category)).size-new Set(of(a).map(p=>p.category)).size)[0];
const athletes=people.filter(p=>p.category==='运动员');
const bosses=people.filter(p=>p.category==='企业家');
const tenOne=STEMS.map(s=>[s,pick(of(s),1)[0]]);

const notes=[
  {key:'01-ten-stems',title:'十种日主，我各挑了一位明星',stem:null,cover:['十种日主','各挑了一位明星'],
    cards:[0,2,4,6,8].map(i=>({head:`${SV(STEMS[i])} · ${SV(STEMS[i+1])}`,lines:[STEMS[i],STEMS[i+1]].map(s=>{const p=tenOne.find(x=>x[0]===s)[1];return `${SV(s)}：${p?p.name+'（'+p.category+'）':'暂未收录'}`;}).concat([stemLine(STEMS[i]).replace(/。$/,'')+'；'+STEMS[i+1]+'为阴'+EL(STEMS[i+1])+'。'])}))
      .concat([{head:'怎么算的',lines:['日主＝出生那天日柱的天干','只看公历生日，不需要时辰',TAIL]}]),
    caption:`最近在翻日主，顺手把公开资料里查得到生日的明星按十种日主整理了一下，每种挑一位放上来：${tenOne.filter(x=>x[1]).map(x=>SV(x[0])+x[1].name).join('，')}。日主就是出生那天日柱的天干，只看生日就能推出来。${TAIL}只是当个文化话题看看，不代表谁是什么性格。${CTA}`},
  {key:'02-jia-wood',stem:'甲',title:'甲木的明星都有谁',cover:['甲木的明星','都有谁？']},
  {key:'03-ding-fire',stem:'丁',title:'丁火明星合集',cover:['丁火','明星合集']},
  {key:'04-which-one',title:'你和哪位明星同一个日主？',stem:null,cover:['你和哪位明星','同一个日主？'],
    cards:[{head:'日主是什么',lines:['八字里“日柱”的第一个字','一共十种：甲乙丙丁戊己庚辛壬癸','只要公历生日就能推出来']},
      {head:'时辰不知道也没关系',lines:['日主只看出生那一天','只有23点以后出生的，','按传统换日算法，可能算到第二天']},
      {head:'我查了几位',lines:pick(people.filter(p=>['华语歌手','华语演员'].includes(p.category)),5).map(p=>`${p.name}：${SV(p.dayMaster)}`)},
      {head:'也有运动员和企业家',lines:pick(athletes.concat(bosses),5).map(p=>`${p.name}：${SV(p.dayMaster)}`)},
      {head:'对照一下自己',lines:['先测出自己的日主','再去库里找同一个字的人',TAIL]}],
    caption:`日主其实就是出生那天日柱的天干，只要生日就能推。我把查得到公开生日的明星都算了一遍，放了几位在图里：${pick(people,6).map(p=>p.name+SV(p.dayMaster)).join('，')}。同一个日主的人，职业、经历都差很多，所以就当个聊天的话题。${TAIL}${CTA}`},
  {key:'05-biggest',stem:biggest,title:`${SV(biggest)}的明星有点多`,cover:[`${SV(biggest)}的明星`,'比我想的多']},
  {key:'06-athletes',title:'运动员都是什么日主',stem:null,cover:['运动员','都是什么日主？'],
    cards:chunk(STEMS.filter(s=>athletes.some(p=>p.dayMaster===s)),3).map(group=>({head:group.map(SV).join(' · '),lines:group.map(s=>`${SV(s)}：${names(athletes.filter(p=>p.dayMaster===s))}`)}))
      .concat([{head:'说明',lines:['按公开生日推算，只看出生那天',TAIL.replace('生日来自公开资料，','')]}]),
    caption:`看比赛的时候突然好奇运动员都是什么日主，就按公开生日算了一下：${STEMS.filter(s=>athletes.some(p=>p.dayMaster===s)).map(s=>SV(s)+'有'+names(athletes.filter(p=>p.dayMaster===s).slice(0,2))).join('；')}。十种日主里都能找到运动员，成绩靠的是训练，日主只是个有意思的标签。${TAIL}${CTA}`},
  {key:'07-founders',title:'这些企业家都是什么日主',stem:null,cover:['这些企业家','都是什么日主？'],
    cards:chunk(bosses,4).map((g,i)=>({head:i?'接着看':'按公开生日算',lines:g.map(p=>`${p.name}：${SV(p.dayMaster)}`)}))
      .concat([{head:'说明',lines:['只用公开生日推算日柱','不评价任何人的经历和选择',TAIL.replace('生日来自公开资料，','')]}]),
    caption:`整理明星日主的时候顺便算了企业家：${bosses.map(p=>p.name+SV(p.dayMaster)).join('，')}。这十位里壬水多一点，样本太小，说明不了什么。只是好玩，别当成创业指南。${TAIL}${CTA}`},
  {key:'08-same-stem',stem:diverse,title:'同一个日主，职业差很远',cover:['同一个日主','职业差很远'],
    cards:[{head:SV(diverse),lines:[stemLine(diverse)]}].concat(chunk(byCat(of(diverse)),3).map(g=>({head:`同是${SV(diverse)}`,lines:g}))).concat([{head:'所以',lines:['日主只是一个认识自己的话题','合不合得来，相处了才知道',TAIL]}]),
    caption:`${SV(diverse)}这一组最有意思：${byCat(of(diverse)).join('；')}。同一个日主，做的事完全不一样。所以我觉得日主更适合当个开场话题，“你是什么日主”比“你是做什么的”好聊一点。${TAIL}${CTA}`}
];
function chunk(a,n){const out=[];for(let i=0;i<a.length;i+=n)out.push(a.slice(i,i+n));return out;}
// 单个日主合集的卡片与配文（02/03/05）。
for(const n of notes)if(n.stem&&!n.cards){
  const s=n.stem,list=of(s);
  // 每张卡最多 3 人一行、约 4 行；人少时也至少拆成两张，保证 4–6 张卡。
  const per=Math.max(2,Math.min(8,Math.ceil(list.length/4)));
  const mid=chunk(list,per).slice(0,4).map((g,i)=>({head:i?'还有':`${SV(s)}的明星`,lines:g.map(p=>`${p.name}（${p.category}）`)}));
  n.cards=[{head:SV(s),lines:[stemLine(s),`这次整理到${list.length}位`]}].concat(mid).concat([{head:'你也是'+SV(s)+'吗',lines:['日主只看出生那一天','测出来是'+SV(s)+'的话，评论区打个'+s,TAIL]}]);
  n.caption=`按公开生日把明星的日主都算了一遍，${SV(s)}这一组有：${names(list)}。${stemLine(s)}同一个日主的人，性格和经历都各不一样，看看就好。${TAIL}${CTA}评论区说说你是什么日主？`;
}
for(const n of notes){
  n.cards=n.cards.slice(0,6);
  if(n.cards.length<4)throw Error(n.key+' 卡片少于4张');
  if([...n.title].length>20)throw Error(n.key+' 标题超过20字');
  if([...n.caption].length>300)throw Error(n.key+' 配文超过300字：'+[...n.caption].length);
  for(const t of [n.title,n.caption,...n.cards.flatMap(c=>[c.head,...c.lines])])if(/最准|必看|命中|旺夫|克夫|注定|大师/.test(t))throw Error(n.key+' 含禁用词：'+t);
}

function md(){
  const out=[`# 相生 · 明星日主库 小红书图文包（2026-11-06）`,'',
`给运营明天用。8 篇，全部是纯文字卡（无明星照片）。名单从 \`assets/data/friends-celebs.json\` 自动取，每位的生日都有 ≥2 个公开来源，日主由现有引擎按生日推算（重跑：\`node scripts/xiangsheng-celeb-xhs-pack.cjs --png\`）。`,'',
'## 发布前必读（合规）','',
'- 明星名字只用于**自然流量笔记**和我们自己的页面（明星日主库）。**不要用于付费投放**（薯条/聚光/信息流广告等）：商业使用他人姓名涉及姓名权，需授权。',
'- 不放任何明星照片、剧照、写真；只发本包里的文字卡。',
'- 不写明星的性格、命运、感情、健康判断；不写“最准”“必看”等绝对化用语；不编造“多少人测过”之类的数字。',
'- 卡片和图片里不放二维码、不放外链（小红书会判导流）。链接放主页简介或按平台规则处理。',
'- 有人在评论区问某位明星“适合谁”“婚姻如何”，统一回复：只是按公开生日算的文化话题，不评价任何人。','',
'## 链接与归因','',
`- 所有 8 篇共用同一个链接：\`${LINK}\``,
'- 活动码统一为 `campaign=celeb`（后台显示“明星日主库”），渠道 `source=xhs`。白名单里只有这一个活动码，**不区分单篇**；想看单篇效果，用小红书后台每篇的阅读/主页访问数对照。',
'- 链接打开后直接进入“填生日测日主”（#hello）。','',
'## 卡片图片','',
'`docs/xiangsheng-content/celeb-cards/<编号>-<序号>.png`，1080×1440（3:4）。`-00` 是封面，其余按顺序发。',''];
  notes.forEach((n,i)=>{
    out.push(`## ${i+1}. ${n.title}`,'',`- 封面字（3:4）：${n.cover.join(' / ')}`,`- 图片：\`celeb-cards/${n.key}-00.png\` ~ \`${n.key}-${String(n.cards.length).padStart(2,'0')}.png\``,'','卡片文字：','');
    n.cards.forEach((c,j)=>out.push(`${j+1}. **${c.head}**：${c.lines.join(' / ')}`));
    out.push('','配文（'+[...n.caption].length+'字）：','',`> ${n.caption}`,'',`话题：${TAGS.join(' ')}`,'',`链接：主页简介链接（campaign=celeb）`,'');
  });
  fs.mkdirSync(path.dirname(OUT_MD),{recursive:true});fs.writeFileSync(OUT_MD,out.join('\n'));
}

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function cardHTML(n,c,idx,total){
  const tone=n.stem?TONE[EL(n.stem)]:'brand',cover=idx===0;
  const body=cover?`<div class="cover"><p class="kicker">明星日主库</p><h1>${n.cover.map(esc).join('<br>')}</h1>${n.stem?`<div class="glyph">${n.stem}</div>`:''}</div>`
    :`<div class="card"><p class="num">${idx} / ${total}</p><h2>${esc(c.head)}</h2>${c.lines.map(l=>`<p class="line">${esc(l)}</p>`).join('')}</div>`;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><link rel="stylesheet" href="file://${root}/assets/css/friends-tokens.css"><style>
  html,body{margin:0;width:1080px;height:1440px}
  body{background:var(--xs-paper);color:var(--xs-ink);font-family:var(--xs-serif);display:flex;flex-direction:column;box-sizing:border-box;padding:110px 96px 80px}
  [data-element="brand"]{--xs-el:var(--xs-primary);--xs-el-soft:var(--xs-primary-soft)}
  .frame{flex:1;display:flex;flex-direction:column;justify-content:center;border-left:10px solid var(--xs-el);padding-left:64px}
  .kicker{margin:0 0 40px;font:500 40px/1 var(--xs-sans);color:var(--xs-el);letter-spacing:.2em}
  h1{margin:0;font-size:116px;line-height:1.28;font-weight:700;text-wrap:balance}
  .glyph{margin-top:70px;width:260px;height:260px;border-radius:40px;background:var(--xs-el-soft);color:var(--xs-el);font-size:190px;line-height:260px;text-align:center;font-weight:700}
  .num{margin:0 0 36px;font:500 34px/1 var(--xs-sans);color:var(--xs-muted)}
  h2{margin:0 0 56px;font-size:84px;line-height:1.3;color:var(--xs-el);text-wrap:balance}
  .line{margin:0 0 34px;font-size:52px;line-height:1.55;text-wrap:pretty}
  footer{margin-top:40px;font:400 30px/1.4 var(--xs-sans);color:var(--xs-muted)}
  </style></head><body data-element="${tone}"><div class="frame">${body}</div><footer>文化兴趣参考 · 生日来自公开资料</footer></body></html>`;
}
async function png(){
  const {chromium}=require('playwright-core');
  const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const page=await browser.newPage({viewport:{width:1080,height:1440}});
  fs.rmSync(OUT_PNG,{recursive:true,force:true});fs.mkdirSync(OUT_PNG,{recursive:true});
  const tmp=path.join(require('node:os').tmpdir(),'xs-celeb-card.html');let count=0;
  for(const n of notes){
    const all=[null,...n.cards];
    for(let i=0;i<all.length;i++){
      fs.writeFileSync(tmp,cardHTML(n,all[i],i,n.cards.length));
      await page.goto('file://'+tmp);await page.evaluate(()=>document.fonts.ready);
      const over=await page.evaluate(()=>document.body.scrollHeight>1440||document.body.scrollWidth>1080);
      if(over)throw Error(`${n.key}-${i} 文字溢出卡片`);
      await page.screenshot({path:path.join(OUT_PNG,`${n.key}-${String(i).padStart(2,'0')}.png`)});count++;
    }
  }
  await browser.close();fs.rmSync(tmp,{force:true});return count;
}
(async()=>{md();console.log('写入',path.relative(root,OUT_MD));if(process.argv.includes('--png'))console.log('卡片',await png(),'张');})().catch(e=>{console.error(e);process.exitCode=1;});
