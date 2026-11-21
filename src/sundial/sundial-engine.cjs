/*
 * Sundial engine — pure geometry and astronomy, no DOM.
 *
 * Models a horizontal sundial with a plate gnomon, seen from directly above.
 * Everything a renderer (web preview, Wear OS, watchOS) needs comes from here,
 * so the same numbers can be ported line-for-line to Kotlin or Swift.
 *
 * Coordinate system ("dial space"), shared with the SVG assets:
 *   - 1024 × 1024 canvas, dial centre / gnomon root at (512, 512).
 *   - x to the right, y downwards (SVG convention).
 *   - Screen-up points to the elevated pole: north in the northern hemisphere,
 *     south in the southern hemisphere (the dial is turned so noon is on top).
 *   - z is height above the dial plate, in the same units.
 *
 * Physics:
 *   - The gnomon's sloped edge (the style) rises from the root toward screen-up
 *     at an angle equal to |latitude|, so it is parallel to the Earth's axis.
 *   - Hour lines: tan θ = sin φ · tan H  (θ from the noon line, H hour angle).
 *   - The plate has thickness t: morning lines start at the west face, afternoon
 *     lines at the east face, so the noon line is split (the "noon gap").
 *   - Shadow = parallel projection of the gnomon solid along the sun vector.
 *   - Penumbra grows with distance from the casting edge (sun disc ≈ 0.533°).
 *
 * Time models:
 *   - 'clock' (heliochronometer): the dial is driven by clock time, so the shadow
 *     always reads the same time as the phone. The sun used for the shadow has
 *     today's real declination, at hour angle (clock time − 12 h) × 15°. This is
 *     what a heliochronometer does mechanically by correcting for longitude and
 *     the equation of time.
 *   - 'solar': the real sun for the location. The shadow shows local apparent
 *     solar time, like an ordinary garden sundial.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SundialEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const RAD = Math.PI / 180;
  const DEG = 180 / Math.PI;
  const SUN_ANGULAR_DIAMETER = 0.533 * RAD;
  const OBLIQUITY = 23.44;

  const DEFAULTS = Object.freeze({
    center: [512, 512],
    gnomonLength: 340,      // root → north foot along the noon line
    gnomonThickness: 17,    // plate thickness (≈1.8% of the plate diameter)
    dialRadius: 491,        // outer edge of the bronze (shadow is clipped here)
    plateRadius: 472,       // engraved face inside the rim
    hourLineInner: 118,
    hourLineOuter: 342,
    tickOuter: 356,
    numeralRadius: 404,
    minLatitude: 1,         // horizontal dials degenerate at the equator
  });

  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const mod = (a, n) => ((a % n) + n) % n;

  /* ------------------------------------------------------------------ *
   * Solar position — NOAA spreadsheet algorithm (after Meeus).
   * Accuracy ≈ 0.01° in position and a few seconds in time, 1800–2100.
   * ------------------------------------------------------------------ */
  function solarPosition(date, latitude, longitude) {
    const jd = date.getTime() / 86400000 + 2440587.5;
    const T = (jd - 2451545) / 36525;
    const L0 = mod(280.46646 + T * (36000.76983 + T * 0.0003032), 360);
    const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
    const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
    const C = Math.sin(M * RAD) * (1.914602 - T * (0.004817 + 0.000014 * T))
      + Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * T)
      + Math.sin(3 * M * RAD) * 0.000289;
    const omega = 125.04 - 1934.136 * T;
    const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * RAD);
    const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
    const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
    const declination = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD)) * DEG;
    const y = Math.tan(eps * RAD / 2) ** 2;
    const equationOfTime = 4 * DEG * (y * Math.sin(2 * L0 * RAD)
      - 2 * e * Math.sin(M * RAD)
      + 4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD)
      - 0.5 * y * y * Math.sin(4 * L0 * RAD)
      - 1.25 * e * e * Math.sin(2 * M * RAD)); // minutes

    const utcMinutes = mod(date.getTime() / 60000, 1440);
    const solarMinutes = mod(utcMinutes + equationOfTime + 4 * longitude, 1440);
    const hourAngle = solarMinutes / 4 - 180;
    const sun = sunVector(latitude, declination, hourAngle);
    const altitude = Math.asin(clamp(sun.up, -1, 1)) * DEG;
    return {
      declination,
      equationOfTime,
      hourAngle,
      solarTimeHours: solarMinutes / 60,
      altitude,
      apparentAltitude: altitude + refraction(altitude),
      azimuth: mod(Math.atan2(sun.east, sun.north) * DEG, 360),
    };
  }

  // Bennett's formula, degrees in → degrees out.
  function refraction(altitude) {
    if (altitude < -1) return 0;
    return 1.02 / Math.tan((altitude + 10.3 / (altitude + 5.11)) * RAD) / 60;
  }

  /* ------------------------------------------------------------------ *
   * Moon position and phase — low-precision series (Astronomical Almanac,
   * as in SunCalc). About 0.3° in position: plenty for a faint moon shadow.
   * Parallax (up to 1°) is applied to the altitude.
   * ------------------------------------------------------------------ */
  function moonPosition(date, latitude, longitude) {
    const d = date.getTime() / 86400000 + 2440587.5 - 2451545;
    const e = 23.4397 * RAD;
    const L = (218.316 + 13.176396 * d) * RAD;      // mean longitude
    const M = (134.963 + 13.064993 * d) * RAD;      // mean anomaly
    const F = (93.272 + 13.22935 * d) * RAD;        // mean distance from node
    const l = L + 6.289 * RAD * Math.sin(M);        // ecliptic longitude
    const b = 5.128 * RAD * Math.sin(F);            // ecliptic latitude
    const distance = 385001 - 20905 * Math.cos(M);  // km
    const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
    const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
    const sidereal = (280.16 + 360.9856235 * d) * RAD + longitude * RAD;
    const hourAngle = mod((sidereal - ra) * DEG + 180, 360) - 180;
    const v = sunVector(latitude, dec * DEG, hourAngle);
    const geocentric = Math.asin(clamp(v.up, -1, 1)) * DEG;
    const altitude = geocentric - Math.asin(6378.14 / distance) * DEG * Math.cos(geocentric * RAD);
    // Phase from the sun's ecliptic longitude (elongation).
    const Ms = (357.5291 + 0.98560028 * d) * RAD;
    const ls = Ms + (1.9148 * Math.sin(Ms) + 0.02 * Math.sin(2 * Ms) + 0.0003 * Math.sin(3 * Ms)) * RAD + 102.9372 * RAD + Math.PI;
    const cosElongation = Math.cos(b) * Math.cos(l - ls);
    return {
      declination: dec * DEG,
      hourAngle,
      altitude,
      apparentAltitude: altitude + refraction(altitude),
      fraction: (1 - cosElongation) / 2,             // 0 new → 1 full
      waxing: Math.sin(l - ls) > 0,
    };
  }

  /* Unit vector toward the sun in local East-North-Up coordinates. */
  function sunVector(latitude, declination, hourAngle) {
    const p = latitude * RAD, d = declination * RAD, h = hourAngle * RAD;
    return {
      east: -Math.cos(d) * Math.sin(h),
      north: Math.cos(p) * Math.sin(d) - Math.sin(p) * Math.cos(d) * Math.cos(h),
      up: Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(h),
    };
  }

  /* ------------------------------------------------------------------ *
   * Gnomon profile — the side elevation of the plate.
   * (u, v) are normalised: u = 0 at the root, 1 at the north foot;
   * v = 0 on the dial, 1 at the top of the back edge. The style is the
   * straight diagonal (0,0)→(1,1) and must stay straight.
   * Commands: ['M',u,v] ['L',u,v] ['Q',cu,cv,u,v] ['Z'].
   * ------------------------------------------------------------------ */

  /* Convert profile art drawn on any triangle (root, top, foot in the art's
     own 2-D coordinates) into normalised (u, v). The mapping is affine, so
     straight lines and quadratic curves stay exact. */
  function profileFromTriangleArt(rootPt, topPt, footPt, commands) {
    // Solve P = root + u·(foot − root) + v·(top − foot)
    const ax = footPt[0] - rootPt[0], ay = footPt[1] - rootPt[1];
    const bx = topPt[0] - footPt[0], by = topPt[1] - footPt[1];
    const det = ax * by - ay * bx;
    const map = (x, y) => {
      const px = x - rootPt[0], py = y - rootPt[1];
      return [round4((px * by - py * bx) / det), round4((ax * py - ay * px) / det)];
    };
    return commands.map(([op, ...n]) => {
      const out = [op];
      for (let i = 0; i < n.length; i += 2) out.push(...map(n[i], n[i + 1]));
      return out;
    });
  }
  const round4 = x => Math.round(x * 1e4) / 1e4;

  // The scroll cutout from the original gnomon art (gnomon.svg v1). That art
  // laid the plate flat with root (512,512), raised corner (430,327) and north
  // end (512,218); it is re-mapped onto a correct right-angled profile here.
  const DEFAULT_GNOMON_PROFILE = Object.freeze({
    outer: [['M', 0, 0], ['L', 1, 1], ['L', 1, 0], ['Z']],
    holes: [profileFromTriangleArt([512, 512], [430, 327], [512, 218], [
      ['M', 492, 296], ['L', 456, 333], ['L', 492, 414],
      ['Q', 473, 379, 475, 356], ['Q', 477, 339, 492, 335], ['Z'],
    ])],
  });

  /* ------------------------------------------------------------------ *
   * Dial
   * ------------------------------------------------------------------ */
  function createDial(options = {}) {
    const o = Object.assign({}, DEFAULTS, options);
    const latitude = o.latitude;
    if (!Number.isFinite(latitude)) throw new Error('createDial needs a latitude');
    const hemisphere = latitude < 0 ? -1 : 1;
    // Clamp only the dial geometry; a dial at the equator has no usable lines.
    const phi = Math.max(Math.abs(latitude), o.minLatitude);
    const dialLatitude = hemisphere * phi;
    const sinPhi = Math.sin(phi * RAD);
    const [cx, cy] = o.center;
    const L = o.gnomonLength, t = o.gnomonThickness;
    const H = L * Math.tan(phi * RAD);
    const profile = o.gnomonProfile || DEFAULT_GNOMON_PROFILE;

    // Screen angle of an hour line, clockwise from screen-up, radians.
    function hourLineAngle(hourAngleDeg) {
      const h = hourAngleDeg * RAD;
      return hemisphere * Math.atan2(sinPhi * Math.sin(h), Math.cos(h));
    }
    // Which face of the plate casts the shadow for this hour: −1 left, +1 right.
    const faceSide = hourAngleDeg => (hemisphere * hourAngleDeg < 0 ? -1 : 1);
    function hourLineOrigin(hourAngleDeg) {
      return [cx + faceSide(hourAngleDeg) * t / 2, cy];
    }
    function pointOnHourLine(hourAngleDeg, r) {
      const a = hourLineAngle(hourAngleDeg), [x, y] = hourLineOrigin(hourAngleDeg);
      return [x + r * Math.sin(a), y - r * Math.cos(a)];
    }
    // Inverse of hourLineAngle: what hour does a shadow at this angle read?
    function hourAngleFromLine(angleRad) {
      const a = hemisphere * angleRad;
      return Math.atan2(Math.sin(a), sinPhi * Math.cos(a)) * DEG;
    }

    // Longest possible day at this latitude (summer solstice), as an hour angle.
    const cosH0 = -Math.tan(phi * RAD) * Math.tan(OBLIQUITY * RAD);
    const maxHourAngle = cosH0 <= -1 ? 180 : Math.acos(clamp(cosH0, -1, 1)) * DEG;

    /* Hour lines, ticks and numeral placements for this latitude. Hours are
       clock hours (12 = noon). Only hours the sun can actually reach appear. */
    function layout() {
      const hours = [], ticks = [];
      const first = Math.ceil(12 - maxHourAngle / 15), last = Math.floor(12 + maxHourAngle / 15);
      for (let q = Math.ceil((12 - maxHourAngle / 15) * 4); q <= Math.floor((12 + maxHourAngle / 15) * 4); q++) {
        const hour = q / 4, ha = (hour - 12) * 15;
        const kind = q % 4 === 0 ? 'hour' : q % 2 === 0 ? 'half' : 'quarter';
        const inner = kind === 'hour' ? o.hourLineOuter : kind === 'half' ? 347 : 351;
        ticks.push({ hour, kind, from: pointOnHourLine(ha, inner), to: pointOnHourLine(ha, o.tickOuter) });
      }
      for (let hour = first; hour <= last; hour++) {
        const ha = (hour - 12) * 15;
        const angle = hourLineAngle(ha);
        hours.push({
          hour,
          label12: ((hour + 11) % 12) + 1,
          angleDegrees: round4(angle * DEG),
          line: [pointOnHourLine(ha, o.hourLineInner), pointOnHourLine(ha, o.hourLineOuter)],
          numeral: pointOnHourLine(ha, o.numeralRadius),
        });
      }
      return { hours, ticks };
    }

    /* Project a point of the gnomon (face offset, profile u, v) onto the dial. */
    function projector(s) {
      const kx = s.x / s.up, ky = s.y / s.up;
      return (offset, u, v) => {
        const z = v * H;
        return [cx + offset - z * kx, cy - u * L - z * ky];
      };
    }
    const toScreenSun = enu => ({
      x: hemisphere * enu.east,
      y: -hemisphere * enu.north,
      up: enu.up,
    });

    /* Shadow geometry for a sun given in ENU coordinates. */
    function shadow(enuSun) {
      const s = toScreenSun(enuSun);
      const minUp = Math.sin(0.25 * RAD);          // avoid projecting to infinity
      const sun = s.up < minUp ? Object.assign({}, s, { up: minUp }) : s;
      const project = projector(sun);
      const faces = [-t / 2, t / 2];
      // The solid is a triangular prism: its shadow is the convex hull of the
      // six projected corners.
      const corners = [];
      for (const f of faces) for (const [u, v] of [[0, 0], [1, 1], [1, 0]]) corners.push(project(f, u, v));
      const hull = convexHull(corners);
      // Light passes through a cutout only where both faces' openings overlap.
      const holes = profile.holes.map(cmds => faces.map(f => cmds.map(([op, ...n]) => {
        const out = [op];
        for (let i = 0; i < n.length; i += 2) out.push(...project(f, n[i], n[i + 1]));
        return out;
      })));
      // The time-telling edge is the style shadow of the face nearest the sun.
      const castFace = sun.x > 0 ? -1 : 1; // sun on the right → shadow goes left
      const styleRoot = [cx + castFace * t / 2, cy];
      const styleTip = project(castFace * t / 2, 1, 1);
      const angle = Math.atan2(styleTip[0] - styleRoot[0], -(styleTip[1] - styleRoot[1]));
      const altitude = Math.asin(clamp(sun.up, -1, 1));
      const casterDistance = H / Math.max(Math.sin(altitude), minUp);
      const horizontal = Math.hypot(sun.x, sun.y) || 1e-9;
      return {
        sun: s,
        altitude: altitude * DEG,
        // Unit ground direction the shadow travels (away from the sun), and how
        // far the top of the gnomon is thrown along it.
        away: [-sun.x / horizontal, -sun.y / horizontal],
        reach: H / Math.tan(altitude),
        hull,
        holes,
        styleRoot,
        styleTip,
        styleAngle: angle,
        readsHourAngle: hourAngleFromLine(angle),
        length: Math.hypot(styleTip[0] - styleRoot[0], styleTip[1] - styleRoot[1]),
        penumbraAtTip: casterDistance * SUN_ANGULAR_DIAMETER,
      };
    }

    /* Shadow geometry for a point light (a lamp) at dial position (x, y), height z,
       all in dial units. A perspective projection from the lamp: it fans out, and
       only exists while the lamp is higher than the gnomon (z is raised if not). */
    function lampShadow({ x, y, z }) {
      const lz = Math.max(z, H * 1.15 + 1);
      const project = (offset, u, v) => {
        const px = cx + offset, py = cy - u * L, pz = v * H;
        const k = lz / (lz - pz);
        return [x + (px - x) * k, y + (py - y) * k];
      };
      const faces = [-t / 2, t / 2];
      const corners = [];
      for (const f of faces) for (const [u, v] of [[0, 0], [1, 1], [1, 0]]) corners.push(project(f, u, v));
      const holes = profile.holes.map(cmds => faces.map(f => cmds.map(([op, ...n]) => {
        const out = [op];
        for (let i = 0; i < n.length; i += 2) out.push(...project(f, n[i], n[i + 1]));
        return out;
      })));
      // Seen from the gnomon's middle: which way the shadow runs, and how high the lamp stands.
      const mx = cx, my = cy - L / 2;
      const dx = mx - x, dy = my - y, horizontal = Math.hypot(dx, dy) || 1e-9;
      const tip = project(0, 1, 1);
      return {
        lamp: { x, y, z: lz },
        altitude: Math.atan2(lz, horizontal) * DEG,
        away: [dx / horizontal, dy / horizontal],
        reach: Math.max(1, Math.hypot(tip[0] - cx, tip[1] - (cy - L))),
        distance: Math.hypot(horizontal, lz - H / 2),
        hull: convexHull(corners),
        holes,
        // Direction toward the lamp from the gnomon, as an ENU vector (for shading).
        enu: (() => {
          const len = Math.hypot(-dx, -dy, lz - H / 2);
          return { east: hemisphere * -dx / len, north: -hemisphere * -dy / len, up: (lz - H / 2) / len };
        })(),
      };
    }

    /* Lambert terms for shading the gnomon seen from above. */
    function gnomonLighting(enuSun) {
      const s = toScreenSun(enuSun);
      const style = Math.max(0, s.up * Math.cos(phi * RAD) + s.y * Math.sin(phi * RAD));
      return { style, litSide: s.x > 0 ? 1 : -1, plate: Math.max(0, s.up) };
    }

    return {
      latitude, dialLatitude, hemisphere, styleAngle: phi,
      center: [cx, cy], gnomonLength: L, gnomonThickness: t, gnomonHeight: H,
      gnomonProfile: profile, options: o, maxHourAngle,
      hourLineAngle, hourLineOrigin, pointOnHourLine, hourAngleFromLine,
      layout, shadow, lampShadow, gnomonLighting,
    };
  }

  /* ------------------------------------------------------------------ *
   * Scene — everything a frame needs, from a time and a place.
   *   clockHours: local clock time in hours (e.g. 15.5), from the device.
   *   date: the UTC instant (for declination and the real sun).
   * ------------------------------------------------------------------ */
  function computeScene({ dial, date, latitude, longitude, clockHours, mode = 'clock' }) {
    const real = solarPosition(date, latitude, longitude);
    const dialHourAngle = mode === 'solar' ? real.hourAngle : (mod(clockHours, 24) - 12) * 15;
    // Sunrise and sunset always follow the real sun, so the shadow is there
    // exactly when the sun is in the sky.
    const sunUp = real.altitude > -0.833;
    let declination = real.declination;
    let enu = sunVector(dial.dialLatitude, declination, dialHourAngle);
    // In clock mode the corrected sun can sit just below the dial's horizon while
    // the real sun is still up (or the reverse). The hour a shadow reads depends
    // only on the hour angle, so lift the declination until the sun clears the
    // horizon: the shadow still reads the exact time, it is just very long.
    const minUp = Math.sin(1.5 * RAD);
    if (sunUp && enu.up < minUp) declination = liftDeclination(dial.dialLatitude, declination, dialHourAngle, minUp);
    enu = sunVector(dial.dialLatitude, declination, dialHourAngle);
    const altitude = Math.asin(clamp(enu.up, -1, 1)) * DEG;
    const daylight = sunUp ? smoothstep(-0.833, 4, real.altitude) : 0; // fades in from sunrise
    const shadowInfo = sunUp && enu.up > 0 ? dial.shadow(enu) : null;
    // The moon, when the sky is dark enough for it to matter. Its shadow is cast by
    // the real moon (a sundial read by moonlight is off by the moon's age).
    const moonPos = moonPosition(date, latitude, longitude);
    const moonEnu = sunVector(dial.dialLatitude, moonPos.declination, moonPos.hourAngle);
    const moonUp = moonPos.apparentAltitude > 0 && moonEnu.up > 0;
    const moon = { ...moonPos, enu: moonEnu, up: moonUp, shadow: moonUp && !sunUp ? dial.shadow(moonEnu) : null };
    return {
      mode,
      real,
      moon,
      dialHourAngle,
      dialSun: { enu, altitude },
      daylight,
      shadow: shadowInfo,
      lighting: dial.gnomonLighting(enu),
      readsHours: shadowInfo ? mod(12 + shadowInfo.readsHourAngle / 15, 24) : null,
      // Clock time minus local apparent solar time, in minutes (the heliochronometer correction).
      correctionMinutes: mod((clockHours - real.solarTimeHours) * 60 + 720, 1440) - 720,
    };
  }

  /* Smallest change of declination (toward the elevated pole) that puts the sun
     at least `minUp` above the dial horizon at this hour angle. */
  function liftDeclination(latitude, declination, hourAngle, minUp) {
    const target = Math.sign(latitude || 1) * 89;
    let lo = declination, hi = target;
    if (sunVector(latitude, hi, hourAngle).up < minUp) return hi;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (sunVector(latitude, mid, hourAngle).up < minUp) lo = mid; else hi = mid;
    }
    return hi;
  }

  /* Andrew's monotone chain. */
  function convexHull(points) {
    const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [], upper = [];
    for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
    return lower.slice(0, -1).concat(upper.slice(0, -1));
  }

  /* SVG path data from points or profile-style commands. */
  function pathData(commandsOrPoints, digits = 2) {
    const f = x => Number(x.toFixed(digits));
    if (typeof commandsOrPoints[0][0] === 'number') {
      return commandsOrPoints.map((p, i) => `${i ? 'L' : 'M'}${f(p[0])} ${f(p[1])}`).join('') + 'Z';
    }
    return commandsOrPoints.map(([op, ...n]) => op + n.map(f).join(' ')).join('');
  }

  return {
    DEFAULTS, DEFAULT_GNOMON_PROFILE, RAD, DEG,
    solarPosition, moonPosition, sunVector, refraction,
    createDial, computeScene, profileFromTriangleArt,
    convexHull, pathData, smoothstep,
  };
});
