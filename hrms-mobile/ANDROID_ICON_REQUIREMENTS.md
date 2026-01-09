# Android Icon & Splash Screen Requirements

## Problem: Stretched Logo

The logo appears stretched in:
- Android system menu (app launcher)
- Splash screen

## Root Cause

Android adaptive icons require **square images (1024x1024px)** with the logo centered in the **safe zone** (inner 66% of the icon).

## Solution

### Option 1: Create Proper Adaptive Icons (Recommended)

1. **Create square versions of your logos:**
   - `adaptive-icon-light.png` - 1024x1024px, logo centered
   - `adaptive-icon-dark.png` - 1024x1024px, logo centered

2. **Safe Zone Guidelines:**
   - The logo should fit within the center 66% of the image
   - Leave padding around edges (about 17% on each side)
   - This ensures the logo isn't cropped on different device shapes

3. **Update app.json:**
   ```json
   "android": {
     "adaptiveIcon": {
       "foregroundImage": "./assets/images/adaptive-icon-light.png",
       "backgroundColor": "#ffffff",
       "monochromeImage": "./assets/images/adaptive-icon-dark.png"
     }
   }
   ```

### Option 2: Use Existing Images with Proper Configuration

If you want to use `light.png` and `dark.png` directly:

1. **Ensure images are square (1024x1024px)**
2. **Center the logo in the image**
3. **Add padding around the logo**

## Splash Screen Fix

The splash screen uses `resizeMode: "contain"` which should prevent stretching, but ensure:

1. **Image aspect ratio matches screen** (or use square images)
2. **Logo is centered in the image**
3. **Background color matches theme**

## Quick Fix Steps

1. **Create square adaptive icons:**
   - Open `light.png` and `dark.png` in image editor
   - Create 1024x1024px canvas
   - Center the logo (leave ~17% padding on all sides)
   - Save as `adaptive-icon-light.png` and `adaptive-icon-dark.png`

2. **Update app.json** (already done - uses light.png and dark.png)

3. **Rebuild the app:**
   ```bash
   npx expo prebuild --clean
   npx expo run:android
   ```

## Image Specifications

### Adaptive Icon (Android)
- **Size:** 1024x1024px (square)
- **Format:** PNG with transparency
- **Safe Zone:** Center 66% (logo should fit here)
- **Padding:** ~17% on all sides

### Splash Screen
- **Size:** 1242x2436px (iPhone) or 1920x1080px (Android)
- **Format:** PNG
- **Resize Mode:** `contain` (prevents stretching)
- **Logo:** Centered with padding

### App Icon (iOS)
- **Size:** 1024x1024px (square)
- **Format:** PNG
- **No transparency needed**

## Testing

After updating images:
1. Clean build: `npx expo prebuild --clean`
2. Rebuild: `npx expo run:android`
3. Check:
   - App icon in launcher (should not be stretched)
   - Splash screen (should not be stretched)
   - Drawer logo (should maintain aspect ratio)

