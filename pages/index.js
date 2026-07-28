import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Home() {
  // Authentication & Current User State
  const [authenticated, setAuthenticated] = useState(false);
  const [loggedInUserEmail, setLoggedInUserEmail] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Application State
  const [currentTab, setCurrentTab] = useState('all');
  const [leads, setLeads] = useState([]);
  const [kpis, setKpis] = useState({ totalLeads: 0, followupsCount: 0, nurtureCount: 0, meetingsCount: 0 });
  const [loading, setLoading] = useState(true);
  const [isCached, setIsCached] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [scoreSort, setScoreSort] = useState('default');

  const [settings, setSettings] = useState({ registeredEmails: [], enableEmailNotifications: true });
  const [notifications, setNotifications] = useState([]);

  // Registered Email State
  const [registeredEmailInput, setRegisteredEmailInput] = useState('');
  const [emailSavedStatus, setEmailSavedStatus] = useState('');
  const [scanning, setScanning] = useState(false);

  // Modals & Drawers
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);

  // Form State (All 18 Fields)
  const [formData, setFormData] = useState({
    company: '', city: '', locations: '', founder: '', linkedin: '',
    contact: '', email: '', pain_point: '', source: 'Direct',
    date_added: new Date().toISOString().split('T')[0], assigned_to: 'Sales Team',
    status: 'New', notes: '', score_of_client: '', reachout_date: '',
    new_status: '', next_action: '', follow_up_dates: ''
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    // Auth Check
    const token = localStorage.getItem('crm_token');
    const userEmail = localStorage.getItem('crm_user_email');
    if (!token) {
      window.location.href = '/login';
    } else {
      setAuthenticated(true);
      setLoggedInUserEmail(userEmail || 'user@company.com');
      fetchSettings();
      fetchNotifications();
    }
  }, []);

  useEffect(() => {
    if (authenticated) {
      fetchLeads();
    }
  }, [authenticated, currentTab, search, statusFilter]);

  // Auth Header Helper
  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('crm_token') || ''}`
  });

  // Handle Token Expiry Auto-Redirect
  const handleAuthError = (data) => {
    if (data && (data.error === 'Invalid or expired token' || data.error === 'No authorization token provided')) {
      alert('Your login session expired. Redirecting to login page...');
      localStorage.removeItem('crm_token');
      localStorage.removeItem('crm_user_email');
      window.location.href = '/login';
      return true;
    }
    return false;
  };

  // Logout Handler
  const handleLogout = () => {
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user_email');
    window.location.href = '/login';
  };

  // Fetch Settings
  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings', { headers: getAuthHeaders() });
      const data = await res.json();
      if (handleAuthError(data)) return;
      if (data.success && data.settings) {
        setSettings(data.settings);
        const emailsStr = (data.settings.registeredEmails || []).join(', ');
        setRegisteredEmailInput(emailsStr || loggedInUserEmail);
      }
    } catch (err) {
      console.error('Fetch settings error:', err);
    }
  };

  // Save Registered Email directly to MongoDB
  const handleSaveRegisteredEmail = async (emailsInput) => {
    setEmailSavedStatus('Saving to MongoDB...');
    try {
      const emailList = emailsInput.split(',').map(e => e.trim()).filter(Boolean);
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...settings,
          registeredEmails: emailList
        })
      });
      const data = await res.json();
      if (handleAuthError(data)) return;
      if (data.success) {
        setSettings(data.settings);
        setEmailSavedStatus('Saved to MongoDB!');
        setTimeout(() => setEmailSavedStatus(''), 3000);
      }
    } catch (err) {
      setEmailSavedStatus('Failed to save');
    }
  };

  // Fetch Notifications Log
  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications', { headers: getAuthHeaders() });
      const data = await res.json();
      if (handleAuthError(data)) return;
      if (data.success) setNotifications(data.notifications || []);
    } catch (err) {
      console.error('Fetch notifications error:', err);
    }
  };

  // Fetch Leads
  const fetchLeads = async () => {
    setLoading(true);
    try {
      const url = `/api/leads?tab=${currentTab}&search=${encodeURIComponent(search)}&status=${encodeURIComponent(statusFilter)}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      const data = await res.json();
      if (handleAuthError(data)) return;

      if (data.success) {
        setLeads(data.leads || []);
        setIsCached(!!data.cached);
        if (data.kpis) setKpis(data.kpis);
      }
    } catch (err) {
      console.error('Fetch leads error:', err);
    } finally {
      setTimeout(() => setLoading(false), 200);
    }
  };

  // Sorted Leads Calculation
  const getSortedLeads = () => {
    let list = [...leads];
    if (scoreSort === 'score_desc') list.sort((a, b) => (b.score_of_client || 0) - (a.score_of_client || 0));
    else if (scoreSort === 'score_asc') list.sort((a, b) => (a.score_of_client || 0) - (b.score_of_client || 0));
    else if (scoreSort === 'followup') list.sort((a, b) => new Date(a.follow_up_dates || '9999-12-31') - new Date(b.follow_up_dates || '9999-12-31'));
    return list;
  };

  // Manual Scan Trigger Handler (Sends to BOTH Admin and Intern)
  const handleManualScan = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/notifications/check', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (handleAuthError(data)) return;

      if (data.success) {
        alert(`⚡ Manual Scan Complete!\nScanned 2-day and 1-day reminders.\nEmails sent to BOTH Admin & Intern registered accounts.`);
        fetchNotifications();
      } else {
        alert('Scan error: ' + (data.error || 'Failed'));
      }
    } catch (err) {
      alert('Scan failed: ' + err.message);
    } finally {
      setScanning(false);
    }
  };

  // Universal Delete All Leads Handler (with Confirmation)
  const handleDeleteAllLeads = async () => {
    if (!confirm('⚠️ CONFIRMATION REQUIRED:\nAre you sure you want to permanently delete ALL leads in your database?\nThis action cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch('/api/leads/deleteAll', {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (handleAuthError(data)) return;

      if (data.success) {
        alert(`Successfully deleted all ${data.deletedCount || 0} leads from database!`);
        fetchLeads();
      } else {
        alert('Failed to delete all leads: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Delete error: ' + err.message);
    }
  };

  // Save Lead Handler
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      const method = editingLead ? 'PUT' : 'POST';
      const url = editingLead ? `/api/leads/${editingLead._id || editingLead.id}` : '/api/leads';

      let scoreVal = parseInt(formData.score_of_client, 10);
      if (isNaN(scoreVal)) scoreVal = undefined;
      else if (scoreVal > 10) scoreVal = Math.min(Math.max(Math.round(scoreVal / 10), 1), 10);

      let newStatusVal = formData.new_status;
      if ((formData.status || '').toLowerCase().includes('not interested')) {
        newStatusVal = 'Nurture (Not Interested)';
      }

      const payload = {
        ...formData,
        new_status: newStatusVal,
        score_of_client: scoreVal
      };

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (handleAuthError(data)) return;

      if (data.success) {
        setLeadModalOpen(false);
        fetchLeads();
        fetchNotifications();
      } else {
        alert('Error saving lead: ' + (data.error || 'Failed'));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Open Edit Modal
  const openEdit = (lead) => {
    setEditingLead(lead);
    setFormData({
      company: lead.company || '', city: lead.city || '', locations: lead.locations || '',
      founder: lead.founder || '', linkedin: lead.linkedin || '', contact: lead.contact || '',
      email: lead.email || '', pain_point: lead.pain_point || '', source: lead.source || 'Direct',
      date_added: lead.date_added || new Date().toISOString().split('T')[0],
      assigned_to: lead.assigned_to || 'Sales Team', status: lead.status || 'New',
      notes: lead.notes || '', score_of_client: lead.score_of_client || '',
      reachout_date: lead.reachout_date || '', new_status: lead.new_status || '',
      next_action: lead.next_action || '', follow_up_dates: lead.follow_up_dates || ''
    });
    setLeadModalOpen(true);
  };

  // Delete Single Lead
  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    try {
      const res = await fetch(`/api/leads/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      const data = await res.json();
      if (handleAuthError(data)) return;
      if (data.success) fetchLeads();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  // Import Excel Handler
  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    const dataForm = new FormData();
    dataForm.append('file', selectedFile);
    setImporting(true);

    try {
      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('crm_token') || ''}` },
        body: dataForm
      });
      const data = await res.json();
      if (handleAuthError(data)) return;

      if (data.success) {
        alert(`Successfully imported ${data.importedCount} leads into your database!`);
        setImportModalOpen(false);
        fetchLeads();
      } else {
        alert('Import error: ' + data.error);
      }
    } catch (err) {
      alert('Import failed: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  if (!authenticated) return null;

  const sortedLeads = getSortedLeads();

  return (
    <div>
      <Head>
        <title>LeadPulse CRM - iPhone, iPad, PC Responsive</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </Head>

      {/* Mobile Top Header Toggle */}
      <div className="mobile-header-toggle">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="logo-icon" style={{ width: '32px', height: '32px', fontSize: '14px' }}>
            <i className="fa-solid fa-chart-line"></i>
          </div>
          <strong style={{ fontSize: '16px', color: '#0f172a' }}>LeadPulse CRM</strong>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{ background: 'transparent', border: 'none', fontSize: '20px', color: '#0f172a', cursor: 'pointer' }}
        >
          <i className={mobileMenuOpen ? "fa-solid fa-xmark" : "fa-solid fa-bars"}></i>
        </button>
      </div>

      {mobileMenuOpen && <div className="mobile-overlay-backdrop" onClick={() => setMobileMenuOpen(false)}></div>}

      <div className="app-container">
        {/* Sidebar Navigation */}
        <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <div>
            <div className="brand">
              <div className="logo-icon">
                <i className="fa-solid fa-chart-line"></i>
              </div>
              <div className="brand-text">
                <h2>LeadPulse CRM</h2>
                <span>Logged in: {loggedInUserEmail}</span>
              </div>
            </div>

            <nav className="nav-menu">
              <button className={`nav-item ${currentTab === 'all' ? 'active' : ''}`} onClick={() => { setCurrentTab('all'); setMobileMenuOpen(false); }}>
                <i className="fa-solid fa-list-check"></i>
                <span>All Leads</span>
                <span className="badge">{kpis.totalLeads}</span>
              </button>

              <button className={`nav-item ${currentTab === 'followups' ? 'active' : ''}`} onClick={() => { setCurrentTab('followups'); setMobileMenuOpen(false); }}>
                <i className="fa-solid fa-clock-rotate-left"></i>
                <span>Follow-up Leads</span>
                <span className="badge" style={{ background: '#fef3c7', color: '#b45309' }}>{kpis.followupsCount}</span>
              </button>

              <button className={`nav-item ${currentTab === 'nurture' ? 'active' : ''}`} onClick={() => { setCurrentTab('nurture'); setMobileMenuOpen(false); }}>
                <i className="fa-solid fa-seedling"></i>
                <span>Nurture List</span>
                <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>{kpis.nurtureCount}</span>
              </button>

              <button className={`nav-item ${currentTab === 'meetings' ? 'active' : ''}`} onClick={() => { setCurrentTab('meetings'); setMobileMenuOpen(false); }}>
                <i className="fa-solid fa-calendar-check"></i>
                <span>Meetings Scheduled</span>
                <span className="badge" style={{ background: '#d1fae5', color: '#047857' }}>{kpis.meetingsCount}</span>
              </button>

              <button className={`nav-item ${currentTab === 'analytics' ? 'active' : ''}`} onClick={() => { setCurrentTab('analytics'); setMobileMenuOpen(false); }}>
                <i className="fa-solid fa-chart-pie"></i>
                <span>Analytics & Scores</span>
              </button>
            </nav>
          </div>

          <div className="sidebar-footer">
            <div className="registered-email-card">
              <i className="fa-solid fa-user-circle"></i>
              <div className="email-info">
                <span className="label">Active User</span>
                <span className="value" title={loggedInUserEmail}>{loggedInUserEmail}</span>
              </div>
            </div>

            <button className="btn btn-secondary w-100" onClick={() => setSettingsModalOpen(true)}>
              <i className="fa-solid fa-sliders"></i>
              <span>Notification Emails</span>
            </button>

            <button className="btn btn-outline w-100" onClick={handleLogout} style={{ color: '#ef4444', borderColor: '#fca5a5' }}>
              <i className="fa-solid fa-right-from-bracket"></i>
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="main-content">
          {/* Topbar */}
          <header className="topbar">
            <div className="topbar-search">
              <i className="fa-solid fa-magnifying-glass search-icon"></i>
              <input
                type="text"
                placeholder="Search Company, Founder, Email, City..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="topbar-actions">
              <button className="btn btn-outline" onClick={handleManualScan} disabled={scanning} title="Run instant manual scan for 2-day & 1-day alerts">
                <i className={scanning ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-bell-concierge"}></i>
                <span>{scanning ? 'Scanning...' : 'Scan Alerts Now'}</span>
              </button>

              <button className="btn btn-outline" onClick={() => setImportModalOpen(true)}>
                <i className="fa-solid fa-file-excel"></i>
                <span>Import Excel</span>
              </button>

              <button
                className="btn btn-outline"
                style={{ color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2' }}
                onClick={handleDeleteAllLeads}
                title="Delete all leads in database"
              >
                <i className="fa-solid fa-trash-can"></i>
                <span>Delete All Leads</span>
              </button>

              <button className="btn btn-primary" onClick={() => {
                setEditingLead(null);
                setFormData({
                  company: '', city: '', locations: '', founder: '', linkedin: '',
                  contact: '', email: '', pain_point: '', source: 'Direct',
                  date_added: new Date().toISOString().split('T')[0], assigned_to: 'Sales Team',
                  status: 'New', notes: '', score_of_client: '', reachout_date: '',
                  new_status: '', next_action: '', follow_up_dates: ''
                });
                setLeadModalOpen(true);
              }}>
                <i className="fa-solid fa-plus"></i>
                <span>Add New Lead</span>
              </button>

              <div className="notification-bell-wrapper" onClick={() => setDrawerOpen(true)} title="View Sent Email Notification Logs">
                <i className="fa-solid fa-bell"></i>
                {notifications.length > 0 && <span className="notif-count">{notifications.length}</span>}
              </div>
            </div>
          </header>

          {/* Registered Email Alert Banner */}
          <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', padding: '14px 20px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <i className="fa-solid fa-bell-concierge" style={{ color: '#4f46e5', fontSize: '22px' }}></i>
              <div>
                <strong style={{ color: '#1e1b4b', fontSize: '14px' }}>Dual Alert Engine Active (iPhone, iPad, PC Responsive)</strong>
                <p style={{ color: '#4338ca', fontSize: '12px', margin: 0 }}>Emails delivered to BOTH Admin & Intern accounts without inbox spam.</p>
              </div>
            </div>
            <button className="btn btn-outline" style={{ background: '#fff', fontSize: '12px' }} onClick={() => setSettingsModalOpen(true)}>
              Manage Emails
            </button>
          </div>

          {/* KPI Metrics Cards */}
          <section className="kpi-grid">
            <div className="kpi-card glass">
              <div className="kpi-icon blue"><i className="fa-solid fa-building"></i></div>
              <div className="kpi-data">
                <span className="kpi-title">Total Active Leads</span>
                <h3>{kpis.totalLeads}</h3>
                <span className="kpi-sub">Stored in MongoDB</span>
              </div>
            </div>

            <div className="kpi-card glass">
              <div className="kpi-icon amber"><i className="fa-solid fa-bell"></i></div>
              <div className="kpi-data">
                <span className="kpi-title">Follow-ups Due</span>
                <h3>{kpis.followupsCount}</h3>
                <span className="kpi-sub">2-Day & 1-Day Alerts</span>
              </div>
            </div>

            <div className="kpi-card glass">
              <div className="kpi-icon purple"><i className="fa-solid fa-seedling"></i></div>
              <div className="kpi-data">
                <span className="kpi-title">Monthly Nurture List</span>
                <h3>{kpis.nurtureCount}</h3>
                <span className="kpi-sub">Includes Not Interested</span>
              </div>
            </div>

            <div className="kpi-card glass">
              <div className="kpi-icon green"><i className="fa-solid fa-handshake"></i></div>
              <div className="kpi-data">
                <span className="kpi-title">Meetings Scheduled</span>
                <h3>{kpis.meetingsCount}</h3>
                <span className="kpi-sub">High Intent Prospects</span>
              </div>
            </div>
          </section>

          {/* Main View & Table / Cards */}
          <section className="view-container">
            <div className="view-header">
              <div>
                <h2>
                  {currentTab === 'all' && 'All Registered Leads'}
                  {currentTab === 'followups' && 'Follow-up Leads'}
                  {currentTab === 'nurture' && 'Monthly Nurture Pipeline'}
                  {currentTab === 'meetings' && 'Meetings Scheduled'}
                  {currentTab === 'analytics' && 'Lead Intelligence & Score Analytics'}
                  {isCached && <span className="cache-badge"><i className="fa-solid fa-bolt"></i> Cached</span>}
                </h2>
                <p>Responsive Layout • iPhone SE, iPhone 12, iPads, and PCs Optimized.</p>
              </div>

              {currentTab !== 'analytics' && (
                <div className="view-filters">
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="form-select">
                    <option value="">All Statuses</option>
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Meeting Scheduled">Meeting Scheduled</option>
                    <option value="Qualified">Qualified</option>
                    <option value="Nurture">Nurture</option>
                    <option value="Not Interested">Not Interested (Auto-Nurture)</option>
                    <option value="Won">Won</option>
                    <option value="Lost">Lost</option>
                  </select>

                  <select value={scoreSort} onChange={(e) => setScoreSort(e.target.value)} className="form-select">
                    <option value="default">Sort by Date Added</option>
                    <option value="score_desc">Score: High to Low</option>
                    <option value="score_asc">Score: Low to High</option>
                    <option value="followup">Follow-up Date</option>
                  </select>
                </div>
              )}
            </div>

            {/* Skeleton Loader vs Table vs Mobile Cards */}
            {loading ? (
              <SkeletonTableRows />
            ) : currentTab === 'analytics' ? (
              <div className="glass" style={{ padding: '24px', background: '#fff' }}>
                <h3>Pipeline & Client Score Metrics (Scale 1 - 10)</h3>
                <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
                  🔥 Hot Leads (Score 8 - 10 / 10): <strong>{leads.filter(l => (l.score_of_client || 5) >= 8).length}</strong>
                  <br />
                  ⚡ Warm Leads (Score 5 - 7 / 10): <strong>{leads.filter(l => (l.score_of_client || 5) >= 5 && (l.score_of_client || 5) < 8).length}</strong>
                  <br />
                  ❄️ Cold Leads (Score 1 - 4 / 10): <strong>{leads.filter(l => (l.score_of_client || 5) < 5).length}</strong>
                </p>
              </div>
            ) : (
              <div className="table-card glass">
                {/* Desktop & PC Table View */}
                <div className="table-responsive">
                  <table className="leads-table">
                    <thead>
                      <tr>
                        <th style={{ width: '35px' }}>#</th>
                        <th>Company & Location</th>
                        <th>Founder & Contact</th>
                        <th>Pain Point</th>
                        <th>Score</th>
                        <th>Status & Next Action</th>
                        <th>Outreach Date</th>
                        <th>Follow-up Date</th>
                        <th>Date Added</th>
                        <th>Assigned & Source</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedLeads.length === 0 ? (
                        <tr>
                          <td colSpan="11" style={{ textAlign: 'center', padding: '40px' }}>
                            <i className="fa-solid fa-folder-open" style={{ fontSize: '32px', color: 'var(--text-dim)' }}></i>
                            <p style={{ marginTop: '10px' }}>No leads found in database.</p>
                          </td>
                        </tr>
                      ) : (
                        sortedLeads.map((lead, index) => {
                          let score = lead.score_of_client || 5;
                          if (score > 10) score = Math.min(Math.max(Math.round(score / 10), 1), 10);

                          const scoreClass = score >= 8 ? 'score-hot' : score >= 5 ? 'score-warm' : 'score-cold';
                          const scoreIcon = score >= 8 ? '🔥' : score >= 5 ? '⚡' : '❄️';

                          return (
                            <tr key={lead._id || lead.id}>
                              <td style={{ fontWeight: 700, color: 'var(--text-dim)' }}>{index + 1}</td>
                              <td>
                                <div className="company-cell">
                                  <span className="company-name">{lead.company}</span>
                                  <span className="location-sub"><i className="fa-solid fa-location-dot"></i> {lead.city || 'N/A'} {lead.locations ? '• ' + lead.locations : ''}</span>
                                </div>
                              </td>
                              <td>
                                <div className="founder-cell">
                                  <span className="founder-name"><i className="fa-solid fa-user-tie"></i> {lead.founder || 'N/A'}</span>
                                  {lead.email && <a href={`mailto:${lead.email}`} className="contact-link"><i className="fa-solid fa-envelope"></i> {lead.email}</a>}
                                  {lead.contact && <span className="contact-link"><i className="fa-solid fa-phone"></i> {lead.contact}</span>}
                                </div>
                              </td>
                              <td><span className="location-sub">{lead.pain_point || 'None specified'}</span></td>
                              <td><span className={`score-badge ${scoreClass}`}>{scoreIcon} {score}/10</span></td>
                              <td>
                                <span className="status-pill status-new">{lead.status || 'New'}</span>
                                {lead.new_status && <div className="date-pill" style={{ color: '#0369a1', fontWeight: 600, marginTop: '2px' }}>{lead.new_status}</div>}
                                {lead.next_action && <div className="date-pill" style={{ marginTop: '4px' }}><i className="fa-solid fa-arrow-right"></i> {lead.next_action}</div>}
                              </td>
                              <td>
                                {lead.reachout_date ? (
                                  <span className="date-pill" style={{ color: '#0284c7', fontWeight: 600 }}>
                                    <i className="fa-solid fa-paper-plane"></i> {lead.reachout_date}
                                  </span>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                                )}
                              </td>
                              <td>
                                {lead.follow_up_dates ? (
                                  <span className="date-pill due-alert" style={{ color: '#d97706', fontWeight: 700 }}>
                                    <i className="fa-solid fa-calendar-day"></i> {lead.follow_up_dates}
                                  </span>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                                )}
                              </td>
                              <td>
                                {lead.date_added ? (
                                  <span style={{ fontSize: '12px', color: '#475569' }}>
                                    <i className="fa-solid fa-clock"></i> {lead.date_added}
                                  </span>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                                )}
                              </td>
                              <td>
                                <div className="location-sub"><strong>Agent:</strong> {lead.assigned_to || 'Sales'}</div>
                                <div className="location-sub"><strong>Source:</strong> {lead.source || 'Direct'}</div>
                              </td>
                              <td>
                                <div className="action-btns">
                                  <button className="icon-btn" onClick={() => openEdit(lead)} title="Edit Lead"><i className="fa-solid fa-pen-to-square"></i></button>
                                  {lead.email && <a href={`mailto:${lead.email}`} className="icon-btn" title="Send Email"><i className="fa-solid fa-envelope"></i></a>}
                                  <button className="icon-btn delete-btn" onClick={() => handleDelete(lead._id || lead.id)} title="Delete Lead"><i className="fa-solid fa-trash"></i></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Touch Cards View (iPhone SE, iPhone 12, Small Touch Devices) */}
                <div className="mobile-lead-cards">
                  {sortedLeads.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                      No leads found.
                    </div>
                  ) : (
                    sortedLeads.map((lead, index) => {
                      let score = lead.score_of_client || 5;
                      if (score > 10) score = Math.min(Math.max(Math.round(score / 10), 1), 10);
                      const scoreClass = score >= 8 ? 'score-hot' : score >= 5 ? 'score-warm' : 'score-cold';
                      const scoreIcon = score >= 8 ? '🔥' : score >= 5 ? '⚡' : '❄️';

                      return (
                        <div key={lead._id || lead.id} className="mobile-lead-card">
                          <div className="mobile-lead-card-header">
                            <div>
                              <strong style={{ fontSize: '15px', color: '#0f172a' }}>#{index + 1} {lead.company}</strong>
                              <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>{lead.city || 'N/A'}</span>
                            </div>
                            <span className={`score-badge ${scoreClass}`}>{scoreIcon} {score}/10</span>
                          </div>

                          <div className="mobile-lead-card-body">
                            <div className="mobile-lead-card-row">
                              <span className="label">Founder / Contact:</span>
                              <strong>{lead.founder || 'N/A'} ({lead.contact || 'N/A'})</strong>
                            </div>
                            <div className="mobile-lead-card-row">
                              <span className="label">Status:</span>
                              <span className="status-pill">{lead.status || 'New'}</span>
                            </div>
                            {lead.follow_up_dates && (
                              <div className="mobile-lead-card-row">
                                <span className="label">Follow-up Date:</span>
                                <span style={{ color: '#d97706', fontWeight: 700 }}>{lead.follow_up_dates}</span>
                              </div>
                            )}
                            {lead.reachout_date && (
                              <div className="mobile-lead-card-row">
                                <span className="label">Outreach Date:</span>
                                <span style={{ color: '#0284c7', fontWeight: 600 }}>{lead.reachout_date}</span>
                              </div>
                            )}
                            {lead.pain_point && (
                              <div style={{ fontSize: '12px', color: '#b91c1c', marginTop: '4px' }}>
                                <strong>Pain Point:</strong> {lead.pain_point}
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                            <button className="btn btn-outline" style={{ flex: 1, padding: '8px', fontSize: '12px', justifyContent: 'center' }} onClick={() => openEdit(lead)}>
                              <i className="fa-solid fa-pen-to-square"></i> Edit
                            </button>
                            {lead.email && (
                              <a href={`mailto:${lead.email}`} className="btn btn-outline" style={{ flex: 1, padding: '8px', fontSize: '12px', justifyContent: 'center', textDecoration: 'none' }}>
                                <i className="fa-solid fa-envelope"></i> Email
                              </a>
                            )}
                            <button className="btn btn-outline" style={{ padding: '8px 12px', fontSize: '12px', color: '#ef4444', borderColor: '#fca5a5' }} onClick={() => handleDelete(lead._id || lead.id)}>
                              <i className="fa-solid fa-trash"></i>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </section>
        </main>

        {/* Slide-out Drawer: Notification History */}
        {drawerOpen && (
          <div className="modal-overlay" style={{ justifyContent: 'flex-end', padding: 0 }}>
            <div style={{
              background: '#ffffff',
              width: '100%',
              maxWidth: '460px',
              height: '100vh',
              boxShadow: '-10px 0 30px rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideInRight 0.25s ease'
            }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <i className="fa-solid fa-bell" style={{ color: '#4f46e5', fontSize: '20px' }}></i>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a', fontWeight: 800 }}>Sent Email Alert History</h3>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Dispatched to Admin & Intern accounts</span>
                  </div>
                </div>
                <button onClick={() => setDrawerOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>&times;</button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                {notifications.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                    <i className="fa-solid fa-envelope-open" style={{ fontSize: '40px', marginBottom: '12px' }}></i>
                    <p style={{ fontSize: '14px' }}>No email alert logs found yet.</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div key={notif._id || notif.key} style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '16px',
                      marginBottom: '14px',
                      position: 'relative'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{
                          background: notif.timing?.includes('2 DAYS') ? '#e0f2fe' : '#e0e7ff',
                          color: notif.timing?.includes('2 DAYS') ? '#0369a1' : '#3730a3',
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '12px'
                        }}>
                          {notif.timing || 'ALERT'}
                        </span>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          <i className="fa-solid fa-paper-plane"></i> {notif.recipient}
                        </span>
                      </div>

                      <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#0f172a' }}>{notif.title || notif.company}</h4>
                      <p style={{ margin: 0, fontSize: '12px', color: '#475569', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                        {notif.message}
                      </p>
                      <div style={{ marginTop: '8px', fontSize: '10px', color: '#94a3b8', textAlign: 'right' }}>
                        Event Date: {notif.eventDate}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', textAlign: 'center' }}>
                <button className="btn btn-outline w-100" onClick={() => setDrawerOpen(false)}>Close Panel</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Registered Email & Settings */}
        {settingsModalOpen && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header">
                <h3><i className="fa-solid fa-envelope"></i> Registered Email & Notification Settings</h3>
                <button className="close-modal-btn" onClick={() => setSettingsModalOpen(false)}>&times;</button>
              </div>
              
              <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <h4 style={{ color: '#0f172a', fontSize: '15px', marginBottom: '6px' }}>Notification Recipient Email Addresses</h4>
                <p style={{ color: '#475569', fontSize: '13px', marginBottom: '12px' }}>
                  Separate emails with commas (e.g. <code>admin@yourcompany.com, intern@yourcompany.com</code>). Both accounts will receive 2-day and 1-day reminders.
                </p>
                
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={registeredEmailInput}
                    onChange={(e) => setRegisteredEmailInput(e.target.value)}
                    placeholder="admin@company.com, intern@company.com"
                    style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleSaveRegisteredEmail(registeredEmailInput)}
                  >
                    Save Emails
                  </button>
                </div>
                {emailSavedStatus && <span style={{ color: '#10b981', fontSize: '12px', marginTop: '6px', display: 'block', fontWeight: 600 }}>{emailSavedStatus}</span>}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setSettingsModalOpen(false)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Add / Edit Lead */}
        {leadModalOpen && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header">
                <h3>{editingLead ? 'Edit Lead' : 'Add New Lead'}</h3>
                <button className="close-modal-btn" onClick={() => setLeadModalOpen(false)}>&times;</button>
              </div>
              <form onSubmit={handleFormSubmit}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Company Name *</label>
                    <input type="text" required value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>City</label>
                    <input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
                  </div>
                  <div className="form-group full-width">
                    <label>Locations / Address</label>
                    <input type="text" value={formData.locations} onChange={(e) => setFormData({ ...formData, locations: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Founder Name</label>
                    <input type="text" value={formData.founder} onChange={(e) => setFormData({ ...formData, founder: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Contact Phone</label>
                    <input type="text" value={formData.contact} onChange={(e) => setFormData({ ...formData, contact: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Email Address</label>
                    <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>LinkedIn Profile URL</label>
                    <input type="text" value={formData.linkedin} onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Client Score (Scale 1 to 10)</label>
                    <input type="number" min="1" max="10" placeholder="1 - 10" value={formData.score_of_client} onChange={(e) => setFormData({ ...formData, score_of_client: e.target.value })} />
                  </div>
                  <div className="form-group full-width">
                    <label>Pain Point</label>
                    <textarea rows="2" value={formData.pain_point} onChange={(e) => setFormData({ ...formData, pain_point: e.target.value })}></textarea>
                  </div>
                  <div className="form-group">
                    <label>Source</label>
                    <input type="text" value={formData.source} onChange={(e) => setFormData({ ...formData, source: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Date Added</label>
                    <input type="date" value={formData.date_added} onChange={(e) => setFormData({ ...formData, date_added: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Assigned To</label>
                    <input type="text" value={formData.assigned_to} onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="form-select">
                      <option value="New">New</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Meeting Scheduled">Meeting Scheduled</option>
                      <option value="Qualified">Qualified</option>
                      <option value="Nurture">Nurture</option>
                      <option value="Not Interested">Not Interested (Auto-Nurture)</option>
                      <option value="Won">Won</option>
                      <option value="Lost">Lost</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>New Status</label>
                    <input type="text" value={formData.new_status} onChange={(e) => setFormData({ ...formData, new_status: e.target.value })} placeholder="Priority or custom status" />
                  </div>
                  <div className="form-group">
                    <label>Outreach / Reachout Date</label>
                    <input type="date" value={formData.reachout_date} onChange={(e) => setFormData({ ...formData, reachout_date: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Follow up Date</label>
                    <input type="date" value={formData.follow_up_dates} onChange={(e) => setFormData({ ...formData, follow_up_dates: e.target.value })} />
                  </div>
                  <div className="form-group full-width">
                    <label>Next Action</label>
                    <input type="text" value={formData.next_action} onChange={(e) => setFormData({ ...formData, next_action: e.target.value })} />
                  </div>
                  <div className="form-group full-width">
                    <label>Notes</label>
                    <textarea rows="3" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}></textarea>
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={() => setLeadModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Save Lead</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Import Excel */}
        {importModalOpen && (
          <div className="modal-overlay">
            <div className="modal-card" style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <h3>Import Leads into MongoDB</h3>
                <button className="close-modal-btn" onClick={() => setImportModalOpen(false)}>&times;</button>
              </div>
              <form onSubmit={handleImportSubmit}>
                <div style={{ border: '2px dashed var(--border-color)', padding: '30px', textAlign: 'center', borderRadius: '10px' }}>
                  <i className="fa-solid fa-file-excel" style={{ fontSize: '36px', color: 'var(--accent-primary)' }}></i>
                  <p style={{ marginTop: '10px' }}>Select `.xlsx` or `.csv` file</p>
                  <input type="file" accept=".xlsx, .xls, .csv" onChange={(e) => setSelectedFile(e.target.files[0])} style={{ marginTop: '15px' }} />
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={() => setImportModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={!selectedFile || importing}>
                    {importing ? 'Importing...' : 'Upload to Database'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// React Skeleton Loading Rows Component
function SkeletonTableRows() {
  return (
    <div className="table-card glass">
      <div style={{ padding: '20px' }}>
        {[1, 2, 3, 4, 5].map((idx) => (
          <div key={idx} style={{ display: 'flex', gap: '20px', padding: '16px 0', borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ flex: 2 }}><div className="skeleton skeleton-title"></div><div className="skeleton skeleton-text"></div></div>
            <div style={{ flex: 2 }}><div className="skeleton skeleton-text"></div><div className="skeleton skeleton-text"></div></div>
            <div style={{ flex: 1 }}><div className="skeleton skeleton-badge"></div></div>
            <div style={{ flex: 1 }}><div className="skeleton skeleton-text"></div></div>
          </div>
        ))}
      </div>
    </div>
  );
}
