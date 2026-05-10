/**
 * Input validation & normalization helpers
 * - Email regex (RFC-ish, practical)
 * - Trim + collapse whitespace for names
 * - Normalize Arabic & English text consistently
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Collapse internal whitespace and trim. Preserves Arabic, English, digits, etc.
 * Example: "  محمد   احمد  علي  " -> "محمد احمد علي"
 */
function normalizeName(s) {
    if (typeof s !== 'string') return '';
    return s.trim().replace(/\s+/g, ' ');
}

function normalizeEmail(s) {
    if (typeof s !== 'string') return '';
    return s.trim().toLowerCase();
}

function normalizeEmployeeNumber(s) {
    if (typeof s !== 'string') return '';
    // Trim + remove inner whitespace; keep digits/letters as-is
    return s.trim().replace(/\s+/g, '');
}

function isValidEmail(email) {
    return EMAIL_RE.test(email) && email.length <= 254;
}

/**
 * Full payload validation for participant creation/update.
 * Returns { ok, errors, data }.
 */
function validateParticipant(payload) {
    const errors = [];

    const full_name       = normalizeName(payload.full_name || '');
    const email           = normalizeEmail(payload.email || '');
    const employee_number = normalizeEmployeeNumber(payload.employee_number || '');

    if (!full_name) {
        errors.push('الاسم الثلاثي مطلوب.');
    } else if (full_name.length < 5 || full_name.length > 100) {
        errors.push('الاسم الثلاثي يجب أن يكون بين 5 و 100 حرف.');
    } else if (full_name.split(' ').filter(Boolean).length < 3) {
        errors.push('يرجى إدخال الاسم الثلاثي كاملًا (3 أجزاء على الأقل).');
    }

    if (!email) {
        errors.push('البريد الإلكتروني مطلوب.');
    } else if (!isValidEmail(email)) {
        errors.push('صيغة البريد الإلكتروني غير صحيحة.');
    }

    if (!employee_number) {
        errors.push('الرقم الوظيفي مطلوب.');
    } else if (employee_number.length < 2 || employee_number.length > 30) {
        errors.push('الرقم الوظيفي يجب أن يكون بين 2 و 30 حرف.');
    }

    return {
        ok: errors.length === 0,
        errors,
        data: { full_name, email, employee_number }
    };
}

module.exports = {
    normalizeName,
    normalizeEmail,
    normalizeEmployeeNumber,
    isValidEmail,
    validateParticipant
};
