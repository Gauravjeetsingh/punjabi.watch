// Copies the sundial engine and plate artwork from the design project
// (../../design/sundial) into this repo. The site deploys on its own, so these
// are snapshots, like shared/*.json. Run after changing the design files:
//   node scripts/sync-sundial.mjs
// Copied as .cjs because this package is "type": "module" and the sundial files
// are UMD (CommonJS when bundled, plain scripts in the design lab).
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const design = fileURLToPath(new URL('../../../design/sundial/', import.meta.url));
await mkdir(`${root}src/sundial`, { recursive: true });
await mkdir(`${root}public/assets/sundial`, { recursive: true });
for (const name of ['sundial-engine', 'sundial-svg', 'sundial-view']) {
  const source = await readFile(`${design}${name}.js`, 'utf8');
  await writeFile(`${root}src/sundial/${name}.cjs`, source.replace(/require\('\.\/(sundial-[a-z]+)\.js'\)/g, "require('./$1.cjs')"));
}
await copyFile(`${design}assets/numerals.json`, `${root}src/sundial/numerals.json`);
await copyFile(`${design}assets/sundial-plate.svg`, `${root}public/assets/sundial/sundial-plate.svg`);
await copyFile(`${design}assets/ornament.png`, `${root}public/assets/sundial/ornament.png`);
console.log('Synced sundial engine and plate from design/sundial.');
