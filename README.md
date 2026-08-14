# QR Tools

---
## Simple QR code decoder for web
---

Browser-based QR scanner and generator. No accounts, no server, works offline.

## Features

**Scanner:** drag and drop, click to upload, paste (Ctrl+V), camera on mobile, batch scanning, URL detection, copy/open, session history.

**Generator:** URL, text, email, phone, SMS, WiFi, vCard, geo, calendar, crypto. Custom colors, corner radius, module styles (square/round/dots), text labels, export as PNG/SVG/WEBP/JPEG/BMP.

## Setup

Static files, no build step. Push to GitHub Pages and it works.

## PWA

On iOS: Safari > Share > Add to Home Screen. On Android: Chrome install prompt. Works offline after first load.

## Dependencies

- [jsQR](https://github.com/cozmo/jsQR) - QR decoding
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) - QR encoding
- Inter and JetBrains Mono (self-hosted)