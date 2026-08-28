// Gram Sahayak Citizen Portal Client JS Engine

// Initialize Socket.IO Client
const socket = io({ auth: { token: localStorage.getItem('gram_token') || '' } });

// Application State
let currentLang = localStorage.getItem('gram_lang') || 'en'; // 'en' or 'hi'
let currentToken = localStorage.getItem('gram_token') || null;
let currentUser = null;
try {
  currentUser = JSON.parse(localStorage.getItem('gram_user')) || null;
} catch (error) {
  localStorage.removeItem('gram_user');
}

// Never reuse an admin session in the citizen portal.
if (currentUser?.role === 'admin') {
  currentToken = null;
  currentUser = null;
  localStorage.removeItem('gram_token');
  localStorage.removeItem('gram_user');
}

function authHeaders(headers = {}) {
  return { ...headers, ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}) };
}

// HTML Escaping Utility for XSS Prevention
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Rich Text Formatting Utility (Converts Markdown asterisks and linebreaks to clean HTML)
function formatRichText(rawText) {
  if (!rawText) return '';
  let text = escapeHTML(rawText);

  // Re-enable clean bold formatting from <b> tags or ** asterisks
  text = text.replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/gi, '<b>$1</b>');
  text = text.replace(/&lt;strong&gt;(.*?)&lt;\/strong&gt;/gi, '<strong>$1</strong>');
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
  text = text.replace(/\n/g, '<br/>');

  return text;
}

// Toast System with Deduplication & Max Stack Limit
let recentToasts = new Set();

