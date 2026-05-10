-- ============================================================
-- Rolling Draw - Database Schema
-- ============================================================
-- Tables: participants, winners
-- Constraints: unique(email), unique(employee_number), unique(full_name)
-- Foreign Key: winners.participant_id -> participants.id (ON DELETE CASCADE)
-- ============================================================

-- Enforce foreign keys (must be set per-connection too in better-sqlite3)
PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------
-- Participants Table
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS participants (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    email           TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    employee_number TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    is_winner       INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for faster searching
CREATE INDEX IF NOT EXISTS idx_participants_is_winner    ON participants(is_winner);
CREATE INDEX IF NOT EXISTS idx_participants_full_name    ON participants(full_name);
CREATE INDEX IF NOT EXISTS idx_participants_email        ON participants(email);
CREATE INDEX IF NOT EXISTS idx_participants_employee_num ON participants(employee_number);

-- Trigger to auto-update updated_at on row update
CREATE TRIGGER IF NOT EXISTS trg_participants_updated_at
AFTER UPDATE ON participants
FOR EACH ROW
BEGIN
    UPDATE participants
       SET updated_at = datetime('now')
     WHERE id = NEW.id;
END;

-- ----------------------------------------------------------------
-- Winners Table
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS winners (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id  INTEGER NOT NULL UNIQUE,
    winner_name     TEXT    NOT NULL,
    draw_round      INTEGER NOT NULL,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (participant_id)
        REFERENCES participants(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_winners_participant_id ON winners(participant_id);
CREATE INDEX IF NOT EXISTS idx_winners_draw_round    ON winners(draw_round);
