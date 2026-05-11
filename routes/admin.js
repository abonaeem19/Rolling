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

// ============================================================
// POST /api/admin/seed  -> insert N random test participants
// Body: { count: number }   (default 200, max 1000)
// ============================================================
router.post('/seed', requireAdminAPI, (req, res) => {
    const db = require('../database/db');
    const { generateParticipants } = require('../utils/seedData');

    const requested = parseInt(req.body && req.body.count, 10);
    const count = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 1000) : 200;

    // Find the next available TEST sequence so repeated seeds don't collide
    const seqRow = db.prepare(`
        SELECT employee_number FROM participants
         WHERE employee_number LIKE 'TEST-%'
         ORDER BY LENGTH(employee_number) DESC, employee_number DESC
         LIMIT 1
    `).get();

    let startNum = 1;
    if (seqRow && seqRow.employee_number) {
        const m = seqRow.employee_number.match(/TEST-(\d+)/);
        if (m) startNum = parseInt(m[1], 10) + 1;
    }

    const rows = generateParticipants(count, startNum);

    const insertOne = db.prepare(`
        INSERT OR IGNORE INTO participants (full_name, email, employee_number)
        VALUES (@full_name, @email, @employee_number)
    `);

    const insertMany = db.transaction((arr) => {
        let inserted = 0;
        for (const r of arr) {
            const info = insertOne.run(r);
            if (info.changes === 1) inserted++;
        }
        return inserted;
    });

    try {
        const inserted = insertMany(rows);
        const skipped = count - inserted;
        return res.json({
            success: true,
            message: `تمت إضافة ${inserted} مشاركًا اختباريًا${skipped > 0 ? ` (تم تخطي ${skipped} مكرر)` : ''}.`,
            inserted,
            skipped,
            requested: count
        });
    } catch (err) {
        console.error('[admin:seed]', err);
        return res.status(500).json({
            success: false,
            message: 'تعذر إضافة بيانات الاختبار.'
        });
    }
});

// ============================================================
// POST /api/admin/clear  -> wipe ALL data (participants + winners)
// Body: { confirm: "DELETE-ALL" }   (must match exactly)
// ============================================================
router.post('/clear', requireAdminAPI, (req, res) => {
    const db = require('../database/db');

    const confirm = (req.body && req.body.confirm) || '';
    if (confirm !== 'DELETE-ALL') {
        return res.status(400).json({
            success: false,
            message: 'تأكيد الحذف غير صحيح.'
        });
    }

    const wipe = db.transaction(() => {
        db.prepare('DELETE FROM winners').run();
        db.prepare('DELETE FROM participants').run();
        // Reset autoincrement counters too
        try {
            db.prepare(`DELETE FROM sqlite_sequence WHERE name IN ('participants','winners')`).run();
        } catch (_) { /* table may not exist if no inserts yet */ }
    });

    try {
        wipe();
        return res.json({
            success: true,
            message: 'تم حذف جميع المشاركين والفائزين.'
        });
    } catch (err) {
        console.error('[admin:clear]', err);
        return res.status(500).json({
            success: false,
            message: 'تعذر حذف البيانات.'
        });
    }
});

// ============================================================
// POST /api/admin/clear-test  -> wipe ONLY test data (TEST-* employee numbers)
// Keeps real participants intact.
// ============================================================
router.post('/clear-test', requireAdminAPI, (req, res) => {
    const db = require('../database/db');

    try {
        const result = db.transaction(() => {
            // First delete winners that reference test participants
            db.prepare(`
                DELETE FROM winners
                 WHERE participant_id IN (
                     SELECT id FROM participants WHERE employee_number LIKE 'TEST-%'
                 )
            `).run();
            const r = db.prepare(`
                DELETE FROM participants WHERE employee_number LIKE 'TEST-%'
            `).run();
            return r.changes;
        })();

        return res.json({
            success: true,
            message: `تم حذف ${result} مشاركًا اختباريًا.`,
            deleted: result
        });
    } catch (err) {
        console.error('[admin:clear-test]', err);
        return res.status(500).json({
            success: false,
            message: 'تعذر حذف بيانات الاختبار.'
        });
    }
});

module.exports = router;
