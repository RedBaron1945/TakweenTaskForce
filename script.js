// --- متابعة طلاب تكوين النسيم ---
// Vanilla JS مع المزامنة السحابية الفورية (Firebase Firestore) + نظام مصادقة المشرف

import { 
  saveAppDataToCloud, 
  loadAppDataFromCloud, 
  subscribeToCloudChanges,
  verifySecurityPinWithCloud,
  updateSecurityPinInCloud,
  computePinHash
} from './src/firebaseSync.js';
import reportLogoImg from './src/assets/images/regenerated_image_1788678249250.png';
import html2pdf from 'html2pdf.js';

const STORAGE_KEYS = {
  STUDENTS: 'takween_students_v1',
  RECORDS: 'takween_records_v1',
  STATE: 'takween_state_v1',
  PENDING_SYNC: 'takween_pending_sync_v1',
  LAST_SAVED_AT: 'takween_last_saved_at_v1',
  HAS_UNSYNCED: 'takween_has_unsynced_v1',
  AUTO_BACKUP: 'takween_auto_backup_v1'
};

const PIN_STORAGE_KEYS = {
  VERIFIED_HASH: 'takween_verified_hash_v1',
  IS_AUTHENTICATED: 'takween_is_authenticated_v1',
  REMEMBER_DEVICE: 'takween_remember_device_v1'
};

// قوائم الطلاب المعتمدة للأسرتين (46 طالباً)
const BAMOUS_STUDENTS_LIST = [
  'البراء الشريف',
  'بندر جوهر',
  'تركي اليافعي',
  'خالد أبو بكر',
  'راكان السلمي',
  'عبد الرحمن السيد',
  'عبد الفتاح هوسي',
  'عبد القادر يحيى',
  'عصام الجعدبي',
  'علي باطهف',
  'عمار بادحدوح',
  'عمر عصفور',
  'فهد الشرف',
  'قصي الشيخ',
  'مؤيد العمودي',
  'مازن الشمراني',
  'محمد الشرعبي',
  'محمد العصيري',
  'محمد المطيري',
  'محمود العبسي',
  'مشاري عثمان',
  'يوسف اليافعي',
  'يوسف برناوي'
];

const AKRAM_STUDENTS_LIST = [
  'أحمد الزهراني',
  'أسامة باحشوان',
  'المهند بن شامس',
  'تركي الشمراني',
  'حمد كشميم',
  'راشد الغامدي',
  'سالم باطرفي',
  'سلمان العمودي',
  'سليمان القطان',
  'صهيب الصارم',
  'طاهر العجيلي',
  'عادل باعظيم',
  'عبدالرحمن خيار',
  'عبدالرحمن قصاب',
  'عبدالرحمن قطان',
  'عبدالله بارشاد',
  'علي محمد نور',
  'عمر باعوض',
  'محمد ادريس نور',
  'محمد باسويدان',
  'مهند العمودي',
  'منصور طميحي',
  'يزيد باطويل'
];

// الطلاب الافتراضيون الكاملون مع تحديد الأسرة لكل طالب
const DEFAULT_STUDENTS = [
  ...BAMOUS_STUDENTS_LIST.map((name, idx) => ({
    id: `std_bamousa_${idx + 1}`,
    name,
    family: 'bamousa',
    createdAt: 1700000000000 + idx
  })),
  ...AKRAM_STUDENTS_LIST.map((name, idx) => ({
    id: `std_akram_${idx + 1}`,
    name,
    family: 'akram',
    createdAt: 1700001000000 + idx
  }))
];

const DAYS_CONFIG = [
  { 
    id: 'sunday', 
    name: 'الأحد', 
    short: 'أحد', 
    maxPoints: 20,
    items: [
      { id: 'attendance', label: 'حضور', maxPoints: 5, icon: '👥', type: 'attendance' },
      { id: 'hifz', label: 'حفظ', maxPoints: 5, icon: '📖', type: 'task' },
      { id: 'murajaah', label: 'مراجعة', maxPoints: 5, icon: '🔁', type: 'task' },
      { id: 'lesson', label: 'حضور الدرس', maxPoints: 5, icon: '🕌', type: 'attendance' }
    ]
  },
  { 
    id: 'monday', 
    name: 'الاثنين', 
    short: 'اثنين', 
    maxPoints: 25,
    items: [
      { id: 'attendance', label: 'حضور', maxPoints: 5, icon: '👥', type: 'attendance' },
      { id: 'hifz', label: 'حفظ', maxPoints: 5, icon: '📖', type: 'task' },
      { id: 'murajaah', label: 'مراجعة', maxPoints: 5, icon: '🔁', type: 'task' },
      { id: 'familyMeeting', label: 'اجتماع أسري', maxPoints: 10, icon: '🫡', type: 'task' }
    ]
  },
  { 
    id: 'tuesday', 
    name: 'الثلاثاء', 
    short: 'ثلاثاء', 
    maxPoints: 20,
    items: [
      { id: 'attendance', label: 'حضور', maxPoints: 5, icon: '👥', type: 'attendance' },
      { id: 'hifz', label: 'حفظ', maxPoints: 5, icon: '📖', type: 'task' },
      { id: 'murajaah', label: 'مراجعة', maxPoints: 5, icon: '🔁', type: 'task' },
      { id: 'lesson', label: 'حضور الدرس', maxPoints: 5, icon: '🕌', type: 'attendance' }
    ]
  },
  { 
    id: 'wednesday', 
    name: 'الأربعاء', 
    short: 'أربعاء', 
    maxPoints: 15,
    items: [
      { id: 'attendance', label: 'حضور', maxPoints: 5, icon: '👥', type: 'attendance' },
      { id: 'hifz', label: 'حفظ', maxPoints: 5, icon: '📖', type: 'task' },
      { id: 'murajaah', label: 'مراجعة', maxPoints: 5, icon: '🔁', type: 'task' }
    ]
  },
  { 
    id: 'thursday', 
    name: 'الخميس', 
    short: 'خميس', 
    maxPoints: 20,
    items: [
      { id: 'attendance', label: 'حضور', maxPoints: 10, icon: '👥', type: 'attendance' },
      { id: 'individualProgram', label: 'إنجاز برنامج فردي', maxPoints: 5, icon: '🎯', type: 'task' },
      { id: 'familyInteraction', label: 'التفاعل الأسري', maxPoints: 5, icon: '🤝', type: 'task' }
    ]
  }
];

// App State
let appState = {
  currentTab: 'tracking', // tracking | followup | leaderboard | stats | students
  selectedFamily: 'bamousa', // bamousa | akram
  currentMonth: 'شهر 1',
  currentWeek: 'الأسبوع 1',
  currentDay: 'sunday',
  statsMonth: 'شهر 1',
  followupMonth: 'شهر 1',
  followupWeek: 'الأسبوع 1',
  followupFamily: 'all', // all | bamousa | akram
  followupFilter: 'all', // all | needs-attention | missed-lessons | low-murajaah | frequent-absent | excellent
  followupSearchQuery: '',
  reportDays: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
  reportFamily: 'bamousa', // bamousa | akram
  searchQuery: '',
  activeFilter: 'all', // all | unrecorded | done | needs-attention
  manageSearchQuery: ''
};

let students = [];
let records = {}; // Key: `${studentId}_${month}_${week}_${day}` -> { attendance, hifz, murajaah, ... }
let isCloudSyncing = false;

function normalizeArabicName(name) {
  if (!name) return '';
  return name
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ـ/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

// دالة مساعدة لترقية وضمان صحة بيانات الطلاب وتوزيعهم الدقيق على الأسر
function ensureStudentsRoster(loadedStudents) {
  const normBamousa = BAMOUS_STUDENTS_LIST.map(normalizeArabicName);
  const normAkram = AKRAM_STUDENTS_LIST.map(normalizeArabicName);

  if (!Array.isArray(loadedStudents) || loadedStudents.length === 0) {
    return [...DEFAULT_STUDENTS];
  }

  // فرز وتعيين كل طالب لأسرته المحددة بدقة والتحقق من اكتمال المعرّفات
  const mapped = loadedStudents.map((student, idx) => {
    const norm = normalizeArabicName(student.name || '');
    let family = student.family;

    if (normAkram.includes(norm)) {
      family = 'akram';
    } else if (normBamousa.includes(norm)) {
      family = 'bamousa';
    } else if (!family || (family !== 'bamousa' && family !== 'akram')) {
      family = 'bamousa';
    }

    return {
      id: student.id || `std_${Date.now()}_${idx}`,
      name: student.name || `طالب ${idx + 1}`,
      family,
      createdAt: student.createdAt || Date.now()
    };
  });

  return mapped;
}

// --- Persistence Helpers ---
function loadData() {
  try {
    const savedStudents = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    if (savedStudents) {
      const parsed = JSON.parse(savedStudents);
      students = ensureStudentsRoster(parsed);
    } else {
      students = [...DEFAULT_STUDENTS];
    }
    saveStudentsLocally();

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
      if (!appState.selectedFamily) appState.selectedFamily = 'bamousa';
      if (!appState.reportFamily) appState.reportFamily = appState.selectedFamily;
      if (appState.currentWeek === 'الأسبوع 5') appState.currentWeek = 'الأسبوع 4';
      if (appState.followupWeek === 'الأسبوع 5') appState.followupWeek = 'الأسبوع 4';
      // التحقق من صلاحية فلتر المتابعة وعدم تعليقه على فلتر محذوف
      const validFollowupFilters = ['all', 'needs-attention', 'frequent-absent', 'excellent'];
      if (!validFollowupFilters.includes(appState.followupFilter)) {
        appState.followupFilter = 'all';
      }
    }
  } catch (e) {
    console.error('Error loading data from localStorage', e);
    students = [...DEFAULT_STUDENTS];
    records = {};
  }
}

function saveStudentsLocally() {
  try {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
    localStorage.setItem(STORAGE_KEYS.LAST_SAVED_AT, new Date().toISOString());
    localStorage.setItem(STORAGE_KEYS.HAS_UNSYNCED, 'true');
  } catch (err) {
    console.warn('Storage warning when saving students locally:', err);
  }
}

function saveRecordsLocally() {
  try {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
    const nowIso = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.LAST_SAVED_AT, nowIso);
    localStorage.setItem(STORAGE_KEYS.HAS_UNSYNCED, 'true');
    
    // حفظ نسخة أمان تلقائية دورية في المتصفح للحماية الإضافية
    try {
      localStorage.setItem(STORAGE_KEYS.AUTO_BACKUP, JSON.stringify({
        version: '1.0',
        timestamp: nowIso,
        studentsCount: students.length,
        recordsCount: Object.keys(records).length,
        students,
        records
      }));
    } catch (e) {
      // تجاهل إذا امتلأت الذاكرة
    }
  } catch (err) {
    console.warn('Storage warning when saving records locally:', err);
  }
  updateAutoSaveStatusUI('saved');
}

function saveStateLocally() {
  localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(appState));
}

// تحديث مؤشرات الحفظ التلقائي في واجهة المستخدم فوراً
function updateAutoSaveStatusUI(status = 'saved', customMsg = null) {
  const autosaveBadge = document.getElementById('autosave-badge');
  const autosaveLabel = document.getElementById('autosave-label');
  const liveSaveEl = document.getElementById('live-save-status');

  const now = new Date();
  const timeStr = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

  if (autosaveBadge && autosaveLabel) {
    if (status === 'saving') {
      autosaveBadge.className = 'autosave-badge saving';
      autosaveLabel.textContent = 'جارِ الحفظ التلقائي...';
    } else if (status === 'offline') {
      autosaveBadge.className = 'autosave-badge offline';
      autosaveLabel.textContent = 'محفوظ محلياً (دون اتصال)';
    } else {
      autosaveBadge.className = 'autosave-badge saved';
      autosaveLabel.textContent = customMsg || `تم الحفظ تلقائياً (${timeStr})`;
    }
  }

  if (liveSaveEl) {
    if (status === 'saving') {
      liveSaveEl.innerHTML = `⏳ <b>جارِ الحفظ التلقائي...</b>`;
    } else if (status === 'offline') {
      liveSaveEl.innerHTML = `💾 <b>تم الحفظ محلياً بأمان</b> <span class="subtle-time">(${timeStr})</span>`;
    } else {
      liveSaveEl.innerHTML = `⚡ <b>تم الحفظ التلقائي</b> <span class="subtle-time">(${timeStr})</span>`;
    }
  }

  updateBackupStatsUI();
}

// Debounce timer for saving to cloud
let cloudSaveTimeout = null;
function triggerCloudSync(immediate = false) {
  // الحفظ المحلي الفوري دائماً أولاً لضمان عدم ضياع أي نقرة أو حالة
  saveStudentsLocally();
  saveRecordsLocally();

  // في حال انقطاع الاتصال بالإنترنت، تسجيل الحاجة للمزامنة فور عودة الشبكة
  if (!navigator.onLine) {
    localStorage.setItem(STORAGE_KEYS.PENDING_SYNC, 'true');
    localStorage.setItem(STORAGE_KEYS.HAS_UNSYNCED, 'true');
    setSyncStatusUI('offline', 'وضع عدم الاتصال (حفظ محلي)');
    updateAutoSaveStatusUI('offline');
    return;
  }

  updateAutoSaveStatusUI('saving');
  setSyncStatusUI('syncing', 'جارِ الحفظ سحابياً...');
  if (cloudSaveTimeout) clearTimeout(cloudSaveTimeout);
  
  const doSave = async () => {
    isCloudSyncing = true;
    try {
      const ok = await saveAppDataToCloud(students, records);
      isCloudSyncing = false;
      if (ok) {
        localStorage.removeItem(STORAGE_KEYS.PENDING_SYNC);
        localStorage.removeItem(STORAGE_KEYS.HAS_UNSYNCED);
        setSyncStatusUI('online', 'متزامن سحابياً');
        updateAutoSaveStatusUI('saved');
      } else {
        localStorage.setItem(STORAGE_KEYS.PENDING_SYNC, 'true');
        localStorage.setItem(STORAGE_KEYS.HAS_UNSYNCED, 'true');
        setSyncStatusUI('offline', 'حفظ محلي (بانتظار المزامنة)');
        updateAutoSaveStatusUI('offline');
      }
    } catch (e) {
      isCloudSyncing = false;
      localStorage.setItem(STORAGE_KEYS.PENDING_SYNC, 'true');
      localStorage.setItem(STORAGE_KEYS.HAS_UNSYNCED, 'true');
      setSyncStatusUI('offline', 'حفظ محلي (بانتظار المزامنة)');
      updateAutoSaveStatusUI('offline');
    }
  };

  if (immediate) {
    doSave();
  } else {
    cloudSaveTimeout = setTimeout(doSave, 300);
  }
}

// تفريغ وحفظ البيانات فوراً عند إغلاق أو تحديث الصفحة لمنع أي فقدان للبيانات
window.addEventListener('beforeunload', () => {
  saveStudentsLocally();
  saveRecordsLocally();
});
window.addEventListener('pagehide', () => {
  saveStudentsLocally();
  saveRecordsLocally();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    saveStudentsLocally();
    saveRecordsLocally();
  }
});

