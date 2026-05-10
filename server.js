/**
 * Rolling Draw - Main server
 * Express app entry point.
 */
require('dotenv').config();

const path           = require('path');
const express        = require('express');
const session        = require('express-session');
const cookieParser   = require('cookie-parser');
const helmet         = require('helmet');

const { requireAdminPage } = require('./middleware/auth');

const participantsRouter = require('./routes/participants');
const winnersRouter      = require('./routes/winners');
const adminRouter        = require('./routes/admin');

const app  = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

// ---------- Security headers ----------
app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            "default-src": ["'self'"],
            "script-src":  ["'self'", "'unsafe-inline'"],
            "style-src":   ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            "font-src":    ["'self'", "https://fonts.gstatic.com", "data:"],
            "img-src":     ["'self'", "data:"],
            "connect-src": ["'self'"],
        }
    },
    crossOriginEmbedderPolicy: false
}));

// Trust proxy if deployed behind one (so secure cookies + rate-limit see real IP)
app.set('trust proxy', 1);

// ---------- Body & cookies ----------
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));
app.use(cookieParser());

// ---------- Session ----------
app.use(session({
    name: 'connect.sid',
    secret: process.env.SESSION_SECRET || 'change-me',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        httpOnly: true,
        secure: NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 8 // 8 hours
    }
}));

// ---------- API Routes ----------
app.use('/api/participants', participantsRouter);
app.use('/api', winnersRouter);          // /api/winners + /api/draw
app.use('/api/admin', adminRouter);

// ---------- Static assets (CSS / JS) ----------
app.use('/static', express.static(path.join(__dirname, 'public', 'static')));

// ---------- Public Pages ----------
app.get('/', (req, res) => res.redirect('/register'));

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/roulette', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'roulette.html'));
});

// ---------- Admin Pages ----------
app.get('/admin/login', (req, res) => {
    if (req.session && req.session.isAdmin) return res.redirect('/admin');
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin', requireAdminPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ---------- 404 ----------
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'غير موجود.' });
});

// ---------- Global error handler (never leak internals) ----------
app.use((err, req, res, next) => {
    console.error('[unhandled]', err);
    if (res.headersSent) return next(err);
    res.status(500).json({ success: false, message: 'حدث خطأ غير متوقع في السيرفر.' });
});

app.listen(PORT, () => {
    console.log('==============================================');
    console.log('  Rolling Draw server is running');
    console.log(`  Local:    http://localhost:${PORT}`);
    console.log(`  Register: http://localhost:${PORT}/register`);
    console.log(`  Admin:    http://localhost:${PORT}/admin/login`);
    console.log(`  Roulette: http://localhost:${PORT}/roulette`);
    console.log(`  ENV:      ${NODE_ENV}`);
    console.log('==============================================');
});
