# QR Tools

---
## Simple QR code decoder for web
---

Browser-based QR scanner and generator. No accounts, no server, works offline.

## Features

**Scanner:** drag and drop, click to upload, paste (Ctrl+V or button), camera on mobile, batch scanning, URL detection, copy/open, session history.

**Generator:** URL, text, email, phone, SMS, WiFi, vCard, geo, calendar, crypto. Custom colors with visual picker, corner radius, module styles (square/round/dots), text labels on any side, export as PNG/SVG/WEBP/JPEG/BMP. On iOS: long-press preview to save to camera roll.

## Setup

Static files, no build step. Push to GitHub Pages and it works.

## PWA

On iOS: Safari > Share > Add to Home Screen. On Android: Chrome install prompt. Works offline after first load.

## Dependencies

- [jsQR](https://github.com/cozmo/jsQR) - QR decoding
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) - QR encoding
- Inter and JetBrains Mono (self-hosted)
