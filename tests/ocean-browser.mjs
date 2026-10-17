import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
await mkdir('test-results',{recursive:true});
try {
 const errors=[];
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/');
 await page.evaluate(()=>document.fonts.ready);
 await page.waitForFunction(()=>document.querySelector('#sea-video').readyState>=3);
 assert.equal(await page.locator('header,nav,.wordmark').count(),0);
 const corner=page.locator('#watch-corner');
 const cornerToggle=page.locator('#watch-corner > summary');
 assert.equal(await corner.evaluate(e=>e.open),false);
 await cornerToggle.click();
 assert.equal(await corner.evaluate(e=>e.open),true);
 assert.equal(await page.getByRole('link',{name:'Explore the watch face'}).getAttribute('href'),'/watch/');
 await page.screenshot({path:'test-results/watch-corner-desktop.png'});
 await page.getByRole('button',{name:'Collapse watch-face preview'}).click();
 assert.equal(await corner.evaluate(e=>e.open),false);
 assert.equal(await cornerToggle.evaluate(e=>e===document.activeElement),true);
 await page.keyboard.press('Enter');
 assert.equal(await corner.evaluate(e=>e.open),true);
 await page.keyboard.press('Escape');
 assert.equal(await corner.evaluate(e=>e.open),false);
 await cornerToggle.click();
 await page.locator('#time-words').click();
 assert.equal(await corner.evaluate(e=>e.open),false);

 assert.ok(await page.locator('#time-words').textContent());
 assert.equal(await page.locator('#sea-video').evaluate(v=>v.muted && v.loop && v.playsInline && !v.paused),true);
 assert.ok((await page.locator('.world-section').boundingBox()).y>=900);
 await page.getByRole('button',{name:'Pause background video',exact:true}).click();
 assert.equal(await page.locator('#sea-video').evaluate(v=>v.paused),true);
 await page.screenshot({path:'test-results/ocean-desktop.png'});
 await page.getByRole('button',{name:'Play background video',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('#sea-video').paused);
 await page.locator('#world-title').scrollIntoViewIfNeeded();
 await page.screenshot({path:'test-results/ocean-world-desktop.png'});
 await page.getByRole('button',{name:'Add a city',exact:true}).click();
 assert.equal(await page.getByRole('dialog').isVisible(),true);
 await page.getByLabel('City or time zone').fill('Vancouver');
 assert.ok(await page.getByRole('button',{name:'Add Vancouver, Canada',exact:true}).isVisible());
 await page.keyboard.press('Escape');
 for (const width of [320,390,768]) {
  await page.setViewportSize({width,height:844});
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at ${width}`);
  assert.ok((await page.locator('.world-section').boundingBox()).y>=844);

  await cornerToggle.click();
  const panelBounds=await page.locator('.watch-corner-panel').boundingBox();
  assert.ok(panelBounds.x>=0 && panelBounds.x+panelBounds.width<=width,`popover overflow at ${width}`);
  if(width===390) await page.screenshot({path:'test-results/watch-corner-mobile.png'});
  await page.keyboard.press('Escape');
  if(width===390) {
   await page.getByRole('button',{name:'Pause background video',exact:true}).click();
   await page.screenshot({path:'test-results/ocean-mobile.png'});
   await page.locator('#world-title').scrollIntoViewIfNeeded();
   await page.screenshot({path:'test-results/ocean-world-mobile.png'});
  }
 }
 const reduced=await browser.newContext({reducedMotion:'reduce'});
 const still=await reduced.newPage();
 await still.goto('http://127.0.0.1:4173/');
 assert.equal(await still.locator('#sea-video source').getAttribute('src'),null);
 assert.equal(await still.locator('#sea-video').evaluate(v=>v.paused),true);
 assert.equal(await still.getByRole('button',{name:'Play background video',exact:true}).isVisible(),true);
 const mobileContext=await browser.newContext({viewport:{width:390,height:844}});
 const mobile=await mobileContext.newPage();
 await mobile.goto('http://127.0.0.1:4173/');
 await mobile.waitForFunction(()=>document.querySelector('#sea-video').readyState>=3);
 assert.match(await mobile.locator('#sea-video source').getAttribute('src'),/sea-water-mobile/);
 await page.goto('http://127.0.0.1:4173/watch/');
 assert.equal(await page.locator('.site-header').isVisible(),true);
 assert.equal(await page.locator('#join-testing').count(),1);
 assert.equal(await page.locator('video').count(),0);
 assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('water-theme')),true);
 await page.getByRole('button',{name:'Always-on',exact:true}).click();
 assert.match(await page.locator('#feature-shot').getAttribute('src'),/06-always-on/);
 await page.getByRole('button',{name:'Active',exact:true}).click();
 for (const width of [320,390,768,1440]) {
  await page.setViewportSize({width,height:900});
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`watch overflow at ${width}`);
  if(width===390||width===1440) await page.screenshot({path:`test-results/water-watch-${width}.png`,fullPage:true});
 }
 const response=await page.request.get('http://127.0.0.1:4173/assets/sea-water.mp4',{headers:{Range:'bytes=0-1023'}});
 assert.equal(response.status(),206);
 assert.match(response.headers()['content-type'],/video\/mp4/);
 assert.equal((await response.body()).length,1024);
 assert.deepEqual(errors,[]);
 console.log('Ocean home checks passed: autoplay, pause/play, reduced motion, no header, scroll placement, responsive layout, city dialog, video streaming and watch-page isolation.');
}finally{await browser.close();}
