/**
 * Winners API + Draw logic
 *
 * Critical rule from spec (#8, #13):
 * The actual random selection MUST happen on the server inside a transaction,
 * never on the client. The client only requests "draw" and animates accordingly.
 *
 * - GET    /api/winners            -> list all winners (public for display)
 * - POST   /api/draw               -> server-side random draw + persist
 * - DELETE /api/winners/:id        -> admin removes a winner record (resets participant)
 */
const express = require('express');
const crypto  = require('crypto');
const db      = require('../database/db');
const { requireAdminAPI } = require('../middleware/auth');
const { drawLimiter }     = require('../middleware/rateLimit');

const router = express.Router();

// ----- Prepared Statements ----------------------------------
const stmts = {
    listWinners: db.prepare(`
        SELECT w.id, w.participant_id, w.winner_name, w.draw_round, w.created_at,
               p.email, p.employee_number
          FROM winners w
          LEFT JOIN participants p ON p.id = w.participant_id
         ORDER BY w.draw_round DESC, w.id DESC
    `),
    nonWinners: db.prepare(`
        SELECT id, full_name FROM participants
         WHERE is_winner = 0
    `),
    nextRound: db.prepare(`
        SELECT COALESCE(MAX(draw_round), 0) + 1 AS next_round FROM winners
    `),
    insertWinner: db.prepare(`
        INSERT INTO winners (participant_id, winner_name, draw_round)
        VALUES (@participant_id, @winner_name, @draw_round)
    `),
    markWinner: db.prepare(`
        UPDATE participants SET is_winner = 1 WHERE id = ? AND is_winner = 0
    `),
    findWinnerById: db.prepare(`SELECT * FROM winners WHERE id = ?`),
    deleteWinnerById: db.prepare(`DELETE FROM winners WHERE id = ?`),
    resetParticipant: db.prepare(`UPDATE participants SET is_winner = 0 WHERE id = ?`)
};

// Cryptographically secure random integer in [0, max)
function secureRandomInt(max) {
    if (max <= 0) throw new Error('max must be > 0');
    const range = 2 ** 32;
    const limit = range - (range % max);
    let r;
    do {
        r = crypto.randomBytes(4).readUInt32BE(0);
    } while (r >= limit);
    return r % max;
}

// ============================================================
// GET /api/winners
// ============================================================
router.get('/winners', (req, res) => {
    const rows = stmts.listWinners.all();
    res.json({ success: true, winners: rows, count: rows.length });
});

// ============================================================
// POST /api/draw   (executes the server-side draw transaction)
// ============================================================
router.post('/draw', drawLimiter, (req, res) => {
    // Wrap the whole select+insert+update in a single transaction
    // so two simultaneous draws cannot pick the same person.
    const drawTxn = db.transaction(() => {
        const candidates = stmts.nonWinners.all();
        if (candidates.length === 0) {
            return { ok: false, reason: 'no_candidates' };
        }

        const idx = secureRandomInt(candidates.length);
        const chosen = candidates[idx];

        // Mark first; if 0 rows updated -> someone else got there. Abort.
        const upd = stmts.markWinner.run(chosen.id);
        if (upd.changes !== 1) {
            return { ok: false, reason: 'race_condition' };
        }

        const round = stmts.nextRound.get().next_round;
        const ins = stmts.insertWinner.run({
            participant_id: chosen.id,
            winner_name: chosen.full_name,
            draw_round: round
        });

        return {
            ok: true,
            winner: {
                id: ins.lastInsertRowid,
                participant_id: chosen.id,
                winner_name: chosen.full_name,
                draw_round: round
            }
        };
    });

    try {
        const result = drawTxn();

        if (!result.ok) {
            if (result.reason === 'no_candidates') {
                return res.status(409).json({
                    success: false,
                    message: 'تم سحب جميع المشاركين المتاحين.',
                    empty: true
                });
            }
            return res.status(409).json({
                success: false,
                message: 'تعذر تنفيذ السحب، حاول مرة أخرى.'
            });
        }

        return res.json({
            success: true,
            message: `الفائز هو: ${result.winner.winner_name}`,
            winner: result.winner
        });
    } catch (err) {
        console.error('[draw]', err);
        return res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء تنفيذ السحب.'
        });
    }
});

// ============================================================
// DELETE /api/winners/:id   (admin removes from winners log,
//                            resets participant.is_winner = 0)
// ============================================================
router.delete('/winners/:id', requireAdminAPI, (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ success: false, message: 'معرّف غير صحيح.' });
    }

    const winner = stmts.findWinnerById.get(id);
    if (!winner) {
        return res.status(404).json({ success: false, message: 'الفائز غير موجود في السجل.' });
    }

    const txn = db.transaction(() => {
        stmts.deleteWinnerById.run(id);
        if (winner.participant_id) {
            stmts.resetParticipant.run(winner.participant_id);
        }
    });

    try {
        txn();
        return res.json({
            success: true,
            message: 'تم حذف الفائز من السجل وإعادته إلى السحب.'
        });
    } catch (err) {
        console.error('[winners:delete]', err);
        return res.status(500).json({ success: false, message: 'حدث خطأ أثناء الحذف.' });
    }
});

module.exports = router;
