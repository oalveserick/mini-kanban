const express = require('express');
const router = express.Router();
const pool = require('../db/connection');

// GET /api/tasks — List all active tasks
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tasks WHERE is_archived = FALSE ORDER BY position ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar tarefas:', error);
    res.status(500).json({ error: 'Erro ao buscar tarefas' });
  }
});

// GET /api/tasks/archived — List archived tasks
router.get('/archived', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tasks WHERE is_archived = TRUE ORDER BY archived_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar tarefas arquivadas:', error);
    res.status(500).json({ error: 'Erro ao buscar tarefas arquivadas' });
  }
});

// POST /api/tasks — Create a new task
router.post('/', async (req, res) => {
  try {
    const { title, description, column_id, priority, color } = req.body;

    if (!title || !column_id) {
      return res.status(400).json({ error: 'Título e coluna são obrigatórios' });
    }

    // Get next position in column
    const posResult = await pool.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM tasks WHERE column_id = $1 AND is_archived = FALSE',
      [column_id]
    );
    const position = posResult.rows[0].next_pos;

    const result = await pool.query(
      `INSERT INTO tasks (title, description, column_id, position, priority, color)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [title, description || '', column_id, position, priority || 'medium', color || '#6366f1']
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar tarefa:', error);
    res.status(500).json({ error: 'Erro ao criar tarefa' });
  }
});

// PUT /api/tasks/:id — Update a task
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, priority, color } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Título é obrigatório' });
    }

    const result = await pool.query(
      `UPDATE tasks
       SET title = $1, description = $2, priority = $3, color = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [title, description || '', priority || 'medium', color || '#6366f1', id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar tarefa:', error);
    res.status(500).json({ error: 'Erro ao atualizar tarefa' });
  }
});

// PUT /api/tasks/:id/move — Move task to another column
router.put('/:id/move', async (req, res) => {
  try {
    const { id } = req.params;
    const { column_id, position } = req.body;

    if (column_id === undefined) {
      return res.status(400).json({ error: 'column_id é obrigatório' });
    }

    // Get the new position (end of column if not specified)
    let newPosition = position;
    if (newPosition === undefined) {
      const posResult = await pool.query(
        'SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM tasks WHERE column_id = $1 AND is_archived = FALSE',
        [column_id]
      );
      newPosition = posResult.rows[0].next_pos;
    }

    const result = await pool.query(
      `UPDATE tasks
       SET column_id = $1, position = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [column_id, newPosition, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao mover tarefa:', error);
    res.status(500).json({ error: 'Erro ao mover tarefa' });
  }
});

// PUT /api/tasks/:id/archive — Archive a task
router.put('/:id/archive', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE tasks
       SET is_archived = TRUE, archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao arquivar tarefa:', error);
    res.status(500).json({ error: 'Erro ao arquivar tarefa' });
  }
});

// PUT /api/tasks/:id/restore — Restore a task from archive
router.put('/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;

    // Get the first column (A Fazer) to restore to
    const colResult = await pool.query(
      'SELECT id FROM columns ORDER BY position ASC LIMIT 1'
    );

    if (colResult.rows.length === 0) {
      return res.status(500).json({ error: 'Nenhuma coluna encontrada' });
    }

    const columnId = colResult.rows[0].id;

    // Get next position in column
    const posResult = await pool.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM tasks WHERE column_id = $1 AND is_archived = FALSE',
      [columnId]
    );
    const position = posResult.rows[0].next_pos;

    const result = await pool.query(
      `UPDATE tasks
       SET is_archived = FALSE, archived_at = NULL, column_id = $1, position = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [columnId, position, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao restaurar tarefa:', error);
    res.status(500).json({ error: 'Erro ao restaurar tarefa' });
  }
});

// DELETE /api/tasks/:id — Permanently delete a task
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    res.json({ message: 'Tarefa excluída permanentemente', task: result.rows[0] });
  } catch (error) {
    console.error('Erro ao excluir tarefa:', error);
    res.status(500).json({ error: 'Erro ao excluir tarefa' });
  }
});

module.exports = router;
