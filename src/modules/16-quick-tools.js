/* ===================== Quick Tools: 01 自动化提醒 ===================== */
function renderAutomation(container) {
  const activeCount = state.reminders.filter(r=>r.active).length;
  const totalCount = state.reminders.length;
  container.innerHTML = `
    <div class="stats-row">
      <div class="stat-card"><span class="stat-icon">⏰</span><div class="stat-num">${totalCount}</div><div class="stat-label">提醒总数</div></div>
      <div class="stat-card"><span class="stat-icon">✅</span><div class="stat-num">${activeCount}</div><div class="stat-label">已启用</div></div>
      <div class="stat-card"><span class="stat-icon">⏸️</span><div class="stat-num">${totalCount-activeCount}</div><div class="stat-label">已暂停</div></div>
    </div>
    <div class="toolbar">
      <div class="section-title">🔔 自动化提醒列表</div>
      <button class="btn btn-primary" data-click="openReminderModal">+ 新建提醒</button>
    </div>
    <div id="reminderList"></div>
    <div class="tool-card" style="margin-top:20px">
      <div class="tool-card-header">
        <div class="tool-card-icon" style="background:var(--primary-lightest)">💡</div>
        <div>
          <div class="tool-card-title">如何接入 WorkBuddy 定时提醒？</div>
          <div class="tool-card-desc">在工作台对话中直接告诉海绵宝宝即可创建自动化定时任务</div>
        </div>
      </div>
      <div style="font-size:13px;color:var(--text-body);line-height:1.9;padding-left:8px">
        <p>📌 <b>操作方式：</b>在 WorkBuddy 对话框中输入类似以下指令：</p>
        <ul style="margin:6px 0 6px 20px">
          <li>"每天下午4点提醒我批改作业"</li>
          <li>"每周一早上8点提醒我检查本周备课"</li>
          <li>"每周五下午3点提醒我同步教学进度"</li>
        </ul>
        <p>📌 海绵宝宝会自动创建定时任务，按设定时间准时提醒你。</p>
        <p>📌 可在下方列表中管理（启用/暂停/删除）本地提醒记录。</p>
      </div>
    </div>
  `;
  renderReminderList();
}

function renderReminderList() {
  const list = document.getElementById('reminderList');
  if (!state.reminders.length) {
    list.innerHTML = '<div class="empty-state"><span class="emoji">📭</span>暂无提醒，点击「新建提醒」创建</div>';
    return;
  }
  list.innerHTML = state.reminders.map(r => `
    <div class="reminder-item ${r.active?'':'paused'}">
      <div style="font-size:22px">${r.active?'🔔':'🔇'}</div>
      <div class="reminder-info">
        <div class="reminder-name">${escapeHtml(r.name)}</div>
        <div class="reminder-schedule">📅 ${escapeHtml(r.schedule)} · ${escapeHtml(r.desc||'')}</div>
      </div>
      <span class="reminder-badge ${r.active?'badge-active':'badge-paused'}">${r.active?'已启用':'已暂停'}</span>
      <button class="btn btn-sm btn-outline" data-click="toggleReminder" data-click-args="[&quot;${r.id}&quot;]">${r.active?'暂停':'启用'}</button>
      <button class="btn-icon" title="删除" data-click="deleteReminder" data-click-args="[&quot;${r.id}&quot;]">🗑️</button>
    </div>
  `).join('');
}

function toggleReminder(id) {
  const r = state.reminders.find(x=>x.id===id);
  if (!r) return;
  r.active = !r.active;
  saveState({pushUndo:true});
  renderReminderList();
  showToast(r.active?'提醒已启用':'提醒已暂停');
}

async function deleteReminder(id) {
  if (!(await appConfirm('确认删除此提醒？', {danger:true}))) return;
  state.reminders = state.reminders.filter(r=>r.id!==id);
  saveState({pushUndo:true});
  renderReminderList();
  showToast('提醒已删除');
}

function openReminderModal(id) {
  const r = id ? state.reminders.find(x=>x.id===id) : null;
  // Parse existing schedule for structured editing
  let freq = 'daily', weekday = '一', timeStr = '16:00';
  if (r && r.schedule) {
    const s = r.schedule;
    const timeMatch = s.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) timeStr = timeMatch[1].padStart(2,'0') + ':' + timeMatch[2];
    if (/^每天/.test(s)) freq = 'daily';
    else if (/^每周/.test(s)) { freq = 'weekly'; const wm = s.match(/每周(日|一|二|三|四|五|六)/); if (wm) weekday = wm[1]; }
    else if (/^每月最后一天/.test(s)) freq = 'monthly';
    else freq = 'custom';
  }
  const weekdayOptions = ['一','二','三','四','五','六','日'];
  openModal(`
    <h3 style="margin-bottom:16px">${r?'编辑提醒':'新建提醒'}</h3>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">提醒名称</label>
        <input class="search-input" id="rmName" placeholder="如：每日批改提醒" value="${r?escapeHtml(r.name):''}">
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <div style="flex:1;min-width:120px">
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">重复频率</label>
          <select class="form-select" id="rmFreq" data-ev="change" data-ev-key="ev56" style="width:100%">
            <option value="daily" ${freq==='daily'?'selected':''}>每天</option>
            <option value="weekly" ${freq==='weekly'?'selected':''}>每周</option>
            <option value="monthly" ${freq==='monthly'?'selected':''}>每月最后一天</option>
            <option value="custom" ${freq==='custom'?'selected':''}>自定义</option>
          </select>
        </div>
        <div id="rmWeekdayWrap" style="display:${freq==='weekly'?'block':'none'};min-width:100px">
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">星期</label>
          <select class="form-select" id="rmWeekday" style="width:100%">
            ${weekdayOptions.map(w => `<option value="${w}" ${weekday===w?'selected':''}>周${w}</option>`).join('')}
          </select>
        </div>
        <div style="min-width:100px">
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">时间</label>
          <input type="time" class="form-input" id="rmTime" value="${timeStr}" style="width:100%">
        </div>
      </div>
      <div id="rmCustomWrap" style="display:${freq==='custom'?'block':'none'}">
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">自定义计划（如：每天 16:00 / 每周一 08:00 / 每月最后一天 09:00）</label>
        <input class="search-input" id="rmSchedule" placeholder="如：每天 16:00" value="${r?escapeHtml(r.schedule):''}">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">备注说明</label>
        <input class="search-input" id="rmDesc" placeholder="提醒内容描述" value="${r?escapeHtml(r.desc||''):''}">
      </div>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">
      <button class="btn btn-outline" data-click="closeModal">取消</button>
      <button class="btn btn-primary" data-click="saveReminder" data-click-args="${escapeAttr(JSON.stringify([r ? r.id : null]))}">保存</button>
    </div>
  `);
}

