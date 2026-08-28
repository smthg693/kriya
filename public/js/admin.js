// Gram Swaraj Admin Dashboard Client JS Engine

// Initialize Socket.IO Client
const socket = io({ auth: { token: localStorage.getItem('gram_token') || '' } });

let reportsData = [];
let applicationsData = [];
let citizensData = [];
let currentAdminLang = localStorage.getItem('gram_lang') || 'en';
let adminToken = localStorage.getItem('gram_token') || null;

function adminHeaders(headers = {}) {
  return { ...headers, ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}) };
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!await ensureAdminAuth()) return;
  setupAdminLanguage();
  loadAdminStats();
  loadReports();
  loadApplications();
  loadCitizens();
  setupSocketListeners();
  setupFilterListeners();
  setupStatusModal();
  setupDashboardControls();
  markDashboardSynced();
  document.getElementById('admin-citizen-portal-link')?.addEventListener('click', () => {
    localStorage.removeItem('gram_token');
    localStorage.removeItem('gram_user');
  });
});

function setupDashboardControls() {
  const refreshButton = document.getElementById('admin-refresh-btn');
  if (!refreshButton) return;
  refreshButton.addEventListener('click', async () => {
    refreshButton.disabled = true;
    refreshButton.classList.add('opacity-60');
    await Promise.all([loadAdminStats(), loadReports(), loadApplications(), loadCitizens()]);
    markDashboardSynced();
    refreshButton.disabled = false;
    refreshButton.classList.remove('opacity-60');
  });
}

function markDashboardSynced() {
  const status = document.getElementById('admin-sync-status');
  if (status) status.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

async function ensureAdminAuth() {
  if (adminToken) {
    try {
      const response = await fetch('/api/auth/me', { headers: adminHeaders() });
      const data = await response.json();
      if (data.success && data.user?.role === 'admin') {
        document.getElementById('admin-auth-modal').classList.add('hidden');
        return true;
      }
    } catch (error) {}
  }
  localStorage.removeItem('gram_token');
  localStorage.removeItem('gram_user');
  document.getElementById('admin-login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorElement = document.getElementById('admin-login-error');
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loginId: document.getElementById('admin-login-id').value.trim(), password: document.getElementById('admin-login-password').value }) });
      const data = await response.json();
      if (!data.success || data.user?.role !== 'admin') throw new Error('Admin credentials required.');
      localStorage.setItem('gram_token', data.token);
      localStorage.setItem('gram_user', JSON.stringify(data.user));
      window.location.reload();
    } catch (error) {
      errorElement.textContent = error.message;
      errorElement.classList.remove('hidden');
    }
  });
  document.getElementById('admin-back-btn').addEventListener('click', () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = '/';
  });
  return false;
}

function setupAdminLanguage() {
  const btn = document.getElementById('admin-lang-toggle-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      currentAdminLang = currentAdminLang === 'en' ? 'hi' : 'en';
      localStorage.setItem('gram_lang', currentAdminLang);
      updateAdminLanguageUI();
    });
  }
  updateAdminLanguageUI();
}

function updateAdminLanguageUI() {
  const lbl = document.getElementById('admin-lang-label');
  const portalLbl = document.getElementById('admin-lbl-portal');
  const logoutLbl = document.getElementById('admin-lbl-logout');

  if (lbl) lbl.textContent = currentAdminLang === 'en' ? 'हिंदी' : 'English';
  if (portalLbl) portalLbl.textContent = currentAdminLang === 'en' ? 'Citizen Portal' : 'नागरिक पोर्टल';
  if (logoutLbl) logoutLbl.textContent = currentAdminLang === 'en' ? 'Logout' : 'लॉग आउट';
}

// HTML Escaping Utility for XSS Security
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Toast System with Deduplication & Max Stack Limit
let recentAdminToasts = new Set();

