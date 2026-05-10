/* Admin Panel logic */
(function () {
    'use strict';

    // ---------- Elements ----------
    const els = {
        statTotal:   document.getElementById('statTotal'),
        statWinners: document.getElementById('statWinners'),
        statPending: document.getElementById('statPending'),

        searchInput: document.getElementById('searchInput'),
        filterBtns:  Array.from(document.querySelectorAll('.filter')),

        body:        document.getElementById('participantsBody'),

        refreshBtn:        document.getElementById('refreshBtn'),
        exportCsvBtn:      document.getElementById('exportCsvBtn'),
        exportXlsxBtn:     document.getElementById('exportXlsxBtn'),

        winnersList:       document.getElementById('winnersList'),
        refreshWinnersBtn: document.getElementById('refreshWinnersBtn'),

        loadQrBtn:   document.getElementById('loadQrBtn'),
        qrBox:       document.getElementById('qrBox'),
        qrUrl:       document.getElementById('qrUrl'),
        qrDownload:  document.getElementById('qrDownload'),

        logoutBtn:   document.getElementById('logoutBtn'),

        modal:       document.getElementById('editModal'),
        modalClose:  document.getElementById('modalCloseBtn'),
        cancelEdit:  document.getElementById('cancelEditBtn'),
        editForm:    document.getElementById('editForm'),
        editId:      document.getElementById('edit_id'),
        editName:    document.getElementById('edit_full_name'),
        editEmail:   document.getElementById('edit_email'),
        editEmp:     document.getElementById('edit_employee_number'),
        editMsg:     document.getElementById('editMsg'),

        toast:       document.getElementById('toast')
    };

    let currentFilter = 'all';
    let currentSearch = '';
    let searchTimer = null;

    // ---------- Toast ----------
    function showToast(text, type) {
        els.toast.textContent = text;
        els.toast.className = 'toast ' + (type || '');
        clearTimeout(showToast._t);
        showToast._t = setTimeout(() => {
            els.toast.className = 'toast hidden';
        }, 2400);
    }

    // ---------- HTTP helper ----------
    async function api(url, opts) {
        const o = Object.assign({ headers: {} }, opts || {});
        if (o.body && typeof o.body !== 'string') {
            o.body = JSON.stringify(o.body);
            o.headers['Content-Type'] = 'application/json';
        }
        const resp = await fetch(url, o);
        if (resp.status === 401) {
            window.location.href = '/admin/login';
            throw new Error('unauthorized');
        }
        const data = await resp.json().catch(() => ({}));
        return { ok: resp.ok, status: resp.status, data };
    }

    // ---------- Escaping ----------
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ---------- Stats ----------
    async function loadStats() {
        const { ok, data } = await api('/api/participants/count');
        if (ok && data.success) {
            els.statTotal.textContent   = data.total ?? 0;
            els.statWinners.textContent = data.winners ?? 0;
            els.statPending.textContent = data.pending ?? 0;
        }
    }

    // ---------- Participants ----------
    async function loadParticipants() {
        const params = new URLSearchParams();
        if (currentSearch) params.set('search', currentSearch);
        if (currentFilter !== 'all') params.set('filter', currentFilter);
        const url = '/api/participants' + (params.toString() ? '?' + params.toString() : '');
        els.body.innerHTML = '<tr><td colspan="6" class="empty-row">جاري التحميل...</td></tr>';

        const { ok, data } = await api(url);
        if (!ok || !data.success) {
            els.body.innerHTML = '<tr><td colspan="6" class="empty-row">تعذر تحميل البيانات.</td></tr>';
            return;
        }

        const rows = data.participants || [];
        if (rows.length === 0) {
            els.body.innerHTML = '<tr><td colspan="6" class="empty-row">لا توجد نتائج.</td></tr>';
            return;
        }

        els.body.innerHTML = rows.map((p, i) => `
            <tr data-id="${p.id}">
                <td>${i + 1}</td>
                <td>${esc(p.full_name)}</td>
                <td>${esc(p.email)}</td>
                <td>${esc(p.employee_number)}</td>
                <td>${
                    p.is_winner
                        ? '<span class="tag winner">فائز</span>'
                        : '<span class="tag pending">في الانتظار</span>'
                }</td>
                <td>
                    <div class="row-actions">
                        <button class="btn ghost" data-action="edit"   data-id="${p.id}">تعديل</button>
                        <button class="btn danger" data-action="delete" data-id="${p.id}">حذف</button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // ---------- Winners ----------
    async function loadWinners() {
        const { ok, data } = await api('/api/winners');
        if (!ok || !data.success) {
            els.winnersList.innerHTML = '<li class="empty-row">تعذر تحميل سجل الفائزين.</li>';
            return;
        }
        const winners = data.winners || [];
        if (winners.length === 0) {
            els.winnersList.innerHTML = '<li class="empty-row">لا يوجد فائزون بعد.</li>';
            return;
        }
        els.winnersList.innerHTML = winners.map(w => `
            <li>
                <div>
                    <div class="winner-name">${esc(w.winner_name)}</div>
                    <div class="winner-meta">جولة #${w.draw_round} • ${esc(w.created_at || '')}</div>
                </div>
                <button class="win-del" data-action="delete-winner" data-id="${w.id}">حذف</button>
            </li>
        `).join('');
    }

    // ---------- QR ----------
    async function loadQr() {
        els.qrBox.innerHTML = '<div class="qr-placeholder">جاري التحميل...</div>';
        const { ok, data } = await api('/api/admin/qr');
        if (!ok || !data.success) {
            els.qrBox.innerHTML = '<div class="qr-placeholder">تعذر تحميل QR.</div>';
            return;
        }
        els.qrBox.innerHTML = `<img src="${data.dataUrl}" alt="QR Code للتسجيل" />`;
        els.qrUrl.textContent = data.url;
        els.qrDownload.href = data.dataUrl;
        els.qrDownload.classList.remove('hidden');
    }

    // ---------- Edit / Delete ----------
    function openEdit(p) {
        els.editId.value = p.id;
        els.editName.value = p.full_name;
        els.editEmail.value = p.email;
        els.editEmp.value = p.employee_number;
        els.editMsg.className = 'modal-msg hidden';
        els.modal.classList.remove('hidden');
        els.editName.focus();
    }
    function closeEdit() {
        els.modal.classList.add('hidden');
        els.editForm.reset();
    }

    async function deleteParticipant(id) {
        if (!confirm('هل أنت متأكد من حذف هذا المشارك؟ لا يمكن التراجع.')) return;
        const { ok, data } = await api(`/api/participants/${id}`, { method: 'DELETE' });
        if (ok && data.success) {
            showToast(data.message || 'تم الحذف.', 'success');
            await Promise.all([loadParticipants(), loadStats(), loadWinners()]);
        } else {
            showToast(data.message || 'تعذر الحذف.', 'error');
        }
    }

    async function deleteWinner(id) {
        if (!confirm('هل تريد حذف هذا الفائز من السجل وإعادته إلى السحب؟')) return;
        const { ok, data } = await api(`/api/winners/${id}`, { method: 'DELETE' });
        if (ok && data.success) {
            showToast(data.message || 'تم الحذف.', 'success');
            await Promise.all([loadWinners(), loadParticipants(), loadStats()]);
        } else {
            showToast(data.message || 'تعذر الحذف.', 'error');
        }
    }

    // ---------- Event handlers ----------
    els.body.addEventListener('click', async (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const id = parseInt(btn.dataset.id, 10);
        if (!id) return;

        if (btn.dataset.action === 'edit') {
            const row = btn.closest('tr');
            const tds = row.querySelectorAll('td');
            // Use an API call to avoid stale rendering
            const { ok, data } = await api('/api/participants?search=&filter=all');
            if (ok && data.success) {
                const p = (data.participants || []).find(x => x.id === id);
                if (p) openEdit(p);
            }
        } else if (btn.dataset.action === 'delete') {
            await deleteParticipant(id);
        }
    });

    els.winnersList.addEventListener('click', async (e) => {
        const btn = e.target.closest('button[data-action="delete-winner"]');
        if (!btn) return;
        const id = parseInt(btn.dataset.id, 10);
        if (id) await deleteWinner(id);
    });

    els.editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        els.editMsg.className = 'modal-msg hidden';
        const id = parseInt(els.editId.value, 10);
        const payload = {
            full_name:       els.editName.value,
            email:           els.editEmail.value,
            employee_number: els.editEmp.value
        };
        const { ok, data } = await api(`/api/participants/${id}`, {
            method: 'PUT',
            body: payload
        });
        if (ok && data.success) {
            els.editMsg.textContent = data.message || 'تم الحفظ.';
            els.editMsg.className = 'modal-msg success';
            await Promise.all([loadParticipants(), loadStats()]);
            setTimeout(closeEdit, 600);
        } else {
            els.editMsg.textContent = data.message || 'تعذر حفظ التعديلات.';
            els.editMsg.className = 'modal-msg error';
        }
    });

    els.modalClose.addEventListener('click', closeEdit);
    els.cancelEdit.addEventListener('click', closeEdit);
    els.modal.addEventListener('click', (e) => {
        if (e.target === els.modal) closeEdit();
    });

    // Search (debounced)
    els.searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            currentSearch = e.target.value.trim();
            loadParticipants();
        }, 250);
    });

    // Filter tabs
    els.filterBtns.forEach(b => {
        b.addEventListener('click', () => {
            els.filterBtns.forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            currentFilter = b.dataset.filter;
            loadParticipants();
        });
    });

    // Refresh
    els.refreshBtn.addEventListener('click', () => {
        loadParticipants();
        loadStats();
    });
    els.refreshWinnersBtn.addEventListener('click', loadWinners);

    // Export
    els.exportCsvBtn.addEventListener('click', () => {
        window.location.href = '/api/participants/export?format=csv';
    });
    els.exportXlsxBtn.addEventListener('click', () => {
        window.location.href = '/api/participants/export?format=xlsx';
    });

    // QR
    els.loadQrBtn.addEventListener('click', loadQr);

    // Logout
    els.logoutBtn.addEventListener('click', async () => {
        await fetch('/api/admin/logout', { method: 'POST' });
        window.location.href = '/admin/login';
    });

    // Auto-refresh stats every 10s
    setInterval(loadStats, 10000);

    // Initial load
    loadStats();
    loadParticipants();
    loadWinners();
})();
