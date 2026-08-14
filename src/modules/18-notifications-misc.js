/* ===================== Task & Reminder Popup Notifications ===================== */
const _firedAlerts = new Set(); // track fired alerts within current minute

function checkRemindersAndTasks() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const currentTime = hh + ':' + mm;
  const currentDay = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const dayNames = ['日','一','二','三','四','五','六'];
  const isLastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() === now.getDate();
  const alertKey = now.getFullYear() + '-' + (now.getMonth()+1) + '-' + now.getDate() + ' ' + currentTime;

  const alerts = [];

  // Check reminders
  if (state.reminders && state.reminders.length > 0) {
    state.reminders.forEach(r => {
      if (!r.active) return;
      const key = 'reminder-' + r.id + '-' + alertKey;
      if (_firedAlerts.has(key)) return;

      const schedule = (r.schedule || '').trim();
      let shouldFire = false;

      // Pattern: 每天 HH:MM
      if (/^每天\s+(\d{1,2}):(\d{2})$/.test(schedule)) {
        const match = schedule.match(/^每天\s+(\d{1,2}):(\d{2})$/);
        shouldFire = (match[1].padStart(2,'0') + ':' + match[2]) === currentTime;
      }
      // Pattern: 每周X HH:MM
      else if (/^每周(日|一|二|三|四|五|六)\s+(\d{1,2}):(\d{2})$/.test(schedule)) {
        const match = schedule.match(/^每周(日|一|二|三|四|五|六)\s+(\d{1,2}):(\d{2})$/);
        const targetDay = dayNames.indexOf(match[1]);
        const targetTime = match[2].padStart(2,'0') + ':' + match[3];
        shouldFire = currentDay === targetDay && targetTime === currentTime;
      }
      // Pattern: 每月最后一天 (optionally with HH:MM)
      else if (/^每月最后一天/.test(schedule)) {
        const timeMatch = schedule.match(/(\d{1,2}):(\d{2})$/);
        const targetTime = timeMatch ? timeMatch[1].padStart(2,'0') + ':' + timeMatch[2] : '09:00';
        shouldFire = isLastDayOfMonth && targetTime === currentTime;
      }
      // Pattern: 每天 HH点MM分 or 每天HH点
      else if (/^每天\s*(\d{1,2})点(\d{1,2})?$/.test(schedule)) {
        const match = schedule.match(/^每天\s*(\d{1,2})点(\d{1,2})?$/);
        const t = match[1].padStart(2,'0') + ':' + (match[2] || '0').padStart(2,'0');
        shouldFire = t === currentTime;
      }

      if (shouldFire) {
        _firedAlerts.add(key);
        alerts.push({ type: 'reminder', title: '🔔 提醒：' + r.name, desc: r.desc || r.schedule, id: r.id });
      }
    });
  }

  // Check tasks (uncompleted tasks whose time matches current time)
  if (state.tasks && state.tasks.length > 0) {
    state.tasks.forEach(t => {
      if (t.completed) return;
      if (!t.time) return;
      const key = 'task-' + t.id + '-' + alertKey;
      if (_firedAlerts.has(key)) return;

      const taskTime = new Date(t.time);
      const taskHH = String(taskTime.getHours()).padStart(2, '0');
      const taskMM = String(taskTime.getMinutes()).padStart(2, '0');
      const taskTimeStr = taskHH + ':' + taskMM;

      // Fire on the exact date and time
      const taskDateStr = taskTime.getFullYear() + '-' + (taskTime.getMonth()+1) + '-' + taskTime.getDate();
      const nowDateStr = now.getFullYear() + '-' + (now.getMonth()+1) + '-' + now.getDate();
      if (taskDateStr === nowDateStr && taskTimeStr === currentTime) {
        _firedAlerts.add(key);
        const tags = [];
        if (t.important) tags.push('🔴 重要');
        if (t.urgent) tags.push('🟠 紧急');
        alerts.push({ type: 'task', title: '📋 任务提醒：' + t.name, desc: (t.desc || '') + (tags.length ? ' | ' + tags.join(' ') : '') + (t.resp ? ' | 负责人：' + t.resp : ''), id: t.id });
      }
    });
  }

  // Clean up old fired alerts (截断 + 每小时清理过期条目)
  if (_firedAlerts.size > 200) {
    const arr = [..._firedAlerts];
    _firedAlerts.clear();
    arr.slice(-100).forEach(function(k) { _firedAlerts.add(k); });
  }
  // 每小时清理超过 1 小时未触发的条目
  if (!_firedAlerts._lastHourClean || Date.now() - _firedAlerts._lastHourClean > 3600000) {
    _firedAlerts._lastHourClean = Date.now();
    const hourAgo = Date.now() - 3600000;
    _firedAlerts.forEach(function(k) {
      const ts = parseInt(k.split('-').pop());
      if (!isNaN(ts) && ts < hourAgo) _firedAlerts.delete(k);
    });
  }

  // Show popup for first alert (avoid multiple modals)
  if (alerts.length > 0) {
    showReminderPopup(alerts);
  }
}

