// ===== 密码哈希：SHA-256 (Web Crypto API) + 向后兼容旧版 djb2 =====
const PWD_SALT = 'pdx_wb_2025_salt';

// 异步 SHA-256 哈希（推荐，加密级别）
async function hashPasswordAsync(pwd) {
  const str = PWD_SALT + pwd + PWD_SALT;
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return 's' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 旧版 djb2 同步哈希（仅用于向后兼容验证旧密码）
function hashPasswordLegacy(pwd) {
  const str = PWD_SALT + pwd + PWD_SALT;
  let hash1 = 5381, hash2 = 52711;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash1 = ((hash1 << 5) + hash1) ^ c;
    hash2 = ((hash2 * 33) ^ c) >>> 0;
  }
  return 'h' + (hash1 >>> 0).toString(36) + (hash2).toString(36);
}

// 同步兼容包装：优先使用异步 SHA-256，但在无法 await 的上下文用旧版降级
// 新密码一律用 SHA-256（异步），验证时自动检测哈希前缀做兼容
function hashPassword(pwd) {
  // 同步降级：仅在 crypto.subtle 不可用时使用
  // 注意：新密码在 setPassword/changePassword 中通过 hashPasswordAsync 设置（前缀 's'）
  // 旧密码仍为 'h' 前缀，验证时自动识别
  return hashPasswordLegacy(pwd);
}

// 密码验证（异步，支持新旧哈希）
async function verifyPasswordHash(pwd, storedHash) {
  if (!storedHash) return false;
  if (storedHash.startsWith('s')) {
    // SHA-256 哈希
    const newHash = await hashPasswordAsync(pwd);
    return newHash === storedHash;
  } else {
    // 旧版 djb2 哈希（前缀 'h'），同步验证
    return hashPasswordLegacy(pwd) === storedHash;
  }
}

/* Teacher message encryption (XOR + Base64, prevents casual localStorage inspection) */
const CHAT_ENC_KEY = 'pdx_chat_2025_enc';
function encryptText(text) {
  if (!text) return text;
  try {
    const utf8 = unescape(encodeURIComponent(text));
    let result = '';
    for (let i = 0; i < utf8.length; i++) {
      result += String.fromCharCode(utf8.charCodeAt(i) ^ CHAT_ENC_KEY.charCodeAt(i % CHAT_ENC_KEY.length));
    }
    return 'enc:' + btoa(result);
  } catch(e) { return text; }
}
function decryptText(text) {
  if (!text || typeof text !== 'string' || !text.startsWith('enc:')) return text;
  try {
    const decoded = atob(text.slice(4));
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ CHAT_ENC_KEY.charCodeAt(i % CHAT_ENC_KEY.length));
    }
    return decodeURIComponent(escape(result));
  } catch(e) { return text; }
}

