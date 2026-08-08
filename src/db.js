// ============================================
// 派大星教学工作台 - SQLite 数据库工具类
// 文件：src/db.js
// 用法：import { initDB, db } from '/db.js';
// ============================================

import Database from "@tauri-apps/plugin-sql";
import { appDataDir } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";

class WorkBuddyDB {
  constructor() {
    this.conn = null;
    this.ready = false;
    this.cache = {}; // 内存缓存，同步读取
  }

  // ==================== 初始化 ====================
  async init() {
    this.conn = await Database.load("sqlite:workbuddy.db");
    // 写操作统一走后端 db_execute 命令（参数化、白名单校验），不再依赖 sql:allow-execute 权限
    const orig = this.conn;
    this.conn = Object.assign(Object.create(orig), {
      execute: function(query, values) {
        return invoke("db_execute", { query: query, values: values || [] })
          .then(function(res) { return { rowsAffected: res[0], lastInsertId: res[1] }; });
      }
    });
    this.ready = true;
    await this._loadCache();
    console.log("[DB] ✅ 数据库初始化完成");
  }

  // 将全量数据加载到内存缓存（同步读）
  async _loadCache() {
    const tables = [
      "students",
      "homework_records",
      "schedule_config",
      "schedule_periods",
      "schedule_days",
      "schedule_adjustments",
      "settings",
      "news_favorites",
      "progress",
      "scores",
      "app_state",
    ];
    for (const t of tables) {
      try {
        this.cache[t] = await this.conn.select(`SELECT * FROM ${t}`);
      } catch (e) {
        this.cache[t] = [];
      }
    }
  }

  // 刷新单个表缓存
  async refreshTable(table) {
    this.cache[table] = await this.conn.select(`SELECT * FROM ${table}`);
  }

  // ==================== 通用CRUD ====================

  /** 新增一条记录 */
  async insert(table, row) {
    const cols = Object.keys(row);
    const placeholders = cols.map(() => "?").join(",");
    const values = cols.map((k) => row[k]);
    const sql = `INSERT INTO ${table} (${cols.join(",")}) VALUES (${placeholders})`;
    await this.conn.execute(sql, values);
    if (row.updated_at === undefined) {
      await this._touch(table);
    }
    await this.refreshTable(table);
  }

  /** 批量新增 */
  async insertBatch(table, rows) {
    for (const row of rows) {
      await this.insert(table, row);
    }
  }

  /** 查询（带条件） */
  async select(table, whereClause = "", params = []) {
    const sql = whereClause
      ? `SELECT * FROM ${table} WHERE ${whereClause}`
      : `SELECT * FROM ${table}`;
    return await this.conn.select(sql, params);
  }

  /** 修改 */
  async update(table, sets, whereClause, params = []) {
    const setStr = Object.keys(sets)
      .map((k) => `${k} = ?`)
      .join(",");
    const setVals = Object.values(sets);
    const sql = `UPDATE ${table} SET ${setStr} WHERE ${whereClause}`;
    await this.conn.execute(sql, [...setVals, ...params]);
    await this._touch(table);
    await this.refreshTable(table);
  }

  /** 删除 */
  async delete(table, whereClause, params = []) {
    const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
    await this.conn.execute(sql, params);
    await this._touch(table);
    await this.refreshTable(table);
  }

  /** 清空表 */
  async truncate(table) {
    await this.conn.execute(`DELETE FROM ${table}`);
    await this.refreshTable(table);
  }

  // ==================== 设置（key-value） ====================
  async getSetting(key) {
    const row = this.cache.settings
      ? this.cache.settings.find((r) => r.key === key)
      : null;
    return row ? row.value : null;
  }

