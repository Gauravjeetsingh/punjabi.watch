import { initTesterSignup } from './tester-signup.js';
import { formatTime, dayPeriod, zonedParts, numericTime, formatNanakshahi, dayDifference, minuteDelay } from './time.js';
import { cityList, defaults, loadCities, storageKey, validZone } from './cities.js';
const $ = selector => document.querySelector(selector);
const make = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const pa = (className, text) => { const node = make('p', className, text); node.lang = 'pa'; return node; };

if ($('#time-words')) {
  let selected;
  try { selected = loadCities(localStorage); } catch { selected = [...defaults]; }
  let timer;
  const cities = cityList();
  const dialog = $('#city-dialog');
  const search = $('#city-search');
  const zoneName = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const sameCity = (a, b) => a.zone === b.zone && a.name === b.name;
  const setText = (selector, text) => { const node = $(selector); if (node.textContent !== text) node.textContent = text; };

  function tick() {
    clearTimeout(timer);
    const now = new Date();
    try {
      const zone = zoneName();
      const parts = zonedParts(now, zone);
      setText('#local-zone', `${zone.split('/').pop().replaceAll('_', ' ')} · Local time`);
      setText('#day-period', dayPeriod(parts.hour, parts.minute));
      setText('#time-words', formatTime(parts.hour, parts.minute));
      setText('#numeric-time', numericTime(parts));
      setText('#gregorian-date', new Intl.DateTimeFormat('en-GB', { timeZone: zone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now));
      try { setText('#nanakshahi-date', formatNanakshahi(parts)); }
      catch { setText('#nanakshahi-date', '—'); throw new Error('The Nanakshahi calendar supports dates from 14 March 2003. Please check your device date.'); }
      for (const [i, city] of selected.entries()) {
        const card = document.querySelectorAll('.world-clock')[i];
        if (!card) continue;
        const p = zonedParts(now, city.zone);
        const difference = dayDifference(p, parts);
        const offset = new Intl.DateTimeFormat('en', { timeZone: city.zone, timeZoneName: 'shortOffset' }).formatToParts(now).find(p => p.type === 'timeZoneName').value;
        card.querySelector('.city-period').textContent = dayPeriod(p.hour, p.minute);
        card.querySelector('.city-words').textContent = formatTime(p.hour, p.minute);
        card.querySelector('.city-numeric').textContent = numericTime(p);
        card.querySelector('.city-day').textContent = `${difference === 0 ? 'Today' : difference === 1 ? 'Tomorrow' : difference === -1 ? 'Yesterday' : `${difference > 0 ? '+' : ''}${difference} days`} · ${offset}`;
      }
      $('#clock-error').hidden = true;
    } catch (error) {
      $('#clock-error').textContent = error.message || 'Unable to read the clock. Please check your device’s date and time.';
      $('#clock-error').hidden = false;
    }
    timer = setTimeout(tick, minuteDelay());
  }
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(selected)); }
    catch { $('#storage-note').textContent = 'Your browser could not save these cities. They will stay here until you close or reload the page.'; }
  }
  function renderCards() {
    const grid = $('#world-clocks');
    grid.replaceChildren();
    if (!selected.length) grid.append(make('p', 'empty-world', 'Which places do you keep time with? Add a city to begin.'));
    selected.forEach((city, i) => {
      const card = make('article', 'world-clock');
      card.setAttribute('aria-label', `${city.name} clock`);
      const heading = make('div', 'city-heading');
      heading.append(make('h3', '', city.name));
      const remove = make('button', 'remove-city', '×');
      remove.type = 'button'; remove.setAttribute('aria-label', `Remove ${city.name}`);
      remove.addEventListener('click', () => {
        selected.splice(i, 1); save(); renderCards(); tick();
        $('#city-status').textContent = `${city.name} removed.`;
        const buttons = [...document.querySelectorAll('.remove-city')];
        (buttons[Math.min(i, buttons.length - 1)] || $('#add-city')).focus();
      });
      heading.append(remove);
      const footer = make('div', 'city-footer');
      footer.append(make('span', 'city-numeric'), make('span', 'city-day'));
      card.append(heading, pa('city-period'), pa('city-words'), footer); grid.append(card);
    });
  }
  function renderResults() {
    const query = search.value.trim();
    const terms = query.toLowerCase().replaceAll('_', ' ').split(/\s+/).filter(Boolean);
    let matches = query ? cities.filter(c => terms.every(t => `${c.name} ${c.region} ${c.zone}`.toLowerCase().replaceAll('_', ' ').includes(t))) : cities.slice(0, 12);
    if (query && !matches.length && validZone(query)) matches = [{ name: query.split('/').pop().replaceAll('_', ' '), zone: query, region: query }];
    $('#search-summary').textContent = query ? `${matches.length} ${matches.length === 1 ? 'place' : 'places'} found${matches.length > 50 ? ' · showing the first 50' : ''}` : 'A few places to start';
    const results = $('#city-results'); results.replaceChildren();
    if (!matches.length) results.append(make('p', 'empty-world', 'No matching city. Try a nearby city or a time zone such as Europe/Paris.'));
    for (const city of matches.slice(0, 50)) {
      const added = selected.some(c => sameCity(c, city));
      const button = make('button', 'city-result'); button.type = 'button'; button.disabled = added;
      button.setAttribute('aria-label', `${added ? 'Already added' : 'Add'} ${city.name}, ${city.region}`);
      const label = make('span'); label.append(make('strong', '', city.name), make('small', '', `${city.region} · ${city.zone}`));
      button.append(label, make('span', 'result-action', added ? 'Added' : '+ Add'));
      button.addEventListener('click', () => {
        if (selected.length >= 50) { $('#search-summary').textContent = 'You have 50 cities. Remove one before adding another.'; return; }
        if (!selected.some(c => sameCity(c, city))) selected.push(city);
        save(); renderCards(); tick(); renderResults();
        $('#search-summary').textContent = `${city.name} added to your clocks.`;
        search.focus();
      }); results.append(button);
    }
  }
  $('#add-city').addEventListener('click', () => { search.value = ''; renderResults(); dialog.showModal(); search.focus(); });
  $('#close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); dialog.close(); } });
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  search.addEventListener('input', renderResults);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); else clearTimeout(timer); });
  window.addEventListener('focus', tick);
  window.addEventListener('pageshow', tick);
  window.addEventListener('storage', event => { if (event.key === storageKey || event.key === null) { try { selected = loadCities(localStorage); } catch { selected = [...defaults]; } renderCards(); tick(); if (dialog.open) renderResults(); } });
  renderCards(); tick();
}

