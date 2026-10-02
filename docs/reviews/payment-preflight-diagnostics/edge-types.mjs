import ts from 'typescript';
import fs from 'node:fs';
const out='artifacts/payment-preflight-diagnostics';
const entry='supabase/functions/easy-erf-founder-launch-readiness/index.ts';
const opts={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,allowImportingTsExtensions:true,noEmit:true,strict:true,skipLibCheck:true,baseUrl:process.cwd(),paths:{'npm:stripe@22.6.0':['C:/Users/bruma/AppData/Local/deno/npm/registry.npmjs.org/stripe/22.6.0/esm/stripe.esm.worker.d.ts'],'npm:@supabase/supabase-js@2.108.0':['node_modules/@supabase/supabase-js/dist/module/index.d.ts']}};
// Use the exact pinned cached Stripe package and existing Supabase package. No imports execute.
const sup=JSON.parse(fs.readFileSync('C:/Users/bruma/AppData/Local/deno/npm/registry.npmjs.org/@supabase/supabase-js/2.108.0/package.json','utf8'));
opts.paths['npm:@supabase/supabase-js@2.108.0']=['C:/Users/bruma/AppData/Local/deno/npm/registry.npmjs.org/@supabase/supabase-js/2.108.0/'+sup.types];
for (const [name, version] of Object.entries(sup.dependencies)) {
 const dir='C:/Users/bruma/AppData/Local/deno/npm/registry.npmjs.org/'+name+'/'+version;
 if(fs.existsSync(dir+'/package.json')) { const pkg=JSON.parse(fs.readFileSync(dir+'/package.json','utf8')); if(pkg.types) opts.paths[name]=[dir+'/'+pkg.types]; }
}
const program=ts.createProgram([entry],opts);
const diagnostics=ts.getPreEmitDiagnostics(program);
fs.writeFileSync(out+'/edge-types.log',ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:x=>x,getCurrentDirectory:()=>process.cwd(),getNewLine:()=> '\n'}));
fs.writeFileSync(out+'/edge-types-receipt.json',JSON.stringify({command:'node artifacts/payment-preflight-diagnostics/edge-types.mjs',entry,typescript:ts.version,stripe:'22.6.0 cached types',supabase:sup.version,diagnostics:diagnostics.length,exitCode:diagnostics.length?1:0,limitation:'TypeScript source type check using locally cached SDK types, not Deno dependency resolution or deployed runtime execution.'},null,2));
console.log('edge type diagnostics: '+diagnostics.length); process.exitCode=diagnostics.length?1:0;

