// --- متابعة طلاب تكوين النسيم ---
// Vanilla JS مع المزامنة السحابية الفورية (Firebase Firestore) + نظام مصادقة المشرف

import { 
  saveAppDataToCloud, 
  loadAppDataFromCloud, 
  subscribeToCloudChanges 
} from './src/firebaseSync.js';

const STORAGE_KEYS = {
  STUDENTS: 'takween_students_v1',
  RECORDS: 'takween_records_v1',
  STATE: 'takween_state_v1',
  AUTH: 'takween_auth_admin_v1'
};

// الطلاب التجريبيون الافتراضيون
const DEFAULT_STUDENTS = [
  { id: 'std_1', name: 'أنمار أحمد', createdAt: Date.now() },
  { id: 'std_2', name: 'بسيل خالد', createdAt: Date.now() + 1 },
  { id: 'std_3', name: 'الحسين باقيس', createdAt: Date.now() + 2 },
  { id: 'std_4', name: 'أحمد البلوطي', createdAt: Date.now() + 3 }
];

const DEFAULT_AUTH = {
  isLoggedIn: false,
  username: 'admin',
  password: 'Naseem_2026'
};

const DAYS_CONFIG = [
  { id: 'sunday', name: 'الأحد', short: 'أحد', hasLesson: false, isThursday: false },
  { id: 'monday', name: 'الاثنين', short: 'اثنين', hasLesson: false, isThursday: false },
  { id: 'tuesday', name: 'الثلاثاء', short: 'ثلاثاء', hasLesson: true, isThursday: false },
  { id: 'wednesday', name: 'الأربعاء', short: 'أربعاء', hasLesson: false, isThursday: false },
  { id: 'thursday', name: 'الخميس', short: 'خميس', hasLesson: false, isThursday: true }
];

// App State
let appState = {
  currentTab: 'tracking', // tracking | leaderboard | stats | students
  currentMonth: 'شهر 1',
  currentWeek: 'الأسبوع 1',
  currentDay: 'sunday',
  statsMonth: 'شهر 1',
  reportDays: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
  searchQuery: '',
  activeFilter: 'all', // all | unrecorded | done | needs-attention
  manageSearchQuery: ''
};

let authState = { ...DEFAULT_AUTH };
let students = [];
let records = {}; // Key: `${studentId}_${month}_${week}_${day}` -> { attendance, wird, tuesdayLesson, thursdayEarly, thursdayProgram }
let isCloudSyncing = false;

// --- Persistence Helpers ---
function loadData() {
  try {
    const savedAuth = localStorage.getItem(STORAGE_KEYS.AUTH);
    if (savedAuth) {
      const parsed = JSON.parse(savedAuth);
      // Upgrade from old default if needed
      if (parsed.username === 'المشرف' && parsed.password === '1234') {
        authState = { ...DEFAULT_AUTH, isLoggedIn: parsed.isLoggedIn || false };
      } else {
        authState = { ...DEFAULT_AUTH, ...parsed };
      }
    } else {
      authState = { ...DEFAULT_AUTH };
    }

    const savedStudents = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    if (savedStudents) {
      students = JSON.parse(savedStudents);
    } else {
      students = [...DEFAULT_STUDENTS];
      saveStudentsLocally();
    }

    const savedRecords = localStorage.getItem(STORAGE_KEYS.RECORDS);
    if (savedRecords) {
      records = JSON.parse(savedRecords);
    } else {
      records = {};
    }

    const savedState = localStorage.getItem(STORAGE_KEYS.STATE);
    if (savedState) {
      const parsed = JSON.parse(savedState);
      appState = { ...appState, ...parsed };
    }
  } catch (e) {
    console.error('Error loading data from localStorage', e);
    students = [...DEFAULT_STUDENTS];
    records = {};
  }
}

function saveStudentsLocally() {
  localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
}

function saveRecordsLocally() {
  localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
}

function saveStateLocally() {
  localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(appState));
}

function saveAuthLocally() {
  localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(authState));
}

// Debounce timer for saving to cloud
let cloudSaveTimeout = null;
function triggerCloudSync() {
  saveStudentsLocally();
  saveRecordsLocally();

  setSyncStatusUI('syncing', 'جارِ الحفظ سحابياً...');
  if (cloudSaveTimeout) clearTimeout(cloudSaveTimeout);
  
  cloudSaveTimeout = setTimeout(async () => {
    isCloudSyncing = true;
    const ok = await saveAppDataToCloud(students, records);
    isCloudSyncing = false;
    if (ok) {
      setSyncStatusUI('online', 'متزامن سحابياً');
    } else {
      setSyncStatusUI('offline', 'حفظ محلي (دون اتصال)');
    }
  }, 400);
}

function setSyncStatusUI(status, text) {
  const statusEl = document.getElementById('cloud-sync-status');
  if (!statusEl) return;
  
  const dot = statusEl.querySelector('.sync-indicator');
  const txt = statusEl.querySelector('.sync-text');
  
  if (dot) {
    dot.className = `sync-indicator ${status}`;
  }
  if (txt) {
    txt.textContent = text;
  }
}

// --- Points Engine ---
function getStudentDayRecord(studentId, dayId = appState.currentDay, week = appState.currentWeek, month = appState.currentMonth) {
  const key = `${studentId}_${month}_${week}_${dayId}`;
  return records[key] || {};
}

function setStudentDayField(studentId, field, value, dayId = appState.currentDay, week = appState.currentWeek, month = appState.currentMonth) {
  const key = `${studentId}_${month}_${week}_${dayId}`;
  if (!records[key]) {
    records[key] = {};
  }
  
  // Toggle off if clicking the already selected status, or set it
  if (records[key][field] === value) {
    delete records[key][field];
  } else {
    records[key][field] = value;
  }
  
  triggerCloudSync();
  renderTrackingDayView();
  renderLeaderboard();
  updateHeaderStats();
}

// Ensure globally accessible for inline onclick handlers
window.setStudentDayField = setStudentDayField;

function calculateDayPoints(record, dayId) {
  let pts = 0;
  if (dayId === 'thursday') {
    if (record.thursdayEarly === 'done') pts += 5;
    if (record.thursdayProgram === 'done') pts += 5;
    return pts;
  }

  // Attendance
  if (record.attendance === 'present') pts += 3;
  else if (record.attendance === 'excused') pts += 1;

  // Wird
  if (record.wird === 'done') pts += 3;
  else if (record.wird === 'partial') pts += 1;

  // Tuesday Lesson
  if (dayId === 'tuesday') {
    if (record.tuesdayLesson === 'present') pts += 3;
    else if (record.tuesdayLesson === 'excused') pts += 1;
  }

  return pts;
}

// Points Engine & Detailed Stats
function calculateStudentWeekPoints(studentId, week = appState.currentWeek, month = appState.currentMonth) {
  let total = 0;
  let breakdown = {
    attendance: 0,
    wird: 0,
    tuesdayLesson: 0,
    thursday: 0
  };

  DAYS_CONFIG.forEach(d => {
    const rec = getStudentDayRecord(studentId, d.id, week, month);
    if (d.id === 'thursday') {
      if (rec.thursdayEarly === 'done') { total += 5; breakdown.thursday += 5; }
      if (rec.thursdayProgram === 'done') { total += 5; breakdown.thursday += 5; }
    } else {
      if (rec.attendance === 'present') { total += 3; breakdown.attendance += 3; }
      else if (rec.attendance === 'excused') { total += 1; breakdown.attendance += 1; }

      if (rec.wird === 'done') { total += 3; breakdown.wird += 3; }
      else if (rec.wird === 'partial') { total += 1; breakdown.wird += 1; }

      if (d.id === 'tuesday') {
        if (rec.tuesdayLesson === 'present') { total += 3; breakdown.tuesdayLesson += 3; }
        else if (rec.tuesdayLesson === 'excused') { total += 1; breakdown.tuesdayLesson += 1; }
      }
    }
  });

  return { total, breakdown };
}

// حساب الأرقام والإحصائيات التفصيلية للطالب خلال الأسبوع (بدلاً من الازدحام بالنقاط فقط)
function getStudentDetailedWeekStats(studentId, week = appState.currentWeek, month = appState.currentMonth) {
  let total = 0;
  let attDays = { present: 0, excused: 0, absent: 0, unrecorded: 0 };
  let wirdDays = { done: 0, partial: 0, none: 0, unrecorded: 0 };
  let tuesdayLesson = 'unrecorded';
  let thursday = { early: 'none', program: 'none' };

  DAYS_CONFIG.forEach(d => {
    const rec = getStudentDayRecord(studentId, d.id, week, month);
    if (d.id === 'thursday') {
      if (rec.thursdayEarly === 'done') { total += 5; thursday.early = 'done'; }
      else if (rec.thursdayEarly === 'none') { thursday.early = 'none'; }

      if (rec.thursdayProgram === 'done') { total += 5; thursday.program = 'done'; }
      else if (rec.thursdayProgram === 'none') { thursday.program = 'none'; }
    } else {
      // الحضور
      if (rec.attendance === 'present') { total += 3; attDays.present++; }
      else if (rec.attendance === 'excused') { total += 1; attDays.excused++; }
      else if (rec.attendance === 'absent') { attDays.absent++; }
      else { attDays.unrecorded++; }

      // الورد
      if (rec.wird === 'done') { total += 3; wirdDays.done++; }
      else if (rec.wird === 'partial') { total += 1; wirdDays.partial++; }
      else if (rec.wird === 'none') { wirdDays.none++; }
      else { wirdDays.unrecorded++; }

      // درس الثلاثاء
      if (d.id === 'tuesday') {
        if (rec.tuesdayLesson === 'present') { total += 3; tuesdayLesson = 'present'; }
        else if (rec.tuesdayLesson === 'excused') { total += 1; tuesdayLesson = 'excused'; }
        else if (rec.tuesdayLesson === 'absent') { tuesdayLesson = 'absent'; }
      }
    }
  });

  return {
    total,
    attDays,
    wirdDays,
    tuesdayLesson,
    thursday
  };
}

// معرفة الأسبوع والشهر السابق لحساب قفزة النقاط والتميز الأسبوعي
function getPreviousPeriod(currentMonth = appState.currentMonth, currentWeek = appState.currentWeek) {
  const weekMatch = currentWeek.match(/\d+/);
  const monthMatch = currentMonth.match(/\d+/);
  const weekNum = weekMatch ? parseInt(weekMatch[0], 10) : 1;
  const monthNum = monthMatch ? parseInt(monthMatch[0], 10) : 1;

  if (weekNum > 1) {
    return { month: currentMonth, week: `الأسبوع ${weekNum - 1}`, label: `الأسبوع ${weekNum - 1}` };
  } else if (monthNum > 1) {
    return { month: `شهر ${monthNum - 1}`, week: 'الأسبوع 4', label: `الأسبوع 4 من شهر ${monthNum - 1}` };
  } else {
    return null;
  }
}

