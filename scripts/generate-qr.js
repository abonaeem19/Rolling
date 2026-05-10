/**
 * Generates a print-ready QR Code PNG that points to /register.
 * Run with:  npm run generate-qr
 *
 * Output:
 *   public/qr/register-qr.png        (600px, screen)
 *   public/qr/register-qr-print.png  (1200px, print-ready, 300dpi)
 */
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, '');
const URL = `${PUBLIC_URL}/register`;

const OUT_DIR = path.join(__dirname, '..', 'public', 'qr');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

(async () => {
    try {
        const screenPath = path.join(OUT_DIR, 'register-qr.png');
        const printPath  = path.join(OUT_DIR, 'register-qr-print.png');

        await QRCode.toFile(screenPath, URL, {
            errorCorrectionLevel: 'H',
            type: 'png',
            width: 600,
            margin: 2,
            color: { dark: '#0a1f44', light: '#ffffff' }
        });

        await QRCode.toFile(printPath, URL, {
            errorCorrectionLevel: 'H',
            type: 'png',
            width: 1200,
            margin: 4,
            color: { dark: '#000000', light: '#ffffff' }
        });

        console.log('✅ QR Code generated.');
        console.log('   URL encoded:', URL);
        console.log('   Screen PNG :', screenPath);
        console.log('   Print  PNG :', printPath);
    } catch (err) {
        console.error('❌ Failed to generate QR Code:', err);
        process.exit(1);
    }
})();
