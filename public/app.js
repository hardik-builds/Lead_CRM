document.addEventListener('DOMContentLoaded', () => {
  // App State
  let currentTab = 'all';
  let allLeads = [];
  let currentSettings = {};
  let currentNotifications = [];

  // DOM Elements
  const navButtons = document.querySelectorAll('.nav-item');
  const leadsTbody = document.getElementById('leads-tbody');
  const emptyState = document.getElementById('empty-state');
  const globalSearch = document.getElementById('global-search');
  const statusFilter = document.getElementById('status-filter');
  const scoreSort = document.getElementById('score-sort');
  const viewTitle = document.getElementById('view-title');
  const viewDesc = document.getElementById('view-desc');
  const tableView = document.getElementById('table-view');
  const analyticsView = document.getElementById('analytics-view');

  // KPI elements
  const kpiTotal = document.getElementById('kpi-total');
  const kpiFollowups = document.getElementById('kpi-followups');
  const kpiNurture = document.getElementById('kpi-nurture');
  const kpiMeetings = document.getElementById('kpi-meetings');

  // Badges
  const badgeAll = document.getElementById('badge-all');
  const badgeFollowups = document.getElementById('badge-followups');
  const badgeNurture = document.getElementById('badge-nurture');
  const badgeMeetings = document.getElementById('badge-meetings');
  const notifCountBadge = document.getElementById('notif-count-badge');
  const currentRegisteredEmail = document.getElementById('current-registered-email');

  // Modals & Drawers
  const leadModal = document.getElementById('lead-modal');
  const importModal = document.getElementById('import-modal');
  const settingsModal = document.getElementById('settings-modal');
  const notifDrawerOverlay = document.getElementById('notif-drawer-overlay');

  // Buttons
  const addLeadBtn = document.getElementById('add-lead-btn');
  const importExcelBtn = document.getElementById('import-excel-btn');
  const checkAlertsBtn = document.getElementById('check-alerts-btn');
  const openSettingsBtn = document.getElementById('open-settings-btn');
  const notifBellBtn = document.getElementById('notif-bell-btn');

  // Close buttons
  document.getElementById('close-lead-modal').onclick = () => leadModal.classList.add('hidden');
  document.getElementById('cancel-lead-modal').onclick = () => leadModal.classList.add('hidden');
  document.getElementById('close-import-modal').onclick = () => importModal.classList.add('hidden');
  document.getElementById('cancel-import-modal').onclick = () => importModal.classList.add('hidden');
  document.getElementById('close-settings-modal').onclick = () => settingsModal.classList.add('hidden');
  document.getElementById('cancel-settings-modal').onclick = () => settingsModal.classList.add('hidden');
  document.getElementById('close-notif-drawer').onclick = () => notifDrawerOverlay.classList.add('hidden');

  // Initialize
  initApp();

  async function initApp() {
    await fetchSettings();
    await fetchLeads();
    await fetchNotifications();
    setupEventListeners();
  }

  // Fetch Settings
  async function fetchSettings() {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success) {
        currentSettings = data.settings || {};
        if (currentRegisteredEmail) {
          currentRegisteredEmail.textContent = currentSettings.registeredEmail || 'admin@example.com';
        }
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  }

  // Fetch Leads
  async function fetchLeads() {
    try {
      const search = globalSearch.value.trim();
      const status = statusFilter.value;
      const url = `/api/leads?tab=${currentTab}&search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        allLeads = data.leads || [];

        // Update KPIs
        if (data.kpis) {
          kpiTotal.textContent = data.kpis.totalLeads;
          kpiFollowups.textContent = data.kpis.followupsCount;
          kpiNurture.textContent = data.kpis.nurtureCount;
          kpiMeetings.textContent = data.kpis.meetingsCount;

          badgeAll.textContent = data.kpis.totalLeads;
          badgeFollowups.textContent = data.kpis.followupsCount;
          badgeNurture.textContent = data.kpis.nurtureCount;
          badgeMeetings.textContent = data.kpis.meetingsCount;
        }

        renderLeads();
      }
    } catch (err) {
      console.error('Error fetching leads:', err);
    }
  }

  // Fetch Notifications
  async function fetchNotifications() {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (data.success) {
        currentNotifications = data.notifications || [];
        notifCountBadge.textContent = currentNotifications.length;
        renderNotifications();
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  }

  // Render Leads Table
  function renderLeads() {
    // Apply sorting
    let displayLeads = [...allLeads];
    const sortVal = scoreSort.value;

    if (sortVal === 'score_desc') {
      displayLeads.sort((a, b) => (b.score_of_client || 0) - (a.score_of_client || 0));
    } else if (sortVal === 'score_asc') {
      displayLeads.sort((a, b) => (a.score_of_client || 0) - (b.score_of_client || 0));
    } else if (sortVal === 'followup') {
      displayLeads.sort((a, b) => new Date(a.follow_up_dates || '9999-12-31') - new Date(b.follow_up_dates || '9999-12-31'));
    }

    if (currentTab === 'analytics') {
      tableView.classList.add('hidden');
      analyticsView.classList.remove('hidden');
      renderAnalytics();
      return;
    } else {
      tableView.classList.remove('hidden');
      analyticsView.classList.add('hidden');
    }

    if (displayLeads.length === 0) {
      leadsTbody.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    leadsTbody.innerHTML = displayLeads.map(lead => createLeadRowHTML(lead)).join('');

    // Attach row action handlers
    document.querySelectorAll('.edit-lead-btn').forEach(btn => {
      btn.onclick = () => openEditModal(btn.dataset.id);
    });

    document.querySelectorAll('.delete-lead-btn').forEach(btn => {
      btn.onclick = () => deleteLead(btn.dataset.id);
    });
  }

  // Single Lead Row HTML Generator
  function createLeadRowHTML(lead) {
    const score = lead.score_of_client || 50;
    let scoreClass = 'score-cold';
    let scoreIcon = '❄️';
    if (score >= 75) { scoreClass = 'score-hot'; scoreIcon = '🔥'; }
    else if (score >= 50) { scoreClass = 'score-warm'; scoreIcon = '⚡'; }

    const statusStr = (lead.status || 'New').toLowerCase();
    let statusPillClass = 'status-new';
    if (statusStr.includes('contacted')) statusPillClass = 'status-contacted';
    else if (statusStr.includes('meeting')) statusPillClass = 'status-meeting';
    else if (statusStr.includes('qualified')) statusPillClass = 'status-qualified';
    else if (statusStr.includes('nurture')) statusPillClass = 'status-nurture';
    else if (statusStr.includes('won')) statusPillClass = 'status-won';
    else if (statusStr.includes('lost')) statusPillClass = 'status-lost';

    const todayStr = new Date().toISOString().split('T')[0];
    const isFollowupDue = (lead.follow_up_dates === todayStr || lead.reachout_date === todayStr);

    return `
      <tr>
        <td>
          <div class="company-cell">
            <span class="company-name">${escapeHTML(lead.company || 'Unnamed')}</span>
            <span class="location-sub"><i class="fa-solid fa-location-dot"></i> ${escapeHTML(lead.city || 'N/A')}${lead.locations ? ' • ' + escapeHTML(lead.locations) : ''}</span>
          </div>
        </td>
        <td>
          <div class="founder-cell">
            <span class="founder-name"><i class="fa-solid fa-user-tie"></i> ${escapeHTML(lead.founder || 'N/A')}</span>
            ${lead.email ? `<a href="mailto:${escapeHTML(lead.email)}" class="contact-link"><i class="fa-solid fa-envelope"></i> ${escapeHTML(lead.email)}</a>` : ''}
            ${lead.contact ? `<span class="contact-link"><i class="fa-solid fa-phone"></i> ${escapeHTML(lead.contact)}</span>` : ''}
            ${lead.linkedin ? `<a href="${escapeHTML(lead.linkedin)}" target="_blank" class="contact-link"><i class="fa-brands fa-linkedin"></i> LinkedIn Profile</a>` : ''}
          </div>
        </td>
        <td>
          <span class="location-sub" title="${escapeHTML(lead.pain_point)}">${escapeHTML(lead.pain_point || 'None specified')}</span>
        </td>
        <td>
          <span class="score-badge ${scoreClass}">
            ${scoreIcon} ${score}/100
          </span>
        </td>
        <td>
          <div style="display:flex; flex-direction:column; gap:4px;">
            <div><span class="status-pill ${statusPillClass}">${escapeHTML(lead.status || 'New')}</span></div>
            ${lead.next_action ? `<span class="date-pill"><i class="fa-solid fa-circle-arrow-right"></i> ${escapeHTML(lead.next_action)}</span>` : ''}
          </div>
        </td>
        <td>
          <div style="display:flex; flex-direction:column; gap:2px;">
            ${lead.follow_up_dates ? `<span class="date-pill ${isFollowupDue ? 'due-alert' : ''}"><i class="fa-solid fa-calendar-day"></i> Followup: ${escapeHTML(lead.follow_up_dates)}</span>` : ''}
            ${lead.reachout_date ? `<span class="date-pill"><i class="fa-solid fa-paper-plane"></i> Reachout: ${escapeHTML(lead.reachout_date)}</span>` : ''}
          </div>
        </td>
        <td>
          <div style="display:flex; flex-direction:column; gap:2px;">
            <span class="location-sub"><strong>Agent:</strong> ${escapeHTML(lead.assigned_to || 'Sales')}</span>
            <span class="location-sub"><strong>Source:</strong> ${escapeHTML(lead.source || 'Direct')}</span>
          </div>
        </td>
        <td>
          <div class="action-btns">
            <button class="icon-btn edit-lead-btn" data-id="${lead.id}" title="Edit Lead"><i class="fa-solid fa-pen-to-square"></i></button>
            ${lead.email ? `<a href="mailto:${escapeHTML(lead.email)}?subject=Follow-up%20regarding%20${encodeURIComponent(lead.company)}" class="icon-btn" title="Send Email"><i class="fa-solid fa-envelope"></i></a>` : ''}
            <button class="icon-btn delete-btn delete-lead-btn" data-id="${lead.id}" title="Delete Lead"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  }

  // Render Analytics View
  function renderAnalytics() {
    let hot = 0, warm = 0, cold = 0;
    const statusCounts = {};

    allLeads.forEach(l => {
      const score = l.score_of_client || 50;
      if (score >= 75) hot++;
      else if (score >= 50) warm++;
      else cold++;

      const st = l.status || 'New';
      statusCounts[st] = (statusCounts[st] || 0) + 1;
    });

    document.getElementById('hot-count').textContent = hot;
    document.getElementById('warm-count').textContent = warm;
    document.getElementById('cold-count').textContent = cold;

    const pipelineContainer = document.getElementById('pipeline-status-list');
    pipelineContainer.innerHTML = Object.keys(statusCounts).map(st => `
      <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border-light);">
        <span>${escapeHTML(st)}</span>
        <strong>${statusCounts[st]} leads</strong>
      </div>
    `).join('');
  }

  // Render Notification Logs
  function renderNotifications() {
    const list = document.getElementById('notif-log-list');
    if (currentNotifications.length === 0) {
      list.innerHTML = `<p style="color:var(--text-dim); text-align:center; padding:20px;">No alerts logged yet.</p>`;
      return;
    }

    list.innerHTML = currentNotifications.map(n => `
      <div class="notif-card">
        <h4>${escapeHTML(n.title)}</h4>
        <p>${escapeHTML(n.message)}</p>
        <span class="notif-time"><i class="fa-solid fa-paper-plane"></i> Sent to ${escapeHTML(n.recipient)} at ${new Date(n.timestamp).toLocaleString()}</span>
      </div>
    `).join('');
  }

  // Event Listeners
  function setupEventListeners() {
    // Navigation Tabs
    navButtons.forEach(btn => {
      btn.onclick = () => {
        navButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.dataset.tab;

        // Update headers
        if (currentTab === 'all') {
          viewTitle.textContent = 'All Registered Leads';
          viewDesc.textContent = 'Browse, search, and manage your complete lead database.';
        } else if (currentTab === 'followups') {
          viewTitle.textContent = 'Follow-up Leads';
          viewDesc.textContent = 'Leads requiring upcoming or overdue touchpoints.';
        } else if (currentTab === 'nurture') {
          viewTitle.textContent = 'Monthly Nurture Pipeline';
          viewDesc.textContent = 'Long-term prospects scheduled for periodic 30-day touchpoints.';
        } else if (currentTab === 'meetings') {
          viewTitle.textContent = 'Meetings Scheduled';
          viewDesc.textContent = 'Prospects with confirmed demo or consultation meetings.';
        } else if (currentTab === 'analytics') {
          viewTitle.textContent = 'Lead Intelligence & Score Analytics';
          viewDesc.textContent = 'Breakdown of client score tiers and sales pipeline status.';
        }

        fetchLeads();
      };
    });

    // Filters & Search
    globalSearch.oninput = debounce(() => fetchLeads(), 300);
    statusFilter.onchange = () => fetchLeads();
    scoreSort.onchange = () => renderLeads();

    // Add Lead Button
    addLeadBtn.onclick = () => {
      document.getElementById('modal-title').textContent = 'Add New Lead';
      document.getElementById('lead-form').reset();
      document.getElementById('lead-id').value = '';
      document.getElementById('field-date_added').value = new Date().toISOString().split('T')[0];
      leadModal.classList.remove('hidden');
    };

    // Save Lead Form Submit
    document.getElementById('lead-form').onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('lead-id').value;

      const payload = {
        company: document.getElementById('field-company').value,
        city: document.getElementById('field-city').value,
        locations: document.getElementById('field-locations').value,
        founder: document.getElementById('field-founder').value,
        contact: document.getElementById('field-contact').value,
        email: document.getElementById('field-email').value,
        linkedin: document.getElementById('field-linkedin').value,
        pain_point: document.getElementById('field-pain_point').value,
        source: document.getElementById('field-source').value,
        date_added: document.getElementById('field-date_added').value,
        assigned_to: document.getElementById('field-assigned_to').value,
        status: document.getElementById('field-status').value,
        score_of_client: document.getElementById('field-score_of_client').value,
        reachout_date: document.getElementById('field-reachout_date').value,
        follow_up_dates: document.getElementById('field-follow_up_dates').value,
        new_status: document.getElementById('field-new_status').value,
        next_action: document.getElementById('field-next_action').value,
        notes: document.getElementById('field-notes').value
      };

      try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/leads/${id}` : '/api/leads';

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.success) {
          leadModal.classList.add('hidden');
          fetchLeads();
          fetchNotifications();
        }
      } catch (err) {
        alert('Failed to save lead: ' + err.message);
      }
    };

    // Excel Import Button & Dropzone
    const fileInput = document.getElementById('excel-file-input');
    const dropzone = document.getElementById('dropzone');
    const startImportBtn = document.getElementById('start-import-btn');
    const selectedFileInfo = document.getElementById('selected-file-info');
    const fileNameDisplay = document.getElementById('file-name');

    importExcelBtn.onclick = () => {
      importModal.classList.remove('hidden');
    };

    dropzone.onclick = () => fileInput.click();

    fileInput.onchange = () => {
      if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        fileNameDisplay.textContent = file.name;
        selectedFileInfo.classList.remove('hidden');
        startImportBtn.disabled = false;
      }
    };

    document.getElementById('import-form').onsubmit = async (e) => {
      e.preventDefault();
      if (!fileInput.files.length) return;

      const formData = new FormData();
      formData.append('file', fileInput.files[0]);

      startImportBtn.textContent = 'Importing...';
      startImportBtn.disabled = true;

      try {
        const res = await fetch('/api/leads/import', {
          method: 'POST',
          body: formData
        });

        const data = await res.json();
        if (data.success) {
          alert(`Successfully imported ${data.importedCount} leads from Excel!`);
          importModal.classList.add('hidden');
          fetchLeads();
        } else {
          alert('Import error: ' + data.error);
        }
      } catch (err) {
        alert('Import failed: ' + err.message);
      } finally {
        startImportBtn.textContent = 'Upload & Process';
        startImportBtn.disabled = false;
      }
    };

    // Check Alerts Button
    checkAlertsBtn.onclick = async () => {
      checkAlertsBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Checking...`;
      try {
        const res = await fetch('/api/notifications/check', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          alert(`Scan complete! ${data.newAlertsCount} new email alerts sent to ${currentSettings.registeredEmail || 'registered email'}.`);
          fetchNotifications();
        }
      } catch (err) {
        alert('Alert scan failed: ' + err.message);
      } finally {
        checkAlertsBtn.innerHTML = `<i class="fa-solid fa-bell-concierge"></i> Scan 1-Day Alerts`;
      }
    };

    // Settings Modal
    openSettingsBtn.onclick = () => {
      settingsModal.classList.remove('hidden');
    };

    // Save Settings
    document.getElementById('settings-form').onsubmit = async (e) => {
      e.preventDefault();
      const payload = {
        registeredEmail: 'admin@yourcompany.com'
      };

      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.success) {
          currentSettings = data.settings;
          currentRegisteredEmail.textContent = currentSettings.registeredEmail;
          settingsModal.classList.add('hidden');
          alert('Settings saved successfully!');
        }
      } catch (err) {
        alert('Failed to save settings: ' + err.message);
      }
    };

    // Test Email Button
    document.getElementById('test-email-btn').onclick = async () => {
      const statusSpan = document.getElementById('test-email-status');
      const email = document.getElementById('setting-registeredEmail').value;
      statusSpan.textContent = 'Sending test email...';
      statusSpan.style.color = '#f59e0b';

      try {
        const res = await fetch('/api/test-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });

        const data = await res.json();
        if (data.success) {
          statusSpan.textContent = `Test notification queued for ${email}`;
          statusSpan.style.color = '#10b981';
        } else {
          statusSpan.textContent = `Error: ${data.result.error || 'Failed'}`;
          statusSpan.style.color = '#ef4444';
        }
      } catch (err) {
        statusSpan.textContent = 'Failed: ' + err.message;
        statusSpan.style.color = '#ef4444';
      }
    };

    // Open Drawer
    notifBellBtn.onclick = () => {
      notifDrawerOverlay.classList.remove('hidden');
    };
  }

  // Open Edit Modal
  function openEditModal(leadId) {
    const lead = allLeads.find(l => l.id === leadId);
    if (!lead) return;

    document.getElementById('modal-title').textContent = 'Edit Lead';
    document.getElementById('lead-id').value = lead.id;

    document.getElementById('field-company').value = lead.company || '';
    document.getElementById('field-city').value = lead.city || '';
    document.getElementById('field-locations').value = lead.locations || '';
    document.getElementById('field-founder').value = lead.founder || '';
    document.getElementById('field-contact').value = lead.contact || '';
    document.getElementById('field-email').value = lead.email || '';
    document.getElementById('field-linkedin').value = lead.linkedin || '';
    document.getElementById('field-pain_point').value = lead.pain_point || '';
    document.getElementById('field-source').value = lead.source || '';
    document.getElementById('field-date_added').value = lead.date_added || '';
    document.getElementById('field-assigned_to').value = lead.assigned_to || '';
    document.getElementById('field-status').value = lead.status || 'New';
    document.getElementById('field-score_of_client').value = lead.score_of_client || '';
    document.getElementById('field-reachout_date').value = lead.reachout_date || '';
    document.getElementById('field-follow_up_dates').value = lead.follow_up_dates || '';
    document.getElementById('field-new_status').value = lead.new_status || '';
    document.getElementById('field-next_action').value = lead.next_action || '';
    document.getElementById('field-notes').value = lead.notes || '';

    leadModal.classList.remove('hidden');
  }

  // Delete Lead
  async function deleteLead(leadId) {
    if (!confirm('Are you sure you want to delete this lead?')) return;

    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchLeads();
      }
    } catch (err) {
      alert('Failed to delete lead: ' + err.message);
    }
  }

  // Helper Utilities
  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
});
