'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const D=require('./friends-preview-deck');
const {createFriendsStore}=require('./friends-store');

const PUBLIC_ALL={dayMaster:'public',zodiac:'public',age:'public',mbti:'public',constellation:'public',occupation:'public',industry:'public',school:'public',income:'public',assets:'public',familyAssets:'public',house:'public',car:'public',hukou:'public',height:'public'};
const SECRETS=['张秘密','北京大学','13800001111','wx_secret_id','我的自我介绍很长','A9.3','有房','有车','上海户籍','photo.jpg','voice.m4a','shareid_secret_0001','27岁','500万'];
function person(i,over={}){
  return {userId:'u'+i,shareId:'shareid_secret_000'+i,nickname:'张秘密',city:'北京',purposes:['buddy'],listed:true,
    chart:{dayMaster:'丙',zodiac:'马',age:27,ageAsOf:'2026-11-06',birthday:'1999-01-01'},
    fields:{age:'27',education:'本科',school:'北京大学',occupation:'AI算法工程师',industry:'互联网',income:'500万',assets:'A9.3',house:'有房',car:'有车',hukou:'上海户籍',height:'175'},
    visibility:{...PUBLIC_ALL},dateActivities:['羽毛球'],hobbies:['羽毛球','徒步','我家楼下的私人球馆','游泳'],mbti:'INTJ',constellation:'白羊座',
    bio:'我的自我介绍很长',contact:'13800001111 wx_secret_id',contactConsent:true,photo:'photo.jpg',voice:'voice.m4a',...over};
}
const storeOf=(profiles,extra={})=>({read:()=>({profiles,blocks:[],requests:[],moderation:[],...extra})});

test('guest card carries teaser fields only — no name, exact age, school, wealth, bio, contact, media or shareId',()=>{
  const deck=D.createPreviewDeck(storeOf([person(1)]));
  const out=deck.deck({stem:'甲'}),real=out.cards.filter(c=>!c.sample);
  assert.equal(real.length,1);
  const json=JSON.stringify(out.cards.filter(c=>!c.sample));
  for(const secret of SECRETS)assert.ok(!json.includes(secret),'leaked '+secret);
  const c=real[0];
  assert.deepEqual(Object.keys(c).sort(),['ageBracket','city','constellation','dayMaster','element','hobbies','jobCategory','mbti','purposeLabels','relation','token','zodiac'].sort());
  assert.equal(c.ageBracket,'25-29');assert.equal(c.jobCategory,'互联网/科技');assert.deepEqual(c.hobbies,['羽毛球','徒步','游泳']);
  assert.equal(c.element,'火');
});

test('self-proof: the allowlist test turns red if teaser copies the profile',()=>{
  const leaky=p=>({...p});
  const json=JSON.stringify(leaky(person(1)));
  assert.ok(SECRETS.some(s=>json.includes(s)),'secret probe must detect a leaky projection');
});

test('per-field owner scope: non-public MBTI/星座/生肖/age/occupation are omitted',()=>{
  const p=person(1,{visibility:{...PUBLIC_ALL,mbti:'connected',constellation:'private',zodiac:'connected',age:'private',occupation:'connected',industry:'private'}});
  const c=D.teaser(p);
  for(const k of ['mbti','constellation','zodiac','ageBracket','jobCategory'])assert.ok(!(k in c),k+' must be hidden');
  // Proof the guard matters: the same profile with public scopes exposes them.
  const open=D.teaser(person(1));for(const k of ['mbti','constellation','zodiac','ageBracket','jobCategory'])assert.ok(k in open);
});

test('exclusions: unlisted, disabled, 日主 not public, minors, deleted never appear',()=>{
  const ps=[person(1),person(2,{listed:false}),person(3,{visibility:{...PUBLIC_ALL,dayMaster:'connected'}}),person(4,{chart:{dayMaster:'丙',zodiac:'马',age:17}}),person(5)];
  const s={profiles:ps,blocks:[],requests:[],moderation:[{userId:'u5',disabled:true}]};
  const deck=D.createPreviewDeck({read:()=>s});
  const real=deck.deck({}).cards.filter(c=>!c.sample);
  assert.equal(real.length,1);
  assert.equal(deck.resolve(real[0].token),'u1');
  // deleted = removed from profiles: next response no longer has it
  s.profiles=[];assert.equal(deck.deck({}).cards.filter(c=>!c.sample).length,0);
  // self-proof: each excluded profile would be eligible without its own blocker
  assert.ok(D.eligible(s,person(2)));assert.ok(D.eligible(s,person(3)));assert.ok(D.eligible(s,person(4)));assert.ok(D.eligible({moderation:[]},person(5)));
  for(const p of [ps[1],ps[2],ps[3]])assert.equal(D.eligible(s,p),false);assert.equal(D.eligible({moderation:[{userId:'u5',disabled:true}]},ps[4]),false);
});