function onReminderFreqChange() {
  const freq = document.getElementById('rmFreq').value;
  document.getElementById('rmWeekdayWrap').style.display = freq === 'weekly' ? 'block' : 'none';
  document.getElementById('rmCustomWrap').style.display = freq === 'custom' ? 'block' : 'none';
}

function saveReminder(id) {
  const name = document.getElementById('rmName').value.trim();
  const desc = document.getElementById('rmDesc').value.trim();
  const freq = document.getElementById('rmFreq').value;
  const time = document.getElementById('rmTime').value || '09:00';
  let schedule = '';
  if (freq === 'daily') {
    schedule = '每天 ' + time;
  } else if (freq === 'weekly') {
    const wd = document.getElementById('rmWeekday').value;
    schedule = '每周' + wd + ' ' + time;
  } else if (freq === 'monthly') {
    schedule = '每月最后一天 ' + time;
  } else {
    schedule = document.getElementById('rmSchedule').value.trim();
  }
  if (!name || !schedule) { showToast('请填写提醒名称和时间', 'error'); return; }
  if (id) {
    const r = state.reminders.find(x=>x.id===id);
    r.name = name; r.schedule = schedule; r.desc = desc;
  } else {
    state.reminders.push({ id: uid(), name, schedule, desc, active: true });
  }
  saveState({pushUndo:true});
  closeModal();
  renderReminderList();
  showToast('提醒已保存');
}

/* ===================== Quick Tools: 02 Skill链接 ===================== */
const SKILL_LINKS = [
  { icon:'📄', name:'PDF工具', desc:'PDF读取/编辑/合并/拆分', url:'#' },
  { icon:'📊', name:'Excel工具', desc:'电子表格处理与生成', url:'#' },
  { icon:'📽️', name:'PPT生成', desc:'演示文稿自动制作', url:'#' },
  { icon:'📝', name:'腾讯文档', desc:'在线协作文档', url:'https://docs.qq.com' },
  { icon:'🔍', name:'Web搜索', desc:'联网搜索信息', url:'#' },
  { icon:'🎨', name:'图表生成', desc:'数据可视化图表', url:'#' },
  { icon:'🌐', name:'网页部署', desc:'在线部署静态网站', url:'#' },
  { icon:'📋', name:'文档摘要', desc:'智能内容摘要', url:'#' },
  { icon:'🤖', name:'Agent浏览器', desc:'网页自动化操作', url:'#' },
  { icon:'🖼️', name:'图片生成', desc:'AI文生图', url:'#' },
  { icon:'🎬', name:'视频生成', desc:'AI文生视频', url:'#' },
  { icon:'🧩', name:'3D模型', desc:'AI生成3D模型', url:'#' }
];

function renderSkillLinks(container) {
  container.innerHTML = `
    <div class="tool-card">
      <div class="tool-card-header">
        <div class="tool-card-icon" style="background:var(--primary-lightest)">🔗</div>
        <div>
          <div class="tool-card-title">Skill 快捷入口</div>
          <div class="tool-card-desc">点击下方卡片快速使用对应 Skill 能力（部分功能需在 WorkBuddy 对话中触发）</div>
        </div>
      </div>
    </div>
    <div class="tool-link-grid" id="skillGrid"></div>
    <div class="tool-card" style="margin-top:20px">
      <div class="tool-card-header">
        <div class="tool-card-icon" style="background:var(--primary-lightest)">💡</div>
        <div>
          <div class="tool-card-title">如何使用 Skill？</div>
          <div class="tool-card-desc">在对话中直接描述你的需求，海绵宝宝会自动调用对应能力</div>
        </div>
      </div>
      <div style="font-size:13px;color:var(--text-body);line-height:1.9;padding-left:8px">
        <p>📌 <b>文档类：</b>"帮我做一个PPT" / "读取这个Excel" / "把PDF转成Word"</p>
        <p>📌 <b>搜索类：</b>"搜索一下动物细胞结构的相关资料" / "查一下最新的中考生物考点"</p>
        <p>📌 <b>生成类：</b>"生成一张细胞结构图" / "帮我画一个食物链的图表"</p>
        <p>📌 <b>部署类：</b>"把工作台部署到线上" / "帮我发布这个网页"</p>
      </div>
    </div>
  `;
  document.getElementById('skillGrid').innerHTML = SKILL_LINKS.map(s => `
    <a class="tool-link-item" href="${s.url}" target="${s.url.startsWith('http')?'_blank':'_self'}" ${s.url==='#'?'data-click="__dcSkillHint"':''}>
      <div class="link-icon">${s.icon}</div>
      <div class="link-name">${s.name}</div>
      <div class="link-desc">${s.desc}</div>
    </a>
  `).join('');
}

function skillHint() {
  showToast('请在 WorkBuddy 对话中描述需求即可触发对应能力', 'warn');
}

