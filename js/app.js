/**
 * ============================================================
 * VERTANODE DASHBOARD — BLYNK DIRECT APP.JS
 * ============================================================
 */

// ─── Konfigurasi Koneksi BLYNK ────────────────────────────────
const BLYNK_TOKEN = 'T6246EZVfOGTHvOLriVY7J6kBwF0O1bg';
const BLYNK_BASE_URL = 'https://blynk.cloud/external/api';

const POLL_INTERVAL = 2000;
const CHART_MAX_POINTS = 30;

// ─── State lokal ──────────────────────────────────────────────
let isOnline = false;
let currentMode = 'auto';
let currentSettings = { tempTarget: 28, humTarget: 70, soilMin: 40, lightMin: 400 };

// ─── Setup Log List Internal ──────────────────────────────────
let activityLog = [];
let logIdCounter = 1;

function addLogInternal(source, message, type = 'info') {
  const time = new Date().toLocaleTimeString('id-ID', { hour12: false });
  activityLog.unshift({ id: logIdCounter++, time, source, message, type });
  if (activityLog.length > 50) activityLog.pop();
  renderLogs();
}

// ─── Chart.js Setup ───────────────────────────────────────────
const chartCtx = document.getElementById('envChart').getContext('2d');
const chartLabels = [];
const chartTempData = [];
const chartHumData = [];

const envChart = new Chart(chartCtx, {
  type: 'line',
  data: {
    labels: chartLabels,
    datasets: [
      {
        label: 'Suhu (°C)',
        data: chartTempData,
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        borderWidth: 2,
        pointRadius: 2,
        fill: true,
        yAxisID: 'yTemp',
      },
      {
        label: 'Kelembapan Udara (%)',
        data: chartHumData,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.06)',
        borderWidth: 2,
        pointRadius: 2,
        fill: true,
        yAxisID: 'yHum',
      },
    ],
  },
  options: {
    animation: { duration: 400 },
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: '#475569', font: { family: 'Inter', size: 11 } } },
      tooltip: { titleFont: { family: 'Inter' } },
    },
    scales: {
      x: { ticks: { color: '#94a3b8', font: { size: 9 }, maxTicksLimit: 8 }, grid: { color: 'rgba(0,0,0,0.04)' } },
      yTemp: { type: 'linear', position: 'left', min: 20, max: 40, ticks: { color: '#f59e0b', callback: v => v + '°C' } },
      yHum: { type: 'linear', position: 'right', min: 20, max: 100, ticks: { color: '#06b6d4', callback: v => v + '%' } },
    },
  },
});

function updateChart(temperature, humidity) {
  const now = new Date().toLocaleTimeString('id-ID', { hour12: false });
  chartLabels.push(now);
  chartTempData.push(parseFloat(temperature.toFixed(1)));
  chartHumData.push(parseFloat(humidity.toFixed(1)));

  if (chartLabels.length > CHART_MAX_POINTS) {
    chartLabels.shift(); chartTempData.shift(); chartHumData.shift();
  }
  envChart.update('none'); 
}

// ─── Update UI Cards ──────────────────────────────────────────
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function updateSensorCard(id, value, unit, barPercent, barColor, labelText, isCritical) {
  const valEl = document.getElementById(`val-${id}`);
  if (valEl) { valEl.textContent = unit === 'lux' ? Math.round(value) : value.toFixed(1); valEl.style.color = barColor; }
  const barEl = document.getElementById(`bar-${id}`);
  if (barEl) { barEl.style.width = clamp(barPercent, 0, 100) + '%'; barEl.style.background = barColor; }
  const labelEl = document.getElementById(`label-${id}`);
  if (labelEl) { labelEl.textContent = labelText; labelEl.style.color = barColor; }
  const card = document.getElementById(`card-${id}`);
  if (card) { card.classList.toggle('critical', isCritical); }
}

function renderSensorsUi(data) {
  const { temperature, humidity, soilMoisture, light } = data;
  const { tempTarget, humTarget, soilMin, lightMin } = currentSettings;

  const tempPercent = ((temperature - 22) / (38 - 22)) * 100;
  let tempColor = '#10b981', tempLabel = 'Optimal', tempCritical = false;
  if (temperature > tempTarget + 3) { tempColor = '#ef4444'; tempLabel = 'Terlalu Tinggi'; tempCritical = true; }
  updateSensorCard('temperature', temperature, '°C', tempPercent, tempColor, tempLabel, tempCritical);

  const humPercent = humidity;
  let humColor = '#06b6d4', humLabel = 'Optimal', humCritical = false;
  if (humidity > 90 || humidity < 40) { humColor = '#ef4444'; humLabel = 'Berbahaya'; humCritical = true; }
  updateSensorCard('humidity', humidity, '%', humPercent, humColor, humLabel, humCritical);

  let soilColor = '#10b981', soilLabel = 'Optimal', soilCritical = false;
  if (soilMoisture < soilMin) { soilColor = '#ef4444'; soilLabel = 'Kekeringan Ekstrem'; soilCritical = true; }
  updateSensorCard('soil', soilMoisture, '%', soilMoisture, soilColor, soilLabel, soilCritical);

  let lightColor = '#eab308', lightLabel = 'Cahaya Cukup', lightCritical = false;
  if (light < lightMin) { lightColor = '#ef4444'; lightLabel = 'Ruangan Gelap'; lightCritical = true; }
  updateSensorCard('light', light, 'lux', (light/1000)*100, lightColor, lightLabel, lightCritical);
}

