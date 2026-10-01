import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'file:///C:/Users/bruma/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const out='artifacts/issue198-rendered';
const browser=await chromium.launch({headless:true,executablePath:process.env.LOCALAPPDATA+'/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe'});
const context=await browser.newContext({serviceWorkers:'block'});
let requests=0;await context.route('**/*',route=>{requests++;return route.abort();});
const results=[];
try {
 for(const name of ['ready','partial','mixed','matched','deed-only','legacy','empty','mismatch','excluded']) {
  const texts=[];
  for(const mode of ['normal','print']) {
   const page=await context.newPage();
   await page.setContent(fs.readFileSync(`${out}/html/${name}-${mode}.html`,'utf8'));
   const ownership=page.locator('#report-ownership');
   const details=ownership.locator('xpath=ancestor::details');
   if(mode==='normal') {assert.equal(await details.evaluate(e=>e.open),false);await details.locator('summary').first().click();}
   assert.equal(await details.evaluate(e=>e.open),true);
   await ownership.waitFor({state:'visible'});
   const municipal=page.locator('#investigation-services');
   if(mode==='normal') await municipal.locator('xpath=ancestor::details').locator('summary').first().click();
   await municipal.waitFor({state:'visible'});
   if(mode==='print') await page.emulateMedia({media:'print'});
   const ownershipText=await ownership.innerText();
   const contextText=await municipal.innerText();
   assert(!ownershipText.includes('Read from a matched document'));
   assert(!contextText.includes('identity-matched document'));
   assert(ownershipText.includes(['empty','mismatch','excluded'].includes(name)?'Not verified by Easy Erf':'Ownership and deeds evidence; not certified by Easy Erf'));
   assert(!ownershipText.includes('8001015009087'));
   texts.push({ownershipText,contextText});
   if(name==='mixed' && mode==='print') await page.pdf({path:`${out}/mixed-print.pdf`,format:'A4'});
   await page.close();
  }
  assert.deepEqual(texts[0],texts[1]);
  results.push({name,expandedAndPrintTextEqual:true,...texts[0]});
 }
 assert.equal(requests,0);
 fs.writeFileSync(`${out}/browser.json`,JSON.stringify({source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),runtime:'bundled Playwright, installed local Chromium; static actual-renderer HTML only',scope:'Native details expansion and print-media text parity. No hydration, application navigation, production session or full layout acceptance.',requests,results},null,2));
 console.log('9 expanded/print pairs passed; 0 requests');
} finally {await browser.close();}