function showToast(message, type = 'info') {
  if (recentAdminToasts.has(message)) return;
  recentAdminToasts.add(message);
  setTimeout(() => recentAdminToasts.delete(message), 3000);

  const container = document.getElementById('toast-container');
  if (!container) return;

  while (container.children.length >= 3) {
    container.removeChild(container.firstChild);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast-error' : (type === 'warning' ? 'toast-warning' : '')}`;
  toast.innerHTML = `
    <span class="material-symbols-outlined text-secondary">notifications_active</span>
    <div class="text-xs font-semibold text-gray-800">${escapeHTML(message)}</div>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4500);
}

// WebSockets Real-Time Listeners
function setupSocketListeners() {
  socket.on('citizen_registered', (newCitizen) => {
    if (!newCitizen || newCitizen.role !== 'user') return;
    showToast(`New citizen registered: ${newCitizen.name || newCitizen.username}`);
    loadAdminStats();
    loadCitizens();
  });

  socket.on('report_created', (newReport) => {
    showToast(`⚡ NEW REPORT: ${newReport.id} (${newReport.category}) in ${newReport.location}`, newReport.priority === 'Critical' ? 'warning' : 'info');
    loadAdminStats();
    loadReports();
  });

  socket.on('application_submitted', (newApp) => {
    showToast(`📝 NEW APPLICATION: ${newApp.id} for "${newApp.scheme_type}" from ${newApp.citizen_name}`);
    loadAdminStats();
    loadApplications();
  });
}

// Admin Tab Switching
function switchAdminTab(tabId) {
  document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.add('hidden'));
  document.getElementById(tabId).classList.remove('hidden');

  // Update tab button styles
  const btnReports = document.getElementById('admin-tab-btn-reports');
  const btnApps = document.getElementById('admin-tab-btn-apps');
  const btnCitizens = document.getElementById('admin-tab-btn-citizens');

  [btnReports, btnApps, btnCitizens].forEach(btn => {
    btn.className = "px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-all flex items-center gap-2";
  });

  if (tabId === 'tab-reports-mgmt') {
    btnReports.className = "px-4 py-2 rounded-xl text-sm font-bold bg-primary text-white transition-all flex items-center gap-2";
  } else if (tabId === 'tab-apps-mgmt') {
    btnApps.className = "px-4 py-2 rounded-xl text-sm font-bold bg-primary text-white transition-all flex items-center gap-2";
  } else {
    btnCitizens.className = "px-4 py-2 rounded-xl text-sm font-bold bg-primary text-white transition-all flex items-center gap-2";
  }
}

// Load Stats
async function loadAdminStats() {
  try {
    const res = await fetch('/api/stats', { headers: adminHeaders() });
    const stats = await res.json();
    document.getElementById('stat-active-reports').textContent = stats.activeReports;
    document.getElementById('stat-critical-emergencies').textContent = stats.criticalEmergencies;
    document.getElementById('stat-resolved-reports').textContent = stats.resolvedThisMonth;
    document.getElementById('stat-total-citizens').textContent = stats.totalCitizens;
    document.getElementById('stat-pending-apps').textContent = stats.pendingApplications;
  } catch (err) {
    console.error("Error loading admin stats:", err);
  }
}

// Load & Render Reports
async function loadReports() {
  try {
    const res = await fetch('/api/reports', { headers: adminHeaders() });
    if (!res.ok) throw new Error('Could not load reports');
    reportsData = await res.json();
    if (!Array.isArray(reportsData)) throw new Error('Invalid reports response');
    renderReportsTable();
  } catch (err) {
    console.error("Error loading reports:", err);
  }
}

function renderReportsTable() {
  const tbody = document.getElementById('admin-reports-tbody');
  const statusFilter = document.getElementById('filter-status').value;
  const categoryFilter = document.getElementById('filter-category').value;
  const searchQuery = document.getElementById('search-reports-input').value.toLowerCase();

  const filtered = reportsData.filter(rep => {
    const matchStatus = statusFilter === 'All' || rep.status === statusFilter;
    const matchCategory = categoryFilter === 'All' || rep.category === categoryFilter;
    const matchSearch = rep.id.toLowerCase().includes(searchQuery) ||
                        rep.location.toLowerCase().includes(searchQuery) ||
                        rep.description.toLowerCase().includes(searchQuery) ||
                        rep.citizen_name.toLowerCase().includes(searchQuery);
    return matchStatus && matchCategory && matchSearch;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-xs text-gray-500 italic">No issue reports match your search criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(rep => `
    <tr class="hover:bg-gray-50 transition-colors">
      <td class="py-3 px-4 font-bold text-gray-900">${escapeHTML(rep.id)}</td>
      <td class="py-3 px-4 text-xs font-semibold text-gray-700">${escapeHTML(rep.citizen_name)}</td>
      <td class="py-3 px-4 text-xs font-medium text-gray-600">${escapeHTML(rep.category)}</td>
      <td class="py-3 px-4 text-xs text-gray-600">${escapeHTML(rep.location)}</td>
      <td class="py-3 px-4 text-xs text-gray-600 max-w-xs truncate" title="${escapeHTML(rep.description)}">${escapeHTML(rep.description)}</td>
      <td class="py-3 px-4">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${rep.priority === 'Critical' ? 'bg-red-600 text-white animate-pulse' : (rep.priority === 'High' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-700')}">
          ${escapeHTML(rep.priority)}
        </span>
      </td>
      <td class="py-3 px-4 whitespace-nowrap">
        <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
          rep.status === 'Resolved' ? 'bg-green-100 text-green-800' :
          rep.status === 'In Progress' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'
        }">${escapeHTML(rep.status)}</span>
      </td>
      <td class="py-3 px-4 text-right">
        <button onclick="openStatusModal('${rep.id}', '${rep.category}', '${rep.location}', '${rep.status}', '${escapeHTML(rep.admin_notes || '')}')" class="px-3 py-1 bg-primary text-white font-semibold text-xs rounded-lg hover:bg-primary-container transition-all">
          Manage
        </button>
      </td>
    </tr>
  `).join('');
}

function setupFilterListeners() {
  document.getElementById('filter-status').addEventListener('change', renderReportsTable);
  document.getElementById('filter-category').addEventListener('change', renderReportsTable);
  document.getElementById('search-reports-input').addEventListener('input', renderReportsTable);
}

// Load & Render Applications
async function loadApplications() {
  try {
    const res = await fetch('/api/applications', { headers: adminHeaders() });
    if (!res.ok) throw new Error('Could not load applications');
    applicationsData = await res.json();
    if (!Array.isArray(applicationsData)) throw new Error('Invalid applications response');
    renderApplicationsTable();
  } catch (err) {
    console.error("Error loading applications:", err);
  }
}

function renderApplicationsTable() {
  const tbody = document.getElementById('admin-apps-tbody');
  if (applicationsData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-xs text-gray-500 italic">No scheme applications pending.</td></tr>`;
    return;
  }

  tbody.innerHTML = applicationsData.map(app => `
    <tr class="hover:bg-gray-50 transition-colors">
      <td class="py-3 px-4 font-bold text-gray-900">${escapeHTML(app.id)}</td>
      <td class="py-3 px-4 text-xs font-semibold text-gray-700">${escapeHTML(app.citizen_name)}</td>
      <td class="py-3 px-4 text-xs font-bold text-primary">${escapeHTML(app.scheme_type)}</td>
      <td class="py-3 px-4 whitespace-nowrap">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold whitespace-nowrap bg-primary/10 text-primary">${escapeHTML(app.status)}</span>
      </td>
      <td class="py-3 px-4 text-xs font-semibold text-gray-700 whitespace-nowrap">${app.progress_pct}%</td>
      <td class="py-3 px-4 text-right whitespace-nowrap">
        <div class="flex justify-end gap-2">
        <button onclick="updateAppProgress('${app.id}', 'In Progress', 50)" class="px-2.5 py-1 bg-amber-500 text-white font-semibold text-xs rounded-lg hover:bg-amber-600 transition-all">
          Verify 50%
        </button>
        <button onclick="updateAppProgress('${app.id}', 'Approved', 100)" class="px-2.5 py-1 bg-emerald-600 text-white font-semibold text-xs rounded-lg hover:bg-emerald-700 transition-all">
          Approve 100%
        </button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function updateAppProgress(id, status, progressPct) {
  try {
    const res = await fetch(`/api/applications/${encodeURIComponent(id)}/status`, {
      method: 'PUT',
      headers: adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status, progress_pct: progressPct, admin_notes: `Processed by Secretary on ${new Date().toLocaleDateString()}` })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Updated ${id} status to "${status}" (${progressPct}%)`);
      loadAdminStats();
      loadApplications();
    }
  } catch (err) {
    showToast('Failed to update application.', 'error');
  }
}

