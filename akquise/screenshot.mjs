// Screenshots einer Demo-Website (Handy + Desktop) zur Sichtprüfung.
// Aufruf: node akquise/screenshot.mjs <slug>
// Ergebnis: akquise/screenshots/<slug>-mobil.png, -mobil-voll.png, -desktop.png (nicht im Git)
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
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
  console.error('Aufruf: node akquise/screenshot.mjs <slug>');
  process.exit(1);
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const seite = join(root, 'demos', slug, 'index.html');
if (!existsSync(seite)) {
  console.error(`Nicht gefunden: ${seite} – zuerst "python3 akquise/akquise.py bauen ${slug}" ausführen.`);
  process.exit(1);
}
const out = join(root, 'akquise', 'screenshots');
mkdirSync(out, { recursive: true });

const browser = await playwright.chromium.launch();
const fehler = [];

const mobil = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
mobil.on('pageerror', (e) => fehler.push(e.message));
await mobil.goto(pathToFileURL(seite).href, { waitUntil: 'load' });
await mobil.screenshot({ path: join(out, `${slug}-mobil.png`) });
await mobil.screenshot({ path: join(out, `${slug}-mobil-voll.png`), fullPage: true });

const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await desktop.goto(pathToFileURL(seite).href, { waitUntil: 'load' });
await desktop.screenshot({ path: join(out, `${slug}-desktop.png`) });

// Seitenbreite prüfen: horizontales Scrollen auf dem Handy ist ein Fehler.
const breite = await mobil.evaluate(() => document.documentElement.scrollWidth);
if (breite > 390) fehler.push(`Seite ist auf dem Handy ${breite}px breit (horizontales Scrollen).`);

await browser.close();
console.log(`Screenshots in akquise/screenshots/${slug}-*.png`);
if (fehler.length) {
  console.error('PROBLEME:\n - ' + fehler.join('\n - '));
  process.exit(1);
}