// مجموعة المعرفات المحددة للإجراءات المجمعة
let selectedStudentIds = new Set();

window.toggleStudentSelect = function(studentId, isChecked) {
  if (isChecked) {
    selectedStudentIds.add(studentId);
  } else {
    selectedStudentIds.delete(studentId);
  }
  renderTrackingDayView();
};

window.toggleSelectAllVisible = function(forceSelect) {
  const filtered = getCurrentlyFilteredStudents();
  if (forceSelect) {
    filtered.forEach(s => selectedStudentIds.add(s.id));
  } else {
    filtered.forEach(s => selectedStudentIds.delete(s.id));
  }
  renderTrackingDayView();
};

window.clearStudentSelection = function() {
  selectedStudentIds.clear();
  renderTrackingDayView();
  showToast('تم إلغاء التحديد 🔄');
};

// Batch Action Applicators
window.applyBatchAttendance = function(status) {
  if (selectedStudentIds.size === 0) return;
  const day = appState.currentDay;
  const count = selectedStudentIds.size;

  selectedStudentIds.forEach(id => {
    const key = `${id}_${appState.currentMonth}_${appState.currentWeek}_${day}`;
    if (!records[key]) records[key] = {};
    records[key].attendance = status;
  });

  triggerCloudSync();
  renderTrackingDayView();
  renderLeaderboard();
  updateHeaderStats();

  const label = status === 'present' ? 'حاضر ✅' : status === 'excused' ? 'معتذر ⚠️' : 'غائب ❌';
  showToast(`تم رصد (${count}) طلاب كـ ${label}`);
};

window.applyBatchWird = function(status) {
  if (selectedStudentIds.size === 0) return;
  const day = appState.currentDay;
  const count = selectedStudentIds.size;

  selectedStudentIds.forEach(id => {
    const key = `${id}_${appState.currentMonth}_${appState.currentWeek}_${day}`;
    if (!records[key]) records[key] = {};
    records[key].wird = status;
  });

  triggerCloudSync();
  renderTrackingDayView();
  renderLeaderboard();
  updateHeaderStats();

  const label = status === 'done' ? 'أنجز الورد ✅' : status === 'partial' ? 'شبه منجز ⏳' : 'لم ينجز ❌';
  showToast(`تم رصد الورد لـ (${count}) طلاب: ${label}`);
};

window.applyBatchTuesday = function(status) {
  if (selectedStudentIds.size === 0) return;
  const day = appState.currentDay;
  const count = selectedStudentIds.size;

  selectedStudentIds.forEach(id => {
    const key = `${id}_${appState.currentMonth}_${appState.currentWeek}_${day}`;
    if (!records[key]) records[key] = {};
    records[key].tuesdayLesson = status;
  });

  triggerCloudSync();
  renderTrackingDayView();
  renderLeaderboard();
  updateHeaderStats();

  const label = status === 'present' ? 'حضر الدرس ✅' : status === 'excused' ? 'معتذر ⚠️' : 'غائب ❌';
  showToast(`تم رصد درس الثلاثاء لـ (${count}) طلاب: ${label}`);
};

window.applyBatchThursday = function(field, status) {
  if (selectedStudentIds.size === 0) return;
  const day = appState.currentDay;
  const count = selectedStudentIds.size;

  selectedStudentIds.forEach(id => {
    const key = `${id}_${appState.currentMonth}_${appState.currentWeek}_${day}`;
    if (!records[key]) records[key] = {};
    records[key][field] = status;
  });

  triggerCloudSync();
  renderTrackingDayView();
  renderLeaderboard();
  updateHeaderStats();

  const fieldName = field === 'thursdayEarly' ? 'التبكير للخميسية' : 'البرنامج الفردي';
  const label = status === 'done' ? 'أنجز ✅' : 'لم ينجز ❌';
  showToast(`تم رصد ${fieldName} لـ (${count}) طلاب: ${label}`);
};

window.applyBatchFullDay = function() {
  if (selectedStudentIds.size === 0) return;
  const day = appState.currentDay;
  const count = selectedStudentIds.size;

  selectedStudentIds.forEach(id => {
    const key = `${id}_${appState.currentMonth}_${appState.currentWeek}_${day}`;
    if (!records[key]) records[key] = {};

    if (day === 'thursday') {
      records[key].thursdayEarly = 'done';
      records[key].thursdayProgram = 'done';
    } else {
      records[key].attendance = 'present';
      records[key].wird = 'done';
      if (day === 'tuesday') {
        records[key].tuesdayLesson = 'present';
      }
    }
  });

  triggerCloudSync();
  renderTrackingDayView();
  renderLeaderboard();
  updateHeaderStats();
  showToast(`تم تسجيل الإنجاز الكامل لـ (${count}) طلاب المحددين ⚡`);
};

window.applyBatchClear = function() {
  if (selectedStudentIds.size === 0) return;
  const day = appState.currentDay;
  const count = selectedStudentIds.size;

  selectedStudentIds.forEach(id => {
    const key = `${id}_${appState.currentMonth}_${appState.currentWeek}_${day}`;
    delete records[key];
  });

  triggerCloudSync();
  renderTrackingDayView();
  renderLeaderboard();
  updateHeaderStats();
  showToast(`تم مسح تسجيلات اليوم لـ (${count}) طلاب 🔄`);
};

function getCurrentlyFilteredStudents() {
  const isThursday = appState.currentDay === 'thursday';
  const isTuesday = appState.currentDay === 'tuesday';

  return students.filter(student => {
    // 1. Search Query Filter
    if (appState.searchQuery) {
      if (!student.name.toLowerCase().includes(appState.searchQuery)) {
        return false;
      }
    }

    // 2. Status Filter
    const record = getStudentDayRecord(student.id, appState.currentDay);
    if (appState.activeFilter === 'unrecorded') {
      if (isThursday) {
        return !record.thursdayEarly && !record.thursdayProgram;
      } else {
        return !record.attendance && !record.wird && (!isTuesday || !record.tuesdayLesson);
      }
    } else if (appState.activeFilter === 'done') {
      if (isThursday) {
        return record.thursdayEarly === 'done' && record.thursdayProgram === 'done';
      } else {
        const attDone = record.attendance === 'present';
        const wirdDone = record.wird === 'done';
        const lessonDone = isTuesday ? record.tuesdayLesson === 'present' : true;
        return attDone && wirdDone && lessonDone;
      }
    } else if (appState.activeFilter === 'needs-attention') {
      if (isThursday) {
        return record.thursdayEarly === 'none' || record.thursdayProgram === 'none';
      } else {
        return record.attendance === 'absent' || record.attendance === 'excused' ||
               (isTuesday && (record.tuesdayLesson === 'absent' || record.tuesdayLesson === 'excused'));
      }
    }

    return true;
  });
}

// --- UI & Lifecycle ---
async function initApp() {
  loadData();
  setupEventListeners();
  setupAuthListeners();
  updateAuthGateUI();
  updateDayPills();
  renderCurrentTab();
  updateHeaderStats();

  // Cloud Firestore Initial Fetch & Real-time subscription
  initCloudSync();
}

async function initCloudSync() {
  setSyncStatusUI('syncing', 'جارِ الاتصال بالسحابة...');
  try {
    const cloudData = await loadAppDataFromCloud();
    if (cloudData) {
      if (Array.isArray(cloudData.students) && cloudData.students.length > 0) {
        students = cloudData.students;
        saveStudentsLocally();
      }
      if (cloudData.records && typeof cloudData.records === 'object') {
        records = cloudData.records;
        saveRecordsLocally();
      }
      renderCurrentTab();
      updateHeaderStats();
      setSyncStatusUI('online', 'متزامن سحابياً');
    } else {
      // First time on cloud: seed existing data
      await saveAppDataToCloud(students, records);
      setSyncStatusUI('online', 'متزامن سحابياً');
    }

    // Subscribe to live cloud changes across all devices
    subscribeToCloudChanges((data) => {
      if (!isCloudSyncing && data) {
        let changed = false;
        if (Array.isArray(data.students) && JSON.stringify(data.students) !== JSON.stringify(students)) {
          students = data.students;
          saveStudentsLocally();
          changed = true;
        }
        if (data.records && JSON.stringify(data.records) !== JSON.stringify(records)) {
          records = data.records;
          saveRecordsLocally();
          changed = true;
        }
        if (changed) {
          renderCurrentTab();
          updateHeaderStats();
          setSyncStatusUI('online', 'متزامن سحابياً (مُحدّث)');
        }
      }
    });
  } catch (err) {
    console.error('Cloud Sync init error:', err);
    setSyncStatusUI('offline', 'حفظ محلي (دون اتصال)');
  }
}

function updateAuthGateUI() {
  const gateScreen = document.getElementById('login-gate-screen');
  const appLayout = document.getElementById('app-layout');
  const authBtnLabel = document.getElementById('auth-btn-label');
  const activeAdminName = document.getElementById('active-admin-name');
  const newAdminUsername = document.getElementById('new-admin-username');
  const gateError = document.getElementById('gate-login-error');

  if (authState.isLoggedIn) {
    if (gateScreen) gateScreen.style.display = 'none';
    if (appLayout) appLayout.style.display = 'flex';
    if (authBtnLabel) authBtnLabel.textContent = `👤 ${authState.username}`;
    if (activeAdminName) activeAdminName.textContent = authState.username;
    if (newAdminUsername) newAdminUsername.value = authState.username;
  } else {
    if (gateScreen) gateScreen.style.display = 'flex';
    if (appLayout) appLayout.style.display = 'none';
    if (gateError) gateError.style.display = 'none';
    const pwdInput = document.getElementById('gate-password');
    if (pwdInput) pwdInput.value = '';
  }
}

