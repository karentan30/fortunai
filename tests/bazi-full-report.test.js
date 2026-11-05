'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {buildFullBaziMessages,generateBaziText,generateFullBaziReport}=require('../server/lib/bazi-full-report');
const input={birthYear:1991,birthMonth:10,birthDay:5,birthHour:6,gender:'female',question:'了解自己',mode:'gentle'};
test('original full Chinese prompt snapshot is preserved',()=>{
 const RealDate=global.Date;global.Date=class extends RealDate{constructor(...a){super(...(a.length?a:['2026-11-04T00:00:00Z']));}};
 try {const messages=buildFullBaziMessages(input,{chartBlock:'已核实四柱测试数据',year:2026});assert.equal(crypto.createHash('sha256').update(JSON.stringify(messages)).digest('hex'),'19262c6d118760c610c924347d33c88971dd9089f906fa7ba38c5c632cc9dbff');assert.equal(messages.length,2);}finally{global.Date=RealDate;}
});
test('friends full report uses supplied verified chart and original full token budget',async()=>{
 let count=0;const result=await generateFullBaziReport(input,{chartBlock:'服务端已验证四柱',generate:async(messages,opts)=>{count++;assert.equal(opts.maxTokens,16384);assert.match(messages[1].content,/服务端已验证四柱/);assert.match(messages[0].content,/本报告由AI生成/);return '测试报告正文';}});assert.equal(count,1);assert.equal(result.tier,'full');assert.equal(result.locked,false);assert.equal(result.reading,'测试报告正文');
});
test('missing verified chart fails before model call',async()=>{let calls=0;await assert.rejects(generateFullBaziReport(input,{generate:async()=>{calls++;return 'x';}}),/需要经验证/);assert.equal(calls,0);});
test('provider errors and empty output fail, without fake delivery',async()=>{
 await assert.rejects(generateBaziText([],{generate:async()=>{throw Error('provider offline');}}),/provider offline/);
 await assert.rejects(generateBaziText([],{generate:async()=>''}),/空内容/);
});
test('legacy route retains gate, persistence and VIP path; no legacy store in shared generator',()=>{
 const route=fs.readFileSync(path.join(__dirname,'../server/routes/divination.js'),'utf8');
 assert.match(route,/gateReportAccess\(req, \['bazi', '八字'\], 'bazi'\)/);
 assert.match(route,/insertReading\.run\('bazi', JSON\.stringify\(req\.body\), result, req\.userId\)/);
 assert.match(route,/baziTier === 'full' && detectBaziVip\(req\)/);
 assert.match(route,/generateBaziText\(useMessages, \{ maxTokens: freeMaxTokens \}\)/);
 const generator=fs.readFileSync(path.join(__dirname,'../server/lib/bazi-full-report.js'),'utf8');
 assert.doesNotMatch(generator,/require\(['"]\.\/store['"]\)|gateReportAccess\(|hasFullAccess\(|ADMIN_TOKEN|insertReading\./);
});
