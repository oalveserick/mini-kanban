const express = require('express');
const router = express.Router();
const pool = require('../db/connection');

// GET /api/columns — List all columns with their active tasks
router.get('/', async (req, res) => {
  try {
    const columnsResult = await pool.query(
      'SELECT * FROM columns ORDER BY position ASC'
    );

    const tasksResult = await pool.query(
      'SELECT * FROM tasks WHERE is_archived = FALSE ORDER BY position ASC'
    );

    const columns = columnsResult.rows.map((col) => ({
      ...col,
      tasks: tasksResult.rows.filter((task) => task.column_id === col.id),
    }));

    res.json(columns);
  } catch (error) {
    console.error('Erro ao buscar colunas:', error);
    res.status(500).json({ error: 'Erro ao buscar colunas' });
  }
});

module.exports = router;
