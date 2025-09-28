#!/usr/bin/env node

import sharp from 'sharp';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const SOURCE_ICON = join(rootDir, 'public', 'spotstr-icon.webp');

const WEB_ICONS = [
  { size: 512, name: 'icon-512.png' },
  { size: 384, name: 'icon-384.png' },
  { size: 192, name: 'icon-192.png' }
];

const ANDROID_SIZES = {
  'mdpi': { size: 48, foregroundSize: 108 },
  'hdpi': { size: 72, foregroundSize: 162 },
  'xhdpi': { size: 96, foregroundSize: 216 },
  'xxhdpi': { size: 144, foregroundSize: 324 },
  'xxxhdpi': { size: 192, foregroundSize: 432 }
};

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

async function generateWebIcons() {
  console.log('Generating web icons...');
  const publicDir = join(rootDir, 'public');

  for (const icon of WEB_ICONS) {
    const outputPath = join(publicDir, icon.name);
    await sharp(SOURCE_ICON)
      .resize(icon.size, icon.size)
      .png()
      .toFile(outputPath);
    console.log(`  ✓ ${icon.name} (${icon.size}x${icon.size})`);
  }

}

async function generateAndroidIcons() {
  console.log('Generating Android icons...');
  const androidResDir = join(rootDir, 'android', 'app', 'src', 'main', 'res');

  for (const [density, config] of Object.entries(ANDROID_SIZES)) {
    const mipmapDir = join(androidResDir, `mipmap-${density}`);
    await ensureDir(mipmapDir);

    // Generate standard launcher icon
    await sharp(SOURCE_ICON)
      .resize(config.size, config.size)
      .png()
      .toFile(join(mipmapDir, 'ic_launcher.png'));
    console.log(`  ✓ mipmap-${density}/ic_launcher.png (${config.size}x${config.size})`);

    // Generate round launcher icon (with circular mask)
    const roundedCorners = Buffer.from(
      `<svg width="${config.size}" height="${config.size}">
        <circle cx="${config.size/2}" cy="${config.size/2}" r="${config.size/2}" fill="white"/>
      </svg>`
    );

    await sharp(SOURCE_ICON)
      .resize(config.size, config.size)
      .composite([{
        input: roundedCorners,
        blend: 'dest-in'
      }])
      .png()
      .toFile(join(mipmapDir, 'ic_launcher_round.png'));
    console.log(`  ✓ mipmap-${density}/ic_launcher_round.png (${config.size}x${config.size})`);

    // Generate foreground icon for adaptive icons
    // Foreground should be 108dp x 108dp with the icon centered at 72dp x 72dp
    // This means adding 18dp padding on each side (25% of original size)
    const padding = Math.round(config.foregroundSize * 0.25);
    const innerSize = config.foregroundSize - (padding * 2);

    await sharp(SOURCE_ICON)
      .resize(innerSize, innerSize)
      .extend({
        top: padding,
        bottom: padding,
        left: padding,
        right: padding,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(join(mipmapDir, 'ic_launcher_foreground.png'));
    console.log(`  ✓ mipmap-${density}/ic_launcher_foreground.png (${config.foregroundSize}x${config.foregroundSize})`);
  }
}

async function verifySourceIcon() {
  try {
    const metadata = await sharp(SOURCE_ICON).metadata();
    if (metadata.width < 512 || metadata.height < 512) {
      throw new Error(`Source icon must be at least 512x512. Current size: ${metadata.width}x${metadata.height}`);
    }
    console.log(`Source icon verified: ${metadata.width}x${metadata.height}`);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Source icon not found: ${SOURCE_ICON}`);
    }
    throw error;
  }
}

async function main() {
  try {
    console.log('🎨 Icon Generation Started');
    console.log(`Source: ${SOURCE_ICON}\n`);

    await verifySourceIcon();
    await generateWebIcons();
    await generateAndroidIcons();

    console.log('\n✅ All icons generated successfully!');
  } catch (error) {
    console.error('\n❌ Error generating icons:', error.message);
    process.exit(1);
  }
}

main();