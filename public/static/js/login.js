(function () {
    'use strict';
    const form = document.getElementById('loginForm');
    const btn  = document.getElementById('loginBtn');
    const msg  = document.getElementById('loginMsg');

    function showMsg(text, type) {
        msg.textContent = text;
        msg.className = 'login-msg ' + type;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!username || !password) {
            showMsg('يرجى إدخال اسم المستخدم وكلمة المرور.', 'error');
            return;
        }

        btn.classList.add('loading');
        btn.disabled = true;
        try {
            const resp = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await resp.json().catch(() => ({}));
            if (resp.ok && data.success) {
                showMsg('تم تسجيل الدخول، جاري التحويل...', 'success');
                setTimeout(() => window.location.href = '/admin', 400);
            } else {
                showMsg(data.message || 'بيانات الدخول غير صحيحة.', 'error');
            }
        } catch (err) {
            showMsg('فشل الاتصال بالسيرفر.', 'error');
        } finally {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    });
})();
