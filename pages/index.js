import { useState, useEffect } from 'react';
import Head from 'next/head';

// Helper: Normalize ANY date to Indian DD/MM/YYYY format
function normalizeToIndianDate(val) {
  if (!val) return '';
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      const d = String(date.getDate()).padStart(2, '0');
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const y = date.getFullYear();
      return `${d}/${m}/${y}`;
    }
  }
  let str = String(val).trim();
  if (!str) return '';

  // 1. Match YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const ymdMatch = str.match(/^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${d}/${m}/${y}`;
  }

  // 2. Indian DD/MM/YYYY mode
  const dmyMatch = str.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})/);
  if (dmyMatch) {
    let p1 = parseInt(dmyMatch[1], 10);
    let p2 = parseInt(dmyMatch[2], 10);
    let year = dmyMatch[3];
    let day = p1;
    let month = p2;

    if (p1 <= 12 && p2 > 12) {
      day = p2;
      month = p1;
    }

    const dStr = String(day).padStart(2, '0');
    const mStr = String(month).padStart(2, '0');
    return `${dStr}/${mStr}/${year}`;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const d = String(parsed.getDate()).padStart(2, '0');
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const y = parsed.getFullYear();
    return `${d}/${m}/${y}`;
  }
  return str;
}

// Helper: Convert DD/MM/YYYY or YYYY-MM-DD to ISO YYYY-MM-DD for accurate comparison logic
function normalizeToISO(str) {
  if (!str) return null;
  const val = String(str).trim();
  const dmyMatch = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }
  const ymdMatch = val.match(/^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
  }
  const parsed = new Date(val);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return null;
}

// Conditional Formatting Helper
function getFollowUpStatus(dateStr) {
  if (!dateStr) return null;
  const iso = normalizeToISO(dateStr);
  if (!iso) return null;

  const todayStr = new Date().toISOString().split('T')[0];

  if (iso === todayStr) {
    return { type: 'today', label: 'DUE TODAY', icon: 'fa-solid fa-clock-rotate-left', rowClass: 'row-due-today', pillClass: 'pill-today' };
  } else if (iso < todayStr) {
    return { type: 'overdue', label: 'OVERDUE', icon: 'fa-solid fa-triangle-exclamation', rowClass: 'row-overdue', pillClass: 'pill-overdue' };
  } else {
    return { type: 'upcoming', label: iso, icon: 'fa-solid fa-calendar-day', rowClass: '', pillClass: 'pill-upcoming' };
  }
}

// Universal Score Evaluator (Handles numbers, ranges "7-8", "8-10", "8/10")
function getScoreValue(raw) {
  if (raw === undefined || raw === null || raw === '') return 5;
  if (typeof raw === 'number') {
    if (raw > 10) return Math.min(Math.round(raw / 10), 10);
    return raw;
  }
  const str = String(raw).trim();
  
  // Match range like "7-8" or "8-10" or "7 - 8"
  const rangeMatch = str.match(/^(\d{1,2})\s*[-–—]\s*(\d{1,2})$/);
  if (rangeMatch) {
    const low = parseInt(rangeMatch[1], 10);
    const high = parseInt(rangeMatch[2], 10);
    return (low + high) / 2;
  }

  const numMatch = str.match(/\d+/);
  if (numMatch) {
    let val = parseInt(numMatch[0], 10);
    if (val > 10) val = Math.min(Math.round(val / 10), 10);
    return val;
  }

  return 5;
}

// Display Badge Formatter (e.g. "7-8/10" or "8/10")
function getScoreDisplay(raw) {
  if (raw === undefined || raw === null || raw === '') return '5/10';
  const str = String(raw).trim();
  if (str.includes('-') || str.includes('–') || str.includes('—')) {
    return `${str}/10`;
  }
  const val = getScoreValue(raw);
  return `${val}/10`;
}

// Parse all valid phone numbers from multi-number contact strings (e.g. "9876543210 / 9123456789")
function parsePhoneNumbers(contactStr) {
  if (!contactStr) return [];
  const parts = String(contactStr).split(/[,/|\n;]|\bor\b|\band\b/i);
  const list = [];

  for (let part of parts) {
    let digits = part.replace(/\D/g, '');
    if (digits.length >= 10) {
      if (digits.length === 10) {
        digits = '91' + digits;
      } else if (digits.length === 11 && digits.startsWith('0')) {
        digits = '91' + digits.substring(1);
      } else if (digits.length > 12 && digits.startsWith('91')) {
        digits = digits.slice(0, 12);
      }
      if (!list.includes(digits) && (digits.length === 12 || digits.length === 10)) {
        list.push(digits);
      }
    }
  }
  return list;
}

// Get array of WhatsApp URLs for multi-number contacts
function getWhatsAppUrls(contact) {
  const numbers = parsePhoneNumbers(contact);
  return numbers.map(num => `https://wa.me/${num}`);
}

// Primary WhatsApp URL
function getWhatsAppUrl(contact) {
  const urls = getWhatsAppUrls(contact);
  return urls.length > 0 ? urls[0] : null;
}

