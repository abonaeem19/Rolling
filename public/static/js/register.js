/* Register page logic
 * - Client-side basic checks (UX), but server is the source of truth
 * - On submit: POST /api/participants
 */
(function () {
    'use strict';

    const form        = document.getElementById('registerForm');
    const btn         = document.getElementById('submitBtn');
    const messageEl   = document.getElementById('message');
    const fullNameIn  = document.getElementById('full_name');
    const emailIn     = document.getElementById('email');
    const empIn       = document.getElementById('employee_number');

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    function showMessage(text, type) {
        messageEl.textContent = text;
        messageEl.className = 'message ' + (type || 'info');
    }
    function clearMessage() {
        messageEl.className = 'message hidden';
        messageEl.textContent = '';
    }

    function setLoading(on) {
        if (on) {
            btn.classList.add('loading');
            btn.disabled = true;
        } else {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    }

    function markInvalid(input, isInvalid) {
        if (isInvalid) input.classList.add('invalid');
        else input.classList.remove('invalid');
    }

    [fullNameIn, emailIn, empIn].forEach(inp => {
        inp.addEventListener('input', () => markInvalid(inp, false));
    });

    function clientValidate(payload) {
        const errs = [];
        const name = payload.full_name.replace(/\s+/g, ' ').trim();
        const email = payload.email.trim().toLowerCase();
        const emp   = payload.employee_number.trim().replace(/\s+/g, '');

        if (!name) {
            errs.push({ field: fullNameIn, msg: 'الاسم الثلاثي مطلوب.' });
        } else if (name.split(' ').filter(Boolean).length < 3) {
            errs.push({ field: fullNameIn, msg: 'يرجى إدخال الاسم الثلاثي كاملًا.' });
        }
        if (!email) {
            errs.push({ field: emailIn, msg: 'البريد الإلكتروني مطلوب.' });
        } else if (!EMAIL_RE.test(email)) {
            errs.push({ field: emailIn, msg: 'صيغة البريد الإلكتروني غير صحيحة.' });
        }
        if (!emp) {
            errs.push({ field: empIn, msg: 'الرقم الوظيفي مطلوب.' });
        }
        return { errs, normalized: { full_name: name, email, employee_number: emp } };
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearMessage();

        const payload = {
            full_name:       fullNameIn.value,
            email:           emailIn.value,
            employee_number: empIn.value
        };

        const { errs, normalized } = clientValidate(payload);
        if (errs.length) {
            errs.forEach(x => markInvalid(x.field, true));
            showMessage(errs[0].msg, 'error');
            return;
        }

        setLoading(true);
        try {
            const resp = await fetch('/api/participants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(normalized)
            });
            const data = await resp.json().catch(() => ({}));

            if (resp.ok && data.success) {
                showMessage(data.message || 'تم تسجيلك بنجاح وإضافتك إلى السحب.', 'success');
                form.reset();
                [fullNameIn, emailIn, empIn].forEach(i => markInvalid(i, false));
            } else {
                showMessage(data.message || 'تعذر إكمال التسجيل. حاول مرة أخرى.', 'error');
            }
        } catch (err) {
            showMessage('فشل الاتصال بالسيرفر. تحقق من الشبكة وحاول مرة أخرى.', 'error');
        } finally {
            setLoading(false);
        }
    });
})();
