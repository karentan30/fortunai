'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../assets/js/friends.js'), 'utf8');
function helpers(state) {
  const names = ['shareUrl', 'posterDestination', 'tailQrEnabled'];
  const code = names.map(name => source.split('\n').find(line => line.trimStart().startsWith('function ' + name + '('))).join('\n');
  assert.equal(code.split('\n').length, names.length);
  const context = vm.createContext({state, URL, location: {origin: 'https://runae.app'}});
  vm.runInContext(code, context);
  return context;
}
test('poster QR supports all four channels without disclosing private birth data', () => {
  for (const [platform, channel] of Object.entries({wechat:'wechat',xiaohongshu:'xhs',douyin:'douyin',channels:'channels'})) {
    const state = {platform, theme:0, posterMode:'profile', tailQr:null, profile:{listed:true,shareId:'public-card',birthDate:'1991-10-05',birthTime:'06:00',email:'private@example.test'}};
    const h = helpers(state), url = new URL(h.posterDestination());
    assert.equal(h.tailQrEnabled(), true); // owner decision 2026-11-06: QR next to the CTA on every platform, user can turn it off
    state.tailQr = true;
    assert.equal(h.tailQrEnabled(), true);
    assert.equal(url.origin, 'https://runae.app');
    assert.equal(url.searchParams.get('card'), 'public-card');
    assert.equal(url.searchParams.get('source'), channel);
    assert.equal(url.searchParams.get('campaign'), 'poster_a');
    assert.deepEqual([...url.searchParams.keys()].sort(), ['campaign','card','source']);
    state.tailQr = false;
    assert.equal(h.tailQrEnabled(), false);
  }
});
test('anonymous, invitation and unlisted exports lead to the free tool without identifying a private card', () => {
  for (const scenario of [{profile:null},{profile:{listed:false,shareId:'private-card'}},{profile:{listed:true,shareId:'public-card'},posterMode:'dayMaster'},{profile:{listed:true,shareId:'public-card'},theme:3}]) {
    const h=helpers({platform:'wechat',theme:0,posterMode:'profile',tailQr:null,...scenario});
    const url=new URL(h.posterDestination());
    assert.equal(url.pathname,'/pages/friends-connect.html');
    assert.equal(url.hash,'#hello');
    assert.equal(url.searchParams.has('card'),false);
    assert.equal(url.searchParams.get('source'),'wechat');
  }
});
test('wanted types reach the poster only while "海报上显示我想认识的类型" is on', () => {
  const line = source.split('\n').find(l => l.trimStart().startsWith('function publicOwn('));
  const context = vm.createContext({fieldLabels:{age:'年龄',income:'年收入'}});
  vm.runInContext(line, context);
  const own = {nickname:'测试', visibility:{age:'public',income:'private',mbti:'public',dayMaster:'public'}, mbti:'INFJ', fields:{age:'29',income:'50–100万'}, chart:{dayMaster:'丙'},
    targetStems:['甲'], targetZodiacs:['马'], targetMbtis:['ENFP','ENTP'], targetConstellations:['狮子座']};
  const on = context.publicOwn({...own});
  assert.deepEqual([...on.targetMbtis], ['ENFP','ENTP']);
  assert.deepEqual([...on.targetConstellations], ['狮子座']);
  assert.deepEqual([...on.targetZodiacs], ['马']);
  const off = context.publicOwn({...own, posterShowTargets:false});
  for (const key of ['targetStems','targetZodiacs','targetMbtis','targetConstellations']) assert.equal(off[key], undefined, key + ' must stay off the poster when the toggle is off');
  // Other privacy filtering is unchanged either way.
  for (const out of [on, off]) { assert.equal(out.fields.income, undefined); assert.equal(out.fields.age, '29'); }
});
test('profile sheet: money only for 认真结婚, 已核验 only from server verified data, own preview has no CTA', () => {
  const lines = source.split('\n');
  const pick = prefix => { const l = lines.find(x => x.trimStart().startsWith(prefix)); assert.ok(l, prefix); return l; };
  const start = lines.findIndex(l => l.trimStart().startsWith('function profileSheetHTML('));
  const end = lines.findIndex((l, i) => i > start && l === '  }');
  const code = [pick('const SENSITIVE='), pick('const verifiedMark='), pick('const POSTER_ELEMENTS='), pick('function posterPurposes('), pick('const HOBBY_ICONS='), pick('function hobbyIcon('), ...lines.slice(start, end + 1)].join('\n');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
  const context = vm.createContext({esc, fieldLabels:{age:'年龄',height:'身高 / cm',income:'年收入 / 万元人民币',assets:'个人净资产 / 万元人民币'}, fieldValue:(k, v) => String(v), shownValue:(k, v) => String(v), purposeText:() => ''});
  vm.runInContext(code, context);
  const card = {nickname:'测试', chart:{dayMaster:'丙'}, fields:{age:'28', height:'166', income:'100–300万'}, hobbies:['羽毛球']};
  const friend = context.profileSheetHTML({...card, purposes:['friend']});
  assert.match(friend, /年收入/, 'one card shows every field the owner made public, whatever the purposes');
  assert.match(friend, /166cm/);
  const serious = context.profileSheetHTML({...card, purposes:['serious']});
  assert.match(serious, /年收入/);
  assert.doesNotMatch(serious, /已核验/, 'no verified data from the server means no 已核验');
  assert.match(context.profileSheetHTML({...card, purposes:['serious'], verified:{income:true}}), /已核验/);
  const own = context.profileSheetHTML({...card, purposes:['friend'], explanation:{forYou:['x']}}, true);
  assert.doesNotMatch(own, /为什么推荐你们|apply-person/);
  
});