function openPasswordModal(pendingPage) {
  if (!state.appPassword) {
    // First time: set password + security question
    openModal(`
      <h3>🔒 设置访问密码</h3>
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
        首次使用，请设置访问密码和密保问题。「学生工作任务」板块免密使用；其他板块需密码验证，15分钟无操作后加密模块自动锁定，保护学生隐私数据。
      </p>
      <div class="form-group">
        <label class="form-label">设置密码 *</label>
        <input type="password" class="form-input" id="pwdSet1" placeholder="输入密码（至少4位）..." data-ev="keypress" data-ev-key="ev4">
      </div>
      <div class="form-group">
        <label class="form-label">确认密码 *</label>
        <input type="password" class="form-input" id="pwdSet2" placeholder="再次输入密码..." data-ev="keypress" data-ev-key="ev5">
      </div>
      <div style="height:1px;background:var(--border-light);margin:16px 0"></div>
      <div class="form-group">
        <label class="form-label">密保问题 *</label>
        <select class="form-select" id="secQuestion">
          <option value="">请选择密保问题</option>
          <option value="出生城市">您的出生城市是？</option>
          <option value="第一只宠物">您的第一只宠物的名字是？</option>
          <option value="母亲生日">您母亲的生日是几月几号？</option>
          <option value="最喜欢的科目">您最喜欢的科目是？</option>
          <option value="初中班主任">您的初中班主任姓什么？</option>
          <option value="小学名称">您的小学叫什么名字？</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">密保答案 *</label>
        <input type="text" class="form-input" id="secAnswer" placeholder="输入密保答案..." data-ev="keypress" data-ev-key="ev6" data-ev-args="${escapeAttr(JSON.stringify([pendingPage]))}">
      </div>
      <div class="modal-actions">
        <button class="btn btn-outline" data-click="closeModal">取消</button>
        <button class="btn btn-primary" data-click="confirmSetPassword" data-click-args="[&quot;${pendingPage}&quot;]">确认设置</button>
      </div>
    `);
  } else {
    openModal(`
      <h3>🔒 密码验证</h3>
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
        请输入密码以访问「${PAGE_TITLES[pendingPage] || pendingPage}」
      </p>
      <div class="form-group">
        <input type="password" class="form-input" id="pwdInput" placeholder="输入密码..." data-ev="keypress" data-ev-key="ev7" data-ev-args="${escapeAttr(JSON.stringify([pendingPage]))}">
      </div>
      <div class="modal-actions">
        <button class="btn btn-outline" data-click="closeModal">取消</button>
        <button class="btn btn-primary" data-click="verifyPassword" data-click-args="[&quot;${pendingPage}&quot;]">验证</button>
      </div>
      <div style="text-align:center;margin-top:12px">
        <a href="#" data-click="resetPassword" style="font-size:12px;color:var(--text-muted);text-decoration:underline">忘记密码？点击重置</a>
      </div>
    `);
    setTimeout(() => { const el = document.getElementById('pwdInput'); if (el) el.focus(); }, 100);
  }
}

async function confirmSetPassword(pendingPage) {
  const p1 = document.getElementById('pwdSet1').value;
  const p2 = document.getElementById('pwdSet2').value;
  const secQ = document.getElementById('secQuestion').value;
  const secA = document.getElementById('secAnswer').value.trim();
  if (!p1) { showToast('请输入密码', 'warn'); return; }
  if (p1 !== p2) { showToast('两次密码不一致', 'error'); return; }
  if (p1.length < 4) { showToast('密码至少4位', 'warn'); return; }
  if (!secQ) { showToast('请选择密保问题', 'warn'); return; }
  if (!secA) { showToast('请输入密保答案', 'warn'); return; }
  state.appPassword = await hashPasswordAsync(p1);
  state.securityQuestion = secQ;
  state.securityAnswer = await hashPasswordAsync(secA.toLowerCase());
  state.passwordUnlocked = true;
  saveState();
  closeModal();
  showToast('密码和密保设置成功，已解锁');
  renderPwdStatusBar();
  navigateTo(pendingPage);
}

async function verifyPassword(pendingPage) {
  const pwd = document.getElementById('pwdInput').value;
  if (await verifyPasswordHash(pwd, state.appPassword)) {
    state.passwordUnlocked = true;
    saveState();
    closeModal();
    renderPwdStatusBar();
    navigateTo(pendingPage);
  } else {
    showToast('密码错误', 'error');
  }
}

