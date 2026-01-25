#!/bin/bash

# Generate PWA icons from a source image
# Usage: ./generate-icons.sh source-image.png

if [ -z "$1" ]; then
    echo "Usage: ./generate-icons.sh source-image.png"
    echo "Source image should be at least 512x512 pixels"
    exit 1
fi

SOURCE="$1"
PUBLIC_DIR="public"

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "ImageMagick not found. Installing..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install imagemagick
    else
        echo "Please install ImageMagick: https://imagemagick.org/script/download.php"
        exit 1
    fi
fi

echo "Generating icons from $SOURCE..."

# Create public directory if it doesn't exist
mkdir -p "$PUBLIC_DIR"

# Generate PWA icons
convert "$SOURCE" -resize 192x192 "$PUBLIC_DIR/pwa-192x192.png"
convert "$SOURCE" -resize 512x512 "$PUBLIC_DIR/pwa-512x512.png"

# Generate Apple touch icon
convert "$SOURCE" -resize 180x180 "$PUBLIC_DIR/apple-touch-icon.png"

# Generate favicon
convert "$SOURCE" -resize 32x32 "$PUBLIC_DIR/favicon.png"

echo "✅ Icons generated in $PUBLIC_DIR/"
echo "   - pwa-192x192.png"
echo "   - pwa-512x512.png"
echo "   - apple-touch-icon.png"
echo "   - favicon.png"









