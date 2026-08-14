-- ============================================
-- 迁移 V3 - 派大星的生物仙途（修仙模块建表）
-- ============================================
-- 形象层由单一企鹅改为 4 池（动物 / 植物 / 人物 / 稀有限定）
-- 其余经济内核字段沿用《生物修仙模块开发指令_v2.0》

-- 0. 记录版本
INSERT OR IGNORE INTO schema_version (version, description) VALUES (3, 'create xiuxian module tables');

-- 1. 形象主数据池（4 池）
CREATE TABLE IF NOT EXISTS xiuxian_characters (
    id           TEXT PRIMARY KEY,
    pool         TEXT NOT NULL CHECK(pool IN ('animal','plant','character','rare')),
    name         TEXT NOT NULL,
    kind         TEXT DEFAULT '',          -- 物种 / 角色类型
    emoji        TEXT DEFAULT '',          -- 临时占位视觉（正式美术资源后续替换）
    rarity       TEXT NOT NULL DEFAULT 'common' CHECK(rarity IN ('common','limited')),
    action       TEXT DEFAULT 'bounce',    -- 动作类型（仿 QQ 企鹅）
    evolution    TEXT DEFAULT '{}',        -- JSON：初/中/后期/突破 各阶段视觉
    source       TEXT DEFAULT '',          -- 获取方式说明
    quota        INTEGER DEFAULT 0,        -- 限定数量（0=不限）
    rank_req     INTEGER DEFAULT 0,        -- 榜单门槛名次（0=无）
    jipin_price  INTEGER DEFAULT 0,        -- 抽取所需极品灵石
    created_at   TEXT DEFAULT (datetime('now','localtime'))
);

-- 2. 学生修仙档案
CREATE TABLE IF NOT EXISTS xiuxian_students (
    student_id   TEXT PRIMARY KEY,
    name         TEXT DEFAULT '',
    class_id     TEXT DEFAULT '',
    character_id TEXT DEFAULT '',          -- 关联 xiuxian_characters.id
    realm        INTEGER DEFAULT 0,        -- 境界序号 0~6
    realm_stage  TEXT DEFAULT '初期',       -- 初期/中期/后期
    linggen      TEXT DEFAULT '凡品',       -- 灵根品级（按最新成绩划分）
    linggen_name TEXT DEFAULT '',
    spirit       REAL DEFAULT 0,           -- 当前灵气
    spirit_cap   REAL DEFAULT 80,          -- 当前境界灵气上限
    stone        INTEGER DEFAULT 15,       -- 灵石（新手礼包 15）
    premium_stone INTEGER DEFAULT 0,       -- 极品灵石
    switch_used  INTEGER DEFAULT 0,        -- 是否已用免费切换(0/1)
    pity_count   INTEGER DEFAULT 0,        -- 极品灵石保底计数
    breakthrough_tier INTEGER DEFAULT 1,  -- 当前突破档位(1-4)
    squad_id     TEXT DEFAULT '',          -- 小队编号 1~7
    is_leader    INTEGER DEFAULT 0,        -- 是否小队长
    created_at   TEXT DEFAULT (datetime('now','localtime')),
    updated_at   TEXT DEFAULT (datetime('now','localtime'))
);

-- 3. 背包（功法 / 丹药 / 外观等）— 阶段4商城启用
CREATE TABLE IF NOT EXISTS xiuxian_bag (
    id          TEXT PRIMARY KEY,
    student_id  TEXT NOT NULL,
    item_type   TEXT DEFAULT '',
    item_id     TEXT DEFAULT '',
    qty         INTEGER DEFAULT 1
);

-- 4. 行为日志
CREATE TABLE IF NOT EXISTS xiuxian_log (
    id          TEXT PRIMARY KEY,
    student_id  TEXT DEFAULT '',
    ts          TEXT DEFAULT (datetime('now','localtime')),
    event_type  TEXT DEFAULT '',
    detail      TEXT DEFAULT ''
);

-- 5. 商城物品（内嵌于每个角色修炼主页）— 阶段4启用
CREATE TABLE IF NOT EXISTS xiuxian_mall (
    id          TEXT PRIMARY KEY,
    category    TEXT DEFAULT '',           -- 功法/丹药/灵宠道具/外观
    name        TEXT NOT NULL,
    price_type  TEXT DEFAULT 'stone' CHECK(price_type IN ('stone','premium')),
    price       INTEGER DEFAULT 0,
    stock       INTEGER DEFAULT -1,        -- -1=不限
    desc        TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_xs_class  ON xiuxian_students(class_id);
CREATE INDEX IF NOT EXISTS idx_xs_squad  ON xiuxian_students(squad_id);
CREATE INDEX IF NOT EXISTS idx_xs_char   ON xiuxian_students(character_id);
CREATE INDEX IF NOT EXISTS idx_bag_stu   ON xiuxian_bag(student_id);