function resetPassword() {
  if (!state.securityQuestion) {
    // 没有密保问题（旧数据兼容），允许直接重置
    openModal(`
      <h3>⚠️ 重置密码</h3>
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
        当前账号未设置密保问题，可直接重置密码。重置后请重新设置密码和密保。
      </p>
      <div class="modal-actions">
        <button class="btn btn-outline" data-click="closeModal">取消</button>
        <button class="btn btn-primary" style="background:var(--danger)" data-click="confirmResetPassword">确认重置</button>
      </div>
    `);
    return;
  }
  openModal(`
    <h3>🔑 密保验证</h3>
    <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
      请回答密保问题以重置密码
    </p>
    <div style="padding:12px;background:var(--primary-lightest);border-radius:var(--radius-sm);margin-bottom:16px">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">密保问题：</div>
      <div style="font-size:15px;font-weight:600">${escapeHtml(state.securityQuestion)}</div>
    </div>
    <div class="form-group">
      <label class="form-label">密保答案</label>
      <input type="text" class="form-input" id="resetSecAnswer" placeholder="输入密保答案..." data-ev="keypress" data-ev-key="ev8">
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" data-click="closeModal">取消</button>
      <button class="btn btn-primary" data-click="verifySecurityAnswer">验证</button>
    </div>
  `);
  setTimeout(() => { const el = document.getElementById('resetSecAnswer'); if (el) el.focus(); }, 100);
}

async function verifySecurityAnswer() {
  const answer = document.getElementById('resetSecAnswer').value.trim().toLowerCase();
  if (await verifyPasswordHash(answer, state.securityAnswer)) {
    confirmResetPassword();
  } else {
    showToast('密保答案错误', 'error');
  }
}

function confirmResetPassword() {
  state.appPassword = '';
  state.passwordUnlocked = false;
  state.securityQuestion = '';
  state.securityAnswer = '';
  saveState();
  closeModal();
  renderPwdStatusBar();
  showToast('密码已重置，请重新设置密码和密保');
  setTimeout(() => openPasswordModal(state.currentPage || 'tasks'), 500);
}

function lockApp() {
  state.passwordUnlocked = false;
  saveState();
  showToast('已锁定加密模块');
  renderPwdStatusBar();
  // 锁定后回到免密的学生工作任务页，保证学生任务模块始终可用
  if (!PASSWORD_EXEMPT_PAGES.includes(state.currentPage)) {
    navigateTo('st-task-info');
  }
}

/* Auto Lock System: 15分钟无操作后仅锁定加密模块，学生工作任务免密 */
let autoLockTimer = null;
let autoLockWarningTimer = null;

function resetAutoLockTimer() {
  if (autoLockTimer) clearTimeout(autoLockTimer);
  if (autoLockWarningTimer) clearTimeout(autoLockWarningTimer);
  if (!state.appPassword || !state.passwordUnlocked) return;
  // Warning 3 minutes before lock (when >= 5 min; here 15-3=12 min)
  autoLockWarningTimer = setTimeout(() => {
    showToast('3分钟后将自动锁定加密模块，请及时保存', 'warn');
  }, (AUTO_LOCK_MINUTES - 3) * 60 * 1000);
  // Auto lock: only lock encrypted modules, st-task pages stay usable
  autoLockTimer = setTimeout(() => {
    state.passwordUnlocked = false;
    saveState();
    showToast('加密模块已自动锁定', 'warn');
    renderPwdStatusBar();
    if (!PASSWORD_EXEMPT_PAGES.includes(state.currentPage)) {
      navigateTo('st-task-info');
    }
  }, AUTO_LOCK_MINUTES * 60 * 1000);
}

