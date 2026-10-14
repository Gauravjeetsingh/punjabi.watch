import { build } from 'esbuild';
import { cp, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
await mkdir('dist/assets', { recursive: true });
await cp('public', 'dist', { recursive: true });
// Keep the existing Play Console privacy URL and domain configuration intact.
for (const name of ['privacy.html', 'CNAME', 'punjab-map.png', 'punjab-map-fikka.png']) {
  await copyFile(name, `dist/${name}`);
}
await build({ entryPoints: ['src/app.js'], bundle: true, format: 'esm', target: 'es2020', outfile: 'dist/app.js', minify: true, legalComments: 'linked' });
await cp('node_modules/nanakshahi/LICENSE.md', 'dist/assets/nanakshahi-LICENSE.md');
await cp('node_modules/nanakshahi/dist/index.js', 'dist/assets/nanakshahi-source.js');
console.log('Built dist/ for GitHub Pages. privacy.html and CNAME copied without changes.');
