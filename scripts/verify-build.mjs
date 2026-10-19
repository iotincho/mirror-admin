import { readdir, readFile } from 'node:fs/promises';
const files = await readdir(new URL('../dist/assets/', import.meta.url));
for (const file of files.filter(name => name.endsWith('.js'))) {
  const content = await readFile(new URL(`../dist/assets/${file}`, import.meta.url), 'utf8');
  if (/lucia@example\.com|10000000-0000-4000-8000-000000000001|cuenta.*@example\.com/.test(content)) {
    throw new Error(`El build contiene fixtures de demostración: ${file}`);
  }
}
console.log('Build verificado: no contiene los fixtures de demostración.');
