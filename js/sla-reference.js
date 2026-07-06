/**
 * sla-reference.js — SLA Framework Reference Page
 * LMS SLA Issue Tracker
 *
 * Read-only reference page displaying the complete SLA framework
 * with tabbed navigation, glass cards, color-coded tables, timeline
 * visualizations, and expandable detail sections.
 */

const SLAReferencePage = (() => {

    // ── Priority & tier color maps ──────────────────────────────
    const PRIORITY_COLORS = { P1: '#ff4757', P2: '#ffa502', P3: '#3742fa', P4: '#747d8c' };

    const SEVERITY_COLORS = {
        critical: '#ff4757',
        high:     '#ffa502',
        medium:   '#3742fa',
        low:      '#747d8c'
    };

    // Track active tab so we can restore it on re-render
    let _activeTab = 'sla-standards';

    // ── Scoped CSS ──────────────────────────────────────────────
    function _injectStyles() {
        if (document.getElementById('sla-reference-styles')) return;
        const style = document.createElement('style');
        style.id = 'sla-reference-styles';
        style.textContent = `
            /* ── Page header ──────────────────────────────── */
            .sla-ref-header {
                margin-bottom: 28px;
            }
            .sla-ref-header h1 {
                font-size: 1.75rem;
                font-weight: 700;
                color: var(--text-primary);
                margin: 0 0 6px;
            }
            .sla-ref-header p {
                color: var(--text-secondary);
                font-size: 0.9rem;
                margin: 0;
            }

            /* ── Tab navigation ───────────────────────────── */
            .sla-ref-tabs {
                display: flex;
                gap: 4px;
                flex-wrap: wrap;
                margin-bottom: 28px;
                border-bottom: 1px solid var(--border-glass);
                padding-bottom: 0;
            }
            .sla-ref-tab-btn {
                background: transparent;
                border: none;
                color: var(--text-secondary);
                font-family: 'Inter', sans-serif;
                font-size: 0.875rem;
                font-weight: 500;
                padding: 10px 18px;
                cursor: pointer;
                border-bottom: 2px solid transparent;
                transition: all 0.25s ease;
                white-space: nowrap;
            }
            .sla-ref-tab-btn:hover {
                color: var(--text-primary);
                background: var(--bg-card);
            }
            .sla-ref-tab-btn.active {
                color: var(--text-primary);
                border-bottom-color: #3742fa;
                background: rgba(55,66,250,0.08);
            }

            /* ── Tab panels ───────────────────────────────── */
            .sla-ref-panel {
                display: none;
                animation: slaRefFadeIn 0.3s ease;
            }
            .sla-ref-panel.active {
                display: block;
            }
            @keyframes slaRefFadeIn {
                from { opacity: 0; transform: translateY(8px); }
                to   { opacity: 1; transform: translateY(0); }
            }

            /* ── Glass card ───────────────────────────────── */
            .sla-ref-card {
                background: var(--bg-card);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border: 1px solid var(--border-glass);
                border-radius: 14px;
                padding: 24px 28px;
                margin-bottom: 24px;
                transition: border-color 0.25s ease;
            }
            .sla-ref-card:hover {
                border-color: var(--text-secondary);
            }
            .sla-ref-card h2 {
                font-size: 1.15rem;
                font-weight: 600;
                color: var(--text-primary);
                margin: 0 0 18px;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .sla-ref-card h2 .sla-ref-icon {
                font-size: 1.25rem;
            }
            .sla-ref-card h3 {
                font-size: 0.95rem;
                font-weight: 600;
                color: var(--text-primary);
                margin: 18px 0 10px;
            }

            /* ── Info list (icon + text) ──────────────────── */
            .sla-ref-info-list {
                list-style: none;
                padding: 0;
                margin: 0;
            }
            .sla-ref-info-list li {
                display: flex;
                align-items: flex-start;
                gap: 12px;
                padding: 10px 0;
                border-bottom: 1px solid var(--border-glass);
                color: var(--text-primary);
                font-size: 0.875rem;
                line-height: 1.55;
            }
            .sla-ref-info-list li:last-child {
                border-bottom: none;
            }
            .sla-ref-info-list .sla-ref-li-icon {
                font-size: 1.1rem;
                flex-shrink: 0;
                margin-top: 1px;
            }
            .sla-ref-info-list strong {
                color: var(--text-primary);
            }

            /* ── Data tables ──────────────────────────────── */
            .sla-ref-table-wrap {
                overflow-x: auto;
                margin: 0 -4px;
                padding: 0 4px;
            }
            .sla-ref-table {
                width: 100%;
                border-collapse: separate;
                border-spacing: 0;
                font-size: 0.835rem;
            }
            .sla-ref-table thead th {
                background: var(--bg-card);
                color: var(--text-primary);
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                font-size: 0.72rem;
                padding: 12px 14px;
                text-align: left;
                border-bottom: 1px solid var(--border-glass);
                white-space: nowrap;
            }
            .sla-ref-table thead th:first-child {
                border-radius: 8px 0 0 0;
            }
            .sla-ref-table thead th:last-child {
                border-radius: 0 8px 0 0;
            }
            .sla-ref-table tbody td {
                padding: 12px 14px;
                color: var(--text-primary);
                border-bottom: 1px solid var(--border-glass);
                line-height: 1.45;
                vertical-align: top;
            }
            .sla-ref-table tbody tr:last-child td {
                border-bottom: none;
            }
            .sla-ref-table tbody tr:hover td {
                background: var(--bg-card);
            }

            /* Row with colored left border */
            .sla-ref-table tbody tr[data-priority-border] td:first-child {
                border-left: 3px solid var(--row-border-color, #3742fa);
                padding-left: 11px;
            }

            /* ── Priority badge ───────────────────────────── */
            .sla-ref-badge {
                display: inline-block;
                padding: 3px 10px;
                border-radius: 6px;
                font-size: 0.75rem;
                font-weight: 600;
                letter-spacing: 0.3px;
                white-space: nowrap;
            }
            .sla-ref-badge-p1 { background: rgba(255,71,87,0.18); color: #ff4757; }
            .sla-ref-badge-p2 { background: rgba(255,165,2,0.18); color: #ffa502; }
            .sla-ref-badge-p3 { background: rgba(55,66,250,0.18); color: #6c7bff; }
            .sla-ref-badge-p4 { background: rgba(116,125,140,0.18); color: #747d8c; }

            /* ── Severity badges (penalty table) ──────────── */
            .sla-ref-severity-critical { background: rgba(255,71,87,0.15); color: #ff4757; }
            .sla-ref-severity-high     { background: rgba(255,165,2,0.15); color: #ffa502; }
            .sla-ref-severity-medium   { background: rgba(55,66,250,0.15); color: #6c7bff; }
            .sla-ref-severity-low      { background: rgba(116,125,140,0.15); color: #a4b0be; }

            /* ── Priority section divider ─────────────────── */
            .sla-ref-priority-divider {
                display: flex;
                align-items: center;
                gap: 12px;
                margin: 4px 0 0;
                padding: 10px 14px;
                background: var(--bg-card);
            }
            .sla-ref-priority-divider .sla-ref-divider-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                flex-shrink: 0;
            }
            .sla-ref-priority-divider span {
                font-size: 0.78rem;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.6px;
            }

            /* ── Expandable sections ──────────────────────── */
            .sla-ref-expandable {
                border: 1px solid var(--border-glass);
                border-radius: 10px;
                margin-bottom: 10px;
                overflow: hidden;
                transition: border-color 0.2s ease;
            }
            .sla-ref-expandable:hover {
                border-color: var(--text-secondary);
            }
            .sla-ref-expandable-header {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 14px 18px;
                cursor: pointer;
                background: var(--bg-card);
                transition: background 0.2s ease;
                user-select: none;
            }
            .sla-ref-expandable-header:hover {
                background: var(--bg-card);
            }
            .sla-ref-expandable-header .sla-ref-expand-chevron {
                transition: transform 0.25s ease;
                color: var(--text-secondary);
                font-size: 0.75rem;
            }
            .sla-ref-expandable.open .sla-ref-expand-chevron {
                transform: rotate(90deg);
            }
            .sla-ref-expandable-header .sla-ref-expand-title {
                font-size: 0.875rem;
                font-weight: 600;
                color: var(--text-primary);
            }
            .sla-ref-expandable-header .sla-ref-expand-count {
                font-size: 0.72rem;
                color: var(--text-secondary);
                margin-left: auto;
            }
            .sla-ref-expandable-body {
                max-height: 0;
                overflow: hidden;
                transition: max-height 0.35s ease, padding 0.35s ease;
                padding: 0 18px;
            }
            .sla-ref-expandable.open .sla-ref-expandable-body {
                max-height: 2000px;
                padding: 10px 18px 18px;
            }
            .sla-ref-expandable-body ul {
                list-style: none;
                padding: 0;
                margin: 0;
            }
            .sla-ref-expandable-body ul li {
                padding: 8px 0;
                border-bottom: 1px solid var(--border-glass);
                color: var(--text-primary);
                font-size: 0.82rem;
                line-height: 1.5;
                display: flex;
                align-items: flex-start;
                gap: 10px;
            }
            .sla-ref-expandable-body ul li:last-child {
                border-bottom: none;
            }
            .sla-ref-expandable-body ul li::before {
                content: '';
                display: none;
            }
            .sla-ref-expandable-body .sla-ref-bullet {
                width: 5px;
                height: 5px;
                border-radius: 50%;
                flex-shrink: 0;
                margin-top: 7px;
            }

            /* ── Escalation timeline ──────────────────────── */
            .sla-ref-timeline-wrap {
                margin: 16px 0 8px;
            }
            .sla-ref-timeline-label {
                font-size: 0.82rem;
                font-weight: 600;
                color: var(--text-primary);
                margin-bottom: 10px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .sla-ref-timeline-label .sla-ref-badge {
                font-size: 0.7rem;
            }
            .sla-ref-timeline-bar {
                position: relative;
                display: flex;
                align-items: center;
                height: 44px;
                background: var(--bg-card);
                border-radius: 22px;
                padding: 0 8px;
                overflow: hidden;
            }
            .sla-ref-timeline-fill {
                position: absolute;
                left: 0;
                top: 0;
                bottom: 0;
                border-radius: 22px;
                opacity: 0.15;
            }
            .sla-ref-timeline-nodes {
                position: relative;
                display: flex;
                width: 100%;
                justify-content: space-between;
                align-items: center;
                z-index: 1;
            }
            .sla-ref-timeline-node {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 2px;
            }
            .sla-ref-timeline-dot {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                border: 2px solid;
                background: #0a0e27;
            }
            .sla-ref-timeline-time {
                font-size: 0.65rem;
                font-weight: 700;
                color: var(--text-primary);
                white-space: nowrap;
            }
            .sla-ref-timeline-level {
                font-size: 0.62rem;
                color: var(--text-secondary);
                white-space: nowrap;
                max-width: 80px;
                text-align: center;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            /* ── Performance threshold bars ───────────────── */
            .sla-ref-perf-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
                gap: 14px;
            }
            .sla-ref-perf-item {
                background: var(--bg-card);
                border: 1px solid var(--border-glass);
                border-radius: 10px;
                padding: 14px 16px;
                transition: border-color 0.2s ease;
            }
            .sla-ref-perf-item:hover {
                border-color: var(--text-secondary);
            }
            .sla-ref-perf-item-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }
            .sla-ref-perf-item-name {
                font-size: 0.82rem;
                color: var(--text-primary);
                font-weight: 500;
            }
            .sla-ref-perf-item-value {
                font-size: 0.82rem;
                font-weight: 700;
                color: #2ed573;
            }
            .sla-ref-perf-bar-track {
                width: 100%;
                height: 6px;
                background: var(--bg-card);
                border-radius: 3px;
                overflow: hidden;
            }
            .sla-ref-perf-bar-fill {
                height: 100%;
                border-radius: 3px;
                background: linear-gradient(90deg, #2ed573, #3742fa);
                transition: width 0.6s ease;
            }

            /* ── Backup items ─────────────────────────────── */
            .sla-ref-backup-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                gap: 14px;
                margin-bottom: 18px;
            }
            .sla-ref-backup-item {
                background: var(--bg-card);
                border: 1px solid var(--border-glass);
                border-radius: 10px;
                padding: 16px;
                text-align: center;
                transition: border-color 0.2s ease, transform 0.2s ease;
            }
            .sla-ref-backup-item:hover {
                border-color: var(--text-secondary);
                transform: translateY(-2px);
            }
            .sla-ref-backup-item .sla-ref-backup-icon {
                font-size: 1.5rem;
                margin-bottom: 8px;
            }
            .sla-ref-backup-item .sla-ref-backup-label {
                font-size: 0.78rem;
                color: var(--text-primary);
                margin-bottom: 4px;
            }
            .sla-ref-backup-item .sla-ref-backup-value {
                font-size: 0.88rem;
                font-weight: 600;
                color: var(--text-primary);
            }

            /* ── RTO/RPO highlight boxes ──────────────────── */
            .sla-ref-highlight-row {
                display: flex;
                gap: 14px;
                flex-wrap: wrap;
            }
            .sla-ref-highlight-box {
                flex: 1;
                min-width: 140px;
                background: rgba(46,213,115,0.06);
                border: 1px solid rgba(46,213,115,0.15);
                border-radius: 10px;
                padding: 16px;
                text-align: center;
            }
            .sla-ref-highlight-box.warning {
                background: rgba(255,165,2,0.06);
                border-color: rgba(255,165,2,0.15);
            }
            .sla-ref-highlight-box .sla-ref-hl-label {
                font-size: 0.72rem;
                color: var(--text-secondary);
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 4px;
            }
            .sla-ref-highlight-box .sla-ref-hl-value {
                font-size: 1.25rem;
                font-weight: 700;
                color: #2ed573;
            }
            .sla-ref-highlight-box.warning .sla-ref-hl-value {
                color: #ffa502;
            }

            /* ── Maintenance window card accent ───────────── */
            .sla-ref-maint-card {
                border-left: 3px solid #ffa502;
            }

            /* ── Two-column grid for cards ────────────────── */
            .sla-ref-two-col {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
                gap: 20px;
            }

            /* ── Update cycle callout ─────────────────────── */
            .sla-ref-callout {
                display: flex;
                align-items: center;
                gap: 12px;
                background: rgba(55,66,250,0.08);
                border: 1px solid rgba(55,66,250,0.2);
                border-radius: 10px;
                padding: 14px 18px;
                margin-top: 16px;
                font-size: 0.82rem;
                color: var(--text-primary);
            }
            .sla-ref-callout .sla-ref-callout-icon {
                font-size: 1.2rem;
                flex-shrink: 0;
            }
        `;
        document.head.appendChild(style);
    }

    // ── Helper: build a glass card ──────────────────────────────
    function _card(titleHtml, bodyHtml, extraClass = '') {
        return `<div class="sla-ref-card ${extraClass}">${titleHtml ? `<h2>${titleHtml}</h2>` : ''}${bodyHtml}</div>`;
    }

    // ── Helper: priority badge HTML ─────────────────────────────
    function _badge(priority) {
        const cls = `sla-ref-badge sla-ref-badge-${priority.toLowerCase()}`;
        return `<span class="${cls}">${Utils.escapeHTML(Store.SLA_CONFIG[priority]?.label || priority)}</span>`;
    }

    // ── TAB 1: SLA Standards ────────────────────────────────────
    function _renderSLAStandards() {
        // Support windows card
        const supportCard = _card(
            '<span class="sla-ref-icon">🕐</span> Support Windows',
            `<ul class="sla-ref-info-list">
                <li>
                    <span class="sla-ref-li-icon">📅</span>
                    <div><strong>Business Support:</strong> Monday to Saturday, 09:00 AM – 06:00 PM (IST) for P2, P3, and Service Requests</div>
                </li>
                <li>
                    <span class="sla-ref-li-icon">🚨</span>
                    <div><strong>Emergency Track:</strong> P1 Support: 24 × 7 × 365 uninterrupted standby</div>
                </li>
                <li>
                    <span class="sla-ref-li-icon">📊</span>
                    <div><strong>Uptime KPI:</strong> Target System Availability: Minimum 99.5% uptime per calendar month</div>
                </li>
            </ul>`
        );

        // Priority level matrix
        const priorities = [
            { p: 'P1', impact: 'System completely down; core login blocked; live exam failure; active security leak.', response: '15 Minutes', resolution: '2 Hours' },
            { p: 'P2', impact: 'Major feature unavailable; SCORM tracking failure; bulk enrollment broken.', response: '60 Minutes', resolution: '12 Hours' },
            { p: 'P3', impact: 'Cosmetic issue; static text/banner change; UI tweaks; non-blocking request.', response: '2 Hours', resolution: '3-5 Business Days' },
            { p: 'P4', impact: 'General feature enhancements or code refactoring.', response: 'Next Cycle', resolution: 'As per Sprint Plan' }
        ];

        const matrixRows = priorities.map(r => {
            const color = PRIORITY_COLORS[r.p];
            return `<tr data-priority-border style="--row-border-color: ${color}">
                <td>${_badge(r.p)}</td>
                <td>${Utils.escapeHTML(r.impact)}</td>
                <td><strong>${Utils.escapeHTML(r.response)}</strong></td>
                <td><strong>${Utils.escapeHTML(r.resolution)}</strong></td>
            </tr>`;
        }).join('');

        const matrixCard = _card(
            '<span class="sla-ref-icon">📋</span> Priority Level Matrix',
            `<div class="sla-ref-table-wrap">
                <table class="sla-ref-table" id="sla-ref-priority-matrix-table">
                    <thead>
                        <tr>
                            <th>Priority Level</th>
                            <th>System Impact Definition</th>
                            <th>Response Window</th>
                            <th>Resolution Window</th>
                        </tr>
                    </thead>
                    <tbody>${matrixRows}</tbody>
                </table>
            </div>`
        );

        return supportCard + matrixCard;
    }

    // ── TAB 2: Penalties ────────────────────────────────────────
    function _renderPenalties() {
        const rows = [
            { cat: 'Uptime Tier A', cond: 'Uptime < 99.5% but ≥ 99.0%', ded: '2% of Monthly AMC', sev: 'medium' },
            { cat: 'Uptime Tier B', cond: 'Uptime < 99.0% but ≥ 98.0%', ded: '5% of Monthly AMC', sev: 'high' },
            { cat: 'Uptime Tier C', cond: 'Uptime < 98.0%', ded: '10% of Monthly AMC', sev: 'critical' },
            { cat: 'P1 Operational Delay', cond: 'P1 resolved beyond 2-hour window', ded: '10% per incident', sev: 'critical' },
            { cat: 'P2 Operational Delay', cond: 'P2 resolved beyond 12-hour window', ded: '5% per incident', sev: 'high' },
            { cat: 'P3 Operational Delay', cond: 'P3 resolved beyond 5 business days', ded: '2% per incident', sev: 'medium' },
            { cat: 'Critical Security Breach', cond: 'Data loss, leak, or vulnerability exploitation', ded: '50% of Monthly AMC', sev: 'critical' }
        ];

        const tableRows = rows.map(r => {
            const sevColor = SEVERITY_COLORS[r.sev];
            return `<tr data-priority-border style="--row-border-color: ${sevColor}">
                <td><strong>${Utils.escapeHTML(r.cat)}</strong></td>
                <td>${Utils.escapeHTML(r.cond)}</td>
                <td><span class="sla-ref-badge sla-ref-severity-${r.sev}">${Utils.escapeHTML(r.ded)}</span></td>
            </tr>`;
        }).join('');

        return _card(
            '<span class="sla-ref-icon">💰</span> Penalty Deduction Logic',
            `<div class="sla-ref-table-wrap">
                <table class="sla-ref-table" id="sla-ref-penalty-table">
                    <thead>
                        <tr>
                            <th>Breach Category</th>
                            <th>Specific Condition</th>
                            <th>Deduction Applied</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>`
        );
    }

    // ── TAB 3: Task Classification ──────────────────────────────
    function _renderTaskClassification() {
        const tasks = Store.TASK_MATRIX;

        // Group by priority for section dividers
        const grouped = { P1: [], P2: [], P3: [] };
        tasks.forEach(t => {
            if (grouped[t.priority]) grouped[t.priority].push(t);
        });

        // Build table with priority group dividers
        let tableBody = '';
        const priorityLabels = {
            P1: 'Critical (P1) — Immediate Response',
            P2: 'Medium (P2) — Urgent Attention',
            P3: 'Low (P3) — Scheduled Resolution'
        };

        ['P1', 'P2', 'P3'].forEach(p => {
            const color = PRIORITY_COLORS[p];
            // Section divider row
            tableBody += `<tr>
                <td colspan="5" style="padding: 0; border-bottom: none;">
                    <div class="sla-ref-priority-divider">
                        <span class="sla-ref-divider-dot" style="background: ${color};"></span>
                        <span style="color: ${color};">${priorityLabels[p]}</span>
                    </div>
                </td>
            </tr>`;

            grouped[p].forEach(t => {
                tableBody += `<tr data-priority-border style="--row-border-color: ${color}">
                    <td>${Utils.escapeHTML(t.module)}</td>
                    <td>${Utils.escapeHTML(t.issue)}</td>
                    <td>${_badge(t.priority)}</td>
                    <td>${Utils.escapeHTML(t.response)}</td>
                    <td>${Utils.escapeHTML(t.resolution)}</td>
                </tr>`;
            });
        });

        const taskTable = _card(
            '<span class="sla-ref-icon">🗂️</span> Full LMS Logical Task Mapping Matrix',
            `<div class="sla-ref-table-wrap">
                <table class="sla-ref-table" id="sla-ref-task-matrix-table">
                    <thead>
                        <tr>
                            <th>Functional Module</th>
                            <th>System Issue / Operational Task</th>
                            <th>Target Priority</th>
                            <th>Response Target</th>
                            <th>Resolution Target</th>
                        </tr>
                    </thead>
                    <tbody>${tableBody}</tbody>
                </table>
            </div>`
        );

        // Expandable detail sections
        const expandableSections = ['P1', 'P2', 'P3'].map(p => {
            const color = PRIORITY_COLORS[p];
            const label = { P1: 'Critical P1 Tasks', P2: 'Medium P2 Tasks', P3: 'Low P3 Tasks' }[p];
            const items = grouped[p];
            const bullets = items.map(t =>
                `<li>
                    <span class="sla-ref-bullet" style="background: ${color};"></span>
                    <div><strong>${Utils.escapeHTML(t.module)}:</strong> ${Utils.escapeHTML(t.issue)}</div>
                </li>`
            ).join('');

            return `<div class="sla-ref-expandable" id="sla-ref-expand-${p.toLowerCase()}">
                <div class="sla-ref-expandable-header" data-toggle="sla-ref-expand-${p.toLowerCase()}">
                    <span class="sla-ref-expand-chevron">▶</span>
                    ${_badge(p)}
                    <span class="sla-ref-expand-title">${label}</span>
                    <span class="sla-ref-expand-count">${items.length} tasks</span>
                </div>
                <div class="sla-ref-expandable-body">
                    <ul>${bullets}</ul>
                </div>
            </div>`;
        }).join('');

        const detailCard = _card(
            '<span class="sla-ref-icon">📝</span> Detailed Task Descriptions',
            expandableSections
        );

        return taskTable + detailCard;
    }

    // ── TAB 4: Escalation ───────────────────────────────────────
    function _renderEscalation() {
        // SLA Clock Mechanics
        const clockCard = _card(
            '<span class="sla-ref-icon">⏱️</span> SLA Clock Mechanics',
            `<h3>⏵ Timer Starts When</h3>
            <ul class="sla-ref-info-list">
                <li>
                    <span class="sla-ref-li-icon">▶️</span>
                    <div>Issue is <strong>created</strong> and logged in the system with a confirmed priority level.</div>
                </li>
            </ul>
            <h3>⏸️ Timer Pauses When</h3>
            <ul class="sla-ref-info-list">
                <li>
                    <span class="sla-ref-li-icon">🔄</span>
                    <div><strong>Waiting for customer confirmation / UAT approval</strong> — SLA clock pauses until customer responds.</div>
                </li>
                <li>
                    <span class="sla-ref-li-icon">🌐</span>
                    <div><strong>Waiting on external provider (ISP / OEM)</strong> — Dependency outside the support team's control.</div>
                </li>
                <li>
                    <span class="sla-ref-li-icon">🔧</span>
                    <div><strong>Scheduled approved maintenance</strong> — Pre-approved maintenance windows are excluded.</div>
                </li>
                <li>
                    <span class="sla-ref-li-icon">🏛️</span>
                    <div><strong>Government-related network / infrastructure outage</strong> — Force majeure conditions.</div>
                </li>
            </ul>`
        );

        // Escalation timelines — horizontal bar visualizations
        const timelineData = {
            P1: { labels: ['0m', '15m', '30m', '60m', '120m'], color: '#ff4757' },
            P2: { labels: ['0m', '60m', '4h', '8h', '12h'], color: '#ffa502' },
            P3: { labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'], color: '#3742fa' }
        };

        let timelinesHtml = '';
        ['P1', 'P2', 'P3'].forEach(p => {
            const timeline = Store.ESCALATION_TIMELINES[p];
            const td = timelineData[p];

            const nodes = timeline.map((step, i) => `
                <div class="sla-ref-timeline-node">
                    <span class="sla-ref-timeline-time">${td.labels[i]}</span>
                    <span class="sla-ref-timeline-dot" style="border-color: ${td.color};"></span>
                    <span class="sla-ref-timeline-level">L${step.level}: ${Utils.escapeHTML(step.label)}</span>
                </div>
            `).join('');

            timelinesHtml += `
                <div class="sla-ref-timeline-wrap">
                    <div class="sla-ref-timeline-label">
                        ${_badge(p)} Escalation Path
                    </div>
                    <div class="sla-ref-timeline-bar">
                        <div class="sla-ref-timeline-fill" style="width: 100%; background: ${td.color};"></div>
                        <div class="sla-ref-timeline-nodes">${nodes}</div>
                    </div>
                </div>`;
        });

        const timelineCard = _card(
            '<span class="sla-ref-icon">📈</span> Escalation Timelines',
            timelinesHtml + `
            <div class="sla-ref-callout">
                <span class="sla-ref-callout-icon">🔔</span>
                <div><strong>P1 Customer Update Cycle:</strong> Status updates must be communicated to the customer every <strong>30 minutes</strong> until resolution.</div>
            </div>`
        );

        // Emergency contact matrix
        const contactRows = Store.ESCALATION_CONTACTS.map(c => {
            return `<tr>
                <td><span class="sla-ref-badge sla-ref-badge-p${Math.min(c.level, 3)}" style="min-width: 28px; text-align: center;">L${c.level}</span></td>
                <td><strong>${Utils.escapeHTML(c.designation)}</strong></td>
                <td>${c.names.map(n => Utils.escapeHTML(n)).join(', ')}</td>
                <td>${c.emails.map(e => `<a href="mailto:${Utils.escapeHTML(e)}" style="color: #6c7bff; text-decoration: none;">${Utils.escapeHTML(e)}</a>`).join('<br>')}</td>
                <td>${c.phones.map(p => Utils.escapeHTML(p)).join(', ')}</td>
            </tr>`;
        }).join('');

        const contactCard = _card(
            '<span class="sla-ref-icon">📞</span> Emergency Contact Matrix',
            `<div class="sla-ref-table-wrap">
                <table class="sla-ref-table" id="sla-ref-contact-table">
                    <thead>
                        <tr>
                            <th>Level</th>
                            <th>Designation</th>
                            <th>Primary Resource</th>
                            <th>Email Address</th>
                            <th>Mobile Number</th>
                        </tr>
                    </thead>
                    <tbody>${contactRows}</tbody>
                </table>
            </div>`
        );

        return clockCard + timelineCard + contactCard;
    }

    // ── TAB 5: Engineering Baselines ────────────────────────────
    function _renderEngineeringBaselines() {
        // Performance thresholds
        const perfItems = [
            { name: 'Login', threshold: 5, unit: 's', maxBar: 30 },
            { name: 'Dashboard Load', threshold: 10, unit: 's', maxBar: 30 },
            { name: 'SCORM Launch', threshold: 10, unit: 's', maxBar: 30 },
            { name: 'Quiz Submit', threshold: 10, unit: 's', maxBar: 30 },
            { name: 'Certificate Generation', threshold: 10, unit: 's', maxBar: 30 },
            { name: 'Analytics Report', threshold: 30, unit: 's', maxBar: 30 }
        ];

        const perfHtml = perfItems.map(item => {
            const pct = Math.min(100, (item.threshold / item.maxBar) * 100);
            return `<div class="sla-ref-perf-item">
                <div class="sla-ref-perf-item-header">
                    <span class="sla-ref-perf-item-name">${Utils.escapeHTML(item.name)}</span>
                    <span class="sla-ref-perf-item-value">≤ ${item.threshold}${item.unit}</span>
                </div>
                <div class="sla-ref-perf-bar-track">
                    <div class="sla-ref-perf-bar-fill" style="width: ${pct}%;"></div>
                </div>
            </div>`;
        }).join('');

        const perfCard = _card(
            '<span class="sla-ref-icon">⚡</span> Performance Thresholds',
            `<div class="sla-ref-perf-grid">${perfHtml}</div>`
        );

        // Backup & DR Policy
        const backupCard = _card(
            '<span class="sla-ref-icon">💾</span> Backup & DR Policy',
            `<div class="sla-ref-backup-grid">
                <div class="sla-ref-backup-item">
                    <div class="sla-ref-backup-icon">🗄️</div>
                    <div class="sla-ref-backup-label">Database</div>
                    <div class="sla-ref-backup-value">Daily Dumps</div>
                </div>
                <div class="sla-ref-backup-item">
                    <div class="sla-ref-backup-icon">💻</div>
                    <div class="sla-ref-backup-label">Code Repository</div>
                    <div class="sla-ref-backup-value">Weekly Backups</div>
                </div>
                <div class="sla-ref-backup-item">
                    <div class="sla-ref-backup-icon">🖼️</div>
                    <div class="sla-ref-backup-label">Media Assets</div>
                    <div class="sla-ref-backup-value">Weekly Mirroring</div>
                </div>
                <div class="sla-ref-backup-item">
                    <div class="sla-ref-backup-icon">🔐</div>
                    <div class="sla-ref-backup-label">Retention Period</div>
                    <div class="sla-ref-backup-value">30 Days (Encrypted)</div>
                </div>
            </div>
            <div class="sla-ref-highlight-row">
                <div class="sla-ref-highlight-box">
                    <div class="sla-ref-hl-label">Recovery Time Objective</div>
                    <div class="sla-ref-hl-value">4 Hours</div>
                </div>
                <div class="sla-ref-highlight-box warning">
                    <div class="sla-ref-hl-label">Recovery Point Objective</div>
                    <div class="sla-ref-hl-value">30 Minutes</div>
                </div>
            </div>`
        );

        // Service request targets
        const serviceRequests = [
            { type: 'New User Creation', target: '4 Hours' },
            { type: 'Bulk User Import', target: '1 Business Day' },
            { type: 'Standard Course Upload', target: '1 Business Day' },
            { type: 'Course Modification', target: '2 Business Days' },
            { type: 'Certificate Template Mapping', target: '2 Business Days' },
            { type: 'New Custom Report Setup', target: '5 Business Days' }
        ];

        const serviceRows = serviceRequests.map(r =>
            `<tr>
                <td>${Utils.escapeHTML(r.type)}</td>
                <td><strong>${Utils.escapeHTML(r.target)}</strong></td>
            </tr>`
        ).join('');

        const serviceCard = _card(
            '<span class="sla-ref-icon">📑</span> Service Request Targets',
            `<div class="sla-ref-table-wrap">
                <table class="sla-ref-table" id="sla-ref-service-table">
                    <thead>
                        <tr>
                            <th>Request Type</th>
                            <th>Target Duration</th>
                        </tr>
                    </thead>
                    <tbody>${serviceRows}</tbody>
                </table>
            </div>`
        );

        // Maintenance window
        const maintCard = _card(
            '<span class="sla-ref-icon">🔧</span> Scheduled Maintenance Window',
            `<ul class="sla-ref-info-list">
                <li>
                    <span class="sla-ref-li-icon">📅</span>
                    <div><strong>Window:</strong> Every Saturday – Sunday, 01:00 PM – 06:00 PM IST</div>
                </li>
                <li>
                    <span class="sla-ref-li-icon">📢</span>
                    <div><strong>Advance Notice:</strong> 48-hour advance notification required to all stakeholders</div>
                </li>
                <li>
                    <span class="sla-ref-li-icon">✅</span>
                    <div><strong>SLA Exclusion:</strong> Excluded from uptime/downtime penalty metrics</div>
                </li>
            </ul>`,
            'sla-ref-maint-card'
        );

        return perfCard + backupCard + serviceCard + maintCard;
    }

    // ── TAB 6: Support Contacts ─────────────────────────────────
    function _renderSupportContacts() {
        const clientHtml = `
            <div class="sla-ref-table-wrap">
                <table class="sla-ref-table">
                    <thead>
                        <tr>
                            <th>Resource Name</th>
                            <th>Designation / Role</th>
                            <th>Email Address</th>
                            <th>Mobile Number</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Krishankant Yadav</strong></td>
                            <td>LMS Administration</td>
                            <td><a href="mailto:krishankant.yadav@literacyindia.org" style="color: #6c7bff; text-decoration: none;">krishankant.yadav@literacyindia.org</a></td>
                            <td>+91 8743080876</td>
                        </tr>
                        <tr>
                            <td><strong>Sunil Kumar Singh</strong></td>
                            <td>Project Director</td>
                            <td><a href="mailto:sunilkumarsingh@literacyindia.org" style="color: #6c7bff; text-decoration: none;">sunilkumarsingh@literacyindia.org</a></td>
                            <td>+91 9811820027</td>
                        </tr>
                        
                    </tbody>
                </table>
            </div>
        `;

        const backendHtml = `
            <div class="sla-ref-table-wrap">
                <table class="sla-ref-table">
                    <thead>
                        <tr>
                            <th>Resource Name</th>
                            <th>Designation / Role</th>
                            <th>Email Address</th>
                            <th>Mobile Number</th>
                        </tr>
                    </thead>
                    <tbody>
                            <tr>
                            <td><strong>Arif</strong></td>
                            <td>Helpdesk / Resident Engineer</td>
                            <td><a href="mailto:arifansari@reospark.com" style="color: #6c7bff; text-decoration: none;">arifansari@reospark.com</a></td>
                            <td>+91 9871264243</td>
                        </tr>
                        <tr>
                            <td><strong>Pradeep</strong></td>
                            <td>Specialist Engineer</td>
                            <td><a href="mailto:pradeep@reospark.com" style="color: #6c7bff; text-decoration: none;">pradeep@reospark.com</a></td>
                            <td>+91 9386292565</td>
                        </tr>
                        <tr>
                            <td><strong>Harvinder</strong></td>
                            <td>Resident Engineer</td>
                            <td><a href="mailto:harvinder.anan@gmail.com" style="color: #6c7bff; text-decoration: none;">harvinder.anan@gmail.com</a></td>
                            <td>+91 9801298785</td>
                        </tr>
                        <tr>
                            <td><strong>Priyesh Tiwari</strong></td>
                            <td>Project Manager</td>
                            <td><a href="mailto:priyesh.cbtech@gmail.com" style="color: #6c7bff; text-decoration: none;">priyesh.cbtech@gmail.com</a></td>
                            <td>+91 7217766185</td>
                            <tr>
                            <td><strong>OP Meenu</strong></td>
                            <td>Project Manager</td>
                            <td><a href="mailto:opmeenu@gmail.com" style="color: #6c7bff; text-decoration: none;">opmeenu@gmail.com</a></td>
                            <td>+91 9999644218</td>
                        </tr>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;

        const serverHtml = `
            <div class="sla-ref-table-wrap">
                <table class="sla-ref-table">
                    <thead>
                        <tr>
                            <th>Resource Name</th>
                            <th>Designation / Role</th>
                            <th>Email Address</th>
                            <th>Mobile Number</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Devendra Soni</strong></td>
                            <td>Server Guy / Infrastructure</td>
                            <td><a href="mailto:devsoni@hotmail.com" style="color: #6c7bff; text-decoration: none;">devsoni@hotmail.com</a></td>
                            <td>—</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;

        const cardClient = _card('<span class="sla-ref-icon">🏢</span> Client & Administration Team', clientHtml);
        const cardBackend = _card('<span class="sla-ref-icon">💻</span> Backend Development Team', backendHtml);
        const cardServer = _card('<span class="sla-ref-icon">🌐</span> Infrastructure & Server Side Support', serverHtml);

        return cardClient + cardBackend + cardServer;
    }

    // ── Tab definitions ─────────────────────────────────────────
    const TABS = [
        { id: 'sla-standards',        label: 'SLA Standards',         icon: '📐', renderer: _renderSLAStandards },
        { id: 'penalties',            label: 'Penalties',             icon: '💰', renderer: _renderPenalties },
        { id: 'task-classification',  label: 'Task Classification',   icon: '🗂️', renderer: _renderTaskClassification },
        { id: 'escalation',          label: 'Escalation',            icon: '📈', renderer: _renderEscalation },
        { id: 'engineering-baselines', label: 'Engineering Baselines', icon: '⚙️', renderer: _renderEngineeringBaselines },
        { id: 'support-contacts',      label: 'Support Contacts',      icon: '👥', renderer: _renderSupportContacts }
    ];

    // ── Main render ─────────────────────────────────────────────
    function render(container) {
        _injectStyles();

        // Page header
        let html = `
            <div class="sla-ref-header">
                <h1>📘 SLA Framework Reference</h1>
                <p>Complete Service Level Agreement documentation — read-only reference for the LMS Operations team.</p>
            </div>`;

        // Tab buttons
        html += `<div class="sla-ref-tabs" id="sla-ref-tabs-nav">`;
        TABS.forEach(tab => {
            const activeClass = tab.id === _activeTab ? 'active' : '';
            html += `<button class="sla-ref-tab-btn ${activeClass}" data-tab="${tab.id}" id="sla-ref-tab-btn-${tab.id}">
                ${tab.icon} ${tab.label}
            </button>`;
        });
        html += `</div>`;

        // Tab panels
        TABS.forEach(tab => {
            const activeClass = tab.id === _activeTab ? 'active' : '';
            html += `<div class="sla-ref-panel ${activeClass}" id="sla-ref-panel-${tab.id}">
                ${tab.renderer()}
            </div>`;
        });

        container.innerHTML = html;

        // ── Event: tab switching ────────────────────────────────
        const tabNav = container.querySelector('#sla-ref-tabs-nav');
        tabNav.addEventListener('click', (e) => {
            const btn = e.target.closest('.sla-ref-tab-btn');
            if (!btn) return;

            const tabId = btn.dataset.tab;
            _activeTab = tabId;

            // Update button states
            tabNav.querySelectorAll('.sla-ref-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update panel visibility
            container.querySelectorAll('.sla-ref-panel').forEach(p => p.classList.remove('active'));
            const panel = container.querySelector(`#sla-ref-panel-${tabId}`);
            if (panel) panel.classList.add('active');
        });

        // ── Event: expandable sections ──────────────────────────
        container.querySelectorAll('.sla-ref-expandable-header').forEach(header => {
            header.addEventListener('click', () => {
                const parent = header.closest('.sla-ref-expandable');
                if (parent) parent.classList.toggle('open');
            });
        });
    }

    // ── Public API ──────────────────────────────────────────────
    return { render };
})();
