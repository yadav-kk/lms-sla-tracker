/**
 * server-tasks.js — Server Task Tracker module
 * LMS SLA Tracker
 */

const ServerTasksPage = (() => {
    let _container = null;
    let _filters = { stage: 'all', testingStatus: 'all', workType: 'all', search: '', startDate: '', endDate: '', implDate: '' };
    let _sort = { column: 'id', direction: 'asc' };

    const STAGE_LABELS = {
        1: 'Stage 1: Backlog / Defined',
        2: 'Stage 2: In Progress',
        3: 'Stage 3: Testing / Validation',
        4: 'Stage 4: Approved / Verified',
        5: 'Stage 5: Deployed / Completed'
    };

    const TESTING_STATUSES = ['Pending', 'Success', 'Need to Update'];

    const STATUS_COLORS = {
        'Pending': 'status-waiting',
        'Success': 'status-resolved',
        'Need to Update': 'status-in-progress'
    };

    function render(container, params = {}) {
        _container = container;
        _container.innerHTML = '';

        // Page header with actions
        const header = document.createElement('div');
        header.className = 'page-header';
        header.innerHTML = `
            <div>
                <h1 class="page-title">Server Task Tracker</h1>
                <p class="page-subtitle">Track server engineering tasks, hardware maintenance, security updates, and backup tests for Devendra Soni</p>
            </div>
            <div class="header-actions">
                <button class="btn btn-primary" id="srv-btn-new">＋ Add Task</button>
            </div>`;
        _container.appendChild(header);

        // Summary metrics row
        const metricsRow = document.createElement('div');
        metricsRow.className = 'metrics-grid mb-4';
        _container.appendChild(metricsRow);
        _renderMetrics(metricsRow);

        // Filter panel
        const filterPanel = document.createElement('div');
        filterPanel.className = 'glass-card mb-4 p-4';
        _container.appendChild(filterPanel);
        _renderFilters(filterPanel);

        // Content Table Container
        const tableContainer = document.createElement('div');
        tableContainer.id = 'srv-tasks-content';
        tableContainer.className = 'issues-content';
        _container.appendChild(tableContainer);
        _renderTable(tableContainer);

        // Bind events
        header.querySelector('#srv-btn-new').addEventListener('click', () => _openTaskModal(null));

        // Auto open if task ID passed in params
        if (params.taskId) {
            setTimeout(() => _openTaskModal(params.taskId), 150);
        }
    }

    function _renderMetrics(container) {
        const tasks = Store.getServerTasks();
        const total = tasks.length;
        const inProgress = tasks.filter(t => t.stage === 2).length;
        const inTesting = tasks.filter(t => t.stage === 3).length;
        const passed = tasks.filter(t => t.testingStatus === 'Success').length;

        container.innerHTML = `
            <div class="glass-card metric-card animate-slide-up" style="border-top: 4px solid var(--accent-primary);">
                <div class="metric-value">${total}</div>
                <div class="metric-label">Total Server Tasks</div>
            </div>
            <div class="glass-card metric-card animate-slide-up" style="border-top: 4px solid var(--warning); animation-delay: 50ms;">
                <div class="metric-value">${inProgress}</div>
                <div class="metric-label">In Progress (Stage 2)</div>
            </div>
            <div class="glass-card metric-card animate-slide-up" style="border-top: 4px solid var(--info); animation-delay: 100ms;">
                <div class="metric-value">${inTesting}</div>
                <div class="metric-label">In Testing (Stage 3)</div>
            </div>
            <div class="glass-card metric-card animate-slide-up" style="border-top: 4px solid var(--success); animation-delay: 150ms;">
                <div class="metric-value">${passed}</div>
                <div class="metric-label">Passed Validation (Success)</div>
            </div>`;
    }

    function _renderFilters(container) {
        const tasks = Store.getServerTasks();
        const workTypes = [...new Set(tasks.map(t => t.workType))].sort();

        container.innerHTML = `
            <div class="filters-bar" style="gap: 12px; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
                <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label" style="font-size:0.7rem;">Search</label>
                    <input type="text" class="form-input" id="srv-filter-search" value="${Utils.escapeHTML(_filters.search)}" placeholder="Search task title/desc...">
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label" style="font-size:0.7rem;">Work Category</label>
                    <select class="form-select" id="srv-filter-worktype">
                        <option value="all">All Categories</option>
                        ${workTypes.map(w => `<option value="${Utils.escapeHTML(w)}" ${_filters.workType === w ? 'selected' : ''}>${Utils.escapeHTML(w)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label" style="font-size:0.7rem;">Stage</label>
                    <select class="form-select" id="srv-filter-stage">
                        <option value="all">All Stages</option>
                        ${Object.entries(STAGE_LABELS).map(([k, v]) => `<option value="${k}" ${_filters.stage === k ? 'selected' : ''}>${v}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label" style="font-size:0.7rem;">Testing Status</label>
                    <select class="form-select" id="srv-filter-status">
                        <option value="all">All Statuses</option>
                        ${TESTING_STATUSES.map(s => `<option value="${s}" ${_filters.testingStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="filters-bar mt-3" style="gap: 12px; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
                <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label" style="font-size:0.7rem;">Start Date</label>
                    <input type="date" class="form-input" id="srv-filter-startdate" value="${_filters.startDate}">
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label" style="font-size:0.7rem;">End Date</label>
                    <input type="date" class="form-input" id="srv-filter-enddate" value="${_filters.endDate}">
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label" style="font-size:0.7rem;">Implementation Date</label>
                    <input type="date" class="form-input" id="srv-filter-impldate" value="${_filters.implDate}">
                </div>
                <div class="form-group" style="margin-bottom: 0; display: flex; align-items: flex-end;">
                    <button class="btn btn-secondary btn-full" id="srv-filter-reset">Reset Filters</button>
                </div>
            </div>`;

        // Filter event listeners
        const searchInput = container.querySelector('#srv-filter-search');
        searchInput.addEventListener('input', Utils.debounce(() => {
            _filters.search = searchInput.value.trim();
            _applyFilters();
        }, 300));

        container.querySelector('#srv-filter-worktype').addEventListener('change', (e) => {
            _filters.workType = e.target.value;
            _applyFilters();
        });

        container.querySelector('#srv-filter-stage').addEventListener('change', (e) => {
            _filters.stage = e.target.value;
            _applyFilters();
        });

        container.querySelector('#srv-filter-status').addEventListener('change', (e) => {
            _filters.testingStatus = e.target.value;
            _applyFilters();
        });

        container.querySelector('#srv-filter-startdate').addEventListener('change', (e) => {
            _filters.startDate = e.target.value;
            _applyFilters();
        });

        container.querySelector('#srv-filter-enddate').addEventListener('change', (e) => {
            _filters.endDate = e.target.value;
            _applyFilters();
        });

        container.querySelector('#srv-filter-impldate').addEventListener('change', (e) => {
            _filters.implDate = e.target.value;
            _applyFilters();
        });

        container.querySelector('#srv-filter-reset').addEventListener('click', () => {
            _filters = { stage: 'all', testingStatus: 'all', workType: 'all', search: '', startDate: '', endDate: '', implDate: '' };
            render(_container);
        });
    }

    function _applyFilters() {
        const tableContainer = document.getElementById('srv-tasks-content');
        if (tableContainer) {
            _renderTable(tableContainer);
        }
        // Also refresh metrics
        const metricsRow = _container.querySelector('.metrics-grid');
        if (metricsRow) {
            _renderMetrics(metricsRow);
        }
    }

    function _getFilteredTasks() {
        let tasks = Store.getServerTasks() || [];

        // Apply filters
        if (_filters.search) {
            const q = _filters.search.toLowerCase();
            tasks = tasks.filter(t => 
                t.title.toLowerCase().includes(q) || 
                (t.description && t.description.toLowerCase().includes(q)) ||
                t.id.toLowerCase().includes(q)
            );
        }
        if (_filters.workType !== 'all') {
            tasks = tasks.filter(t => t.workType === _filters.workType);
        }
        if (_filters.stage !== 'all') {
            tasks = tasks.filter(t => String(t.stage) === _filters.stage);
        }
        if (_filters.testingStatus !== 'all') {
            tasks = tasks.filter(t => t.testingStatus === _filters.testingStatus);
        }
        if (_filters.startDate) {
            tasks = tasks.filter(t => t.startDate && t.startDate >= _filters.startDate);
        }
        if (_filters.endDate) {
            tasks = tasks.filter(t => t.endDate && t.endDate <= _filters.endDate);
        }
        if (_filters.implDate) {
            tasks = tasks.filter(t => t.implementationDate === _filters.implDate);
        }

        // Apply Sorting
        tasks.sort((a, b) => {
            let valA = a[_sort.column];
            let valB = b[_sort.column];

            // Normalize nulls/undefined
            if (valA === null || valA === undefined) valA = '';
            if (valB === null || valB === undefined) valB = '';

            if (typeof valA === 'string') {
                return _sort.direction === 'asc' 
                    ? valA.localeCompare(valB) 
                    : valB.localeCompare(valA);
            } else {
                return _sort.direction === 'asc' 
                    ? valA - valB 
                    : valB - valA;
            }
        });

        return tasks;
    }

    function _renderTable(container) {
        const filteredTasks = _getFilteredTasks();

        if (filteredTasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state glass-card-static" style="padding: 60px 20px;">
                    <div style="font-size: 3rem; margin-bottom: 16px; opacity: 0.5;">🗂️</div>
                    <h3>No Server Tasks Found</h3>
                    <p style="color:var(--text-secondary); font-size:0.9rem;">Change your filters or create a new server task above.</p>
                </div>`;
            return;
        }

        // Table headers sort helper
        const sortHeader = (colName, displayName) => {
            const isActive = _sort.column === colName;
            const arrow = isActive ? (_sort.direction === 'asc' ? ' ↑' : ' ↓') : '';
            const activeStyle = isActive ? 'color: var(--accent-primary); font-weight:600;' : '';
            return `<th style="cursor: pointer; user-select: none; ${activeStyle}" data-sort="${colName}">${displayName}${arrow}</th>`;
        };

        container.innerHTML = `
            <div class="glass-card-static" style="padding: 0; overflow-x: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            ${sortHeader('id', 'Task ID')}
                            ${sortHeader('workType', 'Work Category')}
                            ${sortHeader('title', 'Title')}
                            ${sortHeader('stage', 'Development Stage')}
                            ${sortHeader('testingStatus', 'Testing Status')}
                            ${sortHeader('assignedTo', 'Assigned To')}
                            ${sortHeader('startDate', 'Start Date')}
                            ${sortHeader('endDate', 'Target End')}
                            ${sortHeader('implementationDate', 'Impl. Date')}
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredTasks.map(t => {
                            const statusClass = STATUS_COLORS[t.testingStatus] || 'status-waiting';
                            return `
                                <tr class="task-row" data-id="${t.id}" style="cursor: pointer;">
                                    <td><strong style="color:var(--accent-primary);">${t.id}</strong></td>
                                    <td><span class="tag">${Utils.escapeHTML(t.workType)}</span></td>
                                    <td><strong>${Utils.escapeHTML(t.title)}</strong></td>
                                    <td>
                                        <span style="font-size:0.85rem; color:var(--text-primary);">
                                            ${STAGE_LABELS[t.stage] || `Stage ${t.stage}`}
                                        </span>
                                    </td>
                                    <td><span class="status-badge ${statusClass}">${t.testingStatus}</span></td>
                                    <td><span style="color:var(--text-secondary); font-size:0.85rem;">${Utils.escapeHTML(t.assignedTo || 'Unassigned')}</span></td>
                                    <td><span style="font-size:0.85rem;">${t.startDate ? Utils.formatDate(t.startDate) : '—'}</span></td>
                                    <td><span style="font-size:0.85rem;">${t.endDate ? Utils.formatDate(t.endDate) : '—'}</span></td>
                                    <td><span style="font-size:0.85rem;">${t.implementationDate ? Utils.formatDate(t.implementationDate) : '—'}</span></td>
                                </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;

        // Bind sorting headers
        container.querySelectorAll('thead th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sort;
                if (_sort.column === col) {
                    _sort.direction = _sort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    _sort.column = col;
                    _sort.direction = 'asc';
                }
                _renderTable(container);
            });
        });

        // Bind row clicks to modal edit
        container.querySelectorAll('tbody tr.task-row').forEach(row => {
            row.addEventListener('click', () => {
                _openTaskModal(row.dataset.id);
            });
        });
    }

    function _openTaskModal(taskId = null) {
        const isEdit = !!taskId;
        const allAssignees = ['Devendra Kumar Soni', 'Sunil Kumar Singh', 'Arif', 'Pradeep', 'Harvinder', 'Priyesh Tiwari', 'OP Meenu'];
        const workCategories = ['Server', 'Hosting', 'Database', 'Security', 'Maintenance'];

        let data = {
            id: '',
            workType: 'Server',
            title: '',
            description: '',
            phase: 1,
            stage: 1,
            startDate: '',
            endDate: '',
            implementationDate: '',
            testingStatus: 'Pending',
            assignedTo: 'Devendra Kumar Soni'
        };

        if (isEdit) {
            const task = Store.getServerTasks().find(t => t.id === taskId);
            if (!task) return;
            data = { ...task };
        }

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'srv-modal-overlay';
        overlay.innerHTML = `
            <div class="modal modal-lg">
                <div class="modal-header">
                    <h2>${isEdit ? `✏️ Edit Server Task: ${data.id}` : '＋ Create New Server Task'}</h2>
                    <button class="modal-close" id="srv-modal-close" aria-label="Close modal">×</button>
                </div>
                <div class="modal-body">
                    <form id="srv-task-form" onsubmit="return false;">
                        <div class="form-group">
                            <label class="form-label" for="srv-field-title">Task Title</label>
                            <input type="text" class="form-input" id="srv-field-title" value="${Utils.escapeHTML(data.title)}" required placeholder="Enter a brief summary of the server task...">
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="srv-field-desc">Detailed Description</label>
                            <textarea class="form-textarea" id="srv-field-desc" rows="4" placeholder="Explain the maintenance work, query optimizations, or backup verification steps...">${Utils.escapeHTML(data.description || '')}</textarea>
                        </div>

                        <div class="form-row">
                            <div class="form-group" style="width: 25%; margin-bottom: 0;">
                                <label class="form-label" for="srv-field-worktype">Work Category</label>
                                <select class="form-select" id="srv-field-worktype">
                                    ${workCategories.map(w => `
                                        <option value="${w}" ${data.workType === w ? 'selected' : ''}>${w}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="form-group" style="width: 25%; margin-bottom: 0;">
                                <label class="form-label" for="srv-field-stage">Current Stage</label>
                                <select class="form-select" id="srv-field-stage">
                                    ${Object.entries(STAGE_LABELS).map(([k, v]) => `
                                        <option value="${k}" ${data.stage === parseInt(k, 10) ? 'selected' : ''}>${v}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="form-group" style="width: 20%; margin-bottom: 0;">
                                <label class="form-label" for="srv-field-status">Testing Status</label>
                                <select class="form-select" id="srv-field-status">
                                    ${TESTING_STATUSES.map(s => `
                                        <option value="${s}" ${data.testingStatus === s ? 'selected' : ''}>${s}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="form-group" style="width: 30%; margin-bottom: 0;">
                                <label class="form-label" for="srv-field-assigned">Assigned To</label>
                                <select class="form-select" id="srv-field-assigned">
                                    ${allAssignees.map(n => `
                                        <option value="${Utils.escapeHTML(n)}" ${data.assignedTo === n ? 'selected' : ''}>${Utils.escapeHTML(n)}</option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>

                        <div class="form-row mt-4">
                            <div class="form-group form-group-third">
                                <label class="form-label" for="srv-field-start">Start Date</label>
                                <input type="date" class="form-input" id="srv-field-start" value="${data.startDate || ''}">
                            </div>
                            <div class="form-group form-group-third">
                                <label class="form-label" for="srv-field-end">Target End Date</label>
                                <input type="date" class="form-input" id="srv-field-end" value="${data.endDate || ''}">
                            </div>
                            <div class="form-group form-group-third">
                                <label class="form-label" for="srv-field-impl">Implementation Date</label>
                                <input type="date" class="form-input" id="srv-field-impl" value="${data.implementationDate || ''}">
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="srv-btn-cancel">Cancel</button>
                    ${isEdit ? `<button class="btn btn-danger" id="srv-btn-delete">Delete</button>` : ''}
                    <div class="modal-footer-spacer"></div>
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: var(--text-secondary); cursor: pointer; user-select: none; margin-right: 12px;">
                        <input type="checkbox" id="srv-field-auto-email" ${Store.getSettings().autoEmail ? 'checked' : ''} style="cursor: pointer; width: auto; margin: 0;">
                        Email Alert
                    </label>
                    <button class="btn btn-primary" id="srv-btn-save">${isEdit ? 'Save Changes' : 'Create Task'}</button>
                </div>
            </div>`;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('active'));

        const close = () => {
            overlay.classList.remove('active');
            overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
        };

        overlay.querySelector('#srv-modal-close').addEventListener('click', close);
        overlay.querySelector('#srv-btn-cancel').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        if (isEdit) {
            overlay.querySelector('#srv-btn-delete').addEventListener('click', () => {
                if (confirm(`Are you sure you want to delete task ${data.id}?`)) {
                    Store.deleteServerTask(data.id);
                    App.showToast('Task deleted successfully', 'info');
                    close();
                    _applyFilters();
                }
            });
        }

        overlay.querySelector('#srv-btn-save').addEventListener('click', () => {
            const form = overlay.querySelector('#srv-task-form');
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            const payload = {
                workType: overlay.querySelector('#srv-field-worktype').value.trim(),
                title: overlay.querySelector('#srv-field-title').value.trim(),
                description: overlay.querySelector('#srv-field-desc').value.trim(),
                phase: 1,
                stage: parseInt(overlay.querySelector('#srv-field-stage').value, 10),
                testingStatus: overlay.querySelector('#srv-field-status').value,
                assignedTo: overlay.querySelector('#srv-field-assigned').value,
                startDate: overlay.querySelector('#srv-field-start').value || null,
                endDate: overlay.querySelector('#srv-field-end').value || null,
                implementationDate: overlay.querySelector('#srv-field-impl').value || null
            };

            const autoEmailChecked = overlay.querySelector('#srv-field-auto-email')?.checked;
            let saved = null;

            if (isEdit) {
                saved = Store.updateServerTask(data.id, payload);
                App.showToast('Task updated successfully', 'success');
            } else {
                saved = Store.createServerTask(payload);
                App.showToast('Task created successfully', 'success');
            }

            close();
            _applyFilters();

            if (autoEmailChecked && saved) {
                setTimeout(() => {
                    _generateServerTaskEmailAlert(saved);
                }, 250);
            }
        });
    }

    function _generateServerTaskEmailAlert(task) {
        const id = task.id;
        const title = task.title;
        const workType = task.workType;
        const stage = task.stage;
        const testingStatus = task.testingStatus;
        const assignedTo = task.assignedTo || 'Devendra Kumar Soni';
        const description = task.description || 'No description provided.';
        const startDate = task.startDate ? Utils.formatDate(task.startDate) : 'N/A';
        const endDate = task.endDate ? Utils.formatDate(task.endDate) : 'N/A';
        const implDate = task.implementationDate ? Utils.formatDate(task.implementationDate) : 'N/A';

        const toEmails = ['devsoni@hotmail.com'];
        const ccEmails = ['sunilkumarsingh@literacyindia.org', 'opmeenu@gmail.com', 'krishankant.yadav@literacyindia.org'];

        const stageLabel = STAGE_LABELS[stage] || `Stage ${stage}`;
        const subject = `[SERVER TASK ALERT] [${stageLabel}] ${id}: ${title}`;
        
        const body = `Hello Team,

A Server Task update has been recorded. Please find the details below:

--------------------------------------------------
Task ID        : ${id}
Work Category  : ${workType}
Title          : ${title}
Stage          : ${stageLabel}
Testing Status : ${testingStatus}
Assigned To    : ${assignedTo}
--------------------------------------------------
Start Date     : ${startDate}
Target End     : ${endDate}
Impl. Date     : ${implDate}
--------------------------------------------------
Description:
${description}

--------------------------------------------------
Direct App Link:
- Link: ${window.location.origin + window.location.pathname}#server-tasks

Regards,
Server Operations Desk`;

        const settings = Store.getSettings();
        const smtpHost = settings.smtpHost;
        const smtpPort = settings.smtpPort;
        const smtpUsername = settings.smtpUsername;
        const smtpPassword = settings.smtpPassword;

        if (smtpUsername && smtpPassword && window.Email) {
            App.showToast('Sending background server task email...', 'info');
            const htmlBody = body.replace(/\n/g, '<br>');

            window.Email.send({
                Host: smtpHost || 'smtp.gmail.com',
                Username: smtpUsername,
                Password: smtpPassword,
                To: toEmails.join(','),
                Cc: ccEmails.join(','),
                From: smtpUsername,
                Subject: subject,
                Body: htmlBody
            }).then((message) => {
                if (message === 'OK') {
                    App.showToast('Automatic server task email sent successfully!', 'success');
                } else {
                    console.error('SmtpJS Server Task Email Error:', message);
                    App.showToast('SmtpJS failed. Opening mail client...', 'warning');
                    
                    const mailtoUrl = `mailto:${toEmails.join(',')}?cc=${ccEmails.join(',')}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                    window.location.href = mailtoUrl;
                }
            }).catch((err) => {
                console.error('SmtpJS Server Task Email Exception:', err);
                App.showToast('SmtpJS failed. Opening mail client...', 'warning');
                
                const mailtoUrl = `mailto:${toEmails.join(',')}?cc=${ccEmails.join(',')}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                window.location.href = mailtoUrl;
            });
        } else {
            const mailtoUrl = `mailto:${toEmails.join(',')}?cc=${ccEmails.join(',')}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            window.location.href = mailtoUrl;
        }
    }

    return {
        render
    };
})();
