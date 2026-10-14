import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatTime, dayPeriod, zonedParts, formatNanakshahi, nanakshahiDate, dayDifference, minuteDelay } from '../src/time.js';
import { loadCities, defaults, storageKey } from '../src/cities.js';
const data = JSON.parse(readFileSync(new URL('../shared/punjabi-time.json', import.meta.url)));

test('all 1440 minutes match the Kotlin formatter’s canonical rules, in both scripts', () => {
  for (const [script, words] of Object.entries(data.scripts)) {
    const prefix = script === 'gurmukhi' ? ['ਸਵਾ', 'ਸਾਢੇ', 'ਪੌਣੇ'] : ['sva', 'sade', 'pone'];
    const exact = script === 'gurmukhi' ? 'ਵੱਜੇ' : 'vjje';
    for (let h = 0; h < 24; h++) for (let m = 0; m < 60; m++) {
      const n = h % 12 || 12;
      let expected = `${words.numbers[n]} ${words.numbers[m]}`;
      if (m === 0) expected = `${words.numbers[n]} ${exact}`;
      if (m === 15) expected = `${prefix[0]} ${words.numbers[n]}`;
      if (m === 30) expected = n === 1 ? (script === 'gurmukhi' ? 'ਡੇਢ ਵੱਜੇ' : 'dedh vjje') : n === 2 ? (script === 'gurmukhi' ? 'ਢਾਈ ਵੱਜੇ' : 'dhai vjje') : `${prefix[1]} ${words.numbers[n]}`;
      if (m === 45) expected = `${prefix[2]} ${words.numbers[n % 12 + 1]}`;
      assert.equal(formatTime(h, m, script), expected, `${h}:${m} ${script}`);
    }
  }
});
test('exact day-period boundaries and invalid time values', () => {
  for (const [h, m, expected] of [[0,0,'ਅੰਮ੍ਰਿਤ ਵੇਲਾ'],[4,59,'ਅੰਮ੍ਰਿਤ ਵੇਲਾ'],[5,0,'ਸਵੇਰ ਦੇ'],[11,59,'ਸਵੇਰ ਦੇ'],[12,0,'ਦੁਪਹਿਰ ਦੇ'],[15,29,'ਦੁਪਹਿਰ ਦੇ'],[15,30,'ਸ਼ਾਮ ਦੇ'],[18,59,'ਸ਼ਾਮ ਦੇ'],[19,0,'ਰਾਤ ਦੇ'],[23,59,'ਰਾਤ ਦੇ']]) assert.equal(dayPeriod(h,m),expected);
  for (const [h,m] of [[-1,0],[24,0],[1,-1],[1,60],[1.5,0]]) assert.throws(() => formatTime(h,m), RangeError);
});
test('Nanakshahi matches existing app solar month starts across every day 2003–2100', () => {
  const starts = [[3,14],[4,14],[5,15],[6,15],[7,16],[8,16],[9,15],[10,15],[11,14],[12,14],[1,13],[2,12]];
  for (let epoch = Date.UTC(2003,2,14); epoch < Date.UTC(2101,0,1); epoch += 86400000) {
    const date = new Date(epoch), y = date.getUTCFullYear(), m = date.getUTCMonth()+1, d = date.getUTCDate();
    const startYear = m < 3 || m === 3 && d < 14 ? y - 1 : y;
    let index = 11;
    while (Date.UTC(startYear + (index >= 10 ? 1 : 0), starts[index][0]-1, starts[index][1]) > epoch) index--;
    const day = Math.round((epoch-Date.UTC(startYear+(index>=10?1:0),starts[index][0]-1,starts[index][1]))/86400000)+1;
    const result = nanakshahiDate({ year:y, month:m, day:d }).englishDate;
    assert.deepEqual([result.year,result.month,result.date],[startYear-1468,index+1,day], `${y}-${m}-${d}`);
  }
  assert.equal(formatNanakshahi({year:2026,month:10,day:14}), '੩੦ ਅੱਸੂ, ੫੫੮');
  assert.equal(formatNanakshahi({year:2026,month:10,day:15}), '੧ ਕੱਤਕ, ੫੫੮');
});
test('city civil time handles DST skips, repeats, half-hour offsets and midnight', () => {
  const p = (s,z) => zonedParts(new Date(s),z);
  // Historical transitions stay stable across time-zone database updates.
  // Vancouver no longer falls back from November 2026 (B.C. permanent UTC-7).
  assert.equal(p('2025-03-09T09:59:00Z','America/Vancouver').hour,1);
  assert.equal(p('2025-03-09T10:00:00Z','America/Vancouver').hour,3);
  assert.equal(p('2025-11-02T08:30:00Z','America/Vancouver').hour,1);
  assert.equal(p('2025-11-02T09:30:00Z','America/Vancouver').hour,1);
  assert.equal(p('2026-10-14T19:00:00Z','Asia/Kolkata').minute,30);
  const a = p('2026-10-14T19:00:00Z','Asia/Kolkata'), b = p('2026-10-14T19:00:00Z','America/Vancouver');
  assert.equal(a.hour,0); assert.equal(dayDifference(a,b),1);
  assert.equal(formatNanakshahi(a),'੧ ਕੱਤਕ, ੫੫੮');
});
test('minute scheduler aligns to the next boundary', () => {
  assert.equal(minuteDelay(Date.parse('2026-10-14T19:00:59.900Z')),130);
  assert.equal(minuteDelay(Date.parse('2026-10-14T19:01:00.000Z')),60030);
});
test('persisted selections tolerate missing, corrupt or invalid storage and retain an empty list', () => {
  const storage = value => ({ getItem: key => { assert.equal(key,storageKey); return value; } });
  assert.deepEqual(loadCities(storage(null)), defaults);
  assert.deepEqual(loadCities(storage('oops')), defaults);
  assert.deepEqual(loadCities(storage('[]')), []);
  assert.deepEqual(loadCities(storage(JSON.stringify([{name:'Bad',zone:'No/Zone'},{name:'London',zone:'Europe/London'},{name:'London',zone:'Europe/London'}]))),[{name:'London',zone:'Europe/London',region:''}]);
});
