/**
 * UI Module
 * Handles all DOM rendering, navigation, modals, and toasts
 */

let currentPage = 'dashboard';
let currentMonth = '';

// ===== Navigation =====

function navigateTo(page) {
  // Update pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const targetPage = document.getElementById(`page-${page}`);
  if (targetPage) targetPage.classList.add('active');

  // Update nav buttons
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const navBtn = document.querySelector(`[data-nav="${page}"]`);
  if (navBtn) navBtn.classList.add('active');

  // Update header title
  const titles = {
    dashboard: '私人打卡',
    history: '历史记录',
    summary: '统计汇总',
    settings: '设置'
  };
  document.getElementById('header-title').textContent = titles[page] || '私人打卡';

  currentPage = page;

  // Refresh page content
  switch (page) {
    case 'dashboard':
      refreshDashboard();
      break;
    case 'history':
      refreshHistory();
      break;
    case 'summary':
      refreshSummary();
      break;
    case 'settings':
      refreshSettings();
      break;
  }
}

// ===== Toast =====

let toastTimer = null;

function showToast(msg, duration = 2000) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    toastTimer = null;
  }, duration);
}

// ===== Confirm Modal =====

function showConfirm(msg) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-msg').textContent = msg;
    modal.classList.add('show');

    const cleanup = () => {
      modal.classList.remove('show');
      document.getElementById('confirm-ok').removeEventListener('click', onOk);
      document.getElementById('confirm-cancel').removeEventListener('click', onCancel);
    };

    const onOk = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };

    document.getElementById('confirm-ok').addEventListener('click', onOk);
    document.getElementById('confirm-cancel').addEventListener('click', onCancel);
  });
}

// ===== Photo Modal =====

function showPhoto(blob) {
  if (!blob) return;
  const modal = document.getElementById('photo-modal');
  const img = document.getElementById('photo-modal-img');
  img.src = blobToUrl(blob);
  modal.classList.add('show');

  const close = () => {
    modal.classList.remove('show');
    revokeBlobUrl(img.src);
    img.src = '';
  };

  document.querySelector('#photo-modal .modal-close').onclick = close;
  document.querySelector('#photo-modal .modal-backdrop').onclick = close;
}

// ===== Dashboard =====

let clockTimer = null;

