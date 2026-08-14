/* ===================== Cloud Sync (S3 按班级) ===================== */


function classToObjectKey(cls) {
  return 'class_' + cls.replace('班', '') + '.json';
}


// ── 云同步栏目树（按派大星工作台真实业务板块划分）──
const CLOUD_SECTIONS = [
  { id: 'center', label: '派大星的统筹中心', icon: '\u{1F5C2}', children: [
    { key: 'tasks', label: '任务清单', scope: 'global' },
    { key: 'plans', label: '教学计划', scope: 'global' },
    { key: 'schedule', label: '智能课程表', scope: 'global', keys: ['schedule', 'schedulePeriods', 'scheduleDays', 'adjustments'] },
    { key: 'progress', label: '教学进度', scope: 'global' },
    { key: 'reminders', label: '提醒事项', scope: 'global' },
    { key: 'folders', label: '文件夹', scope: 'global' }
  ]},
  { id: 'student-mgmt', label: '派大星的学生日常管理', icon: '\u{1F465}', children: [
    { key: 'students', label: '学生档案总库', scope: 'class', classField: 'classId' }
  ]},
  { id: 'student-tasks', label: '学生工作任务', icon: '\u{1F4DD}', children: [
    { key: 'studentTasks', label: '01 任务信息', scope: 'class', classField: 'classIds' },
    { key: 'homeworkRecords', label: '02 作业登记', scope: 'class', classField: 'classId' },
    { key: 'chatMessages', label: '03 聊天框', scope: 'class', classField: 'classId' }
  ]},
  { id: 'learning', label: '学生学情分析', icon: '\u{1F4CA}', children: [
    { key: 'scores', label: '学生成绩分析', scope: 'global' }
  ]},
  { id: 'xiuxian', label: '生物仙途秘境', icon: '\u{1F9EC}', children: [
    { key: 'xiuxian', label: '01 修仙档案总库', scope: 'class', classField: 'classId' },
    { key: 'scoreHistory', label: '灵石积分记录', scope: 'global' }
  ]}
];
const CLOUD_LEAF_MAP = {};
CLOUD_SECTIONS.forEach(function(g) { g.children.forEach(function(c) { CLOUD_LEAF_MAP[c.key] = c; }); });
function cloudLeafByKey(k) { return CLOUD_LEAF_MAP[k]; }
const CLOUD_DEFAULT_SECTIONS = ['homeworkRecords', 'studentTasks', 'chatMessages', 'students', 'scores', 'xiuxian', 'scoreHistory'];
function cloudSectionKeysAll() { return Object.keys(CLOUD_LEAF_MAP); }

function s3Configured(strict) {
  let cfg = state.cstcloudConfig || {};
  if (strict) {
    return cfg.endpoint && cfg.bucket && cfg.accessKey && cfg.secretKey;
  }
  return cfg.endpoint && cfg.accessKey;
}

// 从后端同步 S3 配置到前端 state（启动时调用一次）
// 后端 s3_config.json 是权威源，确保前端 state 与后端一致
async function syncS3ConfigFromBackend() {
  if (!isTauriApp()) return;
  try {
    let cfg = await __invoke('get_s3_config_status');
    if (cfg) {
      // 后端有配置：同步非敏感字段到前端 state（不覆盖 state 中已有的 secretKey）
      state.cstcloudConfig = state.cstcloudConfig || {};
      state.cstcloudConfig.endpoint = cfg.endpoint || state.cstcloudConfig.endpoint || '';
      state.cstcloudConfig.bucket = cfg.bucket || state.cstcloudConfig.bucket || '';
      state.cstcloudConfig.accessKey = cfg.accessKey || state.cstcloudConfig.accessKey || '';
      state.cstcloudConfig.region = cfg.region || state.cstcloudConfig.region || 'us-east-1';
      console.log('[Cloud] S3 配置已从后端同步');
    } else if (state.cstcloudConfig && state.cstcloudConfig.endpoint && state.cstcloudConfig.accessKey && state.cstcloudConfig.secretKey) {
      // 后端无配置但前端 state 有（从旧版本升级）：迁移到后端
      await __invoke('save_s3_config', {
        endpoint: state.cstcloudConfig.endpoint,
        bucket: state.cstcloudConfig.bucket || '',
        accessKey: state.cstcloudConfig.accessKey,
        secretKey: state.cstcloudConfig.secretKey,
        region: state.cstcloudConfig.region || 'us-east-1'
      });
      console.log('[Cloud] 前端 S3 配置已迁移到后端');
    }
  } catch(e) {
    console.warn('[Cloud] 从后端同步 S3 配置失败:', e);
  }
}

