import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/bruma/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const out='artifacts/issue201';
const browser=await chromium.launch({headless:true,executablePath:process.env.LOCALAPPDATA+'/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe'});
const context=await browser.newContext({serviceWorkers:'block'});
let requests=0; await context.route('**/*',r=>{requests++;return r.abort();});
const texts=[];
try {
 for(const mode of ['normal','print']) {
  const page=await context.newPage();
  await page.setContent(fs.readFileSync(`${out}/html/${mode}.html`,'utf8'));
  const location=page.locator('#investigation-location');
  const details=location.locator('xpath=ancestor::details');
  if(mode==='normal') await details.locator('summary').first().click();
  if(mode==='print') await page.emulateMedia({media:'print'});
  await location.waitFor({state:'visible'});
  const text=await location.innerText();
  assert(text.includes('A saved parcel boundary is available.'));
  assert(text.includes('Representative point metadata is unavailable'));
  texts.push(text);
  await location.screenshot({path:`${out}/location-${mode}.png`});
  await page.close();
 }
 assert.equal(texts[0],texts[1]); assert.equal(requests,0);
 fs.writeFileSync(`${out}/render-check.json`,JSON.stringify({requests,expandedAndPrintTextEqual:true,locationText:texts[0]},null,2));
 console.log('Expanded and print Location match; zero requests');
} finally {await browser.close();}