function setupAuthListeners() {
  const gateForm = document.getElementById('gate-login-form');
  const gateError = document.getElementById('gate-login-error');
  const togglePwdBtn = document.getElementById('btn-toggle-password');
  const gatePwdInput = document.getElementById('gate-password');
  const pwdToggleIcon = document.getElementById('pwd-toggle-icon');

  const authBtn = document.getElementById('btn-auth-action');
  const accountModal = document.getElementById('account-modal');
  const closeAccountBtn = document.getElementById('btn-close-account-modal');
  const cancelAccountBtn = document.getElementById('btn-cancel-account');
  const accountForm = document.getElementById('update-account-form');
  const modalLogoutBtn = document.getElementById('btn-logout');
  const headerLogoutBtn = document.getElementById('btn-header-logout');

  // Toggle Password visibility on Gate Screen
  if (togglePwdBtn && gatePwdInput) {
    togglePwdBtn.addEventListener('click', () => {
      if (gatePwdInput.type === 'password') {
        gatePwdInput.type = 'text';
        if (pwdToggleIcon) pwdToggleIcon.textContent = '🙈';
      } else {
        gatePwdInput.type = 'password';
        if (pwdToggleIcon) pwdToggleIcon.textContent = '👁️';
      }
    });
  }

  // Gate Login Form Submit
  if (gateForm) {
    gateForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const usernameInput = document.getElementById('gate-username').value.trim();
      const passwordInput = document.getElementById('gate-password').value.trim();

      if (usernameInput === authState.username && passwordInput === authState.password) {
        if (gateError) gateError.style.display = 'none';
        authState.isLoggedIn = true;
        saveAuthLocally();
        updateAuthGateUI();
        renderCurrentTab();
        updateHeaderStats();
        showToast(`مرحباً بك يا مشرف (${authState.username})! تم فتح السجل بنجاح 🌟`);
      } else {
        if (gateError) {
          gateError.style.display = 'block';
          gateError.classList.remove('shakeGate');
          void gateError.offsetWidth; // retrigger animation
          gateError.classList.add('shakeGate');
        }
      }
    });
  }

  // Open Account Settings Modal
  if (authBtn && accountModal) {
    authBtn.addEventListener('click', () => {
      accountModal.classList.add('show');
    });
  }

  // Close Account Modal
  [closeAccountBtn, cancelAccountBtn].forEach(btn => {
    if (btn) btn.addEventListener('click', () => {
      if (accountModal) accountModal.classList.remove('show');
    });
  });

  // Update Account info
  if (accountForm) {
    accountForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const newUsername = document.getElementById('new-admin-username').value.trim();
      const newPassword = document.getElementById('new-admin-password').value.trim();

      if (newUsername) {
        authState.username = newUsername;
      }
      if (newPassword) {
        authState.password = newPassword;
      }
      saveAuthLocally();
      updateAuthGateUI();
      if (accountModal) accountModal.classList.remove('show');
      showToast('تم تحديث بيانات حساب المشرف بنجاح ✅');
    });
  }

  // Logout Handlers (from header button or inside account modal)
  const handleLogout = () => {
    authState.isLoggedIn = false;
    saveAuthLocally();
    updateAuthGateUI();
    if (accountModal) accountModal.classList.remove('show');
    showToast('تم تسجيل الخروج وقفل السجل بنجاح 👋');
  };

  if (modalLogoutBtn) modalLogoutBtn.addEventListener('click', handleLogout);
  if (headerLogoutBtn) headerLogoutBtn.addEventListener('click', handleLogout);
}

function setupEventListeners() {
  // Navigation Tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      appState.currentTab = tab.dataset.tab;
      saveStateLocally();
      renderCurrentTab();
    });
  });

  // Selectors
  const monthSelect = document.getElementById('month-select');
  const weekSelect = document.getElementById('week-select');

  if (monthSelect) {
    monthSelect.value = appState.currentMonth;
    monthSelect.addEventListener('change', (e) => {
      appState.currentMonth = e.target.value;
      saveStateLocally();
      renderCurrentTab();
    });
  }

  if (weekSelect) {
    weekSelect.value = appState.currentWeek;
    weekSelect.addEventListener('change', (e) => {
      appState.currentWeek = e.target.value;
      saveStateLocally();
      renderCurrentTab();
    });
  }

  // Day buttons
  document.querySelectorAll('.day-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      appState.currentDay = pill.dataset.day;
      saveStateLocally();
      updateDayPills();
      renderTrackingDayView();
    });
  });

  // Quick Action: Mark All Present
  const markAllPresentBtn = document.getElementById('btn-mark-all-present');
  if (markAllPresentBtn) {
    markAllPresentBtn.addEventListener('click', () => {
      const day = appState.currentDay;
      students.forEach(s => {
        const key = `${s.id}_${appState.currentMonth}_${appState.currentWeek}_${day}`;
        if (!records[key]) records[key] = {};
        
        if (day === 'thursday') {
          records[key].thursdayEarly = 'done';
          records[key].thursdayProgram = 'done';
        } else {
          records[key].attendance = 'present';
          records[key].wird = 'done';
          if (day === 'tuesday') {
            records[key].tuesdayLesson = 'present';
          }
        }
      });
      triggerCloudSync();
      renderTrackingDayView();
      renderLeaderboard();
      updateHeaderStats();
      showToast('تم تسجيل جميع الطلاب بالإنجاز الكامل لهذا اليوم ✨');
    });
  }

  // Quick Action: Clear Day
  const clearDayBtn = document.getElementById('btn-clear-day');
  if (clearDayBtn) {
    clearDayBtn.addEventListener('click', () => {
      const dayConfig = DAYS_CONFIG.find(d => d.id === appState.currentDay);
      const dayName = dayConfig ? dayConfig.name : appState.currentDay;
      openConfirmModal({
        title: 'مسح تسجيلات اليوم',
        message: `هل أنت متأكد من مسح جميع تسجيلات الطلاب ليوم (${dayName}) للأسبوع (${appState.currentWeek})؟`,
        btnText: '🗑️ نعم، مسح اليوم',
        onConfirm: () => {
          const day = appState.currentDay;
          students.forEach(s => {
            const key = `${s.id}_${appState.currentMonth}_${appState.currentWeek}_${day}`;
            delete records[key];
          });
          triggerCloudSync();
          renderTrackingDayView();
          renderLeaderboard();
          updateHeaderStats();
          showToast(`تم مسح تسجيلات يوم ${dayName} بنجاح 🔄`);
        }
      });
    });
  }

  // Add Student Form (Single)
  const addStudentForm = document.getElementById('add-student-form');
  if (addStudentForm) {
    addStudentForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('new-student-name');
      const name = input.value.trim();
      if (!name) return;

      const newStudent = {
        id: 'std_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        name: name,
        createdAt: Date.now()
      };
      students.push(newStudent);
      triggerCloudSync();
      input.value = '';
      renderStudentsList();
      renderTrackingDayView();
      renderLeaderboard();
      updateHeaderStats();
      showToast(`تمت إضافة الطالب "${name}" بنجاح ✅`);
    });
  }

  // Add Bulk Students Form
  const bulkForm = document.getElementById('bulk-student-form');
  const singleTabBtn = document.getElementById('tab-add-single');
  const bulkTabBtn = document.getElementById('tab-add-bulk');
  const bulkTextarea = document.getElementById('bulk-students-names');

  if (singleTabBtn && bulkTabBtn && addStudentForm && bulkForm) {
    singleTabBtn.addEventListener('click', () => {
      singleTabBtn.classList.add('active');
      bulkTabBtn.classList.remove('active');
      addStudentForm.style.display = 'flex';
      bulkForm.style.display = 'none';
    });

    bulkTabBtn.addEventListener('click', () => {
      bulkTabBtn.classList.add('active');
      singleTabBtn.classList.remove('active');
      addStudentForm.style.display = 'none';
      bulkForm.style.display = 'block';
    });
  }

  if (bulkForm && bulkTextarea) {
    bulkForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = bulkTextarea.value.trim();
      if (!text) return;

      const rawLines = text.split(/[\r\n]+/);
      const newNames = rawLines.map(l => l.trim()).filter(l => l.length > 0);

      if (newNames.length === 0) return;

      let addedCount = 0;
      newNames.forEach((name, i) => {
        students.push({
          id: 'std_' + Date.now() + '_' + i + '_' + Math.floor(Math.random() * 1000),
          name: name,
          createdAt: Date.now() + i
        });
        addedCount++;
      });

      triggerCloudSync();
      bulkTextarea.value = '';
      renderStudentsList();
      renderTrackingDayView();
      renderLeaderboard();
      updateHeaderStats();
      showToast(`تمت إضافة ${addedCount} طالب بنجاح 🚀`);
    });
  }

  // Load 50 Sample Students Button (Helper for large classroom testing)
  const sample50Btn = document.getElementById('btn-load-50-sample');
  if (sample50Btn && bulkTextarea) {
    sample50Btn.addEventListener('click', () => {
      const sampleNames = [
        'محمد أحمد المنصوري', 'عبدالله خالد الغامدي', 'عمر عبدالعزيز العتيبي', 'سعد بن فهد القحطاني',
        'خالد إبراهيم الدوسري', 'يوسف صالح السالم', 'إبراهيم ناصر القرني', 'فهد سعود المطيري',
        'تركي ماجد الشهري', 'عبدالرحمن علي الزهراني', 'سلطان حمد البقمي', 'بدر صالح العنزي',
        'حمد عثمان الشمري', 'سلمان راشد المالكي', 'مشاري فواز السبيعي', 'ريان عيسى الرشيدي',
        'فيصل وليد الحربي', 'طارق هاني الصالح', 'زياد ماهر الخالدي', 'حمزة سامي العمري',
        'أنس طلال الرويلي', 'معاذ عادل الفيفي', 'أسامة حازم الهذلي', 'ماجد فيصل العسيري',
        'حسام باسم الثبيتي', 'عاصم نبيل الجهني', 'ياسر كمال الصاعدي', 'نايف جميل البارقي',
        'حاتم فارس التميمي', 'مروان سعيد باوزير', 'غسان سامر اليافعي', 'ليث هيثم السلمي',
        'عزام وائل الحازمي', 'رائد معتز الجابري', 'بشار رامي النجار', 'فراس نادر الصبحي',
        'أيهم حاتم الشريف', 'مؤيد مازن العوفي', 'سند نزار الأحمدي', 'كرم أشرف السفياني',
        'هاشم لؤي المحمادي', 'منصور زاهر اللهيبي', 'جاسم عمار الشلوي', 'فارس قاسم السواط',
        'باسل هتان الصواط', 'تيم وائل النفيعي', 'سامر ماجد المقاطي', 'عمرو زياد الوقداني',
        'سفيان عماد الحارثي', 'قصي فادي الحصيني'
      ];
      bulkTextarea.value = sampleNames.join('\n');
      showToast('تم تعبئة قائمة من 50 اسماً، اضغط (إضافة الدفعة) لتسجيلهم 📋');
    });
  }

  // Search in Tracking Bar
  const searchInput = document.getElementById('student-search-input');
  const clearSearchBtn = document.getElementById('btn-clear-search');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      appState.searchQuery = e.target.value.trim().toLowerCase();
      if (clearSearchBtn) {
        clearSearchBtn.style.display = appState.searchQuery ? 'flex' : 'none';
      }
      renderTrackingDayView();
    });
  }

  if (clearSearchBtn && searchInput) {
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      appState.searchQuery = '';
      clearSearchBtn.style.display = 'none';
      renderTrackingDayView();
      searchInput.focus();
    });
  }

  // Filter Pills (All, Unrecorded, Done, Needs Attention)
  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      appState.activeFilter = pill.dataset.filter;
      renderTrackingDayView();
    });
  });

  // Search in Management List
  const manageSearchInput = document.getElementById('manage-search-input');
  if (manageSearchInput) {
    manageSearchInput.addEventListener('input', (e) => {
      appState.manageSearchQuery = e.target.value.trim().toLowerCase();
      renderStudentsList();
    });
  }

  // Monthly Stats Controls
  const statsMonthSelect = document.getElementById('stats-month-select');
  if (statsMonthSelect) {
    statsMonthSelect.value = appState.statsMonth || appState.currentMonth;
    statsMonthSelect.addEventListener('change', (e) => {
      appState.statsMonth = e.target.value;
      renderMonthlyStats();
    });
  }

  const copyMonthlyReportBtn = document.getElementById('btn-copy-monthly-stats-report');
  if (copyMonthlyReportBtn) {
    copyMonthlyReportBtn.addEventListener('click', () => {
      copyMonthlyStatsReport();
    });
  }

  // WhatsApp Report Modal Handlers
  setupReportModal();
  setupCustomModals();
}

