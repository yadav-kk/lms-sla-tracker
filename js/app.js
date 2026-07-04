/**
 * app.js — Application Shell, Router & Settings Page
 * LMS SLA Issue Tracker
 *
 * Responsibilities:
 *  - Hash-based SPA router
 *  - Sidebar navigation state management
 *  - Toast notification system
 *  - Settings page (inline)
 *  - Global App API
 */

const App = (() => {

    // ── Page registry ────────────────────────────────────────────────
    // Maps route keys to { title, module } where module.render(container) draws the page.
    // Page modules that haven't been loaded yet will be undefined — router handles gracefully.
    const PAGES = {
        'dashboard':     { title: 'Dashboard',     module: () => typeof DashboardPage     !== 'undefined' ? DashboardPage     : null },
        'issues':        { title: 'Issues',         module: () => typeof IssuesPage        !== 'undefined' ? IssuesPage        : null },
        'uptime':        { title: 'Uptime',         module: () => typeof UptimePage        !== 'undefined' ? UptimePage        : null },
        'sla-reference': { title: 'SLA Reference',  module: () => typeof SLAReferencePage  !== 'undefined' ? SLAReferencePage  : null },
        'settings':      { title: 'Settings',       module: () => ({ render: renderSettingsPage }) }
    };

    const DEFAULT_PAGE = 'dashboard';
    let currentPage = null;

    // ── DOM references (cached after init) ───────────────────────────
    let $sidebar, $nav, $pageTitle, $headerActions, $pageContent, $toastContainer, $sidebarToggle;


    /* ═══════════════════════════════════════════════════════════════
       INITIALIZATION
       ═══════════════════════════════════════════════════════════════ */
    function init() {
        // Cache DOM
        $sidebar        = document.getElementById('app-sidebar');
        $nav            = document.getElementById('sidebar-nav');
        $pageTitle      = document.getElementById('page-title');
        $headerActions  = document.getElementById('header-actions');
        $pageContent    = document.getElementById('page-content');
        $toastContainer = document.getElementById('toast-container');
        $sidebarToggle  = document.getElementById('sidebar-toggle');

        // Bind nav clicks
        $nav.addEventListener('click', handleNavClick);

        // Hash change listener
        window.addEventListener('hashchange', handleHashChange);

        // Mobile sidebar toggle
        if ($sidebarToggle) {
            $sidebarToggle.addEventListener('click', toggleMobileSidebar);
        }

        // Navigate to initial page (from hash or default)
        const initialPage = getPageFromHash() || DEFAULT_PAGE;
        navigate(initialPage);

        // Auto-sync from Supabase Cloud on startup if enabled
        if (Store.isSupabaseEnabled()) {
            showToast('🔄 Syncing with Supabase Cloud...', 'info');
            Store.syncFromCloud()
                .then(() => {
                    showToast('✅ Cloud database sync complete!', 'success');
                    // Refresh current page view
                    if (currentPage) navigate(currentPage);
                })
                .catch(err => {
                    console.error("Startup sync error:", err);
                    showToast('⚠️ Cloud sync failed. Using local cache.', 'warning');
                });
        }
    }


    /* ═══════════════════════════════════════════════════════════════
       ROUTER
       ═══════════════════════════════════════════════════════════════ */

    /**
     * Extract page key from the URL hash.
     * e.g. '#issues' → 'issues', '#sla-reference' → 'sla-reference'
     */
    function getPageFromHash() {
        const hash = window.location.hash.replace('#', '').toLowerCase();
        return PAGES[hash] ? hash : null;
    }

    /** Handle browser back/forward (hashchange). */
    function handleHashChange() {
        const page = getPageFromHash() || DEFAULT_PAGE;
        if (page !== currentPage) {
            navigate(page);
        }
    }

    /** Handle sidebar nav link clicks. */
    function handleNavClick(e) {
        const link = e.target.closest('.nav-link');
        if (!link) return;

        e.preventDefault();
        const page = link.dataset.page;
        if (page) navigate(page);
    }

    /**
     * Navigate to a page.
     * Updates: hash, sidebar active state, page title, header actions, rendered content.
     */
    function navigate(page) {
        const entry = PAGES[page];
        if (!entry) return;

        currentPage = page;

        // 1. Update hash (silently — avoid re-triggering hashchange)
        if (window.location.hash !== '#' + page) {
            history.replaceState(null, '', '#' + page);
        }

        // 2. Update sidebar active link
        const links = $nav.querySelectorAll('.nav-link');
        links.forEach(l => {
            const isActive = l.dataset.page === page;
            l.classList.toggle('nav-active', isActive);
            if (isActive) {
                l.setAttribute('aria-current', 'page');
            } else {
                l.removeAttribute('aria-current');
            }
        });

        // 3. Update header
        $pageTitle.textContent = entry.title;
        $headerActions.innerHTML = '';  // clear — each page can re-populate

        // 4. Close mobile sidebar if open
        closeMobileSidebar();

        // 5. Render the page module
        $pageContent.innerHTML = '';  // clear previous
        const mod = entry.module();
        if (mod && typeof mod.render === 'function') {
            mod.render($pageContent);
        } else {
            $pageContent.innerHTML = `
                <div class="empty-state animate-fade-in">
                    <div class="empty-state-icon">🚧</div>
                    <div class="empty-state-title">Module Loading…</div>
                    <div class="empty-state-text">The "${entry.title}" module hasn't been loaded. Make sure the script is included in index.html.</div>
                </div>`;
        }
    }

    /** Return the current page key. */
    function getCurrentPage() {
        return currentPage;
    }


    /* ═══════════════════════════════════════════════════════════════
       MOBILE SIDEBAR
       ═══════════════════════════════════════════════════════════════ */
    function toggleMobileSidebar() {
        $sidebar.classList.toggle('open');
        // Create / show overlay
        let overlay = document.querySelector('.sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            overlay.addEventListener('click', closeMobileSidebar);
            document.body.appendChild(overlay);
        }
        overlay.classList.toggle('active', $sidebar.classList.contains('open'));
    }

    function closeMobileSidebar() {
        $sidebar.classList.remove('open');
        const overlay = document.querySelector('.sidebar-overlay');
        if (overlay) overlay.classList.remove('active');
    }


    /* ═══════════════════════════════════════════════════════════════
       TOAST NOTIFICATIONS
       ═══════════════════════════════════════════════════════════════ */

    /**
     * Show a toast notification.
     * @param {string} message  - The message to display.
     * @param {'success'|'error'|'warning'|'info'} type - Visual variant (default 'info').
     * @param {number} duration - Auto-dismiss in ms (default 3000).
     */
    function showToast(message, type = 'info', duration = 3000) {
        const icons = {
            success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l2.5 2.5L16 9"/></svg>',
            error:   '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            info:    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon" style="color: var(--${type === 'error' ? 'danger' : type})">${icons[type] || icons.info}</span>
            <span class="toast-message">${Utils.escapeHTML(message)}</span>
            <button class="toast-close" aria-label="Dismiss">&times;</button>
        `;

        // Close on click
        toast.querySelector('.toast-close').addEventListener('click', () => dismissToast(toast));

        $toastContainer.appendChild(toast);

        // Auto-dismiss
        const timer = setTimeout(() => dismissToast(toast), duration);
        toast._timer = timer;
    }

    /** Remove a toast with exit animation. */
    function dismissToast(toast) {
        if (toast._dismissed) return;
        toast._dismissed = true;
        clearTimeout(toast._timer);
        toast.classList.add('toast-removing');
        toast.addEventListener('animationend', () => toast.remove());
    }


    /* ═══════════════════════════════════════════════════════════════
       SETTINGS PAGE  (rendered inline — no separate module file)
       ═══════════════════════════════════════════════════════════════ */
    function renderSettingsPage(container) {
        const settings = Store.getSettings();

        // Build month options for reporting month selector (past 12 months + current)
        const monthOptions = buildMonthOptions(settings.reportingMonth);

        container.innerHTML = `
        <div class="settings-grid animate-slide-up">

            <!-- ── General Settings ──────────────────────────────── -->
            <div class="glass-card-static settings-section">
                <h3 class="settings-section-title">General Settings</h3>

                <div class="form-group">
                    <label class="form-label" for="settings-company">Company Name</label>
                    <input type="text" id="settings-company" class="form-input"
                           value="${Utils.escapeHTML(settings.companyName || '')}"
                           placeholder="e.g. Acme University">
                </div>

                <div class="form-group">
                    <label class="form-label" for="settings-amc">AMC Monthly Charge (₹)</label>
                    <input type="number" id="settings-amc" class="form-input"
                           value="${settings.amcMonthlyCharge || 0}"
                           min="0" step="1000"
                           placeholder="e.g. 150000">
                    <div class="form-hint">Used to calculate penalty deduction amounts.</div>
                </div>

                <div class="form-group">
                    <label class="form-label" for="settings-month">Reporting Month</label>
                    <select id="settings-month" class="form-select">
                        ${monthOptions}
                    </select>
                    <div class="form-hint">Default month used across Dashboard and Uptime views.</div>
                </div>

                <button id="settings-save-btn" class="btn btn-primary mt-4">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    Save Settings
                </button>
            </div>

            <!-- ── Data Management ───────────────────────────────── -->
            <div class="glass-card-static settings-section">
                <h3 class="settings-section-title">Data Management</h3>

                <p class="text-sm text-secondary-color mb-5" style="line-height:1.6">
                    Export your data as a JSON backup, import a previous backup, or reset all data to start fresh.
                </p>

                <div class="settings-actions mb-5">
                    <button id="settings-export-btn" class="btn btn-secondary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Export JSON
                    </button>
                    <button id="settings-import-btn" class="btn btn-secondary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        Import JSON
                    </button>
                </div>

                <!-- Hidden file input for import -->
                <input type="file" id="settings-import-file" accept=".json" class="hidden">

                <div class="divider"></div>

                <div class="mb-2">
                    <p class="text-sm text-danger font-semibold mb-2">Danger Zone</p>
                    <p class="text-sm text-muted mb-4" style="line-height:1.6">
                        This will permanently delete all issues, uptime logs, and settings. This action cannot be undone.
                    </p>
                    <button id="settings-clear-btn" class="btn btn-danger">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                        Clear All Data
                    </button>
                </div>
            </div>

            <!-- ── Supabase Cloud Database Settings ──────────────── -->
            <div class="glass-card-static settings-section">
                <h3 class="settings-section-title">☁️ Supabase Cloud Database</h3>
                
                <p class="text-sm text-secondary mb-4" style="line-height:1.6">
                    Linked to Supabase Cloud Database via configuration parameters (<code>js/config.js</code>).
                </p>

                <div class="form-hint mb-4" style="padding: 12px; border-radius: var(--radius-md); background: var(--bg-primary); border: 1px solid var(--border-glass);">
                    Connection Status: 
                    <strong id="supabase-status" class="${Store.isSupabaseEnabled() ? 'text-success' : 'text-muted'}">
                        ${Store.isSupabaseEnabled() ? 'Active / Connected' : 'Inactive / Local Storage Only'}
                    </strong>
                </div>

                <div class="settings-actions" style="display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; gap:10px; width:100%;">
                        <button id="settings-supabase-sync-btn" class="btn btn-primary" style="flex:1;">
                            ☁️ Sync From Cloud
                        </button>
                        <button id="settings-supabase-upload-btn" class="btn btn-secondary" style="flex:1;">
                            📤 Upload Local Data
                        </button>
                    </div>
                </div>
            </div>

        </div>`;

        // ── Wire up event listeners ─────────────────────────────────
        bindSettingsEvents();
    }

    /** Generate <option> elements for the past 13 months. */
    function buildMonthOptions(selectedYM) {
        const now = new Date();
        let options = '';
        for (let i = 0; i <= 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
            const sel = ym === selectedYM ? ' selected' : '';
            options += `<option value="${ym}"${sel}>${label}</option>`;
        }
        return options;
    }

    /** Attach click/change handlers for the settings form. */
    function bindSettingsEvents() {
        // Save
        document.getElementById('settings-save-btn').addEventListener('click', () => {
            const companyName    = document.getElementById('settings-company').value.trim();
            const amcMonthlyCharge = parseFloat(document.getElementById('settings-amc').value) || 0;
            const reportingMonth = document.getElementById('settings-month').value;

            Store.updateSettings({ companyName, amcMonthlyCharge, reportingMonth });
            showToast('Settings saved successfully.', 'success');
        });

        // Export JSON
        document.getElementById('settings-export-btn').addEventListener('click', () => {
            try {
                const data = Store.exportAllData();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement('a');
                a.href     = url;
                a.download = `lms-sla-backup-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
                showToast('Data exported successfully.', 'success');
            } catch (err) {
                showToast('Export failed: ' + err.message, 'error');
            }
        });

        // Import JSON — trigger file picker
        document.getElementById('settings-import-btn').addEventListener('click', () => {
            document.getElementById('settings-import-file').click();
        });

        document.getElementById('settings-import-file').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    Store.importData(data);
                    showToast('Data imported successfully. Refreshing…', 'success');
                    // Re-render settings page to reflect new data
                    setTimeout(() => navigate('settings'), 500);
                } catch (err) {
                    showToast('Import failed: ' + err.message, 'error');
                }
            };
            reader.readAsText(file);
            // Reset so same file can be re-selected
            e.target.value = '';
        });

        // Clear all data
        document.getElementById('settings-clear-btn').addEventListener('click', () => {
            if (!confirm('⚠️ Are you sure you want to delete ALL data?\n\nThis will remove all issues, uptime logs, and settings permanently.')) {
                return;
            }
            // Double confirmation for safety
            if (!confirm('This is your last chance. Proceed with deletion?')) {
                return;
            }
            Store.clearAllData();
            showToast('All data has been cleared.', 'warning');
            setTimeout(() => navigate('settings'), 300);
        });



        // Sync From Cloud
        document.getElementById('settings-supabase-sync-btn').addEventListener('click', async () => {
            const btn = document.getElementById('settings-supabase-sync-btn');
            const origText = btn.textContent;
            btn.textContent = '⚡ Syncing...';
            btn.disabled = true;

            try {
                await Store.syncFromCloud();
                showToast('Synchronized data from cloud successfully!', 'success');
                // Re-render settings page to show updated database values
                setTimeout(() => navigate('settings'), 500);
            } catch (err) {
                showToast('Sync failed: ' + err.message, 'error');
            } finally {
                btn.textContent = origText;
                btn.disabled = false;
            }
        });

        // Upload to Cloud
        document.getElementById('settings-supabase-upload-btn').addEventListener('click', async () => {
            if (!confirm('This will upload all your local tickets and uptime logs to Supabase, merging with existing records. Continue?')) {
                return;
            }

            const btn = document.getElementById('settings-supabase-upload-btn');
            const origText = btn.textContent;
            btn.textContent = '⚡ Uploading...';
            btn.disabled = true;

            try {
                await Store.uploadToCloud();
                showToast('Uploaded local data to Supabase successfully!', 'success');
            } catch (err) {
                showToast('Upload failed: ' + err.message, 'error');
            } finally {
                btn.textContent = origText;
                btn.disabled = false;
            }
        });
    }


    /* ═══════════════════════════════════════════════════════════════
       HELPER: Header Actions  (used by page modules)
       ═══════════════════════════════════════════════════════════════ */
    /**
     * Convenience for page modules to populate header action buttons.
     * @param {string} html - HTML string of buttons to place in the header.
     */
    function setHeaderActions(html) {
        if ($headerActions) $headerActions.innerHTML = html;
    }


    /* ═══════════════════════════════════════════════════════════════
       PUBLIC API
       ═══════════════════════════════════════════════════════════════ */
    return {
        init,
        navigate,
        showToast,
        getCurrentPage,
        setHeaderActions
    };

})();


/* ═══════════════════════════════════════════════════════════════════
   BOOTSTRAP — kick off when DOM is ready
   ═══════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