/* ===================== Quick Tools: 03 IMA链接入口 ===================== */
function renderImaLink(container) {
  container.innerHTML = `
    <div class="ima-hero">
      <div class="ima-logo">🧠</div>
      <h2>IMA 知识库</h2>
      <p>腾讯 IMA 是智能知识管理工具，支持文档收藏、知识问答、AI 辅助学习。点击下方按钮直接进入 IMA 知识库，随时随地管理你的教学资料。</p>
      <a class="ima-btn" href="https://ima.qq.com" target="_blank">🚀 进入 IMA 知识库</a>
    </div>
    <div class="tool-link-grid">
      <a class="tool-link-item" href="https://ima.qq.com" target="_blank">
        <div class="link-icon">🏠</div>
        <div class="link-name">IMA 首页</div>
        <div class="link-desc">知识库主页</div>
      </a>
      <a class="tool-link-item" href="https://ima.qq.com/explore" target="_blank">
        <div class="link-icon">🔍</div>
        <div class="link-name">知识探索</div>
        <div class="link-desc">搜索与发现</div>
      </a>
      <a class="tool-link-item" href="https://ima.qq.com/chat" target="_blank">
        <div class="link-icon">💬</div>
        <div class="link-name">AI 问答</div>
        <div class="link-desc">智能问答助手</div>
      </a>
      <a class="tool-link-item" href="https://ima.qq.com/library" target="_blank">
        <div class="link-icon">📚</div>
        <div class="link-name">我的知识库</div>
        <div class="link-desc">个人收藏管理</div>
      </a>
    </div>
    <div class="tool-card" style="margin-top:20px">
      <div class="tool-card-header">
        <div class="tool-card-icon" style="background:var(--primary-lightest)">💡</div>
        <div>
          <div class="tool-card-title">IMA 使用小贴士</div>
          <div class="tool-card-desc">教学场景下的 IMA 使用建议</div>
        </div>
      </div>
      <div style="font-size:13px;color:var(--text-body);line-height:1.9;padding-left:8px">
        <p>📌 <b>教学资料管理：</b>将课件、教案、试卷上传到 IMA 知识库，随时检索复用</p>
        <p>📌 <b>中考复习：</b>把历年中考生物真题导入 IMA，用 AI 问答快速查考点</p>
        <p>📌 <b>备课辅助：</b>上传教材章节内容，让 IMA 帮你生成知识点提纲和练习题</p>
        <p>📌 <b>跨设备同步：</b>手机/电脑端数据互通，碎片时间也能随时复习</p>
      </div>
    </div>
  `;
}

