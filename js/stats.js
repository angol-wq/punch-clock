/**
 * Stats Module
 * Calculates work duration, overtime, and earnings
 */

/**
 * Calculate duration between two timestamps in milliseconds
 */
function calcDurationMs(clockInTime, clockOutTime) {
  if (!clockOutTime || !clockInTime) return 0;
  return Math.max(0, new Date(clockOutTime).getTime() - new Date(clockInTime).getTime());
}

/**
 * Calculate working hours for a single record (clock in -> clock out)
 */
function calcRecordHours(record) {
  const ms = calcDurationMs(record.clockInTime, record.clockOutTime);
  return ms / (1000 * 60 * 60);
}

/**
 * Format duration: milliseconds -> human readable
 */
function formatDuration(ms) {
  if (ms <= 0) return '0分钟';

  const totalMinutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}小时${minutes > 0 ? minutes + '分钟' : ''}`;
  }
  return `${minutes}分钟`;
}

/**
 * Format duration short: for compact display
 */
function formatDurationShort(ms) {
  if (ms <= 0) return '0h 0m';

  const totalMinutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

/**
 * Format hours as decimal string
 */
function formatHoursDecimal(ms) {
  const hours = ms / (1000 * 60 * 60);
  return hours.toFixed(1);
}

/**
 * Calculate earnings: hours * hourlyRate
 */
function calcEarnings(ms, hourlyRate) {
  const hours = ms / (1000 * 60 * 60);
  return Math.round(hours * hourlyRate * 100) / 100;
}

function formatCurrency(amount) {
  return `¥${amount.toFixed(2)}`;
}

/**
 * Aggregate stats for a set of records
 */
function aggregateStats(records) {
  let totalMs = 0;
  let workDays = 0;
  let totalEarnings = 0;

  for (const record of records) {
    const ms = calcDurationMs(record.clockInTime, record.clockOutTime);
    if (ms > 0) {
      totalMs += ms;
      workDays++;
      totalEarnings += calcEarnings(ms, record.hourlyRate || 0);
    }
  }

  return {
    totalMs,
    workDays,
    totalEarnings,
    avgMsPerDay: workDays > 0 ? totalMs / workDays : 0
  };
}

/**
 * Group records by date
 */
function groupByDate(records) {
  const groups = {};
  for (const record of records) {
    const date = record.date || formatDateStr(new Date(record.clockInTime));
    if (!groups[date]) groups[date] = [];
    groups[date].push(record);
  }
  return groups;
}

/**
 * Calculate daily summaries
 */
function calcDailySummaries(records) {
  const groups = groupByDate(records);
  const summaries = [];

  for (const [date, dayRecords] of Object.entries(groups)) {
    let dayMs = 0;
    let dayEarnings = 0;

    for (const r of dayRecords) {
      const ms = calcDurationMs(r.clockInTime, r.clockOutTime);
      if (ms > 0) {
        dayMs += ms;
        dayEarnings += calcEarnings(ms, r.hourlyRate || 0);
      }
    }

    summaries.push({ date, totalMs: dayMs, earnings: dayEarnings, records: dayRecords });
  }

  summaries.sort((a, b) => b.date.localeCompare(a.date));
  return summaries;
}

// ===== Period Helpers =====

function getWeekRange(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return {
    start: formatDateStr(monday),
    end: formatDateStr(sunday),
    startDate: monday,
    endDate: sunday
  };
}

function getMonthRange(year, month) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

function getCurrentMonthRange() {
  const now = new Date();
  return getMonthRange(now.getFullYear(), now.getMonth() + 1);
}

/**
 * Parse date string "YYYY-MM-DD" to Date object (local timezone)
 */
function parseDateStr(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}
