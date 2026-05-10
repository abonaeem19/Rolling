/**
 * Admin authentication
 * - POST /api/admin/login   -> verify creds, set session
 * - POST /api/admin/logout  -> destroy session
 * - GET  /api/admin/me      -> who am I (session check)
 *
 * Password is hashed with bcrypt at server boot from .env
 */
const express = require('express');
const bcrypt  = require('bcryptjs');
const { loginLimiter } = require('../middleware/rateLimit');
const { requireAdminAPI } = require('../middleware/auth');

const router = express.Router();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Hash the configured password once on boot. bcrypt comparison is
// constant-time, which protects against timing attacks.
const ADMIN_HASH = bcrypt.hashSync(ADMIN_PASSWORD, 10);

// ============================================================
// POST /api/admin/login
// ============================================================
router.post('/login', loginLimiter, (req, res) => {
    const username = (req.body.username || '').toString().trim();
    const password = (req.body.password || '').toString();

    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: 'يرجى إدخال اسم المستخدم وكلمة المرور.'
        });
    }

    const userOk = username === ADMIN_USERNAME;
    const passOk = bcrypt.compareSync(password, ADMIN_HASH);

    // Always run both checks to keep timing roughly constant
    if (!userOk || !passOk) {
        return res.status(401).json({
            success: false,
            message: 'بيانات الدخول غير صحيحة.'
        });
    }

    req.session.regenerate((err) => {
        if (err) {
            console.error('[admin:login:regenerate]', err);
            return res.status(500).json({ success: false, message: 'خطأ في الجلسة.' });
        }
        req.session.isAdmin = true;
        req.session.username = ADMIN_USERNAME;
        return res.json({ success: true, message: 'تم تسجيل الدخول.' });
    });
});

// ============================================================
// POST /api/admin/logout
// ============================================================
router.post('/logout', (req, res) => {
    if (req.session) {
        req.session.destroy(() => {
            res.clearCookie('connect.sid');
            res.json({ success: true, message: 'تم تسجيل الخروج.' });
        });
    } else {
        res.json({ success: true });
    }
});

// ============================================================
// GET /api/admin/me
// ============================================================
router.get('/me', requireAdminAPI, (req, res) => {
    res.json({
        success: true,
        username: req.session.username
    });
});

// ============================================================
// GET /api/admin/qr  -> QR data for the registration URL
// ============================================================
router.get('/qr', requireAdminAPI, async (req, res) => {
    try {
        const QRCode = require('qrcode');
        const url = (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, '') + '/register';
        const dataUrl = await QRCode.toDataURL(url, {
            errorCorrectionLevel: 'H',
            margin: 2,
            width: 600
        });
        res.json({ success: true, url, dataUrl });
    } catch (err) {
        console.error('[admin:qr]', err);
        res.status(500).json({ success: false, message: 'تعذر توليد QR.' });
    }
});

module.exports = router;
