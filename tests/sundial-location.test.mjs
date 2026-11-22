import test from 'node:test';
import assert from 'node:assert/strict';
import { sundialLocation, utcOffset } from '../src/sundial-location.js';
import zoneCoordinates from '../src/zone-coordinates.js';
import SundialEngine from '../src/sundial/sundial-engine.cjs';

const noonUtc = Date.UTC(2026, 10, 22, 12);

// Local clock noon in `zone` on 22 Nov 2026, as an instant.
const localNoon = zone => new Date(noonUtc - utcOffset(zone, new Date(noonUtc)) * 60000);

test('curated cities are kept', () => {
  assert.equal(sundialLocation('America/Vancouver').name, 'Surrey');
  assert.equal(sundialLocation('Asia/Kolkata').name, 'Amritsar');
});

test('zones not in the curated list use their own place, not Amritsar', () => {
  const place = sundialLocation('America/Regina');
  assert.equal(place.name, 'Regina');
  assert.ok(place.longitude < -100);
});

test('aliases and offset-only zones follow the clock offset', () => {
  assert.equal(sundialLocation('US/Pacific').longitude, -120); // −8 h in November
  assert.equal(sundialLocation('Etc/GMT-5').longitude, 75);
  assert.equal(sundialLocation('UTC').longitude, 0);
  assert.ok(sundialLocation('not/a-zone').latitude);
});

test('the sun is up at local clock noon in every zone with people', () => {
  // Polar zones can be dark at noon in November; everywhere else the sun must be up.
  for (const zone of [...Object.keys(zoneCoordinates), 'US/Pacific', 'Asia/Calcutta', 'UTC', 'Etc/GMT+5']) {
    const date = localNoon(zone);
    const place = sundialLocation(zone, date);
    if (Math.abs(place.latitude) > 60) continue;
    const altitude = SundialEngine.solarPosition(date, place.latitude, place.longitude).altitude;
    assert.ok(altitude > 0, `${zone}: sun ${altitude.toFixed(1)}° at local noon (${place.name})`);
  }
});
