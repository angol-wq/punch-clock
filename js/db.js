/**
 * Database Layer - IndexedDB via Dexie.js
 * Stores work records and settings locally on device
 */

// Check Dexie loaded
if (typeof Dexie === 'undefined') {
  console.error('Dexie not loaded from CDN');
  alert('应用加载失败，请检查网络后刷新重试');
}

const db = new Dexie('PunchClockDB');

db.version(1).stores({
  workRecords: '++id, date, timestamp',
  settings: 'key'
});

// ===== Settings Operations =====

async function getSetting(key, defaultValue = null) {
  const entry = await db.settings.get(key);
  return entry ? entry.value : defaultValue;
}

async function setSetting(key, value) {
  await db.settings.put({ key, value });
}

// ===== Work Record Operations =====

async function addRecord(record) {
  const date = formatDateStr(record.timestamp || new Date());
  return await db.workRecords.add({
    date: date,
    clockInTime: record.clockInTime,
    clockOutTime: record.clockOutTime || null,
    clockInPhoto: record.clockInPhoto || null,
    clockOutPhoto: record.clockOutPhoto || null,
    hourlyRate: record.hourlyRate || 0,
    notes: record.notes || '',
    timestamp: (record.timestamp || new Date()).getTime()
  });
}

async function updateRecord(id, updates) {
  return await db.workRecords.update(id, updates);
}

async function deleteRecord(id) {
  return await db.workRecords.delete(id);
}

async function getRecord(id) {
  return await db.workRecords.get(id);
}

async function getRecordsByDateRange(startDate, endDate) {
  return await db.workRecords
    .where('date')
    .between(startDate, endDate, true, true)
    .reverse()
    .sortBy('timestamp');
}

async function getRecordsByMonth(year, month) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return await getRecordsByDateRange(startDate, endDate);
}

async function getTodayRecord() {
  const today = formatDateStr(new Date());
  const records = await db.workRecords
    .where('date')
    .equals(today)
    .reverse()
    .sortBy('timestamp');
  return records.length > 0 ? records : [];
}

async function getActiveRecord() {
  // Find the most recent record that has clockInTime but no clockOutTime
  const today = formatDateStr(new Date());
  const todayRecords = await db.workRecords
    .where('date')
    .equals(today)
    .reverse()
    .sortBy('timestamp');

  for (const r of todayRecords) {
    if (r.clockInTime && !r.clockOutTime) {
      return r;
    }
  }
  return null;
}

async function getAllRecords() {
  return await db.workRecords.reverse().sortBy('timestamp');
}

async function getDistinctMonths() {
  const all = await getAllRecords();
  const months = new Set();
  for (const r of all) {
    if (r.date) {
      const parts = r.date.split('-');
      months.add(`${parts[0]}-${parts[1]}`);
    }
  }
  return Array.from(months).sort().reverse();
}

async function clearAllData() {
  await db.workRecords.clear();
}

// ===== Helpers =====

function formatDateStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTimeStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function formatDateTime(date) {
  return `${formatDateStr(date)} ${formatTimeStr(date)}`;
}

function formatDisplayDate(dateStr) {
  const parts = dateStr.split('-');
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${parseInt(parts[1])}月${parseInt(parts[2])}日 周${weekdays[d.getDay()]}`;
}

function formatMonthLabel(yearMonth) {
  const [y, m] = yearMonth.split('-');
  return `${y}年${parseInt(m)}月`;
}

// ===== Migration from localStorage (if exists) =====

async function migrateFromLocalStorage() {
  const migrated = await getSetting('migrated_v1', false);
  if (migrated) return;

  const oldRecords = localStorage.getItem('checkin_records');
  if (!oldRecords) {
    await setSetting('migrated_v1', true);
    return;
  }

  try {
    const parsed = JSON.parse(oldRecords);
    for (const [date, punches] of Object.entries(parsed)) {
      for (const punch of punches) {
        const ts = new Date(`${date}T${punch.time}`);
        if (punch.type === 'in') {
          await db.workRecords.add({
            date: date,
            clockInTime: ts.getTime(),
            clockOutTime: null,
            clockInPhoto: null,
            clockOutPhoto: null,
            hourlyRate: 0,
            notes: '',
            timestamp: ts.getTime()
          });
        }
      }
    }
    // Pair up with subsequent out punches
    const all = await db.workRecords.orderBy('timestamp').toArray();
    for (const [date, punches] of Object.entries(parsed)) {
      const outPunches = punches.filter(p => p.type === 'out');
      const dayRecords = all.filter(r => r.date === date && !r.clockOutTime);
      for (let i = 0; i < Math.min(outPunches.length, dayRecords.length); i++) {
        const outTs = new Date(`${date}T${outPunches[i].time}`);
        await db.workRecords.update(dayRecords[i].id, {
          clockOutTime: outTs.getTime()
        });
      }
    }
    localStorage.removeItem('checkin_records');
    await setSetting('migrated_v1', true);
  } catch (e) {
    console.warn('Migration failed:', e);
    await setSetting('migrated_v1', true);
  }
}
