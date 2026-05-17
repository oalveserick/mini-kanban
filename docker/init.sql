-- ============================================
-- TaskFlow — Database Initialization
-- Runs automatically on first container start
-- ============================================

-- Columns table
CREATE TABLE IF NOT EXISTS columns (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    column_id INTEGER REFERENCES columns(id) ON DELETE SET NULL,
    position INTEGER NOT NULL DEFAULT 0,
    priority VARCHAR(20) DEFAULT 'medium',
    color VARCHAR(7) DEFAULT '#6366f1',
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_archived ON tasks(is_archived);
CREATE INDEX IF NOT EXISTS idx_tasks_column ON tasks(column_id, position);

-- Default columns
INSERT INTO columns (name, position) VALUES
    ('A Fazer', 0),
    ('Em Progresso', 1),
    ('Concluído', 2)
ON CONFLICT DO NOTHING;