function showLockOverlay() {
  // Kept for backward compatibility / manual lock overlay use.
  state.passwordUnlocked = false;
  saveState();
  const overlay = document.createElement('div');
  overlay.className = 'lock-overlay';
  overlay.id = 'lockOverlay';
  overlay.innerHTML = `
    <div class="lock-icon">🔒</div>
    <div class="lock-title">加密模块已锁定</div>
    <div class="lock-desc">超过 ${AUTO_LOCK_MINUTES} 分钟未操作，加密模块已自动锁定。请输入密码重新访问。</div>
    <input type="password" class="lock-input" id="lockPwdInput" placeholder="输入密码..." data-ev="keypress" data-ev-key="ev9">
    <button class="lock-btn" data-click="unlockFromOverlay">🔓 解锁</button>
    <div class="lock-timer" id="lockTimer"></div>
    <div style="margin-top:12px;font-size:12px;color:var(--text-muted)">「学生工作任务」模块无需密码，可继续操作</div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => { const el = document.getElementById('lockPwdInput'); if (el) el.focus(); }, 100);
  renderPwdStatusBar();
}

async function unlockFromOverlay() {
  const pwd = document.getElementById('lockPwdInput')?.value;
  if (await verifyPasswordHash(pwd, state.appPassword)) {
    state.passwordUnlocked = true;
    saveState();
    const overlay = document.getElementById('lockOverlay');
    if (overlay) overlay.remove();
    resetAutoLockTimer();
    renderPwdStatusBar();
    showToast('已解锁');
  } else {
    showToast('密码错误', 'error');
  }
}

function renderPwdStatusBar() {
  const el = document.getElementById('pwdStatusBar');
  if (!el) return;
  if (!state.appPassword) {
    el.innerHTML = '<button class="btn-icon" title="设置访问密码（启用15分钟自动锁定加密模块）" data-click="openPasswordModal" data-click-args="' + escapeAttr(JSON.stringify([state.currentPage||'tasks'])) + '" style="color:var(--warning);font-weight:600">🔒 设置密码</button>';
    return;
  }
  if (state.passwordUnlocked) {
    el.innerHTML = `
      <button class="btn-icon" title="修改密码" data-click="changeAppPassword">🔑</button>
      <button class="btn-icon" title="锁定" data-click="lockApp">🔒</button>
    `;
  } else {
    el.innerHTML = `<span style="font-size:12px;color:var(--text-muted);font-weight:500">🔒 已锁定</span>`;
  }
}

function changeAppPassword() {
  if (!state.appPassword) { openPasswordModal('tasks'); return; }
  if (!state.passwordUnlocked) {
    // Need to verify password first
    openModal(`
      <h3>🔒 密码验证</h3>
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">请输入当前密码以修改密码</p>
      <div class="form-group">
        <input type="password" class="form-input" id="changePwdVerify" placeholder="输入当前密码..." data-ev="keypress" data-ev-key="ev10">
      </div>
      <div class="modal-actions">
        <button class="btn btn-outline" data-click="closeModal">取消</button>
        <button class="btn btn-primary" data-click="verifyBeforeChange">验证</button>
      </div>
    `);
    setTimeout(() => { const el = document.getElementById('changePwdVerify'); if (el) el.focus(); }, 100);
    return;
  }
  openChangePasswordModal();
}

async function verifyBeforeChange() {
  const pwd = document.getElementById('changePwdVerify').value;
  if (await verifyPasswordHash(pwd, state.appPassword)) {
    state.passwordUnlocked = true;
    closeModal();
    openChangePasswordModal();
  } else {
    showToast('密码错误', 'error');
  }
}

function openChangePasswordModal() {
  openModal(`
    <h3>🔑 修改密码</h3>
    <div class="form-group">
      <label class="form-label">新密码</label>
      <input type="password" class="form-input" id="newPwd1" placeholder="输入新密码">
    </div>
    <div class="form-group">
      <label class="form-label">确认新密码</label>
      <input type="password" class="form-input" id="newPwd2" placeholder="再次输入新密码">
    </div>
    <div style="height:1px;background:var(--border-light);margin:12px 0"></div>
    <div class="form-group">
      <label class="form-label">密保问题（留空则不修改）</label>
      <select class="form-select" id="changeSecQuestion">
        <option value="">不修改密保（当前：${escapeHtml(state.securityQuestion || '未设置')}）</option>
        <option value="出生城市">您的出生城市是？</option>
        <option value="第一只宠物">您的第一只宠物的名字是？</option>
        <option value="母亲生日">您母亲的生日是几月几号？</option>
        <option value="最喜欢的科目">您最喜欢的科目是？</option>
        <option value="初中班主任">您的初中班主任姓什么？</option>
        <option value="小学名称">您的小学叫什么名字？</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">密保答案（留空则不修改）</label>
      <input type="text" class="form-input" id="changeSecAnswer" placeholder="输入新密保答案...">
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" data-click="closeModal">取消</button>
      <button class="btn btn-primary" data-click="saveNewPassword">确认修改</button>
    </div>
  `);
}

async function saveNewPassword() {
  const n1 = document.getElementById('newPwd1').value;
  const n2 = document.getElementById('newPwd2').value;
  if (n1.length < 4) { showToast('新密码至少4位', 'warn'); return; }
  if (n1 !== n2) { showToast('两次密码不一致', 'error'); return; }
  state.appPassword = await hashPasswordAsync(n1);
  // Update security question if provided
  const newQ = document.getElementById('changeSecQuestion').value;
  const newA = document.getElementById('changeSecAnswer').value.trim();
  if (newQ && newA) {
    state.securityQuestion = newQ;
    state.securityAnswer = await hashPasswordAsync(newA.toLowerCase());
  }
  saveState();
  closeModal();
  showToast('密码已修改');
  renderPwdStatusBar();
}

const NAV_CHILD_ID_MAP = {'student-tasks':'nav-student-tasks','analysis':'nav-analysis','xiuxian':'nav-xiuxian'};
function expandNavParent(parentPage, expanded) {
  const parent = document.querySelector('.nav-item[data-page="' + parentPage + '"]');
  if (!parent) return;
  const children = document.getElementById(NAV_CHILD_ID_MAP[parentPage]);
  parent.classList.toggle('expanded', expanded);
  if (children) children.classList.toggle('show', expanded);
}

function toggleNavParent(parentPage) {
  const parent = document.querySelector('.nav-item[data-page="' + parentPage + '"]');
  if (!parent) return;
  const children = document.getElementById(NAV_CHILD_ID_MAP[parentPage]);
  if (!children) return;
  const willExpand = !children.classList.contains('show');
  expandNavParent(parentPage, willExpand);
}

// 渲染节流：合并短时间内的多次渲染请求，避免连续DOM重建
let _renderRAF = null;
function renderPage() {
  if (_renderRAF) cancelAnimationFrame(_renderRAF);
  _renderRAF = requestAnimationFrame(() => {
    _renderRAF = null;
    _doRenderPage();
  });
}

function _doRenderPage() {
  clearLayerCache(); // 每个渲染周期重置分层缓存
  const area = document.getElementById('contentArea');
  if (!state.xiuxian) state.xiuxian = {students:{},meta:{}};
  console.log('[_doRenderPage] currentPage=', state.currentPage, 'xiuxian.view=', (state.xiuxian||{}).view, 'xiuxian keys=', Object.keys(state.xiuxian||{}));
  switch(state.currentPage) {
    case 'tasks': renderTasks(area); break;
    case 'plan': renderPlan(area); break;
    case 'schedule': renderSchedule(area); break;
    case 'progress': renderProgress(area); break;
    case 'students': renderStudents(area); break;
    case 'st-task-info':
    case 'st-random':
    case 'st-homework':
    case 'st-chat': renderStudentTasks(area); break;
    case 'hw-analysis':
    case 'score-analysis':
    case 'dashboard': renderAnalysis(area); break;
    case 'automation': renderAutomation(area); break;
    case 'skill-links': renderSkillLinks(area); break;
    case 'ima-link': renderImaLink(area); break;
    case 'daily-quiz': renderDailyQuiz(area); break;
    case 'folder': renderFolder(area); break;
    case 'xiuxian':
    case 'xiuxian-archive':
    case 'xiuxian-tasks':
    case 'xiuxian-rank':
    case 'xiuxian-pool': console.log('[_doRenderPage] → renderXiuxian for', state.currentPage); renderXiuxian(area); break;
    default: console.warn('[_doRenderPage] ❌ UNKNOWN page:', state.currentPage, '— showing 页面建设中'); area.innerHTML = '<div class="empty-state"><span class="emoji">🚧</span>页面建设中</div>';
  }
  updateMobileFab();
  updateMobileTabBadges();
}