function updateDayPills() {
  document.querySelectorAll('.day-pill').forEach(pill => {
    if (pill.dataset.day === appState.currentDay) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });
}

function updateHeaderStats() {
  const badge = document.getElementById('students-count-badge');
  if (badge) badge.textContent = students.length;

  const pointsVal = document.getElementById('header-points-val');
  if (pointsVal) {
    let sum = 0;
    students.forEach(s => {
      sum += calculateStudentWeekPoints(s.id).total;
    });
    pointsVal.textContent = sum;
  }
}

function renderCurrentTab() {
  const trackingView = document.getElementById('view-tracking');
  const leaderboardView = document.getElementById('view-leaderboard');
  const statsView = document.getElementById('view-stats');
  const studentsView = document.getElementById('view-students');
  const controlBar = document.getElementById('control-bar');

  // مزامنة حالة التبويب النشط
  document.querySelectorAll('.nav-tab').forEach(tab => {
    if (tab.dataset.tab === appState.currentTab) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  const isTracking = appState.currentTab === 'tracking';
  if (trackingView) trackingView.style.display = isTracking ? 'block' : 'none';
  if (leaderboardView) leaderboardView.style.display = appState.currentTab === 'leaderboard' ? 'block' : 'none';
  if (statsView) statsView.style.display = appState.currentTab === 'stats' ? 'block' : 'none';
  if (studentsView) studentsView.style.display = appState.currentTab === 'students' ? 'block' : 'none';

  // إخفاء شريط الشهر والأسابيع والأيام عند فتح ترتيب الطلاب أو الإحصائيات أو الطلاب
  if (controlBar) controlBar.style.display = isTracking ? 'flex' : 'none';

  if (appState.currentTab === 'tracking') {
    renderTrackingDayView();
  } else if (appState.currentTab === 'leaderboard') {
    renderLeaderboard();
  } else if (appState.currentTab === 'stats') {
    renderMonthlyStats();
  } else if (appState.currentTab === 'students') {
    renderStudentsList();
  }
}

// Quick 1-click full day for a single student
window.markStudentFullDay = function(studentId) {
  const day = appState.currentDay;
  const key = `${studentId}_${appState.currentMonth}_${appState.currentWeek}_${day}`;
  if (!records[key]) records[key] = {};

  if (day === 'thursday') {
    records[key].thursdayEarly = 'done';
    records[key].thursdayProgram = 'done';
  } else {
    records[key].attendance = 'present';
    records[key].wird = 'done';
    if (day === 'tuesday') {
      records[key].tuesdayLesson = 'present';
    }
  }
  triggerCloudSync();
  renderTrackingDayView();
  renderLeaderboard();
  updateHeaderStats();
  showToast('تم تسجيل الإنجاز الكامل للطالب ⚡');
};

// --- Tracking View (اليوم والمتابعة - مع البحث والتصفية والتحديد المتعدد وتحمل 50+ طالب بسلاسة) ---
function renderTrackingDayView() {
  const container = document.getElementById('tracking-students-container');
  if (!container) return;

  const isThursday = appState.currentDay === 'thursday';
  const isTuesday = appState.currentDay === 'tuesday';

  // Calculate filter counts for the day
  let unrecordedCount = 0;
  let doneCount = 0;
  let attentionCount = 0;

  students.forEach(student => {
    const record = getStudentDayRecord(student.id, appState.currentDay);
    if (isThursday) {
      const hasAny = record.thursdayEarly || record.thursdayProgram;
      if (!hasAny) unrecordedCount++;
      if (record.thursdayEarly === 'done' && record.thursdayProgram === 'done') doneCount++;
      if (record.thursdayEarly === 'none' || record.thursdayProgram === 'none') attentionCount++;
    } else {
      const hasAny = record.attendance || record.wird || (isTuesday && record.tuesdayLesson);
      if (!hasAny) unrecordedCount++;
      
      const attDone = record.attendance === 'present';
      const wirdDone = record.wird === 'done';
      const lessonDone = isTuesday ? record.tuesdayLesson === 'present' : true;
      if (attDone && wirdDone && lessonDone) doneCount++;

      if (record.attendance === 'absent' || record.attendance === 'excused' || 
          (isTuesday && (record.tuesdayLesson === 'absent' || record.tuesdayLesson === 'excused'))) {
        attentionCount++;
      }
    }
  });

  // Update filter pill badges
  const cAll = document.getElementById('count-filter-all');
  const cUnrec = document.getElementById('count-filter-unrecorded');
  const cDone = document.getElementById('count-filter-done');
  const cAttn = document.getElementById('count-filter-attention');

  if (cAll) cAll.textContent = students.length;
  if (cUnrec) cUnrec.textContent = unrecordedCount;
  if (cDone) cDone.textContent = doneCount;
  if (cAttn) cAttn.textContent = attentionCount;

  // Filter students based on search and activeFilter
  const filteredStudents = getCurrentlyFilteredStudents();

  if (students.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; background: white; border-radius: var(--radius-lg); border: 1px dashed var(--border-color); color: #64748b;">
        <p style="font-size: 1.1rem; font-weight: 700; margin-bottom: 8px;">لا يوجد طلاب مسجلون بعد</p>
        <p style="font-size: 0.9rem;">انتقل إلى تبويب "الطلاب" لإضافة طلاب وتتبعهم بسهولة.</p>
      </div>
    `;
    return;
  }

  if (filteredStudents.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 36px 20px; background: white; border-radius: var(--radius-lg); border: 1px dashed var(--border-color); color: #64748b;">
        <p style="font-size: 1rem; font-weight: 700; margin-bottom: 6px;">لا توجد نتائج مطابقة للتصفية الحالية</p>
        <p style="font-size: 0.85rem;">جرّب تعديل البحث أو الضغط على تصفية "الكل".</p>
      </div>
    `;
    return;
  }

  const allVisibleSelected = filteredStudents.length > 0 && filteredStudents.every(s => selectedStudentIds.has(s.id));
  const someSelected = selectedStudentIds.size > 0;

  let html = '';

  // شريط الإجراءات الجماعية (يظهر عند تحديد طالب واحد أو أكثر)
  if (someSelected) {
    html += `
      <div class="batch-actions-bar" id="batch-actions-bar">
        <div class="batch-bar-info">
          <span class="batch-selection-count">🔘 تم تحديد <b>${selectedStudentIds.size}</b> طالب</span>
          <button type="button" class="btn-clear-selection" onclick="clearStudentSelection()" title="إلغاء تحديد كل الطلاب">
            <span>✖ إلغاء التحديد</span>
          </button>
        </div>
        <div class="batch-buttons-group">
          <!-- إجراءات الحضور -->
          <div class="batch-group">
            <span class="batch-group-title">الحضور:</span>
            <button type="button" class="batch-btn batch-present" onclick="applyBatchAttendance('present')" title="تسجيل المحددين حاضرين">
              <span>✅ حاضر</span>
            </button>
            <button type="button" class="batch-btn batch-excused" onclick="applyBatchAttendance('excused')" title="تسجيل المحددين معتذرين">
              <span>⚠️ معتذر</span>
            </button>
            <button type="button" class="batch-btn batch-absent" onclick="applyBatchAttendance('absent')" title="تسجيل المحددين غائبين">
              <span>❌ غائب</span>
            </button>
          </div>

          <!-- إجراءات الورد -->
          <div class="batch-group">
            <span class="batch-group-title">الورد:</span>
            <button type="button" class="batch-btn batch-present" onclick="applyBatchWird('done')" title="تسجيل الورد منجز">
              <span>✅ منجز</span>
            </button>
            <button type="button" class="batch-btn batch-excused" onclick="applyBatchWird('partial')" title="تسجيل الورد شبه منجز">
              <span>⏳ جزئي</span>
            </button>
            <button type="button" class="batch-btn batch-absent" onclick="applyBatchWird('none')" title="تسجيل الورد لم ينجز">
              <span>❌ لم ينجز</span>
            </button>
          </div>

          ${isTuesday ? `
          <!-- إجراءات درس الثلاثاء -->
          <div class="batch-group">
            <span class="batch-group-title">الدرس:</span>
            <button type="button" class="batch-btn batch-present" onclick="applyBatchTuesday('present')" title="تسجيل حضور الدرس">
              <span>✅ حضر</span>
            </button>
            <button type="button" class="batch-btn batch-excused" onclick="applyBatchTuesday('excused')" title="تسجيل اعتذار الدرس">
              <span>⚠️ اعتذر</span>
            </button>
            <button type="button" class="batch-btn batch-absent" onclick="applyBatchTuesday('absent')" title="تسجيل غياب الدرس">
              <span>❌ غائب</span>
            </button>
          </div>
          ` : ''}

          ${isThursday ? `
          <!-- إجراءات الخميس -->
          <div class="batch-group">
            <span class="batch-group-title">الخميسية:</span>
            <button type="button" class="batch-btn batch-present" onclick="applyBatchThursday('thursdayEarly', 'done')" title="تسجيل التبكير للخميسية">
              <span>✅ التبكير</span>
            </button>
            <button type="button" class="batch-btn batch-present" onclick="applyBatchThursday('thursdayProgram', 'done')" title="تسجيل البرنامج الفردي">
              <span>✅ البرنامج</span>
            </button>
          </div>
          ` : ''}

          <!-- عمليات سريعة -->
          <div class="batch-group-actions">
            <button type="button" class="batch-btn batch-full" onclick="applyBatchFullDay()" title="تسجيل كل البنود مكتملة للمحددين">
              <span>⚡ إنجاز كامل</span>
            </button>
            <button type="button" class="batch-btn batch-clear" onclick="applyBatchClear()" title="مسح رصد اليوم للمحددين">
              <span>🔄 مسح اليوم</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  html += `
    <!-- ترويسة الأعمدة للشاشات المتوسطة والكبيرة -->
    <div class="compact-table-header">
      <div class="col-student-header">
        <label class="select-all-checkbox-wrapper" title="تحديد / إلغاء تحديد الكل">
          <input type="checkbox" id="chk-select-all-visible" ${allVisibleSelected ? 'checked' : ''} onchange="toggleSelectAllVisible(this.checked)">
          <span class="select-all-text">تحديد الكل (${filteredStudents.length})</span>
        </label>
      </div>
      ${isThursday ? `
        <div class="col-field text-center">التبكير للخميسية (5)</div>
        <div class="col-field text-center">البرنامج الفردي (5)</div>
      ` : `
        <div class="col-field text-center">الحضور (✅ 3 / ⚠️ 1 / ❌ 0)</div>
        <div class="col-field text-center">الورد اليومي (✅ 3 / ⏳ 1 / ❌ 0)</div>
        ${isTuesday ? `<div class="col-field text-center">درس الثلاثاء (✅ 3 / ⚠️ 1 / ❌ 0)</div>` : ''}
      `}
      <div class="col-points text-center">النقاط</div>
    </div>
  `;

  filteredStudents.forEach((student) => {
    const studentIdx = students.findIndex(s => s.id === student.id) + 1;
    const record = getStudentDayRecord(student.id, appState.currentDay);
    const weekStats = calculateStudentWeekPoints(student.id);
    const dayPoints = calculateDayPoints(record, appState.currentDay);
    const isSelected = selectedStudentIds.has(student.id);

    html += `
      <div class="student-compact-row ${isSelected ? 'selected' : ''}" id="row-${student.id}">
        <!-- هوية الطالب مع خانة التحديد -->
        <div class="row-student-info">
          <label class="student-checkbox-label" title="تحديد الطالب لإجراء جماعي">
            <input type="checkbox" class="student-select-box" ${isSelected ? 'checked' : ''} onchange="toggleStudentSelect('${student.id}', this.checked)">
          </label>
          <div class="student-avatar-compact">${studentIdx}</div>
          <div class="student-name-compact" title="${escapeHtml(student.name)}">
            ${escapeHtml(student.name)}
          </div>
          <button type="button" class="btn-quick-full" title="تسجيل إنجاز كامل للطالب اليوم" 
            onclick="markStudentFullDay('${student.id}')">
            <span>⚡ الكل تم</span>
          </button>
        </div>

        <!-- مجموعات الرصد المدمجة -->
        <div class="row-fields-group">
    `;

    if (isThursday) {
      // الخميس
      html += `
          <!-- التبكير للخميسية -->
          <div class="compact-cell">
            <span class="compact-cell-label">الخميسية (5):</span>
            <div class="compact-btn-group two-btns">
              <button type="button" class="compact-btn thursday-done ${record.thursdayEarly === 'done' ? 'active' : ''}" 
                title="أنجز (5 نقاط)"
                onclick="setStudentDayField('${student.id}', 'thursdayEarly', 'done')">
                <span>✅</span>
              </button>
              <button type="button" class="compact-btn thursday-none ${record.thursdayEarly === 'none' ? 'active' : ''}" 
                title="لم ينجز (0)"
                onclick="setStudentDayField('${student.id}', 'thursdayEarly', 'none')">
                <span>❌</span>
              </button>
            </div>
          </div>

          <!-- البرنامج الفردي -->
          <div class="compact-cell">
            <span class="compact-cell-label">البرنامج (5):</span>
            <div class="compact-btn-group two-btns">
              <button type="button" class="compact-btn thursday-done ${record.thursdayProgram === 'done' ? 'active' : ''}" 
                title="أنجز (5 نقاط)"
                onclick="setStudentDayField('${student.id}', 'thursdayProgram', 'done')">
                <span>✅</span>
              </button>
              <button type="button" class="compact-btn thursday-none ${record.thursdayProgram === 'none' ? 'active' : ''}" 
                title="لم ينجز (0)"
                onclick="setStudentDayField('${student.id}', 'thursdayProgram', 'none')">
                <span>❌</span>
              </button>
            </div>
          </div>
      `;
    } else {
      // الأحد إلى الأربعاء
      html += `
          <!-- الحضور: صح / تحذير صفراء / إكس -->
          <div class="compact-cell">
            <span class="compact-cell-label">الحضور:</span>
            <div class="compact-btn-group">
              <button type="button" class="compact-btn present ${record.attendance === 'present' ? 'active' : ''}" 
                title="حاضر (3 نقاط)"
                onclick="setStudentDayField('${student.id}', 'attendance', 'present')">
                <span>✅</span>
              </button>
              <button type="button" class="compact-btn excused ${record.attendance === 'excused' ? 'active' : ''}" 
                title="معتذر (نقطة واحدة)"
                onclick="setStudentDayField('${student.id}', 'attendance', 'excused')">
                <span>⚠️</span>
              </button>
              <button type="button" class="compact-btn absent ${record.attendance === 'absent' ? 'active' : ''}" 
                title="غائب (0)"
                onclick="setStudentDayField('${student.id}', 'attendance', 'absent')">
                <span>❌</span>
              </button>
            </div>
          </div>

          <!-- الورد اليومي: أنجز صح / شبه ساعة رملية / لم ينجز خطأ -->
          <div class="compact-cell">
            <span class="compact-cell-label">الورد:</span>
            <div class="compact-btn-group">
              <button type="button" class="compact-btn present ${record.wird === 'done' ? 'active' : ''}" 
                title="أنجز الورد (3 نقاط)"
                onclick="setStudentDayField('${student.id}', 'wird', 'done')">
                <span>✅</span>
              </button>
              <button type="button" class="compact-btn excused ${record.wird === 'partial' ? 'active' : ''}" 
                title="شبه منجز (نقطة واحدة)"
                onclick="setStudentDayField('${student.id}', 'wird', 'partial')">
                <span>⏳</span>
              </button>
              <button type="button" class="compact-btn absent ${record.wird === 'none' ? 'active' : ''}" 
                title="لم ينجز (0)"
                onclick="setStudentDayField('${student.id}', 'wird', 'none')">
                <span>❌</span>
              </button>
            </div>
          </div>
      `;

      if (isTuesday) {
        html += `
          <!-- حضور الدرس (الثلاثاء): صح / تحذير / إكس -->
          <div class="compact-cell tuesday-cell">
            <span class="compact-cell-label" style="color: #1e40af;">الدرس:</span>
            <div class="compact-btn-group">
              <button type="button" class="compact-btn present ${record.tuesdayLesson === 'present' ? 'active' : ''}" 
                title="حضر الدرس (3 نقاط)"
                onclick="setStudentDayField('${student.id}', 'tuesdayLesson', 'present')">
                <span>✅</span>
              </button>
              <button type="button" class="compact-btn excused ${record.tuesdayLesson === 'excused' ? 'active' : ''}" 
                title="معتذر (نقطة واحدة)"
                onclick="setStudentDayField('${student.id}', 'tuesdayLesson', 'excused')">
                <span>⚠️</span>
              </button>
              <button type="button" class="compact-btn absent ${record.tuesdayLesson === 'absent' ? 'active' : ''}" 
                title="غائب (0)"
                onclick="setStudentDayField('${student.id}', 'tuesdayLesson', 'absent')">
                <span>❌</span>
              </button>
            </div>
          </div>
        `;
      }
    }

    html += `
        </div>

        <!-- النقاط المدمجة -->
        <div class="row-points-badge">
          <div class="day-pts-box" title="نقاط اليوم">
            <span class="pts-tag">اليوم</span>
            <b class="pts-val">${dayPoints}</b>
          </div>
          <div class="week-pts-box" title="مجموع نقاط الأسبوع">
            <span class="pts-tag">الأسبوع</span>
            <b class="pts-val-week">${weekStats.total}</b>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// --- Leaderboard View (ترتيب الطلاب - مع الأرقام التفصيلية والميداليات الأنيقة ومنطقة الهبوط ووسام المتألق) ---
function renderLeaderboard() {
  const container = document.getElementById('leaderboard-content');
  if (!container) return;

  if (students.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 30px; color: #64748b;">
        لا توجد بيانات لعرض الترتيب.
      </div>
    `;
    return;
  }

  const prevPeriod = getPreviousPeriod(appState.currentMonth, appState.currentWeek);

  // Calculate scores, point jumps, and detailed stats for all students
  const studentScores = students.map(s => {
    const detailed = getStudentDetailedWeekStats(s.id, appState.currentWeek, appState.currentMonth);
    const prevDetailed = prevPeriod 
      ? getStudentDetailedWeekStats(s.id, prevPeriod.week, prevPeriod.month)
      : { total: 0 };

    // Jump in points compared to previous week
    const jump = detailed.total - (prevPeriod ? prevDetailed.total : 0);

    return {
      id: s.id,
      name: s.name,
      total: detailed.total,
      prevTotal: prevPeriod ? prevDetailed.total : 0,
      jump: jump,
      stats: detailed
    };
  });

  // Sort descending by current week total
  studentScores.sort((a, b) => b.total - a.total);
  const maxPointsPossible = 40; // Approx max possible per week
  const totalCount = studentScores.length;

  // Identify students who achieved the highest positive jump in points
  const positiveJumps = studentScores.map(s => s.jump).filter(j => j > 0);
  const maxJump = positiveJumps.length > 0 ? Math.max(...positiveJumps) : 0;
  const hasClimber = maxJump > 0;
  const topClimbers = hasClimber ? studentScores.filter(s => s.jump === maxJump && s.jump > 0) : [];

  let tableHtml = '';

  // Top Climber Banner (شريط إبراز المتألق صاحب أعلى قفزة نقطية)
  if (hasClimber && topClimbers.length > 0) {
    const topNames = topClimbers.map(c => `<b>${escapeHtml(c.name)}</b>`).join(' و ');
    const prevDesc = prevPeriod ? `مقارنة بـ ${prevPeriod.label}` : 'عن بداية السجل';
    tableHtml += `
      <div class="top-climber-banner" id="top-climber-highlight-banner">
        <div class="top-climber-icon">✨</div>
        <div class="top-climber-content">
          <span class="top-climber-title">وسام المتألق لهذا الأسبوع:</span>
          <span class="top-climber-names">${topNames}</span>
          <span class="top-climber-meta">(أعلى قفزة نقاط: <b class="jump-highlight-text">+${maxJump} نقطة</b> ${prevDesc})</span>
        </div>
      </div>
    `;
  }

  tableHtml += `
    <div style="overflow-x: auto;">
      <table class="leaderboard-table">
        <thead>
          <tr>
            <th style="width: 70px; text-align: center;">المركز</th>
            <th style="min-width: 190px;">اسم الطالب</th>
            <th style="text-align: center; min-width: 130px;" title="عدد الأيام: حضور / اعتذار / غياب">الحضور (أيام)</th>
            <th style="text-align: center; min-width: 130px;" title="عدد الأيام: منجز / جزئي / لم ينجز">الورد (أيام)</th>
            <th style="text-align: center; min-width: 90px;">درس الثلاثاء</th>
            <th style="text-align: center; min-width: 100px;">الخميسية</th>
            <th style="text-align: center; min-width: 110px;">نسبة الإنجاز</th>
            <th style="text-align: center; font-weight: 800; min-width: 110px;">المجموع الكلي</th>
          </tr>
        </thead>
        <tbody>
  `;

  studentScores.forEach((s, idx) => {
    // Medal Badges - Well-proportioned & Beautifully styled
    let rankBadge = `<span class="rank-badge rank-other">${idx + 1}</span>`;
    if (idx === 0) rankBadge = `<span class="rank-badge rank-1" title="المركز الأول">🥇 1</span>`;
    else if (idx === 1) rankBadge = `<span class="rank-badge rank-2" title="المركز الثاني">🥈 2</span>`;
    else if (idx === 2) rankBadge = `<span class="rank-badge rank-3" title="المركز الثالث">🥉 3</span>`;

    // هل حقق أعلى قفزة في النقاط؟
    const isTopClimber = hasClimber && s.jump === maxJump && s.jump > 0;

    // آخر 5 مراكز: خلفية حمراء وملاحظة "يصارع الهبوط"
    const isRelegationZone = totalCount >= 5 && idx >= totalCount - 5;
    const progressPct = Math.min(100, Math.max(0, Math.round((s.total / maxPointsPossible) * 100)));

    // درس الثلاثاء بصيغة نصية واضحة ومختصرة
    let tuesdayBadge = '<span class="status-pill unrec">⚪ -</span>';
    if (s.stats.tuesdayLesson === 'present') {
      tuesdayBadge = '<span class="status-pill present">✅ حاضر</span>';
    } else if (s.stats.tuesdayLesson === 'excused') {
      tuesdayBadge = '<span class="status-pill excused">⚠️ معتذر</span>';
    } else if (s.stats.tuesdayLesson === 'absent') {
      tuesdayBadge = '<span class="status-pill absent">❌ غائب</span>';
    }

    // الخميسية بصيغة أرقام وعلامات واضحة
    let thursdayText = [];
    if (s.stats.thursday.early === 'done') thursdayText.push('✅ تبكير');
    if (s.stats.thursday.program === 'done') thursdayText.push('✅ برنامج');
    const thursdayBadge = thursdayText.length > 0 
      ? `<span class="status-pill present" style="font-size: 0.76rem;">${thursdayText.join(' + ')}</span>`
      : (s.stats.thursday.early === 'none' && s.stats.thursday.program === 'none')
        ? '<span class="status-pill absent">❌ لم ينجز</span>'
        : '<span class="status-pill unrec">⚪ -</span>';

    tableHtml += `
      <tr class="${isRelegationZone ? 'relegation-danger-row' : ''} ${isTopClimber ? 'top-climber-row' : ''}">
        <td style="text-align: center;">${rankBadge}</td>
        <td>
          <div class="leaderboard-student-col">
            <span class="leaderboard-student-name">${escapeHtml(s.name)}</span>
            ${isTopClimber ? `
              <span class="star-climber-badge" title="وسام المتألق: حقق أعلى قفزة في عدد النقاط هذا الأسبوع (+${s.jump} نقطة)">
                <span class="star-icon">✨</span>
                <span class="star-label">المتألق</span>
                <span class="star-jump">+${s.jump}</span>
              </span>
            ` : ''}
            ${isRelegationZone ? '<span class="relegation-note-badge" title="من بين آخر 5 مراكز">⚠️ يصارع الهبوط</span>' : ''}
          </div>
        </td>
        <!-- الحضور: عدد أيام الحضور / الاعتذار / الغياب -->
        <td style="text-align: center;">
          <div class="stat-counts-pill-group">
            <span class="stat-count-chip present" title="${s.stats.attDays.present} أيام حضور">✅ ${s.stats.attDays.present}</span>
            <span class="stat-count-chip excused" title="${s.stats.attDays.excused} أيام اعتذار">⚠️ ${s.stats.attDays.excused}</span>
            <span class="stat-count-chip absent" title="${s.stats.attDays.absent} أيام غياب">❌ ${s.stats.attDays.absent}</span>
          </div>
        </td>
        <!-- الورد: عدد أيام الإنجاز / الشبه / لم ينجز -->
        <td style="text-align: center;">
          <div class="stat-counts-pill-group">
            <span class="stat-count-chip present" title="${s.stats.wirdDays.done} أيام أنجز">✅ ${s.stats.wirdDays.done}</span>
            <span class="stat-count-chip partial" title="${s.stats.wirdDays.partial} أيام جزئي">⏳ ${s.stats.wirdDays.partial}</span>
            <span class="stat-count-chip absent" title="${s.stats.wirdDays.none} أيام لم ينجز">❌ ${s.stats.wirdDays.none}</span>
          </div>
        </td>
        <!-- درس الثلاثاء -->
        <td style="text-align: center;">
          ${tuesdayBadge}
        </td>
        <!-- الخميسية -->
        <td style="text-align: center;">
          ${thursdayBadge}
        </td>
        <!-- نسبة الإنجاز -->
        <td style="text-align: center;">
          <div class="progress-bar-container" title="${progressPct}%">
            <div class="progress-bar-fill" style="width: ${progressPct}%;"></div>
          </div>
          <span style="font-size: 0.76rem; color: #64748b; font-weight: 700;">${progressPct}%</span>
        </td>
        <!-- المجموع الكلي -->
        <td style="text-align: center;">
          <span class="points-total-pill ${isRelegationZone ? 'relegation-pts' : ''}">
            <b>${s.total}</b> نقطة
          </span>
        </td>
      </tr>
    `;
  });

  tableHtml += `
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = tableHtml;
}

// --- Monthly Statistics & Performance Summary (الملخص الإحصائي لأداء الطلاب على مستوى الشهر) ---
const WEEKS_LIST = ['الأسبوع 1', 'الأسبوع 2', 'الأسبوع 3', 'الأسبوع 4', 'الأسبوع 5'];

function getMonthlyPerformanceSummary(month = appState.statsMonth || appState.currentMonth) {
  const totalStudents = students.length;
  if (totalStudents === 0) {
    return {
      month,
      totalStudents: 0,
      totalPoints: 0,
      averagePoints: 0,
      mostCommittedCount: 0,
      mostCommittedStudents: [],
      overallAttendanceRate: 0,
      overallWirdRate: 0,
      tuesdayLessonRate: 0,
      thursdayParticipationRate: 0,
      weeklyStats: [],
      studentSummaries: []
    };
  }

  let grandTotalPoints = 0;
  let totalAttPresent = 0;
  let totalAttRecorded = 0;
  let totalWirdDone = 0;
  let totalWirdRecorded = 0;
  let totalTuesdayPresent = 0;
  let totalTuesdayRecorded = 0;
  let totalThursdayPresent = 0;
  let totalThursdayRecorded = 0;

  // Analysis per week
  const weeklyStats = WEEKS_LIST.map(week => {
    let weekTotalPts = 0;
    let weekAttPresent = 0;
    let weekAttCount = 0;
    let weekWirdDone = 0;
    let weekWirdCount = 0;
    let weekTopStudent = { name: '-', points: 0 };

    students.forEach(s => {
      const { total } = calculateStudentWeekPoints(s.id, week, month);
      weekTotalPts += total;
      if (total > weekTopStudent.points) {
        weekTopStudent = { name: s.name, points: total };
      }

      DAYS_CONFIG.forEach(d => {
        const rec = getStudentDayRecord(s.id, d.id, week, month);
        if (d.id !== 'thursday') {
          if (rec.attendance === 'present' || rec.attendance === 'excused' || rec.attendance === 'absent') {
            weekAttCount++;
            if (rec.attendance === 'present') weekAttPresent++;
          }
          if (rec.wird === 'done' || rec.wird === 'partial' || rec.wird === 'none') {
            weekWirdCount++;
            if (rec.wird === 'done') weekWirdDone++;
          }
        }
      });
    });

    const weekAvg = totalStudents > 0 ? (weekTotalPts / totalStudents).toFixed(1) : 0;
    const weekAttRate = weekAttCount > 0 ? Math.round((weekAttPresent / weekAttCount) * 100) : 0;
    const weekWirdRate = weekWirdCount > 0 ? Math.round((weekWirdDone / weekWirdCount) * 100) : 0;

    return {
      week,
      totalPoints: weekTotalPts,
      avgPoints: Number(weekAvg),
      topStudent: weekTopStudent,
      attRate: weekAttRate,
      wirdRate: weekWirdRate
    };
  });

  // Analysis per student across month
  const studentSummaries = students.map(s => {
    let studentMonthPts = 0;
    let weekBreakdown = {};
    let attDays = { present: 0, excused: 0, absent: 0, total: 0 };
    let wirdDays = { done: 0, partial: 0, none: 0, total: 0 };
    let tuesdayCount = { present: 0, total: 0 };
    let thursdayCount = { done: 0, total: 0 };

    WEEKS_LIST.forEach(week => {
      const { total } = calculateStudentWeekPoints(s.id, week, month);
      studentMonthPts += total;
      weekBreakdown[week] = total;

      DAYS_CONFIG.forEach(d => {
        const rec = getStudentDayRecord(s.id, d.id, week, month);
        if (d.id === 'thursday') {
          if (rec.thursdayEarly || rec.thursdayProgram) {
            thursdayCount.total++;
            totalThursdayRecorded++;
            if (rec.thursdayEarly === 'done' || rec.thursdayProgram === 'done') {
              thursdayCount.done++;
              totalThursdayPresent++;
            }
          }
        } else {
          if (rec.attendance === 'present' || rec.attendance === 'excused' || rec.attendance === 'absent') {
            attDays.total++;
            totalAttRecorded++;
            if (rec.attendance === 'present') { attDays.present++; totalAttPresent++; }
            else if (rec.attendance === 'excused') { attDays.excused++; }
            else if (rec.attendance === 'absent') { attDays.absent++; }
          }

          if (rec.wird === 'done' || rec.wird === 'partial' || rec.wird === 'none') {
            wirdDays.total++;
            totalWirdRecorded++;
            if (rec.wird === 'done') { wirdDays.done++; totalWirdDone++; }
            else if (rec.wird === 'partial') { wirdDays.partial++; }
            else if (rec.wird === 'none') { wirdDays.none++; }
          }

          if (d.id === 'tuesday') {
            if (rec.tuesdayLesson === 'present' || rec.tuesdayLesson === 'excused' || rec.tuesdayLesson === 'absent') {
              tuesdayCount.total++;
              totalTuesdayRecorded++;
              if (rec.tuesdayLesson === 'present') {
                tuesdayCount.present++;
                totalTuesdayPresent++;
              }
            }
          }
        }
      });
    });

    grandTotalPoints += studentMonthPts;

    // Rate calculation
    const maxPossiblePoints = 200; // 40 pts * 5 weeks
    const pointsCommitmentRate = Math.min(100, Math.max(0, Math.round((studentMonthPts / maxPossiblePoints) * 100)));
    const attendancePct = attDays.total > 0 ? Math.round((attDays.present / attDays.total) * 100) : 0;
    const wirdPct = wirdDays.total > 0 ? Math.round((wirdDays.done / wirdDays.total) * 100) : 0;

    return {
      id: s.id,
      name: s.name,
      totalPoints: studentMonthPts,
      weekBreakdown,
      attDays,
      wirdDays,
      tuesdayCount,
      thursdayCount,
      commitmentRate: pointsCommitmentRate,
      attendancePct,
      wirdPct
    };
  });

  // Sort descending by monthly total points
  studentSummaries.sort((a, b) => b.totalPoints - a.totalPoints);

  const averagePoints = totalStudents > 0 ? (grandTotalPoints / totalStudents).toFixed(1) : 0;
  const overallAttendanceRate = totalAttRecorded > 0 ? Math.round((totalAttPresent / totalAttRecorded) * 100) : 0;
  const overallWirdRate = totalWirdRecorded > 0 ? Math.round((totalWirdDone / totalWirdRecorded) * 100) : 0;
  const tuesdayLessonRate = totalTuesdayRecorded > 0 ? Math.round((totalTuesdayPresent / totalTuesdayRecorded) * 100) : 0;
  const thursdayParticipationRate = totalThursdayRecorded > 0 ? Math.round((totalThursdayPresent / totalThursdayRecorded) * 100) : 0;

  // Most committed students: (have points and commitment rate >= 60% or points above average)
  const avgPtsVal = Number(averagePoints);
  const mostCommittedStudents = studentSummaries.filter(s => s.totalPoints > 0 && (s.commitmentRate >= 60 || s.totalPoints >= avgPtsVal));

  return {
    month,
    totalStudents,
    totalPoints: grandTotalPoints,
    averagePoints: Number(averagePoints),
    mostCommittedCount: mostCommittedStudents.length,
    mostCommittedStudents,
    overallAttendanceRate,
    overallWirdRate,
    tuesdayLessonRate,
    thursdayParticipationRate,
    weeklyStats,
    studentSummaries
  };
}

function renderMonthlyStats() {
  const selectedMonth = appState.statsMonth || appState.currentMonth || 'شهر 1';
  const subtitle = document.getElementById('stats-period-subtitle');
  if (subtitle) {
    subtitle.textContent = `ملخص بسيط وشامل لنقاط وحضور وإنجاز الطلاب في (${selectedMonth})`;
  }

  const monthSelect = document.getElementById('stats-month-select');
  if (monthSelect) {
    monthSelect.value = selectedMonth;
  }

  const stats = getMonthlyPerformanceSummary(selectedMonth);

  renderMonthlyKPIs(stats);
  renderMonthlyTopCommitted(stats);
}

function renderMonthlyKPIs(stats) {
  const container = document.getElementById('stats-kpi-cards');
  if (!container) return;

  const html = `
    <!-- 1. متوسط النقاط الكلي -->
    <div class="kpi-card kpi-avg">
      <div class="kpi-header">
        <span class="kpi-title">متوسط النقاط الكلي</span>
        <span class="kpi-icon">🎯</span>
      </div>
      <div class="kpi-value-row">
        <span class="kpi-value">${stats.averagePoints}</span>
        <span class="kpi-unit">نقطة / طالب</span>
      </div>
      <div class="kpi-footer">
        <span>معدل الأداء الفردي في <b>${stats.month}</b></span>
      </div>
    </div>

    <!-- 2. الطلاب الأكثر التزاماً -->
    <div class="kpi-card kpi-committed">
      <div class="kpi-header">
        <span class="kpi-title">الطلاب الأكثر التزاماً</span>
        <span class="kpi-icon">🌟</span>
      </div>
      <div class="kpi-value-row">
        <span class="kpi-value">${stats.mostCommittedCount}</span>
        <span class="kpi-unit">طالب متفوق</span>
      </div>
      <div class="kpi-footer">
        <span>نسبة المتفوقين: <b>${stats.totalStudents > 0 ? Math.round((stats.mostCommittedCount / stats.totalStudents) * 100) : 0}%</b></span>
      </div>
    </div>

    <!-- 3. معدل التزام الحضور -->
    <div class="kpi-card kpi-att">
      <div class="kpi-header">
        <span class="kpi-title">نسبة الحضور العام</span>
        <span class="kpi-icon">👥</span>
      </div>
      <div class="kpi-value-row">
        <span class="kpi-value">${stats.overallAttendanceRate}%</span>
        <span class="kpi-unit">حضور فعلي</span>
      </div>
      <div class="kpi-footer">
        <span>إجمالي أيام الحضور في الشهر</span>
      </div>
    </div>

    <!-- 4. معدل إنجاز الورد اليومي -->
    <div class="kpi-card kpi-wird">
      <div class="kpi-header">
        <span class="kpi-title">نسبة إنجاز الورد</span>
        <span class="kpi-icon">📖</span>
      </div>
      <div class="kpi-value-row">
        <span class="kpi-value">${stats.overallWirdRate}%</span>
        <span class="kpi-unit">إنجاز كامل</span>
      </div>
      <div class="kpi-footer">
        <span>التزام الأوراد والتلاوة القرآنية</span>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function renderMonthlyTopCommitted(stats) {
  const container = document.getElementById('stats-top-committed-container');
  const countBadge = document.getElementById('stats-committed-count-badge');
  if (!container) return;

  if (countBadge) {
    countBadge.textContent = `${stats.mostCommittedCount} متفوقين`;
  }

  if (stats.mostCommittedStudents.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 20px 16px; color: #64748b;">
        <span style="font-size: 1.8rem; display: block; margin-bottom: 4px;">📝</span>
        <p style="font-size: 0.86rem; font-weight: 700;">لا توجد نقاط مسجلة لهذا الشهر حتى الآن.</p>
        <p style="font-size: 0.78rem; margin-top: 2px;">سجّل الحضور والورد في شاشة المتابعة لتظهر لوحة الشرف هنا.</p>
      </div>
    `;
    return;
  }

  // Display top committed students
  const topList = stats.mostCommittedStudents.slice(0, 6);
  let html = '<div class="top-committed-list">';

  topList.forEach((s, idx) => {
    let rankClass = 'rank-top-rest';
    let medal = `${idx + 1}`;
    if (idx === 0) { rankClass = 'rank-top-1'; medal = '🥇 1'; }
    else if (idx === 1) { rankClass = 'rank-top-2'; medal = '🥈 2'; }
    else if (idx === 2) { rankClass = 'rank-top-3'; medal = '🥉 3'; }

    html += `
      <div class="top-committed-item">
        <div class="top-committed-info">
          <span class="top-committed-rank ${rankClass}">${medal}</span>
          <span class="top-committed-name">${escapeHtml(s.name)}</span>
        </div>
        <div class="top-committed-metrics">
          <span class="commitment-rate-badge" title="نسبة الالتزام بالشهر">
            ⭐ ${s.commitmentRate}% التزام
          </span>
          <span class="commitment-points-badge" title="إجمالي النقاط الشهرية">
            <b>${s.totalPoints}</b> نقطة
          </span>
        </div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
}

function copyMonthlyStatsReport() {
  const selectedMonth = appState.statsMonth || appState.currentMonth || 'شهر 1';
  const stats = getMonthlyPerformanceSummary(selectedMonth);

  let text = `📊 *ملخص إحصائيات الشهر - متابعة طلاب تكوين النسيم*\n`;
  text += `📅 *الشهر:* ${selectedMonth}\n`;
  text += `👥 *إجمالي الطلاب المسجلين:* ${stats.totalStudents} طالب\n`;
  text += `━━━━━━━━━━━━━━━\n\n`;

  text += `📈 *المؤشرات الإحصائية العامة:*\n`;
  text += `🎯 *متوسط النقاط الكلي:* ${stats.averagePoints} نقطة / طالب\n`;
  text += `🌟 *الطلاب الأكثر التزاماً:* ${stats.mostCommittedCount} طالب (${stats.totalStudents > 0 ? Math.round((stats.mostCommittedCount / stats.totalStudents) * 100) : 0}%)\n`;
  text += `👥 *معدل التزام الحضور العام:* ${stats.overallAttendanceRate}%\n`;
  text += `📖 *معدل إنجاز الورد اليومي:* ${stats.overallWirdRate}%\n`;
  text += `✨ *إجمالي النقاط المسجلة:* ${stats.totalPoints.toLocaleString('ar-SA')} نقطة\n\n`;

  if (stats.mostCommittedStudents.length > 0) {
    text += `🌟 *لوحة شرف الطلاب الأكثر التزاماً في ${selectedMonth}:*\n`;
    stats.mostCommittedStudents.slice(0, 8).forEach((s, idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '⭐';
      text += `${idx + 1}. ${medal} *${s.name}* - ${s.totalPoints} نقطة (التزام ${s.commitmentRate}%)\n`;
    });
    text += `\n`;
  }

  text += `━━━━━━━━━━━━━━━\n`;
  text += `تكوين النسيم - معاً نحو الريادة والتميز 🌿`;

  copyToClipboard(text);
}

// --- Students Management View ---
function renderStudentsList() {
  const container = document.getElementById('students-manage-list');
  const countLabel = document.getElementById('manage-count-label');
  if (!container) return;

  if (countLabel) countLabel.textContent = students.length;

  if (students.length === 0) {
    container.innerHTML = `<p style="color: #64748b; font-size: 0.88rem; padding: 16px; text-align: center; background: white; border-radius: var(--radius-md); border: 1px dashed var(--border-color);">لا يوجد طلاب حالياً. أضف طلابك باستخدام النموذج أعلاه.</p>`;
    return;
  }

  const query = appState.manageSearchQuery || '';
  const filtered = students.filter(s => !query || s.name.toLowerCase().includes(query));

  if (filtered.length === 0) {
    container.innerHTML = `<p style="color: #64748b; font-size: 0.88rem; padding: 14px; text-align: center;">لا توجد أسماء مطابقة لكلمة "${escapeHtml(query)}"</p>`;
    return;
  }

  let html = '';
  filtered.forEach((student) => {
    const studentIdx = students.findIndex(s => s.id === student.id) + 1;
    html += `
      <div class="student-manage-item">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="color: #94a3b8; font-weight: 700; width: 26px;">#${studentIdx}</span>
          <b style="font-size: 0.95rem; color: #1e293b;">${escapeHtml(student.name)}</b>
        </div>
        <div class="student-manage-actions">
          <button class="btn btn-sm btn-outline" onclick="renameStudentPrompt('${student.id}')" title="تعديل الاسم">
            ✏️ تعديل
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteStudentConfirm('${student.id}')" title="حذف الطالب">
            🗑️ حذف
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

let confirmCallback = null;

function setupCustomModals() {
  // 1. Confirm Modal
  const confirmModal = document.getElementById('confirm-modal');
  const btnCloseConfirm = document.getElementById('btn-close-confirm-modal');
  const btnCancelConfirm = document.getElementById('btn-cancel-confirm');
  const btnActionConfirm = document.getElementById('btn-action-confirm');

  const closeConfirm = () => {
    if (confirmModal) confirmModal.classList.remove('show');
    confirmCallback = null;
  };

  if (btnCloseConfirm) btnCloseConfirm.addEventListener('click', closeConfirm);
  if (btnCancelConfirm) btnCancelConfirm.addEventListener('click', closeConfirm);
  if (confirmModal) {
    confirmModal.addEventListener('click', (e) => {
      if (e.target === confirmModal) closeConfirm();
    });
  }

  if (btnActionConfirm) {
    btnActionConfirm.addEventListener('click', () => {
      if (typeof confirmCallback === 'function') {
        const cb = confirmCallback;
        closeConfirm();
        cb();
      } else {
        closeConfirm();
      }
    });
  }

  // 2. Edit Student Modal
  const editModal = document.getElementById('edit-student-modal');
  const btnCloseEdit = document.getElementById('btn-close-edit-student-modal');
  const btnCancelEdit = document.getElementById('btn-cancel-edit-student');
  const editForm = document.getElementById('edit-student-form');
  const editInput = document.getElementById('edit-student-input-name');

  const closeEdit = () => {
    if (editModal) editModal.classList.remove('show');
  };

  if (btnCloseEdit) btnCloseEdit.addEventListener('click', closeEdit);
  if (btnCancelEdit) btnCancelEdit.addEventListener('click', closeEdit);
  if (editModal) {
    editModal.addEventListener('click', (e) => {
      if (e.target === editModal) closeEdit();
    });
  }

  if (editForm && editInput) {
    editForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const studentId = editForm.dataset.studentId;
      const newName = editInput.value.trim();
      if (!newName || !studentId) return;

      const student = students.find(s => s.id === studentId);
      if (student) {
        student.name = newName;
        triggerCloudSync();
        renderStudentsList();
        renderTrackingDayView();
        renderLeaderboard();
        showToast('تم تعديل اسم الطالب بنجاح ✅');
      }
      closeEdit();
    });
  }
}

function openConfirmModal({ title, message, btnText, onConfirm }) {
  const confirmModal = document.getElementById('confirm-modal');
  const titleEl = document.getElementById('confirm-modal-title');
  const messageEl = document.getElementById('confirm-modal-message');
  const btnTextEl = document.getElementById('confirm-modal-btn-text');

  if (!confirmModal) {
    // Fallback if modal element is somehow missing
    if (onConfirm) onConfirm();
    return;
  }

  if (titleEl) titleEl.innerHTML = `<span>${title || '⚠️ تأكيد الإجراء'}</span>`;
  if (messageEl) messageEl.textContent = message || 'هل أنت متأكد من تنفيذ هذا الإجراء؟';
  if (btnTextEl) btnTextEl.textContent = btnText || 'تأكيد';

  confirmCallback = onConfirm;
  confirmModal.classList.add('show');
}

function openEditStudentModal(studentId) {
  const student = students.find(s => s.id === studentId);
  if (!student) return;

  const editModal = document.getElementById('edit-student-modal');
  const editForm = document.getElementById('edit-student-form');
  const editInput = document.getElementById('edit-student-input-name');

  if (!editModal || !editForm || !editInput) return;

  editForm.dataset.studentId = studentId;
  editInput.value = student.name;
  editModal.classList.add('show');
  setTimeout(() => editInput.focus(), 50);
}

window.renameStudentPrompt = function(studentId) {
  openEditStudentModal(studentId);
};

window.deleteStudentConfirm = function(studentId) {
  const student = students.find(s => s.id === studentId);
  if (!student) return;

  openConfirmModal({
    title: 'حذف الطالب',
    message: `هل أنت متأكد من حذف الطالب "${student.name}" وسجلاته بالكامل؟ لا يمكن التراجع عن هذا الإجراء.`,
    btnText: '🗑️ نعم، احذف الطالب',
    onConfirm: () => {
      students = students.filter(s => s.id !== studentId);
      
      // Clean up records
      Object.keys(records).forEach(k => {
        if (k.startsWith(studentId + '_')) {
          delete records[k];
        }
      });

      triggerCloudSync();
      renderStudentsList();
      renderTrackingDayView();
      renderLeaderboard();
      updateHeaderStats();
      showToast(`تم حذف الطالب "${student.name}" وسجلاته بنجاح`);
    }
  });
};

// --- WhatsApp Report Modal ---
function setupReportModal() {
  const modal = document.getElementById('report-modal');
  const openButtons = document.querySelectorAll('.btn-open-report');
  const closeButtons = document.querySelectorAll('.modal-close, .btn-close-modal');

  openButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      openReportModal();
    });
  });

  closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (modal) modal.classList.remove('show');
    });
  });

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('show');
      }
    });
  }

  // Day Checkbox interactions
  document.querySelectorAll('.report-day-checkbox').forEach(chk => {
    chk.addEventListener('change', () => {
      updateReportDaysFromUI();
    });
  });

  // Presets
  const presetAll = document.getElementById('preset-all-days');
  if (presetAll) {
    presetAll.addEventListener('click', () => {
      appState.reportDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'];
      syncReportCheckboxes();
      updateReportPreview();
    });
  }

  const presetToday = document.getElementById('preset-today-only');
  if (presetToday) {
    presetToday.addEventListener('click', () => {
      appState.reportDays = [appState.currentDay];
      syncReportCheckboxes();
      updateReportPreview();
    });
  }

  const presetSpecific = document.getElementById('preset-sun-tue-thu');
  if (presetSpecific) {
    presetSpecific.addEventListener('click', () => {
      appState.reportDays = ['sunday', 'tuesday', 'thursday'];
      syncReportCheckboxes();
      updateReportPreview();
    });
  }

  // Copy to Clipboard Button
  const copyBtn = document.getElementById('btn-copy-report');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const text = generateReportText();
      copyToClipboard(text);
    });
  }

  // WhatsApp Share Button
  const waShareBtn = document.getElementById('btn-share-whatsapp');
  if (waShareBtn) {
    waShareBtn.addEventListener('click', () => {
      const text = generateReportText();
      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    });
  }
}

