/* ===================== Utilities ===================== */
function uid() { return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function escapeHtml(s) { if(!s) return ''; const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
function escapeAttr(s) { return (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;'); }
function safeImageSrc(src) { return (src||'').match(/^(data:image\/|blob:|https?:\/\/)/) ? escapeAttr(src) : ''; }
function fmtDate(d) { if(!d) return ''; return new Date(d).toLocaleDateString('zh-CN', {month:'2-digit',day:'2-digit'}); }
function fmtTime(d) { if(!d) return ''; const dt=new Date(d); return dt.getHours().toString().padStart(2,'0')+':'+dt.getMinutes().toString().padStart(2,'0'); }
function fmtDateTime(d) { if(!d) return ''; const dt=new Date(d); return (dt.getMonth()+1)+'/'+dt.getDate()+' '+fmtTime(d); }
function getWeekStart(date) { const d=new Date(date); const day=d.getDay()||7; d.setDate(d.getDate()-day+1); d.setHours(0,0,0,0); return d; }
function getDayName(day) { return ['','周一','周二','周三','周四','周五','周六','周日'][day]||''; }
function getPeriodName(p) { return getPeriodLabel(p); }

// 通用防抖函数（默认 200ms）
function debounce(fn, delay) {
  delay = delay || 200;
  let timer = null;
  return function() {
    const ctx = this, args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function() { fn.apply(ctx, args); }, delay);
  };
}

function showToast(msg, type) {
  const t = document.createElement('div');
  t.className = 'toast' + (type==='error'?' error':type==='warn'?' warn':'');
  t.textContent = msg;
  document.getElementById('toastContainer').appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transition='opacity 0.3s'; setTimeout(()=>t.remove(), 300); }, 2500);
}

/* ===================== Modal ===================== */
// 安全警告：openModal 将 html 参数直接插入 innerHTML，调用方必须自行使用 escapeHtml/escapeAttr 转义用户数据
function openModal(html, opts) {
  opts = opts || {};
  const c = document.getElementById('modalContainer');
  const overlayAttr = opts.closable === false ? '' : ' data-click="closeModal" data-click-self="1"';
  const modalStyle = opts.width ? ' style="max-width:' + opts.width + '"' : '';
  const titleHtml = opts.title ? '<div style="font-size:17px;font-weight:700;color:var(--text-heading);margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border-light)">' + escapeHtml(opts.title) + '</div>' : '';
  c.innerHTML = '<div class="modal-overlay" role="dialog" aria-modal="true"' + overlayAttr + '><div class="modal"' + modalStyle + '>' + titleHtml + html + '</div></div>';
  // 焦点管理：将焦点移到模态框
  const modal = c.querySelector('.modal');
  if (modal) { modal.setAttribute('tabindex', '-1'); modal.focus(); }
}
function closeModal() { document.getElementById('modalContainer').innerHTML = ''; }

