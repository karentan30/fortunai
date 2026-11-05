'use strict';
// 明星日主库数据门：每条都用现有日主引擎从生日独立重算，且至少 2 个独立来源；生成页与数据一致。
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {calculate}=require('./friends-chart');
const {Solar}=require('./bazi-engine/vendor/lunar-typescript');
const {CATEGORIES}=require('./friends-celebs');
const root=path.resolve(__dirname,'../..');
const {people}=JSON.parse(fs.readFileSync(path.join(root,'assets/data/friends-celebs.json'),'utf8'));
const ALLOWED_KEYS=new Set(['slug','name','category','birthDate','sources','ziHour','dayMaster','element','dayPillar','constellation','zodiac']);

test('library size and shape: text only, no photo/MBTI/fate fields',()=>{
  assert.ok(people.length>=80&&people.length<=130,'收录人数 '+people.length);
  const slugs=new Set(),names=new Set();
  for(const p of people){
    for(const k of Object.keys(p))assert.ok(ALLOWED_KEYS.has(k),`${p.name} 有多余字段 ${k}`);
    assert.match(p.slug,/^[a-z0-9-]+$/);assert.ok(!slugs.has(p.slug),'重复 slug '+p.slug);slugs.add(p.slug);
    assert.ok(!names.has(p.name),'重复姓名 '+p.name);names.add(p.name);
    assert.ok(CATEGORIES.includes(p.category),p.name+' 类别 '+p.category);
    assert.match(p.birthDate,/^\d{4}-\d{2}-\d{2}$/);
  }
});

test('every entry has >=2 distinct https sources from different pages',()=>{
  for(const p of people){
    assert.ok(Array.isArray(p.sources)&&p.sources.length>=2,p.name+' 来源不足2个');
    assert.equal(new Set(p.sources).size,p.sources.length,p.name+' 来源重复');
    for(const u of p.sources)assert.equal(new URL(u).protocol,'https:',p.name+' '+u);
  }
});

test('日主/日柱/生肖 recomputed from the date with the existing engine; 星座 from the calendar library',()=>{
  const now=new Date('2026-11-06T00:00:00Z');
  for(const p of people){
    const c=calculate({birthday:p.birthDate,calendar:'solar',...(p.ziHour?{time:'23:30'}:{})},now);
    assert.equal(p.dayMaster,c.dayMaster,p.name+' 日主');
    assert.equal(p.dayPillar,c.dayPillar,p.name+' 日柱');
    assert.equal(p.element,c.element,p.name+' 五行');
    assert.equal(p.zodiac,c.zodiac,p.name+' 生肖');
    const [y,m,d]=p.birthDate.split('-').map(Number);
    assert.equal(p.constellation,Solar.fromYmd(y,m,d).getXingZuo()+'座',p.name+' 星座');
  }
});

test('engine anchors still hold (self-proof: a broken engine would fail here, not just disagree with the JSON)',()=>{
  // 公认参考值：2000-01-01 为戊午日；1984-02-02 为甲子年春节（属鼠起点）。只测引擎本身，不依赖任何明星条目。
  assert.equal(calculate({birthday:'2000-01-01'},new Date('2026-11-06')).dayPillar,'戊午');
  assert.equal(calculate({birthday:'1984-02-02'},new Date('2026-11-06')).zodiac,'鼠');
  assert.equal(calculate({birthday:'1984-02-01'},new Date('2026-11-06')).zodiac,'猪');
});

test('generated pages: stable URL, SEO title, CTA with celeb campaign, footer line, no photos',()=>{
  const index=fs.readFileSync(path.join(root,'pages/friends-celebs.html'),'utf8');
  assert.match(index,/文化兴趣参考，生日来自公开资料/);
  for(const p of people){
    const file=path.join(root,'pages/friends-celebs',p.slug+'.html');
    assert.ok(fs.existsSync(file),'缺页面 '+p.slug);
    const html=fs.readFileSync(file,'utf8');
    assert.ok(html.includes(`<title>${p.name}是什么日主？${p.dayMaster}${p.element} · 相生</title>`),p.name+' title');
    assert.match(html,/<meta name="description" content="[^"]+">/);
    assert.ok(html.includes('href="/pages/friends-connect.html?source=xhs&campaign=celeb#hello">测测你和TA相不相生<'),p.name+' CTA');
    assert.ok(html.includes('文化兴趣参考，生日来自公开资料'));
    assert.doesNotMatch(html,/<img|MBTI|命运|运势/);
    assert.ok(index.includes(`/pages/friends-celebs/${p.slug}.html`),p.name+' 不在索引');
  }
  const files=fs.readdirSync(path.join(root,'pages/friends-celebs'));
  assert.equal(files.length,people.length,'页面数与数据不一致（有残留页）');
});

test('celeb campaign is whitelisted everywhere attribution is normalised',()=>{
  assert.ok(require('./friends-admin').CAMPAIGNS.includes('celeb'));
  for(const f of ['assets/js/friends-attribution.js','assets/js/friends.js'])assert.match(fs.readFileSync(path.join(root,f),'utf8'),/'celeb'/,f);
  assert.match(fs.readFileSync(path.join(root,'assets/js/friends-admin.js'),'utf8'),/celeb:'明星日主库'/);
});
