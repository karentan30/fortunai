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
    assert.equal(h.tailQrEnabled(), platform === 'wechat');
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
    assert.equal(url.hash,'#start');
    assert.equal(url.searchParams.has('card'),false);
    assert.equal(url.searchParams.get('source'),'wechat');
  }
});
