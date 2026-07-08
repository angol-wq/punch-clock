/**
 * Export Module
 * Exports work records as Excel (.xlsx) or CSV files using SheetJS
 */

/**
 * Export records as Excel file with multiple sheets
 */
async function exportToExcel(records, periodLabel = '') {
  if (!records || records.length === 0) {
    showToast('没有可导出的记录');
    return;
  }

  // Sort records by date and time
  const sorted = [...records].sort((a, b) => {
    const dateCmp = (a.date || '').localeCompare(b.date || '');
    if (dateCmp !== 0) return dateCmp;
    return (a.clockInTime || 0) - (b.clockInTime || 0);
  });

  // Sheet 1: 打卡明细
  const detailHeaders = ['日期', '上班时间', '下班时间', '工作时长', '时薪(元)', '工资(元)', '备注'];
  const detailRows = [detailHeaders];

  for (const r of sorted) {
    const ms = calcDurationMs(r.clockInTime, r.clockOutTime);
    detailRows.push([
      formatDisplayDate(r.date || formatDateStr(new Date(r.clockInTime))),
      r.clockInTime ? formatTimeStr(new Date(r.clockInTime)) : '',
      r.clockOutTime ? formatTimeStr(new Date(r.clockOutTime)) : '未下班',
      ms > 0 ? formatDurationShort(ms) : '-',
      (r.hourlyRate || 0).toFixed(2),
      ms > 0 ? calcEarnings(ms, r.hourlyRate || 0).toFixed(2) : '-',
      r.notes || ''
    ]);
  }

  // Sheet 2: 每日汇总
  const dailySummaries = calcDailySummaries(sorted);
  const summaryHeaders = ['日期', '工作次数', '总时长', '时薪(元)', '日收入(元)'];
  const summaryRows = [summaryHeaders];

  let grandTotalMs = 0;
  let grandTotalEarnings = 0;

  for (const ds of dailySummaries) {
    const avgRate = ds.records[0]?.hourlyRate || 0;
    summaryRows.push([
      formatDisplayDate(ds.date),
      ds.records.length,
      formatDurationShort(ds.totalMs),
      avgRate.toFixed(2),
      ds.earnings.toFixed(2)
    ]);
    grandTotalMs += ds.totalMs;
    grandTotalEarnings += ds.earnings;
  }

  // Add grand total row
  summaryRows.push([
    '合计', dailySummaries.length + '天', formatDurationShort(grandTotalMs),
    '', grandTotalEarnings.toFixed(2)
  ]);

  // Sheet 3: 月度汇总
  const monthlyMap = {};
  for (const ds of dailySummaries) {
    const month = ds.date.substring(0, 7);
    if (!monthlyMap[month]) monthlyMap[month] = { days: 0, totalMs: 0, earnings: 0 };
    monthlyMap[month].days++;
    monthlyMap[month].totalMs += ds.totalMs;
    monthlyMap[month].earnings += ds.earnings;
  }

  const monthlyHeaders = ['月份', '工作天数', '总时长', '总收入(元)'];
  const monthlyRows = [monthlyHeaders];

  const sortedMonths = Object.keys(monthlyMap).sort();
  for (const month of sortedMonths) {
    const m = monthlyMap[month];
    monthlyRows.push([
      formatMonthLabel(month),
      m.days + '天',
      formatDurationShort(m.totalMs),
      m.earnings.toFixed(2)
    ]);
  }

  // Create workbook
  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.aoa_to_sheet(detailRows);
  ws1['!cols'] = [
    { wch: 18 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 20 }
  ];
  XLSX.utils.book_append_sheet(wb, ws1, '打卡明细');

  const ws2 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws2['!cols'] = [
    { wch: 18 }, { wch: 10 }, { wch: 12 },
    { wch: 10 }, { wch: 14 }
  ];
  XLSX.utils.book_append_sheet(wb, ws2, '每日汇总');

  const ws3 = XLSX.utils.aoa_to_sheet(monthlyRows);
  ws3['!cols'] = [
    { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 14 }
  ];
  XLSX.utils.book_append_sheet(wb, ws3, '月度汇总');

  // Generate filename
  const now = new Date();
  const filename = periodLabel
    ? `考勤记录_${periodLabel}.xlsx`
    : `考勤记录_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.xlsx`;

  XLSX.writeFile(wb, filename);
  showToast('导出成功！');
}

/**
 * Export records as CSV file
 */
async function exportToCSV(records) {
  if (!records || records.length === 0) {
    showToast('没有可导出的记录');
    return;
  }

  const sorted = [...records].sort((a, b) => {
    const dateCmp = (a.date || '').localeCompare(b.date || '');
    if (dateCmp !== 0) return dateCmp;
    return (a.clockInTime || 0) - (b.clockInTime || 0);
  });

  // BOM for Excel UTF-8 compatibility
  let csv = '﻿日期,上班时间,下班时间,工作时长,时薪,工资,备注\n';

  for (const r of sorted) {
    const ms = calcDurationMs(r.clockInTime, r.clockOutTime);
    csv += [
      r.date || '',
      r.clockInTime ? formatTimeStr(new Date(r.clockInTime)) : '',
      r.clockOutTime ? formatTimeStr(new Date(r.clockOutTime)) : '',
      ms > 0 ? formatDurationShort(ms) : '',
      r.hourlyRate || 0,
      ms > 0 ? calcEarnings(ms, r.hourlyRate || 0).toFixed(2) : '',
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ].join(',') + '\n';
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const now = new Date();
  a.download = `考勤记录_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('CSV 导出成功！');
}
