/**
 * Database connection module
 * Uses better-sqlite3 (synchronous, transaction-safe, fast)
 *
 * Supports DB_PATH env var so Railway/Fly volumes can mount anywhere.
 * Falls back to ../data/rolling.db relative to this file.
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Pick DB location: env var wins, otherwise default to ../data/rolling.db
const DB_PATH = process.env.DB_PATH
    ? path.isAbsolute(process.env.DB_PATH)
        ? process.env.DB_PATH
        : path.join(__dirname, '..', process.env.DB_PATH)
    : path.join(__dirname, '..', 'data', 'rolling.db');

// Ensure parent directory exists
const DATA_DIR = path.dirname(DB_PATH);
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Open database (creates file if missing)
const db = new Database(DB_PATH);

// Critical settings
db.pragma('journal_mode = WAL');     // Better concurrency
db.pragma('foreign_keys = ON');      // Enforce FKs
db.pragma('synchronous = NORMAL');   // Reasonable durability for events

// Apply schema
const schemaSQL = fs.readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schemaSQL);

console.log(`[DB] Database ready at ${DB_PATH}`);

module.exports = db;
