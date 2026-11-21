/*
 * Live sundial renderer for the browser. Mounts into an <svg viewBox="0 0 1024 1024">
 * and redraws the parts that move: hour layout (on latitude change), cast shadow,
 * gnomon shading and sunlight on the plate.
 *
 *   const view = SundialView.mount(svg, { plateHref: 'assets/sundial-plate.svg' });
 *   view.update({ latitude, longitude, date, clockHours, mode, fast });   // returns the scene
 *   (fast: true while animating, for cheaper penumbra)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./sundial-engine.cjs'), require('./sundial-svg.cjs'), root);
  } else {
    root.SundialView = factory(root.SundialEngine, root.SundialSVG, root);
  }
})(typeof self !== 'undefined' ? self : this, function (E, S, root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const n = x => Number(x.toFixed(2));
  const mixRGB = (a, b, t) => a.map((c, i) => Math.round(c + (b[i] - c) * t));
  const rgb = c => `rgb(${c.join(' ')})`;

  // Only touch the DOM when the markup really changed (a still frame redraws nothing).
  function setHTML(node, html) {
    if (node._html === html) return;
    node.innerHTML = html;
    node._html = html;
  }

  function el(parent, tag, attrs = {}) {
    const node = document.createElementNS(NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    parent.appendChild(node);
    return node;
  }

  /*
   * Daylight as two lights, in linear light (sRGB channels ^2.2):
   *   sun – warm when low, on the ground ∝ sin(alt)·transmission (air mass grows
   *         near the horizon), with a mild perceptual lift so low-sun shadows stay legible;
   *   sky – blue, always there, dimmer when the sun is low.
   * Sunlit ground gets sun + sky; shadowed ground gets sky alone, so shadows are
   * blue-grey (warmer and bluer at golden hour) and fade out as the sun sets.
   * The eye is white-balanced to the midday mix and adapts its exposure.
   */
  const lin = c => c.map(v => Math.pow(v / 255, 2.2));
  const srgb = c => c.map(v => Math.round(255 * Math.pow(Math.min(1, Math.max(0, v)), 1 / 2.2)));
  const luma = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const scale = (c, k) => c.map(v => v * k);
  function daylightMix(altitude) {
    const sm = E.smoothstep;
    const a = Math.max(0, altitude);
    const s = Math.sin(a * Math.PI / 180);
    const airMass = 1 / (s + 0.50572 * Math.pow(a + 6.07995, -1.6364)); // Kasten & Young
    const sun = 5 * Math.pow(s, 0.7) * Math.exp(-0.06 * (airMass - 1));
    const sky = 0.35 + 0.65 * Math.sqrt(s);
    const sunHue = lin(mixRGB([255, 251, 244], [255, 168, 92], sm(32, 1, altitude)));
    // Clear blue sky by day; near sunrise and sunset the sky's light is greyer and warmer.
    const skyHue = lin(mixRGB([196, 214, 246], [216, 206, 212], sm(20, 0, altitude)));
    return { sun: scale(sunHue, sun / luma(sunHue)), sky: scale(skyHue, sky / luma(skyHue)) };
  }
  const NOON = (() => { const { sun, sky } = daylightMix(60); return sun.map((v, i) => v + sky[i]); })();
  const NOON_DIRECT = (() => { const { sun, sky } = daylightMix(60); return luma(sun) / luma(sun.map((v, i) => v + sky[i])); })();

  function daylight(altitude) {
    const { sun, sky } = daylightMix(altitude);
    const total = sun.map((v, i) => v + sky[i]);
    // White-balanced to midday, then the eye's exposure: a little dimmer at low sun.
    const balanced = total.map((v, i) => v / NOON[i]);
    const exposure = 0.6 + 0.4 * E.smoothstep(1, 25, altitude);
    const lit = scale(balanced, exposure / luma(balanced));
    return {
      lit: srgb(lit),
      // Multiplied over the lit colour, leaves skylight only (per channel, ≤ 1).
      shadow: srgb(sky.map((v, i) => v / total[i])),
      // Share of the light that comes straight from the sun, 1 at midday.
      direct: Math.min(1, luma(sun) / luma(total) / NOON_DIRECT),
    };
  }

  // Colour keyframes by the real sun's altitude, interpolated smoothly.
  function ramp(keys, altitude) {
    if (altitude <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [a1, c1] = keys[i], [a0, c0] = keys[i - 1];
      if (altitude <= a1) return mixRGB(c0, c1, E.smoothstep(a0, a1, altitude));
    }
    return keys[keys.length - 1][1];
  }
  // Light on the ground (multiplied onto the scene).
  const TWILIGHT = [
    [-18, [40, 50, 86]],     // night
    [-12, [52, 64, 106]],    // end of nautical twilight
    [-8, [82, 96, 148]],     // blue hour
    [-5, [118, 128, 178]],
    [-3, [160, 152, 188]],   // lavender
    [-1.5, [200, 168, 176]], // rose, warmth arriving
    [0, [226, 186, 168]],    // sunrise / sunset
  ];
  // Moonlight is sunlight, but the dark-adapted eye sees it cool (Purkinje shift).
  const MOON_HUE = (() => { const h = lin([212, 222, 248]); return h.map(v => v / luma(h)); })();
  // The lamp by the words: warm incandescent light from a point a little above the
  // ground. Brightness on the ground falls off as cos³ of the angle from straight
  // below it (inverse square × slant), which is what gives a lamp its pool.
  const LAMP_HUE = (() => { const h = lin([255, 184, 112]); return h.map(v => v / luma(h)); })();
  const LAMP_POWER = 0.3;            // linear light right under the lamp
  const LAMP_STOPS = [0, 0.3, 0.6, 1, 1.5, 2.2, 3.2, 4.5];
  const lampFalloff = (r, h) => Math.pow(h * h / (h * h + r * r), 1.5);
  const LIP = 4;                     // height of the rim above the plate and stone
  // The sky straight overhead, which is what a flat bronze plate seen from above
  // mirrors: blue by day, deep blue at dusk, near black at night.
  const ZENITH = [
    [-18, [6, 8, 16]], [-10, [20, 28, 58]], [-6, [44, 58, 116]], [-2, [92, 100, 150]],
    [0, [124, 126, 160]], [6, [118, 148, 200]], [30, [98, 140, 206]],
  ];
  // The warm band on the horizon: deep red-orange when dim, golden as the sun nears.
  const GLOW = [[-6, [226, 112, 96]], [-2, [255, 140, 74]], [0, [255, 162, 84]], [4, [255, 196, 124]]];

  /*
   * The sky as a person would see it. Brightness and colour follow the real sun
   * (so dawn, dusk and night come when they really do); direction follows the
   * dial's sun, the one that casts the shadow, so every light agrees on where
   * the sun is.
   *   day (> 6°) neutral · golden hour (0–25°) warm · sunrise/sunset (−2 to 0°)
   *   rose-warm · civil twilight (−6 to −2°) lavender to blue · nautical twilight
   *   (−12 to −6°) blue hour · night (< −12°) dark blue-black, colour washed out.
   * We look down at the ground, not at the sky: twilight is the colour of the
   * light falling on the stone, which is blue until the last minutes before
   * sunrise. The warm band on the horizon only shows as a faint glow from the
   * sun's side.
   * Returns colours and amounts a page can apply to its own layers too.
   */
  function ambient(scene, dial) {
    const alt = scene.real.altitude;
    const sm = E.smoothstep;
    const dayF = sm(-0.833, 6, alt);
    const day = daylight(scene.real.apparentAltitude);
    // Below the horizon the light on the ground comes from the twilight sky alone.
    const c = mixRGB(ramp(TWILIGHT, alt), day.lit, sm(0, 6, alt));
    // The glow sits on the horizon where the sun is (about to come up, or just gone).
    const enu = scene.dialSun.enu;
    const sx = dial.hemisphere * enu.east, sy = -dial.hemisphere * enu.north;
    const len = Math.hypot(sx, sy) || 1;
    const morning = scene.real.hourAngle < 0;
    const glow = sm(-7, -1.5, alt) * (1 - sm(0, 4, alt)) * (morning ? 1 : 0.8);
    // Moonlight, once the sky is dark: brightness by phase and the moon's height,
    // relative to the night sky's own light. A full moon high up roughly doubles it,
    // so the ground is a little brighter and the gnomon casts a faint, cool shadow.
    const m = scene.moon;
    const moonLight = m && m.up
      ? 1.4 * Math.pow(m.fraction, 1.5) * Math.pow(Math.sin(Math.max(0, m.apparentAltitude) * Math.PI / 180), 0.6) * sm(-4, -12, alt)
      : 0;
    const lit = lin(c).map((v, i) => v * (1 + moonLight * MOON_HUE[i]));
    const darkness = sm(-1, -12, alt);
    return {
      tint: srgb(lit),
      shadow: day.shadow,                       // multiply colour of a full shadow
      direct: n(day.direct * dayF),             // 0 night → 1 midday sun
      darkness,                                 // 0 day → 1 full night
      desaturate: 0.7 * sm(-3, -12, alt),       // colour fades in the dark
      // Night vision: contrast drops and fine detail goes (less so by moonlight).
      // A page lays a veil of night blue over the scene and softens it.
      night: {
        veil: n(darkness * 0.3 * (1 - 0.45 * Math.min(1, moonLight))),
        blur: n(darkness * 0.9 * (1 - 0.3 * Math.min(1, moonLight))),
        color: [24, 31, 52],
      },
      moon: {
        light: n(moonLight),
        // Multiplied over the moonlit tint, leaves the night sky's light only.
        shadow: srgb(MOON_HUE.map(h => 1 / (1 + moonLight * h))),
        direct: n(moonLight / (1 + moonLight)),
      },
      lightsOn: alt < -3,                       // lamps come on in civil dusk
      lamp: n(sm(-2, -4, alt)),                 // 0 off → 1 fully on, around lightsOn
      glow: {
        amount: n(glow),
        color: ramp(GLOW, alt),
        // CSS angle (0deg = up) pointing away from the sun, so a gradient starts on the sun's side.
        angle: n(Math.atan2(-sx / len, sy / len) * 180 / Math.PI),
      },
      morning,
    };
  }

  /*
   * Options:
   *   overlay  – optional <svg> covering the whole page (pointer-events: none). When
   *              given, the cast shadow, gnomon and light tint are drawn there, kept
   *              aligned with the dial, so the shadow runs off the dial across the page
   *              and the sunlight colours everything (a dial set flush in the ground).
   *   groundShadow – draw the contact shadow where the dial meets the stone.
   *   lamp     – optional element (with an overlay) where a lamp stands after dark,
   *              lampHeight dial units above the ground. It lights a warm pool on the
   *              stone and the gnomon casts a long shadow away from it.
   */
  function mount(svg, { plateHref = 'assets/sundial-plate.svg', ornamentHref = 'assets/ornament.png', numerals = root && root.SUNDIAL_NUMERALS, groundShadow = true, overlay = null, lamp = null, lampHeight = 640 } = {}) {
    svg.setAttribute('viewBox', '0 0 1024 1024');
    svg.innerHTML = '';
    const defs = el(svg, 'defs');
    defs.innerHTML = `
      <filter id="v-ground" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="3"/></filter>
      <clipPath id="v-dial"><circle cx="512" cy="512" r="491"/></clipPath>
      <linearGradient id="v-sheen" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#fff2cf" stop-opacity=".5"/><stop offset=".42" stop-color="#fff2cf" stop-opacity="0"/>
        <stop offset=".58" stop-color="#140e05" stop-opacity="0"/><stop offset="1" stop-color="#140e05" stop-opacity=".42"/>
      </linearGradient>`;
    // The dial is set flush in the stone: no cast shadow of its own, only the dark
    // seam where bronze meets stone (contact shadow), the same in any light.
    const ground = el(svg, 'circle', { cx: 512, cy: 512, r: 492, fill: '#000', opacity: 0.45, filter: 'url(#v-ground)' });
    el(svg, 'image', { href: plateHref, x: 0, y: 0, width: 1024, height: 1024 });
    // The ornament is inlaid in the face, flush with it: no shadow of its own.
    // Pages can tune its colour with CSS (class sundial-ornament).
    if (ornamentHref) {
      const O = S.ORNAMENT;
      el(svg, 'image', { href: ornamentHref, x: O.x, y: O.y, width: O.width, height: O.height, class: 'sundial-ornament' });
    }
    const layout = el(svg, 'g');
    // Bronze is a metal: it mirrors the sky, a little, on top of its own colour.
    const skyReflection = el(svg, 'circle', { cx: 512, cy: 512, r: 491, style: 'mix-blend-mode:screen', opacity: 0.16 });
    const sheenGradient = defs.querySelector('#v-sheen');
    let shadow, lip, moonShadow, lampShadow, lampGradient, lampStops, sheen, gnomon, tint;
    if (overlay) {
      // The overlay is multiplied onto the page (CSS mix-blend-mode: multiply on the
      // overlay element), so the shadow darkens and the light colours what lies beneath.
      sheen = el(svg, 'circle', { cx: 512, cy: 512, r: 487.5, fill: 'none', 'stroke-width': 9, stroke: 'url(#v-sheen)' });
      gnomon = el(svg, 'g');
      overlay.innerHTML = '';
      overlay.setAttribute('preserveAspectRatio', 'xMinYMin meet');
      overlay.style.mixBlendMode = 'multiply';
      const overlayDefs = el(overlay, 'defs');
      lampGradient = el(overlayDefs, 'radialGradient', { id: 'v-lamp', gradientUnits: 'userSpaceOnUse' });
      lampStops = LAMP_STOPS.map((r, i) => el(lampGradient, 'stop', { offset: n(r / LAMP_STOPS[LAMP_STOPS.length - 1]) }));
      shadow = el(overlay, 'g');
      lip = el(overlay, 'g');
      moonShadow = el(overlay, 'g');
      lampShadow = el(overlay, 'g');
      tint = el(overlay, 'rect', { style: 'mix-blend-mode:multiply' });
    } else {
      shadow = el(svg, 'g');
      lip = el(svg, 'g');
      moonShadow = el(svg, 'g');
      sheen = el(svg, 'circle', { cx: 512, cy: 512, r: 487.5, fill: 'none', 'stroke-width': 9, stroke: 'url(#v-sheen)' });
      gnomon = el(svg, 'g');
      // Colour of the light falls on everything, gnomon included.
      tint = el(svg, 'rect', { x: 0, y: 0, width: 1024, height: 1024, 'clip-path': 'url(#v-dial)', style: 'mix-blend-mode:multiply' });
    }

    let dial = null, dialKey = '', lastArgs = null;
    // The overlay's area in dial units, so dial geometry lands in the right place.
    let region = [-256, -256, 1536, 1536];
    function align() {
      if (!overlay) return false;
      const r = svg.getBoundingClientRect(), o = overlay.getBoundingClientRect();
      if (!r.width || !o.width) return false;
      const k = 1024 / r.width;
      const next = [(o.left - r.left) * k, (o.top - r.top) * k, o.width * k, o.height * k].map(n);
      if (next.join() === region.join()) return false;
      region = next;
      overlay.setAttribute('viewBox', region.join(' '));
      tint.setAttribute('x', region[0]); tint.setAttribute('y', region[1]);
      tint.setAttribute('width', region[2]); tint.setAttribute('height', region[3]);
      return true;
    }
    if (overlay && typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(() => { if (align() && lastArgs) update(lastArgs); });
      observer.observe(svg); observer.observe(overlay);
    }

    function lipShadow(cast, altitude, color) {
      const [cx, cy] = dial.center, R = dial.options.dialRadius, r = dial.options.plateRadius;
      const off = Math.min(40, LIP / Math.tan(Math.max(altitude, 0.5) * Math.PI / 180));
      const sx = n(cx + cast.away[0] * off), sy = n(cy + cast.away[1] * off);
      const box = overlay ? region : [-256, -256, 1536, 1536];
      const rect = `x="${box[0]}" y="${box[1]}" width="${box[2]}" height="${box[3]}"`;
      return `<defs>
        <mask id="v-lip-out" maskUnits="userSpaceOnUse" ${rect}><circle cx="${sx}" cy="${sy}" r="${R}" fill="#fff"/><circle cx="${cx}" cy="${cy}" r="${R}" fill="#000"/></mask>
        <mask id="v-lip-in" maskUnits="userSpaceOnUse" ${rect}><circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff"/><circle cx="${sx}" cy="${sy}" r="${r}" fill="#000"/></mask>
      </defs><g style="mix-blend-mode:multiply" fill="${color}">
        <rect ${rect} mask="url(#v-lip-out)"/><rect ${rect} mask="url(#v-lip-in)"/>
      </g>`;
    }

    function lampPosition() {
      if (!overlay || !lamp) return null;
      const r = svg.getBoundingClientRect(), l = lamp.getBoundingClientRect();
      if (!r.width || !l.width) return null;
      const k = 1024 / r.width;
      return { x: (l.left + l.width / 2 - r.left) * k, y: (l.top + l.height / 2 - r.top) * k, z: lampHeight };
    }

    function update(args) {
      lastArgs = args;
      const { latitude, longitude, date, clockHours, mode = 'clock', fast = false } = args;
      // While animating, fewer penumbra bands (each is a blur filter).
      const bands = fast ? 3 : 6;
      align();
      const key = latitude.toFixed(3);
      if (key !== dialKey) {
        dial = E.createDial({ latitude });
        dialKey = key;
        layout.innerHTML = S.dialLayout(dial, numerals);
      }
      const scene = E.computeScene({ dial, date, latitude, longitude, clockHours, mode });
      const alt = scene.dialSun.altitude;

      // Light on the scene (see ambient() above): amount and colour from the real
      // sun, direction from the dial's sun.
      scene.ambient = ambient(scene, dial);
      const { direct } = scene.ambient;
      tint.setAttribute('fill', rgb(scene.ambient.tint));
      skyReflection.setAttribute('fill', rgb(ramp(ZENITH, scene.real.altitude)));

      // Cast shadow: what is left is skylight, so it is blue-grey, and it fades as
      // the sun sinks and the sky takes over. The tint above it adds the light's colour.
      setHTML(shadow, scene.shadow
        ? S.shadow(dial, scene.shadow, { id: 'v-sh', opacity: 1, bands, color: rgb(scene.ambient.shadow), clip: !overlay, region: overlay ? region : undefined })
        : '');
      const moon = scene.ambient.moon;
      setHTML(moonShadow, scene.moon.shadow && moon.light > 0.02
        ? S.shadow(dial, scene.moon.shadow, { id: 'v-mn', opacity: 1, bands, color: rgb(moon.shadow), clip: !overlay, region: overlay ? region : undefined })
        : '');
      // The lamp: a warm pool on the stone (in the tint, so it shows the stone's own
      // colour), and the gnomon's shadow thrown away from it.
      const at = lampPosition();
      const lampOn = at ? scene.ambient.lamp : 0;
      let lampShare = 0, lampCast = null;
      if (lampOn > 0) {
        const base = lin(scene.ambient.tint);
        const lit = r => base.map((v, i) => v + LAMP_HUE[i] * LAMP_POWER * lampOn * lampFalloff(r, at.z));
        const reach = at.z * LAMP_STOPS[LAMP_STOPS.length - 1];
        lampGradient.setAttribute('cx', n(at.x)); lampGradient.setAttribute('cy', n(at.y));
        lampGradient.setAttribute('r', n(reach));
        LAMP_STOPS.forEach((r, i) => lampStops[i].setAttribute('stop-color', rgb(srgb(i === LAMP_STOPS.length - 1 ? base : lit(r * at.z)))));
        tint.setAttribute('fill', 'url(#v-lamp)');
        lampCast = dial.lampShadow(at);
        const atGnomon = lit(Math.hypot(at.x - dial.center[0], at.y - (dial.center[1] - dial.gnomonLength / 2)));
        lampShare = 1 - luma(base) / luma(atGnomon);
        setHTML(lampShadow, S.shadow(dial, lampCast, {
          id: 'v-lp', opacity: 1, bands: 1, source: 0.07, region,
          color: rgb(srgb(base.map((v, i) => v / atGnomon[i]))), clip: false,
        }));
      } else if (lampShadow) {
        setHTML(lampShadow, '');
      }
      scene.ambient.lampShare = n(lampShare);

      // The gnomon's top shades by the share of light coming straight from the sun
      // (or, at night, the brighter of the moon and the lamp).
      const byLamp = !scene.shadow && lampCast && lampShare > moon.direct;
      const byMoon = !scene.shadow && !byLamp && moon.light > 0.02;
      const source = byLamp ? dial.gnomonLighting(lampCast.enu) : byMoon ? dial.gnomonLighting(scene.moon.enu) : scene.lighting;
      const k = byLamp ? lampShare : byMoon ? moon.direct : direct;
      const lighting = { ...source, style: source.style * k, plate: source.plate * k };
      // At night `direct` is 0, so it is lit by what is left of the sky.
      setHTML(gnomon, S.gnomonTop(dial, lighting, { id: 'v-gn' }));
      const strength = direct;

      // The rim is a low lip (LIP units high) around the plate. It catches the sun
      // on one side, and throws thin shadows: outward onto the stone on the far side,
      // and inward onto the plate on the sun's side.
      setHTML(lip, scene.shadow ? lipShadow(scene.shadow, alt, rgb(scene.ambient.shadow)) : '');
      if (scene.shadow) {
        const [ax, ay] = scene.shadow.away;
        sheenGradient.setAttribute('x1', n(512 - ax * 491)); sheenGradient.setAttribute('y1', n(512 - ay * 491));
        sheenGradient.setAttribute('x2', n(512 + ax * 491)); sheenGradient.setAttribute('y2', n(512 + ay * 491));
        sheen.setAttribute('opacity', n(0.3 + 0.7 * strength));
      } else if ((byMoon && scene.moon.shadow) || byLamp) {
        // A faint moonlit or lamplit edge on the rim.
        const [ax, ay] = byLamp ? lampCast.away : scene.moon.shadow.away;
        sheenGradient.setAttribute('x1', n(512 - ax * 491)); sheenGradient.setAttribute('y1', n(512 - ay * 491));
        sheenGradient.setAttribute('x2', n(512 + ax * 491)); sheenGradient.setAttribute('y2', n(512 + ay * 491));
        sheen.setAttribute('opacity', n(0.5 * (byLamp ? lampShare : moon.direct)));
      } else {
        sheen.setAttribute('opacity', 0);
      }
      ground.style.display = groundShadow ? '' : 'none';

      // Engravings: the far wall of each groove catches the light, so the light copy
      // shifts away from whichever light is strongest. Under a dark sky it fades.
      const lightFrom = scene.shadow ? [scene.shadow.away, 0.3 + 0.7 * strength]
        : byLamp ? [lampCast.away, 0.6 * lampShare]
          : byMoon && scene.moon.shadow ? [scene.moon.shadow.away, 0.6 * moon.direct]
            : [[0, 0.35], 0.15];
      const engraveLight = layout.querySelector('.engrave-light');
      if (engraveLight) {
        engraveLight.setAttribute('transform', `translate(${n(lightFrom[0][0] * 1.15)} ${n(lightFrom[0][1] * 1.15)})`);
        engraveLight.setAttribute('opacity', n(lightFrom[1]));
      }

      // Raised letters on the page cast a short sharp shadow away from the sun
      // (letters ~1.2 px high), for a page to apply with CSS.
      if (scene.shadow) {
        const len = Math.min(5, 1.2 / Math.tan(Math.max(alt, 1) * Math.PI / 180));
        scene.ambient.textShadow = { x: n(scene.shadow.away[0] * len), y: n(scene.shadow.away[1] * len), alpha: n(0.55 * strength) };
      } else {
        scene.ambient.textShadow = { x: 0, y: 0, alpha: 0 };
      }
      scene.dial = dial;
      return scene;
    }
    return { update, get dial() { return dial; } };
  }

  return { mount, ambient, daylight };
});