test('tokens are fresh per response (no stable id) and expire',()=>{
  let t=0;const deck=D.createPreviewDeck(storeOf([person(1)]),{now:()=>t});
  const a=deck.deck({}).cards[0].token,b=deck.deck({}).cards[0].token;
  assert.notEqual(a,b);assert.equal(deck.resolve(a),'u1');
  t=31*60*1000;assert.equal(deck.resolve(a),null);assert.equal(deck.resolve('nope'),null);assert.equal(deck.resolve(undefined),null);
});

test('cap at 12 and 相生 ranking before same city',()=>{
  const ps=Array.from({length:20},(_,i)=>person(i,{chart:{dayMaster:'庚',zodiac:'猴',age:30},city:'上海'}));
  ps.push(person(98,{chart:{dayMaster:'壬',zodiac:'鼠',age:30},city:'北京'})); // 水生木 → generates_me for 甲
  ps.push(person(99,{chart:{dayMaster:'丙',zodiac:'马',age:30},city:'深圳'})); // 木生火 → i_generate
  ps.push(person(97,{chart:{dayMaster:'庚',zodiac:'猴',age:30},city:'北京'})); // same city, different element
  const out=D.createPreviewDeck(storeOf(ps)).deck({stem:'甲',city:'北京'});
  assert.equal(out.cards.length,D.MAX_CARDS);
  assert.deepEqual(out.cards.slice(0,3).map(c=>c.dayMaster+c.city),['壬北京','丙深圳','庚北京']);
  assert.equal(out.cards[0].relation,'generates_me');
});

test('cold start fills to 3 with labelled fictional samples that have no token',()=>{
  const out=D.createPreviewDeck(storeOf([person(1)])).deck({stem:'甲'});
  assert.equal(out.real,1);assert.equal(out.cards.length,3);
  for(const c of out.cards.filter(c=>c.sample)){assert.equal(c.label,'虚构示例，不可申请认识');assert.ok(!('token' in c));}
  assert.equal(D.createPreviewDeck(storeOf([person(1),person(2),person(3)])).deck({}).cards.filter(c=>c.sample).length,0);
  assert.ok(D.SAMPLES.every(s=>s.sample===true&&s.label===D.SAMPLE_LABEL),'no unlabelled sample');
});

test('helpers: age bracket and coarse job category never echo free text',()=>{
  assert.equal(D.ageBracket(18),'18-24');assert.equal(D.ageBracket(25),'25-29');assert.equal(D.ageBracket(34),'30-34');assert.equal(D.ageBracket(61),'50+');assert.equal(D.ageBracket(17),'');
  assert.equal(D.jobCategory('张三的独家小店'),'');assert.equal(D.jobCategory('银行柜员'),'金融');
});

test('route: unauthenticated GET /preview works, resolve needs login, rate limited',async()=>{
  let express;try{express=require('express');}catch(e){express=require('../../.review/node_modules/express');}
  const {createRouter}=require('../routes/friends');
  const store=createFriendsStore();store.transaction(s=>{s.profiles.push(person(1,{userId:'owner'}));});
  let user=null;const app=express();app.use(express.json());
  app.use('/f',createRouter({express,store,secret:'x'.repeat(32),auth:(req,res,next)=>{req.user=user;next();}}));
  const server=await new Promise(r=>{const x=app.listen(0,'127.0.0.1',()=>r(x));});
  try{
    const base='http://127.0.0.1:'+server.address().port+'/f';
    const r=await fetch(base+'/preview?stem=甲&city=北京');assert.equal(r.status,200);
    const text=await r.text();for(const secret of SECRETS)assert.ok(!text.includes(secret),'route leaked '+secret);
    const token=JSON.parse(text).cards.find(c=>!c.sample).token;
    assert.equal((await fetch(base+'/preview/resolve/'+token)).status,401);
    user={id:'viewer'};
    const ok=await fetch(base+'/preview/resolve/'+token);assert.equal(ok.status,200);assert.equal((await ok.json()).shareId,'shareid_secret_0001');
    assert.equal((await fetch(base+'/preview/resolve/bogus')).status,404);
    store.transaction(s=>{s.blocks.push({by:'owner',target:'viewer'});});
    assert.equal((await fetch(base+'/preview/resolve/'+token)).status,404,'blocked pair cannot open the card');
    user=null;let last=200;for(let i=0;i<35;i++)last=(await fetch(base+'/preview')).status;assert.equal(last,429);
  }finally{server.close();}
});
