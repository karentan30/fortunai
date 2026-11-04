'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const files=['server/lib','server/routes'].flatMap(dir=>fs.readdirSync(path.join(root,dir)).filter(n=>/^friends.*\.test\.cjs$/.test(n)).sort().map(n=>path.join(root,dir,n)));
for(const name of ['bazi-full-report.test.js','friends-reports.test.js','friends-report-adapter.test.js']){const file=path.join(root,'tests',name);if(fs.existsSync(file))files.push(file);}
if(!files.length)throw Error('没有找到交友功能测试');
const result=spawnSync(process.execPath,['--test',...files],{cwd:root,stdio:'inherit',windowsHide:true});
if(result.error)throw result.error;process.exitCode=result.status??1;
