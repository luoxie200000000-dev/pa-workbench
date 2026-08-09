-- ============================================
-- 派大星教学工作台 - 数据库初始化建表
-- ============================================

-- 0. 数据库版本跟踪（升级时用于判断是否需要执行新迁移）
CREATE TABLE IF NOT EXISTS schema_version (
    version     INTEGER PRIMARY KEY,
    description TEXT,
    applied_at  TEXT DEFAULT (datetime('now','localtime'))
);
INSERT OR IGNORE INTO schema_version (version, description) VALUES (1, 'create initial tables');

-- 1. 学生ABCD分层数据
CREATE TABLE IF NOT EXISTS students (
    id          TEXT PRIMARY KEY,
    student_no  TEXT NOT NULL,
    name        TEXT NOT NULL,
    gender      TEXT DEFAULT '',
    class_id    TEXT NOT NULL,
    layer       TEXT NOT NULL CHECK(layer IN ('A','B','C','D')),
    score_trend TEXT DEFAULT '',
    tags        TEXT DEFAULT '[]',
    homework_stats TEXT DEFAULT '{}',
    teacher_note   TEXT DEFAULT '',
    created_at  TEXT DEFAULT (datetime('now','localtime')),
    updated_at  TEXT DEFAULT (datetime('now','localtime'))
);

-- 2. 作业抽查记录
CREATE TABLE IF NOT EXISTS homework_records (
    id          TEXT PRIMARY KEY,
    student_id  TEXT NOT NULL,
    class_id    TEXT NOT NULL,
    title       TEXT DEFAULT '',
    score       TEXT DEFAULT '',
    status      TEXT DEFAULT 'normal',
    feedback    TEXT DEFAULT '',
    check_date  TEXT DEFAULT '',
    created_at  TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- 3. 课表配置
CREATE TABLE IF NOT EXISTS schedule_config (
    id       TEXT PRIMARY KEY,
    day      INTEGER NOT NULL,
    period   INTEGER NOT NULL,
    class_id TEXT NOT NULL,
    subject  TEXT DEFAULT '生物',
    created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS schedule_periods (
    n          INTEGER PRIMARY KEY,
    start_time TEXT NOT NULL,
    end_time   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schedule_days (
    idx  INTEGER PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schedule_adjustments (
    id          TEXT PRIMARY KEY,
    date        TEXT DEFAULT '',
    orig_day    TEXT DEFAULT '',
    orig_period INTEGER DEFAULT 0,
    class_id    TEXT DEFAULT '',
    new_day     TEXT DEFAULT '',
    new_period  INTEGER DEFAULT 0,
    reason      TEXT DEFAULT '',
    note        TEXT DEFAULT '',
    created_at  TEXT DEFAULT (datetime('now','localtime'))
);

-- 4. 软件界面设置 (key-value)
CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now','localtime'))
);

-- 5. 资讯收藏
CREATE TABLE IF NOT EXISTS news_favorites (
    id        TEXT PRIMARY KEY,
    title     TEXT NOT NULL,
    url       TEXT DEFAULT '',
    source    TEXT DEFAULT '',
    category  TEXT DEFAULT '',
    summary   TEXT DEFAULT '',
    saved_at  TEXT DEFAULT (datetime('now','localtime'))
);

-- 6. 教学进度记录
CREATE TABLE IF NOT EXISTS progress (
    id          TEXT PRIMARY KEY,
    week        INTEGER DEFAULT 0,
    date        TEXT DEFAULT '',
    class_id    TEXT DEFAULT '',
    content     TEXT DEFAULT '',
    ch_progress TEXT DEFAULT '',
    status      TEXT DEFAULT 'planned',
    reflection  TEXT DEFAULT '',
    created_at  TEXT DEFAULT (datetime('now','localtime'))
);

-- 7. 考试/成绩记录
CREATE TABLE IF NOT EXISTS scores (
    id         TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    name       TEXT DEFAULT '',
    class_id   TEXT DEFAULT '',
    exam_name  TEXT DEFAULT '',
    exam_date  TEXT DEFAULT '',
    score      REAL DEFAULT 0,
    max_score  REAL DEFAULT 100,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- 8. 完整应用状态快照（兼容旧数据搬家）
CREATE TABLE IF NOT EXISTS app_state (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    state_key  TEXT NOT NULL,
    state_data TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_students_class  ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_layer  ON students(layer);
CREATE INDEX IF NOT EXISTS idx_hw_student      ON homework_records(student_id);
CREATE INDEX IF NOT EXISTS idx_scores_student  ON scores(student_id);
CREATE INDEX IF NOT EXISTS idx_scores_exam     ON scores(exam_name);
