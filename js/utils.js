/**
 * utils.js — SLA Calculations, Date Helpers, Formatters
 * LMS SLA Issue Tracker
 */

const Utils = (() => {

    // ── Date / Time Formatting ───────────────────────────────────
    function formatDate(isoString) {
        if (!isoString) return '—';
        const d = new Date(isoString);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function formatDateTime(isoString) {
        if (!isoString) return '—';
        const d = new Date(isoString);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
               d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    function formatDuration(minutes) {
        if (minutes === null || minutes === undefined) return '—';
        if (minutes < 1) return '< 1 min';
        if (minutes < 60) return `${Math.round(minutes)} min`;
        const hrs = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        if (hrs < 24) return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
        const days = Math.floor(hrs / 24);
        const remHrs = hrs % 24;
        return remHrs > 0 ? `${days}d ${remHrs}h` : `${days}d`;
    }

    function timeAgo(isoString) {
        if (!isoString) return '';
        const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
        return formatDate(isoString);
    }

    function toLocalInputDateTime(isoString) {
        if (!isoString) return '';
        const d = new Date(isoString);
        const offset = d.getTimezoneOffset();
        const local = new Date(d.getTime() - offset * 60000);
        return local.toISOString().slice(0, 16);
    }

    function fromLocalInputDateTime(localString) {
        if (!localString) return null;
        return new Date(localString).toISOString();
    }

    // ── SLA Calculations ─────────────────────────────────────────

    /**
     * Calculate the target end date based on priority.
     * For P3: counts only business days (Mon-Sat, 09:00-18:00 IST).
     * For P1/P2: straight clock (24/7).
     * P4: returns null.
     */
    function computeTargetEndDate(startDateISO, priority) {
        const config = Store.SLA_CONFIG[priority];
        if (!config || !config.resolutionMinutes) return null;

        const start = new Date(startDateISO);

        if (priority === 'P1') {
            // P1: 24x7, straight 2 hours
            return new Date(start.getTime() + config.resolutionMinutes * 60000).toISOString();
        }

        if (priority === 'P2') {
            // P2: Business hours Mon-Sat 09:00-18:00 IST, 12 hours
            return addBusinessMinutes(start, config.resolutionMinutes).toISOString();
        }

        // P3: 3-5 business days (use 5 days = 5 * 9hrs = 2700 business minutes)
        return addBusinessMinutes(start, 5 * 9 * 60).toISOString();
    }

    /**
     * Shift UTC Date by +5:30 so that UTC fields return the exact IST representation.
     * Prevents machine timezone double-offset bugs.
     */
    function getISTParts(date) {
        const shiftDate = new Date(date.getTime() + 330 * 60000);
        return {
            year: shiftDate.getUTCFullYear(),
            month: shiftDate.getUTCMonth(),
            date: shiftDate.getUTCDate(),
            day: shiftDate.getUTCDay(), // 0=Sun, 6=Sat
            hours: shiftDate.getUTCHours(),
            minutes: shiftDate.getUTCMinutes()
        };
    }

    /**
     * Add business minutes (Mon-Sat, 09:00-18:00 IST)
     */
    function addBusinessMinutes(startDate, minutes) {
        let remaining = minutes;
        let current = new Date(startDate.getTime());

        while (remaining > 0) {
            const parts = getISTParts(current);

            // Sunday = non-business
            if (parts.day === 0) {
                current = getNextBusinessStart(current);
                continue;
            }

            const istNow = parts.hours * 60 + parts.minutes;
            const bizStart = 9 * 60;  // 09:00
            const bizEnd = 18 * 60;   // 18:00

            if (istNow < bizStart) {
                const diff = bizStart - istNow;
                current = new Date(current.getTime() + diff * 60000);
                continue;
            }

            if (istNow >= bizEnd) {
                current = getNextBusinessStart(current);
                continue;
            }

            // Within business hours
            const minutesLeftToday = bizEnd - istNow;
            if (remaining <= minutesLeftToday) {
                current = new Date(current.getTime() + remaining * 60000);
                remaining = 0;
            } else {
                remaining -= minutesLeftToday;
                current = new Date(current.getTime() + minutesLeftToday * 60000);
                current = getNextBusinessStart(current);
            }
        }

        return current;
    }

    function getNextBusinessStart(date) {
        const d = new Date(date.getTime() + 330 * 60000);
        // Move to next day
        d.setUTCDate(d.getUTCDate() + 1);
        d.setUTCHours(9, 0, 0, 0);
        // Skip Sunday
        while (d.getUTCDay() === 0) {
            d.setUTCDate(d.getUTCDate() + 1);
        }
        // Convert back to UTC
        return new Date(d.getTime() - 330 * 60000);
    }

    /**
     * Calculate business elapsed minutes (Mon-Sat, 09:00-18:00 IST).
     */
    function computeBusinessMinutes(startDateISO, endDateISO) {
        const start = new Date(startDateISO);
        const end = endDateISO ? new Date(endDateISO) : new Date();
        if (start.getTime() >= end.getTime()) return 0;

        let totalMinutes = 0;
        let current = new Date(start.getTime());

        while (current.getTime() < end.getTime()) {
            const parts = getISTParts(current);

            if (parts.day === 0) {
                current = getNextBusinessStart(current);
                continue;
            }

            const istNow = parts.hours * 60 + parts.minutes;
            const bizStart = 9 * 60;  // 09:00
            const bizEnd = 18 * 60;   // 18:00

            if (istNow < bizStart) {
                const diff = bizStart - istNow;
                current = new Date(current.getTime() + diff * 60000);
                continue;
            }

            if (istNow >= bizEnd) {
                current = getNextBusinessStart(current);
                continue;
            }

            const minutesLeftToday = bizEnd - istNow;
            const msLeftToday = minutesLeftToday * 60000;
            const msToEnd = end.getTime() - current.getTime();

            if (msToEnd <= msLeftToday) {
                totalMinutes += msToEnd / 60000;
                break;
            } else {
                totalMinutes += minutesLeftToday;
                current = new Date(current.getTime() + msLeftToday);
                current = getNextBusinessStart(current);
            }
        }

        return totalMinutes;
    }

    /**
     * Calculate elapsed SLA minutes (excluding paused time).
     */
    function computeElapsedMinutes(startDateISO, endDateISO, totalPausedMinutes, priority) {
        if (!startDateISO) return 0;
        let elapsed = 0;
        if (priority === 'P1') {
            const start = new Date(startDateISO);
            const end = endDateISO ? new Date(endDateISO) : new Date();
            elapsed = (end.getTime() - start.getTime()) / 60000;
        } else if (priority === 'P2' || priority === 'P3') {
            elapsed = computeBusinessMinutes(startDateISO, endDateISO);
        } else {
            // Fallback to straight calendar time for undefined/P4
            const start = new Date(startDateISO);
            const end = endDateISO ? new Date(endDateISO) : new Date();
            elapsed = (end.getTime() - start.getTime()) / 60000;
        }
        return Math.max(0, elapsed - (totalPausedMinutes || 0));
    }

    /**
     * Determine SLA status: On Track / At Risk / Breached
     */
    function computeSLAStatus(issue) {
        if (!issue || !issue.priority || issue.priority === 'P4') return 'On Track';
        if (['Resolved', 'Closed'].includes(issue.status)) {
            // Check if it was resolved within SLA
            if (issue.actualEndDate && issue.targetEndDate) {
                return new Date(issue.actualEndDate) <= new Date(issue.targetEndDate) ? 'On Track' : 'Breached';
            }
            return 'On Track';
        }

        const config = Store.SLA_CONFIG[issue.priority];
        if (!config || !config.resolutionMinutes) return 'On Track';

        const elapsed = computeElapsedMinutes(issue.startDate, null, issue.totalPausedMinutes, issue.priority);

        if (elapsed >= config.resolutionMinutes) return 'Breached';
        if (elapsed >= config.resolutionMinutes * 0.75) return 'At Risk';
        return 'On Track';
    }

    /**
     * Determine current escalation level based on elapsed time
     */
    function computeEscalationLevel(issue) {
        if (!issue || !issue.priority || issue.priority === 'P4') return 1;
        if (['Resolved', 'Closed'].includes(issue.status)) return issue.escalationLevel || 1;

        const timeline = Store.ESCALATION_TIMELINES[issue.priority];
        if (!timeline) return 1;

        const elapsed = computeElapsedMinutes(issue.startDate, null, issue.totalPausedMinutes, issue.priority);

        let level = 1;
        for (const step of timeline) {
            if (elapsed >= step.afterMinutes) {
                level = step.level;
            }
        }
        return level;
    }

    /**
     * Compute SLA countdown (remaining minutes) or overdue (negative)
     */
    function computeSLACountdown(issue) {
        if (!issue || issue.priority === 'P4') return null;
        const config = Store.SLA_CONFIG[issue.priority];
        if (!config || !config.resolutionMinutes) return null;

        if (['Resolved', 'Closed'].includes(issue.status)) return null;

        const elapsed = computeElapsedMinutes(issue.startDate, null, issue.totalPausedMinutes, issue.priority);
        return config.resolutionMinutes - elapsed;
    }

    // ── Penalty Calculations ─────────────────────────────────────

    function computeMonthlyPenalties(yearMonth) {
        const settings = Store.getSettings();
        const amc = settings.amcMonthlyCharge || 0;
        const uptime = Store.getMonthlyUptimePercent(yearMonth);
        const uptimeTier = Store.getUptimePenaltyTier(uptime);

        const issues = Store.getIssues().filter(i => i.startDate && i.startDate.slice(0, 7) === yearMonth);

        let penalties = {
            uptime: { percent: 0, amount: 0, tier: null },
            p1Delays: { count: 0, percent: 0, amount: 0 },
            p2Delays: { count: 0, percent: 0, amount: 0 },
            p3Delays: { count: 0, percent: 0, amount: 0 },
            securityBreach: { count: 0, percent: 0, amount: 0 },
            totalPercent: 0,
            totalAmount: 0
        };

        // Uptime penalty
        if (uptimeTier) {
            penalties.uptime.tier = uptimeTier.label;
            penalties.uptime.percent = uptimeTier.deduction;
            penalties.uptime.amount = (uptimeTier.deduction / 100) * amc;
        }

        // Issue delay penalties
        issues.forEach(issue => {
            if (issue.slaStatus === 'Breached' && ['Resolved', 'Closed'].includes(issue.status)) {
                if (issue.priority === 'P1') {
                    penalties.p1Delays.count++;
                    penalties.p1Delays.percent += Store.PENALTY_RATES.P1_DELAY;
                    penalties.p1Delays.amount += (Store.PENALTY_RATES.P1_DELAY / 100) * amc;
                } else if (issue.priority === 'P2') {
                    penalties.p2Delays.count++;
                    penalties.p2Delays.percent += Store.PENALTY_RATES.P2_DELAY;
                    penalties.p2Delays.amount += (Store.PENALTY_RATES.P2_DELAY / 100) * amc;
                } else if (issue.priority === 'P3') {
                    penalties.p3Delays.count++;
                    penalties.p3Delays.percent += Store.PENALTY_RATES.P3_DELAY;
                    penalties.p3Delays.amount += (Store.PENALTY_RATES.P3_DELAY / 100) * amc;
                }
            }
        });

        // Security breach (check for P1 security issues)
        const securityBreaches = issues.filter(i =>
            i.module === 'Security & Auditing' && i.priority === 'P1' && i.slaStatus === 'Breached'
        );
        if (securityBreaches.length > 0) {
            penalties.securityBreach.count = securityBreaches.length;
            penalties.securityBreach.percent = Store.PENALTY_RATES.SECURITY_BREACH;
            penalties.securityBreach.amount = (Store.PENALTY_RATES.SECURITY_BREACH / 100) * amc;
        }

        penalties.totalPercent = penalties.uptime.percent + penalties.p1Delays.percent +
            penalties.p2Delays.percent + penalties.p3Delays.percent + penalties.securityBreach.percent;
        penalties.totalAmount = penalties.uptime.amount + penalties.p1Delays.amount +
            penalties.p2Delays.amount + penalties.p3Delays.amount + penalties.securityBreach.amount;

        return penalties;
    }

    // ── Priority Color & Badge Helpers ───────────────────────────

    function priorityClass(priority) {
        return `priority-${(priority || 'p3').toLowerCase()}`;
    }

    function statusClass(status) {
        const map = {
            'Open': 'status-open',
            'In Progress': 'status-in-progress',
            'Waiting': 'status-waiting',
            'Escalated': 'status-escalated',
            'Resolved': 'status-resolved',
            'Closed': 'status-closed'
        };
        return map[status] || 'status-open';
    }

    function slaStatusClass(slaStatus) {
        const map = {
            'On Track': 'sla-on-track',
            'At Risk': 'sla-at-risk',
            'Breached': 'sla-breached'
        };
        return map[slaStatus] || 'sla-on-track';
    }

    function slaStatusIcon(slaStatus) {
        const map = {
            'On Track': '✅',
            'At Risk': '⚠️',
            'Breached': '🔴'
        };
        return map[slaStatus] || '✅';
    }

    function priorityIcon(priority) {
        const map = {
            'P1': '🔴',
            'P2': '🟠',
            'P3': '🔵',
            'P4': '⚪'
        };
        return map[priority] || '⚪';
    }

    // ── Misc Helpers ─────────────────────────────────────────────

    function debounce(fn, delay) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    }

    function escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function generateUID() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function getCurrentMonthStr() {
        return new Date().toISOString().slice(0, 7);
    }

    function getMonthName(yearMonth) {
        const [y, m] = yearMonth.split('-').map(Number);
        return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    }

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    // ── Public API ───────────────────────────────────────────────
    return {
        // Formatting
        formatDate,
        formatDateTime,
        formatDuration,
        timeAgo,
        toLocalInputDateTime,
        fromLocalInputDateTime,

        // SLA
        computeTargetEndDate,
        computeElapsedMinutes,
        computeSLAStatus,
        computeEscalationLevel,
        computeSLACountdown,
        addBusinessMinutes,

        // Penalties
        computeMonthlyPenalties,

        // CSS class helpers
        priorityClass,
        statusClass,
        slaStatusClass,
        slaStatusIcon,
        priorityIcon,

        // Misc
        debounce,
        escapeHTML,
        generateUID,
        getCurrentMonthStr,
        getMonthName,
        fileToBase64,
        formatFileSize
    };
})();
