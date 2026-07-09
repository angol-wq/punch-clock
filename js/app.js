/**
 * App Entry Point
 * Initializes DB, registers service worker, sets up navigation and clock
 */

// ===== Clock Display (for dashboard status-time when idle) =====

let appClockInterval = null;

function updateAppClock() {
  const statusIndicator = document.getElementById('status-text');
  const statusTime = document.getElementById('status-time');

  // Only update clock if user is NOT currently clocked in (dashboard timer handles that case)
  // We check if the status text is '未上班' or '已下班'
  if (statusIndicator && (statusIndicator.textContent === '未上班' || statusIndicator.textContent === '已下班')) {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    statusTime.textContent = `${h}:${m}:${s}`;
  }
}

// ===== Navigation Setup =====

function setupNavigation() {
  // Bottom nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.nav;
      navigateTo(page);
    });
  });

  // Quick action buttons on dashboard
  document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.nav;
      navigateTo(page);
    });
  });

  // Modal backdrops - close on click
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', () => {
      backdrop.parentElement.classList.remove('show');
    });
  });
}

// ===== Service Worker =====

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.log('SW registration failed:', err));
  }
}

// ===== Init =====

async function initApp() {
  try {
    // Ensure Dexie DB is open before any operations
    if (typeof db !== 'undefined') {
      await db.open().catch(e => {
        console.warn('DB open warning (may be already open):', e.message);
      });
    }

    // Run migration if needed
    await migrateFromLocalStorage();

    // Recover from any interrupted camera operation (iOS page reload)
    await recoverPendingPhoto();

    // Set default settings if not exist
    const rate = await getSetting('hourlyRate');
    if (rate === null || rate === undefined) {
      await setSetting('hourlyRate', 0);
    }

    // Setup navigation
    setupNavigation();

    // Register service worker
    registerServiceWorker();

    // Load dashboard
    await refreshDashboard();

    // Start global clock
    updateAppClock();
    appClockInterval = setInterval(updateAppClock, 1000);

    // Handle page visibility changes - refresh dashboard when tab becomes visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && currentPage === 'dashboard') {
        refreshDashboard();
      }
    });

    console.log('✅ 私人打卡应用已就绪');
  } catch (err) {
    console.error('App init error:', err);
    showToast('应用初始化失败，请刷新页面');
  }
}

// ===== Start App =====
document.addEventListener('DOMContentLoaded', initApp);
