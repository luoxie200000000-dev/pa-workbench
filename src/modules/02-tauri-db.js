/* ===================== Tauri SQLite DB (inline, no modules) ===================== */
let __db = null;
let __dbReady = false;

// 可靠的 Tauri 环境检测：
// 1) window.__IS_TAURI_APP__ — Rust setup 钩子注入（主检测）
// 2) window.__TAURI_INTERNALS__ — Tauri v2 运行时内置，始终在页面脚本前注入（备用检测）
function isTauriApp() { return !!(window.__IS_TAURI_APP__ || window.__TAURI_INTERNALS__); }

function __invoke(cmd, args) {
  // Tauri v2: 优先使用 __TAURI_INTERNALS__.invoke
  if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') {
    return window.__TAURI_INTERNALS__.invoke(cmd, args || {});
  }
  // Tauri v2 withGlobalTauri / Tauri v1: 使用 __TAURI__.invoke
  if (window.__TAURI__ && typeof window.__TAURI__.invoke === 'function') {
    return window.__TAURI__.invoke(cmd, args || {});
  }
  // Tauri v1 fallback: __TAURI_IPC__
  if (window.__TAURI_IPC__) {
    return window.__TAURI_IPC__(cmd, args || {});
  }
  return Promise.reject('Tauri API not available');
}

const Database = {
  load: function(path) {
    return __invoke('plugin:sql|load', { db: path }).then(function(id) {
      return {
        path: id,
        execute: function(query, values) {
          return __invoke('db_execute', { query: query, values: values || [] })
            .then(function(res) { return { rowsAffected: res[0], lastInsertId: res[1] }; });
        },
        select: function(query, values) {
          return __invoke('plugin:sql|select', { db: this.path, query: query, values: values || [] });
        },
        close: function() {
          return __invoke('plugin:sql|close', { db: this.path });
        }
      };
    });
  }
};

function appDataDir() {
  return __invoke('plugin:path|resolve_directory', { directory: 14 });
}

async function initDB() {
  if (!isTauriApp()) { console.log('[DB] Not in Tauri, skipping DB init'); return; }
  try {
    // 优先使用 Rust 注入的数据库路径
    let dbUrl = window.__TAURI_DB_PATH__ || 'sqlite:workbuddy.db';
    if (dbUrl.indexOf('sqlite:') !== 0) dbUrl = 'sqlite:' + dbUrl.replace(/\\/g, '/');
    // 超时保护：5 秒内数据库未连上则放弃，避免白屏
    const conn = await Promise.race([
      Database.load(dbUrl),
      new Promise(function(_, reject) { setTimeout(function() { reject('DB load timeout (5s)'); }, 5000); })
    ]);
    const cache = {};
    let tables = ['students','homework_records','schedule_config','schedule_periods','schedule_days','schedule_adjustments','settings','news_favorites','progress','scores','app_state'];
    for (let i = 0; i < tables.length; i++) {
      try { cache[tables[i]] = await conn.select('SELECT * FROM ' + tables[i]); } catch(e) { cache[tables[i]] = []; }
    }
    __db = {
      conn: conn, ready: true, cache: cache,
      refreshTable: async function(t) { this.cache[t] = await this.conn.select('SELECT * FROM ' + t); },
      insert: async function(table, row) {
        const cols = Object.keys(row);
        const placeholders = cols.map(function(){ return '?'; }).join(',');
        const values = cols.map(function(k){ return row[k]; });
        await this.conn.execute('INSERT INTO ' + table + ' (' + cols.join(',') + ') VALUES (' + placeholders + ')', values);
        await this.refreshTable(table);
      },
      saveAppState: async function(key, dataJson) {
        let rows = this.cache.app_state || [];
        let exists = false;
        for (let i = 0; i < rows.length; i++) { if (rows[i].state_key === key) { exists = true; break; } }
        if (exists) {
          await this.conn.execute("UPDATE app_state SET state_data = ?, updated_at = datetime('now','localtime') WHERE state_key = ?", [dataJson, key]);
        } else {
          await this.conn.execute("INSERT INTO app_state (state_key, state_data) VALUES (?, ?)", [key, dataJson]);
        }
        await this.refreshTable('app_state');
      },
      getAppState: async function(key) {
        const rows = this.cache.app_state || [];
        for (let i = 0; i < rows.length; i++) {
          if (rows[i].state_key === key) {
            try { return JSON.parse(rows[i].state_data); } catch(e) { return null; }
          }
        }
        return null;
      },
      getDbPath: async function() {
        try { return await __invoke('get_db_path'); } catch(e) { return null; }
      },
      getDbSize: async function() {
        try {
          const pageResult = await this.conn.select('PRAGMA page_count');
          const sizeResult = await this.conn.select('PRAGMA page_size');
          const pages = pageResult[0] ? pageResult[0].page_count : 0;
          const pageSize = sizeResult[0] ? sizeResult[0].page_size : 4096;
          return pages * pageSize;
        } catch(e) { return 0; }
      },
      getTableCounts: async function() {
        const tables = ['students','homework_records','schedule_config','settings','news_favorites','progress','scores','app_state'];
        const counts = {};
        for (let i = 0; i < tables.length; i++) {
          try { let r = await this.conn.select('SELECT COUNT(*) as cnt FROM ' + tables[i]); counts[tables[i]] = r[0] ? r[0].cnt : 0; }
          catch(e) { counts[tables[i]] = 0; }
        }
        return counts;
      }
    };
    window.__db = __db;
    __dbReady = true;
    console.log('[DB] 数据库初始化完成');
    // 通知等待 DB 就绪的代码（_loadFromDB 等可能正在等待此事件）
    window.dispatchEvent(new Event('db-ready'));
  } catch(e) {
    console.error('[DB] 初始化失败:', e);
  }
}