/* ===================== Quick Tools: 04 生物中考每日练习 ===================== */
const QUIZ_BANK = [
  // ===== Day 1: 细胞结构与功能 =====
  {
    mc: [
      { q:'植物细胞和动物细胞都有的结构是（　　）。', opts:['细胞壁、叶绿体','细胞膜、细胞核','细胞壁、液泡','叶绿体、液泡'], answer:1, explain:'细胞膜、细胞核、细胞质是动植物细胞共有的结构；细胞壁、叶绿体、液泡是植物细胞特有的。' },
      { q:'细胞中控制物质进出的结构是（　　）。', opts:['细胞壁','细胞膜','细胞核','细胞质'], answer:1, explain:'细胞膜具有控制物质进出的功能，让有用物质进入，有害物质挡在门外。' },
      { q:'"种瓜得瓜，种豆得豆"这种现象主要取决于细胞中的（　　）。', opts:['细胞膜','细胞核','细胞质','液泡'], answer:1, explain:'细胞核中含有遗传物质，控制生物的遗传特性。' },
      { q:'植物细胞中能进行光合作用制造有机物的结构是（　　）。', opts:['线粒体','叶绿体','细胞核','液泡'], answer:1, explain:'叶绿体是光合作用的场所，能将无机物转化为有机物并释放氧气。' },
      { q:'下列关于线粒体的叙述，正确的是（　　）。', opts:['只存在于植物细胞中','只存在于动物细胞中','动植物细胞都有','与能量转换无关'], answer:2, explain:'线粒体是呼吸作用的场所，动植物细胞都含有线粒体，能为细胞生命活动提供能量。' },
      { q:'制作洋葱表皮细胞临时装片时，滴加的液体是（　　）。', opts:['清水','生理盐水','碘液','酒精'], answer:0, explain:'制作植物细胞临时装片时滴清水，制作动物细胞临时装片时滴生理盐水（0.9%）。' },
      { q:'用显微镜观察口腔上皮细胞时，视野过暗，应调节（　　）。', opts:['换高倍物镜','调节反光镜和光圈','换低倍物镜','移动装片'], answer:1, explain:'视野过暗时应调节反光镜（换凹面镜）和光圈（调大），增加进光量。' },
      { q:'显微镜下看到的物像是（　　）。', opts:['正立的实像','倒立的实像','正立的虚像','倒立的虚像'], answer:1, explain:'显微镜成倒立的实像，所以物像移动方向与装片移动方向相反。' },
      { q:'细胞分裂过程中，最明显的变化是（　　）的变化。', opts:['细胞膜','细胞质','细胞核','细胞壁'], answer:2, explain:'细胞分裂时，细胞核先一分为二，细胞质再分成两份，最后形成新细胞膜（和细胞壁）。' },
      { q:'细胞分化是指细胞在生长过程中（　　）。', opts:['数量增多','体积增大','形态结构功能发生变化','停止分裂'], answer:2, explain:'细胞分化是细胞在分裂生长后，形态、结构和功能发生差异性变化的过程，形成不同组织。' }
    ],
    major: {
      q:'下图为动物细胞结构模式图，请据图回答：(1)写出各结构名称：①______，②______，③______。(2)控制物质进出的结构是[　]______。(3)含有遗传物质的结构是[　]______。(4)与呼吸作用有关、为细胞生命活动提供能量的结构是______。',
      answer:'(1)①细胞膜　②细胞核　③细胞质　(2)[①]细胞膜　(3)[②]细胞核　(4)线粒体。解析：动物细胞的基本结构包括细胞膜、细胞核和细胞质。细胞膜控制物质进出；细胞核含遗传物质；线粒体是呼吸作用场所，为生命活动提供能量。'
    }
  },
  // ===== Day 2: 生物圈与生态系统 =====
  {
    mc: [
      { q:'一个生态系统包括（　　）。', opts:['全部植物和动物','全部生物及其生活环境','全部生产者和分解者','全部非生物部分'], answer:1, explain:'生态系统由生物部分（生产者、消费者、分解者）和非生物部分（阳光、空气、水等）共同组成。' },
      { q:'在生态系统中，能把动植物遗体分解为无机物的是（　　）。', opts:['生产者','消费者','分解者','非生物部分'], answer:2, explain:'分解者（细菌、真菌）能将动植物遗体分解为无机物，归还给无机环境，供植物再利用。' },
      { q:'"绿色工厂"指的是生态系统中的（　　）。', opts:['生产者','消费者','分解者','非生物部分'], answer:0, explain:'生产者（绿色植物）通过光合作用制造有机物，被称为"绿色工厂"。' },
      { q:'食物链的起点是（　　）。', opts:['消费者','生产者','分解者','非生物部分'], answer:1, explain:'食物链从生产者（植物）开始，经消费者逐级传递，分解者不参与食物链。' },
      { q:'在"草→兔→鹰"这条食物链中，鹰属于（　　）。', opts:['生产者','初级消费者','次级消费者','三级消费者'], answer:2, explain:'兔是初级消费者（第一营养级消费者），鹰以兔为食，是次级消费者。' },
      { q:'生态系统中的能量最终来自（　　）。', opts:['生产者','消费者','分解者','太阳'], answer:3, explain:'生态系统中所有能量最终来源于太阳能，生产者通过光合作用将光能转化为化学能。' },
      { q:'下列属于生态系统的是（　　）。', opts:['一个池塘中所有的鱼','一片森林中所有的树','一个湖泊中的所有生物及其环境','一片草地上的所有昆虫'], answer:2, explain:'生态系统必须包含生物部分和非生物部分，A、B、D只有生物没有环境，不构成完整生态系统。' },
      { q:'在生态系统中，有毒物质在食物链中逐级积累，营养级越高（　　）。', opts:['有毒物质越少','有毒物质越多','有毒物质不变','无法判断'], answer:1, explain:'生物富集现象：有毒物质沿食物链逐级积累，营养级越高，体内有毒物质浓度越高。' },
      { q:'生态系统中各种生物的数量和所占比例是相对稳定的，这说明（　　）。', opts:['生态系统不受外界影响','生态系统有一定的自我调节能力','生态系统不会变化','生态系统中生物数量不变'], answer:1, explain:'生态系统具有一定的自我调节能力，能维持相对稳定状态，但能力是有限的。' },
      { q:'下列措施中，不利于保护生态系统的是（　　）。', opts:['建立自然保护区','禁止乱砍滥伐','大量引进外来物种','退耕还林还草'], answer:2, explain:'引进外来物种可能破坏本地生态平衡，造成生物入侵，危害本地物种生存。' }
    ],
    major: {
      q:'下图是一个简化的食物网，请分析回答：(1)该食物网中有______条食物链。(2)最长的一条食物链是______。(3)若草受到农药污染，体内有毒物质浓度最高的生物是______。(4)该生态系统中，兔和草的关系是______。',
      answer:'(1)3条食物链。(2)草→鼠→蛇→鹰。(3)鹰（有毒物质沿食物链逐级积累，营养级最高的鹰体内浓度最高）。(4)吃与被吃的关系（捕食关系）。解析：食物链从生产者开始，终点是最高级消费者。该食物网含三条链：草→兔→鹰、草→鼠→蛇→鹰、草→鼠→鹰。'
    }
  },
  // ===== Day 3: 人体生理 =====
  {
    mc: [
      { q:'人体消化和吸收的主要场所是（　　）。', opts:['口腔','胃','小肠','大肠'], answer:2, explain:'小肠是消化和吸收的主要场所，有丰富的绒毛和微绒毛增大吸收面积，含有多种消化酶。' },
      { q:'淀粉在口腔中开始消化，最终被分解为（　　）。', opts:['氨基酸','葡萄糖','脂肪酸','麦芽糖'], answer:1, explain:'淀粉在唾液淀粉酶作用下先分解为麦芽糖，最终在小肠中分解为葡萄糖被吸收。' },
      { q:'蛋白质的消化始于（　　），最终被分解为氨基酸。', opts:['口腔','食道','胃','小肠'], answer:2, explain:'蛋白质在胃中胃蛋白酶作用下开始消化，最终在小肠分解为氨基酸被吸收。' },
      { q:'人体呼吸的主要器官是（　　）。', opts:['鼻','咽','喉','肺'], answer:3, explain:'肺是呼吸系统的主要器官，是气体交换的场所。' },
      { q:'人体内氧气与二氧化碳交换的场所是（　　）。', opts:['气管','支气管','肺泡','咽喉'], answer:2, explain:'肺泡是气体交换的基本单位，其壁很薄，外面缠绕着毛细血管，便于气体交换。' },
      { q:'血液与组织细胞之间进行物质交换时，血液流经（　　）。', opts:['动脉','静脉','毛细血管','心脏'], answer:2, explain:'毛细血管管壁薄、管径小、血流慢，是血液与组织细胞进行物质交换的场所。' },
      { q:'心脏的四个腔中，壁最厚的是（　　）。', opts:['左心房','左心室','右心房','右心室'], answer:1, explain:'左心室将血液泵向全身，需要最大的收缩力，因此壁最厚。' },
      { q:'体循环和肺循环的共同规律是（　　）。', opts:['心室→动脉→毛细血管→静脉→心房','心房→动脉→毛细血管→静脉→心室','心室→静脉→毛细血管→动脉→心房','心房→静脉→毛细血管→动脉→心室'], answer:0, explain:'血液循环规律：心室→动脉→毛细血管→静脉→心房。' },
      { q:'人体最大的排泄器官是（　　）。', opts:['肺','皮肤','肾脏','肝脏'], answer:2, explain:'肾脏是人体主要的排泄器官，形成尿液排出代谢废物。皮肤排汗也是排泄途径之一。' },
      { q:'尿液形成过程中，过滤作用的场所是（　　）。', opts:['肾小球','肾小囊','肾小管','收集管'], answer:0, explain:'肾小球起过滤作用，形成原尿；肾小管起重吸收作用，形成终尿。' }
    ],
    major: {
      q:'下图为人体血液循环模式图，请据图回答：(1)体循环的途径是：左心室→______→全身毛细血管网→______→右心房。(2)肺循环的途径是：右心室→______→肺部毛细血管网→______→左心房。(3)在肺部毛细血管处，血液发生的变化是______。(4)动脉血是指______的血液。',
      answer:'(1)主动脉　上下腔静脉　(2)肺动脉　肺静脉　(3)静脉血变为动脉血（血液中的二氧化碳进入肺泡，肺泡中的氧气进入血液）　(4)含氧丰富、颜色鲜红。解析：体循环将动脉血变为静脉血，肺循环将静脉血变为动脉血。'
    }
  },
  // ===== Day 4: 植物生理 =====
  {
    mc: [
      { q:'植物的根吸收水分和无机盐的主要部位是（　　）。', opts:['根冠','分生区','伸长区','成熟区'], answer:3, explain:'成熟区（根毛区）有大量根毛，表面积大，是吸收水分和无机盐的主要部位。' },
      { q:'蒸腾作用的主要器官是（　　）。', opts:['根','茎','叶','花'], answer:2, explain:'叶是蒸腾作用的主要器官，气孔是水蒸气散失的门户，也是气体交换的窗口。' },
      { q:'气孔的开闭由（　　）控制。', opts:['表皮细胞','保卫细胞','叶肉细胞','导管细胞'], answer:1, explain:'保卫细胞控制气孔的开闭，保卫细胞吸水膨胀时气孔张开，失水缩小时气孔关闭。' },
      { q:'光合作用的表达式是（　　）。', opts:['二氧化碳+水→有机物+氧气','有机物+氧气→二氧化碳+水+能量','二氧化碳+水+光能→有机物+氧气','水+光能→氧气+有机物'], answer:2, explain:'光合作用：二氧化碳+水→（光能、叶绿体）→有机物（储存能量）+氧气。' },
      { q:'呼吸作用的表达式是（　　）。', opts:['二氧化碳+水→有机物+氧气','有机物+氧气→二氧化碳+水+能量','二氧化碳+水+光能→有机物+氧气','水+光能→氧气+氢气'], answer:1, explain:'呼吸作用：有机物+氧气→二氧化碳+水+能量。所有活细胞都能进行呼吸作用。' },
      { q:'下列措施中，能促进植物进行光合作用的是（　　）。', opts:['增加二氧化碳浓度','降低温度','减少光照','减少水分'], answer:0, explain:'增加二氧化碳浓度可促进光合作用，合理密植、增加光照也能提高光合作用效率。' },
      { q:'植物进行蒸腾作用的意义不包括（　　）。', opts:['促进根对水分的吸收','降低叶片温度','促进水和无机盐的运输','制造有机物'], answer:3, explain:'制造有机物是光合作用的功能，不是蒸腾作用的意义。' },
      { q:'植物生长需要量最大的无机盐是（　　）。', opts:['含铁、含锌、含硼的无机盐','含氮、含磷、含钾的无机盐','含钙、含镁、含硫的无机盐','含锰、含铜、含钼的无机盐'], answer:1, explain:'植物需要量最大的三种无机盐是含氮、含磷、含钾的无机盐，称为"肥料三要素"。' },
      { q:'植物缺氮时，最可能出现的症状是（　　）。', opts:['叶片发黄','叶片暗绿带紫','植株矮小、叶缘枯焦','根系发育不良'], answer:0, explain:'缺氮时植物生长缓慢，植株矮小瘦弱，叶片发黄（叶绿素合成减少）。' },
      { q:'扦插、嫁接等生殖方式属于（　　）。', opts:['有性生殖','无性生殖','孢子生殖','出芽生殖'], answer:1, explain:'扦插、嫁接、压条等不经过两性生殖细胞结合，直接由母体产生新个体，属于无性生殖。' }
    ],
    major: {
      q:'为了探究"二氧化碳是光合作用的原料"，某同学设计了如下实验：将两套装置（A装置中放氢氧化钠溶液，B装置中放清水）分别放入装有天竺葵的小烧杯中，黑暗处理一昼夜后，移至光下照射几小时，取叶片脱色后滴加碘液。请回答：(1)暗处理的目的是______。(2)A装置中氢氧化钠溶液的作用是______。(3)B装置的作用是______。(4)实验现象：______叶片变蓝，______叶片不变蓝。(5)结论：______。',
      answer:'(1)耗尽叶片中原有的有机物（淀粉），排除原有淀粉对实验的干扰　(2)吸收装置中的二氧化碳　(3)对照作用　(4)B（清水组）变蓝，A（氢氧化钠组）不变蓝　(5)二氧化碳是光合作用的原料。解析：氢氧化钠吸收CO₂，使植物无法进行光合作用制造淀粉；清水组有CO₂可正常进行光合作用，叶片遇碘变蓝，说明二氧化碳是光合作用必需的原料。'
    }
  },
  // ===== Day 5: 遗传与变异 =====
  {
    mc: [
      { q:'决定生物性状的遗传物质是（　　）。', opts:['蛋白质','糖类','DNA','脂质'], answer:2, explain:'DNA（脱氧核糖核酸）是主要的遗传物质，基因是DNA上有遗传效应的片段。' },
      { q:'染色体、DNA、基因三者之间的关系是（　　）。', opts:['基因>DNA>染色体','染色体>DNA>基因','DNA>基因>染色体','三者无关系'], answer:1, explain:'染色体由DNA和蛋白质组成，DNA上有许多基因，所以大小关系为：染色体>DNA>基因。' },
      { q:'在人的体细胞中，染色体的存在情况是（　　）。', opts:['23对，46条','23条','46对','22对'], answer:0, explain:'人体体细胞中有23对（46条）染色体，其中22对常染色体和1对性染色体。' },
      { q:'男性的性染色体组成是（　　）。', opts:['XX','XY','XX或XY','YY'], answer:1, explain:'男性性染色体为XY，女性性染色体为XX。' },
      { q:'基因在亲子代间的传递是通过（　　）。', opts:['体细胞','生殖细胞（精子和卵细胞）','红细胞','肌肉细胞'], answer:1, explain:'亲代通过生殖细胞（精子和卵细胞）将基因传递给子代，受精卵含有来自父母双方的基因。' },
      { q:'如果父母都能卷舌（显性），生了一个不能卷舌的孩子（隐性），则父母的基因型是（　　）。', opts:['AA×AA','Aa×Aa','AA×aa','aa×aa'], answer:1, explain:'不能卷舌为隐性性状（aa），孩子从父母各获得一个a基因，所以父母都为杂合子Aa。' },
      { q:'近亲结婚的危害是（　　）。', opts:['使后代变聪明','增加遗传病发病率','使后代更健康','没有影响'], answer:1, explain:'近亲结婚时，携带相同隐性致病基因的概率大大增加，导致遗传病发病率升高。' },
      { q:'可遗传的变异是（　　）引起的。', opts:['环境变化','营养条件','遗传物质改变','体育锻炼'], answer:2, explain:'只有遗传物质发生改变引起的变异才能遗传给后代，环境引起的变异不可遗传。' },
      { q:'一朵花中最重要的结构是（　　）。', opts:['花萼','花冠','花蕊（雄蕊和雌蕊）','花托'], answer:2, explain:'雄蕊和雌蕊是与生殖直接相关的结构，是花的主要部分。' },
      { q:'受精完成后，发育成果皮的是（　　）。', opts:['子房壁','珠被','受精卵','胚珠'], answer:0, explain:'子房壁发育成果皮，胚珠发育成种子，受精卵发育成胚，珠被发育成种皮。' }
    ],
    major: {
      q:'已知双眼皮（A）对单眼皮（a）为显性。一对双眼皮夫妇生了一个单眼皮孩子。请分析回答：(1)父亲和母亲的基因型分别是______、______。(2)孩子的基因型是______。(3)这对夫妇再生一个单眼皮孩子的概率是______。(4)如果母亲是单眼皮，父亲是双眼皮（杂合），生单眼皮孩子的概率是______。',
      answer:'(1)Aa　Aa　(2)aa　(3)1/4（25%）　(4)1/2（50%）。解析：孩子为单眼皮（aa），从父母各获一个a基因，故父母均为Aa。Aa×Aa后代基因型及比例为：1AA:2Aa:1aa，单眼皮概率为1/4。若母亲为aa、父亲为Aa，则后代为1Aa:1aa，单眼皮概率为1/2。'
    }
  },
  // ===== Day 6: 动物运动与行为 =====
  {
    mc: [
      { q:'人体运动的基础是（　　）。', opts:['骨骼肌','骨骼和关节','骨骼肌和骨骼','关节'], answer:2, explain:'人体的运动由骨、关节和骨骼肌共同完成，骨骼肌提供动力，骨为杠杆，关节为支点。' },
      { q:'在运动中，骨的作用是（　　）。', opts:['动力','杠杆','支点','固定'], answer:1, explain:'骨在运动中起杠杆作用，关节起支点作用，骨骼肌收缩提供动力。' },
      { q:'骨骼肌中间较粗的部分叫（　　）。', opts:['肌腱','肌腹','肌纤维','肌膜'], answer:1, explain:'骨骼肌由肌腱和肌腹组成，中间较粗的为肌腹，两端的为肌腱，肌腱附着在骨上。' },
      { q:'下列动物行为中，属于先天性行为的是（　　）。', opts:['蚯蚓走迷宫','小狗算算术','蜘蛛结网','猴子骑车'], answer:2, explain:'先天性行为是生来就有的，如蜘蛛结网、蜜蜂采蜜；学习行为是后天获得的。' },
      { q:'下列行为中，属于学习行为的是（　　）。', opts:['孔雀开屏','小狗做算术','蜜蜂采蜜','母鸡孵卵'], answer:1, explain:'学习行为是在遗传因素基础上，通过环境因素和经验获得的，如小狗做算术。' },
      { q:'蚂蚁的通讯方式主要是（　　）。', opts:['声音','气味（信息素）','光','肢体动作'], answer:1, explain:'蚂蚁主要通过分泌信息素（气味）进行通讯，蚂蚁沿气味标记的路线行走。' },
      { q:'具有社会行为的动物，其群体内部的重要特征是（　　）。', opts:['数量多','有分工合作','个体大小相同','没有首领'], answer:1, explain:'社会行为的重要特征是群体内部有明显的组织分工，不同个体承担不同职责。' },
      { q:'白蚁群体中负责繁殖的是（　　）。', opts:['工蚁','兵蚁','蚁后','雄蚁'], answer:2, explain:'蚁后（雌蚁）专职产卵繁殖，工蚁负责觅食筑巢，兵蚁负责保卫蚁穴。' },
      { q:'下列不属于动物间信息交流方式的是（　　）。', opts:['蜜蜂的"8"字舞','孔雀开屏','蚂蚁的气味','鸟类的鸣叫'], answer:1, explain:'孔雀开屏是求偶行为，不是个体间信息交流。蜜蜂跳舞、蚂蚁气味、鸟类鸣叫都属于信息交流。' },
      { q:'动物在自然界中的作用不包括（　　）。', opts:['维持生态平衡','促进物质循环','帮助植物传粉','制造有机物'], answer:3, explain:'制造有机物是绿色植物（生产者）的功能，动物是消费者，不能制造有机物。' }
    ],
    major: {
      q:'当你完成屈肘动作时，请分析回答：(1)屈肘时，肱二头肌______，肱三头肌______。（填"收缩"或"舒张"）(2)在屈肘动作中，肱二头肌的肌腱固定在______上。(3)当你伸肘时，肱二头肌______，肱三头肌______。(4)人体的任何一个动作都不是由一块骨骼肌独立完成的，而是由______协调配合完成的。',
      answer:'(1)收缩　舒张　(2)骨　(3)舒张　收缩　(4)多组骨骼肌（至少两组相互拮抗的肌群）。解析：屈肘时肱二头肌收缩、肱三头肌舒张；伸肘时相反。骨骼肌通过肌腱附着在不同骨上，收缩时牵引骨绕关节活动。'
    }
  },
  // ===== Day 7: 健康与疾病 =====
  {
    mc: [
      { q:'人体的第一道防线是（　　）。', opts:['皮肤和黏膜','吞噬细胞','抗体','淋巴结'], answer:0, explain:'皮肤和黏膜构成第一道防线，能阻挡病原体侵入。第二道是体液中的杀菌物质和吞噬细胞。' },
      { q:'引起传染病的病原体中，属于病毒的是（　　）。', opts:['结核杆菌','蛔虫','流感病毒','青霉菌'], answer:2, explain:'流感病毒属于病毒，结核杆菌是细菌，蛔虫是寄生虫，青霉菌是真菌。' },
      { q:'传染病流行的三个基本环节是（　　）。', opts:['传染源、传播途径、易感人群','病原体、传播途径、易感人群','传染源、空气、食物','病原体、传染源、传播途径'], answer:0, explain:'传染病流行需同时具备传染源、传播途径和易感人群三个环节，缺一不可。' },
      { q:'下列措施中属于切断传播途径的是（　　）。', opts:['隔离病人','接种疫苗','消灭苍蝇蚊子','锻炼身体'], answer:2, explain:'消灭苍蝇蚊子属于切断传播途径；隔离病人是控制传染源；接种疫苗是保护易感人群；锻炼身体也是保护易感人群。' },
      { q:'艾滋病的主要传播途径不包括（　　）。', opts:['血液传播','母婴传播','性传播','握手拥抱'], answer:3, explain:'艾滋病通过血液、母婴、性接触传播，不通过空气飞沫、握手拥抱、共同进餐等日常接触传播。' },
      { q:'特异性免疫的特点是（　　）。', opts:['人生来就有的','对多种病原体都有防御作用','针对某种特定病原体','由皮肤构成'], answer:2, explain:'特异性免疫是后天获得的，只对某种特定病原体起作用，如抗体对抗特定抗原。' },
      { q:'接种天花疫苗后只对天花有免疫作用，这属于（　　）。', opts:['非特异性免疫','特异性免疫','先天免疫','自然免疫'], answer:1, explain:'接种疫苗属于特异性免疫，产生的抗体只对特定病原体起作用。' },
      { q:'下列属于处方药的是（　　）。', opts:['感冒灵','阿莫西林胶囊','创可贴','风油精'], answer:1, explain:'阿莫西林是抗生素类药物，属于处方药，必须在医生指导下使用。' },
      { q:'当遇到突发急症需要急救时，首先应该拨打（　　）。', opts:['110','119','120','122'], answer:2, explain:'120是医疗急救电话，遇到需要急救的病人应首先拨打120。' },
      { q:'心肺复苏时，胸外按压与人工呼吸的比例是（　　）。', opts:['15:2','30:2','5:1','10:2'], answer:1, explain:'心肺复苏时胸外按压与人工呼吸比例为30:2，按压频率为100-120次/分钟。' }
    ],
    major: {
      q:'某班发生流行性感冒，全班45名同学中有15人患病。请分析回答：(1)流感病毒从传染病角度分析，属于______。(2)患流感的15名同学从传染病角度分析，属于______。(3)未患病的30名同学中，注射过流感疫苗的同学没被传染，这属于______免疫。(4)学校采取了以下措施：①将患病学生隔离治疗；②教室每天开窗通风、消毒；③建议未患病的同学接种疫苗。上述措施分别属于预防传染病措施中的______、______、______。',
      answer:'(1)病原体　(2)传染源　(3)特异性（人工免疫）　(4)①控制传染源　②切断传播途径　③保护易感人群。解析：流感病毒是病原体；患病学生是传染源；接种疫苗产生特异性免疫，属于保护易感人群的预防措施。'
    }
  }
];

