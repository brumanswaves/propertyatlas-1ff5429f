import assert from'node:assert/strict';import{mkdir,writeFile}from'node:fs/promises';import{resolve}from'node:path';import{execFileSync}from'node:child_process';
const {chromium}=await import(process.env.EASY_ERF_PLAYWRIGHT_MODULE||'../artifacts/rehearsal/browser-tools/node_modules/playwright/index.mjs');
const out=process.env.PRINT_EVIDENCE_DIR||'artifacts/print-readiness';await mkdir(out,{recursive:true});
const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const browser=await chromium.launch({headless:true,...(process.env.EASY_ERF_CHROMIUM?{executablePath:process.env.EASY_ERF_CHROMIUM}:(process.platform==='win32'?{executablePath:resolve('artifacts/rehearsal/browser/chrome-win/headless_shell.exe')}:{}))});const results=[];let external=0;
try{for(const name of ['delayed','ready','image-failure','preview-failure','map-failure','map-timeout','timeout','signout','account','order','version']){
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
 await context.route('**/*',r=>{if(new URL(r.request().url()).hostname!=='127.0.0.1'){external++;return r.abort();}return r.continue();});
 await context.addInitScript(()=>{window.print=()=>{parent.printCount=(parent.printCount||0)+1;document.documentElement.dataset.printRequested='true';};});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4189/scripts/fixtures/print-readiness/index.html?case='+name);
 const button=page.getByRole('button',{name:'Print / Save PDF',exact:true});await button.waitFor();
 if(name==='ready')await page.locator('img[alt="SYNTHETIC-SG.png visual preview"]').waitFor({state:'attached'});
 await button.evaluate(b=>{b.click();b.click();});
 if(['signout','account','order','version'].includes(name)){
  await page.evaluate(n=>window.change(n),name);await page.waitForTimeout(1100);assert.equal(await page.locator('iframe[title="Printable delivered Easy Erf Report"]').count(),0);assert.equal(await page.evaluate(()=>window.printCount||0),0);results.push({case:name,result:'passed',assertion:'Selection change cancels pending print; no stale frame or print.'});
 }else if(name==='timeout'){
  await page.getByRole('alert').filter({hasText:'Nothing was printed'}).waitFor({timeout:16000});assert.equal(await page.evaluate(()=>window.printCount||0),0);assert.equal(await page.locator('iframe').count(),0);results.push({case:name,result:'passed',assertion:'Bounded timeout exposes explicit failure and does not print.'});
 }else{
  const frame=page.frameLocator('iframe[title="Printable delivered Easy Erf Report"]');await frame.locator('html[data-print-requested="true"]').waitFor({timeout:15000});
  assert.equal(await page.evaluate(()=>window.printCount),1,'Concurrent clicks must coalesce');
  const body=await frame.locator('body').innerText();assert(!body.includes('No visual preview was generated'));assert(!body.includes('Loading authorized diagram'));
  if(['image-failure','preview-failure'].includes(name))assert(body.includes('Diagram preview unavailable'));
  else assert.equal(await frame.locator('img[alt="SYNTHETIC-SG.png visual preview"]').count(),1);
  if(['map-failure','map-timeout'].includes(name))assert(body.includes('Satellite context is unavailable'));
  else {const pixel=await frame.locator('img[alt="Recorded report map"]').evaluate(async img=>{await img.decode();const c=document.createElement('canvas');c.width=c.height=1;c.getContext('2d').drawImage(img,0,0,1,1);return [...c.getContext('2d').getImageData(0,0,1,1).data];});assert.deepEqual(pixel,[0,128,0,255]);}
  if(name==='delayed'){
   const ask=await page.locator('#report-ask').boundingBox(),assessment=await page.locator('#report-decision').boundingBox();assert(ask.y<assessment.y);
   await page.screenshot({path:out+'/settled-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/settled-mobile.png',fullPage:true});
   const html=await frame.locator('html').evaluate(e=>e.outerHTML);const exportPage=await context.newPage();await exportPage.setContent(html,{waitUntil:'networkidle'});await exportPage.pdf({path:out+'/delayed-ready-export.pdf',format:'A4',printBackground:true});await exportPage.close();
   await page.evaluate(()=>window.change('signout'));
   await page.locator('iframe[title="Printable delivered Easy Erf Report"]').waitFor({state:'detached'});
  }
  results.push({case:name,result:'passed',assertion:'Settled SG/map or labelled terminal fallback captured once.'});
 }
 assert.deepEqual(errors,[]);await context.close();console.log(name+' passed');
}assert.equal(external,0);}finally{await browser.close();await writeFile(out+'/results.json',JSON.stringify({source,synthetic:true,scope:'Actual DeliveredInvestigationReport, SharedInvestigationReport, SG preview and map component. Auth/read transport and Mapbox renderer are controlled local fixtures. Browser print intercepted; not live services or OS print acceptance.',externalRequests:external,results},null,2));}
