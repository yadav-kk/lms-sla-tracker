/**
 * export.js — Excel Export, Print Issue, Print Current View
 * LMS SLA Issue Tracker
 *
 * Uses SheetJS (XLSX global) for Excel workbook generation.
 * Provides print-friendly HTML rendering for individual issues
 * and a simple passthrough for the current view's print stylesheet.
 */

const ExportHelper = (() => {

    // ── XLSX availability check ─────────────────────────────────
    function _isXLSXAvailable() {
        if (typeof XLSX !== 'undefined') return true;
        _showToast('Excel export library not loaded. Please check your internet connection.', 'error');
        return false;
    }

    // ── Toast notification helper ───────────────────────────────
    function _showToast(message, type = 'error') {
        // Reuse existing app toast if available, otherwise create a simple one
        let toast = document.getElementById('export-helper-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'export-helper-toast';
            Object.assign(toast.style, {
                position: 'fixed',
                bottom: '24px',
                right: '24px',
                padding: '14px 22px',
                borderRadius: '10px',
                fontFamily: "'Inter', sans-serif",
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#fff',
                zIndex: '10000',
                opacity: '0',
                transform: 'translateY(12px)',
                transition: 'opacity 0.3s ease, transform 0.3s ease',
                maxWidth: '400px',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
            });
            document.body.appendChild(toast);
        }

        // Set color based on type
        const colors = {
            error:   { bg: 'rgba(255,71,87,0.92)',  icon: '❌' },
            success: { bg: 'rgba(46,213,115,0.92)',  icon: '✅' },
            info:    { bg: 'rgba(55,66,250,0.92)',   icon: 'ℹ️' }
        };
        const c = colors[type] || colors.info;
        toast.style.background = c.bg;
        toast.textContent = `${c.icon}  ${message}`;

        // Animate in
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        // Auto-dismiss after 4s
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(12px)';
        }, 4000);
    }

    // ── Auto-fit column widths for a worksheet ──────────────────
    function _autoFitColumns(ws, data) {
        if (!data || data.length === 0) return;
        const colWidths = Object.keys(data[0]).map(key => {
            // Start with header length
            let maxLen = key.length;
            data.forEach(row => {
                const val = row[key];
                const len = val != null ? String(val).length : 0;
                if (len > maxLen) maxLen = len;
            });
            // Cap at reasonable width, add padding
            return { wch: Math.min(maxLen + 3, 60) };
        });
        ws['!cols'] = colWidths;
    }

    // ── Format a date ISO string for display in Excel ───────────
    function _fmtDate(iso) {
        if (!iso) return '';
        try {
            return Utils.formatDateTime(iso);
        } catch {
            return iso;
        }
    }

    // ── Sheet 1: All Issues ─────────────────────────────────────
    function _buildAllIssuesData(issues) {
        return issues.map(issue => ({
            'ID':               issue.id || '',
            'Title':            issue.title || '',
            'Priority':         issue.priority || '',
            'Status':           issue.status || '',
            'Module':           issue.module || '',
            'System Issue':     issue.systemIssue || '',
            'Assigned To':      issue.assignedTo || '',
            'Start Date':       _fmtDate(issue.startDate),
            'Target End Date':  _fmtDate(issue.targetEndDate),
            'Actual End Date':  _fmtDate(issue.actualEndDate),
            'Response Time':    issue.responseTime != null ? Utils.formatDuration(issue.responseTime) : '',
            'Resolution Time':  issue.resolutionTime != null ? Utils.formatDuration(issue.resolutionTime) : '',
            'SLA Status':       issue.slaStatus || '',
            'Escalation Level': issue.escalationLevel || 1,
            'Notes Count':      (issue.notes || []).length,
            'Attachments Count': (issue.attachments || []).length
        }));
    }

    // ── Sheet 3: Uptime Log ─────────────────────────────────────
    function _buildUptimeData() {
        const logs = Store.getUptimeLogs();
        return logs.map(log => ({
            'ID':               log.id || '',
            'Date':             log.date || '',
            'Downtime Start':   log.downtimeStart || '',
            'Downtime End':     log.downtimeEnd || '',
            'Duration (minutes)': log.durationMinutes || 0,
            'Cause':            log.cause || '',
            'Is Maintenance':   log.isMaintenanceWindow ? 'Yes' : 'No',
            'Month':            log.month || ''
        }));
    }

    // ── Sheet 4: Penalty Summary ────────────────────────────────
    function _buildPenaltyData() {
        const ym = Utils.getCurrentMonthStr();
        const penalties = Utils.computeMonthlyPenalties(ym);

        return [
            {
                'Category':     'Uptime Penalty',
                'Count/Tier':   penalties.uptime.tier || 'N/A',
                'Deduction %':  penalties.uptime.percent + '%',
                'Amount':       penalties.uptime.amount.toFixed(2)
            },
            {
                'Category':     'P1 Delays',
                'Count/Tier':   penalties.p1Delays.count + ' incident(s)',
                'Deduction %':  penalties.p1Delays.percent + '%',
                'Amount':       penalties.p1Delays.amount.toFixed(2)
            },
            {
                'Category':     'P2 Delays',
                'Count/Tier':   penalties.p2Delays.count + ' incident(s)',
                'Deduction %':  penalties.p2Delays.percent + '%',
                'Amount':       penalties.p2Delays.amount.toFixed(2)
            },
            {
                'Category':     'P3 Delays',
                'Count/Tier':   penalties.p3Delays.count + ' incident(s)',
                'Deduction %':  penalties.p3Delays.percent + '%',
                'Amount':       penalties.p3Delays.amount.toFixed(2)
            },
            {
                'Category':     'Security Breach',
                'Count/Tier':   penalties.securityBreach.count + ' incident(s)',
                'Deduction %':  penalties.securityBreach.percent + '%',
                'Amount':       penalties.securityBreach.amount.toFixed(2)
            },
            {
                'Category':     'TOTAL',
                'Count/Tier':   '',
                'Deduction %':  penalties.totalPercent + '%',
                'Amount':       penalties.totalAmount.toFixed(2)
            }
        ];
    }

    // ── Sheet 5: SLA Configuration ──────────────────────────────
    function _buildSLAConfigData() {
        const config = Store.SLA_CONFIG;
        const rows = [];

        // Priority configuration
        Object.keys(config).forEach(p => {
            const c = config[p];
            rows.push({
                'Section':           'Priority Levels',
                'Parameter':         c.label,
                'Response Window':   c.responseMinutes != null ? Utils.formatDuration(c.responseMinutes) : 'N/A',
                'Resolution Window': c.resolutionMinutes != null ? Utils.formatDuration(c.resolutionMinutes) : 'N/A',
                'Notes':             p === 'P1' ? '24x7x365' : (p === 'P4' ? 'As per Sprint Plan' : 'Business Hours Mon-Sat')
            });
        });

        // Uptime tiers
        const tiers = Store.UPTIME_TIERS;
        Object.keys(tiers).forEach(t => {
            const tier = tiers[t];
            rows.push({
                'Section':           'Uptime Penalties',
                'Parameter':         tier.label,
                'Response Window':   '',
                'Resolution Window': '',
                'Notes':             tier.deduction + '% of Monthly AMC'
            });
        });

        return rows;
    }

    // ── Export Issues to Excel (main method) ────────────────────
    function exportIssuesToExcel() {
        if (!_isXLSXAvailable()) return;

        try {
            const wb = XLSX.utils.book_new();
            const allIssues = Store.getIssues();

            // Sheet 1: All Issues
            const allData = _buildAllIssuesData(allIssues);
            const ws1 = XLSX.utils.json_to_sheet(allData.length > 0 ? allData : [{ 'Info': 'No issues found' }]);
            if (allData.length > 0) _autoFitColumns(ws1, allData);
            XLSX.utils.book_append_sheet(wb, ws1, 'All Issues');

            // Sheet 2: Critical Issues (P1)
            const p1Issues = allIssues.filter(i => i.priority === 'P1');
            const p1Data = _buildAllIssuesData(p1Issues);
            const ws2 = XLSX.utils.json_to_sheet(p1Data.length > 0 ? p1Data : [{ 'Info': 'No P1 issues found' }]);
            if (p1Data.length > 0) _autoFitColumns(ws2, p1Data);
            XLSX.utils.book_append_sheet(wb, ws2, 'Critical Issues (P1)');

            // Sheet 3: Uptime Log
            const uptimeData = _buildUptimeData();
            const ws3 = XLSX.utils.json_to_sheet(uptimeData.length > 0 ? uptimeData : [{ 'Info': 'No uptime logs found' }]);
            if (uptimeData.length > 0) _autoFitColumns(ws3, uptimeData);
            XLSX.utils.book_append_sheet(wb, ws3, 'Uptime Log');

            // Sheet 4: Penalty Summary
            const penaltyData = _buildPenaltyData();
            const ws4 = XLSX.utils.json_to_sheet(penaltyData);
            _autoFitColumns(ws4, penaltyData);
            XLSX.utils.book_append_sheet(wb, ws4, 'Penalty Summary');

            // Sheet 5: SLA Configuration
            const configData = _buildSLAConfigData();
            const ws5 = XLSX.utils.json_to_sheet(configData);
            _autoFitColumns(ws5, configData);
            XLSX.utils.book_append_sheet(wb, ws5, 'SLA Configuration');

            // Generate filename with current date
            const today = new Date().toISOString().slice(0, 10);
            const filename = `LMS_SLA_Report_${today}.xlsx`;

            // Trigger download
            XLSX.writeFile(wb, filename);

            _showToast(`Report exported: ${filename}`, 'success');
        } catch (err) {
            console.error('ExportHelper.exportIssuesToExcel error:', err);
            _showToast('Failed to export Excel report. See console for details.', 'error');
        }
    }

    // ── Print a single issue ────────────────────────────────────
    function printIssue(issueId) {
        const issue = Store.getIssueById(issueId);
        if (!issue) {
            _showToast('Issue not found.', 'error');
            return;
        }

        // Compute SLA info
        const slaStatus = Utils.computeSLAStatus(issue);
        const escalationLevel = Utils.computeEscalationLevel(issue);
        const config = Store.SLA_CONFIG[issue.priority] || {};

        // Build notes HTML
        const notesHtml = (issue.notes && issue.notes.length > 0)
            ? issue.notes.map(n =>
                `<tr>
                    <td>${_fmtDate(n.timestamp)}</td>
                    <td>${_escPrint(n.author)}</td>
                    <td>${_escPrint(n.text)}</td>
                </tr>`
            ).join('')
            : '<tr><td colspan="3" style="text-align:center;color:#999;">No notes recorded.</td></tr>';

        // Build attachments HTML
        const attachmentsHtml = (issue.attachments && issue.attachments.length > 0)
            ? issue.attachments.map((a, i) =>
                `<tr>
                    <td>${i + 1}</td>
                    <td>${_escPrint(a.name || 'Attachment')}</td>
                    <td>${a.size ? Utils.formatFileSize(a.size) : '—'}</td>
                </tr>`
            ).join('')
            : '<tr><td colspan="3" style="text-align:center;color:#999;">No attachments.</td></tr>';

        const printHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Issue ${_escPrint(issue.id)} — ${_escPrint(issue.title)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 12px;
            color: #222;
            background: #fff;
            padding: 24px 32px;
            line-height: 1.5;
        }
        h1 { font-size: 18px; margin-bottom: 4px; color: #111; }
        h2 { font-size: 14px; margin: 18px 0 8px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
        .header-meta { color: #666; font-size: 11px; margin-bottom: 16px; }
        .detail-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px 24px;
            margin-bottom: 16px;
        }
        .detail-row { display: flex; gap: 8px; padding: 4px 0; border-bottom: 1px solid #f0f0f0; }
        .detail-label { font-weight: 600; color: #555; min-width: 140px; flex-shrink: 0; }
        .detail-value { color: #222; }
        .priority-indicator {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 11px;
        }
        .p1-print { background: #ffe0e3; color: #d32f2f; }
        .p2-print { background: #fff3e0; color: #e65100; }
        .p3-print { background: #e3f2fd; color: #1565c0; }
        .p4-print { background: #f5f5f5; color: #616161; }
        .sla-on-track-print { color: #2e7d32; }
        .sla-at-risk-print { color: #e65100; }
        .sla-breached-print { color: #d32f2f; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        table th { background: #f5f5f5; text-align: left; padding: 6px 10px; font-size: 11px; font-weight: 600; color: #555; border: 1px solid #ddd; }
        table td { padding: 6px 10px; border: 1px solid #eee; font-size: 11px; }
        .desc-block { background: #fafafa; padding: 10px 14px; border-radius: 4px; border: 1px solid #eee; margin-bottom: 12px; white-space: pre-wrap; font-size: 11.5px; }
        .print-footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #ddd; color: #999; font-size: 10px; text-align: center; }
        @media print {
            body { padding: 12px 16px; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <h1>📋 ${_escPrint(issue.id)} — ${_escPrint(issue.title)}</h1>
    <div class="header-meta">Printed on ${new Date().toLocaleString('en-IN')} | LMS SLA Issue Tracker</div>

    <h2>Issue Details</h2>
    <div class="detail-grid">
        <div class="detail-row">
            <span class="detail-label">Priority:</span>
            <span class="detail-value"><span class="priority-indicator ${issue.priority.toLowerCase()}-print">${_escPrint(config.label || issue.priority)}</span></span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Status:</span>
            <span class="detail-value">${_escPrint(issue.status)}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Module:</span>
            <span class="detail-value">${_escPrint(issue.module)}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">System Issue:</span>
            <span class="detail-value">${_escPrint(issue.systemIssue)}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Assigned To:</span>
            <span class="detail-value">${_escPrint(issue.assignedTo || '—')}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Escalation Level:</span>
            <span class="detail-value">L${escalationLevel}</span>
        </div>
    </div>

    <h2>Dates & SLA</h2>
    <div class="detail-grid">
        <div class="detail-row">
            <span class="detail-label">Start Date:</span>
            <span class="detail-value">${_fmtDate(issue.startDate)}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Target End Date:</span>
            <span class="detail-value">${_fmtDate(issue.targetEndDate)}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Actual End Date:</span>
            <span class="detail-value">${_fmtDate(issue.actualEndDate)}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Response Time:</span>
            <span class="detail-value">${issue.responseTime != null ? Utils.formatDuration(issue.responseTime) : '—'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Resolution Time:</span>
            <span class="detail-value">${issue.resolutionTime != null ? Utils.formatDuration(issue.resolutionTime) : '—'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">SLA Status:</span>
            <span class="detail-value sla-${slaStatus.toLowerCase().replace(/\s/g, '-')}-print">${_escPrint(slaStatus)}</span>
        </div>
    </div>

    ${issue.description ? `<h2>Description</h2><div class="desc-block">${_escPrint(issue.description)}</div>` : ''}

    <h2>Notes (${(issue.notes || []).length})</h2>
    <table>
        <thead><tr><th>Timestamp</th><th>Author</th><th>Note</th></tr></thead>
        <tbody>${notesHtml}</tbody>
    </table>

    <h2>Attachments (${(issue.attachments || []).length})</h2>
    <table>
        <thead><tr><th>#</th><th>Filename</th><th>Size</th></tr></thead>
        <tbody>${attachmentsHtml}</tbody>
    </table>

    <div class="print-footer">LMS SLA Issue Tracker — Generated Report</div>

    <script>
        window.onload = function() {
            window.print();
            // Close after print dialog is dismissed
            window.onafterprint = function() { window.close(); };
            // Fallback: close after a timeout for browsers that don't fire onafterprint
            setTimeout(function() { window.close(); }, 2000);
        };
    </script>
</body>
</html>`;

        // Open in new window and write HTML
        const printWin = window.open('', '_blank', 'width=800,height=900');
        if (!printWin) {
            _showToast('Pop-up blocked. Please allow pop-ups for this site.', 'error');
            return;
        }
        printWin.document.open();
        printWin.document.write(printHtml);
        printWin.document.close();
    }

    // ── Print current view ──────────────────────────────────────
    function printCurrentView() {
        window.print();
    }

    // ── Simple HTML-escape for print documents ──────────────────
    function _escPrint(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ── Public API ──────────────────────────────────────────────
    return {
        exportIssuesToExcel,
        printIssue,
        printCurrentView
    };
})();