let _autoCloudPullDone = false;
function autoCloudPullOnStart() {
  if (_autoCloudPullDone) return;
  _autoCloudPullDone = true;
  const dl = state.cloudDownloadSections || [];
  const dlSecCls = state.cloudDownloadSectionClasses || {};
  if (state.cloudAutoSync && s3Configured() && dl.length) {
    const cls2secs = cloudBuildClassToSectionsMap(dl, dlSecCls);
    const allClasses = Object.keys(cls2secs);
    if (allClasses.length === 0) return;
    updateSyncIndicator('syncing');
    const globalLeaves = dl.map(cloudLeafByKey).filter(function(l) { return l && l.scope === 'global'; });
    const tasks = allClasses.map(function(cls) { return cloudPullByClass(cls, cls2secs[cls]); });
    if (globalLeaves.length) tasks.push(cloudPullGlobal(globalLeaves.map(function(l) { return l.key; })));
    Promise.all(tasks).then(function(res) {
      updateSyncIndicator('synced');
      if (res.some(function(x) { return x; })) {
        let p = state.currentPage || 'tasks';
        if (state.appPassword && !state.passwordUnlocked && !PASSWORD_EXEMPT_PAGES.includes(p)) p = 'st-task-info';
        navigateTo(p);
      }
      console.log('[Cloud] 启动自动下载完成');
    }).catch(function(e) {
      console.warn('[Cloud] Auto-download failed:', e);
      updateSyncIndicator('error');
    });
  }
}

async function cloudPushByClass(cls, sectionKeys) {
  if (!cls) { showToast('请先选择班级', 'warn'); return false; }
  if (!s3Configured()) { showToast('请先配置数据胶囊 S3', 'warn'); return false; }
  let payload = { classId: cls, ts: Date.now() };
  sectionKeys.forEach(function(k) {
    let leaf = cloudLeafByKey(k);
    if (leaf && leaf.scope === 'class') {
      const v = cloudExtractLeaf(leaf, cls);
      if (v !== null) payload[k] = v;
    }
  });
  let objectKey = classToObjectKey(cls);
  await __invoke('s3_upload', { objectKey: objectKey, data: JSON.stringify(payload) });
  state.cloudLastPush = Date.now();
  saveState();
  return true;
}

async function cloudPushGlobal(sectionKeys) {
  if (!s3Configured()) { showToast('请先配置数据胶囊 S3', 'warn'); return false; }
  // 「文件夹」走独立的磁盘→S3 通道（folder_cloud_push），不进 global.json
  let hasFolders = sectionKeys.indexOf('folders') >= 0;
  let nonFolderKeys = sectionKeys.filter(function (k) { return k !== 'folders'; });
  // 全局数据（global.json）通道：失败仅提示，不阻断文件夹上传
  if (nonFolderKeys.length) {
    const payload = { ts: Date.now() };
    nonFolderKeys.forEach(function(k) {
      let leaf = cloudLeafByKey(k);
      if (!leaf || leaf.scope !== 'global') return;
      if (leaf.keys) { leaf.keys.forEach(function(f) { payload[f] = state[f]; }); }
      else { payload[k] = state[k]; }
    });
    try {
      await __invoke('s3_upload', { objectKey: 'global.json', data: JSON.stringify(payload) });
    } catch (e) {
      console.warn('[Cloud] 全局数据上传失败：', e);
      showToast('全局数据上传失败：' + (typeof e === 'string' ? e : (e && e.message ? e.message : String(e))), 'warn');
    }
  }
  state.cloudLastPush = Date.now();
  // 文件夹通道：与 global.json 解耦，独立成败
  if (hasFolders) {
    try {
      let r = await __invoke('folder_cloud_push');
      console.log('[Cloud] 文件夹云上传完成，共 ' + ((r && r.uploaded) || 0) + ' 个文件');
    } catch (e) {
      console.warn('[Cloud] 文件夹云上传失败：', e);
      showToast('文件夹上传失败：' + (typeof e === 'string' ? e : (e && e.message ? e.message : String(e))), 'warn');
    }
  }
  saveState();
  return true;
}

