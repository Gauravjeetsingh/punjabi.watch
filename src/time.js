import wording from '../shared/punjabi-time.json' with { type: 'json' };
import dateWording from '../shared/nanakshahi-date.json' with { type: 'json' };
import { getNanakshahiDate } from 'nanakshahi';

// Port of clock-core/PunjabiTimeFormatter.kt. All language comes from shared JSON.
export function formatTime(hour24, minute, script = 'gurmukhi') {
  if (!Number.isInteger(hour24) || hour24 < 0 || hour24 > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) throw new RangeError('Invalid clock time');
  const words = wording.scripts[script];
  const hour = (hour24 + 11) % 12 + 1;
  if (minute === 30 && words.halfPastOverrides[hour]) return words.halfPastOverrides[hour];
  const key = ({ 0: 'exact', 15: 'quarterPast', 30: 'halfPast', 45: 'quarterTo' })[minute] || 'literal';
  return words.patterns[key].replace('{hour}', words.numbers[hour]).replace('{minute}', words.numbers[minute]).replace('{nextHour}', words.numbers[hour % 12 + 1]);
}
export function dayPeriod(hour, minute) {
  const m = hour * 60 + minute;
  const key = m < 300 ? 'amritVela' : m < 720 ? 'morning' : m < 930 ? 'afternoon' : m < 1140 ? 'evening' : 'night';
  return wording.scripts.gurmukhi.dayPeriods[key];
}
const formatters = new Map();
export function zonedParts(date, timeZone) {
  if (!formatters.has(timeZone)) formatters.set(timeZone, new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }));
  return Object.fromEntries(formatters.get(timeZone).formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
}
export const gurmukhiDigits = value => String(value).replace(/\d/g, d => '੦੧੨੩੪੫੬੭੮੯'[d]);
export function nanakshahiDate(parts) {
  // The library reads local Date fields. Construct the target zone's civil date
  // at noon, rather than passing an instant that may be a different local day.
  const result = getNanakshahiDate(new Date(parts.year, parts.month - 1, parts.day, 12));
  return result;
}
export function numericTime(parts) {
  return `${parts.hour % 12 || 12}:${String(parts.minute).padStart(2, '0')} ${parts.hour < 12 ? 'am' : 'pm'}`;
}
export function dayDifference(a, b) {
  return Math.round((Date.UTC(a.year, a.month - 1, a.day) - Date.UTC(b.year, b.month - 1, b.day)) / 86400000);
}
export function minuteDelay(now = Date.now()) { return 60000 - now % 60000 + 30; }
export { dateWording };
export function formatNanakshahi(parts) {
  const { englishDate: date } = nanakshahiDate(parts);
  return `${gurmukhiDigits(date.date)} ${dateWording.months[date.month - 1]}, ${gurmukhiDigits(date.year)}`;
}