export default function Home() {
  // Authentication State
  const [authenticated, setAuthenticated] = useState(false);
  const [loggedInUserEmail, setLoggedInUserEmail] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Application State
  const [currentTab, setCurrentTab] = useState('all');
  const [leads, setLeads] = useState([]);
  const [kpis, setKpis] = useState({ totalLeads: 0, followupsCount: 0, nurtureCount: 0, meetingsCount: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortOption, setSortOption] = useState('date_added_desc');

  const [settings, setSettings] = useState({ registeredEmails: [], enableEmailNotifications: false });
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Bulk Multi-Select State
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [bulkStatusInput, setBulkStatusInput] = useState('');
  const [bulkRescheduleDate, setBulkRescheduleDate] = useState('');
  const [bulkExecuting, setBulkExecuting] = useState(false);

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

  // 1-Click Reschedule Modal State
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [reschedulingLead, setReschedulingLead] = useState(null);
  const [customRescheduleDate, setCustomRescheduleDate] = useState('');

  // Read Notes Full Popup Modal State
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [activeNotesData, setActiveNotesData] = useState({ company: '', text: '', activityLog: [] });

  // Form State
  const [formData, setFormData] = useState({
    company: '', city: '', locations: '', founder: '', linkedin: '',
    contact: '', email: '', pain_point: '', source: 'Direct',
    date_added: new Date().toISOString().split('T')[0], assigned_to: 'Sales Team',
    status: 'New', notes: '', score_of_client: '', reachout_date: '',
    new_status: '', next_action: '', follow_up_dates: ''
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);

  // Reminder System State
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [reminderLead, setReminderLead] = useState(null);
  const [reminderMessage, setReminderMessage] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('10:00');
  const [reminderEmail, setReminderEmail] = useState('');
  const [reminders, setReminders] = useState([]);
  const [remindersSaving, setRemindersSaving] = useState(false);
  const [remindersDrawerOpen, setRemindersDrawerOpen] = useState(false);

  // Theme State
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('crm_theme');
    if (savedTheme === 'dark') {
      setDarkMode(true);
      document.body.classList.add('dark-mode');
    }
  }, []);

  const toggleTheme = () => {
    const nextMode = !darkMode;
    setDarkMode(nextMode);
    if (nextMode) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('crm_theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('crm_theme', 'light');
    }
  };

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
      fetchReminders();
    }
  }, []);

  useEffect(() => {
    if (authenticated) {
      fetchLeads();
    }
  }, [authenticated, currentTab, search, statusFilter, filterDate]);

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
      if (data.success) {
        const notifs = data.notifications || [];
        setNotifications(notifs);

        const lastReadTime = localStorage.getItem('crm_notifications_last_read_time') || 0;
        const unread = notifs.filter(n => new Date(n.createdAt || n.sentAt || 0).getTime() > parseInt(lastReadTime, 10)).length;
        setUnreadCount(unread);
      }
    } catch (err) {
      console.error('Fetch notifications error:', err);
    }
  };

  // Open Drawer & Mark All Notifications as Read
  const handleOpenNotificationsDrawer = () => {
    setDrawerOpen(true);
    setUnreadCount(0);
    localStorage.setItem('crm_notifications_last_read_time', Date.now().toString());
  };

  // Mark All Notifications as Read Button Handler
  const handleMarkAllAsRead = () => {
    setUnreadCount(0);
    localStorage.setItem('crm_notifications_last_read_time', Date.now().toString());
  };

  // Fetch Leads
  const fetchLeads = async () => {
    setLoading(true);
    try {
      const url = `/api/leads?tab=${currentTab}&search=${encodeURIComponent(search)}&status=${encodeURIComponent(statusFilter)}&filterDate=${encodeURIComponent(filterDate)}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      const data = await res.json();
      if (handleAuthError(data)) return;

      if (data.success) {
        setLeads(data.leads || []);
        if (data.kpis) setKpis(data.kpis);
      }
    } catch (err) {
      console.error('Fetch leads error:', err);
    } finally {
      setTimeout(() => setLoading(false), 200);
    }
  };

  // Comprehensive Sorting Engine
  const getSortedLeads = () => {
    let list = [...leads];

    if (sortOption === 'followup_nearest') {
      list.sort((a, b) => {
        const isoA = normalizeToISO(a.follow_up_dates);
        const isoB = normalizeToISO(b.follow_up_dates);
        if (!isoA) return 1;
        if (!isoB) return -1;
        return new Date(isoA) - new Date(isoB);
      });
    } else if (sortOption === 'followup_farthest') {
      list.sort((a, b) => {
        const isoA = normalizeToISO(a.follow_up_dates);
        const isoB = normalizeToISO(b.follow_up_dates);
        if (!isoA) return 1;
        if (!isoB) return -1;
        return new Date(isoB) - new Date(isoA);
      });
    } else if (sortOption === 'reachout_nearest') {
      list.sort((a, b) => {
        const isoA = normalizeToISO(a.reachout_date);
        const isoB = normalizeToISO(b.reachout_date);
        if (!isoA) return 1;
        if (!isoB) return -1;
        return new Date(isoA) - new Date(isoB);
      });
    } else if (sortOption === 'reachout_farthest') {
      list.sort((a, b) => {
        const isoA = normalizeToISO(a.reachout_date);
        const isoB = normalizeToISO(b.reachout_date);
        if (!isoA) return 1;
        if (!isoB) return -1;
        return new Date(isoB) - new Date(isoA);
      });
    } else if (sortOption === 'score_desc') {
      list.sort((a, b) => getScoreValue(b.score_of_client) - getScoreValue(a.score_of_client));
    } else if (sortOption === 'score_asc') {
      list.sort((a, b) => getScoreValue(a.score_of_client) - getScoreValue(b.score_of_client));
    } else if (sortOption === 'date_added_desc') {
      list.sort((a, b) => new Date(b.date_added || b.createdAt || 0) - new Date(a.date_added || a.createdAt || 0));
    } else if (sortOption === 'date_added_asc') {
      list.sort((a, b) => new Date(a.date_added || a.createdAt || 0) - new Date(b.date_added || b.createdAt || 0));
    }

    return list;
  };

  // FEATURE 1: 1-Click Reschedule Handler (+1 Day, +3 Days, +1 Week, Custom)
  const openRescheduleModal = (lead) => {
    setReschedulingLead(lead);
    setCustomRescheduleDate(lead.follow_up_dates || new Date().toISOString().split('T')[0]);
    setRescheduleModalOpen(true);
  };

  // FEATURE: Mark Followed Up (Complete) Handler
  const handleMarkFollowedUp = async (lead) => {
    try {
      const todayISO = new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/leads/${lead._id || lead.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status: 'Contacted',
          follow_up_dates: '', // clear pending follow-up date
          activity_log: [
            ...(lead.activity_log || []),
            {
              timestamp: new Date(),
              action: 'Follow-up Completed',
              details: `Follow-up completed on ${todayISO}. Pending follow-up date cleared.`,
              performedBy: loggedInUserEmail || 'Sales Team'
            }
          ]
        })
      });
      const data = await res.json();
      if (handleAuthError(data)) return;

      if (data.success) {
        fetchLeads();
        fetchNotifications();
      } else {
        alert('Failed to mark completed: ' + (data.error || 'Error'));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };
  // FEATURE: Bulk Multi-Select & Batch Actions Handlers
  const toggleSelectLead = (id) => {
    setSelectedLeadIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const currentIds = sortedLeads.map(l => l._id || l.id);
    if (selectedLeadIds.length === currentIds.length && currentIds.length > 0) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(currentIds);
    }
  };

  const handleExecuteBulkAction = async (action, extraData = {}) => {
    if (selectedLeadIds.length === 0) return;

    if (action === 'delete' && !confirm(`Are you sure you want to delete all ${selectedLeadIds.length} selected leads?`)) {
      return;
    }

    setBulkExecuting(true);
    try {
      const res = await fetch('/api/leads/bulk', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          leadIds: selectedLeadIds,
          action,
          ...extraData
        })
      });
      const data = await res.json();
      if (handleAuthError(data)) return;

      if (data.success) {
        alert(`Successfully processed ${data.count} leads.`);
        setSelectedLeadIds([]);
        setBulkStatusInput('');
        setBulkRescheduleDate('');
        fetchLeads();
        fetchNotifications();
      } else {
        alert('Bulk action error: ' + (data.error || 'Failed'));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setBulkExecuting(false);
    }
  };

  // FEATURE: Kanban Drag & Drop / Move Stage Handler
  const handleMoveStage = async (leadId, newStatus) => {
    // Instantly update local state so card moves immediately in Kanban UI
    setLeads(prevLeads => prevLeads.map(l => (l._id === leadId || l.id === leadId) ? { ...l, status: newStatus } : l));
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (handleAuthError(data)) return;
      if (data.success) {
        fetchLeads();
        fetchNotifications();
      }
    } catch (err) {
      console.error('Move stage error:', err);
    }
  };

  const handleApplyReschedule = async (daysToAdd, customTargetDate = null) => {
    if (!reschedulingLead) return;

    let targetDateFormatted = '';
    if (customTargetDate) {
      targetDateFormatted = normalizeToIndianDate(customTargetDate) || customTargetDate;
    } else {
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() + daysToAdd);
      const d = String(baseDate.getDate()).padStart(2, '0');
      const m = String(baseDate.getMonth() + 1).padStart(2, '0');
      targetDateFormatted = `${d}/${m}/${baseDate.getFullYear()}`;
    }

    try {
      const res = await fetch(`/api/leads/${reschedulingLead._id || reschedulingLead.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          follow_up_dates: targetDateFormatted
        })
      });
      const data = await res.json();
      if (handleAuthError(data)) return;

      if (data.success) {
        setRescheduleModalOpen(false);
        fetchLeads();
        fetchNotifications();
      } else {
        alert('Reschedule error: ' + (data.error || 'Failed'));
      }
    } catch (err) {
      alert('Reschedule failed: ' + err.message);
    }
  };

  // FEATURE 2: Export Filtered Leads to Excel / CSV Download
  const handleExportCSV = () => {
    const listToExport = getSortedLeads();
    if (listToExport.length === 0) {
      alert('No leads available to export.');
      return;
    }

    const headers = ['Company', 'City', 'Locations', 'Founder', 'Contact', 'Email', 'Client Score', 'Status', 'New Status', 'Follow up Date', 'Outreach Date', 'Pain Point', 'Notes', 'Date Added', 'Assigned Agent', 'Source'];
    
    const csvRows = [headers.join(',')];

    listToExport.forEach(lead => {
      const row = [
        `"${(lead.company || '').replace(/"/g, '""')}"`,
        `"${(lead.city || '').replace(/"/g, '""')}"`,
        `"${(lead.locations || '').replace(/"/g, '""')}"`,
        `"${(lead.founder || '').replace(/"/g, '""')}"`,
        `"${(lead.contact || '').replace(/"/g, '""')}"`,
        `"${(lead.email || '').replace(/"/g, '""')}"`,
        lead.score_of_client || 5,
        `"${(lead.status || '').replace(/"/g, '""')}"`,
        `"${(lead.new_status || '').replace(/"/g, '""')}"`,
        `"${(lead.follow_up_dates || '').replace(/"/g, '""')}"`,
        `"${(lead.reachout_date || '').replace(/"/g, '""')}"`,
        `"${(lead.pain_point || '').replace(/"/g, '""')}"`,
        `"${(lead.notes || '').replace(/"/g, '""')}"`,
        `"${(lead.date_added || '').replace(/"/g, '""')}"`,
        `"${(lead.assigned_to || '').replace(/"/g, '""')}"`,
        `"${(lead.source || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `LeadPulse_Leads_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Manual Scan Trigger Handler
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
        if (data.newAlertsCount > 0) {
          alert(`Scan Complete: Dispatched ${data.newAlertsCount} email notifications to registered users.`);
        } else {
          alert(`Scan Complete: All scheduled reminders are up to date.`);
        }
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

  // ============ REMINDER SYSTEM HANDLERS ============

  // Fetch all reminders
  const fetchReminders = async () => {
    try {
      const res = await fetch('/api/reminders', { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        setReminders(data.reminders || []);
      }
    } catch (err) {
      console.error('Fetch reminders error:', err);
    }
  };

  // Open Set Reminder Modal for a lead
  const openReminderModal = (lead) => {
    setReminderLead(lead);
    setReminderMessage('');
    // Default date: today in YYYY-MM-DD for the input
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    setReminderDate(`${yyyy}-${mm}-${dd}`);
    setReminderTime('10:00');
    setReminderEmail(loggedInUserEmail || 'hsingh.doc04@gmail.com');
    setReminderModalOpen(true);
  };

  // Save a new reminder
  const handleSaveReminder = async () => {
    if (!reminderMessage.trim()) {
      alert('Please enter a reminder message.');
      return;
    }
    if (!reminderDate || !reminderTime) {
      alert('Please select a date and time for the reminder.');
      return;
    }

    setRemindersSaving(true);
    try {
      // Convert YYYY-MM-DD input to DD/MM/YYYY for IST storage
      const [y, m, d] = reminderDate.split('-');
      const dateIST = `${d}/${m}/${y}`;

      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          leadId: reminderLead._id || reminderLead.id,
          company: reminderLead.company,
          reminderMessage: reminderMessage.trim(),
          reminderDateIST: dateIST,
          reminderTimeIST: reminderTime,
          recipientEmail: reminderEmail || loggedInUserEmail,
          createdBy: loggedInUserEmail || 'Sales Team'
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Reminder set! You will receive an email on ${dateIST} at ${reminderTime} IST.`);
        setReminderModalOpen(false);
        fetchReminders();
      } else {
        alert('Failed to set reminder: ' + (data.error || 'Error'));
      }
    } catch (err) {
      alert('Error setting reminder: ' + err.message);
    } finally {
      setRemindersSaving(false);
    }
  };

  // Delete a reminder
  const handleDeleteReminder = async (reminderId) => {
    if (!confirm('Delete this reminder?')) return;
    try {
      const res = await fetch(`/api/reminders/${reminderId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        fetchReminders();
      } else {
        alert('Failed to delete: ' + (data.error || 'Error'));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Manually trigger reminder check
  const handleCheckReminders = async () => {
    try {
      const res = await fetch('/api/reminders/check', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchReminders();
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // ============ END REMINDER SYSTEM ============

  // Universal Delete All Leads Handler
  const handleDeleteAllLeads = async () => {
    if (!confirm('CONFIRMATION: Are you sure you want to permanently delete ALL leads in your database? This action cannot be undone.')) {
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
        alert(`Successfully deleted all ${data.deletedCount || 0} leads from database.`);
        fetchLeads();
      } else {
        alert('Failed to delete all leads: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Delete error: ' + err.message);
    }
  };

  // FEATURE 3: Open Full Notes & Activity Log Timeline Modal
  const openNotesModal = (company, text, activityLog = []) => {
    setActiveNotesData({ company, text, activityLog });
    setNotesModalOpen(true);
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

  // Helper for today's date in Indian format (DD/MM/YYYY)
  const getTodayIndianStr = () => {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${d}/${m}/${now.getFullYear()}`;
  };

  // Open Edit Modal
  const openEdit = (lead) => {
    setEditingLead(lead);
    setFormData({
      company: lead.company || '', city: lead.city || '', locations: lead.locations || '',
      founder: lead.founder || '', linkedin: lead.linkedin || '', contact: lead.contact || '',
      email: lead.email || '', pain_point: lead.pain_point || '', source: lead.source || 'Direct',
      date_added: normalizeToIndianDate(lead.date_added) || getTodayIndianStr(),
      assigned_to: lead.assigned_to || 'Sales Team', status: lead.status || 'New',
      notes: lead.notes || '', score_of_client: lead.score_of_client || '',
      reachout_date: normalizeToIndianDate(lead.reachout_date) || '', new_status: lead.new_status || '',
      next_action: lead.next_action || '', follow_up_dates: normalizeToIndianDate(lead.follow_up_dates) || ''
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
        alert(`Successfully imported ${data.importedCount} leads into your database.`);
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

  if (!authenticated) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc', color: darkMode ? '#f8fafc' : '#0f172a', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '40px', color: '#4f46e5', marginBottom: '16px' }}></i>
        <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Loading LeadPulse CRM...</h2>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '6px' }}>Verifying your session...</p>
      </div>
    );
  }

  const sortedLeads = getSortedLeads();

  return (
    <div>
      <Head>
        <title>LeadPulse CRM - Advanced Sales & Follow-up Intelligence</title>
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

              <button className={`nav-item ${currentTab === 'new' ? 'active' : ''}`} onClick={() => { setCurrentTab('new'); setMobileMenuOpen(false); }}>
                <i className="fa-solid fa-star" style={{ color: '#10b981' }}></i>
                <span>Fresh New Leads</span>
                <span className="badge" style={{ background: '#d1fae5', color: '#047857' }}>{kpis.newLeadsCount}</span>
              </button>

              <button className={`nav-item ${currentTab === 'contacted' ? 'active' : ''}`} onClick={() => { setCurrentTab('contacted'); setMobileMenuOpen(false); }}>
                <i className="fa-solid fa-comments" style={{ color: '#0284c7' }}></i>
                <span>Contacted Leads</span>
                <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>{kpis.contactedCount}</span>
              </button>

              <button className={`nav-item ${currentTab === 'meetings' ? 'active' : ''}`} onClick={() => { setCurrentTab('meetings'); setMobileMenuOpen(false); }}>
                <i className="fa-solid fa-handshake" style={{ color: '#7e22ce' }}></i>
                <span>Meetings Scheduled</span>
                <span className="badge" style={{ background: '#f3e8ff', color: '#6b21a8' }}>{kpis.meetingsCount}</span>
              </button>

              <button className={`nav-item ${currentTab === 'qualified' ? 'active' : ''}`} onClick={() => { setCurrentTab('qualified'); setMobileMenuOpen(false); }}>
                <i className="fa-solid fa-award" style={{ color: '#4f46e5' }}></i>
                <span>Qualified Opportunities</span>
                <span className="badge" style={{ background: '#e0e7ff', color: '#4338ca' }}>{kpis.qualifiedCount}</span>
              </button>

              <button className={`nav-item ${currentTab === 'nurture' ? 'active' : ''}`} onClick={() => { setCurrentTab('nurture'); setMobileMenuOpen(false); }}>
                <i className="fa-solid fa-seedling" style={{ color: '#059669' }}></i>
                <span>Nurture List</span>
                <span className="badge" style={{ background: '#ecfdf5', color: '#047857' }}>{kpis.nurtureCount}</span>
              </button>

              <button className={`nav-item ${currentTab === 'not_interested' ? 'active' : ''}`} onClick={() => { setCurrentTab('not_interested'); setMobileMenuOpen(false); }}>
                <i className="fa-solid fa-ban" style={{ color: '#ef4444' }}></i>
                <span style={{ color: '#b91c1c', fontWeight: 700 }}>Not Interested</span>
                <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>{kpis.notInterestedCount}</span>
              </button>

              <button className={`nav-item ${currentTab === 'today' ? 'active' : ''}`} onClick={() => { setCurrentTab('today'); setMobileMenuOpen(false); }}>
                <i className="fa-solid fa-clock-rotate-left" style={{ color: '#d97706' }}></i>
                <span style={{ color: '#92400e', fontWeight: 700 }}>Today's Follow-ups</span>
              </button>

              <button className={`nav-item ${currentTab === 'overdue' ? 'active' : ''}`} onClick={() => { setCurrentTab('overdue'); setMobileMenuOpen(false); }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ color: '#dc2626' }}></i>
                <span style={{ color: '#991b1b', fontWeight: 700 }}>Overdue Follow-ups</span>
              </button>

              <button className={`nav-item ${currentTab === 'kanban' ? 'active' : ''}`} onClick={() => { setCurrentTab('kanban'); setMobileMenuOpen(false); }}>
                <i className="fa-solid fa-table-columns" style={{ color: '#4f46e5' }}></i>
                <span>Kanban Pipeline</span>
              </button>

              <button className={`nav-item ${currentTab === 'analytics' ? 'active' : ''}`} onClick={() => { setCurrentTab('analytics'); setMobileMenuOpen(false); }}>
                <i className="fa-solid fa-chart-pie"></i>
                <span>Analytics & Intelligence</span>
              </button>

              <button className={`nav-item ${currentTab === 'scorecard' ? 'active' : ''}`} onClick={() => { setCurrentTab('scorecard'); setMobileMenuOpen(false); }}>
                <i className="fa-solid fa-square-poll-vertical" style={{ color: '#10b981' }}></i>
                <span>Weekly Sales Scorecard</span>
              </button>

              <button className="nav-item" onClick={() => { setRemindersDrawerOpen(true); setMobileMenuOpen(false); }}>
                <i className="fa-solid fa-bell" style={{ color: '#f59e0b' }}></i>
                <span>My Reminders ({(reminders || []).filter(r => r && r.status === 'pending').length})</span>
              </button>
            </nav>
          </div>

          <div className="sidebar-footer">
            {/* Interactive Theme Toggle Switch Card */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: darkMode ? '#1e293b' : '#f8fafc', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: '12px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: darkMode ? '#f8fafc' : '#0f172a' }}>
                <i className={darkMode ? "fa-solid fa-moon" : "fa-solid fa-sun"} style={{ color: darkMode ? '#818cf8' : '#f59e0b', fontSize: '16px' }}></i>
                <span>{darkMode ? 'Dark Mode' : 'Light Mode'}</span>
              </div>
              <button
                onClick={toggleTheme}
                title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                style={{
                  width: '46px',
                  height: '24px',
                  borderRadius: '12px',
                  background: darkMode ? '#6366f1' : '#cbd5e1',
                  position: 'relative',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'background 0.3s'
                }}
              >
                <span style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  position: 'absolute',
                  top: '3px',
                  left: darkMode ? '24px' : '3px',
                  transition: 'left 0.3s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}></span>
              </button>
            </div>

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
          {/* Topbar Universal Search & Date Picker Filter */}
          <header className="topbar">
            <div className="topbar-search" style={{ display: 'flex', gap: '10px', flex: 1, maxWidth: '600px', minWidth: '300px' }}>
              <div style={{ position: 'relative', width: '100%', flex: 1 }}>
                <i className="fa-solid fa-magnifying-glass search-icon" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: darkMode ? '#94a3b8' : '#64748b', zIndex: 2 }}></i>
                <input
                  type="text"
                  placeholder="Search by Company, Founder, Phone, Email, City, or Date..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 36px 12px 42px',
                    background: darkMode ? '#1e293b' : '#ffffff',
                    border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`,
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: darkMode ? '#f8fafc' : '#0f172a',
                    outline: 'none'
                  }}
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: darkMode ? '#94a3b8' : '#64748b', fontSize: '16px', zIndex: 3 }}
                    title="Clear search"
                  >
                    &times;
                  </button>
                )}
              </div>

              {/* Exact Date Picker Input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${darkMode ? '#334155' : 'var(--border-color)'}`, borderRadius: '12px', padding: '0 12px' }}>
                <i className="fa-solid fa-calendar" style={{ color: '#4f46e5', fontSize: '14px' }}></i>
                <input
                  type="text"
                  placeholder="Filter Date (DD/MM/YYYY)"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  style={{ border: 'none', background: 'transparent', fontSize: '13px', outline: 'none', color: darkMode ? '#f8fafc' : '#0f172a', fontWeight: 600, width: '170px' }}
                  title="Filter Leads by Date (DD/MM/YYYY)"
                />
                {filterDate && (
                  <button onClick={() => setFilterDate('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '14px' }}>&times;</button>
                )}
              </div>
            </div>

            <div className="topbar-actions">
              {/* Theme Toggle Button */}
              <button
                className="btn btn-outline"
                onClick={toggleTheme}
                title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: darkMode ? '#334155' : '#ffffff',
                  color: darkMode ? '#fde047' : '#0f172a',
                  borderColor: darkMode ? '#475569' : '#cbd5e1',
                  fontWeight: 700,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                }}
              >
                <i className={darkMode ? "fa-solid fa-sun" : "fa-solid fa-moon"} style={{ color: darkMode ? '#fde047' : '#6366f1', fontSize: '15px' }}></i>
                <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </button>

              {/* FEATURE 2: Export Filtered Leads to CSV Button */}
              <button className="btn btn-outline" onClick={handleExportCSV} title="Export filtered leads to Excel / CSV">
                <i className="fa-solid fa-file-arrow-down" style={{ color: '#10b981' }}></i>
                <span>Export CSV</span>
              </button>

              <button className="btn btn-outline" onClick={() => setImportModalOpen(true)}>
                <i className="fa-solid fa-file-excel"></i>
                <span>Import Excel</span>
              </button>

              <button className="btn btn-outline" onClick={handleManualScan} disabled={scanning} title="Run manual alert scan">
                <i className={scanning ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-rotate"}></i>
                <span>{scanning ? 'Scanning...' : 'Scan Alerts'}</span>
              </button>

              <button className="btn btn-outline" onClick={() => setRemindersDrawerOpen(true)} title="View my custom reminders">
                <i className="fa-solid fa-bell" style={{ color: '#f59e0b' }}></i>
                <span>Reminders ({(reminders || []).filter(r => r && r.status === 'pending').length})</span>
              </button>

              <button
                className="btn btn-outline"
                style={{ color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2' }}
                onClick={handleDeleteAllLeads}
                title="Delete all leads in database"
              >
                <i className="fa-solid fa-trash-can"></i>
                <span>Delete All</span>
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

              {/* Notification Bell with Dynamic Unread Counter */}
              <div className="notification-bell-wrapper" onClick={handleOpenNotificationsDrawer} title="View Notification History">
                <i className="fa-solid fa-bell"></i>
                {unreadCount > 0 && <span className="notif-count">{unreadCount}</span>}
              </div>
            </div>
          </header>

          {/* Professional Status Legend Bar */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '14px 20px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="fa-solid fa-filter" style={{ color: '#4f46e5', fontSize: '16px' }}></i>
              <strong style={{ color: '#0f172a', fontSize: '14px' }}>Priority Filters:</strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button className="pill-today" onClick={() => setCurrentTab('today')} style={{ cursor: 'pointer', border: 'none' }}>
                <i className="fa-solid fa-clock-rotate-left"></i> Today's Follow-ups ({kpis.todayCount || 0})
              </button>

              <button className="pill-overdue" onClick={() => setCurrentTab('overdue')} style={{ cursor: 'pointer', border: 'none' }}>
                <i className="fa-solid fa-triangle-exclamation"></i> Overdue Follow-ups ({kpis.overdueCount || 0})
              </button>

              {filterDate && (
                <span className="pill-upcoming">
                  <i className="fa-solid fa-calendar"></i> Filtered: {filterDate}
                </span>
              )}
            </div>
          </div>

          {/* KPI Metrics Cards (Interactive & Clickable) */}
          <section className="kpi-grid">
            <div 
              className={`kpi-card glass ${currentTab === 'all' ? 'active-kpi' : ''}`} 
              onClick={() => setCurrentTab('all')} 
              style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
              title="Click to view All Leads"
            >
              <div className="kpi-icon blue"><i className="fa-solid fa-building"></i></div>
              <div className="kpi-data">
                <span className="kpi-title">Total Active Leads</span>
                <h3>{kpis.totalLeads}</h3>
                <span className="kpi-sub">Stored in Database</span>
              </div>
            </div>

            <div 
              className={`kpi-card glass ${currentTab === 'followups' ? 'active-kpi' : ''}`} 
              onClick={() => setCurrentTab('followups')} 
              style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
              title="Click to view Follow-ups Scheduled"
            >
              <div className="kpi-icon amber"><i className="fa-solid fa-bell"></i></div>
              <div className="kpi-data">
                <span className="kpi-title">Follow-ups Scheduled</span>
                <h3>{kpis.followupsCount}</h3>
                <span className="kpi-sub">Pending Action</span>
              </div>
            </div>

            <div 
              className={`kpi-card glass ${currentTab === 'nurture' ? 'active-kpi' : ''}`} 
              onClick={() => setCurrentTab('nurture')} 
              style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
              title="Click to view Monthly Nurture List"
            >
              <div className="kpi-icon purple"><i className="fa-solid fa-seedling"></i></div>
              <div className="kpi-data">
                <span className="kpi-title">Monthly Nurture List</span>
                <h3>{kpis.nurtureCount}</h3>
                <span className="kpi-sub">Long-term Prospects</span>
              </div>
            </div>

            <div 
              className={`kpi-card glass ${currentTab === 'not_interested' ? 'active-kpi' : ''}`} 
              onClick={() => setCurrentTab('not_interested')} 
              style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
              title="Click to view Not Interested Leads"
            >
              <div className="kpi-icon" style={{ background: '#fee2e2', color: '#b91c1c' }}><i className="fa-solid fa-ban"></i></div>
              <div className="kpi-data">
                <span className="kpi-title">Not Interested</span>
                <h3 style={{ color: '#b91c1c' }}>{kpis.notInterestedCount || 0}</h3>
                <span className="kpi-sub">Opted Out / Rejected</span>
              </div>
            </div>
          </section>

          {/* Analytics & Intelligence Page vs Scorecard vs Kanban vs Table */}
          {currentTab === 'analytics' ? (
            <AnalyticsDashboard leads={leads} />
          ) : currentTab === 'scorecard' ? (
            <WeeklyScorecard leads={leads} />
          ) : currentTab === 'kanban' ? (
            <KanbanView
              leads={sortedLeads}
              onMoveStage={handleMoveStage}
              onEdit={openEdit}
              onReschedule={openRescheduleModal}
              onMarkDone={handleMarkFollowedUp}
              onSetReminder={openReminderModal}
            />
          ) : (
            <section className="view-container">
              <div className="view-header">
                <div>
                  <h2>
                    {currentTab === 'all' && 'All Registered Leads'}
                    {currentTab === 'new' && 'Fresh New Leads'}
                    {currentTab === 'contacted' && 'Contacted & Engaged Leads'}
                    {currentTab === 'meetings' && 'Meetings Scheduled'}
                    {currentTab === 'qualified' && 'Qualified Opportunities'}
                    {currentTab === 'nurture' && 'Monthly Nurture List'}
                    {currentTab === 'not_interested' && 'Not Interested Leads'}
                    {currentTab === 'won' && 'Won Deals'}
                    {currentTab === 'lost' && 'Lost Deals'}
                    {currentTab === 'today' && 'Today\'s Scheduled Follow-ups'}
                    {currentTab === 'overdue' && 'Overdue Follow-ups'}
                    {currentTab === 'followups' && 'All Scheduled Follow-ups'}
                    {currentTab === 'reachout' && 'Outreach Pipeline'}
                    {filterDate && ` (Date: ${filterDate})`}
                  </h2>
                </div>

                <div className="view-filters">
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="form-select">
                    <option value="">All Statuses</option>
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Meeting Scheduled">Meeting Scheduled</option>
                    <option value="Qualified">Qualified</option>
                    <option value="Nurture">Nurture</option>
                    <option value="Not Interested">Not Interested</option>
                    <option value="Won">Won</option>
                    <option value="Lost">Lost</option>
                  </select>

                  <select value={sortOption} onChange={(e) => setSortOption(e.target.value)} className="form-select" style={{ fontWeight: 700, color: '#4f46e5' }}>
                    <option value="date_added_desc">Sort: Newest First</option>
                    <option value="date_added_asc">Sort: Oldest First</option>
                    <option value="followup_nearest">Follow-up: Nearest First</option>
                    <option value="followup_farthest">Follow-up: Farthest First</option>
                    <option value="reachout_nearest">Outreach: Nearest First</option>
                    <option value="reachout_farthest">Outreach: Farthest First</option>
                    <option value="score_desc">Score: High to Low</option>
                    <option value="score_asc">Score: Low to High</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <SkeletonTableRows />
              ) : (
                <div className="table-card glass">
                  {/* Desktop Table View */}
                  <div className="table-responsive">
                    <table className="leads-table">
                      <thead>
                        <tr>
                          <th style={{ width: '36px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={selectedLeadIds.length === sortedLeads.length && sortedLeads.length > 0}
                              onChange={toggleSelectAll}
                              title="Select All Leads"
                              style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#4f46e5' }}
                            />
                          </th>
                          <th style={{ width: '40px' }}>#</th>
                          <th>Company & Location</th>
                          <th>Founder & Contact</th>
                          <th>Pain Point & Notes</th>
                          <th>Score</th>
                          <th>Status</th>
                          <th>Next Action</th>
                          <th>Outreach Date (DD/MM/YYYY)</th>
                          <th>Follow-up Date (DD/MM/YYYY)</th>
                          <th>Date Added (DD/MM/YYYY)</th>
                          <th>Agent & Source</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedLeads.length === 0 ? (
                          <tr>
                            <td colSpan="13" style={{ textAlign: 'center', padding: '40px' }}>
                              <i className="fa-solid fa-folder-open" style={{ fontSize: '32px', color: 'var(--text-dim)' }}></i>
                              <p style={{ marginTop: '10px', color: '#64748b' }}>No leads found matching current filter criteria.</p>
                            </td>
                          </tr>
                        ) : (
                          sortedLeads.map((lead, index) => {
                            const scoreVal = getScoreValue(lead.score_of_client);
                            const scoreDisplay = getScoreDisplay(lead.score_of_client);

                            const scoreClass = scoreVal >= 8 ? 'score-hot' : scoreVal >= 5 ? 'score-warm' : 'score-cold';
                            const scoreIconClass = scoreVal >= 8 ? 'fa-solid fa-fire' : scoreVal >= 5 ? 'fa-solid fa-bolt' : 'fa-solid fa-snowflake';

                            const followStatus = getFollowUpStatus(lead.follow_up_dates);
                            const rowHighlightClass = followStatus ? followStatus.rowClass : '';
                            const notesText = lead.pain_point || lead.notes || '';
                            const leadId = lead._id || lead.id;
                            const isSelected = selectedLeadIds.includes(leadId);

                            return (
                              <tr key={leadId} className={`${rowHighlightClass} ${isSelected ? 'row-selected' : ''}`} style={isSelected ? { background: '#eef2ff' } : {}}>
                                <td style={{ textAlign: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSelectLead(leadId)}
                                    style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#4f46e5' }}
                                  />
                                </td>
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
                                    {lead.email && <a href={`mailto:${lead.email}`} className="contact-link contact-text"><i className="fa-solid fa-envelope"></i> {lead.email}</a>}
                                    {lead.contact && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <span className="contact-link contact-text"><i className="fa-solid fa-phone"></i> {lead.contact}</span>
                                        {getWhatsAppUrls(lead.contact).map((waUrl, waIdx) => (
                                          <a
                                            key={waIdx}
                                            href={waUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="contact-link"
                                            style={{ color: '#25D366', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}
                                            title={`Chat on WhatsApp (${waIdx + 1})`}
                                          >
                                            <i className="fa-brands fa-whatsapp" style={{ fontSize: '13px' }}></i>
                                            {getWhatsAppUrls(lead.contact).length > 1 ? `WA ${waIdx + 1}` : 'WhatsApp'}
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  {notesText ? (
                                    <div className="notes-preview-badge">
                                      <span className="notes-text-truncated">{notesText}</span>
                                      <button className="read-notes-btn" onClick={() => openNotesModal(lead.company, notesText, lead.activity_log || [])}>
                                        <i className="fa-solid fa-eye"></i> View Notes & History
                                      </button>
                                    </div>
                                  ) : (
                                    <button className="read-notes-btn" onClick={() => openNotesModal(lead.company, 'No notes recorded yet.', lead.activity_log || [])}>
                                      <i className="fa-solid fa-clock-rotate-left"></i> View History
                                    </button>
                                  )}
                                </td>
                                <td>
                                  <span className={`score-badge ${scoreClass}`}>
                                    <i className={scoreIconClass}></i> {scoreDisplay}
                                  </span>
                                </td>
                                <td>
                                  <span className="status-pill status-new">{lead.status || 'New'}</span>
                                  {lead.new_status && <div style={{ fontSize: '11px', color: darkMode ? '#38bdf8' : '#0369a1', fontWeight: 600, marginTop: '2px' }}>{lead.new_status}</div>}
                                </td>
                                <td>
                                  {lead.next_action ? (
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: darkMode ? '#34d399' : '#334155', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <i className="fa-solid fa-arrow-right" style={{ color: darkMode ? '#818cf8' : '#4f46e5', fontSize: '11px' }}></i>
                                      <span>{lead.next_action}</span>
                                    </div>
                                  ) : (
                                    <span style={{ color: darkMode ? '#64748b' : '#94a3b8', fontSize: '12px' }}>—</span>
                                  )}
                                </td>
                                <td>
                                  {lead.reachout_date ? (
                                    <span className="date-pill" style={{ color: darkMode ? '#60a5fa' : '#0284c7', fontWeight: 600 }}>
                                      <i className="fa-solid fa-paper-plane"></i> {lead.reachout_date}
                                    </span>
                                  ) : (
                                    <span style={{ color: darkMode ? '#64748b' : '#94a3b8', fontSize: '12px' }}>—</span>
                                  )}
                                </td>
                                <td>
                                  {lead.follow_up_dates ? (
                                    followStatus ? (
                                      <div>
                                        <span className={followStatus.pillClass}>
                                          <i className={followStatus.icon}></i> {followStatus.label}
                                        </span>
                                        <span style={{ display: 'block', fontSize: '10px', color: darkMode ? '#94a3b8' : '#64748b', marginTop: '2px' }}>
                                          {lead.follow_up_dates}
                                        </span>
                                      </div>
                                    ) : (
                                      <span style={{ fontSize: '12px', color: darkMode ? '#cbd5e1' : '#475569' }}>{lead.follow_up_dates}</span>
                                    )
                                  ) : (
                                    <span style={{ color: darkMode ? '#64748b' : '#94a3b8', fontSize: '12px' }}>—</span>
                                  )}
                                </td>
                                <td>
                                  {lead.date_added ? (
                                    <span style={{ fontSize: '12px', color: darkMode ? '#cbd5e1' : '#475569' }}>
                                      <i className="fa-solid fa-clock"></i> {lead.date_added}
                                    </span>
                                  ) : (
                                    <span style={{ color: darkMode ? '#64748b' : '#94a3b8', fontSize: '12px' }}>—</span>
                                  )}
                                </td>
                                <td>
                                  <div className="location-sub"><strong>Agent:</strong> {lead.assigned_to || 'Sales'}</div>
                                  <div className="location-sub"><strong>Source:</strong> {lead.source || 'Direct'}</div>
                                </td>
                                <td>
                                  <div className="action-btns">
                                    {/* Mark Follow-up Complete Button */}
                                    <button className="icon-btn" style={{ color: '#10b981', borderColor: '#a7f3d0', background: '#ecfdf5' }} onClick={() => handleMarkFollowedUp(lead)} title="Mark Follow-up Completed">
                                      <i className="fa-solid fa-circle-check"></i>
                                    </button>
                                    {/* 1-Click Reschedule Action Button */}
                                    <button className="icon-btn" onClick={() => openRescheduleModal(lead)} title="Reschedule Follow-up in 1 Click">
                                      <i className="fa-solid fa-calendar-plus" style={{ color: '#4f46e5' }}></i>
                                    </button>
                                    {/* Set Reminder Button */}
                                    <button className="icon-btn" onClick={() => openReminderModal(lead)} title="Set Email Reminder" style={{ color: '#f59e0b', borderColor: '#fde68a', background: '#fffbeb' }}>
                                      <i className="fa-solid fa-bell"></i>
                                    </button>
                                    <button className="icon-btn" onClick={() => openEdit(lead)} title="Edit Lead"><i className="fa-solid fa-pen-to-square"></i></button>
                                    {lead.email && <a href={`mailto:${lead.email}`} className="icon-btn" title="Send Email"><i className="fa-solid fa-envelope"></i></a>}
                                    {getWhatsAppUrl(lead.contact, lead.founder, lead.company) && (
                                      <a
                                        href={getWhatsAppUrl(lead.contact, lead.founder, lead.company)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="icon-btn"
                                        style={{ color: '#25D366', borderColor: '#86efac', background: '#f0fdf4', textDecoration: 'none' }}
                                        title="Chat on WhatsApp"
                                      >
                                        <i className="fa-brands fa-whatsapp" style={{ fontSize: '15px' }}></i>
                                      </a>
                                    )}
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

                  {/* Mobile Touch Cards View */}
                  <div className="mobile-lead-cards">
                    {sortedLeads.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                        No leads found matching current criteria.
                      </div>
                    ) : (
                      sortedLeads.map((lead, index) => {
                        const scoreVal = getScoreValue(lead.score_of_client);
                        const scoreDisplay = getScoreDisplay(lead.score_of_client);
                        const scoreClass = scoreVal >= 8 ? 'score-hot' : scoreVal >= 5 ? 'score-warm' : 'score-cold';
                        const scoreIconClass = scoreVal >= 8 ? 'fa-solid fa-fire' : scoreVal >= 5 ? 'fa-solid fa-bolt' : 'fa-solid fa-snowflake';

                        const followStatus = getFollowUpStatus(lead.follow_up_dates);
                        const notesText = lead.pain_point || lead.notes || '';

                        return (
                          <div key={lead._id || lead.id} className={`mobile-lead-card ${followStatus ? followStatus.rowClass : ''}`}>
                            <div className="mobile-lead-card-header">
                              <div>
                                <strong style={{ fontSize: '15px', color: '#0f172a' }}>#{index + 1} {lead.company}</strong>
                                <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>{lead.city || 'N/A'}</span>
                              </div>
                              <span className={`score-badge ${scoreClass}`}><i className={scoreIconClass}></i> {scoreDisplay}</span>
                            </div>

                            <div className="mobile-lead-card-body">
                              <div className="mobile-lead-card-row">
                                <span className="label">Founder / Contact:</span>
                                <strong>{lead.founder || 'N/A'} ({lead.contact || 'N/A'})</strong>
                              </div>
                              <div className="mobile-lead-card-row">
                                <span className="label">Status:</span>
                                <div style={{ textAlign: 'right' }}>
                                  <span className="status-pill">{lead.status || 'New'}</span>
                                  {lead.new_status && <div style={{ fontSize: '10px', color: '#0369a1', fontWeight: 600, marginTop: '2px' }}>{lead.new_status}</div>}
                                </div>
                              </div>
                              <div className="mobile-lead-card-row">
                                <span className="label">Next Action:</span>
                                {lead.next_action ? (
                                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#4f46e5' }}>
                                    <i className="fa-solid fa-arrow-right"></i> {lead.next_action}
                                  </span>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>None</span>
                                )}
                              </div>
                              {lead.follow_up_dates && (
                                <div className="mobile-lead-card-row">
                                  <span className="label">Follow-up Status:</span>
                                  {followStatus ? (
                                    <span className={followStatus.pillClass}><i className={followStatus.icon}></i> {followStatus.label}</span>
                                  ) : (
                                    <span>{lead.follow_up_dates}</span>
                                  )}
                                </div>
                              )}
                              {lead.reachout_date && (
                                <div className="mobile-lead-card-row">
                                  <span className="label">Outreach Date:</span>
                                  <span style={{ color: '#0284c7', fontWeight: 600 }}>{lead.reachout_date}</span>
                                </div>
                              )}
                              {notesText && (
                                <div style={{ fontSize: '12px', color: '#b91c1c', marginTop: '4px' }}>
                                  <strong>Pain Point / Notes:</strong>
                                  <div style={{ marginTop: '2px', background: '#f8fafc', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#334155' }}>
                                    {notesText}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                              <button className="btn btn-outline" style={{ flex: 1, padding: '8px', fontSize: '12px', justifyContent: 'center', color: '#10b981', borderColor: '#a7f3d0' }} onClick={() => handleMarkFollowedUp(lead)}>
                                <i className="fa-solid fa-circle-check"></i> Done
                              </button>
                              <button className="btn btn-outline" style={{ flex: 1, padding: '8px', fontSize: '12px', justifyContent: 'center' }} onClick={() => openRescheduleModal(lead)}>
                                <i className="fa-solid fa-calendar-plus" style={{ color: '#4f46e5' }}></i> Reschedule
                              </button>
                              <button className="btn btn-outline" style={{ padding: '8px 12px', fontSize: '12px', justifyContent: 'center', color: '#f59e0b', borderColor: '#fde68a', background: darkMode ? '#1c2436' : '#fffbeb' }} onClick={() => openReminderModal(lead)} title="Set Email Reminder">
                                <i className="fa-solid fa-bell"></i>
                              </button>
                              <button className="btn btn-outline" style={{ padding: '8px 12px', fontSize: '12px', justifyContent: 'center' }} onClick={() => openEdit(lead)}>
                                <i className="fa-solid fa-pen-to-square"></i>
                              </button>
                              {lead.email && (
                                <a href={`mailto:${lead.email}`} className="btn btn-outline" style={{ padding: '8px 12px', fontSize: '12px', justifyContent: 'center', textDecoration: 'none' }} title="Send Email">
                                  <i className="fa-solid fa-envelope"></i>
                                </a>
                              )}
                              {getWhatsAppUrl(lead.contact, lead.founder, lead.company) && (
                                <a
                                  href={getWhatsAppUrl(lead.contact, lead.founder, lead.company)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-outline"
                                  style={{ padding: '8px 12px', fontSize: '12px', justifyContent: 'center', color: '#15803d', borderColor: '#86efac', background: '#f0fdf4', textDecoration: 'none' }}
                                  title="Chat on WhatsApp"
                                >
                                  <i className="fa-brands fa-whatsapp" style={{ color: '#25D366', fontSize: '16px' }}></i>
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
          )}
        </main>

        {/* FEATURE 1: MODAL - 1-Click Reschedule Follow-up */}
        {rescheduleModalOpen && reschedulingLead && (
          <div className="modal-overlay">
            <div className="modal-card" style={{ maxWidth: '480px' }}>
              <div className="modal-header">
                <h3>
                  <i className="fa-solid fa-calendar-plus" style={{ color: '#4f46e5', marginRight: '8px' }}></i>
                  Reschedule Follow-up for {reschedulingLead.company}
                </h3>
                <button className="close-modal-btn" onClick={() => setRescheduleModalOpen(false)}>&times;</button>
              </div>

              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                Current Follow-up Date: <strong style={{ color: '#0f172a' }}>{reschedulingLead.follow_up_dates || 'Not set'}</strong>
              </p>

              <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '10px' }}>Quick 1-Click Options:</label>

              <div className="reschedule-quick-grid">
                <button className="quick-reschedule-btn" onClick={() => handleApplyReschedule(1)}>
                  <i className="fa-solid fa-sun" style={{ color: '#f59e0b', fontSize: '18px' }}></i>
                  <span>+1 Day (Tomorrow)</span>
                </button>

                <button className="quick-reschedule-btn" onClick={() => handleApplyReschedule(3)}>
                  <i className="fa-solid fa-forward" style={{ color: '#0284c7', fontSize: '18px' }}></i>
                  <span>+3 Days</span>
                </button>

                <button className="quick-reschedule-btn" onClick={() => handleApplyReschedule(7)}>
                  <i className="fa-solid fa-calendar-week" style={{ color: '#10b981', fontSize: '18px' }}></i>
                  <span>+1 Week</span>
                </button>
              </div>

              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '6px' }}>Or Select Custom Date (DD/MM/YYYY):</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder="DD/MM/YYYY e.g. 09/08/2026"
                    value={customRescheduleDate}
                    onChange={(e) => setCustomRescheduleDate(e.target.value)}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={() => handleApplyReschedule(0, customRescheduleDate)}
                    disabled={!customRescheduleDate}
                  >
                    Save Custom Date
                  </button>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setRescheduleModalOpen(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* FEATURE: MODAL - Set Email Reminder */}
        {reminderModalOpen && reminderLead && (
          <div className="modal-overlay">
            <div className="modal-card" style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <h3>
                  <i className="fa-solid fa-bell" style={{ color: '#f59e0b', marginRight: '8px' }}></i>
                  Set Reminder for {reminderLead.company}
                </h3>
                <button className="close-modal-btn" onClick={() => setReminderModalOpen(false)}>&times;</button>
              </div>

              <div style={{ padding: '0 24px 16px' }}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '6px' }}>Reminder Message *</label>
                  <textarea
                    rows={3}
                    placeholder="E.g. Call him about pricing, Send proposal, Follow up on WhatsApp..."
                    value={reminderMessage}
                    onChange={(e) => setReminderMessage(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '6px' }}>Date (IST) *</label>
                    <input
                      type="date"
                      value={reminderDate}
                      onChange={(e) => setReminderDate(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '6px' }}>Time (IST) *</label>
                    <input
                      type="time"
                      value={reminderTime}
                      onChange={(e) => setReminderTime(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '6px' }}>Send Reminder Email To</label>
                  <input
                    type="email"
                    value={reminderEmail}
                    onChange={(e) => setReminderEmail(e.target.value)}
                    placeholder="your.email@gmail.com"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>

                <div style={{ background: '#eff6ff', borderRadius: '8px', padding: '12px', fontSize: '12px', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-circle-info"></i>
                  You'll receive an email at the exact date & time you set (Indian Standard Time).
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setReminderModalOpen(false)}>Cancel</button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveReminder}
                  disabled={remindersSaving}
                  style={{ background: '#f59e0b', borderColor: '#f59e0b' }}
                >
                  {remindersSaving ? 'Saving...' : '🔔 Set Reminder'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FEATURE: DRAWER - My Reminders */}
        {remindersDrawerOpen && (
          <div className="modal-overlay" onClick={() => setRemindersDrawerOpen(false)}>
            <div className="drawer-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px', width: '100%', position: 'fixed', right: 0, top: 0, bottom: 0, background: '#fff', boxShadow: '-4px 0 20px rgba(0,0,0,0.1)', zIndex: 1001, overflowY: 'auto', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  <i className="fa-solid fa-bell" style={{ color: '#f59e0b', marginRight: '8px' }}></i>
                  My Reminders
                </h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-outline" style={{ fontSize: '11px', padding: '6px 10px' }} onClick={handleCheckReminders} title="Check & send due reminders now">
                    <i className="fa-solid fa-rotate"></i> Check Now
                  </button>
                  <button className="close-modal-btn" onClick={() => setRemindersDrawerOpen(false)}>&times;</button>
                </div>
              </div>

              {(reminders || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                  <i className="fa-solid fa-bell-slash" style={{ fontSize: '32px', marginBottom: '12px', display: 'block' }}></i>
                  <p>No reminders set yet.<br />Click the 🔔 bell icon on any lead to create one.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(reminders || []).map((rem) => (
                    <div key={rem._id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', background: rem.status === 'sent' ? '#f0fdf4' : '#fffbeb', position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{rem.company}</span>
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '12px', background: rem.status === 'sent' ? '#dcfce7' : rem.status === 'cancelled' ? '#fee2e2' : '#fef3c7', color: rem.status === 'sent' ? '#166534' : rem.status === 'cancelled' ? '#991b1b' : '#92400e', textTransform: 'uppercase' }}>
                          {rem.status}
                        </span>
                      </div>
                      <p style={{ fontSize: '13px', color: '#334155', margin: '0 0 8px 0', lineHeight: 1.4 }}>{rem.reminderMessage}</p>
                      <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span><i className="fa-solid fa-calendar" style={{ marginRight: '4px' }}></i>{rem.reminderDateIST}</span>
                        <span><i className="fa-solid fa-clock" style={{ marginRight: '4px' }}></i>{rem.reminderTimeIST} IST</span>
                        <span><i className="fa-solid fa-envelope" style={{ marginRight: '4px' }}></i>{rem.recipientEmail}</span>
                      </div>
                      {rem.status === 'pending' && (
                        <button onClick={() => handleDeleteReminder(rem._id)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px', padding: '4px' }} title="Delete Reminder">
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* FEATURE 3: MODAL - Notes & Activity Log History Timeline */}
        {notesModalOpen && (
          <div className="modal-overlay">
            <div className="modal-card" style={{ maxWidth: '560px' }}>
              <div className="modal-header">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-note-sticky" style={{ color: '#4f46e5' }}></i>
                  Notes & History Timeline for {activeNotesData.company}
                </h3>
                <button className="close-modal-btn" onClick={() => setNotesModalOpen(false)}>&times;</button>
              </div>

              <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>Current Notes / Pain Point:</label>
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                fontSize: '13px',
                color: '#1e293b',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                marginTop: '6px',
                marginBottom: '20px'
              }}>
                {activeNotesData.text || 'No notes recorded yet.'}
              </div>

              <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                <i className="fa-solid fa-clock-rotate-left" style={{ color: '#4f46e5', marginRight: '6px' }}></i>
                Lead Activity Log & Timeline:
              </label>

              <div style={{ maxHeight: '220px', overflowY: 'auto', paddingRight: '10px' }}>
                {(!activeNotesData.activityLog || activeNotesData.activityLog.length === 0) ? (
                  <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '10px' }}>No history entries logged yet.</p>
                ) : (
                  <div className="timeline-container">
                    {activeNotesData.activityLog.map((logItem, i) => (
                      <div key={i} className="timeline-item">
                        <div className="timeline-dot"></div>
                        <div className="timeline-action">{logItem.action}</div>
                        <div className="timeline-details">{logItem.details}</div>
                        <div className="timeline-meta">
                          {new Date(logItem.timestamp).toLocaleString()} • {logItem.performedBy || 'Sales Team'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-primary" onClick={() => setNotesModalOpen(false)}>Close</button>
              </div>
            </div>
          </div>
        )}

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
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a', fontWeight: 800 }}>Notification History</h3>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Dispatched Email Alerts</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    onClick={handleMarkAllAsRead}
                    style={{
                      background: '#e0e7ff',
                      color: '#4338ca',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                    title="Mark all notifications as read"
                  >
                    <i className="fa-solid fa-check-double"></i> Mark All Read
                  </button>
                  <button onClick={() => setDrawerOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>&times;</button>
                </div>
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
                          background: '#e0e7ff',
                          color: '#3730a3',
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
                <h3><i className="fa-solid fa-envelope"></i> Notification Settings</h3>
                <button className="close-modal-btn" onClick={() => setSettingsModalOpen(false)}>&times;</button>
              </div>
              
              <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <h4 style={{ color: '#0f172a', fontSize: '15px', marginBottom: '6px' }}>Notification Recipients</h4>
                <p style={{ color: '#475569', fontSize: '13px', marginBottom: '12px' }}>
                  Separate emails with commas (e.g. <code>admin@company.com, intern@company.com</code>).
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
                    <label>Client Score (1 to 10 or Range e.g. 7-8, 8-10)</label>
                    <input type="text" placeholder="e.g. 8 or 7-8 or 8-10" value={formData.score_of_client} onChange={(e) => setFormData({ ...formData, score_of_client: e.target.value })} />
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
                    <label>Date Added (DD/MM/YYYY)</label>
                    <input type="text" placeholder="DD/MM/YYYY e.g. 08/08/2026" value={formData.date_added} onChange={(e) => setFormData({ ...formData, date_added: e.target.value })} />
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
                    <label>Outreach / Reachout Date (DD/MM/YYYY)</label>
                    <input type="text" placeholder="DD/MM/YYYY e.g. 08/08/2026" value={formData.reachout_date} onChange={(e) => setFormData({ ...formData, reachout_date: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Follow up Date (DD/MM/YYYY)</label>
                    <input type="text" placeholder="DD/MM/YYYY e.g. 08/08/2026" value={formData.follow_up_dates} onChange={(e) => setFormData({ ...formData, follow_up_dates: e.target.value })} />
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
                <h3>Import Leads into Database</h3>
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
        {/* FEATURE 3: FLOATING BULK BATCH ACTIONS BAR */}
        {selectedLeadIds.length > 0 && (
          <div className="bulk-actions-bar">
            <span className="bulk-count-pill">{selectedLeadIds.length} Selected</span>

            {/* Batch Status Change */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <select
                value={bulkStatusInput}
                onChange={(e) => setBulkStatusInput(e.target.value)}
                className="bulk-select-input"
              >
                <option value="">Change Status To...</option>
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Meeting Scheduled">Meeting Scheduled</option>
                <option value="Qualified">Qualified</option>
                <option value="Nurture">Nurture</option>
                <option value="Not Interested">Not Interested</option>
                <option value="Won">Won</option>
                <option value="Lost">Lost</option>
              </select>
              <button
                className="btn btn-primary"
                style={{ padding: '6px 12px', fontSize: '11px' }}
                disabled={!bulkStatusInput || bulkExecuting}
                onClick={() => handleExecuteBulkAction('update_status', { status: bulkStatusInput })}
              >
                Apply Status
              </button>
            </div>

            {/* Batch Reschedule Date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="text"
                placeholder="DD/MM/YYYY"
                value={bulkRescheduleDate}
                onChange={(e) => setBulkRescheduleDate(e.target.value)}
                className="bulk-select-input"
              />
              <button
                className="btn btn-primary"
                style={{ padding: '6px 12px', fontSize: '11px', background: '#0284c7' }}
                disabled={!bulkRescheduleDate || bulkExecuting}
                onClick={() => handleExecuteBulkAction('reschedule', { follow_up_dates: bulkRescheduleDate })}
              >
                Apply Date
              </button>
            </div>

            {/* Batch Delete */}
            <button
              className="btn btn-outline"
              style={{ padding: '6px 12px', fontSize: '11px', color: '#ef4444', borderColor: '#fca5a5', background: '#fef2f2' }}
              disabled={bulkExecuting}
              onClick={() => handleExecuteBulkAction('delete')}
            >
              <i className="fa-solid fa-trash"></i> Delete Selected
            </button>

            {/* Deselect All */}
            <button
              onClick={() => setSelectedLeadIds([])}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer', marginLeft: 'auto' }}
              title="Deselect All"
            >
              &times;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Visual Sales Kanban Board View Component
function KanbanView({ leads, onMoveStage, onEdit, onReschedule, onMarkDone, onSetReminder }) {
  const columns = [
    { id: 'New', title: 'New Leads', icon: 'fa-solid fa-star', color: '#4f46e5', bg: '#e0e7ff' },
    { id: 'Contacted', title: 'Contacted & Engaged', icon: 'fa-solid fa-comments', color: '#0284c7', bg: '#e0f2fe' },
    { id: 'Meeting Scheduled', title: 'Meeting Scheduled', icon: 'fa-solid fa-handshake', color: '#10b981', bg: '#d1fae5' },
    { id: 'Qualified', title: 'Qualified Opportunities', icon: 'fa-solid fa-award', color: '#7e22ce', bg: '#f3e8ff' },
    { id: 'Won', title: 'Deals Closed (Won)', icon: 'fa-solid fa-trophy', color: '#059669', bg: '#ecfdf5' },
  ];

  const getLeadsForColumn = (colId) => {
    return leads.filter(l => {
      const st = (l.status || '').toLowerCase().trim();

      if (colId === 'Meeting Scheduled') {
        return st === 'meeting scheduled' || st === 'meeting' || st === 'meetings scheduled';
      } else if (colId === 'New') {
        return st === 'new' || st === '';
      } else if (colId === 'Contacted') {
        return st === 'contacted';
      } else if (colId === 'Qualified') {
        return st === 'qualified';
      } else if (colId === 'Won') {
        return st === 'won';
      }
      return false;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="fa-solid fa-table-columns" style={{ color: '#4f46e5' }}></i> Visual Sales Kanban Pipeline
        </h2>
        <span style={{ fontSize: '13px', color: '#64748b' }}>Move deal cards across pipeline stages</span>
      </div>

      <div className="kanban-board-container">
        {columns.map(col => {
          const colLeads = getLeadsForColumn(col.id);
          return (
            <div key={col.id} className="kanban-column">
              <div className="kanban-column-header">
                <div className="kanban-column-title">
                  <i className={col.icon} style={{ color: col.color }}></i>
                  <span>{col.title}</span>
                </div>
                <span className="kanban-count-badge" style={{ background: col.bg, color: col.color }}>
                  {colLeads.length}
                </span>
              </div>

              <div className="kanban-cards-wrapper">
                {colLeads.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94a3b8', fontSize: '12px', border: '2px dashed #e2e8f0', borderRadius: '12px' }}>
                    No leads in this stage
                  </div>
                ) : (
                  colLeads.map(lead => {
                    const scoreVal = getScoreValue(lead.score_of_client);
                    const scoreDisplay = getScoreDisplay(lead.score_of_client);
                    const scoreClass = scoreVal >= 8 ? 'score-hot' : scoreVal >= 5 ? 'score-warm' : 'score-cold';
                    const scoreIconClass = scoreVal >= 8 ? 'fa-solid fa-fire' : scoreVal >= 5 ? 'fa-solid fa-bolt' : 'fa-solid fa-snowflake';

                    return (
                      <div key={lead._id || lead.id} className="kanban-card">
                        <div className="kanban-card-top">
                          <div>
                            <strong style={{ fontSize: '14px', color: '#0f172a', display: 'block' }}>{lead.company}</strong>
                            <span style={{ fontSize: '11px', color: '#64748b' }}><i className="fa-solid fa-user-tie"></i> {lead.founder || 'N/A'}</span>
                          </div>

                          <select
                            value={lead.status || 'New'}
                            onChange={(e) => onMoveStage(lead._id || lead.id, e.target.value)}
                            className="kanban-move-select"
                            title="Move Lead to Stage"
                          >
                            <option value="New">Move to New</option>
                            <option value="Contacted">Move to Contacted</option>
                            <option value="Meeting Scheduled">Move to Meeting</option>
                            <option value="Qualified">Move to Qualified</option>
                            <option value="Nurture">Move to Nurture</option>
                            <option value="Won">Move to Won</option>
                            <option value="Lost">Move to Lost</option>
                          </select>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                          <span className={`score-badge ${scoreClass}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                            <i className={scoreIconClass}></i> {scoreDisplay}
                          </span>
                          <span style={{ color: '#0284c7', fontWeight: 600 }}>{lead.city || 'Direct'}</span>
                        </div>

                        {lead.follow_up_dates && (
                          <div style={{ fontSize: '11px', color: '#d97706', background: '#fef3c7', padding: '4px 8px', borderRadius: '6px', fontWeight: 700 }}>
                            <i className="fa-solid fa-clock"></i> Follow-up: {lead.follow_up_dates}
                          </div>
                        )}

                        {lead.next_action && (
                          <div style={{ fontSize: '11px', color: '#334155', fontWeight: 600 }}>
                            <i className="fa-solid fa-arrow-right" style={{ color: '#4f46e5' }}></i> {lead.next_action}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                          <button className="icon-btn" style={{ width: '28px', height: '28px', fontSize: '11px', color: '#10b981', borderColor: '#a7f3d0', background: '#ecfdf5' }} onClick={() => onMarkDone(lead)} title="Mark Follow-up Completed">
                            <i className="fa-solid fa-circle-check"></i>
                          </button>
                          <button className="icon-btn" style={{ width: '28px', height: '28px', fontSize: '11px' }} onClick={() => onReschedule(lead)} title="Reschedule Follow-up">
                            <i className="fa-solid fa-calendar-plus" style={{ color: '#4f46e5' }}></i>
                          </button>
                          <button className="icon-btn" style={{ width: '28px', height: '28px', fontSize: '11px', color: '#f59e0b', borderColor: '#fde68a', background: '#fffbeb' }} onClick={() => onSetReminder && onSetReminder(lead)} title="Set Email Reminder">
                            <i className="fa-solid fa-bell"></i>
                          </button>
                          <button className="icon-btn" style={{ width: '28px', height: '28px', fontSize: '11px' }} onClick={() => onEdit(lead)} title="Edit Lead">
                            <i className="fa-solid fa-pen-to-square"></i>
                          </button>
                          {lead.email && (
                            <a href={`mailto:${lead.email}`} className="icon-btn" style={{ width: '28px', height: '28px', fontSize: '11px', textDecoration: 'none' }} title="Email Lead">
                              <i className="fa-solid fa-envelope"></i>
                            </a>
                          )}
                          {getWhatsAppUrl(lead.contact, lead.founder, lead.company) && (
                            <a
                              href={getWhatsAppUrl(lead.contact, lead.founder, lead.company)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="icon-btn"
                              style={{ width: '28px', height: '28px', fontSize: '11px', color: '#25D366', borderColor: '#86efac', background: '#f0fdf4', textDecoration: 'none' }}
                              title="Chat on WhatsApp"
                            >
                              <i className="fa-brands fa-whatsapp"></i>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Analytics Dashboard Helper
function AnalyticsDashboard({ leads }) {
  const [analyticsLeads, setAnalyticsLeads] = useState(leads || []);
  const [subTab, setSubTab] = useState('overview');

  useEffect(() => {
    // Fetch 100% complete real-time leads array directly from MongoDB
    const loadRealtimeAnalytics = async () => {
      try {
        const res = await fetch('/api/leads?tab=all', {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('crm_token') || ''}`
          }
        });
        const data = await res.json();
        if (data.success && data.leads) {
          setAnalyticsLeads(data.leads);
        }
      } catch (err) {
        console.error('Analytics real-time load error:', err);
      }
    };
    loadRealtimeAnalytics();
  }, []);

  const activeLeads = analyticsLeads.length > 0 ? analyticsLeads : leads;
  const total = activeLeads.length || 1;

  // Robust Score Extraction (handles numbers, strings like "8", "8/10", missing scores)
  const getScore = (lead) => {
    let raw = lead.score_of_client;
    if (raw === undefined || raw === null || raw === '') return 5;
    if (typeof raw === 'number') {
      if (raw > 10) return Math.min(Math.max(Math.round(raw / 10), 1), 10);
      return raw;
    }
    const str = String(raw).trim();
    const match = str.match(/\d+/);
    if (!match) return 5;
    let val = parseInt(match[0], 10);
    if (val > 10) val = Math.min(Math.max(Math.round(val / 10), 1), 10);
    return val;
  };

  // Scan across status, new_status, next_action, and notes for Meetings
  const isMeeting = (l) => {
    const st = (l.status || '').toLowerCase().trim();
    const nst = (l.new_status || '').toLowerCase().trim();
    const act = (l.next_action || '').toLowerCase().trim();
    const notes = (l.notes || '').toLowerCase().trim();

    // Explicit user status overrides notes!
    if (st === 'qualified' || nst.includes('qualified') || st === 'won' || nst.includes('won') || st === 'lost' || nst.includes('lost') || st.includes('not interested') || nst.includes('not interested')) {
      return false;
    }
    return st.includes('meeting') || nst.includes('meeting') || act.includes('meeting') || notes.includes('meeting');
  };

  // Scan across status, new_status, and notes for Nurture
  const isNurture = (l) => {
    const st = (l.status || '').toLowerCase().trim();
    const nst = (l.new_status || '').toLowerCase().trim();
    const notes = (l.notes || '').toLowerCase().trim();

    if (st === 'won' || nst.includes('won') || st === 'lost' || nst.includes('lost') || st === 'qualified' || nst.includes('qualified')) {
      return false;
    }
    return st.includes('nurture') || nst.includes('nurture') || st.includes('not interested') || nst.includes('not interested') || notes.includes('not interested');
  };

  const statusCounts = {
    'New': activeLeads.filter(l => (l.status || '').toLowerCase() === 'new').length,
    'Contacted': activeLeads.filter(l => (l.status || '').toLowerCase() === 'contacted').length,
    'Meeting Scheduled': activeLeads.filter(isMeeting).length,
    'Qualified': activeLeads.filter(l => (l.status || '').toLowerCase() === 'qualified').length,
    'Nurture': activeLeads.filter(isNurture).length,
    'Won': activeLeads.filter(l => (l.status || '').toLowerCase() === 'won').length,
  };

  const hotLeads = activeLeads.filter(l => getScore(l) >= 8).length;
  const warmLeads = activeLeads.filter(l => getScore(l) >= 5 && getScore(l) < 8).length;
  const coldLeads = activeLeads.filter(l => getScore(l) < 5).length;

  const hotPct = Math.round((hotLeads / total) * 100);
  const warmPct = Math.round((warmLeads / total) * 100);
  const coldPct = Math.round((coldLeads / total) * 100);

  const totalLeadsCount = activeLeads.length;
  const contactedCount = activeLeads.filter(l => l.status && l.status !== 'New').length;
  const meetingsCount = activeLeads.filter(isMeeting).length;
  const wonCount = statusCounts['Won'];
  const nurtureCount = activeLeads.filter(isNurture).length;

  const dateCountsMap = {};
  activeLeads.forEach(l => {
    const d = l.follow_up_dates || l.reachout_date || l.date_added;
    if (d) {
      const iso = normalizeToISO(d) || d;
      dateCountsMap[iso] = (dateCountsMap[iso] || 0) + 1;
    }
  });

  const sortedDates = Object.entries(dateCountsMap).sort((a, b) => new Date(b[0]) - new Date(a[0]));

  const sourceMap = {};
  const cityMap = {};
  activeLeads.forEach(l => {
    const src = l.source || 'Direct';
    sourceMap[src] = (sourceMap[src] || 0) + 1;

    const city = l.city || 'Unspecified';
    cityMap[city] = (cityMap[city] || 0) + 1;
  });

  const sortedSources = Object.entries(sourceMap).sort((a, b) => b[1] - a[1]);
  const sortedCities = Object.entries(cityMap).sort((a, b) => b[1] - a[1]);

  const sliceColors = {
    'New': '#4f46e5',
    'Contacted': '#0284c7',
    'Meeting Scheduled': '#10b981',
    'Qualified': '#7e22ce',
    'Nurture': '#f59e0b',
    'Won': '#059669',
  };

  let cumulativeAngle = 0;
  const donutSlices = Object.entries(statusCounts).map(([label, count]) => {
    const percentage = count / total;
    const angle = percentage * 360;
    const startAngle = cumulativeAngle;
    cumulativeAngle += angle;
    return { label, count, percentage: Math.round(percentage * 100), startAngle, angle, color: sliceColors[label] || '#94a3b8' };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="analytics-tab-bar">
        <button className={`analytics-tab-btn ${subTab === 'overview' ? 'active' : ''}`} onClick={() => setSubTab('overview')}>
          <i className="fa-solid fa-chart-pie"></i> Executive Overview
        </button>
        <button className={`analytics-tab-btn ${subTab === 'date_wise' ? 'active' : ''}`} onClick={() => setSubTab('date_wise')}>
          <i className="fa-solid fa-calendar-days"></i> Date-Wise Analysis
        </button>
        <button className={`analytics-tab-btn ${subTab === 'lead_wise' ? 'active' : ''}`} onClick={() => setSubTab('lead_wise')}>
          <i className="fa-solid fa-users-viewfinder"></i> Lead & Source Intelligence
        </button>
        <button className={`analytics-tab-btn ${subTab === 'scorecard' ? 'active' : ''}`} onClick={() => setSubTab('scorecard')}>
          <i className="fa-solid fa-square-poll-vertical" style={{ color: '#10b981' }}></i> Weekly Scorecard
        </button>
      </div>

      <div className="analytics-kpi-grid">
        <div className="glass" style={{ padding: '20px', background: '#fff' }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Hot Prospects Ratio</span>
          <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#dc2626', marginTop: '4px' }}>
            <i className="fa-solid fa-fire"></i> {hotPct}%
          </h3>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{hotLeads} High Intent Leads</span>
        </div>

        <div className="glass" style={{ padding: '20px', background: '#fff' }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Meeting Conversion Rate</span>
          <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
            <i className="fa-solid fa-handshake"></i> {Math.round((meetingsCount / total) * 100)}%
          </h3>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{meetingsCount} Meetings Booked</span>
        </div>

        <div className="glass" style={{ padding: '20px', background: '#fff' }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Active Nurture Pipeline</span>
          <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>
            <i className="fa-solid fa-seedling"></i> {nurtureCount}
          </h3>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Auto-Nurtured Prospects</span>
        </div>

        <div className="glass" style={{ padding: '20px', background: '#fff' }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Recorded Dates</span>
          <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#4f46e5', marginTop: '4px' }}>
            <i className="fa-solid fa-calendar"></i> {sortedDates.length}
          </h3>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Distinct Event Dates</span>
        </div>
      </div>

      {subTab === 'scorecard' && (
        <WeeklyScorecard leads={activeLeads} />
      )}

      {subTab === 'overview' && (
        <div className="analytics-grid">
          <div className="chart-card">
            <div className="chart-header">
              <h3><i className="fa-solid fa-chart-pie" style={{ color: '#4f46e5' }}></i> Lead Status Breakdown</h3>
              <span>Distribution by Pipeline Stage</span>
            </div>

            <div className="pie-chart-wrapper">
              <svg width="160" height="160" viewBox="0 0 42 42" style={{ transform: 'rotate(-90deg)', borderRadius: '50%' }}>
                {donutSlices.map((slice, i) => (
                  <circle
                    key={i}
                    cx="21"
                    cy="21"
                    r="15.91549430918954"
                    fill="transparent"
                    stroke={slice.color}
                    strokeWidth="6"
                    strokeDasharray={`${slice.percentage} ${100 - slice.percentage}`}
                    strokeDashoffset={100 - slice.startAngle / 3.6}
                  />
                ))}
                <g style={{ transform: 'rotate(90deg) translate(0px, -42px)' }}>
                  <text x="21" y="20" textAnchor="middle" fontSize="6" fontWeight="800" fill="#0f172a">{totalLeadsCount}</text>
                  <text x="21" y="25" textAnchor="middle" fontSize="3" fontWeight="600" fill="#64748b">LEADS</text>
                </g>
              </svg>

              <div className="pie-legend">
                {donutSlices.map((slice, i) => (
                  <div key={i} className="pie-legend-item">
                    <div>
                      <span className="pie-legend-color" style={{ background: slice.color }}></span>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{slice.label}</span>
                    </div>
                    <strong>{slice.count} ({slice.percentage}%)</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-header">
              <h3><i className="fa-solid fa-chart-bar" style={{ color: '#0284c7' }}></i> Client Score Quality Distribution</h3>
              <span>Score Scale 1 to 10</span>
            </div>

            <div className="bar-chart-container">
              <div className="bar-row">
                <div className="bar-label-group">
                  <span style={{ color: '#dc2626' }}><i className="fa-solid fa-fire"></i> High Priority (Score 8 - 10)</span>
                  <strong>{hotLeads} Leads ({hotPct}%)</strong>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${hotPct}%`, background: '#dc2626' }}></div>
                </div>
              </div>

              <div className="bar-row">
                <div className="bar-label-group">
                  <span style={{ color: '#d97706' }}><i className="fa-solid fa-bolt"></i> Moderate Priority (Score 5 - 7)</span>
                  <strong>{warmLeads} Leads ({warmPct}%)</strong>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${warmPct}%`, background: '#f59e0b' }}></div>
                </div>
              </div>

              <div className="bar-row">
                <div className="bar-label-group">
                  <span style={{ color: '#0284c7' }}><i className="fa-solid fa-snowflake"></i> Low Priority (Score 1 - 4)</span>
                  <strong>{coldLeads} Leads ({coldPct}%)</strong>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${coldPct}%`, background: '#0284c7' }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-header">
              <h3><i className="fa-solid fa-filter" style={{ color: '#10b981' }}></i> Lead Conversion Funnel</h3>
              <span>Pipeline Conversion Velocity</span>
            </div>

            <div className="funnel-container">
              <div className="funnel-step">
                <div className="funnel-step-title"><i className="fa-solid fa-building" style={{ color: '#4f46e5' }}></i> 1. Total Registered Leads</div>
                <span className="funnel-step-val">{totalLeadsCount}</span>
              </div>
              <div className="funnel-step" style={{ marginLeft: '12px' }}>
                <div className="funnel-step-title"><i className="fa-solid fa-comments" style={{ color: '#0284c7' }}></i> 2. Contacted & Engaged</div>
                <span className="funnel-step-val">{contactedCount}</span>
              </div>
              <div className="funnel-step" style={{ marginLeft: '24px' }}>
                <div className="funnel-step-title"><i className="fa-solid fa-handshake" style={{ color: '#10b981' }}></i> 3. Meetings Scheduled</div>
                <span className="funnel-step-val">{meetingsCount}</span>
              </div>
              <div className="funnel-step" style={{ marginLeft: '36px', background: '#ecfdf5', borderColor: '#a7f3d0' }}>
                <div className="funnel-step-title" style={{ color: '#047857' }}><i className="fa-solid fa-trophy" style={{ color: '#059669' }}></i> 4. Deals Closed (Won)</div>
                <span className="funnel-step-val" style={{ color: '#059669' }}>{wonCount}</span>
              </div>
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-header">
              <h3><i className="fa-solid fa-chart-line" style={{ color: '#7e22ce' }}></i> Lead Growth Trendline</h3>
              <span>Acquisition Growth</span>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <svg viewBox="0 0 400 120" style={{ width: '100%', height: '120px', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="gradientTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path d="M 0,90 Q 80,40 160,70 T 320,30 T 400,20 L 400,120 L 0,120 Z" fill="url(#gradientTrend)" />
                <path d="M 0,90 Q 80,40 160,70 T 320,30 T 400,20" fill="none" stroke="#4f46e5" strokeWidth="3" />
                <circle cx="80" cy="50" r="4" fill="#4f46e5" />
                <circle cx="160" cy="70" r="4" fill="#4f46e5" />
                <circle cx="320" cy="30" r="4" fill="#4f46e5" />
                <circle cx="400" cy="20" r="5" fill="#10b981" />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginTop: '8px' }}>
                <span>Week 1</span>
                <span>Week 2</span>
                <span>Week 3</span>
                <span>Today (Peak)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {subTab === 'date_wise' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="chart-card">
            <div className="chart-header">
              <h3><i className="fa-solid fa-calendar-days" style={{ color: '#4f46e5' }}></i> Date-Wise Lead Activity Breakdown</h3>
              <span>Lead Volume & Follow-up Load per Date</span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="leads-table">
                <thead>
                  <tr>
                    <th>Event Date</th>
                    <th>Scheduled Follow-ups</th>
                    <th>Volume Load Share</th>
                    <th>Activity Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDates.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>No date-wise events logged.</td>
                    </tr>
                  ) : (
                    sortedDates.map(([dateVal, count]) => {
                      const sharePct = Math.round((count / total) * 100);
                      const followStatus = getFollowUpStatus(dateVal);
                      return (
                        <tr key={dateVal}>
                          <td style={{ fontWeight: 700, color: '#0f172a' }}>
                            <i className="fa-solid fa-calendar-day" style={{ color: '#4f46e5', marginRight: '6px' }}></i>
                            {dateVal}
                          </td>
                          <td style={{ fontWeight: 800, color: '#4f46e5' }}>{count} Leads</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div className="bar-track" style={{ flex: 1, height: '8px' }}>
                                <div className="bar-fill" style={{ width: `${Math.max(sharePct, 15)}%`, background: '#4f46e5' }}></div>
                              </div>
                              <span style={{ fontSize: '11px', fontWeight: 600 }}>{sharePct}%</span>
                            </div>
                          </td>
                          <td>
                            {followStatus ? (
                              <span className={followStatus.pillClass}><i className={followStatus.icon}></i> {followStatus.label}</span>
                            ) : (
                              <span className="pill-upcoming">Scheduled</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {subTab === 'lead_wise' && (
        <div className="analytics-grid">
          <div className="chart-card">
            <div className="chart-header">
              <h3><i className="fa-solid fa-paper-plane" style={{ color: '#0284c7' }}></i> Acquisition Source Performance</h3>
              <span>Distribution by Channel</span>
            </div>
            <div className="bar-chart-container">
              {sortedSources.map(([src, count]) => {
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={src} className="bar-row">
                    <div className="bar-label-group">
                      <span><i className="fa-solid fa-bullseye" style={{ color: '#0284c7' }}></i> {src}</span>
                      <strong>{count} Leads ({pct}%)</strong>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${Math.max(pct, 10)}%`, background: '#0284c7' }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-header">
              <h3><i className="fa-solid fa-location-dot" style={{ color: '#10b981' }}></i> Top Geographical Cities</h3>
              <span>Leads Location Spread</span>
            </div>
            <div className="bar-chart-container">
              {sortedCities.map(([city, count]) => {
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={city} className="bar-row">
                    <div className="bar-label-group">
                      <span><i className="fa-solid fa-city" style={{ color: '#10b981' }}></i> {city}</span>
                      <strong>{count} Leads ({pct}%)</strong>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${Math.max(pct, 10)}%`, background: '#10b981' }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Weekly Sales Scorecard Component
function WeeklyScorecard({ leads }) {
  const [scorecardLeads, setScorecardLeads] = useState(leads || []);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState('0');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  useEffect(() => {
    const loadRealtimeData = async () => {
      try {
        const res = await fetch('/api/leads?tab=all', {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('crm_token') || ''}`
          }
        });
        const data = await res.json();
        if (data.success && data.leads) {
          setScorecardLeads(data.leads);
        }
      } catch (err) {
        console.error('Scorecard load error:', err);
      }
    };
    loadRealtimeData();
  }, []);

  const activeLeads = scorecardLeads.length > 0 ? scorecardLeads : leads;

  // Helper: Generate past 8 week ranges (Monday to Sunday)
  const getWeekOptions = () => {
    const weeks = [];
    const now = new Date();
    const currentMonday = new Date(now);
    const dayOfWeek = currentMonday.getDay();
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    currentMonday.setDate(currentMonday.getDate() + distanceToMonday);
    currentMonday.setHours(0, 0, 0, 0);

    for (let i = 0; i < 8; i++) {
      const start = new Date(currentMonday);
      start.setDate(start.getDate() - i * 7);

      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      const startStr = `${String(start.getDate()).padStart(2, '0')}/${String(start.getMonth() + 1).padStart(2, '0')}/${start.getFullYear()}`;
      const endStr = `${String(end.getDate()).padStart(2, '0')}/${String(end.getMonth() + 1).padStart(2, '0')}/${end.getFullYear()}`;

      const label = i === 0 ? `Current Week (${startStr} - ${endStr})` :
                    i === 1 ? `Last Week (${startStr} - ${endStr})` :
                    `Week -${i} (${startStr} - ${endStr})`;

      weeks.push({ index: String(i), start, end, startStr, endStr, label });
    }
    return weeks;
  };

  const weekOptions = getWeekOptions();

  const getActiveWeekRange = () => {
    if (selectedWeekIndex === 'custom' && customStartDate && customEndDate) {
      const s = new Date(customStartDate);
      s.setHours(0, 0, 0, 0);
      const e = new Date(customEndDate);
      e.setHours(23, 59, 59, 999);

      const startStr = `${String(s.getDate()).padStart(2, '0')}/${String(s.getMonth() + 1).padStart(2, '0')}/${s.getFullYear()}`;
      const endStr = `${String(e.getDate()).padStart(2, '0')}/${String(e.getMonth() + 1).padStart(2, '0')}/${e.getFullYear()}`;

      return { start: s, end: e, startStr, endStr, label: `Custom Range (${startStr} - ${endStr})` };
    }
    const idx = parseInt(selectedWeekIndex, 10);
    return weekOptions[isNaN(idx) ? 0 : idx] || weekOptions[0];
  };

  const activeWeek = getActiveWeekRange();

  const parseLeadDate = (dateVal) => {
    if (!dateVal) return null;
    const str = String(dateVal).trim();
    const dmy = str.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})/);
    if (dmy) {
      return new Date(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10));
    }
    const ymd = str.match(/^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})/);
    if (ymd) {
      return new Date(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10));
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  };

  const weekLeads = activeLeads.filter(l => {
    const dAdded = parseLeadDate(l.date_added);
    const dFollow = parseLeadDate(l.follow_up_dates);
    const dReach = parseLeadDate(l.reachout_date);

    const checkRange = (d) => d && d >= activeWeek.start && d <= activeWeek.end;
    return checkRange(dAdded) || checkRange(dFollow) || checkRange(dReach);
  });

  const leadsAdded = activeLeads.filter(l => {
    const d = parseLeadDate(l.date_added);
    return d && d >= activeWeek.start && d <= activeWeek.end;
  }).length;

  const meetingsBooked = activeLeads.filter(l => {
    const st = (l.status || '').toLowerCase();
    const nst = (l.new_status || '').toLowerCase();
    const act = (l.next_action || '').toLowerCase();
    const notes = (l.notes || '').toLowerCase();
    const isM = st.includes('meeting') || nst.includes('meeting') || act.includes('meeting') || notes.includes('meeting');
    const d = parseLeadDate(l.follow_up_dates || l.reachout_date || l.date_added);
    return isM && d && d >= activeWeek.start && d <= activeWeek.end;
  }).length;

  const contactedLeads = activeLeads.filter(l => {
    const st = (l.status || '').toLowerCase();
    const isEngaged = st !== 'new' && st !== '';
    const d = parseLeadDate(l.reachout_date || l.date_added);
    return isEngaged && d && d >= activeWeek.start && d <= activeWeek.end;
  }).length;

  const dealsWon = activeLeads.filter(l => {
    const st = (l.status || '').toLowerCase();
    const d = parseLeadDate(l.date_added || l.follow_up_dates);
    return st === 'won' && d && d >= activeWeek.start && d <= activeWeek.end;
  }).length;

  const hotLeadsAdded = activeLeads.filter(l => {
    let raw = l.score_of_client;
    let score = 5;
    if (typeof raw === 'number') score = raw;
    else if (raw) {
      const match = String(raw).match(/\d+/);
      if (match) score = parseInt(match[0], 10);
    }
    const d = parseLeadDate(l.date_added);
    return score >= 8 && d && d >= activeWeek.start && d <= activeWeek.end;
  }).length;

  const scoreLeadsPart = Math.min(Math.round((leadsAdded / 10) * 30), 30);
  const scoreContactedPart = Math.min(Math.round((contactedLeads / 10) * 30), 30);
  const scoreMeetingsPart = Math.min(Math.round((meetingsBooked / 3) * 30), 30);
  const scoreHotPart = Math.min(Math.round((hotLeadsAdded / 2) * 10), 10);

  const totalWeeklyScore = Math.min(scoreLeadsPart + scoreContactedPart + scoreMeetingsPart + scoreHotPart, 100);

  let grade = 'B';
  let gradeColor = '#6366f1';
  let gradeLabel = 'Good Progress';
  if (totalWeeklyScore >= 90) { grade = 'A+'; gradeColor = '#10b981'; gradeLabel = 'Exceptional Sales Week'; }
  else if (totalWeeklyScore >= 75) { grade = 'A'; gradeColor = '#059669'; gradeLabel = 'High Performing Week'; }
  else if (totalWeeklyScore >= 60) { grade = 'B'; gradeColor = '#6366f1'; gradeLabel = 'On Track / Steady'; }
  else if (totalWeeklyScore >= 40) { grade = 'C'; gradeColor = '#f59e0b'; gradeLabel = 'Needs Outreach Boost'; }
  else { grade = 'D'; gradeColor = '#ef4444'; gradeLabel = 'Below Weekly Target'; }

  const agentMap = {};
  weekLeads.forEach(l => {
    const agent = l.assigned_to || 'Sales Team';
    if (!agentMap[agent]) {
      agentMap[agent] = { leadsAdded: 0, meetings: 0, contacted: 0, dealsWon: 0 };
    }
    const dAdded = parseLeadDate(l.date_added);
    if (dAdded && dAdded >= activeWeek.start && dAdded <= activeWeek.end) {
      agentMap[agent].leadsAdded++;
    }
    const st = (l.status || '').toLowerCase();
    const nst = (l.new_status || '').toLowerCase();
    const act = (l.next_action || '').toLowerCase();
    if (st.includes('meeting') || nst.includes('meeting') || act.includes('meeting')) {
      agentMap[agent].meetings++;
    }
    if (st !== 'new' && st !== '') {
      agentMap[agent].contacted++;
    }
    if (st === 'won') {
      agentMap[agent].dealsWon++;
    }
  });

  const agentRows = Object.entries(agentMap);

  const handleExportScorecardCSV = () => {
    let csvStr = `WEEKLY SALES SCORECARD REPORT\n`;
    csvStr += `Week Range,${activeWeek.startStr} to ${activeWeek.endStr}\n`;
    csvStr += `Weekly Performance Grade,${grade} (${totalWeeklyScore}/100 - ${gradeLabel})\n\n`;

    csvStr += `METRIC,ACTUAL VALUE,TARGET,COMPLETION RATE (%)\n`;
    csvStr += `New Leads Acquired,${leadsAdded},10,${Math.round((leadsAdded / 10) * 100)}%\n`;
    csvStr += `Contacted / Engaged Leads,${contactedLeads},10,${Math.round((contactedLeads / 10) * 100)}%\n`;
    csvStr += `Meetings Booked,${meetingsBooked},3,${Math.round((meetingsBooked / 3) * 100)}%\n`;
    csvStr += `Hot Intent Prospects (Score 8-10),${hotLeadsAdded},2,${Math.round((hotLeadsAdded / 2) * 100)}%\n`;
    csvStr += `Deals Closed (Won),${dealsWon},1,${dealsWon > 0 ? 100 : 0}%\n\n`;

    csvStr += `AGENT / SALES REP PERFORMANCE MATRIX\n`;
    csvStr += `Agent Name,Leads Added,Contacted,Meetings Booked,Deals Won\n`;
    agentRows.forEach(([agentName, stats]) => {
      csvStr += `"${agentName}",${stats.leadsAdded},${stats.contacted},${stats.meetings},${stats.dealsWon}\n`;
    });

    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Weekly_Sales_Scorecard_${activeWeek.startStr.replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header & Controls */}
      <div className="scorecard-header-wrapper" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa-solid fa-square-poll-vertical" style={{ color: '#10b981' }}></i>
            Weekly Sales Scorecard
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            Track weekly activity, team performance, meeting velocity, and target achievements.
          </p>
        </div>

        <div className="scorecard-controls">
          {/* Week Selector Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '8px 14px', borderRadius: '12px' }}>
            <i className="fa-solid fa-calendar-week" style={{ color: '#6366f1' }}></i>
            <select
              value={selectedWeekIndex}
              onChange={(e) => setSelectedWeekIndex(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer', color: 'inherit' }}
            >
              {weekOptions.map((opt) => (
                <option key={opt.index} value={opt.index}>{opt.label}</option>
              ))}
              <option value="custom">📅 Custom Date Range...</option>
            </select>
          </div>

          {/* Custom Date Range Picker Inputs */}
          {selectedWeekIndex === 'custom' && (
            <div className="custom-date-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '10px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>From:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', fontWeight: 700, color: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '10px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>To:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', fontWeight: 700, color: 'inherit' }}
                />
              </div>
            </div>
          )}

          <button
            className="btn btn-outline"
            onClick={handleExportScorecardCSV}
            title="Download Weekly Scorecard Report"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
          >
            <i className="fa-solid fa-file-arrow-down" style={{ color: '#10b981' }}></i>
            <span>Export Scorecard</span>
          </button>
        </div>
      </div>

      {/* Grade Banner & Target Score Dial */}
      <div className="scorecard-banner">
        <div className="scorecard-banner-left">
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: gradeColor, color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', flexShrink: 0 }}>
            <span style={{ fontSize: '28px', fontWeight: 900, lineHeight: 1 }}>{grade}</span>
            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', opacity: 0.9 }}>GRADE</span>
          </div>
          <div>
            <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: gradeColor }}>{gradeLabel}</span>
            <h3 style={{ margin: '4px 0 2px 0', fontSize: '20px', fontWeight: 800 }}>Weekly Target Completion: {totalWeeklyScore}/100</h3>
            <p style={{ margin: 0, fontSize: '13px', opacity: 0.8 }}>Week Range: <strong>{activeWeek.startStr}</strong> to <strong>{activeWeek.endStr}</strong></p>
          </div>
        </div>

        <div className="scorecard-banner-right">
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>LEADS TARGET</span>
            <div style={{ fontSize: '18px', fontWeight: 800, color: leadsAdded >= 10 ? '#10b981' : '#f59e0b' }}>
              {leadsAdded} / 10
            </div>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>MEETINGS TARGET</span>
            <div style={{ fontSize: '18px', fontWeight: 800, color: meetingsBooked >= 3 ? '#10b981' : '#6366f1' }}>
              {meetingsBooked} / 3
            </div>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>HOT PROSPECTS</span>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#dc2626' }}>
              {hotLeadsAdded} / 2
            </div>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="analytics-kpi-grid">
        <div className="glass" style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Weekly Leads Acquired</span>
          <h3 style={{ fontSize: '26px', fontWeight: 800, color: '#6366f1', marginTop: '4px' }}>
            <i className="fa-solid fa-user-plus"></i> {leadsAdded}
          </h3>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Target: 10 new prospects/week</span>
        </div>

        <div className="glass" style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Leads Contacted / Engaged</span>
          <h3 style={{ fontSize: '26px', fontWeight: 800, color: '#0284c7', marginTop: '4px' }}>
            <i className="fa-solid fa-comments"></i> {contactedLeads}
          </h3>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Active outreach completed</span>
        </div>

        <div className="glass" style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Meetings Booked</span>
          <h3 style={{ fontSize: '26px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
            <i className="fa-solid fa-handshake"></i> {meetingsBooked}
          </h3>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Target: 3 booked meetings/week</span>
        </div>

        <div className="glass" style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Deals Won / Closed</span>
          <h3 style={{ fontSize: '26px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
            <i className="fa-solid fa-trophy"></i> {dealsWon}
          </h3>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Closed revenue deals</span>
        </div>
      </div>

      {/* Agent Performance Matrix Table */}
      <div className="chart-card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
              <i className="fa-solid fa-users-gear" style={{ color: '#6366f1', marginRight: '8px' }}></i>
              Sales Rep & Agent Performance Matrix
            </h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Weekly activity breakdown by team member</span>
          </div>
        </div>

        <div className="scorecard-table-responsive">
          <table className="leads-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Sales Rep / Agent</th>
                <th style={{ textAlign: 'center' }}>Leads Added</th>
                <th style={{ textAlign: 'center' }}>Contacted</th>
                <th style={{ textAlign: 'center' }}>Meetings Booked</th>
                <th style={{ textAlign: 'center' }}>Deals Won</th>
              </tr>
            </thead>
            <tbody>
              {agentRows.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                    No rep activity recorded for this week.
                  </td>
                </tr>
              ) : (
                agentRows.map(([agentName, stats]) => (
                  <tr key={agentName}>
                    <td style={{ fontWeight: 700 }}>
                      <i className="fa-solid fa-user-tie" style={{ marginRight: '8px', color: '#6366f1' }}></i>
                      {agentName}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#6366f1' }}>{stats.leadsAdded}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#0284c7' }}>{stats.contacted}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#10b981' }}>{stats.meetings}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#059669' }}>{stats.dealsWon}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
