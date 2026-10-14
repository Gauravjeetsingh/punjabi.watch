const featured = [
  ['Amritsar', 'India', 'Asia/Kolkata'], ['Chandigarh', 'India', 'Asia/Kolkata'],
  ['Jalandhar', 'India', 'Asia/Kolkata'], ['Ludhiana', 'India', 'Asia/Kolkata'],
  ['Patiala', 'India', 'Asia/Kolkata'], ['Delhi', 'India', 'Asia/Kolkata'],
  ['Lahore', 'Pakistan', 'Asia/Karachi'], ['Faisalabad', 'Pakistan', 'Asia/Karachi'],
  ['Vancouver', 'Canada', 'America/Vancouver'], ['Surrey', 'Canada', 'America/Vancouver'],
  ['Toronto', 'Canada', 'America/Toronto'], ['Brampton', 'Canada', 'America/Toronto'],
  ['London', 'United Kingdom', 'Europe/London'], ['Birmingham', 'United Kingdom', 'Europe/London'],
  ['Melbourne', 'Australia', 'Australia/Melbourne'], ['Sydney', 'Australia', 'Australia/Sydney'],
  ['New York', 'United States', 'America/New_York'], ['Los Angeles', 'United States', 'America/Los_Angeles'],
  ['Auckland', 'New Zealand', 'Pacific/Auckland'], ['Dubai', 'United Arab Emirates', 'Asia/Dubai'],
  ['Singapore', 'Singapore', 'Asia/Singapore'], ['UTC', 'Coordinated Universal Time', 'UTC'],
];
export function validZone(zone) {
  try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(); return true; } catch { return false; }
}
export function cityList() {
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  const cities = featured.map(([name, region, zone]) => ({ name, region, zone }));
  for (const zone of zones) {
    const name = zone.split('/').pop().replaceAll('_', ' ');
    if (!cities.some(c => c.name === name)) cities.push({ name, region: zone.split('/')[0], zone });
  }
  return cities.filter(c => validZone(c.zone));
}
export const defaults = featured.filter(c => ['Amritsar', 'London', 'Toronto'].includes(c[0])).map(([name, region, zone]) => ({ name, region, zone }));
export const storageKey = 'punjabi.watch.cities.v1';
export function loadCities(storage) {
  try {
    const saved = JSON.parse(storage.getItem(storageKey));
    if (!Array.isArray(saved)) return defaults;
    return saved.filter(c => c && typeof c.name === 'string' && c.name.length <= 100 && typeof c.zone === 'string' && validZone(c.zone))
      .map(c => ({ name: c.name, zone: c.zone, region: typeof c.region === 'string' ? c.region.slice(0, 100) : '' }))
      .filter((c, i, all) => all.findIndex(other => other.name === c.name && other.zone === c.zone) === i).slice(0, 50);
  } catch { return defaults; }
}