function openReportModal() {
  const modal = document.getElementById('report-modal');
  if (!modal) return;

  syncReportCheckboxes();
  updateReportPreview();
  modal.classList.add('show');
}

function syncReportCheckboxes() {
  document.querySelectorAll('.report-day-checkbox').forEach(chk => {
    const isChecked = appState.reportDays.includes(chk.value);
    chk.checked = isChecked;
    const parent = chk.closest('.day-checkbox-label');
    if (parent) {
      if (isChecked) parent.classList.add('checked');
      else parent.classList.remove('checked');
    }
  });
}

function updateReportDaysFromUI() {
  const selected = [];
  document.querySelectorAll('.report-day-checkbox').forEach(chk => {
    const parent = chk.closest('.day-checkbox-label');
    if (chk.checked) {
      selected.push(chk.value);
      if (parent) parent.classList.add('checked');
    } else {
      if (parent) parent.classList.remove('checked');
    }
  });

  appState.reportDays = selected;
  saveStateLocally();
  updateReportPreview();
}

function generateReportText() {
  const selectedDays = appState.reportDays;

  if (selectedDays.length === 0) {
    return 'يرجى اختيار يوم واحد على الأقل لإنشاء التقرير.';
  }

  const selectedConfigs = DAYS_CONFIG.filter(d => selectedDays.includes(d.id));
  const daysNames = selectedConfigs.map(d => d.name).join(' + ');

  let report = `*متابعة الطلاب - تكوين النسيم*\n`;
  report += `📅 *${appState.currentWeek}* (${appState.currentMonth})\n`;
  report += `🗓️ *الأيام:* ${daysNames}\n`;
  report += `━━━━━━━━━━━━━━━\n\n`;

  students.forEach(student => {
    let symbols = [];

    selectedConfigs.forEach(d => {
      const rec = getStudentDayRecord(student.id, d.id);

      if (d.id === 'thursday') {
        // Thursday notation
        if (rec.thursdayEarly === 'done' || rec.thursdayProgram === 'done') {
          symbols.push('✅');
        } else if (rec.thursdayEarly === 'none' && rec.thursdayProgram === 'none') {
          symbols.push('❌');
        } else {
          symbols.push('⚪');
        }
      } else {
        if (rec.attendance === 'present') {
          symbols.push('✅');
        } else if (rec.attendance === 'excused') {
          symbols.push('⚠️');
        } else if (rec.attendance === 'absent') {
          symbols.push('❌');
        } else {
          symbols.push('⚪');
        }
      }
    });

    report += `*${student.name}:* ${symbols.join(' ')}\n`;
  });

  report += `\n━━━━━━━━━━━━━━━\n`;
  report += `المفتاح: ✅ حاضر | ⚠️ معتذر | ❌ غائب | ⚪ غير مسجل`;

  return report;
}

function updateReportPreview() {
  const previewBox = document.getElementById('report-preview-text');
  if (previewBox) {
    previewBox.textContent = generateReportText();
  }
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('تم نسخ التقرير بنجاح! جاهز للصق في واتساب 📋');
    }).catch(() => {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    showToast('تم نسخ التقرير بنجاح! جاهز للصق في واتساب 📋');
  } catch (err) {
    showToast('تعذر النسخ التلقائي، يمكنك نسخه يدويًا');
  }
  document.body.removeChild(textarea);
}

// --- Toast Notification ---
let toastTimeout = null;
function showToast(msg) {
  const toast = document.getElementById('app-toast');
  if (!toast) return;

  toast.innerHTML = `<span>${msg}</span>`;
  toast.classList.add('show');

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2800);
}

function escapeHtml(string) {
  const div = document.createElement('div');
  div.textContent = string;
  return div.innerHTML;
}

// Start
document.addEventListener('DOMContentLoaded', initApp);
