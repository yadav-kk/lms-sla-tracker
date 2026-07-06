/**
 * store.js — LocalStorage CRUD & Data Models
 * LMS SLA Issue Tracker
 */

const Store = (() => {
    const KEYS = {
        ISSUES: 'lms_sla_issues',
        UPTIME: 'lms_sla_uptime',
        SETTINGS: 'lms_sla_settings',
        COUNTERS: 'lms_sla_counters',
        DEV_TASKS: 'lms_sla_dev_tasks'
    };

    // ── Supabase Integration ─────────────────────────────────────
    let supabaseClient = null;

    function initSupabase() {
        const settings = _get(KEYS.SETTINGS) || {};
        
        // Read credentials from CONFIG first, fallback to settings in LocalStorage
        const enabled = (typeof CONFIG !== 'undefined' && 'supabaseEnabled' in CONFIG) ? CONFIG.supabaseEnabled : settings.supabaseEnabled;
        const url = ((typeof CONFIG !== 'undefined' && CONFIG.supabaseUrl) ? CONFIG.supabaseUrl : (settings.supabaseUrl || '')).trim();
        const key = ((typeof CONFIG !== 'undefined' && CONFIG.supabaseKey) ? CONFIG.supabaseKey : (settings.supabaseKey || '')).trim();

        if (enabled && url && key) {
            try {
                if (window.supabase) {
                    supabaseClient = window.supabase.createClient(url, key);
                }
            } catch (e) {
                console.error("Supabase initialization failed:", e);
                supabaseClient = null;
            }
        } else {
            supabaseClient = null;
        }
    }

    // Initialize Supabase immediately
    initSupabase();

    async function syncFromCloud() {
        if (!supabaseClient) {
            initSupabase();
            if (!supabaseClient) {
                throw new Error("Supabase is not configured or enabled.");
            }
        }

        try {
            // Fetch issues
            const { data: issues, error: issuesErr } = await supabaseClient
                .from('issues')
                .select('*');
            if (issuesErr) throw issuesErr;

            // Fetch uptime logs
            const { data: uptimeLogs, error: uptimeErr } = await supabaseClient
                .from('uptime_logs')
                .select('*');
            if (uptimeErr) throw uptimeErr;

            // Fetch settings
            const { data: settingsArr, error: settingsErr } = await supabaseClient
                .from('settings')
                .select('*')
                .eq('id', 1);
            if (settingsErr) throw settingsErr;

            // Fetch dev tasks gracefully (in case table doesn't exist yet)
            let devTasks = null;
            try {
                const { data, error } = await supabaseClient
                    .from('dev_tasks')
                    .select('*');
                if (error) throw error;
                devTasks = data;
            } catch (e) {
                console.warn("Could not sync dev_tasks from Supabase (table might not exist yet):", e);
            }

            // Save to LocalStorage cache
            if (issues) {
                _set(KEYS.ISSUES, issues);
                // Sync issues counter based on loaded IDs
                const counters = _get(KEYS.COUNTERS) || {};
                issues.forEach(i => {
                    const parts = i.id.split('-');
                    if (parts.length >= 4) {
                        const monthKey = `LI-${parts[2]}`; // e.g. LI-July
                        const count = parseInt(parts[3], 10);
                        if (!isNaN(count) && (!counters[monthKey] || count > counters[monthKey])) {
                            counters[monthKey] = count;
                        }
                    }
                });
                _set(KEYS.COUNTERS, counters);
            }
            if (uptimeLogs) {
                const mappedLogs = uptimeLogs.map(l => ({
                    id: l.id,
                    date: l.date,
                    downtimeStart: l.startTime,
                    downtimeEnd: l.endTime,
                    durationMinutes: l.durationMinutes,
                    cause: l.cause,
                    isMaintenanceWindow: l.isMaintenance,
                    month: l.month
                }));
                _set(KEYS.UPTIME, mappedLogs);
                
                // Sync UT counter
                const counters = _get(KEYS.COUNTERS) || {};
                uptimeLogs.forEach(l => {
                    const count = parseInt(l.id.replace('UT-', ''), 10);
                    if (!isNaN(count) && (!counters['UT'] || count > counters['UT'])) {
                        counters['UT'] = count;
                    }
                });
                _set(KEYS.COUNTERS, counters);
            }
            if (devTasks) {
                // Map database underscore properties to local store camelCase
                const mappedTasks = devTasks.map(t => ({
                    id: t.id,
                    workType: t.work_type,
                    title: t.title,
                    description: t.description,
                    stage: t.stage,
                    startDate: t.start_date,
                    endDate: t.end_date,
                    implementationDate: t.implementation_date,
                    testingStatus: t.testing_status,
                    assignedTo: t.assigned_to || '',
                    createdAt: t.created_at,
                    updatedAt: t.updated_at
                }));
                _set(KEYS.DEV_TASKS, mappedTasks);
                
                // Sync DEV counter
                const counters = _get(KEYS.COUNTERS) || {};
                devTasks.forEach(t => {
                    const count = parseInt(t.id.replace('DEV-', ''), 10);
                    if (!isNaN(count) && (!counters['DEV'] || count > counters['DEV'])) {
                        counters['DEV'] = count;
                    }
                });
                _set(KEYS.COUNTERS, counters);
            }
            if (settingsArr && settingsArr.length > 0) {
                const s = settingsArr[0];
                const localSettings = _get(KEYS.SETTINGS) || {};
                const mergedSettings = {
                    ...localSettings,
                    companyName: s.companyName,
                    amcMonthlyCharge: parseFloat(s.amcMonthlyCharge) || 0,
                    reportingMonth: s.reportingMonth
                };
                _set(KEYS.SETTINGS, mergedSettings);
            }

            console.log("Successfully synchronized from Supabase Cloud Database!");
            return true;
        } catch (e) {
            console.error("Error during syncFromCloud:", e);
            throw e;
        }
    }

    async function uploadToCloud() {
        if (!supabaseClient) {
            initSupabase();
            if (!supabaseClient) {
                throw new Error("Supabase is not configured or enabled.");
            }
        }

        try {
            const issues = getIssues();
            const uptimeLogs = getUptimeLogs();
            const settings = getSettings();

            // 1. Push settings
            const { error: setErr } = await supabaseClient
                .from('settings')
                .upsert({
                    id: 1,
                    companyName: settings.companyName,
                    amcMonthlyCharge: settings.amcMonthlyCharge || 0,
                    reportingMonth: settings.reportingMonth
                });
            if (setErr) throw setErr;

            // 2. Push issues
            if (issues.length > 0) {
                const issuesToInsert = issues.map(i => ({
                    id: i.id,
                    title: i.title,
                    desc: i.description,
                    module: i.module,
                    systemIssue: i.systemIssue,
                    priority: i.priority,
                    status: i.status,
                    assignedTo: i.assignedTo,
                    startDate: i.startDate,
                    targetEndDate: i.targetEndDate,
                    actualEndDate: i.actualEndDate,
                    totalPausedMinutes: i.totalPausedMinutes || 0,
                    pausedAt: i.pausedAt,
                    pauseReason: i.pauseReason,
                    attachments: i.attachments || [],
                    notes: i.notes || []
                }));
                const { error: issErr } = await supabaseClient
                    .from('issues')
                    .upsert(issuesToInsert);
                if (issErr) throw issErr;
            }

            // 3. Push uptime logs
            if (uptimeLogs.length > 0) {
                const logsToInsert = uptimeLogs.map(l => ({
                    id: l.id,
                    date: l.date,
                    startTime: l.downtimeStart,
                    endTime: l.downtimeEnd,
                    durationMinutes: l.durationMinutes,
                    cause: l.cause,
                    isMaintenance: l.isMaintenanceWindow || false,
                    month: l.month
                }));
                const { error: uptErr } = await supabaseClient
                    .from('uptime_logs')
                    .upsert(logsToInsert);
                if (uptErr) throw uptErr;
            }

            // 4. Push dev tasks (graceful error handling if table is not created yet)
            const devTasks = getDevTasks();
            if (devTasks.length > 0) {
                const tasksToInsert = devTasks.map(t => ({
                    id: t.id,
                    work_type: t.workType,
                    title: t.title,
                    description: t.description,
                    stage: t.stage,
                    start_date: t.startDate || null,
                    end_date: t.endDate || null,
                    implementation_date: t.implementationDate || null,
                    testing_status: t.testingStatus || 'Pending',
                    assigned_to: t.assignedTo || null,
                    updated_at: t.updatedAt || new Date().toISOString()
                }));
                try {
                    const { error } = await supabaseClient
                        .from('dev_tasks')
                        .upsert(tasksToInsert);
                    if (error) throw error;
                } catch (e) {
                    console.warn("Could not upload dev_tasks to Supabase (table might not exist yet):", e);
                }
            }

            console.log("Successfully uploaded local data to Supabase Cloud Database!");
            return true;
        } catch (e) {
            console.error("Error during uploadToCloud:", e);
            throw e;
        }
    }

    // ── SLA Configuration Constants ──────────────────────────────
    const SLA_CONFIG = {
        P1: { responseMinutes: 15, resolutionMinutes: 120, label: 'Critical (P1)', color: '#ff4757' },
        P2: { responseMinutes: 60, resolutionMinutes: 720, label: 'Medium (P2)', color: '#ffa502' },
        P3: { responseMinutes: 120, resolutionMinutes: 7200, label: 'Low (P3)', color: '#3742fa' }, // 3-5 biz days ≈ 5 days max
        P4: { responseMinutes: null, resolutionMinutes: null, label: 'Planned (P4)', color: '#747d8c' }
    };

    const UPTIME_TIERS = {
        A: { min: 99.0, max: 99.5, deduction: 2, label: 'Tier A (99.0%–99.5%)' },
        B: { min: 98.0, max: 99.0, deduction: 5, label: 'Tier B (98.0%–99.0%)' },
        C: { min: 0, max: 98.0, deduction: 10, label: 'Tier C (< 98.0%)' }
    };

    const PENALTY_RATES = {
        P1_DELAY: 10,
        P2_DELAY: 5,
        P3_DELAY: 2,
        SECURITY_BREACH: 50
    };

    const STATUSES = ['Open', 'In Progress', 'Waiting', 'Escalated', 'Resolved', 'Closed'];

    const PAUSE_REASONS = [
        'Waiting for customer confirmation / UAT approval',
        'Waiting on external provider (ISP / OEM)',
        'Scheduled approved maintenance',
        'Government-related network / infrastructure outage'
    ];

    const FUNCTIONAL_MODULES = [
        'Core Platform Availability',
        'Database & Identity',
        'Security & Auditing',
        'Academic Operations',
        'Telemetry & Analytics',
        'User & Enrollments',
        'Communication Engines',
        'Access Control (RBAC)',
        'UI / UX (Frontend)',
        'Content Management',
        'Localization',
        'Maintenance'
    ];

    // Full task classification matrix
    const TASK_MATRIX = [
        { module: 'Core Platform Availability', issue: 'Total system outage (HTTP 500, White Screen of Death, "Site Cannot Be Reached")', priority: 'P1', response: '15 Minutes', resolution: '2 Hours' },
        { module: 'Core Platform Availability', issue: 'Production server crash, 100% disk utilization, or core infrastructure freeze', priority: 'P1', response: '15 Minutes', resolution: '2 Hours' },
        { module: 'Database & Identity', issue: 'Database connection drops or session storage corruption blocking user logins', priority: 'P1', response: '15 Minutes', resolution: '2 Hours' },
        { module: 'Database & Identity', issue: 'Integration gateway failures (SSO, LDAP, OAuth) locking out all users', priority: 'P1', response: '15 Minutes', resolution: '2 Hours' },
        { module: 'Security & Auditing', issue: 'Active security data leaks, unauthorized root access, or live malware injection', priority: 'P1', response: '15 Minutes', resolution: '2 Hours' },
        { module: 'Academic Operations', issue: 'Live examination module crash or total failure during runtime windows', priority: 'P1', response: '15 Minutes', resolution: '2 Hours' },
        { module: 'Telemetry & Analytics', issue: 'Tracking malfunction (SCORM/xAPI completion or quiz scores not writing to DB)', priority: 'P2', response: '60 Minutes', resolution: '12 Hours' },
        { module: 'User & Enrollments', issue: 'Automation rules or bulk manual administration enrollment jobs stalling', priority: 'P2', response: '60 Minutes', resolution: '12 Hours' },
        { module: 'Communication Engines', issue: 'Notification engine freeze (system stops sending registration or alert emails)', priority: 'P2', response: '60 Minutes', resolution: '12 Hours' },
        { module: 'Academic Operations', issue: 'Broken assessment engine preventing quiz submissions or throwing media errors', priority: 'P2', response: '60 Minutes', resolution: '12 Hours' },
        { module: 'Access Control (RBAC)', issue: 'Role/permission hierarchy elevation glitches (e.g., students seeing admin views)', priority: 'P2', response: '60 Minutes', resolution: '12 Hours' },
        { module: 'Telemetry & Analytics', issue: 'Core report builder failure or analytics export to CSV/XLSX/PDF crashing', priority: 'P2', response: '60 Minutes', resolution: '12 Hours' },
        { module: 'UI / UX (Frontend)', issue: 'UI cosmetic tweaks (button misalignments, font sizing issues, layout bugs)', priority: 'P3', response: '2 Hours', resolution: '3-5 Business Days' },
        { module: 'UI / UX (Frontend)', issue: 'Minor browser-specific layout shifting on older versions of Safari or specific mobile models', priority: 'P3', response: '2 Hours', resolution: '3-5 Business Days' },
        { module: 'Content Management', issue: 'Static content updates (replacing homepage banners, thumbnails, or footer hyperlinks)', priority: 'P3', response: '2 Hours', resolution: '3-5 Business Days' },
        { module: 'Localization', issue: 'Modifying language packs, string translation files, or fixing typos', priority: 'P3', response: '2 Hours', resolution: '3-5 Business Days' },
        { module: 'Maintenance', issue: 'Routine, non-critical core/plugin minor version updates or application patching', priority: 'P3', response: '2 Hours', resolution: '3-5 Business Days' },
        { module: 'Telemetry & Analytics', issue: 'Writing a brand-new custom SQL report query or manually structuring a custom data view', priority: 'P3', response: '2 Hours', resolution: '3-5 Business Days' }
    ];

    // Escalation contacts
    const ESCALATION_CONTACTS = [
        { level: 1, designation: 'Helpdesk / Resident Engineer', names: ['Arif', 'Harvinder'], emails: ['arifansari@reospark.com', 'harvinder.anan@gmail.com'], phones: ['9871264243', '9801298785'] },
        { level: 2, designation: 'Specialist Engineer', names: ['Pradeep', 'Arif'], emails: ['pradeep@reospark.com'], phones: ['9386292565', '9801298785'] },
        { level: 3, designation: 'LMS Administration', names: ['Krishankant Yadav'], emails: ['krishankant.yadav@literacyindia.org'], phones: ['8743080876'] },
        { level: 4, designation: 'Project Manager', names: ['OP Meenu', 'Priyesh Tiwari'], emails: ['opmeenu@gmail.com','priyesh.cbtech@gmail.com'], phones: ['9999644218', '7217766185'] },
        { level: 5, designation: 'Project Director', names: ['Sunil Kumar Singh'], emails: ['sunilkumarsingh@literacyindia.org'], phones: ['9811820027'] }
    ];

    // Escalation timelines (minutes)
    const ESCALATION_TIMELINES = {
        P1: [
            { level: 1, label: 'Helpdesk', afterMinutes: 0 },
            { level: 2, label: 'Specialist Engineer', afterMinutes: 15 },
            { level: 3, label: 'LMS Administration', afterMinutes: 30 },
            { level: 4, label: 'Project Manager', afterMinutes: 60 },
            { level: 5, label: 'Project Director', afterMinutes: 120 }
        ],
        P2: [
            { level: 1, label: 'Helpdesk', afterMinutes: 0 },
            { level: 2, label: 'Specialist Engineer', afterMinutes: 60 },
            { level: 3, label: 'LMS Administration', afterMinutes: 240 },
            { level: 4, label: 'Project Manager', afterMinutes: 480 },
            { level: 5, label: 'Project Director', afterMinutes: 720 }
        ],
        P3: [
            { level: 1, label: 'Helpdesk', afterMinutes: 0 },
            { level: 2, label: 'Specialist Engineer', afterMinutes: 1440 },  // Day 2
            { level: 3, label: 'LMS Administration', afterMinutes: 2880 },   // Day 3
            { level: 4, label: 'Project Manager', afterMinutes: 5760 },     // Day 4
            { level: 5, label: 'Project Director', afterMinutes: 7200 }     // Day 5
        ]
    };

    // ── Generic localStorage Helpers ─────────────────────────────
    function _get(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.error(`Store._get error for key "${key}":`, e);
            return null;
        }
    }

    function _set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error(`Store._set error for key "${key}":`, e);
            if (e.name === 'QuotaExceededError') {
                alert('⚠️ Local storage is full. Please export your data and clear old entries.');
            }
        }
    }

    // ── ID Generation ────────────────────────────────────────────
    function _nextId(prefix) {
        const counters = _get(KEYS.COUNTERS) || {};
        const current = counters[prefix] || 0;
        counters[prefix] = current + 1;
        _set(KEYS.COUNTERS, counters);
        return `${prefix}-${String(current + 1).padStart(4, '0')}`;
    }

    function _generateIssueId(priority, startDateISO) {
        const date = new Date(startDateISO || new Date());
        const monthName = date.toLocaleDateString('en-US', { month: 'long' }); // e.g. "July"
        const counters = _get(KEYS.COUNTERS) || {};
        const key = `LI-${monthName}`;
        const current = counters[key] || 0;
        counters[key] = current + 1;
        _set(KEYS.COUNTERS, counters);
        return `LI-${priority}-${monthName}-${String(current + 1).padStart(3, '0')}`;
    }

    // ── Issues CRUD ──────────────────────────────────────────────
    function getIssues() {
        return _get(KEYS.ISSUES) || [];
    }

    function getIssueById(id) {
        return getIssues().find(i => i.id === id) || null;
    }

    function createIssue(data) {
        const issues = getIssues();
        const now = new Date().toISOString();
        const priority = data.priority || 'P3';
        const startDate = data.startDate || now;
        const generatedId = _generateIssueId(priority, startDate);

        const issue = {
            id: data.id || generatedId,
            title: data.title || '',
            description: data.description || '',
            priority: priority,
            status: data.status || 'Open',
            module: data.module || '',
            systemIssue: data.systemIssue || '',
            assignedTo: data.assignedTo || '',
            startDate: startDate,
            targetEndDate: data.targetEndDate || null,
            actualEndDate: data.actualEndDate || null,
            responseTime: data.responseTime || null,
            resolutionTime: data.resolutionTime || null,
            slaStatus: data.slaStatus || 'On Track',
            attachments: data.attachments || [],
            pauseReason: null,
            pausedAt: null,
            totalPausedMinutes: 0,
            escalationLevel: 1,
            notes: data.notes || [],
            createdAt: now,
            updatedAt: now
        };
        issues.push(issue);
        _set(KEYS.ISSUES, issues);
        
        // Supabase Background Sync
        if (supabaseClient) {
            supabaseClient.from('issues').insert([{
                id: issue.id,
                title: issue.title,
                desc: issue.description,
                module: issue.module,
                systemIssue: issue.systemIssue,
                priority: issue.priority,
                status: issue.status,
                assignedTo: issue.assignedTo,
                startDate: issue.startDate,
                targetEndDate: issue.targetEndDate,
                actualEndDate: issue.actualEndDate,
                totalPausedMinutes: issue.totalPausedMinutes || 0,
                pausedAt: issue.pausedAt,
                pauseReason: issue.pauseReason,
                attachments: issue.attachments || [],
                notes: issue.notes || []
            }]).then(({ error }) => {
                if (error) console.error("Supabase createIssue background sync error:", error);
            });
        }
        
        return issue;
    }

    function updateIssue(id, updates) {
        const issues = getIssues();
        const idx = issues.findIndex(i => i.id === id);
        if (idx === -1) return null;
        issues[idx] = { ...issues[idx], ...updates, updatedAt: new Date().toISOString() };
        _set(KEYS.ISSUES, issues);
        
        // Supabase Background Sync
        const issue = issues[idx];
        if (supabaseClient) {
            const dbUpdates = {};
            if ('title' in updates) dbUpdates.title = updates.title;
            if ('description' in updates) dbUpdates.desc = updates.description;
            if ('module' in updates) dbUpdates.module = updates.module;
            if ('systemIssue' in updates) dbUpdates.systemIssue = updates.systemIssue;
            if ('priority' in updates) dbUpdates.priority = updates.priority;
            if ('status' in updates) dbUpdates.status = updates.status;
            if ('assignedTo' in updates) dbUpdates.assignedTo = updates.assignedTo;
            if ('startDate' in updates) dbUpdates.startDate = updates.startDate;
            if ('targetEndDate' in updates) dbUpdates.targetEndDate = updates.targetEndDate;
            if ('actualEndDate' in updates) dbUpdates.actualEndDate = updates.actualEndDate;
            if ('totalPausedMinutes' in updates) dbUpdates.totalPausedMinutes = updates.totalPausedMinutes;
            if ('pausedAt' in updates) dbUpdates.pausedAt = updates.pausedAt;
            if ('pauseReason' in updates) dbUpdates.pauseReason = updates.pauseReason;
            if ('attachments' in updates) dbUpdates.attachments = updates.attachments;
            if ('notes' in updates) dbUpdates.notes = updates.notes;
            dbUpdates.updatedAt = issue.updatedAt;

            supabaseClient.from('issues').update(dbUpdates).eq('id', id).then(({ error }) => {
                if (error) console.error("Supabase updateIssue background sync error:", error);
            });
        }
        
        return issues[idx];
    }

    function deleteIssue(id) {
        const issues = getIssues().filter(i => i.id !== id);
        _set(KEYS.ISSUES, issues);
        
        // Supabase Background Sync
        if (supabaseClient) {
            supabaseClient.from('issues').delete().eq('id', id).then(({ error }) => {
                if (error) console.error("Supabase deleteIssue background sync error:", error);
            });
        }
    }

    function addIssueNote(id, noteText, author) {
        const issue = getIssueById(id);
        if (!issue) return null;
        const notes = issue.notes || [];
        notes.push({
            timestamp: new Date().toISOString(),
            author: author || 'System',
            text: noteText
        });
        return updateIssue(id, { notes });
    }

    function addIssueAttachment(id, attachment) {
        const issue = getIssueById(id);
        if (!issue) return null;
        const attachments = issue.attachments || [];
        attachments.push(attachment);
        return updateIssue(id, { attachments });
    }

    function removeIssueAttachment(id, attachmentIndex) {
        const issue = getIssueById(id);
        if (!issue) return null;
        const attachments = issue.attachments || [];
        attachments.splice(attachmentIndex, 1);
        return updateIssue(id, { attachments });
    }

    // ── Uptime Logs CRUD ─────────────────────────────────────────
    function getUptimeLogs() {
        return _get(KEYS.UPTIME) || [];
    }

    function getUptimeLogsByMonth(yearMonth) {
        return getUptimeLogs().filter(l => l.month === yearMonth);
    }

    function createUptimeLog(data) {
        const logs = getUptimeLogs();
        const log = {
            id: _nextId('UT'),
            date: data.date || new Date().toISOString().slice(0, 10),
            downtimeStart: data.downtimeStart || '',
            downtimeEnd: data.downtimeEnd || '',
            durationMinutes: data.durationMinutes || 0,
            cause: data.cause || '',
            isMaintenanceWindow: data.isMaintenanceWindow || false,
            month: data.month || new Date().toISOString().slice(0, 7),
            createdAt: new Date().toISOString()
        };
        logs.push(log);
        _set(KEYS.UPTIME, logs);
        
        // Supabase Background Sync
        if (supabaseClient) {
            supabaseClient.from('uptime_logs').insert([{
                id: log.id,
                date: log.date,
                startTime: log.downtimeStart,
                endTime: log.downtimeEnd,
                durationMinutes: log.durationMinutes,
                cause: log.cause,
                isMaintenance: log.isMaintenanceWindow,
                month: log.month
            }]).then(({ error }) => {
                if (error) console.error("Supabase createUptimeLog background sync error:", error);
            });
        }
        
        return log;
    }

    function updateUptimeLog(id, updates) {
        const logs = getUptimeLogs();
        const idx = logs.findIndex(l => l.id === id);
        if (idx === -1) return null;
        logs[idx] = { ...logs[idx], ...updates };
        _set(KEYS.UPTIME, logs);
        
        // Supabase Background Sync
        if (supabaseClient) {
            const dbUpdates = {};
            if ('date' in updates) dbUpdates.date = updates.date;
            if ('downtimeStart' in updates) dbUpdates.startTime = updates.downtimeStart;
            if ('downtimeEnd' in updates) dbUpdates.endTime = updates.downtimeEnd;
            if ('durationMinutes' in updates) dbUpdates.durationMinutes = updates.durationMinutes;
            if ('cause' in updates) dbUpdates.cause = updates.cause;
            if ('isMaintenanceWindow' in updates) dbUpdates.isMaintenance = updates.isMaintenanceWindow;
            if ('month' in updates) dbUpdates.month = updates.month;

            supabaseClient.from('uptime_logs').update(dbUpdates).eq('id', id).then(({ error }) => {
                if (error) console.error("Supabase updateUptimeLog background sync error:", error);
            });
        }
        
        return logs[idx];
    }

    function deleteUptimeLog(id) {
        const logs = getUptimeLogs().filter(l => l.id !== id);
        _set(KEYS.UPTIME, logs);
        
        // Supabase Background Sync
        if (supabaseClient) {
            supabaseClient.from('uptime_logs').delete().eq('id', id).then(({ error }) => {
                if (error) console.error("Supabase deleteUptimeLog background sync error:", error);
            });
        }
    }

    // ── Development Tasks CRUD ───────────────────────────────────
    const SEED_DEV_TASKS = [
        { workType: 'Teacher Profile', title: 'Add Filter on Teacher Module', description: 'Implement filter functionality in the teacher module and generate filtered reports.' },
        { workType: 'Teacher Profile', title: 'Assigned Syllabus', description: 'Allow extraction of syllabus in Excel or PDF format (as per given template).' },
        { workType: 'Teacher Profile', title: 'Assigned Syllabus', description: 'Add a trigger to reassign topics to students.' },
        { workType: 'Teacher Profile', title: 'Batch Change Functionality', description: 'Currently, once a batch is assigned to a student, it cannot be changed. The new approach should allow teachers (and users with student creation/upgradation rights) to update the batch of any student.' },
        { workType: 'Teacher Profile', title: 'Granular Content Flow & Subject Control', description: 'To provide a flexible enrolment system that defaults to the standard Gyantantra Pedology for mass student onboarding while allowing teachers to customize Content Flow (Pedology vs. Freeflow) and Subject Availability for individual students' },
        { workType: 'Teacher Profile', title: 'Question Paper Download', description: 'Update the time and size of test paper downlad. Currently the size of paper is so long.' },
        { workType: 'Teacher Profile', title: 'Question Paper Download', description: 'A Button which can download the filled paper.' },
        { workType: 'Teacher Profile', title: 'Syllabus Report Module Update', description: 'Add filter functionality so that data is displayed based on selected criteria.' },
        { workType: 'Teacher Profile', title: 'Syllabus Report Module Update', description: 'Columns are currently static, suitable only for Classes 3–5. For other classes where major subjects differ, dynamic column handling is required.' },
        { workType: 'Teacher Profile', title: 'Test List Module UI', description: 'Add columns for revision, exam completion date, and results (Passed/Needs Revision). Status buttons should use color coding (Red = Pending, Green = Approved).' },
        { workType: 'Teacher Profile', title: 'Test List Module UI', description: 'Update offline paper download process so a button is visible when offline papers are available.' },
        { workType: 'Teacher Profile', title: 'Test List Module UI', description: 'Enable export of test lists to Excel for basic analysis.' },
        { workType: 'Teacher Profile', title: 'Test List Module UI', description: 'Add time tracking to display total duration taken by a user to complete tests (including pre-tests).' },
        { workType: 'Teacher Profile', title: 'Test List Module UI', description: 'Track all assessments completed by a student.' },
        { workType: 'LMS', title: 'Grade card and Certificate verify module', description: 'On Login page there is a module attached to verify certificate and download grade card. (login us done using certificate no. Username, Email Id.' },
        { workType: 'Student', title: 'Completion Animation', description: 'An Completion animation after pass the post Test.' },
        { workType: 'Student', title: 'Grade Card', description: 'A Student can download his/her grade card even between the course progress.' },
        { workType: 'Student', title: 'Pre‑Test Date on Dashboard', description: 'Pre‑Test date displayed on Student Dashboard, set as Date of Admission' },
        { workType: 'Student', title: 'Term & Condition Page', description: 'A New UI for Term and condition for all user.' },
        { workType: 'Teacher Profile', title: 'Grade Card', description: 'Display only the subjects aligned with the selected student.' },
        { workType: 'Teacher Profile', title: 'Restructuring of Seen/Unseen', description: 'Move this module from the dashboard to the service section with full functionality.' },
        { workType: 'Teacher Profile', title: 'Restructuring of Seen/Unseen', description: 'Display only the main topic (e.g., one topic with 10 slides should appear as a single entry). Provide a dropdown to view the full menu.' },
        { workType: 'Teacher Profile', title: 'Restructuring of Seen/Unseen', description: 'Add an approval button for teachers to review progress and reassign topics to students.' },
        { workType: 'LMS', title: 'SMTP Configuration', description: 'Configure SMTP for LMS.' },
        { workType: 'Admin / Super Admin', title: 'Master module', description: 'Master for Subject Icons' },
        { workType: 'Admin / Super Admin', title: 'Organization', description: 'User Control for Admin of various Orgnization' },
        { workType: 'Admin / Super Admin', title: 'Organization', description: 'User Control for all the user.' },
        { workType: 'Admin / Super Admin', title: 'Master Module – Content Management', description: 'For Content Admin' },
        { workType: 'LMS', title: 'Specific module for Assignment', description: 'A specific module on LMS is only for assesments, mean for this there is no need for any content to be completed for tests.' },
        { workType: 'Coordinator', title: 'LMS UI', description: 'Add dynamic centre filter (multiple choice).' },
        { workType: 'Coordinator', title: 'Assigned Syllabus', description: 'Provide a specific module for coordinators and higher users to complete topics for any aligned student.' },
        { workType: 'Coordinator', title: 'Excel Report', description: 'Coordinators can download reports for multiple centres.' },
        { workType: 'Coordinator', title: 'LMS Module', description: 'Coordinators have access to all modules aligned to teacher IDs.' },
        { workType: 'Coordinator', title: 'Restructuring of Seen/Unseen', description: 'Coordinators can approve and review work done by teachers.' },
        { workType: 'Director & Trustees', title: 'LMS UI', description: 'Add dynamic filters for Centre & Coordinator (multiple choice).' },
        { workType: 'Director & Trustees', title: 'Assigned Syllabus', description: 'Provide a specific module for managers and higher users to complete topics for any aligned student.' },
        { workType: 'Director & Trustees', title: 'Excel Report', description: 'Managers can download reports for multiple centres (Including Partner)' },
        { workType: 'Director & Trustees', title: 'LMS Module', description: 'Managers have access to all modules aligned to teacher & Co-ordinator IDs.' },
        { workType: 'Director & Trustees', title: 'Restructuring of Seen/Unseen', description: 'Managers can approve and review work done by teachers & Co-ordinator.' },
        { workType: 'Director & Trustees', title: 'User Deletion Rights', description: 'Managers can add or delete any user lower in hierarchy (e.g., Students).' },
        { workType: 'GyanTantra APK', title: 'Offline Login System', description: 'The LMS allows multiple students to continue their learning progress offline' },
        { workType: 'Manager', title: 'LMS UI', description: 'Add dynamic filters for Centre & Coordinator (multiple choice).' },
        { workType: 'Manager', title: 'Assigned Syllabus', description: 'Provide a specific module for managers and higher users to complete topics for any aligned student.' },
        { workType: 'Manager', title: 'Excel Report', description: 'Managers can download reports for multiple centres.' },
        { workType: 'Manager', title: 'LMS Module', description: 'Managers have access to all modules aligned to teacher & Co-ordinator IDs.' },
        { workType: 'Manager', title: 'Restructuring of Seen/Unseen', description: 'Managers can approve and review work done by teachers & Co-ordinator.' },
        { workType: 'Manager', title: 'User Deletion Rights', description: 'Managers can add or delete any user lower in hierarchy (e.g., Students).' },
        { workType: 'Manager', title: 'Dashboard', description: 'Create a dedicated dashboard for Managers.' },
        { workType: 'Teacher Profile', title: 'Dashboard', description: 'Create a dedicated dashboard for Teacher' },
        { workType: 'Coordinator', title: 'Dashboard', description: 'Create a dedicated dashboard for Coordinators.' },
        { workType: 'Director & Trustees', title: 'Dashboard', description: 'Create a dedicated dashboard for Managers.' },
        { workType: 'Admin / Super Admin', title: 'Master Module – Terms & Conditions', description: 'Master module for Terms & Conditions' },
        { workType: 'Admin / Super Admin', title: 'Master Module – Organization Management', description: 'Master module for Organization' },
        { workType: 'Admin / Super Admin', title: 'Master Module – Contact Us', description: 'Module for managing “Contact Us”' },
        { workType: 'Admin / Super Admin', title: 'All Access of LMS', description: 'Admins must have complete access to the LMS within their organization, with the ability to perform all CRUD (Create, Read, Update, Delete) operations on any module or content.' },
        { workType: 'LMS', title: 'Analytics Dashboard', description: 'Provide visual dashboards with exportable reports.' },
        { workType: 'LMS', title: 'Liaison Members – New UI', description: 'Develop a complete UI for all management users including Director, Trustee, Manager, Faculty, Coordinator, and others.' },
        { workType: 'LMS', title: 'Profile', description: 'Update profile module for all the user.' },
        { workType: 'LMS', title: 'Notification & Alerts System', description: 'Integrate email/SMS/in-app notifications for events like test completion, syllabus updates, or pending approvals.' },
        { workType: 'LMS', title: 'Two‑Way Integration – Literacy India BMS', description: 'Integration between GyanTantra LMS and Literacy India Website, for enrollment & Marks Transfer & Alumini Section.' }
    ];

    function getDevTasks() {
        let tasks = _get(KEYS.DEV_TASKS);
        if (!tasks || tasks.length === 0) {
            // Seed the 60 tasks
            tasks = SEED_DEV_TASKS.map((t, idx) => {
                const num = idx + 1;
                return {
                    id: `DEV-${String(num).padStart(4, '0')}`,
                    workType: t.workType,
                    title: t.title,
                    description: t.description,
                    stage: 1,
                    startDate: null,
                    endDate: null,
                    implementationDate: null,
                    testingStatus: 'Pending',
                    assignedTo: '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
            });
            _set(KEYS.DEV_TASKS, tasks);
            
            // Set DEV counter
            const counters = _get(KEYS.COUNTERS) || {};
            counters['DEV'] = tasks.length;
            _set(KEYS.COUNTERS, counters);
        }
        return tasks;
    }

    function createDevTask(data) {
        const tasks = getDevTasks();
        const now = new Date().toISOString();
        const id = _nextId('DEV');
        const task = {
            id,
            workType: data.workType || 'LMS',
            title: data.title || '',
            description: data.description || '',
            stage: parseInt(data.stage, 10) || 1,
            startDate: data.startDate || null,
            endDate: data.endDate || null,
            implementationDate: data.implementationDate || null,
            testingStatus: data.testingStatus || 'Pending',
            assignedTo: data.assignedTo || '',
            createdAt: now,
            updatedAt: now
        };
        tasks.push(task);
        _set(KEYS.DEV_TASKS, tasks);

        // Supabase Background Sync
        if (supabaseClient) {
            supabaseClient.from('dev_tasks').insert([{
                id: task.id,
                work_type: task.workType,
                title: task.title,
                description: task.description,
                stage: task.stage,
                start_date: task.startDate,
                end_date: task.endDate,
                implementation_date: task.implementationDate,
                testing_status: task.testingStatus,
                assigned_to: task.assignedTo || null
            }]).then(({ error }) => {
                if (error) console.error("Supabase createDevTask background sync error:", error);
            });
        }

        return task;
    }

    function updateDevTask(id, updates) {
        const tasks = getDevTasks();
        const idx = tasks.findIndex(t => t.id === id);
        if (idx === -1) return null;
        
        const now = new Date().toISOString();
        tasks[idx] = { ...tasks[idx], ...updates, updatedAt: now };
        _set(KEYS.DEV_TASKS, tasks);

        // Supabase Background Sync
        if (supabaseClient) {
            const dbUpdates = { updated_at: now };
            if ('workType' in updates) dbUpdates.work_type = updates.workType;
            if ('title' in updates) dbUpdates.title = updates.title;
            if ('description' in updates) dbUpdates.description = updates.description;
            if ('stage' in updates) dbUpdates.stage = parseInt(updates.stage, 10);
            if ('startDate' in updates) dbUpdates.start_date = updates.startDate;
            if ('endDate' in updates) dbUpdates.end_date = updates.endDate;
            if ('implementationDate' in updates) dbUpdates.implementation_date = updates.implementationDate;
            if ('testingStatus' in updates) dbUpdates.testing_status = updates.testingStatus;
            if ('assignedTo' in updates) dbUpdates.assigned_to = updates.assignedTo || null;

            supabaseClient.from('dev_tasks').update(dbUpdates).eq('id', id).then(({ error }) => {
                if (error) console.error("Supabase updateDevTask background sync error:", error);
            });
        }

        return tasks[idx];
    }

    function deleteDevTask(id) {
        const tasks = getDevTasks().filter(t => t.id !== id);
        _set(KEYS.DEV_TASKS, tasks);

        // Supabase Background Sync
        if (supabaseClient) {
            supabaseClient.from('dev_tasks').delete().eq('id', id).then(({ error }) => {
                if (error) console.error("Supabase deleteDevTask background sync error:", error);
            });
        }
    }

    // ── Settings ─────────────────────────────────────────────────
    function getSettings() {
        return _get(KEYS.SETTINGS) || {
            amcMonthlyCharge: 0,
            companyName: 'LMS Operations',
            reportingMonth: new Date().toISOString().slice(0, 7)
        };
    }

    function updateSettings(updates) {
        const settings = { ...getSettings(), ...updates };
        _set(KEYS.SETTINGS, settings);
        
        // Re-initialize Supabase client if enabled/credentials changed
        initSupabase();
        
        // Supabase Background Sync
        if (supabaseClient) {
            supabaseClient.from('settings').upsert({
                id: 1,
                companyName: settings.companyName,
                amcMonthlyCharge: settings.amcMonthlyCharge || 0,
                reportingMonth: settings.reportingMonth
            }).then(({ error }) => {
                if (error) console.error("Supabase updateSettings background sync error:", error);
            });
        }
        return settings;
    }

    // ── Computed Helpers ─────────────────────────────────────────
    function getIssuesByPriority(priority) {
        return getIssues().filter(i => i.priority === priority);
    }

    function getIssuesByStatus(status) {
        return getIssues().filter(i => i.status === status);
    }

    function getOpenIssues() {
        return getIssues().filter(i => !['Resolved', 'Closed'].includes(i.status));
    }

    function getBreachedIssuesThisMonth() {
        const now = new Date();
        const monthStr = now.toISOString().slice(0, 7);
        return getIssues().filter(i => {
            return i.slaStatus === 'Breached' && i.startDate && i.startDate.slice(0, 7) === monthStr;
        });
    }

    function getMonthlyUptimePercent(yearMonth) {
        const logs = getUptimeLogsByMonth(yearMonth);
        // Total minutes in the month
        const [year, month] = yearMonth.split('-').map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();
        const totalMinutes = daysInMonth * 24 * 60;

        // Sum non-maintenance downtime
        const downtimeMinutes = logs
            .filter(l => !l.isMaintenanceWindow)
            .reduce((sum, l) => sum + (l.durationMinutes || 0), 0);

        if (totalMinutes === 0) return 100;
        return Math.max(0, ((totalMinutes - downtimeMinutes) / totalMinutes) * 100);
    }

    function getUptimePenaltyTier(uptimePercent) {
        if (uptimePercent >= 99.5) return null;
        if (uptimePercent >= 99.0) return UPTIME_TIERS.A;
        if (uptimePercent >= 98.0) return UPTIME_TIERS.B;
        return UPTIME_TIERS.C;
    }

    // ── Export All Data ──────────────────────────────────────────
    function exportAllData() {
        return {
            issues: getIssues(),
            uptimeLogs: getUptimeLogs(),
            settings: getSettings(),
            exportedAt: new Date().toISOString()
        };
    }

    function importData(data) {
        if (data.issues) _set(KEYS.ISSUES, data.issues);
        if (data.uptimeLogs) _set(KEYS.UPTIME, data.uptimeLogs);
        if (data.settings) _set(KEYS.SETTINGS, data.settings);
    }

    function clearAllData() {
        Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    }

    // ── Seeding ──────────────────────────────────────────────────
    function seed() {
        const url = (typeof CONFIG !== 'undefined' && CONFIG.supabaseUrl);
        const key = (typeof CONFIG !== 'undefined' && CONFIG.supabaseKey);
        const enabled = (typeof CONFIG !== 'undefined' && CONFIG.supabaseEnabled);
        
        if (enabled && url && key) {
            // Initialize empty LocalStorage caches so we don't seed local mock data
            if (_get(KEYS.ISSUES) === null) _set(KEYS.ISSUES, []);
            if (_get(KEYS.UPTIME) === null) _set(KEYS.UPTIME, []);
            if (_get(KEYS.SETTINGS) === null) {
                const now = new Date();
                const currentMonth = now.toISOString().slice(0, 7);
                _set(KEYS.SETTINGS, {
                    amcMonthlyCharge: 150000,
                    companyName: 'Acme Academy LMS Support',
                    reportingMonth: currentMonth
                });
            }
            return;
        }

        if (_get(KEYS.ISSUES) !== null) return; // already initialized or cleared explicitly

        const now = new Date();
        const currentMonth = now.toISOString().slice(0, 7);
        const monthName = now.toLocaleDateString('en-US', { month: 'long' }); // e.g. "July"

        // 1. Initial settings
        _set(KEYS.SETTINGS, {
            amcMonthlyCharge: 150000,
            companyName: 'Acme Academy LMS Support',
            reportingMonth: currentMonth
        });

        // Initialize counters
        _set(KEYS.COUNTERS, {
            [`LI-${monthName}`]: 1,
            UT: 0
        });

        // 2. Initial uptime logs (empty)
        _set(KEYS.UPTIME, []);

        // 3. Initial issues (Only the WhatsApp ticket)
        const issues = [
            {
                id: `LI-P2-${monthName}-001`,
                title: 'Not working of Test paper download functionality',
                description: 'Test paper download functionality is not working for students. Checked logs, getting access denied error from S3 bucket. Ticket raised via WhatsApp.',
                priority: 'P2',
                status: 'Open',
                module: 'Academic Operations',
                systemIssue: 'Broken assessment engine preventing quiz submissions or throwing media errors',
                assignedTo: 'Arif',
                startDate: new Date('2026-07-04T14:52:00+05:30').toISOString(),
                targetEndDate: new Date('2026-07-06T17:52:00+05:30').toISOString(), // SLA resolution 12 business hours
                actualEndDate: null,
                responseTime: null,
                resolutionTime: null,
                slaStatus: 'On Track',
                attachments: [],
                pauseReason: null,
                pausedAt: null,
                totalPausedMinutes: 0,
                escalationLevel: 1,
                notes: [
                    { timestamp: new Date('2026-07-04T14:52:00+05:30').toISOString(), author: 'System', text: 'Ticket raised via WhatsApp.' }
                ],
                createdAt: new Date('2026-07-04T14:52:00+05:30').toISOString(),
                updatedAt: new Date('2026-07-04T14:52:00+05:30').toISOString()
            }
        ];
        _set(KEYS.ISSUES, issues);
    }

    // Run seeding
    seed();

    // ── Public API ───────────────────────────────────────────────
    return {
        // Constants
        SLA_CONFIG,
        UPTIME_TIERS,
        PENALTY_RATES,
        STATUSES,
        PAUSE_REASONS,
        FUNCTIONAL_MODULES,
        TASK_MATRIX,
        ESCALATION_CONTACTS,
        ESCALATION_TIMELINES,

        // Issues
        getIssues,
        getIssueById,
        createIssue,
        updateIssue,
        deleteIssue,
        addIssueNote,
        addIssueAttachment,
        removeIssueAttachment,

        // Uptime
        getUptimeLogs,
        getUptimeLogsByMonth,
        createUptimeLog,
        updateUptimeLog,
        deleteUptimeLog,

        // Dev Tasks
        getDevTasks,
        createDevTask,
        updateDevTask,
        deleteDevTask,

        // Settings
        getSettings,
        updateSettings,

        // Computed
        getIssuesByPriority,
        getIssuesByStatus,
        getOpenIssues,
        getBreachedIssuesThisMonth,
        getMonthlyUptimePercent,
        getUptimePenaltyTier,

        // Data management
        exportAllData,
        importData,
        clearAllData,

        // Supabase Cloud database connection
        initSupabase,
        syncFromCloud,
        uploadToCloud,
        isSupabaseEnabled: () => {
            if (!supabaseClient) initSupabase();
            return !!supabaseClient;
        }
    };
})();
