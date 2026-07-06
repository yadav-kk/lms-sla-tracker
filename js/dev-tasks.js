/**
 * dev-tasks.js — Development Task Tracker module
 * LMS SLA Tracker
 */

const DevTasksPage = (() => {
    let _container = null;
    let _filters = { phase: 'all', stage: 'all', testingStatus: 'all', workType: 'all', search: '', startDate: '', endDate: '', implDate: '' };
    let _sort = { column: 'id', direction: 'asc' };

    const STAGE_LABELS = {
        1: 'Stage 1: Backlog / Defined',
        2: 'Stage 2: In Development',
        3: 'Stage 3: Testing / UAT',
        4: 'Stage 4: Approved',
        5: 'Stage 5: Deployed'
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
                <h1 class="page-title">Development Task Tracker</h1>
                <p class="page-subtitle">Track custom work requests, stage progress, and testing feedback</p>
            </div>
            <div class="header-actions">
                <button class="btn btn-primary" id="dev-btn-new">＋ Add Task</button>
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
        tableContainer.id = 'dev-tasks-content';
        tableContainer.className = 'issues-content';
        _container.appendChild(tableContainer);
        _renderTable(tableContainer);

        // Bind events
        header.querySelector('#dev-btn-new').addEventListener('click', () => _openTaskModal(null));

        // Auto open if task ID passed in params
        if (params.taskId) {
            setTimeout(() => _openTaskModal(params.taskId), 150);
        }
    }

    function _renderMetrics(container) {
        const tasks = Store.getDevTasks();
        const total = tasks.length;
        const inDev = tasks.filter(t => t.stage === 2).length;
        const inTesting = tasks.filter(t => t.stage === 3).length;
        const passed = tasks.filter(t => t.testingStatus === 'Success').length;

        container.innerHTML = `
            <div class="glass-card metric-card animate-slide-up" style="border-top: 4px solid var(--accent-primary);">
                <div class="metric-value">${total}</div>
                <div class="metric-label">Total Custom Tasks</div>
            </div>
            <div class="glass-card metric-card animate-slide-up" style="border-top: 4px solid var(--warning); animation-delay: 50ms;">
                <div class="metric-value">${inDev}</div>
                <div class="metric-label">In Development (Stage 2)</div>
            </div>
            <div class="glass-card metric-card animate-slide-up" style="border-top: 4px solid var(--info); animation-delay: 100ms;">
                <div class="metric-value">${inTesting}</div>
                <div class="metric-label">In Testing / UAT (Stage 3)</div>
            </div>
            <div class="glass-card metric-card animate-slide-up" style="border-top: 4px solid var(--success); animation-delay: 150ms;">
                <div class="metric-value">${passed}</div>
                <div class="metric-label">Passed Testing (Success)</div>
            </div>`;
    }

    function _renderFilters(container) {
        const tasks = Store.getDevTasks();
        const workTypes = [...new Set(tasks.map(t => t.workType))].sort();

        container.innerHTML = `
            <div class="filters-bar" style="gap: 12px; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));">
                <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label" style="font-size:0.7rem;">Search</label>
                    <input type="text" class="form-input" id="dev-filter-search" value="${Utils.escapeHTML(_filters.search)}" placeholder="Search task title/desc...">
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label" style="font-size:0.7rem;">Work Type / Module</label>
                    <select class="form-select" id="dev-filter-worktype">
                        <option value="all">All Modules</option>
                        ${workTypes.map(w => `<option value="${Utils.escapeHTML(w)}" ${_filters.workType === w ? 'selected' : ''}>${Utils.escapeHTML(w)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label" style="font-size:0.7rem;">Phase</label>
                    <select class="form-select" id="dev-filter-phase">
                        <option value="all">All Phases</option>
                        <option value="1" ${_filters.phase === '1' ? 'selected' : ''}>Phase 1 (Tasks 1-14)</option>
                        <option value="2" ${_filters.phase === '2' ? 'selected' : ''}>Phase 2 (Tasks 15-24)</option>
                        <option value="3" ${_filters.phase === '3' ? 'selected' : ''}>Phase 3 (Tasks 25-34)</option>
                        <option value="4" ${_filters.phase === '4' ? 'selected' : ''}>Phase 4 (Tasks 35-47)</option>
                        <option value="5" ${_filters.phase === '5' ? 'selected' : ''}>Phase 5 (Tasks 48-60)</option>
                    </select>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label" style="font-size:0.7rem;">Stage</label>
                    <select class="form-select" id="dev-filter-stage">
                        <option value="all">All Stages</option>
                        ${Object.entries(STAGE_LABELS).map(([k, v]) => `<option value="${k}" ${_filters.stage === k ? 'selected' : ''}>${v}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label" style="font-size:0.7rem;">Testing Status</label>
                    <select class="form-select" id="dev-filter-status">
                        <option value="all">All Statuses</option>
                        ${TESTING_STATUSES.map(s => `<option value="${s}" ${_filters.testingStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="filters-bar mt-3" style="gap: 12px; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
                <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label" style="font-size:0.7rem;">Start Date</label>
                    <input type="date" class="form-input" id="dev-filter-startdate" value="${_filters.startDate}">
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label" style="font-size:0.7rem;">End Date</label>
                    <input type="date" class="form-input" id="dev-filter-enddate" value="${_filters.endDate}">
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label" style="font-size:0.7rem;">Implementation Date</label>
                    <input type="date" class="form-input" id="dev-filter-impldate" value="${_filters.implDate}">
                </div>
                <div class="form-group" style="margin-bottom: 0; display: flex; align-items: flex-end;">
                    <button class="btn btn-secondary btn-full" id="dev-filter-reset">Reset Filters</button>
                </div>
            </div>`;

        // Filter event listeners
        const searchInput = container.querySelector('#dev-filter-search');
        searchInput.addEventListener('input', Utils.debounce(() => {
            _filters.search = searchInput.value.trim();
            _applyFilters();
        }, 300));

        container.querySelector('#dev-filter-worktype').addEventListener('change', (e) => {
            _filters.workType = e.target.value;
            _applyFilters();
        });

        container.querySelector('#dev-filter-phase').addEventListener('change', (e) => {
            _filters.phase = e.target.value;
            _applyFilters();
        });

        container.querySelector('#dev-filter-stage').addEventListener('change', (e) => {
            _filters.stage = e.target.value;
            _applyFilters();
        });

        container.querySelector('#dev-filter-status').addEventListener('change', (e) => {
            _filters.testingStatus = e.target.value;
            _applyFilters();
        });

        container.querySelector('#dev-filter-startdate').addEventListener('change', (e) => {
            _filters.startDate = e.target.value;
            _applyFilters();
        });

        container.querySelector('#dev-filter-enddate').addEventListener('change', (e) => {
            _filters.endDate = e.target.value;
            _applyFilters();
        });

        container.querySelector('#dev-filter-impldate').addEventListener('change', (e) => {
            _filters.implDate = e.target.value;
            _applyFilters();
        });

        container.querySelector('#dev-filter-reset').addEventListener('click', () => {
            _filters = { phase: 'all', stage: 'all', testingStatus: 'all', workType: 'all', search: '', startDate: '', endDate: '', implDate: '' };
            _renderFilters(container);
            _applyFilters();
        });
    }

    function _getFilteredTasks() {
        let tasks = Store.getDevTasks();

        // 1. Search Query
        if (_filters.search) {
            const query = _filters.search.toLowerCase();
            tasks = tasks.filter(t => 
                (t.title && t.title.toLowerCase().includes(query)) ||
                (t.description && t.description.toLowerCase().includes(query)) ||
                (t.id && t.id.toLowerCase().includes(query))
            );
        }

        // 2. Work Type
        if (_filters.workType !== 'all') {
            tasks = tasks.filter(t => t.workType === _filters.workType);
        }

        // 2.5 Phase
        if (_filters.phase !== 'all') {
            tasks = tasks.filter(t => t.phase === parseInt(_filters.phase, 10));
        }

        // 3. Stage
        if (_filters.stage !== 'all') {
            tasks = tasks.filter(t => t.stage === parseInt(_filters.stage, 10));
        }

        // 4. Testing Status
        if (_filters.testingStatus !== 'all') {
            tasks = tasks.filter(t => t.testingStatus === _filters.testingStatus);
        }

        // 5. Start Date Filter
        if (_filters.startDate) {
            tasks = tasks.filter(t => t.startDate && t.startDate >= _filters.startDate);
        }

        // 6. End Date Filter
        if (_filters.endDate) {
            tasks = tasks.filter(t => t.endDate && t.endDate <= _filters.endDate);
        }

        // 7. Implementation Date Filter
        if (_filters.implDate) {
            tasks = tasks.filter(t => t.implementationDate === _filters.implDate);
        }

        // Sorting
        tasks.sort((a, b) => {
            let valA = a[_sort.column];
            let valB = b[_sort.column];

            if (valA == null) return _sort.direction === 'asc' ? 1 : -1;
            if (valB == null) return _sort.direction === 'asc' ? -1 : 1;

            if (typeof valA === 'string') {
                return _sort.direction === 'asc' 
                    ? valA.localeCompare(valB) 
                    : valB.localeCompare(valA);
            } else {
                return _sort.direction === 'asc' ? valA - valB : valB - valA;
            }
        });

        return tasks;
    }

    function _applyFilters() {
        const content = _container.querySelector('#dev-tasks-content');
        if (content) _renderTable(content);
        
        const metrics = _container.querySelector('.metrics-grid');
        if (metrics) _renderMetrics(metrics);
    }

    function _renderTable(container) {
        const tasks = _getFilteredTasks();

        if (tasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state glass-card p-5">
                    <div class="empty-state-icon">📋</div>
                    <h3>No tasks found</h3>
                    <p>Adjust your filters above or add a new development task.</p>
                </div>`;
            return;
        }

        const columns = [
            { key: 'id',                 label: 'ID',           sortable: true },
            { key: 'workType',           label: 'Work Type',    sortable: true },
            { key: 'phase',              label: 'Phase',        sortable: true },
            { key: 'title',              label: 'Task Title',   sortable: true },
            { key: 'stage',              label: 'Progress Stage',sortable: true },
            { key: 'startDate',          label: 'Start Date',   sortable: true },
            { key: 'endDate',            label: 'Target End',   sortable: true },
            { key: 'implementationDate', label: 'Impl Date',    sortable: true },
            { key: 'testingStatus',      label: 'Testing',      sortable: true },
            { key: 'assignedTo',         label: 'Assigned To',  sortable: true }
        ];

        const sortArrow = (key) => {
            if (_sort.column !== key) return '';
            return _sort.direction === 'asc' ? ' ▲' : ' ▼';
        };

        let html = `<div class="table-wrapper"><table class="data-table">
            <thead><tr>
                ${columns.map(c => `
                    <th class="sortable" data-sort-key="${c.key}">
                        ${c.label}<span class="sort-arrow">${sortArrow(c.key)}</span>
                    </th>`).join('')}
                <th>Action</th>
            </tr></thead>
            <tbody>`;

        tasks.forEach(task => {
            const statusClass = STATUS_COLORS[task.testingStatus] || 'status-waiting';
            const progressPct = task.stage * 20; // 5 stages: 20%, 40%, 60%, 80%, 100%
            
            // Set progress color based on stage
            let progressColor = 'var(--p4-color)';
            if (task.stage === 2) progressColor = 'var(--p3-color)';
            if (task.stage === 3) progressColor = 'var(--p2-color)';
            if (task.stage === 4) progressColor = 'var(--accent-primary)';
            if (task.stage === 5) progressColor = 'var(--success)';

            html += `
                <tr class="issue-row" data-task-id="${task.id}">
                    <td class="td-id">${Utils.escapeHTML(task.id)}</td>
                    <td class="td-module"><strong>${Utils.escapeHTML(task.workType)}</strong></td>
                    <td><span class="tag">Phase ${task.phase}</span></td>
                    <td class="td-title" title="${Utils.escapeHTML(task.description || '')}">${Utils.escapeHTML(task.title)}</td>
                    <td>
                        <div class="progress-bar-container" title="Stage ${task.stage}: ${STAGE_LABELS[task.stage]}" style="width: 120px; background: rgba(255,255,255,0.06); border-radius: 4px; height: 10px; overflow: hidden; position: relative;">
                            <div class="progress-bar-fill" style="width: ${progressPct}%; background: ${progressColor}; height: 100%; border-radius: 4px; transition: width 0.3s ease;"></div>
                        </div>
                        <small class="text-muted" style="font-size: 0.7rem; margin-top: 2px; display: block;">Stage ${task.stage}</small>
                    </td>
                    <td class="td-date">${task.startDate ? Utils.formatDate(task.startDate) : '—'}</td>
                    <td class="td-date">${task.endDate ? Utils.formatDate(task.endDate) : '—'}</td>
                    <td class="td-date">${task.implementationDate ? Utils.formatDate(task.implementationDate) : '—'}</td>
                    <td><span class="badge ${statusClass}">${Utils.escapeHTML(task.testingStatus)}</span></td>
                    <td>${Utils.escapeHTML(task.assignedTo || '—')}</td>
                    <td>
                        <button class="btn btn-secondary btn-sm dev-edit-btn" data-task-id="${task.id}" style="padding: 4px 8px;">Edit</button>
                    </td>
                </tr>`;
        });

        html += `</tbody></table></div>`;
        container.innerHTML = html;

        // Header click sorts
        container.querySelectorAll('th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const key = th.dataset.sortKey;
                if (_sort.column === key) {
                    _sort.direction = _sort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    _sort.column = key;
                    _sort.direction = 'asc';
                }
                _renderTable(container);
            });
        });

        // Row edit button click
        container.querySelectorAll('.dev-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                _openTaskModal(btn.dataset.taskId);
            });
        });

        // Row double-click open modal
        container.querySelectorAll('.issue-row').forEach(row => {
            row.addEventListener('click', () => {
                _openTaskModal(row.dataset.taskId);
            });
        });
    }

    function _openTaskModal(taskId) {
        const isEdit = !!taskId;
        const task = isEdit ? Store.getDevTasks().find(t => t.id === taskId) : null;

        if (isEdit && !task) {
            App.showToast('Task not found', 'error');
            return;
        }

        const data = task || {
            workType: '', title: '', description: '',
            phase: 1, stage: 1, startDate: '', endDate: '', implementationDate: '',
            testingStatus: 'Pending', assignedTo: ''
        };

        // Flatten unique assignee names
        const allAssignees = [];
        Store.ESCALATION_CONTACTS.forEach(c => {
            c.names.forEach(n => {
                if (!allAssignees.includes(n)) allAssignees.push(n);
            });
        });

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'dev-task-modal-overlay';
        overlay.innerHTML = `
            <div class="modal modal-lg" id="dev-task-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
                <div class="modal-header">
                    <h3 id="modal-title">${isEdit ? `Edit Task [${data.id}]` : 'Add New Custom Task'}</h3>
                    <button class="modal-close" id="dev-modal-close" aria-label="Close modal">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="dev-task-form">
                        <div class="form-row">
                            <div class="form-group form-group-half">
                                <label class="form-label" for="dev-field-worktype">Work Type / Module</label>
                                <input type="text" class="form-input" id="dev-field-worktype" value="${Utils.escapeHTML(data.workType)}" placeholder="e.g. Teacher Profile, LMS, Student" required>
                            </div>
                            <div class="form-group form-group-half">
                                <label class="form-label" for="dev-field-title">Task Title</label>
                                <input type="text" class="form-input" id="dev-field-title" value="${Utils.escapeHTML(data.title)}" placeholder="Short name of task" required>
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="dev-field-desc">Description</label>
                            <textarea class="form-textarea" id="dev-field-desc" rows="3" placeholder="Provide full details of request...">${Utils.escapeHTML(data.description || '')}</textarea>
                        </div>

                        <div class="form-row">
                            <div class="form-group" style="width: 20%; margin-bottom: 0;">
                                <label class="form-label" for="dev-field-phase">Phase</label>
                                <select class="form-select" id="dev-field-phase">
                                    <option value="1" ${data.phase == 1 ? 'selected' : ''}>Phase 1</option>
                                    <option value="2" ${data.phase == 2 ? 'selected' : ''}>Phase 2</option>
                                    <option value="3" ${data.phase == 3 ? 'selected' : ''}>Phase 3</option>
                                    <option value="4" ${data.phase == 4 ? 'selected' : ''}>Phase 4</option>
                                    <option value="5" ${data.phase == 5 ? 'selected' : ''}>Phase 5</option>
                                </select>
                            </div>
                            <div class="form-group" style="width: 25%; margin-bottom: 0;">
                                <label class="form-label" for="dev-field-stage">Progress Stage</label>
                                <select class="form-select" id="dev-field-stage">
                                    ${Object.entries(STAGE_LABELS).map(([k, v]) => `
                                        <option value="${k}" ${data.stage == k ? 'selected' : ''}>${v}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="form-group" style="width: 25%; margin-bottom: 0;">
                                <label class="form-label" for="dev-field-status">Testing Status</label>
                                <select class="form-select" id="dev-field-status">
                                    ${TESTING_STATUSES.map(s => `
                                        <option value="${s}" ${data.testingStatus === s ? 'selected' : ''}>${s}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="form-group" style="width: 30%; margin-bottom: 0;">
                                <label class="form-label" for="dev-field-assigned">Assigned To</label>
                                <select class="form-select" id="dev-field-assigned">
                                    <option value="">— Unassigned —</option>
                                    ${allAssignees.map(n => `
                                        <option value="${Utils.escapeHTML(n)}" ${data.assignedTo === n ? 'selected' : ''}>${Utils.escapeHTML(n)}</option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group form-group-third">
                                <label class="form-label" for="dev-field-start">Start Date</label>
                                <input type="date" class="form-input" id="dev-field-start" value="${data.startDate || ''}">
                            </div>
                            <div class="form-group form-group-third">
                                <label class="form-label" for="dev-field-end">Target End Date</label>
                                <input type="date" class="form-input" id="dev-field-end" value="${data.endDate || ''}">
                            </div>
                            <div class="form-group form-group-third">
                                <label class="form-label" for="dev-field-impl">Implementation Date</label>
                                <input type="date" class="form-input" id="dev-field-impl" value="${data.implementationDate || ''}">
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="dev-btn-cancel">Cancel</button>
                    ${isEdit ? `<button class="btn btn-danger" id="dev-btn-delete">Delete</button>` : ''}
                    <div class="modal-footer-spacer"></div>
                    <button class="btn btn-primary" id="dev-btn-save">${isEdit ? 'Save Changes' : 'Create Task'}</button>
                </div>
            </div>`;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('active'));

        const close = () => {
            overlay.classList.remove('active');
            overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
        };

        overlay.querySelector('#dev-modal-close').addEventListener('click', close);
        overlay.querySelector('#dev-btn-cancel').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        if (isEdit) {
            overlay.querySelector('#dev-btn-delete').addEventListener('click', () => {
                if (confirm(`Are you sure you want to delete task ${data.id}?`)) {
                    Store.deleteDevTask(data.id);
                    App.showToast('Task deleted successfully', 'info');
                    close();
                    _applyFilters();
                }
            });
        }

        overlay.querySelector('#dev-btn-save').addEventListener('click', () => {
            const form = overlay.querySelector('#dev-task-form');
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            const payload = {
                workType: overlay.querySelector('#dev-field-worktype').value.trim(),
                title: overlay.querySelector('#dev-field-title').value.trim(),
                description: overlay.querySelector('#dev-field-desc').value.trim(),
                phase: parseInt(overlay.querySelector('#dev-field-phase').value, 10),
                stage: parseInt(overlay.querySelector('#dev-field-stage').value, 10),
                testingStatus: overlay.querySelector('#dev-field-status').value,
                assignedTo: overlay.querySelector('#dev-field-assigned').value,
                startDate: overlay.querySelector('#dev-field-start').value || null,
                endDate: overlay.querySelector('#dev-field-end').value || null,
                implementationDate: overlay.querySelector('#dev-field-impl').value || null
            };

            if (isEdit) {
                Store.updateDevTask(data.id, payload);
                App.showToast('Task updated successfully', 'success');
            } else {
                Store.createDevTask(payload);
                App.showToast('Task created successfully', 'success');
            }

            close();
            _applyFilters();
        });
    }

    return {
        render
    };
})();