async function cloudPullByClass(cls, sectionKeys) {
  if (!cls) { showToast('请先选择班级', 'warn'); return false; }
  if (!s3Configured()) { showToast('请先配置数据胶囊 S3', 'warn'); return false; }
  const objectKey = classToObjectKey(cls);
  let data;
  try { data = await __invoke('s3_download', { objectKey: objectKey }); }
  catch(e) {
    let errMsg = typeof e === 'string' ? e : (e && e.message ? e.message : String(e));
    if (errMsg.indexOf('NOT_FOUND') >= 0) { showToast('云端暂无 ' + cls + ' 的数据', 'info'); return false; }
    throw e;
  }
  let cloudData = JSON.parse(data);
  sectionKeys.forEach(function(k) {
    let leaf = cloudLeafByKey(k);
    if (leaf && leaf.scope === 'class' && cloudData[k] !== undefined) cloudMergeLeaf(leaf, cloudData[k], cls);
  });
  state.cloudLastPull = Date.now();
  saveState();
  return true;
}

async function cloudPullGlobal(sectionKeys) {
  if (!s3Configured()) { showToast('请先配置数据胶囊 S3', 'warn'); return false; }
  // 「文件夹」走独立的 S3→磁盘 通道（folder_cloud_pull），与 global.json 解耦
  const hasFolders = sectionKeys.indexOf('folders') >= 0;
  const nonFolderKeys = sectionKeys.filter(function (k) { return k !== 'folders'; });
  if (nonFolderKeys.length) {
    let data;
    try { data = await __invoke('s3_download', { objectKey: 'global.json' }); }
    catch (e) {
      const errMsg = typeof e === 'string' ? e : (e && e.message ? e.message : String(e));
      if (errMsg.indexOf('NOT_FOUND') >= 0) { showToast('云端暂无全局数据', 'info'); }
      else throw e;
    }
    if (data) {
      const cloudData = JSON.parse(data);
      nonFolderKeys.forEach(function(k) {
        const leaf = cloudLeafByKey(k);
        if (!leaf || leaf.scope !== 'global') return;
        if (leaf.keys) { leaf.keys.forEach(function(f) { if (cloudData[f] !== undefined) state[f] = cloudData[f]; }); }
        else if (cloudData[k] !== undefined) { state[k] = cloudData[k]; }
      });
    }
  }
  state.cloudLastPull = Date.now();
  if (hasFolders) {
    try {
      const r = await __invoke('folder_cloud_pull');
      console.log('[Cloud] 文件夹云下载完成，共 ' + ((r && r.downloaded) || 0) + ' 个文件');
    } catch (e) {
      console.warn('[Cloud] 文件夹云下载失败：', e);
      showToast('文件夹下载失败：' + (typeof e === 'string' ? e : (e && e.message ? e.message : String(e))), 'warn');
    }
  }
  saveState();
  return true;
}

