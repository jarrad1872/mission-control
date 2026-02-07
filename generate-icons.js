#!/usr/bin/env node
/**
 * PWA Icon Generator for Mission Control
 * Generates PNG icons from SVG template using sharp
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch {
  console.log('sharp not available, generating SVG fallbacks only');
  sharp = null;
}

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const ICONS_DIR = path.join(__dirname, 'icons');

// SVG icon template - Mission Control target/crosshair design
function createSvgIcon(size, maskable = false) {
  const padding = maskable ? size * 0.1 : 0; // Safe area for maskable
  const center = size / 2;
  const radius = (size / 2) - padding - (size * 0.05);
  const innerRadius = radius * 0.6;
  const dotRadius = radius * 0.15;
  const crosshairLen = radius * 0.35;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="${size}" height="${size}" fill="#0f0f1a"/>
  
  <!-- Outer ring -->
  <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="#e94560" stroke-width="${size * 0.03}"/>
  
  <!-- Inner ring -->
  <circle cx="${center}" cy="${center}" r="${innerRadius}" fill="none" stroke="#e94560" stroke-width="${size * 0.02}" opacity="0.6"/>
  
  <!-- Center dot -->
  <circle cx="${center}" cy="${center}" r="${dotRadius}" fill="#e94560"/>
  
  <!-- Crosshair lines -->
  <line x1="${center}" y1="${center - radius - size * 0.02}" x2="${center}" y2="${center - radius + crosshairLen}" stroke="#e94560" stroke-width="${size * 0.025}" stroke-linecap="round"/>
  <line x1="${center}" y1="${center + radius + size * 0.02}" x2="${center}" y2="${center + radius - crosshairLen}" stroke="#e94560" stroke-width="${size * 0.025}" stroke-linecap="round"/>
  <line x1="${center - radius - size * 0.02}" y1="${center}" x2="${center - radius + crosshairLen}" y2="${center}" stroke="#e94560" stroke-width="${size * 0.025}" stroke-linecap="round"/>
  <line x1="${center + radius + size * 0.02}" y1="${center}" x2="${center + radius - crosshairLen}" y2="${center}" stroke="#e94560" stroke-width="${size * 0.025}" stroke-linecap="round"/>
</svg>`;
}

// Create screenshots
function createScreenshot(width, height, wide = true) {
  const title = wide ? 'Mission Control Dashboard' : 'Mission Control';
  const subtitle = 'Bob Collective Command Center';
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#0f0f1a"/>
  
  <!-- Header bar -->
  <rect y="0" width="${width}" height="${height * 0.1}" fill="#1a1a2e"/>
  
  <!-- Title -->
  <text x="${width * 0.05}" y="${height * 0.065}" font-family="system-ui, sans-serif" font-size="${height * 0.035}" font-weight="bold" fill="#ffffff">🎯 ${title}</text>
  
  <!-- Cards simulation -->
  <rect x="${width * 0.03}" y="${height * 0.15}" width="${width * 0.44}" height="${height * 0.25}" rx="12" fill="#1f1f35" stroke="#2a2a40"/>
  <rect x="${width * 0.53}" y="${height * 0.15}" width="${width * 0.44}" height="${height * 0.25}" rx="12" fill="#1f1f35" stroke="#2a2a40"/>
  <rect x="${width * 0.03}" y="${height * 0.45}" width="${width * 0.94}" height="${height * 0.35}" rx="12" fill="#1f1f35" stroke="#2a2a40"/>
  
  <!-- Accent elements -->
  <circle cx="${width * 0.1}" cy="${height * 0.27}" r="${height * 0.03}" fill="#e94560"/>
  <circle cx="${width * 0.6}" cy="${height * 0.27}" r="${height * 0.03}" fill="#00d26a"/>
  
  <!-- Subtitle -->
  <text x="${width * 0.5}" y="${height * 0.93}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${height * 0.02}" fill="#6c6c7c">${subtitle}</text>
</svg>`;
}

async function generateIcons() {
  // Ensure icons directory exists
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  console.log('Generating PWA icons...\n');

  // Generate regular icons
  for (const size of SIZES) {
    const svgContent = createSvgIcon(size, false);
    const svgPath = path.join(ICONS_DIR, `icon-${size}.svg`);
    fs.writeFileSync(svgPath, svgContent);
    console.log(`✓ Created icon-${size}.svg`);

    if (sharp) {
      const pngPath = path.join(ICONS_DIR, `icon-${size}.png`);
      await sharp(Buffer.from(svgContent))
        .png()
        .toFile(pngPath);
      console.log(`✓ Created icon-${size}.png`);
    }
  }

  // Generate maskable icons (192 and 512)
  for (const size of [192, 512]) {
    const svgContent = createSvgIcon(size, true);
    const svgPath = path.join(ICONS_DIR, `icon-maskable-${size}.svg`);
    fs.writeFileSync(svgPath, svgContent);
    console.log(`✓ Created icon-maskable-${size}.svg`);

    if (sharp) {
      const pngPath = path.join(ICONS_DIR, `icon-maskable-${size}.png`);
      await sharp(Buffer.from(svgContent))
        .png()
        .toFile(pngPath);
      console.log(`✓ Created icon-maskable-${size}.png`);
    }
  }

  // Generate screenshots
  const wideScreenshot = createScreenshot(1280, 720, true);
  fs.writeFileSync(path.join(ICONS_DIR, 'screenshot-wide.svg'), wideScreenshot);
  console.log('✓ Created screenshot-wide.svg');

  const mobileScreenshot = createScreenshot(390, 844, false);
  fs.writeFileSync(path.join(ICONS_DIR, 'screenshot-mobile.svg'), mobileScreenshot);
  console.log('✓ Created screenshot-mobile.svg');

  if (sharp) {
    await sharp(Buffer.from(wideScreenshot))
      .png()
      .toFile(path.join(ICONS_DIR, 'screenshot-wide.png'));
    console.log('✓ Created screenshot-wide.png');

    await sharp(Buffer.from(mobileScreenshot))
      .png()
      .toFile(path.join(ICONS_DIR, 'screenshot-mobile.png'));
    console.log('✓ Created screenshot-mobile.png');
  }

  console.log('\n✅ Icon generation complete!');
  
  if (!sharp) {
    console.log('\n⚠️  Note: PNG generation requires sharp. Install with: npm install sharp');
    console.log('   SVG files are available as fallbacks.');
    console.log('   For browsers, update manifest.json to use .svg files.');
  }
}

generateIcons().catch(console.error);
