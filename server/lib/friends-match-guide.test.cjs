'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const G=require('../../assets/js/friends-match-guide-data.js');
const {recommend,typeSuggestions}=require('./friends-preferences');
const {findForbidden}=require('./friends-copy-guard');
const ROOT=path.join(__dirname,'..','..');

function strings(v,out=[]){if(typeof v==='string')out.push(v);else if(Array.isArray(v))v.forEach(x=>strings(x,out));else if(v&&typeof v==='object')Object.values(v).forEach(x=>strings(x,out));return out;}
const rendered=()=>[...strings(G),...G.STEMS.flatMap(s=>strings(G.groupsFor(s.stem)))];
const pageText=()=>['pages/friends-match-guide.html','assets/js/friends-match-guide.js'].map(f=>fs.readFileSync(path.join(ROOT,f),'utf8')).join('\n');

test('match guide: every stem card groups exactly equal stemGroups() output',()=>{
  assert.deepEqual(G.STEMS.map(s=>s.stem),[...'甲乙丙丁戊己庚辛壬癸']);
  for(const s of G.STEMS){
    const server=recommend({dayMaster:s.stem}).stemGroups,mine=G.groupsFor(s.stem);
    assert.deepEqual(mine.map(g=>[g.key,g.stems]),server.map(g=>[g.key,g.stems]),s.stem);
    for(const [i,g] of mine.entries())assert.ok(server[i].label.startsWith(g.label),`${s.stem} ${g.label}`);
  }
});

test('match guide: sign elements follow typeSuggestions() same-element and complement groups',()=>{
  for(const e of G.SIGN_ELEMENTS)for(const sign of e.signs){
    const [same,comp]=typeSuggestions({constellation:sign}).constellationGroups;
    assert.deepEqual(same.items,e.signs.filter(x=>x!==sign));
    assert.deepEqual(comp.items,G.SIGN_ELEMENTS[e.complement].signs);
    assert.ok(comp.label.includes(G.SIGN_ELEMENTS[e.complement].name));
  }
  assert.equal(new Set(G.SIGN_ELEMENTS.flatMap(e=>e.signs)).size,12);
});

test('match guide copy passes friends-copy-guard, no scores, never 不合, hedged 相克',()=>{
  const all=rendered();assert.ok(all.length>80);
  for(const t of [...all,pageText()]){
    assert.deepEqual(findForbidden(t),[],t.slice(0,60));
    assert.ok(!/不合|[%％]|\d+\s*分(?!钟)/.test(t),t.slice(0,60));
  }
  assert.ok(!/<(title|h1|h2|h3)[^>]*>[^<]*玄学/.test(pageText()));
  assert.ok(!/玄学/.test(G.COPY.title));
  for(const s of G.STEMS){const n=s.portrait.split('。').filter(Boolean).length;assert.ok(n>=2&&n<=3,s.stem+' portrait 2-3 sentences');}
  assert.match(G.GROUP_META.ke.feel,/互补成长/);assert.match(G.GROUP_META.ke.feel,/沟通/);
  assert.equal(G.COPY.fine,'传统文化与流行性格话题，仅供认识时聊天参考');
  assert.match(pageText(),/friends-mbti-chart\.html/);assert.match(pageText(),/friends-questions\.html/);assert.match(pageText(),/friends-connect\.html#discover/);
});
