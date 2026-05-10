/**
 * Rate limiting middleware
 * Prevents spam on /register and brute-force on admin login
 */
const rateLimit = require('express-rate-limit');

const REGISTER_LIMIT = parseInt(process.env.REGISTER_RATE_LIMIT || '10', 10);

// Limit registrations per IP
const registerLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: REGISTER_LIMIT,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'محاولات كثيرة جدًا. يرجى المحاولة بعد قليل.'
    }
});

// Limit failed login attempts
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: {
        success: false,
        message: 'محاولات تسجيل دخول كثيرة. حاول لاحقًا.'
    }
});

// Limit draw triggers (prevents spam on the public roulette page)
const drawLimiter = rateLimit({
    windowMs: 5 * 1000, // 5 seconds
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'يرجى الانتظار قبل بدء سحب جديد.'
    }
});

module.exports = { registerLimiter, loginLimiter, drawLimiter };
