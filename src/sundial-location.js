// Where to set the sundial, without asking for the visitor's location.
// The device time zone, the same one the clock uses, picks the place; nothing
// leaves the browser. Latitude shapes the dial (hour lines, gnomon height);
// longitude decides the real sunrise and sunset, so it must agree with the clock.
import zoneCoordinates from './zone-coordinates.js';

const AMRITSAR = { name: 'Amritsar', latitude: 31.634, longitude: 74.873 };

const byZone = {
  'Asia/Kolkata': AMRITSAR,
  'Asia/Calcutta': AMRITSAR,
  'Asia/Karachi': { name: 'Lahore', latitude: 31.549, longitude: 74.343 },
  'America/Vancouver': { name: 'Surrey', latitude: 49.191, longitude: -122.849 },
  'America/Toronto': { name: 'Brampton', latitude: 43.731, longitude: -79.762 },
  'America/Edmonton': { name: 'Edmonton', latitude: 53.546, longitude: -113.494 },
  'America/Winnipeg': { name: 'Winnipeg', latitude: 49.895, longitude: -97.138 },
  'America/Halifax': { name: 'Halifax', latitude: 44.649, longitude: -63.575 },
  'America/New_York': { name: 'New York', latitude: 40.713, longitude: -74.006 },
  'America/Chicago': { name: 'Chicago', latitude: 41.878, longitude: -87.630 },
  'America/Denver': { name: 'Denver', latitude: 39.739, longitude: -104.990 },
  'America/Phoenix': { name: 'Phoenix', latitude: 33.448, longitude: -112.074 },
  'America/Los_Angeles': { name: 'Los Angeles', latitude: 34.052, longitude: -118.244 },
  'Europe/London': { name: 'London', latitude: 51.507, longitude: -0.128 },
  'Europe/Dublin': { name: 'Dublin', latitude: 53.350, longitude: -6.260 },
  'Europe/Paris': { name: 'Paris', latitude: 48.857, longitude: 2.352 },
  'Europe/Berlin': { name: 'Berlin', latitude: 52.520, longitude: 13.405 },
  'Europe/Rome': { name: 'Rome', latitude: 41.903, longitude: 12.496 },
  'Europe/Amsterdam': { name: 'Amsterdam', latitude: 52.368, longitude: 4.904 },
  'Asia/Dubai': { name: 'Dubai', latitude: 25.205, longitude: 55.271 },
  'Asia/Singapore': { name: 'Singapore', latitude: 1.352, longitude: 103.820 },
  'Asia/Kuala_Lumpur': { name: 'Kuala Lumpur', latitude: 3.139, longitude: 101.687 },
  'Asia/Hong_Kong': { name: 'Hong Kong', latitude: 22.319, longitude: 114.169 },
  'Australia/Sydney': { name: 'Sydney', latitude: -33.869, longitude: 151.209 },
  'Australia/Melbourne': { name: 'Melbourne', latitude: -37.814, longitude: 144.963 },
  'Australia/Brisbane': { name: 'Brisbane', latitude: -27.470, longitude: 153.026 },
  'Australia/Perth': { name: 'Perth', latitude: -31.950, longitude: 115.860 },
  'Australia/Adelaide': { name: 'Adelaide', latitude: -34.929, longitude: 138.601 },
  'Pacific/Auckland': { name: 'Auckland', latitude: -36.848, longitude: 174.763 },
  'Africa/Nairobi': { name: 'Nairobi', latitude: -1.292, longitude: 36.822 },
};

// Minutes the zone is ahead of UTC at `date`.
export function utcOffset(zone, date = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
    .formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(date.getTime() / 60000) * 60000) / 60000;
}

const SOUTH = /^(Australia|Antarctica)\/|^Pacific\/(Auckland|Chatham|Fiji|Tongatapu|Apia|Noumea|Efate)|^America\/(Argentina|Santiago|Sao_Paulo|Montevideo|Asuncion|Lima|La_Paz)|^Africa\/(Johannesburg|Maputo|Harare|Lusaka|Windhoek|Gaborone)|^Indian\/(Mauritius|Reunion)/;

// 1. a city chosen for the Punjabi community in that zone, 2. the zone's own
// location from the tz database, 3. for any other zone name (an alias, UTC,
// Etc/GMT+5), a longitude read from the clock's UTC offset.
// In every case the sun's longitude agrees with the clock, so daytime on the
// clock is daytime on the dial.
export function sundialLocation(zone, date = new Date()) {
  let offset = 0;
  try { offset = utcOffset(zone, date); } catch { /* invalid zone: treat as UTC */ }
  const clockLongitude = offset / 4; // 15° per hour
  const known = byZone[zone] || (zoneCoordinates[zone] && { name: zone.split('/').pop().replaceAll('_', ' '), latitude: zoneCoordinates[zone][0], longitude: zoneCoordinates[zone][1] });
  // A real place is at most a few hours from its zone's offset; anything further is the wrong place.
  const gap = known ? Math.abs((((known.longitude - clockLongitude) % 360) + 540) % 360 - 180) : Infinity;
  if (known && gap <= 60) return known;
  return {
    name: zone.split('/').pop().replaceAll('_', ' '),
    latitude: known ? known.latitude : SOUTH.test(zone) ? -AMRITSAR.latitude : AMRITSAR.latitude,
    longitude: clockLongitude,
  };
}
