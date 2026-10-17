# Punjabi watch

A live Punjabi word clock, local Nanakshahi date, saved world clocks, and a Wear OS
watch-face showcase at https://punjabi.watch.

## Develop

Requires Node.js 22 or newer (GitHub Actions uses Node 24).

```sh
npm ci
npm test
npm run dev
```

Open http://127.0.0.1:4173. Run `npm run build` after editing source and reload.
`npm run test:browser` runs the interaction/layout checks against the running
preview using an installed Google Chrome. Override `CHROME_PATH` if needed.

## Deployment

Pushes to `main` run the tests, build `dist/`, verify the privacy page and domain,
and deploy only `dist/` through GitHub Pages. No backend, remote fonts, analytics,
API keys or personal data are included. The old root clock files are retained as
legacy files; Pages serves the current source from `public/` and `src/` via `dist/`.

**Do not move or rename `privacy.html`.** Its public address,
https://punjabi.watch/privacy.html, is submitted in Play Console. The build copies
it byte-for-byte, and the workflow checks its approved SHA-256. Any intentional
future privacy policy revision must update the recorded checksum as well.
`CNAME` remains `punjabi.watch`; no DNS changes are required.

## Source and calendar

- `src/time.js` follows the Android/Wear OS `PunjabiTimeFormatter` rules.
  All time spelling and phrasing come from `shared/punjabi-time.json`.
- The shared JSON files are snapshots of the app/watch project’s canonical files.
  Synchronize both JSON files from that project when updating language; do not
  independently change the spellings here. The wording remains draft/unreviewed.
- The date uses `nanakshahi@9.0.1`, the fixed solar 2003 Nanakshahi convention.
  It uses the visitor’s local civil day, with month names from the shared data.
- `Intl.DateTimeFormat` uses IANA time zones and the browser’s current daylight-
  saving rules. City selections are stored only in the visitor’s browser.
- Minute-boundary updates and tab-resume handling always read the actual clock.

## Images and credits

The bundled Noto Sans Gurmukhi font is under SIL OFL 1.1. Real watch screenshots
come from release 0.2.1 and also represent the unchanged 0.2.2 face resources.
`/credits.html` provides font/library licenses and the unmodified library source.
No Play Store link is shown until the public listing for
`com.raga.punjabiwatchface` has been verified.

Tests cover all 1,440 minutes, calendar agreement for every day from 2003–2100,
DST transitions, date rollover, storage recovery, city interactions, and mobile
and desktop layouts. Browser screenshots are saved under ignored `test-results/`.

## Sea-water theme

The home page uses the supplied sea-water video as one fixed, full-page scene.
The word clock fills the first viewport; the date and scroll cue sit below it,
and the world clocks continue below the fold. The header and home wordmark are
removed. The watch showcase uses the same blue-grey palette without video.

The original 4K clip is exported as silent H.264 MP4 at 1920px for desktop and
960px for phones, with fast-start playback and a still poster. The mobile source
is selected before loading to avoid downloading both. The background can be
paused, stays still for reduced-motion/data-saving preferences until played,
and pauses when the tab is hidden. The local preview supports byte-range video
requests. `npm run test:ocean` checks media controls, fallback behavior, responsive
layouts, world-clock scroll placement and the still watch page.

## Tester signups

The showcase uses a custom email field and inline confirmation with Formspree.
Set `data-endpoint` on `#tester-signup-form` in `public/watch/index.html` to the
actual generated endpoint from Formspree’s Integration tab (`https://formspree.io/f/<id>`).
The configured form endpoint is `https://formspree.io/f/xyekoray`. The submit
button is enabled when the generated endpoint is valid. Missing or malformed
configuration keeps the form disabled.

No API secret is needed or placed in the page. Submissions send the email, tester
signup purpose and honeypot directly to Formspree; email addresses are not saved
in browser storage. The UI handles validation, loading, successful confirmation,
rate limits and connection failures without leaving the showcase. Only confirmed
successful responses show “Joined.” The separate `/signup-privacy.html` notice
covers signups; the Play Console `/privacy.html` remains unchanged.

`npm run test:signup` checks success/failure behavior, duplicate-submit prevention,
honeypot handling and responsive layout with intercepted requests. It does not
send any test email addresses to Formspree.
