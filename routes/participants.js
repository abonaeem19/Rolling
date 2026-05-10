/**
 * Participants API
 * - POST   /api/participants            (public, rate-limited)  -> register new participant
 * - GET    /api/participants            (admin only)            -> list with optional search/filter
 * - GET    /api/participants/count      (admin only)            -> totals
 * - GET    /api/participants/non-winners (public)               -> list for roulette wheel
 * - PUT    /api/participants/:id        (admin only)            -> update
 * - DELETE /api/participants/:id        (admin only)            -> delete
 * - GET    /api/participants/export     (admin only)            -> CSV / XLSX export
 */
const express = require('express');
const XLSX = require('xlsx');
const db = require('../database/db');
const { requireAdminAPI } = require('../middleware/auth');
const { registerLimiter } = require('../middleware/rateLimit');
const { validateParticipant } = require('../utils/validation');

const router = express.Router();

// Prepared statements (better-sqlite3 pattern -> safe from SQL injection)
const stmts = {
    insert: db.prepare(`
        INSERT INTO participants (full_name, email, employee_number)
        VALUES (@full_name, @email, @employee_number)
    `),
    findAll: db.prepare(`
        SELECT id, full_name, email, employee_number, is_winner, created_at, updated_at
          FROM participants
         ORDER BY created_at DESC
    `),
    findNonWinners: db.prepare(`
        SELECT id, full_name
          FROM participants
         WHERE is_winner = 0
         ORDER BY id ASC
    `),
    findById: db.prepare(`SELECT * FROM participants WHERE id = ?`),
    findByDuplicate: db.prepare(`
        SELECT id, full_name, email, employee_number FROM participants
         WHERE full_name = @full_name COLLATE NOCASE
            OR email = @email COLLATE NOCASE
            OR employee_number = @employee_number COLLATE NOCASE
    `),
    findByDuplicateExcept: db.prepare(`
        SELECT id, full_name, email, employee_number FROM participants
         WHERE id != @id
           AND ( full_name = @full_name COLLATE NOCASE
              OR email = @email COLLATE NOCASE
              OR employee_number = @employee_number COLLATE NOCASE )
    `),
    update: db.prepare(`
        UPDATE participants
           SET full_name = @full_name,
               email = @email,
               employee_number = @employee_number
         WHERE id = @id
    `),
    delete: db.prepare(`DELETE FROM participants WHERE id = ?`),
    counts: db.prepare(`
        SELECT
            (SELECT COUNT(*) FROM participants)               AS total,
            (SELECT COUNT(*) FROM participants WHERE is_winner = 1) AS winners,
            (SELECT COUNT(*) FROM participants WHERE is_winner = 0) AS pending
    `)
};

// ============================================================
// POST /api/participants  (Public registration)
// ============================================================
router.post('/', registerLimiter, (req, res) => {
    const validation = validateParticipant(req.body);
    if (!validation.ok) {
        return res.status(400).json({
            success: false,
            message: validation.errors[0],
            errors: validation.errors
        });
    }

    const data = validation.data;

    // Check for duplicates explicitly to give a clean message
    const dup = stmts.findByDuplicate.get(data);
    if (dup) {
        return res.status(409).json({
            success: false,
            message: 'تم تسجيلك مسبقًا في السحب.',
            duplicate: true
        });
    }

    try {
        const result = stmts.insert.run(data);
        return res.status(201).json({
            success: true,
            message: 'تم تسجيلك بنجاح وإضافتك إلى السحب.',
            id: result.lastInsertRowid
        });
    } catch (err) {
        // UNIQUE constraint -> race condition fallback
        if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({
                success: false,
                message: 'تم تسجيلك مسبقًا في السحب.',
                duplicate: true
            });
        }
        console.error('[participants:create]', err);
        return res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء التسجيل. حاول مرة أخرى.'
        });
    }
});

// ============================================================
// GET /api/participants/count  (admin)
// ============================================================
router.get('/count', requireAdminAPI, (req, res) => {
    const c = stmts.counts.get();
    res.json({ success: true, ...c });
});

// ============================================================
// GET /api/participants/non-winners  (public, used by roulette page)
// ============================================================
router.get('/non-winners', (req, res) => {
    const rows = stmts.findNonWinners.all();
    res.json({ success: true, participants: rows, count: rows.length });
});