function renderActuatorsUi(data) {
  const list = [
    { id: 'pump', val: data.pump },
    { id: 'light', val: data.light },
    { id: 'fan', val: data.fan },
  ];
  list.forEach(act => {
    const isActOn = (act.val === 1);
    const badge = document.getElementById(`badge-${act.id}`);
    if (badge) {
      badge.textContent = isActOn ? 'AKTIF' : 'STANDBY';
      badge.className = 'status-badge' + (isActOn ? ' active' : '');
    }
    const card = document.getElementById(`actuator-${act.id}`);
    if (card) card.classList.toggle('active-card', isActOn);
    
    const toggle = document.getElementById(`toggle-${act.id}`);
    if (toggle) {
      toggle.checked = isActOn;
      toggle.disabled = (currentMode === 'auto');
    }
  });
}

function renderLogs() {
  const logList = document.getElementById('log-list');
  if (!logList) return;
  logList.innerHTML = '';
  activityLog.forEach(log => {
    const typeClass = `log-${log.type}`;
    logList.innerHTML += `
      <div class="log-entry ${typeClass}">
        <span class="log-time">${log.time}</span>
        <span class="log-source">${log.source}</span>
        <span class="log-msg">${log.message}</span>
      </div>`;
  });
}

// ─── Komunikasi ke Blynk ──────────────────────────────────────
async function blynkGet(pin) {
  const res = await fetch(`${BLYNK_BASE_URL}/get?token=${BLYNK_TOKEN}&${pin}`);
  const data = await res.json();
  return Array.isArray(data) ? parseFloat(data[0]) : data;
}

async function blynkUpdate(pin, value) {
  await fetch(`${BLYNK_BASE_URL}/update?token=${BLYNK_TOKEN}&${pin}=${value}`);
}

async function fetchFromBlynk() {
  try {
    const temp = await blynkGet('v0') || 0;
    const hum = await blynkGet('v1') || 0;
    const soil = await blynkGet('v2') || 0;
    const light = await blynkGet('v3') || 0;
    
    const pumpVal = await blynkGet('v4') || 0;
    const lightVal = await blynkGet('v5') || 0;
    const fanVal = await blynkGet('v6') || 0;
    const modeVal = await blynkGet('v7') || 0; 
    
    setConnectionStatus(true);
    
    currentMode = (modeVal === 1) ? 'manual' : 'auto';
    const modeToggle = document.getElementById('mode-toggle');
    if (modeToggle) modeToggle.checked = (currentMode === 'manual');

    renderSensorsUi({ temperature: temp, humidity: hum, soilMoisture: soil, light: light });
    updateChart(temp, hum);
    renderActuatorsUi({ pump: pumpVal, light: lightVal, fan: fanVal });

    document.getElementById('last-update').textContent = `Sinkronisasi Blynk: ${new Date().toLocaleTimeString('id-ID')}`;

  } catch (err) {
    setConnectionStatus(false);
  }
}

function setConnectionStatus(online) {
  const badge = document.getElementById('connection-badge');
  const text  = document.getElementById('connection-text');
  if (online) {
    badge.className = 'badge badge-online'; text.textContent = 'ONLINE (Blynk)';
  } else {
    badge.className = 'badge badge-offline'; text.textContent = 'TERPUTUS';
  }
  isOnline = online;
}

// ─── Kontrol Web -> Mengirim balik ke Blynk ───────────────────
window.toggleMode = async function() {
  const toggle = document.getElementById('mode-toggle');
  const newMode = toggle.checked ? 1 : 0; 
  try {
    await blynkUpdate('v7', newMode);
    currentMode = toggle.checked ? 'manual' : 'auto';
    addLogInternal('SISTEM', `Sistem beralih ke Mode ${currentMode.toUpperCase()}`, 'info');
    showToast(`Mode berubah menjadi: ${currentMode.toUpperCase()}`, 'info');
    fetchFromBlynk();
  } catch(e) {
    toggle.checked = !toggle.checked;
    showToast('Gagal menyambung ke satelit server.', 'error');
  }
};

window.manualToggle = async function(id, status) {
  if (currentMode === 'auto') {
    showToast('Silakan beralih ke Mode Manual terlebih dahulu.', 'error');
    document.getElementById(`toggle-${id}`).checked = !status;
    return;
  }
  let pin = (id === 'pump') ? 'v4' : (id === 'light' ? 'v5' : 'v6');
  const val = status ? 1 : 0;
  try {
    await blynkUpdate(pin, val);
    addLogInternal('MANUAL', `Aktuator ${id.toUpperCase()} dipaksa ${status ? 'AKTIF' : 'MATI'} dari Web.`, 'warning');
    showToast(`Perintah ${id} di-${status?'aktifkan':'matikan'} berhasil.`, 'success');
  } catch(e) {
    showToast('Koneksi terputus ke alat Blynk.', 'error');
    document.getElementById(`toggle-${id}`).checked = !status;
  }
};

window.applySettings = function() {
  currentSettings.tempTarget = parseFloat(document.getElementById('slider-tempTarget').value);
  currentSettings.soilMin = parseFloat(document.getElementById('slider-soilMin').value);
  showToast('Konfigurasi server berhasil diperbarui', 'success');
  addLogInternal('CONFIG', 'Batas ukur baru ditetapkan.', 'info');
};

window.resetSettings = function() {
  document.getElementById('slider-tempTarget').value = 28;
  document.getElementById('slider-soilMin').value = 40;
  applySettings();
};

window.clearLog = function() {
  activityLog = [];
  addLogInternal('SYSTEM', 'Sistem log direset pengguna.');
};

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if(!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ─── Mulai ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  addLogInternal('SYSTEM', 'Mengkoneksikan Node ke Verta-Cloud...');
  setInterval(fetchFromBlynk, POLL_INTERVAL);
  fetchFromBlynk();
});
