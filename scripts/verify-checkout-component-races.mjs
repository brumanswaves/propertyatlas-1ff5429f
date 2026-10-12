import './verify-mobile-network.mjs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdirSync, createWriteStream, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
const base='http://127.0.0.1:4191';
const out=resolve('artifacts/component-races');mkdirSync(out,{recursive:true});
const log=createWriteStream(resolve(out,'server.log'));
const server=spawn(process.execPath,['scripts/checkout-race-preview.mjs'],{env:{PATH:process.env.PATH,EASY_ERF_EGRESS_LOG:resolve(out,'egress.jsonl')},stdio:['ignore','pipe','pipe']});
server.stdout.pipe(log);server.stderr.pipe(log);
let browser;const checks=[],failures=[],egress=[],pageErrors=[];
const user=id=>({data:{user:id?{id,email:`${id}@example.invalid`}:null},error:null});
const valid={data:{ok:true,mode:'test',url:'https://buy.stripe.com/synthetic-local-only'},error:null};
async function check(name,action){await action();checks.push(name);console.log(`PASS ${name}`)}
try {
 for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{} if(i===99)throw Error('Fixture server unavailable');await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium'});
 const ctx=await browser.newContext({serviceWorkers:'block'});
 let redirects=0;
 await ctx.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='buy.stripe.com'&&url.pathname==='/synthetic-local-only'){redirects++;return route.fulfill({body:'<h1>Synthetic checkout destination</h1>',contentType:'text/html'})}
  if(url.origin===base)return route.continue();
  egress.push(url.origin+url.pathname);return route.abort();
 });
 const page=await ctx.newPage();page.on('pageerror',e=>pageErrors.push(e.message));page.setDefaultTimeout(10000);
 const button=()=>page.getByRole('button',{name:/Investigate this property for me/});
 const fixture=(action,arg)=>page.evaluate(({action,arg})=>window.checkoutFixture[action](arg),{action,arg});
 const flush=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,0)))));
 const hold=kind=>fixture('hold',kind);
 async function release(kind,index,value){await page.evaluate(({kind,index,value})=>window.checkoutFixture.release(kind,index,value),{kind,index,value});await flush()}
 async function prepare(){await page.goto(base+'/pricing?parcelId=csg:lpi:synthetic-race');await page.getByText('Signed in as owner-a@example.invalid.',{exact:false}).waitFor();await page.getByRole('button',{name:/Overall Property Check/}).click();await page.locator('textarea').fill('Private synthetic A brief');await page.getByRole('checkbox').check();assert.equal(await button().isEnabled(),true)}
 async function gate(kind,index=0){await page.waitForFunction(({kind,index})=>window.checkoutFixture.gates[kind].length>index,{kind,index})}
 async function transition(value){
  if(value==='switch'||value==='ABA'){await fixture('emit','owner-b');if(value==='ABA')await fixture('emit','owner-a')}
  if(value==='logout')await fixture('emit',null);
  if(value==='departure')await fixture('navigate','/');
  if(value==='search-navigation')await fixture('navigate','/pricing?parcelId=csg:lpi:synthetic-race&source=changed');
  await flush();
 }
 for(const phase of ['auth','checkout'])for(const change of ['switch','logout','ABA','departure','search-navigation']){
  await check(`${phase} pending: ${change} cancels stale continuation`,async()=>{
   await prepare();await hold(phase);await hold('checkout');const before=redirects;
   await button().click();await gate(phase);await transition(change);
   await release(phase,0,phase==='auth'?user('owner-a'):valid);
   assert.equal(redirects,before);
   const calls=await page.evaluate(()=>window.checkoutFixture.calls);
   assert.equal(calls.length,phase==='auth'?0:1);
   if(change==='switch'||change==='logout'||change==='ABA'){assert.equal(await page.locator('textarea').inputValue(),'');assert.equal(await page.getByRole('checkbox').isChecked(),false)}
   if(change==='departure')await page.getByRole('heading',{name:'Synthetic destination'}).waitFor();
  });
 }
 await check('pending destination loader blocks new checkout before pricing unmount',async()=>{
  await prepare();await hold('navigation');await page.evaluate(()=>{void window.checkoutFixture.navigate('/')});await gate('navigation');
  // Existing pricing remains visible while TanStack awaits the destination loader.
  await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Investigate this property'));b?.click()});await flush();
  assert.equal(await page.evaluate(()=>window.checkoutFixture.calls.length),0);
  await release('navigation',0,null);await page.getByRole('heading',{name:'Synthetic destination'}).waitFor();
 });
 await check('resolved pricing navigation permits a fresh deliberate attempt',async()=>{
  await prepare();await fixture('navigate','/pricing?parcelId=csg:lpi:synthetic-race&source=changed');await flush();await button().click();await page.getByText('Synthetic unavailable',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.checkoutFixture.calls.length),1);assert.equal(await button().isEnabled(),true);
 });
 await check('getUser B without auth event cannot submit A answers',async()=>{
  await prepare();await hold('auth');await button().click();await gate('auth');await release('auth',0,user('owner-b'));
  await page.getByText('Your account changed. Check your investigation answers before trying again.').waitFor();assert.equal(await page.evaluate(()=>window.checkoutFixture.calls.length),0);assert.equal(await button().isEnabled(),true);
 });
 await check('null verified user does not invoke checkout and permits retry',async()=>{
  await prepare();await hold('auth');await button().click();await gate('auth');await release('auth',0,user(null));assert.equal(await page.evaluate(()=>window.checkoutFixture.calls.length),0);assert.equal(await button().isEnabled(),true);
 });
 await check('same-account auth refresh preserves pending success and duplicate-click lock',async()=>{
  await prepare();await hold('auth');await hold('checkout');await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Investigate this property'));b.click();b.click()});await gate('auth');assert.equal(await page.evaluate(()=>window.checkoutFixture.gates.auth.length),1);
  await fixture('emit','owner-a');await release('auth',0,user('owner-a'));await gate('checkout');assert.equal(await page.evaluate(()=>window.checkoutFixture.calls.length),1);
  await page.evaluate(v=>window.checkoutFixture.release('checkout',0,v),valid);await page.getByRole('heading',{name:'Synthetic checkout destination'}).waitFor();
 });
 await check('same-account failure permits deliberate valid retry',async()=>{
  await prepare();await hold('checkout');await button().click();await gate('checkout');await release('checkout',0,{data:{ok:false,error:'Synthetic unavailable'},error:null});await page.getByText('Synthetic unavailable',{exact:true}).waitFor();assert.equal(await button().isEnabled(),true);
  await button().click();await gate('checkout',1);await page.evaluate(v=>window.checkoutFixture.release('checkout',1,v),valid);await page.getByRole('heading',{name:'Synthetic checkout destination'}).waitFor();
 });
 await check('old attempt finally cannot unlock a new owner attempt',async()=>{
  await prepare();await hold('checkout');await button().click();await gate('checkout');await fixture('emit','owner-b');await flush();await page.getByRole('button',{name:/Overall Property Check/}).click();await page.locator('textarea').fill('Synthetic B brief');await page.getByRole('checkbox').check();await button().click();await gate('checkout',1);
  const before=redirects;await release('checkout',0,valid);assert.equal(redirects,before);await page.getByRole('button',{name:/Opening secure checkout/}).waitFor();assert.equal(await page.getByRole('button',{name:/Opening secure checkout/}).isDisabled(),true);
  await release('checkout',1,{data:{ok:false,error:'B retry available'},error:null});await page.getByText('B retry available').waitFor();assert.equal(await button().isEnabled(),true);
 });
 await check('late error-body response cannot display stale error after owner switch',async()=>{
  await prepare();await hold('checkout');await hold('errorBody');await button().click();await gate('checkout');await page.evaluate(()=>window.checkoutFixture.release('checkout',0,window.checkoutFixture.errorResponse()));await gate('errorBody');await fixture('emit','owner-b');await release('errorBody',0,{error:'Synthetic late error'});assert.equal(await page.getByText('Synthetic late error',{exact:true}).count(),0);
 });
 assert.deepEqual(egress,[]);assert.deepEqual(pageErrors,[]);
} catch(e){failures.push(e.stack);process.exitCode=1;console.error(e)}
finally {
 if(browser)await browser.close();server.kill('SIGTERM');await new Promise(r=>server.once('exit',r));log.end();
 writeFileSync(resolve(out,'receipt.json'),JSON.stringify({checks,failures,egress,pageErrors,serverStopped:true,limits:'Actual pricing component and TanStack Router; synthetic SDK and intercepted destination. No remote effects or live acceptance.'},null,2));
}
