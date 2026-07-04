import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import icongen from 'icon-gen';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const assetsDir = path.join(root, 'assets');
const sourceSvg = path.join(assetsDir, 'icon-source.svg');
const buildDir = path.join(assetsDir, 'generated');
const pngPath = path.join(buildDir, 'icon-1024.png');

await fs.mkdir(buildDir, { recursive: true });
await sharp(sourceSvg).resize(1024, 1024).png().toFile(pngPath);

await icongen(pngPath, buildDir, {
  report: false,
  ico: { name: 'icon' },
  icns: { name: 'icon' },
  favicon: { name: 'favicon' },
});

await fs.copyFile(path.join(buildDir, 'icon.ico'), path.join(assetsDir, 'icon.ico'));
await fs.copyFile(path.join(buildDir, 'icon.icns'), path.join(assetsDir, 'icon.icns'));
await fs.copyFile(pngPath, path.join(assetsDir, 'icon.png'));

console.log('Generated desktop icons in desktop/assets');