let _pendingAlerts = null;

function showReminderPopup(alerts) {
  _pendingAlerts = alerts;
  // Also try browser notification
  if ('Notification' in window && Notification.permission === 'granted') {
    const first = alerts[0];
    new Notification(first.title, { body: first.desc, icon: document.querySelector('link[rel="icon"]')?.href || '' });
  }

  // Show in-app popup modal
  const alertHtml = alerts.map(a => `
    <div style="padding:14px;background:var(--primary-lightest);border-radius:var(--radius);margin-bottom:10px;border-left:4px solid var(--primary)">
      <div style="font-weight:700;font-size:15px;color:var(--primary-darker)">${escapeHtml(a.title)}</div>
      <div style="font-size:13px;color:var(--text-body);margin-top:4px">${escapeHtml(a.desc)}</div>
    </div>
  `).join('');

  openModal(`
    <div style="text-align:center;margin-bottom:16px">
      <span style="font-size:40px">⏰</span>
      <h3 style="margin-top:8px">定时提醒</h3>
      <p style="font-size:12px;color:var(--text-muted)">${new Date().toLocaleString('zh-CN')}</p>
    </div>
    ${alertHtml}
    <div class="modal-actions">
      <button class="btn btn-outline" data-click="snoozeAlert" data-click-args="[10]">稍后提醒（10分钟）</button>
      <button class="btn btn-primary" data-click="closeModal">知道了</button>
    </div>
  `);

  // Play a sound (beep)
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch(e) { /* AudioContext may not be available in all environments */ }
}

function snoozeAlert(minutes) {
  const alerts = _pendingAlerts;
  if (!alerts) return;
  closeModal();
  showToast('已设置' + minutes + '分钟后再次提醒');
  setTimeout(() => {
    showReminderPopup(alerts);
  }, minutes * 60000);
}

/* ===================== Standalone HTML Generation ===================== */
function generateStandaloneHTML() {
  // Page is self-contained (CSS+JS inline), so outerHTML has everything
  return '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
}

/* ===================== 屏幕刘海手动切换（模块级，供 _exportMap/__CLICK 引用） ===================== */
function toggleNotch() {
  let notchOn = true;
  try { const v = localStorage.getItem('notchEnabled'); if (v !== null) notchOn = v === '1'; } catch(e) {}
  const newVal = !notchOn;
  try { localStorage.setItem('notchEnabled', newVal ? '1' : '0'); } catch(e) {}
  const tip = newVal ? '已开启屏幕刘海适配（28px 安全区），刷新后生效。' : '已关闭屏幕刘海适配，刷新后生效。';
  openModal(
    '<div style="text-align:center;padding:20px;font-size:16px">'+tip+'</div>'+
    '<div style="text-align:center;margin-top:12px"><button class="btn btn-primary" data-click="closeActiveAndRefresh">立即刷新</button></div>',
    { title: (newVal ? '📱' : '🚫')+' 屏幕刘海', width: '340px' }
  );
}
function closeActiveAndRefresh() { closeModal(); setTimeout(function(){ location.reload(); }, 200); }

