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
