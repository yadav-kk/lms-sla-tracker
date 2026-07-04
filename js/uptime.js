/**
 * uptime.js — Uptime Monitoring Page Module
 * LMS SLA Issue Tracker
 *
 * Renders month-based uptime metrics, downtime log table,
 * penalty calculation details, and add/edit downtime modal.
 */

/* global Store, Utils */

const UptimePage = (() => {

    // ── Styles (injected once) ───────────────────────────────────
    const STYLE_ID = 'uptime-page-styles';
    let _selectedMonth = null;   // current month selector state

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            /* ── Page Header ──────────────────────────────── */
            .uptime-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 24px;
                flex-wrap: wrap;
                gap: 12px;
            }
            .uptime-header-left {
                display: flex;
                align-items: center;
                gap: 14px;
            }
            .uptime-header h1 {
                font-size: 24px;
                font-weight: 700;
                color: var(--text-primary);
                margin: 0;
            }
            .form-select {
                background: var(--bg-card);
                color: var(--text-primary);
                border: 1px solid var(--text-secondary);
                border-radius: 8px;
                padding: 8px 14px;
                font-size: 14px;
                font-family: 'Inter', sans-serif;
                cursor: pointer;
                outline: none;
                transition: border-color 0.2s;
            }
            .form-select:focus {
                border-color: rgba(55,66,250,0.6);
            }
            .form-select option {
                background: #e5e5e6;
                color: var(--text-primary);
            }

            /* ── Uptime Metrics Row ───────────────────────── */
            .uptime-metrics-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 20px;
                margin-bottom: 28px;
            }

            .uptime-metric-card {
                position: relative;
                padding: 24px;
                border-radius: 16px;
                background: var(--bg-card);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border: 1px solid var(--border-glass);
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                transition: transform 0.25s ease, box-shadow 0.25s ease;
            }
            .uptime-metric-card:hover {
                transform: translateY(-3px);
                box-shadow: 0 10px 28px rgba(0,0,0,0.3);
            }

            /* ── Uptime Gauge ─────────────────────────────── */
            .uptime-gauge {
                width: 180px;
                height: 180px;
                border-radius: 50%;
                background: conic-gradient(
                    var(--gauge-color) 0deg calc(var(--gauge-pct) * 3.6deg),
                    rgba(255,255,255,0.05) calc(var(--gauge-pct) * 3.6deg) 360deg
                );
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                margin-bottom: 12px;
            }
            .uptime-gauge-inner {
                width: 140px;
                height: 140px;
                border-radius: 50%;
                background: var(--bg-secondary);
                display: flex;
                align-items: center;
                justify-content: center;
                flex-direction: column;
            }
            .gauge-value {
                font-size: 30px;
                font-weight: 700;
                color: var(--text-primary);
                line-height: 1;
            }
            .gauge-sub {
                font-size: 12px;
                color: var(--text-secondary);
                margin-top: 4px;
            }
            .gauge-target {
                font-size: 12px;
                color: var(--text-secondary);
                margin-top: 4px;
            }

            .uptime-metric-value {
                font-size: 32px;
                font-weight: 700;
                color: var(--text-primary);
                line-height: 1.1;
                margin-bottom: 4px;
            }
            .uptime-metric-label {
                font-size: 13px;
                color: var(--text-secondary);
                text-transform: uppercase;
                letter-spacing: 0.5px;
                font-weight: 500;
                margin-bottom: 6px;
            }
            .tier-badge {
                display: inline-block;
                padding: 4px 12px;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 600;
                margin-top: 6px;
            }

            /* ── Downtime Log Table ───────────────────────── */
            .uptime-table-container {
                border-radius: 16px;
                background: var(--bg-card);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border: 1px solid var(--border-glass);
                overflow: hidden;
                margin-bottom: 28px;
            }
            .uptime-table-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 18px 24px 14px;
            }
            .uptime-table-header h2 {
                font-size: 16px;
                font-weight: 600;
                color: var(--text-primary);
                margin: 0;
            }

            .downtime-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 13px;
            }
            .downtime-table th {
                text-align: left;
                padding: 10px 16px;
                color: var(--text-secondary);
                border-bottom: 1px solid var(--border-glass);
                font-weight: 500;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 0.4px;
            }
            .downtime-table td {
                padding: 12px 16px;
                color: var(--text-primary);
                border-bottom: 1px solid var(--border-glass);
                vertical-align: middle;
            }
            .downtime-table tr:hover td {
                background: var(--bg-card);
            }

            .badge-yes {
                display: inline-block;
                padding: 2px 10px;
                border-radius: 6px;
                font-size: 11px;
                font-weight: 600;
                background: rgba(46,213,115,0.15);
                color: #2ed573;
            }
            .badge-no {
                display: inline-block;
                padding: 2px 10px;
                border-radius: 6px;
                font-size: 11px;
                font-weight: 600;
                background: var(--bg-card);
                color: var(--text-secondary);
            }

            .table-action-btn {
                background: none;
                border: 1px solid var(--text-secondary);
                color: var(--text-primary);
                padding: 4px 10px;
                border-radius: 6px;
                font-size: 12px;
                cursor: pointer;
                transition: background 0.2s, color 0.2s;
                font-family: 'Inter', sans-serif;
                margin-right: 6px;
            }
            .table-action-btn:hover {
                background: var(--bg-card);
                color: var(--text-primary);
            }
            .table-action-btn.danger:hover {
                background: rgba(255,71,87,0.15);
                color: #ff4757;
            }

            /* ── Penalty Details Card ─────────────────────── */
            .penalty-details-card {
                padding: 24px;
                border-radius: 16px;
                background: var(--bg-card);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border: 1px solid var(--border-glass);
                margin-bottom: 28px;
            }
            .penalty-details-card h2 {
                font-size: 16px;
                font-weight: 600;
                color: var(--text-primary);
                margin: 0 0 18px;
            }
            .penalty-detail-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 0;
                border-bottom: 1px solid var(--border-glass);
                font-size: 13px;
            }
            .penalty-detail-row:last-child { border-bottom: none; }
            .penalty-detail-label {
                color: var(--text-secondary);
            }
            .penalty-detail-value {
                color: var(--text-primary);
                font-weight: 600;
            }
            .penalty-formula {
                margin-top: 14px;
                padding: 14px 16px;
                background: var(--bg-card);
                border-radius: 10px;
                font-size: 13px;
                color: var(--text-primary);
                font-family: 'JetBrains Mono', 'Fira Code', monospace;
                line-height: 1.6;
            }
            .penalty-note {
                margin-top: 14px;
                font-size: 12px;
                color: var(--text-secondary);
                font-style: italic;
            }

            /* ── Modal ────────────────────────────────────── */
            .uptime-modal-overlay {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.6);
                backdrop-filter: blur(4px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                opacity: 0;
                transition: opacity 0.25s ease;
            }
            .uptime-modal-overlay.active { opacity: 1; }

            .uptime-modal {
                background: #eaeaea;
                border: 1px solid var(--text-secondary);
                border-radius: 18px;
                width: 520px;
                max-width: 95vw;
                max-height: 90vh;
                overflow-y: auto;
                padding: 28px 30px;
                transform: scale(0.95);
                transition: transform 0.25s ease;
            }
            .uptime-modal-overlay.active .uptime-modal {
                transform: scale(1);
            }
            .uptime-modal h2 {
                font-size: 18px;
                font-weight: 700;
                color: var(--text-primary);
                margin: 0 0 22px;
            }

            .form-group {
                margin-bottom: 16px;
            }
            .form-group label {
                display: block;
                font-size: 12px;
                color: var(--text-secondary);
                margin-bottom: 6px;
                text-transform: uppercase;
                letter-spacing: 0.3px;
                font-weight: 500;
            }
            .form-control {
                width: 100%;
                background: var(--bg-card);
                color: var(--text-primary);
                border: 1px solid var(--text-secondary);
                border-radius: 8px;
                padding: 10px 14px;
                font-size: 14px;
                font-family: 'Inter', sans-serif;
                outline: none;
                transition: border-color 0.2s;
                box-sizing: border-box;
            }
            .form-control:focus {
                border-color: rgba(55,66,250,0.6);
            }
            textarea.form-control {
                resize: vertical;
                min-height: 70px;
            }
            .form-control[readonly] {
                opacity: 0.6;
                cursor: not-allowed;
            }

            .form-check {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 8px 0;
            }
            .form-check input[type="checkbox"] {
                width: 18px;
                height: 18px;
                accent-color: #3742fa;
                cursor: pointer;
            }
            .form-check label {
                font-size: 14px;
                color: var(--text-primary);
                cursor: pointer;
                margin: 0;
                text-transform: none;
                letter-spacing: 0;
            }

            .modal-actions {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
                margin-top: 22px;
            }
            .modal-actions .btn {
                padding: 10px 22px;
                border-radius: 10px;
                font-size: 14px;
                font-weight: 600;
                border: none;
                cursor: pointer;
                font-family: 'Inter', sans-serif;
                transition: transform 0.15s, background 0.2s;
            }
            .modal-actions .btn:hover { transform: translateY(-1px); }
            .modal-actions .btn-primary {
                background: linear-gradient(135deg, #3742fa, #5352ed);
                color: var(--text-primary);
            }
            .modal-actions .btn-cancel {
                background: var(--bg-card);
                color: var(--text-primary);
            }

            /* ── Empty State ──────────────────────────────── */
            .uptime-empty-state {
                text-align: center;
                padding: 40px 16px;
                color: var(--text-secondary);
                font-size: 14px;
            }
            .uptime-empty-state .empty-icon {
                font-size: 40px;
                margin-bottom: 10px;
                display: block;
            }

            /* ── Entrance Animations ──────────────────────── */
            .animate-slide-up {
                opacity: 0;
                transform: translateY(24px);
                animation: uptimeSlideUp 0.5s ease forwards;
            }
            @keyframes uptimeSlideUp {
                to { opacity: 1; transform: translateY(0); }
            }

            /* Primary button (standalone, outside modal) */
            .btn-primary-uptime {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 10px 20px;
                border-radius: 10px;
                font-size: 14px;
                font-weight: 600;
                border: none;
                cursor: pointer;
                background: linear-gradient(135deg, #3742fa, #5352ed);
                color: var(--text-primary);
                font-family: 'Inter', sans-serif;
                transition: transform 0.15s, box-shadow 0.2s;
            }
            .btn-primary-uptime:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(55,66,250,0.35);
            }

            /* ── Responsive ───────────────────────────────── */
            @media (max-width: 900px) {
                .uptime-metrics-grid { grid-template-columns: 1fr; }
            }
        `;
        document.head.appendChild(style);
    }

    // ── Format currency ──────────────────────────────────────────
    function formatCurrency(amount) {
        return '₹' + amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }

    // ── Month selector options ───────────────────────────────────
    function buildMonthOptions(selected) {
        // Show last 12 months + current
        const options = [];
        const now = new Date();
        for (let i = 0; i < 13; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const ym = d.toISOString().slice(0, 7);
            const label = Utils.getMonthName(ym);
            const sel = ym === selected ? 'selected' : '';
            options.push(`<option value="${ym}" ${sel}>${Utils.escapeHTML(label)}</option>`);
        }
        return options.join('');
    }

    // ── Build: Top Metric Cards ──────────────────────────────────
    function buildMetrics(month) {
        const uptime = Store.getMonthlyUptimePercent(month);
        const tier = Store.getUptimePenaltyTier(uptime);

        // Gauge color
        let gaugeColor = '#2ed573';
        if (uptime < 99.0) gaugeColor = '#ff4757';
        else if (uptime < 99.5) gaugeColor = '#ffa502';

        // Gauge percentage (display 0-100 range, scaled for visual effect)
        // We want the gauge to highlight deviation from 100%, so show full pct
        const gaugePct = Math.max(0, Math.min(100, uptime));

        // Total non-maintenance downtime minutes
        const logs = Store.getUptimeLogsByMonth(month);
        const downtimeMin = logs
            .filter(l => !l.isMaintenanceWindow)
            .reduce((sum, l) => sum + (l.durationMinutes || 0), 0);

        // Tier badge
        let tierLabel, tierBg, tierFg;
        if (!tier) {
            tierLabel = 'None'; tierBg = 'rgba(46,213,115,0.15)'; tierFg = '#2ed573';
        } else if (tier.deduction === 2) {
            tierLabel = 'Tier A — 2% deduction'; tierBg = 'rgba(255,165,2,0.15)'; tierFg = '#ffa502';
        } else if (tier.deduction === 5) {
            tierLabel = 'Tier B — 5% deduction'; tierBg = 'rgba(255,165,2,0.2)'; tierFg = '#ffa502';
        } else {
            tierLabel = 'Tier C — 10% deduction'; tierBg = 'rgba(255,71,87,0.15)'; tierFg = '#ff4757';
        }

        return `
        <div class="uptime-metrics-grid">
            <!-- Uptime Gauge -->
            <div class="uptime-metric-card animate-slide-up" style="animation-delay: 0.05s;">
                <div class="uptime-gauge"
                     style="--gauge-color: ${gaugeColor}; --gauge-pct: ${gaugePct};">
                    <div class="uptime-gauge-inner">
                        <span class="gauge-value" style="color: ${gaugeColor}">${uptime.toFixed(2)}%</span>
                        <span class="gauge-sub">Uptime</span>
                    </div>
                </div>
                <span class="gauge-target">Target: 99.5%</span>
            </div>

            <!-- Total Downtime -->
            <div class="uptime-metric-card animate-slide-up" style="animation-delay: 0.12s;">
                <span style="font-size:36px; margin-bottom:10px;">⏱️</span>
                <div class="uptime-metric-value">${Utils.formatDuration(downtimeMin)}</div>
                <div class="uptime-metric-label">Total Downtime</div>
                <span style="font-size:12px; color:var(--text-secondary); margin-top:4px;">(Excl. maintenance)</span>
            </div>

            <!-- Penalty Tier -->
            <div class="uptime-metric-card animate-slide-up" style="animation-delay: 0.19s;">
                <span style="font-size:36px; margin-bottom:10px;">📊</span>
                <div class="uptime-metric-value" style="font-size:22px;">${tier ? tier.label.split('(')[0].trim() : 'No Penalty'}</div>
                <div class="uptime-metric-label">Penalty Tier</div>
                <span class="tier-badge" style="background:${tierBg}; color:${tierFg};">${Utils.escapeHTML(tierLabel)}</span>
            </div>
        </div>`;
    }

    // ── Build: Downtime Log Table ────────────────────────────────
    function buildLogTable(month) {
        const logs = Store.getUptimeLogsByMonth(month)
            .slice()
            .sort((a, b) => new Date(b.date || b.downtimeStart) - new Date(a.date || a.downtimeStart));

        let tableBody;
        if (logs.length === 0) {
            tableBody = `
                <tr>
                    <td colspan="7">
                        <div class="uptime-empty-state">
                            <span class="empty-icon">📭</span>
                            No downtime logged for this month.
                        </div>
                    </td>
                </tr>`;
        } else {
            tableBody = logs.map(log => {
                const duration = Utils.formatDuration(log.durationMinutes);
                const isMaint = log.isMaintenanceWindow;
                return `
                <tr>
                    <td>${Utils.formatDate(log.date)}</td>
                    <td>${Utils.formatDateTime(log.downtimeStart)}</td>
                    <td>${Utils.formatDateTime(log.downtimeEnd)}</td>
                    <td>${Utils.escapeHTML(duration)}</td>
                    <td>${Utils.escapeHTML(log.cause || '—')}</td>
                    <td>${isMaint
                        ? '<span class="badge-yes">Yes</span>'
                        : '<span class="badge-no">No</span>'}</td>
                    <td>
                        <button class="table-action-btn uptime-edit-btn" data-id="${Utils.escapeHTML(log.id)}">✏️ Edit</button>
                        <button class="table-action-btn danger uptime-delete-btn" data-id="${Utils.escapeHTML(log.id)}">🗑️ Delete</button>
                    </td>
                </tr>`;
            }).join('');
        }

        return `
        <div class="uptime-table-container animate-slide-up" style="animation-delay: 0.26s;">
            <div class="uptime-table-header">
                <h2>📋 Downtime Log</h2>
            </div>
            <table class="downtime-table" id="uptime-downtime-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Downtime Start</th>
                        <th>Downtime End</th>
                        <th>Duration</th>
                        <th>Cause</th>
                        <th>Maintenance?</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>${tableBody}</tbody>
            </table>
        </div>`;
    }

    // ── Build: Penalty Details Card ──────────────────────────────
    function buildPenaltyDetails(month) {
        const uptime = Store.getMonthlyUptimePercent(month);
        const tier = Store.getUptimePenaltyTier(uptime);
        const settings = Store.getSettings();
        const amc = settings.amcMonthlyCharge || 0;
        const logs = Store.getUptimeLogsByMonth(month);

        // Total minutes in month
        const [y, m] = month.split('-').map(Number);
        const daysInMonth = new Date(y, m, 0).getDate();
        const totalMinutes = daysInMonth * 24 * 60;

        // Non-maintenance downtime
        const downMin = logs
            .filter(l => !l.isMaintenanceWindow)
            .reduce((sum, l) => sum + (l.durationMinutes || 0), 0);

        const tierLabel = tier ? tier.label : 'None (≥ 99.5%)';
        const deductPct = tier ? tier.deduction + '%' : '0%';
        const penaltyAmt = tier && amc ? (tier.deduction / 100) * amc : 0;

        return `
        <div class="penalty-details-card animate-slide-up" style="animation-delay: 0.32s;">
            <h2>📐 Penalty Calculation Details</h2>

            <div class="penalty-detail-row">
                <span class="penalty-detail-label">Total minutes in month</span>
                <span class="penalty-detail-value">${totalMinutes.toLocaleString()}</span>
            </div>
            <div class="penalty-detail-row">
                <span class="penalty-detail-label">Non-maintenance downtime</span>
                <span class="penalty-detail-value">${downMin.toLocaleString()} min (${Utils.formatDuration(downMin)})</span>
            </div>
            <div class="penalty-detail-row">
                <span class="penalty-detail-label">Uptime %</span>
                <span class="penalty-detail-value">${uptime.toFixed(4)}%</span>
            </div>
            <div class="penalty-detail-row">
                <span class="penalty-detail-label">Applied Tier</span>
                <span class="penalty-detail-value">${Utils.escapeHTML(tierLabel)}</span>
            </div>
            <div class="penalty-detail-row">
                <span class="penalty-detail-label">Deduction %</span>
                <span class="penalty-detail-value">${deductPct}</span>
            </div>
            ${amc ? `
            <div class="penalty-detail-row">
                <span class="penalty-detail-label">Estimated Penalty Amount</span>
                <span class="penalty-detail-value" style="color:#ff4757">${formatCurrency(penaltyAmt)}</span>
            </div>` : ''}

            <div class="penalty-formula">
                Uptime% = (${totalMinutes.toLocaleString()} − ${downMin.toLocaleString()}) / ${totalMinutes.toLocaleString()} × 100 = ${uptime.toFixed(4)}%
            </div>

            <p class="penalty-note">
                ℹ️ Sat–Sun 01:00 PM – 06:00 PM IST maintenance windows are excluded from penalty calculations.
            </p>
            ${!amc ? '<p class="penalty-note">⚠️ Set AMC monthly charge in Settings to see estimated penalty amounts.</p>' : ''}
        </div>`;
    }

    // ── Build: Add/Edit Modal ────────────────────────────────────
    function buildModal(log) {
        const isEdit = !!log;
        const title = isEdit ? 'Edit Downtime Entry' : 'Log Downtime';

        // Pre-fill values for edit mode
        const dateVal   = log ? log.date || '' : '';
        const startVal  = log && log.downtimeStart ? Utils.toLocalInputDateTime(log.downtimeStart) : '';
        const endVal    = log && log.downtimeEnd   ? Utils.toLocalInputDateTime(log.downtimeEnd)   : '';
        const causeVal  = log ? Utils.escapeHTML(log.cause || '') : '';
        const isMaint   = log ? log.isMaintenanceWindow : false;
        const durVal    = log ? Utils.formatDuration(log.durationMinutes) : '—';
        const logId     = log ? log.id : '';

        return `
        <div class="uptime-modal-overlay" id="uptime-modal-overlay">
            <div class="uptime-modal">
                <h2>${title}</h2>
                <form id="uptime-modal-form" data-log-id="${logId}">
                    <div class="form-group">
                        <label for="uptime-modal-date">Date</label>
                        <input type="date" class="form-control" id="uptime-modal-date" value="${dateVal}" required>
                    </div>
                    <div class="form-group">
                        <label for="uptime-modal-start">Downtime Start</label>
                        <input type="datetime-local" class="form-control" id="uptime-modal-start" value="${startVal}" required>
                    </div>
                    <div class="form-group">
                        <label for="uptime-modal-end">Downtime End</label>
                        <input type="datetime-local" class="form-control" id="uptime-modal-end" value="${endVal}" required>
                    </div>
                    <div class="form-group">
                        <label for="uptime-modal-duration">Duration (auto-calculated)</label>
                        <input type="text" class="form-control" id="uptime-modal-duration" value="${durVal}" readonly>
                    </div>
                    <div class="form-group">
                        <label for="uptime-modal-cause">Cause</label>
                        <textarea class="form-control" id="uptime-modal-cause" placeholder="Describe the cause of downtime…">${causeVal}</textarea>
                    </div>
                    <div class="form-check">
                        <input type="checkbox" id="uptime-modal-maintenance" ${isMaint ? 'checked' : ''}>
                        <label for="uptime-modal-maintenance">Is Maintenance Window?</label>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-cancel" id="uptime-modal-cancel">Cancel</button>
                        <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Save'}</button>
                    </div>
                </form>
            </div>
        </div>`;
    }

    // ── Auto-calculate duration when start/end change ────────────
    function autoCalcDuration() {
        const startEl = document.getElementById('uptime-modal-start');
        const endEl   = document.getElementById('uptime-modal-end');
        const durEl   = document.getElementById('uptime-modal-duration');
        if (!startEl || !endEl || !durEl) return;

        const s = startEl.value;
        const e = endEl.value;
        if (s && e) {
            const diffMs = new Date(e) - new Date(s);
            const diffMin = Math.max(0, diffMs / 60000);
            durEl.value = Utils.formatDuration(diffMin);
        } else {
            durEl.value = '—';
        }
    }

    // ── Check if a datetime falls in Sat-Sun 1PM-6PM IST ────────
    function isInMaintenanceWindow(datetimeStr) {
        if (!datetimeStr) return false;
        const d = new Date(datetimeStr);
        // Convert to IST
        const istOffset = 330; // +5:30 in minutes
        const ist = new Date(d.getTime() + istOffset * 60000);
        const day = ist.getUTCDay();  // 0=Sun, 6=Sat
        const hour = ist.getUTCHours();
        // Sat (6) or Sun (0), 13:00-18:00
        return (day === 0 || day === 6) && hour >= 13 && hour < 18;
    }

    // ── Open modal ───────────────────────────────────────────────
    function openModal(container, log) {
        // Remove any existing modal first
        const existing = document.getElementById('uptime-modal-overlay');
        if (existing) existing.remove();

        // Inject the modal into the page
        container.insertAdjacentHTML('beforeend', buildModal(log || null));

        const overlay = document.getElementById('uptime-modal-overlay');
        // Trigger enter animation
        requestAnimationFrame(() => overlay.classList.add('active'));

        // Close handlers
        const closeModal = () => {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 250);
        };

        document.getElementById('uptime-modal-cancel').addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        // Auto-calc duration on start/end change
        const startInput = document.getElementById('uptime-modal-start');
        const endInput   = document.getElementById('uptime-modal-end');
        startInput.addEventListener('change', autoCalcDuration);
        endInput.addEventListener('change', autoCalcDuration);

        // Auto-check maintenance checkbox if falls in window
        const maintCheckbox = document.getElementById('uptime-modal-maintenance');
        const checkMaintenanceAuto = () => {
            if (maintCheckbox && startInput.value) {
                const localIso = Utils.fromLocalInputDateTime(startInput.value);
                if (isInMaintenanceWindow(localIso)) {
                    maintCheckbox.checked = true;
                }
            }
        };
        startInput.addEventListener('change', checkMaintenanceAuto);

        // Form submit
        const form = document.getElementById('uptime-modal-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const logId = form.dataset.logId;
            const dateVal = document.getElementById('uptime-modal-date').value;
            const startVal = startInput.value;
            const endVal = endInput.value;
            const cause = document.getElementById('uptime-modal-cause').value.trim();
            const isMaint = maintCheckbox.checked;

            // Compute duration in minutes
            const diffMs = new Date(endVal) - new Date(startVal);
            const durationMinutes = Math.max(0, Math.round(diffMs / 60000));

            // Derive month from date
            const month = dateVal.slice(0, 7);

            const data = {
                date: dateVal,
                downtimeStart: Utils.fromLocalInputDateTime(startVal),
                downtimeEnd: Utils.fromLocalInputDateTime(endVal),
                durationMinutes,
                cause,
                isMaintenanceWindow: isMaint,
                month
            };

            if (logId) {
                Store.updateUptimeLog(logId, data);
                if (typeof App !== 'undefined' && App.showToast) App.showToast('Downtime entry updated', 'success');
            } else {
                Store.createUptimeLog(data);
                if (typeof App !== 'undefined' && App.showToast) App.showToast('Downtime logged', 'success');
            }

            closeModal();
            // Re-render page with current month
            render(container);
        });
    }

    // ── Event Binding ────────────────────────────────────────────
    function bindEvents(container) {
        // Month selector
        const monthSelect = container.querySelector('#uptime-month-select');
        if (monthSelect) {
            monthSelect.addEventListener('change', () => {
                _selectedMonth = monthSelect.value;
                render(container);
            });
        }

        // Log Downtime button
        const btnLog = container.querySelector('#uptime-btn-log');
        if (btnLog) {
            btnLog.addEventListener('click', () => {
                openModal(container, null);
            });
        }

        // Edit buttons
        container.querySelectorAll('.uptime-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const logId = btn.dataset.id;
                const logs = Store.getUptimeLogs();
                const log = logs.find(l => l.id === logId);
                if (log) openModal(container, log);
            });
        });

        // Delete buttons
        container.querySelectorAll('.uptime-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const logId = btn.dataset.id;
                if (confirm('Are you sure you want to delete this downtime entry?')) {
                    Store.deleteUptimeLog(logId);
                    if (typeof App !== 'undefined' && App.showToast) App.showToast('Entry deleted', 'success');
                    render(container);
                }
            });
        });
    }

    // ── Public render() ──────────────────────────────────────────
    function render(container) {
        injectStyles();

        // Default to current month
        if (!_selectedMonth) {
            _selectedMonth = Utils.getCurrentMonthStr();
        }

        const monthLabel = Utils.getMonthName(_selectedMonth);

        container.innerHTML = `
            <div class="uptime-page">
                <!-- Header -->
                <div class="uptime-header">
                    <div class="uptime-header-left">
                        <h1>Uptime Monitoring</h1>
                        <select class="form-select" id="uptime-month-select">
                            ${buildMonthOptions(_selectedMonth)}
                        </select>
                    </div>
                    <button class="btn-primary-uptime" id="uptime-btn-log">+ Log Downtime</button>
                </div>

                <!-- Top Row: Metrics -->
                ${buildMetrics(_selectedMonth)}

                <!-- Downtime Log Table -->
                ${buildLogTable(_selectedMonth)}

                <!-- Penalty Details -->
                ${buildPenaltyDetails(_selectedMonth)}
            </div>
        `;

        bindEvents(container);
    }

    // ── Expose ───────────────────────────────────────────────────
    return { render };
})();
