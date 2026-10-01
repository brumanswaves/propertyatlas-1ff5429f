import fs from 'node:fs';
import {spawnSync,execFileSync} from 'node:child_process';
const out='artifacts/issue198-rendered';
const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const checks=[['suite',['node_modules/vitest/vitest.mjs','run']],['typescript',['node_modules/typescript/bin/tsc','--noEmit']],['whitespace',['diff','--check']]];
const receipts=[];
for(const [name,args] of checks){
 const started=new Date().toISOString();
 const command=name==='whitespace'?'git':'node';
 const r=spawnSync(command,args,{encoding:'utf8',maxBuffer:32e6,windowsHide:true,env:{...process.env,EE_RENDER_EVIDENCE_DIR:out+'/html'}});
 fs.writeFileSync(`${out}/${name}.log`,(r.stdout||'')+(r.stderr||''));
 receipts.push({source,name,command:[command,...args],started,finished:new Date().toISOString(),exitCode:r.status});
 fs.writeFileSync(`${out}/checks.json`,JSON.stringify(receipts,null,2));
 console.log(name+': '+r.status);
 if(r.status!==0){process.exitCode=1;break;}
}
