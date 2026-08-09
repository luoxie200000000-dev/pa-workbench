-- ============================================
-- 迁移 V2 - 新增字段示例（兼容旧数据）
-- ============================================

-- 给 students 表加字段（如果字段已存在则静默忽略）
-- SQLite 不支持 IF NOT EXISTS 语法，通过查询 sqlite_master 来判断

-- 示例1：新增"座位号"字段
-- INSERT OR IGNORE 风格的迁移：先查表结构，不存在才加
-- 注意：SQLite 的 ALTER TABLE 不支持 IF NOT EXISTS
-- 这里用尝试执行的方式，已存在的字段会报错但不影响后续语句
-- 实际使用时请删除以下注释块，或改为执行前先检查

-- ALTER TABLE students ADD COLUMN seat_number TEXT DEFAULT '';

-- 示例2：新增"家长电话"字段
-- ALTER TABLE students ADD COLUMN parent_phone TEXT DEFAULT '';

-- 示例3：新增"备注"字段
-- ALTER TABLE students ADD COLUMN notes TEXT DEFAULT '';

-- ============================================
-- 安全新增字段的标准流程（复制到下一次迁移SQL）
-- ============================================

-- 第1步：记录当前版本
-- INSERT INTO schema_version (version, description) VALUES (2, 'added seat_number, parent_phone, notes');

-- 第2步：逐条加字段，每次只加一个
-- ALTER TABLE students ADD COLUMN seat_number TEXT DEFAULT '';
-- ALTER TABLE students ADD COLUMN parent_phone TEXT DEFAULT '';
-- ALTER TABLE students ADD COLUMN notes TEXT DEFAULT '';

-- 关键规则：
-- 1. 必须用 ADD COLUMN（不是 ADD），且必须有 DEFAULT 值
-- 2. 旧数据的该字段自动填充 DEFAULT 值，不会报错
-- 3. 不能 DELETE 列，不能 RENAME 列（SQLite 限制）
-- 4. 新字段必须放在表的最后
-- 5. 改动后手动改 package.json 里的 version 号