async function refreshDashboard() {
  const activeRecord = await getActiveRecord();
  const hourlyRate = parseFloat(await getSetting('hourlyRate', 0));

  const statusIndicator = document.getElementById('status-indicator');
  const statusDot = statusIndicator.querySelector('.status-dot');
  const statusText = document.getElementById('status-text');
  const statusTime = document.getElementById('status-time');
  const statusDate = document.getElementById('status-date');
  const punchBtn = document.getElementById('punch-btn');
  const todayCard = document.getElementById('today-card');

  // Update date
  const now = new Date();
  statusDate.textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 周${['日','一','二','三','四','五','六'][now.getDay()]}`;

  if (activeRecord) {
    // Clocked in
    statusDot.className = 'status-dot on';
    statusText.textContent = '已上班';
    punchBtn.className = 'punch-btn punch-out-btn';
    punchBtn.querySelector('.punch-icon').textContent = '🏁';
    punchBtn.querySelector('.punch-label').textContent = '下班打卡';
    punchBtn.onclick = () => handlePunchOut();

    // Show today card
    todayCard.style.display = 'block';
    document.getElementById('today-in').textContent = formatTimeStr(new Date(activeRecord.clockInTime));

    // Start live timer
    if (clockTimer) clearInterval(clockTimer);
    function updateTimer() {
      const elapsed = Date.now() - new Date(activeRecord.clockInTime).getTime();
      statusTime.textContent = formatDurationShort(elapsed);
      document.getElementById('today-duration').textContent = formatDuration(elapsed);
      if (hourlyRate > 0) {
        document.getElementById('today-earnings').textContent = formatCurrency(calcEarnings(elapsed, hourlyRate));
      } else {
        document.getElementById('today-earnings').textContent = '请先设置时薪';
      }
    }
    updateTimer();
    clockTimer = setInterval(updateTimer, 1000);

  } else {
    // Not clocked in
    statusDot.className = 'status-dot off';
    statusText.textContent = '未上班';
    statusTime.textContent = '--:--';
    punchBtn.className = 'punch-btn punch-in-btn';
    punchBtn.querySelector('.punch-icon').textContent = '▶';
    punchBtn.querySelector('.punch-label').textContent = '上班打卡';
    punchBtn.onclick = () => handlePunchIn();

    // Check today's completed records
    const todayRecords = await getTodayRecord();
    const completedRecords = todayRecords.filter(r => r.clockInTime && r.clockOutTime);

    if (completedRecords.length > 0) {
      let todayMs = 0;
      let todayEarnings = 0;
      for (const r of completedRecords) {
        const ms = calcDurationMs(r.clockInTime, r.clockOutTime);
        todayMs += ms;
        todayEarnings += calcEarnings(ms, r.hourlyRate || 0);
      }
      todayCard.style.display = 'block';
      document.getElementById('today-in').textContent = `${completedRecords.length}次记录`;
      document.getElementById('today-duration').textContent = formatDuration(todayMs);
      document.getElementById('today-earnings').textContent = hourlyRate > 0 ? formatCurrency(todayEarnings) : '请先设置时薪';
      statusTime.textContent = formatDurationShort(todayMs);
      statusDot.className = 'status-dot off';
      statusText.textContent = '已下班';
    } else {
      todayCard.style.display = 'none';
    }

    if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
  }
}

async function handlePunchIn() {
  try {
    const now = new Date();
    const rate = parseFloat(await getSetting('hourlyRate', 0));

    await addRecord({
      clockInTime: now.getTime(),
      clockInPhoto: null,
      hourlyRate: rate,
      timestamp: now.getTime()
    });

    await refreshDashboard();
    showToast('✅ 上班打卡成功！');
  } catch (err) {
    console.error('Punch in error:', err);
    showToast('打卡失败: ' + (err.message || err), 4000);
  }
}

async function handlePunchOut() {
  try {
    const activeRecord = await getActiveRecord();
    if (!activeRecord) {
      showToast('没有正在进行的上班记录');
      return;
    }

    const now = new Date();
    await updateRecord(activeRecord.id, {
      clockOutTime: now.getTime()
    });

    const elapsed = now.getTime() - new Date(activeRecord.clockInTime).getTime();
    await refreshDashboard();
    showToast(`✅ 下班打卡成功！工作时长 ${formatDuration(elapsed)}`);
  } catch (err) {
    console.error('Punch out error:', err);
    showToast('打卡失败: ' + (err.message || err), 4000);
  }
}

// ===== History =====

let historyRecords = [];

async function refreshHistory() {
  const months = await getDistinctMonths();
  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  if (!currentMonth || !months.includes(currentMonth)) {
    currentMonth = months.length > 0 ? months[0] : currentYM;
  }

  renderMonthFilter(months);
  await loadHistoryMonth(currentMonth);
}

function renderMonthFilter(months) {
  const container = document.getElementById('month-filter');
  if (months.length === 0) {
    container.innerHTML = `<span class="month-label">暂无记录</span>`;
    return;
  }

  const idx = months.indexOf(currentMonth);
  const prevMonth = idx < months.length - 1 ? months[idx + 1] : null;
  const nextMonth = idx > 0 ? months[idx - 1] : null;

  container.innerHTML = `
    <button ${prevMonth ? '' : 'disabled'} data-month="${prevMonth || ''}">◀</button>
    <span class="month-label">${formatMonthLabel(currentMonth)}</span>
    <button ${nextMonth ? '' : 'disabled'} data-month="${nextMonth || ''}">▶</button>
  `;

  container.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', async () => {
      const m = btn.dataset.month;
      if (m) {
        currentMonth = m;
        await loadHistoryMonth(m);
        renderMonthFilter(months);
      }
    });
  });
}

async function loadHistoryMonth(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  const records = await getRecordsByMonth(y, m);
  historyRecords = records;

  const container = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');

  if (records.length === 0) {
    container.innerHTML = '';
    empty.classList.add('show');
    return;
  }

  empty.classList.remove('show');

  const dailySummaries = calcDailySummaries(records);
  let html = '';

  for (const ds of dailySummaries) {
    html += `
      <div class="history-item">
        <div class="history-item-header">
          <span class="history-date">${formatDisplayDate(ds.date)}</span>
          <span class="history-duration">${formatDurationShort(ds.totalMs)} · ${formatCurrency(ds.earnings)}</span>
        </div>
        <div class="history-item-body">
          <div class="history-times">
    `;

    for (const r of ds.records) {
      const inTime = r.clockInTime ? formatTimeStr(new Date(r.clockInTime)) : '--';
      const outTime = r.clockOutTime ? formatTimeStr(new Date(r.clockOutTime)) : '未下班';
      const dur = r.clockOutTime ? formatDurationShort(calcDurationMs(r.clockInTime, r.clockOutTime)) : '进行中...';
      html += `<div>🟢 ${inTime} → 🔴 ${outTime}  (${dur})</div>`;
    }

    html += `</div><div class="history-photos">`;

    for (const r of ds.records) {
      if (r.clockInPhoto) {
        html += `<img class="history-thumb" src="${blobToUrl(r.clockInPhoto)}" data-record-id="${r.id}" data-photo-type="in" alt="上班照">`;
      }
      if (r.clockOutPhoto) {
        html += `<img class="history-thumb" src="${blobToUrl(r.clockOutPhoto)}" data-record-id="${r.id}" data-photo-type="out" alt="下班照">`;
      }
    }

    html += `
          </div>
        </div>
        <div style="text-align:right;margin-top:8px;">
    `;

    // Delete button for each record
    for (const r of ds.records) {
      html += `<button class="history-delete" data-delete-id="${r.id}">删除</button>`;
    }

    html += `</div></div>`;
  }

  container.innerHTML = html;

  // Bind photo click events
  container.querySelectorAll('.history-thumb').forEach(img => {
    img.addEventListener('click', () => {
      const recordId = parseInt(img.dataset.recordId);
      const photoType = img.dataset.photoType;
      const record = records.find(r => r.id === recordId);
      if (record) {
        const blob = photoType === 'in' ? record.clockInPhoto : record.clockOutPhoto;
        showPhoto(blob);
      }
    });
  });

  // Bind delete events
  container.querySelectorAll('.history-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.deleteId);
      const confirmed = await showConfirm('确认删除这条打卡记录？\n此操作不可撤销。');
      if (confirmed) {
        await deleteRecord(id);
        showToast('已删除');
        await loadHistoryMonth(currentMonth);
        // Refresh months list in case this was the last record of the month
        const months = await getDistinctMonths();
        renderMonthFilter(months);
      }
    });
  });
}

// ===== Summary =====

let currentPeriod = 'week';
let customStart = '';
let customEnd = '';

async function refreshSummary() {
  // Bind period selector
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.period === currentPeriod) btn.classList.add('active');

    btn.onclick = async () => {
      currentPeriod = btn.dataset.period;
      document.getElementById('custom-range').style.display = currentPeriod === 'custom' ? 'flex' : 'none';
      refreshSummary();
    };
  });

  // Custom range visibility
  document.getElementById('custom-range').style.display = currentPeriod === 'custom' ? 'flex' : 'none';

  // Get date range
  let startDate, endDate, periodLabel;
  const now = new Date();

  if (currentPeriod === 'week') {
    const range = getWeekRange(now);
    startDate = range.start;
    endDate = range.end;
    periodLabel = `本周 (${range.start} ~ ${range.end})`;
  } else if (currentPeriod === 'month') {
    const range = getCurrentMonthRange();
    startDate = range.start;
    endDate = range.end;
    periodLabel = `本月 (${range.start} ~ ${range.end})`;
  } else {
    startDate = document.getElementById('range-start').value || formatDateStr(now);
    endDate = document.getElementById('range-end').value || formatDateStr(now);
    periodLabel = `${startDate} ~ ${endDate}`;
  }

  const records = await getRecordsByDateRange(startDate, endDate);
  const stats = aggregateStats(records);

  // Render summary cards
  const cardsHtml = `
    <div class="summary-card">
      <div class="summary-card-value">${stats.workDays}</div>
      <div class="summary-card-label">工作天数</div>
    </div>
    <div class="summary-card">
      <div class="summary-card-value">${formatHoursDecimal(stats.totalMs)}h</div>
      <div class="summary-card-label">总工作时长</div>
    </div>
    <div class="summary-card">
      <div class="summary-card-value">${formatHoursDecimal(stats.avgMsPerDay)}h</div>
      <div class="summary-card-label">日均时长</div>
    </div>
    <div class="summary-card">
      <div class="summary-card-value earnings">${formatCurrency(stats.totalEarnings)}</div>
      <div class="summary-card-label">总收入</div>
    </div>
  `;
  document.getElementById('summary-cards').innerHTML = cardsHtml;

  // Render daily chart
  if (records.length > 0) {
    const dailySummaries = calcDailySummaries(records);
    const maxMs = Math.max(...dailySummaries.map(d => d.totalMs), 1);

    let chartHtml = '<div class="card"><div class="card-title">每日工时分布</div>';
    for (const ds of dailySummaries.slice(0, 14)) { // max 14 days
      const pct = Math.round((ds.totalMs / maxMs) * 100);
      chartHtml += `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:0.8rem;">
          <div style="width:60px;text-align:right;color:var(--color-text-secondary);">${ds.date.substring(5)}</div>
          <div style="flex:1;background:var(--color-separator);border-radius:4px;height:20px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:var(--color-primary);border-radius:4px;transition:width 0.3s;"></div>
          </div>
          <div style="width:70px;font-weight:600;">${formatDurationShort(ds.totalMs)}</div>
        </div>
      `;
    }
    chartHtml += '</div>';
    document.getElementById('summary-chart').innerHTML = chartHtml;
  } else {
    document.getElementById('summary-chart').innerHTML = '';
  }

  // Bind export button
  document.getElementById('export-btn').onclick = async () => {
    const confirmed = await showConfirm(
      `导出 ${periodLabel} 的考勤记录？\n\n选择"确认"导出 Excel (.xlsx)`
    );
    if (confirmed) {
      await exportToExcel(records, periodLabel);
    }
  };

  // Bind custom range inputs
  document.getElementById('range-start').onchange = () => {
    customStart = document.getElementById('range-start').value;
    refreshSummary();
  };
  document.getElementById('range-end').onchange = () => {
    customEnd = document.getElementById('range-end').value;
    refreshSummary();
  };

  // Initialize custom range inputs if empty
  if (!document.getElementById('range-start').value) {
    document.getElementById('range-start').value = formatDateStr(now);
  }
  if (!document.getElementById('range-end').value) {
    document.getElementById('range-end').value = formatDateStr(now);
  }
}

// ===== Settings =====

async function refreshSettings() {
  const name = await getSetting('name', '');
  const rate = await getSetting('hourlyRate', '');

  document.getElementById('setting-name').value = name;
  document.getElementById('setting-rate').value = rate;

  // Bind save events
  document.getElementById('setting-name').onchange = async (e) => {
    await setSetting('name', e.target.value.trim());
    showToast('名称已保存');
  };

  document.getElementById('setting-rate').onchange = async (e) => {
    const val = parseFloat(e.target.value);
    if (isNaN(val) || val < 0) {
      showToast('请输入有效的时薪');
      e.target.value = await getSetting('hourlyRate', '');
      return;
    }
    await setSetting('hourlyRate', val);
    showToast(`时薪已更新为 ¥${val.toFixed(2)}/小时`);
  };

  // Clear data button
  document.getElementById('btn-clear-data').onclick = async () => {
    const confirmed = await showConfirm('⚠️ 确认清除所有打卡数据？\n\n此操作不可撤销！\n建议先导出一份备份。');
    if (confirmed) {
      const doubleConfirm = await showConfirm('再次确认：所有数据将被永久删除\n\n确定继续吗？');
      if (doubleConfirm) {
        await clearAllData();
        showToast('所有数据已清除');
        refreshDashboard();
      }
    }
  };
}