// ============================================================
// GET /api/participants/export?format=csv|xlsx  (admin)
// ============================================================
router.get('/export', requireAdminAPI, (req, res) => {
    const format = (req.query.format || 'csv').toLowerCase();
    const rows = stmts.findAll.all();

    const data = rows.map(r => ({
        ID: r.id,
        'الاسم الثلاثي': r.full_name,
        'البريد الإلكتروني': r.email,
        'الرقم الوظيفي': r.employee_number,
        'فائز': r.is_winner ? 'نعم' : 'لا',
        'تاريخ التسجيل': r.created_at
    }));

    if (format === 'xlsx') {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Participants');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="participants.xlsx"');
        return res.send(buf);
    }

    // CSV (UTF-8 BOM so Excel renders Arabic correctly)
    const headers = Object.keys(data[0] || { ID: '', 'الاسم الثلاثي': '', 'البريد الإلكتروني': '', 'الرقم الوظيفي': '', 'فائز': '', 'تاريخ التسجيل': '' });
    const csvLines = [headers.join(',')];
    for (const row of data) {
        const line = headers.map(h => {
            const v = row[h] === null || row[h] === undefined ? '' : String(row[h]);
            // Escape: wrap in quotes if contains , " \n; double internal quotes
            if (v.includes(',') || v.includes('"') || v.includes('\n')) {
                return `"${v.replace(/"/g, '""')}"`;
            }
            return v;
        }).join(',');
        csvLines.push(line);
    }
    const csv = '\uFEFF' + csvLines.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="participants.csv"');
    res.send(csv);
});

// ============================================================
// GET /api/participants?search=&filter=all|winners|non-winners  (admin)
// ============================================================
router.get('/', requireAdminAPI, (req, res) => {
    const search = (req.query.search || '').toString().trim();
    const filter = (req.query.filter || 'all').toString();

    const conditions = [];
    const params = {};

    if (search) {
        conditions.push(`(
            full_name LIKE @q COLLATE NOCASE OR
            email LIKE @q COLLATE NOCASE OR
            employee_number LIKE @q COLLATE NOCASE
        )`);
        params.q = `%${search}%`;
    }
    if (filter === 'winners') {
        conditions.push('is_winner = 1');
    } else if (filter === 'non-winners') {
        conditions.push('is_winner = 0');
    }

    let sql = `SELECT id, full_name, email, employee_number, is_winner, created_at, updated_at FROM participants`;
    if (conditions.length) sql += ` WHERE ` + conditions.join(' AND ');
    sql += ` ORDER BY created_at DESC`;

    const rows = db.prepare(sql).all(params);
    res.json({ success: true, participants: rows, count: rows.length });
});

// ============================================================
// PUT /api/participants/:id  (admin)
// ============================================================
router.put('/:id', requireAdminAPI, (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ success: false, message: 'معرّف غير صحيح.' });
    }

    const existing = stmts.findById.get(id);
    if (!existing) {
        return res.status(404).json({ success: false, message: 'المشارك غير موجود.' });
    }

    const validation = validateParticipant(req.body);
    if (!validation.ok) {
        return res.status(400).json({
            success: false,
            message: validation.errors[0],
            errors: validation.errors
        });
    }

    const data = { id, ...validation.data };

    // Block duplicates with OTHER rows
    const dup = stmts.findByDuplicateExcept.get(data);
    if (dup) {
        return res.status(409).json({
            success: false,
            message: 'لا يمكن حفظ هذه التعديلات لأنها مكررة مع مشارك آخر.',
            duplicate: true
        });
    }

    try {
        stmts.update.run(data);
        return res.json({
            success: true,
            message: 'تم تحديث بيانات المشارك بنجاح.'
        });
    } catch (err) {
        if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({
                success: false,
                message: 'لا يمكن حفظ هذه التعديلات لأنها مكررة مع مشارك آخر.'
            });
        }
        console.error('[participants:update]', err);
        return res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء التحديث.'
        });
    }
});

// ============================================================
// DELETE /api/participants/:id  (admin)
// Cascades to winners.participant_id automatically (FK ON DELETE CASCADE)
// ============================================================
router.delete('/:id', requireAdminAPI, (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ success: false, message: 'معرّف غير صحيح.' });
    }

    const existing = stmts.findById.get(id);
    if (!existing) {
        return res.status(404).json({ success: false, message: 'المشارك غير موجود.' });
    }

    try {
        stmts.delete.run(id);
        return res.json({
            success: true,
            message: 'تم حذف المشارك بنجاح.'
        });
    } catch (err) {
        console.error('[participants:delete]', err);
        return res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء الحذف.'
        });
    }
});

module.exports = router;
