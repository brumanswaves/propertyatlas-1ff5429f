import fs from 'node:fs';
import {execFileSync, spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import ts from 'typescript';
import {transformSync} from 'esbuild';
const dir='artifacts/pr194-final';
const base='c4e20d3e55b8ac81c48dc798c155219f8c42ae6d';
const reviewed='8a3a1ea0983b3d568a0cd23adfe3e779ce5c9d79';
const files=execFileSync('git',['diff',base,reviewed,'--name-only','--','*.ts','*.tsx'],{encoding:'utf8'}).trim().split(/\r?\n/);
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const receipts=[];
function run(name, bin, args) {
 const start=new Date().toISOString();const r=spawnSync(process.execPath,[bin,...args],{encoding:'utf8',maxBuffer:16e6});
 fs.writeFileSync(`${dir}/${name}.log`,r.stdout+r.stderr);
 receipts.push({name,command:['node',bin,...args],started:start,finished:new Date().toISOString(),exitCode:r.status});
 fs.writeFileSync(`${dir}/commands.json`,JSON.stringify(receipts,null,2));
 if(r.status!==0)throw new Error(`${name} failed: see log`);
}
run('format','node_modules/prettier/bin/prettier.cjs',['--write',...files]);
const equivalent=files.map(file=>{
 const old=execFileSync('git',['show',`${reviewed}:${file}`],{encoding:'utf8'});const current=fs.readFileSync(file,'utf8');
 const emit=s=>ts.transpileModule(s,{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,removeComments:true,sourceMap:false}}).outputText;
 const before=emit(old),after=emit(current);
 const normalize=s=>transformSync(s,{loader:'js',minifyWhitespace:true,minifyIdentifiers:false,minifySyntax:false,legalComments:'none',target:'es2022'}).code;
 const a=normalize(before),b=normalize(after);
 return {file,beforeSource:hash(old),afterSource:hash(current),tsEmitBefore:hash(before),tsEmitAfter:hash(after),normalizedEmitBefore:hash(a),normalizedEmitAfter:hash(b),equivalent:a===b};
});
fs.writeFileSync(`${dir}/runtime-equivalence.json`,JSON.stringify({reviewed,base,node:process.version,typescript:ts.version,method:'TypeScript ES2022/react-jsx emit without comments/maps; esbuild whitespace-only normalization, identifiers and syntax minification disabled',files:equivalent},null,2));
if(equivalent.some(x=>!x.equivalent))throw new Error('Runtime output differs; investigate');
run('lint','node_modules/eslint/bin/eslint.js',files);
run('typecheck','node_modules/typescript/bin/tsc',['--noEmit']);
const whitespace=spawnSync('git',['diff','--check'],{encoding:'utf8'});
fs.writeFileSync(`${dir}/whitespace.log`,whitespace.stdout+whitespace.stderr);
receipts.push({name:'whitespace',command:['git','diff','--check'],exitCode:whitespace.status});
fs.writeFileSync(`${dir}/commands.json`,JSON.stringify(receipts,null,2));
console.log(JSON.stringify({files:files.length,equivalent:equivalent.every(x=>x.equivalent),checks:receipts.map(x=>({name:x.name,exitCode:x.exitCode}))}));
