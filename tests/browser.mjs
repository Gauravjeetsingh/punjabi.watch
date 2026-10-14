import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { formatTime, formatNanakshahi, zonedParts } from '../src/time.js';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const failures = [];
await mkdir('test-results', { recursive: true });
try {
  const context = await browser.newContext({ timezoneId:'America/Vancouver', viewport:{width:1440,height:1100} });
  const page = await context.newPage();
  page.on('pageerror', e => failures.push(e.message));
  page.on('response', r => { if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`); });
  await page.clock.install({ time: new Date('2026-10-14T20:29:59.500Z') });
  await page.goto('http://127.0.0.1:4173/');
  await page.clock.runFor(1000);
  assert.equal(await page.locator('#time-words').textContent(),'ਡੇਢ ਵੱਜੇ');
  assert.equal(await page.locator('#nanakshahi-date').textContent(),'੩੦ ਅੱਸੂ, ੫੫੮');
  await page.clock.setSystemTime(new Date('2026-10-15T06:59:59.500Z'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.clock.runFor(1000);
  assert.equal(await page.locator('#time-words').textContent(),'ਬਾਰਾਂ ਵੱਜੇ');
  assert.equal(await page.locator('#day-period').textContent(),'ਅੰਮ੍ਰਿਤ ਵੇਲਾ');
  assert.equal(await page.locator('#nanakshahi-date').textContent(),'੧ ਕੱਤਕ, ੫੫੮');
  assert.equal(await page.locator('.world-clock').count(),3);
  await page.getByRole('button',{name:'Add a city',exact:true}).click();
  await page.getByLabel('City or time zone').fill('Vancouver');
  await page.getByRole('button',{name:'Add Vancouver, Canada',exact:true}).click();
  assert.equal(await page.locator('.world-clock').count(),4);
  await page.getByRole('button',{name:'Close city search'}).click();
  await page.reload();
  assert.equal(await page.locator('.world-clock').count(),4);
  assert.equal(await page.locator('[aria-label="Vancouver clock"] .city-words').textContent(),await page.locator('#time-words').textContent());
  await page.getByRole('button',{name:'Remove Vancouver',exact:true}).click();
  assert.equal(await page.locator('.world-clock').count(),3);
  await page.getByRole('button',{name:'Add a city',exact:true}).click();
  await page.getByLabel('City or time zone').fill('zzznomatch');
  assert.match(await page.locator('#city-results').textContent(),/No matching city/);
  await page.getByLabel('City or time zone').fill('Asia/Kolkata');
  assert.ok(await page.locator('.city-result').count() >= 5);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#city-dialog').evaluate(e => e.open),false);
  assert.equal(await page.locator('#add-city').evaluate(e => e === document.activeElement),true);
  // Removing every card persists an intentional empty state.
  while (await page.locator('.remove-city').count()) await page.locator('.remove-city').first().click();
  await page.reload();
  assert.equal(await page.locator('.world-clock').count(),0);
  assert.match(await page.locator('.empty-world').textContent(),/Add a city/);
  // Corrupt storage recovers to safe defaults.
  await page.evaluate(() => localStorage.setItem('punjabi.watch.cities.v1','{broken'));
  await page.reload();
  assert.equal(await page.locator('.world-clock').count(),3);
  // Storage failures do not prevent clocks or adding a city in this session.
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('Blocked'); }; });
  await page.getByRole('button',{name:'Add a city',exact:true}).click();
  await page.getByLabel('City or time zone').fill('Lahore');
  await page.getByRole('button',{name:'Add Lahore, Pakistan',exact:true}).click();
  assert.match(await page.locator('#storage-note').textContent(),/could not save/);
  await page.keyboard.press('Escape');
  await page.goto('http://127.0.0.1:4173/watch/');
  await page.getByRole('button',{name:'Always-on',exact:true}).click();
  assert.match(await page.locator('#feature-shot').getAttribute('src'),/06-always-on/);
  assert.equal(await page.getByRole('button',{name:'Always-on',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('a[href*="play.google"]').count(),0);
  // Screenshots use the actual current clock in an unfaked fresh context.
  const liveContext = await browser.newContext({timezoneId:'America/Vancouver', viewport:{width:1440,height:1100}});
  const live = await liveContext.newPage();
  live.on('pageerror',e=>failures.push(e.message));
  await live.goto('http://127.0.0.1:4173/');
  await live.evaluate(() => document.fonts.ready);
  const now = new Date(), parts = zonedParts(now,'America/Vancouver');
  assert.equal(await live.locator('#time-words').textContent(),formatTime(parts.hour,parts.minute));
  assert.equal(await live.locator('#nanakshahi-date').textContent(),formatNanakshahi(parts));
  await live.screenshot({path:'test-results/clock-desktop.png',fullPage:true});
  for (const path of ['/', '/watch/']) {
    await live.goto(`http://127.0.0.1:4173${path}`);
    for (const width of [320,390,768,1440]) {
      await live.setViewportSize({width,height:900});
      await live.evaluate(() => document.fonts.ready);
      assert.equal(await live.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth),true,`${path} overflow at ${width}`);
      assert.ok(await live.locator('main').isVisible());
      const imageErrors = await live.locator('img').evaluateAll(imgs => imgs.filter(i => i.complete && !i.naturalWidth).map(i=>i.src));
      assert.deepEqual(imageErrors,[]);
      if (width === 390 || (width === 1440 && path === '/watch/')) await live.screenshot({path:`test-results/${path === '/' ? 'clock' : 'watch'}-${width}.png`,fullPage:true});
    }
  }
  const response = await live.goto('http://127.0.0.1:4173/privacy.html'); assert.equal(response.status(),200);
  assert.deepEqual(failures,[]);
  await writeFile('test-results/browser-results.json',JSON.stringify({passed:true, checkedAt:new Date().toISOString(),checks:['minute update without refresh','midnight and Nanakshahi rollover','city search/add/remove/persistence','empty and corrupt storage','blocked storage','keyboard dialog dismissal and focus','active/always-on screenshots','live clock/date','responsive 320/390/768/1440','privacy route','no JS errors']},null,2));
  console.log('Browser checks passed. Desktop/mobile screenshots saved to website/test-results/.');
} finally { await browser.close(); }
