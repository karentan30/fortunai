'use strict';
const fs=require('node:fs');
const path=require('node:path');
// Single-process pilot store, separate from payments/auth. Never expose this directory via static.
function createFriendsStore(file) {
  let state={version:1,profiles:[],requests:[],blocks:[],reports:[]};
  if(file && fs.existsSync(file)) {
    state=JSON.parse(fs.readFileSync(file,'utf8')); // Fail closed on corrupt files: never overwrite with an empty pool.
    for(const k of ['profiles','requests','blocks','reports']) if(!Array.isArray(state[k])) throw Error('交友资料快照损坏');
  }
  return {
    read:()=>state,
    transaction(fn){
      const next=structuredClone(state),result=fn(next);
      if(file){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(next),{mode:0o600});fs.renameSync(tmp,file);}
      state=next;return result;
    }
  };
}
module.exports={createFriendsStore};