let quizDayOffset = 0;

function getQuizDayIndex() {
  const today = new Date();
  const start = new Date(today.getFullYear(), 0, 1);
  const diff = Math.floor((today - start) / (24*60*60*1000));
  return diff % QUIZ_BANK.length;
}

function getActualQuizDay() {
  const base = getQuizDayIndex();
  return (base + quizDayOffset + QUIZ_BANK.length * 100) % QUIZ_BANK.length;
}

function renderDailyQuiz(container) {
  const dayIdx = getActualQuizDay();
  const dayData = QUIZ_BANK[dayIdx];
  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日`;
  const dayNum = Math.floor((today - new Date(today.getFullYear(),0,1)) / (24*60*60*1000)) + 1;
  const topics = ['细胞结构与功能','生物圈与生态系统','人体生理','植物生理','遗传与变异','动物运动与行为','健康与疾病'];
  const offsetLabel = quizDayOffset === 0 ? '今日' : (quizDayOffset < 0 ? `前${-quizDayOffset}天` : `后${quizDayOffset}天`);
  container.innerHTML = `
    <div class="quiz-header">
      <div>
        <div class="section-title">📚 生物中考每日练习题库</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">每日自动更新 · 共10道单选 + 1道大题 · 当前查看：${offsetLabel}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="quiz-date-badge">📅 ${dateStr} · 第${dayNum}天</span>
        <button class="btn btn-outline btn-sm" data-click="prevQuizDay">◀ 前一天</button>
        <button class="btn btn-outline btn-sm" data-click="nextQuizDay">后一天 ▶</button>
      </div>
    </div>
    <div id="quizContainer"></div>
  `;
  renderQuizContent(dayIdx, dayData, topics[dayIdx] || '综合练习');
}

function renderQuizContent(dayIdx, dayData, topicName) {
  const container = document.getElementById('quizContainer');
  let html = `
    <div class="tool-card" style="background:var(--primary-lightest);padding:12px 18px;margin-bottom:16px">
      <span style="font-size:14px;font-weight:600;color:var(--text-heading)">📋 今日专题：${topicName}</span>
      <span style="font-size:12px;color:var(--text-muted);margin-left:12px">点击选项作答，点击"显示答案"查看解析</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <span style="font-size:14px;font-weight:600;color:var(--text-heading)">一、单项选择题（共10题）</span>
      <button class="btn btn-primary btn-sm" data-click="toggleAllAnswers">👁️ 全部显示/隐藏答案</button>
    </div>
  `;
  dayData.mc.forEach((q, i) => {
    html += `
      <div class="quiz-question-card" id="mc-${i}">
        <span class="quiz-q-num">${i+1}</span><span class="quiz-q-text">${escapeHtml(q.q)}</span>
        <div class="quiz-options">
          ${q.opts.map((opt, oi) => `<div class="quiz-option" data-click="selectQuizOption" data-click-args="${escapeAttr(JSON.stringify([i, oi]))}" id="opt-${i}-${oi}">${String.fromCharCode(65+oi)}. ${escapeHtml(opt)}</div>`).join('')}
        </div>
        <div class="quiz-answer-row" id="ans-${i}">
          ✅ 正确答案：<b>${String.fromCharCode(65+q.answer)}</b>　|　${escapeHtml(q.explain)}
        </div>
      </div>
    `;
  });
  html += `
    <div style="margin-top:20px;font-size:14px;font-weight:600;color:var(--text-heading)">二、综合题（共1题）</div>
    <div class="quiz-major-card">
      <span class="major-label">综合大题</span>
      <div style="font-size:14px;color:var(--text-body);line-height:1.8">${escapeHtml(dayData.major.q)}</div>
      <div class="quiz-major-answer" id="majorAnswer">${escapeHtml(dayData.major.answer)}</div>
      <button class="btn btn-outline btn-sm" style="margin-top:10px" data-click="toggleMajorAnswer">👁️ 显示/隐藏答案</button>
    </div>
  `;
  container.innerHTML = html;
}

function selectQuizOption(qIdx, optIdx) {
  const dayIdx = getActualQuizDay();
  const correct = QUIZ_BANK[dayIdx].mc[qIdx].answer;
  document.querySelectorAll(`#mc-${qIdx} .quiz-option`).forEach((el, i) => {
    el.classList.remove('selected');
    if (i === optIdx) el.classList.add('selected');
  });
  const ansEl = document.getElementById(`ans-${qIdx}`);
  if (optIdx === correct) {
    ansEl.classList.add('show');
    ansEl.style.background = '#E8F5E9';
    showToast('✅ 回答正确！');
  } else {
    ansEl.classList.add('show');
    ansEl.style.background = '#FFEBEE';
    showToast('❌ 回答错误，请看解析', 'error');
  }
}

