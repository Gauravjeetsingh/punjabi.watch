// Where to set the sundial, without asking for the visitor's location.
// The device time zone picks a representative city; nothing leaves the browser.
// Latitude shapes the dial (hour lines, gnomon height); longitude only decides
// the real sunrise and sunset. Unknown zones fall back to Amritsar.
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

export function sundialLocation(zone) {
  return byZone[zone] || AMRITSAR;
}
