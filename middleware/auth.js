/**
 * Authentication middleware
 * Protects /api/admin/* routes (except login)
 * Protects /admin HTML page
 */

function requireAdminAPI(req, res, next) {
    if (req.session && req.session.isAdmin === true) {
        return next();
    }
    return res.status(401).json({
        success: false,
        message: 'غير مصرح. يرجى تسجيل الدخول.'
    });
}

function requireAdminPage(req, res, next) {
    if (req.session && req.session.isAdmin === true) {
        return next();
    }
    return res.redirect('/admin/login');
}

module.exports = { requireAdminAPI, requireAdminPage };
