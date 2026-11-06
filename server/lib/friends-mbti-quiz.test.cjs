'use strict';
// 相生快速性格小测：题库结构、计分、打平加题。
const test=require('node:test'),assert=require('node:assert/strict');
const quiz=require('../../assets/js/friends-mbti-quiz.js');
const {AXES,QUESTIONS,TIE_BREAKERS,DESCRIPTIONS,DISCLAIMER,score,sequence}=quiz;
// pick the option that counts toward `pole`
const toward=(q,pole)=>q.a.pole===pole?'a':'b';

test('16 questions, 4 per axis, both options map to opposite poles, option A alternates',()=>{
  assert.equal(QUESTIONS.length,16);
  assert.equal(new Set(QUESTIONS.map(q=>q.id)).size,16);
  for(const [x,y] of AXES){
    const axis=x+y,qs=QUESTIONS.filter(q=>q.axis===axis);
    assert.equal(qs.length,4,axis);
    for(const q of [...qs,TIE_BREAKERS[axis]]){
      assert.deepEqual([q.a.pole,q.b.pole].sort(),[x,y].sort(),q.id);
      assert.ok(q.text&&q.a.text&&q.b.text&&q.a.text!==q.b.text,q.id);
    }
    const aSides=qs.map(q=>q.a.pole);
    for(let i=1;i<aSides.length;i++)assert.notEqual(aSides[i],aSides[i-1],axis+' option A should alternate');
    assert.equal(TIE_BREAKERS[axis].axis,axis);
  }
  assert.equal(Object.keys(TIE_BREAKERS).length,4);
});

test('16 short descriptions without the banned word; disclaimer text',()=>{
  const types=['E','I'].flatMap(a=>['S','N'].flatMap(b=>['T','F'].flatMap(c=>['J','P'].map(d=>a+b+c+d))));
  assert.deepEqual(Object.keys(DESCRIPTIONS).sort(),types.sort());
  for(const t of types){assert.ok(DESCRIPTIONS[t].length<=40,t);assert.doesNotMatch(DESCRIPTIONS[t],/自述|配对|恋爱|婚|命/);}
  assert.equal(DISCLAIMER,'这是相生的快速性格小测，不是官方 MBTI 测评，结果仅供参考，可以随时改。');
  assert.doesNotMatch(JSON.stringify({QUESTIONS,TIE_BREAKERS,DESCRIPTIONS}),/自述/);
});

test('clear majorities score straight to a type, no tie-breakers',()=>{
  const ans={};
  for(const q of QUESTIONS)ans[q.id]=toward(q,{EI:'E',SN:'N',TF:'F',JP:'P'}[q.axis]);
  for(const axis of ['EI','SN','TF','JP']){const q=QUESTIONS.find(q=>q.axis===axis);ans[q.id]=ans[q.id]==='a'?'b':'a';}
  const s=score(ans);
  assert.equal(s.type,'ENFP');assert.ok(s.complete);assert.deepEqual(s.tied,[]);assert.deepEqual(s.needTieBreak,[]);
  assert.deepEqual(s.counts,{E:3,I:1,S:1,N:3,T:1,F:3,J:1,P:3});
  assert.equal(sequence(ans).length,16);
});

test('2 : 2 on an axis triggers exactly that tie-breaker, which decides the letter',()=>{
  const ans={};
  for(const q of QUESTIONS)ans[q.id]=toward(q,{EI:'I',SN:'S',TF:'T',JP:'J'}[q.axis]);
  const ei=QUESTIONS.filter(q=>q.axis==='EI'),jp=QUESTIONS.filter(q=>q.axis==='JP');
  ans[ei[0].id]=toward(ei[0],'E');ans[ei[1].id]=toward(ei[1],'E');
  ans[jp[0].id]=toward(jp[0],'P');ans[jp[1].id]=toward(jp[1],'P');
  let s=score(ans);
  assert.equal(s.type,null);assert.equal(s.complete,false);
  assert.deepEqual(s.tied,['EI','JP']);assert.deepEqual(s.needTieBreak,['EI','JP']);
  assert.deepEqual(sequence(ans).slice(16).map(q=>q.id),['tEI','tJP']);
  ans.tEI=toward(TIE_BREAKERS.EI,'E');
  s=score(ans);assert.deepEqual(s.needTieBreak,['JP']);assert.equal(s.type,null);
  ans.tJP=toward(TIE_BREAKERS.JP,'J');
  s=score(ans);
  assert.equal(s.type,'ESTJ');assert.ok(s.complete);
  assert.equal(s.counts.E,3);assert.equal(s.counts.I,2);assert.equal(s.counts.J,3);assert.equal(s.counts.P,2);
  // a stale tie-breaker answer is ignored once the axis is no longer tied
  ans[ei[2].id]=toward(ei[2],'E');
  s=score(ans);assert.deepEqual(s.tied,['JP']);assert.equal(s.counts.E,3);assert.equal(s.counts.I,1);assert.equal(s.type,'ESTJ');
});

test('incomplete answers never produce a type or tie-breakers',()=>{
  const s=score({q1:'a',q2:'b'});
  assert.equal(s.type,null);assert.deepEqual(s.tied,[]);assert.deepEqual(s.needTieBreak,[]);
  assert.equal(score({}).complete,false);assert.equal(score(null).type,null);
  const bad=score({q1:'x'});assert.equal(bad.counts.E+bad.counts.I,0);
});
