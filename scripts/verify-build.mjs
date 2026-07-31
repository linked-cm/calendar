import { access } from 'node:fs/promises';

const requiredArtifacts = [
  'lib/esm/index.js',
  'lib/esm/index.d.ts',
  'lib/esm/Calendar.module.css',
  'lib/esm/translations/en.json',
  'lib/cjs/index.js',
  'lib/cjs/package.json',
];

await Promise.all(requiredArtifacts.map((artifact) => access(new URL(`../${artifact}`, import.meta.url))));
