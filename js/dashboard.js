/**
 * dashboard.js — Dashboard Page Module
 * LMS SLA Issue Tracker
 *
 * Renders a visually rich overview: metric cards, priority bar chart,
 * SLA compliance ring, penalty breakdown, recent activity, and quick actions.
 */

/* global Store, Utils */

const DashboardPage = (() => {

    // ── Styles (injected once) ───────────────────────────────────
    const STYLE_ID = 'dashboard-page-styles';

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            /* ── Metrics Grid ─────────────────────────────── */
            .metrics-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 20px;
                margin-bottom: 28px;
            }

            .metric-card {
                position: relative;
                padding: 24px 22px 20px;
                border-radius: 16px;
                background: var(--bg-card);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border: 1px solid var(--border-glass);
                overflow: hidden;
                transition: transform 0.25s ease, box-shadow 0.25s ease;
            }
            .metric-card:hover {
                transform: translateY(-4px);
                box-shadow: 0 12px 32px rgba(0,0,0,0.35);
            }

            /* Colored accent bar at top */
            .metric-card::before {
                content: '';
                position: absolute;
                top: 0; left: 0; right: 0;
                height: 4px;
                background: var(--accent);
                border-radius: 16px 16px 0 0;
            }

            .metric-icon {
                font-size: 28px;
                margin-bottom: 8px;
                display: block;
            }
            .metric-value {
                font-size: 36px;
                font-weight: 700;
                color: var(--text-primary);
                line-height: 1.1;
            }
            .metric-label {
                font-size: 13px;
                color: var(--text-secondary);
                margin-top: 6px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                font-weight: 500;
            }
            .metric-sub {
                margin-top: 10px;
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
            }
            .metric-badge {
                font-size: 11px;
                padding: 2px 8px;
                border-radius: 8px;
                font-weight: 600;
                color: var(--text-primary);
            }
            .metric-tier-label {
                font-size: 12px;
                margin-top: 8px;
                padding: 3px 10px;
                border-radius: 8px;
                display: inline-block;
                font-weight: 600;
                background: var(--bg-card);
            }

            /* ── Two-column rows ──────────────────────────── */
            .dashboard-row {
                display: grid;
                gap: 20px;
                margin-bottom: 28px;
            }
            .dashboard-row.two-col-60-40 { grid-template-columns: 3fr 2fr; }
            .dashboard-row.two-col-50-50 { grid-template-columns: 1fr 1fr; }
            .dashboard-row.full-width    { grid-template-columns: 1fr; }

            /* ── Glass Card (reusable) ────────────────────── */
            .glass-card {
                padding: 24px;
                border-radius: 16px;
                background: var(--bg-card);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border: 1px solid var(--border-glass);
            }
            .card-title {
                font-size: 16px;
                font-weight: 600;
                color: var(--text-primary);
                margin-bottom: 18px;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            /* ── Bar Chart ────────────────────────────────── */
            .bar-chart { display: flex; flex-direction: column; gap: 14px; }

            .bar-row {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .bar-label {
                width: 32px;
                font-size: 13px;
                font-weight: 700;
                color: var(--text-primary);
                text-align: right;
                flex-shrink: 0;
            }
            .bar-track {
                flex: 1;
                height: 28px;
                background: var(--bg-card);
                border-radius: 8px;
                overflow: hidden;
                position: relative;
            }
            .bar-fill {
                height: 100%;
                border-radius: 8px;
                min-width: 2px;
                transition: width 0.8s cubic-bezier(0.22, 1, 0.36, 1);
            }
            .bar-value {
                font-size: 13px;
                font-weight: 600;
                width: 28px;
                text-align: left;
                color: var(--text-primary);
                flex-shrink: 0;
            }

            /* ── SLA Compliance Ring ──────────────────────── */
            .compliance-ring-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 20px;
            }
            .compliance-ring {
                width: 180px;
                height: 180px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
            }
            .compliance-ring-inner {
                width: 130px;
                height: 130px;
                border-radius: 50%;
                background: var(--bg-secondary);
                display: flex;
                align-items: center;
                justify-content: center;
                flex-direction: column;
            }
            .compliance-pct {
                font-size: 32px;
                font-weight: 700;
                color: var(--text-primary);
                line-height: 1;
            }
            .compliance-pct-label {
                font-size: 11px;
                color: var(--text-secondary);
                margin-top: 4px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .compliance-legend {
                display: flex;
                gap: 18px;
                flex-wrap: wrap;
                justify-content: center;
            }
            .compliance-legend-item {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 13px;
                color: var(--text-primary);
            }
            .legend-dot {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                flex-shrink: 0;
            }

            /* ── Penalty Table ────────────────────────────── */
            .penalty-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 13px;
            }
            .penalty-table th {
                text-align: left;
                padding: 8px 10px;
                color: var(--text-secondary);
                border-bottom: 1px solid var(--border-glass);
                font-weight: 500;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 0.4px;
            }
            .penalty-table td {
                padding: 10px 10px;
                color: var(--text-primary);
                border-bottom: 1px solid var(--border-glass);
            }
            .penalty-table tr.penalty-total td {
                font-weight: 700;
                color: var(--text-primary);
                border-top: 2px solid var(--text-secondary);
                padding-top: 12px;
            }
            .penalty-note {
                margin-top: 14px;
                font-size: 12px;
                color: var(--text-secondary);
                font-style: italic;
            }

            /* ── Timeline (Recent Activity) ───────────────── */
            .timeline { list-style: none; padding: 0; margin: 0; }

            .timeline-item {
                display: flex;
                align-items: flex-start;
                gap: 12px;
                padding: 10px 0;
                border-bottom: 1px solid var(--border-glass);
                cursor: pointer;
                transition: background 0.2s;
                border-radius: 8px;
                padding-left: 8px;
                padding-right: 8px;
            }
            .timeline-item:last-child { border-bottom: none; }
            .timeline-item:hover { background: var(--bg-card); }

            .timeline-icon {
                font-size: 18px;
                flex-shrink: 0;
                margin-top: 2px;
            }
            .timeline-body {
                flex: 1;
                min-width: 0;
            }
            .timeline-title {
                font-size: 13px;
                color: var(--text-primary);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                font-weight: 500;
            }
            .timeline-meta {
                font-size: 11px;
                color: var(--text-secondary);
                margin-top: 3px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .status-badge-sm {
                font-size: 10px;
                padding: 2px 7px;
                border-radius: 6px;
                font-weight: 600;
                color: var(--text-primary);
                white-space: nowrap;
            }

            /* ── Quick Actions ────────────────────────────── */
            .quick-actions {
                display: flex;
                gap: 12px;
                flex-wrap: wrap;
            }
            .quick-actions .btn {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 10px 20px;
                border-radius: 10px;
                font-size: 14px;
                font-weight: 600;
                border: none;
                cursor: pointer;
                transition: transform 0.15s, box-shadow 0.2s, background 0.2s;
                font-family: 'Inter', sans-serif;
            }
            .quick-actions .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(0,0,0,0.3);
            }
            .quick-actions .btn-primary {
                background: linear-gradient(135deg, #3742fa, #5352ed);
                color: var(--text-primary);
            }
            .quick-actions .btn-secondary {
                background: var(--bg-card);
                color: var(--text-primary);
                border: 1px solid var(--text-secondary);
            }
            .quick-actions .btn-secondary:hover {
                background: var(--text-secondary);
            }

            /* ── Empty State ──────────────────────────────── */
            .empty-state {
                text-align: center;
                padding: 32px 16px;
                color: var(--text-secondary);
                font-size: 14px;
            }
            .empty-state-icon {
                font-size: 36px;
                margin-bottom: 10px;
                display: block;
            }

            /* ── Entrance Animations ──────────────────────── */
            .animate-slide-up {
                opacity: 0;
                transform: translateY(24px);
                animation: dashSlideUp 0.5s ease forwards;
            }
            @keyframes dashSlideUp {
                to { opacity: 1; transform: translateY(0); }
            }

            /* ── Responsive ───────────────────────────────── */
            @media (max-width: 1024px) {
                .metrics-grid { grid-template-columns: repeat(2, 1fr); }
                .dashboard-row.two-col-60-40,
                .dashboard-row.two-col-50-50 { grid-template-columns: 1fr; }
            }
            @media (max-width: 600px) {
                .metrics-grid { grid-template-columns: 1fr; }
            }
        `;
        document.head.appendChild(style);
    }

    // ── Status badge color map ───────────────────────────────────
    const STATUS_COLORS = {
        'Open':        '#3742fa',
        'In Progress': '#ffa502',
        'Waiting':     '#747d8c',
        'Escalated':   '#ff4757',
        'Resolved':    '#2ed573',
        'Closed':      '#57606f'
    };

    const PRIORITY_COLORS = {
        P1: '#ff4757',
        P2: '#ffa502',
        P3: '#3742fa',
        P4: '#747d8c'
    };

    // ── Helper: format currency ──────────────────────────────────
    function formatCurrency(amount) {
        return '₹' + amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }

    // ── Build: Top Metrics Row ───────────────────────────────────
    function buildMetricsRow() {
        const currentMonth = Utils.getCurrentMonthStr();
        const openIssues = Store.getOpenIssues();
        const breached = Store.getBreachedIssuesThisMonth();
        const uptime = Store.getMonthlyUptimePercent(currentMonth);
        const tier = Store.getUptimePenaltyTier(uptime);
        const penalties = Utils.computeMonthlyPenalties(currentMonth);

        // Priority breakdown of open issues
        const priCounts = { P1: 0, P2: 0, P3: 0, P4: 0 };
        openIssues.forEach(i => { if (priCounts.hasOwnProperty(i.priority)) priCounts[i.priority]++; });

        // Uptime color
        let uptimeColor = '#2ed573';  // green
        if (uptime < 99.0) uptimeColor = '#ff4757';
        else if (uptime < 99.5) uptimeColor = '#ffa502';

        // Tier label
        const tierLabel = tier ? tier.label : 'No Penalty';
        const tierColor = tier ? (tier.deduction >= 10 ? '#ff4757' : tier.deduction >= 5 ? '#ffa502' : '#ffa502') : '#2ed573';

        // Priority badge markup
        const priBadges = ['P1','P2','P3','P4']
            .filter(p => priCounts[p] > 0)
            .map(p => `<span class="metric-badge" style="background:${PRIORITY_COLORS[p]}">${p}: ${priCounts[p]}</span>`)
            .join('');

        return `
        <div class="metrics-grid">
            <!-- Open Issues -->
            <div class="metric-card glass-card animate-slide-up" style="--accent: #3742fa; animation-delay: 0s;">
                <span class="metric-icon">📋</span>
                <div class="metric-value">${openIssues.length}</div>
                <div class="metric-label">Open Issues</div>
                ${priBadges ? `<div class="metric-sub">${priBadges}</div>` : ''}
            </div>

            <!-- SLA Breaches -->
            <div class="metric-card glass-card animate-slide-up" style="--accent: #ff4757; animation-delay: 0.08s;">
                <span class="metric-icon">🔴</span>
                <div class="metric-value">${breached.length}</div>
                <div class="metric-label">SLA Breaches This Month</div>
            </div>

            <!-- Current Uptime -->
            <div class="metric-card glass-card animate-slide-up" style="--accent: ${uptimeColor}; animation-delay: 0.16s;">
                <span class="metric-icon">⚡</span>
                <div class="metric-value" style="color: ${uptimeColor}">${uptime.toFixed(2)}%</div>
                <div class="metric-label">Current Uptime</div>
                <span class="metric-tier-label" style="color: ${tierColor}">${Utils.escapeHTML(tierLabel)}</span>
            </div>

            <!-- Penalty Estimate -->
            <div class="metric-card glass-card animate-slide-up" style="--accent: #ffa502; animation-delay: 0.24s;">
                <span class="metric-icon">💰</span>
                <div class="metric-value">${formatCurrency(penalties.totalAmount)}</div>
                <div class="metric-label">Penalty Estimate</div>
                ${penalties.totalPercent > 0 ? `<span class="metric-tier-label" style="color:#ff4757">${penalties.totalPercent}% of AMC</span>` : ''}
            </div>
        </div>`;
    }

    // ── Build: Priority Bar Chart ────────────────────────────────
    function buildPriorityChart() {
        const counts = {
            P1: Store.getIssuesByPriority('P1').length,
            P2: Store.getIssuesByPriority('P2').length,
            P3: Store.getIssuesByPriority('P3').length,
            P4: Store.getIssuesByPriority('P4').length
        };
        const maxVal = Math.max(1, ...Object.values(counts));

        const bars = ['P1','P2','P3','P4'].map(p => {
            const pct = (counts[p] / maxVal) * 100;
            return `
            <div class="bar-row">
                <span class="bar-label" style="color:${PRIORITY_COLORS[p]}">${p}</span>
                <div class="bar-track">
                    <div class="bar-fill" style="width:${pct}%; background:${PRIORITY_COLORS[p]}"></div>
                </div>
                <span class="bar-value">${counts[p]}</span>
            </div>`;
        }).join('');

        return `
        <div class="glass-card animate-slide-up" style="animation-delay: 0.32s;">
            <div class="card-title">📊 Issues by Priority</div>
            <div class="bar-chart">${bars}</div>
        </div>`;
    }

    // ── Build: SLA Compliance Ring ────────────────────────────────
    function buildComplianceRing() {
        const allIssues = Store.getIssues().filter(i => i.priority !== 'P4');
        let onTrack = 0, atRisk = 0, breached = 0;

        allIssues.forEach(issue => {
            const status = Utils.computeSLAStatus(issue);
            if (status === 'On Track')  onTrack++;
            else if (status === 'At Risk') atRisk++;
            else if (status === 'Breached') breached++;
        });

        const total = onTrack + atRisk + breached;
        const compliancePct = total > 0 ? Math.round((onTrack / total) * 100) : 100;

        // Build conic-gradient segments (green → orange → red → empty)
        let gradient;
        if (total === 0) {
            gradient = 'conic-gradient(rgba(255,255,255,0.08) 0deg 360deg)';
        } else {
            const greenDeg = (onTrack / total) * 360;
            const orangeDeg = greenDeg + (atRisk / total) * 360;
            // Red fills the rest
            gradient = `conic-gradient(
                #2ed573 0deg ${greenDeg}deg,
                #ffa502 ${greenDeg}deg ${orangeDeg}deg,
                #ff4757 ${orangeDeg}deg 360deg
            )`;
        }

        return `
        <div class="glass-card animate-slide-up" style="animation-delay: 0.36s;">
            <div class="card-title">🛡️ SLA Compliance</div>
            <div class="compliance-ring-container">
                <div class="compliance-ring" style="background: ${gradient}">
                    <div class="compliance-ring-inner">
                        <span class="compliance-pct">${compliancePct}%</span>
                        <span class="compliance-pct-label">Compliant</span>
                    </div>
                </div>
                <div class="compliance-legend">
                    <span class="compliance-legend-item"><span class="legend-dot" style="background:#2ed573"></span>On Track: ${onTrack}</span>
                    <span class="compliance-legend-item"><span class="legend-dot" style="background:#ffa502"></span>At Risk: ${atRisk}</span>
                    <span class="compliance-legend-item"><span class="legend-dot" style="background:#ff4757"></span>Breached: ${breached}</span>
                </div>
            </div>
        </div>`;
    }

    // ── Build: Penalty Breakdown ─────────────────────────────────
    function buildPenaltyBreakdown() {
        const currentMonth = Utils.getCurrentMonthStr();
        const penalties = Utils.computeMonthlyPenalties(currentMonth);
        const settings = Store.getSettings();
        const noAmc = !settings.amcMonthlyCharge;

        const rows = [
            { label: 'Uptime Penalty',   detail: penalties.uptime.tier || '—', pct: penalties.uptime.percent,          amt: penalties.uptime.amount },
            { label: 'P1 Delays',        detail: `${penalties.p1Delays.count} issue(s)`,  pct: penalties.p1Delays.percent,  amt: penalties.p1Delays.amount },
            { label: 'P2 Delays',        detail: `${penalties.p2Delays.count} issue(s)`,  pct: penalties.p2Delays.percent,  amt: penalties.p2Delays.amount },
            { label: 'P3 Delays',        detail: `${penalties.p3Delays.count} issue(s)`,  pct: penalties.p3Delays.percent,  amt: penalties.p3Delays.amount },
            { label: 'Security Breach',  detail: `${penalties.securityBreach.count} incident(s)`, pct: penalties.securityBreach.percent, amt: penalties.securityBreach.amount }
        ];

        const tableRows = rows.map(r => `
            <tr>
                <td>${Utils.escapeHTML(r.label)}</td>
                <td>${Utils.escapeHTML(r.detail)}</td>
                <td>${r.pct}%</td>
                <td>${formatCurrency(r.amt)}</td>
            </tr>`).join('');

        return `
        <div class="glass-card animate-slide-up" style="animation-delay: 0.40s;">
            <div class="card-title">📑 Monthly Penalty Summary</div>
            <table class="penalty-table">
                <thead>
                    <tr><th>Category</th><th>Detail</th><th>Deduction %</th><th>Amount</th></tr>
                </thead>
                <tbody>
                    ${tableRows}
                    <tr class="penalty-total">
                        <td>Total</td>
                        <td></td>
                        <td>${penalties.totalPercent}%</td>
                        <td>${formatCurrency(penalties.totalAmount)}</td>
                    </tr>
                </tbody>
            </table>
            ${noAmc ? '<p class="penalty-note">⚠️ Set AMC charge in Settings to see penalty amounts</p>' : ''}
        </div>`;
    }

    // ── Build: Recent Activity Timeline ──────────────────────────
    function buildRecentActivity() {
        const issues = Store.getIssues()
            .slice()
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
            .slice(0, 10);

        if (issues.length === 0) {
            return `
            <div class="glass-card animate-slide-up" style="animation-delay: 0.44s;">
                <div class="card-title">🕒 Recent Activity</div>
                <div class="empty-state">
                    <span class="empty-state-icon">📭</span>
                    No issues yet. Create your first issue to get started.
                </div>
            </div>`;
        }

        const items = issues.map(issue => {
            const statusColor = STATUS_COLORS[issue.status] || '#747d8c';
            const titleTruncated = issue.title && issue.title.length > 48
                ? Utils.escapeHTML(issue.title.slice(0, 48)) + '…'
                : Utils.escapeHTML(issue.title || 'Untitled');

            return `
            <li class="timeline-item" data-issue-id="${Utils.escapeHTML(issue.id)}">
                <span class="timeline-icon">${Utils.priorityIcon(issue.priority)}</span>
                <div class="timeline-body">
                    <div class="timeline-title">${titleTruncated}</div>
                    <div class="timeline-meta">
                        <span class="status-badge-sm" style="background:${statusColor}">${Utils.escapeHTML(issue.status)}</span>
                        <span>${Utils.timeAgo(issue.updatedAt)}</span>
                    </div>
                </div>
            </li>`;
        }).join('');

        return `
        <div class="glass-card animate-slide-up" style="animation-delay: 0.44s;">
            <div class="card-title">🕒 Recent Activity</div>
            <ul class="timeline" id="dashboard-timeline">${items}</ul>
        </div>`;
    }

    // ── Build: Quick Actions ─────────────────────────────────────
    function buildQuickActions() {
        return `
        <div class="glass-card animate-slide-up" style="animation-delay: 0.50s;">
            <div class="card-title">⚡ Quick Actions</div>
            <div class="quick-actions">
                <button class="btn btn-primary" id="dashboard-btn-new-issue">+ New Issue</button>
                <button class="btn btn-secondary" id="dashboard-btn-log-downtime">📉 Log Downtime</button>
                <button class="btn btn-secondary" id="dashboard-btn-export">📄 Export Report</button>
                <button class="btn btn-secondary" id="dashboard-btn-sla-guide">📘 View SLA Guide</button>
            </div>
        </div>`;
    }

    // ── Event Binding ────────────────────────────────────────────
    function bindEvents(container) {
        // Timeline item click — navigate to issue detail
        const timeline = container.querySelector('#dashboard-timeline');
        if (timeline) {
            timeline.addEventListener('click', (e) => {
                const item = e.target.closest('.timeline-item');
                if (!item) return;
                const issueId = item.dataset.issueId;
                if (issueId && typeof App !== 'undefined' && App.navigate) {
                    App.navigate('issues', { issueId });
                }
            });
        }

        // Quick action: New Issue
        const btnNew = container.querySelector('#dashboard-btn-new-issue');
        if (btnNew) {
            btnNew.addEventListener('click', () => {
                if (typeof App !== 'undefined' && App.navigate) {
                    App.navigate('issues', { action: 'create' });
                }
            });
        }

        // Quick action: Log Downtime
        const btnDowntime = container.querySelector('#dashboard-btn-log-downtime');
        if (btnDowntime) {
            btnDowntime.addEventListener('click', () => {
                if (typeof App !== 'undefined' && App.navigate) {
                    App.navigate('uptime');
                }
            });
        }

        // Quick action: Export Report
        const btnExport = container.querySelector('#dashboard-btn-export');
        if (btnExport) {
            btnExport.addEventListener('click', () => {
                if (typeof ExportHelper !== 'undefined' && ExportHelper.exportIssuesToExcel) {
                    ExportHelper.exportIssuesToExcel();
                } else {
                    // Fallback: export JSON data
                    const data = Store.exportAllData();
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `lms-sla-report-${Utils.getCurrentMonthStr()}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    if (typeof App !== 'undefined' && App.showToast) {
                        App.showToast('Report exported', 'success');
                    }
                }
            });
        }

        // Quick action: SLA Guide
        const btnGuide = container.querySelector('#dashboard-btn-sla-guide');
        if (btnGuide) {
            btnGuide.addEventListener('click', () => {
                if (typeof App !== 'undefined' && App.navigate) {
                    App.navigate('sla-reference');
                }
            });
        }

        // Header sync button
        const headerSyncBtn = document.getElementById('dashboard-header-sync-btn');
        if (headerSyncBtn) {
            headerSyncBtn.addEventListener('click', async () => {
                const origText = headerSyncBtn.innerHTML;
                headerSyncBtn.innerHTML = `
                    <svg class="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                    Syncing...
                `;
                headerSyncBtn.disabled = true;
                try {
                    await Store.syncFromCloud();
                    if (typeof App !== 'undefined' && App.showToast) {
                        App.showToast('Database sync complete!', 'success');
                    }
                    render(container);
                } catch (e) {
                    if (typeof App !== 'undefined' && App.showToast) {
                        App.showToast('Sync failed: ' + e.message, 'error');
                    }
                } finally {
                    if (headerSyncBtn) {
                        headerSyncBtn.innerHTML = origText;
                        headerSyncBtn.disabled = false;
                    }
                }
            });
        }
    }

    // ── Public render() ──────────────────────────────────────────
    function render(container) {
        injectStyles();

        if (typeof App !== 'undefined' && App.setHeaderActions) {
            App.setHeaderActions(`
                <button class="btn btn-primary btn-sm" id="dashboard-header-sync-btn" style="display:flex;align-items:center;gap:6px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                    Sync Database
                </button>
            `);
        }

        const monthLabel = Utils.getMonthName(Utils.getCurrentMonthStr());

        container.innerHTML = `
            <div class="dashboard-page">
                <h1 style="font-size:24px;font-weight:700;color: var(--text-primary);margin-bottom:4px;">Dashboard</h1>
                <p style="font-size:13px;color:var(--text-secondary);margin-bottom:24px;">${Utils.escapeHTML(monthLabel)} Overview</p>

                <!-- Row 1: Metric Cards -->
                ${buildMetricsRow()}

                <!-- Row 2: Priority Chart + Compliance Ring -->
                <div class="dashboard-row two-col-60-40">
                    ${buildPriorityChart()}
                    ${buildComplianceRing()}
                </div>

                <!-- Row 3: Penalty Breakdown + Recent Activity -->
                <div class="dashboard-row two-col-50-50">
                    ${buildPenaltyBreakdown()}
                    ${buildRecentActivity()}
                </div>

                <!-- Row 4: Quick Actions -->
                <div class="dashboard-row full-width">
                    ${buildQuickActions()}
                </div>
            </div>
        `;

        bindEvents(container);
    }

    // ── Expose ───────────────────────────────────────────────────
    return { render };
})();
