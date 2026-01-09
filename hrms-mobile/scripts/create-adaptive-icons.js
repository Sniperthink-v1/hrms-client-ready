#!/usr/bin/env node

/**
 * Script to create circular adaptive icons from existing logo images
 * Creates 1024x1024px circular icons with logo centered in safe zone
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available, if not, provide instructions
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('❌ Error: sharp package not found.');
  console.log('\n📦 Installing sharp...');
  console.log('Please run: npm install sharp --save-dev');
  console.log('Then run this script again.\n');
  process.exit(1);
}

const ASSETS_DIR = path.join(__dirname, '../assets/images');
const OUTPUT_SIZE = 1024;
const SAFE_ZONE_PERCENT = 0.66; // Logo should fit in 66% of the icon
const PADDING_PERCENT = (1 - SAFE_ZONE_PERCENT) / 2; // ~17% padding on each side

// SVG Logo Path from SniperThinkLogo component
const SVG_LOGO_PATH = "M20.727 7.2647L21.0527 6.79414L20.1116 6.14276L19.7859 6.61332L20.727 7.2647ZM13.158 16.1892L12.8323 16.6598L13.7734 17.3112L14.0991 16.8406L13.158 16.1892ZM6.38192 9.13932H5.80964C5.80964 10.6137 4.63067 11.7971 3.19096 11.7971V12.3693V12.9416C5.27588 12.9416 6.95419 11.2327 6.95419 9.13932H6.38192ZM3.19096 12.3693V11.7971C1.75124 11.7971 0.572274 10.6137 0.572274 9.13932H0H-0.572274C-0.572274 11.2327 1.10604 12.9416 3.19096 12.9416V12.3693ZM0 9.13932H0.572274C0.572274 7.66491 1.75124 6.48158 3.19096 6.48158V5.90931V5.33703C1.10604 5.33703 -0.572274 7.04596 -0.572274 9.13932H0ZM3.19096 5.90931V6.48158C4.63067 6.48158 5.80964 7.66491 5.80964 9.13932H6.38192H6.95419C6.95419 7.04596 5.27588 5.33703 3.19096 5.33703V5.90931ZM14.5266 19.0082H13.9543C13.9543 20.4826 12.7754 21.666 11.3356 21.666V22.2382V22.8105C13.4206 22.8105 15.0989 21.1016 15.0989 19.0082H14.5266ZM11.3356 22.2382V21.666C9.89593 21.666 8.71696 20.4826 8.71696 19.0082H8.14469H7.57241C7.57241 21.1016 9.25073 22.8105 11.3356 22.8105V22.2382ZM8.14469 19.0082H8.71696C8.71696 17.5338 9.89593 16.3505 11.3356 16.3505V15.7782V15.2059C9.25073 15.2059 7.57241 16.9148 7.57241 19.0082H8.14469ZM11.3356 15.7782V16.3505C12.7754 16.3505 13.9543 17.5338 13.9543 19.0082H14.5266H15.0989C15.0989 16.9148 13.4206 15.2059 11.3356 15.2059V15.7782ZM24.8343 3.80228H24.2621C24.2621 5.2767 23.0831 6.46003 21.6434 6.46003V7.0323V7.60457C23.7283 7.60457 25.4066 5.89565 25.4066 3.80228H24.8343ZM21.6434 7.0323V6.46003C20.2037 6.46003 19.0247 5.2767 19.0247 3.80228H18.4524H17.8802C17.8802 5.89565 19.5585 7.60457 21.6434 7.60457V7.0323ZM18.4524 3.80228H19.0247C19.0247 2.32787 20.2037 1.14454 21.6434 1.14454V0.572266V-8.46386e-06C19.5585 -8.46386e-06 17.8802 1.70892 17.8802 3.80228H18.4524ZM21.6434 0.572266V1.14454C23.0831 1.14454 24.2621 2.32787 24.2621 3.80228H24.8343H25.4066C25.4066 1.70892 23.7283 -8.46386e-06 21.6434 -8.46386e-06V0.572266ZM20.2564 6.93901L19.7859 6.61332L13.158 16.1892L13.6285 16.5149L14.0991 16.8406L20.727 7.2647L20.2564 6.93901ZM5.25752 11.3663L4.81925 11.7343L9.27677 17.0432L9.71505 16.6752L10.1533 16.3072L5.6958 10.9983L5.25752 11.3663Z";
const SVG_VIEWBOX = "-1 0 28 23"; // Original viewBox from component
const SVG_ASPECT_RATIO = 23 / 28; // Height / Width ≈ 0.821

// Helper function to create circular mask
async function createCircularMask(size) {
  const radius = size / 2;
  const center = size / 2;
  
  // Create SVG for circular mask
  const svg = `
    <svg width="${size}" height="${size}">
      <circle cx="${center}" cy="${center}" r="${radius}" fill="white"/>
    </svg>
  `;
  
  return Buffer.from(svg);
}

// Helper function to create SVG logo
function createSVGLogo(size, color) {
  // Calculate dimensions maintaining aspect ratio
  const width = size;
  const height = size * SVG_ASPECT_RATIO;
  
  // Center the logo in the safe zone
  const safeZoneSize = size * SAFE_ZONE_PERCENT;
  const logoWidth = safeZoneSize;
  const logoHeight = safeZoneSize * SVG_ASPECT_RATIO;
  
  // Calculate position to center
  const x = (size - logoWidth) / 2;
  const y = (size - logoHeight) / 2;
  
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(${x}, ${y}) scale(${logoWidth / 28})">
        <path d="${SVG_LOGO_PATH}" fill="${color}" transform="translate(1, 0)"/>
      </g>
    </svg>
  `;
  
  return Buffer.from(svg);
}

async function createAdaptiveIcon(outputPath, backgroundColor, logoColor, isCircular = true) {
  try {
    // Create SVG logo
    const logoSVG = createSVGLogo(OUTPUT_SIZE, logoColor);
    
    // Convert SVG to PNG buffer
    const logoPNG = await sharp(logoSVG)
      .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();

    // Create square canvas with background color
    let canvas = sharp({
      create: {
        width: OUTPUT_SIZE,
        height: OUTPUT_SIZE,
        channels: 4,
        background: backgroundColor
      }
    });

    // Composite logo onto canvas (centered)
    canvas = canvas.composite([
      {
        input: logoPNG,
        left: 0,
        top: 0,
        blend: 'over'
      }
    ]);

    // Apply circular mask if requested
    if (isCircular) {
      const mask = await createCircularMask(OUTPUT_SIZE);
      canvas = canvas
        .composite([
          {
            input: mask,
            blend: 'dest-in'
          }
        ]);
    }

    // Save as PNG
    await canvas.png().toFile(outputPath);

    const shape = isCircular ? 'circular' : 'square';
    const safeZoneSize = Math.floor(OUTPUT_SIZE * SAFE_ZONE_PERCENT);
    console.log(`✅ Created: ${path.basename(outputPath)} (${OUTPUT_SIZE}x${OUTPUT_SIZE}px, ${shape})`);
    console.log(`   Logo: SVG centered in safe zone (${safeZoneSize}px)`);
    console.log(`   Colors: Background ${backgroundColor}, Logo ${logoColor}`);
    return true;
  } catch (error) {
    console.error(`❌ Error creating ${outputPath}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🎨 Creating Android Adaptive Icons with SVG Logo...\n');

  const lightOutput = path.join(ASSETS_DIR, 'adaptive-icon-light.png');
  const darkOutput = path.join(ASSETS_DIR, 'adaptive-icon-dark.png');

  // Create light adaptive icon (white background, teal logo)
  console.log('📱 Creating light adaptive icon (circular, white bg, teal logo)...');
  const lightSuccess = await createAdaptiveIcon(lightOutput, '#ffffff', '#0B5E59', true);

  // Create dark adaptive icon (teal background, white logo)
  console.log('\n📱 Creating dark adaptive icon (circular, teal bg, white logo)...');
  const darkSuccess = await createAdaptiveIcon(darkOutput, '#0B5E59', '#ffffff', true);

  if (lightSuccess && darkSuccess) {
    console.log('\n✨ Success! Adaptive icons created:');
    console.log(`   - ${path.basename(lightOutput)}`);
    console.log(`   - ${path.basename(darkOutput)}`);
    console.log('\n📝 Next steps:');
    console.log('   1. Update app.json to use adaptive-icon-light.png and adaptive-icon-dark.png');
    console.log('   2. Run: npx expo prebuild --clean');
    console.log('   3. Run: npx expo run:android');
  } else {
    console.log('\n⚠️  Some icons failed to create. Please check the errors above.');
    process.exit(1);
  }
}

main().catch(console.error);

