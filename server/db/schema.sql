-- TaskFlow Database Schema

-- Drop tables if they exist (for clean re-creation)
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS columns CASCADE;

-- Columns table (board columns like "A Fazer", "Em Progresso", "Concluído")
CREATE TABLE columns (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table
CREATE TABLE tasks (
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

-- Index for faster queries on active/archived tasks
CREATE INDEX idx_tasks_archived ON tasks(is_archived);
CREATE INDEX idx_tasks_column ON tasks(column_id, position);