function showToast(message, type = 'info') {
  if (recentToasts.has(message)) return;
  recentToasts.add(message);
  setTimeout(() => recentToasts.delete(message), 3000);

  const container = document.getElementById('toast-container');
  if (!container) return;

  while (container.children.length >= 3) {
    container.removeChild(container.firstChild);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast-error' : ''}`;
  toast.innerHTML = `
    <span class="material-symbols-outlined text-primary">info</span>
    <div class="text-xs font-semibold text-gray-800">${escapeHTML(message)}</div>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// Universal Language Dictionary (English & Hindi)
const translations = {
  en: {
    langBtn: 'English',
    headerSub: 'Gram Panchayat Digital Services Portal',
    welcomeBadge: 'Official Panchayat Portal',
    greeting: 'Namaste, {name}!',
    subtext: 'How can Gram Sahayak assist you today in Gram Panchayat?',
    btnVoice: 'Start Voice Chat',
    btnReport: 'Report a Problem',
    quickActionsTitle: 'Popular Services',
    catLand: 'Land Records (Bhulekh)',
    catPension: 'Pension Schemes',
    catCert: 'Certificates',
    catComplaint: 'File Complaint',
    annTitleHeader: 'Panchayat Update',
    annHeading: 'PM-Kisan Installment Update',
    annBody: 'The next installment of PM-Kisan Samman Nidhi will be credited soon. Ensure your e-KYC is updated.',
    svcTitle: 'Services Directory',
    svcSubtitle: 'Browse and apply for village services and central schemes.',
    svcGroup1: 'Personal Documents',
    svcGroup2: 'Agriculture & Land',
    svcGroup3: 'Social Welfare & Pensions',
    chatIntro: 'Namaste! I am Gram Sahayak, your digital assistant for Gram Panchayat. How can I help you today? You can type below or tap the microphone to speak!',
    chatPlaceholder: 'Type your question or speak in English/Hindi/Marathi...',
    reportTitle: 'Report a Problem in Village',
    reportSubtitle: 'Submit civic complaints (water, electricity, roads) directly to the Gram Panchayat Officer.',
    navHome: 'Home',
    navServices: 'Services',
    navReport: 'Report',
    navProfile: 'Profile'
  },
  hi: {
    langBtn: 'हिंदी',
    headerSub: 'ग्राम पंचायत डिजिटल सेवाएं पोर्टल',
    welcomeBadge: 'आधिकारिक पंचायत पोर्टल',
    greeting: 'नमस्ते, {name}!',
    subtext: 'आज ग्राम सहायक ग्राम पंचायत में आपकी क्या सहायता कर सकता है?',
    btnVoice: 'वॉयस चैट शुरू करें',
    btnReport: 'समस्या रिपोर्ट करें',
    quickActionsTitle: 'लोकप्रिय सेवाएं',
    catLand: 'भूलेख (खतौनी)',
    catPension: 'पेंशन योजनाएं',
    catCert: 'प्रमाण पत्र',
    catComplaint: 'शिकायत दर्ज करें',
    annTitleHeader: 'पंचायत अपडेट',
    annHeading: 'पीएम-किसान किस्त अपडेट',
    annBody: 'पीएम-किसान सम्मान निधि की अगली किस्त जल्द ही आएगी। सुनिश्चित करें कि आपकी ई-केवाईसी अपडेट है।',
    svcTitle: 'सेवाएं निर्देशिका',
    svcSubtitle: 'ग्रामीण सेवाओं और केंद्रीय योजनाओं के लिए आवेदन करें।',
    svcGroup1: 'व्यक्तिगत दस्तावेज',
    svcGroup2: 'कृषि और भूमि',
    svcGroup3: 'समाज कल्याण एवं पेंशन',
    chatIntro: 'नमस्ते! मैं ग्राम सहायक हूँ, आपकी ग्राम पंचायत का डिजिटल सहायक। मैं आज आपकी क्या सहायता कर सकता हूँ? नीचे टाइप करें या बोलने के लिए माइक दबाएँ!',
    chatPlaceholder: 'अपना प्रश्न टाइप करें या हिंदी/अंग्रेजी में बोलें...',
    reportTitle: 'गांव में समस्या दर्ज करें',
    reportSubtitle: 'पानी, बिजली, सड़क की शिकायतें सीधे ग्राम पंचायत अधिकारी को भेजें।',
    navHome: 'होम',
    navServices: 'सेवाएं',
    navReport: 'रिपोर्ट',
    navProfile: 'प्रोफाइल'
  },
  mr: {
    langBtn: 'मराठी',
    headerSub: 'ग्राम पंचायत डिजिटल सेवा पोर्टल',
    welcomeBadge: 'अधिकृत पंचायत पोर्टल',
    greeting: 'नमस्कार, {name}!',
    subtext: 'आज ग्राम सहायक ग्राम पंचायतीमध्ये तुमची कशी मदत करू शकतो?',
    btnVoice: 'व्हॉइस चॅट सुरू करा',
    btnReport: 'तक्रार नोंदवा',
    quickActionsTitle: 'लोकप्रिय सेवा',
    catLand: 'जमीन नोंदी (भूलेख)',
    catPension: 'पेन्शन योजना',
    catCert: 'प्रमाणपत्रे',
    catComplaint: 'तक्रार नोंदवा',
    annTitleHeader: 'पंचायत अपडेट',
    annHeading: 'पीएम-किसान हप्ता अपडेट',
    annBody: 'पीएम-किसान सन्मान निधीचा पुढील हप्ता लवकरच जमा होईल. तुमची e-KYC अपडेट असल्याचे सुनिश्चित करा.',
    svcTitle: 'सेवा निर्देशिका',
    svcSubtitle: 'ग्रामीण सेवा आणि केंद्रीय योजनांसाठी अर्ज करा.',
    svcGroup1: 'वैयक्तिक कागदपत्रे',
    svcGroup2: 'शेती आणि जमीन',
    svcGroup3: 'समाज कल्याण आणि पेन्शन',
    chatIntro: 'नमस्कार! मी ग्राम सहायक आहे, तुमचा ग्राम पंचायतीचा डिजिटल साहाय्यक. आज मी तुम्हाला कशी मदत करू शकतो? खाली टाईप करा किंवा बोलण्यासाठी माईक दाबा!',
    chatPlaceholder: 'तुमचा प्रश्न टाईप करा किंवा मराठी/हिंदी/इंग्रजीत बोला...',
    reportTitle: 'गावातील समस्या नोंदवा',
    reportSubtitle: 'पाणी, वीज, रस्त्यांच्या तक्रारी थेट ग्राम पंचायत अधिकाऱ्याकडे पाठवा.',
    navHome: 'मुख्यपृष्ठ',
    navServices: 'सेवा',
    navReport: 'तक्रार',
    navProfile: 'प्रोफाईल'
  }
};

// Document Ready Setup
document.addEventListener('DOMContentLoaded', () => {
  setupLanguageSwitcher();
  setupTabNavigation();
  setupAuthModal();
  setupEditProfileModal();
  setupChatBot();
  setupReportForm();
  if (!currentToken) {
    document.getElementById('auth-modal').classList.remove('hidden');
    return;
  }
  loadCitizenData();
  checkAuthSession();

  // WebSockets Real-Time Sync Listener
  socket.on('report_updated', (updatedReport) => {
    if (updatedReport && currentUser && updatedReport.citizen_id === currentUser.id) {
      showToast(`🔔 Complaint Update: Status of ${updatedReport.id} (${updatedReport.category}) changed to "${updatedReport.status}"`);
      loadCitizenData();
    }
  });

  socket.on('application_updated', (updatedApp) => {
    if (updatedApp && currentUser && updatedApp.citizen_id === currentUser.id) {
      showToast(`🎉 Application Update: Status of ${updatedApp.scheme_type} changed to "${updatedApp.status}"`);
      loadCitizenData();
    }
  });
});

async function checkAuthSession() {
  if (!currentToken) return;
  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': currentToken }
    });
    const data = await res.json();
    if (data.success && data.user?.role === 'user') {
      currentUser = data.user;
      localStorage.setItem('gram_user', JSON.stringify(currentUser));
      updateUserProfileDisplay();
    } else {
      currentToken = null;
      currentUser = null;
      localStorage.removeItem('gram_token');
      localStorage.removeItem('gram_user');
      document.getElementById('auth-modal').classList.remove('hidden');
    }
  } catch (err) {
    console.error("Session verification error:", err);
  }
}

// Tab Navigation Engine
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  const activeTab = document.getElementById(tabId);
  if (activeTab) activeTab.classList.remove('hidden');

  // Update Nav Button States
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.remove('text-primary');
    btn.classList.add('text-gray-500');
  });

  const activeBtnMap = {
    'tab-home': 'nav-btn-home',
    'tab-services': 'nav-btn-services',
    'tab-chat': 'nav-btn-chat',
    'tab-report': 'nav-btn-report',
    'tab-profile': 'nav-btn-profile'
  };
  const activeBtn = document.getElementById(activeBtnMap[tabId]);
  if (activeBtn && tabId !== 'tab-chat') {
    activeBtn.classList.remove('text-gray-500');
    activeBtn.classList.add('text-primary');
  }

  if (tabId === 'tab-profile') {
    loadCitizenData();
  }
}

// Language Switcher Engine
function setupLanguageSwitcher() {
  document.querySelectorAll('.lang-option-chip').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const selectedLang = btn.dataset.lang;
      if (selectedLang && ['en', 'hi', 'mr'].includes(selectedLang)) {
        currentLang = selectedLang;
        localStorage.setItem('gram_lang', currentLang);
        updateLanguageUI();
      }
    });
  });

  updateLanguageUI();
}

function updateLanguageUI() {
  const dict = translations[currentLang] || translations.en;
  const langLabel = document.getElementById('lang-label');
  if (langLabel) langLabel.textContent = dict.langBtn;

  document.querySelectorAll('.lang-option-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.lang === currentLang);
  });

  const headerSub = document.getElementById('header-subtitle');
  if (headerSub) headerSub.textContent = dict.headerSub;
  const welcomeBadge = document.getElementById('home-welcome-badge');
  if (welcomeBadge) welcomeBadge.textContent = dict.welcomeBadge;
  const greeting = document.getElementById('home-greeting');
  if (greeting) greeting.textContent = dict.greeting.replace('{name}', currentUser?.name || 'Citizen');
  const subtext = document.getElementById('home-subtext');
  if (subtext) subtext.textContent = dict.subtext;
  const btnVoice = document.getElementById('home-btn-voice');
  if (btnVoice) btnVoice.textContent = dict.btnVoice;
  const btnReport = document.getElementById('home-btn-report');
  if (btnReport) btnReport.textContent = dict.btnReport;
  const quickTitle = document.getElementById('home-quick-actions-title');
  if (quickTitle) quickTitle.textContent = dict.quickActionsTitle;

  const catLand = document.getElementById('cat-land');
  if (catLand) catLand.textContent = dict.catLand;
  const catPension = document.getElementById('cat-pension');
  if (catPension) catPension.textContent = dict.catPension;
  const catCert = document.getElementById('cat-cert');
  if (catCert) catCert.textContent = dict.catCert;
  const catComplaint = document.getElementById('cat-complaint');
  if (catComplaint) catComplaint.textContent = dict.catComplaint;

  document.getElementById('announcement-title-header').textContent = dict.annTitleHeader;
  document.getElementById('announcement-heading').textContent = dict.annHeading;
  document.getElementById('announcement-body').textContent = dict.annBody;

  document.getElementById('services-title').textContent = dict.svcTitle;
  document.getElementById('services-subtitle').textContent = dict.svcSubtitle;
  document.getElementById('svc-group-1').textContent = dict.svcGroup1;
  document.getElementById('svc-group-2').textContent = dict.svcGroup2;
  document.getElementById('svc-group-3').textContent = dict.svcGroup3;

  const chatIntro = document.getElementById('chat-intro-text');
  if (chatIntro) chatIntro.textContent = dict.chatIntro;
  document.getElementById('chat-input').placeholder = dict.chatPlaceholder;

  document.getElementById('report-title').textContent = dict.reportTitle;
  document.getElementById('report-subtitle').textContent = dict.reportSubtitle;

  document.getElementById('nav-lbl-home').textContent = dict.navHome;
  document.getElementById('nav-lbl-services').textContent = dict.navServices;
  document.getElementById('nav-lbl-report').textContent = dict.navReport;
  document.getElementById('nav-lbl-profile').textContent = dict.navProfile;
}

function setupTabNavigation() {
  switchTab('tab-home');
}

// Authentication Engine
function setupAuthModal() {
  const modal = document.getElementById('auth-modal');
  const openBtn = document.getElementById('auth-profile-btn');
  const closeBtn = document.getElementById('auth-modal-close');
  const logoutBtn = document.getElementById('logout-btn');
  const headerLogoutBtn = document.getElementById('header-signout-btn');

  openBtn.addEventListener('click', () => modal.classList.remove('hidden'));
  closeBtn.classList.toggle('hidden', !currentToken);
  closeBtn.addEventListener('click', () => { if (currentToken) modal.classList.add('hidden'); });

  // Quick Citizen Login
  const quickCitizenBtn = document.getElementById('quick-citizen-login');
  if (quickCitizenBtn) {
    quickCitizenBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ loginId: '9876543210', password: 'user123', role: 'citizen' })
        });
        const data = await res.json();
        if (data.success && data.user) {
          currentUser = data.user;
          currentToken = data.token;
          localStorage.setItem('gram_user', JSON.stringify(currentUser));
          localStorage.setItem('gram_token', currentToken);
          updateUserProfileDisplay();
          modal.classList.add('hidden');
          window.location.reload();
        }
      } catch (e) {
        showToast('Quick login failed.', 'error');
      }
    });
  }

  // Quick Admin Login
  const quickAdminBtn = document.getElementById('quick-admin-login');
  if (quickAdminBtn) {
    quickAdminBtn.addEventListener('click', () => {
      window.location.href = '/admin.html';
    });
  }

  // Standard Form Submit
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const loginId = document.getElementById('login-id-input').value;
    const password = document.getElementById('login-password-input').value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId, password, role: 'citizen' })
      });
      const data = await res.json();
      if (data.success && data.user) {
        currentUser = data.user;
        currentToken = data.token;
        localStorage.setItem('gram_user', JSON.stringify(currentUser));
        localStorage.setItem('gram_token', currentToken);
        updateUserProfileDisplay();
        modal.classList.add('hidden');
        window.location.reload();
      } else {
        showToast('Login failed. Please check credentials.', 'error');
      }
    } catch (err) {
      showToast('Login error occurred.', 'error');
    }
  });

  const signOut = async () => {
      if (currentToken) await fetch('/api/auth/logout', { method: 'POST', headers: authHeaders() }).catch(() => {});
      localStorage.removeItem('gram_user');
      localStorage.removeItem('gram_token');
      showToast('Signed out successfully.');
      setTimeout(() => window.location.reload(), 800);
  };
  if (logoutBtn) logoutBtn.addEventListener('click', signOut);
  if (headerLogoutBtn) headerLogoutBtn.addEventListener('click', signOut);

  const signupForm = document.getElementById('signup-form');
  const signupToggle = document.getElementById('signup-toggle');
  const loginForm = document.getElementById('login-form');
  if (signupToggle && signupForm) {
    signupToggle.addEventListener('click', () => {
      loginForm.classList.toggle('hidden');
      signupForm.classList.toggle('hidden');
      signupToggle.textContent = signupForm.classList.contains('hidden') ? 'Create an account' : 'Back to sign in';
    });
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const mobileInput = document.getElementById('signup-mobile')?.value.trim();
      const emailInput = document.getElementById('signup-email')?.value.trim();
      const body = {
        username: document.getElementById('signup-username').value.trim(),
        name: document.getElementById('signup-name').value.trim(),
        password: document.getElementById('signup-password').value
      };
      if (mobileInput) body.mobile = mobileInput;
      if (emailInput) body.email = emailInput;

      try {
        const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        if (!data.success) return showToast(data.error || 'Sign-up failed.', 'error');
        localStorage.setItem('gram_user', JSON.stringify(data.user));
        localStorage.setItem('gram_token', data.token);
        window.location.reload();
      } catch (err) {
        showToast('Sign-up error occurred.', 'error');
      }
    });
  }

  updateUserProfileDisplay();
}

function getInitialAvatarHtml(name, sizeClasses = 'w-16 h-16 text-xl') {
  if (!name || typeof name !== 'string') name = 'Citizen';
  const cleanName = name.trim();
  const parts = cleanName.split(/\s+/);
  let initials = '';
  if (parts.length >= 2) {
    initials = (parts[0][0] + parts[1][0]).toUpperCase();
  } else if (parts.length === 1 && parts[0].length > 0) {
    initials = parts[0].substring(0, Math.min(2, parts[0].length)).toUpperCase();
  } else {
    initials = 'C';
  }

  // WhatsApp-style rich color palette
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

function updateUserProfileDisplay() {
  if (!currentUser) {
    currentUser = {
      id: 'CIT-001',
      name: 'Rajesh Kumar',
      username: 'rajesh_kumar',
      mobile: '9876543210',
      email: 'rajesh.kumar@gmail.com',
      village: 'Kalyanpur',
      role: 'user'
    };
  }

  const headerLogoutBtn = document.getElementById('header-signout-btn');
  if (headerLogoutBtn) {
    headerLogoutBtn.classList.toggle('hidden', !currentToken);
    headerLogoutBtn.classList.toggle('flex', Boolean(currentToken));
  }
  const nameDisp = document.getElementById('user-name-display');
  if (nameDisp) nameDisp.textContent = currentToken ? (currentUser.name || currentUser.username || 'Citizen') : (currentUser.name || 'Sign in');

  const headerAvatarContainer = document.getElementById('header-user-avatar-container');
  if (headerAvatarContainer) {
    headerAvatarContainer.innerHTML = getInitialAvatarHtml(currentUser.name || 'Citizen', 'w-8 h-8 text-xs');
  }

  const cardName = document.getElementById('profile-card-name');
  if (cardName) cardName.textContent = currentUser.name || currentUser.username || 'Rajesh Kumar';

  const cardAvatarContainer = document.getElementById('profile-card-avatar-container');
  if (cardAvatarContainer) {
    cardAvatarContainer.innerHTML = getInitialAvatarHtml(currentUser.name || 'Rajesh Kumar', 'w-20 h-20 text-2xl');
  }

  const cardVillage = document.getElementById('profile-card-village');
  if (cardVillage) {
    const mob = (currentUser.mobile && currentUser.mobile !== 'null') ? currentUser.mobile : '9876543210';
    cardVillage.textContent = `${currentUser.village || 'Kalyanpur'} Village • Mobile: ${mob}`;
  }

  const modalIcon = document.getElementById('edit-profile-modal-icon');
  if (modalIcon) {
    modalIcon.innerHTML = getInitialAvatarHtml(currentUser.name || 'Rajesh Kumar', 'w-12 h-12 text-sm');
  }

  updateLanguageUI();
}

function setupEditProfileModal() {
  const openBtn = document.getElementById('open-edit-profile-btn');
  const modal = document.getElementById('edit-profile-modal');
  const closeBtn = document.getElementById('edit-profile-modal-close');
  const cancelBtn = document.getElementById('cancel-edit-profile-btn');
  const form = document.getElementById('edit-profile-form');

  if (!modal) return;

  const openModal = (e) => {
    if (e) e.preventDefault();
    if (!currentUser) {
      currentUser = {
        id: 'CIT-001',
        name: 'Rajesh Kumar',
        username: 'rajesh_kumar',
        mobile: '9876543210',
        email: 'rajesh.kumar@gmail.com',
        village: 'Kalyanpur',
        role: 'user'
      };
    }

    const nameInput = document.getElementById('edit-name-input');
    const emailInput = document.getElementById('edit-email-input');
    const mobileInput = document.getElementById('edit-mobile-input');
    const userDisp = document.getElementById('edit-username-display');

    if (nameInput) nameInput.value = currentUser.name || 'Rajesh Kumar';
    if (emailInput) emailInput.value = (currentUser.email && currentUser.email !== 'null') ? currentUser.email : 'rajesh.kumar@gmail.com';
    if (mobileInput) mobileInput.value = (currentUser.mobile && currentUser.mobile !== 'null') ? currentUser.mobile : '9876543210';
    if (userDisp) userDisp.textContent = currentUser.username || currentUser.id || 'CIT-001';

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  };

  if (openBtn) {
    openBtn.onclick = openModal;
  }

  const closeModal = () => {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  };

  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const newName = document.getElementById('edit-name-input').value.trim();
      const newEmail = document.getElementById('edit-email-input').value.trim();
      const newMobile = document.getElementById('edit-mobile-input').value.trim();

      if (!newName) {
        showToast('Please enter your full name', 'error');
        return;
      }

      if (!currentUser) currentUser = { id: 'CIT-001', village: 'Kalyanpur' };

      currentUser.name = newName;
      currentUser.email = newEmail;
      currentUser.mobile = newMobile;

      try {
        if (currentToken) {
          const res = await fetch('/api/profile', {
            method: 'PUT',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ name: newName, email: newEmail, mobile: newMobile })
          });
          const data = await res.json();
          if (data.success && data.profile) {
            currentUser = data.profile;
          }
        }
      } catch (err) {
        console.error('Error saving profile:', err);
      }

      localStorage.setItem('gram_user', JSON.stringify(currentUser));
      updateUserProfileDisplay();
      closeModal();
      showToast('Profile details updated successfully!');
    };
  }
}

// Assistant & Speech Recognition Setup
function setupChatBot() {
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  const micBtn = document.getElementById('mic-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    appendChatMessage('user', text);
    input.value = '';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ text, citizenId: currentUser.id, language: currentLang })
      });
      const data = await res.json();
      if (data.reply) {
        const replyText = typeof data.reply === 'string' ? data.reply : data.reply.reply;
        const actions = typeof data.reply === 'object' ? data.reply.actions : (data.actions || []);
        appendChatMessage('assistant', replyText, actions);
      }
    } catch (err) {
      appendChatMessage('assistant', 'Sorry, I am having trouble connecting right now. Please try again.');
    }
  });

  // Web Speech Recognition setup
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = currentLang === 'hi' ? 'hi-IN' : (currentLang === 'mr' ? 'mr-IN' : 'en-US');

    micBtn.addEventListener('click', () => {
      recognition.lang = currentLang === 'hi' ? 'hi-IN' : (currentLang === 'mr' ? 'mr-IN' : 'en-US');
      recognition.start();
      micBtn.classList.add('pulse-mic');
      showToast('Listening... Speak now into your microphone.');
    });

    recognition.onresult = (event) => {
      micBtn.classList.remove('pulse-mic');
      const transcript = event.results[0][0].transcript;
      input.value = transcript;
      form.dispatchEvent(new Event('submit'));
    };

    recognition.onerror = () => {
      micBtn.classList.remove('pulse-mic');
      showToast('Voice input error. Please try typing.', 'error');
    };
    recognition.onend = () => micBtn.classList.remove('pulse-mic');
  } else {
    micBtn.addEventListener('click', () => {
      showToast('Voice recognition not supported in this browser. Please type your query.');
    });
  }
}

function sendQuickQuery(text) {
  const input = document.getElementById('chat-input');
  input.value = text;
  document.getElementById('chat-form').dispatchEvent(new Event('submit'));
}

function appendChatMessage(sender, text, actions = []) {
  const container = document.getElementById('chat-messages-container');
  const msgDiv = document.createElement('div');

  if (sender === 'user') {
    const safeText = escapeHTML(text);
    const avatarHtml = getInitialAvatarHtml(currentUser?.name || 'Citizen', 'w-8 h-8 text-xs');
    msgDiv.className = 'flex gap-3 max-w-[85%] self-end flex-row-reverse';
    msgDiv.innerHTML = `
      ${avatarHtml}
      <div class="user-chat-bubble">
        <p>${safeText}</p>
      </div>
    `;
  } else {
    const formattedText = formatRichText(text);
    let actionsHtml = '';
    if (actions && actions.length > 0) {
      actionsHtml = `<div class="mt-3 pt-2 border-t border-slate-100 flex flex-wrap gap-2">` +
        actions.map(act => `
          <button onclick="handleActionChip('${act.tab}', '${act.category || act.scheme || ''}')" class="chat-action-btn">
            ${escapeHTML(act.label)} ➔
          </button>
        `).join('') + `</div>`;
    }

    msgDiv.className = 'flex gap-3 max-w-[85%]';
    const plainMsgText = text.replace(/<[^>]*>?/gm, '').replace(/[*#_]/g, '');
    const listenLabel = currentLang === 'hi' ? 'सुनें' : (currentLang === 'mr' ? 'ऐका' : 'Listen');
    msgDiv.innerHTML = `
      <div class="assistant-avatar-badge">
        <span class="material-symbols-outlined text-sm">support_agent</span>
      </div>
      <div class="assistant-chat-bubble relative group">
        <div class="flex items-center justify-between gap-2 mb-1">
          <p class="font-semibold text-emerald-800 text-xs">Gram Sahayak</p>
          <button onclick="speakText(this.getAttribute('data-text'))" data-text="${escapeHTML(plainMsgText)}" class="p-1 rounded-full hover:bg-slate-100 text-slate-500 hover:text-emerald-800 transition-colors inline-flex items-center gap-1 text-[11px]" title="Listen / ऐका / सुनें">
            <span class="material-symbols-outlined text-base">volume_up</span>
            <span class="font-medium">${listenLabel}</span>
          </button>
        </div>
        <div class="leading-relaxed text-slate-900">${formattedText}</div>
        ${actionsHtml}
      </div>
    `;
  }
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

function handleActionChip(tabId, param) {
  switchTab(tabId);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (tabId === 'tab-report') {
    let cat = 'Electricity';
    if (param) {
      if (/light|electric|bijli/i.test(param)) cat = 'Electricity';
      else if (/water|paani|jal/i.test(param)) cat = 'Water Supply';
      else if (/road|sadak|gaddha/i.test(param)) cat = 'Roads';
      else if (/sanitation|kachra|drain/i.test(param)) cat = 'Sanitation';
      else cat = param;
    }
    const radio = document.querySelector(`input[name="issue_category"][value="${cat}"]`);
    if (radio) radio.checked = true;
    showToast(`Opening complaint form (${cat})`);
  } else if (param && tabId === 'tab-services') {
    applyScheme(param);
  }
}

let activeAudioPlayer = null;

function speakText(text) {
  if (!text || !text.trim()) return;
  const clean = text.replace(/<[^>]*>?/gm, '').replace(/[•#*_`]/g, ' ').trim();

  // Cancel any active audio playback
  if (activeAudioPlayer) {
    activeAudioPlayer.pause();
    activeAudioPlayer = null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  // Determine speech language
  const hasDevanagari = /[\u0900-\u097F]/.test(clean);
  const speechLang = hasDevanagari ? 'hi' : (currentLang === 'hi' ? 'hi' : 'en');

  // Single clean MP3 stream from our gTTS service
  const audioUrl = `/api/tts?text=${encodeURIComponent(clean)}&lang=${speechLang}`;
  const audio = new Audio(audioUrl);
  activeAudioPlayer = audio;

  audio.play().catch(err => {
    console.error("Audio playback error:", err);
  });
}

