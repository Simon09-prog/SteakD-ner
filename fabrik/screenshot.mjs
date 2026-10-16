// Screenshots aller Entwürfe eines Ladens (Handy + Desktop) und der Entwurfs-Übersicht zur Sichtprüfung.
// Aufruf: node fabrik/screenshot.mjs <slug>
// Ergebnis: screenshots/<slug>-<n>-mobil.png, -<n>-desktop.png, -<n>-voll.png, <slug>-entwuerfe.png (nicht im Git)
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require(join(execSync('npm root -g').toString().trim(), 'playwright'));
}

const slug = process.argv[2];
if (!slug) {
  console.error('Aufruf: node fabrik/screenshot.mjs <slug>');
  process.exit(1);
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ordner = join(root, 'demos', slug);
if (!existsSync(join(ordner, 'index.html'))) {
  console.error(`Nicht gefunden: demos/${slug}/index.html – zuerst "python3 fabrik/fabrik.py bauen ${slug}" ausführen.`);
  process.exit(1);
}
const seiten = [[1, join(ordner, 'index.html')]];
for (const name of readdirSync(ordner)) {
  if (/^\d+$/.test(name) && existsSync(join(ordner, name, 'index.html'))) seiten.push([Number(name), join(ordner, name, 'index.html')]);
}
seiten.sort((a, b) => a[0] - b[0]);

const out = join(root, 'screenshots');
mkdirSync(out, { recursive: true });
const browser = await playwright.chromium.launch();
const fehler = [];

for (const [nr, seite] of seiten) {
  const url = pathToFileURL(seite).href;
  const mobil = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  mobil.on('pageerror', (e) => fehler.push(`Entwurf ${nr}: ${e.message}`));
  await mobil.goto(url, { waitUntil: 'load' });
  await mobil.screenshot({ path: join(out, `${slug}-${nr}-mobil.png`) });
  await mobil.screenshot({ path: join(out, `${slug}-${nr}-voll.png`), fullPage: true });
  // Horizontales Scrollen auf dem Handy ist ein Fehler.
  const breite = await mobil.evaluate(() => document.documentElement.scrollWidth);
  if (breite > 390) fehler.push(`Entwurf ${nr}: Seite ist auf dem Handy ${breite}px breit (horizontales Scrollen).`);
  await mobil.close();

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desktop.goto(url, { waitUntil: 'load' });
  await desktop.screenshot({ path: join(out, `${slug}-${nr}-desktop.png`) });
  await desktop.close();
}

const uebersicht = join(ordner, 'entwuerfe', 'index.html');
if (existsSync(uebersicht)) {
  const seite = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  seite.on('pageerror', (e) => fehler.push(`Übersicht: ${e.message}`));
  await seite.goto(pathToFileURL(uebersicht).href, { waitUntil: 'load' });
  await seite.waitForTimeout(800);
  await seite.screenshot({ path: join(out, `${slug}-entwuerfe.png`), fullPage: true });
  await seite.close();
}

await browser.close();
console.log(`${seiten.length} Entwurf/Entwürfe fotografiert -> screenshots/${slug}-*.png`);
if (fehler.length) {
  console.error('PROBLEME:\n - ' + fehler.join('\n - '));
  process.exit(1);
}
