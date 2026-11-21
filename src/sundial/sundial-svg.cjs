/*
 * SVG builders for the sundial, shared by the asset generator (static files)
 * and the live preview (sundial-view.js). All output is in the 1024 × 1024
 * dial space defined in sundial-engine.js.
 */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./sundial-engine.cjs') : root.SundialEngine);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SundialSVG = api;
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  const n = x => Number(x.toFixed(2));
  const pt = p => `${n(p[0])} ${n(p[1])}`;
  const line = (a, b, attrs = '') => `<path d="M${pt(a)}L${pt(b)}" ${attrs}/>`;
  const SUN_DIAMETER = 0.533 * Math.PI / 180;

  /* Engraved hour lines, quarter ticks and Gurmukhi numerals for a latitude.
     `numerals` is the glyph table written by the generator (assets/numerals.json). */
  // Engraved lines and numerals: a dark groove, plus the groove's far wall catching
  // the light, drawn as a lighter copy shifted away from the light. All those copies
  // sit in one group (.engrave-light, world space) so a renderer can move it with
  // the sun: `light` is its offset in dial units.
  function dialLayout(dial, numerals, { light = [0.6, 1] } = {}) {
    const { hours, ticks } = dial.layout();
    const [cx, cy] = dial.center, r = dial.options.plateRadius - 1;
    let litLines = '', litGlyphs = '', lines = '', tickMarks = '', glyphs = '';
    for (const tk of ticks) {
      const major = tk.kind === 'hour';
      tickMarks += line(tk.from, tk.to, `stroke="#382f20" stroke-width="${major ? 2 : 1}" stroke-opacity=".8"`);
    }
    for (const h of hours) {
      litLines += line(...h.line);
      lines += line(...h.line, 'stroke="#3c3523" stroke-opacity=".78" stroke-width="1.2"');
      const g = numerals && numerals.glyphs[h.label12];
      if (!g) continue;
      const place = `translate(${pt(h.numeral)}) rotate(${n(h.angleDegrees)})`;
      litGlyphs += `<g transform="${place}"><path d="${g.d}" transform="translate(${g.tx} ${g.ty})"/></g>`;
      glyphs += `<g aria-label="${g.label}" transform="${place}"><g transform="translate(${g.tx} ${g.ty})">`
        + `<path d="${g.d}" fill="#342f21" stroke="#302a1c" stroke-width=".3"/></g></g>`;
    }
    return `<g class="dial-layout"><clipPath id="layout-clip"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`
      + `<g clip-path="url(#layout-clip)">`
      + `<g class="engrave-light" transform="translate(${n(light[0])} ${n(light[1])})">`
      + `<g stroke="#d1b377" stroke-opacity=".48" stroke-width="1.3">${litLines}</g>`
      + `<g fill="#d0b67c" opacity=".62">${litGlyphs}</g></g>`
      + `${lines}${tickMarks}${glyphs}</g></g>`;
  }


  /* Cast shadow of the gnomon. Penumbra is physically graded: the shadow is cut
     into bands by distance from the gnomon's foot-line, and each band gets the
     blur the sun's disc would give at that distance (crisp at the gnomon, soft
     at the tip). The sun's disc lands on the ground as an ellipse stretched by
     1/sin(altitude) along the shadow, so the blur is too: the tip of a long
     evening shadow is much softer than its sides. Bands do not overlap (each is
     the ring between two swept footprints), so the penumbra never doubles up.
     Cutouts in the plate let light through. */
  // `clip: false` lets the shadow run off the dial (a dial set flush in the ground);
  // `region` is the [x, y, width, height] area, in dial units, that filters may cover.
  // `source` is the light's angular size (the sun's by default; a lamp is larger).
  // `bands: 1` draws one evenly blurred shadow with no band clipping (for a lamp,
  // whose shadow fans out instead of running parallel).
  function shadow(dial, s, { id = 'sh', opacity = 0.58, color = '#211f1a', bands = 6, clip = true, region = [-256, -256, 1536, 1536], source = SUN_DIAMETER } = {}) {
    if (!s) return '';
    const [cx, cy] = dial.center, t = dial.gnomonThickness, L = dial.gnomonLength;
    const alt = s.altitude * Math.PI / 180;
    const blurAt = d => Math.max(0.3, (d / Math.cos(alt)) * source / 2.56);
    // Along the shadow the blur stretches by 1/sin(alt) (capped, for very low sun).
    const stretch = bands > 1 ? Math.min(6, 1 / Math.max(Math.sin(alt), 1e-3)) : 1;
    const maxBlur = blurAt(s.reach) * stretch;
    const margin = 3 * maxBlur + 3;
    const [ax, ay] = s.away;
    const foot = [[cx - t / 2 - margin, cy + margin], [cx + t / 2 + margin, cy + margin],
      [cx + t / 2 + margin, cy - L - margin], [cx - t / 2 - margin, cy - L - margin]];
    const swept = (d0, d1) => E.convexHull(foot.flatMap(([x, y]) => [[x + ax * d0, y + ay * d0], [x + ax * d1, y + ay * d1]]));

    const box = `x="${n(region[0])}" y="${n(region[1])}" width="${n(region[2])}" height="${n(region[3])}"`;
    let defs = clip ? `<clipPath id="${id}-dial"><circle cx="${cx}" cy="${cy}" r="${dial.options.dialRadius}"/></clipPath>` : '';
    // The gnomon never shades its own top, which is drawn on the dial beneath an overlay.
    let holeMask = `<rect ${box} fill="#fff"/><rect x="${n(cx - t / 2)}" y="${n(cy - L)}" width="${n(t)}" height="${n(L)}" fill="#000"/>`;
    s.holes.forEach(([faceA, faceB], i) => {
      defs += `<clipPath id="${id}-hole${i}"><path d="${E.pathData(faceB)}"/></clipPath>`;
      holeMask += `<path d="${E.pathData(faceA)}" fill="#000" clip-path="url(#${id}-hole${i})"/>`;
    });
    defs += `<mask id="${id}-holes" maskUnits="userSpaceOnUse" ${box}>${holeMask}</mask>`;
    defs += `<g id="${id}-shape"><path d="${E.pathData(s.hull)}" fill="${color}" mask="url(#${id}-holes)"/></g>`;

    let body = '';
    if (bands === 1) {
      // Filter only over the shadow's own area plus the blur's reach.
      const sigma = blurAt(s.reach / 2), e = 3 * sigma + 2;
      const xs = s.hull.map(p => p[0]), ys = s.hull.map(p => p[1]);
      const fx = Math.min(...xs) - e, fy = Math.min(...ys) - e;
      defs += `<filter id="${id}-f0" filterUnits="userSpaceOnUse" x="${n(fx)}" y="${n(fy)}" width="${n(Math.max(...xs) + e - fx)}" height="${n(Math.max(...ys) + e - fy)}"><feGaussianBlur stdDeviation="${n(sigma)}"/></filter>`;
      body = `<use href="#${id}-shape" filter="url(#${id}-f0)"/>`;
    }
    // Each band blurs in a frame turned to the shadow's direction (x along `away`),
    // over just the band's own area plus the blur's reach.
    const turn = Math.atan2(ay, ax), deg = n(turn * 180 / Math.PI);
    const cos = Math.cos(-turn), sin = Math.sin(-turn);
    const local = ([x, y]) => [cx + (x - cx) * cos - (y - cy) * sin, cy + (x - cx) * sin + (y - cy) * cos];
    for (let k = 0; bands > 1 && k < bands; k++) {
      const d0 = s.reach * k / bands, d1 = k === bands - 1 ? s.reach + margin + 2 : s.reach * (k + 1) / bands;
      const across = blurAt(s.reach * (k + 0.5) / bands), along = across * stretch;
      const outer = swept(-margin, d1 + 1);
      // The ring between two swept footprints (even-odd), overlapping its neighbour by 2 units.
      const d = E.pathData(outer) + (k ? E.pathData(swept(-margin, d0 - 1)) : '');
      defs += `<clipPath id="${id}-b${k}"><path d="${d}" clip-rule="evenodd"/></clipPath>`;
      const pts = outer.map(local), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const ex = 3 * along + 2, ey = 3 * across + 2;
      const fx = Math.min(...xs) - ex, fy = Math.min(...ys) - ey;
      defs += `<filter id="${id}-f${k}" filterUnits="userSpaceOnUse" x="${n(fx)}" y="${n(fy)}" width="${n(Math.max(...xs) + ex - fx)}" height="${n(Math.max(...ys) + ey - fy)}"><feGaussianBlur stdDeviation="${n(along)} ${n(across)}"/></filter>`;
      body += `<g clip-path="url(#${id}-b${k})"><g transform="rotate(${deg} ${cx} ${cy})" filter="url(#${id}-f${k})"><use href="#${id}-shape" transform="rotate(${-deg} ${cx} ${cy})"/></g></g>`;
    }
    return `<g class="cast-shadow"><defs>${defs}</defs><g${clip ? ` clip-path="url(#${id}-dial)"` : ''} opacity="${n(opacity * 100) / 100}" style="mix-blend-mode:multiply">${body}</g></g>`;
  }

  /* The gnomon seen from directly above: only the sloped top edge (the style)
     is visible, a strip as wide as the plate is thick. Its brightness follows
     the sun; the sun-side arris catches a highlight. */
  function gnomonTop(dial, lighting, { id = 'gn' } = {}) {
    const [cx, cy] = dial.center, t = dial.gnomonThickness, L = dial.gnomonLength;
    const k = lighting ? 0.28 + 0.72 * lighting.style : 0.7;
    const mix = (a, b) => a.map((c, i) => Math.round(c + (b[i] - c) * k));
    const lo = mix([40, 35, 22], [120, 104, 64]), hi = mix([74, 64, 40], [222, 198, 138]);
    const rgb = c => `rgb(${c.join(' ')})`;
    const side = lighting ? lighting.litSide : -1;
    const x0 = cx - t / 2, y0 = cy - L;
    // Deterministic wear pits along the strip.
    let seed = 2611, pits = '';
    const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 70; i++) {
      const x = n(x0 + 1.5 + rnd() * (t - 3)), y = n(y0 + 3 + rnd() * (L - 6)), r = n(0.3 + rnd() * 0.7);
      pits += `<circle cx="${x}" cy="${y}" r="${r}" fill="${i % 3 ? '#29291b' : '#e1c483'}" opacity="${n(0.12 + rnd() * 0.2)}"/>`;
    }
    return `<g class="gnomon"><defs>
      <filter id="${id}-ao" x="-50%" y="-10%" width="200%" height="120%"><feGaussianBlur stdDeviation="2.2"/></filter>
      <linearGradient id="${id}-len" gradientUnits="userSpaceOnUse" x1="0" y1="${cy}" x2="0" y2="${y0}">
        <stop stop-color="${rgb(lo)}"/><stop offset=".45" stop-color="${rgb(hi)}"/><stop offset=".8" stop-color="${rgb(mix([62, 70, 52], [176, 160, 112]))}"/><stop offset="1" stop-color="${rgb(hi)}"/>
      </linearGradient></defs>
      <rect x="${x0 - 2.5}" y="${y0 - 1.5}" width="${t + 5}" height="${L + 3}" rx="3" fill="#17130b" opacity=".38" filter="url(#${id}-ao)"/>
      <rect x="${x0}" y="${y0}" width="${t}" height="${L}" rx="1" fill="url(#${id}-len)" stroke="#3a3423" stroke-width=".8"/>
      ${pits}
      <rect x="${side > 0 ? x0 + t - 1.6 : x0 + 0.4}" y="${y0 + 0.5}" width="1.2" height="${L - 1}" fill="#f3dfa6" opacity="${lighting ? n(0.25 + 0.5 * lighting.plate) : 0.4}"/>
      <rect x="${side > 0 ? x0 + 0.3 : x0 + t - 1.3}" y="${y0 + 0.5}" width="1" height="${L - 1}" fill="#1e1a10" opacity=".45"/>
      <rect x="${x0}" y="${y0}" width="${t}" height="1.6" fill="#2b2619" opacity=".6"/>
    </g>`;
  }

  /* Side elevation of the plate (for design reference and asset review). */
  function gnomonProfile(dial, { width = 1024, height = 640 } = {}) {
    const L = dial.gnomonLength, H = dial.gnomonHeight;
    const s = Math.min((width - 160) / L, (height - 160) / H);
    const ox = 80, oy = height - 80;
    const map = cmds => cmds.map(([op, ...v]) => {
      const out = [op];
      for (let i = 0; i < v.length; i += 2) out.push(ox + v[i] * L * s, oy - v[i + 1] * H * s);
      return out;
    });
    const p = dial.gnomonProfile;
    const d = E.pathData(map(p.outer)) + p.holes.map(h => E.pathData(map(h))).join('');
    const arc = 70, a = dial.styleAngle * Math.PI / 180;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
<title>Gnomon side elevation — style at ${n(dial.styleAngle)}° (equal to latitude)</title>
<defs><linearGradient id="pf" x1="0" y1="1" x2=".8" y2="0"><stop stop-color="#544c31"/><stop offset=".45" stop-color="#8d7647"/><stop offset=".8" stop-color="#c3a86d"/><stop offset="1" stop-color="#d0b679"/></linearGradient></defs>
<path d="M${ox - 40} ${oy}H${ox + L * s + 40}" stroke="#7d6d43" stroke-width="2"/>
<path d="${d}" fill="url(#pf)" fill-rule="evenodd" stroke="#473d25" stroke-width="1.5" stroke-linejoin="round"/>
<g fill="none" stroke="#7d6d43" stroke-width="1" font-family="system-ui, sans-serif" font-size="16" stroke-dasharray="4 4">
  <path d="M${ox + arc} ${oy}A${arc} ${arc} 0 0 0 ${n(ox + arc * Math.cos(a))} ${n(oy - arc * Math.sin(a))}"/>
</g>
<g font-family="system-ui, sans-serif" font-size="16" fill="#5d5132">
  <text x="${ox + arc + 10}" y="${oy - 12}">${n(dial.styleAngle)}° = latitude</text>
  <text x="${ox}" y="${oy + 30}">root (dial centre)</text>
  <text x="${n(ox + L * s)}" y="${oy + 30}" text-anchor="end">north foot · L = ${n(L)}</text>
  <text x="${n(ox + L * s + 12)}" y="${n(oy - H * s / 2)}">H = ${n(H)}</text>
</g></svg>`;
  }

  return { dialLayout, shadow, gnomonTop, gnomonProfile };
});