  async setSetting(key, value) {
    const exists = this.cache.settings
      ? this.cache.settings.find((r) => r.key === key)
      : null;
    if (exists) {
      await this.conn.execute(
        "UPDATE settings SET value = ?, updated_at = datetime('now','localtime') WHERE key = ?",
        [value, key]
      );
    } else {
      await this.conn.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?)",
        [key, value]
      );
    }
    await this.refreshTable("settings");
  }

  // ==================== 全量状态快照 ====================

  /** 保存完整应用状态（兼容旧localStorage方式）
   *  性能优化：写库后局部更新内存缓存，省去全表 SELECT 回读大 JSON（原 refreshTable 每次回读整个快照） */
  async saveAppState(key, dataJson) {
    const exists = this.cache.app_state
      ? this.cache.app_state.find((r) => r.state_key === key)
      : null;
    if (exists) {
      await this.conn.execute(
        "UPDATE app_state SET state_data = ?, updated_at = datetime('now','localtime') WHERE state_key = ?",
        [dataJson, key]
      );
      exists.state_data = dataJson;
      exists.updated_at = new Date().toISOString();
    } else {
      await this.conn.execute(
        "INSERT INTO app_state (state_key, state_data) VALUES (?, ?)",
        [key, dataJson]
      );
      if (!this.cache.app_state) this.cache.app_state = [];
      this.cache.app_state.push({ state_key: key, state_data: dataJson, updated_at: new Date().toISOString() });
    }
  }

  /** 读取完整应用状态 */
  async getAppState(key) {
    const row = this.cache.app_state
      ? this.cache.app_state.find((r) => r.state_key === key)
      : null;
    if (!row) return null;
    try {
      return JSON.parse(row.state_data);
    } catch (e) {
      return null;
    }
  }

  // ==================== 学生ABCD分层 ====================
  async getAllStudents() {
    return this.cache.students || [];
  }

  async getStudentsByClass(classId) {
    return (this.cache.students || []).filter((s) => s.class_id === classId);
  }

  async getStudentsByLayer(layer) {
    return (this.cache.students || []).filter((s) => s.layer === layer);
  }

  async saveStudent(student) {
    const id = student.id || this._uid();
    const row = { ...student, id, updated_at: new Date().toISOString() };
    // 解析JSON字段
    if (Array.isArray(row.tags)) row.tags = JSON.stringify(row.tags);
    if (typeof row.homework_stats === "object")
      row.homework_stats = JSON.stringify(row.homework_stats);
    const exists = (this.cache.students || []).find((s) => s.id === id);
    if (exists) {
      await this.update("students", row, "id = ?", [id]);
    } else {
      row.created_at = new Date().toISOString();
      await this.insert("students", row);
    }
  }

  async deleteStudent(id) {
    await this.delete("students", "id = ?", [id]);
  }

  // ==================== 作业抽查记录 ====================
  async getAllHomeworkRecords() {
    return this.cache.homework_records || [];
  }

  async getHomeworkByStudent(studentId) {
    return (this.cache.homework_records || []).filter(
      (r) => r.student_id === studentId
    );
  }

  async saveHomeworkRecord(record) {
    const id = record.id || this._uid();
    const row = { ...record, id, updated_at: new Date().toISOString() };
    const exists = (this.cache.homework_records || []).find(
      (r) => r.id === id
    );
    if (exists) {
      await this.update("homework_records", row, "id = ?", [id]);
    } else {
      row.created_at = new Date().toISOString();
      await this.insert("homework_records", row);
    }
  }

  // ==================== 课表配置 ====================
  async getSchedule() {
    return this.cache.schedule_config || [];
  }

  async saveScheduleItem(item) {
    const id = item.id || this._uid();
    const row = { ...item, id };
    const exists = (this.cache.schedule_config || []).find(
      (r) => r.id === id
    );
    if (exists) {
      await this.update("schedule_config", row, "id = ?", [id]);
    } else {
      await this.insert("schedule_config", row);
    }
  }

  async getSchedulePeriods() {
    return this.cache.schedule_periods || [];
  }

  async saveSchedulePeriods(periods) {
    await this.truncate("schedule_periods");
    if (periods.length > 0) await this.insertBatch("schedule_periods", periods);
  }

  async getScheduleDays() {
    return this.cache.schedule_days || [];
  }

  async saveScheduleDays(days) {
    await this.truncate("schedule_days");
    const rows = days.map((name, i) => ({ idx: i, name }));
    if (rows.length > 0) await this.insertBatch("schedule_days", rows);
  }

  // ==================== 资讯收藏 ====================
  async getNewsFavorites() {
    return this.cache.news_favorites || [];
  }

  async addNewsFavorite(item) {
    const id = item.id || this._uid();
    const row = { ...item, id, saved_at: new Date().toISOString() };
    await this.insert("news_favorites", row);
  }

  async removeNewsFavorite(id) {
    await this.delete("news_favorites", "id = ?", [id]);
  }

  // ==================== 教学进度 ====================
  async getProgress() {
    return this.cache.progress || [];
  }

  async saveProgress(item) {
    const id = item.id || this._uid();
    const row = { ...item, id };
    const exists = (this.cache.progress || []).find((r) => r.id === id);
    if (exists) {
      await this.update("progress", row, "id = ?", [id]);
    } else {
      await this.insert("progress", row);
    }
  }

  // ==================== 成绩 ====================
  async getScores() {
    return this.cache.scores || [];
  }

  async saveScore(score) {
    const id = score.id || this._uid();
    const row = { ...score, id };
    const exists = (this.cache.scores || []).find((r) => r.id === id);
    if (exists) {
      await this.update("scores", row, "id = ?", [id]);
    } else {
      await this.insert("scores", row);
    }
  }

  // ==================== 工具方法 ====================
  _uid() {
    return (
      "x" +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 6)
    );
  }

  async _touch(table) {
    // 更新时间戳，预留扩展
  }

  // 数据库文件路径（开发调试用）
  async getDbPath() {
    try {
      var dir = await appDataDir();
      // 统一路径分隔符
      return dir.replace(/\//g, "\\") + "\\workbuddy.db";
    } catch(e) {
      return null;
    }
  }

  // 数据库文件大小（字节）
  async getDbSize() {
    try {
      var pageResult = await this.conn.select("PRAGMA page_count");
      var sizeResult = await this.conn.select("PRAGMA page_size");
      var pages = pageResult[0] ? pageResult[0].page_count : 0;
      var pageSize = sizeResult[0] ? sizeResult[0].page_size : 4096;
      return pages * pageSize;
    } catch(e) {
      return 0;
    }
  }

  // 各表数据条目数
  async getTableCounts() {
    var tables = ["students", "homework_records", "schedule_config", "settings", "news_favorites", "progress", "scores", "app_state"];
    var counts = {};
    for (var i = 0; i < tables.length; i++) {
      try {
        var r = await this.conn.select("SELECT COUNT(*) as cnt FROM " + tables[i]);
        counts[tables[i]] = r[0] ? r[0].cnt : 0;
      } catch(e) {
        counts[tables[i]] = 0;
      }
    }
    return counts;
  }
}

// 单例导出
export const db = new WorkBuddyDB();

export async function initDB() {
  await db.init();
  // 暴露到全局，方便旧代码调用
  window.__db = db;
}