// Automatic sync function for reconnected internet
async function syncPendingDataToCloud(notifyOnSuccess = false) {
  if (!navigator.onLine) {
    setSyncStatusUI('offline', 'وضع عدم الاتصال (حفظ محلي)');
    return;
  }

  const hasPending = localStorage.getItem(STORAGE_KEYS.PENDING_SYNC) === 'true' ||
                     localStorage.getItem(STORAGE_KEYS.HAS_UNSYNCED) === 'true';
  setSyncStatusUI('syncing', 'جارِ مزامنة البيانات...');

  try {
    isCloudSyncing = true;
    const ok = await saveAppDataToCloud(students, records);
    isCloudSyncing = false;

    if (ok) {
      localStorage.removeItem(STORAGE_KEYS.PENDING_SYNC);
      localStorage.removeItem(STORAGE_KEYS.HAS_UNSYNCED);
      setSyncStatusUI('online', 'متزامن سحابياً');
      updateAutoSaveStatusUI('saved');
      if (notifyOnSuccess && hasPending) {
        showToast('📶 عادت شبكة الإنترنت! تم مزامنة البيانات المسجلة محلياً مع السحابة تلقائياً ✨');
      }
    } else {
      localStorage.setItem(STORAGE_KEYS.PENDING_SYNC, 'true');
      setSyncStatusUI('offline', 'حفظ محلي (بانتظار المزامنة)');
    }
  } catch (err) {
    isCloudSyncing = false;
    console.warn('Sync pending data warning:', err);
    localStorage.setItem(STORAGE_KEYS.PENDING_SYNC, 'true');
    setSyncStatusUI('offline', 'حفظ محلي (بانتظار المزامنة)');
  }
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

// --- ميزة النسخ الاحتياطي بصيغة JSON وإدارته ---
let pendingRestoreData = null;

function updateBackupStatsUI() {
  const statStudents = document.getElementById('backup-stat-students');
  const statRecords = document.getElementById('backup-stat-records');
  const statTime = document.getElementById('backup-stat-time');

  if (statStudents) statStudents.textContent = students.length;
  if (statRecords) statRecords.textContent = Object.keys(records).length;
  if (statTime) {
    const lastSaved = localStorage.getItem(STORAGE_KEYS.LAST_SAVED_AT);
    if (lastSaved) {
      const d = new Date(lastSaved);
      statTime.textContent = 'آخر حفظ: ' + d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    } else {
      statTime.textContent = 'محفوظ تلقائياً';
    }
  }
}

function generateBackupJsonData() {
  const now = new Date();
  return {
    appName: 'متابعة طلاب تكوين النسيم',
    version: '1.0',
    exportedAt: now.toISOString(),
    exportedAtFormatted: now.toLocaleString('ar-SA', { dateStyle: 'full', timeStyle: 'medium' }),
    stats: {
      studentsCount: students.length,
      recordsCount: Object.keys(records).length,
      bamousaCount: students.filter(s => (s.family || 'bamousa') === 'bamousa').length,
      akramCount: students.filter(s => s.family === 'akram').length
    },
    students: students,
    records: records,
    appState: {
      selectedFamily: appState.selectedFamily,
      currentMonth: appState.currentMonth,
      currentWeek: appState.currentWeek,
      currentDay: appState.currentDay
    }
  };
}

function downloadJsonBackup() {
  try {
    const data = generateBackupJsonData();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = `takween_backup_${dateStr}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`تم تنزيل النسخة الاحتياطية (${filename}) بنجاح 📥`);
  } catch (err) {
    console.error('Download backup error:', err);
    showToast('حدث خطأ أثناء تنزيل النسخة الاحتياطية ⚠️');
  }
}

function copyJsonBackup() {
  try {
    const data = generateBackupJsonData();
    const jsonStr = JSON.stringify(data, null, 2);
    copyToClipboard(jsonStr);
    showToast('تم نسخ بيانات النسخة الاحتياطية (JSON) للحافظة بنجاح 📋');
  } catch (err) {
    console.error('Copy backup error:', err);
    showToast('تعذر نسخ كود JSON للحافظة ⚠️');
  }
}

function validateAndPreviewBackup(jsonString) {
  const previewCard = document.getElementById('backup-preview-card');
  const previewDate = document.getElementById('backup-preview-date');
  const previewStudents = document.getElementById('backup-preview-students-count');
  const previewRecords = document.getElementById('backup-preview-records-count');
  const previewFamilies = document.getElementById('backup-preview-families-info');

  try {
    if (!jsonString || !jsonString.trim()) {
      showToast('الرجاء اختيار ملف أو إدخال كود JSON صالح ⚠️');
      return;
    }

    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('بيانات JSON غير صالحة');
    }

    let incomingStudents = [];
    let incomingRecords = {};

    if (Array.isArray(parsed.students)) {
      incomingStudents = parsed.students;
    } else if (Array.isArray(parsed)) {
      incomingStudents = parsed;
    }

    if (parsed.records && typeof parsed.records === 'object') {
      incomingRecords = parsed.records;
    }

    if (incomingStudents.length === 0 && Object.keys(incomingRecords).length === 0) {
      showToast('لم يتم العثور على أي طلاب أو سجلات رصد في هذا الملف ⚠️');
      return;
    }

    pendingRestoreData = {
      students: incomingStudents,
      records: incomingRecords,
      appState: parsed.appState || null,
      exportedAt: parsed.exportedAtFormatted || parsed.exportedAt || new Date().toLocaleString('ar-SA')
    };

    const bamousaCount = incomingStudents.filter(s => (s.family || 'bamousa') === 'bamousa').length;
    const akramCount = incomingStudents.filter(s => s.family === 'akram').length;

    if (previewDate) previewDate.textContent = pendingRestoreData.exportedAt;
    if (previewStudents) previewStudents.textContent = incomingStudents.length;
    if (previewRecords) previewRecords.textContent = Object.keys(incomingRecords).length;
    if (previewFamilies) previewFamilies.textContent = `باموسى (${bamousaCount}) | أكرم (${akramCount})`;

    if (previewCard) {
      previewCard.style.display = 'block';
      previewCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    showToast('✓ تم فحص النسخة الاحتياطية بنجاح! راجع البيانات ثم اختر خيار الاستعادة');
  } catch (err) {
    console.error('JSON parse error:', err);
    showToast('صيغة JSON غير صحيحة. يرجى التأكد من سلامة الملف أو النص ⚠️');
    if (previewCard) previewCard.style.display = 'none';
    pendingRestoreData = null;
  }
}

function executeRestoreBackup(mode = 'full') {
  if (!pendingRestoreData) {
    showToast('لا توجد بيانات نسخة احتياطية جاهزة للاستعادة ⚠️');
    return;
  }

  const doRestore = () => {
    if (mode === 'full') {
      if (pendingRestoreData.students && pendingRestoreData.students.length > 0) {
        students = ensureStudentsRoster(pendingRestoreData.students);
      }
      if (pendingRestoreData.records) {
        records = pendingRestoreData.records;
      }
    } else {
      // وضع الدمج الذكي: دمج الطلاب والسجلات دون حذف أي بيانات سابقة
      if (pendingRestoreData.students && pendingRestoreData.students.length > 0) {
        const localMap = new Map(students.map(s => [s.id, s]));
        const nameMap = new Map(students.map(s => [s.name.trim().toLowerCase(), s]));

        pendingRestoreData.students.forEach(ns => {
          if (localMap.has(ns.id)) {
            const curr = localMap.get(ns.id);
            curr.name = ns.name || curr.name;
            curr.family = ns.family || curr.family;
          } else if (nameMap.has(ns.name.trim().toLowerCase())) {
            const curr = nameMap.get(ns.name.trim().toLowerCase());
            curr.family = ns.family || curr.family;
          } else {
            students.push(ns);
          }
        });
        students = ensureStudentsRoster(students);
      }

      if (pendingRestoreData.records) {
        records = {
          ...records,
          ...pendingRestoreData.records
        };
      }
    }

    // حفظ فوري محلياً ومزامنة فورية مع السحابة
    saveStudentsLocally();
    saveRecordsLocally();
    triggerCloudSync(true);

    // تحديث كافة الشاشات والقوائم فورياً
    renderStudentsList();
    renderTrackingDayView();
    renderLeaderboard();
    updateHeaderStats();
    updateBackupStatsUI();

    const previewCard = document.getElementById('backup-preview-card');
    if (previewCard) previewCard.style.display = 'none';
    pendingRestoreData = null;

    showToast(mode === 'full' 
      ? '⚡ تم استبدال واستعادة النسخة الاحتياطية بنجاح وحفظها تلقائياً!' 
      : '🔄 تم دمج النسخة الاحتياطية بنجاح مع البيانات الحالية وحفظها تلقائياً!');
  };

  if (mode === 'full') {
    openConfirmModal({
      title: '⚠️ تأكيد الاستعادة الكاملة (استبدال)',
      message: `سيتم استبدال بيانات الطلاب الحالية (${students.length} طالب) وسجلات الرصد (${Object.keys(records).length} سجل) بالنسخة الاحتياطية. هل أنت متأكد من المتابعة؟`,
      btnText: 'نعم، استبدل البيانات الآن',
      onConfirm: doRestore
    });
  } else {
    openConfirmModal({
      title: '🔄 تأكيد دمج البيانات',
      message: `سيتم دمج الطلاب وسجلات الرصد من النسخة الاحتياطية مع بياناتك الحالية دون حذف أي بيانات موجودة. هل تريد المتابعة؟`,
      btnText: 'تأكيد الدمج',
      onConfirm: doRestore
    });
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
  if (!record) return 0;
  const config = DAYS_CONFIG.find(d => d.id === dayId);
  if (!config) return 0;

  let pts = 0;
  config.items.forEach(item => {
    const val = record[item.id];
    if (val === 'present' || val === 'done') {
      pts += item.maxPoints;
    } else if (val === 'excused' || val === 'partial') {
      pts += (item.maxPoints / 2);
    }
  });

  return pts;
}

// Points Engine & Detailed Stats
function calculateStudentWeekPoints(studentId, week = appState.currentWeek, month = appState.currentMonth) {
  let total = 0;
  let breakdown = {
    attendance: 0,
    hifz: 0,
    murajaah: 0,
    lesson: 0,
    familyMeeting: 0,
    individualProgram: 0,
    familyInteraction: 0
  };

  DAYS_CONFIG.forEach(d => {
    const rec = getStudentDayRecord(studentId, d.id, week, month);
    d.items.forEach(item => {
      const val = rec[item.id];
      let p = 0;
      if (val === 'present' || val === 'done') {
        p = item.maxPoints;
      } else if (val === 'excused' || val === 'partial') {
        p = (item.maxPoints / 2);
      }
      total += p;
      if (breakdown[item.id] !== undefined) {
        breakdown[item.id] += p;
      }
    });
  });

  return { total, breakdown };
}

// حساب الأرقام والإحصائيات التفصيلية للطالب خلال الأسبوع (بدلاً من الازدحام بالنقاط فقط)
function getStudentDetailedWeekStats(studentId, week = appState.currentWeek, month = appState.currentMonth) {
  let total = 0;
  let attDays = { present: 0, excused: 0, absent: 0, unrecorded: 0 };
  let hifzDays = { done: 0, excused: 0, none: 0, unrecorded: 0 };
  let murajaahDays = { done: 0, excused: 0, none: 0, unrecorded: 0 };
  let lessonCount = { present: 0, excused: 0, absent: 0, unrecorded: 0 }; // Sun & Tue
  let familyMeeting = 'unrecorded'; // Mon
  let thursdayProgram = 'unrecorded'; // Thu
  let thursdayInteraction = 'unrecorded'; // Thu

  DAYS_CONFIG.forEach(d => {
    const rec = getStudentDayRecord(studentId, d.id, week, month);
    
    // Calculate points
    d.items.forEach(item => {
      const val = rec[item.id];
      if (val === 'present' || val === 'done') {
        total += item.maxPoints;
      } else if (val === 'excused' || val === 'partial') {
        total += (item.maxPoints / 2);
      }
    });

    // Attendance
    if (rec.attendance === 'present') attDays.present++;
    else if (rec.attendance === 'excused') attDays.excused++;
    else if (rec.attendance === 'absent') attDays.absent++;
    else attDays.unrecorded++;

    // Hifz
    if (d.items.some(i => i.id === 'hifz')) {
      if (rec.hifz === 'done' || rec.hifz === 'present') hifzDays.done++;
      else if (rec.hifz === 'excused' || rec.hifz === 'partial') hifzDays.excused++;
      else if (rec.hifz === 'none' || rec.hifz === 'absent') hifzDays.none++;
      else hifzDays.unrecorded++;
    }

    // Murajaah
    if (d.items.some(i => i.id === 'murajaah')) {
      if (rec.murajaah === 'done' || rec.murajaah === 'present') murajaahDays.done++;
      else if (rec.murajaah === 'excused' || rec.murajaah === 'partial') murajaahDays.excused++;
      else if (rec.murajaah === 'none' || rec.murajaah === 'absent') murajaahDays.none++;
      else murajaahDays.unrecorded++;
    }

    // Lessons (Sun & Tue)
    if (d.items.some(i => i.id === 'lesson')) {
      if (rec.lesson === 'present') lessonCount.present++;
      else if (rec.lesson === 'excused') lessonCount.excused++;
      else if (rec.lesson === 'absent') lessonCount.absent++;
      else lessonCount.unrecorded++;
    }

    // Monday Family Meeting
    if (d.id === 'monday') {
      familyMeeting = rec.familyMeeting || 'unrecorded';
    }

    // Thursday
    if (d.id === 'thursday') {
      thursdayProgram = rec.individualProgram || 'unrecorded';
      thursdayInteraction = rec.familyInteraction || 'unrecorded';
    }
  });

  return {
    total,
    attDays,
    hifzDays,
    murajaahDays,
    lessonCount,
    familyMeeting,
    thursdayProgram,
    thursdayInteraction
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

// Batch Action Applicator for any specific evaluation item
window.applyBatchField = function(fieldId, status, fieldLabel) {
  if (selectedStudentIds.size === 0) return;
  const day = appState.currentDay;
  const count = selectedStudentIds.size;

  selectedStudentIds.forEach(id => {
    const key = `${id}_${appState.currentMonth}_${appState.currentWeek}_${day}`;
    if (!records[key]) records[key] = {};
    records[key][fieldId] = status;
  });

  triggerCloudSync();
  renderTrackingDayView();
  renderLeaderboard();
  updateHeaderStats();

  const isTask = fieldId === 'hifz' || fieldId === 'murajaah';
  const excIcon = isTask ? '⏳' : '⚠️';
  const label = (status === 'present' || status === 'done') ? 'مكتمل ✅' : (status === 'excused' || status === 'partial') ? `مستأذن / جزئي ${excIcon}` : 'غائب / لم ينجز ❌';
  showToast(`تم رصد (${fieldLabel || fieldId}) لـ (${count}) طلاب: ${label}`);
};

window.applyBatchFullDay = function() {
  if (selectedStudentIds.size === 0) return;
  const day = appState.currentDay;
  const count = selectedStudentIds.size;
  const config = DAYS_CONFIG.find(d => d.id === day);
  if (!config) return;

  selectedStudentIds.forEach(id => {
    const key = `${id}_${appState.currentMonth}_${appState.currentWeek}_${day}`;
    if (!records[key]) records[key] = {};

    config.items.forEach(item => {
      records[key][item.id] = (item.type === 'attendance') ? 'present' : 'done';
    });
  });

  triggerCloudSync();
  renderTrackingDayView();
  renderLeaderboard();
  updateHeaderStats();
  showToast(`تم تسجيل الإنجاز الكامل (${config.maxPoints} درجة) لـ (${count}) طلاب المحددين ⚡`);
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

// التحقق مما إذا كان تسجيل الطالب لليوم غير مسجل أو ناقص/غير مكتمل
function isStudentDayUnrecordedOrIncomplete(record, items) {
  if (!items || items.length === 0) return false;

  // 1. إذا لم يُسجل الحضور إطلاقاً، يعتبر غير مسجل
  if (record.attendance === undefined) {
    return true;
  }

  // 2. إذا كان الطالب غائباً، فإن رصده يعتبر تاماً ومنتهياً
  if (record.attendance === 'absent') {
    return false;
  }

  // 3. إذا كان حاضراً أو مستأذناً، ولكن هناك أي بند مقرر لهذا اليوم لم يُسجل بعد
  return items.some(item => record[item.id] === undefined);
}

function getCurrentlyFilteredStudents() {
  const currentDayConfig = DAYS_CONFIG.find(d => d.id === appState.currentDay);
  const items = currentDayConfig ? currentDayConfig.items : [];

  // تصفية حسب الأسرة المحددة (أسرة باموسى أو أسرة أكرم)
  const targetFamily = appState.selectedFamily || 'bamousa';
  const familyStudents = students.filter(s => (s.family || 'bamousa') === targetFamily);

  return familyStudents.filter(student => {
    // 1. Search Query Filter
    if (appState.searchQuery) {
      if (!student.name.toLowerCase().includes(appState.searchQuery)) {
        return false;
      }
    }

    // 2. Status Filter
    const record = getStudentDayRecord(student.id, appState.currentDay);
    
    if (appState.activeFilter === 'unrecorded') {
      return isStudentDayUnrecordedOrIncomplete(record, items);
    } else if (appState.activeFilter === 'done') {
      const allDone = items.length > 0 && items.every(item => {
        const val = record[item.id];
        return val === 'present' || val === 'done';
      });
      return allDone;
    } else if (appState.activeFilter === 'needs-attention') {
      const hasAttention = items.some(item => {
        const val = record[item.id];
        return val === 'absent' || val === 'excused' || val === 'none' || val === 'partial';
      });
      return hasAttention;
    }

    return true;
  });
}

// --- UI & Lifecycle ---
let cloudSyncInitialized = false;
let unsubscribeCloudChanges = null;

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then((reg) => {
          console.log('[SW] Service Worker registered successfully with scope:', reg.scope);
          // Auto check for updates on registration
          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[SW] New version available in background.');
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn('[SW] Registration failed:', err);
        });
    });
  }
}

function setupNetworkStatusListeners() {
  // 1. Connection Restored: trigger automatic background sync
  window.addEventListener('online', () => {
    console.log('[Network] Back online, syncing pending data...');
    setSyncStatusUI('syncing', 'عادت الشبكة، جارِ المزامنة...');
    syncPendingDataToCloud(true);
  });

  // 2. Connection Lost: persist gracefully to local storage
  window.addEventListener('offline', () => {
    console.log('[Network] Offline mode activated');
    setSyncStatusUI('offline', 'وضع عدم الاتصال (حفظ محلي)');
    showToast('⚠️ انقطع الاتصال بالإنترنت - يتم حفظ بياناتك محلياً وستتزامن فور عودة الشبكة');
  });

  // 3. Periodic Background Sync Check (every 30 seconds)
  setInterval(() => {
    if (navigator.onLine && localStorage.getItem(STORAGE_KEYS.PENDING_SYNC) === 'true' && !isCloudSyncing) {
      syncPendingDataToCloud(false);
    }
  }, 30000);
}

// --- PIN Security & Supervisor Authentication System ---
let currentEnteredPin = '';
let isPinVisible = false;
let isVerifyingPin = false;

function isAppUnlocked() {
  return localStorage.getItem(PIN_STORAGE_KEYS.IS_AUTHENTICATED) === 'true' ||
         sessionStorage.getItem(PIN_STORAGE_KEYS.IS_AUTHENTICATED) === 'true';
}

function updatePinDisplayUI() {
  const dots = document.querySelectorAll('.pin-dot');
  const preview = document.getElementById('pin-text-preview');

  dots.forEach((dot, idx) => {
    if (idx < currentEnteredPin.length) {
      dot.classList.add('filled');
    } else {
      dot.classList.remove('filled');
    }
  });

  if (preview) {
    if (isPinVisible && currentEnteredPin.length > 0) {
      preview.textContent = currentEnteredPin;
      preview.style.display = 'block';
    } else {
      preview.textContent = '';
      preview.style.display = 'none';
    }
  }

  const hiddenInput = document.getElementById('pin-hidden-input');
  if (hiddenInput) {
    hiddenInput.value = currentEnteredPin;
  }
}

function handlePinDigitInput(digit) {
  if (currentEnteredPin.length >= 8) return;
  currentEnteredPin += digit;
  clearPinError();
  updatePinDisplayUI();

  // Auto-submit when 4 digits are entered for swift, responsive interaction
  if (currentEnteredPin.length === 4) {
    setTimeout(() => {
      attemptUnlockApp();
    }, 150);
  }
}

function handlePinBackspace() {
  if (currentEnteredPin.length > 0) {
    currentEnteredPin = currentEnteredPin.slice(0, -1);
    clearPinError();
    updatePinDisplayUI();
  }
}

function clearPinError() {
  const errEl = document.getElementById('pin-error-msg');
  if (errEl) {
    errEl.style.display = 'none';
  }
  const card = document.getElementById('pin-card-box');
  if (card) {
    card.classList.remove('pin-shake');
  }
}

function showPinError(msg = '⚠️ رمز المرور غير صحيح، يرجى المحاولة مرة أخرى') {
  const errEl = document.getElementById('pin-error-msg');
  const errTxt = document.getElementById('pin-error-text');
  if (errEl) {
    if (errTxt) errTxt.textContent = msg;
    errEl.style.display = 'block';
  }

  const card = document.getElementById('pin-card-box');
  if (card) {
    card.classList.remove('pin-shake');
    void card.offsetWidth;
    card.classList.add('pin-shake');
  }

  setTimeout(() => {
    currentEnteredPin = '';
    updatePinDisplayUI();
  }, 400);
}

async function attemptUnlockApp() {
  if (isVerifyingPin) return;
  if (!currentEnteredPin || currentEnteredPin.length < 4) {
    showPinError('⚠️ يرجى إدخال 4 أرقام على الأقل');
    return;
  }

  isVerifyingPin = true;
  const submitBtn = document.getElementById('pin-key-submit');
  const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.innerHTML = '<span>⏳ جاري التحقق...</span>';
  }

  try {
    const isCloudValid = await verifySecurityPinWithCloud(currentEnteredPin);
    
    let isSuccess = false;
    if (isCloudValid === true) {
      isSuccess = true;
    } else if (isCloudValid === null) {
      // Offline fallback: verify against cached hashed token if previously authenticated
      const enteredHash = await computePinHash(currentEnteredPin);
      const cachedHash = localStorage.getItem(PIN_STORAGE_KEYS.VERIFIED_HASH);
      if (cachedHash && cachedHash === enteredHash) {
        isSuccess = true;
      }
    }

    if (isSuccess) {
      // Save authenticated session & cached verified hash for offline resilience
      const enteredHash = await computePinHash(currentEnteredPin);
      const hashChanged = localStorage.getItem(PIN_STORAGE_KEYS.VERIFIED_HASH) !== enteredHash;
      localStorage.setItem(PIN_STORAGE_KEYS.VERIFIED_HASH, enteredHash);

      // app_data is scoped to this hash (see firestore.rules / firebaseSync.js).
      // If this is the first time we've had a valid hash this session (or it
      // just changed), (re)kick off cloud sync now that reads/writes will
      // actually be permitted.
      if (hashChanged || !cloudSyncInitialized) {
        cloudSyncInitialized = true;
        initCloudSync();
      }

      const rememberDevice = document.getElementById('pin-remember-device');
      const shouldRemember = rememberDevice ? rememberDevice.checked : true;

      if (shouldRemember) {
        localStorage.setItem(PIN_STORAGE_KEYS.IS_AUTHENTICATED, 'true');
      }
      sessionStorage.setItem(PIN_STORAGE_KEYS.IS_AUTHENTICATED, 'true');

      const lockScreen = document.getElementById('pin-lock-screen');
      const appLayout = document.getElementById('app-layout');

      if (lockScreen) {
        lockScreen.classList.add('unlocked');
        setTimeout(() => {
          lockScreen.style.display = 'none';
        }, 350);
      }
      if (appLayout) {
        appLayout.classList.remove('app-locked');
        appLayout.style.display = '';
      }

      currentEnteredPin = '';
      updatePinDisplayUI();
      clearPinError();

      renderCurrentTab();
      updateHeaderStats();
      showToast('تم التحقق بنجاح! أهلاً بك في منظومة تكوين النسيم ✨');
    } else {
      showPinError('⚠️ رمز المرور غير صحيح، يرجى المحاولة مرة أخرى');
    }
  } catch (err) {
    console.error('Error during PIN verification:', err);
    showPinError('⚠️ تعذر التحقق، يرجى المحاولة مرة أخرى');
  } finally {
    isVerifyingPin = false;
    if (submitBtn) {
      submitBtn.innerHTML = originalBtnText || '<span>🔓 فتح</span>';
    }
  }
}

function lockApp() {
  localStorage.removeItem(PIN_STORAGE_KEYS.IS_AUTHENTICATED);
  sessionStorage.removeItem(PIN_STORAGE_KEYS.IS_AUTHENTICATED);

  const lockScreen = document.getElementById('pin-lock-screen');
  const appLayout = document.getElementById('app-layout');

  if (appLayout) {
    appLayout.classList.add('app-locked');
    appLayout.style.display = 'none';
  }

  if (lockScreen) {
    lockScreen.style.display = 'flex';
    void lockScreen.offsetWidth;
    lockScreen.classList.remove('unlocked');
  }

  currentEnteredPin = '';
  clearPinError();
  updatePinDisplayUI();

  const hiddenInput = document.getElementById('pin-hidden-input');
  if (hiddenInput) {
    hiddenInput.focus();
  }

  showToast('تم قفل التطبيق برمز المرور بنجاح 🔒');
}

function initSecurityPinSystem() {
  const lockScreen = document.getElementById('pin-lock-screen');
  const appLayout = document.getElementById('app-layout');

  if (isAppUnlocked()) {
    if (lockScreen) {
      lockScreen.classList.add('unlocked');
      lockScreen.style.display = 'none';
    }
    if (appLayout) {
      appLayout.classList.remove('app-locked');
      appLayout.style.display = '';
    }
  } else {
    if (lockScreen) {
      lockScreen.classList.remove('unlocked');
      lockScreen.style.display = 'flex';
    }
    if (appLayout) {
      appLayout.classList.add('app-locked');
      appLayout.style.display = 'none';
    }
  }

  // Keypad clicks
  const keypad = document.getElementById('pin-keypad');
  if (keypad) {
    keypad.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      if (btn.dataset.digit !== undefined) {
        handlePinDigitInput(btn.dataset.digit);
      } else if (btn.id === 'pin-key-backspace') {
        handlePinBackspace();
      } else if (btn.id === 'pin-key-submit') {
        attemptUnlockApp();
      }
    });
  }

  // Toggle Visibility
  const toggleBtn = document.getElementById('btn-toggle-pin-visibility');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      isPinVisible = !isPinVisible;
      const icon = document.getElementById('pin-visibility-icon');
      if (icon) icon.textContent = isPinVisible ? '🙈' : '👁️';
      updatePinDisplayUI();
    });
  }

  // Keyboard support for typing PIN
  window.addEventListener('keydown', (e) => {
    if (lockScreen && lockScreen.style.display !== 'none' && !lockScreen.classList.contains('unlocked')) {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handlePinDigitInput(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handlePinBackspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        attemptUnlockApp();
      } else if (e.key === 'Escape') {
        currentEnteredPin = '';
        clearPinError();
        updatePinDisplayUI();
      }
    }
  });

  // Hidden input for mobile focus
  const pinDisplay = document.getElementById('pin-display-wrapper');
  const hiddenInput = document.getElementById('pin-hidden-input');
  if (pinDisplay && hiddenInput) {
    pinDisplay.addEventListener('click', () => {
      hiddenInput.focus();
      pinDisplay.classList.add('focused');
    });
    hiddenInput.addEventListener('blur', () => {
      pinDisplay.classList.remove('focused');
    });
    hiddenInput.addEventListener('input', (e) => {
      const val = e.target.value.replace(/\D/g, '');
      currentEnteredPin = val;
      updatePinDisplayUI();
      if (currentEnteredPin.length === 4) {
        attemptUnlockApp();
      }
    });
  }

  // Header Lock Button
  const btnLock = document.getElementById('btn-header-lock');
  if (btnLock) {
    btnLock.addEventListener('click', () => {
      lockApp();
    });
  }

  // Header Change PIN Button & Modal
  const btnChangePin = document.getElementById('btn-header-change-pin');
  const changePinModal = document.getElementById('change-pin-modal');
  const btnClosePinModal = document.getElementById('btn-close-pin-modal');
  const btnCancelPinModal = document.getElementById('btn-cancel-pin-modal');
  const formChangePin = document.getElementById('form-change-pin');
  const pinModalError = document.getElementById('pin-modal-error');
  const pinModalErrorText = document.getElementById('pin-modal-error-text');

  if (btnChangePin && changePinModal) {
    btnChangePin.addEventListener('click', () => {
      if (formChangePin) formChangePin.reset();
      if (pinModalError) pinModalError.style.display = 'none';
      changePinModal.classList.add('show');
      const curInput = document.getElementById('input-current-pin');
      if (curInput) setTimeout(() => curInput.focus(), 150);
    });
  }

  const closeChangePinModal = () => {
    if (changePinModal) changePinModal.classList.remove('show');
  };

  if (btnClosePinModal) btnClosePinModal.addEventListener('click', closeChangePinModal);
  if (btnCancelPinModal) btnCancelPinModal.addEventListener('click', closeChangePinModal);
  if (changePinModal) {
    changePinModal.addEventListener('click', (e) => {
      if (e.target === changePinModal) closeChangePinModal();
    });
  }

  if (formChangePin) {
    formChangePin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPin = (document.getElementById('input-current-pin')?.value || '').trim();
      const newPin = (document.getElementById('input-new-pin')?.value || '').trim();
      const confirmPin = (document.getElementById('input-confirm-pin')?.value || '').trim();

      const showModalError = (msg) => {
        if (pinModalError) {
          if (pinModalErrorText) pinModalErrorText.textContent = msg;
          pinModalError.style.display = 'block';
        }
      };

      if (!currentPin) {
        showModalError('يرجى إدخال رمز المرور الحالي ❌');
        return;
      }

      if (!/^\d{4,8}$/.test(newPin)) {
        showModalError('يجب أن يتكون رمز المرور الجديد من 4 إلى 8 أرقام فقط ❌');
        return;
      }

      if (newPin !== confirmPin) {
        showModalError('رمز المرور الجديد وتأكيده غير متطابقين ❌');
        return;
      }

      const saveBtn = document.getElementById('btn-save-new-pin');
      const originalBtnHtml = saveBtn ? saveBtn.innerHTML : '';
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span>⏳ جاري التحقق والتحديث...</span>';
      }

      try {
        const isCurrentValid = await verifySecurityPinWithCloud(currentPin);
        if (isCurrentValid !== true) {
          showModalError('رمز المرور الحالي غير صحيح ❌');
          return;
        }

        const updated = await updateSecurityPinInCloud(currentPin, newPin);
        if (updated) {
          const newHash = await computePinHash(newPin);
          localStorage.setItem(PIN_STORAGE_KEYS.VERIFIED_HASH, newHash);
          closeChangePinModal();
          showToast('تم تحديث رمز المرور بنجاح وحفظه سحابياً لجميع المشرفين ✨');
        } else {
          showModalError('تعذر تحديث الرمز في السحابة، يرجى المحاولة لاحقاً ❌');
        }
      } catch (err) {
        console.error('Error during PIN change:', err);
        showModalError('حدث خطأ أثناء تحديث رمز المرور ❌');
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = originalBtnHtml || '<span>💾 حفظ الرمز الجديد</span>';
        }
      }
    });
  }
}

async function initApp() {
  initSecurityPinSystem();
  loadData();
  setupEventListeners();
  setupNetworkStatusListeners();
  registerServiceWorker();
  updateDayPills();
  renderCurrentTab();
  updateHeaderStats();

  // If we came back with pending sync from a previous offline session, attempt sync
  if (navigator.onLine && localStorage.getItem(STORAGE_KEYS.PENDING_SYNC) === 'true') {
    syncPendingDataToCloud(false);
  }

  // Start cloud sync immediately for anyone viewing the page
  if (!cloudSyncInitialized) {
    cloudSyncInitialized = true;
    initCloudSync();
  }
}

async function initCloudSync() {
  setSyncStatusUI('syncing', 'جارِ الاتصال بالسحابة...');
  try {
    const cloudData = await loadAppDataFromCloud();
    if (cloudData) {
      const hasLocalUnsynced = localStorage.getItem(STORAGE_KEYS.HAS_UNSYNCED) === 'true' ||
                               localStorage.getItem(STORAGE_KEYS.PENDING_SYNC) === 'true';

      if (hasLocalUnsynced) {
        // حماية البيانات: دمج السجلات المحلية غير المتزامنة مع بيانات السحابة لمنع أي ضياع للبيانات عند التحديث
        records = {
          ...(cloudData.records || {}),
          ...records
        };
        if (Array.isArray(cloudData.students) && cloudData.students.length > 0) {
          const localMap = new Map(students.map(s => [s.id, s]));
          cloudData.students.forEach(cs => {
            if (!localMap.has(cs.id)) {
              students.push(cs);
            }
          });
        }
        students = ensureStudentsRoster(students);
        saveStudentsLocally();
        saveRecordsLocally();
        
        saveAppDataToCloud(students, records).then(ok => {
          if (ok) {
            localStorage.removeItem(STORAGE_KEYS.PENDING_SYNC);
            localStorage.removeItem(STORAGE_KEYS.HAS_UNSYNCED);
            setSyncStatusUI('online', 'متزامن سحابياً');
            updateAutoSaveStatusUI('saved');
          }
        });
      } else {
        if (Array.isArray(cloudData.students) && cloudData.students.length > 0) {
          const validated = ensureStudentsRoster(cloudData.students);
          students = validated;
          saveStudentsLocally();
          if (JSON.stringify(validated) !== JSON.stringify(cloudData.students)) {
            saveAppDataToCloud(students, records);
          }
        } else {
          students = [...DEFAULT_STUDENTS];
          saveStudentsLocally();
          saveAppDataToCloud(students, records);
        }
        if (cloudData.records && typeof cloudData.records === 'object') {
          records = cloudData.records;
          saveRecordsLocally();
        }
      }
      renderCurrentTab();
      updateHeaderStats();
      setSyncStatusUI('online', 'متزامن سحابياً');
      updateAutoSaveStatusUI('saved');
    } else {
      // First time on cloud: seed existing data
      await saveAppDataToCloud(students, records);
      setSyncStatusUI('online', 'متزامن سحابياً');
      updateAutoSaveStatusUI('saved');
    }

    // Subscribe to live cloud changes across all devices
    // (guard against a duplicate listener if initCloudSync runs more than
    // once in the same page session, e.g. right after a fresh PIN unlock)
    if (unsubscribeCloudChanges) {
      unsubscribeCloudChanges();
      unsubscribeCloudChanges = null;
    }
    unsubscribeCloudChanges = subscribeToCloudChanges((data) => {
      if (!isCloudSyncing && data) {
        const hasLocalUnsynced = localStorage.getItem(STORAGE_KEYS.HAS_UNSYNCED) === 'true' ||
                                 localStorage.getItem(STORAGE_KEYS.PENDING_SYNC) === 'true';
        if (hasLocalUnsynced) {
          // منع مسح التعديلات المحلية الجارية
          return;
        }

        let changed = false;
        if (Array.isArray(data.students)) {
          const validated = ensureStudentsRoster(data.students);
          if (JSON.stringify(validated) !== JSON.stringify(students)) {
            students = validated;
            saveStudentsLocally();
            changed = true;
          }
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
    updateAutoSaveStatusUI('offline');
  }
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
      appState.statsMonth = e.target.value;
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

  // Family Switcher Buttons (أسرة باموسى / أسرة أكرم)
  const btnFamBamousa = document.getElementById('btn-family-bamousa');
  const btnFamAkram = document.getElementById('btn-family-akram');

  if (btnFamBamousa) {
    btnFamBamousa.addEventListener('click', () => {
      appState.selectedFamily = 'bamousa';
      selectedStudentIds.clear();
      saveStateLocally();
      renderTrackingDayView();
    });
  }

  if (btnFamAkram) {
    btnFamAkram.addEventListener('click', () => {
      appState.selectedFamily = 'akram';
      selectedStudentIds.clear();
      saveStateLocally();
      renderTrackingDayView();
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
      const dayConfig = DAYS_CONFIG.find(d => d.id === day);
      if (!dayConfig) return;

      students.forEach(s => {
        const key = `${s.id}_${appState.currentMonth}_${appState.currentWeek}_${day}`;
        if (!records[key]) records[key] = {};
        
        dayConfig.items.forEach(item => {
          records[key][item.id] = (item.type === 'attendance') ? 'present' : 'done';
        });
      });
      triggerCloudSync();
      renderTrackingDayView();
      renderLeaderboard();
      updateHeaderStats();
      showToast(`تم تسجيل جميع الطلاب بالإنجاز الكامل (${dayConfig.name} - ${dayConfig.maxPoints} درجة) ✨`);
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
      const famSelect = document.getElementById('new-student-family');
      const name = input.value.trim();
      const family = famSelect ? famSelect.value : (appState.selectedFamily || 'bamousa');
      if (!name) return;

      const newStudent = {
        id: 'std_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        name: name,
        family: family,
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

  // Add Student & Backup Tabs
  const bulkForm = document.getElementById('bulk-student-form');
  const singleTabBtn = document.getElementById('tab-add-single');
  const bulkTabBtn = document.getElementById('tab-add-bulk');
  const backupTabBtn = document.getElementById('tab-add-backup');
  const backupSection = document.getElementById('backup-json-section');
  const bulkTextarea = document.getElementById('bulk-students-names');

  if (singleTabBtn && bulkTabBtn && addStudentForm && bulkForm) {
    const activateTab = (tab) => {
      singleTabBtn.classList.toggle('active', tab === 'single');
      bulkTabBtn.classList.toggle('active', tab === 'bulk');
      if (backupTabBtn) backupTabBtn.classList.toggle('active', tab === 'backup');

      addStudentForm.style.display = tab === 'single' ? 'flex' : 'none';
      bulkForm.style.display = tab === 'bulk' ? 'block' : 'none';
      if (backupSection) {
        backupSection.style.display = tab === 'backup' ? 'block' : 'none';
        if (tab === 'backup') {
          updateBackupStatsUI();
        }
      }
    };

    singleTabBtn.addEventListener('click', () => activateTab('single'));
    bulkTabBtn.addEventListener('click', () => activateTab('bulk'));
    if (backupTabBtn) {
      backupTabBtn.addEventListener('click', () => activateTab('backup'));
    }
  }

  // --- ربط أحداث أزرار النسخ الاحتياطي JSON ---
  const downloadBackupBtn = document.getElementById('btn-download-json-backup');
  if (downloadBackupBtn) {
    downloadBackupBtn.addEventListener('click', () => {
      downloadJsonBackup();
    });
  }

  const copyBackupBtn = document.getElementById('btn-copy-json-backup');
  if (copyBackupBtn) {
    copyBackupBtn.addEventListener('click', () => {
      copyJsonBackup();
    });
  }

  // منطقة اختيار أو إفلات ملف النسخة الاحتياطية
  const dropZone = document.getElementById('backup-drop-zone');
  const fileInput = document.getElementById('backup-file-input');

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        validateAndPreviewBackup(event.target.result);
      };
      reader.onerror = () => {
        showToast('تعذر قراءة الملف المحدد ⚠️');
      };
      reader.readAsText(file);
      fileInput.value = '';
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');

      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        validateAndPreviewBackup(event.target.result);
      };
      reader.onerror = () => {
        showToast('تعذر قراءة الملف المفلت ⚠️');
      };
      reader.readAsText(file);
    });
  }

  // تبديل إظهار مربع لصق الـ JSON يدوياً
  const togglePasteBtn = document.getElementById('btn-toggle-json-paste');
  const pasteWrapper = document.getElementById('json-paste-wrapper');
  const pasteTextarea = document.getElementById('json-paste-textarea');
  const validatePastedBtn = document.getElementById('btn-validate-pasted-json');

  if (togglePasteBtn && pasteWrapper) {
    togglePasteBtn.addEventListener('click', () => {
      const isHidden = pasteWrapper.style.display === 'none';
      pasteWrapper.style.display = isHidden ? 'block' : 'none';
      togglePasteBtn.innerHTML = isHidden 
        ? '<span>✖ إخفاء مربع اللصق</span>' 
        : '<span>✏️ أو الصق محتوى الـ JSON يدوياً</span>';
    });
  }

  if (validatePastedBtn && pasteTextarea) {
    validatePastedBtn.addEventListener('click', () => {
      validateAndPreviewBackup(pasteTextarea.value);
    });
  }

  // أزرار تنفيذ الاستعادة والإلغاء
  const restoreFullBtn = document.getElementById('btn-restore-full-backup');
  if (restoreFullBtn) {
    restoreFullBtn.addEventListener('click', () => {
      executeRestoreBackup('full');
    });
  }

  const restoreMergeBtn = document.getElementById('btn-restore-merge-backup');
  if (restoreMergeBtn) {
    restoreMergeBtn.addEventListener('click', () => {
      executeRestoreBackup('merge');
    });
  }

  const cancelPreviewBtn = document.getElementById('btn-cancel-preview');
  if (cancelPreviewBtn) {
    cancelPreviewBtn.addEventListener('click', () => {
      const previewCard = document.getElementById('backup-preview-card');
      if (previewCard) previewCard.style.display = 'none';
      pendingRestoreData = null;
      showToast('تم إلغاء معاينة الاستعادة');
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
        const isAkram = AKRAM_STUDENTS_LIST.some(ak => ak.trim().toLowerCase() === name.toLowerCase());
        const family = isAkram ? 'akram' : (appState.selectedFamily || 'bamousa');
        students.push({
          id: 'std_' + Date.now() + '_' + i + '_' + Math.floor(Math.random() * 1000),
          name: name,
          family: family,
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

  // Load Official Roster Button (46 Students: Bamousa 23 + Akram 23)
  const loadOfficialBtn = document.getElementById('btn-load-official-roster');
  if (loadOfficialBtn) {
    loadOfficialBtn.addEventListener('click', () => {
      if (confirm('هل تريد استعادة وتعيين القائمة الرسمية للأسر (أسرة باموسى 23 طالباً + أسرة أكرم 23 طالباً)؟')) {
        students = [...DEFAULT_STUDENTS];
        triggerCloudSync();
        renderStudentsList();
        renderTrackingDayView();
        renderLeaderboard();
        updateHeaderStats();
        showToast('تم استعادة وتثبيت القائمة الرسمية للأسر (46 طالباً) بنجاح 🏛️🌟');
      }
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
      saveStateLocally();
      renderMonthlyStats();
    });
  }

  const copyMonthlyReportBtn = document.getElementById('btn-copy-monthly-stats-report');
  if (copyMonthlyReportBtn) {
    copyMonthlyReportBtn.addEventListener('click', () => {
      copyMonthlyStatsReport();
    });
  }

  // --- Follow-up View Controls (مركز المتابعة ومعالجة مواطن الضعف) ---
  const followupMonthSelect = document.getElementById('followup-month-select');
  const followupWeekSelect = document.getElementById('followup-week-select');
  const followupSearchInput = document.getElementById('followup-search-input');
  const btnClearFollowupSearch = document.getElementById('btn-clear-followup-search');
  const btnExportFollowupPdf = document.getElementById('btn-export-followup-month-pdf');

  if (followupMonthSelect) {
    followupMonthSelect.value = appState.followupMonth || appState.currentMonth;
    followupMonthSelect.addEventListener('change', (e) => {
      appState.followupMonth = e.target.value;
      saveStateLocally();
      renderFollowupView();
    });
  }

  if (followupWeekSelect) {
    followupWeekSelect.value = appState.followupWeek || appState.currentWeek;
    followupWeekSelect.addEventListener('change', (e) => {
      appState.followupWeek = e.target.value;
      saveStateLocally();
      renderFollowupView();
    });
  }

  if (followupSearchInput) {
    followupSearchInput.addEventListener('input', (e) => {
      appState.followupSearchQuery = e.target.value.trim().toLowerCase();
      if (btnClearFollowupSearch) {
        btnClearFollowupSearch.style.display = appState.followupSearchQuery ? 'flex' : 'none';
      }
      renderFollowupView();
    });
  }

  if (btnClearFollowupSearch && followupSearchInput) {
    btnClearFollowupSearch.addEventListener('click', () => {
      followupSearchInput.value = '';
      appState.followupSearchQuery = '';
      btnClearFollowupSearch.style.display = 'none';
      renderFollowupView();
      followupSearchInput.focus();
    });
  }

  if (btnExportFollowupPdf) {
    btnExportFollowupPdf.addEventListener('click', () => {
      exportMonthlyFollowupPDF();
    });
  }

  // Follow-up Family Pills
  document.querySelectorAll('.followup-fam-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.followup-fam-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      appState.followupFamily = btn.dataset.followupFamily;
      saveStateLocally();
      renderFollowupView();
    });
  });

  // Follow-up Status Filters
  document.querySelectorAll('.status-filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.status-filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      appState.followupFilter = pill.dataset.followupFilter;
      saveStateLocally();
      renderFollowupView();
    });
  });

  // WhatsApp Report Modal Handlers
  setupReportModal();
  setupStudentReportModal();
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
  const followupView = document.getElementById('view-followup');
  const leaderboardView = document.getElementById('view-leaderboard');
  const statsView = document.getElementById('view-stats');
  const studentsView = document.getElementById('view-students');
  const controlBar = document.getElementById('control-bar');
  const familySwitcherBar = document.getElementById('family-switcher-bar');

  // مزامنة حالة التبويب النشط
  document.querySelectorAll('.nav-tab').forEach(tab => {
    if (tab.dataset.tab === appState.currentTab) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  const isTracking = appState.currentTab === 'tracking';
  const introWelcomeCard = document.getElementById('intro-welcome-card');

  if (introWelcomeCard) introWelcomeCard.style.display = isTracking ? 'flex' : 'none';
  if (trackingView) trackingView.style.display = isTracking ? 'block' : 'none';
  if (followupView) followupView.style.display = appState.currentTab === 'followup' ? 'block' : 'none';
  if (leaderboardView) leaderboardView.style.display = appState.currentTab === 'leaderboard' ? 'block' : 'none';
  if (statsView) statsView.style.display = appState.currentTab === 'stats' ? 'block' : 'none';
  if (studentsView) studentsView.style.display = appState.currentTab === 'students' ? 'block' : 'none';

  // إظهار شريط اختيار الأسرة وشريط التحكم فقط في تبويب الرصد اليومي
  if (familySwitcherBar) familySwitcherBar.style.display = isTracking ? 'flex' : 'none';
  if (controlBar) controlBar.style.display = isTracking ? 'flex' : 'none';

  if (appState.currentTab === 'tracking') {
    renderTrackingDayView();
  } else if (appState.currentTab === 'followup') {
    renderFollowupView();
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
  const config = DAYS_CONFIG.find(d => d.id === day);
  if (!config) return;

  const key = `${studentId}_${appState.currentMonth}_${appState.currentWeek}_${day}`;
  if (!records[key]) records[key] = {};

  config.items.forEach(item => {
    records[key][item.id] = (item.type === 'attendance') ? 'present' : 'done';
  });

  triggerCloudSync();
  renderTrackingDayView();
  renderLeaderboard();
  updateHeaderStats();
  showToast(`تم تسجيل الإنجاز الكامل (${config.maxPoints} درجات) للطالب ⚡`);
};

// --- Tracking View (اليوم والمتابعة - مع البحث والتصفية والتحديد المتعدد وتجاوب فائق للهواتف) ---
function renderTrackingDayView() {
  const container = document.getElementById('tracking-students-container');
  if (!container) return;

  const currentDayConfig = DAYS_CONFIG.find(d => d.id === appState.currentDay) || DAYS_CONFIG[0];
  const items = currentDayConfig.items;

  // تحديث أزرار وأعداد الأسر
  const countBamousa = students.filter(s => (s.family || 'bamousa') === 'bamousa').length;
  const countAkram = students.filter(s => s.family === 'akram').length;

  const btnBamousa = document.getElementById('btn-family-bamousa');
  const btnAkram = document.getElementById('btn-family-akram');
  const badgeBamousa = document.getElementById('count-family-bamousa');
  const badgeAkram = document.getElementById('count-family-akram');

  if (badgeBamousa) badgeBamousa.textContent = `${countBamousa} طالب`;
  if (badgeAkram) badgeAkram.textContent = `${countAkram} طالب`;

  const currentFam = appState.selectedFamily || 'bamousa';
  if (btnBamousa) btnBamousa.classList.toggle('active', currentFam === 'bamousa');
  if (btnAkram) btnAkram.classList.toggle('active', currentFam === 'akram');

  // طلاب الأسرة المحددة
  const familyStudents = students.filter(s => (s.family || 'bamousa') === currentFam);

  // Calculate filter counts for the active family for current day
  let unrecordedCount = 0;
  let doneCount = 0;
  let attentionCount = 0;

  familyStudents.forEach(student => {
    const record = getStudentDayRecord(student.id, appState.currentDay);
    if (isStudentDayUnrecordedOrIncomplete(record, items)) unrecordedCount++;

    const isAllDone = items.length > 0 && items.every(item => {
      const val = record[item.id];
      return val === 'present' || val === 'done';
    });
    if (isAllDone) doneCount++;

    const hasAttention = items.some(item => {
      const val = record[item.id];
      return val === 'absent' || val === 'excused' || val === 'none' || val === 'partial';
    });
    if (hasAttention) attentionCount++;
  });

  // Update filter pill badges
  const cAll = document.getElementById('count-filter-all');
  const cUnrec = document.getElementById('count-filter-unrecorded');
  const cDone = document.getElementById('count-filter-done');
  const cAttn = document.getElementById('count-filter-attention');

  if (cAll) cAll.textContent = familyStudents.length;
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
    const familyTitleName = currentFam === 'akram' ? 'أسرة أكرم' : 'أسرة باموسى';
    container.innerHTML = `
      <div style="text-align: center; padding: 36px 20px; background: white; border-radius: var(--radius-lg); border: 1px dashed var(--border-color); color: #64748b;">
        <p style="font-size: 1rem; font-weight: 700; margin-bottom: 6px;">لا توجد نتائج مطابقة للتصفية في ${familyTitleName}</p>
        <p style="font-size: 0.85rem;">جرّب تعديل البحث أو الضغط على تصفية "الكل".</p>
      </div>
    `;
    return;
  }

  const allVisibleSelected = filteredStudents.length > 0 && filteredStudents.every(s => selectedStudentIds.has(s.id));
  const someSelected = selectedStudentIds.size > 0;
  const familyTitleLabel = currentFam === 'akram' ? 'أسرة أكرم' : 'أسرة باموسى';

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
    `;

    // Render batch action group for each evaluation item of current day
    items.forEach(item => {
      const isAtt = item.type === 'attendance';
      const isTask = item.id === 'hifz' || item.id === 'murajaah';
      const posVal = isAtt ? 'present' : 'done';
      const excVal = 'excused';
      const negVal = isAtt ? 'absent' : 'none';

      const posLabel = isAtt ? 'حاضر' : 'منجز';
      const excIcon = isTask ? '⏳' : '⚠️';
      const excLabel = isTask ? 'جزئي' : 'مستأذن';
      const negLabel = isAtt ? 'غائب' : 'لم ينجز';

      html += `
        <div class="batch-group">
          <span class="batch-group-title">${item.icon} ${item.label}:</span>
          <button type="button" class="batch-btn batch-present" onclick="applyBatchField('${item.id}', '${posVal}', '${item.label}')" title="تسجيل ${item.label} مكتمل">
            <span>✅ ${posLabel}</span>
          </button>
          <button type="button" class="batch-btn batch-excused" onclick="applyBatchField('${item.id}', '${excVal}', '${item.label}')" title="تسجيل ${item.label} ${excLabel}">
            <span>${excIcon} ${excLabel}</span>
          </button>
          <button type="button" class="batch-btn batch-absent" onclick="applyBatchField('${item.id}', '${negVal}', '${item.label}')" title="تسجيل ${item.label} ${negLabel}">
            <span>❌ ${negLabel}</span>
          </button>
        </div>
      `;
    });

    html += `
          <!-- عمليات سريعة -->
          <div class="batch-group-actions">
            <button type="button" class="batch-btn batch-full" onclick="applyBatchFullDay()" title="تسجيل كل بنود اليوم مكتملة للمحددين">
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

  // ترويسة الجدول
  html += `
    <div class="compact-table-header">
      <div class="col-student-header">
        <label class="select-all-checkbox-wrapper" title="تحديد / إلغاء تحديد الكل">
          <input type="checkbox" id="chk-select-all-visible" ${allVisibleSelected ? 'checked' : ''} onchange="toggleSelectAllVisible(this.checked)">
          <span class="select-all-text">طلاب ${familyTitleLabel} (${filteredStudents.length})</span>
        </label>
      </div>
  `;

  items.forEach(item => {
    html += `
      <div class="col-field text-center" title="${item.label}">
        ${item.icon} ${item.label}
      </div>
    `;
  });

  html += `
      <div class="col-points text-center">النقاط</div>
    </div>
  `;

  // قائمة الطلاب
  filteredStudents.forEach((student, index) => {
    const studentIdx = index + 1;
    const record = getStudentDayRecord(student.id, appState.currentDay);
    const weekStats = calculateStudentWeekPoints(student.id);
    const dayPoints = calculateDayPoints(record, appState.currentDay);
    const isSelected = selectedStudentIds.has(student.id);
    const isIncomplete = isStudentDayUnrecordedOrIncomplete(record, items);
    const isPartiallyRecorded = isIncomplete && record.attendance !== undefined && record.attendance !== 'absent';

    // تلوين بطاقة الطالب بناءً على حالة الحضور اليومية لسرعة التتبع
    let statusClass = 'status-unrecorded';
    if (record.attendance === 'present') {
      statusClass = 'status-present';
    } else if (record.attendance === 'absent') {
      statusClass = 'status-absent';
    } else if (record.attendance === 'excused') {
      statusClass = 'status-excused';
    }
    if (isPartiallyRecorded) {
      statusClass += ' status-incomplete';
    }

    html += `
      <div class="student-compact-row ${statusClass} ${isSelected ? 'selected' : ''}" id="row-${student.id}">
        <!-- هوية الطالب مع خانة التحديد وزر الإنجاز السريع -->
        <div class="row-student-info">
          <label class="student-checkbox-label" title="تحديد الطالب لإجراء جماعي">
            <input type="checkbox" class="student-select-box" ${isSelected ? 'checked' : ''} onchange="toggleStudentSelect('${student.id}', this.checked)">
          </label>
          <div class="student-avatar-compact">${studentIdx}</div>
          <div class="student-name-compact" title="${escapeHtml(student.name)}">
            ${escapeHtml(student.name)}
            ${isPartiallyRecorded ? '<span class="badge-incomplete" title="تسجيل هذا اليوم ناقص: تم وضع الحضور ولكن توجد بنود متبقية لم تُرصد بعد">⚠️ رصد ناقص</span>' : ''}
          </div>
          <button type="button" class="btn-quick-full" title="تسجيل إنجاز كامل للطالب اليوم" 
            onclick="markStudentFullDay('${student.id}')">
            <span>⚡ تم الكل</span>
          </button>
        </div>

        <!-- أزرار الرصد اليومية المتجاوبة (أيقونات واضحة بدون زحمة أرقام) -->
        <div class="row-fields-group">
    `;

    items.forEach(item => {
      const isAtt = item.type === 'attendance';
      const isTask = item.id === 'hifz' || item.id === 'murajaah';
      const posVal = isAtt ? 'present' : 'done';
      const excVal = 'excused';
      const negVal = isAtt ? 'absent' : 'none';

      const excIcon = isTask ? '⏳' : '⚠️';
      const excTitle = isTask ? 'جزئي / مستأذن' : 'مستأذن';

      const currentVal = record[item.id];
      const isPos = currentVal === posVal;
      const isExc = currentVal === excVal || currentVal === 'partial';
      const isNeg = currentVal === negVal;

      html += `
        <div class="compact-cell">
          <span class="compact-cell-label">${item.icon} ${item.label}:</span>
          <div class="compact-btn-group">
            <button type="button" class="compact-btn present ${isPos ? 'active' : ''}" 
              title="${item.label}: مكتمل"
              onclick="setStudentDayField('${student.id}', '${item.id}', '${posVal}')">
              <span>✅</span>
            </button>
            <button type="button" class="compact-btn excused ${isExc ? 'active' : ''}" 
              title="${item.label}: ${excTitle}"
              onclick="setStudentDayField('${student.id}', '${item.id}', '${excVal}')">
              <span>${excIcon}</span>
            </button>
            <button type="button" class="compact-btn absent ${isNeg ? 'active' : ''}" 
              title="${item.label}: غائب / لم ينجز"
              onclick="setStudentDayField('${student.id}', '${item.id}', '${negVal}')">
              <span>❌</span>
            </button>
          </div>
        </div>
      `;
    });

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
      family: s.family || 'bamousa',
      total: detailed.total,
      prevTotal: prevPeriod ? prevDetailed.total : 0,
      jump: jump,
      stats: detailed
    };
  });

  // Sort descending by current week total (out of 100 max per week)
  studentScores.sort((a, b) => b.total - a.total);
  const maxPointsPossible = 100; // Weekly max points is 100
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
            <th style="min-width: 180px;">اسم الطالب</th>
            <th style="text-align: center; min-width: 120px;" title="عدد أيام الحضور والاعتذار">الحضور (أيام)</th>
            <th style="text-align: center; min-width: 120px;" title="عدد أيام الحفظ">الحفظ (أيام)</th>
            <th style="text-align: center; min-width: 120px;" title="عدد أيام المراجعة">المراجعة (أيام)</th>
            <th style="text-align: center; min-width: 140px;">الدروس والأنشطة</th>
            <th style="text-align: center; min-width: 100px;">نسبة الإنجاز</th>
            <th style="text-align: center; font-weight: 800; min-width: 110px;">المجموع الكلي</th>
          </tr>
        </thead>
        <tbody>
  `;

  studentScores.forEach((s, idx) => {
    // Medal Badges
    let rankBadge = `<span class="rank-badge rank-other">${idx + 1}</span>`;
    if (idx === 0) rankBadge = `<span class="rank-badge rank-1" title="المركز الأول">🥇 1</span>`;
    else if (idx === 1) rankBadge = `<span class="rank-badge rank-2" title="المركز الثاني">🥈 2</span>`;
    else if (idx === 2) rankBadge = `<span class="rank-badge rank-3" title="المركز الثالث">🥉 3</span>`;

    // هل حقق أعلى قفزة في النقاط؟
    const isTopClimber = hasClimber && s.jump === maxJump && s.jump > 0;

    // آخر 5 مراكز: خلفية حمراء وملاحظة "يصارع الهبوط"
    const isRelegationZone = totalCount >= 5 && idx >= totalCount - 5;
    const progressPct = Math.min(100, Math.max(0, Math.round((s.total / maxPointsPossible) * 100)));

    // الأنشطة والدروس بصيغة واضحة
    let activities = [];
    if (s.stats.lessonCount.present > 0) activities.push(`🕌 ${s.stats.lessonCount.present} دروس`);
    if (s.stats.familyMeeting === 'done') activities.push(`👨‍👩‍👦 اجتماع`);
    if (s.stats.thursdayProgram === 'done') activities.push(`🎯 فردي`);
    if (s.stats.thursdayInteraction === 'done') activities.push(`🤝 تفاعل`);

    const activityBadge = activities.length > 0
      ? `<span class="status-pill present" style="font-size: 0.76rem;">${activities.join(' • ')}</span>`
      : `<span class="status-pill unrec">⚪ -</span>`;

    tableHtml += `
      <tr class="${isRelegationZone ? 'relegation-danger-row' : ''} ${isTopClimber ? 'top-climber-row' : ''}">
        <td class="lb-col-rank" style="text-align: center;">${rankBadge}</td>
        <td class="lb-col-student">
          <div class="leaderboard-student-col">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span class="leaderboard-student-name">${escapeHtml(s.name)}</span>
              <span class="badge-family ${s.family || 'bamousa'}">${s.family === 'akram' ? 'أكرم' : 'باموسى'}</span>
            </div>
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
        <!-- الحضور -->
        <td class="lb-col-attendance" data-label="الحضور" style="text-align: center;">
          <div class="stat-counts-pill-group">
            <span class="stat-count-chip present" title="${s.stats.attDays.present} أيام حضور">✅ ${s.stats.attDays.present}</span>
            <span class="stat-count-chip excused" title="${s.stats.attDays.excused} أيام اعتذار">⚠️ ${s.stats.attDays.excused}</span>
            <span class="stat-count-chip absent" title="${s.stats.attDays.absent} أيام غياب">❌ ${s.stats.attDays.absent}</span>
          </div>
        </td>
        <!-- الحفظ -->
        <td class="lb-col-hifz" data-label="الحفظ" style="text-align: center;">
          <div class="stat-counts-pill-group">
            <span class="stat-count-chip present" title="${s.stats.hifzDays.done} أيام حفظ منجز">✅ ${s.stats.hifzDays.done}</span>
            <span class="stat-count-chip partial" title="${s.stats.hifzDays.excused} أيام جزئي / مستأذن">⏳ ${s.stats.hifzDays.excused}</span>
            <span class="stat-count-chip absent" title="${s.stats.hifzDays.none} أيام لم يحفظ">❌ ${s.stats.hifzDays.none}</span>
          </div>
        </td>
        <!-- المراجعة -->
        <td class="lb-col-murajaah" data-label="المراجعة" style="text-align: center;">
          <div class="stat-counts-pill-group">
            <span class="stat-count-chip present" title="${s.stats.murajaahDays.done} أيام مراجعة منجزة">✅ ${s.stats.murajaahDays.done}</span>
            <span class="stat-count-chip partial" title="${s.stats.murajaahDays.excused} أيام جزئي / مستأذن">⏳ ${s.stats.murajaahDays.excused}</span>
            <span class="stat-count-chip absent" title="${s.stats.murajaahDays.none} أيام لم يراجع">❌ ${s.stats.murajaahDays.none}</span>
          </div>
        </td>
        <!-- الدروس والأنشطة -->
        <td class="lb-col-activities" data-label="الدروس والأنشطة" style="text-align: center;">
          ${activityBadge}
        </td>
        <!-- نسبة الإنجاز -->
        <td class="lb-col-progress" data-label="نسبة الإنجاز" style="text-align: center;">
          <div class="progress-bar-container" title="${progressPct}%">
            <div class="progress-bar-fill" style="width: ${progressPct}%;"></div>
          </div>
          <span style="font-size: 0.76rem; color: #64748b; font-weight: 700;">${progressPct}%</span>
        </td>
        <!-- المجموع الكلي -->
        <td class="lb-col-total" data-label="المجموع الكلي" style="text-align: center;">
          <span class="points-total-pill ${isRelegationZone ? 'relegation-pts' : ''}">
            <b>${s.total}</b> / 100
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
const WEEKS_LIST = ['الأسبوع 1', 'الأسبوع 2', 'الأسبوع 3', 'الأسبوع 4'];

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
      overallQuranRate: 0,
      weeklyStats: [],
      studentSummaries: []
    };
  }

  let grandTotalPoints = 0;
  let totalAttPresent = 0;
  let totalAttRecorded = 0;
  let totalQuranDone = 0;
  let totalQuranRecorded = 0;
  let activeWeeksCount = 0;

  // Analysis per week
  const weeklyStats = WEEKS_LIST.map(week => {
    let weekTotalPts = 0;
    let weekAttPresent = 0;
    let weekAttCount = 0;
    let weekQuranDone = 0;
    let weekQuranCount = 0;
    let weekTopStudent = { name: '-', points: 0 };

    students.forEach(s => {
      const { total } = calculateStudentWeekPoints(s.id, week, month);
      weekTotalPts += total;
      if (total > weekTopStudent.points) {
        weekTopStudent = { name: s.name, points: total };
      }

      DAYS_CONFIG.forEach(d => {
        const rec = getStudentDayRecord(s.id, d.id, week, month);

        // Attendance (كل الأيام)
        if (rec.attendance === 'present' || rec.attendance === 'excused' || rec.attendance === 'absent') {
          weekAttCount++;
          if (rec.attendance === 'present') weekAttPresent++;
        }

        // الحفظ والمراجعة القرآنية
        if (rec.hifz) {
          weekQuranCount++;
          if (rec.hifz === 'done' || rec.hifz === 'present') weekQuranDone++;
          else if (rec.hifz === 'partial' || rec.hifz === 'excused') weekQuranDone += 0.5;
        }
        if (rec.murajaah) {
          weekQuranCount++;
          if (rec.murajaah === 'done' || rec.murajaah === 'present') weekQuranDone++;
          else if (rec.murajaah === 'partial' || rec.murajaah === 'excused') weekQuranDone += 0.5;
        }
      });
    });

    const weekHasData = (weekTotalPts > 0) || (weekAttCount > 0) || (weekQuranCount > 0);
    if (weekHasData) activeWeeksCount++;

    const weekAvg = totalStudents > 0 ? (weekTotalPts / totalStudents).toFixed(1) : 0;
    const weekAttRate = weekAttCount > 0 ? Math.round((weekAttPresent / weekAttCount) * 100) : 0;
    const weekQuranRate = weekQuranCount > 0 ? Math.round((weekQuranDone / weekQuranCount) * 100) : 0;

    return {
      week,
      totalPoints: weekTotalPts,
      avgPoints: Number(weekAvg),
      topStudent: weekTopStudent,
      attRate: weekAttRate,
      quranRate: weekQuranRate
    };
  });

  // Analysis per student across month
  const studentSummaries = students.map(s => {
    let studentMonthPts = 0;
    let weekBreakdown = {};
    let weekDetails = {};
    let attDays = { present: 0, excused: 0, absent: 0, total: 0 };
    let hifzDays = { done: 0, partial: 0, none: 0, total: 0 };
    let murajaahDays = { done: 0, partial: 0, none: 0, total: 0 };
    let lessonDays = { attended: 0, excused: 0, absent: 0, total: 0 };
    let familyMeetingDays = { done: 0, partial: 0, none: 0, total: 0 };
    let individualProgramDays = { done: 0, none: 0, total: 0 };
    let familyInteractionDays = { done: 0, none: 0, total: 0 };

    WEEKS_LIST.forEach(week => {
      const { total } = calculateStudentWeekPoints(s.id, week, month);
      studentMonthPts += total;
      weekBreakdown[week] = total;

      let wAttPres = 0, wAttAbs = 0, wAttExc = 0;
      let wHifzDone = 0, wMurDone = 0, wLessonAtt = 0, wMeetingDone = 0, wProgDone = 0, wInterDone = 0;

      DAYS_CONFIG.forEach(d => {
        const rec = getStudentDayRecord(s.id, d.id, week, month);

        // Attendance (جميع أيام الأسبوع)
        if (rec.attendance === 'present' || rec.attendance === 'excused' || rec.attendance === 'absent') {
          attDays.total++;
          totalAttRecorded++;
          if (rec.attendance === 'present') { 
            attDays.present++; 
            totalAttPresent++; 
            wAttPres++;
          } else if (rec.attendance === 'excused') { 
            attDays.excused++; 
            wAttExc++;
          } else if (rec.attendance === 'absent') { 
            attDays.absent++; 
            wAttAbs++;
          }
        }

        // الحفظ
        if (rec.hifz) {
          hifzDays.total++;
          totalQuranRecorded++;
          if (rec.hifz === 'done' || rec.hifz === 'present') {
            hifzDays.done++;
            totalQuranDone++;
            wHifzDone++;
          } else if (rec.hifz === 'partial' || rec.hifz === 'excused') {
            hifzDays.partial++;
            totalQuranDone += 0.5;
          } else {
            hifzDays.none++;
          }
        }

        // المراجعة
        if (rec.murajaah) {
          murajaahDays.total++;
          totalQuranRecorded++;
          if (rec.murajaah === 'done' || rec.murajaah === 'present') {
            murajaahDays.done++;
            totalQuranDone++;
            wMurDone++;
          } else if (rec.murajaah === 'partial' || rec.murajaah === 'excused') {
            murajaahDays.partial++;
            totalQuranDone += 0.5;
          } else {
            murajaahDays.none++;
          }
        }

        // الدروس (الأحد والثلاثاء)
        if (rec.lesson) {
          lessonDays.total++;
          if (rec.lesson === 'present' || rec.lesson === 'done') {
            lessonDays.attended++;
            wLessonAtt++;
          } else if (rec.lesson === 'excused') {
            lessonDays.excused++;
          } else {
            lessonDays.absent++;
          }
        }

        // اللقاء الأسري (الاثنين)
        if (rec.familyMeeting) {
          familyMeetingDays.total++;
          if (rec.familyMeeting === 'done' || rec.familyMeeting === 'present') {
            familyMeetingDays.done++;
            wMeetingDone++;
          } else if (rec.familyMeeting === 'partial' || rec.familyMeeting === 'excused') {
            familyMeetingDays.partial++;
          } else {
            familyMeetingDays.none++;
          }
        }

        // البرنامج الفردي (الخميس)
        if (rec.individualProgram) {
          individualProgramDays.total++;
          if (rec.individualProgram === 'done' || rec.individualProgram === 'present') {
            individualProgramDays.done++;
            wProgDone++;
          } else {
            individualProgramDays.none++;
          }
        }

        // التفاعل الأسري (الخميس)
        if (rec.familyInteraction) {
          familyInteractionDays.total++;
          if (rec.familyInteraction === 'done' || rec.familyInteraction === 'present') {
            familyInteractionDays.done++;
            wInterDone++;
          } else {
            familyInteractionDays.none++;
          }
        }
      });

      weekDetails[week] = {
        points: total,
        attPresent: wAttPres,
        attAbsent: wAttAbs,
        attExcused: wAttExc,
        hifzDone: wHifzDone,
        murajaahDone: wMurDone,
        lessonAtt: wLessonAtt,
        meetingDone: wMeetingDone,
        progDone: wProgDone,
        interDone: wInterDone
      };
    });

    grandTotalPoints += studentMonthPts;

    // احتساب نسبة الالتزام بناء على الأسابيع التي تم رصد بيانات فيها (100 نقطة لكل أسبوع)
    const effectiveWeeks = Math.max(1, activeWeeksCount || 1);
    const maxPossiblePoints = effectiveWeeks * 100;
    const pointsCommitmentRate = Math.min(100, Math.max(0, Math.round((studentMonthPts / maxPossiblePoints) * 100)));
    const attendancePct = attDays.total > 0 ? Math.round((attDays.present / attDays.total) * 100) : 0;
    const totalQuranTasks = hifzDays.total + murajaahDays.total;
    const doneQuranTasks = hifzDays.done + murajaahDays.done + (hifzDays.partial + murajaahDays.partial) * 0.5;
    const quranPct = totalQuranTasks > 0 ? Math.round((doneQuranTasks / totalQuranTasks) * 100) : 0;

    return {
      id: s.id,
      name: s.name,
      family: s.family || 'bamousa',
      totalPoints: studentMonthPts,
      weekBreakdown,
      weekDetails,
      attDays,
      hifzDays,
      murajaahDays,
      lessonDays,
      familyMeetingDays,
      individualProgramDays,
      familyInteractionDays,
      commitmentRate: pointsCommitmentRate,
      attendancePct,
      quranPct
    };
  });

  // Sort descending by monthly total points
  studentSummaries.sort((a, b) => b.totalPoints - a.totalPoints);

  const averagePoints = totalStudents > 0 ? (grandTotalPoints / totalStudents).toFixed(1) : 0;
  const overallAttendanceRate = totalAttRecorded > 0 ? Math.round((totalAttPresent / totalAttRecorded) * 100) : 0;
  const overallQuranRate = totalQuranRecorded > 0 ? Math.round((totalQuranDone / totalQuranRecorded) * 100) : 0;

  // Family Attendance Comparison Analysis (مقارنة نسبة الحضور بين أسرة باموسى وأسرة أكرم)
  const bamousaStudents = students.filter(s => (s.family || 'bamousa') === 'bamousa');
  const akramStudents = students.filter(s => s.family === 'akram');

  let bamousaAttPresent = 0;
  let bamousaAttExcused = 0;
  let bamousaAttAbsent = 0;
  let bamousaAttRecorded = 0;
  let bamousaTotalPoints = 0;

  let akramAttPresent = 0;
  let akramAttExcused = 0;
  let akramAttAbsent = 0;
  let akramAttRecorded = 0;
  let akramTotalPoints = 0;

  studentSummaries.forEach(s => {
    const isBamousa = (s.family || 'bamousa') === 'bamousa';
    if (isBamousa) {
      bamousaTotalPoints += s.totalPoints;
      bamousaAttPresent += s.attDays.present;
      bamousaAttExcused += s.attDays.excused;
      bamousaAttAbsent += s.attDays.absent;
      bamousaAttRecorded += s.attDays.total;
    } else {
      akramTotalPoints += s.totalPoints;
      akramAttPresent += s.attDays.present;
      akramAttExcused += s.attDays.excused;
      akramAttAbsent += s.attDays.absent;
      akramAttRecorded += s.attDays.total;
    }
  });

  const bamousaAttRate = bamousaAttRecorded > 0 ? Math.round((bamousaAttPresent / bamousaAttRecorded) * 100) : 0;
  const akramAttRate = akramAttRecorded > 0 ? Math.round((akramAttPresent / akramAttRecorded) * 100) : 0;
  const rateDiff = Math.abs(bamousaAttRate - akramAttRate);
  let familyLeader = 'tie';
  if (bamousaAttRate > akramAttRate) familyLeader = 'bamousa';
  else if (akramAttRate > bamousaAttRate) familyLeader = 'akram';

  const familyComparison = {
    bamousa: {
      name: 'أسرة باموسى',
      icon: '🏛️',
      studentsCount: bamousaStudents.length,
      attRate: bamousaAttRate,
      attPresent: bamousaAttPresent,
      attExcused: bamousaAttExcused,
      attAbsent: bamousaAttAbsent,
      attRecorded: bamousaAttRecorded,
      totalPoints: bamousaTotalPoints,
      avgPoints: bamousaStudents.length > 0 ? (bamousaTotalPoints / bamousaStudents.length).toFixed(1) : 0
    },
    akram: {
      name: 'أسرة أكرم',
      icon: '🌟',
      studentsCount: akramStudents.length,
      attRate: akramAttRate,
      attPresent: akramAttPresent,
      attExcused: akramAttExcused,
      attAbsent: akramAttAbsent,
      attRecorded: akramAttRecorded,
      totalPoints: akramTotalPoints,
      avgPoints: akramStudents.length > 0 ? (akramTotalPoints / akramStudents.length).toFixed(1) : 0
    },
    diff: rateDiff,
    leader: familyLeader
  };

  // Most committed students: students with recorded points > 0
  const avgPtsVal = Number(averagePoints);
  const mostCommittedStudents = studentSummaries.filter(s => s.totalPoints > 0 && (s.totalPoints >= avgPtsVal || s.commitmentRate >= 50));

  return {
    month,
    totalStudents,
    totalPoints: grandTotalPoints,
    averagePoints: Number(averagePoints),
    mostCommittedCount: mostCommittedStudents.length,
    mostCommittedStudents,
    overallAttendanceRate,
    overallQuranRate,
    weeklyStats,
    studentSummaries,
    familyComparison
  };
}

function renderMonthlyStats() {
  const selectedMonth = appState.statsMonth || appState.currentMonth || 'شهر 1';
  const subtitle = document.getElementById('stats-period-subtitle');
  if (subtitle) {
    subtitle.textContent = `ملخص شامل ودقيق لنقاط وحضور وإنجاز الطلاب في (${selectedMonth})`;
  }

  const monthSelect = document.getElementById('stats-month-select');
  if (monthSelect) {
    monthSelect.value = selectedMonth;
  }

  const stats = getMonthlyPerformanceSummary(selectedMonth);

  renderMonthlyKPIs(stats);
  renderMonthlyFamilyComparison(stats);
  renderMonthlyTopCommitted(stats);
}

function renderMonthlyFamilyComparison(stats) {
  const container = document.getElementById('stats-family-comparison-body');
  const badge = document.getElementById('stats-family-leader-badge');
  if (!container) return;

  const fc = stats.familyComparison;
  const b = fc.bamousa;
  const a = fc.akram;

  // Update Badge
  if (badge) {
    if (fc.leader === 'bamousa') {
      badge.className = 'stats-badge-pill blue-pill';
      badge.textContent = `🏛️ الصدارة: باموسى (+${fc.diff}%)`;
    } else if (fc.leader === 'akram') {
      badge.className = 'stats-badge-pill gold-pill';
      badge.textContent = `🌟 الصدارة: أكرم (+${fc.diff}%)`;
    } else {
      badge.className = 'stats-badge-pill blue-pill';
      badge.textContent = `🤝 تعادل بالحضور (${b.attRate}%)`;
    }
  }

  // Calculate SVG Chart Bar Coordinates
  const chartHeight = 140;
  const chartBaseline = 170;
  const bamousaBarH = Math.max(4, Math.round((b.attRate / 100) * chartHeight));
  const akramBarH = Math.max(4, Math.round((a.attRate / 100) * chartHeight));
  const bamousaBarY = chartBaseline - bamousaBarH;
  const akramBarY = chartBaseline - akramBarH;

  // Insight message
  let insightHtml = '';
  if (b.attRecorded === 0 && a.attRecorded === 0) {
    insightHtml = `
      <div class="comparison-insight-box empty">
        <span class="insight-icon">ℹ️</span>
        <span>لم يُسجل حضور لأي من الأسرتين في <b>(${stats.month})</b> حتى الآن. ابدأ بتسجيل الحضور في شاشة المتابعة لتحديث المقارنة تلقائياً.</span>
      </div>
    `;
  } else if (fc.leader === 'bamousa') {
    insightHtml = `
      <div class="comparison-insight-box" style="background: #eff6ff; border-color: #bfdbfe; color: #1e40af;">
        <span class="insight-icon">🏆</span>
        <span>تتصدر <b>أسرة باموسى</b> نسبة الحضور في (${stats.month}) بنسبة <b>${b.attRate}%</b> وبفارق <b>+${fc.diff}%</b> عن أسرة أكرم (${a.attRate}%).</span>
      </div>
    `;
  } else if (fc.leader === 'akram') {
    insightHtml = `
      <div class="comparison-insight-box" style="background: #fffbeb; border-color: #fde68a; color: #92400e;">
        <span class="insight-icon">🏆</span>
        <span>تتصدر <b>أسرة أكرم</b> نسبة الحضور في (${stats.month}) بنسبة <b>${a.attRate}%</b> وبفارق <b>+${fc.diff}%</b> عن أسرة باموسى (${b.attRate}%).</span>
      </div>
    `;
  } else {
    insightHtml = `
      <div class="comparison-insight-box tie">
        <span class="insight-icon">🤝</span>
        <span>أداء متقارب وممتاز! حققت الأسرتان نسبة حضور متطابقة تبلغ <b>${b.attRate}%</b> خلال (${stats.month}).</span>
      </div>
    `;
  }

  const html = `
    <!-- البطاقات التوضيحية لنسبة كل أسرة -->
    <div class="comparison-layout-grid">
      <!-- بطاقة أسرة باموسى -->
      <div class="family-chart-card bamousa-card ${fc.leader === 'bamousa' ? 'is-winner' : ''}">
        <div class="family-chart-header">
          <div class="family-chart-title-box">
            <span class="family-chart-icon">🏛️</span>
            <div>
              <span class="family-chart-name">أسرة باموسى</span>
              <span class="family-chart-count">(${b.studentsCount} طالباً)</span>
            </div>
          </div>
          <div class="family-rate-display">
            <span class="family-rate-number">${b.attRate}</span>
            <span class="family-rate-unit">%</span>
          </div>
        </div>

        <!-- شريط التقدم -->
        <div class="family-bar-track" title="نسبة الحضور: ${b.attRate}%">
          <div class="family-bar-fill bamousa-fill" style="width: ${b.attRate}%;"></div>
        </div>

        <!-- تفاصيل الحضور -->
        <div class="family-chart-breakdown">
          <div class="breakdown-item">
            <span class="breakdown-dot present"></span>
            <span>حضور: <b>${b.attPresent}</b></span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-dot excused"></span>
            <span>عذر: <b>${b.attExcused}</b></span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-dot absent"></span>
            <span>غياب: <b>${b.attAbsent}</b></span>
          </div>
        </div>
      </div>

      <!-- بطاقة أسرة أكرم -->
      <div class="family-chart-card akram-card ${fc.leader === 'akram' ? 'is-winner' : ''}">
        <div class="family-chart-header">
          <div class="family-chart-title-box">
            <span class="family-chart-icon">🌟</span>
            <div>
              <span class="family-chart-name">أسرة أكرم</span>
              <span class="family-chart-count">(${a.studentsCount} طالباً)</span>
            </div>
          </div>
          <div class="family-rate-display">
            <span class="family-rate-number">${a.attRate}</span>
            <span class="family-rate-unit">%</span>
          </div>
        </div>

        <!-- شريط التقدم -->
        <div class="family-bar-track" title="نسبة الحضور: ${a.attRate}%">
          <div class="family-bar-fill akram-fill" style="width: ${a.attRate}%;"></div>
        </div>

        <!-- تفاصيل الحضور -->
        <div class="family-chart-breakdown">
          <div class="breakdown-item">
            <span class="breakdown-dot present"></span>
            <span>حضور: <b>${a.attPresent}</b></span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-dot excused"></span>
            <span>عذر: <b>${a.attExcused}</b></span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-dot absent"></span>
            <span>غياب: <b>${a.attAbsent}</b></span>
          </div>
        </div>
      </div>
    </div>

    <!-- الرسم البياني بالأعمدة SVG -->
    <div class="visual-comparison-graph-box">
      <div class="graph-header-row">
        <div class="graph-title">
          <span>📊 المنحنى المقارن لأعمدة الحضور</span>
        </div>
        <div class="graph-legend">
          <div class="legend-item">
            <span class="legend-color-box bamousa"></span>
            <span>أسرة باموسى (${b.attRate}%)</span>
          </div>
          <div class="legend-item">
            <span class="legend-color-box akram"></span>
            <span>أسرة أكرم (${a.attRate}%)</span>
          </div>
        </div>
      </div>

      <div class="comparison-svg-wrapper">
        <svg class="comparison-svg" viewBox="0 0 540 215" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bamousaColGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#0060cc" />
              <stop offset="100%" stop-color="#004094" />
            </linearGradient>
            <linearGradient id="akramColGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#f59e0b" />
              <stop offset="100%" stop-color="#d97706" />
            </linearGradient>
            <filter id="barShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity="0.18" />
            </filter>
          </defs>

          <!-- خطوط الشبكة والمحور الصادي (Gridlines) -->
          <g stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4,4">
            <line x1="50" y1="30" x2="510" y2="30" />
            <line x1="50" y1="65" x2="510" y2="65" />
            <line x1="50" y1="100" x2="510" y2="100" />
            <line x1="50" y1="135" x2="510" y2="135" />
          </g>

          <!-- خط الأساس الأرضي الصلب -->
          <line x1="50" y1="170" x2="510" y2="170" stroke="#cbd5e1" stroke-width="2" />

          <!-- نسب المحور الصادي -->
          <g font-family="inherit" font-size="11" font-weight="700" fill="#94a3b8" text-anchor="start">
            <text x="12" y="34">100%</text>
            <text x="12" y="69">75%</text>
            <text x="12" y="104">50%</text>
            <text x="12" y="139">25%</text>
            <text x="12" y="174">0%</text>
          </g>

          <!-- عمود أسرة باموسى -->
          <g>
            <rect 
              x="130" 
              y="${bamousaBarY}" 
              width="90" 
              height="${bamousaBarH}" 
              rx="8" 
              fill="url(#bamousaColGrad)" 
              filter="url(#barShadow)"
            />
            <!-- القيمة بالنسبة المئوية أعلى العمود -->
            <text 
              x="175" 
              y="${Math.max(22, bamousaBarY - 8)}" 
              font-family="inherit" 
              font-size="14" 
              font-weight="900" 
              fill="#004094" 
              text-anchor="middle"
            >
              ${b.attRate}%
            </text>
            <!-- تسمية الأسرة أسفل الخط -->
            <text x="175" y="193" font-family="inherit" font-size="13" font-weight="800" fill="#0f172a" text-anchor="middle">
              🏛️ أسرة باموسى
            </text>
          </g>

          <!-- عمود أسرة أكرم -->
          <g>
            <rect 
              x="320" 
              y="${akramBarY}" 
              width="90" 
              height="${akramBarH}" 
              rx="8" 
              fill="url(#akramColGrad)" 
              filter="url(#barShadow)"
            />
            <!-- القيمة بالنسبة المئوية أعلى العمود -->
            <text 
              x="365" 
              y="${Math.max(22, akramBarY - 8)}" 
              font-family="inherit" 
              font-size="14" 
              font-weight="900" 
              fill="#b45309" 
              text-anchor="middle"
            >
              ${a.attRate}%
            </text>
            <!-- تسمية الأسرة أسفل الخط -->
            <text x="365" y="193" font-family="inherit" font-size="13" font-weight="800" fill="#0f172a" text-anchor="middle">
              🌟 أسرة أكرم
            </text>
          </g>
        </svg>
      </div>
    </div>

    <!-- بطاقة الملخص والتحليل -->
    ${insightHtml}
  `;

  container.innerHTML = html;
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

    <!-- 4. معدل إنجاز الحفظ والمراجعة القرآنية -->
    <div class="kpi-card kpi-wird">
      <div class="kpi-header">
        <span class="kpi-title">إنجاز الحفظ والمراجعة</span>
        <span class="kpi-icon">📖</span>
      </div>
      <div class="kpi-value-row">
        <span class="kpi-value">${stats.overallQuranRate}%</span>
        <span class="kpi-unit">إنجاز القرآن</span>
      </div>
      <div class="kpi-footer">
        <span>التزام الحفظ والمراجعة القرآنية</span>
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
  text += `📖 *معدل إنجاز الحفظ والمراجعة القرآنية:* ${stats.overallQuranRate}%\n`;
  text += `✨ *إجمالي النقاط المسجلة:* ${stats.totalPoints.toLocaleString('ar-SA')} نقطة\n\n`;

  if (stats.familyComparison) {
    const fc = stats.familyComparison;
    text += `🏛️ *مقارنة الحضور بين الأسر في ${selectedMonth}:*\n`;
    text += `• 🏛️ *أسرة باموسى:* ${fc.bamousa.attRate}% (${fc.bamousa.attPresent} حضور من ${fc.bamousa.attRecorded})\n`;
    text += `• 🌟 *أسرة أكرم:* ${fc.akram.attRate}% (${fc.akram.attPresent} حضور من ${fc.akram.attRecorded})\n`;
    if (fc.leader === 'bamousa') {
      text += `👑 *الصدارة بالحضور:* أسرة باموسى بفارق (+${fc.diff}%)\n\n`;
    } else if (fc.leader === 'akram') {
      text += `👑 *الصدارة بالحضور:* أسرة أكرم بفارق (+${fc.diff}%)\n\n`;
    } else {
      text += `🤝 *النتيجة:* تعادل في نسبة الحضور بين الأسرتين!\n\n`;
    }
  }

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

// ==========================================================================
// --- مركز المتابعة الفردية وتشخيص مواطن الضعف (Follow-up & Diagnostics Engine) ---
// ==========================================================================

let currentReportStudentId = null;

function getStudentWeeklyDiagnostic(studentId, week = (appState.followupWeek || appState.currentWeek), month = (appState.followupMonth || appState.currentMonth)) {
  const student = students.find(s => s.id === studentId);
  if (!student) return null;

  const daysData = [];
  let totalPoints = 0;
  let maxPossiblePoints = 0;

  const presentDays = [];
  const absentDays = [];
  const excusedDays = [];
  const unrecordedDays = [];

  // Lessons (Sunday, Tuesday)
  const lessonsExpected = [];
  const lessonsAttended = [];
  const lessonsMissed = [];
  const lessonsExcused = [];

  // Murajaah
  let murajaahExpected = 0;
  const murajaahDone = [];
  const murajaahMissed = [];
  const murajaahPartial = [];

  // Hifz
  let hifzExpected = 0;
  const hifzDone = [];
  const hifzMissed = [];
  const hifzPartial = [];

  // Activities
  let familyMeetingDone = false;
  let familyMeetingMissed = false;
  let thursdayProgramDone = false;
  let thursdayProgramMissed = false;
  let thursdayInteractionDone = false;

  // Tracking recorded status
  let recordedDaysCount = 0;
  let attendanceRecordedCount = 0;
  let quranRecordedOpportunities = 0;
  let quranRecordedDone = 0;
  let quranRecordedMissed = 0;

  DAYS_CONFIG.forEach(dConfig => {
    maxPossiblePoints += dConfig.maxPoints;
    const key = `${studentId}_${month}_${week}_${dConfig.id}`;
    const rec = records[key] || {};
    const dPoints = calculateDayPoints(rec, dConfig.id);
    totalPoints += dPoints;

    const isDayRecorded = rec.attendance !== undefined || dConfig.items.some(it => rec[it.id] !== undefined);
    if (isDayRecorded) {
      recordedDaysCount++;
    }

    // 1. Attendance Check
    if (rec.attendance !== undefined) {
      attendanceRecordedCount++;
      if (rec.attendance === 'present') {
        presentDays.push(dConfig.name);
      } else if (rec.attendance === 'absent') {
        absentDays.push(dConfig.name);
      } else if (rec.attendance === 'excused') {
        excusedDays.push(dConfig.name);
      }
    } else {
      unrecordedDays.push(dConfig.name);
    }

    // 2. Lessons Check (Sunday, Tuesday)
    if (dConfig.items.some(it => it.id === 'lesson')) {
      lessonsExpected.push(dConfig.name);
      if (rec.lesson === 'present') {
        lessonsAttended.push(dConfig.name);
      } else if (rec.lesson === 'excused') {
        lessonsExcused.push(dConfig.name);
      } else if (rec.attendance !== undefined && (rec.lesson === 'absent' || rec.lesson === 'none' || rec.attendance === 'absent')) {
        lessonsMissed.push(dConfig.name);
      }
    }

    // 3. Murajaah Check
    if (dConfig.items.some(it => it.id === 'murajaah')) {
      murajaahExpected++;
      const isMurRecorded = rec.murajaah !== undefined || (rec.attendance !== undefined && rec.attendance === 'absent');
      if (isMurRecorded) {
        quranRecordedOpportunities++;
        if (rec.murajaah === 'done') {
          murajaahDone.push(dConfig.name);
          quranRecordedDone++;
        } else if (rec.murajaah === 'partial' || rec.murajaah === 'excused') {
          murajaahPartial.push(dConfig.name);
          quranRecordedDone += 0.5;
        } else if (rec.murajaah === 'none' || rec.murajaah === 'absent' || rec.attendance === 'absent') {
          murajaahMissed.push(dConfig.name);
          quranRecordedMissed++;
        }
      }
    }

    // 4. Hifz Check
    if (dConfig.items.some(it => it.id === 'hifz')) {
      hifzExpected++;
      const isHifzRecorded = rec.hifz !== undefined || (rec.attendance !== undefined && rec.attendance === 'absent');
      if (isHifzRecorded) {
        quranRecordedOpportunities++;
        if (rec.hifz === 'done') {
          hifzDone.push(dConfig.name);
          quranRecordedDone++;
        } else if (rec.hifz === 'partial' || rec.hifz === 'excused') {
          hifzPartial.push(dConfig.name);
          quranRecordedDone += 0.5;
        } else if (rec.hifz === 'none' || rec.hifz === 'absent' || rec.attendance === 'absent') {
          hifzMissed.push(dConfig.name);
          quranRecordedMissed++;
        }
      }
    }

    // 5. Monday Meeting
    if (dConfig.id === 'monday') {
      const isMondayRecorded = rec.attendance !== undefined;
      if (rec.familyMeeting === 'done') {
        familyMeetingDone = true;
      } else if (isMondayRecorded && (rec.familyMeeting === 'none' || rec.attendance === 'absent' || !rec.familyMeeting)) {
        familyMeetingMissed = true;
      }
    }

    // 6. Thursday Activities (Individual Program + Family Interaction)
    if (dConfig.id === 'thursday') {
      const isThursdayRecorded = rec.attendance !== undefined;
      if (rec.individualProgram === 'done') {
        thursdayProgramDone = true;
      } else if (isThursdayRecorded && (rec.individualProgram === 'none' || rec.attendance === 'absent' || !rec.individualProgram)) {
        thursdayProgramMissed = true;
      }

      if (rec.familyInteraction === 'done') {
        thursdayInteractionDone = true;
      }
    }

    daysData.push({
      dayId: dConfig.id,
      dayName: dConfig.name,
      config: dConfig,
      record: rec,
      points: dPoints,
      maxPoints: dConfig.maxPoints
    });
  });

  const isAnyRecorded = recordedDaysCount > 0;
  const percentage = maxPossiblePoints > 0 ? Math.round((totalPoints / maxPossiblePoints) * 100) : 0;
  const attendanceRate = DAYS_CONFIG.length > 0 ? Math.round((presentDays.length / DAYS_CONFIG.length) * 100) : 0;
  const attendanceRecordedRate = attendanceRecordedCount > 0 ? Math.round((presentDays.length / attendanceRecordedCount) * 100) : 0;

  const quranExpectedTotal = murajaahExpected + hifzExpected;
  const quranDoneTotal = murajaahDone.length + hifzDone.length;
  const quranRate = quranExpectedTotal > 0 ? Math.round((quranDoneTotal / quranExpectedTotal) * 100) : 0;
  const quranRecordedRate = quranRecordedOpportunities > 0 ? Math.round((quranRecordedDone / quranRecordedOpportunities) * 100) : 0;

  // Diagnostic Weaknesses & Alerts
  const weaknesses = [];
  const strengths = [];

  // إذا تم رصد بيانات للطالب في هذا الأسبوع فقط، نقوم بتحليل وتشخيص الأداء
  if (isAnyRecorded) {
    // 1. تشخيص كثرة الغيابات (لا تظهر أبداً إلا في حال وجود أيام غياب فعلية مرصودة)
    if (attendanceRecordedCount > 0 && absentDays.length >= 2) {
      weaknesses.push({
        type: 'danger',
        icon: '🚨',
        title: `كثرة غيابات: تغيب في (${absentDays.join('، ')})`
      });
    } else if (attendanceRecordedCount >= 3 && attendanceRecordedRate < 20 && absentDays.length > 0) {
      weaknesses.push({
        type: 'danger',
        icon: '🚨',
        title: `كثرة غيابات (حضور أقل من 20%): تغيب في (${absentDays.join('، ')})`
      });
    } else if (attendanceRecordedCount > 0 && absentDays.length === 1) {
      weaknesses.push({
        type: 'warning',
        icon: '⚠️',
        title: `تغيب عن الحضور يوم (${absentDays[0]})`
      });
    }

    if (excusedDays.length >= 2) {
      weaknesses.push({
        type: 'warning',
        icon: 'ℹ️',
        title: `استئذان وتأخر متكرر في (${excusedDays.join('، ')})`
      });
    }

    // 2. تشخيص ضعف الجانب القرآني (لا يظهر أبداً إلا إذا رُصدت أوراد قرآنية وكان هناك تقصير فعلي)
    if (quranRecordedOpportunities >= 2 && quranRecordedMissed >= 2 && quranRecordedRate < 25) {
      weaknesses.push({
        type: 'danger',
        icon: '📖',
        title: 'ضعف إنجاز بالجانب القرآني'
      });
    }

    // B. الدروس العلمية
    if (lessonsMissed.length >= 2) {
      weaknesses.push({
        type: 'danger',
        icon: '📚',
        title: `انقطاع تام عن حضور الدروس العلمية طوال الأسبوع: لم يحضر في (${lessonsMissed.join(' و ')})`
      });
    } else if (lessonsMissed.length === 1) {
      weaknesses.push({
        type: 'warning',
        icon: '📚',
        title: `لم يحضر الدرس العلمي المقرر يوم (${lessonsMissed[0]})`
      });
    } else if (lessonsAttended.length === lessonsExpected.length && lessonsExpected.length > 0) {
      strengths.push('مواظبة تامة وحضور كامل للدروس العلمية الأسبوعية.');
    }

    // C. تفصيل المراجعة القرآنية
    if (murajaahMissed.length >= 3) {
      weaknesses.push({
        type: 'danger',
        icon: '🔁',
        title: `انقطاع شبه تام عن مراجعة القرآن الكريم: فاته الورد في (${murajaahMissed.join('، ')})`
      });
    } else if (murajaahMissed.length >= 1) {
      weaknesses.push({
        type: 'warning',
        icon: '🔁',
        title: `تقصير في المراجعة القرآنية: فاته الورد في (${murajaahMissed.join('، ')})`
      });
    }

    if (murajaahPartial.length > 0) {
      weaknesses.push({
        type: 'warning',
        icon: '⏳',
        title: `مراجعة جزئية غير مكتملة في (${murajaahPartial.join('، ')})`
      });
    }

    if (murajaahDone.length >= 4) {
      strengths.push('إتقان وتسميع كامل لجميع أوراد المراجعة اليومية المقررة.');
    }

    // D. تفصيل الحفظ الجديد
    if (hifzMissed.length >= 3) {
      weaknesses.push({
        type: 'danger',
        icon: '📖',
        title: `تعثر كبير في تسميع الحفظ الجديد طوال الأسبوع: لم يسمّع في (${hifzMissed.join('، ')})`
      });
    } else if (hifzMissed.length >= 1) {
      weaknesses.push({
        type: 'warning',
        icon: '📖',
        title: `تأخر في تسميع الحفظ الجديد المقرر في (${hifzMissed.join('، ')})`
      });
    }

    if (hifzPartial.length > 0) {
      weaknesses.push({
        type: 'warning',
        icon: '⏳',
        title: `تسميع حفظ جديد جزئي في (${hifzPartial.join('، ')})`
      });
    }

    if (hifzDone.length >= 4) {
      strengths.push('همة عالية وإنجاز كامل لجميع تسميعات الحفظ الجديد.');
    }

    // E. الأنشطة والبرامج
    if (familyMeetingMissed) {
      weaknesses.push({
        type: 'warning',
        icon: '🫡',
        title: 'لم يحضر الإجتماع الأسري يوم الإثنين'
      });
    } else if (familyMeetingDone) {
      strengths.push('حضور ومشاركة إيجابية في الاجتماع الأسري يوم الإثنين.');
    }

    if (thursdayProgramMissed) {
      weaknesses.push({
        type: 'warning',
        icon: '🎯',
        title: 'لم ينجز البرنامج الفردي'
      });
    } else if (thursdayProgramDone) {
      strengths.push('إنجاز كامل للبرنامج الفردي.');
    }

    if (thursdayInteractionDone) {
      strengths.push('تفاعل أسري واجتماعي مميز في نشاط يوم الخميس.');
    }

    // F. جوانب القوة والتميز
    if (presentDays.length === DAYS_CONFIG.length && DAYS_CONFIG.length > 0) {
      strengths.push('انضباط مثالي وحضور بنسبة 100% طوال أيام الأسبوع دون أي غياب.');
    }

    if (percentage >= 90) {
      strengths.push(`أداء استثنائي متفوق بمجموع ${totalPoints} من ${maxPossiblePoints} نقطة (امتياز ⭐).`);
    }
  }

  // تحديد التقييم وحالة الطالب
  let ratingText = 'لم يتم الرصد بعد ⏳';
  let statusTag = 'unrecorded';

  if (!isAnyRecorded) {
    ratingText = 'لم يتم الرصد بعد ⏳';
    statusTag = 'unrecorded';
  } else if (weaknesses.some(w => w.type === 'danger')) {
    ratingText = 'يحتاج متابعة ومعالجة ⚠️';
    statusTag = 'danger';
  } else if (weaknesses.some(w => w.type === 'warning') || percentage < 65) {
    ratingText = 'يحتاج متابعة وتوجيه ⚠️';
    statusTag = 'warning';
  } else if (percentage >= 85) {
    ratingText = 'ممتاز ومرتفع 🌟';
    statusTag = 'excellent';
  } else if (percentage >= 70) {
    ratingText = 'جيد جداً ✨';
    statusTag = 'excellent';
  } else {
    ratingText = 'جيد 👍';
    statusTag = 'neutral';
  }

  return {
    student,
    week,
    month,
    totalPoints,
    maxPossiblePoints,
    percentage,
    attendanceRate,
    attendanceRecordedRate,
    quranRate,
    quranRecordedRate,
    isAnyRecorded,
    recordedDaysCount,
    attendanceRecordedCount,
    ratingText,
    presentDays,
    absentDays,
    excusedDays,
    unrecordedDays,
    lessonsExpected,
    lessonsAttended,
    lessonsMissed,
    lessonsExcused,
    murajaahExpected,
    murajaahDone,
    murajaahMissed,
    murajaahPartial,
    hifzExpected,
    hifzDone,
    hifzMissed,
    hifzPartial,
    familyMeetingDone,
    familyMeetingMissed,
    thursdayProgramDone,
    thursdayProgramMissed,
    thursdayInteractionDone,
    daysData,
    weaknesses,
    recommendations: [],
    strengths,
    statusTag
  };
}

function renderFollowupView() {
  const container = document.getElementById('followup-students-container');
  const kpiContainer = document.getElementById('followup-kpi-summary');
  if (!container) return;

  const currentMonth = appState.followupMonth || appState.currentMonth || 'شهر 1';
  const currentWeek = appState.followupWeek || appState.currentWeek || 'الأسبوع 1';

  // Sync Selectors
  const mSel = document.getElementById('followup-month-select');
  const wSel = document.getElementById('followup-week-select');
  if (mSel && mSel.value !== currentMonth) mSel.value = currentMonth;
  if (wSel && wSel.value !== currentWeek) wSel.value = currentWeek;

  // Calculate diagnostics for all students
  const allDiags = students.map(s => getStudentWeeklyDiagnostic(s.id, currentWeek, currentMonth)).filter(Boolean);

  // Filter by Family
  const famFilter = appState.followupFamily || 'all';
  let filteredDiags = allDiags;
  if (famFilter === 'bamousa') {
    filteredDiags = allDiags.filter(d => (d.student.family || 'bamousa') === 'bamousa');
  } else if (famFilter === 'akram') {
    filteredDiags = allDiags.filter(d => d.student.family === 'akram');
  }

  // Counts for Badges
  const countAll = filteredDiags.length;
  const countAttn = filteredDiags.filter(d => d.weaknesses.length > 0 || d.statusTag === 'danger' || d.statusTag === 'warning').length;
  const countLessons = filteredDiags.filter(d => d.lessonsMissed.length > 0).length;
  const countMurajaah = filteredDiags.filter(d => d.murajaahMissed.length > 0).length;
  const countHifz = filteredDiags.filter(d => d.hifzMissed.length > 0).length;
  const countActivities = filteredDiags.filter(d => d.familyMeetingMissed || d.thursdayProgramMissed).length;
  const countAbsent = filteredDiags.filter(d => d.absentDays.length >= 2).length;
  const countExcellent = filteredDiags.filter(d => d.isAnyRecorded && d.percentage >= 80 && d.weaknesses.length === 0).length;

  // Update header counts
  const cAllEl = document.getElementById('count-followup-all');
  const cBamEl = document.getElementById('count-followup-bamousa');
  const cAkrEl = document.getElementById('count-followup-akram');
  const cAttnEl = document.getElementById('count-followup-attn');
  const cLessonsEl = document.getElementById('count-followup-lessons');
  const cMurEl = document.getElementById('count-followup-murajaah');
  const cHifzEl = document.getElementById('count-followup-hifz');
  const cActEl = document.getElementById('count-followup-activities');
  const cAbsEl = document.getElementById('count-followup-absent');
  const cExcEl = document.getElementById('count-followup-excellent');

  if (cAllEl) cAllEl.textContent = allDiags.length;
  if (cBamEl) cBamEl.textContent = allDiags.filter(d => (d.student.family || 'bamousa') === 'bamousa').length;
  if (cAkrEl) cAkrEl.textContent = allDiags.filter(d => d.student.family === 'akram').length;
  if (cAttnEl) cAttnEl.textContent = countAttn;
  if (cLessonsEl) cLessonsEl.textContent = countLessons;
  if (cMurEl) cMurEl.textContent = countMurajaah;
  if (cHifzEl) cHifzEl.textContent = countHifz;
  if (cActEl) cActEl.textContent = countActivities;
  if (cAbsEl) cAbsEl.textContent = countAbsent;
  if (cExcEl) cExcEl.textContent = countExcellent;

  // Apply Status / Search Filters
  const search = (appState.followupSearchQuery || '').trim().toLowerCase();
  const statusFilter = appState.followupFilter || 'all';

  // مزامنة حالة الأزرار النشطة لفلاتر الأسرة وفلاتر الحالة
  document.querySelectorAll('.followup-fam-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.followupFamily === famFilter);
  });
  document.querySelectorAll('.status-filter-pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.followupFilter === statusFilter);
  });

  let displayDiags = filteredDiags.filter(d => {
    // 1. Search Query
    if (search && !d.student.name.toLowerCase().includes(search)) {
      return false;
    }
    // 2. Status Filter
    if (statusFilter === 'needs-attention') {
      return d.weaknesses.length > 0 || d.statusTag === 'danger' || d.statusTag === 'warning';
    } else if (statusFilter === 'frequent-absent') {
      return d.absentDays.length >= 2;
    } else if (statusFilter === 'excellent') {
      return d.isAnyRecorded && d.percentage >= 80 && d.weaknesses.length === 0;
    }
    return true;
  });

  // Render KPI Summary Row
  if (kpiContainer) {
    kpiContainer.innerHTML = `
      <div class="followup-kpi-card">
        <div class="followup-kpi-info">
          <span class="followup-kpi-title">يحتاجون متابعة وتنبيه</span>
          <span class="followup-kpi-num">${countAttn} طالب</span>
        </div>
        <div class="followup-kpi-icon-wrap kpi-icon-danger">⚠️</div>
      </div>
      <div class="followup-kpi-card">
        <div class="followup-kpi-info">
          <span class="followup-kpi-title">لم يحضروا الدروس العلمية</span>
          <span class="followup-kpi-num">${countLessons} طالب</span>
        </div>
        <div class="followup-kpi-icon-wrap kpi-icon-warning">📚</div>
      </div>
      <div class="followup-kpi-card">
        <div class="followup-kpi-info">
          <span class="followup-kpi-title">تقصير في المراجعة القرآنية</span>
          <span class="followup-kpi-num">${countMurajaah} طالب</span>
        </div>
        <div class="followup-kpi-icon-wrap kpi-icon-warning">🔁</div>
      </div>
      <div class="followup-kpi-card">
        <div class="followup-kpi-info">
          <span class="followup-kpi-title">الطلاب المتميزون</span>
          <span class="followup-kpi-num">${countExcellent} طالب</span>
        </div>
        <div class="followup-kpi-icon-wrap kpi-icon-success">🌟</div>
      </div>
    `;
  }

  // Render Student Cards Grid
  if (displayDiags.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; background: white; border-radius: var(--radius-lg); border: 1px dashed var(--border-color); color: #64748b;">
        <span style="font-size: 2rem; display: block; margin-bottom: 8px;">🔍</span>
        <p style="font-size: 1.05rem; font-weight: 700;">لا توجد نتائج مطابقة لخيارات التصفية المحددة</p>
        <p style="font-size: 0.85rem; margin-top: 4px;">جرّب مسح البحث أو اختيار تصفية "الكل" لعرض جميع الطلاب.</p>
      </div>
    `;
    return;
  }

  let html = '';
  displayDiags.forEach((diag, idx) => {
    const student = diag.student;
    const fam = student.family || 'bamousa';
    const famLabel = fam === 'akram' ? 'أسرة أكرم' : 'أسرة باموسى';
    const famClass = fam === 'akram' ? 'akram' : 'bamousa';

    let cardBorderClass = 'is-neutral';
    if (!diag.isAnyRecorded) cardBorderClass = 'is-unrecorded';
    else if (diag.statusTag === 'danger') cardBorderClass = 'has-danger';
    else if (diag.statusTag === 'warning') cardBorderClass = 'has-warning';
    else if (diag.statusTag === 'excellent') cardBorderClass = 'is-excellent';

    // Build micro attendance grid
    let microGridHtml = '<div class="followup-days-micro-grid">';
    DAYS_CONFIG.forEach(dc => {
      const rec = diag.daysData.find(d => d.dayId === dc.id)?.record || {};
      let chipClass = 'chip-none';
      let chipSymbol = '⚪';
      if (rec.attendance === 'present') {
        chipClass = 'chip-present';
        chipSymbol = '✅';
      } else if (rec.attendance === 'absent') {
        chipClass = 'chip-absent';
        chipSymbol = '❌';
      } else if (rec.attendance === 'excused') {
        chipClass = 'chip-excused';
        chipSymbol = '⚠️';
      }
      microGridHtml += `
        <div class="followup-day-micro-col" title="${dc.name}">
          <span>${dc.short}</span>
          <div class="followup-day-chip ${chipClass}">${chipSymbol}</div>
        </div>
      `;
    });
    microGridHtml += '</div>';

    // Build diagnostic alerts
    let alertsHtml = '<div class="followup-alerts-list">';
    if (!diag.isAnyRecorded) {
      alertsHtml += `
        <div class="followup-alert-item followup-alert-neutral" style="background: #f8fafc; color: #64748b; border: 1px dashed #cbd5e1;">
          <span>⏳</span>
          <span>لم يتم رصد درجات أو حضور لهذا الأسبوع بعد</span>
        </div>
      `;
    } else if (diag.weaknesses.length > 0) {
      diag.weaknesses.slice(0, 3).forEach(w => {
        const aClass = w.type === 'danger' ? 'followup-alert-danger' : 'followup-alert-warning';
        alertsHtml += `
          <div class="followup-alert-item ${aClass}">
            <span>${w.icon}</span>
            <span>${escapeHtml(w.title)}</span>
          </div>
        `;
      });
      if (diag.weaknesses.length > 3) {
        alertsHtml += `
          <div class="followup-alert-item followup-alert-warning" style="font-size: 0.72rem; padding: 2px 6px;">
            <span>+ ${diag.weaknesses.length - 3} تنبيهات إضافية</span>
          </div>
        `;
      }
    } else {
      alertsHtml += `
        <div class="followup-alert-item followup-alert-success">
          <span>🌟</span>
          <span>إنجاز متكامل ومواظبة ممتازة طوال الأسبوع</span>
        </div>
      `;
    }
    alertsHtml += '</div>';

    html += `
      <div class="followup-student-card ${cardBorderClass}" onclick="openStudentWeeklyReportModal('${student.id}')" title="انقر لعرض تقرير الطالب الأسبوعي والتشخيص">
        <div class="followup-card-header">
          <div class="followup-student-main">
            <div class="followup-avatar">${idx + 1}</div>
            <div>
              <div class="followup-student-name">${escapeHtml(student.name)}</div>
              <div class="followup-student-meta">
                <span class="badge-family ${famClass}">${famLabel}</span>
                <span class="followup-score-badge">${diag.isAnyRecorded ? `⭐ ${diag.percentage}% (${diag.totalPoints}/${diag.maxPossiblePoints} نقطة)` : '⏳ لم يُرصد بعد'}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- شبكة أيام الأسبوع للحضور -->
        ${microGridHtml}

        <!-- تنبيهات الأداء ومواطن الضعف -->
        ${alertsHtml}

        <!-- أزرار الإجراءات للبطاقة -->
        <div class="followup-card-actions" onclick="event.stopPropagation()">
          <button type="button" class="btn-open-student-rep" onclick="openStudentWeeklyReportModal('${student.id}')" title="فتح التقرير الأسبوعي التفصيلي">
            <span>📄 عرض التقرير التفصيلي</span>
          </button>
          <div style="display: flex; gap: 6px;">
            <button type="button" class="btn-card-copy" onclick="copyStudentReportText('${student.id}')" title="نسخ التقرير الأسبوعي للطالب">
              <span>📋 نسخ التقرير</span>
            </button>
            <button type="button" class="btn btn-sm btn-outline" onclick="printStudentWeeklyReportPDF('${student.id}')" title="طباعة أو تصدير PDF بجدول وشعار تكوين النسيم">
              <span>🖨️ PDF</span>
            </button>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// --- Single Student Weekly Report Modal Logic ---
function setupStudentReportModal() {
  const modal = document.getElementById('student-report-modal');
  const btnCloseHeader = document.getElementById('btn-close-student-report-modal');
  const btnCloseFooter = document.getElementById('btn-close-rep-footer');
  const btnPrint = document.getElementById('btn-print-student-report');
  const btnShareWA = document.getElementById('btn-share-student-whatsapp');
  const btnCopy = document.getElementById('btn-copy-student-text');

  const closeModal = () => {
    if (modal) modal.classList.remove('show');
  };

  if (btnCloseHeader) btnCloseHeader.addEventListener('click', closeModal);
  if (btnCloseFooter) btnCloseFooter.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      if (currentReportStudentId) {
        printStudentWeeklyReportPDF(currentReportStudentId);
      } else {
        window.print();
      }
    });
  }

  if (btnShareWA) {
    btnShareWA.addEventListener('click', () => {
      if (currentReportStudentId) {
        shareStudentReportWhatsApp(currentReportStudentId);
      }
    });
  }

  if (btnCopy) {
    btnCopy.addEventListener('click', () => {
      if (currentReportStudentId) {
        copyStudentReportText(currentReportStudentId);
      }
    });
  }
}

window.openStudentWeeklyReportModal = function(studentId, autoPrint = false) {
  currentReportStudentId = studentId;
  const currentMonth = appState.followupMonth || appState.currentMonth || 'شهر 1';
  const currentWeek = appState.followupWeek || appState.currentWeek || 'الأسبوع 1';

  const diag = getStudentWeeklyDiagnostic(studentId, currentWeek, currentMonth);
  if (!diag) return;

  const modal = document.getElementById('student-report-modal');
  const nameEl = document.getElementById('rep-student-name');
  const subtitleEl = document.getElementById('rep-student-subtitle');
  const bodyEl = document.getElementById('rep-student-body');

  if (!modal || !bodyEl) return;

  const student = diag.student;
  const famLabel = student.family === 'akram' ? 'أسرة أكرم' : 'أسرة باموسى';

  if (nameEl) {
    nameEl.innerHTML = `<span>تقرير الطالب: ${escapeHtml(student.name)} (${famLabel})</span>`;
  }
  if (subtitleEl) {
    subtitleEl.textContent = `متابعة ${diag.week} (${diag.month}) - تشخيص شامل للأداء ومعالجة نقاط الضعف`;
  }

  // Build Daily Breakdown Table HTML
  let tableRows = '';
  diag.daysData.forEach(d => {
    const rec = d.record;
    
    // Attendance Badge
    let attBadge = '<span class="status-badge badge-unrecorded">⚪ غير مسجل</span>';
    if (rec.attendance === 'present') attBadge = '<span class="status-badge badge-done">✅ حاضر</span>';
    else if (rec.attendance === 'excused') attBadge = '<span class="status-badge badge-partial">⚠️ مستأذن</span>';
    else if (rec.attendance === 'absent') attBadge = '<span class="status-badge badge-missed">❌ غائب</span>';

    // Hifz Badge
    let hifzBadge = '<span class="status-badge badge-unrecorded">-</span>';
    if (d.config.items.some(it => it.id === 'hifz')) {
      if (rec.hifz === 'done') hifzBadge = '<span class="status-badge badge-done">✅ منجز</span>';
      else if (rec.hifz === 'excused' || rec.hifz === 'partial') hifzBadge = '<span class="status-badge badge-partial">⏳ جزئي</span>';
      else if (rec.hifz === 'none' || rec.hifz === 'absent' || rec.attendance === 'absent') hifzBadge = '<span class="status-badge badge-missed">❌ لم يسمّع</span>';
      else hifzBadge = '<span class="status-badge badge-unrecorded">⚪ لم يرصد</span>';
    }

    // Murajaah Badge
    let murBadge = '<span class="status-badge badge-unrecorded">-</span>';
    if (d.config.items.some(it => it.id === 'murajaah')) {
      if (rec.murajaah === 'done') murBadge = '<span class="status-badge badge-done">✅ راجع</span>';
      else if (rec.murajaah === 'excused' || rec.murajaah === 'partial') murBadge = '<span class="status-badge badge-partial">⏳ جزئي</span>';
      else if (rec.murajaah === 'none' || rec.murajaah === 'absent' || rec.attendance === 'absent') murBadge = '<span class="status-badge badge-missed">❌ لم يراجع</span>';
      else murBadge = '<span class="status-badge badge-unrecorded">⚪ لم يرصد</span>';
    }

    // Activities / Lessons Badge
    let actBadge = '<span class="status-badge badge-unrecorded">-</span>';
    if (d.dayId === 'sunday' || d.dayId === 'tuesday') {
      if (rec.lesson === 'present') actBadge = '<span class="status-badge badge-done">🕌 حضر الدرس</span>';
      else if (rec.lesson === 'excused') actBadge = '<span class="status-badge badge-partial">⚠️ استأذن</span>';
      else if (rec.lesson === 'absent' || rec.lesson === 'none' || rec.attendance === 'absent') actBadge = '<span class="status-badge badge-missed">❌ غاب عن الدرس</span>';
      else actBadge = '<span class="status-badge badge-unrecorded">⚪ لم يرصد</span>';
    } else if (d.dayId === 'monday') {
      if (rec.familyMeeting === 'done') actBadge = '<span class="status-badge badge-done">🫡 حضر اللقاء</span>';
      else if (rec.familyMeeting === 'excused') actBadge = '<span class="status-badge badge-partial">⚠️ مستأذن</span>';
      else if (rec.familyMeeting === 'none' || rec.attendance === 'absent') actBadge = '<span class="status-badge badge-missed">❌ لم يحضر</span>';
      else actBadge = '<span class="status-badge badge-unrecorded">⚪ لم يرصد</span>';
    } else if (d.dayId === 'thursday') {
      if (rec.individualProgram === 'done' || rec.familyInteraction === 'done') actBadge = '<span class="status-badge badge-done">🎯 شارك بالبرنامج</span>';
      else if (rec.individualProgram === 'none' && rec.attendance === 'absent') actBadge = '<span class="status-badge badge-missed">❌ لم يشارك</span>';
      else actBadge = '<span class="status-badge badge-unrecorded">⚪ برنامج الخميس</span>';
    }

    tableRows += `
      <tr>
        <td><b>${d.dayName}</b></td>
        <td>${attBadge}</td>
        <td>${hifzBadge}</td>
        <td>${murBadge}</td>
        <td>${actBadge}</td>
        <td style="font-weight: 800; color: #1d4ed8;">${d.points} / ${d.maxPoints}</td>
      </tr>
    `;
  });

  // Weaknesses List HTML
  let weakListHtml = '';
  if (!diag.isAnyRecorded) {
    weakListHtml = `
      <div class="rep-diag-item" style="background: #f8fafc; color: #64748b; border: 1px dashed #cbd5e1;">
        <span style="font-size: 1rem;">⏳</span>
        <span>لم يتم رصد أي درجات أو حضور لهذا الطالب في هذا الأسبوع حتى الآن.</span>
      </div>
    `;
  } else if (diag.weaknesses.length > 0) {
    diag.weaknesses.forEach(w => {
      const cls = w.type === 'danger' ? 'danger' : 'warning';
      weakListHtml += `
        <div class="rep-diag-item ${cls}">
          <span style="font-size: 1rem;">${w.icon}</span>
          <span>${escapeHtml(w.title)}</span>
        </div>
      `;
    });
  } else {
    weakListHtml = `
      <div class="rep-diag-item success">
        <span>✨</span>
        <span>لا توجد أي ملاحظات تقصير أو مواطن ضعف مرصودة هذا الأسبوع. أداء متكامل ومتميز!</span>
      </div>
    `;
  }

  // Strengths HTML
  let strListHtml = '';
  if (diag.strengths && diag.strengths.length > 0) {
    diag.strengths.forEach(s => {
      strListHtml += `
        <div class="rep-diag-item success">
          <span>🌟</span>
          <span>${escapeHtml(s)}</span>
        </div>
      `;
    });
  }

  bodyEl.innerHTML = `
    <!-- هيدر الشعار وبيانات الطالب أعلى التقرير (متموضع بالمنتصف بدقة) -->
    <div class="rep-student-brand-banner">
      <div class="rep-brand-left">
        <div class="rep-logo-circle">
          <img src="${reportLogoImg}" alt="شعار تكوين النسيم" style="width: 100%; height: 100%; object-fit: contain;" />
        </div>
        <div>
          <div class="rep-brand-title">تكوين النسيم</div>
          <div class="rep-brand-sub">سجل المتابعة الأسبوعي والتشخيص الفردي للقرآن والأنشطة</div>
        </div>
      </div>
      <div class="rep-student-meta-box">
        <div class="rep-meta-row"><span>👤 الطالب:</span> <b>${escapeHtml(student.name)}</b></div>
        <div class="rep-meta-row"><span>🏛️ الأسرة:</span> <b>${famLabel}</b></div>
        <div class="rep-meta-row"><span>📅 الفترة:</span> <b>${diag.week} (${diag.month})</b></div>
      </div>
    </div>

    <!-- شبكة المؤشرات الرئيسية -->
    <div class="rep-overview-grid">
      <div class="rep-stat-box">
        <span class="rep-stat-label">إجمالي النقاط الأسبوعية</span>
        <span class="rep-stat-value" style="color: #2563eb;">${diag.totalPoints} / ${diag.maxPossiblePoints}</span>
      </div>
      <div class="rep-stat-box">
        <span class="rep-stat-label">نسبة الإنجاز الأسبوعي</span>
        <span class="rep-stat-value" style="color: #16a34a;">${diag.percentage}%</span>
      </div>
      <div class="rep-stat-box">
        <span class="rep-stat-label">نسبة حضور الأيام</span>
        <span class="rep-stat-value" style="color: #0f172a;">${diag.attendanceRate}%</span>
      </div>
      <div class="rep-stat-box">
        <span class="rep-stat-label">إنجاز القرآن الكريم</span>
        <span class="rep-stat-value" style="color: #d97706;">${diag.quranRate}%</span>
      </div>
      <div class="rep-stat-box">
        <span class="rep-stat-label">التقييم العام</span>
        <span class="rep-stat-value" style="font-size: 0.95rem; color: ${diag.ratingText.includes('يحتاج متابعة') ? '#dc2626' : '#16a34a'}; font-weight: 800;">${diag.ratingText}</span>
      </div>
    </div>

    <!-- بطاقة تشخيص مواطن الضعف والتنبيهات -->
    <div class="rep-diagnostic-card" style="border-right: 4px solid #dc2626;">
      <div class="rep-diag-header">
        <span class="diag-icon-danger">🚨</span>
        <span>تشخيص مواطن الضعف والملاحظات المرصودة:</span>
      </div>
      <div class="rep-diag-list">
        ${weakListHtml}
      </div>
    </div>

    <!-- بطاقة جوانب القوة والتميز -->
    ${strListHtml ? `
      <div class="rep-diagnostic-card" style="border-right: 4px solid #16a34a;">
        <div class="rep-diag-header">
          <span class="diag-icon-success">✨</span>
          <span>جوانب القوة والتميز:</span>
        </div>
        <div class="rep-diag-list">
          ${strListHtml}
        </div>
      </div>
    ` : ''}

    <!-- جدول إنجاز الأيام طوال الأسبوع -->
    <div class="rep-diagnostic-card">
      <div class="rep-diag-header">
        <span>📅</span>
        <span>سجل إنجاز الأيام طوال الأسبوع:</span>
      </div>
      <div class="rep-table-wrap">
        <table class="rep-daily-table">
          <thead>
            <tr>
              <th>اليوم</th>
              <th>الحضور</th>
              <th>الحفظ الجديد</th>
              <th>المراجعة القرآنية</th>
              <th>الدروس العلمية والأنشطة</th>
              <th>النقاط</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    </div>
  `;

  modal.classList.add('show');

  if (autoPrint) {
    setTimeout(() => {
      printStudentWeeklyReportPDF(studentId);
    }, 250);
  }
};

// ==========================================================================
// --- مولّد تقارير الطباعة وتصدير PDF المستقل مع الشعار وبيانات الطالب والجدول ---
// ==========================================================================

function generatePrintableStudentReportHtml(diag) {
  if (!diag) return '';
  const student = diag.student;
  const famLabel = student.family === 'akram' ? 'أسرة أكرم' : 'أسرة باموسى';

  // Build daily rows for print table
  let dailyTableRows = '';
  diag.daysData.forEach((d, idx) => {
    const rec = d.record;

    // Attendance Text & Symbol
    let attText = 'غير مسجل';
    let attClass = 'unrec';
    if (rec.attendance === 'present') {
      attText = '✅ حاضر';
      attClass = 'pres';
    } else if (rec.attendance === 'absent') {
      attText = '❌ غائب';
      attClass = 'abs';
    } else if (rec.attendance === 'excused') {
      attText = '⚠️ مستأذن';
      attClass = 'exc';
    }

    // Hifz Text
    let hifzText = '-';
    if (d.config.items.some(it => it.id === 'hifz')) {
      if (rec.hifz === 'done') hifzText = '✅ منجز';
      else if (rec.hifz === 'partial' || rec.hifz === 'excused') hifzText = '⏳ جزئي';
      else if (rec.hifz === 'none' || rec.hifz === 'absent' || rec.attendance === 'absent') hifzText = '❌ لم يسمّع';
      else hifzText = '⚪ لم يرصد';
    }

    // Murajaah Text
    let murText = '-';
    if (d.config.items.some(it => it.id === 'murajaah')) {
      if (rec.murajaah === 'done') murText = '✅ راجع الورد';
      else if (rec.murajaah === 'partial' || rec.murajaah === 'excused') murText = '⏳ جزئي';
      else if (rec.murajaah === 'none' || rec.murajaah === 'absent' || rec.attendance === 'absent') murText = '❌ لم يراجع';
      else murText = '⚪ لم يرصد';
    }

    // Activities & Lessons
    let actText = '-';
    if (d.dayId === 'sunday' || d.dayId === 'tuesday') {
      if (rec.lesson === 'present') actText = '📚 حضر الدرس العلمي';
      else if (rec.lesson === 'excused') actText = '⚠️ مستأذن من الدرس العلمي';
      else if (rec.lesson === 'absent' || rec.lesson === 'none' || rec.attendance === 'absent') actText = '❌ لم يحضر الدرس العلمي';
      else actText = '⚪ غير مرصود';
    } else if (d.dayId === 'monday') {
      if (rec.familyMeeting === 'done') actText = '🫡 حضر الاجتماع الأسري';
      else if (rec.familyMeeting === 'excused') actText = '⚠️ مستأذن';
      else if (rec.familyMeeting === 'none' || rec.attendance === 'absent') actText = '❌ لم يحضر الاجتماع الأسري';
      else actText = '⚪ غير مرصود';
    } else if (d.dayId === 'thursday') {
      if (rec.individualProgram === 'done' || rec.familyInteraction === 'done') actText = '🎯 أنجز البرنامج الفردي';
      else if (rec.individualProgram === 'none' && rec.attendance === 'absent') actText = '❌ لم ينجز البرنامج الفردي';
      else actText = '⚪ البرنامج الفردي والأنشطة';
    }

    dailyTableRows += `
      <tr>
        <td class="col-day"><b>${d.dayName}</b></td>
        <td class="col-att ${attClass}">${attText}</td>
        <td class="col-hifz">${hifzText}</td>
        <td class="col-mur">${murText}</td>
        <td class="col-act">${actText}</td>
        <td class="col-pts"><b>${d.points}</b> / ${d.maxPoints}</td>
      </tr>
    `;
  });

  // Weaknesses for Print
  let weaknessesHtml = '';
  if (diag.weaknesses && diag.weaknesses.length > 0) {
    diag.weaknesses.forEach(w => {
      weaknessesHtml += `<li class="print-note-item alert-danger">${w.icon} ${escapeHtml(w.title)}</li>`;
    });
  } else {
    weaknessesHtml = `<li class="print-note-item alert-success">✨ لا توجد أي ملاحظات تقصير. أداء ومواظبة نموذجية طوال الأسبوع.</li>`;
  }

  // Strengths for Print
  let strengthsHtml = '';
  if (diag.strengths && diag.strengths.length > 0) {
    diag.strengths.forEach(s => {
      strengthsHtml += `<li class="print-note-item alert-success">🌟 ${escapeHtml(s)}</li>`;
    });
  }

  const currentDateStr = new Date().toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const isNeedsAttention = diag.ratingText.includes('يحتاج متابعة') || (diag.statusTag && diag.statusTag !== 'excellent');
  const ratingColor = isNeedsAttention ? '#dc2626' : '#16a34a';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>تقرير متابعة الطالب - ${escapeHtml(student.name)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Segoe UI', Tahoma, 'Arial', sans-serif;
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
      direction: rtl;
      font-size: 11pt;
      line-height: 1.4;
    }
    .print-container {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
    }
    
    /* 1. Header with Official Takween Logo */
    .print-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2.5px solid #0047ba;
      padding-bottom: 12px;
      margin-bottom: 12px;
    }
    .print-header-brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .print-logo-box {
      width: 72px;
      height: 72px;
      flex-shrink: 0;
    }
    .print-header-text h1 {
      margin: 0 0 3px 0;
      font-size: 18pt;
      font-weight: 800;
      color: #0047ba;
    }
    .print-header-text p {
      margin: 0;
      font-size: 9.5pt;
      color: #64748b;
      font-weight: 600;
    }
    .print-header-meta {
      text-align: left;
      font-size: 9pt;
      color: #334155;
    }
    .print-header-badge {
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      padding: 4px 10px;
      border-radius: 6px;
      font-weight: 700;
      display: inline-block;
      margin-bottom: 4px;
    }

    /* 2. Student Identification Box (فوق الجدول) */
    .student-id-banner {
      background: #f8fafc;
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
    }
    .student-id-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10.5pt;
    }
    .student-id-label {
      color: #64748b;
      font-weight: 700;
    }
    .student-id-val {
      font-weight: 800;
      color: #0f172a;
    }
    .student-id-val.highlight {
      font-size: 12pt;
      color: #0047ba;
    }

    /* 3. Key Summary Table */
    .kpi-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    .kpi-table th {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      font-size: 9pt;
      color: #475569;
      font-weight: 700;
      text-align: center;
    }
    .kpi-table td {
      border: 1px solid #cbd5e1;
      padding: 8px 6px;
      text-align: center;
      font-weight: 800;
      font-size: 11pt;
    }

    /* 4. Weekly Main Table */
    .section-title {
      font-size: 11pt;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 6px 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .main-print-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      font-size: 9.5pt;
    }
    .main-print-table th {
      background: #0047ba;
      color: #ffffff;
      border: 1px solid #003894;
      padding: 7px 8px;
      font-weight: 800;
      text-align: right;
    }
    .main-print-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: right;
      color: #1e293b;
    }
    .main-print-table tr:nth-child(even) {
      background: #f8fafc;
    }
    .col-day {
      width: 15%;
      font-weight: 700;
      background: #f1f5f9;
    }
    .col-att {
      width: 16%;
      font-weight: 700;
    }
    .col-att.pres { color: #15803d; }
    .col-att.abs { color: #b91c1c; font-weight: 800; }
    .col-att.exc { color: #b45309; }
    .col-hifz { width: 18%; }
    .col-mur { width: 18%; }
    .col-act { width: 21%; }
    .col-pts { width: 12%; text-align: center !important; color: #0047ba; font-weight: 800; }

    /* 5. Diagnostics */
    .print-diag-box {
      border: 1.5px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
      background: #ffffff;
    }
    .print-diag-box.danger-box {
      border-color: #fca5a5;
      background: #fffafa;
    }
    .print-diag-box-title {
      font-size: 9.5pt;
      font-weight: 800;
      margin-bottom: 6px;
      color: #0f172a;
    }
    .print-notes-list {
      margin: 0;
      padding: 0 16px 0 0;
      list-style-type: disc;
    }
    .print-note-item {
      font-size: 8.5pt;
      line-height: 1.35;
      margin-bottom: 4px;
      color: #334155;
    }
    .print-note-item.alert-danger {
      color: #991b1b;
      font-weight: 700;
    }
    .print-note-item.alert-success {
      color: #15803d;
      font-weight: 600;
    }

    .print-footer {
      text-align: center;
      font-size: 8pt;
      color: #64748b;
      margin-top: 14px;
      padding-top: 8px;
      border-top: 1px dashed #cbd5e1;
    }
  </style>
</head>
<body>
  <div class="print-container">
    <!-- أعلى الصفحة: شعار تكوين النسيم + العنوان -->
    <div class="print-header">
      <div class="print-header-brand">
        <div class="print-logo-box">
          <img src="${reportLogoImg}" alt="شعار تكوين النسيم" style="width: 100%; height: 100%; object-fit: contain;" />
        </div>
        <div class="print-header-text">
          <h1>تكوين النسيم</h1>
          <p>سجل المتابعة الأسبوعي والتربوي للقرآن الكريم والأنشطة</p>
        </div>
      </div>
      <div class="print-header-meta">
        <div class="print-header-badge">تقرير متابعة معتمد</div>
        <div>تاريخ الإصدار: ${currentDateStr}</div>
      </div>
    </div>

    <!-- اسم الطالب والأسرة والأسبوع فوق الجدول -->
    <div class="student-id-banner">
      <div class="student-id-item">
        <span class="student-id-label">👤 اسم الطالب:</span>
        <span class="student-id-val highlight">${escapeHtml(student.name)}</span>
      </div>
      <div class="student-id-item">
        <span class="student-id-label">🏛️ الأسرة:</span>
        <span class="student-id-val">${famLabel}</span>
      </div>
      <div class="student-id-item">
        <span class="student-id-label">📅 الفترة:</span>
        <span class="student-id-val">${diag.week} (${diag.month})</span>
      </div>
      <div class="student-id-item">
        <span class="student-id-label">🏅 التقييم:</span>
        <span class="student-id-val" style="color: ${ratingColor}; font-weight: 800;">${diag.ratingText}</span>
      </div>
    </div>

    <!-- جدول ملخص مؤشرات الأداء الرئيسية -->
    <table class="kpi-table">
      <thead>
        <tr>
          <th>إجمالي النقاط الأسبوعية</th>
          <th>نسبة الإنجاز الشامل</th>
          <th>نسبة الحضور والانضباط</th>
          <th>إنجاز الحفظ والمراجعة</th>
          <th>التقدير الأسبوعي</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="color: #0047ba;">${diag.totalPoints} / ${diag.maxPossiblePoints} نقطة</td>
          <td style="color: #16a34a;">${diag.percentage}%</td>
          <td style="color: #0f172a;">${diag.attendanceRate}%</td>
          <td style="color: #d97706;">${diag.quranRate}%</td>
          <td style="color: ${ratingColor}; font-weight: 800;">${diag.ratingText}</td>
        </tr>
      </tbody>
    </table>

    <!-- جدول المتابعة الأسبوعية التفصيلي على شكل جدول منتظم -->
    <div class="section-title">📊 جدول إنجاز الأيام الأسبوعي التفصيلي:</div>
    <table class="main-print-table">
      <thead>
        <tr>
          <th>اليوم</th>
          <th>حالة الحضور</th>
          <th>الحفظ الجديد</th>
          <th>المراجعة القرآنية</th>
          <th>الدروس العلمية والأنشطة</th>
          <th>النقاط</th>
        </tr>
      </thead>
      <tbody>
        ${dailyTableRows}
      </tbody>
    </table>

    <!-- تشخيص مواطن الضعف والملاحظات -->
    <div class="print-diag-box danger-box" style="margin-bottom: 12px;">
      <div class="print-diag-box-title" style="color: #991b1b;">🚨 تشخيص مواطن الضعف والملاحظات:</div>
      <ul class="print-notes-list">
        ${weaknessesHtml}
      </ul>
    </div>

    ${strengthsHtml ? `
      <div class="print-diag-box" style="border-color: #bbf7d0; background: #f0fdf4; margin-bottom: 10px;">
        <div class="print-diag-box-title" style="color: #166534;">✨ جوانب القوة والتميز:</div>
        <ul class="print-notes-list">
          ${strengthsHtml}
        </ul>
      </div>
    ` : ''}

    <div class="print-footer">
      تكوين النسيم • معاً لتنشئة جيل قرآني قيادي 🌿 • تم استخراج التقرير إلكترونياً
    </div>
  </div>
</body>
</html>`;
}

// محرك الطباعة وتصدير PDF الفعلي والمضمون لجميع المتصفحات والـ Iframes
window.printStudentWeeklyReportPDF = function(studentId) {
  if (!studentId && currentReportStudentId) {
    studentId = currentReportStudentId;
  }
  if (!studentId) return;

  const currentMonth = appState.followupMonth || appState.currentMonth || 'شهر 1';
  const currentWeek = appState.followupWeek || appState.currentWeek || 'الأسبوع 1';
  const diag = getStudentWeeklyDiagnostic(studentId, currentWeek, currentMonth);
  if (!diag) return;

  const reportHtml = generatePrintableStudentReportHtml(diag);

  // 1. طريقة الإطار المخفي للطباعة التلقائية (Fast & Clean Iframe Print)
  let printIframe = document.getElementById('takween-print-iframe');
  if (printIframe) {
    try { printIframe.remove(); } catch (e) { /* ignore */ }
  }

  printIframe = document.createElement('iframe');
  printIframe.id = 'takween-print-iframe';
  printIframe.style.position = 'fixed';
  printIframe.style.right = '-9999px';
  printIframe.style.bottom = '-9999px';
  printIframe.style.width = '0px';
  printIframe.style.height = '0px';
  printIframe.style.border = 'none';
  document.body.appendChild(printIframe);

  try {
    const frameDoc = printIframe.contentWindow.document;
    frameDoc.open();
    frameDoc.write(reportHtml);
    frameDoc.close();

    setTimeout(() => {
      try {
        printIframe.contentWindow.focus();
        printIframe.contentWindow.print();
      } catch (printErr) {
        console.warn('Direct iframe print was prevented by browser, opening print window...', printErr);
        openPrintWindowFallback(reportHtml);
      }
    }, 350);
  } catch (err) {
    console.warn('Iframe write error, using fallback print window', err);
    openPrintWindowFallback(reportHtml);
  }
};

function openPrintWindowFallback(htmlContent) {
  try {
    const printWin = window.open('', '_blank', 'width=850,height=950,scrollbars=yes');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(htmlContent);
      printWin.document.close();
      setTimeout(() => {
        printWin.focus();
        printWin.print();
      }, 400);
    } else {
      window.print();
    }
  } catch (e) {
    window.print();
  }
}

function generateStudentWeeklyReportText(diag) {
  if (!diag) return '';
  const student = diag.student;
  const famLabel = student.family === 'akram' ? 'أسرة أكرم' : 'أسرة باموسى';

  let text = `📋 *التقرير الأسبوعي لمتابعة الطالب*\n`;
  text += `👤 *الطالب:* ${student.name}\n`;
  text += `🏛️ *الأسرة:* ${famLabel}\n`;
  text += `📅 *الفترة:* ${diag.week} (${diag.month})\n`;
  text += `━━━━━━━━━━━━━━━\n\n`;

  text += `📈 *مؤشرات الأداء الأسبوعية:*\n`;
  text += `⭐ *النقاط المحققة:* ${diag.totalPoints} من ${diag.maxPossiblePoints} نقطة (${diag.percentage}%)\n`;
  text += `👥 *نسبة الحضور:* ${diag.attendanceRate}%\n`;
  text += `📖 *إنجاز القرآن الكريم:* ${diag.quranRate}%\n`;
  text += `🏅 *التقييم العام:* ${diag.ratingText}\n\n`;

  // Daily Breakdown Summary
  text += `🗓️ *سجل أيام الأسبوع:*\n`;
  diag.daysData.forEach(d => {
    const rec = d.record;
    let att = '⚪ غير مسجل';
    if (rec.attendance === 'present') att = '✅ حاضر';
    else if (rec.attendance === 'absent') att = '❌ غائب';
    else if (rec.attendance === 'excused') att = '⚠️ مستأذن';

    let details = [];
    if (d.config.items.some(it => it.id === 'hifz')) {
      if (rec.hifz === 'done') details.push('حفظ: ✅');
      else if (rec.hifz === 'partial') details.push('حفظ: ⏳ جزئي');
      else if (rec.hifz === 'none' || rec.attendance === 'absent') details.push('حفظ: ❌');
    }
    if (d.config.items.some(it => it.id === 'murajaah')) {
      if (rec.murajaah === 'done') details.push('مراجعة: ✅');
      else if (rec.murajaah === 'partial') details.push('مراجعة: ⏳ جزئي');
      else if (rec.murajaah === 'none' || rec.attendance === 'absent') details.push('مراجعة: ❌');
    }
    if (d.dayId === 'sunday' || d.dayId === 'tuesday') {
      if (rec.lesson === 'present') details.push('الدرس العلمي: 📚 حضر');
      else if (rec.lesson === 'absent' || rec.lesson === 'none' || rec.attendance === 'absent') details.push('الدرس العلمي: ❌ لم يحضر');
    }
    if (d.dayId === 'monday') {
      if (rec.familyMeeting === 'done') details.push('الاجتماع الأسري: 🫡 حضر');
      else if (rec.familyMeeting === 'none' || rec.attendance === 'absent') details.push('الاجتماع الأسري: ❌');
    }
    if (d.dayId === 'thursday') {
      if (rec.individualProgram === 'done') details.push('البرنامج الفردي: 🎯 منجز');
      else if (rec.individualProgram === 'none' && rec.attendance === 'absent') details.push('البرنامج الفردي: ❌');
    }

    const detStr = details.length > 0 ? ` (${details.join(' | ')})` : '';
    text += `• *${d.dayName}:* ${att}${detStr} - [${d.points}/${d.maxPoints} ن]\n`;
  });
  text += `\n`;

  // Weaknesses
  if (diag.weaknesses.length > 0) {
    text += `🚨 *مواطن الضعف والتنبيهات للمتابعة:*\n`;
    diag.weaknesses.forEach(w => {
      text += `• ${w.icon} ${w.title}\n`;
    });
    text += `\n`;
  }

  // Strengths
  if (diag.strengths && diag.strengths.length > 0) {
    text += `✨ *جوانب التميز والإتقان:*\n`;
    diag.strengths.forEach(s => {
      text += `• ${s}\n`;
    });
    text += `\n`;
  }

  text += `━━━━━━━━━━━━━━━\n`;
  text += `تكوين النسيم - معاً لتنشئة جيل قرآني قيادي 🌿`;

  return text;
}

window.shareStudentReportWhatsApp = function(studentId) {
  const currentMonth = appState.followupMonth || appState.currentMonth || 'شهر 1';
  const currentWeek = appState.followupWeek || appState.currentWeek || 'الأسبوع 1';
  const diag = getStudentWeeklyDiagnostic(studentId, currentWeek, currentMonth);
  if (!diag) return;

  const text = generateStudentWeeklyReportText(diag);
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
};

window.copyStudentReportText = function(studentId) {
  const currentMonth = appState.followupMonth || appState.currentMonth || 'شهر 1';
  const currentWeek = appState.followupWeek || appState.currentWeek || 'الأسبوع 1';
  const diag = getStudentWeeklyDiagnostic(studentId, currentWeek, currentMonth);
  if (!diag) return;

  const text = generateStudentWeeklyReportText(diag);
  copyToClipboard(text);
};

function copyFollowupSummaryReport() {
  const currentMonth = appState.followupMonth || appState.currentMonth || 'شهر 1';
  const currentWeek = appState.followupWeek || appState.currentWeek || 'الأسبوع 1';

  const allDiags = students.map(s => getStudentWeeklyDiagnostic(s.id, currentWeek, currentMonth)).filter(Boolean);
  const famFilter = appState.followupFamily || 'all';

  let targetDiags = allDiags;
  let famTitle = 'جميع الطلاب';
  if (famFilter === 'bamousa') {
    targetDiags = allDiags.filter(d => (d.student.family || 'bamousa') === 'bamousa');
    famTitle = 'أسرة باموسى';
  } else if (famFilter === 'akram') {
    targetDiags = allDiags.filter(d => d.student.family === 'akram');
    famTitle = 'أسرة أكرم';
  }

  let text = `🔍 *كشف المتابعة الأسبوعي وتشخيص أداء الطلاب*\n`;
  text += `🏛️ *الأسرة:* ${famTitle}\n`;
  text += `📅 *الفترة:* ${currentWeek} (${currentMonth})\n`;
  text += `👥 *إجمالي الطلاب:* ${targetDiags.length} طالب\n`;
  text += `━━━━━━━━━━━━━━━\n\n`;

  const attentionList = targetDiags.filter(d => d.weaknesses.length > 0);
  const excellentList = targetDiags.filter(d => d.percentage >= 80 && d.weaknesses.length === 0);

  if (attentionList.length > 0) {
    text += `⚠️ *طلاب يحتاجون إلى متابعة وتنبيه معالجة (${attentionList.length}):*\n`;
    attentionList.forEach((d, i) => {
      text += `${i + 1}. *${d.student.name}* (${d.percentage}% - ${d.totalPoints} ن):\n`;
      d.weaknesses.forEach(w => {
        text += `   ↳ ${w.icon} ${w.title}\n`;
      });
    });
    text += `\n`;
  }

  if (excellentList.length > 0) {
    text += `🌟 *الطلاب المتميزون والملتزمون تماماً (${excellentList.length}):*\n`;
    excellentList.forEach((d, i) => {
      text += `${i + 1}. *${d.student.name}* - ${d.totalPoints} نقطة (التزام ${d.percentage}%)\n`;
    });
    text += `\n`;
  }

  text += `━━━━━━━━━━━━━━━\n`;
  text += `تكوين النسيم - مركز المتابعة والتوجيه التربوي 🌿`;

  copyToClipboard(text);
}

// --- تقرير المتابعة الشهري الرسمي بصيغة PDF (Monthly Follow-up Official PDF Report) ---
function getMonthlyRating(commitmentRate, attendancePct, totalPoints) {
  if (totalPoints === 0) {
    return { text: 'غير مرصود', color: '#94a3b8' };
  }
  if (commitmentRate >= 85 || (attendancePct >= 85 && commitmentRate >= 75)) {
    return { text: 'ممتاز 🌟', color: '#16a34a' };
  }
  if (commitmentRate >= 70 || attendancePct >= 75) {
    return { text: 'جيد جداً 🟢', color: '#0284c7' };
  }
  if (commitmentRate >= 50 || attendancePct >= 50) {
    return { text: 'جيد 🟡', color: '#d97706' };
  }
  return { text: 'يحتاج متابعة ⚠️', color: '#dc2626' };
}

function getStudentMonthlyNotes(s) {
  if (s.totalPoints === 0 && s.attDays.total === 0) {
    return 'لم يُرصد للطالب بيانات خلال هذا الشهر بعد';
  }
  const notes = [];
  if (s.attDays.absent >= 3) {
    notes.push(`🚨 غياب متكرر (${s.attDays.absent} أيام غياب)`);
  } else if (s.attDays.absent > 0) {
    notes.push(`⚠️ غياب (${s.attDays.absent} يوم)`);
  }
  if (s.attDays.excused >= 3) {
    notes.push(`ℹ️ استئذان متكرر (${s.attDays.excused} أيام)`);
  }
  if (s.hifzDays.none >= 2) {
    notes.push(`تأخر في إنجاز الحفظ الجديد`);
  }
  if (s.murajaahDays.none >= 2) {
    notes.push(`إخفاق في ورد المراجعة اليومي`);
  }
  if (notes.length === 0) {
    if (s.totalPoints >= 350 || s.commitmentRate >= 80) {
      return '🌟 أداء متميز ومواظبة تامة';
    }
    return '✅ التزام وانضباط جيد';
  }
  return notes.join(' • ');
}

function generateMonthlyFollowupReportHtml(month, targetFamily = 'all') {
  const currentDateStr = new Date().toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  let targetStudents = students;
  let famLabel = 'جميع الطلاب (أسرة باموسى وأسرة أكرم)';
  if (targetFamily === 'bamousa') {
    targetStudents = students.filter(s => (s.family || 'bamousa') === 'bamousa');
    famLabel = 'طلاب أسرة باموسى فقط';
  } else if (targetFamily === 'akram') {
    targetStudents = students.filter(s => s.family === 'akram');
    famLabel = 'طلاب أسرة أكرم فقط';
  }

  const monthlySummary = getMonthlyPerformanceSummary(month);
  const activeSummaries = monthlySummary.studentSummaries.filter(s => 
    targetStudents.some(ts => ts.id === s.id)
  );

  const totalStudentsCount = activeSummaries.length;
  const grandTotalPoints = activeSummaries.reduce((sum, s) => sum + s.totalPoints, 0);
  const avgPoints = totalStudentsCount > 0 ? (grandTotalPoints / totalStudentsCount).toFixed(1) : '0';

  const totalPresent = activeSummaries.reduce((sum, s) => sum + s.attDays.present, 0);
  const totalAtt = activeSummaries.reduce((sum, s) => sum + s.attDays.total, 0);
  const overallAttendanceRate = totalAtt > 0 ? Math.round((totalPresent / totalAtt) * 100) : 0;

  const totalQuranTasks = activeSummaries.reduce((sum, s) => sum + s.hifzDays.total + s.murajaahDays.total, 0);
  const doneQuranTasks = activeSummaries.reduce((sum, s) => sum + s.hifzDays.done + s.murajaahDays.done + (s.hifzDays.partial + s.murajaahDays.partial) * 0.5, 0);
  const overallQuranRate = totalQuranTasks > 0 ? Math.round((doneQuranTasks / totalQuranTasks) * 100) : 0;

  let excellentCount = 0;
  let veryGoodCount = 0;
  let goodCount = 0;
  let attentionCount = 0;

  const rowsHtml = activeSummaries.map((s, index) => {
    const studentIdx = index + 1;
    const rating = getMonthlyRating(s.commitmentRate, s.attendancePct, s.totalPoints);
    if (rating.text.includes('ممتاز')) excellentCount++;
    else if (rating.text.includes('جيد جداً')) veryGoodCount++;
    else if (rating.text.includes('جيد')) goodCount++;
    else if (rating.text.includes('متابعة')) attentionCount++;

    const w1 = s.weekBreakdown['الأسبوع 1'] ?? 0;
    const w2 = s.weekBreakdown['الأسبوع 2'] ?? 0;
    const w3 = s.weekBreakdown['الأسبوع 3'] ?? 0;
    const w4 = s.weekBreakdown['الأسبوع 4'] ?? 0;

    const w1Det = s.weekDetails?.['الأسبوع 1'] || { attPresent: 0, attAbsent: 0, attExcused: 0, hifzDone: 0, murajaahDone: 0, lessonAtt: 0 };
    const w2Det = s.weekDetails?.['الأسبوع 2'] || { attPresent: 0, attAbsent: 0, attExcused: 0, hifzDone: 0, murajaahDone: 0, lessonAtt: 0 };
    const w3Det = s.weekDetails?.['الأسبوع 3'] || { attPresent: 0, attAbsent: 0, attExcused: 0, hifzDone: 0, murajaahDone: 0, lessonAtt: 0 };
    const w4Det = s.weekDetails?.['الأسبوع 4'] || { attPresent: 0, attAbsent: 0, attExcused: 0, hifzDone: 0, murajaahDone: 0, lessonAtt: 0 };

    const sFam = s.family === 'akram' ? 'أكرم' : 'باموسى';
    const famClass = s.family === 'akram' ? 'badge-akram' : 'badge-bamousa';
    const note = getStudentMonthlyNotes(s);

    // بناء كشف الإنجازات اليومية المفصلة تحت الطالب لكل يوم في أسابيع الشهر الأربعة
    const weeksColumnsHtml = ['الأسبوع 1', 'الأسبوع 2', 'الأسبوع 3', 'الأسبوع 4'].map(weekName => {
      const weekPts = s.weekBreakdown[weekName] ?? 0;
      const wDet = s.weekDetails?.[weekName] || { attPresent: 0, attAbsent: 0, attExcused: 0, hifzDone: 0, murajaahDone: 0, lessonAtt: 0 };
      let hasAnyDayData = false;

      const daysListHtml = DAYS_CONFIG.map(dConfig => {
        const key = `${s.id}_${month}_${weekName}_${dConfig.id}`;
        const rec = records[key] || {};
        const dPts = calculateDayPoints(rec, dConfig.id);
        const isRecorded = (rec.attendance !== undefined) || dConfig.items.some(it => rec[it.id] !== undefined);
        if (isRecorded) hasAnyDayData = true;

        if (!isRecorded) {
          return `
            <div class="day-stat-line unrecorded">
              <div class="day-info-row">
                <span class="day-lbl">${dConfig.name}</span>
                <span class="day-score pts-zero">0/${dConfig.maxPoints}ن</span>
              </div>
              <div class="day-badges"><span class="badge-tag tag-unrecorded">لم يُرصد هذا اليوم</span></div>
            </div>
          `;
        }

        const tags = [];
        // تفصيل الحضور والانضباط
        if (rec.attendance === 'present') {
          tags.push(`<span class="badge-tag tag-present">👥 حضور</span>`);
        } else if (rec.attendance === 'absent') {
          tags.push(`<span class="badge-tag tag-absent">👥 غياب</span>`);
        } else if (rec.attendance === 'excused') {
          tags.push(`<span class="badge-tag tag-excused">👥 استئذان</span>`);
        }

        // تفاصيل الحفظ والمراجعة والأنشطة
        dConfig.items.forEach(it => {
          if (it.id === 'attendance') return;
          const val = rec[it.id];
          if (it.id === 'hifz') {
            if (val === 'done' || val === 'present') tags.push(`<span class="badge-tag tag-done">📖 حفظ متقن</span>`);
            else if (val === 'partial' || val === 'excused') tags.push(`<span class="badge-tag tag-part">📖 نصف حفظ</span>`);
            else if (val === 'none') tags.push(`<span class="badge-tag tag-miss">📖 لم يحفظ</span>`);
          } else if (it.id === 'murajaah') {
            if (val === 'done' || val === 'present') tags.push(`<span class="badge-tag tag-done">🔁 مراجعة متقنة</span>`);
            else if (val === 'partial' || val === 'excused') tags.push(`<span class="badge-tag tag-part">🔁 نصف مراجعة</span>`);
            else if (val === 'none') tags.push(`<span class="badge-tag tag-miss">🔁 لم يراجع</span>`);
          } else if (it.id === 'lesson') {
            if (val === 'present' || val === 'done') tags.push(`<span class="badge-tag tag-act">🕌 درس المسجد</span>`);
            else if (val === 'absent' || val === 'none') tags.push(`<span class="badge-tag tag-miss">🕌 غياب الدرس</span>`);
            else if (val === 'excused') tags.push(`<span class="badge-tag tag-excused">🕌 استئذان درس</span>`);
          } else if (it.id === 'familyMeeting') {
            if (val === 'done' || val === 'present') tags.push(`<span class="badge-tag tag-act">🫡 لقاء أسري</span>`);
            else if (val === 'partial' || val === 'excused') tags.push(`<span class="badge-tag tag-part">🫡 لقاء جزئي</span>`);
            else if (val === 'none') tags.push(`<span class="badge-tag tag-miss">🫡 فات اللقاء</span>`);
          } else if (it.id === 'individualProgram') {
            if (val === 'done' || val === 'present') tags.push(`<span class="badge-tag tag-act">🎯 برنامج فردي</span>`);
            else if (val === 'none') tags.push(`<span class="badge-tag tag-miss">🎯 لم ينجز</span>`);
          } else if (it.id === 'familyInteraction') {
            if (val === 'done' || val === 'present') tags.push(`<span class="badge-tag tag-act">🤝 تفاعل أسري</span>`);
            else if (val === 'none') tags.push(`<span class="badge-tag tag-miss">🤝 لم يتفاعل</span>`);
          }
        });

        const dayPtsClass = dPts >= (dConfig.maxPoints * 0.8) ? 'pts-high' : dPts > 0 ? 'pts-mid' : 'pts-zero';

        return `
          <div class="day-stat-line">
            <div class="day-info-row">
              <span class="day-lbl"><b>${dConfig.name}</b></span>
              <span class="day-score ${dayPtsClass}">${dPts}/${dConfig.maxPoints}ن</span>
            </div>
            <div class="day-badges">
              ${tags.join('')}
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="week-detail-col ${hasAnyDayData ? '' : 'week-col-empty'}">
          <div class="week-col-head">
            <div class="week-head-title-row">
              <span class="week-head-title">${weekName}</span>
              <span class="week-head-score">${weekPts} / 100ن</span>
            </div>
            <div class="week-head-metrics">
              <span class="w-metric-pill">👥 حضور: ${wDet.attPresent}/5</span>
              <span class="w-metric-pill">📖 حفظ: ${wDet.hifzDone}</span>
              <span class="w-metric-pill">🔁 مراجعة: ${wDet.murajaahDone}</span>
              <span class="w-metric-pill">🕌 دروس: ${wDet.lessonAtt}</span>
            </div>
          </div>
          <div class="week-days-list">
            ${daysListHtml}
          </div>
        </div>
      `;
    }).join('');

    return `
      <tbody class="student-entry-block">
        <tr class="student-main-row">
          <td class="col-num">${studentIdx}</td>
          <td class="col-name"><b>${escapeHtml(s.name)}</b></td>
          <td class="col-fam"><span class="print-fam-pill ${famClass}">أسرة ${sFam}</span></td>
          <td class="col-w">
            <div class="col-w-pts">${w1 > 0 ? w1 : '-'}</div>
            ${w1 > 0 ? `<div class="col-w-sub">ح:${w1Det.attPresent}/5 | ق:${w1Det.hifzDone + w1Det.murajaahDone}</div>` : ''}
          </td>
          <td class="col-w">
            <div class="col-w-pts">${w2 > 0 ? w2 : '-'}</div>
            ${w2 > 0 ? `<div class="col-w-sub">ح:${w2Det.attPresent}/5 | ق:${w2Det.hifzDone + w2Det.murajaahDone}</div>` : ''}
          </td>
          <td class="col-w">
            <div class="col-w-pts">${w3 > 0 ? w3 : '-'}</div>
            ${w3 > 0 ? `<div class="col-w-sub">ح:${w3Det.attPresent}/5 | ق:${w3Det.hifzDone + w3Det.murajaahDone}</div>` : ''}
          </td>
          <td class="col-w">
            <div class="col-w-pts">${w4 > 0 ? w4 : '-'}</div>
            ${w4 > 0 ? `<div class="col-w-sub">ح:${w4Det.attPresent}/5 | ق:${w4Det.hifzDone + w4Det.murajaahDone}</div>` : ''}
          </td>
          <td class="col-total">
            <div class="total-pts-num">${s.totalPoints}</div>
            <div class="total-pts-lbl">نقطة</div>
          </td>
          <td class="col-att-detail">
            <div class="stat-pct-pill att-pct-pill">${s.attendancePct}%</div>
            <div class="stat-subdetail">
              <span class="sub-pill pill-present">${s.attDays.present} حضور</span>
              ${s.attDays.absent > 0 ? `<span class="sub-pill pill-absent">${s.attDays.absent} غياب</span>` : ''}
              ${s.attDays.excused > 0 ? `<span class="sub-pill pill-excused">${s.attDays.excused} إذن</span>` : ''}
            </div>
          </td>
          <td class="col-quran-detail">
            <div class="stat-pct-pill quran-pct-pill">${s.quranPct}%</div>
            <div class="stat-subdetail">
              <span class="sub-pill pill-hifz">${s.hifzDays.done} حفظ</span>
              <span class="sub-pill pill-mur">${s.murajaahDays.done} مراجعة</span>
              ${(s.hifzDays.none + s.murajaahDays.none) > 0 ? `<span class="sub-pill pill-absent">${s.hifzDays.none + s.murajaahDays.none} إخفاق</span>` : ''}
            </div>
          </td>
          <td class="col-acts-detail">
            <div class="stat-subdetail-vert">
              <span class="sub-pill pill-lesson">🕌 ${s.lessonDays.attended}/${s.lessonDays.total || 8} دروس</span>
              <span class="sub-pill pill-meet">🫡 ${s.familyMeetingDays.done}/${s.familyMeetingDays.total || 4} لقاءات</span>
              <span class="sub-pill pill-prog">🎯 ${s.individualProgramDays.done + s.familyInteractionDays.done} برامج</span>
            </div>
          </td>
          <td class="col-rating"><span class="print-rating-pill" style="color: ${rating.color}; border-color: ${rating.color};">${rating.text}</span></td>
          <td class="col-notes">${note}</td>
        </tr>
        <tr class="student-detail-subrow">
          <td colspan="13" class="student-detail-cell">
            <div class="student-detail-wrapper">
              <!-- Comprehensive Monthly Indicator Ribbon -->
              <div class="student-detail-ribbon">
                <div class="ribbon-card">
                  <div class="ribbon-head">👥 الحضور والانضباط الشهري</div>
                  <div class="ribbon-body">
                    <span class="ribbon-main-stat ${s.attendancePct >= 85 ? 'stat-green' : s.attendancePct >= 70 ? 'stat-amber' : 'stat-red'}">${s.attendancePct}%</span>
                    <span class="ribbon-desc">${s.attDays.present} يوم حضور من أصل ${s.attDays.total} يوم • ${s.attDays.absent} غياب • ${s.attDays.excused} استئذان</span>
                  </div>
                </div>
                <div class="ribbon-card">
                  <div class="ribbon-head">📖 إنجاز الورد القرآني</div>
                  <div class="ribbon-body">
                    <span class="ribbon-main-stat ${s.quranPct >= 85 ? 'stat-blue' : s.quranPct >= 70 ? 'stat-amber' : 'stat-red'}">${s.quranPct}%</span>
                    <span class="ribbon-desc">${s.hifzDays.done} حفظ متقن (${s.hifzDays.partial} جزئي) • ${s.murajaahDays.done} مراجعة متقنة (${s.murajaahDays.partial} جزئية) • ${s.hifzDays.none + s.murajaahDays.none} إخفاق</span>
                  </div>
                </div>
                <div class="ribbon-card">
                  <div class="ribbon-head">🕌 دروس المسجد العلمية</div>
                  <div class="ribbon-body">
                    <span class="ribbon-main-stat stat-purple">${s.lessonDays.attended}/${s.lessonDays.total || 8}</span>
                    <span class="ribbon-desc">${s.lessonDays.attended} درس تم حضوره • ${s.lessonDays.absent} غياب درس • ${s.lessonDays.excused} استئذان</span>
                  </div>
                </div>
                <div class="ribbon-card">
                  <div class="ribbon-head">🫡 الأنشطة الأسرية والبرامج</div>
                  <div class="ribbon-body">
                    <span class="ribbon-main-stat stat-teal">${s.familyMeetingDays.done + s.individualProgramDays.done + s.familyInteractionDays.done}</span>
                    <span class="ribbon-desc">${s.familyMeetingDays.done} لقاء أسري • ${s.individualProgramDays.done} برنامج فردي • ${s.familyInteractionDays.done} تفاعل أسري</span>
                  </div>
                </div>
              </div>

              <div class="student-weeks-grid">
                ${weeksColumnsHtml}
              </div>
            </div>
          </td>
        </tr>
      </tbody>
    `;
  }).join('');

  // كشف الطلاب الأكثر احتياجاً للمتابعة والمعالجة التربوية
  const studentsNeedingFollowup = activeSummaries.filter(s => {
    const rating = getMonthlyRating(s.commitmentRate, s.attendancePct, s.totalPoints);
    return rating.text.includes('متابعة') || s.attDays.absent >= 2 || s.murajaahDays.none >= 2 || s.hifzDays.none >= 2;
  });

  let followupSectionHtml = '';
  if (studentsNeedingFollowup.length > 0) {
    const followupRows = studentsNeedingFollowup.map((s, idx) => {
      const sFam = s.family === 'akram' ? 'أسرة أكرم' : 'أسرة باموسى';
      const weaknesses = [];
      let recommendation = 'متابعة دورية وتكريم عند التحسن والالتزام';

      if (s.attDays.absent >= 2) {
        weaknesses.push(`غياب عن الحلقات (${s.attDays.absent} أيام)`);
        recommendation = 'الاتصال الفوري بولي الأمر للوقوف على أسباب الغياب والتأكيد على الحضور';
      }
      if (s.murajaahDays.none >= 2) {
        weaknesses.push(`إخفاق في ورد المراجعة اليومي (${s.murajaahDays.none} مرات)`);
        recommendation = 'تحديد وقت تسميع مخصص مع المعلم وتكثيف المراجعة وتخفيف الحمل';
      }
      if (s.hifzDays.none >= 2) {
        weaknesses.push(`تأخر في حفظ المقدار الجديد (${s.hifzDays.none} مرات)`);
        recommendation = 'مراجعة خطة الحفظ وتقسيم الوجه القرآني لفقرات مناسبة لقدرات الطالب';
      }
      if (s.totalPoints === 0) {
        weaknesses.push('لم يُرصد للطالب أي درجات أو حضور خلال الشهر');
        recommendation = 'التثبت من انتظام الطالب أو تحديث قيده في السجل';
      }

      return `
        <tr>
          <td style="width: 4%; text-align: center;">${idx + 1}</td>
          <td style="width: 22%; font-weight: 700;">${escapeHtml(s.name)} <span style="font-size: 8pt; color: #64748b;">(${sFam})</span></td>
          <td style="width: 38%; color: #b91c1c; font-weight: 600;">${weaknesses.join(' • ')}</td>
          <td style="width: 36%; color: #047857;">${recommendation}</td>
        </tr>
      `;
    }).join('');

    followupSectionHtml = `
      <div class="followup-box-page">
        <div class="section-badge-title">⚠️ كشف تشخيص مواطن الضعف والتوصيات التربوية الميدانية للمعلمين والمشرفين:</div>
        <table class="sub-table">
          <thead>
            <tr>
              <th style="width: 4%; text-align: center;">#</th>
              <th style="width: 22%;">اسم الطالب</th>
              <th style="width: 38%;">مواطن الضعف والقصور المرصودة في الشهر</th>
              <th style="width: 36%;">التوصية الإجرائية للمشرف والمعلم</th>
            </tr>
          </thead>
          <tbody>
            ${followupRows}
          </tbody>
        </table>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>تقرير المتابعة الشهري - تكوين النسيم - ${escapeHtml(month)}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 7mm 9mm 7mm 9mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
      direction: rtl;
      font-size: 8.8pt;
      line-height: 1.35;
    }
    .print-doc-container {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
    }
    
    /* Header */
    .doc-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2.5px solid #0047ba;
      padding-bottom: 8px;
      margin-bottom: 8px;
    }
    .doc-header-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .doc-logo-box {
      width: 54px;
      height: 54px;
      flex-shrink: 0;
    }
    .doc-logo-box img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .doc-title-text h1 {
      margin: 0 0 2px 0;
      font-size: 15pt;
      font-weight: 800;
      color: #0047ba;
    }
    .doc-title-text p {
      margin: 0;
      font-size: 8.5pt;
      color: #475569;
      font-weight: 600;
    }
    .doc-header-meta {
      text-align: left;
      font-size: 8.5pt;
      color: #334155;
    }
    .doc-badge {
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      padding: 3px 8px;
      border-radius: 4px;
      font-weight: 700;
      display: inline-block;
      margin-bottom: 3px;
    }

    /* Sub-header Banner */
    .doc-sub-banner {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      padding: 5px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 8.8pt;
    }
    .banner-item {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .banner-label {
      color: #64748b;
      font-weight: 700;
    }
    .banner-val {
      font-weight: 800;
      color: #0f172a;
    }

    /* KPI Summary Cards */
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 6px;
      margin-bottom: 8px;
    }
    .kpi-card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      padding: 5px 4px;
      text-align: center;
    }
    .kpi-num {
      font-size: 11pt;
      font-weight: 800;
      color: #0047ba;
      line-height: 1.1;
    }
    .kpi-label {
      font-size: 7pt;
      color: #64748b;
      font-weight: 700;
      margin-top: 2px;
    }

    /* Main Table */
    .roster-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      font-size: 8.5pt;
    }
    .roster-table th {
      background: #0047ba;
      color: #ffffff;
      border: 1px solid #003894;
      padding: 5px 6px;
      font-weight: 800;
      text-align: center;
    }
    .roster-table th.th-name {
      text-align: right;
    }
    .roster-table td {
      border: 1px solid #cbd5e1;
      padding: 4px 6px;
      text-align: center;
      color: #1e293b;
    }
    .roster-table tr:nth-child(even) {
      background: #f8fafc;
    }
    .col-num { width: 22px; color: #64748b; font-weight: 700; }
    .col-name { text-align: right !important; width: 110px; }
    .col-fam { width: 62px; }
    .col-w { width: 52px; font-weight: 600; color: #475569; }
    .col-total { width: 55px; color: #0047ba; font-weight: 800; background: #eff6ff; }
    .col-att-head { width: 92px; }
    .col-quran-head { width: 100px; }
    .col-acts-head { width: 96px; }
    .col-rating { width: 75px; }
    .col-notes { text-align: right !important; font-size: 7.2pt; color: #334155; }

    .col-w-pts { font-weight: 800; font-size: 8pt; color: #1e293b; }
    .col-w-sub { font-size: 5.6pt; color: #64748b; font-weight: 700; margin-top: 1px; }

    .total-pts-num { font-size: 9.5pt; font-weight: 900; line-height: 1.1; }
    .total-pts-lbl { font-size: 5.5pt; font-weight: 700; color: #1d4ed8; }

    .stat-pct-pill {
      font-weight: 800;
      font-size: 7.8pt;
      padding: 1px 5px;
      border-radius: 3px;
      display: inline-block;
      margin-bottom: 2px;
    }
    .att-pct-pill { background: #dcfce7; color: #15803d; }
    .quran-pct-pill { background: #e0f2fe; color: #0369a1; }

    .stat-subdetail {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 2px;
      font-size: 5.8pt;
    }
    .stat-subdetail-vert {
      display: flex;
      flex-direction: column;
      gap: 1.5px;
      align-items: center;
      font-size: 5.8pt;
    }
    .sub-pill {
      font-size: 5.6pt;
      font-weight: 700;
      padding: 0.5px 3px;
      border-radius: 2px;
      white-space: nowrap;
      line-height: 1.2;
    }
    .pill-present { background: #f0fdf4; color: #166534; border: 0.5px solid #bbf7d0; }
    .pill-absent { background: #fef2f2; color: #991b1b; border: 0.5px solid #fecaca; font-weight: 800; }
    .pill-excused { background: #fefce8; color: #854d0e; border: 0.5px solid #fef08a; }
    .pill-hifz { background: #eff6ff; color: #1e40af; border: 0.5px solid #bfdbfe; }
    .pill-mur { background: #f0fdfa; color: #0f766e; border: 0.5px solid #99f6e4; }
    .pill-lesson { background: #faf5ff; color: #6b21a8; border: 0.5px solid #e9d5ff; }
    .pill-meet { background: #fff7ed; color: #9a3412; border: 0.5px solid #fed7aa; }
    .pill-prog { background: #f8fafc; color: #334155; border: 0.5px solid #e2e8f0; }

    /* Student Detail Ribbon & Indicators */
    .student-detail-ribbon {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 5px;
      margin-bottom: 5px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 4px 6px;
    }
    .ribbon-card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 3px;
      padding: 3px 5px;
      text-align: right;
    }
    .ribbon-head {
      font-size: 6.8pt;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 2px;
      border-bottom: 0.5px solid #f1f5f9;
      padding-bottom: 1px;
    }
    .ribbon-body {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .ribbon-main-stat {
      font-size: 8.8pt;
      font-weight: 900;
      line-height: 1;
    }
    .stat-green { color: #15803d; }
    .stat-blue { color: #0284c7; }
    .stat-amber { color: #b45309; }
    .stat-red { color: #b91c1c; }
    .stat-purple { color: #7e22ce; }
    .stat-teal { color: #0f766e; }

    .ribbon-desc {
      font-size: 5.8pt;
      color: #475569;
      font-weight: 600;
      line-height: 1.2;
    }

    .week-head-title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2px;
    }
    .week-head-metrics {
      display: flex;
      flex-wrap: wrap;
      gap: 2px;
      font-size: 5.6pt;
      padding-top: 2px;
      border-top: 0.5px dashed #cbd5e1;
    }
    .w-metric-pill {
      background: #ffffff;
      border: 0.5px solid #cbd5e1;
      padding: 0.5px 3px;
      border-radius: 2px;
      color: #334155;
      font-weight: 700;
      white-space: nowrap;
    }

    .print-fam-pill {
      font-size: 7pt;
      padding: 1px 5px;
      border-radius: 4px;
      font-weight: 700;
      display: inline-block;
    }
    .print-fam-pill.badge-bamousa {
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
    }
    .print-fam-pill.badge-akram {
      background: #fdf2f8;
      color: #be185d;
      border: 1px solid #fbcfe8;
    }

    .print-rating-pill {
      font-size: 7pt;
      padding: 1px 5px;
      border-radius: 4px;
      font-weight: 800;
      border: 1px solid;
      display: inline-block;
      white-space: nowrap;
    }

    /* Sub-table for weaknesses */
    .followup-box-page {
      margin-top: 10px;
      page-break-inside: avoid;
    }
    .section-badge-title {
      font-size: 9pt;
      font-weight: 800;
      color: #991b1b;
      margin-bottom: 4px;
    }
    .sub-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
      margin-bottom: 8px;
    }
    .sub-table th {
      background: #fee2e2;
      color: #991b1b;
      border: 1px solid #fecaca;
      padding: 4px 6px;
      font-weight: 800;
      text-align: right;
    }
    .sub-table td {
      border: 1px solid #cbd5e1;
      padding: 4px 6px;
      text-align: right;
    }
    .sub-table tr:nth-child(even) {
      background: #fffafa;
    }

    /* Student Entry Block & Detailed Daily Breakdown */
    .student-entry-block {
      page-break-inside: avoid;
      break-inside: avoid;
      border-bottom: 2px solid #94a3b8;
    }
    .student-entry-block tr.student-main-row td {
      background: #f8fafc;
      font-weight: 600;
      border-bottom: 1px solid #e2e8f0;
    }
    .student-entry-block tr.student-main-row td.col-total {
      background: #dbeafe;
      color: #1e40af;
      font-weight: 800;
    }
    .student-entry-block tr.student-detail-subrow td {
      padding: 5px 8px 8px 8px;
      background: #ffffff;
      border-top: none;
      border-bottom: 2px solid #94a3b8;
    }
    .student-detail-wrapper {
      width: 100%;
      text-align: right;
    }
    .student-detail-subhead {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 2px 4px 4px 4px;
      margin-bottom: 4px;
      border-bottom: 1px dashed #e2e8f0;
      font-size: 7.5pt;
      color: #334155;
    }
    .student-detail-subhead .subhead-title {
      font-weight: 800;
      color: #0047ba;
    }
    .student-detail-subhead .subhead-pts {
      font-weight: 600;
      color: #475569;
    }
    .student-weeks-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 5px;
      width: 100%;
    }
    .week-detail-col {
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      background: #f8fafc;
      padding: 3px 5px;
      display: flex;
      flex-direction: column;
    }
    .week-detail-col.week-col-empty {
      background: #fafafa;
      opacity: 0.75;
    }
    .week-col-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 2px;
      margin-bottom: 3px;
      border-bottom: 1px solid #cbd5e1;
      font-size: 7.2pt;
    }
    .week-head-title {
      font-weight: 800;
      color: #0047ba;
    }
    .week-head-score {
      font-weight: 700;
      color: #1e293b;
      background: #e2e8f0;
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 6.8pt;
    }
    .week-days-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .day-stat-line {
      background: #ffffff;
      border: 1px solid #eef2f6;
      border-radius: 3px;
      padding: 2px 4px;
    }
    .day-stat-line.unrecorded {
      background: #f8fafc;
      opacity: 0.65;
    }
    .day-info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 6.8pt;
      margin-bottom: 1px;
    }
    .day-lbl {
      color: #1e293b;
      font-weight: 700;
    }
    .day-score {
      font-size: 6.5pt;
      font-weight: 700;
      padding: 0 3px;
      border-radius: 2px;
    }
    .day-score.pts-high {
      background: #dcfce7;
      color: #166534;
    }
    .day-score.pts-mid {
      background: #fef9c3;
      color: #854d0e;
    }
    .day-score.pts-zero {
      background: #fee2e2;
      color: #991b1b;
    }
    .day-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 2px;
    }
    .badge-tag {
      font-size: 6pt;
      font-weight: 700;
      padding: 0.5px 3px;
      border-radius: 2.5px;
      line-height: 1.2;
      display: inline-flex;
      align-items: center;
      white-space: nowrap;
    }
    .badge-tag.tag-present { background: #dcfce7; color: #15803d; border: 0.5px solid #bbf7d0; }
    .badge-tag.tag-absent { background: #fee2e2; color: #b91c1c; border: 0.5px solid #fecaca; font-weight: 800; }
    .badge-tag.tag-excused { background: #fef9c3; color: #854d0e; border: 0.5px solid #fef08a; }
    .badge-tag.tag-done { background: #e0f2fe; color: #0369a1; border: 0.5px solid #bae6fd; }
    .badge-tag.tag-part { background: #fef3c7; color: #92400e; border: 0.5px solid #fde68a; }
    .badge-tag.tag-miss { background: #fee2e2; color: #991b1b; border: 0.5px solid #fecaca; }
    .badge-tag.tag-act { background: #f3e8ff; color: #6b21a8; border: 0.5px solid #e9d5ff; }
    .badge-tag.tag-unrecorded { background: #f1f5f9; color: #94a3b8; border: 0.5px solid #e2e8f0; font-size: 6pt; }

    .doc-footer {
      text-align: center;
      font-size: 7.2pt;
      color: #64748b;
      margin-top: 6px;
      border-top: 1px solid #e2e8f0;
      padding-top: 3px;
    }
  </style>
</head>
<body>
  <div class="print-doc-container">
    <!-- Header -->
    <div class="doc-header">
      <div class="doc-header-brand">
        <div class="doc-logo-box">
          <img src="${reportLogoImg}" alt="شعار تكوين النسيم" />
        </div>
        <div class="doc-title-text">
          <h1>تكوين النسيم</h1>
          <p>سجل المتابعة والتقييم الشهري الشامل لحلقات القرآن الكريم والأنشطة التربوية</p>
        </div>
      </div>
      <div class="doc-header-meta">
        <div class="doc-badge">وثيقة متابعة رسمية معتمدة</div>
        <div>تاريخ الإصدار: ${currentDateStr}</div>
      </div>
    </div>

    <!-- Banner -->
    <div class="doc-sub-banner">
      <div class="banner-item">
        <span class="banner-label">📅 الشهر المستهدف:</span>
        <span class="banner-val">${escapeHtml(month)}</span>
      </div>
      <div class="banner-item">
        <span class="banner-label">🏛️ الفئة المشمولة:</span>
        <span class="banner-val">${famLabel}</span>
      </div>
      <div class="banner-item">
        <span class="banner-label">👥 عدد الطلاب المشمولين:</span>
        <span class="banner-val">${totalStudentsCount} طالب</span>
      </div>
    </div>

    <!-- KPI Row -->
    <div class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-num">${totalStudentsCount}</div>
        <div class="kpi-label">إجمالي الطلاب</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-num">${grandTotalPoints}</div>
        <div class="kpi-label">مجموع نقاط الشهر</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-num">${avgPoints}</div>
        <div class="kpi-label">متوسط نقاط الطالب</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-num" style="color: #16a34a;">${overallAttendanceRate}%</div>
        <div class="kpi-label">نسبة الحضور العامة</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-num" style="color: #0284c7;">${overallQuranRate}%</div>
        <div class="kpi-label">نسبة القرآن (حفظ ومراجعة)</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-num" style="color: #15803d;">${excellentCount}</div>
        <div class="kpi-label">المتميزون (ممتاز 🌟)</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-num" style="color: #b91c1c;">${attentionCount}</div>
        <div class="kpi-label">يحتاجون متابعة ⚠️</div>
      </div>
    </div>

    <!-- Main Table -->
    <table class="roster-table">
      <thead>
        <tr>
          <th class="col-num">#</th>
          <th class="th-name">اسم الطالب</th>
          <th class="col-fam">الأسرة</th>
          <th class="col-w">أسبوع 1</th>
          <th class="col-w">أسبوع 2</th>
          <th class="col-w">أسبوع 3</th>
          <th class="col-w">أسبوع 4</th>
          <th class="col-total">المجموع</th>
          <th class="col-att-head">سجل الحضور والغياب</th>
          <th class="col-quran-head">إنجاز القرآن الكريم</th>
          <th class="col-acts-head">الدروس والأنشطة</th>
          <th class="col-rating">التقدير الشهري</th>
          <th class="col-notes" style="text-align: right;">تشخيص المتابعة وملاحظات المشرف</th>
        </tr>
      </thead>
      ${rowsHtml}
    </table>

    <!-- Followup recommendations section if any -->
    ${followupSectionHtml}

    <!-- Footer -->
    <div class="doc-footer">
      منظومة تكوين النسيم التعليمية والتربوية • تم إنشاء هذا التقرير رسمياً بصيغة PDF وتصديره بتاريخ ${currentDateStr} • نظام المتابعة السحابية الشاملة
    </div>
  </div>
</body>
</html>`;
}

function printMonthlyReportViaIframe(reportHtml) {
  let printIframe = document.getElementById('takween-monthly-print-iframe');
  if (printIframe) {
    try { printIframe.remove(); } catch (e) {}
  }

  printIframe = document.createElement('iframe');
  printIframe.id = 'takween-monthly-print-iframe';
  printIframe.style.position = 'fixed';
  printIframe.style.right = '-9999px';
  printIframe.style.bottom = '-9999px';
  printIframe.style.width = '0px';
  printIframe.style.height = '0px';
  printIframe.style.border = 'none';
  document.body.appendChild(printIframe);

  try {
    const frameDoc = printIframe.contentWindow.document;
    frameDoc.open();
    frameDoc.write(reportHtml);
    frameDoc.close();

    setTimeout(() => {
      try {
        printIframe.contentWindow.focus();
        printIframe.contentWindow.print();
      } catch (printErr) {
        openPrintWindowFallback(reportHtml);
      }
    }, 400);
  } catch (err) {
    openPrintWindowFallback(reportHtml);
  }
}

async function exportMonthlyFollowupPDF() {
  if (students.length === 0) {
    showToast('لا يوجد طلاب مسجلون حالياً لتصدير التقرير ⚠️');
    return;
  }

  const selectedMonth = appState.followupMonth || appState.currentMonth || 'شهر 1';
  const targetFamily = appState.followupFamily || 'all';

  showToast('جاري تجهيز تقرير المتابعة الشهري وتحميل ملف PDF... ⏳');

  const reportHtml = generateMonthlyFollowupReportHtml(selectedMonth, targetFamily);
  const fileName = `تقرير_متابعة_الطلاب_الشهري_تكوين_النسيم_${selectedMonth.replace(/\s+/g, '_')}.pdf`;

  // حاوية غير مرئية في DOM لـ html2pdf
  const container = document.createElement('div');
  container.id = 'takween-pdf-export-container';
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '1120px';
  container.style.backgroundColor = '#ffffff';
  container.style.zIndex = '-9999';
  container.style.opacity = '0.01';
  container.style.pointerEvents = 'none';
  container.innerHTML = reportHtml;
  document.body.appendChild(container);

  const opt = {
    margin: [6, 6, 6, 6],
    filename: fileName,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'landscape'
    },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  };

  try {
    const targetElement = container.querySelector('.print-doc-container') || container;
    await html2pdf().set(opt).from(targetElement).save();
    showToast(`تم تحميل ملف PDF (${fileName}) بنجاح! 📄✅`);
    setTimeout(() => {
      try { container.remove(); } catch (e) {}
    }, 1500);
  } catch (err) {
    console.warn('html2pdf direct conversion failed or was blocked, falling back to print window:', err);
    try { container.remove(); } catch (e) {}
    printMonthlyReportViaIframe(reportHtml);
    showToast(`تم فتح نافذة الطباعة / الحفظ بتنسيق PDF لتقرير الشهر 🖨️`);
  }
}
window.exportMonthlyFollowupPDF = exportMonthlyFollowupPDF;

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
    const fam = student.family || 'bamousa';
    const famLabel = fam === 'akram' ? 'أسرة أكرم' : 'أسرة باموسى';
    html += `
      <div class="student-manage-item">
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <span style="color: #94a3b8; font-weight: 700; width: 26px;">#${studentIdx}</span>
          <b style="font-size: 0.95rem; color: #1e293b;">${escapeHtml(student.name)}</b>
          <span class="badge-family ${fam}">${famLabel}</span>
        </div>
        <div class="student-manage-actions">
          <button class="btn btn-sm btn-outline" onclick="renameStudentPrompt('${student.id}')" title="تعديل الاسم والأسرة">
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
  const editFamilySelect = document.getElementById('edit-student-family');

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
      const newFam = editFamilySelect ? editFamilySelect.value : 'bamousa';
      if (!newName || !studentId) return;

      const student = students.find(s => s.id === studentId);
      if (student) {
        student.name = newName;
        student.family = newFam;
        triggerCloudSync();
        renderStudentsList();
        renderTrackingDayView();
        renderLeaderboard();
        showToast('تم تعديل بيانات الطالب بنجاح ✅');
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
  const editFamilySelect = document.getElementById('edit-student-family');

  if (!editModal || !editForm || !editInput) return;

  editForm.dataset.studentId = studentId;
  editInput.value = student.name;
  if (editFamilySelect) {
    editFamilySelect.value = student.family || 'bamousa';
  }
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

  // Family Filter Pills in Report Modal
  document.querySelectorAll('.report-family-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.report-family-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const fam = btn.getAttribute('data-report-family') || btn.dataset.reportFamily;
      appState.reportFamily = fam;
      saveStateLocally();
      updateReportPreview();
    });
  });

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

  appState.reportFamily = appState.selectedFamily || 'bamousa';
  syncReportFamilyPills();
  syncReportCheckboxes();
  updateReportPreview();
  modal.classList.add('show');
}

function syncReportFamilyPills() {
  const currentFam = appState.reportFamily || appState.selectedFamily || 'bamousa';
  document.querySelectorAll('.report-family-btn').forEach(btn => {
    const fam = btn.getAttribute('data-report-family') || btn.dataset.reportFamily;
    if (fam === currentFam) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  const bamCount = students.filter(s => (s.family || 'bamousa') === 'bamousa').length;
  const akrCount = students.filter(s => s.family === 'akram').length;
  const badgeBam = document.getElementById('badge-rep-fam-bamousa');
  const badgeAkr = document.getElementById('badge-rep-fam-akram');
  if (badgeBam) badgeBam.textContent = `${bamCount} طالب`;
  if (badgeAkr) badgeAkr.textContent = `${akrCount} طالب`;
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

  const targetFamily = appState.reportFamily || appState.selectedFamily || 'bamousa';
  let targetStudents = [];
  let familyHeader = '';

  const normAkramList = AKRAM_STUDENTS_LIST.map(normalizeArabicName);

  if (targetFamily === 'akram') {
    targetStudents = students.filter(s => s.family === 'akram' || normAkramList.includes(normalizeArabicName(s.name)));
    familyHeader = 'أسرة أكرم';
  } else if (targetFamily === 'bamousa') {
    targetStudents = students.filter(s => s.family === 'bamousa' || (!s.family && !normAkramList.includes(normalizeArabicName(s.name))));
    familyHeader = 'أسرة باموسى';
  } else {
    targetStudents = students;
    familyHeader = 'جميع الطلاب';
  }

  let report = `*📋 تقرير حضور الطلاب - ${familyHeader}*\n`;
  report += `📅 *${appState.currentWeek}* (${appState.currentMonth})\n`;
  report += `🗓️ *الأيام:* ${daysNames}\n`;
  report += `━━━━━━━━━━━━━━━\n\n`;

  targetStudents.forEach((student, idx) => {
    let symbols = [];

    selectedConfigs.forEach(d => {
      const rec = getStudentDayRecord(student.id, d.id);
      if (rec.attendance === 'present') {
        symbols.push('✅');
      } else if (rec.attendance === 'excused') {
        symbols.push('⚠️');
      } else if (rec.attendance === 'absent') {
        symbols.push('❌');
      } else {
        symbols.push('⚪');
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
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