async function cloudTestConnection() {
  // 测试前先从输入框读取最新值，避免用户忘记点保存或 state 被旧数据覆盖
  let endpoint = (document.getElementById('s3-endpoint').value || '').trim();
  if (endpoint && !endpoint.match(/^https?:\/\//i)) endpoint = 'https://' + endpoint;
  state.cstcloudConfig = state.cstcloudConfig || {};
  state.cstcloudConfig.endpoint = endpoint;
  state.cstcloudConfig.bucket = (document.getElementById('s3-bucket').value || '').trim();
  state.cstcloudConfig.accessKey = (document.getElementById('s3-accesskey').value || '').trim();
  state.cstcloudConfig.secretKey = (document.getElementById('s3-secretkey').value || '').trim();
  state.cstcloudConfig.region = (document.getElementById('s3-region').value || '').trim() || 'us-east-1';
  saveState();

  if (!s3Configured(true)) {
    let cfg = state.cstcloudConfig || {};
    const missing = [];
    if (!cfg.endpoint) missing.push('Endpoint');
    if (!cfg.bucket) missing.push('Bucket');
    if (!cfg.accessKey) missing.push('AccessKey ID');
    if (!cfg.secretKey) missing.push('Secret Access Key');
    showToast('请先完整填写 S3 配置：' + missing.join('、'), 'warn');
    return false;
  }
  // 基础格式校验
  const cfg = state.cstcloudConfig;
  if (!cfg.endpoint.match(/^https?:\/\//i)) {
    cfg.endpoint = 'https://' + cfg.endpoint;
  }
  if (!cfg.region) cfg.region = 'us-east-1';
  saveState();

  // 保存配置到后端文件（凭据不再通过 IPC 在每次同步时反复传递）
  try {
    await __invoke('save_s3_config', {
      endpoint: cfg.endpoint,
      bucket: cfg.bucket,
      accessKey: cfg.accessKey,
      secretKey: cfg.secretKey,
      region: cfg.region
    });
    console.log('[Cloud] S3 配置已保存到后端');
  } catch(e) {
    showToast('保存配置到后端失败: ' + (e.message || String(e)), 'error');
    return false;
  }

  // 测试连接（不传凭据，后端从配置文件读取）
  try {
    updateSyncIndicator('syncing');
    await __invoke('s3_test');
    updateSyncIndicator('synced');
    showToast('数据胶囊连接成功', 'success');
    return true;
  } catch(e) {
    updateSyncIndicator('error');
    const raw = typeof e === 'string' ? e : (e && e.message ? e.message : String(e));
    let msg = raw;
    if (typeof raw === 'string' && raw.includes('401')) {
      msg = 'HTTP 401 Unauthorized（凭证错误）。请按顺序检查：1. Bucket 名称是否填成了 AccessKey ID；2. Secret Access Key 是否完整复制（含斜杠前部分）；3. AccessKey ID 与 Secret Key 是否配对且未过期。';
    } else if (typeof raw === 'string' && raw.includes('404')) {
      msg = 'HTTP 404 Not Found。Bucket 名称可能不存在或 endpoint 错误，请到中国科技云数据胶囊控制台核对。';
    } else if (typeof raw === 'string' && raw.includes('403')) {
      msg = 'HTTP 403 Forbidden。AccessKey 权限不足或已过期，请在控制台重新创建密钥。';
    }
    showToast('连接失败: ' + msg, 'error');
    return false;
  }
}

function saveCstcloudConfig() {
  let endpoint = (document.getElementById('s3-endpoint').value || '').trim();
  if (endpoint && !endpoint.match(/^https?:\/\//i)) {
    endpoint = 'https://' + endpoint;
  }
  state.cstcloudConfig.endpoint = endpoint;
  state.cstcloudConfig.bucket = (document.getElementById('s3-bucket').value || '').trim();
  state.cstcloudConfig.accessKey = (document.getElementById('s3-accesskey').value || '').trim();
  state.cstcloudConfig.secretKey = (document.getElementById('s3-secretkey').value || '').trim();
  state.cstcloudConfig.region = (document.getElementById('s3-region').value || '').trim() || 'us-east-1';
  saveState();
  // 同步保存到后端配置文件（凭据不再通过 IPC 在每次同步时传递）
  if (isTauriApp()) {
    __invoke('save_s3_config', {
      endpoint: state.cstcloudConfig.endpoint,
      bucket: state.cstcloudConfig.bucket,
      accessKey: state.cstcloudConfig.accessKey,
      secretKey: state.cstcloudConfig.secretKey,
      region: state.cstcloudConfig.region
    }).then(function() {
      console.log('[Cloud] S3 配置已同步到后端');
    }).catch(function(e) {
      console.error('[Cloud] 保存到后端失败:', e);
      showToast('警告：配置已保存到本地，但同步到后端失败', 'warn');
    });
  }
  showToast('S3 配置已保存', 'success');
  updateSyncModal();
}

