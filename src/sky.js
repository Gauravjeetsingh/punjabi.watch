// Applies the sundial's sky (scene.ambient from sundial-view) to page-wide layers
// through CSS variables: night colour washout, the twilight glow on the sun's side
// of the horizon, night vision (a softening blur and a contrast-lowering veil), and
// the lamp that lights the text once it gets dark.
export function applySky(scene, root = document.body) {
  const sky = scene && scene.ambient;
  if (!sky) return;
  const [r, g, b] = sky.glow.color;
  root.style.setProperty('--sky-desaturate', String(sky.desaturate));
  root.style.setProperty('--sky-darkness', String(sky.darkness));
  root.style.setProperty('--sky-glow', String(sky.glow.amount));
  root.style.setProperty('--sky-glow-color', `rgb(${r} ${g} ${b})`);
  root.style.setProperty('--sky-glow-angle', `${sky.glow.angle}deg`);
  const [nr, ng, nb] = sky.night.color;
  root.style.setProperty('--sky-veil', String(sky.night.veil));
  root.style.setProperty('--sky-blur', `${sky.night.blur}px`);
  root.style.setProperty('--sky-night-color', `rgb(${nr} ${ng} ${nb})`);
  root.classList.toggle('night-vision', sky.night.blur > 0.05);
  // Full-page blend layers cost compositing work, so they only exist while they show.
  root.classList.toggle('sky-desaturating', sky.desaturate > 0.005);
  root.classList.toggle('sky-glowing', sky.glow.amount > 0.005);
  root.classList.toggle('sky-veiled', sky.night.veil > 0.005);
  // Raised letters: a short sharp shadow away from the sun.
  const text = sky.textShadow || { x: 0, y: 0, alpha: 0 };
  root.style.setProperty('--text-sun-x', `${text.x}px`);
  root.style.setProperty('--text-sun-y', `${text.y}px`);
  root.style.setProperty('--text-sun-alpha', String(text.alpha));
  root.classList.toggle('lights-on', sky.lightsOn);
}