for (const button of document.querySelectorAll('[data-mode]')) {
  button.addEventListener('click', () => {
    const ambient = button.dataset.mode === 'ambient';
    $('#feature-shot').src = `/assets/${ambient ? '06-always-on' : '05-quarter-to'}.png`;
    $('#feature-shot').alt = `${ambient ? 'Always-on' : 'Active'} Punjabi watch face at 7:45 pm: ਰਾਤ ਦੇ, ਪੌਣੇ ਅੱਠ`;
    for (const other of document.querySelectorAll('[data-mode]')) other.setAttribute('aria-pressed', String(other === button));
  });
}

const seaVideo = $('#sea-video');
if (seaVideo) {
  const toggle = $('#video-toggle');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let resumeOnReturn = false;
  function updateVideoControl() {
    const playing = !seaVideo.paused && !seaVideo.ended;
    toggle.dataset.playing = String(playing);
    toggle.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} background video`);
    toggle.title = toggle.getAttribute('aria-label');
  }
  async function playVideo() {
    const source = seaVideo.querySelector('source');
    if (!source.getAttribute('src')) { source.src = window.matchMedia('(max-width: 640px)').matches ? source.dataset.mobileSrc : source.dataset.src; seaVideo.load(); }
    seaVideo.muted = true;
    try { await seaVideo.play(); } catch { /* The poster stays visible when autoplay is blocked. */ }
    updateVideoControl();
  }
  toggle.hidden = false;
  toggle.addEventListener('click', () => { if (seaVideo.paused) playVideo(); else seaVideo.pause(); });
  for (const event of ['play', 'pause', 'ended', 'error']) seaVideo.addEventListener(event, updateVideoControl);
  reducedMotion.addEventListener('change', event => { if (event.matches) { resumeOnReturn = false; seaVideo.pause(); } });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { resumeOnReturn = !seaVideo.paused; seaVideo.pause(); }
    else if (resumeOnReturn && !reducedMotion.matches) { resumeOnReturn = false; playVideo(); }
  });
  if (!reducedMotion.matches && !navigator.connection?.saveData) playVideo();
  else updateVideoControl();
}

const watchCorner = $('#watch-corner');
if (watchCorner) {
  const summary = watchCorner.querySelector('summary');
  const collapse = (returnFocus = false) => { watchCorner.open = false; if (returnFocus) summary.focus(); };
  watchCorner.querySelector('.watch-corner-close').addEventListener('click', () => collapse(true));
  document.addEventListener('click', event => { if (watchCorner.open && !watchCorner.contains(event.target)) collapse(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !event.defaultPrevented && watchCorner.open) {
      event.preventDefault(); collapse(watchCorner.contains(document.activeElement));
    }
  });
}

const testerSignup = document.querySelector('#tester-signup-form');
if (testerSignup) initTesterSignup(testerSignup);