// Report A Problem Form Logic
function setupReportForm() {
  const form = document.getElementById('report-issue-form');
  const autoLocBtn = document.getElementById('auto-location-btn');
  const reportMicBtn = document.getElementById('report-mic-btn');
  const descInput = document.getElementById('report-desc-input');

  autoLocBtn.addEventListener('click', () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          document.getElementById('report-location-input').value = `Ward 4 (Lat: ${pos.coords.latitude.toFixed(3)}, Long: ${pos.coords.longitude.toFixed(3)})`;
          showToast('Location pinned automatically!');
        },
        () => {
          document.getElementById('report-location-input').value = 'Ward 4, Kalyanpur Main Market';
          showToast('Pinned location: Ward 4, Kalyanpur');
        }
      );
    } else {
      document.getElementById('report-location-input').value = 'Ward 4, Kalyanpur';
    }
  });

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition && reportMicBtn) {
    const recognition = new SpeechRecognition();
    reportMicBtn.addEventListener('click', () => {
      recognition.lang = currentLang === 'hi' ? 'hi-IN' : 'en-US';
      recognition.start();
      showToast('Listening... Describe your problem.');
    });
    recognition.onresult = (e) => {
      descInput.value = e.results[0][0].transcript;
    };
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser || !currentUser.id) {
      document.getElementById('auth-modal').classList.remove('hidden');
      showToast('Please sign in to submit your civic complaint.', 'error');
      return;
    }

    const category = document.querySelector('input[name="issue_category"]:checked').value;
    const location = document.getElementById('report-location-input').value;
    const description = descInput.value;
    const photoFile = document.getElementById('report-photo-file').files[0];

    const formData = new FormData();
    formData.append('category', category);
    formData.append('location', location);
    formData.append('description', description);
    formData.append('citizen_id', currentUser.id);
    formData.append('citizen_name', currentUser.name);
    if (photoFile) formData.append('photo', photoFile);

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: authHeaders(),
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Complaint ${data.report.id} submitted! Priority: ${data.report.priority}`);
        form.reset();
        switchTab('tab-profile');
      } else {
        showToast(data.error || 'Failed to submit complaint.', 'error');
      }
    } catch (err) {
      showToast('Error submitting complaint.', 'error');
    }
  });
}

// Load Real-Time Citizen Profile & Application Tracker Data
async function loadCitizenData() {
  try {
    const reportsRes = await fetch('/api/reports', { headers: authHeaders() });
    if (!reportsRes.ok) throw new Error('Could not load reports');
    const reports = await reportsRes.json();
    if (!Array.isArray(reports)) throw new Error('Invalid reports response');
    const reportsContainer = document.getElementById('citizen-reports-list');

    if (reportsContainer) {
      if (reports.length === 0) {
        reportsContainer.innerHTML = `<p class="text-xs text-gray-500 italic p-3">No active civic complaints submitted yet.</p>`;
      } else {
        reportsContainer.innerHTML = reports.map(r => `
          <div class="bg-gray-50 border border-outline-variant p-4 rounded-xl flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-xs text-primary">${escapeHTML(r.id)}</span>
                <span class="text-xs font-semibold text-gray-700">• ${escapeHTML(r.category)}</span>
              </div>
              <p class="text-xs text-gray-600 mt-1">${escapeHTML(r.location)}</p>
              ${r.admin_notes ? `<p class="text-xs text-tertiary mt-1 font-medium">Secretary Note: ${escapeHTML(r.admin_notes)}</p>` : ''}
            </div>
            <span class="px-2.5 py-1 rounded-full text-xs font-bold ${
              r.status === 'Resolved' ? 'badge-resolved' :
              r.status === 'In Progress' ? 'badge-in-progress' : 'badge-pending'
            }">${escapeHTML(r.status)}</span>
          </div>
        `).join('');
      }
    }

    const appsRes = await fetch('/api/applications', { headers: authHeaders() });
    if (!appsRes.ok) throw new Error('Could not load applications');
    const apps = await appsRes.json();
    if (!Array.isArray(apps)) throw new Error('Invalid applications response');
    const appsContainer = document.getElementById('citizen-applications-list');

    if (appsContainer) {
      if (apps.length === 0) {
        appsContainer.innerHTML = `<p class="text-xs text-gray-500 italic p-3">No active scheme applications submitted yet.</p>`;
      } else {
        appsContainer.innerHTML = apps.map(a => `
          <div class="bg-gray-50 border border-outline-variant p-4 rounded-xl">
            <div class="flex items-center justify-between mb-2">
              <span class="font-bold text-xs text-gray-900">${escapeHTML(a.scheme_type)}</span>
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">${escapeHTML(a.status)}</span>
            </div>
            <div class="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
              <div class="bg-primary h-full rounded-full transition-all" style="width: ${a.progress_pct}%"></div>
            </div>
            <p class="text-[11px] text-gray-500 mt-1.5 text-right font-medium">${a.progress_pct}% Progress</p>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error("Error loading citizen profile data:", err);
  }
}

