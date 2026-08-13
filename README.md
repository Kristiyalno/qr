# QR Tools

A fast, offline-capable QR code scanner and generator. No accounts, no ads, no server — everything runs in the browser.

## Features

**Scanner**
- Drag and drop images, click to upload, or paste from clipboard (Ctrl+V)
- Camera capture on mobile
- Batch scanning — drop multiple images at once
- Auto-detects URLs vs plain text, with one-click open or search
- Session history with click-to-copy

**Generator**
- 10 content types: URL, plain text, email, phone, SMS, WiFi, vCard, geo location, calendar event, crypto address
- Custom foreground and background colors (hex, RGB, or visual color picker)
- Corner radius — round the entire image from square to circle
- Module styles: square, rounded, dots
- Text labels on any side (top, bottom, left, right) with custom font size, alignment, offset, and color
- Export as PNG, SVG, WEBP, JPEG, or BMP
- Copy image directly to clipboard

## Setup

Static files — no build step. Just push to a GitHub Pages branch and it works.

```
index.html
style.css
app.js
jsQR.min.js       ← QR decoder (bundled, no CDN)
qrcodegen.js      ← QR encoder (bundled, no CDN)
fonts/            ← Inter + JetBrains Mono (self-hosted)
icons/            ← PWA icons
manifest.json     ← Web app manifest
sw.js             ← Service worker (offline support)
```

## PWA / Add to Home Screen

Works as an installable web app on iOS and Android. In Safari on iPad or iPhone, tap Share → Add to Home Screen. On Android, use Chrome's install prompt. The app works fully offline after the first load.

## Dependencies

- [jsQR](https://github.com/cozmo/jsQR) — QR decoding
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) — QR encoding
- Inter and JetBrains Mono fonts (self-hosted)

All dependencies are bundled. No npm, no CDN, no runtime network requests.
