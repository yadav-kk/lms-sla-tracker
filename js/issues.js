/**
 * issues.js — Issue Tracker Page Module
 * LMS SLA Issue Tracker
 *
 * Provides two view modes (Table / Kanban Board), filtering, sorting,
 * full CRUD modal with SLA pause/resume, attachments, and activity notes.
 */

/* global Store, Utils, App, ExportHelper */

const IssuesPage = (() => {

    // ── State ────────────────────────────────────────────────────
    let _container = null;
    let _viewMode = 'table';   // 'table' | 'board'
    let _sort = { column: 'startDate', direction: 'desc' };
    let _filters = { priority: 'all', status: 'all', module: 'all', search: '' };

    // ── Public render entry point ────────────────────────────────
    function render(container) {
        _container = container;
        _container.innerHTML = '';

        // Page header
        const header = document.createElement('div');
        header.className = 'page-header';
        header.innerHTML = `
            <div>
                <h1 class="page-title">Issue Tracker</h1>
                <p class="page-subtitle">Manage and track all SLA issues</p>
            </div>`;
        _container.appendChild(header);

        // Toolbar: view toggle + actions
        const toolbar = document.createElement('div');
        toolbar.id = 'issues-toolbar';
        toolbar.className = 'issues-toolbar';
        toolbar.innerHTML = `
            <div class="issues-view-tabs" id="issues-view-tabs">
                <button class="view-tab ${_viewMode === 'table' ? 'active' : ''}" data-view="table">
                    <span class="view-tab-icon">☰</span> Table View
                </button>
                <button class="view-tab ${_viewMode === 'board' ? 'active' : ''}" data-view="board">
                    <span class="view-tab-icon">▦</span> Board View
                </button>
            </div>
            <div class="issues-actions">
                <button class="btn btn-primary" id="issues-btn-new">＋ New Issue</button>
                <button class="btn btn-secondary" id="issues-btn-export">📥 Export Excel</button>
                <button class="btn btn-secondary" id="issues-btn-print">🖨️ Print</button>
            </div>`;
        _container.appendChild(toolbar);

        // Filter bar
        const filterBar = document.createElement('div');
        filterBar.id = 'issues-filter-bar';
        filterBar.className = 'issues-filter-bar';
        renderFilters(filterBar);
        _container.appendChild(filterBar);

        // Content area (table or board)
        const content = document.createElement('div');
        content.id = 'issues-content';
        content.className = 'issues-content';
        _container.appendChild(content);

        // Render the active view
        _renderCurrentView();

        // ── Event delegation ─────────────────────────────────────
        toolbar.addEventListener('click', (e) => {
            // View tabs
            const tab = e.target.closest('.view-tab');
            if (tab) {
                _viewMode = tab.dataset.view;
                toolbar.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                _renderCurrentView();
                return;
            }
            // Action buttons
            if (e.target.closest('#issues-btn-new')) { openIssueModal(null); return; }
            if (e.target.closest('#issues-btn-export')) {
                if (typeof ExportHelper !== 'undefined' && ExportHelper.exportIssuesToExcel) {
                    ExportHelper.exportIssuesToExcel();
                } else {
                    App.showToast('Export helper not available', 'warning');
                }
                return;
            }
            if (e.target.closest('#issues-btn-print')) { window.print(); }
        });
    }

    // ── Re-render active view into #issues-content ───────────────
    function _renderCurrentView() {
        const content = document.getElementById('issues-content');
        if (!content) return;
        content.innerHTML = '';

        const issues = getFilteredIssues();
        if (_viewMode === 'table') {
            renderTableView(content, issues);
        } else {
            renderBoardView(content, issues);
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  FILTERS
    // ══════════════════════════════════════════════════════════════

    function renderFilters(container) {
        // Flatten all assignee names from escalation contacts
        const allNames = _getAllAssigneeNames();

        container.innerHTML = `
            <div class="filter-group filter-chips" id="issues-priority-chips">
                <label class="filter-label">Priority</label>
                <button class="chip ${_filters.priority === 'all' ? 'active' : ''}" data-priority="all">All</button>
                <button class="chip chip-p1 ${_filters.priority === 'P1' ? 'active' : ''}" data-priority="P1">P1</button>
                <button class="chip chip-p2 ${_filters.priority === 'P2' ? 'active' : ''}" data-priority="P2">P2</button>
                <button class="chip chip-p3 ${_filters.priority === 'P3' ? 'active' : ''}" data-priority="P3">P3</button>
                <button class="chip chip-p4 ${_filters.priority === 'P4' ? 'active' : ''}" data-priority="P4">P4</button>
            </div>
            <div class="filter-group">
                <label class="filter-label" for="issues-filter-status">Status</label>
                <select class="form-select form-select-sm" id="issues-filter-status">
                    <option value="all" ${_filters.status === 'all' ? 'selected' : ''}>All Statuses</option>
                    ${Store.STATUSES.map(s =>
                        `<option value="${s}" ${_filters.status === s ? 'selected' : ''}>${s}</option>`
                    ).join('')}
                </select>
            </div>
            <div class="filter-group">
                <label class="filter-label" for="issues-filter-module">Module</label>
                <select class="form-select form-select-sm" id="issues-filter-module">
                    <option value="all" ${_filters.module === 'all' ? 'selected' : ''}>All Modules</option>
                    ${Store.FUNCTIONAL_MODULES.map(m =>
                        `<option value="${Utils.escapeHTML(m)}" ${_filters.module === m ? 'selected' : ''}>${Utils.escapeHTML(m)}</option>`
                    ).join('')}
                </select>
            </div>
            <div class="filter-group filter-search">
                <label class="filter-label" for="issues-filter-search">Search</label>
                <input type="text" class="form-input form-input-sm" id="issues-filter-search"
                       placeholder="Search title or description…" value="${Utils.escapeHTML(_filters.search)}">
            </div>`;

        // Bind filter events
        container.addEventListener('click', (e) => {
            const chip = e.target.closest('.chip[data-priority]');
            if (chip) {
                _filters.priority = chip.dataset.priority;
                _refreshFiltersAndView();
            }
        });

        container.querySelector('#issues-filter-status').addEventListener('change', (e) => {
            _filters.status = e.target.value;
            _renderCurrentView();
        });

        container.querySelector('#issues-filter-module').addEventListener('change', (e) => {
            _filters.module = e.target.value;
            _renderCurrentView();
        });

        const searchInput = container.querySelector('#issues-filter-search');
        searchInput.addEventListener('input', Utils.debounce((e) => {
            _filters.search = e.target.value.trim().toLowerCase();
            _renderCurrentView();
        }, 250));
    }

    /** Re-render filter chips active states and the current view */
    function _refreshFiltersAndView() {
        const chips = document.querySelectorAll('#issues-priority-chips .chip');
        chips.forEach(c => c.classList.toggle('active', c.dataset.priority === _filters.priority));
        _renderCurrentView();
    }

    /** Apply all active filters + sorting to the issue list */
    function getFilteredIssues() {
        let issues = Store.getIssues();

        // Priority filter
        if (_filters.priority !== 'all') {
            issues = issues.filter(i => i.priority === _filters.priority);
        }
        // Status filter
        if (_filters.status !== 'all') {
            issues = issues.filter(i => i.status === _filters.status);
        }
        // Module filter
        if (_filters.module !== 'all') {
            issues = issues.filter(i => i.module === _filters.module);
        }
        // Search filter (title + description)
        if (_filters.search) {
            const q = _filters.search;
            issues = issues.filter(i =>
                (i.title || '').toLowerCase().includes(q) ||
                (i.description || '').toLowerCase().includes(q)
            );
        }

        // Sort
        issues.sort((a, b) => {
            let va = a[_sort.column];
            let vb = b[_sort.column];

            // Numeric-style priority: P1 < P2 < P3 < P4
            if (_sort.column === 'priority') {
                va = parseInt((va || 'P3').slice(1));
                vb = parseInt((vb || 'P3').slice(1));
            }

            // Null-safe compare
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;

            let cmp = 0;
            if (typeof va === 'string' && typeof vb === 'string') {
                cmp = va.localeCompare(vb);
            } else {
                cmp = va > vb ? 1 : va < vb ? -1 : 0;
            }
            return _sort.direction === 'asc' ? cmp : -cmp;
        });

        return issues;
    }

    // ══════════════════════════════════════════════════════════════
    //  TABLE VIEW
    // ══════════════════════════════════════════════════════════════

    function renderTableView(container, issues) {
        if (issues.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <h3>No issues found</h3>
                    <p>Create your first issue or adjust the filters above.</p>
                </div>`;
            return;
        }

        const columns = [
            { key: 'id',            label: 'ID',           sortable: true },
            { key: 'priority',      label: 'Priority',     sortable: true },
            { key: 'title',         label: 'Title',        sortable: true },
            { key: 'status',        label: 'Status',       sortable: true },
            { key: 'module',        label: 'Module',       sortable: true },
            { key: 'assignedTo',    label: 'Assigned To',  sortable: true },
            { key: 'startDate',     label: 'Start Date',   sortable: true },
            { key: 'targetEndDate', label: 'Target End',   sortable: true },
            { key: 'slaStatus',     label: 'SLA Status',   sortable: true },
            { key: 'attachments',   label: '📎',           sortable: false }
        ];

        // Build sort arrow helper
        const sortArrow = (key) => {
            if (_sort.column !== key) return '';
            return _sort.direction === 'asc' ? ' ▲' : ' ▼';
        };

        let html = `<div class="table-wrapper"><table class="data-table" id="issues-table">
            <thead><tr>
                ${columns.map(c => `
                    <th class="${c.sortable ? 'sortable' : ''}" data-sort-key="${c.key}">
                        ${c.label}${c.sortable ? `<span class="sort-arrow">${sortArrow(c.key)}</span>` : ''}
                    </th>`).join('')}
            </tr></thead>
            <tbody>`;

        issues.forEach(issue => {
            // Recompute live SLA status
            const slaStatus = Utils.computeSLAStatus(issue);
            const slaClass = Utils.slaStatusClass(slaStatus);
            const slaIcon = Utils.slaStatusIcon(slaStatus);
            const slaPulse = (slaStatus === 'At Risk' || slaStatus === 'Breached') ? 'pulse' : '';
            const attachCount = (issue.attachments || []).length;

            html += `
                <tr class="issue-row" data-issue-id="${issue.id}">
                    <td class="td-id">${Utils.escapeHTML(issue.id)}</td>
                    <td><span class="badge ${Utils.priorityClass(issue.priority)}">${Utils.priorityIcon(issue.priority)} ${issue.priority}</span></td>
                    <td class="td-title" title="${Utils.escapeHTML(issue.title)}">${Utils.escapeHTML(issue.title)}</td>
                    <td><span class="badge ${Utils.statusClass(issue.status)}">${Utils.escapeHTML(issue.status)}</span></td>
                    <td class="td-module" title="${Utils.escapeHTML(issue.module)}">${Utils.escapeHTML(_truncate(issue.module, 20))}</td>
                    <td>${Utils.escapeHTML(issue.assignedTo || '—')}</td>
                    <td class="td-date">${Utils.formatDate(issue.startDate)}</td>
                    <td class="td-date">${Utils.formatDate(issue.targetEndDate)}</td>
                    <td><span class="badge ${slaClass} ${slaPulse}">${slaIcon} ${slaStatus}</span></td>
                    <td class="td-center">${attachCount > 0 ? `📎 ${attachCount}` : '—'}</td>
                </tr>`;
        });

        html += `</tbody></table></div>`;
        container.innerHTML = html;

        // ── Table event listeners ────────────────────────────────
        const table = container.querySelector('#issues-table');

        // Sortable headers
        table.querySelectorAll('th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const key = th.dataset.sortKey;
                if (_sort.column === key) {
                    _sort.direction = _sort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    _sort.column = key;
                    _sort.direction = 'asc';
                }
                _renderCurrentView();
            });
        });

        // Row click → open modal
        table.querySelectorAll('.issue-row').forEach(row => {
            row.addEventListener('click', () => {
                openIssueModal(row.dataset.issueId);
            });
        });
    }

    // ══════════════════════════════════════════════════════════════
    //  BOARD (KANBAN) VIEW
    // ══════════════════════════════════════════════════════════════

    function renderBoardView(container, issues) {
        const board = document.createElement('div');
        board.className = 'kanban-board';
        board.id = 'issues-kanban-board';

        Store.STATUSES.forEach(status => {
            const statusIssues = issues.filter(i => i.status === status);
            const col = document.createElement('div');
            col.className = 'kanban-column';
            col.dataset.status = status;

            col.innerHTML = `
                <div class="kanban-column-header">
                    <span class="badge ${Utils.statusClass(status)}">${Utils.escapeHTML(status)}</span>
                    <span class="kanban-count">${statusIssues.length}</span>
                </div>
                <div class="kanban-column-body" data-status="${Utils.escapeHTML(status)}">
                    ${statusIssues.map(issue => _renderKanbanCard(issue)).join('')}
                    ${statusIssues.length === 0 ? '<div class="kanban-empty">No issues</div>' : ''}
                </div>`;

            board.appendChild(col);
        });

        container.appendChild(board);

        // ── Drag & Drop ──────────────────────────────────────────
        board.querySelectorAll('.kanban-card').forEach(card => {
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', card.dataset.issueId);
                card.classList.add('dragging');
                // Slight delay so the browser captures the drag image first
                setTimeout(() => card.style.opacity = '0.4', 0);
            });
            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                card.style.opacity = '';
            });
        });

        board.querySelectorAll('.kanban-column-body').forEach(colBody => {
            colBody.addEventListener('dragover', (e) => {
                e.preventDefault();
                colBody.classList.add('drag-over');
            });
            colBody.addEventListener('dragleave', () => {
                colBody.classList.remove('drag-over');
            });
            colBody.addEventListener('drop', (e) => {
                e.preventDefault();
                colBody.classList.remove('drag-over');
                const issueId = e.dataTransfer.getData('text/plain');
                const newStatus = colBody.dataset.status;
                if (!issueId || !newStatus) return;

                const issue = Store.getIssueById(issueId);
                if (!issue || issue.status === newStatus) return;

                const updates = { status: newStatus };
                // Auto-set actual end date when moving to Resolved/Closed
                if (['Resolved', 'Closed'].includes(newStatus) && !issue.actualEndDate) {
                    updates.actualEndDate = new Date().toISOString();
                }
                updates.slaStatus = Utils.computeSLAStatus({ ...issue, ...updates });
                updates.escalationLevel = Utils.computeEscalationLevel({ ...issue, ...updates });

                Store.updateIssue(issueId, updates);
                Store.addIssueNote(issueId, `Status changed to ${newStatus}`, 'System');
                App.showToast(`Issue moved to ${newStatus}`, 'success');
                _renderCurrentView();
            });
        });

        // Card click → open modal
        board.querySelectorAll('.kanban-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.defaultPrevented) return; // ignore if drag
                openIssueModal(card.dataset.issueId);
            });
        });
    }

    /** Render a single kanban card HTML string */
    function _renderKanbanCard(issue) {
        const slaStatus = Utils.computeSLAStatus(issue);
        const countdown = Utils.computeSLACountdown(issue);
        let countdownLabel = '';
        if (countdown !== null) {
            if (countdown >= 0) {
                countdownLabel = `<span class="kanban-countdown on-track">${Utils.formatDuration(countdown)} left</span>`;
            } else {
                countdownLabel = `<span class="kanban-countdown breached">${Utils.formatDuration(Math.abs(countdown))} overdue</span>`;
            }
        }
        const attachCount = (issue.attachments || []).length;

        return `
            <div class="kanban-card" draggable="true" data-issue-id="${issue.id}">
                <div class="kanban-card-top">
                    <span class="badge badge-sm ${Utils.priorityClass(issue.priority)}">${Utils.priorityIcon(issue.priority)} ${issue.priority}</span>
                    <span class="kanban-card-id">${Utils.escapeHTML(issue.id)}</span>
                </div>
                <div class="kanban-card-title" title="${Utils.escapeHTML(issue.title)}">${Utils.escapeHTML(issue.title)}</div>
                <div class="kanban-card-meta">
                    ${issue.assignedTo ? `<span class="kanban-card-assignee">👤 ${Utils.escapeHTML(issue.assignedTo)}</span>` : ''}
                    ${countdownLabel}
                </div>
                <div class="kanban-card-footer">
                    <span class="badge badge-sm ${Utils.slaStatusClass(slaStatus)}">${Utils.slaStatusIcon(slaStatus)} ${slaStatus}</span>
                    ${attachCount > 0 ? `<span class="kanban-attach">📎 ${attachCount}</span>` : ''}
                </div>
            </div>`;
    }

    // ══════════════════════════════════════════════════════════════
    //  ISSUE CREATE / EDIT MODAL
    // ══════════════════════════════════════════════════════════════

    function openIssueModal(issueId) {
        const isEdit = !!issueId;
        const issue = isEdit ? Store.getIssueById(issueId) : null;
        if (isEdit && !issue) {
            App.showToast('Issue not found', 'error');
            return;
        }

        const allNames = _getAllAssigneeNames();
        const now = new Date().toISOString();

        // Defaults for a new issue
        const data = issue || {
            title: '', description: '', module: '', systemIssue: '',
            priority: 'P3', status: 'Open', assignedTo: '',
            startDate: now, targetEndDate: null, actualEndDate: null,
            pausedAt: null, pauseReason: null, totalPausedMinutes: 0,
            attachments: [], notes: [], escalationLevel: 1, slaStatus: 'On Track'
        };

        // Get system issues for the currently selected module
        const moduleIssues = Store.TASK_MATRIX.filter(t => t.module === data.module);

        // Build the modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'issue-modal-overlay';

        const slaConfig = Store.SLA_CONFIG[data.priority] || {};
        const elapsed = Utils.computeElapsedMinutes(data.startDate, data.actualEndDate, data.totalPausedMinutes, data.priority);
        const slaStatus = Utils.computeSLAStatus(data);
        const escLevel = Utils.computeEscalationLevel(data);
        const escContact = Store.ESCALATION_CONTACTS.find(c => c.level === escLevel);
        const isPaused = !!data.pausedAt;
        const isOpenIssue = !['Resolved', 'Closed'].includes(data.status);
        const showActualEnd = ['Resolved', 'Closed'].includes(data.status);

        overlay.innerHTML = `
        <div class="modal modal-xl" id="issue-modal">
            <div class="modal-header">
                <h2 class="modal-title">${isEdit ? `Edit Issue — ${Utils.escapeHTML(data.id)}` : 'Create New Issue'}</h2>
                <button class="modal-close" id="issue-modal-close" title="Close">✕</button>
            </div>
            <div class="modal-body">
                <div class="modal-grid">
                    <!-- ═══ LEFT COLUMN (2/3) ═══ -->
                    <div class="modal-col-main">
                        <div class="form-group">
                            <label class="form-label" for="issue-field-title">Title <span class="required">*</span></label>
                            <input type="text" class="form-input" id="issue-field-title"
                                   placeholder="Concise issue summary…" value="${Utils.escapeHTML(data.title)}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="issue-field-description">Description</label>
                            <textarea class="form-textarea" id="issue-field-description" rows="4"
                                      placeholder="Detailed description of the issue…">${Utils.escapeHTML(data.description)}</textarea>
                        </div>
                        <div class="form-row">
                            <div class="form-group form-group-half">
                                <label class="form-label" for="issue-field-module">Functional Module</label>
                                <select class="form-select" id="issue-field-module">
                                    <option value="">— Select Module —</option>
                                    ${Store.FUNCTIONAL_MODULES.map(m =>
                                        `<option value="${Utils.escapeHTML(m)}" ${data.module === m ? 'selected' : ''}>${Utils.escapeHTML(m)}</option>`
                                    ).join('')}
                                </select>
                            </div>
                            <div class="form-group form-group-half">
                                <label class="form-label" for="issue-field-system-issue">System Issue</label>
                                <select class="form-select" id="issue-field-system-issue">
                                    <option value="">— Select System Issue —</option>
                                    ${moduleIssues.map(t =>
                                        `<option value="${Utils.escapeHTML(t.issue)}" data-priority="${t.priority}"
                                            ${data.systemIssue === t.issue ? 'selected' : ''}>
                                            ${Utils.escapeHTML(t.issue)}</option>`
                                    ).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group form-group-third">
                                <label class="form-label" for="issue-field-priority">Priority</label>
                                <select class="form-select" id="issue-field-priority">
                                    <option value="P1" ${data.priority === 'P1' ? 'selected' : ''}>P1 — Critical</option>
                                    <option value="P2" ${data.priority === 'P2' ? 'selected' : ''}>P2 — Medium</option>
                                    <option value="P3" ${data.priority === 'P3' ? 'selected' : ''}>P3 — Low</option>
                                    <option value="P4" ${data.priority === 'P4' ? 'selected' : ''}>P4 — Planned</option>
                                </select>
                            </div>
                            <div class="form-group form-group-third">
                                <label class="form-label" for="issue-field-status">Status</label>
                                <select class="form-select" id="issue-field-status">
                                    ${Store.STATUSES.map(s =>
                                        `<option value="${s}" ${data.status === s ? 'selected' : ''}>${s}</option>`
                                    ).join('')}
                                </select>
                            </div>
                            <div class="form-group form-group-third">
                                <label class="form-label" for="issue-field-assigned">Assigned To</label>
                                <select class="form-select" id="issue-field-assigned">
                                    <option value="">— Unassigned —</option>
                                    ${allNames.map(n =>
                                        `<option value="${Utils.escapeHTML(n)}" ${data.assignedTo === n ? 'selected' : ''}>${Utils.escapeHTML(n)}</option>`
                                    ).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group form-group-third">
                                <label class="form-label" for="issue-field-start">Start Date</label>
                                <input type="datetime-local" class="form-input" id="issue-field-start"
                                       value="${Utils.toLocalInputDateTime(data.startDate)}">
                            </div>
                            <div class="form-group form-group-third">
                                <label class="form-label" for="issue-field-target-end">Target End Date</label>
                                <input type="datetime-local" class="form-input" id="issue-field-target-end"
                                       value="${Utils.toLocalInputDateTime(data.targetEndDate)}">
                            </div>
                            <div class="form-group form-group-third ${showActualEnd ? '' : 'hidden'}" id="issue-actual-end-group">
                                <label class="form-label" for="issue-field-actual-end">Actual End Date</label>
                                <input type="datetime-local" class="form-input" id="issue-field-actual-end"
                                       value="${Utils.toLocalInputDateTime(data.actualEndDate)}">
                            </div>
                        </div>
                    </div>

                    <!-- ═══ RIGHT COLUMN (1/3) ═══ -->
                    <div class="modal-col-side">

                        <!-- SLA Information Panel -->
                        <div class="glass-card-static" id="issue-sla-panel">
                            <h4 class="panel-heading">SLA Information</h4>
                            <div class="sla-info-grid">
                                <div class="sla-info-item">
                                    <span class="sla-info-label">Response Window</span>
                                    <span class="sla-info-value">${slaConfig.responseMinutes != null ? Utils.formatDuration(slaConfig.responseMinutes) : 'N/A'}</span>
                                </div>
                                <div class="sla-info-item">
                                    <span class="sla-info-label">Resolution Window</span>
                                    <span class="sla-info-value">${slaConfig.resolutionMinutes != null ? Utils.formatDuration(slaConfig.resolutionMinutes) : 'N/A'}</span>
                                </div>
                                <div class="sla-info-item">
                                    <span class="sla-info-label">Elapsed Time</span>
                                    <span class="sla-info-value" id="issue-sla-elapsed">${Utils.formatDuration(elapsed)}</span>
                                </div>
                                <div class="sla-info-item">
                                    <span class="sla-info-label">SLA Status</span>
                                    <span class="badge ${Utils.slaStatusClass(slaStatus)}" id="issue-sla-badge">${Utils.slaStatusIcon(slaStatus)} ${slaStatus}</span>
                                </div>
                                <div class="sla-info-item">
                                    <span class="sla-info-label">Escalation Level</span>
                                    <span class="sla-info-value">Level ${escLevel}${escContact ? ` — ${Utils.escapeHTML(escContact.designation)}` : ''}</span>
                                </div>
                                ${escContact ? `
                                <div class="sla-info-item sla-info-contact">
                                    <span class="sla-info-label">Contact</span>
                                    <span class="sla-info-value">${Utils.escapeHTML(escContact.names.join(', '))}</span>
                                </div>` : ''}
                            </div>
                        </div>

                        <!-- Notify Resolver Panel -->
                        <div class="glass-card-static" id="issue-notify-panel" style="margin-top:16px;">
                            <h4 class="panel-heading">Notify Resolver</h4>
                            <div class="notify-controls flex-col gap-sm" style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">
                                <button class="btn btn-secondary btn-sm" id="issue-btn-notify-email" style="width:100%; text-align:left; display:flex; align-items:center; gap:8px;">
                                    ✉️ Email Resolver
                                </button>
                                <button class="btn btn-secondary btn-sm" id="issue-btn-notify-whatsapp" style="width:100%; text-align:left; display:flex; align-items:center; gap:8px;">
                                    💬 WhatsApp Resolver
                                </button>
                            </div>
                        </div>

                        <!-- Pause / Resume SLA -->
                        ${isEdit && isOpenIssue && data.priority !== 'P4' ? `
                        <div class="glass-card-static" id="issue-pause-panel">
                            <h4 class="panel-heading">Pause SLA</h4>
                            <div class="pause-controls">
                                <button class="btn ${isPaused ? 'btn-success' : 'btn-warning'} btn-sm" id="issue-btn-pause-toggle">
                                    ${isPaused ? '▶ Resume SLA' : '⏸ Pause SLA'}
                                </button>
                                <div class="pause-reason-wrap ${isPaused ? 'hidden' : ''}" id="issue-pause-reason-wrap">
                                    <select class="form-select form-select-sm" id="issue-pause-reason">
                                        <option value="">— Select Reason —</option>
                                        ${Store.PAUSE_REASONS.map(r =>
                                            `<option value="${Utils.escapeHTML(r)}" ${data.pauseReason === r ? 'selected' : ''}>${Utils.escapeHTML(r)}</option>`
                                        ).join('')}
                                    </select>
                                </div>
                                <div class="pause-info">
                                    Total paused: <strong>${Utils.formatDuration(data.totalPausedMinutes || 0)}</strong>
                                    ${isPaused ? `<br><em>Paused since ${Utils.formatDateTime(data.pausedAt)}</em>` : ''}
                                </div>
                            </div>
                        </div>` : ''}

                        <!-- Attachments -->
                        <div class="glass-card-static" id="issue-attachments-panel">
                            <h4 class="panel-heading">Attachments</h4>
                            <div class="attachment-upload">
                                <input type="file" multiple id="issue-file-input" class="file-input-hidden">
                                <label for="issue-file-input" class="btn btn-secondary btn-sm btn-full">📁 Add Files</label>
                                <small class="text-muted">Max 500 KB per file</small>
                            </div>
                            <div class="attachment-list" id="issue-attachment-list">
                                ${_renderAttachmentList(data.attachments || [])}
                            </div>
                        </div>

                        <!-- Notes / Activity Log -->
                        <div class="glass-card-static" id="issue-notes-panel">
                            <h4 class="panel-heading">Notes / Activity Log</h4>
                            <div class="timeline" id="issue-notes-timeline">
                                ${_renderNotesTimeline(data.notes || [])}
                            </div>
                            <div class="note-add">
                                <textarea class="form-textarea form-textarea-sm" id="issue-note-text" rows="2"
                                          placeholder="Add a note…"></textarea>
                                <button class="btn btn-secondary btn-sm" id="issue-btn-add-note">Add Note</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" id="issue-btn-cancel">Cancel</button>
                ${isEdit ? `<button class="btn btn-danger" id="issue-btn-delete">Delete</button>` : ''}
                <div class="modal-footer-spacer"></div>
                ${isEdit ? `<button class="btn btn-secondary" id="issue-btn-print-issue">🖨️ Print Issue</button>` : ''}
                <button class="btn btn-primary" id="issue-btn-save">${isEdit ? 'Save Changes' : 'Create Issue'}</button>
            </div>
        </div>`;

        document.body.appendChild(overlay);

        // Trigger entrance animation
        requestAnimationFrame(() => overlay.classList.add('active'));

        // ── Bind modal events ────────────────────────────────────
        _bindModalEvents(overlay, isEdit, issueId);
    }

    /** Bind all interactive events inside the modal */
    function _bindModalEvents(overlay, isEdit, issueId) {
        const modal = overlay.querySelector('#issue-modal');

        // Close modal
        const close = () => closeModal(overlay);
        overlay.querySelector('#issue-modal-close').addEventListener('click', close);
        overlay.querySelector('#issue-btn-cancel').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        // ESC key
        const escHandler = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); } };
        document.addEventListener('keydown', escHandler);

        // ── Module ↔ System Issue ↔ Priority cascade ─────────────
        const moduleSelect = modal.querySelector('#issue-field-module');
        const sysIssueSelect = modal.querySelector('#issue-field-system-issue');
        const prioritySelect = modal.querySelector('#issue-field-priority');

        moduleSelect.addEventListener('change', () => {
            const mod = moduleSelect.value;
            const matching = Store.TASK_MATRIX.filter(t => t.module === mod);
            sysIssueSelect.innerHTML = `<option value="">— Select System Issue —</option>` +
                matching.map(t => `<option value="${Utils.escapeHTML(t.issue)}" data-priority="${t.priority}">${Utils.escapeHTML(t.issue)}</option>`).join('');
        });

        sysIssueSelect.addEventListener('change', () => {
            const opt = sysIssueSelect.selectedOptions[0];
            if (opt && opt.dataset.priority) {
                prioritySelect.value = opt.dataset.priority;
                _recomputeTargetEnd(modal);
            }
        });

        // ── Auto-compute target end when priority or start changes ─
        prioritySelect.addEventListener('change', () => _recomputeTargetEnd(modal));
        modal.querySelector('#issue-field-start').addEventListener('change', () => _recomputeTargetEnd(modal));

        // ── Show / hide actual end date based on status ──────────
        const statusSelect = modal.querySelector('#issue-field-status');
        statusSelect.addEventListener('change', () => {
            const grp = modal.querySelector('#issue-actual-end-group');
            if (['Resolved', 'Closed'].includes(statusSelect.value)) {
                grp.classList.remove('hidden');
            } else {
                grp.classList.add('hidden');
            }
        });

        // ── Pause / Resume SLA ───────────────────────────────────
        const pauseBtn = modal.querySelector('#issue-btn-pause-toggle');
        if (pauseBtn && isEdit) {
            pauseBtn.addEventListener('click', () => {
                const issue = Store.getIssueById(issueId);
                if (!issue) return;

                if (issue.pausedAt) {
                    // Resume
                    const pausedMs = Date.now() - new Date(issue.pausedAt).getTime();
                    const pausedMin = Math.round(pausedMs / 60000);
                    const newTotal = (issue.totalPausedMinutes || 0) + pausedMin;
                    Store.updateIssue(issueId, { pausedAt: null, pauseReason: null, totalPausedMinutes: newTotal });
                    Store.addIssueNote(issueId, `SLA resumed after ${pausedMin} minutes`, 'System');
                    App.showToast('SLA resumed', 'success');
                } else {
                    // Pause — require reason
                    const reasonSelect = modal.querySelector('#issue-pause-reason');
                    const reason = reasonSelect ? reasonSelect.value : '';
                    if (!reason) {
                        App.showToast('Please select a pause reason', 'warning');
                        // Show the dropdown
                        const wrap = modal.querySelector('#issue-pause-reason-wrap');
                        if (wrap) wrap.classList.remove('hidden');
                        return;
                    }
                    Store.updateIssue(issueId, { pausedAt: new Date().toISOString(), pauseReason: reason });
                    Store.addIssueNote(issueId, `SLA paused: ${reason}`, 'System');
                    App.showToast('SLA paused', 'info');
                }
                // Refresh modal
                closeModal(overlay);
                openIssueModal(issueId);
            });

            // Show/hide pause reason dropdown on first click
            const pauseReasonWrap = modal.querySelector('#issue-pause-reason-wrap');
            if (pauseReasonWrap) {
                const issue = Store.getIssueById(issueId);
                if (!issue.pausedAt) {
                    // Initially hidden, show when pause button is first clicked (handled above)
                }
            }
        }

        // ── Attachments ──────────────────────────────────────────
        const fileInput = modal.querySelector('#issue-file-input');
        if (fileInput) {
            fileInput.addEventListener('change', async () => {
                const files = Array.from(fileInput.files);
                for (const file of files) {
                    if (file.size > 512000) { // 500 KB
                        App.showToast(`File "${file.name}" exceeds 500 KB limit`, 'warning');
                        continue;
                    }
                    try {
                        const base64 = await Utils.fileToBase64(file);
                        const attachment = { name: file.name, size: file.size, data: base64, addedAt: new Date().toISOString() };
                        if (isEdit) {
                            Store.addIssueAttachment(issueId, attachment);
                        } else {
                            // Accumulate in a temporary array on the modal element
                            if (!modal._pendingAttachments) modal._pendingAttachments = [];
                            modal._pendingAttachments.push(attachment);
                        }
                    } catch (err) {
                        App.showToast(`Failed to read file: ${file.name}`, 'error');
                    }
                }
                // Refresh attachment list
                _refreshAttachmentList(modal, isEdit, issueId);
                fileInput.value = '';
            });
        }

        // Attachment actions (delegation on the list container)
        const attachList = modal.querySelector('#issue-attachment-list');
        if (attachList) {
            attachList.addEventListener('click', (e) => {
                const removeBtn = e.target.closest('.attachment-remove');
                if (removeBtn) {
                    const idx = parseInt(removeBtn.dataset.index, 10);
                    if (isEdit) {
                        Store.removeIssueAttachment(issueId, idx);
                    } else {
                        if (modal._pendingAttachments) modal._pendingAttachments.splice(idx, 1);
                    }
                    _refreshAttachmentList(modal, isEdit, issueId);
                    return;
                }

                const link = e.target.closest('.attachment-name');
                if (link) {
                    e.preventDefault();
                    const idx = parseInt(link.dataset.index, 10);
                    const attachments = isEdit ? (Store.getIssueById(issueId)?.attachments || []) : (modal._pendingAttachments || []);
                    const att = attachments[idx];
                    if (att && att.data) {
                        // Open in new tab for preview/download
                        const win = window.open('');
                        if (win) {
                            win.document.write(`<title>${Utils.escapeHTML(att.name)}</title>
                                <body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh">
                                ${att.data.startsWith('data:image') ?
                                    `<img src="${att.data}" style="max-width:100%;max-height:100vh">` :
                                    `<iframe src="${att.data}" style="width:100%;height:100vh;border:none"></iframe>`}
                                </body>`);
                        }
                    }
                }
            });
        }

        // ── Add Note ─────────────────────────────────────────────
        const addNoteBtn = modal.querySelector('#issue-btn-add-note');
        if (addNoteBtn) {
            addNoteBtn.addEventListener('click', () => {
                const textarea = modal.querySelector('#issue-note-text');
                const text = textarea.value.trim();
                if (!text) return;

                const settings = Store.getSettings();
                const author = settings.companyName || 'User';

                if (isEdit) {
                    Store.addIssueNote(issueId, text, author);
                    const issue = Store.getIssueById(issueId);
                    const timeline = modal.querySelector('#issue-notes-timeline');
                    if (timeline) timeline.innerHTML = _renderNotesTimeline(issue.notes || []);
                } else {
                    if (!modal._pendingNotes) modal._pendingNotes = [];
                    modal._pendingNotes.push({ timestamp: new Date().toISOString(), author, text });
                    const timeline = modal.querySelector('#issue-notes-timeline');
                    if (timeline) timeline.innerHTML = _renderNotesTimeline(modal._pendingNotes);
                }
                textarea.value = '';
            });
        }

        // ── Delete Issue ─────────────────────────────────────────
        const deleteBtn = modal.querySelector('#issue-btn-delete');
        if (deleteBtn && isEdit) {
            deleteBtn.addEventListener('click', () => {
                if (!confirm(`Are you sure you want to delete issue ${issueId}? This cannot be undone.`)) return;
                Store.deleteIssue(issueId);
                App.showToast('Issue deleted', 'info');
                closeModal(overlay);
                _renderCurrentView();
            });
        }

        // ── Print Single Issue ───────────────────────────────────
        const printBtn = modal.querySelector('#issue-btn-print-issue');
        if (printBtn && isEdit) {
            printBtn.addEventListener('click', () => _printSingleIssue(issueId));
        }

        // ── Notify Resolver ──────────────────────────────────────
        const notifyEmailBtn = modal.querySelector('#issue-btn-notify-email');
        const notifyWhatsappBtn = modal.querySelector('#issue-btn-notify-whatsapp');
        
        const getResolverContact = () => {
            const assigneeSelect = modal.querySelector('#issue-field-assigned');
            const name = assigneeSelect ? assigneeSelect.value : '';
            if (!name) return null;

            let phone = '';
            let email = '';
            let designation = '';
            for (const c of Store.ESCALATION_CONTACTS) {
                const idx = c.names.indexOf(name);
                if (idx !== -1) {
                    designation = c.designation;
                    if (!phone && c.phones[idx]) phone = c.phones[idx];
                    if (!email && c.emails[idx]) email = c.emails[idx];
                }
            }
            // Fallbacks matching contact matrix
            if (!email || !phone) {
                if (name === 'Arif') { email = 'arifansari@reospark.com'; phone = '9871264243'; }
                else if (name === 'Harvinder') { email = 'harvinder.anan@gmail.com'; phone = '9801298785'; }
                else if (name === 'Pradeep') { email = 'pradeep@reospark.com'; phone = '9386292565'; }
                else if (name === 'Priyesh Tiwari') { email = 'opmeenu@gmail.com'; phone = '9999644218'; }
                else if (name === 'O.P. Arora') { email = 'opmeenu@gmail.com'; phone = '7217766185'; }
            }
            return { name, designation, email, phone };
        };

        const getIssueNotifyDetails = () => {
            const title = modal.querySelector('#issue-field-title').value.trim() || 'Untitled Issue';
            const priority = modal.querySelector('#issue-field-priority').value;
            const status = modal.querySelector('#issue-field-status').value;
            const module = modal.querySelector('#issue-field-module').value;
            const id = isEdit ? issueId : 'NEW TICKET';
            const desc = modal.querySelector('#issue-field-desc').value.trim() || 'No description provided';
            
            const startVal = modal.querySelector('#issue-field-start').value;
            const startISO = Utils.fromLocalInputDateTime(startVal);
            const targetISO = Utils.computeTargetEndDate(startISO, priority);
            const targetFormatted = targetISO ? Utils.formatDateTime(targetISO) : 'N/A';
            
            return { id, title, priority, status, module, desc, targetFormatted };
        };

        if (notifyEmailBtn) {
            notifyEmailBtn.addEventListener('click', () => {
                const contact = getResolverContact();
                if (!contact || !contact.email) {
                    App.showToast('Please assign a resolver first', 'warning');
                    return;
                }
                const issue = getIssueNotifyDetails();
                
                const subject = `[LMS SLA ALERT] Ticket ${issue.id} Assigned - ${issue.priority}`;
                const body = `LMS SLA ALERT\r\n\r\n` +
                             `Ticket ID: ${issue.id}\r\n` +
                             `Priority: ${issue.priority}\r\n` +
                             `Status: ${issue.status}\r\n` +
                             `Module: ${issue.module}\r\n` +
                             `Issue: ${issue.title}\r\n` +
                             `Description: ${issue.desc}\r\n\r\n` +
                             `SLA Targets:\r\n` +
                             `- Target End Date: ${issue.targetFormatted}\r\n\r\n` +
                             `This is an automated notification. Please log in to resolve.`;
                             
                window.location.href = `mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                App.showToast('Email client opened', 'success');
            });
        }

        if (notifyWhatsappBtn) {
            notifyWhatsappBtn.addEventListener('click', () => {
                const contact = getResolverContact();
                if (!contact || !contact.phone) {
                    App.showToast('Please assign a resolver first', 'warning');
                    return;
                }
                const issue = getIssueNotifyDetails();
                
                const text = `*LMS SLA ALERT* 🚨\r\n` +
                             `-------------------------\r\n` +
                             `*Ticket ID*: ${issue.id}\r\n` +
                             `*Priority*: ${issue.priority}\r\n` +
                             `*Status*: ${issue.status}\r\n` +
                             `*Module*: ${issue.module}\r\n` +
                             `*Issue*: ${issue.title}\r\n\r\n` +
                             `*SLA Target End*: ${issue.targetFormatted}\r\n\r\n` +
                             `Please check the portal.`;
                             
                const cleanPhone = contact.phone.replace(/\D/g, '');
                const url = `https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${encodeURIComponent(text)}`;
                window.open(url, '_blank');
                App.showToast('WhatsApp redirect opened', 'success');
            });
        }

        // ── Save Issue ───────────────────────────────────────────
        modal.querySelector('#issue-btn-save').addEventListener('click', () => {
            _saveIssue(modal, isEdit, issueId, overlay);
        });
    }

    /** Auto-recompute the target end date field */
    function _recomputeTargetEnd(modal) {
        const priority = modal.querySelector('#issue-field-priority').value;
        const startVal = modal.querySelector('#issue-field-start').value;
        if (!startVal) return;

        const startISO = Utils.fromLocalInputDateTime(startVal);
        const target = Utils.computeTargetEndDate(startISO, priority);
        const targetInput = modal.querySelector('#issue-field-target-end');
        if (target) {
            targetInput.value = Utils.toLocalInputDateTime(target);
        } else {
            targetInput.value = '';
        }
    }

    /** Validate and save the issue (create or update) */
    function _saveIssue(modal, isEdit, issueId, overlay) {
        const title = modal.querySelector('#issue-field-title').value.trim();
        if (!title) {
            App.showToast('Title is required', 'warning');
            modal.querySelector('#issue-field-title').focus();
            return;
        }

        const priority = modal.querySelector('#issue-field-priority').value;
        const status = modal.querySelector('#issue-field-status').value;
        const startVal = modal.querySelector('#issue-field-start').value;
        const targetVal = modal.querySelector('#issue-field-target-end').value;
        const actualVal = modal.querySelector('#issue-field-actual-end').value;

        const startDate = startVal ? Utils.fromLocalInputDateTime(startVal) : new Date().toISOString();
        let targetEndDate = targetVal ? Utils.fromLocalInputDateTime(targetVal) : Utils.computeTargetEndDate(startDate, priority);
        let actualEndDate = actualVal ? Utils.fromLocalInputDateTime(actualVal) : null;

        // Auto-set actual end date when resolving/closing
        if (['Resolved', 'Closed'].includes(status) && !actualEndDate) {
            actualEndDate = new Date().toISOString();
        }

        const issueData = {
            title,
            description: modal.querySelector('#issue-field-description').value.trim(),
            module: modal.querySelector('#issue-field-module').value,
            systemIssue: modal.querySelector('#issue-field-system-issue').value,
            priority,
            status,
            assignedTo: modal.querySelector('#issue-field-assigned').value,
            startDate,
            targetEndDate,
            actualEndDate
        };

        // Compute SLA status and escalation level
        issueData.slaStatus = Utils.computeSLAStatus({ ...issueData, totalPausedMinutes: isEdit ? (Store.getIssueById(issueId)?.totalPausedMinutes || 0) : 0 });
        issueData.escalationLevel = Utils.computeEscalationLevel({ ...issueData, totalPausedMinutes: isEdit ? (Store.getIssueById(issueId)?.totalPausedMinutes || 0) : 0 });

        if (isEdit) {
            // Detect status change for auto-note
            const oldIssue = Store.getIssueById(issueId);
            Store.updateIssue(issueId, issueData);

            if (oldIssue && oldIssue.status !== status) {
                Store.addIssueNote(issueId, `Status changed from ${oldIssue.status} to ${status}`, 'System');
            }
            if (oldIssue && oldIssue.priority !== priority) {
                Store.addIssueNote(issueId, `Priority changed from ${oldIssue.priority} to ${priority}`, 'System');
            }

            App.showToast('Issue updated', 'success');
        } else {
            // Attach pending attachments and notes
            issueData.attachments = modal._pendingAttachments || [];
            issueData.notes = modal._pendingNotes || [];

            const created = Store.createIssue(issueData);
            Store.addIssueNote(created.id, `Issue created with priority ${priority}`, 'System');

            App.showToast('Issue created successfully', 'success');
        }

        closeModal(overlay);
        _renderCurrentView();
    }

    // ── Close modal ──────────────────────────────────────────────
    function closeModal(overlay) {
        if (!overlay) overlay = document.getElementById('issue-modal-overlay');
        if (!overlay) return;
        overlay.classList.remove('active');
        // Remove after transition
        setTimeout(() => overlay.remove(), 300);
    }

    // ══════════════════════════════════════════════════════════════
    //  PRINT SINGLE ISSUE
    // ══════════════════════════════════════════════════════════════

    function _printSingleIssue(issueId) {
        const issue = Store.getIssueById(issueId);
        if (!issue) return;

        const slaStatus = Utils.computeSLAStatus(issue);
        const escLevel = Utils.computeEscalationLevel(issue);
        const elapsed = Utils.computeElapsedMinutes(issue.startDate, issue.actualEndDate, issue.totalPausedMinutes, issue.priority);
        const slaConfig = Store.SLA_CONFIG[issue.priority] || {};

        const printContainer = document.createElement('div');
        printContainer.id = 'issue-print-container';
        printContainer.className = 'print-only-container';
        printContainer.innerHTML = `
            <style>
                #issue-print-container { font-family: 'Inter', Arial, sans-serif; color: #222; padding: 20px; }
                #issue-print-container h2 { margin: 0 0 8px; font-size: 20px; }
                #issue-print-container .print-meta { color: #666; font-size: 12px; margin-bottom: 16px; }
                #issue-print-container table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
                #issue-print-container th, #issue-print-container td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; font-size: 13px; }
                #issue-print-container th { background: #f5f5f5; font-weight: 600; width: 160px; }
                #issue-print-container .notes-section h3 { font-size: 15px; margin: 16px 0 8px; }
                #issue-print-container .note-entry { padding: 6px 0; border-bottom: 1px solid #eee; font-size: 13px; }
                #issue-print-container .note-meta { color: #888; font-size: 11px; }
                @media screen { #issue-print-container { display: none; } }
                @media print { body > *:not(#issue-print-container) { display: none !important; } #issue-print-container { display: block !important; } }
            </style>
            <h2>${Utils.escapeHTML(issue.id)} — ${Utils.escapeHTML(issue.title)}</h2>
            <div class="print-meta">Printed on ${new Date().toLocaleString()}</div>
            <table>
                <tr><th>Priority</th><td>${issue.priority} — ${slaConfig.label || ''}</td></tr>
                <tr><th>Status</th><td>${issue.status}</td></tr>
                <tr><th>Module</th><td>${Utils.escapeHTML(issue.module || '—')}</td></tr>
                <tr><th>System Issue</th><td>${Utils.escapeHTML(issue.systemIssue || '—')}</td></tr>
                <tr><th>Assigned To</th><td>${Utils.escapeHTML(issue.assignedTo || '—')}</td></tr>
                <tr><th>Start Date</th><td>${Utils.formatDateTime(issue.startDate)}</td></tr>
                <tr><th>Target End Date</th><td>${Utils.formatDateTime(issue.targetEndDate)}</td></tr>
                <tr><th>Actual End Date</th><td>${Utils.formatDateTime(issue.actualEndDate)}</td></tr>
                <tr><th>SLA Status</th><td>${slaStatus}</td></tr>
                <tr><th>Elapsed Time</th><td>${Utils.formatDuration(elapsed)}</td></tr>
                <tr><th>Escalation Level</th><td>Level ${escLevel}</td></tr>
                <tr><th>Total Paused</th><td>${Utils.formatDuration(issue.totalPausedMinutes || 0)}</td></tr>
                <tr><th>Description</th><td>${Utils.escapeHTML(issue.description || '—')}</td></tr>
            </table>
            <div class="notes-section">
                <h3>Activity Log (${(issue.notes || []).length} notes)</h3>
                ${(issue.notes || []).map(n => `
                    <div class="note-entry">
                        <div class="note-meta">${Utils.formatDateTime(n.timestamp)} — ${Utils.escapeHTML(n.author)}</div>
                        <div>${Utils.escapeHTML(n.text)}</div>
                    </div>`).join('')}
                ${(issue.notes || []).length === 0 ? '<p>No notes recorded.</p>' : ''}
            </div>`;

        document.body.appendChild(printContainer);

        // Wait for styles to apply, then print
        setTimeout(() => {
            window.print();
            // Remove after print dialog closes
            setTimeout(() => printContainer.remove(), 1000);
        }, 200);
    }

    // ══════════════════════════════════════════════════════════════
    //  PRIVATE HELPERS
    // ══════════════════════════════════════════════════════════════

    /** Flatten all unique names from ESCALATION_CONTACTS */
    function _getAllAssigneeNames() {
        const nameSet = new Set();
        Store.ESCALATION_CONTACTS.forEach(c => {
            (c.names || []).forEach(n => nameSet.add(n));
        });
        return Array.from(nameSet).sort();
    }

    /** Truncate a string to maxLen and add ellipsis */
    function _truncate(str, maxLen) {
        if (!str) return '—';
        return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
    }

    /** Render attachment list HTML */
    function _renderAttachmentList(attachments) {
        if (!attachments || attachments.length === 0) {
            return '<p class="text-muted text-sm">No attachments</p>';
        }
        return attachments.map((att, idx) => `
            <div class="attachment-item">
                <a href="#" class="attachment-name" data-index="${idx}" title="${Utils.escapeHTML(att.name)}">
                    📄 ${Utils.escapeHTML(_truncate(att.name, 25))}
                </a>
                <span class="attachment-size">${Utils.formatFileSize(att.size || 0)}</span>
                <button class="attachment-remove" data-index="${idx}" title="Remove">✕</button>
            </div>`).join('');
    }

    /** Refresh the attachment list inside the modal */
    function _refreshAttachmentList(modal, isEdit, issueId) {
        const listEl = modal.querySelector('#issue-attachment-list');
        if (!listEl) return;
        const attachments = isEdit
            ? (Store.getIssueById(issueId)?.attachments || [])
            : (modal._pendingAttachments || []);
        listEl.innerHTML = _renderAttachmentList(attachments);
    }

    /** Render notes timeline HTML */
    function _renderNotesTimeline(notes) {
        if (!notes || notes.length === 0) {
            return '<p class="text-muted text-sm">No activity recorded yet</p>';
        }
        // Show newest first
        return [...notes].reverse().map(note => `
            <div class="timeline-item">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                    <div class="timeline-meta">
                        <span class="timeline-author">${Utils.escapeHTML(note.author || 'System')}</span>
                        <span class="timeline-time">${Utils.timeAgo(note.timestamp)}</span>
                    </div>
                    <div class="timeline-text">${Utils.escapeHTML(note.text)}</div>
                </div>
            </div>`).join('');
    }

    // ── Public API ───────────────────────────────────────────────
    return {
        render,
        openIssueModal,
        closeModal
    };
})();
