/**
 * Roulette page logic
 *
 * KEY RULE (from the spec):
 *   The winner is picked by the SERVER inside a transaction.
 *   The wheel only animates to land on the slice the server chose.
 */
(function () {
    'use strict';

    const canvas = document.getElementById('wheelCanvas');
    const ctx    = canvas.getContext('2d');

    const els = {
        drawBtn:        document.getElementById('drawBtn'),
        statusText:     document.getElementById('statusText'),
        cntPending:     document.getElementById('cntPending'),
        cntWinners:     document.getElementById('cntWinners'),
        recentList:     document.getElementById('recentList'),
        overlay:        document.getElementById('winnerOverlay'),
        winnerName:     document.getElementById('winnerName'),
        closeOverlay:   document.getElementById('closeOverlay'),
        confettiBox:    document.getElementById('confettiBox')
    };

    let participants    = [];   // [{id, full_name}]
    let isDrawing       = false;
    let currentRotation = 0;    // accumulated rotation in degrees

    // Slice colors (alternating)
    const PALETTE = [
        { fill: '#0a1f44', text: '#ffffff' },
        { fill: '#d4a73a', text: '#0a1f44' },
        { fill: '#1a3a7a', text: '#ffffff' },
        { fill: '#f1c14a', text: '#0a1f44' }
    ];

    // ----------------------------------------------------------------
    //  Data loading
    // ----------------------------------------------------------------
    async function loadParticipants() {
        try {
            const resp = await fetch('/api/participants/non-winners');
            const data = await resp.json();
            if (data && data.success) {
                participants = data.participants || [];
            }
        } catch (e) {
            participants = [];
        }
        drawWheel();
        updateStatusForState();
    }

    async function loadCounts() {
        try {
            const resp = await fetch('/api/winners');
            const data = await resp.json();
            if (data && data.success) {
                els.cntWinners.textContent = data.count;
            }
        } catch (e) { /* ignore */ }
        // Pending = current participants list size
        els.cntPending.textContent = participants.length;
    }

    async function loadRecentWinners() {
        try {
            const resp = await fetch('/api/winners');
            const data = await resp.json();
            if (!data || !data.success) return;
            const winners = data.winners || [];
            if (winners.length === 0) {
                els.recentList.innerHTML = '<li class="empty">لا يوجد فائزون بعد.</li>';
                return;
            }
            // Show last 12, latest first
            const top = winners.slice(0, 12);
            els.recentList.innerHTML = top.map(w => `
                <li>${escapeHtml(w.winner_name)} <span class="round-tag">#${w.draw_round}</span></li>
            `).join('');
        } catch (e) { /* ignore */ }
    }

    function updateStatusForState() {
        if (participants.length === 0) {
            els.statusText.textContent = 'لا يوجد مشاركون حتى الآن.';
            els.drawBtn.disabled = true;
        } else {
            els.statusText.textContent = `جاهز للسحب — ${participants.length} مشارك في القائمة.`;
            els.drawBtn.disabled = false;
        }
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // ----------------------------------------------------------------
    //  Wheel drawing
    // ----------------------------------------------------------------
    function drawWheel() {
        const size = canvas.width;
        const cx = size / 2;
        const cy = size / 2;
        const r  = size / 2 - 4;

        ctx.clearRect(0, 0, size, size);

        // Background ring
        ctx.fillStyle = '#0a1f44';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        if (participants.length === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.font = 'bold 22px Tajawal, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('لا يوجد مشاركون', cx, cy);
            return;
        }

        const N = participants.length;
        const sliceRad = (Math.PI * 2) / N;

        // Choose a font size that scales with slice count
        let fontSize = 20;
        if (N > 12)  fontSize = 16;
        if (N > 24)  fontSize = 13;
        if (N > 40)  fontSize = 11;
        if (N > 70)  fontSize = 9;
        if (N > 120) fontSize = 7;

        for (let i = 0; i < N; i++) {
            const startAngle = i * sliceRad;
            const endAngle   = (i + 1) * sliceRad;
            const palette    = PALETTE[i % PALETTE.length];

            // Slice fill
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, r, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = palette.fill;
            ctx.fill();

            // Slice border
            ctx.strokeStyle = 'rgba(255,255,255,0.18)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Slice text (radial)
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(startAngle + sliceRad / 2);
            ctx.fillStyle    = palette.text;
            ctx.font         = `bold ${fontSize}px Tajawal, sans-serif`;
            ctx.textAlign    = 'right';
            ctx.textBaseline = 'middle';

            const name = participants[i].full_name || '—';
            const maxChars = N <= 12 ? 18 : N <= 24 ? 14 : N <= 40 ? 10 : 8;
            const display = name.length > maxChars ? name.slice(0, maxChars - 1) + '…' : name;
            ctx.fillText(display, r - 16, 0);
            ctx.restore();
        }

        // Outer rim ring
        ctx.beginPath();
        ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(241,193,74,0.6)';
        ctx.lineWidth = 4;
        ctx.stroke();
    }

    // ----------------------------------------------------------------
    //  Spin animation
    // ----------------------------------------------------------------
    function spinToIndex(winnerIndex, durationMs) {
        const N = participants.length;
        if (N === 0) return Promise.resolve();

        const sliceDeg = 360 / N;
        // We want slice center at 270° (top, where the pointer is) AFTER rotation
        const targetAtTop = 270 - (winnerIndex * sliceDeg) - (sliceDeg / 2);
        // Normalize to [0, 360)
        const targetMod = ((targetAtTop % 360) + 360) % 360;

        // Build a final rotation that:
        // - Always advances forward (clockwise) so animation feels right
        // - Adds 6 full extra spins for drama
        const extraSpins = 6;
        const currMod    = ((currentRotation % 360) + 360) % 360;
        let delta        = (targetMod - currMod + 360) % 360;
        const finalRotation = currentRotation + extraSpins * 360 + delta;

        canvas.style.transition = `transform ${durationMs}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`;
        // Force layout flush before applying transform so transition triggers
        // eslint-disable-next-line no-unused-expressions
        canvas.offsetHeight;
        canvas.style.transform = `rotate(${finalRotation}deg)`;
        currentRotation = finalRotation;

        return new Promise(resolve => setTimeout(resolve, durationMs + 50));
    }

    // ----------------------------------------------------------------
    //  Draw flow
    // ----------------------------------------------------------------
    async function startDraw() {
        if (isDrawing) return;
        isDrawing = true;
        els.drawBtn.disabled = true;
        els.statusText.classList.remove('error');
        els.statusText.textContent = 'جاري السحب...';

        // Refresh local list right before draw to keep wheel & DB in sync
        await loadParticipants();

        if (participants.length === 0) {
            els.statusText.textContent = 'تم سحب جميع المشاركين المتاحين.';
            isDrawing = false;
            els.drawBtn.disabled = true;
            return;
        }

        // Ask the SERVER for the winner (server-side random + transaction)
        let result;
        try {
            const resp = await fetch('/api/draw', { method: 'POST' });
            result = await resp.json().catch(() => ({}));
            if (!resp.ok || !result.success) {
                if (result && result.empty) {
                    els.statusText.textContent = 'تم سحب جميع المشاركين المتاحين.';
                } else {
                    els.statusText.classList.add('error');
                    els.statusText.textContent = (result && result.message) || 'تعذر تنفيذ السحب.';
                }
                isDrawing = false;
                els.drawBtn.disabled = (participants.length === 0);
                return;
            }
        } catch (e) {
            els.statusText.classList.add('error');
            els.statusText.textContent = 'فشل الاتصال بالسيرفر.';
            isDrawing = false;
            els.drawBtn.disabled = false;
            return;
        }

        const winner = result.winner;

        // Find winner's index in the visible wheel
        let idx = participants.findIndex(p => p.id === winner.participant_id);
        if (idx === -1) {
            // Race: someone registered just now and the server picked them.
            // Append to wheel and redraw, then animate to last slice.
            participants.push({ id: winner.participant_id, full_name: winner.winner_name });
            drawWheel();
            idx = participants.length - 1;
        }

        // Spin
        await spinToIndex(idx, 5500);

        // Reveal
        showWinnerOverlay(winner.winner_name);

        // Refresh state in background
        await Promise.all([loadCounts(), loadRecentWinners()]);
        // Reload wheel without resetting visual rotation (next draw will animate from here)
        const resp2 = await fetch('/api/participants/non-winners');
        const data2 = await resp2.json().catch(() => ({}));
        if (data2 && data2.success) participants = data2.participants || [];
        drawWheel();
        loadCounts();

        isDrawing = false;
        // Re-enable: button stays disabled while overlay open; will re-enable on overlay close
    }

    // ----------------------------------------------------------------
    //  Winner Overlay + Confetti
    // ----------------------------------------------------------------
    function showWinnerOverlay(name) {
        els.winnerName.textContent = name;
        els.overlay.classList.remove('hidden');
        spawnConfetti(80);
    }
    function hideWinnerOverlay() {
        els.overlay.classList.add('hidden');
        els.confettiBox.innerHTML = '';
        // Resume button only if there are still participants
        if (participants.length > 0) {
            els.drawBtn.disabled = false;
            els.statusText.classList.remove('error');
            els.statusText.textContent = `جاهز للسحب — ${participants.length} مشارك في القائمة.`;
        } else {
            els.drawBtn.disabled = true;
            els.statusText.textContent = 'تم سحب جميع المشاركين المتاحين.';
        }
    }

    function spawnConfetti(n) {
        const colors = ['#f1c14a', '#d4a73a', '#ffe28a', '#ffffff', '#1a3a7a'];
        const frag = document.createDocumentFragment();
        for (let i = 0; i < n; i++) {
            const s = document.createElement('span');
            s.style.left = Math.random() * 100 + '%';
            s.style.background = colors[Math.floor(Math.random() * colors.length)];
            s.style.animationDuration = (2.5 + Math.random() * 2.5) + 's';
            s.style.animationDelay = (Math.random() * 0.6) + 's';
            s.style.transform = `rotate(${Math.random() * 360}deg)`;
            s.style.width = (8 + Math.random() * 6) + 'px';
            s.style.height = (12 + Math.random() * 8) + 'px';
            frag.appendChild(s);
        }
        els.confettiBox.appendChild(frag);
    }

    // ----------------------------------------------------------------
    //  Event hooks
    // ----------------------------------------------------------------
    els.drawBtn.addEventListener('click', startDraw);
    els.closeOverlay.addEventListener('click', hideWinnerOverlay);
    els.overlay.addEventListener('click', (e) => {
        if (e.target === els.overlay) hideWinnerOverlay();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !els.overlay.classList.contains('hidden')) {
            hideWinnerOverlay();
        }
        if (e.key === ' ' && !isDrawing && !els.drawBtn.disabled) {
            e.preventDefault();
            startDraw();
        }
    });

    // Auto-refresh when the overlay isn't open and we're idle
    setInterval(() => {
        if (!isDrawing && els.overlay.classList.contains('hidden')) {
            // Light refresh: only update list if changed length
            fetch('/api/participants/non-winners')
                .then(r => r.json())
                .then(d => {
                    if (d && d.success && (d.participants || []).length !== participants.length) {
                        participants = d.participants || [];
                        drawWheel();
                        updateStatusForState();
                        loadCounts();
                    }
                })
                .catch(() => { /* ignore */ });
        }
    }, 8000);

    // Initial load
    (async () => {
        await loadParticipants();
        await loadCounts();
        await loadRecentWinners();
    })();
})();