// Load & Render Citizens Directory
async function loadCitizens() {
  try {
    const res = await fetch('/api/citizens', { headers: adminHeaders() });
    if (!res.ok) throw new Error('Could not load citizens');
    const citizensPayload = await res.json();
    citizensData = Array.isArray(citizensPayload) ? citizensPayload : citizensPayload.users;
    if (!Array.isArray(citizensData)) throw new Error('Invalid citizens response');
    renderCitizensGrid();
  } catch (err) {
    console.error("Error loading citizens:", err);
  }
}

function getInitialAvatarHtml(name, sizeClasses = 'w-10 h-10 text-sm') {
  if (!name || typeof name !== 'string') name = 'Citizen User';
  const cleanName = name.trim();
  const parts = cleanName.split(/\s+/);
  let initials = '';
  if (parts.length >= 2) {
    initials = (parts[0][0] + parts[1][0]).toUpperCase();
  } else if (parts.length === 1 && parts[0].length > 0) {
    initials = parts[0].substring(0, Math.min(2, parts[0].length)).toUpperCase();
  } else {
    initials = 'CU';
  }

  const colors = [
    { bg: '#064e3b', text: '#ffffff' }, // Deep Emerald
    { bg: '#0369a1', text: '#ffffff' }, // Ocean Teal
    { bg: '#6b21a8', text: '#ffffff' }, // Rich Purple
    { bg: '#c2410c', text: '#ffffff' }, // Burnt Amber
    { bg: '#0f766e', text: '#ffffff' }, // Deep Mint
    { bg: '#b91c1c', text: '#ffffff' }, // Crimson Red
    { bg: '#4d7c0f', text: '#ffffff' }, // Forest Green
    { bg: '#1d4ed8', text: '#ffffff' }, // Cobalt Blue
  ];

  let hash = 0;
  for (let i = 0; i < cleanName.length; i++) {
    hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const chosenColor = colors[Math.abs(hash) % colors.length];

  return `
    <div class="${sizeClasses} rounded-full flex items-center justify-center font-bold tracking-wider shrink-0 shadow-md select-none border-2 border-white/40" style="background-color: ${chosenColor.bg}; color: ${chosenColor.text}; font-family: 'Plus Jakarta Sans', sans-serif;">
      <span>${initials}</span>
    </div>
  `;
}

function renderCitizensGrid() {
  const grid = document.getElementById('citizens-cards-grid');
  grid.innerHTML = citizensData.map(c => `
    <div class="bg-gray-50 border border-outline-variant p-4 rounded-2xl flex items-center gap-3">
      ${getInitialAvatarHtml(c.name || c.username || 'Citizen', 'w-11 h-11 text-sm')}
      <div>
        <h4 class="font-bold text-sm text-gray-900">${escapeHTML(c.name || c.username || 'Unnamed Citizen')}</h4>
        <p class="text-xs text-gray-500">ID: ${escapeHTML(c.id)} • ${escapeHTML(c.mobile || c.email || c.username || 'No contact details')}</p>
        <div class="mt-1 flex items-center gap-1">
          <span class="w-2 h-2 rounded-full ${c.disabled ? 'bg-red-500' : 'bg-emerald-500'}"></span>
          <span class="text-[10px] font-semibold ${c.disabled ? 'text-red-700' : 'text-emerald-700'} uppercase">${c.disabled ? 'Account Disabled' : 'Aadhaar Verified'}</span>
        </div>
      </div>
    </div>
  `).join('');
}

// Status Update Modal Logic
function setupStatusModal() {
  const modal = document.getElementById('status-modal');
  const closeBtn = document.getElementById('status-modal-close');
  const form = document.getElementById('update-status-form');

  closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('modal-target-id').value;
    const status = document.getElementById('modal-status-select').value;
    const admin_notes = document.getElementById('modal-notes-input').value;

    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(id)}/status`, {
        method: 'PUT',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status, admin_notes })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Report ${id} status updated to "${status}"`);
        modal.classList.add('hidden');
        loadAdminStats();
        loadReports();
      }
    } catch (err) {
      showToast('Error updating status.', 'error');
    }
  });

  const logoutBtn = document.getElementById('admin-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (adminToken) {
        try {
          await fetch('/api/auth/logout', { method: 'POST', headers: adminHeaders() });
        } catch (error) {}
      }
      localStorage.removeItem('gram_user');
      localStorage.removeItem('gram_token');
      adminToken = null;
      showToast('Admin logged out.');
      setTimeout(() => window.location.href = '/', 600);
    });
  }
}

function openStatusModal(id, category, location, currentStatus, notes) {
  document.getElementById('modal-target-id').value = id;
  document.getElementById('modal-report-id').textContent = `Manage Report ${id}`;
  document.getElementById('modal-report-desc').textContent = `${category} • ${location}`;
  document.getElementById('modal-status-select').value = currentStatus;
  document.getElementById('modal-notes-input').value = notes || '';
  document.getElementById('status-modal').classList.remove('hidden');
}