function toggleAllAnswers() {
  const anyHidden = Array.from(document.querySelectorAll('.quiz-answer-row')).some(el => !el.classList.contains('show'));
  document.querySelectorAll('.quiz-answer-row').forEach(el => {
    if (anyHidden) el.classList.add('show');
    else el.classList.remove('show');
  });
  const majorAns = document.getElementById('majorAnswer');
  if (majorAns) {
    if (anyHidden) majorAns.classList.add('show');
    else majorAns.classList.remove('show');
  }
}

function toggleMajorAnswer() {
  const el = document.getElementById('majorAnswer');
  if (el) el.classList.toggle('show');
}

function prevQuizDay() {
  quizDayOffset--;
  const dayIdx = getActualQuizDay();
  const topics = ['细胞结构与功能','生物圈与生态系统','人体生理','植物生理','遗传与变异','动物运动与行为','健康与疾病'];
  renderQuizContent(dayIdx, QUIZ_BANK[dayIdx], topics[dayIdx] || '综合练习');
  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日`;
  const dayNum = Math.floor((today - new Date(today.getFullYear(),0,1)) / (24*60*60*1000)) + 1;
  const offsetLabel = quizDayOffset === 0 ? '今日' : (quizDayOffset < 0 ? `前${-quizDayOffset}天` : `后${quizDayOffset}天`);
  const subEl = document.querySelector('.quiz-header div div:last-child');
  if (subEl) subEl.textContent = `每日自动更新 · 共10道单选 + 1道大题 · 当前查看：${offsetLabel}`;
}

function nextQuizDay() {
  quizDayOffset++;
  const dayIdx = getActualQuizDay();
  const topics = ['细胞结构与功能','生物圈与生态系统','人体生理','植物生理','遗传与变异','动物运动与行为','健康与疾病'];
  renderQuizContent(dayIdx, QUIZ_BANK[dayIdx], topics[dayIdx] || '综合练习');
  const today = new Date();
  const offsetLabel = quizDayOffset === 0 ? '今日' : (quizDayOffset < 0 ? `前${-quizDayOffset}天` : `后${quizDayOffset}天`);
  const subEl = document.querySelector('.quiz-header div div:last-child');
  if (subEl) subEl.textContent = `每日自动更新 · 共10道单选 + 1道大题 · 当前查看：${offsetLabel}`;
}

