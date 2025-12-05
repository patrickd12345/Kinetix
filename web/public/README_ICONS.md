# PWA Icons

## Required Icons

For the PWA to work properly, you need these icons in the `public/` directory:

- `pwa-192x192.png` - 192x192 pixels (Android)
- `pwa-512x512.png` - 512x512 pixels (Android, desktop)
- `apple-touch-icon.png` - 180x180 pixels (iOS)
- `favicon.png` - 32x32 pixels (browser tab)

## Generating Icons

### Option 1: Using the Script

1. Create or find a source image (at least 512x512 pixels)
2. Run the generator script:
   ```bash
   ./generate-icons.sh your-icon.png
   ```

### Option 2: Manual Creation

Use any image editor to create icons at the specified sizes.

### Option 3: Online Tools

- [PWA Asset Generator](https://github.com/onderceylan/pwa-asset-generator)
- [RealFaviconGenerator](https://realfavicongenerator.net/)
- [PWA Builder](https://www.pwabuilder.com/imageGenerator)

## Icon Design Guidelines

- **Square format** - Icons should be square (1:1 aspect ratio)
- **Simple design** - Works well at small sizes
- **High contrast** - Visible on various backgrounds
- **Brand colors** - Use Kinetix cyan (#22d3ee) and dark theme
- **No text** - Avoid text in icons (hard to read at small sizes)

## Temporary Placeholders

Until you create proper icons, the PWA will still work but may show default browser icons. The app functionality is not affected.