async function applyScheme(schemeName) {
  if (!currentUser) {
    currentUser = {
      id: 'CIT-001',
      name: 'Rajesh Kumar',
      username: 'rajesh_kumar',
      mobile: '9876543210',
      email: 'rajesh.kumar@gmail.com',
      village: 'Kalyanpur',
      role: 'user'
    };
  }

  try {
    if (currentToken) {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          scheme_type: schemeName,
          citizen_id: currentUser.id,
          citizen_name: currentUser.name,
          details: { applied_on: new Date().toISOString() }
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Application for "${schemeName}" submitted successfully!`);
      } else {
        showToast(`Application for "${schemeName}" submitted!`);
      }
    } else {
      showToast(`Application for "${schemeName}" submitted!`);
    }
  } catch (err) {
    showToast(`Application for "${schemeName}" submitted!`);
  }

  switchTab('tab-profile');
  loadCitizenData();
}

function switchTab(tabId) {
  const tabs = document.querySelectorAll('.tab-content');
  tabs.forEach(tab => {
    if (tab.id === tabId) {
      tab.classList.remove('hidden');
      tab.classList.add('flex');
    } else {
      tab.classList.add('hidden');
      tab.classList.remove('flex');
    }
  });

  const navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach(btn => {
    const isTarget = btn.id === `nav-btn-${tabId.replace('tab-', '')}`;
    if (btn.id === 'nav-btn-chat') return;
    if (isTarget) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}
