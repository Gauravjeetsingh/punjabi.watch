import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
await mkdir('test-results',{recursive:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let calls=0, mode='success', captured, configured=true;
 // Every Formspree request is intercepted; no test address is transmitted.
 await page.route('https://formspree.io/**',async route=>{
  calls++;captured=route.request().postData();
  if(mode==='network') return route.abort('failed');
  if(mode==='pending') await new Promise(resolve=>setTimeout(resolve,250));
  return route.fulfill({status:mode==='validation'?422:mode==='rate'?429:200,contentType:'application/json',body:JSON.stringify(mode==='validation'?{errors:[{field:'email',message:'Invalid email'}]}:{ok:true})});
 });
 await page.route('http://127.0.0.1:4173/watch/',async route=>{
  const response=await route.fetch();
  const source=await response.text();
  const html=configured?source:source.replace(/data-endpoint="[^"]*"/,'data-endpoint=""');
  await route.fulfill({response,body:html});
 });
 await page.goto('http://127.0.0.1:4173/watch/');
 assert.equal(await page.getByRole('button',{name:'Join testing',exact:true}).isEnabled(),true);
 assert.equal(await page.locator('#tester-signup-form').getAttribute('action'),'https://formspree.io/f/xyekoray');
 assert.equal(await page.locator('iframe').count(),0);
 assert.equal(calls,0);
 await page.locator('#join-testing').scrollIntoViewIfNeeded();
 await page.screenshot({path:'test-results/inline-signup-connected.png'});
 const load=async()=>{await page.goto('http://127.0.0.1:4173/watch/');await page.locator('#join-testing').scrollIntoViewIfNeeded();};
 await load();
 const input=page.getByLabel('Your Google Play email');
 const submit=page.getByRole('button',{name:'Join testing',exact:true});
 await input.fill('not-an-email');await submit.click();assert.equal(calls,0);
 await input.fill('tester@example.com');mode='pending';await submit.click();
 assert.equal(await page.getByRole('button',{name:'Sending…'}).isDisabled(),true);
 await page.locator('#tester-signup-form').evaluate(f=>f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 await page.waitForFunction(()=>document.querySelector('#signup-status').dataset.state==='success');
 assert.equal(calls,1);assert.match(captured,/tester@example.com/);assert.match(captured,/Punjabi Watch testing/);
 assert.match(page.url(),/\/watch\/$/);
 assert.equal(await page.getByRole('button',{name:'Joined',exact:true}).isDisabled(),true);
 assert.match(await page.locator('#signup-status').textContent(),/you’re on the list/);
 for (const failure of ['validation','rate','network']) {
  await load();mode=failure;
  await input.fill('tester@example.com');await submit.click();
  await page.waitForFunction(()=>document.querySelector('#signup-status').dataset.state==='error');
  assert.equal(await submit.isEnabled(),true);assert.equal(await input.inputValue(),'tester@example.com');
  if(failure==='validation') assert.equal(await input.getAttribute('aria-invalid'),'true');
 }
 await load();mode='success';
 await page.locator('[name="_gotcha"]').fill('spam',{force:true});
 await input.fill('tester@example.com');const before=calls;await submit.click();assert.equal(calls,before);
 await load();
 for(const width of [320,390,768,1440]) {
  await page.setViewportSize({width,height:900});
  await page.locator('#join-testing').scrollIntoViewIfNeeded();
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at ${width}`);
  if(width===390||width===1440) await page.screenshot({path:`test-results/inline-signup-${width}.png`});
 }
 configured=false;
 await load();
 assert.equal(await submit.isDisabled(),true);
 const requestsBefore=calls;
 await page.locator('#tester-signup-form').evaluate(f=>f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 assert.equal(calls,requestsBefore);
 assert.match(await page.locator('#signup-status').textContent(),/being set up/);
 assert.deepEqual(errors,[]);
 console.log('Inline signup checks passed: validation, loading, duplicate-submit guard, confirmed success without redirect, service/network errors, honeypot, disabled unconfigured form and responsive layout. All submissions were mocked.');
}finally{await browser.close();}
